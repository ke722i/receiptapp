import { supabase } from '../services/supabaseClient';
import { notifyReceiptsChanged } from './receiptChanges';

/*
 * 自分のアカウントの削除（設定の「アカウントを削除する」）
 *  ・本人の確認: パスワードで、もう一度ログインできるかを確かめてから消す（ログインしたままの端末を、ほかの人が触っても消せないように）
 *  ・消すのは DB の関数 delete_my_account（supabase/migrations/20261119000000_delete_my_account.sql）。消せるのは本人だけ
 *  ・管理者のアカウントは消せない（関数がエラーを返す）
 */

const ERRORS = {
  admin_account: '管理者のアカウントは削除できません。別の管理者に、管理者の権限を外してもらってから、削除してください。',
  not_signed_in: 'ログインし直してから、もう一度お試しください。',
};

/**
 * @param {string} password 本人の確認のためのパスワード
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const deleteMyAccount = async (password) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.email) return { success: false, error: ERRORS.not_signed_in };

    // 本人の確認（パスワードが違えば、消さない）
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (authError) return { success: false, error: 'パスワードが違います。' };

    const { error } = await supabase.rpc('delete_my_account');
    if (error) {
      const key = Object.keys(ERRORS).find((k) => String(error.message || '').includes(k));
      return { success: false, error: key ? ERRORS[key] : 'アカウントを削除できませんでした。時間をおいて、もう一度お試しください。' };
    }
    notifyReceiptsChanged({ all: true });
    return { success: true };
  } catch (error) {
    console.error('Delete account failed:', error);
    return { success: false, error: 'アカウントを削除できませんでした。通信を確認して、もう一度お試しください。' };
  }
};

/**
 * 端末に覚えている、そのアカウントの控え（検索履歴・お気に入り・既読など）を消す
 *  キーの形は receipt_app_〇〇_<ユーザー ID>。保存したユーザー ID も、同じ人なら消す
 */
export const forgetLocalUserData = (userId) => {
  try {
    const suffix = `_${userId}`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith('receipt_app_') && key.endsWith(suffix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    if ((localStorage.getItem('receipt_app_saved_user_id') || '').toLowerCase() === String(userId).toLowerCase()) {
      localStorage.removeItem('receipt_app_saved_user_id');
    }
    ['receipt_app_user_id', 'receipt_app_avatar'].forEach((key) => localStorage.removeItem(key));
  } catch {
    // 消せなくても、アカウントは消えている
  }
};
