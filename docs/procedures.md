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
「提案を確認して」「承認したものを追加して」と頼まれたら、次を行う（私は DB に接続できないので、SQL はユーザーに実行してもらう）。
1. ユーザーに、SQL Editor で承認待ちの一覧を出してもらう（SQL は migrations/20261113000000_category_proposals_product.sql の冒頭のコメント。商品名も含めて、同じ提案は人数でまとまる）
2. 一覧を見て、採否の案を出す。判断の目安: 今の表に近い分類が無いか（表記ゆれ・重複）、大分類・中分類の位置が合っているか、分類の名前として適切か、人数、商品の例（note）
3. ユーザーが決めたら、承認・見送りの SQL（同じ冒頭のコメントに例がある）と、提案者へのメモ（admin_note）の文案を渡す。実行はユーザーが行う
4. 承認した中分類・小分類に入れる**商品名**を決める（商品名の提案は、その名前を使う。表記だけ整えてよい）。ユーザーが決めるか、ユーザーの指示で、商品の例（note）をもとに私が案を出して、了承を得る
5. tools/categoryTable.xlsx に、カテゴリと商品名を足す（ユーザーの了承を得てから。Excel は、ユーザーが同じ場所に上書きして管理している）。
   **半自動のスクリプトがある**: `python tools/apply_proposals.py 提案.csv`（何を足すかを表示）→ 確認して `--apply`（Excel に足す。元は `tools/categoryTable.backup.xlsx` に控える）。
   提案.csv は、ユーザーが SQL Editor で、承認した提案を出して、CSV でダウンロードしたもの（SQL と列は、スクリプトの冒頭のコメント）。
   新しい中分類・小分類の商品名は、CSV の `products` 列（「、」区切り）に書いてから実行する（無いものは、足さずに報告される）。すでにある名前は飛ばす。
   漢字を含む商品名の読み仮名は readings.tsv へ（スクリプトの `--rebuild` の警告で分かる）
6. 「カテゴリ表の更新手順」を行う（`python tools/apply_proposals.py --rebuild` で、categoryData.js の作成と sync-categories。そのあと readings.tsv の追加、build、ユーザーに deploy-functions を依頼）
7. 追加したカテゴリ・商品名を報告し、すでに「その他」で登録されたレシートを移すかどうかを、ユーザーに確認する（移すときは、印字名で絞った UPDATE の SQL を渡す）

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
