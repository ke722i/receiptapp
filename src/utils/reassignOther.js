import { PRODUCT_PATHS, OTHER, productKey, formatPath } from './categoryUtils';
import { normalizeText, hiraganaToKatakana } from './searchUtils';

/*
 * 「その他」で登録した商品を、あとから増えたカテゴリ（商品名）へ移す
 *  ・AI は使わない。レシートの印字名に、商品名が含まれているかだけで決める（文字の一致）
 *  ・探す範囲は、その商品が入っている「その他」の箱の中だけ（例: 常温 > 飲料 > お茶 の商品名その他 → お茶の商品名だけ）
 *  ・確実なもの（候補が 1 つに決まる）は自動で移す。決められないもの（候補が複数・印字名に商品名がない）は、
 *    「その他を見直す」の画面で、ユーザーが選ぶ
 *  ・自動で移したものは、通知から「元に戻す」ができる（戻したものは、二度と自動では移さない）
 */

const MIN_NAME_LENGTH = 2; // 1 文字の商品名（例: 「米」）は、別の言葉の一部になりやすいので、文字の一致には使わない

// 全角半角・大文字小文字・ひらがなとカタカナ・空白と記号の違いを、そろえる（検索と同じ考え方）
export const foldForMatch = (text) =>
  hiraganaToKatakana(normalizeText(String(text ?? '')))
    .normalize('NFKC')
    .replace(/[\s・･\-ー_()（）[\]【】「」『』.,、。:;!！?？*＊]/g, '');

// 商品名の一致の判定を速くするため、起動時に 1 度だけ作る
const FOLDED_PATHS = PRODUCT_PATHS.map((path) => ({ path, folded: foldForMatch(path.product) }));

/**
 * 「その他」の箱を求める（どの階層より下が「その他」か）
 * @param {{ main_category, category, sub_category, product_name }} row 明細の行
 * @returns {{ main: string, category?: string, sub?: string, level: 'category'|'sub'|'product' } | null}
 *   「その他」の箱でなければ null。大分類が「その他」のときは、探す範囲が広すぎるため null
 */
export const otherBoxOf = (row) => {
  const main = row.main_category;
  if (!main || main === OTHER) return null;
  if (row.category === OTHER) return { main, level: 'category' };
  if (!row.category || row.category === '未選択') return null;
  if (row.sub_category === OTHER) return { main, category: row.category, level: 'sub' };
  if (row.product_name === OTHER) return { main, category: row.category, sub: row.sub_category || null, level: 'product' };
  return null;
};

/** 箱の中にある、表の商品のパス一覧 */
export const candidatesInBox = (box) =>
  PRODUCT_PATHS.filter(
    (p) =>
      p.main === box.main &&
      (box.category === undefined || p.category === box.category) &&
      (box.sub === undefined || (p.sub || null) === (box.sub || null))
  );

/**
 * 印字名に含まれている商品名（箱の中）を探す
 *  ・「麦茶」と「大麦茶」のように、一方が他方の一部なら、長いほうだけを残す
 * @returns {object[]} 一致した商品のパス（同じ名前が別の小分類にもあれば、複数）
 */
export const matchProducts = (itemName, box) => {
  const folded = foldForMatch(itemName);
  if (!folded) return [];
  const inBox = new Set(candidatesInBox(box).map(productKey));
  const hits = FOLDED_PATHS.filter(
    ({ path, folded: name }) => name.length >= MIN_NAME_LENGTH && inBox.has(productKey(path)) && folded.includes(name)
  );
  // 一方が他方の一部になっている一致は、短いほうを捨てる
  const kept = hits.filter((a) => !hits.some((b) => b !== a && b.folded.length > a.folded.length && b.folded.includes(a.folded)));
  return kept.map((h) => h.path);
};

const toPlace = (row) => ({
  main: row.main_category,
  category: row.category,
  sub: row.sub_category || null,
  product: row.product_name || null,
});

