// Gemini のチャットで作ったレシートの JSON（P番号・M番号つき）から、DB に入れる SQL を作る。
// 使い方（プロジェクトの直下で）: node tools/receipt_json_to_sql.mjs [JSON のフォルダ]
//  既定のフォルダ: tools/receipt_json/trial → 出力: tools/receipt_json/import.sql（Git には入れない）
//  ・P番号・M番号は、アプリと同じ処理（catalog.js の resolveItems）で、カテゴリの名前に戻す（表に無い番号は「未選択」）
//  ・店名は、アプリと同じ辞書（normalizeStoreName）で、「チェーン名 支店名」にそろえる
//  ・SQL は、Supabase の SQL Editor で実行する。「ここにあなたのUID」を、自分のユーザー ID に直す
//  ・同じ店・同じ購入日・同じ合計金額のレシートが、すでにあれば、入れずに飛ばす（2 回実行しても二重にならない）
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveItems } from '../supabase/functions/parse-receipt/catalog.js';
import { normalizeStoreName } from '../src/utils/storeNameNormalizer.js';

const dir = process.argv[2] || fileURLToPath(new URL('./receipt_json/trial', import.meta.url));
const out = fileURLToPath(new URL('./receipt_json/import.sql', import.meta.url));

const q = (value) => (value === null || value === undefined || value === '' ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const qOrEmpty = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
const warnings = [];
const blocks = [];
let receiptCount = 0;
let itemCount = 0;
let unselected = 0;

for (const file of files) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (e) {
    warnings.push(`${file}: JSON として読めません（${e.message}）。tools/fix_receipt_json.mjs で直してください`);
    continue;
  }
  (data.receipts || []).forEach((r, index) => {
    const label = `${file}${(data.receipts || []).length > 1 ? ` の ${index + 1} 枚目` : ''}`;
    if (!r.items || r.items.length === 0) {
      warnings.push(`${label}: 商品が 0 件のため、飛ばしました`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.purchase_date || '')) {
      warnings.push(`${label}: 購入日が YYYY-MM-DD ではないため、飛ばしました（${r.purchase_date}）`);
      return;
    }
    const resolved = resolveItems({ items: r.items }).items;
    const sum = resolved.reduce((s, i) => s + Number(i.price || 0), 0);
    const storeName = r.store_name ? normalizeStoreName(r.store_name) : '';
    resolved.forEach((i) => {
      if (!i.main_category) unselected += 1;
    });
    if (r.total != null && sum !== r.total) {
      warnings.push(`${label}: 商品の合計 ${sum} 円 ≠ レシートの合計 ${r.total} 円（参考: 単品価格・値引き・外税のため、合わないのが普通。差が大きいときだけ、読み落としを疑う）`);
    }
    const items = resolved
      .map((i) => `      (v_id, ${qOrEmpty(i.item_name)}, ${q(i.main_category)}, ${q(i.category || '未選択')}, ${q(i.sub_category)}, ${q(i.product_name)}, ${Number(i.price) || 0}, ${i.is_discount ? 'true' : 'false'}, ${q(i.volume)})`)
      .join(',\n');
    blocks.push(`  -- ${label}: ${storeName} ${r.purchase_date}（商品 ${resolved.length} 件、合計 ${sum} 円）
  if exists (
    select 1 from public.receipts r
    where r.user_id = v_uid and r.store_name = ${qOrEmpty(storeName)} and r.purchase_date = '${r.purchase_date}'
      and (select coalesce(sum(i.price), 0) from public.receipt_items i where i.receipt_id = r.id) = ${sum}
  ) then
    raise notice '飛ばしました（同じレシートがあります）: ${label.replace(/'/g, "''")}';
  else
    insert into public.receipts (user_id, store_name, store_address, store_number, purchase_date)
    values (v_uid, ${qOrEmpty(storeName)}, ${qOrEmpty(r.store_address)}, ${qOrEmpty(r.store_number)}, '${r.purchase_date}')
    returning id into v_id;
    insert into public.receipt_items (receipt_id, item_name, main_category, category, sub_category, product_name, price, is_discount, volume) values
${items};
  end if;`);
    receiptCount += 1;
    itemCount += resolved.length;
  });
}

const sql = `-- Gemini のチャットで作ったレシートを、DB に入れる（tools/receipt_json_to_sql.mjs で作成）
--  使い方: 「ここにあなたのUID」を、自分のユーザー ID（Supabase の Authentication > Users の UID）に直して、SQL Editor で実行する
--  レシート ${receiptCount} 枚・商品 ${itemCount} 件。画像は入らない（画像なしのレシートになる）
do $$
declare
  v_uid uuid := 'ここにあなたのUID'::uuid;
  v_id public.receipts.id%type;
begin
${blocks.join('\n\n')}
end $$;
`;
writeFileSync(out, sql, 'utf8');

console.log(`SQL を作りました: ${out}`);
console.log(`レシート ${receiptCount} 枚 / 商品 ${itemCount} 件 / カテゴリが「未選択」の商品 ${unselected} 件`);
warnings.forEach((w) => console.log(`★ ${w}`));
