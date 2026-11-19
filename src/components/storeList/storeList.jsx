import { useState, useMemo } from 'react';
import './storeList.css';
import { useReceiptHistory } from '../../utils/receiptCache';
import { getChainName } from '../../utils/storeNameNormalizer';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import Icon from '../icon/icon';
import { SkeletonList, EmptyState } from '../common/common';

const UNREGISTERED = '店舗名未登録';

/**
 * 店舗別の一覧
 *  同じチェーン（例: 「ディオ 和泉店」「ディオ 堺店」→「ディオ」）の店舗をまとめて表示する。
 *  チェーンをタップすると、そのチェーンの店舗（支店名つき）が開く。店舗をタップすると、その店舗の画面（店舗詳細）へ行く。
 * @param {string|null} openChain 開いているチェーン名（店舗詳細から戻ったときも、開いたままにするため、親が持つ）
 * @param {(name: string|null) => void} onOpenChainChange
 * @param {(storeName: string) => void} onSelectStore 店舗を選んだとき（店舗詳細へ）
 */
export default function StoreList({ onBack, onSelectStore, openChain = null, onOpenChainChange, onOpenMyStores, onOpenCamera }) {
  const { receipts, loading, errorMessage } = useReceiptHistory(); // 覚えた一覧を使う（画像は読まない。utils/receiptCache.js）
  const [localOpen, setLocalOpen] = useState(null); // 親が開いたチェーンを持たないときの控え
  const openName = onOpenChainChange ? openChain : localOpen;
  const setOpenName = onOpenChainChange || setLocalOpen;

  // チェーンごとにまとめる（レシートの多い順 → 新しい順）
  const chains = useMemo(() => {
    const map = new Map();
    receipts.forEach((receipt) => {
      const name = getChainName(receipt.store_name);
      if (!map.has(name)) map.set(name, { name, receipts: [], latest: '' });
      const group = map.get(name);
      group.receipts.push(receipt);
      const date = receipt.purchase_date || '';
      if (date > group.latest) group.latest = date;
    });

    return Array.from(map.values())
      .map((group) => {
        // 同じチェーンの中の店舗（支店名つきの店舗名ごと。レシートの多い順 → 新しい順）
        const byStore = new Map();
        group.receipts.forEach((r) => {
          const storeName = r.store_name || UNREGISTERED;
          if (!byStore.has(storeName)) byStore.set(storeName, { name: storeName, count: 0, latest: '' });
          const store = byStore.get(storeName);
          store.count += 1;
          if ((r.purchase_date || '') > store.latest) store.latest = r.purchase_date || '';
        });
        const stores = Array.from(byStore.values()).sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
        return { ...group, stores, storeCount: stores.length };
      })
      .sort((a, b) => b.receipts.length - a.receipts.length || b.latest.localeCompare(a.latest));
  }, [receipts]);

  return (
    <div className="store-list-container">
      {/* 1. ヘッダー */}
      <header className="store-list-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">店舗</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. メインコンテンツ（チェーン別カード） */}
      <main className="store-list-main">
        {/* マイ店舗（よく行く店舗を登録して、価格を比べる） */}
        {onOpenMyStores && (
          <button type="button" className="store-mystores-link" onClick={onOpenMyStores}>
            <span className="store-mystores-icon"><Icon name="star" size={20} /></span>
            <span className="store-mystores-text">
              <span className="store-mystores-title">マイ店舗</span>
              <span className="store-mystores-sub">よく行く店舗を登録すると、商品ごとに価格を比べられます</span>
            </span>
            <Icon name="chevronRight" size={18} />
          </button>
        )}

        {loading && <SkeletonList rows={4} />}

        {errorMessage && (
          <div className="no-stores-message" style={{ color: 'var(--danger)' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && chains.length === 0 && (
          <EmptyState
            icon="store"
            title="まだ店舗がありません"
            text="レシートを撮影すると、お店ごとにまとまって、ここに出ます。"
            actionLabel={onOpenCamera ? 'レシートを撮影する' : undefined}
            actionIcon="camera"
            onAction={onOpenCamera}
          />
        )}

        {!loading && chains.length > 0 && (
          <div className="store-chain-list">
            {chains.map((chain) => {
              const isOpen = openName === chain.name;
              return (
                <section key={chain.name} className="store-chain-card">
                  <button
                    type="button"
                    className="store-chain-header"
                    onClick={() => setOpenName(isOpen ? null : chain.name)}
                    aria-expanded={isOpen}
                  >
                    <span className="store-chain-icon"><Icon name="store" size={22} /></span>
                    <span className="store-chain-text">
                      <span className="store-chain-name">{chain.name}</span>
                      <span className="store-chain-meta">
                        {chain.storeCount}店舗 ・ {chain.receipts.length}件
                        {chain.latest && ` ・ 最新 ${chain.latest}`}
                      </span>
                    </span>
                    <span className={`store-chain-arrow ${isOpen ? 'is-open' : ''}`}>›</span>
                  </button>

                  {isOpen && (
                    <ul className="store-receipt-list">
                      {chain.stores.map((store) => (
                        <li key={store.name}>
                          <button type="button" className="store-receipt-row" onClick={() => onSelectStore && onSelectStore(store.name)}>
                            <span className="store-receipt-store">{store.name}</span>
                            <span className="store-branch-meta">
                              {store.count}件{store.latest && ` ・ 最新 ${formatPurchaseDate(store.latest)}`}
                            </span>
                            <span className="store-branch-arrow">›</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
