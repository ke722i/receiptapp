-- 管理者画面（カテゴリの提案の承認・見送り）
--  （20261113000000_category_proposals_product.sql を実行したあとに、実行する。2 回実行してもよい）
--
--  ・管理者は、表 app_admins に登録したアカウントだけ。アプリからは登録できない（SQL Editor で、オーナーが登録する）
--  ・管理者だけが、全員の提案を（人数でまとめて）読み、承認・見送り・承認待ちに戻すことができる（下の関数から）
--  ・一般のユーザーの権限は、今までどおり（自分の提案だけ読める。status は変えられない）
--  ・提案した人のユーザー ID は、管理者にも返さない（何人が出したかだけ）
--
-- 管理者の登録（SQL Editor。UID は Authentication > Users で確かめる）:
--   insert into public.app_admins (user_id) values ('ここに管理者のUID') on conflict do nothing;
-- 管理者を外す:
--   delete from public.app_admins where user_id = 'ここに管理者のUID';

-- ---------- 1. 管理者の一覧 ----------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
-- アプリからは、読むことも書くこともできない（判定は、下の関数 is_app_admin からだけ）
revoke all on table public.app_admins from anon, authenticated;

-- ---------- 2. 管理者かどうか ----------
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

revoke all on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

-- ---------- 3. 提案の一覧（管理者だけ。同じ提案は、人数でまとめる） ----------
--  p_status: 'pending'（承認待ち）／'approved'（承認）／'rejected'（見送り）
--  ids は、まとめた提案の id（承認・見送りの関数に、そのまま渡す）
--  11/11 に以前の形式（商品名の提案）を自動で見送りにしたものは、出さない
create or replace function public.admin_list_proposals(p_status text default 'pending')
returns table (
  kind text,
  main_category text,
  category text,
  sub_category text,
  product_name text,
  people integer,
  first_at timestamptz,
  reviewed_at timestamptz,
  notes text[],
  admin_note text,
  ids bigint[]
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
  if p_status is null or p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'proposal_invalid' using errcode = '22023';
  end if;

  return query
  select p.kind, p.main_category, p.category, p.sub_category, p.product_name,
         count(*)::integer as people,
         min(p.created_at) as first_at,
         max(p.reviewed_at) as reviewed_at,
         coalesce(array_agg(distinct p.note) filter (where p.note is not null), '{}') as notes,
         max(p.admin_note) as admin_note,
         array_agg(p.id order by p.id) as ids
  from public.category_proposals p
  where p.status = p_status
    and p.admin_note is distinct from '提案の対象が「カテゴリ（中分類・小分類）」に変わりました。お手数ですが、もう一度提案してください。'
  group by p.kind, p.main_category, p.category, p.sub_category, p.product_name
  order by
    case when p_status = 'pending' then count(*) end desc nulls last,
    case when p_status = 'pending' then min(p.created_at) end asc,
    max(p.reviewed_at) desc nulls last;
end;
$$;

revoke all on function public.admin_list_proposals(text) from public, anon;
grant execute on function public.admin_list_proposals(text) to authenticated;

-- ---------- 4. 承認・見送り・承認待ちに戻す（管理者だけ） ----------
--  p_ids: 提案の id（一覧の ids）。p_status: 'approved'／'rejected'／'pending'（戻す）
--  p_note: 提案した人へのメモ（通知に出る。200 文字まで）。承認待ちに戻すときは、消す
--  確認した日時（reviewed_at）は、今までの仕組み（トリガー）が入れる。変えた件数を返す
create or replace function public.admin_decide_proposals(
  p_ids bigint[],
  p_status text,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(p_note), '');
  v_count integer;
begin
  if not public.is_app_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_status is null or p_status not in ('pending', 'approved', 'rejected')
     or p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 500
     or char_length(coalesce(v_note, '')) > 200 then
    raise exception 'proposal_invalid' using errcode = '22023';
  end if;

  update public.category_proposals
  set status = p_status,
      admin_note = case when p_status = 'pending' then null else v_note end
  where id = any(p_ids);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_decide_proposals(bigint[], text, text) from public, anon;
grant execute on function public.admin_decide_proposals(bigint[], text, text) to authenticated;
