import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';
import { ensureBlogTables } from '../../../../lib/blogSchema';

const MAX_BYTES = 5 * 1024 * 1024;

/** Stores a binary image and returns { id, url } the editor can paste in. */
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
    await ensureBlogTables(pool);
    const r = await pool
      .request()
      .input('image_data', sql.VarBinary(sql.MAX), buffer)
      .input('mime_type', sql.NVarChar(50), mime)
      .query(`
        INSERT INTO dbo.ecommerce_blog_images (image_data, mime_type)
        OUTPUT INSERTED.id
        VALUES (@image_data, @mime_type)
      `);
    const id = r.recordset[0]?.id;
    return NextResponse.json({ success: true, id, url: `/api/blog/images/${id}` });
  } catch (error: any) {
    console.error('Error uploading blog image:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
