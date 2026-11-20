// 集計だけを、読み取り専用で調べる（開発者・Claude 用）
//  接続するのは、読み取り専用のロール claude_readonly（supabase/migrations/20261120000000_analytics_readonly.sql）。
//  読めるのは、スキーマ analytics の集計のビューだけ（ユーザー ID・購入日・値段は入っていない）。
//
// 準備（1 回だけ。手順は docs/manual/db-readonly.md）:
//  プロジェクトの直下に .db-readonly.url（Git に入れない）を作り、接続の文字列を 1 行で書く。
//  このファイルは、このツールだけが読む（中身を表示しない。Claude も開かない）。
//
// 使い方（プロジェクトの直下で）:
//  node tools/db_query.mjs categories        … カテゴリごとの件数（中分類まで）
//  node tools/db_query.mjs zero              … 登録が 0 件の中分類・小分類（今のカテゴリ表と比べる）
//  node tools/db_query.mjs unclassified      … 未選択・その他・商品名なしの件数（中分類ごと）
//  node tools/db_query.mjs unclassified-names … 未選択・その他・商品名なしの印字名（多い順）
//  node tools/db_query.mjs stores            … 店舗名ごとの件数と、表記ゆれの候補
//  node tools/db_query.mjs sql "select …"    … analytics のビューに、自由に問い合わせる（読み取りだけ）
//  node tools/db_query.mjs check             … 接続の設定を確かめる（パスワードは表示しない）
//  末尾に --test を付けると、テスト用アカウントだけ。--general で、テスト用以外だけ（既定は全部）
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CATEGORY_TREE } from '../supabase/functions/_shared/categoryData.js';
import { normalizeStoreName, splitStoreName, joinStoreName } from '../src/utils/storeNameNormalizer.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const URL_FILE = `${ROOT}.db-readonly.url`;

const args = process.argv.slice(2);
const scope = args.includes('--test') ? 'test' : args.includes('--general') ? 'general' : 'all';
const rest = args.filter((a) => !a.startsWith('--'));
const [command, ...params] = rest;
const scopeWhere = scope === 'test' ? 'where is_test' : scope === 'general' ? 'where not is_test' : '';

const connectionString = process.env.DB_READONLY_URL || (existsSync(URL_FILE) ? readFileSync(URL_FILE, 'utf8').trim() : '');
if (!connectionString) {
  console.error('接続の設定がありません。docs/manual/db-readonly.md の手順で、.db-readonly.url を作ってください。');
  process.exit(1);
}

