import { useState, useEffect } from 'react';
import './myStorePrices.css';
import { fetchMyStores, fetchMyStorePrices } from '../../utils/myStoreDb';
import { PERIOD_OPTIONS, DEFAULT_PERIOD_DAYS, groupPricesByStore } from '../../utils/myStoreCompare';
import { formatPurchaseDate } from '../../utils/purchaseDate';

const PREVIEW_ROWS = 5; // 店舗ごとに最初に見せる件数（残りは「すべて表示」）

/**
 * 商品詳細の「マイ店舗の価格比較」
 *  登録したマイ店舗での、この商品の価格（自分のレシート＋価格データを提供している他のユーザーのレシート）
 * @param {{ main, category, sub, product }} product
 */
export default function MyStorePrices({ product, onManageStores }) {
  const [days, setDays] = useState(DEFAULT_PERIOD_DAYS);
  const [myStores, setMyStores] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [expanded, setExpanded] = useState({}); // 店舗名 → すべて表示中か

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      const [stores, prices] = await Promise.all([fetchMyStores(), fetchMyStorePrices(product, days)]);
      if (cancelled) return;
      if (!stores.success || !prices.success) {
        setErrorMessage((!stores.success ? stores.error : prices.error) || '読み込みに失敗しました。');
        setMyStores([]);
        setRows([]);
      } else {
        setMyStores(stores.data);
        setRows(prices.data);
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [product, days]);

  const groups = groupPricesByStore(myStores, rows);

  return (
    <section className="detail-section msp-section">
      <div className="msp-title-row">
        <h3 className="section-title">マイ店舗の価格比較</h3>
        <button type="button" className="msp-manage" onClick={onManageStores}>
          マイ店舗を編集 ›
        </button>
      </div>

      {/* 期間（既定は 1 週間、最長は半年） */}
      <div className="msp-periods" role="group" aria-label="期間">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            className={`msp-period ${days === option.days ? 'is-active' : ''}`}
            aria-pressed={days === option.days}
            onClick={() => setDays(option.days)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="msp-legend">
        <span className="msp-legend-item">
          <span className="msp-badge msp-badge-mine">自分</span>自分のレシート
        </span>
        <span className="msp-legend-item">
          <span className="msp-badge msp-badge-others">他のユーザー</span>匿名のデータ
        </span>
      </div>

      {loading && <div className="msp-message">データを読み込み中...</div>}
      {!loading && errorMessage && <div className="msp-message msp-error">{errorMessage}</div>}

      {!loading && !errorMessage && myStores.length === 0 && (
        <div className="msp-card msp-empty">
          <p>マイ店舗が登録されていません。</p>
          <button type="button" className="msp-register" onClick={onManageStores}>
            マイ店舗を登録する
          </button>
        </div>
      )}

      {!loading &&
        !errorMessage &&
        groups.map((group) => {
          const isExpanded = Boolean(expanded[group.storeName]);
          const visibleRows = isExpanded ? group.rows : group.rows.slice(0, PREVIEW_ROWS);
          return (
            <div key={group.storeName} className="msp-card">
              <div className="msp-store-row">
                <span className="msp-store-name">⭐ {group.storeName}</span>
                {group.minPrice !== null && (
                  <span className="msp-min">
                    最安 <b>{group.minPrice}</b>円
                  </span>
                )}
              </div>

              {group.rows.length === 0 ? (
                <div className="msp-no-data">この期間のデータはありません</div>
              ) : (
                <>
                  <ul className="msp-list">
                    {visibleRows.map((row, index) => (
                      <li key={`${index}-${row.price}-${row.isMine}`} className="msp-item">
                        <span className={`msp-badge ${row.isMine ? 'msp-badge-mine' : 'msp-badge-others'}`}>
                          {row.isMine ? '自分' : '他のユーザー'}
                        </span>
                        <span className="msp-detail">
                          {row.isMine && row.purchaseDate && (
                            <span className="msp-date">{formatPurchaseDate(row.purchaseDate)}</span>
                          )}
                          <span className="msp-volume">{row.volume || '容量不明'}</span>
                        </span>
                        {row.isDiscount && <span className="msp-discount">値引きあり</span>}
                        <span className="msp-price">{row.price}円</span>
                      </li>
                    ))}
                  </ul>
                  {group.rows.length > PREVIEW_ROWS && (
                    <button
                      type="button"
                      className="msp-toggle"
                      onClick={() => setExpanded((prev) => ({ ...prev, [group.storeName]: !isExpanded }))}
                    >
                      {isExpanded ? '閉じる' : `すべて表示（${group.rows.length}件）`}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
    </section>
  );
}
