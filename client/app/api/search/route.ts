import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../lib/db';
import { getPriceColumnForRequest } from '../../lib/getPriceColumn';
import { getHiddenProductIds, buildHiddenIdsExclusion } from '../../lib/getHiddenProductIds';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const priceCol = await getPriceColumnForRequest(request);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';

    if (q.length < 2) {
      return NextResponse.json({ success: true, products: [] });
    }

    const pool = await getDb2();
    const hiddenExclusion = buildHiddenIdsExclusion(await getHiddenProductIds(), 'a.Id');
    const req = pool.request();
    req.input('search', sql.NVarChar, `%${q}%`);

    const result = await req.query(`
      SELECT TOP 20
        a.Id as id,
        a.Pershkrim as name,
        ISNULL(a.${priceCol}, a.Cmimi) as price,
        ISNULL(a.Art_Kls01_Kodi, 'General') as category,
        ISNULL(k.Pershkrim, 'General') as categoryName,
        ISNULL(a.Pershkrim1, a.Pershkrim) as description,
        ISNULL(a.Barkod, '') as image,
        ISNULL((SELECT TOP 1 CASE WHEN al.Imazh1 IS NOT NULL THEN (CASE WHEN al.Imazh1 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh2 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh3 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh4 IS NOT NULL THEN 1 ELSE 0 END) ELSE (CASE WHEN al.Imazh IS NOT NULL THEN 1 ELSE 0 END) END FROM Art_Left al WHERE al.Art_Id = a.Id), 0) as imageCount,
        4.0 as rating,
        CAST(ISNULL(a.SasiaMax, 0) as int) as stock,
        a.Njesi_Kodi as unit,
        ISNULL(a.Oferte_Aktiv, 0) as ofpiActive,
        a.Cmimi_Oferte as offerPrice,
        a.Oferte_DataFillim as offerStart,
        a.Oferte_DataMbarim as offerEnd,
        a.Skonto_Perqindje as discountPercent,
        CASE WHEN a.Id > (SELECT MAX(Id) - 30 FROM Art) THEN 1 ELSE 0 END AS isNew,
        CASE WHEN a.Id <= (SELECT MAX(Id) - 30 FROM Art) AND a.Id > (SELECT MAX(Id) - 200 FROM Art) THEN 1 ELSE 0 END AS isBestseller
      FROM Art a
      LEFT JOIN Art_Kls01 k ON a.Art_Kls01_Kodi = k.Kodi
      WHERE a.Aktiv = 1 AND a.Cmimi > 0${hiddenExclusion}
        AND (a.Pershkrim LIKE @search OR a.Pershkrim1 LIKE @search OR a.Kodi LIKE @search)
      ORDER BY a.Pershkrim
    `);

    return NextResponse.json({ success: true, products: result.recordset });
  } catch (error: any) {
    console.error('Search error:', error);
    return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 });
  }
}
