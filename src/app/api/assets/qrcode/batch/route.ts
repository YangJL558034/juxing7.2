import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/database';
import { chinaToday } from '@/lib/china-time';

interface AssetRow {
  id: number;
  name: string;
  type: string;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'asset';
}

function createZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { time, date } = zipDateTime();

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(time, 10);
    localHeader.writeUInt16LE(date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(time, 12);
    centralHeader.writeUInt16LE(date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request.headers.get('cookie'));
  if (!user) {
    return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
  }

  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    if (!host) {
      return NextResponse.json({ success: false, error: '无法识别访问域名' }, { status: 400 });
    }

    const assets = query.getAllAssets.all() as AssetRow[];
    if (assets.length === 0) {
      return NextResponse.json({ success: false, error: '暂无资产二维码可下载' }, { status: 400 });
    }

    const entries = await Promise.all(assets.map(async (asset) => {
      const assetUrl = `${protocol}://${host}/asset/${asset.id}`;
      const data = await QRCode.toBuffer(assetUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff',
        },
      });
      const name = `${String(asset.id).padStart(4, '0')}_${sanitizeFileName(asset.name)}.png`;
      return { name, data };
    }));

    const zip = createZip(entries);
    const fileName = encodeURIComponent(`资产二维码_${chinaToday()}.zip`);
    return new NextResponse(zip, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Content-Length': String(zip.length),
      },
    });
  } catch (error) {
    console.error('Batch QR download error:', error);
    return NextResponse.json({ success: false, error: '下载全部资产二维码失败' }, { status: 500 });
  }
}
