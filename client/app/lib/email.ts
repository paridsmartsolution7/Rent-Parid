// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodemailer = require('nodemailer');

let cached: any = null;

function getTransporter(): any {
  if (cached) return cached;

  if (process.env.SMTP_HOST) {
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
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
    throw new Error('No email transport configured. Set SMTP_HOST or GMAIL_USER + GMAIL_APP_PASSWORD.');
  }

  return cached;
}

const BRAND = process.env.BRAND_NAME || 'PSS Shop';
const PRIMARY = '#1F3E76';
const SECONDARY = '#1F3E76';
const SUCCESS = '#10B981';
const TEXT = '#111827';
const MUTED = '#6B7280';
const BG = '#EFF3F9';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';

function wrap(contentHtml: string, accent: string, headerEmoji: string, headerTitle: string, headerSubtitle: string) {
  return `
  <div style="background:${BG};padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT};">
    <div style="max-width:600px;margin:0 auto;background:${CARD};border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(31,62,118,0.10);border:1px solid ${BORDER};">

      <div style="background:linear-gradient(135deg, ${PRIMARY}, ${accent});padding:40px 32px;text-align:center;color:#fff;">
        <div style="font-size:13px;letter-spacing:3px;font-weight:600;opacity:.85;text-transform:uppercase;margin-bottom:8px;">${BRAND}</div>
        <div style="font-size:48px;line-height:1;margin-bottom:12px;">${headerEmoji}</div>
        <div style="font-size:26px;font-weight:700;margin-bottom:6px;">${headerTitle}</div>
        <div style="font-size:14px;opacity:.9;">${headerSubtitle}</div>
      </div>

      <div style="padding:32px 32px 28px 32px;">
        ${contentHtml}
      </div>

      <div style="background:#FAFAFA;padding:20px 32px;text-align:center;border-top:1px solid ${BORDER};">
        <div style="font-size:12px;color:${MUTED};">
          Derguar me kujdes nga <b style="color:${TEXT}">${BRAND}</b><br/>
          Pyetje? Pergjigju direkt ketij emaili.
        </div>
      </div>
    </div>
  </div>`;
}

export async function sendOrderConfirmationEmail(params: {
  to: string;
  customerName: string;
  confirmUrl: string;
  total: number;
  lineCount: number;
  currency: string;
}) {
  const { to, customerName, confirmUrl, total, lineCount, currency } = params;

  const body = `
    <p style="margin:0 0 8px 0;font-size:17px;">Pershendetje <b>${customerName || ''}</b>,</p>
    <p style="margin:0 0 20px 0;color:${MUTED};line-height:1.6;">
      Kemi marre porosine tuaj. Shikoni permbledhjen me poshte dhe klikoni <b>Konfirmo Porosine</b> per ta finalizuar.
    </p>

    <div style="background:${BG};border:1px solid ${BORDER};border-radius:14px;padding:20px 24px;margin:20px 0 28px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:14px;">Artikuj</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${lineCount} artikull${lineCount === 1 ? '' : 'e'}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:14px;">Totali i porosise</td>
          <td style="padding:4px 0;text-align:right;font-weight:700;font-size:18px;color:${PRIMARY};">
            ${currency}${total.toFixed(2)}
          </td>
        </tr>
      </table>
    </div>

    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${confirmUrl}" style="height:50px;v-text-anchor:middle;width:220px;" arcsize="50%" fillcolor="${PRIMARY}">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">Konfirmo Porosine</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <div style="text-align:center;margin:28px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td style="background-color:${PRIMARY};border-radius:999px;padding:0;">
            <a href="${confirmUrl}"
               target="_blank"
               style="display:inline-block;background-color:${PRIMARY};
                      color:#ffffff;padding:16px 40px;border-radius:999px;text-decoration:none;
                      font-weight:700;font-size:15px;letter-spacing:.3px;font-family:sans-serif;">
              Konfirmo Porosine &rarr;
            </a>
          </td>
        </tr>
      </table>
    </div>
    <!--<![endif]-->

    <div style="border-top:1px dashed ${BORDER};margin-top:28px;padding-top:20px;">
      <p style="margin:0 0 6px 0;font-size:12px;color:${MUTED};">
        ⏱  Ky link skadon per <b>1 ore</b>.
      </p>
      <p style="margin:0 0 10px 0;font-size:12px;color:${MUTED};">
        Nese nuk e keni bere kete porosi, injoroni kete email.
      </p>
      <p style="margin:0;font-size:11px;color:${MUTED};word-break:break-all;">
        Butoni nuk funksionon? Kopjoni kete link:<br/>
        <a href="${confirmUrl}" target="_blank" style="color:${PRIMARY};text-decoration:underline;">${confirmUrl}</a>
      </p>
    </div>
  `;

  const html = wrap(body, SECONDARY, '🛍️', 'Gati per konfirmim!', 'Nje klik per te konfirmuar porosine tuaj');

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER,
    to,
    subject: `Konfirmo porosine ne ${BRAND}`,
    html,
  });
}

