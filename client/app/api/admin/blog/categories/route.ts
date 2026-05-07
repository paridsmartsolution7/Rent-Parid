import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';
import { ensureBlogTables, slugify } from '../../../../lib/blogSchema';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);
    const r = await pool.request().query(`
      SELECT
        c.id, c.name, c.slug, c.color, c.created_at,
        (SELECT COUNT(*) FROM dbo.ecommerce_blog_posts p
           WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS post_count
      FROM dbo.ecommerce_blog_categories c
      ORDER BY c.name
    `);
    return NextResponse.json({ success: true, categories: r.recordset });
  } catch (error: any) {
    console.error('Error reading admin blog categories:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { name?: string; slug?: string; color?: string };
    const name = (body.name || '').trim();
    if (!name) {
      return NextResponse.json({ success: false, message: 'name required' }, { status: 400 });
    }
    const slug = slugify(body.slug || name);

    const pool = await getDb1();
    await ensureBlogTables(pool);

    const r = await pool
      .request()
      .input('name', sql.NVarChar(255), name)
      .input('slug', sql.NVarChar(255), slug)
      .input('color', sql.NVarChar(20), body.color || null)
      .query(`
        INSERT INTO dbo.ecommerce_blog_categories (name, slug, color)
        OUTPUT INSERTED.id
        VALUES (@name, @slug, @color)
      `);

    return NextResponse.json({ success: true, id: r.recordset[0]?.id, slug });
  } catch (error: any) {
    console.error('Error creating blog category:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '0', 10);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ success: false, message: 'id required' }, { status: 400 });
    }
    const pool = await getDb1();
    await ensureBlogTables(pool);
    // Detach posts from this category instead of cascading
    await pool.request().input('id', sql.Int, id).query(`
      UPDATE dbo.ecommerce_blog_posts SET category_id = NULL WHERE category_id = @id;
      DELETE FROM dbo.ecommerce_blog_categories WHERE id = @id;
    `);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting blog category:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
