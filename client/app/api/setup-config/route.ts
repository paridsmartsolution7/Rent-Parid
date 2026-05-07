import { NextResponse } from 'next/server';
import { getDb1 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb1();

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ecommerce_config')
      BEGIN
        CREATE TABLE ecommerce_config (
          id INT IDENTITY(1,1) PRIMARY KEY,
          company_name NVARCHAR(255) DEFAULT 'PSS Shop',
          logo_url NVARCHAR(500) NULL,
          navbar_color NVARCHAR(20) DEFAULT '#FFFFFF',
          primary_color NVARCHAR(20) DEFAULT '#4F46E5',
          secondary_color NVARCHAR(20) DEFAULT '#9333EA',
          hero_title NVARCHAR(255) DEFAULT 'Summer Sale — Up to 40% Off',
          hero_subtitle NVARCHAR(255) DEFAULT 'Discover top products across all categories',
          hero_button_text NVARCHAR(50) DEFAULT 'Shop Now',
          cart_button_text NVARCHAR(50) DEFAULT 'Cart',
          currency_symbol NVARCHAR(10) DEFAULT 'L',
          show_stock_warning BIT DEFAULT 1,
          show_ratings BIT DEFAULT 1,
          items_per_page INT DEFAULT 20,
          updated_at DATETIME DEFAULT GETDATE()
        );

        INSERT INTO ecommerce_config (company_name) VALUES ('PSS Shop');
      END
    `);

    return NextResponse.json({ success: true, message: 'ecommerce_config table ready' });
  } catch (error: any) {
    console.error('Setup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
