-- 自分のアカウントの削除（設定の「アカウントを削除する」）
--  （ほかの migration を実行したあとに、Supabase の SQL Editor で実行する。2 回実行してもよい）
--
--  ・消せるのは、ログインしている本人のアカウントだけ（引数は無い。auth.uid() の人を消す）
--  ・消すもの: その人のレシートと明細、認証のユーザー（auth.users）。
--    マイ店舗・設定・カテゴリの提案・解析の回数・管理者の表は、auth.users の削除と一緒に消える（on delete cascade）
--  ・ほかのユーザーのデータは消さない
--  ・管理者のアカウントは消せない（先に、別の管理者に、管理者の権限を外してもらう。管理者が 0 人になるのを防ぐ）
--  ・本人の確認（パスワード）は、アプリの画面で行ってから、この関数を呼ぶ

create or replace function public.delete_my_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if exists (select 1 from public.app_admins a where a.user_id = v_uid) then
    raise exception 'admin_account' using errcode = 'P0001';
  end if;

  -- レシートの表は、migration の外で作ったので、auth.users と一緒に消える設定か分からない。ここで、はっきり消す
  delete from public.receipt_items i
  where i.receipt_id in (select r.id from public.receipts r where r.user_id = v_uid);
  delete from public.receipts r where r.user_id = v_uid;

  -- 認証のユーザー（ほかの表は on delete cascade で一緒に消える）
  delete from auth.users u where u.id = v_uid;
  return true;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
