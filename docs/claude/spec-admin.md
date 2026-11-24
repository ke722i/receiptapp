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
  - お知らせ: 表 `announcements`（title 1〜60、body ≤500、active、level `low`/`mid`/`high`（既定 mid）、ends_at（null = 期限なし）、show_on_login、created_at、updated_at。level 以降は `20261117000000_announcement_levels.sql`）。`list_announcements()`（authenticated、active かつ期限内、level ごとに updated_at 降順 low 30・mid 3・high 5 件）、`list_login_announcements()`（anon も可。active・show_on_login・期限内、3 件。返すのは id/title/body/level/ends_at/updated_at だけ）、`admin_list_announcements()`、`admin_save_announcement(p_id, p_title, p_body, p_active, p_level, p_ends_at, p_show_on_login)`（後ろ 3 つは省略可。p_id null で作成。無い id は `announcement_not_found`、不正は `announcement_invalid`、high で期限なしは `announcement_ends_required`、公開で期限が過去は `announcement_expired`）、`admin_delete_announcement(p_id)`。
  - 利用状況: `admin_stats()` → users, users_7d, receipts, receipts_7d, items, parses_today（日本時間）, share_users, proposals_pending/approved/rejected（1 行）。
  - アカウント: `admin_list_users()` → user_id, login_id, created_at, last_sign_in_at, is_admin, is_test_account, share_prices, receipt_count, parses_today, parses_7d, parses_total（`receipt_parse_usage` から。新しい順）。
  - `admin_set_test_account(p_user, p_value)`（`user_settings` を upsert。share_prices は変えない）、`admin_set_admin(p_user, p_value)`（自分を外すと `admin_self`）。存在しないユーザーは `user_invalid`。
- テスト: PGlite で検証済み（scratchpad の admin_test / admin_tools_test。リポジトリには無い）。
- `20261124000000_notice_states.sql`（11/24〜）: 表 `notice_states`（user_id, kind `read`/`closed`/`confirmed`, key ≤200、PK (user_id, kind, key)。表は直接読み書き不可）。`list_notice_states()`（自分の分、古い順）、`set_notice_states(p_kind, p_keys text[], p_on)`（1 回 500 件まで。種類ごとに新しい 1000 件だけ残す）。アプリは `utils/noticeSync.js`: 端末の控え（`receipt_app_read_notices_*`・`closed_announcements_*`・`confirmed_announcements_*`）を、ログイン中にホーム・通知の画面を開いたとき・前面に戻ったときに DB の内容で上書き（送信中の変更は重ねる）。端末ごとに初回だけ、端末の記録を DB に足す（印 `receipt_app_notice_synced_<userId>`）。SQL 未実行のときは、端末だけで動く。
- `20261124100000_user_prefs.sql`（11/24〜）: 表 `user_prefs`（user_id, name, value jsonb, PK (user_id, name)。name は `favorites`／`search_history`／`proposal_tip`／`reassign_fp`／`reassign_skip`／`reassign_runs` だけ。1 つ 200KB まで。表は直接読み書き不可）。`list_user_prefs()`、`set_user_pref(p_name, p_value)`（同じ name は置き換え）。アプリは `utils/userPrefs.js`: 変えたとき DB へ送り（`favorites.js`・`reassignOther.js`・ホームの検索履歴・お知らせの印）、`syncUserPrefs` で、ホーム・通知の画面を開いたとき・前面に戻ったときに、端末の控えを DB の内容で上書き（送信中の値は優先。DB に無く端末にあるものは DB に足す）。自動移動（`runAutoReassign`）は、先に同期してから動かす。ホームの検索履歴・お知らせの印は、`prefsVersion` で読み直す。これで、端末だけに覚えるものは無い（テーマ・並び替え・自動ログインの設定は、端末の設定なので端末のまま）。

- `20261124200000_category_suggestions.sql`（11/24〜）: `suggest_categories(p_item_name)`（authenticated。編集画面の「印字名からの候補」。ほかの人の直し方は、自分以外の 2 人以上が同じものだけ。ユーザー ID・ほかの人の印字名は返さない。表は直接読めないまま）。詳しくは spec-category.md。PGlite で検証済み（scratchpad の pgtest/suggest_test.mjs）。

