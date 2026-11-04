import { CATEGORY_TREE } from '../constants/categoryData';

/**
 * 商品名から CATEGORY_TREE 内の該当カテゴリ名を自動検索する関数
 * @param {string} itemName - レシートの商品名（例: "牛乳 1L", "高級食パン" など）
 * @returns {string} - マッチしたカテゴリ名（例: "乳製品・卵", "パン類"）。見つからない場合は "その他"
 */
export const matchCategoryFromTree = (itemName) => {
  if (!itemName) return 'その他';

  for (const mainCategory of CATEGORY_TREE) {
    for (const category of mainCategory.categories) {
      // 1. 中カテゴリ直下に items 配列がある場合（例: 冷蔵・冷凍カテゴリ）
      if (category.items && Array.isArray(category.items)) {
        if (category.items.some((item) => itemName.includes(item))) {
          return category.name;
        }
      }

      // 2. subCategories（小カテゴリ）配下に items 配列がある場合（例: 常温・日用品カテゴリ）
      if (category.subCategories && Array.isArray(category.subCategories)) {
        for (const sub of category.subCategories) {
          if (sub.items && Array.isArray(sub.items)) {
            if (sub.items.some((item) => itemName.includes(item))) {
              return category.name; // 中カテゴリ名（例: '調味料', 'パン類', '紙製品'）を返す
            }
          }
        }
      }
    }
  }

  return 'その他';
};