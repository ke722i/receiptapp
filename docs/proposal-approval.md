<!-- 「提案を確認して」「承認したものを追加して」と頼まれたとき、または、承認のやり方を聞かれたときに読む -->
# カテゴリの提案の承認・見送りと、表への反映

提案できるのは 3 種類（kind）: `category`（新しい中分類）／`sub`（今ある中分類に、新しい小分類）／`product`（今ある小分類に、新しい商品名）。
承認・見送りは、管理者（ユーザー）が、Supabase で `status` を直して行う（アプリの画面に、管理者用の機能は無い）。私は DB に接続できないので、SQL はユーザーに実行してもらう。

## 流れ（全体）
1. 承認待ちの一覧を見る → 2. 採否を決める → 3. 承認・見送りにする（Supabase） → 4. 承認したものを CSV で出す → 5. Excel に足す（私） → 6. `categoryData.js` を作り直す（私） → 7. デプロイ・公開（ユーザー）

## 1. 承認待ちの一覧（SQL Editor）
```sql
select kind, main_category, category, sub_category, product_name,
       count(*) as people, min(created_at) as first_at, string_agg(note, ' / ') as notes
from public.category_proposals
where status = 'pending'
group by 1, 2, 3, 4, 5
order by people desc, first_at;
```
同じ提案は、人数（people）でまとまる。

## 2. 採否の案（私が出す）
判断の目安: 今の表に近い分類・商品名が無いか（表記ゆれ・重複）、大分類・中分類・小分類の位置が合っているか、名前として適切か、人数、商品の例（note）。
ユーザーが決めたら、提案者へのメモ（`admin_note`。通知に出る）の文案を、私が作る。

## 3. 承認・見送りにする（ユーザー）
**方法 A: Table Editor**（件数が少ないとき）
`category_proposals` を開き、対象の行の `status` を `approved`（承認）か `rejected`（見送り）に直し、`admin_note` にメモを入れて保存する。`reviewed_at`（確認した日時）は、DB が自動で入れる。`status` と `admin_note` 以外の列は直さない。

**方法 B: SQL Editor**（同じ提案が複数人から出ているとき。まとめて直せる。`where` の条件は必ず付ける）
```sql
-- 承認（商品名の提案の例）
update public.category_proposals
set status = 'approved', admin_note = '次の更新で追加します'
where status = 'pending' and kind = 'product' and main_category = '冷凍'
  and category = '冷凍野菜・フルーツ・素材（未調理）' and sub_category = '冷凍フルーツ'
  and product_name = '冷凍ライチ';

-- 見送り（理由を admin_note に書くと、提案者の通知に出る）
update public.category_proposals
set status = 'rejected', admin_note = '似た商品がすでにあります（冷凍ぶどう）'
where status = 'pending' and kind = 'product' and main_category = '冷凍'
  and category = '冷凍野菜・フルーツ・素材（未調理）' and sub_category = '冷凍フルーツ'
  and product_name = '冷凍ライチ';
```
中分類・小分類の提案は、`kind` を `'category'` / `'sub'` にし、`product_name` の条件を外して、中分類・小分類の名前で絞る。

提案した人のホームの手紙に、黄色の丸が出て、通知画面に「承認」「見送り」と `admin_note` が出る（承認・見送りの両方）。
**承認しただけでは、全員の画面にも AI にも出ない**（下の手順で表に足すまで）。すでに「その他」で登録されたレシートも、自動では移らない。

## 4. 承認したものを CSV にする（ユーザー）
```sql
select kind, main_category, category, sub_category, product_name, note
from public.category_proposals where status = 'approved' order by reviewed_at;
```
結果を CSV でダウンロードし、`tools/proposals/` に置く（このフォルダの中身は、Git に入れない）。
前に反映したものも出てくるが、**すでにある名前は飛ばされる**ので、二重にならない。
置いたら、ユーザーが「承認したものを追加して」と言う。

## 5. Excel に足す（私）
```
python tools/apply_proposals.py "tools/proposals/ファイル名.csv"            # 何を足すかを表示（Excel は変えない）
python tools/apply_proposals.py "tools/proposals/ファイル名.csv" --apply    # Excel（tools/categoryTable.xlsx）に足す。元は tools/categoryTable.backup.xlsx
```
- `product`: 今ある小分類の、いちばん下に、商品名を足す。
- `sub`: 今ある中分類の、いちばん下に、小分類と商品名を足す。
- `category`: そのシートの、いちばん下に、中分類と、小分類・商品名を足す。
- **新しい中分類・小分類には、商品名が要る**。CSV に `products` 列（「、」区切り）を足して書く。商品名は、ユーザーが決めるか、私が、メモ（note）をもとに案を出して、了承を得る。商品名が無いものは、足さずに「★」で報告される。
- 番号と書式は、自動で付く。結合セルも、ずれない。
- Excel は、ユーザーが同じ場所に上書きして管理している。**私が足したあとは、最新のファイルを使うよう、ユーザーに伝える**（古いコピーで上書きすると、足した分が消える）。

## 6. `categoryData.js` を作り直す（私）
```
python tools/apply_proposals.py --rebuild
```
- `categoryData.js` の作成と、`npm run sync-categories`（Edge Function 用のコピー）まで行う。
- 「★よみがな未登録」の警告（漢字を含む商品名・分類名）が出たら、`tools/readings.tsv` に、ひらがなで足して（例: `冷凍白ぶどう<TAB>れいとうしろぶどう しろぶどう ぶどう`）、もう一度 `--rebuild`。
- `npm run build` が通ることを確認する。
- 増えた項目と、足した読み仮名を、ユーザーに報告する。

## 7. デプロイ・公開（ユーザー）
- `npm run deploy-functions`（AI の解析に反映）。
- コミット → PR → マージ（アプリの画面に反映）。
- すでに「その他」で登録したレシートを、新しい商品名に移したいときは、印字名で絞った `UPDATE` の SQL を、私が作る（ユーザーが実行）。

## 注意
- DB は `category_proposals`。登録は関数 `submit_category_proposal` からだけで、本人は自分の提案だけ読める。`status` を変えられるのは、管理者だけ。
- 承認待ちは 1 人 20 件まで。同じ人の同じ提案は重ねて出せない（別の人の同じ提案は、要望の多さとして数える）。
- 「その他」は、Excel（表）に入れない。
- 仕様の詳細は `docs/spec-category.md`。
