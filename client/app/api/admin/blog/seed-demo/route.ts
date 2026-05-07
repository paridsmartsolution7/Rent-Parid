import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getDb1 } from '../../../../lib/db';
import { isAdminRequest } from '../../../../lib/getAdminAuth';
import { ensureBlogTables } from '../../../../lib/blogSchema';

/**
 * One-shot demo seeder. Idempotent: only runs when the blog has zero posts
 * AND zero categories — so calling it again on a populated tenant is a no-op.
 *
 * Inserts three professional posts tailored to an organic-store audience plus
 * matching categories. Authored by "system" (operator/username left blank).
 */
const CATEGORIES = [
  { name: 'Shendet',   slug: 'shendet',   color: '#16A34A' },
  { name: 'Ushqyerja', slug: 'ushqyerja', color: '#0EA5E9' },
  { name: 'Receta',    slug: 'receta',    color: '#F59E0B' },
];

const POSTS = [
  {
    title: 'Pse te zgjedhim ushqimet organike: 5 perfitime shendetesore',
    slug: 'pse-te-zgjedhim-ushqimet-organike',
    category_slug: 'shendet',
    excerpt:
      'Nga me pak pesticide deri tek vlerat me te larta ushqyese, ja perse familjet ne mbare boten po kalojne tek ushqimi organik.',
    tags: ['organike', 'shendet', 'familje', 'bio'],
    title_size: 'xl',
    content_html: `
<p><strong>Ushqimi organik</strong> nuk eshte nje mode kalimtare — eshte nje zgjedhje e bazuar ne shkence qe ndikon direkt ne shendetin tend, ne mjedis dhe ne komunitetin lokal. Ne <em>Goodies Farm</em> punojme me fermere te vegjel Shqiptare per te te sjelle produktet me te mira te stineve.</p>

<h2>1. Me pak pesticide ne pjaten tende</h2>
<p>Studimet kane treguar se konsumi i rregullt i ushqimeve organike redukton ndjeshem mbetjet e pesticideve ne organizem brenda vetem <strong>1 jave</strong>. Per femijet, kjo eshte vecanerisht e rendesishme — sistemi i tyre nervor eshte ne zhvillim e siper.</p>

<h2>2. Vlera me te larta ushqyese</h2>
<p>Nje meta-analize e <a href="https://www.cambridge.org/core/journals/british-journal-of-nutrition" target="_blank" rel="noopener noreferrer">British Journal of Nutrition</a> ka treguar se frutat dhe perimet organike permbajne deri ne <strong>69% me shume antioksidante</strong> sesa ato te kultivuara me menyra konvencionale.</p>

<h3>Cfare permbajne me shume?</h3>
<ul>
  <li><strong>Polifenole</strong> — luftojne dem oksidativ ne qeliza</li>
  <li><strong>Vitamina C</strong> — perforcon sistemin imunitar</li>
  <li><strong>Magnez dhe zink</strong> — minerale qe shpesh mungojne ne diet</li>
</ul>

<h2>3. Mbeshtetje e fermereve lokale</h2>
<p>Kur blen organike nga <strong>Goodies Farm</strong>, paratet shkojne direkt tek <em>fermeret e vegjel Shqiptare</em>, jo tek korporata te medhaja. Kjo do te thote ekonomi me e shendetshme lokale dhe me pak transport — pra me pak emisione karboni.</p>

<blockquote>
  "Zgjedhja organike nuk eshte luksi — eshte mbeshtetje e atyre qe punojne me dashuri token tone."
</blockquote>

<h2>4. Shije me autentike</h2>
<p>Domatet e ferme<em>s</em> qe pjeken ne diell, jo ne magazinen e nje supermarketi, kane nje shije qe nuk mund te krahasohet. Provoji vete — nuk ka nevoje per shume erezat.</p>

<h2>5. Shendet me i mire afatgjate</h2>
<p>Konsumi i rregullt i ushqimeve te paperpunuara organike eshte i lidhur me:</p>
<ol>
  <li>Sistem imunitar me te forte</li>
  <li>Risk me te vogel per smundje kronike (zemer, diabet)</li>
  <li>Tretje me te mire dhe energji me konstante gjate dites</li>
</ol>

<hr />

<p><strong>Gati per te filluar?</strong> Shfleto kategorite tona te <a href="/shop" target="_blank" rel="noopener noreferrer">produkteve organike</a> ose merr nje sygjerim personal duke na <a href="/contact" target="_blank" rel="noopener noreferrer">kontaktuar</a>.</p>
    `.trim(),
  },
  {
    title: 'Vitamina D3: vitamin e diellit dhe perse na duhet ne dimer',
    slug: 'vitamina-d3-perfitime',
    category_slug: 'shendet',
    excerpt:
      'Mungesa e Vitamines D eshte nje nga mungesat me te perhapura ne Europe. Mesoni si ta merrni nga ushqimi, dielli dhe suplementet organike.',
    tags: ['vitamina-d', 'imunitet', 'dimer', 'shendet'],
    title_size: 'xl',
    content_html: `
<p>Vitamina <strong>D3 (kolekalciferol)</strong> nuk eshte thjesht "vitamine" — eshte nje hormon qe organizmi e prodhon kur lekura ekspozohet ne diell. Por sa prej nesh marrim ne te vertete sa duhet?</p>

<h2>Cfare ben Vitamina D3 ne trupin tend</h2>
<p>Vitamina D3 ka role kritike per:</p>
<ul>
  <li><strong>Sistemin imunitar</strong> — redukton frekuencen e infeksioneve respiratore</li>
  <li><strong>Shendetin e kockave</strong> — ndihmon thithjen e kalciumit</li>
  <li><strong>Humorin</strong> — mungesa lidhet me <em>depresionin sezonal</em></li>
  <li><strong>Forcen muskulore</strong> — rralle e diskutuar, por kritike per te moshuarit</li>
</ul>

<h2>Sa shqiptare kane mungese?</h2>
<p>Sipas raporteve te <a href="https://www.who.int/" target="_blank" rel="noopener noreferrer">OBSh-se</a>, mbi <strong>40% e popullsise se Mesdheut</strong> ka nivele te ulura te Vitamines D, vecanerisht ne muajt Tetor–Mars. Pse? Diku rreth 90% e Vitamines D vjen nga dielli, dhe ne dimer dielli ne Shqiperi nuk eshte mjaft i forte per ta sintetizuar.</p>

<h3>Burimet ushqyese me te mira</h3>
<table>
  <tr><th>Ushqimi</th><th>Sasia per 100g</th></tr>
  <tr><td>Mengjir (salmon, sardele)</td><td>400–800 IU</td></tr>
  <tr><td>Vez te ferme</td><td>40 IU</td></tr>
  <tr><td>Kerpurdha qe rriten ne diell</td><td>200–1000 IU</td></tr>
  <tr><td>Bulmet i pasuruar</td><td>120 IU per gote</td></tr>
</table>

<h2>Sa te marrim ne dite?</h2>
<p>Rekomandimi standard eshte <strong>600–800 IU/dite</strong> per te rriturit, por nese mungesa eshte e konfirmuar nga gjaku, mjeku mund te rekomandoj 2000–4000 IU/dite per disa muaj.</p>

<blockquote>
  Mos merr suplemente Vitamine D pa konsultim — doza e larte per kohe te gjate mund te shkaktoje toksicitet.
</blockquote>

<h2>Cfare gjeni tek Goodies Farm</h2>
<p>Ne dyqanin tone do te gjeni produkte natyrale te pasura me Vitamine D3:</p>
<ul>
  <li>Vez nga pula te lira (jo ne kafaze)</li>
  <li>Salmon i fresket nga Adriatiku</li>
  <li>Kerpurdha shitake te ferme me ekspozim diellor</li>
  <li>Suplemente <em>vegan-friendly</em> nga liken islandeze</li>
</ul>

<hr />

<p>Per nje plan personal, <a href="/contact" target="_blank" rel="noopener noreferrer">na kontaktoni</a> dhe nutricionistja jone do te te ndihmoje pa pagese.</p>
    `.trim(),
  },
  {
    title: 'Ushqyerja me stine: receta dhe perfitime per familjen',
    slug: 'ushqyerja-me-stine-perfitime',
    category_slug: 'ushqyerja',
    excerpt:
      'Te hash sipas stineve nuk eshte vetem trend — eshte menyra me e shendetshme, me e lire dhe me e shijshme. Ja si te filloni.',
    tags: ['stine', 'receta', 'ekonomi', 'shendetesore'],
    title_size: 'lg',
    content_html: `
<p>Imagjino te ndjesh shijen e nje <strong>domate te vertete</strong> ne mes te gushtit, jo nje qe ka udhetuar 3000km dhe eshte mbledhur jeshile. Ushqyerja sipas stineve eshte kthimi tek bazat — dhe trupi yt do ta vleresoj.</p>

<h2>Pse stinishmeria eshte e rendesishme</h2>
<ol>
  <li><strong>Vlera me te larta ushqyese</strong> — frutat e mbledhura ne pikun e pjekjes kane me shume vitamina</li>
  <li><strong>Kosto me e ulet</strong> — kur stineja te jep me shume, cmimi bie</li>
  <li><strong>Mbeshtetje e fermereve lokale</strong> — paratet ngelin ne komunitet</li>
  <li><strong>Me pak pesticide</strong> — me pak nevoje per ruajtje afatgjate</li>
</ol>

<h2>Cfare blejme cdo stine ne Shqiperi</h2>

<h3>Pranvere (Mars–Maj)</h3>
<p>Spinaqi i fresket, lakra jeshile, qepujkat, hudhrat e njoma, marathja, luledielli i njome — pjate me te lehta pas dimrit te rende.</p>

<h3>Vere (Qershor–Gusht)</h3>
<p>Domate, kastraveca, speca, patellxhane, fiq, pjepra, shalqi, kajsi, qershi — koha e shijes maksimale dhe e <em>imuninzimit natyror</em>.</p>

<h3>Vjeshte (Shtator–Nentor)</h3>
<p>Mollet, dardha, rrushi, kungulli, kerpurdhat, arrat, gestenjat — pasuri ne antioksidante per te perballuar dimrin qe vjen.</p>

<h3>Dimer (Dhjetor–Shkurt)</h3>
<p>Portokalle, mandarina, limona, lakra te bardha dhe jeshile, lulelakra, brokoli, panxhar — vitamina C dhe fibra qe na mbajne te shendetshem.</p>

<hr />

<h2>Recete e thjeshte: Sallate me stinen</h2>
<p>Marr cfare ke me te fresket nga ferma jote ose dyqani:</p>
<ul>
  <li>2 lugje vaj ulliri ekstra te virgjer</li>
  <li>1 luge limon te shtrydhur</li>
  <li>Krip te trashe deti, piper i sapobluar</li>
  <li>Erezat e stines (rigon, borzilok, marathja)</li>
</ul>

<p><strong>Hapi 1:</strong> Pri perimet ne mas teme te krahasueshme.<br />
<strong>Hapi 2:</strong> Perziej dressimin direkt mbi sallate.<br />
<strong>Hapi 3:</strong> Le 5 minuta para se ta sherbesh — shijesat balancohen.</p>

<blockquote>
  Sekreti i nje sallate te mire eshte cilesia e perberesve. Per kete arsye Goodies Farm zgjedh vetem furnizues qe respektojne stinen.
</blockquote>

<h2>Cfare jane <em>"super-foods"</em> e Shqiperise?</h2>
<p>Disa nga produktet me te vlefshme te kultivuara ne Shqiperi:</p>
<ul>
  <li><strong>Sherebela e Maleve</strong> — antibakteriale natyrore</li>
  <li><strong>Mjalti i akacieve</strong> — antioksidant i forte</li>
  <li><strong>Rrushi i zi i Beratit</strong> — i pasur me resveratrol</li>
  <li><strong>Vaji i ullirit te Vlores</strong> — yndyrnat me te mira "Mesdhetare"</li>
</ul>

<p>Te gjitha keto i gjeni ne <a href="/shop" target="_blank" rel="noopener noreferrer">dyqanin tone</a>, te mbledhura nga partnere te besueshem ne Shqiperi.</p>
    `.trim(),
  },
];

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const pool = await getDb1();
    await ensureBlogTables(pool);

    // Only short-circuit when posts already exist — categories are reused
    // by slug below, so re-running after a partial failure is safe.
    const existing = await pool.request().query(
      `SELECT (SELECT COUNT(*) FROM dbo.ecommerce_blog_posts) AS posts`
    );
    const posts = existing.recordset[0]?.posts ?? 0;
    if (posts > 0) {
      return NextResponse.json({
        success: false,
        message: `Seed nuk u ekzekutua: blog ka tashme ${posts} postime. Krijoji nga UI.`,
        skipped: true,
      });
    }

    // Insert (or reuse) categories — keyed by slug.
    const slugToId = new Map<string, number>();
    for (const c of CATEGORIES) {
      const found = await pool
        .request()
        .input('slug', sql.NVarChar(255), c.slug)
        .query(`SELECT id FROM dbo.ecommerce_blog_categories WHERE slug = @slug`);
      let id = found.recordset[0]?.id as number | undefined;
      if (!id) {
        const r = await pool
          .request()
          .input('name', sql.NVarChar(255), c.name)
          .input('slug', sql.NVarChar(255), c.slug)
          .input('color', sql.NVarChar(20), c.color)
          .query(`
            INSERT INTO dbo.ecommerce_blog_categories (name, slug, color)
            OUTPUT INSERTED.id
            VALUES (@name, @slug, @color)
          `);
        id = r.recordset[0]?.id;
      }
      if (id) slugToId.set(c.slug, id);
    }

    // Insert posts (published immediately)
    const insertedIds: number[] = [];
    for (const p of POSTS) {
      const r = await pool
        .request()
        .input('slug', sql.NVarChar(255), p.slug)
        .input('title', sql.NVarChar(500), p.title)
        .input('excerpt', sql.NVarChar(1000), p.excerpt)
        .input('content_html', sql.NVarChar(sql.MAX), p.content_html)
        .input('category_id', sql.Int, slugToId.get(p.category_slug) || null)
        .input('title_size', sql.NVarChar(20), p.title_size)
        .input('author_username', sql.NVarChar(255), 'system')
        .query(`
          INSERT INTO dbo.ecommerce_blog_posts
            (slug, title, excerpt, content_html, category_id,
             title_size, author_username, published, published_at)
          OUTPUT INSERTED.id
          VALUES
            (@slug, @title, @excerpt, @content_html, @category_id,
             @title_size, @author_username, 1, GETDATE())
        `);
      const id = r.recordset[0]?.id;
      insertedIds.push(id);
      for (const tag of p.tags) {
        await pool
          .request()
          .input('pid', sql.Int, id)
          .input('tag', sql.NVarChar(80), tag)
          .query(
            `INSERT INTO dbo.ecommerce_blog_post_tags (post_id, tag) VALUES (@pid, @tag)`
          );
      }
      await pool
        .request()
        .input('pid', sql.Int, id)
        .input('un', sql.NVarChar(255), 'system')
        .query(`
          INSERT INTO dbo.ecommerce_blog_post_history (post_id, action, username)
          VALUES (@pid, 'create', @un)
        `);
    }

    return NextResponse.json({
      success: true,
      categories: Array.from(slugToId.entries()).map(([slug, id]) => ({ slug, id })),
      posts: insertedIds,
    });
  } catch (error: any) {
    console.error('Error seeding demo blog:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Failed' },
      { status: 500 }
    );
  }
}
