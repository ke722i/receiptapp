import { supabase } from '../services/supabaseClient';
import { getMainCategories, getMidCategories, getSubCategories, getProducts, OTHER } from './categoryUtils';

/*
 * 印字名から、分類の候補を読む（商品の編集画面）。DB の関数 suggest_categories
 *  （supabase/migrations/20261124200000_category_suggestions.sql）
 *  ・候補: 管理者が承認した辞書／自分以外の 2 人以上が同じ分類に直したもの／自分が前に選んだ分類（最大 5 つ）
 *  ・返ってくるのは、分類と人数・印だけ（ユーザー ID などは返らない）
 *  ・今の表に無い分類（表が変わって消えたもの）は、捨てる
 *  ・読めないとき（SQL 未実行・通信の失敗）は、候補なし（画面はそのまま使える）
 */

const fold = (name) => String(name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

// 画面を開いているあいだ、同じ印字名は読み直さない（印字名をそろえた形 → 候補の配列）
const cache = new Map();

const isValidPath = (p) => {
  if (!p.main || p.main === OTHER || !getMainCategories().includes(p.main)) return false;
  if (!p.category || p.category === OTHER || !getMidCategories(p.main).includes(p.category)) return false;
  if (p.sub && (p.sub === OTHER || !getSubCategories(p.main, p.category).includes(p.sub))) return false;
  if (p.product && (!p.sub || p.product === OTHER || !getProducts(p.main, p.category, p.sub).includes(p.product))) return false;
  return true;
};

/** 覚えている候補（まだ読んでいなければ undefined） */
export const peekCategorySuggestions = (itemName) => cache.get(fold(itemName));

/**
 * @param {string} itemName レシートの印字名
 * @returns {Promise<{ main, category, sub, product, people, approved, mine }[]>}
 */
export const fetchCategorySuggestions = async (itemName) => {
  const key = fold(itemName);
  if (!key || key.length > 100) return [];
  if (cache.has(key)) return cache.get(key);
  try {
    const { data, error } = await supabase.rpc('suggest_categories', { p_item_name: String(itemName).trim() });
    if (error) throw error;
    const list = (data || [])
      .map((r) => ({
        main: r.main_category,
        category: r.category,
        sub: r.sub_category || null,
        product: r.product_name || null,
        people: Number(r.people) || 0,
        approved: !!r.approved,
        mine: !!r.mine,
      }))
      .filter(isValidPath);
    cache.set(key, list);
    return list;
  } catch (error) {
    console.warn('分類の候補を読めませんでした', error?.message || error);
    return []; // 失敗は覚えない（次に開いたとき、もう一度読む）
  }
};
