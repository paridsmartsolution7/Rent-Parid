import sql from 'mssql';
import { getDb1, getDb2 } from './db';

async function reserveNextKlientKodi(db2: sql.ConnectionPool): Promise<string> {
  const maxResult = await db2.request().query(`
    SELECT TOP 1 Kodi
    FROM Klient
    WHERE Kodi LIKE 'L%'
      AND LEN(Kodi) > 1
      AND TRY_CAST(SUBSTRING(Kodi, 2, LEN(Kodi)-1) AS INT) IS NOT NULL
    ORDER BY TRY_CAST(SUBSTRING(Kodi, 2, LEN(Kodi)-1) AS INT) DESC
  `);
  const maxKodi = maxResult.recordset[0]?.Kodi || 'L102129';
  const parsedNum = parseInt(maxKodi.substring(1), 10);
  const nextNum = Number.isFinite(parsedNum) ? parsedNum + 1 : 102130;
  return `L${nextNum}`;
}

/**
 * Returns the canonical Qyteti value from DB2 (matching case-insensitively)
 * or null if the given name isn't in the master Qyteti table.
 * This keeps DB2 Klient.Qyteti populated only with known master-data values;
 * any custom city the user typed still lives in DB1 ecommerce_users.city.
 */
async function resolveCanonicalQyteti(
  db2: sql.ConnectionPool,
  city?: string | null,
): Promise<string | null> {
  const trimmed = (city || '').trim();
  if (!trimmed) return null;
  try {
    const res = await db2.request()
      .input('name', sql.NVarChar(100), trimmed)
      .query(`
        SELECT TOP 1 Pershkrim, Kodi
        FROM Qyteti
        WHERE LOWER(LTRIM(RTRIM(Pershkrim))) = LOWER(LTRIM(RTRIM(@name)))
           OR LOWER(LTRIM(RTRIM(Kodi))) = LOWER(LTRIM(RTRIM(@name)))
      `);
    const row = res.recordset[0];
    if (!row) return null;
    const canonical = (row.Pershkrim && String(row.Pershkrim).trim()) ||
                      (row.Kodi && String(row.Kodi).trim()) || null;
    return canonical;
  } catch {
    return null;
  }
}

let cachedKlientColumns: Set<string> | null = null;

async function getKlientColumns(db2: sql.ConnectionPool): Promise<Set<string>> {
  if (cachedKlientColumns) return cachedKlientColumns;
  const res = await db2.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Klient'
  `);
  cachedKlientColumns = new Set(res.recordset.map((r: any) => String(r.COLUMN_NAME)));
  return cachedKlientColumns;
}

/**
 * Creates a Klient row in DB2 and returns the generated Kodi.
 * Only inserts columns that actually exist in the Klient table schema.
 * Throws on any failure — callers must not create a DB1 user if this throws.
 */
export async function createKlientInDb2(
  fullName: string,
  email: string,
  phone?: string | null,
  address?: string | null,
  city?: string | null,
  postalCode?: string | null,
): Promise<string> {
  const db2 = await getDb2();
  const cols = await getKlientColumns(db2);

  const nextKodi = await reserveNextKlientKodi(db2);

  // Resolve the city to a value from the DB2 Qyteti master table.
  // Custom (user-typed) names that don't match stay in DB1 only — DB2 Klient gets no city.
  const canonicalQyteti = await resolveCanonicalQyteti(db2, city);

  // Mandatory fields (always present on any Klient table we've seen)
  const fields: { col: string; type: any; value: any }[] = [
    { col: 'Kodi', type: sql.VarChar(25), value: nextKodi },
    { col: 'Pershkrim', type: sql.NVarChar(100), value: (fullName || '').substring(0, 100) },
    { col: 'Email', type: sql.NVarChar(100), value: (email || '').substring(0, 100) },
    { col: 'Tel', type: sql.NVarChar(50), value: (phone || '').substring(0, 50) },
    { col: 'Adresa', type: sql.NVarChar(100), value: (address || '').substring(0, 100) },
    { col: 'Aktiv', type: sql.Bit, value: 1 },
  ];

  // Optional fields — tolerate multiple naming conventions, include only if present
  const optional: { col: string; type: any; value: any }[] = [];
  const tryAdd = (candidates: string[], type: any, value: any) => {
    const match = candidates.find(c => cols.has(c));
    if (match) optional.push({ col: match, type, value });
  };
  // Only include Qyteti on DB2 if it matches a row in the Qyteti master table
  if (canonicalQyteti) {
    tryAdd(['Qyteti', 'City'], sql.NVarChar(100), canonicalQyteti.substring(0, 100));
  }
  tryAdd(['Kodi_Postar', 'Kodi_Postal', 'KodiPostar', 'KodiPostal', 'PostalCode', 'ZipCode', 'Zip'],
    sql.NVarChar(20), (postalCode || '').substring(0, 20));
  tryAdd(['Tip_Cmimi', 'TipCmimi'], sql.NVarChar(15), 'CMIMI');

  const allFields = [...fields, ...optional];

  const colList = allFields.map(f => f.col).join(', ');
  const valList = allFields.map(f => `@${f.col}`).join(', ');
  const extraCols: string[] = [];
  const extraVals: string[] = [];
  if (cols.has('Data_Regjistrimit')) {
    extraCols.push('Data_Regjistrimit');
    extraVals.push('GETDATE()');
  }

  const finalColList = extraCols.length ? `${colList}, ${extraCols.join(', ')}` : colList;
  const finalValList = extraVals.length ? `${valList}, ${extraVals.join(', ')}` : valList;

  const req = db2.request();
  for (const f of allFields) req.input(f.col, f.type, f.value);

  await req.query(`INSERT INTO Klient (${finalColList}) VALUES (${finalValList})`);

  return nextKodi;
}

/**
 * Ensures dbo.ecommerce_users has the klient_kodi column.
 */
export async function ensureKlientKodiColumn() {
  const db1 = await getDb1();
  await db1.request().query(`
    IF COL_LENGTH('dbo.ecommerce_users', 'klient_kodi') IS NULL
    BEGIN
      ALTER TABLE dbo.ecommerce_users ADD klient_kodi NVARCHAR(25) NULL;
    END
  `);
}
