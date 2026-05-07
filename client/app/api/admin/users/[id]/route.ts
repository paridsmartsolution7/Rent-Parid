import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const userId = parseInt(id, 10);
    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid user id' },
        { status: 400 }
      );
    }

    const pool = await getDb1();
    // Cascade-clean dependents that reference the user, then delete the user.
    const req = pool.request().input('id', sql.Int, userId);
    await req.batch(`
      DELETE FROM dbo.ecommerce_comments WHERE user_id = @id;
      DELETE FROM dbo.ecommerce_favorites WHERE user_id = @id;
      DELETE FROM dbo.ecommerce_users WHERE id = @id;
    `);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}
