import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const allowedOrigins = ['http://localhost:5000', 'http://127.0.0.1:5000', 'http://shanze.hppro1.hpnu.cn'];
  const origin = request.headers.get('origin');
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  // 检查首页访问，如果没有token则重定向到登录页面
  const path = request.nextUrl.pathname;
  const authToken = request.cookies.get('auth_token');
  
  // 受保护的页面需要登录
  const protectedPaths = ['/', '/notification-center', '/operation-logs'];
  
  if (protectedPaths.includes(path) && !authToken?.value) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return response;
}

export const config = { matcher: ['/', '/api/:path*', '/login', '/register', '/forgot-password', '/notification-center', '/operation-logs'] };
