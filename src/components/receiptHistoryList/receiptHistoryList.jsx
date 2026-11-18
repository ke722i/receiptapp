import { useState, useEffect, useMemo, useRef } from 'react';
import './receiptHistoryList.css';
import { useReceiptHistory } from '../../utils/receiptCache';
import ReceiptRowCard from '../receiptRowCard/receiptRowCard';
import { RECEIPT_SORT_OPTIONS, sortReceipts } from '../../utils/receiptSort';
import { loadReceiptSort, saveReceiptSort, peekReturnState, rememberOpenedReceipt, scrollToReturnedReceipt } from '../../utils/receiptListState';
import { RECEIPT_PERIOD_OPTIONS, filterReceipts } from '../../utils/receiptFilter';

export default function ReceiptHistoryList({ onBack, onSelectReceiptDetail }) {
  // 一覧は、一度読んだら覚えておく（2 回目からは、すぐ出る。utils/receiptCache.js）
  const { receipts, loading, errorMessage } = useReceiptHistory();
  // レシート詳細から戻ってきたときは、絞り込みを元に戻す（あらためて開いたときは、絞り込みなし）
  const [returned] = useState(() => peekReturnState());
  const [sortKey, setSortKey] = useState(loadReceiptSort); // 並び替えは、端末に保存（既定は購入日）
  const [searchText, setSearchText] = useState(returned?.searchText ?? ''); // 店名・印字名の絞り込み
  const [period, setPeriod] = useState(returned?.period ?? 'all'); // 購入日の期間
  const scrolledRef = useRef(false);
  // 絞り込んでから、並び替える
  const sortedReceipts = useMemo(
    () => sortReceipts(filterReceipts(receipts, { text: searchText, period }), sortKey),
    [receipts, sortKey, searchText, period]
  );
  const isFiltering = searchText.trim() !== '' || period !== 'all';

  const changeSort = (value) => {
    setSortKey(value);
    saveReceiptSort(value);
  };

  // 詳細から戻ってきたら、開いたレシートの行までスクロールする（読み込みが終わって、行が並んだあとに 1 回だけ）
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    scrolledRef.current = true;
    scrollToReturnedReceipt(returned?.receiptId);
  }, [loading, returned]);

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
              onChange={(e) => changeSort(e.target.value)}
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
          <div className="receipt-row-list">
            {sortedReceipts.map((receipt) => (
              <ReceiptRowCard
                key={receipt.id}
                receipt={receipt}
                showStore
                onClick={() => {
                  rememberOpenedReceipt(receipt.id, { searchText, period });
                  if (onSelectReceiptDetail) onSelectReceiptDetail(receipt);
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}