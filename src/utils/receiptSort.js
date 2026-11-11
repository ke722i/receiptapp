// レシート一覧の並び替え（画面に依存しない処理）

/** 並び替えの選択肢。最初のものが既定（購入日） */
export const RECEIPT_SORT_OPTIONS = [
  { value: 'purchaseDate', label: '購入日（新しい順）' },
  { value: 'storeName', label: '店舗名（あいうえお順）' },
  { value: 'createdAt', label: '登録日（新しい順）' },
];
export const DEFAULT_RECEIPT_SORT = 'purchaseDate';

const text = (value) => String(value || '');

// 新しい順（降順）。空のものは最後
const compareDesc = (a, b) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
};

/**
 * レシートを並び替えた、新しい配列を返す（元の配列は変えない）
 *  ・購入日: 新しい順。同じ日は、登録日の新しい順
 *  ・店舗名: あいうえお順（店舗名が無いものは最後）。同じ店舗は、購入日の新しい順
 *  ・登録日: 新しい順（登録日の列が無いデータは、最後）
 * @param {{ id, store_name, purchase_date, created_at }[]} receipts
 * @param {'purchaseDate' | 'storeName' | 'createdAt'} sortKey
 */
export const sortReceipts = (receipts, sortKey = DEFAULT_RECEIPT_SORT) => {
  const byPurchase = (a, b) =>
    compareDesc(text(a.purchase_date), text(b.purchase_date)) ||
    compareDesc(text(a.created_at), text(b.created_at));

  const compare = {
    purchaseDate: byPurchase,
    storeName: (a, b) => {
      const sa = text(a.store_name);
      const sb = text(b.store_name);
      if (!sa && sb) return 1;
      if (sa && !sb) return -1;
      return sa.localeCompare(sb, 'ja') || byPurchase(a, b);
    },
    createdAt: (a, b) => compareDesc(text(a.created_at), text(b.created_at)) || byPurchase(a, b),
  }[sortKey] || byPurchase;

  return [...(receipts || [])].sort(compare);
};
