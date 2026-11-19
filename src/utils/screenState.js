/*
 * 別の画面へ移って、戻ってきたときに、元の状態（スクロールの位置・並び替えなど）に戻すための控え
 *  ・画面を開いているあいだだけ覚える（再読み込みで消える。端末には保存しない）
 *  ・商品詳細・購入履歴の一覧で使う（レシート一覧は receiptListState.js、ホームは homeCategoryState.js）
 *  ・key には、画面と商品を表す文字を使う（別の商品の控えで、戻さないように）
 */

const states = new Map();

/** 別の画面へ移る直前に呼ぶ。今の状態と、スクロールの位置を覚える */
export const rememberScreenState = (key, state = {}) => {
  states.set(key, { ...state, scrollY: typeof window !== 'undefined' ? window.scrollY : 0 });
};

/** 画面を開くときに呼ぶ。戻ってきたなら、覚えた状態（なければ null） */
export const peekScreenState = (key) => states.get(key) ?? null;

/** 控えを消す（あらためて開いたとき・戻し終わったとき） */
export const clearScreenState = (key) => {
  if (key === undefined) states.clear();
  else states.delete(key);
};

/** 覚えたスクロールの位置に戻す（行が並んだあとに 1 回だけ呼ぶ） */
export const restoreScroll = (state) => {
  if (!state || typeof window === 'undefined') return;
  // 描画が終わってから戻す（高さが足りないうちに戻すと、途中で止まる）
  requestAnimationFrame(() => window.scrollTo(0, state.scrollY || 0));
};
