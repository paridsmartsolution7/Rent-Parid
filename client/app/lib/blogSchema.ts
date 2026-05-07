import type { ConnectionPool } from 'mssql';

/**
 * Centralised idempotent migration for the blog tables. Called by every
 * route handler that touches the blog so a fresh DB is provisioned on first
 * request and the schema stays in sync without manual SQL.
 *
 * Tables (all live inside {nipt}Eccomerce / DB1):
 *   - ecommerce_blog_categories
 *   - ecommerce_blog_posts             (soft-deleted via deleted_at)
 *   - ecommerce_blog_post_tags         (many tags per post, simple text rows)
 *   - ecommerce_blog_post_history      (audit log)
 *   - ecommerce_blog_images            (binary uploads referenced from posts)
 */
export async function ensureBlogTables(pool: ConnectionPool) {
  await pool.request().batch(`
    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_blog_categories' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_blog_categories (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(255) NOT NULL,
        slug        NVARCHAR(255) NOT NULL,
        color       NVARCHAR(20)  NULL,
        created_at  DATETIME      NOT NULL DEFAULT GETDATE()
      );
      CREATE UNIQUE INDEX IX_blog_cat_slug ON dbo.ecommerce_blog_categories(slug);
    END;

    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_blog_posts' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_blog_posts (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        slug            NVARCHAR(255)  NOT NULL,
        title           NVARCHAR(500)  NOT NULL,
        excerpt         NVARCHAR(1000) NULL,
        content_html    NVARCHAR(MAX)  NULL,
        category_id     INT            NULL,
        cover_image_id  INT            NULL,
        author_operator NVARCHAR(255)  NULL,   -- nipt-scoped POS operator id
        author_username NVARCHAR(255)  NULL,
        title_size      NVARCHAR(20)   NULL,   -- 'sm' | 'md' | 'lg' | 'xl'
        published       BIT            NOT NULL CONSTRAINT DF_blog_published DEFAULT 0,
        published_at    DATETIME       NULL,
        created_at      DATETIME       NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME       NOT NULL DEFAULT GETDATE(),
        deleted_at      DATETIME       NULL    -- soft-delete; auto-purged after 30 days
      );
      CREATE UNIQUE INDEX IX_blog_post_slug ON dbo.ecommerce_blog_posts(slug);
      CREATE INDEX IX_blog_post_published ON dbo.ecommerce_blog_posts(published, published_at);
      CREATE INDEX IX_blog_post_deleted ON dbo.ecommerce_blog_posts(deleted_at);
    END;

    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_blog_post_tags' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_blog_post_tags (
        post_id  INT          NOT NULL,
        tag      NVARCHAR(80) NOT NULL,
        CONSTRAINT PK_blog_post_tag PRIMARY KEY (post_id, tag)
      );
      CREATE INDEX IX_blog_post_tag_tag ON dbo.ecommerce_blog_post_tags(tag);
    END;

    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_blog_post_history' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_blog_post_history (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        post_id       INT             NOT NULL,
        action        NVARCHAR(20)    NOT NULL,   -- create | update | delete | restore
        operator      NVARCHAR(255)   NULL,
        username      NVARCHAR(255)   NULL,
        snapshot_json NVARCHAR(MAX)   NULL,
        at            DATETIME        NOT NULL DEFAULT GETDATE()
      );
      CREATE INDEX IX_blog_history_post ON dbo.ecommerce_blog_post_history(post_id, at DESC);
    END;

    IF NOT EXISTS (SELECT 1 FROM sysobjects WHERE name = 'ecommerce_blog_images' AND xtype = 'U')
    BEGIN
      CREATE TABLE dbo.ecommerce_blog_images (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        image_data  VARBINARY(MAX) NULL,
        mime_type   NVARCHAR(50)   NULL,
        uploaded_at DATETIME       NOT NULL DEFAULT GETDATE()
      );
    END;
  `);
}

/**
 * Hard-deletes posts that have been soft-deleted for 30+ days. Called from
 * the admin list endpoint so cleanup is opportunistic and free.
 */
export async function purgeExpiredDeletedPosts(pool: ConnectionPool) {
  try {
    await pool.request().batch(`
      -- collect ids first so we can clean dependents in the same TX
      DECLARE @ids TABLE (id INT);
      INSERT INTO @ids
        SELECT id FROM dbo.ecommerce_blog_posts
        WHERE deleted_at IS NOT NULL AND deleted_at < DATEADD(day, -30, GETDATE());

      DELETE FROM dbo.ecommerce_blog_post_tags
       WHERE post_id IN (SELECT id FROM @ids);
      DELETE FROM dbo.ecommerce_blog_post_history
       WHERE post_id IN (SELECT id FROM @ids);
      DELETE FROM dbo.ecommerce_blog_posts
       WHERE id IN (SELECT id FROM @ids);
    `);
  } catch {
    /* best-effort cleanup; ignore failures */
  }
}

/**
 * URL-safe slug from a title. Keeps Albanian/Latin chars but strips accents
 * and turns whitespace + punctuation into hyphens. Length-capped.
 */
export function slugify(s: string, max = 80): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || `post-${Date.now()}`;
}
