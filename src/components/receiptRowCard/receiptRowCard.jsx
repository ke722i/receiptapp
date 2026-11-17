import './receiptRowCard.css';
import { formatPurchaseDate } from '../../utils/purchaseDate';

const UNREGISTERED = '店舗名未登録';

/**
 * レシート 1 枚の行（左にレシートの画像、右に購入日・点数・商品名の例）。レシート一覧・店舗詳細で使う
 * @param {object} receipt 明細つきのレシート（receipt_items を持つ）
 * @param {boolean} showStore 店舗名も出すか（レシート一覧は、店舗がまちまちなので出す。店舗詳細は、同じ店舗なので出さない）
 * @param {() => void} onClick
 */
export default function ReceiptRowCard({ receipt, showStore = false, onClick }) {
  const items = receipt.receipt_items || [];
  const imageSrc = receipt.image_url || receipt.imageSrc || null;
  const names = items
    .map((item) => item.item_name)
    .filter(Boolean)
    .slice(0, 3)
    .join('、');

  return (
    <button type="button" className="receipt-row-card" onClick={onClick}>
      <span className="receipt-row-thumb">
        {imageSrc ? <img src={imageSrc} alt="レシート写真" /> : <span aria-hidden="true">📄</span>}
      </span>
      <span className="receipt-row-info">
        <span className="receipt-row-date">{formatPurchaseDate(receipt.purchase_date)}</span>
        {showStore && <span className="receipt-row-store">{receipt.store_name || UNREGISTERED}</span>}
        <span className="receipt-row-meta">{items.length}点</span>
        {names && (
          <span className="receipt-row-items">
            {names}
            {items.length > 3 ? ' ほか' : ''}
          </span>
        )}
      </span>
      <span className="receipt-row-arrow" aria-hidden="true">›</span>
    </button>
  );
}
