<!-- CLAUDE.md から分けたもの。該当する作業をするときだけ読む -->
# 4. レシート解析（Edge Function）
- Gemini の呼び出しは Edge Function（supabase/functions/parse-receipt）で行う。API キーとプロンプトをブラウザ側のコードや VITE_ の環境変数に戻さない。
- GEMINI_API_KEY は Supabase のシークレットに置く。ブラウザからは画像だけを送り、プロンプトは受け取らない（Gemini を別の用途に使われないため）。
- Gemini が混み合っている（503 など）ときは、2 秒待って同じモデルでもう一度、それでもだめなら代わりのモデル（シークレット GEMINI_FALLBACK_MODELS、既定 gemini-3.8-flash）で試す。
  全体の待ち時間は 140 秒まで（Edge Function の上限 150 秒の内側）。すべてだめなら ai_busy（「AI が混み合っていて…」）を返す。原因はログの「receipt parse attempt」「receipt parse failed」で分かる。
- 解析は 1 ユーザー 1 日 30 回まで。上限は supabase/migrations の consume_receipt_parse_quota の v_limit にあり、この関数がログイン確認も兼ねる。
- supabase/functions/_shared/categoryData.js は src/constants/categoryData.js のコピー。直接編集しない。
- 関数を変更したら npm run deploy-functions でデプロイする（ユーザーの Supabase ログインが必要）。
- テスト用ダミーデータは開発中（npm run dev）だけ。本番の解析失敗はエラーを表示する。
- 解析できないとき（混雑・1 日の上限・通信の失敗など）は、画像確認のポップアップの「手動で入力する」から、空の確認画面で手で入力して登録できる（src/utils/manualReceipt.js）。
  確認画面には「＋ 商品を追加」と、選んだ商品の「削除」がある（AI の結果にも使える）。登録の前に、商品なし・印字名が空・値段 0 円の商品を止める。DB の変更なし。
- カテゴリの答えさせ方（`parse-receipt/catalog.js`。11/19〜）: 表は、中分類に M番号（58 個ほど）、商品は番号なしの名前だけ。AI は `mid_code`（M番号）と `product_name`（その中分類の商品名を、表の文字のまま）で答える。`findProduct` で、①その中分類の中の同じ名前（`foldName`: NFKC・空白・大小文字を無視）→ ②表全体で 1 か所だけの名前 → ③なければ中分類まで、の順に決める。前の P番号（1,161 個）で答えさせる形は、AI が近い番号の別の商品を選ぶずれが出たため、やめた（`product_code` は、古い JSON のために読むだけ）。商品名は、同じ中分類の中では重ならない（表を足すときも、同じ中分類に同じ名前を入れない）。JSON の取り込み（`tools/receipt_json_to_sql.mjs`）も、同じ `findProduct` を使う。
- 使用量の記録: 解析が成功するたびに、ログに「receipt parse usage (モデル名) prompt=… output=… thoughts=… total=… imageBase64Chars=…」が出る（数字だけ）。どこが重いか（指示文・カテゴリ表・画像・考えた分）を調べるために使う。
