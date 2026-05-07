import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../lib/db';

/**
 * Soft-unsubscribe by email. Linked from the footer of every newsletter.
 * Public GET so it works as a one-click link from the email client.
 *
 *   GET /api/newsletter/unsubscribe?email=...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get('email') || '').trim().toLowerCase();
    if (!email) {
      return new NextResponse('Email i pavlefshem.', { status: 400 });
    }
    const pool = await getDb1();
    await pool
      .request()
      .input('email', sql.NVarChar(320), email)
      .query(`
        UPDATE dbo.ecommerce_newsletter_subscribers
        SET active = 0, unsubscribed_at = GETDATE()
        WHERE email = @email
      `);
    return new NextResponse(
      `<html><body style="font-family:system-ui;padding:48px;text-align:center;">
         <h2>Cregjistrimi u krye</h2>
         <p>Nuk do te merrni me njoftime per postimet e blog-ut.</p>
       </body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error: any) {
    console.error('Error unsubscribing:', error);
    return new NextResponse('Gabim', { status: 500 });
  }
}
