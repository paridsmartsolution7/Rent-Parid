import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../../../lib/db';

function detectMime(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 4 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const artId = parseInt(id);
  if (!Number.isFinite(artId) || artId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const url = new URL(request.url);
  const indexParam = parseInt(url.searchParams.get('i') || '0');
  // Imazh is a duplicate of Imazh1 when both exist, so prefer Imazh1-4 for carousel
  // But fall back to Imazh for products that only have Imazh (no Imazh1)
  const cols = ['Imazh1', 'Imazh2', 'Imazh3', 'Imazh4'];
  const col = cols[indexParam] || 'Imazh1';

  try {
    const pool = await getDb2();
    let result = await pool.request()
      .input('id', sql.Int, artId)
      .query(`SELECT TOP 1 ${col} as img FROM Art_Left WHERE Art_Id = @id AND ${col} IS NOT NULL`);

    // Fallback: if requesting first image and Imazh1 is NULL, try Imazh
    if ((!result.recordset[0] || !result.recordset[0].img) && indexParam === 0) {
      result = await pool.request()
        .input('id', sql.Int, artId)
        .query(`SELECT TOP 1 Imazh as img FROM Art_Left WHERE Art_Id = @id AND Imazh IS NOT NULL`);
    }

    const row = result.recordset[0];
    if (!row || !row.img) {
      return NextResponse.json({ error: 'No image' }, { status: 404 });
    }

    const buf: Buffer = Buffer.isBuffer(row.img) ? row.img : Buffer.from(row.img);
    const mime = detectMime(buf);

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Length': String(buf.length),
        // Product images change rarely. Cache 1h fresh + 1d stale-while-revalidate
        // so scrolling doesn't re-download every image (was causing iOS black flashes).
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('Image fetch error:', error);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
