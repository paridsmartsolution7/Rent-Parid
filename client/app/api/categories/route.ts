import { NextResponse } from 'next/server';
import { getDb1, getDb2 } from '../../lib/db';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

/**
 * Returns categories with `product_count` (number of active, priced articles
 * in each category). When the global config flag `hide_empty_categories` is
 * on, drops categories whose product_count is 0.
 */
export async function GET() {
  let retries = 2;
  let lastError: any;

  while (retries > 0) {
    try {
      const pool = await getDb2();

      // Pull categories joined with a per-category product count via
      // dependent subquery (cheap because Art has an index on Art_Kls01_Kodi).
      const result = await pool.request().query(`
        SELECT
          k.Kodi,
          k.Pershkrim,
          (SELECT COUNT(*) FROM dbo.Art a WHERE a.Art_Kls01_Kodi = k.Kodi AND a.Aktiv = 1 AND a.Cmimi > 0) AS product_count
        FROM dbo.Art_Kls01 k
        ORDER BY k.Pershkrim
      `);

      let categories: any[] = result.recordset;

      // Cross-DB lookup: which Kodi values have an uploaded image in DB1?
      // Single round-trip; cheap because the table is tiny.
      try {
        const db1 = await getDb1();
        const imgRes = await db1.request().query(
          `SELECT category_kodi FROM dbo.ecommerce_category_images WHERE image_data IS NOT NULL`
        );
        const withImage = new Set<string>(
          imgRes.recordset.map((r: any) => String(r.category_kodi))
        );
        categories = categories.map((c: any) => ({
          ...c,
          has_image: withImage.has(String(c.Kodi)),
        }));
      } catch {
        // ecommerce_category_images table not yet created — assume no images.
        categories = categories.map((c: any) => ({ ...c, has_image: false }));
      }

      // Apply the global hide-empty toggle if set.
      try {
        const db1 = await getDb1();
        const flag = await db1.request().query(
          `SELECT TOP 1 ISNULL(hide_empty_categories, 0) AS h FROM dbo.ecommerce_config ORDER BY id DESC`
        );
        if (flag.recordset[0]?.h) {
          categories = categories.filter((c: any) => Number(c.product_count) > 0);
        }
      } catch {
        // Column missing (pre-migration) — ignore, return all categories.
      }

      return NextResponse.json({ success: true, categories }, { headers: NO_STORE_HEADERS });
    } catch (error: any) {
      lastError = error;
      retries--;

      if (retries > 0 && error.code === 'ECONNCLOSED') {
        console.log('Connection closed, retrying...');
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      console.error('Error fetching categories:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      }, { status: 500, headers: NO_STORE_HEADERS });
    }
  }

  return NextResponse.json({
    success: false,
    message: 'Failed to fetch categories after retries',
    error: lastError?.message
  }, { status: 500, headers: NO_STORE_HEADERS });
}
