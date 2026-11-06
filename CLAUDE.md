# プロジェクト概要
レシートを撮影して商品ごとの購入価格を比較するWebアプリ（React + Vite + Supabase、レシート解析は Gemini API）。

# カテゴリの仕組み
- 4階層: 大分類 > 中分類 > 小分類 > 商品名。元データはExcelで、categoryData.js はそこから生成したもの。
- 同じ名前の商品が別の場所にあっても混ざらないよう、商品は名前ではなく経路 {main, category, sub, product} で区別する（productKey）。
- DBの receipt_items: main_category(大) / category(中) / sub_category(小) / product_name(商品名) / item_name(レシート印字名)。
- AIには M/P コードで答えさせ、コードから名前に戻している（supabase/functions/parse-receipt/catalog.js）。
- 商品を表に当てはめられなくても、中分類まで当てはまるならそこまで保存する。
- 値引きは「あり／なし」の表示だけ。比較は自分のレシートのみ。

# 注意
- .env は絶対に読まない・表示しない（APIキーが入っている）。
- 一部ファイル（categoryData.js の readings 部分など）は生成物。直接大きく編集せず、元のExcelから作り直す。

# レシート解析（Edge Function）
- Gemini の呼び出しは Edge Function（supabase/functions/parse-receipt）で行う。API キーとプロンプトをブラウザ側のコードや VITE_ の環境変数に戻さない。
- GEMINI_API_KEY は Supabase のシークレットに置く。ブラウザからは画像だけを送り、プロンプトは受け取らない（Gemini を別の用途に使われないため）。
- 解析は 1 ユーザー 1 日 30 回まで。上限は supabase/migrations の consume_receipt_parse_quota の v_limit にあり、この関数がログイン確認も兼ねる。
- supabase/functions/_shared/categoryData.js は src/constants/categoryData.js のコピー。直接編集しない。
- 関数を変更したら npm run deploy-functions でデプロイする（ユーザーの Supabase ログインが必要）。
- テスト用ダミーデータは開発中（npm run dev）だけ。本番の解析失敗はエラーを表示する。

## カテゴリ表の更新手順
「カテゴリ表を更新して」と頼まれたら、次を行う。
1. 今の src 内の categoryData.js の商品数とカテゴリ構成を控える
2. tools/categoryTable.xlsx を tools/parse_xlsx.py で読む
3. tools/gen_category_data.py と tools/readings.tsv で categoryData.js を作り、src 内の元の場所に置く
4. 漢字の項目で読み仮名が足りない警告が出たら、readings.tsv にひらがなで追加して、もう一度作る
5. Excel から消えた項目の読み仮名が readings.tsv に残っていないか調べ、残っていれば削除する。
   ただし、同じ名前の項目が Excel の別の場所にまだある場合は、その読み仮名は残す。
   削除したあとは、もう一度 categoryData.js を作り直す
6. 商品数、増減したカテゴリ・商品、追加した読み仮名、削除した読み仮名を報告する
7. npm run build が通ることを確認する
8. npm run sync-categories で Edge Function 用のコピーを更新し、ユーザーに npm run deploy-functions の実行を依頼する
   （デプロイするまで、AI の解析は古いカテゴリ表のまま）
- categoryData.js 以外の src のファイルは変更しない
- Excel は、ユーザーが同じ場所に上書きして更新する

# 店舗名
- store_name は「チェーン名 支店名」の形で保存する（例: 「ディオ 和泉店」）。正規化は storeNameNormalizer.js の normalizeStoreName。
- チェーン別の集計は、DB に列を足さず、読み出すときに getChainName(store_name) でチェーン名を割り出して行う（店舗別画面 storeList）。
- 以前に保存したデータはチェーン名だけだが、そのまま同じチェーンとして集計される。
- 新しいチェーンは storeNameNormalizer.js の STORE_RULES に追加する。辞書にないチェーンは、最初の空白までをチェーン名とみなす。

## 店名の追加手順
「店名を追加して」と頼まれたら、次を行う。
1. src/utils/storeNameNormalizer.js の STORE_RULES に { keywords: [...], normalized: '統一名' } を1行追加する
   - keywords はレシートに印字される表記（カタカナ・英字など）を入れる。大文字小文字・全角半角・空白や記号は区別されない
   - 「玉出」のような地名や短い語は、支店名と誤って一致するので keywords にしない
   - 別のお店として分けたい場合（例: ローソンストア100）は、別のルールにする
2. 追加した店名で normalizeStoreName を実行し、「チェーン名 支店名」になること、既存の店名の結果が変わらないことを確認する
3. npm run build が通ることを確認する
4. 追加した店名と、keywords に使った表記を報告する
- storeNameNormalizer.js 以外のファイルは変更しない

## モデルの使い分け
- 通常は Sonnet 5.5 Medium で作業する。
- 次のような作業では、Opus 5.5 Medium のほうが適していると判断したら、
  コードを変更する前に作業を止め、ユーザーに次の3点を伝えて、モデルの変更を求める。
  1. なぜ Opus 5.5 Medium が適していると判断したか（理由）
  2. 何の作業をする予定か
  3. 変更の方法（「/model」で Opus 5.5 Medium に切り替える）
  対象の例: 複数ファイルにまたがる設計変更、原因がはっきりしないバグの調査、
  データベース構造やセキュリティに関わる変更、大きなリファクタリング。
- ユーザーから「変更した」などの変更完了の連絡があるまで、コードの変更は再開しない。
  連絡を受けたら、止めていた作業から再開する。
- 軽い修正や文言の変更、すでに手順が決まっている作業（カテゴリ表の更新など）では、
  モデルの変更を求めず、そのまま進める。
