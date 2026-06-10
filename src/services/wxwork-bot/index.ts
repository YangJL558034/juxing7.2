/**
 * 企业微信智能机器人 - 长连接模式
 * 
 * 功能：
 * - 使用企业微信官方 WebSocket 长连接 SDK
 * - 接收用户消息并调用生成管理模块 API
 * - 自动回复处理结果
 * 
 * 使用方法：
 * 1. 在系统设置中配置 Bot ID、Secret 和 API 地址
 * 2. 运行：npx ts-node src/services/wxwork-bot/index.ts
 * 
 * 后期修改配置：
 * - 配置文件：src/services/wxwork-bot/config.ts
 * - 或设置环境变量
 */

import WebSocket from 'ws';
import https from 'https';
import http from 'http';
import { wxWorkBotConfig, apiConfig, logConfig, wsConfig } from './config.js';
import { formatChinaDateTime } from '@/lib/china-time';

// 日志工具
function log(level: string, message: string, ...args: any[]) {
  const timestamp = formatChinaDateTime(new Date());
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (logConfig.console) {
    switch (level) {
      case 'debug':
        console.debug(logMessage, ...args);
        break;
      case 'info':
        console.info(logMessage, ...args);
        break;
      case 'warn':
        console.warn(logMessage, ...args);
        break;
      case 'error':
        console.error(logMessage, ...args);
        break;
    }
  }
}

// 消息类型定义
interface WxWorkMessage {
  msgId: string;
  toUserName: string;
  fromUserName: string;
  createTime: number;
  msgType: string;
  content: string;
  event?: string;
}

// 消息处理结果
interface ProcessResult {
  success: boolean;
  message: string;
  data?: any;
}

// 企业微信长连接 SDK 类
class WxWorkBot {
  private ws: WebSocket | null = null;
  private token: string = '';
  private baseUrl: string = 'https://qyapi.weixin.qq.com';
  private reconnectAttempts: number = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;

  constructor(
    private botId: string,
    private botSecret: string
  ) {
    if (!botId || !botSecret) {
      throw new Error('Bot ID 和 Secret 不能为空');
    }
  }

