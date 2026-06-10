/**
 * 机器人状态管理模块 - 用于在多个API端点之间共享状态
 */

import { type ChildProcess } from 'child_process';
import { formatChinaDateTime } from '@/lib/china-time';

// 机器人运行状态
export let botRunning = false;
export let botProcess: ChildProcess | null = null;
export let botLogs: string[] = [];

// 设置运行状态
export function setBotRunning(running: boolean) {
  botRunning = running;
}

// 设置进程
export function setBotProcess(process: ChildProcess | null) {
  botProcess = process;
}

// 添加日志
export function addLog(type: string, message: string) {
  const timestamp = formatChinaDateTime(new Date());
  botLogs.push(`[${timestamp}] [${type}] ${message}`);
  // 保留最近100条日志
  if (botLogs.length > 100) {
    botLogs.shift();
  }
  console.log(`[WxWork Bot] ${message}`);
}

// 获取日志
export function getLogs() {
  return botLogs.slice(-50);
}

// 清空日志
export function clearLogs() {
  botLogs = [];
}
