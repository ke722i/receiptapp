import { useState, useEffect } from 'react';
import './productHistoryList.css';
import { fetchProductPriceHistory } from '../../utils/receiptDb';

// product: { main, category, sub, product }（同じ名前の商品を場所で区別する）
export default function ProductHistoryList({ product, onBack, onSelectReceipt }) {
  const productName = product?.product || '';
  const [sortOrder, setSortOrder] = useState('dateDesc'); // デフォルト：日付順（新しい順）
  const [fullHistoryData, setFullHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // 自分のレシートから、この商品の全履歴を取得
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      const result = await fetchProductPriceHistory(product);
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setFullHistoryData(result.data);
      } else {
        setFullHistoryData([]);
        setErrorMessage(result.error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // 並び替え処理
  const sortedHistory = [...fullHistoryData].sort((a, b) => {
    if (sortOrder === 'priceAsc') return a.price - b.price;
    if (sortOrder === 'priceDesc') return b.price - a.price;
    return b.dateValue.localeCompare(a.dateValue); // dateDesc
  });

  return (
    <div className="history-list-container">
      {/* 1. ヘッダー領域 */}
      <header className="history-list-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">購入履歴（{productName}）</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* メインコンテンツ */}
      <main className="history-list-main">
        {loading && <div className="history-message">データを読み込み中...</div>}

        {errorMessage && (
          <div className="history-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && sortedHistory.length === 0 && (
          <div className="history-message">この商品の購入履歴はまだありません</div>
        )}

        {!loading && sortedHistory.length > 0 && (
          <>
            <div className="history-list-header-row">
              <span className="history-count">全 {sortedHistory.length} 件</span>
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

            {/* 履歴カード一覧 */}
            <div className="full-history-list">
              {sortedHistory.map((item) => (
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
          </>
        )}
      </main>
    </div>
  );
}