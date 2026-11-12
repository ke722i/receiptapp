import { CATEGORY_TREE, CUSTOM_READING_MAP, CATEGORY_READING_MAP } from '../constants/categoryData';
import { normalizeForSearch, matchesItemSearch } from './itemNameGroup';

// カテゴリツリーから全アイテム名を抽出
export const getAllCategoryItems = () => {
  const itemSet = new Set();
  CATEGORY_TREE.forEach((topCat) => {
    topCat.categories.forEach((mainCat) => {
      if (mainCat.subCategories) {
        mainCat.subCategories.forEach((subCat) => {
          subCat.items.forEach((item) => itemSet.add(item));
        });
      }
      if (mainCat.items) {
        mainCat.items.forEach((item) => itemSet.add(item));
      }
    });
  });
  return Array.from(itemSet);
};

// 全角/半角統一、英小文字化
export const normalizeText = (str) => {
  if (!str) return '';
  const normalized = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  );
  return normalized.toLowerCase().trim();
};

// ひらがな -> カタカナ変換
export const hiraganaToKatakana = (str) =>
  str.replace(/[\u3041-\u3096]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));

// カタカナ -> ひらがな変換
export const katakanaToHiragana = (str) =>
  str.replace(/[\u30a1-\u30f6]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0x60));

// 全アイテムの読みマップ構築
export const buildItemReadingMap = () => {
  const allItems = getAllCategoryItems();
  const readingMap = {};

  allItems.forEach((item) => {
    const customReading = CUSTOM_READING_MAP[item] || '';
    readingMap[item] = `${item} ${customReading}`;
  });

  return readingMap;
};

// リアルタイム検索フィルタリング（優先度順ソート ＆ 最大10件制限）
export const filterSearchSuggestions = (searchQuery, itemReadingMap) => {
  if (!searchQuery.trim()) return [];

  const normQuery = normalizeText(searchQuery);
  const kataQuery = hiraganaToKatakana(normQuery);
  const hiraQuery = katakanaToHiragana(normQuery);

  const allItems = getAllCategoryItems();

  const exactMatches = [];      // 1. 完全一致
  const startsWithMatches = []; // 2. 前方一致（「た〜」で始まる）
  const includesMatches = [];   // 3. 部分一致（途中に「〜た〜」が含まれる）

  allItems.forEach((item) => {
    const normItem = normalizeText(item);
    const rawReading = itemReadingMap[item] ? normalizeText(itemReadingMap[item]) : '';
    const readingsOnly = rawReading.replace(normItem, '').trim();
    const readingTokens = readingsOnly.split(' ');

    // 1. 完全一致判定
    const isExact =
      normItem === normQuery ||
      normItem === kataQuery ||
      normItem === hiraQuery ||
      readingTokens.some((r) => r === normQuery || r === kataQuery || r === hiraQuery);

    if (isExact) {
      exactMatches.push(item);
      return;
    }

    // 2. 前方一致判定
    const isStartsWith =
      normItem.startsWith(normQuery) ||
      normItem.startsWith(kataQuery) ||
      normItem.startsWith(hiraQuery) ||
      readingTokens.some(
        (r) => r.startsWith(normQuery) || r.startsWith(kataQuery) || r.startsWith(hiraQuery)
      );

    if (isStartsWith) {
      startsWithMatches.push(item);
      return;
    }

    // 3. 部分一致判定
    const isIncludes =
      normItem.includes(normQuery) ||
      normItem.includes(kataQuery) ||
      normItem.includes(hiraQuery) ||
      readingsOnly.includes(normQuery) ||
      readingsOnly.includes(kataQuery) ||
      readingsOnly.includes(hiraQuery);

    if (isIncludes) {
      includesMatches.push(item);
    }
  });

  // 重複を排除し、完全一致 ➔ 前方一致 ➔ 部分一致 の優先順位で上位10件のみ返却
  const combined = Array.from(new Set([...exactMatches, ...startsWithMatches, ...includesMatches]));
  return combined.slice(0, 10);
};


// ---------- カテゴリ（大・中・小分類）の検索 ----------

