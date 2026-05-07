import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../lib/db';
import { getAuthUser } from '../../lib/getAuthUser';
import { isAdminRequest } from '../../lib/getAdminAuth';

const DEFAULT_TITLE = "Bizneset po kalojne online... po ti ? Perfito oferta qe biznesi yt nuk duhet t'i humbase.";
const DEFAULT_SUBTITLE = 'Nga programet te pajisjet gjithçka qe i duhet biznesit tend ne nje vend te vetem.';

// One-shot migration: if a previously-deployed grocery shop has the old
// "Zbritje Vere" copy stored, swap it to the PSS copy. Admins who already
// customised the hero text are untouched (the WHERE filter only matches
// the verbatim grocery defaults).
const LEGACY_GROCERY_TITLE = 'Zbritje Vere — Deri ne 40% Ulje';
const LEGACY_GROCERY_SUBTITLE = 'Zbuloni produktet me te mira ne te gjitha kategorite';

async function ensureHeroTable(pool: sql.ConnectionPool) {
  await pool.request()
    .input('title', sql.NVarChar(255), DEFAULT_TITLE)
    .input('subtitle', sql.NVarChar(500), DEFAULT_SUBTITLE)
    .input('legacyTitle', sql.NVarChar(255), LEGACY_GROCERY_TITLE)
    .input('legacySubtitle', sql.NVarChar(500), LEGACY_GROCERY_SUBTITLE)
    .query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ecommerce_hero' AND xtype='U')
      BEGIN
        CREATE TABLE dbo.ecommerce_hero (
          id INT PRIMARY KEY IDENTITY(1,1),
          hero_title NVARCHAR(255) NOT NULL,
          hero_subtitle NVARCHAR(500) NOT NULL,
          updated_at DATETIME NOT NULL DEFAULT GETDATE()
        );
        INSERT INTO dbo.ecommerce_hero (hero_title, hero_subtitle) VALUES (@title, @subtitle);
      END
      ELSE IF NOT EXISTS (SELECT 1 FROM dbo.ecommerce_hero)
      BEGIN
        INSERT INTO dbo.ecommerce_hero (hero_title, hero_subtitle) VALUES (@title, @subtitle);
      END
      ELSE
      BEGIN
        UPDATE dbo.ecommerce_hero
           SET hero_title    = @title
         WHERE hero_title    = @legacyTitle;
        UPDATE dbo.ecommerce_hero
           SET hero_subtitle = @subtitle
         WHERE hero_subtitle = @legacySubtitle;
      END
    `);
}

export async function GET() {
  try {
    const pool = await getDb2();
    await ensureHeroTable(pool);

    const result = await pool.request().query(`
      SELECT TOP 1 hero_title, hero_subtitle
      FROM dbo.ecommerce_hero
      ORDER BY id DESC
    `);

    const row = result.recordset[0] || { hero_title: DEFAULT_TITLE, hero_subtitle: DEFAULT_SUBTITLE };

    return NextResponse.json({
      success: true,
      hero: {
        hero_title: row.hero_title,
        hero_subtitle: row.hero_subtitle,
      },
    });
  } catch (error: any) {
    console.error('Error fetching hero:', error);
    return NextResponse.json({
      success: false,
      hero: { hero_title: DEFAULT_TITLE, hero_subtitle: DEFAULT_SUBTITLE },
    });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      const user = await getAuthUser(request);
      if (!user) {
        return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });
      }
    }

    const body = await request.json() as { hero_title?: string; hero_subtitle?: string };
    const pool = await getDb2();
    await ensureHeroTable(pool);

    const updates: string[] = [];
    const req = pool.request();
    // Accept empty strings as an explicit "clear" — the previous truthy
    // check silently dropped empty payloads, so admin "clear + save" did
    // nothing in the DB. Now `''` actually persists, and page.tsx renders
    // a clean hero with no title/subtitle.
    if (typeof body.hero_title === 'string') {
      req.input('hero_title', sql.NVarChar(255), body.hero_title.trim());
      updates.push('hero_title = @hero_title');
    }
    if (typeof body.hero_subtitle === 'string') {
      req.input('hero_subtitle', sql.NVarChar(500), body.hero_subtitle.trim());
      updates.push('hero_subtitle = @hero_subtitle');
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: false, message: 'Asnje fushe per te perditesuar' }, { status: 400 });
    }

    updates.push('updated_at = GETDATE()');

    await req.query(`
      UPDATE dbo.ecommerce_hero
      SET ${updates.join(', ')}
      WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_hero ORDER BY id DESC)
    `);

    return NextResponse.json({ success: true, message: 'Hero u perditesua' });
  } catch (error: any) {
    console.error('Error updating hero:', error);
    return NextResponse.json({ success: false, message: 'Perditesimi deshtoi' }, { status: 500 });
  }
}
