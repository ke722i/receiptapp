-- 商品の編集画面で、印字名から「分類の候補」を出す（ほかの人の直し方・管理者が承認した辞書・自分が前に選んだ分類）
--  （20261121000000_category_corrections.sql のあとに、Supabase の SQL Editor で実行する。2 回実行してもよい）
--
--  個人の情報:
--   ・返すのは、分類と人数・印（承認済み・自分）だけ。ユーザー ID・店・購入日・値段・ほかの人の印字名は返さない
--   ・ほかの人の直し方は、自分以外の 2 人以上が同じ分類に直したものだけ（1 人だけの直し方は、出さない）
--   ・管理者が見送りにした直し方は、出さない
--   ・自分の分（自分のレシート・自分の直し方）は、人数に関係なく出す
--   ・表は直接読めないまま（RLS は緩めない）。この関数からだけ

create or replace function public.suggest_categories(p_item_name text)
returns table (
  main_category text, category text, sub_category text, product_name text,
  people integer,    -- 同じ分類に直した、自分以外の人数
  approved boolean,  -- 管理者が承認した辞書にある
  mine boolean       -- 自分が前に選んだ（レシート・直し方）
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_key text;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_item_name is null or btrim(p_item_name) = '' or char_length(p_item_name) > 100 then
    return;
  end if;
  v_key := public.fold_item_name(p_item_name);

  return query
  with cand as (
    -- 管理者が承認した辞書
    select r.main_category as m, r.category as c, r.sub_category as s, r.product_name as p,
           0 as others, true as is_rule, false as is_mine
    from public.print_name_rules r
    where r.item_key = v_key
    union all
    -- ほかの人の直し方（見送りは除く。人数は、あとで数える）
    select cc.to_main, cc.to_category, cc.to_sub, cc.to_product,
           case when cc.user_id <> v_uid then 1 else 0 end, false, cc.user_id = v_uid
    from public.category_corrections cc
    where cc.item_key = v_key and cc.status <> 'rejected'
    union all
    -- 自分のレシートで、同じ印字名に付けた分類（未選択・その他は除く）
    select i.main_category, i.category, i.sub_category, i.product_name, 0, false, true
    from public.receipt_items i
    join public.receipts rc on rc.id = i.receipt_id
    where rc.user_id = v_uid
      and public.fold_item_name(i.item_name) = v_key
      and coalesce(i.main_category, '') not in ('', 'その他')
      and coalesce(i.category, '') not in ('', '未選択', 'その他')
      and coalesce(i.sub_category, '') <> 'その他'
      and coalesce(i.product_name, '') <> 'その他'
  ),
  others as (
    -- 自分以外の人数（同じ分類ごと）
    select cc.to_main as m, cc.to_category as c, cc.to_sub as s, cc.to_product as p,
           count(distinct cc.user_id)::integer as n
    from public.category_corrections cc
    where cc.item_key = v_key and cc.status <> 'rejected' and cc.user_id <> v_uid
    group by 1, 2, 3, 4
  ),
  g as (
    select cand.m, cand.c, cand.s, cand.p, bool_or(cand.is_rule) as is_rule, bool_or(cand.is_mine) as is_mine
    from cand
    group by 1, 2, 3, 4
  )
  select g.m, g.c, g.s, g.p, coalesce(o.n, 0), g.is_rule, g.is_mine
  from g
  left join others o
    on o.m = g.m and o.c = g.c and o.s is not distinct from g.s and o.p is not distinct from g.p
  where g.is_rule or g.is_mine or coalesce(o.n, 0) >= 2
  order by g.is_rule desc, coalesce(o.n, 0) desc, g.is_mine desc
  limit 5;
end;
$$;
revoke all on function public.suggest_categories(text) from public, anon;
grant execute on function public.suggest_categories(text) to authenticated;
