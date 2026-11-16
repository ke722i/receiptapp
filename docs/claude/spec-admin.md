<!-- 【Claude 用】管理者の機能を直す・足すときに読む。人が読む手引きは docs/manual/admin.md -->
# 管理者の機能（仕様）

## 権限
- 管理者 = 表 `public.app_admins`（`user_id`）にあるアカウント。判定は `public.is_app_admin()`（security definer、`auth.uid()` で判定）。
- `app_admins`・`announcements` は anon/authenticated から直接読めない・書けない（RLS 有効・ポリシーなし・権限 revoke）。操作は `admin_*` 関数だけ。各関数の先頭で `is_app_admin()` を確かめ、違えば `not_admin`（42501）。
- 画面の出し分け（`isAdmin`）は見た目のためだけ。権限の本体は DB。
- 管理者に返すのは、数・ログイン ID（`auth.users.email` の @ より前）・設定だけ。レシートの中身（店・商品・値段・印字名）は返さない（RLS を緩めない、の基本ルールを守る）。

## migrations
- `20261116000000_admin_proposals.sql`: `app_admins`、`is_app_admin`、`admin_list_proposals(p_status)`、`admin_decide_proposals(p_ids, p_status, p_note)`。
- `20261116100000_admin_tools.sql`:
  - お知らせ: 表 `announcements`（title 1〜60、body ≤500、active、created_at、updated_at）。`list_announcements()`（authenticated、active のみ、updated_at 降順 5 件）、`admin_list_announcements()`、`admin_save_announcement(p_id, p_title, p_body, p_active)`（p_id null で作成。無い id は `announcement_not_found`、不正は `announcement_invalid`）、`admin_delete_announcement(p_id)`。
  - 利用状況: `admin_stats()` → users, users_7d, receipts, receipts_7d, items, parses_today（日本時間）, share_users, proposals_pending/approved/rejected（1 行）。
  - アカウント: `admin_list_users()` → user_id, login_id, created_at, last_sign_in_at, is_admin, is_test_account, share_prices, receipt_count, parses_today, parses_7d, parses_total（`receipt_parse_usage` から。新しい順）。
  - `admin_set_test_account(p_user, p_value)`（`user_settings` を upsert。share_prices は変えない）、`admin_set_admin(p_user, p_value)`（自分を外すと `admin_self`）。存在しないユーザーは `user_invalid`。
- テスト: PGlite で検証済み（scratchpad の admin_test / admin_tools_test。リポジトリには無い）。

## 画面（src）
- `App.jsx`: ログイン成功時に `checkIsAdmin()` → 管理者なら `adminHome`、それ以外は `home`。ホームを開くたびに `isAdmin` と、お知らせ（`fetchAnnouncements`）を読み直す。画面: `adminHome`／`adminProposals`／`adminAnnouncements`／`adminUsers`（戻るは `adminHome`）。
- `components/adminHome/adminHome.jsx`（利用状況・入口・「一般の画面を見る」・ログアウト）、`adminAnnouncements.jsx`、`adminUsers.jsx`（自分の管理者のチェックは無効。管理者の付け外しは ConfirmDialog のあと。テスト用はすぐ）。
- `components/adminProposals/adminProposals.jsx`（提案の承認。docs/claude/proposal-approval.md）。
- `components/home/home.jsx`: ハンバーガーメニューの「管理者」→「管理者ホーム」（`isAdmin` のときだけ）。ユーザー欄と設定のユーザー情報に「管理者」の印（`.admin-badge`）。公開中のお知らせを、ホームの上に出す（`.announcement-card`、本文は改行そのまま）。
- `utils/adminDb.js`（rpc の呼び出しと、エラーの日本語化）、`utils/announcements.js`（公開中のお知らせ、閉じた印は `receipt_app_closed_announcements_<userId>` に `id:updated_at` で保存 → 直されたら再表示）。