// 接続の設定の確かめ（パスワードは表示しない。長さと、URL で問題になる記号があるかだけ）
if (command === 'check') {
  try {
    const u = new URL(connectionString);
    const raw = connectionString.replace(/^[^:]+:\/\/[^:]+:/, '').replace(/@[^@]*$/, '');
    console.log(`ユーザー: ${decodeURIComponent(u.username)}`);
    console.log(`ホスト: ${u.hostname}  ポート: ${u.port || '(なし)'}  DB: ${u.pathname.slice(1)}`);
    console.log(`パスワード: ${decodeURIComponent(u.password).length} 文字`);
    if (/[[\]]/.test(raw)) console.log('  ⚠ パスワードの部分に [ ] が残っています（[YOUR-PASSWORD] のかっこも消す）');
    if (/[@#/?%:\s]/.test(raw)) console.log('  ⚠ パスワードに @ # / ? % : や空白が入っています。URL では使えないので、英数字だけのパスワードにし直してください');
    if (!decodeURIComponent(u.username).startsWith('claude_readonly.')) console.log('  ⚠ ユーザーは「claude_readonly.（プロジェクトの文字）」の形にしてください');
    if (!u.hostname.includes('pooler.supabase.com')) console.log('  ⚠ Session pooler の文字列ではないようです');
  } catch {
    console.log('接続の文字列の形が、正しくありません（postgresql://ユーザー:パスワード@ホスト:ポート/postgres の形）');
  }
  process.exit(0);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });

const table = (rows, cols) => {
  if (!rows.length) {
    console.log('（0 件）');
    return;
  }
  const keys = cols || Object.keys(rows[0]);
  const width = keys.map((k) => Math.min(40, Math.max(String(k).length, ...rows.map((r) => String(r[k] ?? '').length))));
  const line = (vals) => vals.map((v, i) => String(v ?? '').slice(0, 40).padEnd(width[i])).join(' | ');
  console.log(line(keys));
  console.log(width.map((w) => '-'.repeat(w)).join('-+-'));
  rows.forEach((r) => console.log(line(keys.map((k) => r[k]))));
};

const run = async () => {
  await client.connect();
  await client.query('set default_transaction_read_only = on');
  const q = async (sql, values) => (await client.query(sql, values)).rows;
  console.log(`対象: ${scope === 'test' ? 'テスト用アカウントだけ' : scope === 'general' ? 'テスト用以外' : '全アカウント'}\n`);

  switch (command) {
    case 'categories': {
      table(await q(`select main_category as 大分類, category as 中分類, sum(items)::int as 件数, max(users)::int as 人数_最大
        from analytics.category_counts ${scopeWhere} group by 1, 2 order by 1, 2`));
      break;
    }
    case 'zero': {
      const rows = await q(`select main_category, category, sub_category, product_name, sum(items)::int as n from analytics.category_counts ${scopeWhere} group by 1, 2, 3, 4`);
      const mids = new Set(rows.map((r) => `${r.main_category}>${r.category}`));
      const subs = new Set(rows.map((r) => `${r.main_category}>${r.category}>${r.sub_category}`));
      const prods = new Set(rows.map((r) => `${r.main_category}>${r.category}>${r.sub_category}>${r.product_name}`));
      const zMid = [];
      const zSub = {};
      let totalSub = 0;
      let totalProd = 0;
      let zProd = 0;
      CATEGORY_TREE.forEach((t) => t.categories.forEach((m) => {
        const mk = `${t.name}>${m.name}`;
        if (!mids.has(mk)) zMid.push(mk);
        (m.subCategories || []).forEach((s) => {
          totalSub += 1;
          if (!subs.has(`${mk}>${s.name}`)) (zSub[mk] = zSub[mk] || []).push(s.name);
          (s.items || []).forEach((p) => {
            totalProd += 1;
            if (!prods.has(`${mk}>${s.name}>${p}`)) zProd += 1;
          });
        });
      }));
      const totalMid = CATEGORY_TREE.reduce((a, t) => a + t.categories.length, 0);
      console.log(`登録が 0 件の中分類: ${zMid.length} / ${totalMid}`);
      zMid.forEach((x) => console.log(`  ・${x}`));
      console.log(`\n登録が 0 件の小分類: ${Object.values(zSub).flat().length} / ${totalSub}`);
      Object.entries(zSub).forEach(([k, v]) => console.log(`  ・${k}: ${v.join('、')}`));
      console.log(`\n登録が 0 件の商品: ${zProd} / ${totalProd}`);
      break;
    }
    case 'unclassified': {
      const rows = await q(`select main_category as 大分類, category as 中分類, sum(items)::int as 全体, sum(unselected)::int as 未選択,
          sum(other)::int as その他, sum(no_product)::int as 商品名なし
        from analytics.unclassified_counts ${scopeWhere} group by 1, 2
        having sum(unselected) + sum(other) + sum(no_product) > 0 order by 4 desc, 5 desc, 6 desc`);
      const total = rows.reduce((a, r) => ({ u: a.u + r.未選択, o: a.o + r.その他, n: a.n + r.商品名なし }), { u: 0, o: 0, n: 0 });
      const all = await q(`select coalesce(sum(items), 0)::int as n from analytics.unclassified_counts ${scopeWhere}`);
      console.log(`全体 ${all[0].n} 件のうち: 未選択 ${total.u}・その他 ${total.o}・商品名なし ${total.n}\n`);
      table(rows);
      break;
    }
    case 'unclassified-names': {
      table(await q(`select item_name as 印字名, coalesce(category, '未選択') as 中分類, coalesce(product_name, '') as 商品名,
          sum(items)::int as 件数, max(users)::int as 人数
        from analytics.unclassified_item_names ${scopeWhere} group by 1, 2, 3 order by 4 desc, 1 limit 200`));
      break;
    }
    case 'stores': {
      const rows = await q(`select store_name, sum(receipts)::int as n, max(users)::int as users from analytics.store_name_counts ${scopeWhere} group by 1 order by 1`);
      table(rows.map((r) => ({ 店舗名: r.store_name ?? '（空）', 件数: r.n, 人数: r.users })));
      // アプリの辞書・入力欄と同じ形にそろえたときに、変わるもの
      const fix = rows
        .filter((r) => r.store_name && r.store_name !== '店舗名未登録')
        .map((r) => {
          const { chain, branch } = splitStoreName(normalizeStoreName(r.store_name));
          return { before: r.store_name, after: joinStoreName(chain, branch), n: r.n };
        })
        .filter((x) => x.after && x.after !== x.before);
      console.log(`\n表記ゆれの候補（そろえると変わるもの）: ${fix.length} 件`);
      fix.forEach((x) => console.log(`  ${x.before}  →  ${x.after}（${x.n} 件）`));
      if (fix.length) console.log('  → 直すときは、tools/fix_store_names.mjs で SQL を作る');
      break;
    }
    case 'sql': {
      const sql = params.join(' ');
      if (!/^\s*(select|with)\b/i.test(sql)) throw new Error('select（または with）で始まる問い合わせだけ使えます。');
      table(await q(sql));
      break;
    }
    default:
      console.log('使い方: node tools/db_query.mjs categories | zero | unclassified | unclassified-names | stores | sql "select …"  [--test | --general]');
  }
};

run()
  .catch((error) => {
    // 接続の文字列（パスワードを含む）は、表示しない
    console.error('エラー:', String(error.message || error).replace(/postgres(ql)?:\/\/\S+/g, '(接続の文字列)'));
    process.exitCode = 1;
  })
  .finally(() => client.end().catch(() => {}));
