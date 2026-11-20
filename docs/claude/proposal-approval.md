<!-- 【Claude 用】読むとき: 「提案を確認して」「承認したものを追加して」と頼まれたとき。人が読む手引きは docs/manual/proposal-approval.md -->
# カテゴリの提案: 承認・見送り・表への反映（Claude の作業手順）

## 前提（変えてはいけないこと）
- Claude は、集計のビューを、読み取り専用で調べられる（`node tools/db_query.mjs`。docs/manual/db-readonly.md）。それ以外の読み書きの SQL は、ユーザーが実行する。承認・見送りは、ユーザーが管理者画面で行う（Claude は行わない）。
- 提案の種類 `kind`: `category`（新しい中分類。小分類も任意）／`sub`（今ある中分類に新しい小分類）／`product`（今ある小分類に新しい商品名）。
- DB: テーブル `category_proposals`。登録は関数 `submit_category_proposal`（6 引数）だけ。`status` を変えられるのは管理者だけ（関数 `admin_decide_proposals`、判定 `is_app_admin`、表 `app_admins`）。
- 管理者画面: `src/components/adminProposals/adminProposals.jsx`、呼び出し `src/utils/adminDb.js`、CSV `src/utils/proposalCsv.js`。migrations: `20261113000000_category_proposals_product.sql`、`20261116000000_admin_proposals.sql`。
- 承認しただけでは、画面にも AI にも出ない。`tools/categoryTable.xlsx` に足し、`categoryData.js` を作り直し、ユーザーが `npm run deploy-functions` を実行するまで反映されない。
- 「その他」は Excel に入れない。既に「その他」で登録済みの明細は、ユーザーの端末が、表の変更を見つけたときに、確実なものだけ自動で移す（`src/utils/reassignOther.js`・`reassignRun.js`。AI は使わない）。管理者の作業は不要。「元に戻す」と「その他の商品を見直す」の画面あり。

## 依頼を受けたときの手順
1. **提案の確認を頼まれたとき**（「提案を確認して」）
   - ユーザーに、管理者画面（管理者のアカウントでログイン → 管理者ホーム → 「提案の承認」）の「承認待ち」を見るよう伝える。画面が使えない場合のみ、`docs/claude/proposal-approval.md` 末尾の予備 SQL を渡す。
   - 採否の案を出すときの観点: 表に同じ・似た名前がないか（表記ゆれ、重複）／大・中・小分類の位置が合っているか／名前として適切か／人数／商品の例（note）。
   - ユーザーが決めたら、提案者へのメモ（`admin_note`、通知に出る）の文案を渡す。
2. **反映を頼まれたとき**（「承認したものを追加して」）
   - `tools/proposals/` の CSV を探す（列: `kind, main_category, category, sub_category, product_name, note`。任意で `products`）。
   - `python tools/apply_proposals.py "<csv>"`（予定の表示。Excel は変えない）→ 結果をユーザーに報告し、了承を得る。
   - 新しい中分類・小分類は商品名が必須。CSV の `products` 列（「、」区切り）が空なら、足されず「★」で報告される。商品名はユーザーが決めるか、note を元に Claude が案を出して了承を得る。
   - `python tools/apply_proposals.py "<csv>" --apply`（Excel に足す。元は `tools/categoryTable.backup.xlsx`）。
   - `python tools/apply_proposals.py --rebuild`（`categoryData.js` 作成＋`npm run sync-categories`）。
   - 「★よみがな未登録」が出たら、`tools/readings.tsv` に「名前<TAB>ひらがな（空白区切りで複数可）」を足して `--rebuild` をやり直す。
   - `npm run build` が通ることを確認する。
   - 足した項目と読み仮名を報告する。ユーザーに `npm run deploy-functions` を依頼する。
   - 「その他」で登録済みのレシートを移すか確認する（移すときは、印字名で絞った UPDATE の SQL を渡す）。

## `apply_proposals.py` の動き
- `product`: 該当小分類の最下段に商品名を足す。`sub`: 該当中分類の最下段に小分類＋商品名。`category`: シート最下段に中分類＋小分類＋商品名。
- 番号・書式は自動（隣の行から書式を複写）。結合セルは行挿入に合わせてずらす。
- 名前の比較は `fold`（NFKC・記号除去・大小文字・ひらがなカタカナを区別しない）。既にある名前は飛ばす（再実行しても二重にならない）。商品名は、**同じ中分類の中（ほかの小分類も含む）**に同じ名前があれば飛ばす（レシート解析が「中分類＋商品名」で商品を決めるため。docs/claude/spec-parse.md）。
- Excel のシートは大分類ごと。列は `tools/parse_xlsx.py` と同じ読み方（先頭列を自動判定）。

## 注意
- Excel はユーザーが同じ場所に上書きして管理している。Claude が足したあとは、最新のファイルを使うよう伝える（古いコピーで上書きすると足した分が消える）。
- 承認待ちは 1 人 20 件まで。同じ人の同じ提案は重ねて出せない。
- 管理者にも、提案した人のユーザー ID は返さない（人数のみ）。

## 予備: Supabase で直接（管理者画面が使えないときだけ）
```sql
-- 承認待ちの一覧
select kind, main_category, category, sub_category, product_name,
       count(*) as people, min(created_at) as first_at, string_agg(note, ' / ') as notes
from public.category_proposals where status = 'pending' group by 1,2,3,4,5 order by people desc, first_at;
-- 承認済みを CSV 用に出す
select kind, main_category, category, sub_category, product_name, note
from public.category_proposals where status = 'approved' order by reviewed_at;
```
承認・見送りは Table Editor で `status`（`approved`/`rejected`）と `admin_note` を直す。複数人分は `update ... where status = 'pending' and kind = … and …`（`where` は必ず付ける）。
