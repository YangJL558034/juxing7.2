import { db } from '@/lib/database';
import { formatChinaDateTime } from '@/lib/china-time';

/**
 * 清理35天前的日志
 * @param tableName 表名 - 'operation_logs' 或 'chat_messages'
 */
export function cleanupOldLogs(tableName: 'operation_logs' | 'chat_messages') {
  try {
    // 计算35天前的日期
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 35);
    
    // 格式化日期为 SQLite 格式 (YYYY-MM-DD HH:MM:SS)
    const cutoffDateStr = formatChinaDateTime(cutoffDate);
    
    console.log(`清理${tableName}表中${cutoffDateStr}之前的记录...`);
    
    // 执行删除
    const result = db
      .prepare(`DELETE FROM ${tableName} WHERE created_at < ?`)
      .run(cutoffDateStr);
    
    console.log(`已删除 ${tableName} 表中的 ${result.changes} 条过期记录`);
    
    return { success: true, deletedCount: result.changes, cutoffDate: cutoffDateStr };
  } catch (error) {
    console.error(`清理${tableName}表失败:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * 清理所有类型的过期日志
 */
export function cleanupAllOldLogs() {
  console.log('开始清理所有过期日志...');
  
  const results = {
    operation_logs: cleanupOldLogs('operation_logs'),
    chat_messages: cleanupOldLogs('chat_messages'),
  };
  
  console.log('日志清理完成:', results);
  return results;
}

/**
 * 检查并清理过期日志（每次服务器启动或定时触发时调用）
 */
export function checkAndCleanupLogs() {
  console.log('检查过期日志...');
  
  // 先检查两个表是否存在
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('operation_logs', 'chat_messages')").all();
    const existingTables = (tables as any[]).map(t => t.name);
    
    console.log('存在的表:', existingTables);
    
    if (existingTables.includes('operation_logs')) {
      cleanupOldLogs('operation_logs');
    }
    
    if (existingTables.includes('chat_messages')) {
      cleanupOldLogs('chat_messages');
    }
    
    console.log('过期日志检查完成');
  } catch (error) {
    console.error('检查过期日志失败:', error);
  }
}
