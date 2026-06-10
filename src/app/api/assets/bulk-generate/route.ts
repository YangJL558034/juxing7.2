import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, logOperationServer, query } from '@/lib/database';
import { chinaNowSql, chinaToday } from '@/lib/china-time';

interface BulkAssetRequest {
  type?: string;
  namePrefix?: string;
  department?: string;
  user?: string | null;
  value?: number | string;
  purchase_date?: string;
  count?: number | string;
  startNumber?: number | string;
  config?: Record<string, unknown>;
}

function toPositiveInt(value: number | string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function toMoney(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const body = await request.json() as BulkAssetRequest;
    const type = String(body.type || '').trim();
    const namePrefix = String(body.namePrefix || '').trim();
    const department = String(body.department || '').trim();
    const assetUser = String(body.user || '').trim();
    const count = toPositiveInt(body.count, 1);
    const startNumber = toPositiveInt(body.startNumber, 1);
    const value = toMoney(body.value);
    const purchaseDate = String(body.purchase_date || chinaToday()).trim();
    const configJson = body.config ? JSON.stringify(body.config) : null;

    if (!type) {
      return NextResponse.json({ success: false, error: '请选择资产类型' }, { status: 400 });
    }
    if (!namePrefix) {
      return NextResponse.json({ success: false, error: '请填写资产名称前缀' }, { status: 400 });
    }
    if (!department) {
      return NextResponse.json({ success: false, error: '请填写所属部门' }, { status: 400 });
    }
    if (count > 500) {
      return NextResponse.json({ success: false, error: '单次最多生成500个资产' }, { status: 400 });
    }

    const status = assetUser ? '使用中' : '闲置';
    const claimTime = assetUser ? chinaNowSql() : null;
    const width = Math.max(3, String(startNumber + count - 1).length);
    const createMany = db.transaction(() => {
      const ids: number[] = [];
      for (let index = 0; index < count; index += 1) {
        const serial = String(startNumber + index).padStart(width, '0');
        const name = `${namePrefix}${serial}`;
        const result = query.createAsset.run(
          type,
          name,
          department,
          assetUser || null,
          value,
          purchaseDate || null,
          status,
          configJson,
          claimTime,
        );
        ids.push(Number(result.lastInsertRowid));
      }
      return ids;
    });

    const ids = createMany();

    logOperationServer({
      userId: user.id,
      userName: user.name || user.username,
      module: 'asset',
      action: 'bulk-generate',
      details: {
        count,
        type,
        namePrefix,
        department,
        assetUser: assetUser || null,
        startNumber,
        generatedIds: ids,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        count,
        ids,
      },
    });
  } catch (error) {
    console.error('Bulk generate assets error:', error);
    return NextResponse.json({ success: false, error: '一键生成资产失败' }, { status: 500 });
  }
}
