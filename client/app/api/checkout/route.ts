import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import { getDb1, getDb2 } from '../../lib/db';
import { sendOrderConfirmationEmail } from '../../lib/email';
import { getConfigFlags } from '../../lib/getConfigFlags';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

type CartLine = { product_id: number; qty: number; itemType?: 'AR' | 'SH' };

function getUserIdFromRequest(request: Request): number | null {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.headers.get('cookie')?.split('auth_token=')[1]?.split(';')[0];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json() as {
      items: CartLine[];
      billingInfo?: string;
      shippingInfo?: string;
      paymentMethod?: 'cash' | 'card';
    };

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ success: false, message: 'Cart is empty' }, { status: 400 });
    }

    const lines: CartLine[] = [];
    for (const raw of body.items) {
      const pid = Number(raw.product_id);
      const qty = Number(raw.qty);
      if (!Number.isInteger(pid) || pid <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid product_id' }, { status: 400 });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid quantity' }, { status: 400 });
      }
      lines.push({ product_id: pid, qty, itemType: raw.itemType === 'SH' ? 'SH' : 'AR' });
    }

    // Block ordering of out-of-stock items when admin disabled it.
    const flags = await getConfigFlags();
    if (!flags.allow_out_of_stock_orders) {
      const productLines = lines.filter((l) => l.itemType === 'AR');
      if (productLines.length > 0) {
        const db2 = await getDb2();
        const ids = productLines.map((l) => l.product_id);
        const placeholders = ids.map((_, i) => `@pid${i}`).join(',');
        const stockReq = db2.request();
        ids.forEach((id, i) => stockReq.input(`pid${i}`, sql.Int, id));
        const stockRes = await stockReq.query(
          `SELECT Id AS id, ISNULL(SasiaMax, 0) AS stock FROM dbo.Art WHERE Id IN (${placeholders})`
        );
        const stockMap = new Map<number, number>(
          stockRes.recordset.map((r: any) => [Number(r.id), Number(r.stock)])
        );
        const oos = productLines.filter((l) => (stockMap.get(l.product_id) ?? 0) <= 0);
        if (oos.length > 0) {
          const msg =
            (await getDb1())
              .request()
              .query(
                "SELECT TOP 1 ISNULL(out_of_stock_message, 'Ky produkt nuk ka gjendje per momentin') AS m FROM dbo.ecommerce_config ORDER BY id DESC"
              );
          const m = (await msg).recordset[0]?.m || 'Ky produkt nuk ka gjendje per momentin';
          return NextResponse.json(
            {
              success: false,
              blocked: true,
              message: m,
              out_of_stock_ids: oos.map((l) => l.product_id),
            },
            { status: 409 }
          );
        }
      }
    }

    // Load user (need email for sending the confirmation)
    const db1 = await getDb1();
    const userResult = await db1.request()
      .input('userId', sql.Int, userId)
      .query('SELECT id, email, full_name, phone, address, city, postal_code FROM dbo.ecommerce_users WHERE id = @userId');
    if (userResult.recordset.length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }
    const user = userResult.recordset[0];
    if (!user.email) {
      return NextResponse.json({ success: false, message: 'No email on file' }, { status: 400 });
    }

    // Require the user to have shipping info before allowing checkout
    const trim = (v: any) => (v == null ? '' : String(v).trim());
    const missing = {
      phone: !trim(user.phone),
      address: !trim(user.address),
      city: !trim(user.city),
      postal_code: !trim(user.postal_code),
    };
    if (missing.phone || missing.address || missing.city || missing.postal_code) {
      return NextResponse.json({
        success: false,
        reason: 'incomplete-profile',
        message: 'Plotesoni te dhenat e profilit per te vazhduar',
        missing,
        currentUser: {
          phone: trim(user.phone),
          address: trim(user.address),
          city: trim(user.city),
          postal_code: trim(user.postal_code),
        },
      }, { status: 400 });
    }

    // Validate products exist + compute a preview total (final total recomputed at confirm time)
    const db2 = await getDb2();
    const idsCsv = lines.map((_, i) => `@p${i}`).join(',');
    const productRequest = db2.request();
    lines.forEach((l, i) => productRequest.input(`p${i}`, sql.Int, l.product_id));
    const productResult = await productRequest.query(`
      SELECT Id, Cmimi, ISNULL(Tvsh, 20) as Tvsh
      FROM Art
      WHERE Id IN (${idsCsv}) AND Aktiv = 1 AND Cmimi > 0
    `);
    const productMap = new Map<number, any>();
    for (const p of productResult.recordset) productMap.set(p.Id, p);
    for (const line of lines) {
      if (!productMap.has(line.product_id)) {
        return NextResponse.json({
          success: false,
          message: `Product ${line.product_id} not found or inactive`,
        }, { status: 400 });
      }
    }

    const totalPreview = lines.reduce((sum, line) => {
      const art = productMap.get(line.product_id);
      return sum + Number(art.Cmimi) * line.qty;
    }, 0);

    // Sign a short-lived token carrying the order intent
    const orderToken = jwt.sign(
      {
        kind: 'order-confirm',
        userId,
        items: lines,
        billingInfo: body.billingInfo || null,
        shippingInfo: body.shippingInfo || null,
        paymentMethod: body.paymentMethod || 'cash',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const appUrl = process.env.APP_URL || 'https://www.goodiesfarm.al';
    const confirmUrl = `${appUrl}/api/checkout/confirm?token=${encodeURIComponent(orderToken)}`;

    // Save draft order in DB1 so user can track pending orders
    try {
      await db1.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ecommerce_draft_orders' AND xtype='U')
        BEGIN
          CREATE TABLE dbo.ecommerce_draft_orders (
            id INT PRIMARY KEY IDENTITY(1,1),
            user_id INT NOT NULL,
            items NVARCHAR(MAX) NOT NULL,
            billing_info NVARCHAR(500) NULL,
            shipping_info NVARCHAR(550) NULL,
            payment_method NVARCHAR(10) NOT NULL DEFAULT 'cash',
            total_preview FLOAT NOT NULL DEFAULT 0,
            status NVARCHAR(20) NOT NULL DEFAULT 'DRAFT',
            created_at DATETIME NOT NULL DEFAULT GETDATE()
          );
          CREATE INDEX IX_ecommerce_draft_orders_user_id ON dbo.ecommerce_draft_orders(user_id);
        END
      `);
      await db1.request()
        .input('UserId', sql.Int, userId)
        .input('Items', sql.NVarChar(sql.MAX), JSON.stringify(lines))
        .input('BillingInfo', sql.NVarChar(500), body.billingInfo || null)
        .input('ShippingInfo', sql.NVarChar(550), body.shippingInfo || null)
        .input('PaymentMethod', sql.NVarChar(10), body.paymentMethod || 'cash')
        .input('TotalPreview', sql.Float, totalPreview)
        .query(`
          INSERT INTO dbo.ecommerce_draft_orders (user_id, items, billing_info, shipping_info, payment_method, total_preview, status)
          VALUES (@UserId, @Items, @BillingInfo, @ShippingInfo, @PaymentMethod, @TotalPreview, 'DRAFT')
        `);
    } catch (draftErr: any) {
      console.error('Failed to save draft order:', draftErr);
    }

    try {
      await sendOrderConfirmationEmail({
        to: user.email,
        customerName: user.full_name || '',
        confirmUrl,
        total: totalPreview,
        lineCount: lines.length,
        currency: process.env.CURRENCY_SYMBOL || 'L',
      });

    } catch (mailErr: any) {
      console.error('Failed to send confirmation email:', mailErr);
      return NextResponse.json({
        success: false,
        message: 'Could not send confirmation email. Please try again later.',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Konfirmoni porosine ne gmail`,
      email: user.email,
    });
  } catch (error: any) {
    console.error('Error preparing order:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to prepare order',
      error: error.message,
    }, { status: 500 });
  }
}
