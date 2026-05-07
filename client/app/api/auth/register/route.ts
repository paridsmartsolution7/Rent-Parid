import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb1 } from '../../../lib/db';
import nodemailer from 'nodemailer';
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';
import { createKlientInDb2, ensureKlientKodiColumn } from '../../../lib/createKlient';

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

async function ensureEmailVerificationTable(pool: any) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ecommerce_email_verifications' AND xtype='U')
    BEGIN
      CREATE TABLE dbo.ecommerce_email_verifications (
        id INT PRIMARY KEY IDENTITY(1,1),
        user_id INT NOT NULL,
        code_hash NVARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        attempts INT NOT NULL CONSTRAINT DF_ecommerce_email_verifications_attempts DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ecommerce_email_verifications_user_id ON dbo.ecommerce_email_verifications(user_id);
    END
  `);
}

function generate4DigitCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function sendVerificationCodeEmail(toEmail: string, code: string) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD env vars");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: user,
    to: toEmail,
    subject: "Kodi juaj i verifikimit",
    text: `Kodi juaj i verifikimit eshte: ${code}\n\nKy kod skadon pas 10 minutash.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.4">
        <h2 style="margin:0 0 12px 0">Verifikimi i email-it</h2>
        <p style="margin:0 0 10px 0">Kodi juaj i verifikimit eshte:</p>
        <div style="font-size:28px;letter-spacing:6px;font-weight:700;margin:10px 0 16px 0">${code}</div>
        <p style="margin:0;color:#666">Ky kod skadon pas 10 minutash.</p>
      </div>
    `,
  });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`register:${ip}`, 3, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Shume perpjekje. Provoni perseri me vone.' }, { status: 429 });
    }

    const { email, password, full_name, phone, address, city, postal_code } = await request.json();

    if (!email || !password || !full_name) {
      return NextResponse.json({
        success: false,
        message: 'Email, password, and full name are required'
      }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({
        success: false,
        message: 'Fjalekalimi duhet te kete te pakten 8 karaktere'
      }, { status: 400 });
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({
        success: false,
        message: 'Fjalekalimi duhet te permbaje shkronja te medha, te vogla dhe numra'
      }, { status: 400 });
    }

    const pool = await getDb1();
    await ensureUsersTable(pool);
    await ensureEmailVerificationTable(pool);
    await ensureKlientKodiColumn();

    // Check if user already exists
    const existingUser = await pool.request()
      .input('email', email)
      .query('SELECT id FROM dbo.ecommerce_users WHERE email = @email');

    if (existingUser.recordset.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Regjistrimi deshtoi. Provoni perseri.'
      }, { status: 400 });
    }

    // Create Klient in DB2 FIRST — no DB1 user is created unless this succeeds
    let klientKodi: string;
    try {
      klientKodi = await createKlientInDb2(full_name, email, phone, address, city, postal_code);
    } catch (klientErr) {
      console.error('Failed to create Klient in DB2:', klientErr);
      return NextResponse.json({
        success: false,
        message: 'Regjistrimi deshtoi. Nuk u krijua klienti ne sistem. Provoni perseri.',
      }, { status: 500 });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert new user with klient_kodi already linked
    const result = await pool.request()
      .input('email', email)
      .input('password_hash', password_hash)
      .input('full_name', full_name)
      .input('phone', phone || null)
      .input('address', address || null)
      .input('city', city || null)
      .input('postal_code', postal_code || null)
      .input('klient_kodi', klientKodi)
      .query(`
        INSERT INTO dbo.ecommerce_users (email, password_hash, full_name, phone, address, city, postal_code, klient_kodi, email_verified)
        OUTPUT INSERTED.id, INSERTED.email, INSERTED.full_name, INSERTED.phone, INSERTED.address, INSERTED.city, INSERTED.postal_code, INSERTED.klient_kodi, INSERTED.created_at, INSERTED.email_verified
        VALUES (@email, @password_hash, @full_name, @phone, @address, @city, @postal_code, @klient_kodi, 0)
      `);

    const user = result.recordset[0];

    // Create verification code (valid 10 minutes)
    const code = generate4DigitCode();
    const code_hash = await bcrypt.hash(code, 10);
    await pool.request()
      .input('user_id', user.id)
      .query('DELETE FROM dbo.ecommerce_email_verifications WHERE user_id = @user_id');
    await pool.request()
      .input('user_id', user.id)
      .input('code_hash', code_hash)
      .query(`
        INSERT INTO dbo.ecommerce_email_verifications (user_id, code_hash, expires_at)
        VALUES (@user_id, @code_hash, DATEADD(minute, 10, GETDATE()))
      `);

    await sendVerificationCodeEmail(email, code);

    return NextResponse.json({
      success: true,
      message: 'User registered. Verification code sent to email.',
      needs_email_verification: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address,
        city: user.city,
        postal_code: user.postal_code
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json({
      success: false,
      message: 'Registration failed',
      error: error.message
    }, { status: 500 });
  }
}
