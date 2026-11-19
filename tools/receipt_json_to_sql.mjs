// Gemini のチャットで作ったレシートの JSON（P番号・M番号つき）から、DB に入れる SQL を作る。
// 使い方（プロジェクトの直下で）:
//    node tools/receipt_json_to_sql.mjs [JSON のフォルダ ...]   … 指定したフォルダ（複数可）から、1 つの SQL を作る
//    node tools/receipt_json_to_sql.mjs --all                    … tools/receipt_json の、すべての店舗フォルダ（_dup で終わるフォルダは除く）から、1 つの SQL を作る
//    node tools/receipt_json_to_sql.mjs --update --all           … 「更新モード」: レシートは入れず、すでに DB にある明細の「分類」だけを、JSON の番号で直す SQL（update.sql）を作る
//       ・同じ店・購入日・印字名・値段の明細が対象（自分のレシートだけ）。店名・購入日・値段・容量などは変えない
//       ・JSON に、使える商品番号・中分類番号が無い明細は、飛ばす（今の分類を、そのままにする）
//       ・新しい指示文で作り直した JSON で、まちがった分類を直すときに使う（入れ直しなので、レシートは消さない）
//  既定のフォルダ: tools/receipt_json/trial → 出力: tools/receipt_json/import.sql（Git には入れない）
//  ・今の指示文（11/19〜）の JSON は「M番号＋商品名（文字）」。商品名は、今の表で探すので、表が変わっても、ずれない（M番号は、下と同じく、指示文の版で読む）
//  ・P番号・M番号は、Gemini に貼った指示文の番号（既定: tools/gemini_chat_prompt.txt。JSON のフォルダに prompt.txt があれば、そちら）で、
//    カテゴリの名前に戻す。今のカテゴリ表の番号ではない（表が変わると番号がずれて、別の商品になってしまうため）。
//    その名前が今の表に無いときは、中分類まで（それも無ければ、アプリと同じ名前の一致 → 「未選択」）
//  ・カテゴリ表を更新して指示文を作り直す前に、入れていない JSON は、このツールで SQL にするか、
//    古い指示文を、そのフォルダの prompt.txt として置いておく
//  ・店名は、アプリと同じ辞書（normalizeStoreName）で、「チェーン名 支店名」にそろえる
//  ・SQL は、Supabase の SQL Editor で実行する。「ここにあなたのUID」を、自分のユーザー ID に直す
//  ・同じ店・同じ購入日・同じ合計金額のレシートが、すでにあれば、入れずに飛ばす（2 回実行しても二重にならない。フォルダをまたいでも、同じ）
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveItems, findProduct } from '../supabase/functions/parse-receipt/catalog.js';
import { normalizeStoreName } from '../src/utils/storeNameNormalizer.js';
import { CATEGORY_TREE } from '../src/constants/categoryData.js';

const baseDir = fileURLToPath(new URL('./receipt_json/', import.meta.url));
const updateMode = process.argv.includes('--update');
const out = join(baseDir, updateMode ? 'update.sql' : 'import.sql');

// ---- 読むフォルダ ----
const args = process.argv.slice(2).filter((a) => !a.startsWith('--') || a === '--all');
let dirs;
if (args.includes('--all')) {
  dirs = readdirSync(baseDir)
    .filter((name) => statSync(join(baseDir, name)).isDirectory() && !name.endsWith('_dup'))
    .sort((a, b) => a.localeCompare(b, 'ja'))
    .map((name) => join(baseDir, name))
    .filter((d) => readdirSync(d).some((f) => f.endsWith('.json')));
} else {
  const given = args.filter((a) => a !== '--all');
  dirs = given.length > 0 ? given : [join(baseDir, 'trial')];
}

