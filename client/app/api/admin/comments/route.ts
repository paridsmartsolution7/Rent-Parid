import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/getAdminAuth';

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10))
    );
    const offset = (page - 1) * pageSize;

    const pool = await getDb1();

    const countReq = pool.request();
    const listReq = pool
      .request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, pageSize);

    const [countRes, listRes] = await Promise.all([
      countReq.query('SELECT COUNT(*) AS total FROM dbo.ecommerce_comments'),
      listReq.query(`
        SELECT
          c.id,
          c.user_id,
          c.product_id,
          c.comment_text AS commentText,
          c.created_at  AS createdAt,
          u.full_name   AS userName,
          u.email       AS userEmail
        FROM dbo.ecommerce_comments c
        LEFT JOIN dbo.ecommerce_users u ON u.id = c.user_id
        ORDER BY c.created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
    ]);

    return NextResponse.json({
      success: true,
      comments: listRes.recordset,
      total: countRes.recordset[0]?.total ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('Error fetching admin comments:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
