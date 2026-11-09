/* ==========================================================================
   api/go.js — بيحل اللينك القصير  https://nosoq-link.vercel.app/<code>
   1) بيجيب بيانات اللينك من Supabase (جدول share_links).
   2) بيرجّع صفحة فيها OG tags (عنوان + وصف + صورة المنتج) عشان واتساب/فيسبوك/تيليجرام
      يعرضوا معاينة حلوة — الكراولرز مبتشغّلش JavaScript ولا بتتبع الـ redirect.
   3) المستخدم الحقيقي بيتحوّل فوراً لصفحة المنتج/المتجر على دومين المتجر.
   ========================================================================== */
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dbzqejwsivgndftfnezb.supabase.co';
/* anon key = مفتاح عام مخصص للمتصفح (محمي بـ RLS) — مش سر. */
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRienFlandzaXZnbmRmdGZuZXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5ODUwMzAsImV4cCI6MjEwNTU2MTAzMH0.QCY4799Pg_caHK5c0WmKat-Q78uiF3PT19IxAlFBuW4';
/* دومين المتجر الفعلي — غيّره هنا أو من Environment Variable اسمه MAIN_ORIGIN */
const MAIN_ORIGIN = (process.env.MAIN_ORIGIN || 'https://nosoq-shop.vercel.app').replace(/\/+$/, '');
const SITE_NAME = 'نَسَق';
const BOT_RE = /bot|crawl|spider|facebookexternalhit|whatsapp|telegram|twitter|slack|discord|preview|embed|linkedin|pinterest|skype|curl|wget/i;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const headers = { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY };

module.exports = async function handler(req, res) {
  const code = String((req.query && req.query.code) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  const fallback = () => { res.statusCode = 302; res.setHeader('Location', MAIN_ORIGIN + '/'); res.end(); };
  if (!code) return fallback();

  let row = null;
  try {
    const r = await fetch(SUPABASE_URL + '/rest/v1/share_links?select=code,kind,target_path,title,description,image_url&code=eq.' + encodeURIComponent(code) + '&limit=1', { headers });
    if (r.ok) { const j = await r.json(); row = j && j[0]; }
  } catch (_) { /* لو Supabase مردّش نرجع للمتجر */ }
  if (!row) return fallback();

  const target = MAIN_ORIGIN + encodeURI(row.target_path || '/');
  const ua = String(req.headers['user-agent'] || '');
  const isBot = BOT_RE.test(ua);

  if (!isBot) {   /* عدّاد الضغطات (من غير البوتات) */
    try { await fetch(SUPABASE_URL + '/rest/v1/rpc/share_link_click', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_code: code }) }); } catch (_) { /* تجاهل */ }
  }

  const title = (row.title ? row.title + ' | ' : '') + SITE_NAME;
  const desc = row.description || (row.kind === 'store' ? 'تسوّق من متجرنا على نَسَق' : 'اكتشف المنتج على نَسَق');
  const img = row.image_url && /^https?:\/\//i.test(row.image_url) ? row.image_url : '';
  const self = 'https://' + (req.headers['x-forwarded-host'] || req.headers.host || 'nosoq-link.vercel.app') + '/' + code;

  const html = '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(title) + '</title>' +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<meta name="robots" content="noindex">' +
    '<link rel="canonical" href="' + esc(target) + '">' +
    '<meta property="og:type" content="' + (row.kind === 'product' ? 'product' : 'website') + '">' +
    '<meta property="og:site_name" content="' + SITE_NAME + '">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta property="og:url" content="' + esc(self) + '">' +
    (img ? '<meta property="og:image" content="' + esc(img) + '"><meta name="twitter:image" content="' + esc(img) + '">' : '') +
    '<meta name="twitter:card" content="' + (img ? 'summary_large_image' : 'summary') + '">' +
    '<meta name="twitter:title" content="' + esc(title) + '"><meta name="twitter:description" content="' + esc(desc) + '">' +
    (isBot ? '' : '<meta http-equiv="refresh" content="0;url=' + esc(target) + '">') +
    '<style>body{font-family:system-ui,Tahoma,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f8fc;color:#1b2540}a{color:#2563c9}</style>' +
    '</head><body><p>جارٍ فتح الصفحة… <a href="' + esc(target) + '">اضغط هنا لو ماتحوّلتش</a></p>' +
    (isBot ? '' : '<script>location.replace(' + JSON.stringify(target) + ')</script>') +
    '</body></html>';

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', isBot ? 'public, s-maxage=300, stale-while-revalidate=3600' : 'no-store');
  res.end(html);
};
