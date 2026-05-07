import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../lib/db';
import { getPriceColumnForRequest } from '../../lib/getPriceColumn';
import { getConfigFlags } from '../../lib/getConfigFlags';
import { getHiddenProductIds, buildHiddenIdsExclusion } from '../../lib/getHiddenProductIds';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

export async function GET(request: Request) {
  try {
    const priceCol = await getPriceColumnForRequest(request);
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const category = searchParams.get('category') || '';
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'default';

    const grouped = searchParams.get('grouped') === 'true';
    const perGroup = parseInt(searchParams.get('perGroup') || '4');
    const onlyOffers = searchParams.get('onlyOffers') === 'true';
    const offset = (page - 1) * limit;

    const pool = await getDb2();
    const flags = await getConfigFlags();
    // Per-product hide flag from DB1 (ecommerce_article_settings.hidden_in_ecommerce).
    // Cross-database join isn't possible from DB2 → fetch the IDs separately
    // and inline them as a NOT IN clause. IDs are validated integers.
    const hiddenIds = await getHiddenProductIds();
    const hiddenExclusion = buildHiddenIdsExclusion(hiddenIds, 'a.Id');

    const categoryName = searchParams.get('categoryName') || '';

    // Build WHERE clause — when admin disables show_out_of_stock, hide items
    // whose displayed stock (SasiaMax) is zero or negative.
    let whereClause = 'WHERE a.Aktiv = 1 AND a.Cmimi > 0';
    whereClause += hiddenExclusion;
    if (!flags.show_out_of_stock) {
      whereClause += ' AND ISNULL(a.SasiaMax, 0) > 0';
    }
    if (categoryName) {
      whereClause += ` AND ISNULL(k.Pershkrim, 'General') = @categoryName`;
    } else if (category && category !== 'All') {
      whereClause += ` AND a.Art_Kls01_Kodi = @category`;
    }
    if (search) {
      whereClause += ` AND (a.Pershkrim LIKE @search OR a.Pershkrim1 LIKE @search OR a.Kodi LIKE @search)`;
    }
    if (onlyOffers) {
      // Active offer = flag on, has an offer price, and falls inside the date window.
      whereClause += `
        AND ISNULL(a.Oferte_Aktiv, 0) = 1
        AND a.Cmimi_Oferte IS NOT NULL AND a.Cmimi_Oferte > 0
        AND (a.Oferte_DataFillim IS NULL OR a.Oferte_DataFillim <= GETDATE())
        AND (a.Oferte_DataMbarim IS NULL OR a.Oferte_DataMbarim >= GETDATE())
      `;
    }

    // Grouped mode: return all products grouped by category
    if (grouped && (!category || category === 'All')) {
      const productsRequest = pool.request();
      if (search) productsRequest.input('search', sql.NVarChar, `%${search}%`);

      const result = await productsRequest.query(`
        SELECT
          a.Id as id,
          a.Pershkrim as name,
          ISNULL(a.${priceCol}, a.Cmimi) as price,
          ISNULL(a.Art_Kls01_Kodi, 'General') as category,
          ISNULL(k.Pershkrim, 'General') as categoryName,
          ISNULL(a.Pershkrim1, a.Pershkrim) as description,
          ISNULL(a.Barkod, '📦') as image,
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
        ${whereClause}
        ORDER BY k.Pershkrim, a.Id
      `);

      return NextResponse.json({
        success: true,
        products: result.recordset,
        grouped: true
      }, { headers: NO_STORE_HEADERS });
    }

    // Build ORDER BY clause
    let orderBy = 'ORDER BY k.Pershkrim, a.Id';
    if (sortBy === 'price-asc') orderBy = `ORDER BY ISNULL(a.${priceCol}, a.Cmimi) ASC`;
    else if (sortBy === 'price-desc') orderBy = `ORDER BY ISNULL(a.${priceCol}, a.Cmimi) DESC`;
    else if (sortBy === 'name') orderBy = 'ORDER BY a.Pershkrim ASC';

    // Prepare count query
    const countRequest = pool.request();
    if (categoryName) countRequest.input('categoryName', sql.NVarChar, categoryName);
    else if (category && category !== 'All') countRequest.input('category', sql.VarChar, category);
    if (search) countRequest.input('search', sql.NVarChar, `%${search}%`);

    // Prepare paginated products query
    const productsRequest = pool.request();
    if (categoryName) productsRequest.input('categoryName', sql.NVarChar, categoryName);
    else if (category && category !== 'All') productsRequest.input('category', sql.VarChar, category);
    if (search) productsRequest.input('search', sql.NVarChar, `%${search}%`);
    productsRequest.input('offset', sql.Int, offset);
    productsRequest.input('limit', sql.Int, limit);

    // Run both queries in parallel
    const [countResult, result] = await Promise.all([
      countRequest.query(`
        SELECT COUNT(*) as total
        FROM Art a
        LEFT JOIN Art_Kls01 k ON a.Art_Kls01_Kodi = k.Kodi
        ${whereClause}
      `),
      productsRequest.query(`
        SELECT
          a.Id as id,
          a.Pershkrim as name,
          ISNULL(a.${priceCol}, a.Cmimi) as price,
          ISNULL(a.Art_Kls01_Kodi, 'General') as category,
          ISNULL(k.Pershkrim, 'General') as categoryName,
          ISNULL(a.Pershkrim1, a.Pershkrim) as description,
          ISNULL(a.Barkod, '📦') as image,
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
        ${whereClause}
        ${orderBy}
        OFFSET @offset ROWS
        FETCH NEXT @limit ROWS ONLY
      `),
    ]);

    const total = countResult.recordset[0].total;

    return NextResponse.json({
      success: true,
      products: result.recordset,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }, { headers: NO_STORE_HEADERS });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch products'
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
