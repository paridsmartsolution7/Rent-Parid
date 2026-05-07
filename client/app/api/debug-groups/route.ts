import { NextResponse } from 'next/server';
import { getDb2 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb2();

    const categories = await pool.request().query(`SELECT TOP 10 * FROM Art_Kls01`);
    const artColumns = await pool.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Art' AND COLUMN_NAME LIKE '%Kls%'`);
    const sampleProducts = await pool.request().query(`SELECT TOP 5 Id, Pershkrim, Art_Kls01_Kodi FROM Art WHERE Aktiv = 1 AND Cmimi > 0`);

    return NextResponse.json({
      art_kls01_sample: categories.recordset,
      art_kls_columns: artColumns.recordset,
      product_sample: sampleProducts.recordset
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
