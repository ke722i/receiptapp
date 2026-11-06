import { useState, useEffect } from 'react';
import './productDetail.css';
import { fetchProductPriceHistory } from '../../utils/receiptDb';
import { formatPath } from '../../utils/categoryUtils';

// product: { main, category, sub, product }（同じ名前の商品を場所で区別する）
export default function ProductDetail({ product, onBack, onViewAllHistory, onSelectReceipt }) {
  const productName = product?.product || '';
  const [sortOrder, setSortOrder] = useState('dateDesc'); // デフォルト：日付順（新しい順）
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 自分のレシートから、この商品の購入履歴を取得
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      const result = await fetchProductPriceHistory(product);
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setHistoryData(result.data);
      } else {
        setHistoryData([]);
        setErrorMessage(result.error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // 並び替え処理
  const sortedHistory = [...historyData].sort((a, b) => {
    if (sortOrder === 'priceAsc') return a.price - b.price;
    if (sortOrder === 'priceDesc') return b.price - a.price;
    return b.dateValue.localeCompare(a.dateValue); // dateDesc
  });

  // 最安値の購入（価格が最も安い1件。同額の場合は購入日が新しいほうを採用。
  // historyData は日付降順で返るので、より安い場合だけ入れ替えれば同額は新しい日付が残る）
  const cheapestPurchase = historyData.reduce(
    (min, item) => (min === null || item.price < min.price ? item : min),
    null
  );

  // 履歴は最大4件までを表示（全件は「すべて見る」へ）
  const previewHistory = sortedHistory.slice(0, 4);

  return (
    <div className="product-detail-container">
      {/* 1. ヘッダー領域 */}
      <header className="product-detail-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">商品詳細</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* メインコンテンツ */}
      <main className="product-detail-main">
        {/* 2. 上部：商品名 & 画像 */}
        <section className="product-title-card">
          <div className="product-info-wrapper">
            <div>
              <h2 className="product-name">{productName}</h2>
              {/* どの分類の商品か（例: 常温 > 麺類 > 乾麺） */}
              <div className="product-name-note">{formatPath(product)}</div>
            </div>
            <div className="product-image-container">
              <div className="product-image-placeholder">画像</div>
            </div>
          </div>
        </section>

        {loading && <div className="detail-message">データを読み込み中...</div>}

        {errorMessage && (
          <div className="detail-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && historyData.length === 0 && (
          <div className="detail-message">
            この商品の購入履歴はまだありません
          </div>
        )}

        {/* 3. 最安値の購入カード */}
        {!loading && cheapestPurchase && (
          <section className="detail-section">
            <h3 className="section-title">最安値の購入</h3>
            <div className="recent-purchase-card">
              <div className="recent-card-header">
                <span className="purchase-date">{cheapestPurchase.date.split('(')[0]}</span>
                <span className="history-shop">{cheapestPurchase.shop}</span>
              </div>
              <div className="recent-card-body">
                <div className="price-info">
                  <span className="current-price">{cheapestPurchase.price}<span className="unit">円</span></span>
                  {cheapestPurchase.itemName && (
                    <span className="original-price" style={{ textDecoration: 'none' }}>
                      {cheapestPurchase.itemName}
                    </span>
                  )}
                </div>
                <div className="recent-card-actions">
                  {cheapestPurchase.isDiscount && (
                    <div className="discount-tag">値引きあり</div>
                  )}
                  <button
                    type="button"
                    className="receipt-link-button"
                    onClick={() => onSelectReceipt && onSelectReceipt(cheapestPurchase.receiptId)}
                  >
                    レシートを見る ›
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 4. 購入履歴セクション */}
        {!loading && historyData.length > 0 && (
          <section className="detail-section">
            <div className="history-header-row">
              <h3 className="section-title">購入履歴</h3>
              {/* 並び替えプルダウン */}
              <select
                className="sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              >
                <option value="dateDesc">日付順</option>
                <option value="priceAsc">価格が安い順</option>
                <option value="priceDesc">価格が高い順</option>
              </select>
            </div>

            {/* 履歴リスト */}
            <div className="history-list">
              {previewHistory.map((item) => (
                <div
                  key={item.id}
                  className="history-card clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectReceipt && onSelectReceipt(item.receiptId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectReceipt && onSelectReceipt(item.receiptId);
                    }
                  }}
                >
                  <div className="history-card-left">
                    <div className="history-title-row">
                      <span className="history-date">{item.date}</span>
                      <span className="history-shop">{item.shop}</span>
                    </div>
                    {item.itemName && (
                      <span className="history-item-name">{item.itemName}</span>
                    )}
                  </div>
                  <div className="history-card-right">
                    <div className="history-price-group">
                      <span className="history-price">{item.price}円</span>
                    </div>
                    <span className={`history-discount ${item.isDiscount ? 'has-discount' : ''}`}>
                      {item.isDiscount ? '値引きあり' : '値引きなし'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* すべて見るボタン（4件を超える場合のみ） */}
            {historyData.length > previewHistory.length && (
              <button
                type="button"
                className="view-all-button"
                onClick={onViewAllHistory}
              >
                すべて見る
              </button>
            )}
          </section>
        )}
      </main>
    </div>
  );
}