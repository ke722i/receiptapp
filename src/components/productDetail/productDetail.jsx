import { useState } from 'react';
import './productDetail.css';

// 商品画像を差し込む場合は import してください
// import milkImage from '../../assets/milk.png';

export default function ProductDetail({ onBack, onViewAllHistory }) {
  const [sortOrder, setSortOrder] = useState('dateDesc'); // デフォルト：日付順（新しい順）

  // ダミーの購入履歴データ（4件）
  const historyData = [
    { id: 1, date: '2026/10/27(金)', shop: 'イオン', price: 178, originalPrice: 208, discount: '30円引き' },
    { id: 2, date: '2026/10/18(水)', shop: 'イトーヨーカドー', price: 198, originalPrice: null, discount: 'なし' },
    { id: 3, date: '2026/10/05(木)', shop: 'ライフ', price: 168, originalPrice: 198, discount: '30円引き' },
    { id: 4, date: '2026/09/25(月)', shop: 'イオン', price: 208, originalPrice: null, discount: 'なし' },
  ];

  // 並び替え処理
  const sortedHistory = [...historyData].sort((a, b) => {
    if (sortOrder === 'dateDesc') {
      return new Date(b.date.split('(')[0]) - new Date(a.date.split('(')[0]);
    } else if (sortOrder === 'priceAsc') {
      return a.price - b.price;
    } else if (sortOrder === 'priceDesc') {
      return b.price - a.price;
    }
    return 0;
  });

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
            <h2 className="product-name">牛乳</h2>
            <div className="product-image-container">
              {/* <img src={milkImage} alt="牛乳" className="product-image" /> */}
              <div className="product-image-placeholder">画像</div>
            </div>
          </div>
        </section>

        {/* 3. 直近の購入カード */}
        <section className="detail-section">
          <h3 className="section-title">直近の購入</h3>
          <div className="recent-purchase-card">
            <div className="recent-card-header">
              <span className="purchase-date">10/27 (金)</span>
              <span className="shop-name">イオン</span>
            </div>
            <div className="recent-card-body">
              <div className="price-info">
                <span className="current-price">178<span className="unit">円</span></span>
                <span className="original-price">（値引き前: 208円）</span>
              </div>
              <div className="discount-tag">30円引き</div>
            </div>
          </div>
        </section>

        {/* 4. 購入履歴セクション */}
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

          {/* 履歴リスト（4件表示） */}
          <div className="history-list">
            {sortedHistory.map((item) => (
              <div key={item.id} className="history-card">
                <div className="history-card-left">
                  <span className="history-date">{item.date}</span>
                  <span className="history-shop">{item.shop}</span>
                </div>
                <div className="history-card-right">
                  <div className="history-price-group">
                    <span className="history-price">{item.price}円</span>
                    {item.originalPrice && (
                      <span className="history-original-price">{item.originalPrice}円</span>
                    )}
                  </div>
                  <span className={`history-discount ${item.discount !== 'なし' ? 'has-discount' : ''}`}>
                    {item.discount}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* すべて見るボタン */}
          <button
            type="button"
            className="view-all-button"
            onClick={onViewAllHistory}
            >
            すべて見る
          </button>
        </section>
      </main>
    </div>
  );
}