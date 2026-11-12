import { useState, useEffect, useMemo } from 'react';
import './productDetail.css';
import { fetchProductPriceHistory } from '../../utils/receiptDb';
import { formatPath } from '../../utils/categoryUtils';
import MyStorePrices from '../myStorePrices/myStorePrices';
import PurchaseRow from '../purchaseRow/purchaseRow';
import { unitPriceText } from '../../utils/volume';
import { cheapestByItemName, normalizeForSearch, matchesItemSearch } from '../../utils/itemNameGroup';

const OTHER_PREVIEW = 1; // 「他の商品の最安値」を最初に見せる件数（残りは「すべて表示」）

// 印字名に容量を添える（例: "明治おいしい牛乳 ・ 900ml"）
const withVolume = (itemName, volume) => [itemName, volume].filter(Boolean).join(' ・ ');

// product: { main, category, sub, product }（同じ名前の商品を場所で区別する）
export default function ProductDetail({
  product,
  initialSearchText = '',
  onBack,
  onViewAllHistory,
  onSelectReceipt,
  onNavigateToMyStores,
}) {
  const productName = product?.product || '';
  const [sortOrder, setSortOrder] = useState('dateDesc'); // デフォルト：日付順（新しい順）
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState(initialSearchText || ''); // 印字名の検索（ホームで印字名から開いたときは、その文字）
  const [showAllOthers, setShowAllOthers] = useState(false); // 「他の商品の最安値」をすべて表示中か

  // 自分のレシートから、この商品の購入履歴を取得
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage('');
      const result = await fetchProductPriceHistory(product);
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setHistoryData(result.data);
      } else {
        setHistoryData([]);
        setErrorMessage(result.error);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // 印字名の検索（読み込み済みの履歴を、画面の中で絞り込むだけ。通信はしない）。
  //  文字をそろえる処理は、履歴を読み込んだときに 1 回だけ行う
  const searchIndex = useMemo(
    () => historyData.map((item) => normalizeForSearch(item.itemName)),
    [historyData]
  );
  const isSearching = normalizeForSearch(searchText) !== '';
  const matchedHistory = useMemo(
    () => (isSearching ? historyData.filter((_, i) => matchesItemSearch(searchIndex[i], searchText)) : historyData),
    [historyData, searchIndex, searchText, isSearching]
  );

  // 並び替え処理
  const sortedHistory = [...matchedHistory].sort((a, b) => {
    if (sortOrder === 'priceAsc') return a.price - b.price;
    if (sortOrder === 'priceDesc') return b.price - a.price;
    return b.dateValue.localeCompare(a.dateValue); // dateDesc
  });

  // 同じカテゴリの商品でも、印字名が別の商品（例: ちいかわグミ／他メーカーのグミ）は、別々に最安値を出す
  const cheapestList = cheapestByItemName(matchedHistory);
  const topItem = cheapestList[0]; // いちばん安い商品は、大きいカードで
  const otherItems = cheapestList.slice(1); // 2 番目以降は、コンパクトな行（赤枠）で
  const visibleOthers = showAllOthers ? otherItems : otherItems.slice(0, OTHER_PREVIEW);

  // 履歴は最大4件までを表示（全件は「すべて見る」へ）
  //  検索中は、一致したものを全部出す（「すべて見る」の画面は、検索で絞り込まないため）
  const previewHistory = isSearching ? sortedHistory : sortedHistory.slice(0, 4);

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
            <div>
              <h2 className="product-name">{productName}</h2>
              {/* どの分類の商品か（例: 常温 > 麺類 > 乾麺） */}
              <div className="product-name-note">{formatPath(product)}</div>
            </div>
            <div className="product-image-container">
              <div className="product-image-placeholder">画像</div>
            </div>
          </div>
        </section>

        {loading && <div className="detail-message">データを読み込み中...</div>}

        {errorMessage && (
          <div className="detail-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && historyData.length === 0 && (
          <div className="detail-message">
            この商品の購入履歴はまだありません
          </div>
        )}

        {/* 印字名の検索（全角/半角・ひらがな/カタカナ・大文字/小文字・空白や記号の違いは、区別しない） */}
        {!loading && historyData.length > 0 && (
          <div className="item-search">
            <input
              type="search"
              className="item-search-input"
              placeholder="レシートの印字名で検索"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="レシートの印字名で検索"
              enterKeyHint="search"
            />
            {isSearching && (
              <span className="item-search-count">{matchedHistory.length}件</span>
            )}
          </div>
        )}

        {!loading && isSearching && matchedHistory.length === 0 && (
          <div className="detail-message">「{searchText.trim()}」に一致する購入履歴はありません</div>
        )}

        {/* 3. 最安値の購入。いちばん安い商品は大きいカード、印字名が別の商品（2 番目以降）はコンパクトな行 */}
        {!loading && topItem && (
          <section className="detail-section">
            <h3 className="section-title">最安値の購入</h3>
            {/* カード全体を押すと、そのレシートが開く（ほかのカードと同じ） */}
            <div
              className={`recent-purchase-card ${onSelectReceipt ? 'is-clickable' : ''}`}
              {...(onSelectReceipt
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => onSelectReceipt(topItem.cheapest.receiptId),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectReceipt(topItem.cheapest.receiptId);
                      }
                    },
                  }
                : {})}
            >
              <div className="recent-card-body">
                {/* 左: 商品名（左詰め）／ 右: 価格（右詰め） */}
                <span className="recent-item-name">
                  {withVolume(topItem.cheapest.itemName, topItem.cheapest.volume) || '印字名なし'}
                </span>
                <div className="recent-price-side">
                  <span className="current-price">{topItem.cheapest.price}<span className="unit">円</span></span>
                  {unitPriceText(topItem.cheapest.price, topItem.cheapest.volume) && (
                    <span className="recent-unit-price">{unitPriceText(topItem.cheapest.price, topItem.cheapest.volume)}</span>
                  )}
                </div>
              </div>
              <div className="recent-card-header">
                <span className="purchase-date">{topItem.cheapest.date}</span>
                <span className="history-shop">{topItem.cheapest.shop}</span>
                {/* 値引きの有無（購入履歴の行と同じ表示） */}
                <span className={`recent-card-count purchase-row-discount ${topItem.cheapest.isDiscount ? 'has-discount' : ''}`}>
                  {topItem.cheapest.isDiscount ? '値引きあり' : '値引きなし'}
                </span>
              </div>
            </div>

            {otherItems.length > 0 && (
              <>
                <div className="others-list">
                  {visibleOthers.map(({ key, cheapest, count }) => (
                    <PurchaseRow
                      key={key || 'no-name'}
                      card
                      primary={withVolume(cheapest.itemName, cheapest.volume) || '印字名なし'}
                      muted={!cheapest.itemName && !cheapest.volume}
                      sub={`${cheapest.date}  ${cheapest.shop} ・ 購入 ${count}件`}
                      price={cheapest.price}
                      unitPrice={unitPriceText(cheapest.price, cheapest.volume)}
                      isDiscount={cheapest.isDiscount}
                      onClick={onSelectReceipt ? () => onSelectReceipt(cheapest.receiptId) : undefined}
                    />
                  ))}
                </div>
                {otherItems.length > OTHER_PREVIEW && (
                  <button
                    type="button"
                    className="view-all-button"
                    onClick={() => setShowAllOthers((v) => !v)}
                  >
                    {showAllOthers ? '閉じる' : `他の商品をすべて表示（${otherItems.length}件）`}
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {/* 4. 購入履歴セクション */}
        {!loading && matchedHistory.length > 0 && (
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

            {/* 履歴リスト */}
            <div className="history-list">
              {previewHistory.map((item) => (
                <PurchaseRow
                  key={item.id}
                  card
                  primary={withVolume(item.itemName, item.volume) || '印字名なし'}
                  muted={!item.itemName && !item.volume}
                  sub={`${item.date}  ${item.shop}`}
                  price={item.price}
                  unitPrice={unitPriceText(item.price, item.volume)}
                  isDiscount={item.isDiscount}
                  onClick={onSelectReceipt ? () => onSelectReceipt(item.receiptId) : undefined}
                />
              ))}
            </div>

            {/* すべて見るボタン（4件を超える場合のみ） */}
            {!isSearching && historyData.length > previewHistory.length && (
              <button
                type="button"
                className="view-all-button"
                onClick={onViewAllHistory}
              >
                すべて見る
              </button>
            )}
          </section>
        )}
        {/* 5. マイ店舗の価格比較（自分＋価格データを提供している他のユーザー） */}
        {product?.product && (
          <MyStorePrices
            product={product}
            ownHistory={historyData}
            ownLoading={loading}
            onManageStores={onNavigateToMyStores}
            onSelectReceipt={onSelectReceipt}
          />
        )}
      </main>
    </div>
  );
}