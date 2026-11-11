import { supabase } from '../services/supabaseClient';

/*
 * カテゴリ（中分類・小分類）の提案（Supabase）
 *  ・登録は DB の関数 submit_category_proposal からだけ（承認待ちの上限・重複は、関数が確かめる）
 *  ・読めるのは自分の提案だけ。取り下げ（削除）は、自分の承認待ちだけ（RLS）
 *  ・承認・見送りは、管理者が Supabase の Table Editor で行う
 */

const DB_ERROR_MESSAGES = {
  proposal_limit: '承認待ちの提案は、20件までです。結果が出るまで、お待ちください。',
  proposal_duplicate: 'この提案は、すでに出しています。',
  proposal_invalid: '入力の内容を確認してください。',
  'not authenticated': 'ログインし直してください。',
};

const toMessage = (error, fallback) => {
  const text = String(error?.message || '');
  const key = Object.keys(DB_ERROR_MESSAGES).find((k) => text.includes(k));
  if (!key) console.error(fallback, error);
  return key ? DB_ERROR_MESSAGES[key] : fallback;
};

/** 自分の提案（新しい順） */
export const fetchMyProposals = async () => {
  const { data, error } = await supabase
    .from('category_proposals')
    .select('id, kind, main_category, category, sub_category, product_name, note, status, admin_note, created_at, reviewed_at')
    .order('created_at', { ascending: false });
  if (error) return { success: false, error: toMessage(error, '提案の一覧を読み込めませんでした。') };
  return { success: true, data: data || [] };
};

/**
 * 提案する
 * @param {{ kind, main, category, sub, note }} value validateProposal で、そろえた値
 */
export const submitCategoryProposal = async (value) => {
  const { data, error } = await supabase.rpc('submit_category_proposal', {
    p_kind: value.kind,
    p_main: value.main,
    p_category: value.category,
    p_sub: value.sub || null,
    p_note: value.note || null,
  });
  if (error) return { success: false, error: toMessage(error, '提案を送れませんでした。') };
  return { success: true, data };
};

/** 承認待ちの提案を取り下げる（承認待ちでなければ、何も消えない） */
export const withdrawCategoryProposal = async (id) => {
  const { data, error } = await supabase.from('category_proposals').delete().eq('id', id).select('id');
  if (error) return { success: false, error: toMessage(error, '取り下げられませんでした。') };
  if (!data || data.length === 0) {
    return { success: false, error: 'この提案は、すでに確認済みのため、取り下げられません。' };
  }
  return { success: true };
};
