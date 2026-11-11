-- カテゴリ（商品名）の提案
--  ・ユーザーが、表（Excel）に無い商品名を、大・中・小分類の位置を選んで提案する
--  ・管理者が Supabase の Table Editor で、status を approved（承認）／rejected（見送り）に変える
--  ・承認したものは、管理者が tools/categoryTable.xlsx に足して、「カテゴリ表を更新して」の手順で反映する
--    （アプリと AI の解析の両方に載る。承認しただけでは、画面には出ない）
--
-- 守り:
--  ・登録は、下の関数 submit_category_proposal からだけ（表への insert / update の権限は外す）。
--    本人が status や admin_note を書き換えられない
--  ・読めるのは、自分の提案だけ（RLS）。他のユーザーの提案は読めない
--  ・取り下げ（削除）は、自分の「承認待ち」だけ
--  ・1人の承認待ちは 20 件まで。同じ位置・同じ商品名の提案は、承認待ち・承認済みのものと重ねて出せない
--
-- 管理者の確認用（SQL Editor）: 承認待ちを、同じ提案の人数が多い順に
--   select main_category, category, sub_category, product_name,
--          count(*) as people, min(created_at) as first_at,
--          string_agg(distinct reading, ' / ') as readings, string_agg(note, ' / ') as notes
--   from public.category_proposals
--   where status = 'pending'
--   group by 1, 2, 3, 4
--   order by people desc, first_at;
--
-- まとめて承認する例（同じ位置・同じ商品名の提案を、全員分）:
--   update public.category_proposals
--   set status = 'approved', admin_note = '次の更新で追加します'
--   where status = 'pending' and main_category = '常温' and category = '菓子'
--     and sub_category is not distinct from 'グミ' and product_name = 'ちいかわグミ';

create table if not exists public.category_proposals (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  main_category text not null check (char_length(main_category) between 1 and 40),
  category text not null check (char_length(category) between 1 and 40),
  sub_category text check (sub_category is null or char_length(sub_category) between 1 and 40),
  product_name text not null check (char_length(product_name) between 1 and 40),
  reading text check (reading is null or char_length(reading) between 1 and 40), -- ひらがな（検索用）
  note text check (note is null or char_length(note) <= 200), -- 提案者のメモ（どんな商品か）
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 200), -- 管理者から提案者へのメモ
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists category_proposals_user_idx on public.category_proposals (user_id, created_at desc);
create index if not exists category_proposals_status_idx on public.category_proposals (status, created_at);

alter table public.category_proposals enable row level security;

-- 権限そのものも外す（RLS と二重の守り）。登録は関数から、削除は自分の承認待ちだけ
revoke all on table public.category_proposals from anon;
revoke insert, update on table public.category_proposals from authenticated;
grant select, delete on table public.category_proposals to authenticated;

drop policy if exists "Users can read their own proposals" on public.category_proposals;
create policy "Users can read their own proposals" on public.category_proposals
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Users can withdraw their own pending proposals" on public.category_proposals;
create policy "Users can withdraw their own pending proposals" on public.category_proposals
  for delete to authenticated using (user_id = auth.uid() and status = 'pending');

-- 管理者が status を変えたら、確認した日時を入れる
create or replace function public.category_proposals_set_reviewed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
  end if;
  return new;
end;
$$;

drop trigger if exists category_proposals_reviewed_at on public.category_proposals;
create trigger category_proposals_reviewed_at
  before update on public.category_proposals
  for each row execute function public.category_proposals_set_reviewed_at();

-- 提案する（ログインしているユーザーだけ）。登録した提案の id を返す
--  エラーの文言（アプリで、日本語の案内に置き換える）:
--   not authenticated / proposal_invalid / proposal_limit / proposal_duplicate
create or replace function public.submit_category_proposal(
  p_main text,
  p_category text,
  p_sub text,
  p_product text,
  p_reading text default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_main text := nullif(btrim(p_main), '');
  v_category text := nullif(btrim(p_category), '');
  v_sub text := nullif(btrim(p_sub), '');
  v_product text := nullif(btrim(p_product), '');
  v_reading text := nullif(btrim(p_reading), '');
  v_note text := nullif(btrim(p_note), '');
  v_pending integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_main is null or v_category is null or v_product is null
     or char_length(v_main) > 40 or char_length(v_category) > 40
     or char_length(coalesce(v_sub, '')) > 40 or char_length(v_product) > 40
     or char_length(coalesce(v_reading, '')) > 40 or char_length(coalesce(v_note, '')) > 200
     or v_product in ('その他', '未選択')
     or (v_reading is not null and v_reading !~ '^[ぁ-ゖー]+$') then
    raise exception 'proposal_invalid' using errcode = '22023';
  end if;

  -- 同じ人が、同時に出し過ぎないように（同じ人の提案は、順番に処理する）
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select count(*) into v_pending
  from public.category_proposals
  where user_id = v_uid and status = 'pending';
  if v_pending >= 20 then
    raise exception 'proposal_limit' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.category_proposals
    where user_id = v_uid
      and status in ('pending', 'approved')
      and main_category = v_main and category = v_category
      and sub_category is not distinct from v_sub
      and product_name = v_product
  ) then
    raise exception 'proposal_duplicate' using errcode = 'P0001';
  end if;

  insert into public.category_proposals (user_id, main_category, category, sub_category, product_name, reading, note)
  values (v_uid, v_main, v_category, v_sub, v_product, v_reading, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_category_proposal(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_category_proposal(text, text, text, text, text, text) to authenticated;
