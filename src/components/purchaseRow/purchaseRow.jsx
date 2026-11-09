import './purchaseRow.css';

/**
 * 価格の 1 行（購入履歴・購入履歴の一覧・マイ店舗の価格比較で、同じ見た目にそろえるための部品）
 *
 *   ┌───────────────────────────────────────────┐
 *   │ 2026年10月31日  食品館アプロ 堺水池店          148円 │  ← 主な文字（日付など）と、店名
 *   │ ちいかわグミ ・ 容量不明                  値引きなし │  ← 印字名・容量（小さく）／値引きの有無
 *   └───────────────────────────────────────────┘
 *
 * @param {string} primary    太字の、主な文字（購入日。購入日が出せない行では、容量など）
 * @param {boolean} [muted]   primary を、薄い色にする（「容量不明」など）
 * @param {string} [secondary] primary の横に並べる、太字の文字（店名）
 * @param {string} [sub]      小さい文字の 2 行目（印字名・容量）
 * @param {number} price      価格（円）
 * @param {boolean} isDiscount 値引きの有無。「値引きあり」（赤）／「値引きなし」（グレー）を出す
 * @param {boolean} [card]    1 行を、単独のカード（枠・白背景）にする。カードの中に並べるときは付けない
 * @param {() => void} [onClick] 渡すと、行を押せる（レシートを開くなど）
 */
export default function PurchaseRow({
  primary,
  muted = false,
  secondary,
  sub,
  price,
  isDiscount,
  card = false,
  onClick,
}) {
  const className = ['purchase-row', card ? 'is-card' : '', onClick ? 'is-clickable' : '']
    .filter(Boolean)
    .join(' ');

  const clickProps = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  return (
    <div className={className} {...clickProps}>
      <div className="purchase-row-left">
        <div className="purchase-row-main">
          <span className={`purchase-row-primary ${muted ? 'is-muted' : ''}`}>{primary}</span>
          {secondary && <span className="purchase-row-secondary">{secondary}</span>}
        </div>
        {sub && <span className="purchase-row-sub">{sub}</span>}
      </div>
      <div className="purchase-row-right">
        <span className="purchase-row-price">{price}円</span>
        <span className={`purchase-row-discount ${isDiscount ? 'has-discount' : ''}`}>
          {isDiscount ? '値引きあり' : '値引きなし'}
        </span>
      </div>
    </div>
  );
}
