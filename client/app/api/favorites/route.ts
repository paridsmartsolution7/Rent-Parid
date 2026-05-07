import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getDb1 } from '../../lib/db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

// GET - Fetch user's favorites
export async function GET(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'Not authenticated'
      }, { status: 401 });
    }

    const pool = await getDb1();
    const result = await pool.request()
      .input('userId', userId)
      .query('SELECT product_id, created_at FROM ecommerce_favorites WHERE user_id = @userId ORDER BY created_at DESC');

    return NextResponse.json({
      success: true,
      favorites: result.recordset.map(f => f.product_id)
    });
  } catch (error: any) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch favorites',
      error: error.message
    }, { status: 500 });
  }
}

// POST - Add to favorites
export async function POST(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'Not authenticated'
      }, { status: 401 });
    }

    const { product_id } = await request.json();

    if (!product_id) {
      return NextResponse.json({
        success: false,
        message: 'Product ID is required'
      }, { status: 400 });
    }

    const pool = await getDb1();
    
    // Check if already exists
    const existing = await pool.request()
      .input('userId', userId)
      .input('productId', product_id)
      .query('SELECT id FROM ecommerce_favorites WHERE user_id = @userId AND product_id = @productId');

    if (existing.recordset.length > 0) {
      return NextResponse.json({
        success: false,
        message: 'Product already in favorites'
      }, { status: 400 });
    }

    await pool.request()
      .input('userId', userId)
      .input('productId', product_id)
      .query('INSERT INTO ecommerce_favorites (user_id, product_id) VALUES (@userId, @productId)');

    return NextResponse.json({
      success: true,
      message: 'Added to favorites'
    });
  } catch (error: any) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to add favorite',
      error: error.message
    }, { status: 500 });
  }
}

// DELETE - Remove from favorites
export async function DELETE(request: Request) {
  try {
    const userId = getUserIdFromRequest(request);
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: 'Not authenticated'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');

    if (!product_id) {
      return NextResponse.json({
        success: false,
        message: 'Product ID is required'
      }, { status: 400 });
    }

    const pool = await getDb1();
    await pool.request()
      .input('userId', userId)
      .input('productId', parseInt(product_id))
      .query('DELETE FROM ecommerce_favorites WHERE user_id = @userId AND product_id = @productId');

    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    });
  } catch (error: any) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to remove favorite',
      error: error.message
    }, { status: 500 });
  }
}
