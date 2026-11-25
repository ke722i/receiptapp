// 「前の分類」: 自分が前に登録した商品と、同じ商品（印字名のゆれをそろえて同じ）が、違う分類になっていたら知らせる（確認画面）
//  ・分類は、自動では変えない。ユーザーが「この分類にする」を押したときだけ変える
//  ・自分のレシートだけを見る（fetchMyItemNames。商品名まで決まっている明細）。ほかの人のデータは使わない
//  ・同じ印字名に、前の分類が複数あれば、いちばん新しい購入日のもの
//  ・印字名のそろえ方は normalizeItemName（半角全角・大文字小文字・空白・記号・カッコ・税・容量の表記・カタカナとひらがなの違いを除く）
import { normalizeItemName } from './itemNameGroup';
import { isValidProductPath, isOtherPath } from './categoryUtils';

/**
 * 自分の明細から、印字名（そろえた形）→ 前の分類 の表を作る
 * @param {{ itemName, path, purchaseDate }[]} rows 購入日の新しい順（fetchMyItemNames の結果）
 * @returns {Map<string, { main, category, sub, product }>}
 */
export const buildPastCategoryIndex = (rows) => {
  const index = new Map();
  (rows || []).forEach((row) => {
    const key = normalizeItemName(row.itemName);
    if (!key || index.has(key)) return; // 先に来たもの（新しいもの）を使う
    const path = row.path;
    // 今の表に無い分類（表が変わって消えたもの）・「その他」は、知らせない
    if (!path || isOtherPath(path) || !isValidProductPath(path)) return;
    index.set(key, { main: path.main, category: path.category, sub: path.sub || null, product: path.product });
  });
  return index;
};

const samePath = (path, item) =>
  path.main === (item.mainCategory || '') &&
  path.category === (item.category || '') &&
  (path.sub || '') === (item.subCategory || '') &&
  (path.product || '') === (item.productName || '');

/**
 * その商品の「前の分類」。今の分類と同じ・前の記録が無いときは null
 * @param {Map} index buildPastCategoryIndex の結果
 * @param {{ printName, mainCategory, category, subCategory, productName }} item 確認画面の商品
 */
export const pastCategoryOf = (index, item) => {
  if (!index || !item) return null;
  const key = normalizeItemName(item.printName);
  if (!key) return null;
  const path = index.get(key);
  if (!path || samePath(path, item)) return null;
  return path;
};

/** 商品に、前の分類を入れる（新しい商品の形を返す） */
export const applyPastCategory = (item, path) => ({
  ...item,
  mainCategory: path.main,
  category: path.category,
  subCategory: path.sub || '',
  productName: path.product || '',
});
