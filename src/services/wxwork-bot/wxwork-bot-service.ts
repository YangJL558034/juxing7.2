/**
 * 企业微信长连接机器人服务
 * 仅对接企业微信WebSocket长连接，简化版本
 * 
 * 使用方法：
 * 1. 在企业微信管理后台创建智能机器人，获取 Bot ID 和 Secret
 * 2. 运行：pnpm exec ts-node src/services/wxwork-bot/wxwork-bot-service.ts
 * 
 * 环境变量：
 * WXWORK_BOT_ID=aiB-xxxxxxxxxxxxxxxxxx
 * WXWORK_BOT_SECRET=xxxxxxxxxxxxxxxxxx
 * WXWORK_API_URL=http://localhost:5000/api/generate
 */

import WebSocket from 'ws';
import https from 'https';
import http from 'http';
import { formatChinaDateTime } from '@/lib/china-time';

interface Config {
  botId: string;
  botSecret: string;
  apiUrl?: string;
}

interface IntentResult {
  intent: string;
  documentType: string;
  params: Record<string, string>;
  confidence: number;
}

const DOCUMENT_TYPE_MAP: Record<string, { intent: string; keywords: string[] }> = {
  'purchase_request': { intent: '采购申请', keywords: ['采购申请', '请购单', '采购单', '购买申请'] },
  'expense_claim': { intent: '报销申请', keywords: ['报销', '报销单', '费用报销'] },
  'contract': { intent: '合同', keywords: ['合同', '合同模板'] },
  'invoice': { intent: '发票', keywords: ['发票', '开票'] },
  'registration_code': { intent: '注册码', keywords: ['注册码', '邀请码'] },
  'customer': { intent: '客户', keywords: ['客户', '客户信息'] },
  'opportunity': { intent: '商机', keywords: ['商机', '销售机会'] },
  'approval': { intent: '审批', keywords: ['审批', '待审批'] },
  'help': { intent: '帮助', keywords: ['帮助', '功能介绍'] },
};

function loadConfig(): Config {
  return {
    botId: process.env.WXWORK_BOT_ID || '',
    botSecret: process.env.WXWORK_BOT_SECRET || '',
    apiUrl: process.env.WXWORK_API_URL || 'http://localhost:5000/api/generate',
  };
}

function log(level: string, message: string, ...args: any[]) {
  const timestamp = formatChinaDateTime(new Date());
  console.log(`[${timestamp}] [${level}] ${message}`, ...args);
}

async function getAccessToken(botId: string, botSecret: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(botId)}&corpsecret=${encodeURIComponent(botSecret)}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            resolve(result.access_token);
          } else {
            reject(new Error(`获取Token失败: ${result.errmsg || '未知错误'}`));
          }
        } catch (e) {
          reject(new Error(`解析响应失败: ${e}`));
        }
      });
    }).on('error', (e) => reject(new Error(`网络请求失败: ${e}`)));
  });
}

function fuzzyMatchIntent(message: string): { key: string; intent: string; confidence: number } {
  const lowerMessage = message.toLowerCase();
  let bestMatch = { key: 'unknown', intent: '未知', confidence: 0 };

  for (const [key, config] of Object.entries(DOCUMENT_TYPE_MAP)) {
    let matchedCount = 0;
    for (const keyword of config.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        matchedCount++;
      }
    }
    const confidence = matchedCount > 0 ? (matchedCount / config.keywords.length) * 100 : 0;
    if (confidence > bestMatch.confidence) {
      bestMatch = { key, intent: config.intent, confidence };
    }
  }
  return bestMatch;
}

function extractParams(message: string, documentType: string): Record<string, string> {
  const params: Record<string, string> = {};
  const countMatch = message.match(/(\d+)\s*个|(\d+)\s*份|数量\s*[为是:：]\s*(\d+)/);
  if (countMatch) {
    const count = countMatch.find(c => c && !isNaN(parseInt(c)));
    if (count) params.count = count;
  }
  const amountMatch = message.match(/(\d+(?:\.\d{1,2})?)\s*元|金额\s*[为是:：]\s*(\d+(?:\.\d{1,2})?)/);
  if (amountMatch) {
    const amount = amountMatch.find(a => a && !isNaN(parseFloat(a)));
    if (amount) params.amount = amount;
  }
  return params;
}

async function callGenerateAPI(url: string, intentResult: IntentResult): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      intent: intentResult.intent,
      documentType: intentResult.documentType,
      params: intentResult.params,
      confidence: intentResult.confidence,
    });

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 30000,
    };

    const protocol = urlObj.protocol === 'https:' ? https : require('http');
    const req = protocol.request(options, (res: http.IncomingMessage) => {
      let data = '';
      res.on('data', (chunk: string) => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result.message || result.result || '处理完成');
        } catch {
          resolve(data || '处理完成');
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    req.write(postData);
    req.end();
  });
}

class WxWorkBotService {
  private config: Config;
  private ws: WebSocket | null = null;
  private accessToken: string = '';
  private tokenExpireTime: number = 0;
  private running: boolean = false;
  private reconnectAttempts: number = 0;

  constructor(config: Config) {
    this.config = config;
  }