/** 「その他」の箱の表示（例: 「常温 > 飲料 > お茶 の商品名その他」） */
export const describeBox = (box) => {
  const place = formatPath({ main: box.main, category: box.category, sub: box.sub });
  const what = { category: '中分類', sub: '小分類', product: '商品名' }[box.level];
  return `${place}（${what}が「その他」）`;
};

/**
 * 「その他」の明細を、自動で移すもの と 見直すもの に分ける
 * @param {{ id, item_name, main_category, category, sub_category, product_name }[]} rows 「その他」を含む明細
 * @param {(number|string)[]} skipIds 移さない・見直さないと決めた明細の id
 * @returns {{
 *   auto: { id, itemName, from, to }[],        // 確実（候補が 1 つ）→ 自動で移す
 *   review: { id, itemName, box, from, candidates: object[], suggested: object[] }[] // 決められない → ユーザーが選ぶ
 * }}
 */
export const planReassign = (rows, skipIds = []) => {
  const skip = new Set(skipIds.map(String));
  const auto = [];
  const review = [];
  (rows || []).forEach((row) => {
    if (skip.has(String(row.id))) return;
    const box = otherBoxOf(row);
    if (!box) return;
    const candidates = candidatesInBox(box);
    if (candidates.length === 0) return; // 箱の中に商品が無い（今のところ移し先が無い）
    const hits = matchProducts(row.item_name, box);
    if (hits.length === 1) {
      auto.push({ id: row.id, itemName: row.item_name, from: toPlace(row), to: hits[0] });
    } else {
      review.push({ id: row.id, itemName: row.item_name, box, from: toPlace(row), candidates, suggested: hits });
    }
  });
  return { auto, review };
};

/** 見直す明細を、同じ印字名・同じ箱でまとめる（まとめて直せるように） */
export const groupReview = (review) => {
  const map = new Map();
  review.forEach((r) => {
    const key = `${foldForMatch(r.itemName)}|${describeBox(r.box)}`;
    if (!map.has(key)) map.set(key, { key, itemName: r.itemName, box: r.box, candidates: r.candidates, suggested: r.suggested, ids: [], from: r.from });
    map.get(key).ids.push(r.id);
  });
  return [...map.values()];
};

/** 表の商品の一覧が変わったかを調べる印（変わったときだけ、自動で移す処理を動かす） */
export const categoryTableFingerprint = () => {
  let hash = 5381;
  PRODUCT_PATHS.forEach((p) => {
    const text = productKey(p);
    for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  });
  return `${PRODUCT_PATHS.length}:${hash}`;
};

// ---------- 端末に覚えること（ユーザーごと） ----------
const key = (name, userId) => `receipt_app_reassign_${name}_${userId}`;
const readJson = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (k, value) => {
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    // 保存できなくても、この画面では動く
  }
};

export const loadFingerprint = (userId) => readJson(key('fp', userId), '');
export const saveFingerprint = (userId, fp) => writeJson(key('fp', userId), fp);

/** 移さない・見直さないと決めた明細の id（元に戻したもの・「このままにする」を押したもの） */
export const loadSkipIds = (userId) => {
  const list = readJson(key('skip', userId), []);
  return Array.isArray(list) ? list : [];
};
export const addSkipIds = (userId, ids) => writeJson(key('skip', userId), [...new Set([...loadSkipIds(userId), ...ids])].slice(-2000));

/**
 * 自動で移した記録（通知に出す。新しい順。20 回分まで）
 *  { id, at, moves: [{ id, name, from, to }], reviewCount, undone }
 */
export const loadRuns = (userId) => {
  const list = readJson(key('runs', userId), []);
  return Array.isArray(list) ? list : [];
};
export const saveRuns = (userId, runs) => writeJson(key('runs', userId), runs.slice(0, 20));
export const addRun = (userId, run) => saveRuns(userId, [run, ...loadRuns(userId)]);
export const markRunUndone = (userId, runId) =>
  saveRuns(
    userId,
    loadRuns(userId).map((r) => (r.id === runId ? { ...r, undone: true } : r))
  );