  /**
   * 获取调用 API 的 Access Token
   */
  async getAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}/cgi-bin/gettoken?corpid=${this.botId}&corpsecret=${this.botSecret}`;
      
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.access_token) {
              this.token = result.access_token;
              resolve(result.access_token);
            } else {
              reject(new Error(`获取 Token 失败: ${result.errmsg}`));
            }
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * 启动长连接
   */
  async start(): Promise<void> {
    log('info', '正在获取 Access Token...');
    
    try {
      await this.getAccessToken();
      log('info', 'Access Token 获取成功');
      
      await this.connectWebSocket();
    } catch (error) {
      log('error', '启动失败:', error);
      throw error;
    }
  }

  /**
   * 建立 WebSocket 连接
   */
  async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 获取 WebSocket 连接地址
      const wsUrl = `${this.baseUrl}/cgi-bin/ws/execute?access_token=${this.token}`;
      
      log('info', '正在建立长连接...');
      
      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        log('info', '长连接已建立');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve();
      });

      this.ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(message);
        } catch (error) {
          log('error', '处理消息失败:', error);
        }
      });

      this.ws.on('close', () => {
        log('warn', '长连接已断开');
        this.isConnected = false;
        this.stopHeartbeat();
        this.reconnect();
      });

      this.ws.on('error', (error) => {
        log('error', 'WebSocket 错误:', error);
        reject(error);
      });
    });
  }

  /**
   * 处理接收到的消息
   */
  async handleMessage(message: any): Promise<void> {
    log('info', '收到消息:', JSON.stringify(message));

    // 消息类型：推事件
    if (message.msgType === 'text') {
      const userMessage = message.content as string;
      const userId = message.fromUserName;
      
      log('info', `用户 ${userId} 发送: ${userMessage}`);

      // 调用生成管理 API
      const result = await this.callGenerateAPI(userMessage);

      // 回复用户
      await this.sendMessage(userId, result.message);
    }
  }

  /**
   * 调用生成管理 API
   */
  async callGenerateAPI(command: string): Promise<ProcessResult> {
    log('info', '调用生成管理 API，指令:', command);

    const { apiUrl, authToken } = wxWorkBotConfig;
    
    if (!apiUrl) {
      return {
        success: false,
        message: '生成管理 API 地址未配置'
      };
    }

    return new Promise((resolve) => {
      const postData = JSON.stringify({
        command,
        timestamp: Date.now()
      });

      const urlObj = new URL(apiUrl);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        timeout: apiConfig.timeout
      };

      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            log('info', 'API 返回:', result);
            resolve({
              success: true,
              message: result.message || result.result || JSON.stringify(result),
              data: result
            });
          } catch {
            resolve({
              success: true,
              message: data
            });
          }
        });
      });

      req.on('error', (error) => {
        log('error', 'API 调用失败:', error);
        resolve({
          success: false,
          message: `API 调用失败: ${error.message}`
        });
      });

      req.on('timeout', () => {
        req.destroy();
        log('error', 'API 调用超时');
        resolve({
          success: false,
          message: 'API 调用超时，请稍后重试'
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 发送消息给用户
   */
  async sendMessage(toUser: string, content: string): Promise<void> {
    log('info', `向用户 ${toUser} 发送消息: ${content}`);

    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        toUser,
        msgType: 'text',
        content
      });

      const url = `${this.baseUrl}/cgi-bin/message/send?access_token=${this.token}`;
      
      const req = https.request(url, { method: 'POST' }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.errcode === 0) {
              log('info', '消息发送成功');
            } else {
              log('error', '消息发送失败:', result.errmsg);
            }
          } catch {
            log('error', '解析响应失败:', data);
          }
          resolve();
        });
      });

      req.on('error', (error) => {
        log('error', '发送消息失败:', error);
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        log('debug', '发送心跳');
      }
    }, wsConfig.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 重新连接
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= wsConfig.maxReconnectAttempts) {
      log('error', '达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    log('info', `${wsConfig.reconnectInterval / 1000}秒后尝试第${this.reconnectAttempts}次重连...`);

    setTimeout(async () => {
      try {
        await this.getAccessToken();
        await this.connectWebSocket();
      } catch (error) {
        log('error', '重连失败:', error);
        this.reconnect();
      }
    }, wsConfig.reconnectInterval);
  }

  /**
   * 停止机器人
   */
  stop(): void {
    log('info', '正在停止机器人...');
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    log('info', '机器人已停止');
  }

  /**
   * 获取运行状态
   */
  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// 导出类型和类
export type { WxWorkMessage, ProcessResult };
export { WxWorkBot };

// 主函数
async function main() {
  const { botId, botSecret } = wxWorkBotConfig;

  if (!botId || !botSecret) {
    log('error', '请先配置 Bot ID 和 Secret');
    log('error', '在系统设置的企业微信机器人配置中填写，或设置环境变量 WXWORK_BOT_ID 和 WXWORK_BOT_SECRET');
    process.exit(1);
  }

  log('info', '========================================');
  log('info', '   企业微信智能机器人启动中...');
  log('info', '========================================');
  log('info', `Bot ID: ${botId}`);
  log('info', `API 地址: ${wxWorkBotConfig.apiUrl || '未配置'}`);

  const bot = new WxWorkBot(botId, botSecret);

  // 启动机器人
  try {
    await bot.start();
    log('info', '========================================');
    log('info', '   机器人已成功启动！');
    log('info', '========================================');
  } catch (error) {
    log('error', '机器人启动失败:', error);
    process.exit(1);
  }

  // 优雅退出
  process.on('SIGINT', () => {
    log('info', '收到退出信号');
    bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('info', '收到终止信号');
    bot.stop();
    process.exit(0);
  });
}

// 运行主函数
main().catch((error) => {
  log('error', '主函数执行失败:', error);
  process.exit(1);
});
