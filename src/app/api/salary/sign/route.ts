import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, signature } = body;
    
    if (!recordId || !signature) {
      return NextResponse.json({ success: false, error: '参数错误' }, { status: 400 });
    }
    
    const result = query.updateWorkHoursMonthlySignature.run(signature, recordId);
    
    if (result.changes === 0) {
      return NextResponse.json({ success: false, error: '未找到对应的工资记录' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true, message: '签字成功' });
  } catch (error) {
    console.error('Sign salary error:', error);
    return NextResponse.json({ success: false, error: '签字失败' }, { status: 500 });
  }
}
