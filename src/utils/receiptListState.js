import { RECEIPT_SORT_OPTIONS, DEFAULT_RECEIPT_SORT } from './receiptSort';

/*
 * レシートの一覧（レシート一覧・店舗詳細）の、「戻ってきたときの状態」
 *  ・並び替え: 端末に保存する（どの一覧も共通。次に開いたときも、前の指定のまま）
 *  ・絞り込み（店名・期間）と、開いたレシート: 画面を開いているあいだだけ覚える（再読み込みで消える）
 *    - レシート詳細から戻ったときは、絞り込みを元に戻し、開いたレシートの行までスクロールする
 *    - ホームなどから、あらためて開いたときは、絞り込みなし・いちばん上から（今までどおり）
 */

const SORT_STORAGE_KEY = 'receipt_app_receipt_sort';

export const loadReceiptSort = () => {
  try {
    const value = localStorage.getItem(SORT_STORAGE_KEY);
    if (RECEIPT_SORT_OPTIONS.some((option) => option.value === value)) return value;
  } catch {
    // localStorage が使えないときは、既定の並び替え
  }
  return DEFAULT_RECEIPT_SORT;
};

export const saveReceiptSort = (sortKey) => {
  try {
    localStorage.setItem(SORT_STORAGE_KEY, sortKey);
  } catch {
    // 保存できなくても、画面の動作には影響しない
  }
};

// 開いたレシートの id と、そのときの絞り込み（レシート一覧）
const returnState = { receiptId: null, searchText: '', period: 'all', needsOnly: false };

/** レシートを開く直前に呼ぶ。戻ってきたとき、この行まで戻す */
export const rememberOpenedReceipt = (receiptId, filter = {}) => {
  returnState.receiptId = receiptId;
  returnState.searchText = filter.searchText ?? '';
  returnState.period = filter.period ?? 'all';
  returnState.needsOnly = Boolean(filter.needsOnly);
};

/** 一覧を開くときに呼ぶ。詳細から戻ってきたなら、絞り込みと行の id を返す（なければ null） */
export const peekReturnState = () => (returnState.receiptId == null ? null : { ...returnState });

/** 行へのスクロールが済んだら呼ぶ（次にあらためて開いたときは、いちばん上から） */
export const clearReturnState = () => {
  returnState.receiptId = null;
  returnState.searchText = '';
  returnState.period = 'all';
  returnState.needsOnly = false;
};

/** 戻ってきた行までスクロールする。行が見つからなくても、状態は消す */
export const scrollToReturnedReceipt = (receiptId) => {
  if (receiptId != null && typeof document !== 'undefined') {
    const row = Array.from(document.querySelectorAll('[data-receipt-id]')).find((el) => el.getAttribute('data-receipt-id') === String(receiptId));
    if (row) row.scrollIntoView({ block: 'center' });
  }
  clearReturnState();
};
