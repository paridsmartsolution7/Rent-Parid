import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../../lib/db';
import { isAdminRequest } from '../../../../../lib/getAdminAuth';
import { ensureBlogTables, slugify } from '../../../../../lib/blogSchema';
import { notifySubscribersOfNewPost } from '../../../../../lib/blogEmail';

async function getPostId(params: Promise<{ id: string }>) {
  const { id } = await params;
  const pid = parseInt(id, 10);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const pid = await getPostId(params);
  if (!pid) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);
    const r = await pool.request().input('id', sql.Int, pid).query(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM dbo.ecommerce_blog_posts p
      LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
      WHERE p.id = @id
    `);
    const post = r.recordset[0];
    if (!post) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    const tagsRes = await pool.request().input('pid', sql.Int, pid)
      .query(`SELECT tag FROM dbo.ecommerce_blog_post_tags WHERE post_id = @pid ORDER BY tag`);
    const histRes = await pool.request().input('pid', sql.Int, pid)
      .query(`SELECT TOP 50 id, action, operator, username, snapshot_json, at FROM dbo.ecommerce_blog_post_history WHERE post_id = @pid ORDER BY at DESC`);

    return NextResponse.json({
      success: true,
      post: {
        ...post,
        tags: tagsRes.recordset.map((r: any) => r.tag),
        history: histRes.recordset,
      },
    });
  } catch (error: any) {
    console.error('Error reading blog post:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Failed' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const pid = await getPostId(params);
  if (!pid) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const body = (await request.json()) as any;
    const pool = await getDb1();
    await ensureBlogTables(pool);

    // Capture pre-update state so we can detect a draft → published flip
    // and trigger the email fan-out only on that transition.
    let prevPublished: boolean | null = null;
    try {
      const cur = await pool
        .request()
        .input('id', sql.Int, pid)
        .query(`SELECT published FROM dbo.ecommerce_blog_posts WHERE id = @id`);
      prevPublished = !!cur.recordset[0]?.published;
    } catch {/* ignore */}

    const updates: string[] = [];
    const req = pool.request().input('id', sql.Int, pid);

    if (body.title !== undefined) {
      req.input('title', sql.NVarChar(500), body.title);
      updates.push('title = @title');
    }
    if (body.slug !== undefined) {
      req.input('slug', sql.NVarChar(255), slugify(body.slug || body.title || ''));
      updates.push('slug = @slug');
    }
    if (body.excerpt !== undefined) {
      req.input('excerpt', sql.NVarChar(1000), body.excerpt);
      updates.push('excerpt = @excerpt');
    }
    if (body.content_html !== undefined) {
      req.input('content_html', sql.NVarChar(sql.MAX), body.content_html);
      updates.push('content_html = @content_html');
    }
    if (body.category_id !== undefined) {
      req.input('category_id', sql.Int, body.category_id || null);
      updates.push('category_id = @category_id');
    }
    if (body.cover_image_id !== undefined) {
      req.input('cover_image_id', sql.Int, body.cover_image_id || null);
      updates.push('cover_image_id = @cover_image_id');
    }
    if (body.title_size !== undefined) {
      req.input('title_size', sql.NVarChar(20), body.title_size);
      updates.push('title_size = @title_size');
    }
    if (body.published !== undefined) {
      req.input('published', sql.Bit, body.published ? 1 : 0);
      updates.push('published = @published');
      // First time being published?
      if (body.published) {
        updates.push('published_at = ISNULL(published_at, GETDATE())');
      }
    }
    updates.push('updated_at = GETDATE()');

    await req.query(`UPDATE dbo.ecommerce_blog_posts SET ${updates.join(', ')} WHERE id = @id`);

    // Replace tags wholesale if provided
    if (Array.isArray(body.tags)) {
      await pool.request().input('id', sql.Int, pid)
        .query(`DELETE FROM dbo.ecommerce_blog_post_tags WHERE post_id = @id`);
      for (const raw of body.tags) {
        const tag = String(raw).trim().slice(0, 80);
        if (!tag) continue;
        try {
          await pool.request()
            .input('pid', sql.Int, pid)
            .input('tag', sql.NVarChar(80), tag)
            .query(`INSERT INTO dbo.ecommerce_blog_post_tags (post_id, tag) VALUES (@pid, @tag)`);
        } catch {/* dupe */}
      }
    }

    // History
    await pool.request()
      .input('pid', sql.Int, pid)
      .input('op', sql.NVarChar(255), body.operator || null)
      .input('un', sql.NVarChar(255), body.username || null)
      .input('snap', sql.NVarChar(sql.MAX), JSON.stringify({
        updates_keys: Object.keys(body),
      }))
      .query(`
        INSERT INTO dbo.ecommerce_blog_post_history (post_id, action, operator, username, snapshot_json)
        VALUES (@pid, 'update', @op, @un, @snap)
      `);

    // Fan out emails when this update FLIPPED the post from draft → published.
    // Re-publishing an already-published post does NOT re-notify (avoids spam).
    if (body.published === true && prevPublished === false) {
      try {
        const r = await pool
          .request()
          .input('id', sql.Int, pid)
          .query(`
            SELECT p.title, p.slug, p.excerpt, p.cover_image_id, c.slug AS category_slug
            FROM dbo.ecommerce_blog_posts p
            LEFT JOIN dbo.ecommerce_blog_categories c ON c.id = p.category_id
            WHERE p.id = @id
          `);
        const post = r.recordset[0];
        if (post) {
          const reqUrl = new URL(request.url);
          const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;
          const brand = body.company_name || 'Goodies Farm';
          notifySubscribersOfNewPost(post, brand, baseUrl).catch((e) => {
            console.warn('[blog] notifySubscribers failed:', e?.message);
          });
        }
      } catch (e) {
        console.warn('[blog] could not load post for fan-out:', (e as Error).message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating blog post:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Failed' }, { status: 500 });
  }
}

/** Soft-delete (sets deleted_at). Hard purge happens 30 days later via the
 *  GET handler in the parent route. POST without action=restore restores. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const pid = await getPostId(params);
  if (!pid) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const { searchParams } = new URL(request.url);
    const operator = searchParams.get('operator') || null;
    const username = searchParams.get('username') || null;

    const pool = await getDb1();
    await ensureBlogTables(pool);

    await pool.request().input('id', sql.Int, pid).query(`
      UPDATE dbo.ecommerce_blog_posts
      SET deleted_at = GETDATE(), published = 0
      WHERE id = @id
    `);
    await pool.request()
      .input('pid', sql.Int, pid)
      .input('op', sql.NVarChar(255), operator)
      .input('un', sql.NVarChar(255), username)
      .input('snap', sql.NVarChar(sql.MAX), JSON.stringify({ scheduled_purge_in_days: 30 }))
      .query(`
        INSERT INTO dbo.ecommerce_blog_post_history (post_id, action, operator, username, snapshot_json)
        VALUES (@pid, 'delete', @op, @un, @snap)
      `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting blog post:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Failed' }, { status: 500 });
  }
}

/** Restore a soft-deleted post. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  const pid = await getPostId(params);
  if (!pid) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const pool = await getDb1();
    await ensureBlogTables(pool);
    await pool.request().input('id', sql.Int, pid).query(`
      UPDATE dbo.ecommerce_blog_posts SET deleted_at = NULL WHERE id = @id
    `);
    await pool.request()
      .input('pid', sql.Int, pid)
      .input('op', sql.NVarChar(255), body.operator || null)
      .input('un', sql.NVarChar(255), body.username || null)
      .query(`
        INSERT INTO dbo.ecommerce_blog_post_history (post_id, action, operator, username)
        VALUES (@pid, 'restore', @op, @un)
      `);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error restoring blog post:', error);
    return NextResponse.json({ success: false, message: error?.message || 'Failed' }, { status: 500 });
  }
}
