import { NextResponse } from 'next/server';
import sql from 'mssql';
import type { ConnectionPool } from 'mssql';
import { getDb1 } from '../../lib/db';
import { getAuthUser } from '../../lib/getAuthUser';
import { isAdminRequest } from '../../lib/getAdminAuth';

/**
 * Auto-add columns introduced after the table was first created. Safe to run
 * on every request — each ALTER is idempotent (gated by sys.columns lookup).
 */
async function ensureConfigColumns(pool: ConnectionPool) {
  await pool.request().batch(`
    -- Legacy columns: present in newer grocery schema but missing from older
    -- Eccomerce-Parid installs that started life with create-config-table/route.ts.
    -- Add them idempotently so the SELECT below doesn't blow up with
    -- "Invalid column name" on first GET after migration.
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'top_banner_text')
      ALTER TABLE dbo.ecommerce_config ADD top_banner_text NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'categories_section_title')
      ALTER TABLE dbo.ecommerce_config ADD categories_section_title NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'categories_section_subtitle')
      ALTER TABLE dbo.ecommerce_config ADD categories_section_subtitle NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'banner_image_text')
      ALTER TABLE dbo.ecommerce_config ADD banner_image_text NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'banner_image_url')
      ALTER TABLE dbo.ecommerce_config ADD banner_image_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_eyebrow')
      ALTER TABLE dbo.ecommerce_config ADD about_eyebrow NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_title')
      ALTER TABLE dbo.ecommerce_config ADD about_title NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_text')
      ALTER TABLE dbo.ecommerce_config ADD about_text NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_image_url')
      ALTER TABLE dbo.ecommerce_config ADD about_image_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'contact_phone')
      ALTER TABLE dbo.ecommerce_config ADD contact_phone NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'contact_address')
      ALTER TABLE dbo.ecommerce_config ADD contact_address NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'delivery_note')
      ALTER TABLE dbo.ecommerce_config ADD delivery_note NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'facebook_url')
      ALTER TABLE dbo.ecommerce_config ADD facebook_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'instagram_url')
      ALTER TABLE dbo.ecommerce_config ADD instagram_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'portal_url')
      ALTER TABLE dbo.ecommerce_config ADD portal_url NVARCHAR(500) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'maps_url')
      ALTER TABLE dbo.ecommerce_config ADD maps_url NVARCHAR(500) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_out_of_stock')
      ALTER TABLE dbo.ecommerce_config ADD show_out_of_stock BIT NOT NULL CONSTRAINT DF_ec_show_oos DEFAULT 1;

    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'comments_enabled')
      ALTER TABLE dbo.ecommerce_config ADD comments_enabled BIT NOT NULL CONSTRAINT DF_ec_comments_en DEFAULT 1;

    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'reviews_enabled')
      ALTER TABLE dbo.ecommerce_config ADD reviews_enabled BIT NOT NULL CONSTRAINT DF_ec_reviews_en DEFAULT 1;

    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'services_enabled')
      ALTER TABLE dbo.ecommerce_config ADD services_enabled BIT NOT NULL CONSTRAINT DF_ec_services_en DEFAULT 0;

    -- Social visibility per platform
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_facebook')
      ALTER TABLE dbo.ecommerce_config ADD show_facebook BIT NOT NULL CONSTRAINT DF_ec_show_fb DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_instagram')
      ALTER TABLE dbo.ecommerce_config ADD show_instagram BIT NOT NULL CONSTRAINT DF_ec_show_ig DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_portal')
      ALTER TABLE dbo.ecommerce_config ADD show_portal BIT NOT NULL CONSTRAINT DF_ec_show_pt DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_maps')
      ALTER TABLE dbo.ecommerce_config ADD show_maps BIT NOT NULL CONSTRAINT DF_ec_show_mp DEFAULT 1;

    -- Stock display + ordering policy
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_stock_count')
      ALTER TABLE dbo.ecommerce_config ADD show_stock_count BIT NOT NULL CONSTRAINT DF_ec_show_stkc DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'allow_out_of_stock_orders')
      ALTER TABLE dbo.ecommerce_config ADD allow_out_of_stock_orders BIT NOT NULL CONSTRAINT DF_ec_allow_oos DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'out_of_stock_message')
      ALTER TABLE dbo.ecommerce_config ADD out_of_stock_message NVARCHAR(500) NULL;

    -- Footer attribution
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'powered_by_text')
      ALTER TABLE dbo.ecommerce_config ADD powered_by_text NVARCHAR(255) NULL;

    -- About-us section extras (eyebrow/title/text/image already exist).
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_image_caption')
      ALTER TABLE dbo.ecommerce_config ADD about_image_caption NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'about_maps_button_text')
      ALTER TABLE dbo.ecommerce_config ADD about_maps_button_text NVARCHAR(50) NULL;

    -- Promo banner overlay (the "GOODIES FARM / ORGANIC FOOD PRODUCTS" text).
    -- Empty string means "don't render this line"; NULL means "use default".
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'banner_image_eyebrow')
      ALTER TABLE dbo.ecommerce_config ADD banner_image_eyebrow NVARCHAR(255) NULL;

    -- Categories list: hide categories that have zero active products.
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'hide_empty_categories')
      ALTER TABLE dbo.ecommerce_config ADD hide_empty_categories BIT NOT NULL CONSTRAINT DF_ec_hide_empty_cat DEFAULT 0;

    -- Delivery info card on the product page.
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_delivery_info')
      ALTER TABLE dbo.ecommerce_config ADD show_delivery_info BIT NOT NULL CONSTRAINT DF_ec_show_deliv DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'delivery_estimate_text')
      ALTER TABLE dbo.ecommerce_config ADD delivery_estimate_text NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'delivery_pickup_fee')
      ALTER TABLE dbo.ecommerce_config ADD delivery_pickup_fee NVARCHAR(50) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'delivery_pickup_label')
      ALTER TABLE dbo.ecommerce_config ADD delivery_pickup_label NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'delivery_shipping_fee')
      ALTER TABLE dbo.ecommerce_config ADD delivery_shipping_fee NVARCHAR(50) NULL;

    -- Per-product UI buttons.
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_share_button')
      ALTER TABLE dbo.ecommerce_config ADD show_share_button BIT NOT NULL CONSTRAINT DF_ec_show_share DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_favorite_button')
      ALTER TABLE dbo.ecommerce_config ADD show_favorite_button BIT NOT NULL CONSTRAINT DF_ec_show_fav DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'show_zoom_button')
      ALTER TABLE dbo.ecommerce_config ADD show_zoom_button BIT NOT NULL CONSTRAINT DF_ec_show_zoom DEFAULT 1;

    -- Layout choices.
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'images_layout')
      ALTER TABLE dbo.ecommerce_config ADD images_layout NVARCHAR(20) NOT NULL CONSTRAINT DF_ec_imgs_layout DEFAULT 'row';
    IF NOT EXISTS (SELECT 1 FROM sys.columns
                   WHERE object_id = OBJECT_ID('dbo.ecommerce_config') AND name = 'price_currency_position')
      ALTER TABLE dbo.ecommerce_config ADD price_currency_position NVARCHAR(10) NOT NULL CONSTRAINT DF_ec_curr_pos DEFAULT 'after';

    -- Seed sensible defaults the first time a row exists with NULL values.
    -- MUST be EXEC'd: ALTER TABLE ADD + UPDATE on the new column in the same
    -- batch fails to parse because the column doesn't exist at compile time.
    EXEC(N'UPDATE dbo.ecommerce_config
             SET out_of_stock_message    = ISNULL(out_of_stock_message, ''Ky produkt nuk ka gjendje per momentin''),
                 powered_by_text         = ISNULL(powered_by_text, ''Parid Smart Solution''),
                 about_image_caption     = ISNULL(about_image_caption, ''Tiranë, Shqipëri''),
                 about_maps_button_text  = ISNULL(about_maps_button_text, ''Shiko në hartë''),
                 about_eyebrow           = ISNULL(about_eyebrow, N''QË PREJ 2019 • MADE IN ALBANIA''),
                 about_title             = ISNULL(about_title, N''Ndërtuar për biznese që kërkojnë kontroll real.''),
                 about_text              = ISNULL(about_text, N''Një sistem i vetëm për menaxhimin e shitjeve, stokut, financave dhe fiskalizimit. Më pak punë manuale – më shumë kontroll në kohë reale.

Kush jemi: Parid Smart Solution ofron programe profesionale për fiskalizimin, kontabilitetin dhe manaxhimin e biznesit, të shoqëruara edhe me pajisje POS. Ndihmojmë bizneset të punojnë më thjeshtë, më shpejt dhe në përputhje me ligjin.

Misioni: T''''u japim bizneseve mjete të thjeshta, të sakta dhe të ligjshme për të menaxhuar çdo proces ditor.

Vizioni: Të jemi programi më i besueshëm i menaxhimit financiar dhe fiskal në Shqipëri.'')');
  `);
}

