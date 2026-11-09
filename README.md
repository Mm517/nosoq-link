# منصة لينكات نَسَق — `nosoq-link`
`https://nosoq-link.vercel.app`

```
nosoq-link/
├─ index.html          ← لوحة بتعرض كل اللينكات (بحث + نسخ + عدّاد الضغطات)
├─ api/go.js           ← بيحل  /<code>  : OG tags للمعاينة + تحويل لصفحة المنتج
├─ vercel.json         ← rewrite:  /<code>  →  /api/go?code=<code>
├─ database/share_links.sql   ← الجدول + التريجرز (متطبّق فعلاً على مشروع nosoq)
└─ assets/favicon.svg
```

## إزاي بيشتغل
1. **تلقائي**: أي منتج أو متجر جديد بيتضاف في قاعدة البيانات، تريجر بيعملّه صف في `share_links` بكود عشوائي (8 حروف). التعديل في الاسم/الوصف/الصور بيحدّث اللينك.
2. زرار «شارك» في المتجر بيجيب الكود (`ensure_share_link`) ويبعت `https://nosoq-link.vercel.app/<code>`.
3. اللي بيفتح اللينك: `api/go.js` بيحوّله على `MAIN_ORIGIN` + مسار المنتج. واتساب/فيسبوك بيشوفوا العنوان والوصف والصورة.

## الإعدادات
- `MAIN_ORIGIN` (Environment Variable في Vercel، أو غيّره في أول `api/go.js`): دومين المتجر الفعلي. الافتراضي `https://nosoq-shop.vercel.app`.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY`: اختياريين (القيم الافتراضية لمشروع nosoq).

## النشر
Vercel: Framework = **Other** · Build Command فاضي · Output Directory فاضي.
