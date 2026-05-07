import { NextResponse } from 'next/server';
import { getDb2 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb2();
    const result = await pool.request().query(`
      SELECT
        Id as id,
        Kodi as kodi,
        RTRIM(Pershkrim) as name,
        ISNULL(Cmimi, 0) as price,
        ISNULL(Njesi_Kodi, '') as unit
      FROM Sherbim
      WHERE Aktiv = 1
      ORDER BY Pershkrim
    `);
    return NextResponse.json({ success: true, services: result.recordset });
  } catch (error: any) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch services' }, { status: 500 });
  }
}
