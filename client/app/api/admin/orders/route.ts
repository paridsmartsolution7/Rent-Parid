import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../../lib/db';
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

    const pool = await getDb2();

    const countReq = pool.request();
    const listReq = pool
      .request()
      .input('offset', sql.Int, offset)
      .input('limit', sql.Int, pageSize);

    const [countRes, listRes] = await Promise.all([
      countReq.query(
        'SELECT COUNT(*) AS total FROM dbo.PorosiKlient WHERE Aktiv = 1'
      ),
      listReq.query(`
        SELECT
          p.Id          AS id,
          p.Kodi        AS code,
          p.Data        AS data,
          p.Vlera       AS total,
          p.Mon         AS currency,
          p.Status_Kodi AS status,
          p.Confirmed   AS confirmed,
          p.KLFU_Kodi   AS customer_code,
          ISNULL(k.Pershkrim, '') AS customer_name,
          ISNULL(k.Email, '')     AS email,
          p.Inserted    AS created_at
        FROM dbo.PorosiKlient p
        LEFT JOIN dbo.Klient k ON k.Kodi = p.KLFU_Kodi
        WHERE p.Aktiv = 1
        ORDER BY p.Data DESC, p.Id DESC
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
    ]);

    return NextResponse.json({
      success: true,
      orders: listRes.recordset,
      total: countRes.recordset[0]?.total ?? 0,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
