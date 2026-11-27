// 分類を見直す: 「その他」以外の商品でも、印字名に、同じ中分類の別の商品名が入っていれば、移すかを聞く
//  例: 表に「ほうじ茶」を足したあと、前に「緑茶」で登録した「お〜いお茶 ほうじ茶」を、ほうじ茶へ移すか聞く
//  ・自動では変えない（ユーザーの指示。お知らせで聞いて、選んだものだけ直す）
//  ・「同じ商品」（印字名から容量などを除くと、商品名とぴったり同じ）は、最初からチェックを付ける。
//    ほかの言葉が付いているもの（例: 「ほうじ茶ラテ」「お〜いお茶 ほうじ茶」）は、別の商品のこともあるので、チェックを付けない
//  ・探す範囲は、同じ大分類・中分類の中だけ（範囲を広げると、関係のない一致が増えるため）
//  ・次のものは出さない: 印字名に、今の商品名が入っている（今の分類で合っている）／見つかった名前が、今の商品名の一部（例: 缶コーヒー → コーヒー。広い名前に移す意味がない）／
//    候補が 2 つ以上（決められない）／「その他」の商品（utils/reassignOther.js が受け持つ）／「このままにする」と決めた明細
import { PRODUCT_PATHS, productKey } from './categoryUtils';
import { foldForMatch, loadSkipIds } from './reassignOther';
import { isFixTarget } from './sameItemFix';
import { normalizeItemName } from './itemNameGroup';
import { fetchMyItemsForFix } from './receiptDb';

const MIN_NAME_LENGTH = 2;

// 中分類（大分類 + 中分類）ごとの、商品名の一覧（起動時に 1 度だけ作る）
const BY_CATEGORY = (() => {
  const map = new Map();
  PRODUCT_PATHS.forEach((path) => {
    const folded = foldForMatch(path.product);
    if (!path.product || folded.length < MIN_NAME_LENGTH) return;
    const k = `${path.main}>${path.category}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push({ path, folded });
  });
  return map;
})();

/**
 * 1 つの明細の、移し先の候補（1 つに決まるときだけ）
 * @param {{ itemName: string, path: { main, category, sub, product } }} row
 * @returns {{ to: object, match: 'same' | 'similar' } | null}
 */
export const recategorizeTarget = (row) => {
  if (!row || !isFixTarget(row.path)) return null;
  const printed = foldForMatch(row.itemName);
  const current = foldForMatch(row.path.product);
  if (!printed || !current) return null;
  if (printed.includes(current)) return null; // 今の商品名が入っている → 今の分類で合っている
  const list = BY_CATEGORY.get(`${row.path.main}>${row.path.category}`) || [];
  const hits = list.filter(
    (c) => productKey(c.path) !== productKey(row.path) && printed.includes(c.folded) && !current.includes(c.folded)
  );
  // 「麦茶」と「大麦茶」のように、一方が他方の一部なら、長いほうだけを残す
  const kept = hits.filter((a) => !hits.some((b) => b !== a && b.folded.length > a.folded.length && b.folded.includes(a.folded)));
  if (kept.length !== 1) return null;
  const to = kept[0].path;
  const core = foldForMatch(normalizeItemName(row.itemName)).replace(/\d+/g, ''); // 容量の数字だけ（例: 「ほうじ茶500」）も、同じ名前とみなす
  return { to, match: core === kept[0].folded ? 'same' : 'similar' };
};

/**
 * 自分の明細から、見直す候補を、移し先ごとにまとめる（SameItemFix の形）
 * @param {{ id, receiptId, itemName, path, purchaseDate, storeName }[]} rows fetchMyItemsForFix の結果
 * @param {(number|string)[]} skipIds 「このままにする」と決めた明細の id
 * @returns {{ source: { printName, path }, items: object[] }[]} 「同じ商品」がある移し先が上。中は、同じ → ほかの言葉付き、購入日の新しい順
 */
export const findRecategorize = (rows, skipIds = []) => {
  const skip = new Set((skipIds || []).map(String));
  const groups = new Map();
  (rows || []).forEach((row) => {
    if (skip.has(String(row.id))) return;
    const target = recategorizeTarget(row);
    if (!target) return;
    const k = productKey(target.to);
    if (!groups.has(k)) groups.set(k, { source: { printName: target.to.product, path: target.to }, items: [] });
    groups.get(k).items.push({ ...row, match: target.match });
  });
  const hasSame = (g) => g.items.some((i) => i.match === 'same');
  return [...groups.values()]
    .map((g) => ({
      ...g,
      items: g.items.sort(
        (a, b) =>
          (a.match === 'same' ? 0 : 1) - (b.match === 'same' ? 0 : 1) ||
          String(b.purchaseDate).localeCompare(String(a.purchaseDate))
      ),
    }))
    .sort((a, b) => (hasSame(a) ? 0 : 1) - (hasSame(b) ? 0 : 1) || b.items.length - a.items.length);
};

/** 自分の明細を読んで、見直す候補を探す（読めないときは、null） */
export const prepareRecategorize = async (userId) => {
  const result = await fetchMyItemsForFix();
  if (!result.success) return null;
  return findRecategorize(result.data, loadSkipIds(userId));
};
