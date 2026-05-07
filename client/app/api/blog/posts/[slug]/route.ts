import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { ensureBlogTables } from '../../../../lib/blogSchema';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, message: 'Missing slug' }, { status: 400 });
    }
    const pool = await getDb1();
    await ensureBlogTables(pool);

    const r = await pool
      .request()
      .input('slug', sql.NVarChar(255), slug)
      .query(`
        SELECT
          p.id,
          p.slug,
          p.title,
          p.excerpt,
          p.content_html,
          p.cover_image_id,
          p.published_at,
          p.title_size,
          c.name AS category_name,
          c.slug AS category_slug,
          c.color AS category_color
        FROM dbo.ecommerce_blog_posts p
        LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
        WHERE p.slug = @slug AND p.deleted_at IS NULL AND p.published = 1
      `);

    const post = r.recordset[0];
    if (!post) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const tagsRes = await pool
      .request()
      .input('pid', sql.Int, post.id)
      .query(`SELECT tag FROM dbo.ecommerce_blog_post_tags WHERE post_id = @pid ORDER BY tag`);

    return NextResponse.json({
      success: true,
      post: { ...post, tags: tagsRes.recordset.map((row: any) => row.tag) },
    });
  } catch (error: any) {
    console.error('Error reading blog post:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
