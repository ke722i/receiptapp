import { supabase } from '../services/supabaseClient';

/*
 * 管理者画面（カテゴリの提案の承認・見送り）の呼び出し
 *  ・管理者かどうか・一覧・承認／見送りは、DB の関数（security definer）が、管理者だけに許す
 *    （supabase/migrations/20261116000000_admin_proposals.sql）。画面で隠すのは、見た目のためだけ
 *  ・管理者の登録は、SQL Editor で、オーナーが行う（アプリからは登録できない）
 */

const toMessage = (error, fallback) => {
  const text = String(error?.message || '');
  if (text.includes('not_admin')) return '管理者のアカウントではありません。';
  if (text.includes('proposal_invalid')) return '入力の内容を確認してください（メモは 200 文字まで）。';
  console.error(fallback, error);
  return fallback;
};

/** 管理者のアカウントか（関数がまだ無い・失敗したときは false） */
export const checkIsAdmin = async () => {
  const { data, error } = await supabase.rpc('is_app_admin');
  return !error && data === true;
};

/**
 * 提案の一覧（同じ提案は人数でまとめる）
 * @param {'pending' | 'approved' | 'rejected'} status
 * @returns {{ success: true, data: { kind, main_category, category, sub_category, product_name, people, first_at, reviewed_at, notes, admin_note, ids }[] } | { success: false, error }}
 */
export const fetchAdminProposals = async (status) => {
  const { data, error } = await supabase.rpc('admin_list_proposals', { p_status: status });
  if (error) return { success: false, error: toMessage(error, '提案の一覧を読み込めませんでした。') };
  return { success: true, data: data || [] };
};

/**
 * 承認・見送り・承認待ちに戻す（まとめた提案の id すべて）
 * @param {number[]} ids
 * @param {'approved' | 'rejected' | 'pending'} status
 * @param {string} [note] 提案した人へのメモ（通知に出る）
 */
export const decideProposals = async (ids, status, note) => {
  const { data, error } = await supabase.rpc('admin_decide_proposals', {
    p_ids: ids,
    p_status: status,
    p_note: note || null,
  });
  if (error) return { success: false, error: toMessage(error, '変更できませんでした。') };
  return { success: true, count: data ?? 0 };
};
