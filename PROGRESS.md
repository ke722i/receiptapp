# 進捗メモ

最終更新: 2026-11-07

## やったこと
- レシート解析のタイムアウトを修正した（`supabase/functions/parse-receipt/handler.ts`）。
  - モデルの既定値を `gemini-3.6-flash` に変更した。
  - Gemini の待ち時間を 60 秒から 120 秒に延ばした。
  - 作業は `fujita` ブランチ（学校のPCでの修正 64ca695 の上）に載せた。
- 固定URLのサイトで動作を確認した（`main` をもとにした版。`GEMINI_MODEL` を読まない版でデプロイしたもの）。
  - 10 件のレシート: 正しく 10 件、約 30 秒。
  - 25 件のレシート: 25 件、11 秒。
- Gemini の API キーを新しく作り直した（チャットに貼ってしまったため）。
- CLAUDE.md に「作業の引き継ぎ」のルールを追加した。

## 分かったこと
- 新しいキー（`AQ.` で始まる）では `gemini-2.5-flash` は使えない（404: 新規ユーザーには提供しない）。
- 同じレシート 1 枚での比較（正解は 10 件）。
  - `gemini-3.5-flash-lite`: 6.3 秒、12 件で 2 件多い。
  - `gemini-3.6-flash`: 15.4 秒、10 件で一致。
- `gemini-2.5-flash` は 2026-12-01 に停止予定。
- 解析時間は商品数に比例していない（10 件で約 30 秒、25 件で 11 秒）。

## 途中のこと
- 以前のタイムアウトの原因は確定していない。学校のPCで `gemini-3.8-flash` に変えた版がデプロイされていて、それが遅かった可能性がある（3.8 の速度は未測定）。現在は解消している。
- `fujita` の版はまだデプロイしていない。Supabase のシークレットに `GEMINI_MODEL` が設定されているかも未確認。
- 25 件のレシートの内容（商品名と金額）が正しいかは未確認。
- 古い Gemini キーを AI Studio で削除したかは未確認。

## 次にやること
1. Supabase の Edge Functions → Secrets で `GEMINI_MODEL` を確認する。あれば削除するか `gemini-3.6-flash` にする。
2. `fujita` を GitHub に push し、`fujita` の状態で `npm.cmd run deploy-functions` を実行して、もう一度動作を確認する。
3. 古い Gemini キーが残っていれば、AI Studio で削除する。
4. 25 件のレシートの解析結果を、実物と見比べる。

## 注意点
- 作業は `fujita` ブランチで行う。`main` には学校のPCでの修正が入っていない。
- シークレット `GEMINI_MODEL` を設定すると、コードの既定値より優先される。
- API キーはチャットに貼らない。`GEMINI_API_KEY` は Supabase のシークレットで更新する（`.env` には入れない）。
- Edge Function を変更したら `npm.cmd run deploy-functions` でデプロイする。先に `npx.cmd supabase login` が必要。
- `npm run dev` では解析に失敗するとダミーデータが出る。確認は固定URLのサイトで行うと確実。
- タイムアウトした解析も、1 日 30 回の枠を 1 回消費する。
- Gemini の待ち時間は 150 秒未満にする（Edge Function は 150 秒応答がないと 504 になる）。
- 思考の量を減らす設定は試していない。今の速度で足りているので見送った。