/**
 * 表の、すべての分類（大・中・小）。名前が同じでも、場所が違えば別のもの（例: 常温の「麺類」と冷凍の「麺類」）
 *  ids: ホームのカテゴリ一覧を、その場所まで開くための id（大 → 中 → 小）
 */
export const CATEGORY_ENTRIES = (() => {
  const list = [];
  CATEGORY_TREE.forEach((top) => {
    list.push({ key: top.id, level: '大分類', name: top.name, parent: '', ids: [top.id] });
    top.categories.forEach((mid) => {
      list.push({ key: mid.id, level: '中分類', name: mid.name, parent: top.name, ids: [top.id, mid.id] });
      (mid.subCategories || []).forEach((sub) => {
        list.push({
          key: sub.id,
          level: '小分類',
          name: sub.name,
          parent: `${top.name} > ${mid.name}`,
          ids: [top.id, mid.id, sub.id],
        });
      });
    });
  });
  return list;
})();

/**
 * 分類の名前で探す（ひらがなは CATEGORY_READING_MAP の読み仮名でも探す）。完全一致 → 前方一致 → 部分一致の順
 *  名前は「・」で区切られた語の、それぞれの頭でも前方一致とみなす（例: 「たれ」→「調味料・油・タレ」）
 * @param {string} searchQuery
 * @param {number} max 返す最大の件数
 */
export const filterCategorySuggestions = (searchQuery, max = 20) => {
  if (!String(searchQuery || '').trim()) return [];
  const normQuery = normalizeText(searchQuery);
  const queries = [normQuery, hiraganaToKatakana(normQuery), katakanaToHiragana(normQuery)];

  const ranked = [[], [], []]; // 完全一致・前方一致・部分一致
  CATEGORY_ENTRIES.forEach((entry) => {
    const name = normalizeText(entry.name);
    const words = [name, ...name.split(/[・()（）\s]+/).filter(Boolean)];
    const readings = normalizeText(CATEGORY_READING_MAP[entry.name] || '').split(' ').filter(Boolean);
    const tokens = [...words, ...readings];

    if (tokens.some((t) => queries.includes(t))) ranked[0].push(entry);
    else if (tokens.some((t) => queries.some((q) => t.startsWith(q)))) ranked[1].push(entry);
    else if (tokens.some((t) => queries.some((q) => t.includes(q)))) ranked[2].push(entry);
  });
  return [...ranked[0], ...ranked[1], ...ranked[2]].slice(0, max);
};

// ---------- 自分のレシートの、印字名の検索 ----------

/**
 * 印字名の一覧（fetchMyItemNames の結果）を、検索しやすい形にまとめる。
 *  同じ印字名（文字をそろえて同じ）・同じ商品のものは 1 つにまとめ、件数を数える。最新の購入日の書き方を代表にする
 * @param {{ itemName, path, purchaseDate }[]} rows 購入日の新しい順
 */
export const buildItemNameIndex = (rows) => {
  const groups = new Map();
  (rows || []).forEach((row) => {
    const norm = normalizeForSearch(row.itemName);
    if (!norm) return;
    const p = row.path;
    const key = `${norm}|${[p.main, p.category, p.sub, p.product].map((v) => v || '').join('>')}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { key, norm, itemName: row.itemName, path: p, count: 1, latestDate: row.purchaseDate });
  });
  return [...groups.values()];
};

/**
 * 印字名で探す（全角/半角・ひらがな/カタカナ・大文字/小文字・記号・空白の違いは区別しない。空白区切りは AND）。
 *  印字名の頭が合うものを先に、あとは買った回数の多い順
 * @param {ReturnType<typeof buildItemNameIndex>} index
 */
export const filterItemNameSuggestions = (index, searchQuery, max = 20) => {
  const head = normalizeForSearch(String(searchQuery || '').split(/\s+/)[0]);
  if (!head || !index) return [];
  return index
    .filter((entry) => matchesItemSearch(entry.norm, searchQuery))
    .sort(
      (a, b) =>
        Number(b.norm.startsWith(head)) - Number(a.norm.startsWith(head)) ||
        b.count - a.count ||
        String(b.latestDate).localeCompare(String(a.latestDate))
    )
    .slice(0, max);
};
