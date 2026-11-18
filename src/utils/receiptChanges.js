/*
 * レシートが変わったこと（保存・編集・削除・分類の変更）を、覚えている一覧（utils/receiptCache.js）に知らせる
 *  receiptDb.js（書き込む側）と receiptCache.js（覚える側）が、お互いを読み込まないように、間に置く
 */

const listeners = new Set();

/** 変わったときに呼ばれる関数を登録する。戻り値で、登録を消せる */
export const onReceiptsChanged = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/**
 * レシートが変わったことを知らせる
 * @param {{ deletedIds?: (string|number)[], all?: boolean }} detail deletedIds: 消したレシート。all: 全部消した
 */
export const notifyReceiptsChanged = (detail = {}) => {
  listeners.forEach((fn) => {
    try {
      fn(detail);
    } catch (error) {
      console.error('receipts changed listener failed:', error);
    }
  });
};
