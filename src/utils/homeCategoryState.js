/*
 * ホームのカテゴリ一覧（大分類 > 中分類 > 小分類 > 商品名）から商品などを開いて、戻ってきたときの状態
 *  ・開いていた分類（どこまで開いていたか）と、押した行の位置を、画面を開いているあいだだけ覚える（再読み込みで消える）
 *  ・戻ってきたときは、開いていた分類を元に戻し、押した行までスクロールする（レシート一覧の戻る動作と同じ。utils/receiptListState.js）
 *  ・ホームを、ほかの画面から開いたとき（覚えていないとき）は、今までどおり、閉じた状態・いちばん上から
 */

const state = { open: null, key: null };

/** カテゴリ一覧の行の識別（押した行までスクロールするための印） */
export const navKeyOf = (path) => JSON.stringify([path.main ?? null, path.category ?? null, path.sub ?? null, path.product ?? null]);

/** カテゴリ一覧から開く直前に呼ぶ */
export const rememberHomeCategory = (open, key) => {
  state.open = { ...open };
  state.key = key;
};

/** ホームを開くときに呼ぶ。戻ってきたなら、開いていた分類と行の印を返す（なければ null） */
export const peekHomeCategory = () => (state.key == null ? null : { open: { ...state.open }, key: state.key });

/** 行へのスクロールが済んだら呼ぶ */
export const clearHomeCategory = () => {
  state.open = null;
  state.key = null;
};

/** 戻ってきた行までスクロールする。行が見つからなくても、状態は消す */
export const scrollToReturnedCategoryRow = (key) => {
  if (key != null && typeof document !== 'undefined') {
    const row = Array.from(document.querySelectorAll('[data-nav-key]')).find((el) => el.getAttribute('data-nav-key') === key);
    if (row) row.scrollIntoView({ block: 'center' });
  }
  clearHomeCategory();
};
