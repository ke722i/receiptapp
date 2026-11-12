// アプリの解析と同じ指示文・カテゴリ表（番号つき）を、Gemini のチャットに貼る文字ファイルに書き出す。
// 使い方（プロジェクトの直下で）: node tools/export_gemini_prompt.mjs
//  → tools/gemini_chat_prompt.txt ができる（Git には入れない）。番号は、アプリと同じ表から作るので、
//    返ってきた JSON の P番号・M番号は、私（Claude）が、名前に戻せる。カテゴリ表を更新したら、作り直す。
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PROMPT_TEXT } from '../supabase/functions/parse-receipt/catalog.js';

const out = fileURLToPath(new URL('./gemini_chat_prompt.txt', import.meta.url));

const FORMAT = `

【出力の形（JSON だけを返す。説明文は不要）】
画像が 1 枚でも複数枚でも、次の形にする（レシート 1 枚につき 1 要素。画像の順に並べる）。
{"receipts":[
  {
    "store_name": "…", "store_address": null, "store_number": null,
    "purchase_date": "YYYY-MM-DD",
    "total": レシートに印字された合計金額（数値。読めなければ null）,
    "items": [
      {"item_name": "…", "price": 198, "is_discount": false, "volume": null, "product_code": "P12", "mid_code": "M3"}
    ]
  }
]}
- 値引き行（「値引」「-50」など）は、独立した商品にせず、直前の商品の is_discount を true にする（price は値引き前の金額のまま）。
- 軽減税率の印（※）などの記号は、item_name に含めない。
- 小計・合計・お預り・お釣り・税の行は、商品に含めない。

【読み落としを防ぐ（必ず守る）】
- 商品の行を、上から順に、1 行も飛ばさずに読む。長いレシートでも、途中でやめない。
- 返す前に、items の price（値引きは引いた額）の合計を計算し、レシートの小計（外税なら税抜きの合計、内税なら合計）と合うか確かめる。
  合わなければ、読み落とし・読み違いを探して直してから返す。それでも合わなければ、その商品の行に "check": true を付ける。
`;

writeFileSync(out, `${PROMPT_TEXT}${FORMAT}`, 'utf8');
console.log(`書き出しました: ${out}`);
