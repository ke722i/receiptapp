// 印字名（レシートに印字された商品名）のゆれをそろえて、「同じ商品」ごとにまとめる処理

/**
 * 印字名を、比べるための形にそろえる（表示には使わない）
 *  1. 半角カナ・全角英数を通常の形に（ﾁｲｶﾜｸﾞﾐ → チイカワグミ）、大文字小文字をそろえる
 *  2. カッコの中、税の表記（税込・軽減など）を除く
 *  3. 空白・記号を除く
 *  4. 容量・個数の表記（5袋・100g・×2 など）を除く
 *  5. カタカナをひらがなに（チイカワグミ → ちいかわぐみ）
 */
export const normalizeItemName = (name) => {
  let text = String(name || '').normalize('NFKC').toLowerCase();
  text = text.replace(/[(（[［【〔][^)）\]］】〕]*[)）\]］】〕]/g, '');
  text = text.replace(/税込|税抜|軽減税率|軽減|内税|外税/g, '');
  text = text.replace(/[×]\s*\d+/g, ''); // 記号を除く前に（× が消えると数字だけ残るため）
  text = text.replace(/[^\p{L}\p{N}]/gu, '');
  text = text.replace(/\d+(?:\.\d+)?(?:kg|g|ml|l|cc|個|袋|入|枚|本|粒|パック|pcs|pc|p|こ|つ|コ|ケ)/g, '');
  return text.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
};

/**
 * 購入履歴を、印字名のゆれをそろえた「同じ商品」ごとに分け、それぞれの最安の 1 件を返す。安い順。
 *  ・同じ価格なら、購入日が新しいほうを採用する
 *  ・印字名が無いものは、まとめて 1 つにする
 * @param {{ itemName, price, dateValue }[]} history
 * @returns {{ key: string, cheapest: object, count: number }[]}
 */
export const cheapestByItemName = (history) => {
  const groups = new Map();
  (history || []).forEach((item) => {
    const key = normalizeItemName(item.itemName);
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { key, cheapest: item, count: 1 });
      return;
    }
    group.count += 1;
    const isCheaper = item.price < group.cheapest.price;
    const isSameButNewer =
      item.price === group.cheapest.price &&
      String(item.dateValue || '') > String(group.cheapest.dateValue || '');
    if (isCheaper || isSameButNewer) group.cheapest = item;
  });
  return [...groups.values()].sort(
    (a, b) =>
      a.cheapest.price - b.cheapest.price ||
      String(b.cheapest.dateValue || '').localeCompare(String(a.cheapest.dateValue || ''))
  );
};
