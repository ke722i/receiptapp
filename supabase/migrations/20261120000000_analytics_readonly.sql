-- 開発者（Claude）が、集計だけを読むための、読み取り専用の窓口
--  （Supabase の SQL Editor で実行する。2 回実行してもよい）
--
--  ・スキーマ analytics に、集計のビューを置く。アプリ（anon・authenticated）からは見えない（API に出していないスキーマ）
--  ・読み取り専用のロール claude_readonly は、analytics のビューだけを読める。レシート・明細・ユーザーの表は、直接は読めない
--  ・ビューには、ユーザー ID・メールアドレス・購入日・値段・画像を入れない（件数と、ユーザーの人数だけ）
--  ・パスワードは、このファイルに書かない。実行のあと、下の「パスワードの設定」を、SQL Editor で別に実行する
--
--  パスワードの設定（自分で考えた、長いパスワードにする。チャットに貼らない）:
--    alter role claude_readonly with password 'ここに長いパスワード';
--  使わなくなったら（窓口を閉じる）:
--    alter role claude_readonly nologin;

-- ---------- 1. スキーマ ----------
create schema if not exists analytics;
revoke all on schema analytics from public, anon, authenticated;

-- ---------- 2. 集計のビュー（作った人＝postgres の権限で、元の表を読む） ----------

-- 2-1. カテゴリごとの件数（大分類・中分類・小分類・商品名。テスト用アカウントかどうかで分ける）
create or replace view analytics.category_counts as
select
  coalesce(us.is_test_account, false) as is_test,
  i.main_category,
  i.category,
  i.sub_category,
  i.product_name,
  count(*)::integer as items,
  count(distinct r.user_id)::integer as users
from public.receipt_items i
join public.receipts r on r.id = i.receipt_id
left join public.user_settings us on us.user_id = r.user_id
group by 1, 2, 3, 4, 5;

-- 2-2. 未選択・その他・商品名なしの件数（中分類ごと）
create or replace view analytics.unclassified_counts as
select
  coalesce(us.is_test_account, false) as is_test,
  i.main_category,
  i.category,
  count(*)::integer as items,
  count(*) filter (where i.category is null or i.category = '未選択')::integer as unselected,
  count(*) filter (where i.main_category = 'その他' or i.category = 'その他' or i.sub_category = 'その他' or i.product_name = 'その他')::integer as other,
  count(*) filter (where i.category is not null and i.category <> '未選択' and i.product_name is null)::integer as no_product
from public.receipt_items i
join public.receipts r on r.id = i.receipt_id
left join public.user_settings us on us.user_id = r.user_id
group by 1, 2, 3;

-- 2-3. 未選択・その他・商品名なしの、印字名ごとの件数（辞書づくり・分類の見直し用。値段・日付・店は入れない）
create or replace view analytics.unclassified_item_names as
select
  coalesce(us.is_test_account, false) as is_test,
  i.item_name,
  i.main_category,
  i.category,
  i.sub_category,
  i.product_name,
  count(*)::integer as items,
  count(distinct r.user_id)::integer as users
from public.receipt_items i
join public.receipts r on r.id = i.receipt_id
left join public.user_settings us on us.user_id = r.user_id
where i.category is null or i.category = '未選択'
   or i.main_category = 'その他' or i.category = 'その他' or i.sub_category = 'その他' or i.product_name = 'その他'
   or i.product_name is null
group by 1, 2, 3, 4, 5, 6;

-- 2-4. 店舗名ごとの件数（表記ゆれの確認用）
create or replace view analytics.store_name_counts as
select
  coalesce(us.is_test_account, false) as is_test,
  r.store_name,
  count(*)::integer as receipts,
  count(distinct r.user_id)::integer as users
from public.receipts r
left join public.user_settings us on us.user_id = r.user_id
group by 1, 2;

-- ---------- 3. 読み取り専用のロール ----------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'claude_readonly') then
    create role claude_readonly login noinherit;
  end if;
end
$$;

-- 読むだけ・長い問い合わせは止める
alter role claude_readonly set default_transaction_read_only = on;
alter role claude_readonly set statement_timeout = '15s';
alter role claude_readonly connection limit 2;

-- public（アプリの表）・auth・storage などは、使わせない
revoke all on schema public from claude_readonly;
revoke all on all tables in schema public from claude_readonly;
revoke all on all functions in schema public from claude_readonly;

-- analytics のビューだけ、読める
grant usage on schema analytics to claude_readonly;
grant select on all tables in schema analytics to claude_readonly;
alter default privileges in schema analytics grant select on tables to claude_readonly;
