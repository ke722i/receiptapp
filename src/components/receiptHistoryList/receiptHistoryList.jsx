import { useState, useEffect, useMemo, useRef } from 'react';
import './receiptHistoryList.css';
import { useReceiptHistory } from '../../utils/receiptCache';
import ReceiptRowCard from '../receiptRowCard/receiptRowCard';
import { RECEIPT_SORT_OPTIONS, sortReceipts } from '../../utils/receiptSort';
import { loadReceiptSort, saveReceiptSort, peekReturnState, rememberOpenedReceipt, scrollToReturnedReceipt } from '../../utils/receiptListState';
import { RECEIPT_PERIOD_OPTIONS, filterReceipts } from '../../utils/receiptFilter';
import { countNeedsCheck } from '../../utils/needsCheck';
import { SkeletonList, EmptyState } from '../common/common';
import Icon from '../icon/icon';

export default function ReceiptHistoryList({ onBack, onSelectReceiptDetail, onOpenCamera }) {
  // 一覧は、一度読んだら覚えておく（2 回目からは、すぐ出る。utils/receiptCache.js）
  const { receipts, loading, errorMessage } = useReceiptHistory();
  // レシート詳細から戻ってきたときは、絞り込みを元に戻す（あらためて開いたときは、絞り込みなし）
  const [returned] = useState(() => peekReturnState());
  const [sortKey, setSortKey] = useState(loadReceiptSort); // 並び替えは、端末に保存（既定は購入日）
  const [searchText, setSearchText] = useState(returned?.searchText ?? ''); // 店名・印字名の絞り込み
  const [period, setPeriod] = useState(returned?.period ?? 'all'); // 購入日の期間
  const [needsOnly, setNeedsOnly] = useState(returned?.needsOnly ?? false); // 未選択・その他の商品があるレシートだけ
  const scrolledRef = useRef(false);

  // 直してほしい商品（未選択・その他）があるレシートの数
  const needsCount = useMemo(() => receipts.filter((r) => countNeedsCheck(r.receipt_items) > 0).length, [receipts]);

  // 絞り込んでから、並び替える
  const sortedReceipts = useMemo(() => {
    const filtered = filterReceipts(receipts, { text: searchText, period });
    const needs = needsOnly ? filtered.filter((r) => countNeedsCheck(r.receipt_items) > 0) : filtered;
    return sortReceipts(needs, sortKey);
  }, [receipts, sortKey, searchText, period, needsOnly]);
  const isFiltering = searchText.trim() !== '' || period !== 'all' || needsOnly;

  const changeSort = (value) => {
    setSortKey(value);
    saveReceiptSort(value);
  };

  const clearFilters = () => {
    setSearchText('');
    setPeriod('all');
    setNeedsOnly(false);
  };

  // 詳細から戻ってきたら、開いたレシートの行までスクロールする（読み込みが終わって、行が並んだあとに 1 回だけ）
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    scrolledRef.current = true;
    scrollToReturnedReceipt(returned?.receiptId);
  }, [loading, returned]);

  const hasReceipts = !loading && receipts.length > 0;

  return (
    <div className="receipt-history-container">
      {/* 1. ヘッダー */}
      <header className="receipt-history-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. メインコンテンツ（カード一覧） */}
      <main className="receipt-history-main">
        {loading && <SkeletonList rows={6} />}

        {errorMessage && (
          <div className="no-receipts-message" style={{ color: 'var(--danger)' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && receipts.length === 0 && (
          <EmptyState
            icon="receipt"
            title="最初の 1 枚を撮りましょう"
            text="レシートを撮影すると、商品と値段を自動で読み取って、ここに並びます。"
            actionLabel={onOpenCamera ? 'レシートを撮影する' : undefined}
            actionIcon="camera"
            onAction={onOpenCamera}
          />
        )}

        {/* 絞り込み・並び替え（上にまとめる。効いている条件は、緑の印） */}
        {hasReceipts && (
          <div className="receipt-toolbar">
            <div className="receipt-search-field">
              <Icon name="search" size={18} className="receipt-search-icon" />
              <input
                type="search"
                className="receipt-filter-input"
                placeholder="店名・商品名で探す"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="店名・商品名で探す"
                enterKeyHint="search"
              />
            </div>
            <div className="receipt-chip-row">
              <label className={`receipt-chip ${period !== 'all' ? 'is-active' : ''}`}>
                <span className="visually-hidden">期間</span>
                <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="期間">
                  {RECEIPT_PERIOD_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={14} />
              </label>
              <label className="receipt-chip">
                <span className="visually-hidden">並び替え</span>
                <select value={sortKey} onChange={(e) => changeSort(e.target.value)} aria-label="並び替え">
                  {RECEIPT_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Icon name="chevronDown" size={14} />
              </label>
              {(needsCount > 0 || needsOnly) && (
                <button
                  type="button"
                  className={`needs-check-toggle ${needsOnly ? 'is-on' : ''}`}
                  aria-pressed={needsOnly}
                  onClick={() => setNeedsOnly((v) => !v)}
                >
                  <Icon name="alert" size={14} strokeWidth={2.2} />
                  要確認 {needsCount}
                </button>
              )}
            </div>
          </div>
        )}

        {hasReceipts && isFiltering && (
          <div className="receipt-filter-count">
            <span>{sortedReceipts.length > 0 ? `${sortedReceipts.length}件のレシート` : '条件に合うレシートはありません'}</span>
            <button type="button" className="receipt-filter-clear" onClick={clearFilters}>
              条件を消す
            </button>
          </div>
        )}

        {hasReceipts && (
          <div className="receipt-row-list">
            {sortedReceipts.map((receipt) => (
              <ReceiptRowCard
                key={receipt.id}
                receipt={receipt}
                showStore
                onClick={() => {
                  rememberOpenedReceipt(receipt.id, { searchText, period, needsOnly });
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
