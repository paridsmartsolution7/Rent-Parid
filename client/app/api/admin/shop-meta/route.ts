import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../../lib/db';
import { isAdminRequest } from '../../../lib/getAdminAuth';

/**
 * Manages dbo.ecommerce_tenant_meta inside the per-tenant {nipt}Eccomerce DB.
 * Holds the public Next.js shop URL + the MSSQL connection string for this
 * tenant, so ops can see at a glance what's wired to what from the admin UI.
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (
      SELECT 1 FROM sysobjects WHERE name = 'ecommerce_tenant_meta' AND xtype = 'U'
    )
    BEGIN
      CREATE TABLE dbo.ecommerce_tenant_meta (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        shop_url          NVARCHAR(500)  NULL,
        connection_string NVARCHAR(MAX)  NULL,
        admin_key         NVARCHAR(255)  NULL,
        notes             NVARCHAR(1000) NULL,
        updated_at        DATETIME       NOT NULL DEFAULT GETDATE()
      );
    END;

    -- Auto-add columns for installs that pre-date them.
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.ecommerce_tenant_meta')
        AND name = 'connection_string'
    )
    BEGIN
      ALTER TABLE dbo.ecommerce_tenant_meta ADD connection_string NVARCHAR(MAX) NULL;
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.ecommerce_tenant_meta')
        AND name = 'admin_key'
    )
    BEGIN
      ALTER TABLE dbo.ecommerce_tenant_meta ADD admin_key NVARCHAR(255) NULL;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.ecommerce_tenant_meta)
    BEGIN
      INSERT INTO dbo.ecommerce_tenant_meta (shop_url) VALUES (NULL);
    END;
  `);
}

/**
 * Self-register from env on every ensureTable() call. Fills ONLY the columns
 * that are still NULL so any admin edit via PUT wins. The Parid POS reads
 * (shop_url, admin_key) from this row to build its `/ecommerce/check`
 * response — making the whole pipeline data-driven without hardcoded maps.
 */
async function seedFromEnv(pool: ConnectionPool) {
  const appUrl = (process.env.APP_URL || '').replace(/\/+$/, '');
  const shopUrlFromEnv = appUrl ? `${appUrl}/api` : null;
  const adminKeyFromEnv = process.env.ADMIN_API_KEY || null;

  if (!shopUrlFromEnv && !adminKeyFromEnv) return;

  await pool
    .request()
    .input('shop_url', sql.NVarChar(500), shopUrlFromEnv)
    .input('admin_key', sql.NVarChar(255), adminKeyFromEnv)
    .query(`
      UPDATE dbo.ecommerce_tenant_meta
      SET shop_url  = COALESCE(NULLIF(LTRIM(RTRIM(shop_url)), ''), @shop_url),
          admin_key = COALESCE(NULLIF(LTRIM(RTRIM(admin_key)), ''), @admin_key)
      WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_tenant_meta ORDER BY id DESC)
    `);
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const pool = await getDb1();
    await ensureTable(pool);
    await seedFromEnv(pool);

    const r = await pool.request().query(`
      SELECT TOP 1 id, shop_url, connection_string, admin_key, notes, updated_at
      FROM dbo.ecommerce_tenant_meta
      ORDER BY id DESC
    `);

    return NextResponse.json({
      success: true,
      meta: r.recordset[0] || {
        shop_url: null,
        connection_string: null,
        admin_key: null,
        notes: null,
      },
    });
  } catch (error: any) {
    console.error('Error reading tenant meta:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to read tenant meta' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as {
      shop_url?: string | null;
      connection_string?: string | null;
      admin_key?: string | null;
      notes?: string | null;
    };

    const pool = await getDb1();
    await ensureTable(pool);
    await seedFromEnv(pool);

    const req = pool.request();
    const updates: string[] = [];
    if (body.shop_url !== undefined) {
      req.input('shop_url', sql.NVarChar(500), body.shop_url ?? null);
      updates.push('shop_url = @shop_url');
    }
    if (body.connection_string !== undefined) {
      req.input(
        'connection_string',
        sql.NVarChar(sql.MAX),
        body.connection_string ?? null
      );
      updates.push('connection_string = @connection_string');
    }
    if (body.admin_key !== undefined) {
      req.input('admin_key', sql.NVarChar(255), body.admin_key ?? null);
      updates.push('admin_key = @admin_key');
    }
    if (body.notes !== undefined) {
      req.input('notes', sql.NVarChar(1000), body.notes ?? null);
      updates.push('notes = @notes');
    }
    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Asnje fushe per te perditesuar' },
        { status: 400 }
      );
    }
    updates.push('updated_at = GETDATE()');

    await req.query(`
      UPDATE dbo.ecommerce_tenant_meta
      SET ${updates.join(', ')}
      WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_tenant_meta ORDER BY id DESC)
    `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating tenant meta:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to update tenant meta' },
      { status: 500 }
    );
  }
}
