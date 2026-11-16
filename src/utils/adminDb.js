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

// ---------- 利用状況・アカウント・お知らせ（管理者だけ。migrations/20261116100000_admin_tools.sql） ----------

const adminMessage = (error, fallback) => {
  const text = String(error?.message || '');
  if (text.includes('not_admin')) return '管理者のアカウントではありません。';
  if (text.includes('admin_self')) return '自分自身の管理者の権限は外せません（別の管理者が外してください）。';
  if (text.includes('announcement_invalid')) return 'タイトル（60 文字まで）と本文（500 文字まで）を確認してください。';
  if (text.includes('announcement_ends_required')) return '重要度「高」のお知らせには、期限を入れてください。';
  if (text.includes('announcement_expired')) return '期限が過ぎています。今より後の日時にしてください。';
  if (text.includes('user_invalid')) return 'アカウントが見つかりません。';
  console.error(fallback, error);
  return fallback;
};

const rpc = async (name, args, fallback) => {
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { success: false, error: adminMessage(error, fallback) };
  return { success: true, data };
};

/** 利用状況の数字（1 行） */
export const fetchAdminStats = async () => {
  const result = await rpc('admin_stats', {}, '利用状況を読み込めませんでした。');
  return result.success ? { success: true, data: (result.data || [])[0] || null } : result;
};

/** アカウントの一覧（ログイン ID・管理者・テスト用・共有・レシート数・解析の回数） */
export const fetchAdminUsers = async () => {
  const result = await rpc('admin_list_users', {}, 'アカウントの一覧を読み込めませんでした。');
  return result.success ? { success: true, data: result.data || [] } : result;
};

export const setTestAccount = (userId, value) =>
  rpc('admin_set_test_account', { p_user: userId, p_value: value }, 'テスト用の設定を変えられませんでした。');

export const setAdminRole = (userId, value) =>
  rpc('admin_set_admin', { p_user: userId, p_value: value }, '管理者の権限を変えられませんでした。');

/** お知らせ（下書き・公開終了も） */
export const fetchAdminAnnouncements = async () => {
  const result = await rpc('admin_list_announcements', {}, 'お知らせを読み込めませんでした。');
  return result.success ? { success: true, data: result.data || [] } : result;
};

/** お知らせを作る（id が null）・直す */
export const saveAnnouncement = ({ id = null, title, body, active, level = 'mid', endsAt = null, showOnLogin = false }) =>
  rpc(
    'admin_save_announcement',
    { p_id: id, p_title: title, p_body: body, p_active: active, p_level: level, p_ends_at: endsAt, p_show_on_login: showOnLogin },
    'お知らせを保存できませんでした。'
  );

export const deleteAnnouncement = (id) => rpc('admin_delete_announcement', { p_id: id }, 'お知らせを消せませんでした。');
