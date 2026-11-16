# 公開までの流れ（コミット・PR・マージ・デプロイ）

作業した内容を、公開サイト（resoku.pages.dev）に出すまでの手順です。

## 全体の流れ

| 手順 | やること | だれが |
|---|---|---|
| ① | 変更をコミットして、`fujita` ブランチに送る（push） | Claude（「コミットして」と言う） |
| ② | GitHub で、`main` への PR を作る | あなた |
| ③ | PR を `main` にマージする | あなた |
| ④ | 公開サイトが、自動で更新される（数分） | （自動） |
| ⑤ | 必要なら `npm run deploy-functions` を実行する | あなた |

## ① コミットして送る

Claude に、「**コミットして**」と言います。
- コミットの名前は、`26/11/16 変更の内容` の形で、Claude が付けます。
- そのまま、`fujita` ブランチに送られます。

## ② PR を作る

1. このリンクを開く: https://github.com/ke722i/receiptapp/compare/main...fujita
2. 「Create pull request」を押す
3. タイトルと説明を書く（Claude に、案を頼めます）
4. 作成する

## ③ マージする

PR の画面で、「Merge pull request」を押します。

## ⑤ `deploy-functions` が必要なとき

次のどれかを変えたときに、実行します。
- レシート解析の Edge Function（`supabase/functions/` の中）
- カテゴリ表（AI の解析に反映するため）

```
npm run deploy-functions
```

## DB（SQL）を変えたとき

- 新しい SQL ファイル（`supabase/migrations/`）がある変更は、**マージの前か同時に**、Supabase の SQL Editor で実行します。
- 実行する順番は、ファイル名の日付の順です。
- Claude が、実行する SQL と、順番を教えます。

## 確認すること

- マージのあと、公開サイトで、変えた機能が動くか確認します。
- スマホ（iPhone）では、ページを再読み込みしてください（古い画面が残ることがあります）。
