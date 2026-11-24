-- 通知の「既読」と、お知らせの「閉じた（中の ✕）」「OK（高）」を、アカウントごとに DB に覚える
--  （これまでは端末だけに覚えていたので、別の端末・ブラウザでログインすると、未読に戻っていた）
--  Supabase の SQL Editor で実行する。2 回実行してもよい
--
--  ・ユーザーは、表を直接は読み書きできない。関数（list_notice_states・set_notice_states）から、自分の分だけ
--  ・key は、アプリが決める文字（提案の id、「a:お知らせの id:更新日時」、「r:記録の id」など）。個人の情報は入れない
--  ・1 人あたり、種類ごとに新しい 1000 件まで（古いものから消す）

create table if not exists public.notice_states (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('read', 'closed', 'confirmed')),
  key text not null check (char_length(key) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
create index if not exists notice_states_user_kind_idx on public.notice_states (user_id, kind, created_at desc);

alter table public.notice_states enable row level security;
revoke all on table public.notice_states from anon, authenticated;

-- 自分の記録を読む（古い順。アプリは、新しいものを後ろに並べて覚える）
create or replace function public.list_notice_states()
returns table (kind text, key text)
language sql
stable
security definer
set search_path = public
as $$
  select s.kind, s.key from public.notice_states s
  where s.user_id = auth.uid()
  order by s.created_at, s.key;
$$;

-- 自分の記録を足す（p_on = true）・消す（p_on = false）
create or replace function public.set_notice_states(p_kind text, p_keys text[], p_on boolean)
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
  if p_kind not in ('read', 'closed', 'confirmed') then
    raise exception 'invalid kind';
  end if;
  if p_keys is null or cardinality(p_keys) = 0 then
    return;
  end if;
  if cardinality(p_keys) > 500 then
    raise exception 'too many keys';
  end if;

  if p_on then
    insert into public.notice_states (user_id, kind, key)
    select v_uid, p_kind, k from unnest(p_keys) as k
    where char_length(k) between 1 and 200
    on conflict do nothing;
    -- 種類ごとに、新しい 1000 件だけ残す
    delete from public.notice_states s
    where s.user_id = v_uid and s.kind = p_kind
      and s.key not in (
        select s2.key from public.notice_states s2
        where s2.user_id = v_uid and s2.kind = p_kind
        order by s2.created_at desc limit 1000
      );
  else
    delete from public.notice_states s
    where s.user_id = v_uid and s.kind = p_kind and s.key = any (p_keys);
  end if;
end;
$$;

revoke all on function public.list_notice_states() from public, anon;
revoke all on function public.set_notice_states(text, text[], boolean) from public, anon;
grant execute on function public.list_notice_states() to authenticated;
grant execute on function public.set_notice_states(text, text[], boolean) to authenticated;
