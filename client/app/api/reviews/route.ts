import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../lib/db';
import { getAuthUser } from '../../lib/getAuthUser';
import { getArticleBlocks, getConfigFlags } from '../../lib/getConfigFlags';

const REVIEWS_BLOCKED_MSG = 'Vleresimet per kete artikull jane te bllokuara';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = parseInt(searchParams.get('productId') || '0');
    if (!productId) return NextResponse.json({ success: false, message: 'Missing productId' }, { status: 400 });

    const pool = await getDb1();
    const result = await pool.request()
      .input('productId', sql.Int, productId)
      .query(`
        SELECT r.id, r.rating, r.review_text as reviewText, r.created_at as createdAt,
               u.full_name as userName
        FROM dbo.ecommerce_reviews r
        JOIN dbo.ecommerce_users u ON r.user_id = u.id
        WHERE r.product_id = @productId
        ORDER BY r.created_at DESC
      `);

    return NextResponse.json({ success: true, reviews: result.recordset });
  } catch (error: any) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch reviews' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });

    const { productId, rating, reviewText } = await request.json();
    if (!productId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: 'Vleresimi duhet te jete 1-5' }, { status: 400 });
    }

    const flags = await getConfigFlags();
    if (!flags.reviews_enabled) {
      return NextResponse.json(
        { success: false, blocked: true, message: REVIEWS_BLOCKED_MSG },
        { status: 403 }
      );
    }
    const blocks = await getArticleBlocks(Number(productId));
    if (blocks.reviews_blocked) {
      return NextResponse.json(
        { success: false, blocked: true, message: REVIEWS_BLOCKED_MSG },
        { status: 403 }
      );
    }

    const pool = await getDb1();

    // Upsert: update if exists, insert if not
    const existing = await pool.request()
      .input('userId', sql.Int, user.userId)
      .input('productId', sql.Int, productId)
      .query('SELECT id FROM dbo.ecommerce_reviews WHERE user_id = @userId AND product_id = @productId');

    if (existing.recordset.length > 0) {
      await pool.request()
        .input('userId', sql.Int, user.userId)
        .input('productId', sql.Int, productId)
        .input('rating', sql.Int, rating)
        .input('reviewText', sql.NVarChar(1000), (reviewText || '').substring(0, 1000))
        .query('UPDATE dbo.ecommerce_reviews SET rating = @rating, review_text = @reviewText, created_at = GETDATE() WHERE user_id = @userId AND product_id = @productId');
    } else {
      await pool.request()
        .input('userId', sql.Int, user.userId)
        .input('productId', sql.Int, productId)
        .input('rating', sql.Int, rating)
        .input('reviewText', sql.NVarChar(1000), (reviewText || '').substring(0, 1000))
        .query('INSERT INTO dbo.ecommerce_reviews (user_id, product_id, rating, review_text) VALUES (@userId, @productId, @rating, @reviewText)');
    }

    return NextResponse.json({ success: true, message: 'Vleresimi u ruajt' });
  } catch (error: any) {
    console.error('Error saving review:', error);
    return NextResponse.json({ success: false, message: 'Deshtoi ruajtja e vleresimit' }, { status: 500 });
  }
}