// ---- Gemini に貼った指示文の番号（P番号・M番号）→ カテゴリの名前（フォルダごと）----
const defaultPromptPath = fileURLToPath(new URL('./gemini_chat_prompt.txt', import.meta.url));
const loadPrompt = (dir) => {
  const mids = new Map(); // 'M1' -> { main, category }
  const products = new Map(); // 'P1' -> { main, category, sub, product }
  const path = existsSync(join(dir, 'prompt.txt')) ? join(dir, 'prompt.txt') : defaultPromptPath;
  if (existsSync(path)) {
    let cur = null;
    readFileSync(path, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^【(M\d+) (.+?)>(.+)】$/);
      if (m) {
        cur = { main: m[2], category: m[3] };
        mids.set(m[1], cur);
        return;
      }
      const sub = line.match(/^ {2}(.+?): (P\d+ .+)$/);
      if (sub && cur) {
        sub[2].split(/、(?=P\d+ )/).forEach((part) => {
          const p = part.match(/^(P\d+) (.+)$/);
          if (p) products.set(p[1], { main: cur.main, category: cur.category, sub: sub[1], product: p[2] });
        });
      }
    });
  }
  return { mids, products };
};
const tablePaths = new Set();
const tableMids = new Set();
CATEGORY_TREE.forEach((top) =>
  top.categories.forEach((mid) => {
    tableMids.add(`${top.name}>${mid.name}`);
    (mid.subCategories || []).forEach((sub) => (sub.items || []).forEach((product) => tablePaths.add(`${top.name}>${mid.name}>${sub.name}>${product}`)));
  })
);
/**
 * JSON の答えを、カテゴリの名前に戻す。決められなければ、null（呼び出し側で、アプリと同じ名前の一致に任せる）
 *  ・今の形（11/19〜）: 中分類の M番号（指示文の版の番号）＋ 商品名（文字）。商品名は、今の表で探す（findProduct。表が変わっても、ずれない）
 *  ・古い形: P番号・M番号（指示文の版の番号）
 */
const resolveByPrompt = (prompt, item) => {
  const promptMid = prompt.mids.get(String(item.mid_code || '').trim()) || null;
  if (item.product_name) {
    const found = findProduct(promptMid, item.product_name);
    if (found) return { main_category: found.main, category: found.category, sub_category: found.sub, product_name: found.product };
    if (promptMid && tableMids.has(`${promptMid.main}>${promptMid.category}`)) {
      return { main_category: promptMid.main, category: promptMid.category, sub_category: null, product_name: null };
    }
    return null;
  }
  const p = prompt.products.get(String(item.product_code || '').trim());
  if (p && tablePaths.has(`${p.main}>${p.category}>${p.sub}>${p.product}`)) {
    return { main_category: p.main, category: p.category, sub_category: p.sub, product_name: p.product };
  }
  const mid = prompt.mids.get(String(item.mid_code || '').trim()) || (p ? { main: p.main, category: p.category } : null);
  if (mid && tableMids.has(`${mid.main}>${mid.category}`)) {
    return { main_category: mid.main, category: mid.category, sub_category: null, product_name: null };
  }
  return null;
};

const q = (value) => (value === null || value === undefined || value === '' ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const qOrEmpty = (value) => `'${String(value ?? '').replace(/'/g, "''")}'`;

const warnings = [];
const blocks = [];
const perFolder = [];
let receiptCount = 0;
let itemCount = 0;
let unselected = 0;
let skippedUnselected = 0;

for (const dir of dirs) {
  const folder = basename(dir);
  const prompt = loadPrompt(dir);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  let folderReceipts = 0;
  let folderItems = 0;
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      warnings.push(`${folder}/${file}: JSON として読めません（${e.message}）。tools/fix_receipt_json.mjs で直してください`);
      continue;
    }
    (data.receipts || []).forEach((r, index) => {
      const label = `${folder}/${file}${(data.receipts || []).length > 1 ? ` の ${index + 1} 枚目` : ''}`;
      if (!r.items || r.items.length === 0) {
        warnings.push(`${label}: 商品が 0 件のため、飛ばしました`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.purchase_date || '')) {
        warnings.push(`${label}: 購入日が YYYY-MM-DD ではないため、飛ばしました（${r.purchase_date}）`);
        return;
      }
      // 番号は、指示文の番号で名前に戻す（アプリと同じ resolveItems は、今の表の番号なので、番号がずれる）。番号が使えないものだけ、resolveItems（名前の一致）に任せる
      const fallback = resolveItems({ items: r.items.map((i) => ({ ...i, product_code: null, mid_code: null, product_name: null })) }).items;
      const resolved = fallback.map((i, n) => ({ ...i, ...(resolveByPrompt(prompt, r.items[n]) || {}) }));
      const sum = resolved.reduce((s, i) => s + Number(i.price || 0), 0);
      const storeName = r.store_name ? normalizeStoreName(r.store_name) : '';
      resolved.forEach((i) => {
        if (!i.main_category) unselected += 1;
      });
      if (r.total != null && sum !== r.total) {
        warnings.push(`${label}: 商品の合計 ${sum} 円 ≠ レシートの合計 ${r.total} 円（参考: 単品価格・値引き・外税のため、合わないのが普通。差が大きいときだけ、読み落としを疑う）`);
      }
      if (updateMode) {
        // 更新モード: JSON の番号で、分類が決まった明細だけ、分類を直す。レシート・値段・容量などは、そのまま
        //  （番号が無い・使えない明細は、飛ばす。名前の一致だけで決めた、中分類までの推定で、今のより細かい分類を、粗くしないため）
        const rows = resolved
          .filter((i, n) => {
            const decided = !!resolveByPrompt(prompt, r.items[n]);
            if (!decided) skippedUnselected += 1;
            return decided;
          })
          .map((i) => `      (${qOrEmpty(i.item_name)}, ${Number(i.price) || 0}, ${q(i.main_category)}, ${q(i.category || '未選択')}, ${q(i.sub_category)}, ${q(i.product_name)})`);
        if (rows.length === 0) return;
        const stores = [...new Set([storeName, String(r.store_name || '').trim()])].map(qOrEmpty).join(', ');
        blocks.push(`  -- ${label}: ${storeName} ${r.purchase_date}（分類を直す ${rows.length} 件）
  with v(item_name, price, m, c, s, p) as (values
${rows.join(',\n')}
  )
  update public.receipt_items i
  set main_category = v.m, category = v.c, sub_category = v.s, product_name = v.p
  from public.receipts r, v
  where i.receipt_id = r.id and r.user_id = v_uid
    and r.store_name in (${stores}) and r.purchase_date = '${r.purchase_date}'
    and i.item_name = v.item_name and i.price = v.price;
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;
  if v_n = 0 then
    raise notice '見つかりませんでした（DB に、同じ店・購入日・印字名・値段の明細がありません）: ${label.replace(/'/g, "''")}';
  end if;`);
        receiptCount += 1;
        itemCount += rows.length;
        folderReceipts += 1;
        folderItems += rows.length;
        return;
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
      folderReceipts += 1;
      folderItems += resolved.length;
    });
  }
  perFolder.push({ folder, receipts: folderReceipts, items: folderItems, files: files.length });
}

