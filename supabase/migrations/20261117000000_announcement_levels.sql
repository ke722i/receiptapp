-- お知らせの 3 段階（小・中・高）・期限・ログイン画面への表示
--  （20261116100000_admin_tools.sql を実行したあとに、実行する。2 回実行してもよい）
--
--  level（重要度）
--    low  = 小: 通知の画面（メールボックス）に入る。新しい順に 30 件まで
--    mid  = 中: ホームのお知らせ（スライド）。新しい順に 3 件まで。閉じたあとも、通知の画面に残る
--    high = 高: アプリを使っている人に、ポップアップで出す（30 秒ごとに確認）。期限が必須
--  ends_at（期限）: 過ぎたら、だれにも出さない（null = 期限なし。管理者が公開を終えるまで）
--  show_on_login: ログイン画面にも出す（ログインしていない人も読める。公開してよい内容だけにする）

alter table public.announcements add column if not exists level text not null default 'mid';
alter table public.announcements add column if not exists ends_at timestamptz;
alter table public.announcements add column if not exists show_on_login boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'announcements_level_check') then
    alter table public.announcements add constraint announcements_level_check check (level in ('low', 'mid', 'high'));
  end if;
end;
$$;

-- 公開中・期限内のお知らせ（ログインしているユーザー）。小 30 件・中 3 件・高 5 件まで（それぞれ新しい順）
drop function if exists public.list_announcements();
create function public.list_announcements()
returns table (id bigint, title text, body text, level text, ends_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select x.id, x.title, x.body, x.level, x.ends_at, x.updated_at
  from (
    select a.*, row_number() over (partition by a.level order by a.updated_at desc) as rn
    from public.announcements a
    where a.active and (a.ends_at is null or a.ends_at > now()) and auth.uid() is not null
  ) x
  where x.rn <= case x.level when 'low' then 30 when 'mid' then 3 else 5 end
  order by x.updated_at desc;
$$;
revoke all on function public.list_announcements() from public, anon;
grant execute on function public.list_announcements() to authenticated;

-- ログイン画面のお知らせ（ログインしていなくても読める）。「ログイン画面にも出す」が付いた、公開中・期限内のものを 3 件まで
create or replace function public.list_login_announcements()
returns table (id bigint, title text, body text, level text, ends_at timestamptz, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.title, a.body, a.level, a.ends_at, a.updated_at
  from public.announcements a
  where a.active and a.show_on_login and (a.ends_at is null or a.ends_at > now())
  order by a.updated_at desc
  limit 3;
$$;
revoke all on function public.list_login_announcements() from public;
grant execute on function public.list_login_announcements() to anon, authenticated;

-- すべてのお知らせ（管理者だけ。下書き・公開終了・期限切れも）
drop function if exists public.admin_list_announcements();
create function public.admin_list_announcements()
returns table (
  id bigint, title text, body text, active boolean, level text, ends_at timestamptz, show_on_login boolean,
  created_at timestamptz, updated_at timestamptz
)
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
  select a.id, a.title, a.body, a.active, a.level, a.ends_at, a.show_on_login, a.created_at, a.updated_at
  from public.announcements a
  order by a.active desc, a.updated_at desc;
end;
$$;
revoke all on function public.admin_list_announcements() from public, anon;
grant execute on function public.admin_list_announcements() to authenticated;

-- お知らせを作る（p_id が null）・直す（p_id あり）。id を返す
--  ・高は期限が必須。公開するとき、期限は今より後（過ぎた期限では公開できない）
drop function if exists public.admin_save_announcement(bigint, text, text, boolean);
create or replace function public.admin_save_announcement(
  p_id bigint, p_title text, p_body text, p_active boolean,
  p_level text default 'mid', p_ends_at timestamptz default null, p_show_on_login boolean default false
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text := nullif(btrim(p_title), '');
  v_body text := coalesce(btrim(p_body), '');
  v_level text := coalesce(p_level, 'mid');
  v_id bigint;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if v_title is null or char_length(v_title) > 60 or char_length(v_body) > 500 or p_active is null
     or v_level not in ('low', 'mid', 'high') then
    raise exception 'announcement_invalid' using errcode = '22023';
  end if;
  if v_level = 'high' and p_ends_at is null then
    raise exception 'announcement_ends_required' using errcode = '22023';
  end if;
  if p_active and p_ends_at is not null and p_ends_at <= now() then
    raise exception 'announcement_expired' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.announcements (title, body, active, level, ends_at, show_on_login)
    values (v_title, v_body, p_active, v_level, p_ends_at, coalesce(p_show_on_login, false))
    returning id into v_id;
  else
    update public.announcements
    set title = v_title, body = v_body, active = p_active, level = v_level, ends_at = p_ends_at,
        show_on_login = coalesce(p_show_on_login, false), updated_at = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'announcement_not_found' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;
revoke all on function public.admin_save_announcement(bigint, text, text, boolean, text, timestamptz, boolean) from public, anon;
grant execute on function public.admin_save_announcement(bigint, text, text, boolean, text, timestamptz, boolean) to authenticated;
