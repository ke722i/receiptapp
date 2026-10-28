import { useState } from 'react';
import './productHistoryList.css';

export default function ProductHistoryList({ productName = '牛乳', onBack }) {
  const [sortOrder, setSortOrder] = useState('dateDesc'); // デフォルト：日付順（新しい順）

  // 商品ごとの全履歴サンプルデータ（プレースホルダー）
  const mockFullHistoryData = {
    '牛乳': [
      { id: 1, date: '2026/10/27(金)', shop: 'イオン', price: 178, originalPrice: 208, discount: '30円引き' },
      { id: 2, date: '2026/10/18(水)', shop: 'イトーヨーカドー', price: 198, originalPrice: null, discount: 'なし' },
      { id: 3, date: '2026/10/05(木)', shop: 'ライフ', price: 168, originalPrice: 198, discount: '30円引き' },
      { id: 4, date: '2026/09/25(月)', shop: 'イオン', price: 208, originalPrice: null, discount: 'なし' },
      { id: 5, date: '2026/09/12(土)', shop: 'マルエツ', price: 188, originalPrice: 208, discount: '20円引き' },
      { id: 6, date: '2026/08/30(日)', shop: 'ライフ', price: 208, originalPrice: null, discount: 'なし' },
      { id: 7, date: '2026/08/15(土)', shop: 'イオン', price: 158, originalPrice: 208, discount: '50円引き' },
    ],
    '卵': [
      { id: 1, date: '2026/10/26(木)', shop: 'ライフ', price: 218, originalPrice: null, discount: 'なし' },
      { id: 2, date: '2026/10/15(日)', shop: '西友', price: 198, originalPrice: 238, discount: '40円引き' },
      { id: 3, date: '2026/09/28(木)', shop: 'イオン', price: 228, originalPrice: null, discount: 'なし' },
    ],
    'サラダ油': [
      { id: 1, date: '2026/10/20(火)', shop: 'イオン', price: 298, originalPrice: 348, discount: '50円引き' },
      { id: 2, date: '2026/09/10(木)', shop: 'ライフ', price: 328, originalPrice: null, discount: 'なし' },
    ]
  };

  // 選択された商品の全履歴を取得（未登録の場合はデフォルトデータを動的適用）
  const fullHistoryData = mockFullHistoryData[productName] || [
    { id: 1, date: '2026/10/27(金)', shop: '近所のスーパー', price: 198, originalPrice: null, discount: 'なし' },
    { id: 2, date: '2026/09/15(火)', shop: 'ドラッグストア', price: 188, originalPrice: 208, discount: '20円引き' }
  ];

  // 並び替え処理
  const sortedHistory = [...fullHistoryData].sort((a, b) => {
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
      </main>
    </div>
  );
}