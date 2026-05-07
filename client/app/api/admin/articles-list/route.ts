import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/getAdminAuth';

/**
 * Lightweight list of products for the admin "Bllokim per artikull" picker.
 * Returns just id + code + name so the dropdown loads fast even for tenants
 * with thousands of articles. Optional ?search=foo filter for type-ahead.
 */
export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').trim();
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '200', 10)));

    const pool = await getDb2();
    const req = pool.request().input('limit', sql.Int, limit);

    let where = 'WHERE a.Aktiv = 1';
    if (search) {
      req.input('search', sql.NVarChar, `%${search}%`);
      where += ' AND (a.Pershkrim LIKE @search OR a.Kodi LIKE @search OR CAST(a.Id AS NVARCHAR) = @searchExact)';
      req.input('searchExact', sql.NVarChar, search);
    }

    const r = await req.query(`
      SELECT TOP (@limit)
        a.Id AS id,
        a.Kodi AS code,
        a.Pershkrim AS name
      FROM dbo.Art a
      ${where}
      ORDER BY a.Pershkrim
    `);

    return NextResponse.json({ success: true, items: r.recordset });
  } catch (error: any) {
    console.error('Error listing articles:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
