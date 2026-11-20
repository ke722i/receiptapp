-- 分類の修正の記録と、管理者が承認した「印字名 → 分類」の辞書（DB の辞書）
--  （20261116000000_admin_proposals.sql のあとに、Supabase の SQL Editor で実行する。2 回実行してもよい）
--
--  流れ:
--   1. ユーザーが、AI の分類を直して登録した（確認画面）／登録後に直した（レシート詳細）
--      → アプリが record_category_corrections で、印字名と「直す前 → 直した後」の分類を記録する
--   2. 管理者が、管理者の画面で、印字名ごとにまとめて見て、承認・見送りを決める（admin_list_category_corrections・admin_decide_category_correction）
--   3. 承認したものは、print_name_rules に入り、次の読み取りから、Edge Function が使う（list_print_name_rules）。再デプロイは要らない
--
--  個人の情報:
--   ・記録するのは、印字名・分類・どの画面で直したかだけ。店・購入日・値段・画像は記録しない
--   ・管理者に返すのは、人数・回数だけ。ユーザー ID は返さない
--   ・ユーザーは、記録を読めない（書くのも、関数からだけ）

-- ---------- 1. 修正の記録 ----------
create table if not exists public.category_corrections (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_name text not null check (char_length(item_name) between 1 and 100),
  item_key text not null, -- 比べるための形（NFKC・空白なし・小文字）。アプリの foldName とそろえる
  from_main text, from_category text, from_sub text, from_product text, -- 直す前（AI の分類、または前の分類）
  to_main text not null, to_category text not null, to_sub text, to_product text, -- 直した後
  source text not null check (source in ('confirm', 'detail')), -- confirm = 登録前の確認画面、detail = 登録後のレシート詳細
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
create index if not exists category_corrections_key_idx on public.category_corrections (item_key, status);
create index if not exists category_corrections_user_day_idx on public.category_corrections (user_id, created_at);

alter table public.category_corrections enable row level security;
revoke all on table public.category_corrections from anon, authenticated;

-- ---------- 2. 承認した辞書（印字名 → 分類） ----------
create table if not exists public.print_name_rules (
  id bigint generated always as identity primary key,
  item_key text not null unique,
  item_name text not null,
  main_category text not null,
  category text not null,
  sub_category text,
  product_name text,
  approved_at timestamptz not null default now()
);
alter table public.print_name_rules enable row level security;
revoke all on table public.print_name_rules from anon, authenticated;

-- 印字名を、比べるための形にする（アプリ・Edge Function の foldName と同じ: NFKC・空白を除く・小文字）
create or replace function public.fold_item_name(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(normalize(coalesce(p, ''), NFKC), '\s+', '', 'g'));
$$;

-- ---------- 3. 修正を記録する（ログインしているユーザー） ----------
--  p_rows: [{ item_name, from: { main, category, sub, product }, to: { main, category, sub, product } }, …]
--  ・1 回に 50 行まで。1 人 1 日 300 行まで（いたずらで、記録があふれないように）
--  ・直した後が「未選択」・「その他」・空の行は、記録しない（辞書にできないため）
--  ・直す前と直した後が同じ行は、記録しない
create or replace function public.record_category_corrections(p_rows jsonb, p_source text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_count integer := 0;
  v_today integer;
  v_name text;
  v_to jsonb;
  v_from jsonb;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_source not in ('confirm', 'detail') or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 50 then
    raise exception 'too_many' using errcode = '22023';
  end if;
  select count(*) into v_today from public.category_corrections c
  where c.user_id = v_uid and c.created_at > now() - interval '1 day';
  if v_today >= 300 then
    return 0;
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    v_name := btrim(coalesce(v_row ->> 'item_name', ''));
    v_to := coalesce(v_row -> 'to', '{}'::jsonb);
    v_from := coalesce(v_row -> 'from', '{}'::jsonb);
    continue when v_name = '' or char_length(v_name) > 100;
    continue when coalesce(v_to ->> 'main', '') = '' or coalesce(v_to ->> 'category', '') in ('', '未選択', 'その他')
      or v_to ->> 'main' = 'その他' or coalesce(v_to ->> 'sub', '') = 'その他' or coalesce(v_to ->> 'product', '') = 'その他';
    continue when coalesce(v_from ->> 'main', '') = coalesce(v_to ->> 'main', '')
      and coalesce(v_from ->> 'category', '') = coalesce(v_to ->> 'category', '')
      and coalesce(v_from ->> 'sub', '') = coalesce(v_to ->> 'sub', '')
      and coalesce(v_from ->> 'product', '') = coalesce(v_to ->> 'product', '');
    insert into public.category_corrections (
      user_id, item_name, item_key, from_main, from_category, from_sub, from_product,
      to_main, to_category, to_sub, to_product, source
    ) values (
      v_uid, v_name, public.fold_item_name(v_name),
      nullif(v_from ->> 'main', ''), nullif(v_from ->> 'category', ''), nullif(v_from ->> 'sub', ''), nullif(v_from ->> 'product', ''),
      left(v_to ->> 'main', 60), left(v_to ->> 'category', 60), left(nullif(v_to ->> 'sub', ''), 60), left(nullif(v_to ->> 'product', ''), 60),
      p_source
    );
    v_count := v_count + 1;
    exit when v_today + v_count >= 300;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.record_category_corrections(jsonb, text) from public, anon;
grant execute on function public.record_category_corrections(jsonb, text) to authenticated;

-- ---------- 4. 承認した辞書を読む（Edge Function・ログインしているユーザー） ----------
create or replace function public.list_print_name_rules()
returns table (item_name text, main_category text, category text, sub_category text, product_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.item_name, r.main_category, r.category, r.sub_category, r.product_name
  from public.print_name_rules r
  order by r.id;
$$;
revoke all on function public.list_print_name_rules() from public, anon;
grant execute on function public.list_print_name_rules() to authenticated;

-- ---------- 5. 管理者: 修正の一覧（印字名 × 直した後の分類ごとに、まとめる） ----------
--  p_status: pending（確認待ち）／ rejected（見送り）。承認済みは、admin_list_print_name_rules で見る
create or replace function public.admin_list_category_corrections(p_status text default 'pending')
returns table (
  item_key text, item_name text,
  to_main text, to_category text, to_sub text, to_product text,
  from_summary text, -- 直す前の分類（多い順。「中分類>商品（回数）」を「、」でつなぐ）
  times integer, people integer, last_at timestamptz,
  other_targets integer, -- 同じ印字名で、別の直し先がある数（直し先が分かれているか）
  rule_category text, rule_product text -- すでに辞書にある、その印字名の分類（無ければ null）
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
  with g as (
    select c.item_key, c.to_main, c.to_category, c.to_sub, c.to_product,
           min(c.item_name) as item_name, count(*)::integer as times, count(distinct c.user_id)::integer as people,
           max(c.created_at) as last_at
    from public.category_corrections c
    where c.status = p_status
    group by 1, 2, 3, 4, 5
  )
  select g.item_key, g.item_name, g.to_main, g.to_category, g.to_sub, g.to_product,
         (select string_agg(x.label || '（' || x.n || '）', '、' order by x.n desc)
          from (
            select coalesce(c2.from_category, '未選択') || coalesce('>' || c2.from_product, '') as label, count(*)::integer as n
            from public.category_corrections c2
            where c2.status = p_status and c2.item_key = g.item_key
              and c2.to_main = g.to_main and c2.to_category = g.to_category
              and c2.to_sub is not distinct from g.to_sub and c2.to_product is not distinct from g.to_product
            group by 1
          ) x) as from_summary,
         g.times, g.people, g.last_at,
         (select count(*)::integer - 1 from g g2 where g2.item_key = g.item_key) as other_targets,
         r.category, r.product_name
  from g
  left join public.print_name_rules r on r.item_key = g.item_key
  order by g.people desc, g.times desc, g.last_at desc
  limit 500;
end;
$$;
revoke all on function public.admin_list_category_corrections(text) from public, anon;
grant execute on function public.admin_list_category_corrections(text) to authenticated;

-- ---------- 6. 管理者: 承認・見送り ----------
--  承認: その印字名の辞書を、この分類にする（すでにあれば、置き換える）。同じ印字名・同じ直し先の記録を「承認」にする
--  見送り: 同じ印字名・同じ直し先の記録を「見送り」にする（辞書は変えない）
create or replace function public.admin_decide_category_correction(
  p_item_key text, p_to_main text, p_to_category text, p_to_sub text, p_to_product text, p_action text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_name text;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_action not in ('approve', 'reject') then
    raise exception 'invalid_action' using errcode = '22023';
  end if;

  update public.category_corrections c
  set status = case when p_action = 'approve' then 'approved' else 'rejected' end
  where c.item_key = p_item_key and c.status in ('pending', 'rejected')
    and c.to_main = p_to_main and c.to_category = p_to_category
    and c.to_sub is not distinct from p_to_sub and c.to_product is not distinct from p_to_product;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_action = 'approve' then
    select min(c.item_name) into v_name from public.category_corrections c where c.item_key = p_item_key;
    insert into public.print_name_rules (item_key, item_name, main_category, category, sub_category, product_name)
    values (p_item_key, v_name, p_to_main, p_to_category, p_to_sub, p_to_product)
    on conflict (item_key) do update
      set item_name = excluded.item_name, main_category = excluded.main_category, category = excluded.category,
          sub_category = excluded.sub_category, product_name = excluded.product_name, approved_at = now();
  end if;
  return v_n;
end;
$$;
revoke all on function public.admin_decide_category_correction(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_decide_category_correction(text, text, text, text, text, text) to authenticated;

-- ---------- 7. 管理者: 承認した辞書の一覧と、取り消し ----------
create or replace function public.admin_list_print_name_rules()
returns table (id bigint, item_name text, main_category text, category text, sub_category text, product_name text, approved_at timestamptz, people integer)
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
  select r.id, r.item_name, r.main_category, r.category, r.sub_category, r.product_name, r.approved_at,
         (select count(distinct c.user_id)::integer from public.category_corrections c where c.item_key = r.item_key and c.status = 'approved')
  from public.print_name_rules r
  order by r.approved_at desc;
end;
$$;
revoke all on function public.admin_list_print_name_rules() from public, anon;
grant execute on function public.admin_list_print_name_rules() to authenticated;

--  取り消し: 辞書から消し、その印字名の承認した記録を「確認待ち」に戻す（もう一度、判断できる）
create or replace function public.admin_delete_print_name_rule(p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  delete from public.print_name_rules r where r.id = p_id returning r.item_key into v_key;
  if v_key is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update public.category_corrections c set status = 'pending' where c.item_key = v_key and c.status = 'approved';
  return true;
end;
$$;
revoke all on function public.admin_delete_print_name_rule(bigint) from public, anon;
grant execute on function public.admin_delete_print_name_rule(bigint) to authenticated;
