import { NextResponse } from 'next/server';
import { getDb1, getDb2 } from '../../../lib/db';
import { getAuthUser } from '../../../lib/getAuthUser';

async function ensureUsersTable(pool: any) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ecommerce_users' AND xtype='U')
    BEGIN
      CREATE TABLE dbo.ecommerce_users (
        id INT PRIMARY KEY IDENTITY(1,1),
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        phone NVARCHAR(50) NULL,
        address NVARCHAR(500) NULL,
        city NVARCHAR(255) NULL,
        postal_code NVARCHAR(50) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );

      CREATE UNIQUE INDEX IX_ecommerce_users_email ON dbo.ecommerce_users(email);
    END
  `);
}

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const pool = await getDb1();
    await ensureUsersTable(pool);

    await pool.request().query(`
      IF COL_LENGTH('dbo.ecommerce_users', 'klient_kodi') IS NULL
      BEGIN
        ALTER TABLE dbo.ecommerce_users ADD klient_kodi NVARCHAR(25) NULL;
      END
    `);

    const result = await pool.request()
      .input('userId', user.userId)
      .query('SELECT id, email, full_name, phone, address, city, postal_code, klient_kodi, created_at FROM dbo.ecommerce_users WHERE id = @userId');

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 });
    }

    const userRow = result.recordset[0];
    let tip_cmimi: string | null = null;
    if (userRow.klient_kodi) {
      try {
        const db2 = await getDb2();
        const r2 = await db2.request()
          .input('kodi', userRow.klient_kodi)
          .query('SELECT Tip_Cmimi FROM Klient WHERE Kodi = @kodi');
        tip_cmimi = r2.recordset[0]?.Tip_Cmimi || null;
      } catch (e) {
        console.error('Failed to fetch Tip_Cmimi from DB2:', e);
      }
    }

    return NextResponse.json({
      success: true,
      user: { ...userRow, tip_cmimi }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Authentication failed'
    }, { status: 401 });
  }
}
