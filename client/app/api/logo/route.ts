import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../lib/db';
import { isAdminRequest } from '../../lib/getAdminAuth';

async function fallbackLogoResponse(): Promise<NextResponse> {
  try {
    const filePath = path.join(process.cwd(), 'public', 'logo.png');
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

/**
 * Tenant logo — used as the browser-tab favicon AND the navbar logo.
 * Binary stored in {nipt}Eccomerce so it follows the tenant.
 *
 *   GET    /api/logo   -> raw bytes (public)
 *   POST   /api/logo   -> { image_data_base64, mime_type } (admin)
 *   DELETE /api/logo   -> clear (admin)
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_logo' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_logo (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        image_data  VARBINARY(MAX) NULL,
        mime_type   NVARCHAR(50)   NULL,
        updated_at  DATETIME       NOT NULL DEFAULT GETDATE()
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ecommerce_logo)
    BEGIN
      INSERT INTO dbo.ecommerce_logo (image_data, mime_type) VALUES (NULL, NULL);
    END;
  `);
}

export async function GET() {
  try {
    const pool = await getDb1();
    await ensureTable(pool);

    const r = await pool.request().query(`
      SELECT TOP 1 image_data, mime_type
      FROM dbo.ecommerce_logo
      ORDER BY id DESC
    `);

    const row = r.recordset[0];
    if (!row?.image_data) return fallbackLogoResponse();

    return new NextResponse(row.image_data, {
      status: 200,
      headers: {
        'Content-Type': row.mime_type || 'image/png',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Error reading logo:', error);
    return fallbackLogoResponse();
  }
}

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { image_data_base64?: string; mime_type?: string };
    if (!body.image_data_base64) {
      return NextResponse.json(
        { success: false, message: 'image_data_base64 is required' },
        { status: 400 }
      );
    }
    const cleaned = body.image_data_base64.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleaned, 'base64');
    if (buffer.length === 0) {
      return NextResponse.json({ success: false, message: 'Decoded image is empty' }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json(
        { success: false, message: `Logo is too large (>${MAX_BYTES} bytes)` },
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
      .input('image_data', sql.VarBinary(sql.MAX), buffer)
      .input('mime_type', sql.NVarChar(50), mime)
      .query(`
        UPDATE dbo.ecommerce_logo
        SET image_data = @image_data,
            mime_type  = @mime_type,
            updated_at = GETDATE()
        WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_logo ORDER BY id DESC)
      `);

    return NextResponse.json({ success: true, bytes: buffer.length, mime_type: mime });
  } catch (error: any) {
    console.error('Error saving logo:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to save logo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureTable(pool);
    await pool.request().query(`
      UPDATE dbo.ecommerce_logo
      SET image_data = NULL, mime_type = NULL, updated_at = GETDATE()
      WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_logo ORDER BY id DESC)
    `);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing logo:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
