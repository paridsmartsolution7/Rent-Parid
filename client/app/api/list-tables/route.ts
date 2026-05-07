import { NextResponse } from 'next/server';
import { getDb2 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb2();
    
    const result = await pool.request().query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    return NextResponse.json({
      success: true,
      tables: result.recordset.map(r => r.TABLE_NAME)
    });
  } catch (error: any) {
    console.error('Error listing tables:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to list tables',
      error: error.message
    }, { status: 500 });
  }
}
