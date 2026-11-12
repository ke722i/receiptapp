import { CATEGORY_ICON_MAP } from '../../constants/categoryIconData';

// 用意された SVG（src/assets/categoryIcons/<ファイル名>.svg）。ファイル名（拡張子なし）→ 画像の URL
const ICON_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../../assets/categoryIcons/*.svg', { eager: true, query: '?url', import: 'default' })).map(
    ([path, url]) => [path.split('/').pop().replace(/\.svg$/, ''), url]
  )
);

/** 商品（大分類＋商品名）のアイコンの URL。対応が無い・SVG が無いときは null */
const findProductIconUrl = (product) => {
  if (!product || !product.main || !product.product) return null;
  const name = CATEGORY_ICON_MAP[product.main]?.[product.product];
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
