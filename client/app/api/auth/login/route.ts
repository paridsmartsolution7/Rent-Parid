import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb1 } from '../../../lib/db';
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';

const JWT_SECRET = process.env.JWT_SECRET!;

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
        email_verified BIT NOT NULL CONSTRAINT DF_ecommerce_users_email_verified DEFAULT 1,
        email_verified_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );

      CREATE UNIQUE INDEX IX_ecommerce_users_email ON dbo.ecommerce_users(email);
    END

    IF COL_LENGTH('dbo.ecommerce_users', 'email_verified') IS NULL
    BEGIN
      ALTER TABLE dbo.ecommerce_users
      ADD email_verified BIT NOT NULL CONSTRAINT DF_ecommerce_users_email_verified DEFAULT 1;
    END
    IF COL_LENGTH('dbo.ecommerce_users', 'email_verified_at') IS NULL
    BEGIN
      ALTER TABLE dbo.ecommerce_users
      ADD email_verified_at DATETIME NULL;
    END
  `);
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Shume perpjekje. Provoni perseri me vone.' }, { status: 429 });
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        message: 'Email and password are required'
      }, { status: 400 });
    }

    const pool = await getDb1();
    await ensureUsersTable(pool);
    
    // Find user
    const result = await pool.request()
      .input('email', email)
      .query('SELECT * FROM dbo.ecommerce_users WHERE email = @email');

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    const user = result.recordset[0];

    if (user.email_verified === false || user.email_verified === 0) {
      return NextResponse.json({
        success: false,
        message: 'Please verify your email before logging in'
      }, { status: 403 });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json({
        success: false,
        message: 'Invalid email or password'
      }, { status: 401 });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address,
        city: user.city,
        postal_code: user.postal_code
      },
      token
    });

    // Set HTTP-only cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 // 1 day
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      message: 'Login failed',
      error: error.message
    }, { status: 500 });
  }
}
