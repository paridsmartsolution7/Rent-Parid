import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../lib/db';
import { ensureBlogTables } from '../../../lib/blogSchema';

/**
 * Public list of blog posts. Filters out unpublished + soft-deleted.
 * Supports ?category=slug, ?tag=name, ?limit=12, ?page=1.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category') || '';
    const tag = searchParams.get('tag') || '';
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '12', 10)));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const offset = (page - 1) * limit;

    const pool = await getDb1();
    await ensureBlogTables(pool);

    const req = pool
      .request()
      .input('limit', sql.Int, limit)
      .input('offset', sql.Int, offset);

    let whereExtra = '';
    if (categorySlug) {
      req.input('categorySlug', sql.NVarChar(255), categorySlug);
      whereExtra += ' AND c.slug = @categorySlug';
    }
    if (tag) {
      req.input('tag', sql.NVarChar(80), tag);
      whereExtra += ' AND EXISTS (SELECT 1 FROM dbo.ecommerce_blog_post_tags t WHERE t.post_id = p.id AND t.tag = @tag)';
    }

    const list = await req.query(`
      SELECT
        p.id,
        p.slug,
        p.title,
        p.excerpt,
        p.cover_image_id,
        p.published_at,
        p.title_size,
        c.name AS category_name,
        c.slug AS category_slug,
        c.color AS category_color
      FROM dbo.ecommerce_blog_posts p
      LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL AND p.published = 1 ${whereExtra}
      ORDER BY p.published_at DESC, p.id DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `);

    const countReq = pool.request();
    if (categorySlug) countReq.input('categorySlug', sql.NVarChar(255), categorySlug);
    if (tag) countReq.input('tag', sql.NVarChar(80), tag);
    const count = await countReq.query(`
      SELECT COUNT(*) AS total
      FROM dbo.ecommerce_blog_posts p
      LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
      WHERE p.deleted_at IS NULL AND p.published = 1 ${whereExtra}
    `);

    return NextResponse.json({
      success: true,
      posts: list.recordset,
      total: count.recordset[0]?.total ?? 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('Error listing blog posts:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
