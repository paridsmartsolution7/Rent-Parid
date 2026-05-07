import { NextResponse } from 'next/server';
import { getDb2 } from '../../lib/db';

type CityRow = {
  kodi: string | null;
  name: string;
};

export async function GET() {
  try {
    const pool = await getDb2();
    const result = await pool.request().query(`SELECT * FROM Qyteti`);

    // Pick the most descriptive column available for display
    const cities: CityRow[] = [];
    for (const r of result.recordset) {
      const name =
        (r.Pershkrim && String(r.Pershkrim).trim()) ||
        (r.Emri && String(r.Emri).trim()) ||
        (r.Name && String(r.Name).trim()) ||
        (r.Kodi && String(r.Kodi).trim()) ||
        '';
      if (!name) continue;
      const kodi = r.Kodi != null ? String(r.Kodi) : null;
      cities.push({ kodi, name });
    }

    // Sort alphabetically and de-duplicate by name (case-insensitive)
    const seen = new Set<string>();
    const unique = cities
      .sort((a, b) => a.name.localeCompare(b.name, 'sq'))
      .filter(c => {
        const key = c.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return NextResponse.json({ success: true, cities: unique });
  } catch (error: any) {
    console.error('Error fetching cities:', error);
    return NextResponse.json({ success: false, cities: [] });
  }
}
