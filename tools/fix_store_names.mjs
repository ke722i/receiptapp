// DB に入っている店舗名を、アプリと同じ辞書（normalizeStoreName）でそろえる SQL を作る。
//  例: 「TRIAL 阪南店」→「トライアル 阪南店」（辞書に入る前の保存や、手入力の表記ゆれ）
//
// 使い方（プロジェクトの直下で）:
//  A. DB から直接（おすすめ。docs/manual/db-readonly.md の準備が済んでいるとき）
//       node tools/fix_store_names.mjs --from-db
//     → 直る店舗名の一覧（前 → 後・件数）を表示し、tools/receipt_json/store_names.fix.sql を作る
//  B. CSV から
//       1. Supabase の SQL Editor で、次を実行して、結果を CSV で保存する（列: store_name, n）
//            select store_name, count(*) as n from public.receipts group by store_name order by store_name;
//       2. node tools/fix_store_names.mjs 保存したCSV
//          → 同じフォルダに「<CSV名>.fix.sql」を作る
//  どちらも: 一覧を見て、直してよいものだけにしたいときは、不要な行を .fix.sql から消し、
//  .fix.sql を Supabase の SQL Editor で実行する
//
//  ・直すのは receipts.store_name と、マイ店舗（my_stores.store_name。同じ名前がすでにあるときは、飛ばす）
//  ・店舗名が変わらないもの・「店舗名未登録」・空は、対象外
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { normalizeStoreName, splitStoreName, joinStoreName } from '../src/utils/storeNameNormalizer.js';

const fromDb = process.argv.includes('--from-db');
const file = fromDb ? null : process.argv[2];
if (!fromDb && !file) {
  console.error('使い方: node tools/fix_store_names.mjs --from-db   または   node tools/fix_store_names.mjs 店舗名のCSV（列: store_name, n）');
  process.exit(1);
}

// DB から、店舗名と件数を読む（読み取り専用の窓口。tools/db_query.mjs と同じ接続）
const readFromDb = async () => {
  const urlFile = fileURLToPath(new URL('../.db-readonly.url', import.meta.url));
  const connectionString = process.env.DB_READONLY_URL || (existsSync(urlFile) ? readFileSync(urlFile, 'utf8').trim() : '');
  if (!connectionString) {
    console.error('接続の設定がありません。docs/manual/db-readonly.md の手順で、.db-readonly.url を作ってください。');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false }, statement_timeout: 15000 });
  try {
    await client.connect();
    await client.query('set default_transaction_read_only = on');
    const res = await client.query('select store_name, sum(receipts)::int as n from analytics.store_name_counts group by store_name order by store_name');
    return [['store_name', 'n'], ...res.rows.map((r) => [r.store_name ?? '', String(r.n)])];
  } finally {
    await client.end().catch(() => {});
  }
};

// CSV を読む（先頭行は見出し。"…" で囲まれた値・"" のエスケープに対応）
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
};

const rows = fromDb ? await readFromDb() : parseCsv(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const header = rows.shift().map((h) => h.trim().toLowerCase());
const nameCol = header.indexOf('store_name');
const countCol = header.indexOf('n');
if (nameCol < 0) {
  console.error('CSV に store_name の列がありません。');
  process.exit(1);
}

const q = (v) => `'${String(v).replace(/'/g, "''")}'`; // SQL の文字列
const changes = [];
rows.forEach((r) => {
  const before = (r[nameCol] ?? '').trim();
  if (!before || before === '店舗名未登録' || before === 'null') return;
  // ①辞書で、チェーン名をそろえる ②店名と店舗名に分けて、アプリの入力欄と同じ形につなぎ直す
  //   （全角・半角の違い（「（」と「(」）や、空白の重なりも、そろう。辞書にない店名も対象）
  const { chain, branch } = splitStoreName(normalizeStoreName(before));
  const after = joinStoreName(chain, branch);
  if (after && after !== before) changes.push({ before, after, n: countCol >= 0 ? r[countCol] : '' });
});

if (changes.length === 0) {
  console.log('直す店舗名は、ありませんでした。');
  process.exit(0);
}

console.log(`直る店舗名: ${changes.length} 件`);
changes.forEach((c) => console.log(`  ${c.before}  →  ${c.after}${c.n ? `  （${c.n} 件）` : ''}`));

const sql = [
  '-- 店舗名をそろえる（tools/fix_store_names.mjs で作成）。直したくない行は、消してから実行する',
  '-- 先に、「前」の名前が、意図したものか確認する',
  'begin;',
  '',
  ...changes.flatMap((c) => [
    `-- ${c.before} → ${c.after}${c.n ? `（${c.n} 件）` : ''}`,
    `update public.receipts set store_name = ${q(c.after)} where store_name = ${q(c.before)};`,
    `update public.my_stores m set store_name = ${q(c.after)} where m.store_name = ${q(c.before)}`,
    `  and not exists (select 1 from public.my_stores x where x.user_id = m.user_id and x.store_name = ${q(c.after)});`,
    '',
  ]),
  'commit;',
  '',
].join('\n');

const out = fromDb ? fileURLToPath(new URL('./receipt_json/store_names.fix.sql', import.meta.url)) : file.replace(/\.csv$/i, '') + '.fix.sql';
writeFileSync(out, sql, 'utf8');
console.log(`\n書き出しました: ${out}`);