const sql = updateMode
  ? `-- Gemini のチャットで作った JSON の番号で、すでに DB にある明細の「分類」だけを直す（tools/receipt_json_to_sql.mjs --update で作成）
--  使い方: 「ここにあなたのUID」を、自分のユーザー ID（Supabase の Authentication > Users の UID）に直して、SQL Editor で実行する
--  フォルダ ${perFolder.length} 個・レシート ${receiptCount} 枚・分類を直す明細 ${itemCount} 件（番号が無い・使えない ${skippedUnselected} 件は、飛ばした）
--  同じ店・購入日・印字名・値段の明細が対象。レシートは入れない。2 回実行しても、同じ結果になる
--  実行後、メッセージ（NOTICE）に、「更新した明細: ○ 件」と、DB に見つからなかったレシートが出る
do $$
declare
  v_uid uuid := 'ここにあなたのUID'::uuid;
  v_n integer;
  v_total integer := 0;
begin
${blocks.join('\n\n')}
  raise notice '更新した明細: % 件', v_total;
end $$;
`
  : `-- Gemini のチャットで作ったレシートを、DB に入れる（tools/receipt_json_to_sql.mjs で作成）
--  使い方: 「ここにあなたのUID」を、自分のユーザー ID（Supabase の Authentication > Users の UID）に直して、SQL Editor で実行する
--  フォルダ ${perFolder.length} 個・レシート ${receiptCount} 枚・商品 ${itemCount} 件。画像は入らない（画像なしのレシートになる）
--  同じ店・購入日・商品の合計のレシートが、すでに DB にあれば、飛ばす（飛ばしたものは、実行後のメッセージ「NOTICE」に出る）
do $$
declare
  v_uid uuid := 'ここにあなたのUID'::uuid;
  v_id public.receipts.id%type;
begin
${blocks.join('\n\n')}
end $$;
`;
writeFileSync(out, sql, 'utf8');

console.log(`SQL を作りました: ${out}（${(sql.length / 1024).toFixed(0)}KB）`);
perFolder.forEach((f) => console.log(`  ${f.folder}: ファイル ${f.files} 個 → レシート ${f.receipts} 枚 / 商品 ${f.items} 件`));
console.log(`合計: フォルダ ${perFolder.length} 個 / レシート ${receiptCount} 枚 / 商品 ${itemCount} 件 / カテゴリが「未選択」の商品 ${unselected} 件`);
warnings.forEach((w) => console.log(`★ ${w}`));
