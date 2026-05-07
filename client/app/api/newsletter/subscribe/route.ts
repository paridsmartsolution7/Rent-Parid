import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../../lib/db';

/**
 * Newsletter subscription. Public POST — anyone can opt in from the homepage
 * "Bashkohu me komunitetin tone" form. Stored in {nipt}Eccomerce so it
 * follows the tenant. Idempotent: re-subscribing with the same email
 * re-activates the row instead of erroring.
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_newsletter_subscribers' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_newsletter_subscribers (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        email           NVARCHAR(320) NOT NULL,
        active          BIT           NOT NULL CONSTRAINT DF_news_active DEFAULT 1,
        subscribed_at   DATETIME      NOT NULL DEFAULT GETDATE(),
        unsubscribed_at DATETIME      NULL,
        last_notified_at DATETIME     NULL
      );
      CREATE UNIQUE INDEX IX_news_email ON dbo.ecommerce_newsletter_subscribers(email);
    END;
  `);
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = (body.email || '').trim().toLowerCase().slice(0, 320);
    if (!email || !EMAIL_RX.test(email)) {
      return NextResponse.json(
        { success: false, message: 'Email-i nuk eshte i vlefshem.' },
        { status: 400 }
      );
    }

    const pool = await getDb1();
    await ensureTable(pool);

    await pool
      .request()
      .input('email', sql.NVarChar(320), email)
      .query(`
        MERGE dbo.ecommerce_newsletter_subscribers AS t
        USING (SELECT @email AS email) AS s
        ON t.email = s.email
        WHEN MATCHED THEN
          UPDATE SET active = 1, unsubscribed_at = NULL, subscribed_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (email, active) VALUES (@email, 1);
      `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error subscribing to newsletter:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
