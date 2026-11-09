-- マイ店舗・容量・価格データの匿名共有
--  ・receipt_items に容量（volume）を追加する（任意）
--  ・my_stores: 自分が登録した店舗
--  ・user_settings: 価格データの共有（オプトイン）とテスト用アカウントの印
--  ・他のユーザーのデータは、下の関数を通してだけ読める。個々のレシートやユーザーIDは返さない
--
-- テスト用アカウントの設定（SQL Editor で、ユーザーIDを置き換えて実行）:
--   insert into public.user_settings (user_id, share_prices, is_test_account)
--   select id, true, true from auth.users where email = 'テスト用ユーザーID@app.internal'
--   on conflict (user_id) do update set share_prices = true, is_test_account = true, updated_at = now();

-- ---------- 1. 容量 ----------
alter table public.receipt_items
  add column if not exists volume text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'receipt_items_volume_length') then
    alter table public.receipt_items
      add constraint receipt_items_volume_length check (volume is null or char_length(volume) <= 30);
  end if;
end $$;

-- ---------- 2. 共有の設定 ----------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  share_prices boolean not null default false, -- 価格データを匿名で提供する（初期はオフ）
  is_test_account boolean not null default false, -- テスト用（1人あたりの上限をかけない）。管理者が SQL で設定する
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- 書き込みの権限そのものも外す（RLS と二重の守り。変更は下の関数からだけ）
revoke all on table public.user_settings from anon;
revoke insert, update, delete on table public.user_settings from authenticated;
grant select on table public.user_settings to authenticated;

-- 自分の行だけ読める。書き込みのポリシーは作らない（下の関数からだけ変更できる。テスト用の印を本人が変えられないように）
drop policy if exists "Users can read their own settings" on public.user_settings;
create policy "Users can read their own settings" on public.user_settings
  for select to authenticated using (user_id = auth.uid());

-- 共有のオン・オフを切り替える（テスト用の印は変えない）
create or replace function public.set_share_prices(p_share boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.user_settings (user_id, share_prices, updated_at)
  values (auth.uid(), coalesce(p_share, false), now())
  on conflict (user_id)
  do update set share_prices = excluded.share_prices, updated_at = now();

  return coalesce(p_share, false);
end;
$$;

revoke all on function public.set_share_prices(boolean) from public, anon;
grant execute on function public.set_share_prices(boolean) to authenticated;

-- ---------- 3. マイ店舗 ----------
create table if not exists public.my_stores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  store_name text not null check (char_length(store_name) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, store_name)
);

alter table public.my_stores enable row level security;

-- ログインしていない人は触れない。登録内容の書き換えは無し（登録と削除だけ）
revoke all on table public.my_stores from anon;
revoke update on table public.my_stores from authenticated;

drop policy if exists "Users can read their own stores" on public.my_stores;
create policy "Users can read their own stores" on public.my_stores
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can add their own stores" on public.my_stores;
create policy "Users can add their own stores" on public.my_stores
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "Users can remove their own stores" on public.my_stores;
create policy "Users can remove their own stores" on public.my_stores
  for delete to authenticated using (user_id = auth.uid());

-- ---------- 4. 比較に使える店舗名の一覧（マイ店舗の登録用） ----------
-- 自分のレシートの店舗と、共有している人のレシートの店舗。店舗名だけを返す
create or replace function public.list_comparable_stores()
returns table (store_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct r.store_name
  from public.receipts r
  where auth.uid() is not null
    and coalesce(r.store_name, '') not in ('', '店舗名未登録')
    and (
      r.user_id = auth.uid()
      or exists (
        select 1 from public.user_settings s
        where s.user_id = r.user_id and s.share_prices
      )
    )
  order by 1;
$$;

revoke all on function public.list_comparable_stores() from public, anon;
grant execute on function public.list_comparable_stores() to authenticated;

-- ---------- 5. マイ店舗での価格比較 ----------
-- 指定した商品（4階層）について、マイ店舗に登録した店舗の価格を返す。
--  ・自分のレシート: すべて（購入日つき）
--  ・他のユーザー: 共有をオンにした人だけ。購入日・ユーザー・レシートは返さない
--  ・1人の影響に上限: 他のユーザーは 1人につき 店舗×商品ごとに直近 3 件まで（テスト用アカウントは上限なし）
--  ・極端な価格（0 円以下、10 万円以上）は除く
--  ・期間は 1〜183 日（半年）に収める
create or replace function public.get_my_store_prices(
  p_main text,
  p_category text,
  p_sub text,
  p_product text,
  p_days integer default 7
)
returns table (
  store_name text,
  price numeric,
  volume text,
  is_discount boolean,
  is_mine boolean,
  purchase_date date
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      auth.uid() as me,
      (now() at time zone 'Asia/Tokyo')::date - least(greatest(coalesce(p_days, 7), 1), 183) as since
  ),
  src as (
    select
      r.user_id,
      r.store_name,
      ri.price::numeric as price,
      ri.volume,
      coalesce(ri.is_discount, false) as is_discount,
      -- purchase_date の型（date / text）に関係なく、YYYY-MM-DD で始まるものだけを日付にする
      case
        when r.purchase_date::text ~ '^\d{4}-\d{2}-\d{2}' then left(r.purchase_date::text, 10)::date
      end as bought_on
    from public.receipt_items ri
    join public.receipts r on r.id = ri.receipt_id
    where ri.main_category = p_main
      and ri.category = p_category
      and ri.sub_category is not distinct from p_sub
      and ri.product_name = p_product
      and r.store_name in (
        select ms.store_name from public.my_stores ms where ms.user_id = (select me from params)
      )
  ),
  ranked as (
    select
      s.*,
      s.user_id = p.me as mine,
      row_number() over (
        partition by s.user_id, s.store_name
        order by s.bought_on desc, s.price
      ) as rn
    from src s
    cross join params p
    where s.bought_on >= p.since
      and s.price > 0
      and s.price < 100000
  )
  select
    k.store_name,
    k.price,
    k.volume,
    k.is_discount,
    k.mine as is_mine,
    case when k.mine then k.bought_on end as purchase_date
  from ranked k
  left join public.user_settings us on us.user_id = k.user_id
  where (select me from params) is not null
    and (
      k.mine
      or (coalesce(us.share_prices, false) and (k.rn <= 3 or coalesce(us.is_test_account, false)))
    )
  order by k.store_name, k.price, k.mine desc;
$$;

revoke all on function public.get_my_store_prices(text, text, text, text, integer) from public, anon;
grant execute on function public.get_my_store_prices(text, text, text, text, integer) to authenticated;
