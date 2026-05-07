import { NextResponse } from 'next/server';
import { getDb1 } from '../../../lib/db';
import { ensureBlogTables } from '../../../lib/blogSchema';

export async function GET() {
  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);
    const r = await pool.request().query(`
      SELECT
        c.id,
        c.name,
        c.slug,
        c.color,
        (SELECT COUNT(*) FROM dbo.ecommerce_blog_posts p
           WHERE p.category_id = c.id
             AND p.deleted_at IS NULL
             AND p.published = 1) AS post_count
      FROM dbo.ecommerce_blog_categories c
      ORDER BY c.name
    `);
    return NextResponse.json({ success: true, categories: r.recordset });
  } catch (error: any) {
    console.error('Error reading blog categories:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
