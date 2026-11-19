import { useRef } from 'react';
import './receiptRowCard.css';
import { useReceiptImage } from '../../utils/receiptCache';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { countNeedsCheck } from '../../utils/needsCheck';
import Icon from '../icon/icon';

const UNREGISTERED = '店舗名未登録';

/**
 * レシート 1 枚の行（左にレシートの画像、右に購入日・点数・商品名の例）。レシート一覧・店舗詳細で使う
 * @param {object} receipt 明細つきのレシート（receipt_items を持つ）
 * @param {boolean} showStore 店舗名も出すか（レシート一覧は、店舗がまちまちなので出す。店舗詳細は、同じ店舗なので出さない）
 * @param {() => void} onClick
 */
export default function ReceiptRowCard({ receipt, showStore = false, onClick }) {
  const items = receipt.receipt_items || [];
  const rowRef = useRef(null);
  // 画像は、一覧には含めない。この行が画面に近づいたら読む（undefined = 読み込み中、null = 画像なし）
  const imageSrc = useReceiptImage(receipt, rowRef);
  const names = items
    .map((item) => item.item_name)
    .filter(Boolean)
    .slice(0, 3)
    .join('、');
  const total = items.reduce((sum, item) => sum + (Number(item.price) || 0), 0); // 印字の値段の合計（値引き前）
  const needs = countNeedsCheck(items);

  return (
    <button type="button" className="receipt-row-card" data-receipt-id={receipt.id} onClick={onClick} ref={rowRef}>
      <span className={`receipt-row-thumb ${imageSrc === undefined ? 'skeleton-block' : ''}`}>
        {imageSrc ? (
          <img src={imageSrc} alt="レシート写真" />
        ) : imageSrc === undefined ? null : (
          <Icon name="receipt" size={26} />
        )}
      </span>
      <span className="receipt-row-info">
        {showStore && <span className="receipt-row-store">{receipt.store_name || UNREGISTERED}</span>}
        <span className="receipt-row-date">{formatPurchaseDate(receipt.purchase_date)}</span>
        <span className="receipt-row-meta">
          <span className="receipt-row-total">{total.toLocaleString()}円</span>
          <span>・{items.length}点</span>
          {needs > 0 && <span className="needs-check-badge">要確認 {needs}</span>}
        </span>
        {names && (
          <span className="receipt-row-items">
            {names}
            {items.length > 3 ? ' ほか' : ''}
          </span>
        )}
      </span>
      <span className="receipt-row-arrow" aria-hidden="true"><Icon name="chevronRight" size={20} /></span>
    </button>
  );
}
