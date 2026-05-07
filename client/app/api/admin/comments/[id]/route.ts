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
    const commentId = parseInt(id, 10);
    if (Number.isNaN(commentId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid comment id' },
        { status: 400 }
      );
    }

    const pool = await getDb1();
    await pool
      .request()
      .input('id', sql.Int, commentId)
      .query('DELETE FROM dbo.ecommerce_comments WHERE id = @id');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
