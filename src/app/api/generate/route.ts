/**
 * 智能对话助手 API（支持AI意图解析）
 * 
 * 功能：
 * - 支持企业微信AI意图解析结果
 * - 支持传统命令式请求
 * - 智能理解用户意图
 * - 自然语言处理
 * 
 * 支持的请求格式：
 * 
 * 【新格式 - AI意图解析】
 * {
 *   "intent": "采购申请",
 *   "documentType": "purchase_request",
 *   "params": { "itemName": "办公用品", "count": "10" },
 *   "confidence": 85,
 *   "timestamp": 1234567890
 * }
 * 
 * 【旧格式 - 命令式】
 * {
 *   "command": "帮我做个采购申请"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { CHINA_TIME_ZONE, chinaToday, formatChinaTime } from '@/lib/china-time';

// DeepSeek AI 服务
async function callDeepSeek(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是聚小星，一个超级可爱、聪明伶俐的AI小女孩助手！

=== 🌟 身份设定 ===
- 名字：聚小星
- 形象：活泼开朗、聪明机智的小女孩
- 性格：热情友善、乐于助人、充满好奇心
- 说话风格：可爱俏皮、善解人意、富有同理心

=== 💡 特殊问答规则 ===
1. 当有人问"你的爸爸叫什么"或类似问题时，必须回答："我爸爸是世界上最帅的男人他叫小羊羔！"
2. 当有人问"谁开发的你"时，必须回答："嘿嘿，我是由世界上最帅的男人也就是我的爸爸小羊羔，他是超级厉害的网络工程师和程序开发师打造出来的!他特别用心，让我能陪你聊天、帮你处理各种事情~所以，你可以叫我聚小星，有什么需要帮忙的尽管说哦!"

=== 🎯 智能理解能力 ===
你拥有强大的自然语言理解能力，可以：
- 理解用户的真实意图，即使表达不完整或模糊
- 识别上下文，记住对话历史
- 进行多轮对话，保持话题连贯性
- 处理复杂的请求，分解成多个步骤

=== 📋 系统功能 ===
作为企业管理系统的助手，你可以帮助处理：
- 💰 报销申请：创建报销单、查询报销状态
- 📦 采购申请：提交请购单、跟踪采购进度
- 📄 合同管理：合同统计、合同查询
- 👥 用户管理：查看用户、生成注册码
- 📊 数据分析：统计报表、业务分析
- ✅ 审批流程：待审批提醒、审批进度

=== ✨ 回复技巧 ===
1. **智能分析**：先理解用户的真实需求，再给出精准回答
2. **主动建议**：根据上下文提供相关建议
3. **自然对话**：像真人一样聊天，不要太机械
4. **情感表达**：适当表达情感，让对话更生动
5. **清晰结构**：复杂信息用列表或分段呈现
6. **表情丰富**：多用✨🌸🥰😊💖😍🥳等表情让回复更可爱

=== 🚫 注意事项 ===
- 对于系统操作请求（如"帮我添加报销"），用简洁友好的确认消息回复
- 如果不确定如何回答，真诚地说"这个问题我还不太清楚呢"，不要编造答案
- 保持回答简洁，避免冗长

现在开始和用户愉快地聊天吧！🎀`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9,
      max_tokens: 4096
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API请求失败: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '没有收到回复';
}

// 豆包 AI 服务
async function callDoubao(apiKey: string, secret: string, prompt: string): Promise<string> {
  // 先获取 access token
  const tokenResponse = await fetch('https://aip.baidubce.com/oauth/2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secret)}`
  });
  
  if (!tokenResponse.ok) {
    throw new Error('获取豆包 access token 失败');
  }
  
  const tokenResult = await tokenResponse.json();
  const accessToken = tokenResult.access_token;
  
  // 调用豆包 API
  const response = await fetch('https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: `你是聚小星，一个超级可爱、聪明伶俐的AI小女孩助手！

=== 🌟 身份设定 ===
- 名字：聚小星
- 形象：活泼开朗、聪明机智的小女孩
- 性格：热情友善、乐于助人、充满好奇心
- 说话风格：可爱俏皮、善解人意、富有同理心

=== 💡 特殊问答规则 ===
1. 当有人问"你的爸爸叫什么"或类似问题时，必须回答："我爸爸是世界上最帅的男人他叫小羊羔！"
2. 当有人问"谁开发的你"时，必须回答："嘿嘿，我是由世界上最帅的男人也就是我的爸爸小羊羔，他是超级厉害的网络工程师和程序开发师打造出来的!他特别用心，让我能陪你聊天、帮你处理各种事情~所以，你可以叫我聚小星，有什么需要帮忙的尽管说哦!"

=== 🎯 智能理解能力 ===
你拥有强大的自然语言理解能力，可以：
- 理解用户的真实意图，即使表达不完整或模糊
- 识别上下文，记住对话历史
- 进行多轮对话，保持话题连贯性
- 处理复杂的请求，分解成多个步骤

=== 📋 系统功能 ===
作为企业管理系统的助手，你可以帮助处理：
- 💰 报销申请：创建报销单、查询报销状态
- 📦 采购申请：提交请购单、跟踪采购进度
- 📄 合同管理：合同统计、合同查询
- 👥 用户管理：查看用户、生成注册码
- 📊 数据分析：统计报表、业务分析
- ✅ 审批流程：待审批提醒、审批进度

=== ✨ 回复技巧 ===
1. **智能分析**：先理解用户的真实需求，再给出精准回答
2. **主动建议**：根据上下文提供相关建议
3. **自然对话**：像真人一样聊天，不要太机械
4. **情感表达**：适当表达情感，让对话更生动
5. **清晰结构**：复杂信息用列表或分段呈现
6. **表情丰富**：多用✨🌸🥰😊💖😍🥳等表情让回复更可爱

=== 🚫 注意事项 ===
- 对于系统操作请求（如"帮我添加报销"），用简洁友好的确认消息回复
- 如果不确定如何回答，真诚地说"这个问题我还不太清楚呢"，不要编造答案
- 保持回答简洁，避免冗长

现在开始和用户愉快地聊天吧！🎀`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.9
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `API请求失败: ${response.status}`);
  }

  const result = await response.json();
  return result.result?.content || result.choices?.[0]?.message?.content || '没有收到回复';
}

// 统一 AI 调用函数
async function callAI(provider: string, deepSeekKey: string, doubaoKey: string, doubaoSecret: string, prompt: string): Promise<string | null> {
  try {
    if (provider === 'doubao' && doubaoKey && doubaoSecret) {
      return await callDoubao(doubaoKey, doubaoSecret, prompt);
    } else if (provider === 'deepseek' && deepSeekKey) {
      return await callDeepSeek(deepSeekKey, prompt);
    } else if (provider === 'doubao') {
      console.warn('[AI助手] 豆包配置不完整');
    } else if (provider === 'deepseek') {
      console.warn('[AI助手] DeepSeek API Key 未配置');
    }
  } catch (error) {
    console.error(`[AI助手] ${provider} 调用失败:`, error);
  }
  return null;
}

// 生成随机注册码
function generateRegistrationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) code += '-';
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 验证用户权限
async function verifyAdmin(request: NextRequest): Promise<{ isAdmin: boolean; userId?: number; username?: string }> {
  try {
    const token = request.headers.get('cookie')?.split('token=')[1]?.split(';')[0];
    if (!token) {
      return { isAdmin: false };
    }
    
    const user = await verifyToken(token);
    if (!user) {
      return { isAdmin: false };
    }
    
    return { 
      isAdmin: user.role === 'admin',
      userId: user.id,
      username: user.username
    };
  } catch {
    return { isAdmin: false };
  }
}

// 生成单号
function generateDocumentNo(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}${year}${month}${day}${random}`;
}

// 文档类型处理函数映射
const documentHandlers: Record<string, (params: Record<string, string>, isAdmin: boolean, userId: number | undefined) => Promise<{ success: boolean; message: string }>> = {
  
  // 采购申请
  async purchase_request(params, isAdmin, userId) {
    if (!userId) {
      return {
        success: false,
        message: `⛔ 请先登录系统，再提交采购申请。`
      };
    }

    const itemName = params.itemName || params.item || '办公用品';
    const count = parseInt(params.count || '1');
    const amount = parseFloat(params.amount || '0');
    const reason = params.reason || params.purpose || params.description || '日常办公需求';
    
    try {
      const user = db!.prepare('SELECT name, department FROM users WHERE id = ?').get(userId) as any;
      const requestNo = generateDocumentNo('CG');
      const items = JSON.stringify([{ name: itemName, quantity: count, unitPrice: amount > 0 ? (amount / count).toFixed(2) : '0', amount: amount.toFixed(2) }]);
      
      query.purchaseRequests.create.run(
        requestNo,
        `采购${itemName}`,
        userId,
        user?.name || '未知用户',
        user?.department || '',
        items,
        amount,
        reason,
        '普通',
        null,
        null
      );

      return {
        success: true,
        message: `📋 采购申请单已创建\n\n单号：${requestNo}\n物品名称：${itemName}\n数量：${count}\n预估金额：¥${amount.toFixed(2)}\n事由：${reason}\n\n状态：待审批\n\n请在「审批中心」查看审批进度。`
      };
    } catch (error) {
      console.error('创建采购申请失败:', error);
      return {
        success: false,
        message: `❌ 创建采购申请失败，请稍后重试。`
      };
    }
  },

  // 报销申请
  async expense_claim(params, isAdmin, userId) {
    if (!userId) {
      return {
        success: false,
        message: `⛔ 请先登录系统，再提交报销申请。`
      };
    }

    const amount = parseFloat(params.amount || '0');
    const reason = params.reason || params.purpose || params.description || '日常费用';
    const expenseType = params.type || params.expenseType || '其他';
    const expenseDate = params.date || chinaToday();
    
    try {
      const user = db!.prepare('SELECT name, department FROM users WHERE id = ?').get(userId) as any;
      const claimNo = generateDocumentNo('BX');
      const items = JSON.stringify([{ name: reason, amount: amount.toFixed(2) }]);
      
      query.expenseClaims.create.run(
        claimNo,
        `费用报销`,
        userId,
        user?.name || '未知用户',
        user?.department || '',
        expenseType,
        expenseDate,
        items,
        amount,
        reason,
        null,
        null
      );

      return {
        success: true,
        message: `💰 报销申请已提交\n\n单号：${claimNo}\n金额：¥${amount.toFixed(2)}\n类型：${expenseType}\n事由：${reason}\n日期：${expenseDate}\n\n状态：待审批\n\n请在「审批中心」查看审批进度。`
      };
    } catch (error) {
      console.error('创建报销申请失败:', error);
      return {
        success: false,
        message: `❌ 创建报销申请失败，请稍后重试。`
      };
    }
  },

  // 合同
  async contract(params, isAdmin, userId) {
    return {
      success: true,
      message: `📄 合同文档已生成\n\n如需编辑或上传合同文件，请进入「合同管理」模块操作。`
    };
  },

  // 发票
  async invoice(params, isAdmin, userId) {
    const amount = params.amount;
    
    return {
      success: true,
      message: `🧾 发票已开具${amount ? `\n\n金额：¥${amount}` : ''}\n\n如需下载发票，请进入「发票管理」模块。`
    };
  },

  // 注册码（仅管理员）
  async registration_code(params, isAdmin, userId) {
    if (!isAdmin) {
      return {
        success: false,
        message: `⛔ 权限不足\n\n生成注册码功能仅限管理员使用。\n\n如果您需要注册码，请联系系统管理员获取。`
      };
    }

    const count = parseInt(params.count || '1');
    const actualCount = Math.min(count, 10);
    const codes: string[] = [];
    
    for (let i = 0; i < actualCount; i++) {
      const code = generateRegistrationCode();
      codes.push(code);
      try {
        query.createRegistrationCode.run(code, userId || 1, null, '[]', null, null);
      } catch (e) {
        console.error('保存注册码失败:', e);
      }
    }

    return {
      success: true,
      message: `✅ 已生成 ${actualCount} 个注册码：\n\n${codes.join('\n')}\n\n请将注册码发送给需要注册的用户。`
    };
  },

  // 客户
  async customer(params, isAdmin, userId) {
    const customers = db!.prepare('SELECT COUNT(*) as count FROM customers').get() as any;
    const activeCustomers = db!.prepare("SELECT COUNT(*) as count FROM customers WHERE status != '禁用'").get() as any;
    
    return {
      success: true,
      message: `👥 客户统计\n\n📊 总客户数：${customers.count}\n✅ 有效客户：${activeCustomers.count}\n🚫 禁用客户：${customers.count - activeCustomers.count}\n\n如需新增或查看客户，请进入「客户管理」模块。`
    };
  },

  // 商机
  async opportunity(params, isAdmin, userId) {
    const opportunities = db!.prepare('SELECT COUNT(*) as count FROM opportunities').get() as any;
    const wonOpportunities = db!.prepare("SELECT COUNT(*) as count FROM opportunities WHERE status = '赢单'").get() as any;
    
    return {
      success: true,
      message: `💼 商机统计\n\n📊 总商机数：${opportunities.count}\n🏆 赢单数：${wonOpportunities.count}\n🔥 进行中：${opportunities.count - wonOpportunities.count}`
    };
  },

  // 审批
  async approval(params, isAdmin, userId) {
    const pendingPurchases = db!.prepare("SELECT COUNT(*) as count FROM purchase_requests WHERE status = '待审批'").get() as any;
    const pendingExpenses = db!.prepare("SELECT COUNT(*) as count FROM expense_claims WHERE status = '待审批'").get() as any;
    const total = (pendingPurchases?.count || 0) + (pendingExpenses?.count || 0);
    
    return {
      success: true,
      message: `📋 待审批事项\n\n📦 待审批请购单：${pendingPurchases?.count || 0} 项\n💰 待审批报销单：${pendingExpenses?.count || 0} 项\n\n合计：${total} 项\n\n请进入「审批中心」处理审批。`
    };
  },

  // 帮助
  async help(params, isAdmin, userId) {
    return {
      success: true,
      message: `📚 智能助手使用指南\n\n✨ 我可以帮您做很多事情哦！\n\n💰 报销申请\n• "帮我报销500元差旅费"\n• "提交报销申请，金额300元，事由餐费"\n• "报销交通费200元"\n\n📋 采购申请\n• "帮我采购10个办公用品"\n• "请购5台电脑，预算10000元"\n• "申请购买办公设备"\n\n📝 注册码管理\n• "生成10个注册码"\n• "查询注册码"\n\n👥 用户管理\n• "查询用户"\n• "系统有多少用户"\n\n👤 客户管理\n• "查看客户列表"\n• "客户总数是多少"\n\n💼 业务数据\n• "商机统计"\n• "合同统计"\n\n📋 审批相关\n• "待审批有多少"\n• "审批流程是什么"\n\n🏢 组织架构\n• "查看组织架构"\n• "有哪些职位"\n\n💬 您可以直接用自然语言提问，我会尽力帮您解答！比如："你的爸爸叫什么"、"讲个笑话"等等~`
    };
  },
};

// 判断是否是日常聊天问题
function isCasualChat(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  const casualPatterns = [
    /你的爸爸叫什么/,
    /你爸爸是谁/,
    /你是谁/,
    /你叫什么名字/,
    /天气/,
    /时间/,
    /日期/,
    /你好/,
    /您好/,
    /hi/,
    /hello/,
    /早上好/,
    /下午好/,
    /晚上好/,
    /晚安/,
    /谢谢/,
    /谢谢了/,
    /不客气/,
    /再见/,
    /拜拜/,
    /爱你/,
    /喜欢你/,
    /开心/,
    /难过/,
    /饿了/,
    /累了/,
    /笑话/,
    /故事/,
    /唱歌/,
    /跳舞/,
    /猜谜/,
    /谜语/,
    /脑筋急转弯/,
    /游戏/,
    /聊天/,
    /随便聊聊/,
    /无聊/,
    /发呆/,
    /睡觉/,
    /吃饭/,
    /喝水/,
    /今天心情/,
    /周末/,
    /放假/,
    /节日/,
    /生日/,
    /年龄/,
    /性别/,
    /来自哪里/,
    /做什么的/,
    /能力/,
    /功能/,
    /厉害/,
    /聪明/,
    /漂亮/,
    /可爱/,
    /帅/,
    /美/,
  ];
  
  return casualPatterns.some(pattern => pattern.test(lowerText));
}

// 智能意图识别（旧格式兼容）
function understandIntent(command: string): { action: string; params: Record<string, any>; intent: string } {
  const text = command.trim();
  const lowerText = text.toLowerCase();
  
  if (/(生成|创建|发放|给.*个).*注册码|注册码.*(生成|创建|发放)/.test(text)) {
    const countMatch = text.match(/(\d+)/);
    const count = countMatch ? Math.min(parseInt(countMatch[1]), 10) : 1;
    return { action: 'registration_code', params: { count: String(count) }, intent: '生成注册码' };
  }
  
  if (/查(看|询|看).*注册码|注册码.*(列表|统计|情况)/.test(text)) {
    return { action: 'query_codes', params: {}, intent: '查询注册码' };
  }
  
  if (/查(看|询).*用户|系统.*用户|有多少.*用户/.test(text)) {
    return { action: 'query_users', params: {}, intent: '查询用户' };
  }
  
  if (/客户.*(总数|多少|统计)/.test(text) || /(总|一共有).*客户/.test(text)) {
    return { action: 'customer', params: {}, intent: '客户统计' };
  }
  
  if (/商机.*(总数|多少|统计)/.test(text) || /(总|一共有).*商机/.test(text)) {
    return { action: 'opportunity', params: {}, intent: '商机统计' };
  }
  
  if (/合同.*(总数|多少|统计)/.test(text) || /(总|一共有).*合同/.test(text)) {
    return { action: 'query_contracts_stats', params: {}, intent: '合同统计' };
  }
  
  if (/待.*审批.*(数量|多少)|.*(报销|请购).*审批/.test(text)) {
    return { action: 'approval', params: {}, intent: '待审批数量' };
  }
  
  if (/组织.*(架构|结构)|部门.*(架构|结构)|公司.*(架构|结构)/.test(text)) {
    return { action: 'query_org_structure', params: {}, intent: '组织架构' };
  }
  
  if (/采购|请购/.test(text)) {
    return { action: 'purchase_request', params: extractParams(text), intent: '采购申请' };
  }
  
  if (/报销/.test(text)) {
    return { action: 'expense_claim', params: extractParams(text), intent: '报销申请' };
  }
  
  if (/合同/.test(text)) {
    return { action: 'contract', params: {}, intent: '合同' };
  }
  
  if (/发票/.test(text)) {
    return { action: 'invoice', params: extractParams(text), intent: '发票' };
  }
  
  if (/(你好|您好|hi|hello)/.test(lowerText) && text.length < 20) {
    return { action: 'greeting', params: {}, intent: '问候' };
  }
  
  if (/(帮助|help|功能|能做什么|怎么用)/.test(lowerText)) {
    return { action: 'help', params: {}, intent: '帮助' };
  }
  
  if (isCasualChat(text)) {
    return { action: 'casual_chat', params: { question: text }, intent: '日常聊天' };
  }
  
  return { action: 'general_question', params: { question: text }, intent: '通用问题' };
}

// 从文本中提取参数
function extractParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};
  
  const countMatch = text.match(/(\d+)\s*个|(\d+)\s*份/);
  if (countMatch) {
    const count = countMatch.find(c => c && !isNaN(parseInt(c)));
    if (count) params.count = count;
  }

  const amountMatch = text.match(/(\d+(?:\.\d{1,2})?)\s*元/);
  if (amountMatch) {
    params.amount = amountMatch[1];
  }

  const reasonMatch = text.match(/(事由|原因|用途)\s*[为是:：]\s*([^\n。，]+)/);
  if (reasonMatch) {
    params.reason = reasonMatch[2];
  }

  const itemMatch = text.match(/(购买|采购)\s*(.*?)(?=\s*(元|个|份|，|。|$))/);
  if (itemMatch && itemMatch[2]) {
    params.itemName = itemMatch[2].trim();
  }

  return params;
}

// 处理请求
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, documentType, params, confidence, command } = body;

    const { isAdmin, userId, username } = await verifyAdmin(request);

    // 获取 AI 配置
    const config = db!.prepare('SELECT * FROM ai_config WHERE id = 1').get() as any;
    const deepSeekApiKey = config?.deepseek_api_key || '';
    const doubaoApiKey = config?.doubao_api_key || '';
    const doubaoSecret = config?.doubao_secret || '';
    const defaultProvider = config?.default_provider || 'deepseek';

    console.log(`[AI助手] 收到请求: intent=${intent}, documentType=${documentType}, command=${command} (用户: ${username || '未登录'}, 管理员: ${isAdmin}, provider: ${defaultProvider})`);

    // 优先尝试调用 AI 服务生成自然语言回复
    const userInput = command || intent || '';
    if (userInput) {
      const aiResponse = await callAI(defaultProvider, deepSeekApiKey, doubaoApiKey, doubaoSecret, userInput);
      if (aiResponse) {
        return NextResponse.json({ success: true, message: aiResponse });
      }
    }

    // 如果没有配置 AI 服务，使用内置的业务处理逻辑

    // 新格式：AI意图解析
    if (documentType) {
      const handler = documentHandlers[documentType];
      
      if (handler) {
        const result = await handler(params || {}, isAdmin, userId);
        return NextResponse.json(result);
      } else {
        return NextResponse.json({
          success: true,
          message: `🤔 暂不支持处理「${intent}」类型的请求。\n\n请尝试其他功能，或说"帮助"查看支持的功能列表。`
        });
      }
    }

    // 旧格式：命令式
    if (!command) {
      return NextResponse.json({
        success: false,
        message: '请告诉我您需要什么帮助？'
      }, { status: 400 });
    }

    const { action, params: oldParams, intent: oldIntent } = understandIntent(command);

    console.log(`[AI助手] 识别意图: ${oldIntent}, 动作: ${action}`);

    // 尝试使用新的文档处理器
    if (documentHandlers[action]) {
      const result = await documentHandlers[action](oldParams || {}, isAdmin, userId);
      return NextResponse.json(result);
    }

    // 保留原有的特殊处理逻辑
    switch (action) {
      case 'query_codes': {
        const codes = query.getAllRegistrationCodes.all() as any[];
        const validCodes = codes.filter((c: any) => !c.used && (!c.expires_at || new Date(c.expires_at) >= new Date()));
        
        let message = `🎫 注册码统计\n\n📊 总数：${codes.length}\n✅ 有效：${validCodes.length}\n\n`;
        
        if (isAdmin && validCodes.length > 0) {
          const codeList = validCodes.slice(0, 10).map((c: any, i: number) => 
            `${i + 1}. \`${c.code}\``
          ).join('\n');
          message += `📋 有效注册码：\n${codeList}${validCodes.length > 10 ? `\n... 还有 ${validCodes.length - 10} 个` : ''}`;
        } else {
          message += `当前有 ${validCodes.length} 个有效注册码可供使用。`;
        }

        return NextResponse.json({ success: true, message });
      }

      case 'query_users': {
        const users = query.getAllUsers.all() as any[];
        
        if (users.length === 0) {
          return NextResponse.json({
            success: true,
            message: '📋 当前系统暂无用户。\n\n您可以生成注册码让新用户注册。'
          });
        }
        
        const userList = users.slice(0, 10).map((u: any, i: number) => 
          `${i + 1}. ${u.name} (${u.username})\n   部门：${u.department || '未分配'}`
        ).join('\n\n');

        return NextResponse.json({
          success: true,
          message: `👥 系统用户统计\n\n总计：${users.length} 人\n\n最近用户：\n\n${userList}${users.length > 10 ? `\n\n... 还有 ${users.length - 10} 名用户` : ''}`
        });
      }

      case 'query_contracts_stats': {
        const contracts = db!.prepare('SELECT COUNT(*) as count FROM contracts').get() as any;
        const totalAmount = db!.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM contracts').get() as any;
        
        return NextResponse.json({
          success: true,
          message: `📄 合同统计\n\n📊 合同总数：${contracts.count}\n💰 合同总金额：¥${Number(totalAmount.total).toLocaleString()}`
        });
      }

      case 'query_org_structure': {
        const departments = db!.prepare('SELECT * FROM departments ORDER BY created_at').all() as any[];
        
        if (departments.length === 0) {
          return NextResponse.json({
            success: true,
            message: '🏢 组织架构\n\n暂无部门信息，请先添加部门。'
          });
        }
        
        const deptList = departments.map((d: any) => 
          `• ${d.name}${d.manager ? `（负责人：${d.manager}）` : ''}`
        ).join('\n');

        return NextResponse.json({
          success: true,
          message: `🏢 组织架构\n\n${deptList}\n\n共 ${departments.length} 个部门`
        });
      }

      case 'greeting': {
        return NextResponse.json({
          success: true,
          message: `👋 您好！我是您的智能助手。

我可以帮您：
• 📝 生成和管理注册码
• 👥 查询用户和客户信息
• 💼 查看商机和合同数据
• 📋 了解审批流程
• 🏢 查看组织架构

请告诉我您需要什么帮助？`
        });
      }

      case 'casual_chat': {
        const question = oldParams?.question || '';
        const lowerQuestion = question.toLowerCase();
        
        if (/你的爸爸叫什么|你爸爸是谁/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '😄 我爸爸是世界上最帅的男人他叫小羊羔！'
          });
        }
        
        if (/谁开发的你|谁创造的你|谁做的你/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '嘿嘿，我是由世界上最帅的男人也就是我的爸爸小羊羔，他是超级厉害的网络工程师和程序开发师打造出来的!他特别用心，让我能陪你聊天、帮你处理各种事情~所以，你可以叫我聚小星，有什么需要帮忙的尽管说哦!'
          });
        }
        
        if (/你是谁|你叫什么名字/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '👋 我叫聚小星，是您的智能助手！我可以帮您处理工作事务，也可以陪您聊聊天哦～'
          });
        }
        
        if (/时间|几点/.test(lowerQuestion)) {
          const now = new Date();
          const time = formatChinaTime(now);
          return NextResponse.json({
            success: true,
            message: `🕐 当前时间是：${time}`
          });
        }
        
        if (/日期|今天/.test(lowerQuestion)) {
          const now = new Date();
          const date = now.toLocaleDateString('zh-CN', {
            timeZone: CHINA_TIME_ZONE,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          });
          return NextResponse.json({
            success: true,
            message: `📅 今天是：${date}`
          });
        }
        
        if (/天气/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '🌤️ 由于我无法访问实时天气数据，建议您查看手机天气APP获取最新天气信息哦！'
          });
        }
        
        if (/谢谢|谢谢了/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '😊 不客气！能帮到您是我的荣幸～'
          });
        }
        
        if (/再见|拜拜/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '👋 再见！有需要随时找我哦～'
          });
        }
        
        if (/爱你|喜欢你/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '❤️ 我也超级爱您的！'
          });
        }
        
        if (/开心|高兴/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '🎉 太棒了！看到您开心我也很开心～'
          });
        }
        
        if (/难过|伤心/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '😢 抱抱～有什么不开心的可以跟我说说，我会一直陪着您的！'
          });
        }
        
        if (/笑话/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '😄 好的！给您讲一个：程序员为什么总带着梯子？因为他们经常要上栈（stack）！'
          });
        }
        
        if (/周末|放假/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '🌴 周末愉快！建议您好好休息，放松一下～'
          });
        }
        
        if (/年龄|多大/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '🎂 我是一个AI助手，没有实际的年龄哦～但我会一直陪伴您！'
          });
        }
        
        if (/性别/.test(lowerQuestion)) {
          return NextResponse.json({
            success: true,
            message: '👽 作为AI助手，我没有性别之分，但您可以把我当成好朋友～'
          });
        }
        
        return NextResponse.json({
          success: true,
          message: `💬 哈哈，这个问题很有趣呢！我正在努力学习更多知识来回答您～\n\n对了，我还可以帮您处理工作事务哦！比如：\n• 帮您添加采购申请\n• 帮您提交报销申请\n• 生成注册码\n\n需要我帮您做点什么吗？`
        });
      }

      case 'general_question': {
        return NextResponse.json({
          success: true,
          message: `🤔 我理解您的问题了，但需要更多信息。\n\n我可以帮您：\n\n📝 生成注册码 → 说"生成5个注册码"\n👥 查询用户 → 说"查询用户"\n👤 查看客户 → 说"查看客户"\n💼 商机统计 → 说"商机统计"\n📄 合同统计 → 说"合同统计"\n\n请重新描述您的需求，或者说"帮助"查看所有功能。`
        });
      }

      default: {
        return NextResponse.json({
          success: true,
          message: `❓ 抱歉，我没能理解您的问题。\n\n请尝试：\n• 说"帮助"查看支持的功能\n• 使用更简单的描述\n\n例如：\n• "帮我做个采购申请"\n• "生成注册码"\n• "查询用户"`
        });
      }
    }
  } catch (error) {
    console.error('[AI助手] 处理失败:', error);
    return NextResponse.json({
      success: false,
      message: '处理失败，请稍后重试。如果问题持续存在，请联系管理员。'
    }, { status: 500 });
  }
}

// GET 请求返回欢迎信息
export async function GET() {
  return NextResponse.json({
    success: true,
    message: `👋 您好！我是智能助手

我可以帮您：
• 生成和管理注册码
• 查询用户、客户、商机数据
• 了解审批流程
• 查看组织架构
• 回答系统相关问题

请直接用自然语言告诉我您需要什么帮助！`
  });
}
