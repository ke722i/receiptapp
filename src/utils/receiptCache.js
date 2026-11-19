import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { fetchReceiptHistory, fetchReceiptImages } from './receiptDb';
import { onReceiptsChanged } from './receiptChanges';

/*
 * レシートの一覧と画像を、覚えておく（レシート一覧・店舗別一覧・店舗詳細を、速く開くため）
 *  ・一覧（明細つき・画像なし）: 1 回読んだら覚える。次に開いたときは、すぐ出す
 *    - 5 分たったら、出したあと、裏で読み直す（他の端末で登録した分も、反映する）
 *    - このアプリでの保存・編集・削除・分類の変更のあとは、覚えた一覧を捨てて、読み直す（古い内容を出さない）
 *  ・画像: 一覧には含めない（1 枚 100〜300KB あり、全部読むと遅い）。画面に見えた行の分だけ、まとめて読む。
 *    読んだ画像は、新しいものから 100 枚まで覚える
 *  ・ログイン・ログアウト・アカウントの切り替えのときは、全部捨てる（別のアカウントのレシートを出さない）
 *  ・覚えるのは、画面を開いているあいだだけ（再読み込みで消える。端末には保存しない）
 */

const STALE_MS = 5 * 60 * 1000;
const MAX_IMAGES = 100;
const IMAGE_BATCH = 6; // 1 回にまとめて読む画像の数（1 回の通信が大きくなりすぎないように）

let history = null; // { ownerId, data, at }
let historyRequest = null; // 読んでいる途中の Promise（同時に何回も読まない）
let generation = 0; // 捨てた回数。読んでいる途中に捨てたら、その結果は覚えない

const images = new Map(); // レシートの id → 画像（data URL など）。画像が無いレシートは null
const waiting = new Map(); // id → 画像を待っている resolve の一覧
let queue = new Set();
let timer = null;

/** 覚えた一覧と画像を、全部捨てる（ログイン・ログアウトのとき） */
export const clearReceiptCache = () => {
  history = null;
  historyRequest = null;
  generation += 1;
  images.clear();
};

// 保存・編集・削除のあとは、一覧を捨てる。削除したレシートの画像も捨てる
onReceiptsChanged(({ deletedIds = [], all = false } = {}) => {
  history = null;
  historyRequest = null;
  generation += 1;
  if (all) images.clear();
  deletedIds.forEach((id) => images.delete(String(id)));
});

// 別のアカウントに変わったら、全部捨てる
supabase.auth.onAuthStateChange((_event, session) => {
  const id = session?.user?.id || null;
  if (history && history.ownerId !== id) clearReceiptCache();
  if (!id) clearReceiptCache();
});

// 削除して「元に戻す」を待っているレシート（一覧に出さない。utils/undoToast.js）
const hidden = new Set();
const hiddenListeners = new Set();

/** レシートを、一覧から隠す・戻す（削除の「元に戻す」を待つあいだ） */
export const setReceiptHidden = (id, on) => {
  const key = String(id);
  if (on) hidden.add(key);
  else hidden.delete(key);
  hiddenListeners.forEach((fn) => fn());
};

const withoutHidden = (list) => (hidden.size === 0 ? list : list.filter((r) => !hidden.has(String(r.id))));

/** 覚えている一覧（なければ null） */
export const peekReceiptHistory = () => history?.data ?? null;

/**
 * 一覧を読む。覚えていて、新しければ、読まずに返す
 * @param {{ force?: boolean }} options force: 覚えていても読み直す
 * @returns {Promise<{ success: boolean, data?: object[], error?: string }>}
 */
export const loadReceiptHistory = ({ force = false } = {}) => {
  if (!force && history && Date.now() - history.at < STALE_MS) {
    return Promise.resolve({ success: true, data: history.data });
  }
  if (historyRequest) return historyRequest;
  const myGeneration = generation;
  historyRequest = fetchReceiptHistory().then((result) => {
    if (myGeneration === generation) {
      historyRequest = null;
      if (result.success) history = { ownerId: result.ownerId ?? null, data: result.data, at: Date.now() };
    }
    return result;
  });
  return historyRequest;
};

