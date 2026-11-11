-- カテゴリの提案を、「商品名」から「カテゴリ（中分類・小分類）」に変える
--  （20261111000000_category_proposals.sql を実行したあとに、実行する。2 回実行してもよい）
--
--  提案の種類（kind）:
--   ・category: 新しい中分類（小分類も一緒に提案してよい。sub_category が空なら中分類だけ）
--   ・sub:      今ある中分類に、新しい小分類（sub_category は必須）
--   ・product:  以前の形式（商品名の提案）。新しくは作れない。承認待ちだったものは「見送り」にして、メモで知らせる
--  商品名は AI が決めるもので、ユーザーは提案しない。承認したカテゴリに入れる商品名は、管理者が決めて Excel に足す。
--  大分類（常温・冷蔵・冷凍・日用品）は、提案できない（選ぶだけ）。
--
-- 管理者の確認用（SQL Editor）: 承認待ちを、同じ提案の人数が多い順に
--   select kind, main_category, category, sub_category,
--          count(*) as people, min(created_at) as first_at, string_agg(note, ' / ') as notes
--   from public.category_proposals
--   where status = 'pending'
--   group by 1, 2, 3, 4
--   order by people desc, first_at;
--
-- まとめて承認する例（同じ提案を、全員分）:
--   update public.category_proposals
--   set status = 'approved', admin_note = '次の更新で追加します'
--   where status = 'pending' and kind = 'sub' and main_category = '常温' and category = '菓子'
--     and sub_category = 'ゼリー';

-- ---------- 1. 提案の種類 ----------
alter table public.category_proposals
  add column if not exists kind text;

-- 以前の形式（商品名の提案）は product とする
update public.category_proposals
set kind = 'product'
where kind is null;

-- 以前の形式の承認待ちは、見送りにして、提案し直してもらう（データは消さない）
update public.category_proposals
set status = 'rejected',
    admin_note = '提案の対象が「カテゴリ（中分類・小分類）」に変わりました。お手数ですが、もう一度提案してください。'
where kind = 'product' and status = 'pending';

alter table public.category_proposals
  alter column kind set not null,
  alter column kind set default 'category',
  alter column product_name drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'category_proposals_kind_check') then
    alter table public.category_proposals
      add constraint category_proposals_kind_check check (
        (kind = 'product' and product_name is not null)
        or (kind = 'category' and product_name is null)
        or (kind = 'sub' and product_name is null and sub_category is not null)
      );
  end if;
end $$;

-- ---------- 2. 提案の関数を入れ替える ----------
-- 以前の関数（商品名を受け取る）は消す。呼べなくなる
drop function if exists public.submit_category_proposal(text, text, text, text, text, text);

-- 提案する（ログインしているユーザーだけ）。登録した提案の id を返す
--  p_kind: 'category'（新しい中分類。p_sub は任意の新しい小分類）／'sub'（今ある中分類 p_category に、新しい小分類 p_sub）
--  エラーの文言（アプリで、日本語の案内に置き換える）:
--   not authenticated / proposal_invalid / proposal_limit / proposal_duplicate
--  名前が、今の表（Excel）にすでにあるかどうかは、DB では分からないので、アプリ側で確かめる（管理者も承認のときに見る）
create or replace function public.submit_category_proposal(
  p_kind text,
  p_main text,
  p_category text,
  p_sub text default null,
  p_note text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kind text := nullif(btrim(p_kind), '');
  v_main text := nullif(btrim(p_main), '');
  v_category text := nullif(btrim(p_category), '');
  v_sub text := nullif(btrim(p_sub), '');
  v_note text := nullif(btrim(p_note), '');
  v_pending integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if v_kind is null or v_kind not in ('category', 'sub')
     or v_main is null or v_category is null
     or (v_kind = 'sub' and v_sub is null)
     or char_length(v_main) > 40 or char_length(v_category) > 40
     or char_length(coalesce(v_sub, '')) > 40 or char_length(coalesce(v_note, '')) > 200
     or v_main in ('その他', '未選択') or v_category in ('その他', '未選択')
     or coalesce(v_sub, '') in ('その他', '未選択') then
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
      and kind = v_kind
      and main_category = v_main and category = v_category
      and sub_category is not distinct from v_sub
  ) then
    raise exception 'proposal_duplicate' using errcode = 'P0001';
  end if;

  insert into public.category_proposals (user_id, kind, main_category, category, sub_category, note)
  values (v_uid, v_kind, v_main, v_category, v_sub, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_category_proposal(text, text, text, text, text) from public, anon;
grant execute on function public.submit_category_proposal(text, text, text, text, text) to authenticated;
