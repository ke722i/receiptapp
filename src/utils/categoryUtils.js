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

// ---------- ホームのカテゴリの「その他」（編集画面と同じ階層に出す） ----------
/*
 * 「その他」を選んだ明細は、その階層より下が空（null）で保存される。それを開くためのパス（「その他」の箱）:
 *  ・大分類が その他: { main: その他, category: その他, sub: null, product: null }
 *  ・中分類が その他: { main: 大分類, category: その他, sub: null, product: null }
 *  ・小分類が その他: { main, category, sub: その他, product: null }
 *  ・商品名が その他: { main, category, sub, product: その他 }
 * 表（Excel）には入れない。検索の候補・カテゴリの検索にも出さない。マイ店舗の価格比較は出さない（何でも入る箱なので）
 */
export const otherMainPath = () => ({ main: OTHER, category: OTHER, sub: null, product: null });
export const otherMidPath = (main) => ({ main, category: OTHER, sub: null, product: null });
export const otherSubPath = (main, category) => ({ main, category, sub: OTHER, product: null });
export const otherProductPath = (main, category, sub) => ({ main, category, sub: sub || null, product: OTHER });

/** 「その他」の箱を指すパスか（どこかの階層が「その他」） */
export const isOtherPath = (path) =>
  !!path && [path.main, path.category, path.sub, path.product].includes(OTHER);

/** 商品詳細で開けるパスか（表の商品、または「その他」の箱） */
export const isOpenablePath = (path) => !!path && (!!path.product || isOtherPath(path));

/**
 * 画面に出す名前（商品詳細の見出し・閲覧履歴）。表の商品は商品名、「その他」の箱は「○○のその他」
 *  例: 小分類「チョコレート・キャンディ」の商品名その他 → 「チョコレート・キャンディのその他」、
 *      中分類「菓子」の小分類その他 → 「菓子のその他」、大分類「常温」の中分類その他 → 「常温のその他」、大分類その他 → 「その他」
 */
export const pathTitle = (path) => {
  if (!path) return '';
  if (path.product && path.product !== OTHER) return path.product;
  if (path.product === OTHER) return `${path.sub || path.category}の${OTHER}`;
  if (path.sub === OTHER) return `${path.category}の${OTHER}`;
  if (path.category === OTHER && path.main && path.main !== OTHER) return `${path.main}の${OTHER}`;
  return OTHER;
};

/** 場所の表示（例: 「常温 > 菓子」）。大分類が「その他」なら「その他」だけ（「その他 > その他」にしない） */
export const formatPlace = (path) => {
  if (!path) return '';
  if (path.main === OTHER) return OTHER;
  return [path.main, path.category, path.sub].filter(Boolean).join(' > ');
};

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