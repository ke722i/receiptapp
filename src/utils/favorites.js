// お気に入りの商品（端末に保存。DB は使わない）。商品は名前ではなく経路 { main, category, sub, product } で区別する
import { productKey, isOtherPath } from './categoryUtils';

export const MAX_FAVORITES = 30;
const storageKey = (userId) => `receipt_app_favorites_${userId}`;

/** お気に入りにできる商品か（商品名があり、「その他」の箱ではない） */
export const canFavorite = (path) => !!path && !!path.product && !isOtherPath(path);

const clean = (path) => ({ main: path.main, category: path.category, sub: path.sub ?? null, product: path.product });

/** 保存してあるお気に入り（新しく足した順）。読めなければ空 */
export const loadFavorites = (userId) => {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(list) ? list.filter(canFavorite).map(clean) : [];
  } catch {
    return [];
  }
};

export const saveFavorites = (userId, list) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(list));
  } catch {
    // 保存できなくても、この画面では使える
  }
};

export const isFavorite = (list, path) => !!path && list.some((item) => productKey(item) === productKey(path));

/** お気に入りに入れる／外す。新しい配列を返す（入れるときは先頭。MAX_FAVORITES を超えたら古いものから外す） */
export const toggleFavorite = (list, path) => {
  if (!canFavorite(path)) return list;
  if (isFavorite(list, path)) return list.filter((item) => productKey(item) !== productKey(path));
  return [clean(path), ...list].slice(0, MAX_FAVORITES);
};
