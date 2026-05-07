import { getDb1 } from './db';

export type ConfigFlags = {
  show_out_of_stock: boolean;
  comments_enabled: boolean;
  reviews_enabled: boolean;
  services_enabled: boolean;
  show_stock_count: boolean;
  allow_out_of_stock_orders: boolean;
};

const DEFAULTS: ConfigFlags = {
  show_out_of_stock: true,
  comments_enabled: true,
  reviews_enabled: true,
  services_enabled: true,
  show_stock_count: true,
  allow_out_of_stock_orders: true,
};

// Tiny in-process cache so high-frequency reads (every product list request)
// don't hit MSSQL every time. 10s is short enough for admin toggle changes
// to feel "real-time" without hammering the DB.
let cached: { value: ConfigFlags; at: number } | null = null;
const TTL_MS = 10_000;

export async function getConfigFlags(): Promise<ConfigFlags> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    const pool = await getDb1();
    const r = await pool.request().query(`
      SELECT TOP 1
        ISNULL(show_out_of_stock, 1)         AS show_out_of_stock,
        ISNULL(comments_enabled, 1)          AS comments_enabled,
        ISNULL(reviews_enabled, 1)           AS reviews_enabled,
        ISNULL(services_enabled, 1)          AS services_enabled,
        ISNULL(show_stock_count, 1)          AS show_stock_count,
        ISNULL(allow_out_of_stock_orders, 1) AS allow_out_of_stock_orders
      FROM dbo.ecommerce_config
      ORDER BY id DESC
    `);
    const row = r.recordset[0];
    const value: ConfigFlags = row
      ? {
          show_out_of_stock: !!row.show_out_of_stock,
          comments_enabled: !!row.comments_enabled,
          reviews_enabled: !!row.reviews_enabled,
          services_enabled: !!row.services_enabled,
          show_stock_count: !!row.show_stock_count,
          allow_out_of_stock_orders: !!row.allow_out_of_stock_orders,
        }
      : DEFAULTS;
    cached = { value, at: Date.now() };
    return value;
  } catch {
    // Column missing (pre-migration) or DB unreachable — fall back to defaults.
    return DEFAULTS;
  }
}

export function invalidateConfigFlags() {
  cached = null;
}

export async function getArticleBlocks(productId: number): Promise<{
  comments_blocked: boolean;
  reviews_blocked: boolean;
  delivery_blocked: boolean;
}> {
  try {
    const pool = await getDb1();
    const r = await pool
      .request()
      .input('pid', productId)
      .query(`
        SELECT comments_blocked, reviews_blocked,
               ISNULL(delivery_blocked, 0) AS delivery_blocked
        FROM dbo.ecommerce_article_settings
        WHERE product_id = @pid
      `);
    const row = r.recordset[0];
    return {
      comments_blocked: !!row?.comments_blocked,
      reviews_blocked: !!row?.reviews_blocked,
      delivery_blocked: !!row?.delivery_blocked,
    };
  } catch {
    return { comments_blocked: false, reviews_blocked: false, delivery_blocked: false };
  }
}
