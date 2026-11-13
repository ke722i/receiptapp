-- カテゴリの提案に、「今ある小分類に、新しい商品名」を足す（「新しい中分類」「今ある中分類に、新しい小分類」は、そのまま）
--  （20261111100000_category_proposals_categories.sql を実行したあとに、実行する。2 回実行してもよい）
--
--  提案の種類（kind）:
--   ・category: 新しい中分類（小分類も一緒に提案してよい）
--   ・sub:      今ある中分類に、新しい小分類
--   ・product:  今ある小分類に、新しい商品名（sub_category・product_name は必須）。←今回、また作れるようにした
--               以前の形式（11/11 より前）で自動的に見送りにしたものも product のまま残っている（admin_note で見分ける）
--
-- 管理者の確認用（SQL Editor）: 承認待ちを、同じ提案の人数が多い順に
--   select kind, main_category, category, sub_category, product_name,
--          count(*) as people, min(created_at) as first_at, string_agg(note, ' / ') as notes
--   from public.category_proposals
--   where status = 'pending'
--   group by 1, 2, 3, 4, 5
--   order by people desc, first_at;
--
-- まとめて承認する例（商品名の提案を、全員分）:
--   update public.category_proposals
--   set status = 'approved', admin_note = '次の更新で追加します'
--   where status = 'pending' and kind = 'product' and main_category = '冷凍'
--     and category = '冷凍野菜・フルーツ・素材（未調理）' and sub_category = '冷凍フルーツ'
--     and product_name = '冷凍ライチ';

-- ---------- 1. 種類の制約（product は、小分類も必須。以前の形式の行は、そのまま通す） ----------
alter table public.category_proposals drop constraint if exists category_proposals_kind_check;
alter table public.category_proposals
  add constraint category_proposals_kind_check check (
    (kind = 'product' and product_name is not null)
    or (kind = 'category' and product_name is null)
    or (kind = 'sub' and product_name is null and sub_category is not null)
  );

-- ---------- 2. 提案の関数を入れ替える（商品名 p_product を足す） ----------
-- 以前の関数（5 つの引数）は消す。同じ名前の関数が 2 つあると、アプリから呼べなくなるため
drop function if exists public.submit_category_proposal(text, text, text, text, text);

-- 提案する（ログインしているユーザーだけ）。登録した提案の id を返す
--  p_kind: 'category'（新しい中分類。p_sub は任意の新しい小分類）
--         'sub'（今ある中分類 p_category に、新しい小分類 p_sub）
--         'product'（今ある小分類 p_sub に、新しい商品名 p_product）
--  エラーの文言（アプリで、日本語の案内に置き換える）:
--   not authenticated / proposal_invalid / proposal_limit / proposal_duplicate
--  名前が、今の表（Excel）にすでにあるかどうかは、DB では分からないので、アプリ側で確かめる（管理者も承認のときに見る）
create or replace function public.submit_category_proposal(
  p_kind text,
  p_main text,
  p_category text,
  p_sub text default null,
  p_note text default null,
  p_product text default null
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
  v_product text := nullif(btrim(p_product), '');
  v_pending integer;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- 商品名は、product のときだけ使う（ほかの種類では捨てる）
  if v_kind is distinct from 'product' then
    v_product := null;
  end if;

  if v_kind is null or v_kind not in ('category', 'sub', 'product')
     or v_main is null or v_category is null
     or (v_kind in ('sub', 'product') and v_sub is null)
     or (v_kind = 'product' and v_product is null)
     or char_length(v_main) > 40 or char_length(v_category) > 40
     or char_length(coalesce(v_sub, '')) > 40 or char_length(coalesce(v_product, '')) > 40
     or char_length(coalesce(v_note, '')) > 200
     or v_main in ('その他', '未選択') or v_category in ('その他', '未選択')
     or coalesce(v_sub, '') in ('その他', '未選択') or coalesce(v_product, '') in ('その他', '未選択') then
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
      and product_name is not distinct from v_product
  ) then
    raise exception 'proposal_duplicate' using errcode = 'P0001';
  end if;

  insert into public.category_proposals (user_id, kind, main_category, category, sub_category, product_name, note)
  values (v_uid, v_kind, v_main, v_category, v_sub, v_product, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_category_proposal(text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_category_proposal(text, text, text, text, text, text) to authenticated;
