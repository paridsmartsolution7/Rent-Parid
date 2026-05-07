import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../lib/db';
import { getAuthUser } from '../../../lib/getAuthUser';

export async function PUT(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, phone, address, city, postal_code } = body;

    // Partial update: only touch fields that were actually provided.
    const pool = await getDb1();
    const req = pool.request().input('userId', sql.Int, user.userId);
    const sets: string[] = [];

    if (full_name !== undefined) {
      if (typeof full_name !== 'string' || full_name.trim().length < 2) {
        return NextResponse.json({ success: false, message: 'Emri eshte i detyrueshem' }, { status: 400 });
      }
      req.input('full_name', sql.NVarChar, full_name.trim());
      sets.push('full_name = @full_name');
    }
    if (phone !== undefined) {
      req.input('phone', sql.NVarChar, phone || null);
      sets.push('phone = @phone');
    }
    if (address !== undefined) {
      req.input('address', sql.NVarChar, address || null);
      sets.push('address = @address');
    }
    if (city !== undefined) {
      req.input('city', sql.NVarChar, city || null);
      sets.push('city = @city');
    }
    if (postal_code !== undefined) {
      req.input('postal_code', sql.NVarChar, postal_code || null);
      sets.push('postal_code = @postal_code');
    }

    if (sets.length === 0) {
      return NextResponse.json({ success: false, message: 'Asnje fushe per te perditesuar' }, { status: 400 });
    }

    await req.query(`UPDATE dbo.ecommerce_users SET ${sets.join(', ')} WHERE id = @userId`);

    return NextResponse.json({ success: true, message: 'Profili u perditesua' });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ success: false, message: 'Perditesimi deshtoi' }, { status: 500 });
  }
}
