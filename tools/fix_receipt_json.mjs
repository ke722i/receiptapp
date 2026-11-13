// Gemini のチャットが返した JSON の、よくある崩れを直す（```json の囲み、[cite: 1] の印、{"receipts":[…]} が何回も続く形）。
// 使い方（プロジェクトの直下で）: node tools/fix_receipt_json.mjs tools/receipt_json/ファイル名.json
//  → 同じファイルを、1 つの {"receipts":[…]} にまとめて上書きする。合計金額が合わないレシートも、画面に出す。
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('使い方: node tools/fix_receipt_json.mjs ファイル名.json');
  process.exit(1);
}

let text = readFileSync(file, 'utf8');
// ``` の行と、[cite: 数字] の印を取る
text = text
  .split('\n')
  .filter((line) => !/^\s*```/.test(line))
  .join('\n')
  .replace(/\[cite:[^\]]*\]/g, '');

// 文字列の外の { } の釣り合いで、いちばん外側のオブジェクトを順に取り出す
const blocks = [];
let depth = 0;
let start = -1;
let inString = false;
let escaped = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (inString) {
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (c === '"') inString = false;
    continue;
  }
  if (c === '"') inString = true;
  else if (c === '{') {
    if (depth === 0) start = i;
    depth += 1;
  } else if (c === '}') {
    depth -= 1;
    if (depth === 0) blocks.push(text.slice(start, i + 1));
  }
}

const receipts = [];
for (const block of blocks) {
  const obj = JSON.parse(block);
  (Array.isArray(obj.receipts) ? obj.receipts : [obj]).forEach((r) => receipts.push(r));
}

writeFileSync(file, `${JSON.stringify({ receipts }, null, 1)}\n`, 'utf8');
console.log(`${file}: ブロック ${blocks.length} 個 → レシート ${receipts.length} 枚`);
for (const r of receipts) {
  const sum = r.items.reduce((s, i) => s + Number(i.price || 0), 0);
  const note = sum === r.total ? '' : '  （参考）商品の合計とレシートの合計が違う: 単品価格・値引き・外税のため、普通';
  console.log(`  ${r.store_name} ${r.purchase_date}  商品 ${r.items.length} 件 / 合計 ${sum} / レシートの合計 ${r.total}${note}`);
}
