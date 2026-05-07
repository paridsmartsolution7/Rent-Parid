import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';

/**
 * Per-category image. The category id (Art_Kls01.Kodi from DB2 / {nipt}) is
 * the natural key — the binary lives in DB1 ({nipt}Eccomerce) keyed by the
 * same string so the join across DBs is implicit.
 *
 *   GET    /api/categories/{kodi}/image   public binary
 *   POST   /api/categories/{kodi}/image   admin upload  (X-Admin-Key)
 *   DELETE /api/categories/{kodi}/image   admin clear
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_category_images' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_category_images (
        category_kodi NVARCHAR(50) NOT NULL PRIMARY KEY,
        image_data    VARBINARY(MAX) NULL,
        mime_type     NVARCHAR(50)   NULL,
        updated_at    DATETIME       NOT NULL DEFAULT GETDATE()
      );
    END;
  `);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kodi: string }> }
) {
  try {
    const { kodi } = await params;
    if (!kodi) return new NextResponse(null, { status: 400 });

    const pool = await getDb1();
    await ensureTable(pool);
    const r = await pool
      .request()
      .input('kodi', sql.NVarChar(50), kodi)
      .query(`
        SELECT image_data, mime_type
        FROM dbo.ecommerce_category_images
        WHERE category_kodi = @kodi
      `);
    const row = r.recordset[0];
    if (!row?.image_data) return new NextResponse(null, { status: 404 });
    return new NextResponse(row.image_data, {
      status: 200,
      headers: {
        'Content-Type': row.mime_type || 'image/png',
        'Cache-Control': 'public, max-age=600',
      },
    });
  } catch (error: any) {
    console.error('Error reading category image:', error);
    return new NextResponse(null, { status: 500 });
  }
}

const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ kodi: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { kodi } = await params;
    if (!kodi) {
      return NextResponse.json({ success: false, message: 'kodi required' }, { status: 400 });
    }

    const body = (await request.json()) as { image_data_base64?: string; mime_type?: string };
    if (!body.image_data_base64) {
      return NextResponse.json(
        { success: false, message: 'image_data_base64 required' },
        { status: 400 }
      );
    }
    const cleaned = body.image_data_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: `Invalid image (>${MAX_BYTES} bytes max)` },
        { status: 413 }
      );
    }
    const mime =
      typeof body.mime_type === 'string' && body.mime_type.length <= 50
        ? body.mime_type
        : 'image/png';

    const pool = await getDb1();
    await ensureTable(pool);
    await pool
      .request()
      .input('kodi', sql.NVarChar(50), kodi)
      .input('image_data', sql.VarBinary(sql.MAX), buffer)
      .input('mime_type', sql.NVarChar(50), mime)
      .query(`
        MERGE dbo.ecommerce_category_images AS t
        USING (SELECT @kodi AS category_kodi) AS s ON t.category_kodi = s.category_kodi
        WHEN MATCHED THEN
          UPDATE SET image_data = @image_data, mime_type = @mime_type, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (category_kodi, image_data, mime_type)
          VALUES (@kodi, @image_data, @mime_type);
      `);
    return NextResponse.json({ success: true, bytes: buffer.length, mime_type: mime });
  } catch (error: any) {
    console.error('Error saving category image:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ kodi: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { kodi } = await params;
    const pool = await getDb1();
    await ensureTable(pool);
    await pool
      .request()
      .input('kodi', sql.NVarChar(50), kodi)
      .query('DELETE FROM dbo.ecommerce_category_images WHERE category_kodi = @kodi');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing category image:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
