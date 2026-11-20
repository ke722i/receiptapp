import { supabase } from '../services/supabaseClient';

/*
 * 分類の修正を、DB に記録する（管理者が確認して、承認したものは、次の読み取りから自動で使われる）
 *  ・記録するのは、印字名と「直す前 → 直した後」の分類だけ（店・購入日・値段は送らない）
 *  ・DB の関数 record_category_corrections（supabase/migrations/20261121000000_category_corrections.sql）が、
 *    分類が変わっていない行・直した後が未選択／その他の行を、捨てる
 *  ・記録できなくても、登録・保存は止めない（失敗はログだけ）
 */

/** 画面の形（camelCase）の明細から、分類だけを取り出す */
export const pathOf = (item) => ({
  main: item?.mainCategory || '',
  category: item?.category || '未選択',
  sub: item?.subCategory || '',
  product: item?.productName || '',
});

const samePath = (a, b) => a.main === b.main && a.category === b.category && a.sub === b.sub && a.product === b.product;

/**
 * @param {{ itemName: string, from: object, to: object }[]} changes from・to は pathOf の形
 * @param {'confirm' | 'detail'} source confirm = 登録前の確認画面、detail = 登録後のレシート詳細
 */
export const recordCategoryCorrections = async (changes, source) => {
  const rows = (changes || [])
    .filter((c) => c.itemName && !samePath(c.from, c.to))
    .slice(0, 50)
    .map((c) => ({ item_name: String(c.itemName).slice(0, 100), from: c.from, to: c.to }));
  if (rows.length === 0) return 0;
  try {
    const { data, error } = await supabase.rpc('record_category_corrections', { p_rows: rows, p_source: source });
    if (error) throw error;
    return data || 0;
  } catch (error) {
    console.error('record category corrections failed:', error?.message || error);
    return 0;
  }
};
