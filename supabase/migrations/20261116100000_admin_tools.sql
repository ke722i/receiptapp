-- 管理者の機能: お知らせの配信・利用状況の数字・アカウントの管理（テスト用・管理者）・ユーザー別の解析の回数
--  （20261116000000_admin_proposals.sql を実行したあとに、実行する。2 回実行してもよい）
--
--  ・管理者の判定は public.is_app_admin()（表 app_admins）。下の admin_ で始まる関数は、管理者だけが使える
--  ・一般のユーザーが読めるのは、公開中のお知らせだけ（list_announcements）
--  ・管理者に返すのは、数・ログイン ID・設定だけ。レシートの中身（店・商品・値段）は返さない

-- ---------- 1. お知らせ ----------
create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 500),
  active boolean not null default true, -- 公開中か（false = 下書き・公開終了）
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
-- アプリからは、直接読み書きできない（下の関数からだけ）
revoke all on table public.announcements from anon, authenticated;

-- 公開中のお知らせ（ログインしているユーザーなら、だれでも）。新しい順に 5 件まで
create or replace function public.list_announcements()
returns table (id bigint, title text, body text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.body, a.updated_at
  from public.announcements a
  where a.active and auth.uid() is not null
  order by a.updated_at desc
  limit 5;
$$;
revoke all on function public.list_announcements() from public, anon;
grant execute on function public.list_announcements() to authenticated;

-- すべてのお知らせ（管理者だけ。下書き・公開終了も）
create or replace function public.admin_list_announcements()
returns table (id bigint, title text, body text, active boolean, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  select a.id, a.title, a.body, a.active, a.created_at, a.updated_at
  from public.announcements a
  order by a.active desc, a.updated_at desc;
end;
$$;
revoke all on function public.admin_list_announcements() from public, anon;
grant execute on function public.admin_list_announcements() to authenticated;

-- お知らせを作る（p_id が null）・直す（p_id あり）。id を返す
create or replace function public.admin_save_announcement(p_id bigint, p_title text, p_body text, p_active boolean)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_title), '');
  v_body text := coalesce(btrim(p_body), '');
  v_id bigint;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_title is null or char_length(v_title) > 60 or char_length(v_body) > 500 or p_active is null then
    raise exception 'announcement_invalid' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.announcements (title, body, active) values (v_title, v_body, p_active) returning id into v_id;
  else
    update public.announcements
    set title = v_title, body = v_body, active = p_active, updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'announcement_not_found' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_save_announcement(bigint, text, text, boolean) from public, anon;
grant execute on function public.admin_save_announcement(bigint, text, text, boolean) to authenticated;

create or replace function public.admin_delete_announcement(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  delete from public.announcements where id = p_id;
  return found;
end;
$$;
revoke all on function public.admin_delete_announcement(bigint) from public, anon;
grant execute on function public.admin_delete_announcement(bigint) to authenticated;

-- ---------- 2. 利用状況の数字（管理者だけ） ----------
create or replace function public.admin_stats()
returns table (
  users integer,              -- 登録ユーザー数
  users_7d integer,           -- 直近 7 日に登録したユーザー
  receipts integer,           -- レシートの数
  receipts_7d integer,        -- 直近 7 日に登録したレシート
  items integer,              -- 明細（商品）の数
  parses_today integer,       -- 今日（日本時間）の解析の回数（全員の合計）
  share_users integer,        -- 価格データの共有をオンにしている人
  proposals_pending integer,
  proposals_approved integer,
  proposals_rejected integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  select
    (select count(*)::integer from auth.users),
    (select count(*)::integer from auth.users u where u.created_at >= now() - interval '7 days'),
    (select count(*)::integer from public.receipts),
    (select count(*)::integer from public.receipts r where r.created_at >= now() - interval '7 days'),
    (select count(*)::integer from public.receipt_items),
    (select coalesce(sum(p.count), 0)::integer from public.receipt_parse_usage p where p.usage_date = v_today),
    (select count(*)::integer from public.user_settings s where s.share_prices),
    (select count(*)::integer from public.category_proposals c where c.status = 'pending'),
    (select count(*)::integer from public.category_proposals c where c.status = 'approved'),
    (select count(*)::integer from public.category_proposals c where c.status = 'rejected');
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- ---------- 3. アカウントの一覧（管理者だけ）: ログイン ID・管理者・テスト用・共有・レシート数・解析の回数 ----------
--  login_id はメールアドレスの @ より前（このアプリは「ユーザーID@…」でアカウントを作る）
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  login_id text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean,
  is_test_account boolean,
  share_prices boolean,
  receipt_count integer,
  parses_today integer,
  parses_7d integer,
  parses_total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
  select
    u.id,
    split_part(coalesce(u.email, ''), '@', 1),
    u.created_at,
    u.last_sign_in_at,
    exists (select 1 from public.app_admins a where a.user_id = u.id),
    coalesce(s.is_test_account, false),
    coalesce(s.share_prices, false),
    (select count(*)::integer from public.receipts r where r.user_id = u.id),
    coalesce((select p.count from public.receipt_parse_usage p where p.user_id = u.id and p.usage_date = v_today), 0),
    coalesce((select sum(p.count)::integer from public.receipt_parse_usage p where p.user_id = u.id and p.usage_date > v_today - 7), 0),
    coalesce((select sum(p.count)::integer from public.receipt_parse_usage p where p.user_id = u.id), 0)
  from auth.users u
  left join public.user_settings s on s.user_id = u.id
  order by u.created_at desc;
end;
$$;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- ---------- 4. テスト用の印（管理者だけ） ----------
create or replace function public.admin_set_test_account(p_user uuid, p_value boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_user is null or p_value is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'user_invalid' using errcode = '22023';
  end if;
  insert into public.user_settings (user_id, is_test_account)
  values (p_user, p_value)
  on conflict (user_id) do update set is_test_account = excluded.is_test_account, updated_at = now();
  return p_value;
end;
$$;
revoke all on function public.admin_set_test_account(uuid, boolean) from public, anon;
grant execute on function public.admin_set_test_account(uuid, boolean) to authenticated;

-- ---------- 5. 管理者の権限（管理者だけ） ----------
--  自分自身は外せない（管理者が 0 人になるのを防ぐため。外すときは、別の管理者が行う）
create or replace function public.admin_set_admin(p_user uuid, p_value boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_user is null or p_value is null or not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception 'user_invalid' using errcode = '22023';
  end if;
  if not p_value and p_user = auth.uid() then
    raise exception 'admin_self' using errcode = 'P0001';
  end if;
  if p_value then
    insert into public.app_admins (user_id) values (p_user) on conflict do nothing;
  else
    delete from public.app_admins where user_id = p_user;
  end if;
  return p_value;
end;
$$;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