export async function sendOrderFinalizedEmail(params: {
  to: string;
  customerName: string;
  orderKodi: number;
  total: number;
  currency: string;
  lines: { name: string; qty: number; price: number }[];
}) {
  const { to, customerName, orderKodi, total, currency, lines } = params;

  const rowsHtml = lines.map((l, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};">
      <td style="padding:12px 14px;border-bottom:1px solid ${BORDER};font-size:14px;">
        ${l.name}
        <div style="font-size:12px;color:${MUTED};margin-top:2px;">
          ${currency}${l.price.toFixed(2)} secili
        </div>
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${BORDER};text-align:center;font-weight:600;">
        ×${l.qty}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid ${BORDER};text-align:right;font-weight:600;">
        ${currency}${(l.price * l.qty).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const body = `
    <p style="margin:0 0 8px 0;font-size:17px;">Faleminderit, <b>${customerName || ''}</b>! 🎉</p>
    <p style="margin:0 0 22px 0;color:${MUTED};line-height:1.6;">
      Porosia juaj eshte konfirmuar dhe po pergatitet.
      Do ta nisim sa me shpejt te jete e mundur.
    </p>

    <div style="background:linear-gradient(135deg, #ECFDF5, #F0FDF4);border:1px solid #D1FAE5;border-radius:14px;
                padding:18px 22px;margin:0 0 24px 0;display:flex;align-items:center;">
      <div style="font-size:13px;color:${MUTED};letter-spacing:1px;text-transform:uppercase;">Numri i Porosise</div>
      <div style="font-size:24px;font-weight:800;color:${SUCCESS};letter-spacing:.5px;margin-top:4px;">
        #${orderKodi}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;margin:0 0 8px 0;">
      <thead>
        <tr style="background:${BG};">
          <th style="padding:12px 14px;text-align:left;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Artikulli</th>
          <th style="padding:12px 14px;text-align:center;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Sasia</th>
          <th style="padding:12px 14px;text-align:right;font-size:12px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Nentotali</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div style="background:${BG};border-radius:12px;padding:16px 22px;margin:16px 0 28px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:15px;color:${TEXT};font-weight:600;">Totali i paguar</td>
          <td style="text-align:right;font-size:22px;font-weight:800;color:${PRIMARY};">
            ${currency}${total.toFixed(2)}
          </td>
        </tr>
      </table>
    </div>

    <div style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:12px;padding:16px 20px;margin:0 0 8px 0;">
      <div style="font-weight:700;color:#9A3412;margin-bottom:4px;">📦 Cfare ndodh me pas?</div>
      <div style="font-size:13px;color:#9A3412;line-height:1.6;">
        Ekipi yne po paketizon porosine tuaj tani. Do te merrni nje email tjeter me detajet e dergeses sapo te nise. Ju faleminderit per besimin!
      </div>
    </div>
  `;

  const html = wrap(body, SUCCESS, '✨', 'Porosia u Konfirmua!', 'Porosia juaj po pergatitet');

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER,
    to,
    subject: `✓ Porosia #${orderKodi} u konfirmua — faleminderit!`,
    html,
  });
}

export async function sendAdminOrderNotification(params: {
  to: string[];
  customerName: string;
  customerEmail: string;
  orderKodi: number;
  total: number;
  lineCount: number;
  currency: string;
  lines: { name: string; qty: number; price: number }[];
}) {
  const { to, customerName, customerEmail, orderKodi, total, lineCount, currency, lines } = params;

  const rowsHtml = lines.map((l, idx) => `
    <tr style="background:${idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'};">
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};font-size:13px;">${l.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:center;font-weight:600;">x${l.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid ${BORDER};text-align:right;font-weight:600;">${currency}${(l.price * l.qty).toFixed(2)}</td>
    </tr>
  `).join('');

  const body = `
    <p style="margin:0 0 8px 0;font-size:17px;">Porosi e re e konfirmuar nga <b>${customerName}</b></p>
    <p style="margin:0 0 20px 0;color:${MUTED};line-height:1.6;">
      Klienti konfirmoi porosine ne ${BRAND}. Me poshte jane detajet.
    </p>

    <div style="background:${BG};border:1px solid ${BORDER};border-radius:14px;padding:20px 24px;margin:20px 0 16px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:14px;">Nr. Porosise</td>
          <td style="padding:4px 0;text-align:right;font-weight:700;font-size:16px;color:${PRIMARY};">#${orderKodi}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:14px;">Klienti</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${customerName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:${MUTED};font-size:14px;">Email</td>
          <td style="padding:4px 0;text-align:right;font-weight:600;">${customerEmail}</td>
        </tr>
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;margin:0 0 8px 0;">
      <thead>
        <tr style="background:${BG};">
          <th style="padding:10px 12px;text-align:left;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Produkti</th>
          <th style="padding:10px 12px;text-align:center;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Sasia</th>
          <th style="padding:10px 12px;text-align:right;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">Vlera</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    <div style="background:${BG};border-radius:12px;padding:14px 20px;margin:12px 0 0 0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-size:14px;color:${TEXT};font-weight:600;">Totali</td>
          <td style="text-align:right;font-size:20px;font-weight:800;color:${PRIMARY};">
            ${currency}${total.toFixed(2)}
          </td>
        </tr>
      </table>
    </div>
  `;

  const html = wrap(body, '#F59E0B', '🔔', `Porosi #${orderKodi} e Konfirmuar`, 'Nje klient konfirmoi porosine');

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER,
    to: to.join(', '),
    subject: `🔔 Porosi #${orderKodi} konfirmuar nga ${customerName} — ${currency}${total.toFixed(2)}`,
    html,
  });
}
