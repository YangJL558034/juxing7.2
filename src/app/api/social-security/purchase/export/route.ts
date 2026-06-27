import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import {
  normalizeSocialSecurityPurchaseCategory,
  parseSocialSecurityPurchaseRow,
  socialSecurityPurchaseCategoryLabel,
  type SocialSecurityPurchaseDbRow,
} from '@/lib/social-security-purchase-records';
import { parseSocialSecurityRow, type SocialSecurityDbRow } from '@/lib/social-security-records';
import { buildSocialSecurityPurchaseWorkbook } from '@/lib/social-security-purchase-xlsx';
import type { SocialSecurityPurchaseCategory, SocialSecurityPurchaseRecord } from '@/types/social-security-purchase';

async function requireUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category')?.trim() || 'all';
    const employment = searchParams.get('employment')?.trim();
    const keyword = searchParams.get('keyword')?.trim();
    const deleted = searchParams.get('deleted') === '1';
    const where: string[] = [];
    const params: unknown[] = [];
    const resignedWhere = "(COALESCE(resignation_date, '') <> '' OR employment_status LIKE '%离%')";

    if (deleted) {
      where.push("deleted_at IS NOT NULL AND deleted_at >= datetime('now', '+8 hours', '-7 days')");
    } else {
      where.push('deleted_at IS NULL');
    }
    if (categoryParam !== 'all') {
      where.push('category = ?');
      params.push(normalizeSocialSecurityPurchaseCategory(categoryParam));
    }
    if (!deleted && employment === 'resigned') {
      where.push(resignedWhere);
    } else if (!deleted && employment === 'active') {
      where.push(`NOT ${resignedWhere}`);
    }
    if (keyword) {
      where.push('(employee_name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR department LIKE ? OR insurance_status LIKE ?)');
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    const rows = db.prepare(`
      SELECT * FROM social_security_purchase_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY category ASC, created_at DESC, id DESC
    `).all(...params) as SocialSecurityPurchaseDbRow[];

    const purchaseRecords = rows.map(parseSocialSecurityPurchaseRow);
    let agreementRecords: SocialSecurityPurchaseRecord[] = [];
    if (!deleted && employment !== 'resigned') {
      const agreementWhere = ["deleted_at IS NULL", "status IN ('已审核', '已导出')"];
      const agreementParams: unknown[] = [];
      if (keyword) {
        agreementWhere.push('(name LIKE ? OR id_card LIKE ? OR phone LIKE ? OR department LIKE ? OR position LIKE ?)');
        agreementParams.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
      }

      agreementRecords = (db.prepare(`
        SELECT * FROM social_security_records
        WHERE ${agreementWhere.join(' AND ')}
        ORDER BY created_at DESC, id DESC
      `).all(...agreementParams) as SocialSecurityDbRow[])
        .map(parseSocialSecurityRow)
        .map((record): SocialSecurityPurchaseRecord => {
          const category = normalizeSocialSecurityPurchaseCategory(record.department);
          return {
            id: -record.id,
            category,
            categoryLabel: socialSecurityPurchaseCategoryLabel(category),
            contractStatus: '放弃协议',
            department: record.department,
            employeeName: record.name,
            domicile: '',
            idCard: record.idCard,
            phone: record.phone,
            bankCard: '',
            gender: '',
            birthDate: '',
            education: '',
            insuranceStatus: record.documentTitle,
            contractCount: '',
            contractStartDate: record.hireDate || record.applicationDate,
            contractTermYears: '',
            contractEndDate: '',
            dueDays: '',
            employmentStatus: '在职',
            resignationDate: '',
            confidentialityAgreement: '',
            probationSalary: '',
            remarks: '来自社保申请',
            exportedAt: record.exportedAt,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            deletedAt: null,
            restoreUntil: null,
          };
        })
        .filter((record) => categoryParam === 'all' || record.category === normalizeSocialSecurityPurchaseCategory(categoryParam));
    }

    const records = [...purchaseRecords, ...agreementRecords];
    const categories: SocialSecurityPurchaseCategory[] = categoryParam === 'all'
      ? ['production', 'management']
      : [normalizeSocialSecurityPurchaseCategory(categoryParam)];
    const buffer = buildSocialSecurityPurchaseWorkbook(records, categories);

    if (!deleted && rows.length > 0) {
      const ids = rows.map((row) => row.id);
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`
        UPDATE social_security_purchase_records
        SET exported_at = datetime('now', '+8 hours'),
            updated_at = datetime('now', '+8 hours')
        WHERE id IN (${placeholders})
      `).run(...ids);
    }

    const suffix = categoryParam === 'all' ? '全部' : (normalizeSocialSecurityPurchaseCategory(categoryParam) === 'management' ? '管理部' : '车间');
    const employmentSuffix = employment === 'resigned' ? '离职' : employment === 'active' ? '在职' : '全部';
    const filename = `购买社保记录-${suffix}-${employmentSuffix}-${today()}.xlsx`;
    const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Export social security purchase records error:', error);
    return NextResponse.json({ success: false, error: '导出购买社保记录失败' }, { status: 500 });
  }
}