## 画面（src）
- `App.jsx`: ログイン成功時に `checkIsAdmin()` → 管理者なら `adminHome`、それ以外は `home`。ホームを開くたびに `isAdmin` を読み直す。お知らせ（`fetchAnnouncements`）は、ログイン中（login/register 以外）に 30 秒ごと（画面が前面のとき）・前面に戻ったとき・ホームを開いたときに読み直す。mid → ホームのスライド、low・mid → 通知の画面（`utils/notices.js` の `buildNoticeItems`。key は `a:id:updated_at`、mid は `noRead` で未読に数えない）、high → `components/announcementPopup`（OK を押した印は `receipt_app_confirmed_announcements_<userId>`）。ログイン画面は `list_login_announcements` を表示。画面: `adminHome`／`adminProposals`／`adminAnnouncements`／`adminUsers`（戻るは `adminHome`）。
- `components/adminHome/adminHome.jsx`（利用状況・入口・「一般の画面を見る」・ログアウト）、`adminAnnouncements.jsx`、`adminUsers.jsx`（自分の管理者のチェックは無効。管理者の付け外しは ConfirmDialog のあと。テスト用はすぐ）。
- `components/adminProposals/adminProposals.jsx`（提案の承認。docs/claude/proposal-approval.md）。
- `components/settings/settings.jsx`: 「メニュー」の「管理者ホーム」（`isAdmin` のときだけ。11/19 にホームのハンバーガーメニューを廃止し、下のタブ `components/tabBar` に変えたため、設定へ移した）。設定のユーザー情報に「管理者」の印（`.admin-badge`）。`components/home/home.jsx`:公開中のお知らせを、ホームの上に出す（`.announcement-card`、本文は改行そのまま）。
- `utils/adminDb.js`（rpc の呼び出しと、エラーの日本語化）、`utils/announcements.js`（公開中のお知らせ、閉じた印は `receipt_app_closed_announcements_<userId>` に `id:updated_at` で保存 → 直されたら再表示）。

## ログイン状態（11/19〜。`src/utils/authSession.js`）
- ログイン状態は Supabase が localStorage に保存する。App は `'boot'` から始まり、`restoreSession()` でログイン状態があればホーム（管理者は管理者ホーム）へ。画面の更新ではログアウトしない。
- ログアウトはボタンのときだけ `signOutHere()`（`supabase.auth.signOut({ scope: 'local' })`。以前は画面を戻すだけで、ログイン状態が残っていた）。`SIGNED_OUT` を受けたらログイン画面へ。
- ログイン画面の「自動ログイン」（`receipt_app_auto_login`、初期オン）: オフなら sessionStorage の印（`receipt_app_session_alive`）が無いとき（タブを閉じたあと）に signOut。「ユーザーIDを保存」（`receipt_app_saved_user_id`）は ID だけ。パスワードはアプリで保存しない（`autoComplete` でブラウザに任せる）。

## アカウントの削除（11/19〜。設定の「アカウントを削除する」）
- 画面でパスワードを入力 → `signInWithPassword` で本人を確認 → DB の関数 `delete_my_account()`（`supabase/migrations/20261119000000_delete_my_account.sql`。`src/utils/accountDb.js`）。
- 関数は本人（`auth.uid()`）だけを消す: receipt_items → receipts を明示的に消し、`auth.users` を消す（ほかの表は on delete cascade）。管理者（`app_admins`）は消せない（`admin_account`）。
- 消したあと、端末の控え（`receipt_app_〇〇_<ユーザーID>`、保存した ID）を消して、ログアウト。
- 「レシートの保存期間」は、何もしていなかったので廃止した。

## 分類の修正（11/21〜。管理者ホーム →「分類の修正」。`components/adminCorrections`・`utils/categoryCorrectionDb.js`・migration `20261121000000_category_corrections.sql`）
- 記録: 確認画面は、登録が成功したとき、AI の行（`aiOriginals`。削除した行は外す。手入力のレシートは記録しない）の「AI の印字名・AI の分類 → 直した分類」。レシート詳細は、保存の「元に戻す」が確定したとき（`onCommit`）、「直す前の印字名・分類 → 直した分類」。`record_category_corrections`（1 回 50 行・1 人 1 日 300 行まで。分類が同じ・直した後が未選択／その他は捨てる。店・日付・値段は送らない）。
- 管理者: `admin_list_category_corrections`（印字名 × 直し先ごとに、人数・回数・直す前の要約。直し先が分かれている数・今の辞書）、`admin_decide_category_correction`（承認 → `print_name_rules` に入れる。同じ印字名は置き換え）、`admin_list_print_name_rules`・`admin_delete_print_name_rule`（取り消すと記録は確認待ちに戻る）。ユーザー ID は返さない。自動の承認はしない。
- 読み取り: Edge Function が `list_print_name_rules` をユーザーのトークンで読み（1 分キャッシュ、読めなければ空で続ける）、`resolveItems(parsed, rules)` → `applyPrintNameDictionary` が、DB の辞書 → ファイルの辞書の順に当てる（印字名がぴったり同じ・表に無い分類は使わない）。承認はすぐ効く（再デプロイ不要。ただし、この仕組みの初回だけ deploy-functions が必要）。
