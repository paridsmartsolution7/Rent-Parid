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
    const search = (searchParams.get('search') || '').trim();
    const offset = (page - 1) * pageSize;

    const pool = await getDb1();

    const where = search
      ? `WHERE email LIKE @search OR full_name LIKE @search OR phone LIKE @search OR city LIKE @search`
      : '';

    const countReq = pool.request();
    const listReq = pool.request();
    if (search) {
      countReq.input('search', sql.NVarChar, `%${search}%`);
      listReq.input('search', sql.NVarChar, `%${search}%`);
    }
    listReq.input('offset', sql.Int, offset);
    listReq.input('limit', sql.Int, pageSize);

    const [countRes, listRes] = await Promise.all([
      countReq.query(`SELECT COUNT(*) AS total FROM dbo.ecommerce_users ${where}`),
      listReq.query(`
        SELECT
          id,
          email,
          full_name,
          phone,
          address,
          city,
          postal_code,
          created_at
        FROM dbo.ecommerce_users
        ${where}
        ORDER BY created_at DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
    ]);

    return NextResponse.json({
      success: true,
      users: listRes.recordset,
      total: countRes.recordset[0]?.total ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
