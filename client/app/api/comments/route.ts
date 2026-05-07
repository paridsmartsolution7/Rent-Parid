import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../lib/db';
import { getAuthUser } from '../../lib/getAuthUser';
import { getArticleBlocks, getConfigFlags } from '../../lib/getConfigFlags';

const COMMENTS_BLOCKED_MSG = 'Komentet per kete artikull jane te bllokuara';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get('productId') || '0');
    if (!productId) return NextResponse.json({ success: false, message: 'Missing productId' }, { status: 400 });

    const pool = await getDb1();
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT c.id, c.comment_text as commentText, c.created_at as createdAt,
               u.full_name as userName
        FROM dbo.ecommerce_comments c
        JOIN dbo.ecommerce_users u ON c.user_id = u.id
        WHERE c.product_id = @productId
        ORDER BY c.created_at DESC
      `);

    return NextResponse.json({ success: true, comments: result.recordset });
  } catch (error: any) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch comments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });

    const { productId, commentText } = await request.json();
    if (!productId || !commentText || commentText.trim().length === 0) {
      return NextResponse.json({ success: false, message: 'Komenti nuk mund te jete bosh' }, { status: 400 });
    }

    const flags = await getConfigFlags();
    if (!flags.comments_enabled) {
      return NextResponse.json(
        { success: false, blocked: true, message: COMMENTS_BLOCKED_MSG },
        { status: 403 }
      );
    }
    const blocks = await getArticleBlocks(Number(productId));
    if (blocks.comments_blocked) {
      return NextResponse.json(
        { success: false, blocked: true, message: COMMENTS_BLOCKED_MSG },
        { status: 403 }
      );
    }

    const pool = await getDb1();
    await pool.request()
      .input('userId', sql.Int, user.userId)
      .input('productId', sql.Int, productId)
      .input('commentText', sql.NVarChar(1000), commentText.trim().substring(0, 1000))
      .query('INSERT INTO dbo.ecommerce_comments (user_id, product_id, comment_text) VALUES (@userId, @productId, @commentText)');

    return NextResponse.json({ success: true, message: 'Komenti u shtua' });
  } catch (error: any) {
    console.error('Error saving comment:', error);
    return NextResponse.json({ success: false, message: 'Deshtoi ruajtja e komentit' }, { status: 500 });
  }
}
