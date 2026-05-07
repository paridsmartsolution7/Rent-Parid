import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb1 } from "../../../lib/db";
import { checkRateLimit, getClientIp } from '../../../lib/rateLimit';

async function ensureUsersAndVerificationTables(pool: any) {
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

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`verify:${ip}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json({ success: false, message: 'Shume perpjekje. Provoni perseri me vone.' }, { status: 429 });
    }

    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { success: false, message: "Email and code are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(String(code))) {
      return NextResponse.json(
        { success: false, message: "Code must be 4 digits" },
        { status: 400 }
      );
    }

    const pool = await getDb1();
    await ensureUsersAndVerificationTables(pool);

    const userRes = await pool
      .request()
      .input("email", email)
      .query("SELECT id, email_verified FROM dbo.ecommerce_users WHERE email = @email");

    if (userRes.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const user = userRes.recordset[0];
    if (user.email_verified) {
      return NextResponse.json({ success: true, message: "Email already verified" });
    }

    const verRes = await pool
      .request()
      .input("userId", user.id)
      .query(`
        SELECT TOP 1 id, code_hash, expires_at, attempts
        FROM dbo.ecommerce_email_verifications
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);

    if (verRes.recordset.length === 0) {
      return NextResponse.json(
        { success: false, message: "No verification code found. Please register again." },
        { status: 400 }
      );
    }

    const v = verRes.recordset[0];
    const expired = new Date(v.expires_at).getTime() < Date.now();
    if (expired) {
      return NextResponse.json(
        { success: false, message: "Code expired. Please resend a new code." },
        { status: 400 }
      );
    }

    if ((v.attempts ?? 0) >= 5) {
      return NextResponse.json(
        { success: false, message: "Too many attempts. Please resend a new code." },
        { status: 429 }
      );
    }

    const ok = await bcrypt.compare(String(code), v.code_hash);

    await pool
      .request()
      .input("id", v.id)
      .query("UPDATE dbo.ecommerce_email_verifications SET attempts = attempts + 1 WHERE id = @id");

    if (!ok) {
      return NextResponse.json(
        { success: false, message: "Invalid code" },
        { status: 400 }
      );
    }

    await pool
      .request()
      .input("userId", user.id)
      .query(`
        UPDATE dbo.ecommerce_users
        SET email_verified = 1, email_verified_at = GETDATE()
        WHERE id = @userId
      `);

    await pool
      .request()
      .input("userId", user.id)
      .query("DELETE FROM dbo.ecommerce_email_verifications WHERE user_id = @userId");

    return NextResponse.json({ success: true, message: "Email verified successfully" });
  } catch (error: any) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { success: false, message: "Verification failed" },
      { status: 500 }
    );
  }
}

