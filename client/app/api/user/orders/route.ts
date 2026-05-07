import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb2 } from '../../../lib/db';
import { getAuthUser } from '../../../lib/getAuthUser';

export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });
    }

    const db2 = await getDb2();

    // Fetch orders for this user
    const ordersResult = await db2.request()
      .input('userId', sql.VarChar(25), String(user.userId))
      .query(`
        SELECT
          Id as id,
          Kodi as kodi,
          Data as data,
          Vlera as total,
          Mon as currency,
          Status_Kodi as status,
          Confirmed as confirmed,
          BillingInfo as billingInfo,
          ShippingInfo as shippingInfo,
          Inserted as createdAt
        FROM PorosiKlient
        WHERE KLFU_Kodi = @userId AND Aktiv = 1
        ORDER BY Data DESC
      `);

    const orders = ordersResult.recordset;

    // Fetch order details for all orders
    if (orders.length > 0) {
      const orderIds = orders.map((o: any) => o.id);
      const placeholders = orderIds.map((_: any, i: number) => `@oid${i}`).join(',');
      const detailsReq = db2.request();
      orderIds.forEach((id: number, i: number) => detailsReq.input(`oid${i}`, sql.Int, id));

      const detailsResult = await detailsReq.query(`
        SELECT
          Master_Id as orderId,
          Art_ID as productId,
          Pershkrim as name,
          Sasia as qty,
          Cmimi as price,
          Vlera as lineTotal,
          Tvsh as vat
        FROM PorosiKlientDTL
        WHERE Master_Id IN (${placeholders}) AND Aktiv = 1
        ORDER BY Master_Id, Id
      `);

      // Group details by order
      const detailsByOrder = new Map<number, any[]>();
      for (const d of detailsResult.recordset) {
        if (!detailsByOrder.has(d.orderId)) detailsByOrder.set(d.orderId, []);
        detailsByOrder.get(d.orderId)!.push(d);
      }

      for (const order of orders) {
        order.items = detailsByOrder.get(order.id) || [];
      }
    }

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    console.error('Error fetching user orders:', error);
    return NextResponse.json({ success: false, message: 'Deshtoi marrja e porosive' }, { status: 500 });
  }
}
