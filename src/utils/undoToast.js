/*
 * 「元に戻す」つきの、画面の下のお知らせ（削除・上書きのあとに出す）
 *  ・削除は、確認のポップアップを出さずに、すぐ画面から消し、数秒のあいだ「元に戻す」を出す。
 *    その間に「元に戻す」を押さなければ、onCommit（DB からの削除など）を行う
 *  ・上書き（保存）は、すぐ保存し、「元に戻す」で前の内容に戻す（onUndo で、前の内容を保存し直す）
 *  ・出せるのは 1 つだけ。次のお知らせを出すときは、前のものを、すぐ確定（onCommit）する
 *  ・アプリを閉じる・別のアプリに切り替えたときも、すぐ確定する（消したはずのものが残らないように）
 */

const DEFAULT_MS = 6000;
let current = null; // { id, message, undoLabel, onUndo, onCommit, timer }
let nextId = 1;
const listeners = new Set();

const emit = () => listeners.forEach((fn) => fn(current));

/** お知らせが変わったときに呼ばれる関数を登録する。戻り値で、登録を消せる */
export const subscribeUndoToast = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const peekUndoToast = () => current;

const finish = (toast, undo) => {
  if (!toast || toast.done) return;
  toast.done = true;
  clearTimeout(toast.timer);
  if (current === toast) {
    current = null;
    emit();
  }
  const fn = undo ? toast.onUndo : toast.onCommit;
  if (!fn) return;
  Promise.resolve()
    .then(fn)
    .catch((error) => console.error('undo toast action failed:', error));
};

/**
 * お知らせを出す
 * @param {{ message: string, onUndo?: Function, onCommit?: Function, undoLabel?: string, ms?: number }} options
 *   onUndo が無いときは、「元に戻す」は出さない（ただのお知らせ）
 */
export const showUndoToast = ({ message, onUndo = null, onCommit = null, undoLabel = '元に戻す', ms = DEFAULT_MS }) => {
  finish(current, false); // 前のお知らせは、確定する
  const toast = { id: nextId++, message, undoLabel, onUndo, onCommit, done: false };
  toast.timer = setTimeout(() => finish(toast, false), ms);
  current = toast;
  emit();
  return toast.id;
};

/** 「元に戻す」を押したとき */
export const undoToast = () => finish(current, true);

/** 「✕」で閉じたとき（元に戻さずに、すぐ確定する） */
export const closeToast = () => finish(current, false);

if (typeof window !== 'undefined') {
  const commitNow = () => finish(current, false);
  window.addEventListener('pagehide', commitNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') commitNow();
  });
}
