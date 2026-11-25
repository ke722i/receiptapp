-- 開発者（Claude）が、カテゴリの提案の「場所」と状態を、読み取り専用で調べるためのビュー
--  （Supabase の SQL Editor で実行する。2 回実行してもよい。先に 20261120000000_analytics_readonly.sql を実行してあること）
--
--  ・目的: 承認した提案が、カテゴリ表（tools/categoryTable.xlsx）に、全部入っているかを確かめる（node tools/db_query.mjs proposals）
--  ・入れるもの: 種類・状態・大中小分類・商品名・件数・人数・最初に提案した日・最後に確認した日（日付だけ）
--  ・入れないもの: ユーザー ID・提案者のメモ（note）・運営のメモ（admin_note）・読み仮名・時刻
--  ・提案の表（public.category_proposals）そのものは、これまでどおり claude_readonly から読めない（RLS も変えない）

create or replace view analytics.category_proposal_places as
select
  coalesce(us.is_test_account, false) as is_test,
  coalesce(p.kind, 'product') as kind,
  p.status,
  p.main_category,
  p.category,
  p.sub_category,
  p.product_name,
  count(*)::integer as proposals,
  count(distinct p.user_id)::integer as users,
  (min(p.created_at) at time zone 'Asia/Tokyo')::date as first_proposed,
  (max(p.reviewed_at) at time zone 'Asia/Tokyo')::date as last_reviewed
from public.category_proposals p
left join public.user_settings us on us.user_id = p.user_id
-- 11/11 に、以前の形式の提案を自動で見送りにしたもの（アプリでも通知に出さない）は除く
where p.admin_note is distinct from '提案の対象が「カテゴリ（中分類・小分類）」に変わりました。お手数ですが、もう一度提案してください。'
group by 1, 2, 3, 4, 5, 6, 7;

grant usage on schema analytics to claude_readonly;
grant select on analytics.category_proposal_places to claude_readonly;
