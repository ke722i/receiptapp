<!-- CLAUDE.md から分けたもの。該当する作業をするときだけ読む -->
# 7. 作業手順

## カテゴリ表の更新手順
「カテゴリ表を更新して」と頼まれたら、次を行う。
1. 今の src 内の categoryData.js の商品数とカテゴリ構成を控える
2. tools/categoryTable.xlsx を tools/parse_xlsx.py で読む
3. tools/gen_category_data.py と tools/readings.tsv で categoryData.js を作り、src 内の元の場所に置く
4. 漢字の項目で読み仮名が足りない警告が出たら、readings.tsv にひらがなで追加して、もう一度作る。
   警告は、商品名（★よみがな未登録（漢字を含む商品））と、分類名＝大・中・小分類（★よみがな未登録（漢字を含む分類名））の2種類。
   分類名の読みは、ホームの検索の「カテゴリ」で、ひらがなで探すために使う（「・」で区切った語ごとの読みを、空白で並べると、語の頭でも見つかる）
5. Excel から消えた項目（商品名・分類名）の読み仮名が readings.tsv に残っていないか調べ、残っていれば削除する。
   ただし、同じ名前の項目が Excel の別の場所にまだある場合は、その読み仮名は残す。
   削除したあとは、もう一度 categoryData.js を作り直す
6. 商品数、増減したカテゴリ・商品、追加した読み仮名、削除した読み仮名を報告する
7. npm run build が通ることを確認する
8. npm run sync-categories で Edge Function 用のコピーを更新し、ユーザーに npm run deploy-functions の実行を依頼する
   （デプロイするまで、AI の解析は古いカテゴリ表のまま）
- categoryData.js 以外の src のファイルは変更しない
- Excel は、ユーザーが同じ場所に上書きして更新する

## カテゴリの提案の承認手順
**docs/proposal-approval.md に移した**（「提案を確認して」「承認したものを追加して」と頼まれたら、そちらを読む）。

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
