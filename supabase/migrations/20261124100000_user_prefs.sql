-- 端末に覚えていた、アカウントごとの設定・記録を、DB に覚える（別の端末・ブラウザでも、同じになる）
--  お気に入り・検索履歴・カテゴリの提案のお知らせを閉じたか・「その他」の自動移動の記録（印・移さない明細・移した記録）
--  Supabase の SQL Editor で実行する。2 回実行してもよい（20261124000000_notice_states.sql のあとでなくてもよい）
--
--  ・ユーザーは、表を直接は読み書きできない。関数（list_user_prefs・set_user_pref）から、自分の分だけ
--  ・name は、下の一覧にあるものだけ。value は JSON（1 つ 200KB まで）。同じ name は、あとから送ったもので置き換える

create table if not exists public.user_prefs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name in ('favorites', 'search_history', 'proposal_tip', 'reassign_fp', 'reassign_skip', 'reassign_runs')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.user_prefs enable row level security;
revoke all on table public.user_prefs from anon, authenticated;

create or replace function public.list_user_prefs()
returns table (name text, value jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select p.name, p.value from public.user_prefs p where p.user_id = auth.uid();
$$;

create or replace function public.set_user_pref(p_name text, p_value jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_name not in ('favorites', 'search_history', 'proposal_tip', 'reassign_fp', 'reassign_skip', 'reassign_runs') then
    raise exception 'invalid name';
  end if;
  if p_value is null or octet_length(p_value::text) > 200000 then
    raise exception 'invalid value';
  end if;
  insert into public.user_prefs (user_id, name, value, updated_at)
  values (v_uid, p_name, p_value, now())
  on conflict (user_id, name) do update set value = excluded.value, updated_at = now();
end;
$$;

revoke all on function public.list_user_prefs() from public, anon;
revoke all on function public.set_user_pref(text, jsonb) from public, anon;
grant execute on function public.list_user_prefs() to authenticated;
grant execute on function public.set_user_pref(text, jsonb) to authenticated;
