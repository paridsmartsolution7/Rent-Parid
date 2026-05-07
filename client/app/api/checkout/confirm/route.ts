import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getDb1, getDb2 } from '../../../lib/db';
import { sendOrderFinalizedEmail, sendAdminOrderNotification } from '../../../lib/email';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

type CartLine = { product_id: number; qty: number; itemType?: 'AR' | 'SH' };
type OrderToken = {
  kind: 'order-confirm';
  userId: number;
  items: CartLine[];
  billingInfo: string | null;
  shippingInfo: string | null;
  paymentMethod: 'cash' | 'card';
};

function redirectTo(appUrl: string, path: string) {
  return NextResponse.redirect(`${appUrl}${path}`);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.APP_URL || 'https://www.goodiesfarm.al';
  const token = url.searchParams.get('token');

  if (!token) {
    return redirectTo(appUrl, '/order-confirmed?status=error&reason=missing-token');
  }

  let payload: OrderToken;
  try {
    payload = jwt.verify(token, JWT_SECRET) as OrderToken;
  } catch {
    return redirectTo(appUrl, '/order-confirmed?status=error&reason=expired-or-invalid');
  }

  if (payload.kind !== 'order-confirm' || !Array.isArray(payload.items) || payload.items.length === 0) {
    return redirectTo(appUrl, '/order-confirmed?status=error&reason=bad-token');
  }

  try {
    const db1 = await getDb1();
    const userResult = await db1.request()
      .input('userId', sql.Int, payload.userId)
      .query('SELECT id, email, full_name, phone, address, city, postal_code FROM dbo.ecommerce_users WHERE id = @userId');

    if (userResult.recordset.length === 0) {
      return redirectTo(appUrl, '/order-confirmed?status=error&reason=user-not-found');
    }
    const user = userResult.recordset[0];

    const db2 = await getDb2();
    const productMap = new Map<number, any>();

    // Load articles (AR items)
    const artItems = payload.items.filter(l => (l.itemType || 'AR') === 'AR');
    if (artItems.length > 0) {
      const artCsv = artItems.map((_, i) => `@a${i}`).join(',');
      const artReq = db2.request();
      artItems.forEach((l, i) => artReq.input(`a${i}`, sql.Int, l.product_id));
      const artResult = await artReq.query(`
        SELECT Id, Kodi, Pershkrim, Barkod, Cmimi, ISNULL(Tvsh, 20) as Tvsh,
               Njesi_Kodi, Art_Kls01_Kodi, Magazina_Kodi
        FROM Art WHERE Id IN (${artCsv}) AND Aktiv = 1 AND Cmimi > 0
      `);
      for (const p of artResult.recordset) productMap.set(p.Id, p);
    }

    // Load services (SH items)
    const shItems = payload.items.filter(l => l.itemType === 'SH');
    if (shItems.length > 0) {
      const shCsv = shItems.map((_, i) => `@s${i}`).join(',');
      const shReq = db2.request();
      shItems.forEach((l, i) => shReq.input(`s${i}`, sql.Int, l.product_id));
      const shResult = await shReq.query(`
        SELECT Id, Kodi, RTRIM(Pershkrim) as Pershkrim, '' as Barkod, ISNULL(Cmimi, 0) as Cmimi, ISNULL(Tvsh, 20) as Tvsh,
               Njesi_Kodi, Art_Kls01_Kodi, 'M01' as Magazina_Kodi
        FROM Sherbim WHERE Id IN (${shCsv}) AND Aktiv = 1
      `);
      for (const p of shResult.recordset) productMap.set(p.Id, p);
    }

    for (const line of payload.items) {
      if (!productMap.has(line.product_id)) {
        return redirectTo(appUrl, '/order-confirmed?status=error&reason=product-unavailable');
      }
    }

    const firstArt = productMap.values().next().value;
    const magazinaKodi = firstArt?.Magazina_Kodi || 'M01';

    // Resolve the user's city against DB2 Qyteti. Matched → Qyteti_Kodi.
    // Not matched (custom typed value) → write the name into Shenim instead.
    let qytetiKodi: string | null = null;
    let shenim: string | null = null;
    const cityTrimmed = (user.city || '').trim();
    if (cityTrimmed) {
      try {
        const qytetiRes = await db2.request()
          .input('name', sql.NVarChar(100), cityTrimmed)
          .query(`
            SELECT TOP 1 Kodi
            FROM Qyteti
            WHERE LOWER(LTRIM(RTRIM(Pershkrim))) = LOWER(LTRIM(RTRIM(@name)))
               OR LOWER(LTRIM(RTRIM(Kodi))) = LOWER(LTRIM(RTRIM(@name)))
          `);
        const row = qytetiRes.recordset[0];
        if (row && row.Kodi) {
          qytetiKodi = String(row.Kodi).trim();
        } else {
          shenim = `Qyteti: ${cityTrimmed}`;
        }
      } catch (e) {
        console.error('Qyteti lookup failed:', e);
        shenim = `Qyteti: ${cityTrimmed}`;
      }
    }

    type DetailRow = {
      art: any;
      sasia: number;
      cmimi: number;
      tvsh: number;
      cmimiPaTvsh: number;
      vleraPaTvsh: number;
      tvshVlera: number;
      vlera: number;
      itemType: 'AR' | 'SH';
    };

    const details: DetailRow[] = payload.items.map((line) => {
      const art = productMap.get(line.product_id);
      const sasia = line.qty;
      const cmimi = Number(art.Cmimi);
      const tvsh = Number(art.Tvsh || 20);
      const cmimiPaTvsh = cmimi / (1 + tvsh / 100);
      const vleraPaTvsh = cmimiPaTvsh * sasia;
      const tvshVlera = vleraPaTvsh * (tvsh / 100);
      const vlera = vleraPaTvsh + tvshVlera;
      return { art, sasia, cmimi, tvsh, cmimiPaTvsh, vleraPaTvsh, tvshVlera, vlera, itemType: line.itemType || 'AR' };
    });
    const totalVlera = details.reduce((s, d) => s + d.vlera, 0);

    const menyraPageses = payload.paymentMethod === 'card' ? 2 : 1;

    const transaction = new sql.Transaction(db2);
    await transaction.begin();
    try {
      const kodiRes = await new sql.Request(transaction).query(
        'SELECT ISNULL(MAX(Kodi), 0) + 1 as nextKodi FROM PorosiKlient'
      );
      const nextKodi: number = kodiRes.recordset[0].nextKodi;
      const operatorName = (user.full_name || user.email || 'web').toString().substring(0, 50);

      const masterReq = new sql.Request(transaction);
      masterReq.input('Kodi', sql.Int, nextKodi);
      masterReq.input('KLFU_Kodi', sql.VarChar(25), user.klient_kodi || String(user.id));
      masterReq.input('KLFU_Pershkrim', sql.NVarChar(100), (user.full_name || user.email || '').substring(0, 100));
      masterReq.input('Vlera', sql.Float, totalVlera);
      masterReq.input('Mon', sql.VarChar(5), 'ALL');
      masterReq.input('Kursi', sql.Float, 1);
      masterReq.input('Skonto', sql.Float, 0);
      masterReq.input('TipCmimi', sql.NVarChar(15), 'CMIMI');
      masterReq.input('Operator', sql.NVarChar(50), operatorName);
      masterReq.input('BillingInfo', sql.NVarChar(500),
        (payload.billingInfo || `${user.full_name || ''} | ${user.email || ''} | ${user.phone || ''}`).substring(0, 500));
      masterReq.input('ShippingInfo', sql.NVarChar(550),
        (payload.shippingInfo || `${user.address || ''}, ${user.city || ''} ${user.postal_code || ''}`).substring(0, 550));
      masterReq.input('StatusKodi', sql.VarChar(20), 'CONFIRMED');
      masterReq.input('MagazinaKodi', sql.VarChar(10), magazinaKodi);
      masterReq.input('MenyraPageses', sql.Int, menyraPageses);
      masterReq.input('QytetiKodi', sql.VarChar(10), qytetiKodi);
      masterReq.input('Shenim', sql.NVarChar(500), shenim);

      const masterResult = await masterReq.query(`
        INSERT INTO PorosiKlient
          (Kodi, Data, KLFU_Kodi, KLFU_Pershkrim, Vlera, Mon, Kursi, Skonto,
           Tip_Cmimi, Operator, OperatorInsert, Updated, Inserted, Aktiv,
           NdertuarNgaWeb, BillingInfo, ShippingInfo, Status_Kodi, Confirmed,
           Magazina_Kodi, Data_Deklarimit, Menyra_Pageses_ID, Afati_PagesesData,
           Qyteti_Kodi, Shenim)
        OUTPUT INSERTED.Id
        VALUES
          (@Kodi, CAST(CAST(GETDATE() AS DATE) AS DATETIME), @KLFU_Kodi, @KLFU_Pershkrim, @Vlera, @Mon, @Kursi, @Skonto,
           @TipCmimi, @Operator, @Operator, GETDATE(), GETDATE(), 1,
           1, @BillingInfo, @ShippingInfo, @StatusKodi, 1,
           @MagazinaKodi, CAST(CAST(GETDATE() AS DATE) AS DATETIME), @MenyraPageses, CAST(CAST(GETDATE() AS DATE) AS DATETIME),
           @QytetiKodi, @Shenim)
      `);
      const masterId: number = masterResult.recordset[0].Id;

      for (const d of details) {
        const lineReq = new sql.Request(transaction);
        lineReq.input('MasterId', sql.Int, masterId);
        lineReq.input('ArtId', sql.Int, d.art.Id);
        lineReq.input('Kodi', sql.VarChar(25), d.art.Kodi || '');
        lineReq.input('BarKod', sql.NVarChar(50), d.art.Barkod || '');
        lineReq.input('Pershkrim', sql.NVarChar(100), (d.art.Pershkrim || '').substring(0, 100));
        lineReq.input('ArtKls01Kodi', sql.VarChar(5), d.art.Art_Kls01_Kodi || null);
        lineReq.input('Sasia', sql.Float, d.sasia);
        lineReq.input('Cmimi', sql.Float, d.cmimi);
        lineReq.input('Tvsh', sql.Float, d.tvsh);
        lineReq.input('TvshVlera', sql.Float, d.tvshVlera);
        lineReq.input('CmimiPaTvsh', sql.Float, d.cmimiPaTvsh);
        lineReq.input('VleraPaTvsh', sql.Float, d.vleraPaTvsh);
        lineReq.input('Vlera', sql.Float, d.vlera);
        lineReq.input('Total', sql.Float, d.vlera);
        lineReq.input('NjesiKodi', sql.VarChar(5), d.art.Njesi_Kodi || '');
        lineReq.input('Koeficient', sql.Float, 1);
        lineReq.input('Tipi', sql.NVarChar(2), d.itemType);
        lineReq.input('Operator', sql.NVarChar(50), operatorName);

        await lineReq.query(`
          INSERT INTO PorosiKlientDTL
            (Master_Id, Art_ID, Kodi, BarKod, Pershkrim, Art_Kls01_Kodi,
             Sasia, Cmimi, Tvsh, Tvsh_Vlera, Cmimi_Pa_Tvsh, Vlera_Pa_Tvsh,
             Vlera, Total, Njesi_Kodi, Koeficient, Tipi, Skonto, Skonto_Vlera,
             Operator, OperatorInsert, Inserted, Updated, Aktiv)
          VALUES
            (@MasterId, @ArtId, @Kodi, @BarKod, @Pershkrim, @ArtKls01Kodi,
             @Sasia, @Cmimi, @Tvsh, @TvshVlera, @CmimiPaTvsh, @VleraPaTvsh,
             @Vlera, @Total, @NjesiKodi, @Koeficient, @Tipi, 0, 0,
             @Operator, @Operator, GETDATE(), GETDATE(), 1)
        `);
      }

      await transaction.commit();

      const currency = process.env.CURRENCY_SYMBOL || 'L';
      const orderLines = details.map(d => ({
        name: d.art.Pershkrim || d.art.Kodi || 'Artikull',
        qty: d.sasia,
        price: d.cmimi,
      }));

      // Fire-and-forget thank-you email to customer
      sendOrderFinalizedEmail({
        to: user.email,
        customerName: user.full_name || '',
        orderKodi: nextKodi,
        total: totalVlera,
        currency,
        lines: orderLines,
      }).catch(err => console.error('Failed to send finalized email:', err));

      // Send order details to admin users (non-blocking)
      (async () => {
        try {
          const adminResult = await db2.request().query(
            "SELECT Email FROM Users WHERE Users_Grup_Id = 1 AND Aktiv = 1 AND Email IS NOT NULL AND Email != ''"
          );
          const adminEmails = adminResult.recordset
            .map((r: any) => r.Email)
            .filter((e: string) => e && e.includes('@'));

          if (adminEmails.length > 0) {
            await sendAdminOrderNotification({
              to: adminEmails,
              customerName: user.full_name || '',
              customerEmail: user.email,
              orderKodi: nextKodi,
              total: totalVlera,
              lineCount: details.length,
              currency,
              lines: orderLines,
            });
          }
        } catch (adminErr) {
          console.error('Admin notification error:', adminErr);
        }
      })();

      return redirectTo(appUrl, `/order-confirmed?status=ok&kodi=${nextKodi}&total=${totalVlera.toFixed(2)}`);
    } catch (err: any) {
      await transaction.rollback();
      console.error('Error inserting confirmed order:', err);
      return redirectTo(appUrl, '/order-confirmed?status=error&reason=db');
    }
  } catch (error: any) {
    console.error('Confirm route error:', error);
    return redirectTo(appUrl, '/order-confirmed?status=error&reason=server');
  }
}
