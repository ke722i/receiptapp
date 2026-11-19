import { OTHER } from './categoryUtils';

/*
 * 直してほしい明細（未選択・その他・商品名なし）を見分ける。確認画面・レシート詳細・レシート一覧で、色を付ける
 *  ・未選択: 中分類が決まっていない
 *  ・商品名なし: 中分類までで、商品名が決まっていない（AI が中分類だけ答えたときなど）
 *  ・その他: どこかの階層に「その他」を選んだ（自分で選んだこともあるので、色は控えめ）
 */

/**
 * @param {{ mainCategory?, category?, subCategory?, productName?, main_category?, sub_category?, product_name? }} item
 *   画面の形（camelCase）でも、DB の形（snake_case）でもよい
 * @returns {'未選択' | '商品名なし' | 'その他' | null}
 */
export const needsCheckReason = (item) => {
  if (!item) return null;
  const main = item.mainCategory ?? item.main_category ?? '';
  const category = item.category ?? '';
  const sub = item.subCategory ?? item.sub_category ?? '';
  const product = item.productName ?? item.product_name ?? '';
  if (!category || category === '未選択') return '未選択';
  if (main === OTHER || category === OTHER || sub === OTHER || product === OTHER) return 'その他';
  if (!product) return '商品名なし';
  return null;
};

/** レシートの明細のうち、直してほしいものの数 */
export const countNeedsCheck = (items = []) => items.filter((item) => needsCheckReason(item)).length;
