import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../../lib/db';

/**
 * Public endpoint the shop frontend hits once per page-load to record a
 * visitor hit. Stored in {nipt}Eccomerce.dbo.ecommerce_visits so it follows
 * the tenant. The admin dashboard reads these counts via /api/admin/stats.
 *
 *   POST /api/track/visit   -> { session_id?, path? }
 *
 * session_id is generated client-side (uuid in localStorage) so we can also
 * derive a unique-visitor count without bothering with cookies/auth.
 */
async function ensureTable(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_visits' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_visits (
        id          BIGINT IDENTITY(1,1) PRIMARY KEY,
        session_id  NVARCHAR(64)  NULL,
        path        NVARCHAR(500) NULL,
        ip          NVARCHAR(64)  NULL,
        user_agent  NVARCHAR(500) NULL,
        visited_at  DATETIME      NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_ecommerce_visits_visited_at ON dbo.ecommerce_visits(visited_at);
      CREATE INDEX IX_ecommerce_visits_session ON dbo.ecommerce_visits(session_id);
    END;
  `);
}

function readClientIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip') || null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      session_id?: string;
      path?: string;
    };
    const sessionId = (body.session_id || '').slice(0, 64) || null;
    const path = (body.path || '').slice(0, 500) || null;
    const ip = (readClientIp(request) || '').slice(0, 64) || null;
    const userAgent = (request.headers.get('user-agent') || '').slice(0, 500) || null;

    const pool = await getDb1();
    await ensureTable(pool);

    await pool
      .request()
      .input('session_id', sql.NVarChar(64), sessionId)
      .input('path', sql.NVarChar(500), path)
      .input('ip', sql.NVarChar(64), ip)
      .input('user_agent', sql.NVarChar(500), userAgent)
      .query(`
        INSERT INTO dbo.ecommerce_visits (session_id, path, ip, user_agent)
        VALUES (@session_id, @path, @ip, @user_agent)
      `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking visit:', error);
    // Never let analytics failures bubble up to the shop UI.
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
