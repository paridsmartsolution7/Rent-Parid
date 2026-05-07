import { getDb1, getDb2 } from './db';
import { getAuthUser } from './getAuthUser';

// Whitelist of valid price-tier column names on the Art table
const VALID_COLUMNS = new Set<string>([
  'Cmimi',
  'Cmimi_1', 'Cmimi_2', 'Cmimi_3', 'Cmimi_4', 'Cmimi_5',
  'Cmimi_6', 'Cmimi_7', 'Cmimi_8', 'Cmimi_9', 'Cmimi_10',
]);

/**
 * Normalizes a Tip_Cmimi value (e.g. "CMIMI_3" or "cmimi_3" → "Cmimi_3")
 * and returns the canonical column name. Falls back to 'Cmimi' for unknown values.
 */
function normalizeTipCmimi(raw: string | null | undefined): string {
  if (!raw) return 'Cmimi';
  const trimmed = String(raw).trim();
  if (!trimmed) return 'Cmimi';

  // Build case-insensitive lookup against the whitelist
  const upper = trimmed.toUpperCase();
  for (const col of VALID_COLUMNS) {
    if (col.toUpperCase() === upper) return col;
  }
  return 'Cmimi';
}

/**
 * Resolves which Art column to read prices from for the caller:
 * - Authenticated user → look up their Klient's Tip_Cmimi in DB2
 * - Anonymous caller or any error → 'Cmimi'
 *
 * Always returns a value from the whitelist — safe to interpolate into SQL.
 */
export async function getPriceColumnForRequest(request: Request): Promise<string> {
  try {
    const user = await getAuthUser(request);
    if (!user) return 'Cmimi';

    const db1 = await getDb1();
    const r1 = await db1.request()
      .input('id', user.userId)
      .query('SELECT klient_kodi FROM dbo.ecommerce_users WHERE id = @id');
    const klientKodi: string | null = r1.recordset[0]?.klient_kodi || null;
    if (!klientKodi) return 'Cmimi';

    const db2 = await getDb2();
    const r2 = await db2.request()
      .input('kodi', klientKodi)
      .query('SELECT Tip_Cmimi FROM Klient WHERE Kodi = @kodi');
    const tipCmimi: string | null = r2.recordset[0]?.Tip_Cmimi || null;

    return normalizeTipCmimi(tipCmimi);
  } catch {
    return 'Cmimi';
  }
}
