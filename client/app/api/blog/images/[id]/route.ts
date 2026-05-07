import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { ensureBlogTables } from '../../../../lib/blogSchema';

/**
 * Public binary fetch for a blog image. Used for cover images and inline
 * images embedded in post bodies.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imageId = parseInt(id, 10);
    if (!Number.isFinite(imageId) || imageId <= 0) {
      return new NextResponse(null, { status: 400 });
    }
    const pool = await getDb1();
    await ensureBlogTables(pool);

    const r = await pool
      .request()
      .input('id', sql.Int, imageId)
      .query(`
        SELECT image_data, mime_type
        FROM dbo.ecommerce_blog_images
        WHERE id = @id
      `);
    const row = r.recordset[0];
    if (!row?.image_data) return new NextResponse(null, { status: 404 });

    return new NextResponse(row.image_data, {
      status: 200,
      headers: {
        'Content-Type': row.mime_type || 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    console.error('Error reading blog image:', error);
    return new NextResponse(null, { status: 500 });
  }
}
