import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';
import { ensureBlogTables, purgeExpiredDeletedPosts, slugify } from '../../../../lib/blogSchema';
import { notifySubscribersOfNewPost } from '../../../../lib/blogEmail';

/** Admin list — includes drafts and soft-deleted, returns operator metadata. */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);
    // Opportunistic cleanup of posts soft-deleted > 30 days ago.
    await purgeExpiredDeletedPosts(pool);

    const { searchParams } = new URL(request.url);
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    const where = includeDeleted ? '' : 'WHERE p.deleted_at IS NULL';
    const r = await pool.request().query(`
      SELECT
        p.id, p.slug, p.title, p.excerpt, p.cover_image_id, p.title_size,
        p.published, p.published_at, p.created_at, p.updated_at, p.deleted_at,
        p.author_operator, p.author_username,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug, c.color AS category_color
      FROM dbo.ecommerce_blog_posts p
      LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
      ${where}
      ORDER BY p.updated_at DESC, p.id DESC
    `);
    return NextResponse.json({ success: true, posts: r.recordset });
  } catch (error: any) {
    console.error('Error listing admin blog posts:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

/**
 * Create a new post. Admin sends:
 *   { title, slug?, excerpt?, content_html, category_id?, cover_image_id?,
 *     tags: [...], title_size?, published?, operator, username }
 *
 * `operator` + `username` are passed by the admin UI from the Parid POS user
 * session (DB1 → DB2 link). Stored on the post and shown only in the admin
 * panel — never exposed on the public website.
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as any;
    const title = (body.title || '').trim();
    if (!title) {
      return NextResponse.json({ success: false, message: 'title required' }, { status: 400 });
    }
    const slug = slugify(body.slug || title);
    const published = !!body.published;

    const pool = await getDb1();
    await ensureBlogTables(pool);

    const insertReq = pool
      .request()
      .input('slug', sql.NVarChar(255), slug)
      .input('title', sql.NVarChar(500), title)
      .input('excerpt', sql.NVarChar(1000), body.excerpt || null)
      .input('content_html', sql.NVarChar(sql.MAX), body.content_html || null)
      .input('category_id', sql.Int, body.category_id || null)
      .input('cover_image_id', sql.Int, body.cover_image_id || null)
      .input('title_size', sql.NVarChar(20), body.title_size || 'lg')
      .input('author_operator', sql.NVarChar(255), body.operator || null)
      .input('author_username', sql.NVarChar(255), body.username || null)
      .input('published', sql.Bit, published ? 1 : 0)
      .input('published_at', sql.DateTime, published ? new Date() : null);

    const r = await insertReq.query(`
      INSERT INTO dbo.ecommerce_blog_posts
        (slug, title, excerpt, content_html, category_id, cover_image_id,
         title_size, author_operator, author_username, published, published_at)
      OUTPUT INSERTED.id
      VALUES
        (@slug, @title, @excerpt, @content_html, @category_id, @cover_image_id,
         @title_size, @author_operator, @author_username, @published, @published_at)
    `);
    const id = r.recordset[0]?.id;

    // Tags
    const tags = Array.isArray(body.tags) ? body.tags : [];
    for (const raw of tags) {
      const tag = String(raw).trim().slice(0, 80);
      if (!tag) continue;
      try {
        await pool
          .request()
          .input('pid', sql.Int, id)
          .input('tag', sql.NVarChar(80), tag)
          .query(`INSERT INTO dbo.ecommerce_blog_post_tags (post_id, tag) VALUES (@pid, @tag)`);
      } catch {/* duplicate or other — ignore */}
    }

    // History entry
    await pool
      .request()
      .input('pid', sql.Int, id)
      .input('op', sql.NVarChar(255), body.operator || null)
      .input('un', sql.NVarChar(255), body.username || null)
      .input('snap', sql.NVarChar(sql.MAX), JSON.stringify({ title, slug, published }))
      .query(`
        INSERT INTO dbo.ecommerce_blog_post_history (post_id, action, operator, username, snapshot_json)
        VALUES (@pid, 'create', @op, @un, @snap)
      `);

    // Fire-and-forget email fan-out to newsletter subscribers + registered
    // shop users. ONLY fires when the post is published at create-time so
    // drafts don't trigger notifications. Resolving the category slug for
    // the deep link is best-effort — we fall back to "general".
    if (published) {
      let categorySlug: string | null = null;
      try {
        if (body.category_id) {
          const cr = await pool
            .request()
            .input('cid', sql.Int, body.category_id)
            .query(`SELECT slug FROM dbo.ecommerce_blog_categories WHERE id = @cid`);
          categorySlug = cr.recordset[0]?.slug || null;
        }
      } catch {/* ignore */}

      // baseUrl = the shop's own origin (this same Next.js app)
      const reqUrl = new URL(request.url);
      const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
      const brand = body.company_name || 'Goodies Farm';
      // Don't await — fire and forget. The admin UI gets its 200 immediately.
      notifySubscribersOfNewPost(
        {
          title,
          slug,
          excerpt: body.excerpt || null,
          category_slug: categorySlug,
          cover_image_id: body.cover_image_id || null,
        },
        brand,
        baseUrl
      ).catch((e) => {
        console.warn('[blog] notifySubscribers failed:', e?.message);
      });
    }

    return NextResponse.json({ success: true, id, slug });
  } catch (error: any) {
    console.error('Error creating blog post:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
