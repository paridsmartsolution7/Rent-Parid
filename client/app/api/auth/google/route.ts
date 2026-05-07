import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { getDb1 } from '../../../lib/db';
import { createKlientInDb2, ensureKlientKodiColumn } from '../../../lib/createKlient';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const googleClient = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

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
  `);
}

export async function POST(request: Request) {
  try {
    const { credential } = await request.json();

    if (!credential) {
      return NextResponse.json({ success: false, message: 'Missing credential' }, { status: 400 });
    }

    // Verify token with Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });
    const googleUser = ticket.getPayload();
    if (!googleUser || !googleUser.email) {
      return NextResponse.json({ success: false, message: 'Invalid Google token' }, { status: 401 });
    }
    const { email, name } = googleUser;

    const pool = await getDb1();
    await ensureUsersTable(pool);
    await ensureKlientKodiColumn();

    // Check if user exists
    const existing = await pool.request()
      .input('email', email)
      .query('SELECT id, email, full_name, phone, address, city, postal_code FROM dbo.ecommerce_users WHERE email = @email');

    let user;

    if (existing.recordset.length > 0) {
      // Existing user — log them in
      user = existing.recordset[0];
    } else {
      // New user — Klient in DB2 must succeed BEFORE creating user in DB1
      const displayName = name || email.split('@')[0];
      let klientKodi: string;
      try {
        klientKodi = await createKlientInDb2(displayName, email);
      } catch (klientErr) {
        console.error('Failed to create Klient in DB2 (Google auth):', klientErr);
        return NextResponse.json({
          success: false,
          message: 'Regjistrimi deshtoi. Nuk u krijua klienti ne sistem. Provoni perseri.',
        }, { status: 500 });
      }

      const randomPass = crypto.randomBytes(32).toString('hex');
      const hashedPass = await bcrypt.hash(randomPass, 10);
      const result = await pool.request()
        .input('email', email)
        .input('password_hash', hashedPass)
        .input('full_name', displayName)
        .input('klient_kodi', klientKodi)
        .query(`
          INSERT INTO dbo.ecommerce_users (email, password_hash, full_name, klient_kodi, email_verified, email_verified_at)
          OUTPUT INSERTED.id, INSERTED.email, INSERTED.full_name, INSERTED.phone, INSERTED.address, INSERTED.city, INSERTED.postal_code
          VALUES (@email, @password_hash, @full_name, @klient_kodi, 1, GETDATE())
        `);
      user = result.recordset[0];
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address,
        city: user.city,
        postal_code: user.postal_code,
      }
    });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Google auth error:', error);
    return NextResponse.json({ success: false, message: 'Google auth failed' }, { status: 500 });
  }
}
