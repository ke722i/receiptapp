import { useState, useEffect, useMemo, useRef } from 'react';
import './storeDetail.css';
import { useReceiptHistory } from '../../utils/receiptCache';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { RECEIPT_SORT_OPTIONS, sortReceipts } from '../../utils/receiptSort';
import { loadReceiptSort, saveReceiptSort, peekReturnState, rememberOpenedReceipt, scrollToReturnedReceipt } from '../../utils/receiptListState';
import ReceiptRowCard from '../receiptRowCard/receiptRowCard';

const UNREGISTERED = '店舗名未登録';

// 新しいレシートから見て、最初に見つかった、空でない値（住所・電話番号。レシートごとに、読み取れたり、読み取れなかったりするため）
const pickLatest = (receipts, key) => {
  const found = receipts.find((r) => String(r[key] || '').trim());
  return found ? String(found[key]).trim() : '';
};

// 電話番号らしい文字列か（数字・ハイフン・括弧・空白だけ）
const isPhoneLike = (text) => /^[\d\s\-()（）+]{8,}$/.test(text);

/**
 * 店舗詳細（店舗別一覧で、店舗を選ぶと開く）
 *  ・店舗の情報（店名・店舗名・住所・電話番号・レシートの件数・購入の期間）。住所・電話番号は、この店舗のレシートから読み取れたもの
 *  ・この店舗のレシートの一覧（画像・購入日・点数・商品の例）。押すと、レシート詳細へ
 * @param {string} storeName 店舗名（「チェーン名 支店名」の形。レシートの store_name）
 */
export default function StoreDetail({ storeName, onBack, onSelectReceiptDetail }) {
  const { receipts, loading, errorMessage } = useReceiptHistory(); // 覚えた一覧を使う（utils/receiptCache.js）
  const [returned] = useState(() => peekReturnState()); // レシート詳細から戻ってきたとき、その行まで戻す
  const [sortKey, setSortKey] = useState(loadReceiptSort); // 並び替えは、端末に保存（レシート一覧と共通）
  const scrolledRef = useRef(false);

  // この店舗のレシート（選んだ順に並べる。最初は、購入日の新しい順）
  const storeReceipts = useMemo(
    () => sortReceipts(receipts.filter((r) => (r.store_name || UNREGISTERED) === storeName), sortKey),
    [receipts, storeName, sortKey]
  );

  const changeSort = (value) => {
    setSortKey(value);
    saveReceiptSort(value);
  };

  useEffect(() => {
    if (loading || scrolledRef.current) return;
    scrolledRef.current = true;
    scrollToReturnedReceipt(returned?.receiptId);
  }, [loading, returned]);

  const address = pickLatest(storeReceipts, 'store_address');
  const phone = pickLatest(storeReceipts, 'store_number');
  const dates = storeReceipts.map((r) => r.purchase_date).filter(Boolean).sort();
  const period =
    dates.length === 0
      ? ''
      : dates[0] === dates[dates.length - 1]
        ? formatPurchaseDate(dates[0])
        : `${formatPurchaseDate(dates[0])} 〜 ${formatPurchaseDate(dates[dates.length - 1])}`;

  return (
    <div className="store-detail-container">
      <header className="store-detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">店舗詳細</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="store-detail-main">
        {loading && <div className="store-detail-message">データを読み込み中...</div>}
        {errorMessage && (
          <div className="store-detail-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && (
          <>
            <section className="store-info-card" aria-label="店舗の情報">
              <h2 className="store-info-name">{storeName}</h2>
              {address && (
                <div className="store-info-row">
                  <span className="store-info-label">住所</span>
                  <span className="store-info-value">{address}</span>
                </div>
              )}
              {phone && (
                <div className="store-info-row">
                  <span className="store-info-label">電話番号</span>
                  <span className="store-info-value">
                    {isPhoneLike(phone) ? (
                      <a className="store-info-link" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>
                        {phone}
                      </a>
                    ) : (
                      phone
                    )}
                  </span>
                </div>
              )}
              <div className="store-info-row">
                <span className="store-info-label">レシート</span>
                <span className="store-info-value">{storeReceipts.length}件</span>
              </div>
              {period && (
                <div className="store-info-row">
                  <span className="store-info-label">購入の期間</span>
                  <span className="store-info-value">{period}</span>
                </div>
              )}
            </section>

            <div className="store-detail-sort-row">
              <h2 className="store-detail-section-title">この店舗のレシート</h2>
              {storeReceipts.length > 1 && (
                <select className="store-detail-sort" value={sortKey} onChange={(e) => changeSort(e.target.value)} aria-label="並び替え">
                  {RECEIPT_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {storeReceipts.length === 0 ? (
              <div className="store-detail-message">この店舗のレシートはありません</div>
            ) : (
              <div className="receipt-row-list">
                {storeReceipts.map((receipt) => (
                  <ReceiptRowCard
                    key={receipt.id}
                    receipt={receipt}
                    onClick={() => {
                      rememberOpenedReceipt(receipt.id);
                      if (onSelectReceiptDetail) onSelectReceiptDetail(receipt);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
