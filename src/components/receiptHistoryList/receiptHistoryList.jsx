import { useState, useEffect, useMemo } from 'react';
import './receiptHistoryList.css';
import { fetchReceiptHistory } from '../../utils/receiptDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { RECEIPT_SORT_OPTIONS, DEFAULT_RECEIPT_SORT, sortReceipts } from '../../utils/receiptSort';
import { RECEIPT_PERIOD_OPTIONS, filterReceipts } from '../../utils/receiptFilter';

export default function ReceiptHistoryList({ onBack, onSelectReceiptDetail }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [sortKey, setSortKey] = useState(DEFAULT_RECEIPT_SORT); // 既定は購入日
  const [searchText, setSearchText] = useState(''); // 店名・印字名の絞り込み
  const [period, setPeriod] = useState('all'); // 購入日の期間
  // 絞り込んでから、並び替える
  const sortedReceipts = useMemo(
    () => sortReceipts(filterReceipts(receipts, { text: searchText, period }), sortKey),
    [receipts, sortKey, searchText, period]
  );
  const isFiltering = searchText.trim() !== '' || period !== 'all';

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
          <div className="receipt-filter-row">
            <input
              type="search"
              className="receipt-filter-input"
              placeholder="店名・商品名で探す"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="店名・商品名で探す"
            />
            <select
              className="sort-select"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              aria-label="期間"
            >
              {RECEIPT_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!loading && receipts.length > 0 && (
          <div className="receipt-sort-row">
            <label className="receipt-sort-label" htmlFor="receipt-sort">並び替え</label>
            <select
              id="receipt-sort"
              className="sort-select"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {RECEIPT_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {!loading && receipts.length > 0 && isFiltering && (
          <div className="receipt-filter-count">
            {sortedReceipts.length > 0 ? `${sortedReceipts.length}件のレシート` : '条件に合うレシートはありません'}
          </div>
        )}

        {!loading && receipts.length > 0 && (
          <div className="receipt-grid">
            {sortedReceipts.map((receipt) => {
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