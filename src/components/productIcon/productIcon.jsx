import { CATEGORY_ICON_MAP, CATEGORY_ICON_OVERRIDES, CATEGORY_ICON_FALLBACK } from '../../constants/categoryIconData';
import { OTHER } from '../../utils/categoryUtils';

// 用意された SVG（src/assets/categoryIcons/<ファイル名>.svg）。ファイル名（拡張子なし）→ 画像の URL
const ICON_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/categoryIcons/*.svg', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.split('/').pop().replace(/\.svg$/, ''), url]
  )
);

/**
 * 商品のアイコンの URL。次の順に探す。見つからない・SVG が無いときは null
 *  1. 中分類ごとの指定（CATEGORY_ICON_OVERRIDES。例: 刺身・寿司ネタのぶり）
 *  2. 大分類＋商品名のアイコン（CATEGORY_ICON_MAP）
 *  3. アイコンが無い商品（新しく足した商品・提案で増えた商品）は、同じ小分類 → 同じ中分類で、いちばん多く使われているアイコン（CATEGORY_ICON_FALLBACK）
 *  ※ 「その他」の箱には、3 は使わない
 */
const findProductIconUrl = (product) => {
  if (!product || !product.main || !product.product) return null;
  let name = CATEGORY_ICON_OVERRIDES[product.main]?.[product.product]?.[product.category] ?? CATEGORY_ICON_MAP[product.main]?.[product.product];
  if (!name && ![product.product, product.sub, product.category].includes(OTHER)) {
    const fb = CATEGORY_ICON_FALLBACK[product.main]?.[product.category];
    name = fb?.subs?.[product.sub] ?? fb?.default;
  }
  return (name && ICON_URLS[name]) || null;
};

/**
 * 商品のアイコン。アイコンが無いときは、fallback（既定は何も出さない）
 * @param {{main, product}} product 経路（{ main, category, sub, product }）
 */
export default function ProductIcon({ product, fallback = null, className = 'product-icon-image' }) {
  const url = findProductIconUrl(product);
  return url ? <img src={url} alt="" className={className} draggable="false" /> : fallback;
}
