import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const os = await import('os');
    
    const systemInfo = {
      platform: os.platform(),
      platformName: getPlatformName(os.platform()),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMem: formatMemory(os.totalmem()),
      freeMem: formatMemory(os.freemem()),
      uptime: formatUptime(os.uptime()),
    };

    return NextResponse.json({ success: true, data: systemInfo });
  } catch (error) {
    console.error('Get system info error:', error);
    return NextResponse.json({ success: false, error: '获取系统信息失败' }, { status: 500 });
  }
}

function getPlatformName(platform: string): string {
  const platformMap: Record<string, string> = {
    'win32': 'Windows',
    'linux': 'Linux',
    'darwin': 'macOS',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'SunOS',
  };
  return platformMap[platform] || platform;
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时 ${minutes}分钟 ${secs}秒`;
  }
  return `${minutes}分钟 ${secs}秒`;
}
