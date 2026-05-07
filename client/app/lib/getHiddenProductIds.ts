import { getDb1 } from './db';

/**
 * Returns the set of product IDs that an admin has marked
 * `hidden_in_ecommerce = 1` in `dbo.ecommerce_article_settings` (DB1).
 * Public listing endpoints (/api/products, /api/search) MUST exclude
 * any ID returned here so hidden products never surface on the shop,
 * category pages, or search results.
 *
 * Cached per-process for 30s — admin toggles propagate within that window.
 * Falls back to an empty set on any DB error so a transient outage doesn't
 * blank out the entire catalog.
 */
type CacheEntry = { ids: Set<number>; expiresAt: number };
let cache: CacheEntry = { ids: new Set(), expiresAt: 0 };
const TTL_MS = 30_000;

export async function getHiddenProductIds(): Promise<Set<number>> {
  const now = Date.now();
  if (cache.expiresAt > now) return cache.ids;

  try {
    const pool = await getDb1();
    // Self-heal: if the table or column doesn't exist yet (first-deploy
    // scenario where admin hasn't visited article-settings), create it
    // idempotently so subsequent reads don't blow up.
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
                     WHERE object_id = OBJECT_ID('dbo.ecommerce_article_settings') AND name = 'hidden_in_ecommerce')
        ALTER TABLE dbo.ecommerce_article_settings ADD hidden_in_ecommerce BIT NOT NULL CONSTRAINT DF_ec_as_hidden DEFAULT 0;
    `);

    const r = await pool.request().query(`
      SELECT product_id FROM dbo.ecommerce_article_settings WHERE hidden_in_ecommerce = 1
    `);
    const ids = new Set<number>();
    for (const row of r.recordset) {
      const n = Number(row.product_id);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
    cache = { ids, expiresAt: now + TTL_MS };
    return ids;
  } catch (err) {
    console.error('getHiddenProductIds failed:', err);
    return new Set();
  }
}

/**
 * Builds the SQL fragment to exclude hidden product IDs from a query, e.g.
 *   `AND a.Id NOT IN (1,2,3)`
 * Returns empty string when nothing is hidden. The IDs are validated as
 * positive integers in getHiddenProductIds() so direct interpolation is safe.
 */
export function buildHiddenIdsExclusion(hiddenIds: Set<number>, columnRef: string): string {
  if (hiddenIds.size === 0) return '';
  return ` AND ${columnRef} NOT IN (${Array.from(hiddenIds).join(',')})`;
}
