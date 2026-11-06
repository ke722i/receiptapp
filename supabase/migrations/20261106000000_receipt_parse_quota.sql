-- レシート解析（Gemini 呼び出し）の 1 日あたりの回数制限
--  Edge Function parse-receipt がユーザーのトークンで consume_receipt_parse_quota() を呼ぶ。
--  トークンが無効なら DB が拒否するので、この呼び出しがログイン確認も兼ねる。

create table if not exists public.receipt_parse_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  count integer not null default 0,
  primary key (user_id, usage_date)
);

-- ポリシーは作らない: テーブルを直接読み書きできず、下の関数からだけ更新できる
alter table public.receipt_parse_usage enable row level security;

-- 1 回分を消費する。上限に達していたら false を返す（日付は日本時間で区切る）
-- 上限はユーザーに変えられないよう、引数にせずここに書く
create or replace function public.consume_receipt_parse_quota()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit constant integer := 30;
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
  v_count integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.receipt_parse_usage as usage (user_id, usage_date, count)
  values (v_user, v_today, 1)
  on conflict (user_id, usage_date)
  do update set count = usage.count + 1
  where usage.count < v_limit
  returning usage.count into v_count;

  return v_count is not null;
end;
$$;

revoke all on function public.consume_receipt_parse_quota() from public, anon;
grant execute on function public.consume_receipt_parse_quota() to authenticated;
