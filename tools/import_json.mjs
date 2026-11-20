// Gemini のチャットで作ったレシートの JSON を、DB に入れる SQL にするまでを、1 つのコマンドで行う。
//
// 使い方（プロジェクトの直下で）:
//   node tools/import_json.mjs            … tools/receipt_json/ の JSON を、直して・SQL にして・UID を入れる
//   node tools/import_json.mjs --done     … 取り込みが終わったあと。JSON と SQL を、misc/取り込み・移行（実行済み）/ に移す
//   オプション: --chunk 45（SQL を分ける枚数。既定 45）／ --uid <UID>（取り込み先の UID を、その場で指定）
//
// 準備（1 回だけ）: プロジェクトの直下に、ファイル .import-uid を作り、取り込み先のユーザー ID（UID）を 1 行で書く。
//   （Supabase の Authentication > Users の UID。Git に入らない）
//
// やること:
//   1. JSON が崩れていたら、直す（fix_receipt_json.mjs。直す前の元ファイルは、misc/JSON元ファイル_日付/ に残す）
//   2. SQL を作る（receipt_json_to_sql.mjs。レシート 45 枚ごとに分ける。重複・分類・店名は、いつもの規則）
//   3. SQL の「ここにあなたのUID」を、UID に書き換える
//   4. SQL を、Supabase の SQL Editor で、import_1.sql から順に実行する（これだけは、あなたが行う）
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const JSON_DIR = join(ROOT, 'tools', 'receipt_json');
const UID_FILE = join(ROOT, '.import-uid');
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }).slice(5); // 11-21
const MISC_DONE = join(ROOT, 'misc', '取り込み・移行（実行済み）');

const listJson = () => readdirSync(JSON_DIR).filter((f) => f.endsWith('.json'));
const listSql = () => readdirSync(JSON_DIR).filter((f) => /^import(_\d+)?\.sql$/.test(f));
const run = (script, scriptArgs) => spawnSync(process.execPath, [join(ROOT, 'tools', script), ...scriptArgs], { cwd: ROOT, encoding: 'utf8' });

// ---------- 終わったあと: 移す ----------
if (args.includes('--done')) {
  const files = [...listJson(), ...listSql()];
  if (files.length === 0) {
    console.log('移すファイルは、ありません。');
    process.exit(0);
  }
  const dest = join(MISC_DONE, `JSON_${today}`);
  mkdirSync(dest, { recursive: true });
  files.forEach((f) => renameSync(join(JSON_DIR, f), join(dest, f)));
  console.log(`${files.length} 個を、次に移しました（次回、二重に取り込まれないように）:\n  ${dest}`);
  process.exit(0);
}

// ---------- UID ----------
const uid = (flag('--uid') || (existsSync(UID_FILE) ? readFileSync(UID_FILE, 'utf8').trim() : '')).trim();
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
  console.error('取り込み先の UID が、ありません（または、形が違います）。');
  console.error('  プロジェクトの直下に、.import-uid というファイルを作り、Supabase の Authentication > Users の UID を、1 行で書いてください。');
  console.error('  （または、node tools/import_json.mjs --uid xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx）');
  process.exit(1);
}

const files = listJson();
if (files.length === 0) {
  console.error('tools/receipt_json/ に、JSON がありません。');
  process.exit(1);
}

// ---------- 1. 崩れた JSON を直す ----------
const broken = files.filter((f) => {
  try {
    JSON.parse(readFileSync(join(JSON_DIR, f), 'utf8'));
    return false;
  } catch {
    return true;
  }
});
if (broken.length > 0) {
  const backup = join(ROOT, 'misc', `JSON元ファイル_${today}`);
  mkdirSync(backup, { recursive: true });
  files.forEach((f) => copyFileSync(join(JSON_DIR, f), join(backup, f)));
  let failed = 0;
  broken.forEach((f) => {
    const r = run('fix_receipt_json.mjs', [join(JSON_DIR, f)]);
    if (r.status !== 0) {
      failed += 1;
      console.error(`直せませんでした: ${f}\n${r.stderr || r.stdout}`);
    }
  });
  console.log(`崩れていた JSON: ${broken.length} 個 → 直しました${failed ? `（直せなかった ${failed} 個）` : ''}。元のファイルは、misc/JSON元ファイル_${today}/ にあります。`);
  if (failed) process.exit(1);
}

// ---------- 2. SQL を作る ----------
for (const old of listSql()) renameSync(join(JSON_DIR, old), join(JSON_DIR, `前回_${old}`)); // 前の SQL は、上書きしない（名前を変えて残す）
const chunk = flag('--chunk') || '45';
const r = run('receipt_json_to_sql.mjs', ['--chunk', chunk, JSON_DIR]);
if (r.status !== 0) {
  console.error(r.stderr || r.stdout);
  process.exit(1);
}
process.stdout.write(r.stdout);

// ---------- 3. UID を入れる ----------
const sqls = listSql();
sqls.forEach((f) => {
  const p = join(JSON_DIR, f);
  const text = readFileSync(p, 'utf8');
  if (!text.includes('ここにあなたのUID')) return;
  writeFileSync(p, text.replaceAll('ここにあなたのUID', uid), 'utf8');
});

console.log(`\n--- 次にやること ---`);
console.log(`1. Supabase の SQL Editor で、次の SQL を、この順番で、1 つずつ実行します（UID は入れてあります）:`);
sqls.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).forEach((f) => console.log(`     tools/receipt_json/${f}`));
console.log(`2. 終わったら、次を実行します（JSON と SQL を、次回、二重にならないように移します）:`);
console.log(`     node tools/import_json.mjs --done`);
