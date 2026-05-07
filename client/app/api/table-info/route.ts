import { NextResponse } from 'next/server';
import { getDb2 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb2();
    
    // Get column information for the art table
    const result = await pool.request().query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'art'
      ORDER BY ORDINAL_POSITION
    `);
    
    return NextResponse.json({
      success: true,
      columns: result.recordset
    });
  } catch (error: any) {
    console.error('Error fetching table info:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch table info',
      error: error.message
    }, { status: 500 });
  }
}
