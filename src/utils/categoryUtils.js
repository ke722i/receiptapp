import { CATEGORY_TREE } from '../constants/categoryData';

/*
 * カテゴリは 4 階層: 大分類(main) > 中分類(category) > 小分類(sub) > 商品名(product)
 * 同じ名前の中分類・商品が別の場所にあるため（例: 常温/冷凍 の「麺類」）、
 * 商品は名前ではなく「パス」 { main, category, sub, product } で区別する。
 */

// ---------- 表から一覧を作る（起動時に1度だけ） ----------

// 全商品のパス一覧（表の並び順）
export const PRODUCT_PATHS = (() => {
  const list = [];
  CATEGORY_TREE.forEach((top) => {
    top.categories.forEach((mid) => {
      (mid.subCategories || []).forEach((sub) => {
        (sub.items || []).forEach((product) => {
          list.push({ main: top.name, category: mid.name, sub: sub.name, product });
        });
      });
      // 小分類が無い古い形式の表にも対応
      (mid.items || []).forEach((product) => {
        list.push({ main: top.name, category: mid.name, sub: null, product });
      });
    });
  });
  return list;
})();

// ---------- パスの基本操作 ----------

/** パスを一意な文字列に（比較・React の key・履歴の重複判定に使う） */
export const productKey = (path) =>
  path ? [path.main, path.category, path.sub, path.product].map((v) => v || '').join('>') : '';

/** 表示用の文字列（例: "常温 > 麺類 > 乾麺"）。withProduct で商品名まで付ける */
export const formatPath = (path, { withProduct = false } = {}) => {
  if (!path) return '';
  const parts = [path.main, path.category, path.sub];
  if (withProduct) parts.push(path.product);
  return parts.filter(Boolean).join(' > ');
};

/** 商品名から、その商品のパスをすべて返す（同名が複数の場所にあれば複数） */
export const findProductPaths = (productName) =>
  PRODUCT_PATHS.filter((p) => p.product === productName);

/** 表に実在する商品のパスかどうか */
export const isValidProductPath = (path) =>
  !!path && PRODUCT_PATHS.some((p) => productKey(p) === productKey(path));

// ---------- 編集画面のプルダウン用 ----------

const uniq = (arr) => Array.from(new Set(arr));

/** 大分類の一覧 */
export const getMainCategories = () => CATEGORY_TREE.map((top) => top.name);

/** 大分類に属する中分類の一覧 */
export const getMidCategories = (main) => {
  const top = CATEGORY_TREE.find((t) => t.name === main);
  return top ? uniq(top.categories.map((m) => m.name)) : [];
};

/** 大分類＋中分類に属する小分類の一覧 */
export const getSubCategories = (main, category) =>
  uniq(
    PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub).map((p) => p.sub)
  );

/** 大分類＋中分類＋小分類に属する商品名の一覧 */
export const getProducts = (main, category, sub) =>
  uniq(
    PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub === sub).map(
      (p) => p.product
    )
  );

// ---------- 自動判定（AI 解析が失敗したときの補助） ----------

/**
 * レシートの商品名から、いちばん長く一致した商品の 大分類＋中分類 を返す
 *  ※ 文字列の一致だけでは商品名までは決めきれないため、商品名・小分類は返さない
 * @returns {{ main: string, category: string } | null}
 */
export const matchCategoryPathFromTree = (itemName) => {
  if (!itemName) return null;
  let best = null;
  let bestLength = 0;
  PRODUCT_PATHS.forEach((p) => {
    if (p.product.length > bestLength && itemName.includes(p.product)) {
      bestLength = p.product.length;
      best = { main: p.main, category: p.category };
    }
  });
  return best;
};

/**
 * （互換用）中分類名だけを返す。見つからない場合は "その他"
 */
export const matchCategoryFromTree = (itemName) =>
  matchCategoryPathFromTree(itemName)?.category || 'その他';