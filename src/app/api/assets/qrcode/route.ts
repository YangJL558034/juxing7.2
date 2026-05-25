import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

// 生成资产二维码
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: '资产ID不能为空' }, { status: 400 });
    }

    // 从请求头获取域名，优先使用自定义域名，否则从请求中获取
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    
    const assetUrl = `${protocol}://${host}/asset/${id}`;

    // 生成二维码图片 (Base64)
    const qrCodeDataUrl = await QRCode.toDataURL(assetUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e40af', // 深蓝色
        light: '#ffffff'
      }
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        qrCode: qrCodeDataUrl,
        url: assetUrl
      }
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    return NextResponse.json({ success: false, error: '生成二维码失败' }, { status: 500 });
  }
}
