import { NextResponse } from 'next/server';
import { getDb1 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb1();

    const createTableQuery = `
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
    `;

    await pool.request().query(createTableQuery);

    return NextResponse.json({
      success: true,
      message: 'ecommerce_users table ready',
      table: 'ecommerce_users',
    });
  } catch (error: any) {
    console.error('Error creating users table:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create ecommerce_users table', error: error.message },
      { status: 500 }
    );
  }
}

