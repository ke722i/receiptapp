# DB を、Claude が読み取り専用で調べる準備

Claude が見られるのは、集計（件数・人数）だけです。ユーザー ID・購入日・値段・画像は、見えません。書き込みもできません。

## 準備（1 回だけ）

1. Supabase の SQL Editor で、`supabase/migrations/20261120000000_analytics_readonly.sql` の中身を、全部貼って実行する
2. 同じ SQL Editor で、次を実行する（パスワードは、自分で考えた長いもの。**チャットに貼らない**）
   ```sql
   alter role claude_readonly with password 'ここに長いパスワード';
   ```
3. Supabase の画面の上の「Connect」→「Session pooler」の接続の文字列をコピーする
4. 文字列の `postgres.xxxx` の部分を `claude_readonly.xxxx` に、`[YOUR-PASSWORD]` を 2 のパスワードに置き換える
5. プロジェクトの直下に、`.db-readonly.url` というファイルを作り、4 の文字列を 1 行で保存する
6. ターミナルで `node tools/db_query.mjs zero` を実行して、結果が出れば完了

## 使い方

Claude に「DB を調べて」と頼むと、Claude が、次のコマンドで調べます。

- `node tools/db_query.mjs categories` → カテゴリごとの件数
- `node tools/db_query.mjs zero` → 登録が 0 件のカテゴリ
- `node tools/db_query.mjs unclassified` → 未選択・その他・商品名なしの件数
- `node tools/db_query.mjs unclassified-names` → 未選択などの印字名（多い順）
- `node tools/db_query.mjs stores` → 店舗名の件数と、表記ゆれの候補
- 末尾に `--test` で、テスト用アカウントだけ

## 注意

- `.db-readonly.url` は、Git に入りません。Claude も開きません。
- やめるときは、SQL Editor で `alter role claude_readonly nologin;` を実行する
- 調べたいことが増えたら、Claude が、集計のビューを足す SQL を作ります（実行は、あなた）
