import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';
import { ensureBlogTables } from '../../../../lib/blogSchema';

/**
 * Backfills cover images on the demo posts. Idempotent: only updates posts
 * that don't already have a cover. Three branded SVG covers (green / blue /
 * amber) match the seeded categories so the blog grid looks alive even
 * before real photos are uploaded.
 */
type Cover = { slug: string; svg: string };

const COVERS: Cover[] = [
  {
    slug: 'pse-te-zgjedhim-ushqimet-organike',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#65A30D"/>
    </linearGradient>
    <radialGradient id="g2" cx="0.85" cy="0.2" r="0.7">
      <stop offset="0%" stop-color="#F59E0B" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g1)"/>
  <rect width="1600" height="900" fill="url(#g2)"/>
  <g opacity="0.85" transform="translate(1100,260)">
    <circle cx="0" cy="0" r="180" fill="#FACC15" opacity="0.85"/>
    <path d="M -90 0 Q -50 -110 0 -90 Q 50 -110 90 0 Q 50 110 0 130 Q -50 110 -90 0 Z" fill="#84CC16"/>
    <ellipse cx="0" cy="-95" rx="6" ry="22" fill="#3F6212"/>
  </g>
  <g fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-weight="800">
    <text x="120" y="380" font-size="64" letter-spacing="6" opacity="0.85">SHENDET · ORGANIKE</text>
    <text x="120" y="500" font-size="120">Ushqyerja qe</text>
    <text x="120" y="640" font-size="120">te ben mire.</text>
  </g>
</svg>`,
  },
  {
    slug: 'vitamina-d3-perfitime',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0EA5E9"/>
      <stop offset="100%" stop-color="#FDBA74"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="1180" cy="320" r="180" fill="#FEF08A" opacity="0.95"/>
  <g stroke="#FEF08A" stroke-width="6" stroke-linecap="round" opacity="0.9">
    <line x1="1180" y1="60"  x2="1180" y2="120"/>
    <line x1="1180" y1="520" x2="1180" y2="580"/>
    <line x1="920"  y1="320" x2="980"  y2="320"/>
    <line x1="1380" y1="320" x2="1440" y2="320"/>
    <line x1="1000" y1="140" x2="1040" y2="180"/>
    <line x1="1320" y1="460" x2="1360" y2="500"/>
    <line x1="1000" y1="500" x2="1040" y2="460"/>
    <line x1="1320" y1="180" x2="1360" y2="140"/>
  </g>
  <g fill="#0c4a6e" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-weight="800">
    <text x="120" y="360" font-size="56" letter-spacing="4" opacity="0.8">VITAMINA D3</text>
    <text x="120" y="480" font-size="120">Vitamin e diellit</text>
    <text x="120" y="620" font-size="120">per cdo dimer.</text>
  </g>
</svg>`,
  },
  {
    slug: 'ushqyerja-me-stine-perfitime',
    svg: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F97316"/>
      <stop offset="60%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#84CC16"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#warm)"/>
  <g transform="translate(1080,260)">
    <circle r="180" fill="#DC2626" opacity="0.9"/>
    <ellipse cx="-30" cy="-80" rx="60" ry="22" fill="#16A34A"/>
    <ellipse cx="35"  cy="-72" rx="50" ry="18" fill="#16A34A"/>
  </g>
  <g transform="translate(820,640)">
    <circle r="120" fill="#7C2D12" opacity="0.85"/>
    <path d="M 0 -80 Q -40 -120 0 -130 Q 40 -120 0 -80" fill="#16A34A"/>
  </g>
  <g transform="translate(1300,640)">
    <ellipse rx="120" ry="80" fill="#FACC15" opacity="0.9"/>
  </g>
  <g fill="#ffffff" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-weight="800">
    <text x="120" y="370" font-size="56" letter-spacing="4" opacity="0.85">RECETA · STINE</text>
    <text x="120" y="500" font-size="120">Cdo stine</text>
    <text x="120" y="640" font-size="120">e shijes saj.</text>
  </g>
</svg>`,
  },
];

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);

    const updated: { slug: string; image_id: number }[] = [];
    for (const c of COVERS) {
      // Skip if the post already has a cover (idempotent re-run).
      const postRes = await pool
        .request()
        .input('slug', sql.NVarChar(255), c.slug)
        .query(`SELECT id, cover_image_id FROM dbo.ecommerce_blog_posts WHERE slug = @slug`);
      const post = postRes.recordset[0];
      if (!post) continue;
      if (post.cover_image_id) continue;

      const buffer = Buffer.from(c.svg, 'utf8');
      const ins = await pool
        .request()
        .input('image_data', sql.VarBinary(sql.MAX), buffer)
        .input('mime_type', sql.NVarChar(50), 'image/svg+xml')
        .query(`
          INSERT INTO dbo.ecommerce_blog_images (image_data, mime_type)
          OUTPUT INSERTED.id
          VALUES (@image_data, @mime_type)
        `);
      const imageId = ins.recordset[0]?.id;
      if (!imageId) continue;

      await pool
        .request()
        .input('id', sql.Int, post.id)
        .input('cid', sql.Int, imageId)
        .query(`
          UPDATE dbo.ecommerce_blog_posts
          SET cover_image_id = @cid, updated_at = GETDATE()
          WHERE id = @id
        `);

      updated.push({ slug: c.slug, image_id: imageId });
    }

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    console.error('Error seeding blog images:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
