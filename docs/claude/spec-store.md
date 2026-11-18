<!-- CLAUDE.md から分けたもの。該当する作業をするときだけ読む -->
# 5. 店舗名
- store_name は「チェーン名 支店名」の形で保存する（例: 「ディオ 和泉店」）。正規化は storeNameNormalizer.js の normalizeStoreName。
- チェーン別の集計は、DB に列を足さず、読み出すときに getChainName(store_name) でチェーン名を割り出して行う（店舗別画面 storeList）。
- 以前に保存したデータはチェーン名だけだが、そのまま同じチェーンとして集計される。
- 店舗別一覧（storeList）: チェーンを押すと、店舗（store_name ごと。支店名つき）が開く（レシートごとではない）。店舗を押すと、店舗詳細（storeDetail。App の `selectedStoreName`）へ。開いたチェーンは App が持つ（`storeListOpenChain`。詳細から戻っても開いたまま）。
- 店舗詳細（`components/storeDetail`）: `fetchReceiptHistory` を店舗名で絞る。住所（`receipts.store_address`）・電話番号（`store_number`）は、新しいレシートから、空でない最初の値。**読み取れていなければ、その行ごと出さない**。電話番号は `tel:` のリンク。「店名」の行は無い。レシートは共通の行の部品（`components/receiptRowCard`。画像・購入日・点数・商品名の例。レシート一覧も同じ）。並び替え（`RECEIPT_SORT_OPTIONS`。レシート一覧と共通の 5 つ: 購入日（新しい順）・購入日（古い順）・登録日（新しい順）・登録日（古い順）・店舗名（あいうえお順）。`utils/receiptSort.js`。店舗詳細では、店舗名は同じなので、店舗名順は、購入日の新しい順のまま）。押すとレシート詳細（戻り先は店舗詳細）。
- レシートの一覧の読み込み（レシート一覧・店舗別一覧・店舗詳細。`utils/receiptCache.js` の `useReceiptHistory`）: `fetchReceiptHistory` は **画像 `image_url` を含めない**（1 枚 100〜300KB）。一覧は画面を開いているあいだ覚え、2 回目からはすぐ出す（5 分たったら裏で読み直す）。保存・編集・削除・分類の変更（`receiptDb.js` → `utils/receiptChanges.js` の `notifyReceiptsChanged`）、ログイン・ログアウト・アカウントの切り替えで捨てる。画像は `useReceiptImage`（行は画面に近づいたら、詳細はすぐ。`fetchReceiptImages` で 6 枚ずつまとめて読む。100 枚まで覚える）。新しく receipts を読む画面・書く関数を足すときは、これに合わせる。
- レシート詳細から戻ったとき: 並び替え（localStorage `receipt_app_receipt_sort`）・絞り込み・開いた行の位置を保つ（`utils/receiptListState.js`）。
- 新しいチェーンは storeNameNormalizer.js の STORE_RULES に追加する。辞書にないチェーンは、最初の空白までをチェーン名とみなす。
- 入力画面（レシートの確認・登録、レシート詳細の編集）では、店名（チェーン）と店舗名（支店）を別の枠で、同じ行に並べる（StoreNameFields）。
  DB には今までどおり 1 つの文字列「チェーン名 支店名」で保存する。分けるのは splitStoreName、つなぐのは joinStoreName。
  店名は辞書の名前を候補に出し、「AEON」などの表記は枠から出るときに辞書の名前にそろえる（canonicalChainName）。
- 初めて入力された店名・店舗名は、入力欄の右の赤い「!」で知らせる。押すと、枠の下に小さな黄色の吹き出しが重なって出る（もう一度押す・外側を押すと閉じる）。
  常に出る吹き出しは、レシート画像が見づらくなるため、やめた（ポップアップではない）。
  「知っている」名前 = 辞書の店名 ＋ 自分や共有している人のレシートにある店舗名（list_comparable_stores）。2 回目からは、自動入力でも手入力でも出ない。
  判定は src/utils/storeNotice.js、一覧の読み込みは useKnownStores。一覧を読み込めなかったときは、吹き出しを出さない。
