import { useState, useEffect, useMemo } from 'react';
import './myStorePrices.css';
import PurchaseRow from '../purchaseRow/purchaseRow';
import { fetchMyStores, fetchMyStorePrices } from '../../utils/myStoreDb';
import {
  PERIOD_OPTIONS,
  DEFAULT_PERIOD_DAYS,
  groupPricesByStore,
  pickOwnRows,
  SORT_OPTIONS,
  sortRowsByUnitPrice,
} from '../../utils/myStoreCompare';
import { unitPriceText } from '../../utils/volume';
import { formatPurchaseDate } from '../../utils/purchaseDate';

const PREVIEW_ROWS = 5; // カードごとに最初に見せる件数（残りは「すべて表示」）

/**
 * 1 つの店舗の中の、「自分」または「他のユーザー」のカード
 *  自分のレシートと他のユーザーのレシートは、別のカードに分ける。
 *  行の見せ方は、購入履歴と同じ部品（PurchaseRow）。
 *  ・自分のカード: 購入日・印字名（商品名）・容量・価格。押すと、そのレシートが開く
 *  ・他のユーザーのカード: 容量・価格だけ（購入日・印字名は匿名のため出さない）
 */
function SourceCard({ mine, rows, expanded, onToggle, onSelectReceipt, sortMode }) {
  // 値段順は、もとの並び（安い順）のまま。単価順は、単価の安い順（単価が出せない行は最後）
  const sortedRows = sortMode === 'unit' ? sortRowsByUnitPrice(rows) : rows;
  const visibleRows = expanded ? sortedRows : sortedRows.slice(0, PREVIEW_ROWS);

  return (
    <div className={`msp-card ${mine ? 'msp-card-mine' : 'msp-card-others'}`}>
      <div className="msp-card-header">
        <span className={`msp-badge ${mine ? 'msp-badge-mine' : 'msp-badge-others'}`}>
          {mine ? '自分' : '他のユーザー'}
        </span>
        <span className="msp-card-note">{mine ? '自分のレシート' : '匿名のデータ'}</span>
        <span className="msp-card-count">{rows.length}件</span>
      </div>

      {rows.length === 0 ? (
        <div className="msp-no-data">この期間のデータはありません</div>
      ) : (
        <>
          <ul className="msp-list">
            {visibleRows.map((row, index) => (
              <li key={`${index}-${row.price}`} className="msp-item">
                {mine ? (
                  <PurchaseRow
                    primary={[row.itemName, row.volume || '容量不明'].filter(Boolean).join(' ・ ')}
                    sub={formatPurchaseDate(row.purchaseDate)}
                    price={row.price}
                    unitPrice={unitPriceText(row.price, row.volume)}
                    isDiscount={row.isDiscount}
                    onClick={onSelectReceipt && row.receiptId ? () => onSelectReceipt(row.receiptId) : undefined}
                  />
                ) : (
                  <PurchaseRow
                    primary={row.volume || '容量不明'}
                    muted={!row.volume}
                    price={row.price}
                    unitPrice={unitPriceText(row.price, row.volume)}
                    isDiscount={row.isDiscount}
                  />
                )}
              </li>
            ))}
          </ul>
          {rows.length > PREVIEW_ROWS && (
            <button type="button" className="msp-toggle" onClick={onToggle}>
              {expanded ? '閉じる' : `すべて表示（${rows.length}件）`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 商品詳細の「マイ店舗の価格比較」
 *  登録したマイ店舗での、この商品の価格。店舗ごとに、「自分」と「他のユーザー」を別のカードで出す。
 *  自分の行は、商品詳細が読み込んだ購入履歴（ownHistory）から。他のユーザーの行は、DB の関数から（匿名）。
 * @param {{ main, category, sub, product }} product
 * @param {object[]} ownHistory 自分の購入履歴（fetchProductPriceHistory の結果）
 * @param {boolean} ownLoading ownHistory を読み込み中か
 * @param {(receiptId) => void} onSelectReceipt 自分の行を押したとき
 */
export default function MyStorePrices({
  product,
  ownHistory = [],
  ownLoading = false,
  onManageStores,
  onSelectReceipt,
}) {
  const [days, setDays] = useState(DEFAULT_PERIOD_DAYS);
  const [myStores, setMyStores] = useState([]);
  const [othersRows, setOthersRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [expanded, setExpanded] = useState({}); // 'ディオ 和泉店|mine' → すべて表示中か
  const [sortMode, setSortMode] = useState('price'); // 並び順: 値段順／単価順

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
        setOthersRows([]);
      } else {
        setMyStores(stores.data);
        // 自分の行は、購入履歴から作る（印字名があるため）。DB の関数が返す「自分の行」は使わない
        setOthersRows(prices.data.filter((row) => !row.isMine));
      }
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [product, days]);

  const groups = useMemo(() => {
    const ownRows = pickOwnRows(ownHistory, myStores, days);
    return groupPricesByStore(myStores, [...ownRows, ...othersRows]);
  }, [ownHistory, myStores, othersRows, days]);

  const toggle = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  const isLoading = loading || ownLoading;

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

      {/* 並び順（値段順／単価順）。単価は、容量が入っている行だけ出せる */}
      <div className="msp-periods msp-sort" role="group" aria-label="並び順">
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`msp-period ${sortMode === option.value ? 'is-active' : ''}`}
            aria-pressed={sortMode === option.value}
            onClick={() => setSortMode(option.value)}
          >
            {option.label}
          </button>
        ))}
        <span className="msp-sort-note">単価は、容量が入っている商品だけ</span>
      </div>

      {isLoading && <div className="msp-message">データを読み込み中...</div>}
      {!isLoading && errorMessage && <div className="msp-message msp-error">{errorMessage}</div>}

      {!isLoading && !errorMessage && myStores.length === 0 && (
        <div className="msp-empty">
          <p>マイ店舗が登録されていません。</p>
          <button type="button" className="msp-register" onClick={onManageStores}>
            マイ店舗を登録する
          </button>
        </div>
      )}

      {!isLoading &&
        !errorMessage &&
        groups.map((group) => (
          <div key={group.storeName} className="msp-store">
            {/* 店舗の見出し（最安値は、自分と他のユーザーを合わせた中で） */}
            <div className="msp-store-row">
              <span className="msp-store-name">⭐ {group.storeName}</span>
              {group.minPrice !== null && (
                <span className="msp-min">
                  最安 <b>{group.minPrice}</b>円
                </span>
              )}
            </div>

            <SourceCard
              mine
              rows={group.mineRows}
              expanded={Boolean(expanded[`${group.storeName}|mine`])}
              onToggle={() => toggle(`${group.storeName}|mine`)}
              onSelectReceipt={onSelectReceipt}
              sortMode={sortMode}
            />
            <SourceCard
              sortMode={sortMode}
              rows={group.othersRows}
              expanded={Boolean(expanded[`${group.storeName}|others`])}
              onToggle={() => toggle(`${group.storeName}|others`)}
            />
          </div>
        ))}
    </section>
  );
}
