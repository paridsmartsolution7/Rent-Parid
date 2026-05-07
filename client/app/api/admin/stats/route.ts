import { NextResponse } from 'next/server';
import { getDb1, getDb2 } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/getAdminAuth';

const safeCount = async (
  poolPromise: Promise<any>,
  query: string
): Promise<number> => {
  try {
    const pool = await poolPromise;
    const r = await pool.request().query(query);
    return Number(r.recordset?.[0]?.c ?? 0);
  } catch {
    return 0;
  }
};

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const [
      users,
      comments,
      favorites,
      products,
      categories,
      orders,
      visits_total,
      visits_today,
      unique_visitors,
      unique_visitors_today,
    ] = await Promise.all([
      safeCount(getDb1(), 'SELECT COUNT(*) AS c FROM dbo.ecommerce_users'),
      safeCount(getDb1(), 'SELECT COUNT(*) AS c FROM dbo.ecommerce_comments'),
      safeCount(getDb1(), 'SELECT COUNT(*) AS c FROM dbo.ecommerce_favorites'),
      safeCount(getDb2(), 'SELECT COUNT(*) AS c FROM dbo.Art WHERE Aktiv = 1'),
      safeCount(getDb2(), 'SELECT COUNT(*) AS c FROM dbo.Art_Kls01'),
      safeCount(
        getDb2(),
        'SELECT COUNT(*) AS c FROM dbo.PorosiKlient WHERE Aktiv = 1'
      ),
      safeCount(getDb1(), 'SELECT COUNT(*) AS c FROM dbo.ecommerce_visits'),
      safeCount(
        getDb1(),
        "SELECT COUNT(*) AS c FROM dbo.ecommerce_visits WHERE visited_at >= CAST(GETDATE() AS DATE)"
      ),
      safeCount(
        getDb1(),
        'SELECT COUNT(DISTINCT session_id) AS c FROM dbo.ecommerce_visits WHERE session_id IS NOT NULL'
      ),
      safeCount(
        getDb1(),
        "SELECT COUNT(DISTINCT session_id) AS c FROM dbo.ecommerce_visits WHERE session_id IS NOT NULL AND visited_at >= CAST(GETDATE() AS DATE)"
      ),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        users,
        comments,
        favorites,
        products,
        categories,
        orders,
        visits_total,
        visits_today,
        unique_visitors,
        unique_visitors_today,
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
