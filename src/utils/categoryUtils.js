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

// ---------- 「その他」 ----------
/*
 * 「その他」は表（Excel）には入れず、編集画面のプルダウンの末尾にコードで足す。
 *  （表に入れると、検索の候補や価格比較に「その他」が大量に混ざるため）
 *  ・その他を選んだ階層より下は「選択不要」で、空（null）で保存する
 *  ・大分類がその他のときは、中分類も「その他」にする（中分類の空は「未選択」の意味になるため）
 *  ・AI が当てはめられなかった明細は「未選択」のまま。「その他」は人が選んだものだけ
 */
export const OTHER = 'その他';

const uniq = (arr) => Array.from(new Set(arr));

// 選択肢があれば末尾に「その他」を付ける（選択肢が無い階層には付けない）
const withOther = (list) => (list.length > 0 ? uniq([...list, OTHER]) : []);

// ---------- 編集画面のプルダウン用（どれも末尾に「その他」が付く） ----------

/** 大分類の一覧 */
export const getMainCategories = () => withOther(CATEGORY_TREE.map((top) => top.name));

/** 大分類に属する中分類の一覧（大分類がその他・未選択なら空） */
export const getMidCategories = (main) => {
  const top = CATEGORY_TREE.find((t) => t.name === main);
  return top ? withOther(uniq(top.categories.map((m) => m.name))) : [];
};

/** 大分類＋中分類に属する小分類の一覧（中分類がその他・未選択なら空） */
export const getSubCategories = (main, category) =>
  withOther(
    uniq(
      PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub).map((p) => p.sub)
    )
  );

/** 大分類＋中分類＋小分類に属する商品名の一覧（小分類がその他・未選択なら空） */
export const getProducts = (main, category, sub) =>
  withOther(
    uniq(
      PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub === sub).map(
        (p) => p.product
      )
    )
  );

/**
 * 編集画面で 1 つの階層を選び直したときの、明細のカテゴリの新しい値。
 *  上の階層を変えたら、それより下は選び直しになるので空に戻す。
 * @param {{ mainCategory, category, subCategory, productName }} item
 * @param {'main' | 'category' | 'sub' | 'product'} level
 * @param {string} value 選んだ値（'' は「選択してください」）
 */
export const applyCategoryChange = (item, level, value) => {
  if (level === 'main') {
    return {
      ...item,
      mainCategory: value,
      // 大分類がその他なら中分類もその他（選択不要）。それ以外は選び直し
      category: value === OTHER ? OTHER : '未選択',
      subCategory: '',
      productName: '',
    };
  }
  if (level === 'category') {
    return { ...item, category: value || '未選択', subCategory: '', productName: '' };
  }
  if (level === 'sub') {
    return { ...item, subCategory: value, productName: '' };
  }
  return { ...item, productName: value };
};