/**
 * 画面で使う一覧。覚えていれば、すぐ出す（loading にならない）。古ければ、裏で読み直して差し替える
 * @returns {{ receipts: object[], loading: boolean, errorMessage: string }}
 */
export function useReceiptHistory() {
  const [state, setState] = useState(() => {
    const cached = peekReceiptHistory();
    return cached ? { receipts: cached, loading: false, errorMessage: '' } : { receipts: [], loading: true, errorMessage: '' };
  });

  useEffect(() => {
    let alive = true;
    loadReceiptHistory().then((result) => {
      if (!alive) return;
      if (result.success) {
        setState((prev) => (prev.receipts === result.data && !prev.loading ? prev : { receipts: result.data, loading: false, errorMessage: '' }));
      } else {
        // すでに出している一覧があれば、そのまま（エラーで消さない）
        setState((prev) => (prev.loading ? { receipts: [], loading: false, errorMessage: result.error } : prev));
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  // 隠したレシートが変わったら、出し直す
  const [hiddenVersion, setHiddenVersion] = useState(0);
  useEffect(() => {
    const fn = () => setHiddenVersion((v) => v + 1);
    hiddenListeners.add(fn);
    return () => hiddenListeners.delete(fn);
  }, []);
  const receipts = useMemo(() => withoutHidden(state.receipts), [state.receipts, hiddenVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...state, receipts };
}

// ---------- 画像 ----------

const rememberImage = (key, value) => {
  images.delete(key);
  images.set(key, value);
  while (images.size > MAX_IMAGES) images.delete(images.keys().next().value);
};

/** 覚えている画像。まだ読んでいなければ undefined、画像が無いレシートは null */
export const peekReceiptImage = (id) => (images.has(String(id)) ? images.get(String(id)) : undefined);

const flushImages = async () => {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  const chunks = [];
  for (let i = 0; i < ids.length; i += IMAGE_BATCH) chunks.push(ids.slice(i, i + IMAGE_BATCH));
  await Promise.all(
    chunks.map(async (chunk) => {
      const result = await fetchReceiptImages(chunk);
      const found = new Map((result.data || []).map((row) => [String(row.id), row.image_url || null]));
      chunk.forEach((key) => {
        const value = result.success ? (found.get(key) ?? null) : null;
        if (result.success) rememberImage(key, value); // 失敗したときは覚えない（次に見えたとき、読み直す）
        (waiting.get(key) || []).forEach((resolve) => resolve(value));
        waiting.delete(key);
      });
    })
  );
};

/** レシート 1 枚の画像を読む（近い時間に頼まれた分は、まとめて 1 回で読む） */
export const loadReceiptImage = (id) => {
  const key = String(id);
  if (images.has(key)) return Promise.resolve(images.get(key));
  return new Promise((resolve) => {
    if (!waiting.has(key)) waiting.set(key, []);
    waiting.get(key).push(resolve);
    queue.add(key);
    if (!timer) timer = setTimeout(flushImages, 30);
  });
};

/**
 * 画面で使う、レシートの画像
 *  ・レシートが画像を持っていれば（撮った直後など）、それを使う
 *  ・持っていなければ、読む。targetRef を渡すと、その要素が画面に近づいたときに読む（一覧の行）
 * @returns {string | null | undefined} 画像。null は画像なし、undefined は読み込み中
 */
export function useReceiptImage(receipt, targetRef = null) {
  const inline = receipt?.image_url || receipt?.imageSrc || null;
  const id = receipt?.id ?? null;
  const [loaded, setLoaded] = useState({ id: null, src: undefined });

  useEffect(() => {
    if (inline || id == null || peekReceiptImage(id) !== undefined) return undefined;
    let alive = true;
    const start = () =>
      loadReceiptImage(id).then((src) => {
        if (alive) setLoaded({ id, src });
      });
    const el = targetRef?.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      start();
      return () => {
        alive = false;
      };
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [id, inline, targetRef]);

  if (inline) return inline;
  if (id == null) return null;
  if (loaded.id === id && loaded.src !== undefined) return loaded.src;
  return peekReceiptImage(id);
}
