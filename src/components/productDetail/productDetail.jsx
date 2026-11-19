import { useState, useEffect, useMemo } from 'react';
import './productDetail.css';
import { fetchProductPriceHistory } from '../../utils/receiptDb';
import { isOtherPath, pathTitle, formatPlace, productKey } from '../../utils/categoryUtils';
import { rememberScreenState, peekScreenState, clearScreenState, restoreScroll } from '../../utils/screenState';
import MyStorePrices from '../myStorePrices/myStorePrices';
import ProductIcon from '../productIcon/productIcon';
import { canFavorite } from '../../utils/favorites';
import PurchaseRow from '../purchaseRow/purchaseRow';
import { unitPriceText } from '../../utils/volume';
import { cheapestByItemName, normalizeForSearch, matchesItemSearch } from '../../utils/itemNameGroup';
import { SkeletonList } from '../common/common';
import Icon from '../icon/icon';

const OTHER_PREVIEW = 1; // 「他の商品の最安値」を最初に見せる件数（残りは「すべて表示」）

// 印字名に容量を添える（例: "明治おいしい牛乳 ・ 900ml"）
const withVolume = (itemName, volume) => [itemName, volume].filter(Boolean).join(' ・ ');

// product: { main, category, sub, product }（同じ名前の商品を場所で区別する）
export default function ProductDetail({
  product,
  initialSearchText = '',
  isFavorite = false,
  onToggleFavorite,
  onBack,
  onViewAllHistory,
  onSelectReceipt,
  onNavigateToMyStores,
}) {
  const productName = pathTitle(product); // 「その他」の箱は「菓子のその他」など
  // 「すべて見る」・レシートから戻ってきたときは、並び替え・検索・スクロールの位置を元に戻す（utils/screenState.js）
  const stateKey = `productDetail:${productKey(product)}`;
  const [returned] = useState(() => peekScreenState(stateKey));
  const [sortOrder, setSortOrder] = useState(returned?.sortOrder ?? 'dateDesc'); // デフォルト：日付順（新しい順）
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchText, setSearchText] = useState(returned?.searchText ?? (initialSearchText || '')); // 印字名の検索（ホームで印字名から開いたときは、その文字）
  const [showAllOthers, setShowAllOthers] = useState(returned?.showAllOthers ?? false); // 「他の商品の最安値」をすべて表示中か

  // 戻ってきたときは、読み込みが終わって、行が並んだあとに、押したときの位置へ戻す（1 回だけ）
  useEffect(() => {
    if (loading || !returned) return;
    restoreScroll(returned);
    clearScreenState(stateKey);
  }, [loading, returned, stateKey]);

  // 別の画面へ移る直前に、今の状態を覚える
  const leave = (go) => (...args) => {
    rememberScreenState(stateKey, { sortOrder, searchText, showAllOthers });
    go(...args);
  };
  const openReceipt = onSelectReceipt ? leave(onSelectReceipt) : undefined;
  const openAllHistory = onViewAllHistory
    ? leave(() => {
        clearScreenState(`productHistory:${productKey(product)}`); // 「すべて見る」は、いちばん上から
        onViewAllHistory();
      })
    : undefined;
  const openMyStores = onNavigateToMyStores ? leave(onNavigateToMyStores) : undefined;

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

  // いちばん安かった購入（全部の履歴から。商品名のすぐ下に、大きく出す）と、いちばん高かった値段
  const best = historyData.reduce((min, item) => (min === null || item.price < min.price ? item : min), null);
  const highest = historyData.reduce((max, item) => Math.max(max, Number(item.price) || 0), 0);

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
        {/* お気に入り（☆ → ★）。ホームの「お気に入り」に出る */}
        {onToggleFavorite && canFavorite(product) ? (
          <button
            type="button"
            className={`favorite-button ${isFavorite ? 'is-on' : ''}`}
            onClick={() => onToggleFavorite(product)}
            aria-pressed={!!isFavorite}
            aria-label={isFavorite ? 'お気に入りから外す' : 'お気に入りに入れる'}
          >
            <Icon name="star" size={24} filled={!!isFavorite} />
          </button>
        ) : (
          <div className="header-right-spacer"></div>
        )}
      </header>

      {/* メインコンテンツ */}
      <main className="product-detail-main">
        {/* 2. 上部：商品名 & 画像 */}
        <section className="product-title-card">
          <div className="product-info-wrapper">
            <div>
              <h2 className="product-name">{productName}</h2>
              {/* どの分類の商品か（例: 常温 > 麺類 > 乾麺） */}
              <div className="product-name-note">{formatPlace(product)}</div>
            </div>
            <div className="product-image-container">
              <div className="product-image-placeholder">
                <ProductIcon product={product} fallback="画像" />
              </div>
            </div>
          </div>

          {/* いちばん安かった値段とお店（押すと、そのレシートが開く） */}
          {!loading && best && (
            <button
              type="button"
              className="best-price-banner"
              onClick={openReceipt ? () => openReceipt(best.receiptId) : undefined}
              disabled={!openReceipt}
            >
              <span className="best-price-icon"><Icon name="trophy" size={22} /></span>
              <span className="best-price-body">
                <span className="best-price-label">いちばん安かった</span>
                <span className="best-price-shop">{best.shop || '店舗名未登録'}</span>
                <span className="best-price-date">{best.date}</span>
              </span>
              <span className="best-price-value">
                <span className="best-price-amount">{Number(best.price).toLocaleString()}</span>
                <span className="best-price-unit">円</span>
                {highest > best.price && (
                  <span className="best-price-diff">最高より {(highest - best.price).toLocaleString()}円 安い</span>
                )}
              </span>
            </button>
          )}
        </section>

        {loading && <SkeletonList rows={3} thumb={false} />}

        {errorMessage && (
          <div className="detail-message" style={{ color: 'var(--danger)' }}>
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
              className={`recent-purchase-card ${openReceipt ? 'is-clickable' : ''}`}
              {...(onSelectReceipt
                ? {
                    role: 'button',
                    tabIndex: 0,
                    onClick: () => openReceipt(topItem.cheapest.receiptId),
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openReceipt(topItem.cheapest.receiptId);
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
                      onClick={openReceipt ? () => openReceipt(cheapest.receiptId) : undefined}
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
                  onClick={openReceipt ? () => openReceipt(item.receiptId) : undefined}
                />
              ))}
            </div>

            {/* すべて見るボタン（4件を超える場合のみ） */}
            {!isSearching && historyData.length > previewHistory.length && (
              <button
                type="button"
                className="view-all-button"
                onClick={openAllHistory}
              >
                すべて見る
              </button>
            )}
          </section>
        )}
        {/* 5. マイ店舗の価格比較（自分＋価格データを提供している他のユーザー）。
            「その他」の箱は、いろいろな商品が入るので、比べない */}
        {isOtherPath(product) && (
          <p className="detail-other-note">
            「その他」には、いろいろな商品が入るため、マイ店舗の価格比較は出しません。
          </p>
        )}
        {product?.product && !isOtherPath(product) && (
          <MyStorePrices
            product={product}
            ownHistory={historyData}
            ownLoading={loading}
            onManageStores={openMyStores}
            onSelectReceipt={openReceipt}
          />
        )}
      </main>
    </div>
  );
}