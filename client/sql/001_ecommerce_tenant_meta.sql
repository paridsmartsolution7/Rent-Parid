-- ============================================================================
-- Run this ONCE on each {nipt}Eccomerce database that has a deployed shop.
-- Example: USE PSSTESTEccomerce; GO  -- then run the rest.
--
-- Stores per-tenant shop infrastructure metadata so /ecommerce/check on the
-- Parid POS backend can return shop_url to the admin dashboard.
--
-- The /api/admin/shop-meta route auto-creates the table and adds new columns
-- if missing — running this manually is optional.
-- ============================================================================

IF NOT EXISTS (
  SELECT 1 FROM sysobjects WHERE name = 'ecommerce_tenant_meta' AND xtype = 'U'
)
BEGIN
  CREATE TABLE dbo.ecommerce_tenant_meta (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    shop_url          NVARCHAR(500)  NULL,
    connection_string NVARCHAR(MAX)  NULL,
    notes             NVARCHAR(1000) NULL,
    updated_at        DATETIME       NOT NULL DEFAULT GETDATE()
  );
END
GO

-- Add columns to pre-existing installs that don't have them yet.
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.ecommerce_tenant_meta')
    AND name = 'connection_string'
)
BEGIN
  ALTER TABLE dbo.ecommerce_tenant_meta ADD connection_string NVARCHAR(MAX) NULL;
END
GO

-- Seed exactly one row per DB. Re-running is safe — it only inserts when empty.
IF NOT EXISTS (SELECT 1 FROM dbo.ecommerce_tenant_meta)
BEGIN
  INSERT INTO dbo.ecommerce_tenant_meta (shop_url, notes)
  VALUES (NULL, 'Set shop_url to the public Next.js shop API base, e.g. http://84.247.137.67:9101/api');
END
GO

-- Manual one-time seed for PSSTEST (uncomment + edit + run after CREATE):
-- UPDATE dbo.ecommerce_tenant_meta
--    SET shop_url          = 'http://84.247.137.67:9101/api',
--        connection_string = 'Server=80.91.125.240,9998;Database=PSSTESTEccomerce;User Id=sa;Password=...;TrustServerCertificate=True',
--        updated_at        = GETDATE()
--  WHERE id = (SELECT TOP 1 id FROM dbo.ecommerce_tenant_meta ORDER BY id DESC);