export async function GET() {
  try {
    const pool = await getDb1();
    await ensureConfigColumns(pool);

    const result = await pool.request().query(`
      SELECT TOP 1
        company_name,
        logo_url,
        navbar_color,
        primary_color,
        secondary_color,
        hero_title,
        hero_subtitle,
        hero_button_text,
        cart_button_text,
        currency_symbol,
        show_stock_warning,
        show_ratings,
        items_per_page,
        top_banner_text,
        categories_section_title,
        categories_section_subtitle,
        banner_image_text,
        banner_image_url,
        about_eyebrow,
        about_title,
        about_text,
        about_image_url,
        contact_phone,
        contact_address,
        delivery_note,
        facebook_url,
        instagram_url,
        portal_url,
        maps_url,
        show_out_of_stock,
        comments_enabled,
        reviews_enabled,
        services_enabled,
        show_facebook,
        show_instagram,
        show_portal,
        show_maps,
        show_stock_count,
        allow_out_of_stock_orders,
        out_of_stock_message,
        powered_by_text,
        about_image_caption,
        about_maps_button_text,
        banner_image_eyebrow,
        banner_image_text,
        hide_empty_categories,
        show_delivery_info,
        delivery_estimate_text,
        delivery_pickup_fee,
        delivery_pickup_label,
        delivery_shipping_fee,
        show_share_button,
        show_favorite_button,
        show_zoom_button,
        images_layout,
        price_currency_position
      FROM dbo.ecommerce_config
      ORDER BY id DESC
    `);

    if (result.recordset.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No configuration found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      config: result.recordset[0]
    });
  } catch (error: any) {
    console.error('Error fetching config:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to fetch configuration'
    }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!isAdminRequest(request)) {
      const user = await getAuthUser(request);
      if (!user) {
        return NextResponse.json({ success: false, message: 'Nuk jeni i identifikuar' }, { status: 401 });
      }
    }

    const raw = await request.json();
    // Defensive coercion: the admin form sometimes ships array values when
    // the same field gets bound twice. mssql can't bind arrays to NVarChar,
    // so flatten array → last element (most recent edit wins) before any
    // SQL parameter binding.
    const body: any = raw && typeof raw === 'object' ? { ...raw } : {};
    for (const k of Object.keys(body)) {
      const v = body[k];
      if (Array.isArray(v)) body[k] = v.length ? v[v.length - 1] : null;
    }
    const pool = await getDb1();
    await ensureConfigColumns(pool);

    const updateRequest = pool.request();

    // Build dynamic update query
    const updates: string[] = [];
    if (body.company_name) {
      updateRequest.input('company_name', sql.NVarChar, body.company_name);
      updates.push('company_name = @company_name');
    }
    if (body.logo_url !== undefined) {
      updateRequest.input('logo_url', sql.NVarChar, body.logo_url);
      updates.push('logo_url = @logo_url');
    }
    if (body.navbar_color) {
      updateRequest.input('navbar_color', sql.NVarChar, body.navbar_color);
      updates.push('navbar_color = @navbar_color');
    }
    if (body.primary_color) {
      updateRequest.input('primary_color', sql.NVarChar, body.primary_color);
      updates.push('primary_color = @primary_color');
    }
    if (body.secondary_color) {
      updateRequest.input('secondary_color', sql.NVarChar, body.secondary_color);
      updates.push('secondary_color = @secondary_color');
    }
    if (body.hero_title) {
      updateRequest.input('hero_title', sql.NVarChar, body.hero_title);
      updates.push('hero_title = @hero_title');
    }
    if (body.hero_subtitle) {
      updateRequest.input('hero_subtitle', sql.NVarChar, body.hero_subtitle);
      updates.push('hero_subtitle = @hero_subtitle');
    }
    if (body.hero_button_text) {
      updateRequest.input('hero_button_text', sql.NVarChar, body.hero_button_text);
      updates.push('hero_button_text = @hero_button_text');
    }
    if (body.cart_button_text) {
      updateRequest.input('cart_button_text', sql.NVarChar, body.cart_button_text);
      updates.push('cart_button_text = @cart_button_text');
    }
    if (body.currency_symbol) {
      updateRequest.input('currency_symbol', sql.NVarChar, body.currency_symbol);
      updates.push('currency_symbol = @currency_symbol');
    }
    if (body.show_stock_warning !== undefined) {
      updateRequest.input('show_stock_warning', sql.Bit, body.show_stock_warning);
      updates.push('show_stock_warning = @show_stock_warning');
    }
    if (body.show_ratings !== undefined) {
      updateRequest.input('show_ratings', sql.Bit, body.show_ratings);
      updates.push('show_ratings = @show_ratings');
    }
    if (body.items_per_page) {
      updateRequest.input('items_per_page', sql.Int, body.items_per_page);
      updates.push('items_per_page = @items_per_page');
    }
    if (body.show_out_of_stock !== undefined) {
      updateRequest.input('show_out_of_stock', sql.Bit, body.show_out_of_stock);
      updates.push('show_out_of_stock = @show_out_of_stock');
    }
    if (body.comments_enabled !== undefined) {
      updateRequest.input('comments_enabled', sql.Bit, body.comments_enabled);
      updates.push('comments_enabled = @comments_enabled');
    }
    if (body.reviews_enabled !== undefined) {
      updateRequest.input('reviews_enabled', sql.Bit, body.reviews_enabled);
      updates.push('reviews_enabled = @reviews_enabled');
    }
    if (body.services_enabled !== undefined) {
      updateRequest.input('services_enabled', sql.Bit, body.services_enabled);
      updates.push('services_enabled = @services_enabled');
    }
    if (body.show_facebook !== undefined) {
      updateRequest.input('show_facebook', sql.Bit, body.show_facebook);
      updates.push('show_facebook = @show_facebook');
    }
    if (body.show_instagram !== undefined) {
      updateRequest.input('show_instagram', sql.Bit, body.show_instagram);
      updates.push('show_instagram = @show_instagram');
    }
    if (body.show_portal !== undefined) {
      updateRequest.input('show_portal', sql.Bit, body.show_portal);
      updates.push('show_portal = @show_portal');
    }
    if (body.show_maps !== undefined) {
      updateRequest.input('show_maps', sql.Bit, body.show_maps);
      updates.push('show_maps = @show_maps');
    }
    if (body.show_stock_count !== undefined) {
      updateRequest.input('show_stock_count', sql.Bit, body.show_stock_count);
      updates.push('show_stock_count = @show_stock_count');
    }
    if (body.allow_out_of_stock_orders !== undefined) {
      updateRequest.input('allow_out_of_stock_orders', sql.Bit, body.allow_out_of_stock_orders);
      updates.push('allow_out_of_stock_orders = @allow_out_of_stock_orders');
    }
    if (body.out_of_stock_message !== undefined) {
      updateRequest.input('out_of_stock_message', sql.NVarChar(500), body.out_of_stock_message);
      updates.push('out_of_stock_message = @out_of_stock_message');
    }
    if (body.powered_by_text !== undefined) {
      updateRequest.input('powered_by_text', sql.NVarChar(255), body.powered_by_text);
      updates.push('powered_by_text = @powered_by_text');
    }
    if (body.contact_phone !== undefined) {
      updateRequest.input('contact_phone', sql.NVarChar, body.contact_phone);
      updates.push('contact_phone = @contact_phone');
    }
    if (body.contact_address !== undefined) {
      updateRequest.input('contact_address', sql.NVarChar, body.contact_address);
      updates.push('contact_address = @contact_address');
    }
    if (body.delivery_note !== undefined) {
      updateRequest.input('delivery_note', sql.NVarChar, body.delivery_note);
      updates.push('delivery_note = @delivery_note');
    }
    if (body.facebook_url !== undefined) {
      updateRequest.input('facebook_url', sql.NVarChar, body.facebook_url);
      updates.push('facebook_url = @facebook_url');
    }
    if (body.instagram_url !== undefined) {
      updateRequest.input('instagram_url', sql.NVarChar, body.instagram_url);
      updates.push('instagram_url = @instagram_url');
    }
    if (body.portal_url !== undefined) {
      updateRequest.input('portal_url', sql.NVarChar, body.portal_url);
      updates.push('portal_url = @portal_url');
    }
    if (body.maps_url !== undefined) {
      updateRequest.input('maps_url', sql.NVarChar, body.maps_url);
      updates.push('maps_url = @maps_url');
    }
    if (body.about_eyebrow !== undefined) {
      updateRequest.input('about_eyebrow', sql.NVarChar, body.about_eyebrow);
      updates.push('about_eyebrow = @about_eyebrow');
    }
    if (body.about_title !== undefined) {
      updateRequest.input('about_title', sql.NVarChar, body.about_title);
      updates.push('about_title = @about_title');
    }
    if (body.about_text !== undefined) {
      updateRequest.input('about_text', sql.NVarChar(sql.MAX), body.about_text);
      updates.push('about_text = @about_text');
    }
    if (body.about_image_url !== undefined) {
      updateRequest.input('about_image_url', sql.NVarChar, body.about_image_url);
      updates.push('about_image_url = @about_image_url');
    }
    if (body.about_image_caption !== undefined) {
      updateRequest.input('about_image_caption', sql.NVarChar(255), body.about_image_caption);
      updates.push('about_image_caption = @about_image_caption');
    }
    if (body.about_maps_button_text !== undefined) {
      updateRequest.input('about_maps_button_text', sql.NVarChar(50), body.about_maps_button_text);
      updates.push('about_maps_button_text = @about_maps_button_text');
    }
    if (body.banner_image_eyebrow !== undefined) {
      updateRequest.input('banner_image_eyebrow', sql.NVarChar(255), body.banner_image_eyebrow);
      updates.push('banner_image_eyebrow = @banner_image_eyebrow');
    }
    if (body.banner_image_text !== undefined) {
      updateRequest.input('banner_image_text', sql.NVarChar, body.banner_image_text);
      updates.push('banner_image_text = @banner_image_text');
    }
    if (body.hide_empty_categories !== undefined) {
      updateRequest.input('hide_empty_categories', sql.Bit, body.hide_empty_categories);
      updates.push('hide_empty_categories = @hide_empty_categories');
    }
    if (body.show_delivery_info !== undefined) {
      updateRequest.input('show_delivery_info', sql.Bit, body.show_delivery_info);
      updates.push('show_delivery_info = @show_delivery_info');
    }
    if (body.delivery_estimate_text !== undefined) {
      updateRequest.input('delivery_estimate_text', sql.NVarChar(255), body.delivery_estimate_text);
      updates.push('delivery_estimate_text = @delivery_estimate_text');
    }
    if (body.delivery_pickup_fee !== undefined) {
      updateRequest.input('delivery_pickup_fee', sql.NVarChar(50), body.delivery_pickup_fee);
      updates.push('delivery_pickup_fee = @delivery_pickup_fee');
    }
    if (body.delivery_pickup_label !== undefined) {
      updateRequest.input('delivery_pickup_label', sql.NVarChar(255), body.delivery_pickup_label);
      updates.push('delivery_pickup_label = @delivery_pickup_label');
    }
    if (body.delivery_shipping_fee !== undefined) {
      updateRequest.input('delivery_shipping_fee', sql.NVarChar(50), body.delivery_shipping_fee);
      updates.push('delivery_shipping_fee = @delivery_shipping_fee');
    }
    if (body.show_share_button !== undefined) {
      updateRequest.input('show_share_button', sql.Bit, body.show_share_button);
      updates.push('show_share_button = @show_share_button');
    }
    if (body.show_favorite_button !== undefined) {
      updateRequest.input('show_favorite_button', sql.Bit, body.show_favorite_button);
      updates.push('show_favorite_button = @show_favorite_button');
    }
    if (body.show_zoom_button !== undefined) {
      updateRequest.input('show_zoom_button', sql.Bit, body.show_zoom_button);
      updates.push('show_zoom_button = @show_zoom_button');
    }
    if (body.images_layout !== undefined) {
      updateRequest.input('images_layout', sql.NVarChar(20), body.images_layout);
      updates.push('images_layout = @images_layout');
    }
    if (body.price_currency_position !== undefined) {
      updateRequest.input('price_currency_position', sql.NVarChar(10), body.price_currency_position);
      updates.push('price_currency_position = @price_currency_position');
    }

    updates.push('updated_at = GETDATE()');

    await updateRequest.query(`
      UPDATE dbo.ecommerce_config
      SET ${updates.join(', ')}
      WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_config ORDER BY id DESC)
    `);

    return NextResponse.json({
      success: true,
      message: 'Configuration updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating config:', error);
    return NextResponse.json({
      success: false,
      message: error?.message || 'Failed to update configuration'
    }, { status: 500 });
  }
}
