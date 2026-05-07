import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/getAdminAuth';

/**
 * Per-product overrides for comments / reviews. Lives in {nipt}Eccomerce so it
 * follows the tenant. A row exists only when at least one override is set.
 *
 *   GET    /api/admin/article-settings           -> { items: [...] }
 *   PUT    /api/admin/article-settings           -> { product_id, comments_blocked, reviews_blocked, delivery_blocked, hidden_in_ecommerce }
 *   DELETE /api/admin/article-settings?product_id=N
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_article_settings' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_article_settings (
        product_id          INT NOT NULL PRIMARY KEY,
        comments_blocked    BIT NOT NULL CONSTRAINT DF_ec_as_cb DEFAULT 0,
        reviews_blocked     BIT NOT NULL CONSTRAINT DF_ec_as_rb DEFAULT 0,
        delivery_blocked    BIT NOT NULL CONSTRAINT DF_ec_as_db DEFAULT 0,
        hidden_in_ecommerce BIT NOT NULL CONSTRAINT DF_ec_as_hidden DEFAULT 0,
        updated_at          DATETIME NOT NULL DEFAULT GETDATE()
      );
    END;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_article_settings') AND name = 'delivery_blocked')
      ALTER TABLE dbo.ecommerce_article_settings ADD delivery_blocked BIT NOT NULL CONSTRAINT DF_ec_as_db DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_article_settings') AND name = 'hidden_in_ecommerce')
      ALTER TABLE dbo.ecommerce_article_settings ADD hidden_in_ecommerce BIT NOT NULL CONSTRAINT DF_ec_as_hidden DEFAULT 0;
  `);
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureTable(pool);
    const r = await pool.request().query(`
      SELECT product_id, comments_blocked, reviews_blocked, delivery_blocked, hidden_in_ecommerce, updated_at
      FROM dbo.ecommerce_article_settings
      ORDER BY product_id
    `);
    return NextResponse.json({ success: true, items: r.recordset });
  } catch (error: any) {
    console.error('Error reading article settings:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      product_id?: number;
      comments_blocked?: boolean;
      reviews_blocked?: boolean;
      delivery_blocked?: boolean;
      hidden_in_ecommerce?: boolean;
    };
    const pid = Number(body.product_id);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { success: false, message: 'product_id is required' },
        { status: 400 }
      );
    }
    const cb = body.comments_blocked ? 1 : 0;
    const rb = body.reviews_blocked ? 1 : 0;
    const db = body.delivery_blocked ? 1 : 0;
    const hi = body.hidden_in_ecommerce ? 1 : 0;

    const pool = await getDb1();
    await ensureTable(pool);

    // If everything is false, delete the row to keep the table tidy.
    if (cb === 0 && rb === 0 && db === 0 && hi === 0) {
      await pool
        .request()
        .input('pid', sql.Int, pid)
        .query('DELETE FROM dbo.ecommerce_article_settings WHERE product_id = @pid');
      return NextResponse.json({ success: true, deleted: true });
    }

    await pool
      .request()
      .input('pid', sql.Int, pid)
      .input('cb', sql.Bit, cb)
      .input('rb', sql.Bit, rb)
      .input('db', sql.Bit, db)
      .input('hi', sql.Bit, hi)
      .query(`
        MERGE dbo.ecommerce_article_settings AS t
        USING (SELECT @pid AS product_id) AS s
        ON t.product_id = s.product_id
        WHEN MATCHED THEN
          UPDATE SET comments_blocked = @cb, reviews_blocked = @rb, delivery_blocked = @db, hidden_in_ecommerce = @hi, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (product_id, comments_blocked, reviews_blocked, delivery_blocked, hidden_in_ecommerce) VALUES (@pid, @cb, @rb, @db, @hi);
      `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving article settings:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const pid = parseInt(searchParams.get('product_id') || '0', 10);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { success: false, message: 'product_id query param required' },
        { status: 400 }
      );
    }
    const pool = await getDb1();
    await ensureTable(pool);
    await pool
      .request()
      .input('pid', sql.Int, pid)
      .query('DELETE FROM dbo.ecommerce_article_settings WHERE product_id = @pid');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting article settings:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
