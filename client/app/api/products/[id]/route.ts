import { NextResponse } from 'next/server';
import { getDb2, getDb1 } from '../../../lib/db';
import { getPriceColumnForRequest } from '../../../lib/getPriceColumn';
import { getHiddenProductIds } from '../../../lib/getHiddenProductIds';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const priceCol = await getPriceColumnForRequest(request);
    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid product ID'
      }, { status: 400 });
    }

    // Block direct URL access to admin-hidden products too — keeping list and
    // detail in sync so a hidden product is fully unreachable from the shop.
    const hiddenIds = await getHiddenProductIds();
    if (hiddenIds.has(productId)) {
      return NextResponse.json({
        success: false,
        message: 'Product not found'
      }, { status: 404 });
    }

    const pool = await getDb2();
    
    // Get product details
    const result = await pool.request()
      .input('id', productId)
      .query(`
        SELECT
          a.Id as id,
          a.Kodi as code,
          a.Pershkrim as name,
          ISNULL(a.${priceCol}, a.Cmimi) as price,
          ISNULL(a.Art_Kls01_Kodi, 'General') as category,
          ISNULL(k.Pershkrim, 'General') as categoryName,
          a.Pershkrim1 as description,
          a.Shenime as longDescription,
          ISNULL(a.Barkod, '📦') as image,
          ISNULL((SELECT TOP 1 CASE WHEN al.Imazh1 IS NOT NULL THEN (CASE WHEN al.Imazh1 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh2 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh3 IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN al.Imazh4 IS NOT NULL THEN 1 ELSE 0 END) ELSE (CASE WHEN al.Imazh IS NOT NULL THEN 1 ELSE 0 END) END FROM Art_Left al WHERE al.Art_Id = a.Id), 0) as imageCount,
          ISNULL((SELECT TOP 1 CAST(v.Gjendje_Sasia AS int) FROM V_Art_HyrjeDalje_Grup v WHERE v.KODI = a.Kodi), 0) as stock,
          a.Njesi_Kodi as unit,
          a.Magazina_Kodi as magazina,
          a.Aktiv as active,
          ISNULL(a.Oferte_Aktiv, 0) as ofpiActive,
          a.Cmimi_Oferte as offerPrice,
          a.Oferte_DataFillim as offerStart,
          a.Oferte_DataMbarim as offerEnd,
          a.Skonto_Perqindje as discountPercent,
          CASE WHEN a.Id > (SELECT MAX(Id) - 30 FROM Art) THEN 1 ELSE 0 END AS isNew,
          CASE WHEN a.Id <= (SELECT MAX(Id) - 30 FROM Art) AND a.Id > (SELECT MAX(Id) - 200 FROM Art) THEN 1 ELSE 0 END AS isBestseller
        FROM Art a
        LEFT JOIN Art_Kls01 k ON a.Art_Kls01_Kodi = k.Kodi
        WHERE a.Id = @id
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Product not found'
      }, { status: 404 });
    }

    const product = result.recordset[0];

    // Get reviews from DB1
    try {
      const db1Pool = await getDb1();
      const reviewsResult = await db1Pool.request()
        .input('productId', productId)
        .query(`
          SELECT 
            r.id,
            r.rating,
            r.review_text,
            r.created_at,
            u.full_name as user_name
          FROM dbo.ecommerce_reviews r
          JOIN dbo.ecommerce_users u ON r.user_id = u.id
          WHERE r.product_id = @productId
          ORDER BY r.created_at DESC
        `);

      const reviews = reviewsResult.recordset;
      const avgRating = reviews.length > 0 
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
        : 4.0;

      return NextResponse.json({
        success: true,
        product: {
          ...product,
          rating: avgRating,
          reviewCount: reviews.length
        },
        reviews
      });
    } catch (reviewError) {
      // If reviews table doesn't exist yet, return product without reviews
      return NextResponse.json({
        success: true,
        product: {
          ...product,
          rating: 4.0,
          reviewCount: 0
        },
        reviews: []
      });
    }
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch product'
    }, { status: 500 });
  }
}
