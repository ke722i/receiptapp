// レシート一覧の絞り込み（店名・印字名の文字、購入日の期間）
import { normalizeForSearch } from './itemNameGroup';

/** 期間の選択肢。最初が既定（全期間）。days = 今日から何日前までか */
export const RECEIPT_PERIOD_OPTIONS = [
  { value: 'all', label: '全期間', days: null },
  { value: '30', label: '1か月', days: 30 },
  { value: '90', label: '3か月', days: 90 },
  { value: '183', label: '半年', days: 183 },
  { value: '365', label: '1年', days: 365 },
];

const toLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * レシートを絞り込む（新しい配列を返す）
 *  ・text: 店名か、明細の印字名に含まれる（空白・大文字小文字・全角半角の違いは区別しない）。空なら絞らない
 *  ・period: RECEIPT_PERIOD_OPTIONS の value。購入日がその期間のもの（購入日が無いレシートは、期間を選ぶと除く）
 */
export const filterReceipts = (receipts, { text = '', period = 'all', today = new Date() } = {}) => {
  const query = normalizeForSearch(text);
  const days = RECEIPT_PERIOD_OPTIONS.find((o) => o.value === period)?.days ?? null;
  let since = null;
  if (days) {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    since = toLocalDate(d);
  }
  return receipts.filter((r) => {
    if (since && !(r.purchase_date && r.purchase_date >= since)) return false;
    if (!query) return true;
    if (normalizeForSearch(r.store_name || '').includes(query)) return true;
    return (r.receipt_items || []).some((item) => normalizeForSearch(item.item_name || '').includes(query));
  });
};
