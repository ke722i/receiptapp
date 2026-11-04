import { CATEGORY_TREE, CUSTOM_READING_MAP } from '../constants/categoryData';

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