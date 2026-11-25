// 同じ商品の分類をそろえる: 商品の分類を直したとき、自分の過去のレシートで、同じ・似た商品が、違う分類になっていたら知らせる
//  ・「同じ」: 印字名をそろえて（normalizeItemName。全角半角・空白・記号・カッコ・税・容量・カナの違いを除く）完全に同じ。最初からチェックを付ける
//  ・「似ている」: そろえた印字名の、片方がもう片方を含む（短いほうが 3 文字以上）か、2 文字ずつの重なりが大きい（0.6 以上）。
//    店ごとの書き方の違い（例: 「天然水」と「サントリー天然水」）を拾う。別の商品のこともあるので、チェックは付けない（ユーザーが選ぶ）
//  ・自分のレシートだけ。書き換えるのは、ユーザーが「直す」を押したときだけ
import { normalizeItemName } from './itemNameGroup';
import { isValidProductPath, isOtherPath, productKey } from './categoryUtils';
import { fetchMyItemsForFix } from './receiptDb';

const SIMILAR_MIN_CONTAIN = 3; // 含む、とみなす短いほうの文字数
const SIMILAR_DICE = 0.6; // 2 文字ずつの重なり（Dice 係数）

const bigrams = (text) => {
  const list = [];
  for (let i = 0; i < text.length - 1; i += 1) list.push(text.slice(i, i + 2));
  return list;
};

const dice = (a, b) => {
  const x = bigrams(a);
  const y = bigrams(b);
  if (x.length === 0 || y.length === 0) return 0;
  const rest = [...y];
  let hit = 0;
  x.forEach((g) => {
    const i = rest.indexOf(g);
    if (i >= 0) {
      hit += 1;
      rest.splice(i, 1);
    }
  });
  return (2 * hit) / (x.length + y.length);
};

/**
 * 2 つの印字名（そろえた形）の近さ
 * @returns {'same' | 'similar' | null}
 */
export const nameMatch = (keyA, keyB) => {
  if (!keyA || !keyB) return null;
  if (keyA === keyB) return 'same';
  const [short, long] = keyA.length <= keyB.length ? [keyA, keyB] : [keyB, keyA];
  if (short.length >= SIMILAR_MIN_CONTAIN && long.includes(short)) return 'similar';
  if (short.length >= SIMILAR_MIN_CONTAIN && dice(keyA, keyB) >= SIMILAR_DICE) return 'similar';
  return null;
};

/** 直す先に使える分類（商品名まで決まっていて、「その他」でなく、今の表にある） */
export const isFixTarget = (path) => !!path && !!path.product && !isOtherPath(path) && isValidProductPath(path);

/**
 * 直した商品（sources）と、同じ・似た過去の明細を探す
 * @param {{ printName: string, path: { main, category, sub, product } }[]} sources 直した商品と、直した後の分類
 * @param {{ id, receiptId, itemName, path, purchaseDate, storeName }[]} pastRows 自分の明細（fetchMyItemsForFix）
 * @param {{ excludeReceiptId?: any, excludeItemIds?: any[] }} [options] 今のレシート・今の明細は除く
 * @returns {{ source: { printName, path }, items: { id, receiptId, itemName, path, purchaseDate, storeName, match: 'same'|'similar' }[] }[]}
 *   直す先ごと（同じ印字名・同じ分類の sources は 1 つにまとめる）。直す先は、「同じ」がある先が上・「似ている」だけの先が下。明細は、同じ → 似ている、購入日の新しい順。1 つの明細は 1 か所にだけ入る（同じが優先）
 */
export const findSameItemFixes = (sources, pastRows, { excludeReceiptId = null, excludeItemIds = [] } = {}) => {
  const groups = [];
  const seenGroup = new Map(); // 印字名（そろえた形）+ 分類 → group
  (sources || []).forEach((src) => {
    if (!isFixTarget(src.path)) return;
    const key = normalizeItemName(src.printName);
    if (!key) return;
    const id = `${key}\u0000${productKey(src.path)}`;
    if (seenGroup.has(id)) return;
    const group = { source: { printName: src.printName, path: src.path }, key, items: [] };
    seenGroup.set(id, group);
    groups.push(group);
  });
  if (groups.length === 0) return [];

  const excluded = new Set((excludeItemIds || []).map(String));
  (pastRows || []).forEach((row) => {
    if (excluded.has(String(row.id))) return;
    if (excludeReceiptId !== null && excludeReceiptId !== undefined && String(row.receiptId) === String(excludeReceiptId)) return;
    const rowKey = normalizeItemName(row.itemName);
    if (!rowKey) return;
    // いちばん近い直し先（同じ → 似ている。同じ近さなら、先に直したもの）
    let best = null;
    groups.forEach((group) => {
      const match = nameMatch(group.key, rowKey);
      if (!match) return;
      if (!best || (best.match === 'similar' && match === 'same')) best = { group, match };
    });
    if (!best) return;
    if (productKey(row.path) === productKey(best.group.source.path)) return; // すでに同じ分類
    best.group.items.push({ ...row, match: best.match });
  });

  // 「同じ商品」がある直す先を上に、「似ている」だけの直す先を下に（同じ順位の中は、直した順のまま）
  const hasSame = (g) => g.items.some((i) => i.match === 'same');
  return groups
    .filter((group) => group.items.length > 0)
    .map(({ source, items }) => ({
      source,
      items: items.sort(
        (a, b) =>
          (a.match === 'same' ? 0 : 1) - (b.match === 'same' ? 0 : 1) ||
          String(b.purchaseDate).localeCompare(String(a.purchaseDate))
      ),
    }))
    .sort((a, b) => (hasSame(a) ? 0 : 1) - (hasSame(b) ? 0 : 1));
};

/** 「同じ」の明細の数（似ているものは数えない） */
export const countSameItems = (groups) => (groups || []).reduce((n, g) => n + g.items.filter((i) => i.match === 'same').length, 0);
/** 明細の数（同じ・似ている） */
export const countAllItems = (groups) => (groups || []).reduce((n, g) => n + g.items.length, 0);

/** 画面の商品（camelCase）の分類 */
export const itemPath = (item) => ({
  main: item?.mainCategory || '',
  category: item?.category || '未選択',
  sub: item?.subCategory || null,
  product: item?.productName || null,
});

const TIMEOUT_MS = 8000; // 読み込みが遅いときは、知らせずに進む（登録・保存の流れを止めない）

/**
 * 直した商品について、自分の過去のレシートを読み、同じ・似た商品を探す（読めないときは、空）
 * @param {{ printName, path }[]} sources
 * @param {object} [options] findSameItemFixes の options
 */
export const prepareSameItemFix = async (sources, options = {}) => {
  if (!(sources || []).some((s) => isFixTarget(s.path))) return [];
  const result = await Promise.race([
    fetchMyItemsForFix(),
    new Promise((resolve) => setTimeout(() => resolve({ success: false }), TIMEOUT_MS)),
  ]);
  if (!result.success) return [];
  return findSameItemFixes(sources, result.data, options);
};
