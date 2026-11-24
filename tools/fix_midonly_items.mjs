// 中分類までしか決まっていない明細（商品名が空）を、印字名の文字の一致で、商品まで決める SQL を作る。
//  例: 「ロールケーキコーヒー」（冷蔵 > チルド飲料・チルドスイーツ。商品名が空）→ 商品「ロールケーキ」
//
// 使い方（プロジェクトの直下で。docs/manual/db-readonly.md の準備が済んでいること）:
//   npm run fix-products
//   → 直る印字名の一覧（前 → 後・件数）を表示し、tools/receipt_json/midonly_fix.sql を作る
//   → 一覧を見て、直したくない行は、SQL から消し、Supabase の SQL Editor で実行する
//
// 決め方（間違いを減らすため、確かなものだけ）:
//   ・明細の中分類（AI が決めたもの）の中だけで、探す（別の中分類の商品名には、当てない）
//     例: 「ブルーベリーマシュマロ」（菓子）に、果物の「ブルーベリー」は、当てない
//   ・印字名に含まれる商品名（3 文字以上。全角半角・ひらがなカタカナ・空白記号を無視）のうち、いちばん長いものが、1 つに決まるときだけ
//   ・商品名が空でない明細・「その他」・未選択は、対象外
//   ・SQL は、同じ印字名・同じ中分類で、商品名が空の明細だけを更新する（2 回実行しても、同じ結果）
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CATEGORY_TREE } from '../supabase/functions/_shared/categoryData.js';
import { foldName } from '../supabase/functions/parse-receipt/catalog.js';

const MIN_LEN = 3;
// 確認して、文字の一致では、正しくないと分かったもの（商品名が、別の意味で、印字名に入っているだけ）。増えたら、ここに足す
const EXCLUDE_NAMES = new Set([
  'キムチ鍋＆もつ鍋', // 「キムチ」鍋であって、漬物のキムチではない
  'ハウス柚子こしょう', // 「こしょう」（胡椒）ではなく、柚子こしょう
  'カーシャンプー 1000ml', // 車用で、ヘアケアのシャンプーではない
].map((n) => n.normalize('NFKC')));
const urlFile = fileURLToPath(new URL('../.db-readonly.url', import.meta.url));
const connectionString = process.env.DB_READONLY_URL || (existsSync(urlFile) ? readFileSync(urlFile, 'utf8').trim() : '');
if (!connectionString) {
  console.error('接続の設定がありません。docs/manual/db-readonly.md の手順で、.db-readonly.url を作ってください。');
  process.exit(1);
}

// ひらがな→カタカナ（読み方の違いを、そろえる）
const kata = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const fold = (s) => kata(foldName(s)).replace(/[・･\-ー_()（）[\]【】「」『』.,、。:;!！?？*＊]/g, '');

// 中分類ごとの商品（3 文字以上）
const byMid = new Map();
CATEGORY_TREE.forEach((t) => t.categories.forEach((m) => {
  const list = [];
  (m.subCategories || []).forEach((s) => (s.items || []).forEach((p) => {
    const key = fold(p);
    if (key.length >= MIN_LEN) list.push({ key, sub: s.name, product: p });
  }));
  byMid.set(`${t.name}>${m.name}`, list);
}));

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
let rows;
try {
  await client.connect();
  await client.query('set default_transaction_read_only = on');
  rows = (await client.query(`
    select item_name, main_category, category, sum(items)::int as n
    from analytics.unclassified_item_names
    where product_name is null and category is not null and category not in ('未選択', 'その他')
      and main_category is not null and main_category <> 'その他' and coalesce(sub_category, '') <> 'その他'
    group by 1, 2, 3`)).rows;
} finally {
  await client.end().catch(() => {});
}

const fixes = [];
rows.forEach((r) => {
  if (EXCLUDE_NAMES.has(String(r.item_name).normalize('NFKC'))) return;
  const list = byMid.get(`${r.main_category}>${r.category}`);
  if (!list) return;
  const name = fold(r.item_name);
  const hits = list.filter((p) => name.includes(p.key));
  if (hits.length === 0) return;
  const longest = Math.max(...hits.map((h) => h.key.length));
  const best = [...new Map(hits.filter((h) => h.key.length === longest).map((h) => [`${h.sub}>${h.product}`, h])).values()];
  if (best.length !== 1) return; // 候補が複数: 決めない
  fixes.push({ ...r, sub: best[0].sub, product: best[0].product });
});

console.log(`中分類までの印字名: ${rows.length} 種類 → 商品まで決まるもの: ${fixes.length} 種類（${fixes.reduce((a, f) => a + f.n, 0)} 件）`);
fixes.sort((a, b) => b.n - a.n || a.item_name.localeCompare(b.item_name, 'ja'));
fixes.forEach((f) => console.log(`  ${f.item_name}  [${f.category}]  →  ${f.sub} > ${f.product}（${f.n} 件）`));
if (fixes.length === 0) process.exit(0);

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const sql = `-- 中分類までの明細を、印字名の一致で、商品まで決める（tools/fix_midonly_items.mjs で作成）
--  同じ印字名・同じ中分類で、商品名が空の明細だけを更新する。2 回実行しても、同じ結果。直したくない行は、消してから実行する
with v(item_name, main_category, category, sub_category, product_name) as (values
${fixes.map((f) => `  (${q(f.item_name)}, ${q(f.main_category)}, ${q(f.category)}, ${q(f.sub)}, ${q(f.product)})`).join(',\n')}
)
update public.receipt_items i
set sub_category = v.sub_category, product_name = v.product_name
from v
where i.item_name = v.item_name and i.main_category = v.main_category and i.category = v.category
  and i.product_name is null;
`;
const out = fileURLToPath(new URL('./receipt_json/midonly_fix.sql', import.meta.url));
writeFileSync(out, sql, 'utf8');
console.log(`\n書き出しました: ${out}`);