  async start() {
    if (!this.config.botId || !this.config.botSecret) {
      throw new Error('请配置 WXWORK_BOT_ID 和 WXWORK_BOT_SECRET 环境变量');
    }

    log('info', '========================================');
    log('info', '   企业微信长连接机器人启动中...');
    log('info', '========================================');
    log('info', `Bot ID: ${this.config.botId}`);
    log('info', `API地址: ${this.config.apiUrl}`);

    try {
      await this.refreshToken();
      await this.connectWebSocket();
      this.running = true;
      log('info', '========================================');
      log('info', '   机器人启动成功！');
      log('info', '========================================');
    } catch (error) {
      log('error', '启动失败:', error);
      throw error;
    }
  }

  async refreshToken() {
    log('info', '正在获取Access Token...');
    this.accessToken = await getAccessToken(this.config.botId, this.config.botSecret);
    this.tokenExpireTime = Date.now() + (2 * 60 * 60 * 1000) - (5 * 60 * 1000);
    log('info', 'Access Token获取成功');
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      const url = `wss://qyapi.weixin.qq.com/ws/chat?access_token=${this.accessToken}`;
      log('info', `连接WebSocket: ${url}`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        log('info', 'WebSocket连接已建立');
        this.reconnectAttempts = 0;
        
        // 发送 aibot_subscribe 指令完成身份校验
        this.subscribeBot();
        
        this.startHeartbeat();
        resolve(null);
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message);
        } catch (error) {
          log('error', '处理消息失败:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        log('warn', `WebSocket连接断开: code=${code}, reason=${reason}`);
        this.stopHeartbeat();
        if (this.running) {
          this.reconnect();
        }
      });

      this.ws.on('error', (error) => {
        log('error', 'WebSocket错误:', error);
        reject(error);
      });
    });
  }

  async handleMessage(message: any) {
    log('info', '收到消息:', JSON.stringify(message));

    if (!message || !message.Content) return;

    const { Content, FromUserName } = message;
    log('info', `用户 ${FromUserName} 发送: ${Content}`);

    try {
      const matched = fuzzyMatchIntent(Content);
      const intentResult: IntentResult = {
        intent: matched.intent,
        documentType: matched.key,
        params: extractParams(Content, matched.key),
        confidence: matched.confidence
      };

      let reply: string;

      if (intentResult.documentType === 'help' || intentResult.confidence < 10) {
        reply = `👋 您好！我是聚小星AI助手，我可以帮您处理：\n• 采购申请\n• 报销申请\n• 合同生成\n• 发票开具\n• 注册码生成\n• 客户查询\n• 商机统计\n• 审批查询\n\n直接告诉我您的需求！`;
      } else if (this.config.apiUrl) {
        try {
          const apiResponse = await callGenerateAPI(this.config.apiUrl, intentResult);
          reply = apiResponse;
        } catch (apiError: unknown) {
          log('error', 'API调用失败:', apiError);
          const errorMessage = apiError instanceof Error ? apiError.message : '未知错误';
          reply = `😔 处理失败：${errorMessage}\n请稍后重试或直接进入系统操作。`;
        }
      } else {
        reply = `👍 已识别您的意图：${intentResult.intent}`;
      }

      this.sendReply(FromUserName, reply);
    } catch (error: unknown) {
      log('error', '处理消息异常:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.sendReply(FromUserName, `😔 处理失败：${errorMessage}`);
    }
  }

  private sendReply(toUserName: string, content: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const response = JSON.stringify({
        ToUserName: toUserName,
        Content: content,
        MsgType: 'text',
      });
      this.ws.send(response);
      log('info', `已回复用户 ${toUserName}`);
    }
  }

  /**
   * 发送 aibot_subscribe 指令完成身份校验
   * 根据企业微信官方文档，长连接建立后必须发送此指令进行身份认证
   */
  private subscribeBot() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscribeMsg = JSON.stringify({
        action: 'aibot_subscribe',
        data: {
          bot_id: this.config.botId,
          bot_secret: this.config.botSecret
        }
      });
      this.ws.send(subscribeMsg);
      log('info', '已发送 aibot_subscribe 身份校验指令');
    }
  }

  private heartbeatTimer: NodeJS.Timeout | null = null;

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() >= this.tokenExpireTime) {
        this.refreshToken().catch(console.error);
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async reconnect() {
    if (this.reconnectAttempts >= 10) {
      log('error', '达到最大重连次数');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectAttempts * 5000, 30000);
    log('info', `${delay / 1000}秒后尝试第${this.reconnectAttempts}次重连...`);

    setTimeout(async () => {
      try {
        await this.refreshToken();
        await this.connectWebSocket();
      } catch (error) {
        log('error', '重连失败:', error);
        this.reconnect();
      }
    }, delay);
  }

  stop() {
    log('info', '正在停止机器人...');
    this.running = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    log('info', '机器人已停止');
  }
}

async function main() {
  const config = loadConfig();
  const bot = new WxWorkBotService(config);

  process.on('SIGINT', () => { bot.stop(); process.exit(0); });
  process.on('SIGTERM', () => { bot.stop(); process.exit(0); });

  try {
    await bot.start();
  } catch (error) {
    log('error', '启动失败:', error);
    process.exit(1);
  }
}

main();
