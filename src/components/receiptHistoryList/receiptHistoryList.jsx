import { useState, useEffect } from 'react';
import './receiptHistoryList.css';
import { fetchReceiptHistory } from '../../utils/receiptDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';

export default function ReceiptHistoryList({ onBack, onSelectReceiptDetail }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Supabase からレシート履歴を取得
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      setErrorMessage('');

      const result = await fetchReceiptHistory();
      setLoading(false);

      if (result.success) {
        setReceipts(result.data);
      } else {
        setErrorMessage(result.error);
      }
    };

    loadHistory();
  }, []);

  return (
    <div className="receipt-history-container">
      {/* 1. ヘッダー */}
      <header className="receipt-history-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート一覧</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. メインコンテンツ（カード一覧） */}
      <main className="receipt-history-main">
        {loading && (
          <div className="no-receipts-message">データを読み込み中...</div>
        )}

        {errorMessage && (
          <div className="no-receipts-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && receipts.length === 0 && (
          <div className="no-receipts-message">登録されたレシートはありません</div>
        )}

        {!loading && receipts.length > 0 && (
          <div className="receipt-grid">
            {receipts.map((receipt) => {
              // Supabase から取得したデータのキーマッピング
              const storeName = receipt.store_name || '店舗名未登録';
              const purchaseDate = receipt.purchase_date || '';
              const imageSrc = receipt.image_url || receipt.imageSrc || null;

              return (
                <div
                  key={receipt.id}
                  className="receipt-card"
                  onClick={() => onSelectReceiptDetail && onSelectReceiptDetail(receipt)}
                >
                  {/* サムネイル画像 */}
                  <div className="receipt-card-image-box">
                    {imageSrc ? (
                      <img src={imageSrc} alt="レシート写真" className="receipt-card-image" />
                    ) : (
                      <div className="receipt-placeholder-icon">📄</div>
                    )}
                  </div>

                  {/* 店舗名・日付 */}
                  <div className="receipt-card-info">
                    <span className="receipt-card-date">{formatPurchaseDate(purchaseDate)}</span>
                    <span className="receipt-card-store">{storeName}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}