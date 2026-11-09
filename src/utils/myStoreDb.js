import { supabase } from '../services/supabaseClient';

/*
 * マイ店舗と、価格データの匿名共有（Supabase）
 *  ・他のユーザーのデータは、DB の関数（get_my_store_prices / list_comparable_stores）を通してだけ読める。
 *    返ってくるのは店舗名・価格・容量・値引きの有無・自分のものかだけで、
 *    他のユーザーのユーザーID・レシート・購入日は返らない。
 *  ・共有は本人の同意（オプトイン）。設定画面のスイッチで切り替える（初期はオフ）
 */

const fail = (error, fallback) => {
  console.error(fallback, error);
  return { success: false, error: error?.message || fallback };
};

/** 登録しているマイ店舗（登録順） */
export const fetchMyStores = async () => {
  const { data, error } = await supabase
    .from('my_stores')
    .select('id, store_name, created_at')
    .order('created_at', { ascending: true });
  if (error) return fail(error, 'マイ店舗の取得に失敗しました。');
  return { success: true, data: data || [] };
};

/** マイ店舗に登録する */
export const addMyStore = async (storeName) => {
  const name = String(storeName || '').trim();
  if (!name) return { success: false, error: '店舗名が空です。' };
  const { error } = await supabase.from('my_stores').insert([{ store_name: name }]);
  if (error) {
    if (error.code === '23505') return { success: false, error: 'この店舗はすでに登録されています。' };
    return fail(error, 'マイ店舗の登録に失敗しました。');
  }
  return { success: true };
};

/** マイ店舗から外す */
export const removeMyStore = async (id) => {
  const { error } = await supabase.from('my_stores').delete().eq('id', id);
  if (error) return fail(error, 'マイ店舗の削除に失敗しました。');
  return { success: true };
};

/** 登録できる店舗名の一覧（自分のレシートの店と、共有している人のレシートの店） */
export const fetchComparableStores = async () => {
  const { data, error } = await supabase.rpc('list_comparable_stores');
  if (error) return fail(error, '店舗の一覧の取得に失敗しました。');
  return { success: true, data: (data || []).map((row) => row.store_name) };
};

/**
 * マイ店舗での、指定した商品の価格（自分のレシート＋共有している人のレシート）
 * @param {{ main, category, sub, product }} path 商品の 4 階層
 * @param {number} days 何日前までのデータを使うか（1〜183）
 */
export const fetchMyStorePrices = async (path, days) => {
  if (!path?.product) return { success: true, data: [] };
  const { data, error } = await supabase.rpc('get_my_store_prices', {
    p_main: path.main,
    p_category: path.category,
    p_sub: path.sub || null,
    p_product: path.product,
    p_days: days,
  });
  if (error) return fail(error, '価格の取得に失敗しました。');
  return {
    success: true,
    data: (data || []).map((row) => ({
      storeName: row.store_name,
      price: Number(row.price) || 0,
      volume: row.volume || null,
      isDiscount: Boolean(row.is_discount),
      isMine: Boolean(row.is_mine),
      purchaseDate: row.purchase_date || null, // 自分のレシートのときだけ入る
    })),
  };
};

/** 価格データを匿名で提供しているか（設定が無ければ false） */
export const fetchSharePrices = async () => {
  const { data, error } = await supabase.from('user_settings').select('share_prices').maybeSingle();
  if (error) return fail(error, '設定の取得に失敗しました。');
  return { success: true, data: Boolean(data?.share_prices) };
};

/** 価格データの匿名提供を切り替える */
export const updateSharePrices = async (share) => {
  const { data, error } = await supabase.rpc('set_share_prices', { p_share: Boolean(share) });
  if (error) return fail(error, '設定の保存に失敗しました。');
  return { success: true, data: Boolean(data) };
};
