// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer');
import { getDb1 } from './db';

let cached: any = null;

function getTransporter(): any {
  if (cached) return cached;
  if (process.env.SMTP_HOST) {
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    cached = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  } else {
    throw new Error('No email transport configured.');
  }
  return cached;
}

const PRIMARY = '#1F3E76';
const DARK = '#111827';
const MUTED = '#6B7280';
const BG = '#EFF3F9';

function buildHtml(params: {
  title: string;
  excerpt: string | null;
  link: string;
  unsubscribeLink: string;
  brand: string;
  coverUrl?: string | null;
}) {
  const { title, excerpt, link, unsubscribeLink, brand, coverUrl } = params;
  return `
<div style="background:${BG};padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${DARK};">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(31,62,118,0.10);border:1px solid #E5E7EB;">
    <div style="background:linear-gradient(135deg, ${PRIMARY}, #1F3E76);padding:32px;text-align:center;color:#fff;">
      <div style="font-size:13px;letter-spacing:3px;font-weight:600;opacity:.85;text-transform:uppercase;margin-bottom:8px;">${brand}</div>
      <div style="font-size:14px;opacity:.9;">Postim i ri ne blog</div>
    </div>
    ${coverUrl ? `<img src="${coverUrl}" alt="" style="width:100%;display:block;max-height:280px;object-fit:cover;" />` : ''}
    <div style="padding:32px 28px;">
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:${DARK};">${escapeHtml(title)}</h1>
      ${excerpt ? `<p style="margin:0 0 24px;color:${MUTED};font-size:15px;line-height:1.6;">${escapeHtml(excerpt)}</p>` : ''}
      <a href="${link}" target="_blank" style="display:inline-block;background:${PRIMARY};color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;">
        Lexo postimin →
      </a>
    </div>
    <div style="padding:18px 28px 24px;border-top:1px solid #E5E7EB;text-align:center;color:${MUTED};font-size:12px;">
      Ju kane derguar kete postim sepse jeni regjistruar ne ${escapeHtml(brand)}.<br />
      <a href="${unsubscribeLink}" style="color:${MUTED};text-decoration:underline;">Cregjistrohu</a>
    </div>
  </div>
</div>`;
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Pulls the recipient list (active newsletter subscribers + registered shop
 * users), dedupes, and emails each one with the new post. Errors per address
 * are swallowed so one bad mailbox can't block the rest. Runs entirely in
 * the background — the calling route should not await this.
 */
export async function notifySubscribersOfNewPost(post: {
  title: string;
  slug: string;
  excerpt?: string | null;
  category_slug?: string | null;
  cover_image_id?: number | null;
}, brand: string, baseUrl: string) {
  let transporter: any;
  try {
    transporter = getTransporter();
  } catch (e) {
    console.warn('[blog-email] transporter not configured, skipping fan-out:', (e as Error).message);
    return;
  }

  const pool = await getDb1();
  let recipients: string[] = [];
  try {
    const r = await pool.request().query(`
      SELECT email FROM dbo.ecommerce_newsletter_subscribers WHERE active = 1
      UNION
      SELECT email FROM dbo.ecommerce_users WHERE email IS NOT NULL AND email <> ''
    `);
    recipients = r.recordset
      .map((row: any) => String(row.email || '').trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    // dedupe (UNION should already, but belt-and-braces)
    recipients = Array.from(new Set(recipients));
  } catch (e) {
    console.warn('[blog-email] could not load recipients:', (e as Error).message);
    return;
  }

  if (recipients.length === 0) {
    console.log('[blog-email] no subscribers / users — skipping');
    return;
  }

  const link = `${baseUrl}/blog/${encodeURIComponent(post.category_slug || 'general')}/${encodeURIComponent(post.slug)}`;
  const coverUrl = post.cover_image_id ? `${baseUrl}/api/blog/images/${post.cover_image_id}` : null;
  const subject = `📝 ${post.title}`;
  const from = `"${brand}" <${process.env.GMAIL_USER || process.env.SMTP_USER}>`;

  console.log(`[blog-email] sending "${post.title}" to ${recipients.length} addresses`);

  // Fan-out in parallel but cap concurrency so Gmail doesn't throttle us.
  const CHUNK = 8;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const slice = recipients.slice(i, i + CHUNK);
    await Promise.allSettled(
      slice.map(async (email) => {
        try {
          const unsubscribeLink = `${baseUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
          await transporter.sendMail({
            from,
            to: email,
            subject,
            html: buildHtml({
              title: post.title,
              excerpt: post.excerpt || null,
              link,
              unsubscribeLink,
              brand,
              coverUrl,
            }),
          });
          // Track last_notified for newsletter subscribers (silent if user-only)
          await pool
            .request()
            .input('email', email)
            .query(`
              UPDATE dbo.ecommerce_newsletter_subscribers
              SET last_notified_at = GETDATE()
              WHERE email = @email
            `).catch(() => {});
        } catch (e) {
          console.warn(`[blog-email] failed for ${email}:`, (e as Error).message);
        }
      })
    );
  }
  console.log(`[blog-email] fan-out complete`);
}
