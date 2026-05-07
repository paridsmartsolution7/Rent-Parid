import { NextResponse } from 'next/server';
import { getDb1 } from '../../lib/db';

export async function GET() {
  try {
    const pool = await getDb1();
    
    // Create ecommerce_config table
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ecommerce_config' AND xtype='U')
      BEGIN
        CREATE TABLE dbo.ecommerce_config (
          id INT PRIMARY KEY IDENTITY(1,1),
          company_name NVARCHAR(255) NOT NULL,
          logo_url NVARCHAR(500),
          navbar_color NVARCHAR(50) DEFAULT '#FFFFFF',
          primary_color NVARCHAR(50) DEFAULT '#4F46E5',
          secondary_color NVARCHAR(50) DEFAULT '#9333EA',
          hero_title NVARCHAR(500),
          hero_subtitle NVARCHAR(500),
          hero_button_text NVARCHAR(100),
          cart_button_text NVARCHAR(100),
          currency_symbol NVARCHAR(10) DEFAULT '$',
          show_stock_warning BIT DEFAULT 1,
          show_ratings BIT DEFAULT 1,
          items_per_page INT DEFAULT 20,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        )
        
        -- Insert default configuration
        INSERT INTO dbo.ecommerce_config (
          company_name,
          navbar_color,
          primary_color,
          secondary_color,
          hero_title,
          hero_subtitle,
          hero_button_text,
          cart_button_text
        ) VALUES (
          'PSS Shop',
          '#FFFFFF',
          '#4F46E5',
          '#9333EA',
          'Summer Sale — Up to 40% Off',
          'Discover top products across all categories',
          'Shop Now',
          'Cart'
        )
      END
    `;
    
    await pool.request().query(createTableQuery);
    
    return NextResponse.json({
      success: true,
      message: 'Ecommerce config table created successfully in PSSTEST_konfigurim database',
      table: 'ecommerce_config',
      fields: [
        'id (auto-increment)',
        'company_name',
        'logo_url',
        'primary_color',
        'secondary_color',
        'hero_title',
        'hero_subtitle',
        'hero_button_text',
        'cart_button_text',
        'currency_symbol',
        'show_stock_warning',
        'show_ratings',
        'items_per_page',
        'created_at',
        'updated_at'
      ]
    });
  } catch (error: any) {
    console.error('Error creating table:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to create ecommerce config table',
      error: error.message
    }, { status: 500 });
  }
}
