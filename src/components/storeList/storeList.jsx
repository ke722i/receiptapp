import { useState, useMemo, useEffect, useRef } from 'react';
import './storeList.css';
import { useReceiptHistory } from '../../utils/receiptCache';
import { getChainName } from '../../utils/storeNameNormalizer';
import { normalizeForSearch } from '../../utils/itemNameGroup';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import Icon from '../icon/icon';
import { SkeletonList, EmptyState } from '../common/common';
import { rememberScreenState, peekScreenState, clearScreenState } from '../../utils/screenState';

const STATE_KEY = 'storeList'; // 店舗詳細から戻ったとき、開いた店舗の行まで戻す（utils/screenState.js）

const UNREGISTERED = '店舗名未登録';

// 並び替え（チェーンの並びも、チェーンの中の店舗の並びも、同じ選択肢）。既定はレシートの多い順。選んだものは端末に覚える
const SORT_OPTIONS = [
  { value: 'count', label: 'レシートの多い順' },
  { value: 'latest', label: '最新の購入日順' },
  { value: 'name', label: '店舗名（あいうえお順）' },
];
const SORT_STORAGE_KEY = 'receipt_app_store_list_sort';
const loadSort = () => {
  try {
    const value = localStorage.getItem(SORT_STORAGE_KEY);
    if (SORT_OPTIONS.some((option) => option.value === value)) return value;
  } catch {
    // 使えないときは、既定の並び替え
  }
  return 'count';
};

// a・b は { name, count, latest }。同じ順位のときは、もう一方の条件で並べる
const compareStores = (sortKey) => {
  const byCount = (a, b) => b.count - a.count || b.latest.localeCompare(a.latest);
  const byLatest = (a, b) => b.latest.localeCompare(a.latest) || b.count - a.count;
  const byName = (a, b) => {
    if (a.name === UNREGISTERED && b.name !== UNREGISTERED) return 1; // 店舗名未登録は最後
    if (b.name === UNREGISTERED && a.name !== UNREGISTERED) return -1;
    return a.name.localeCompare(b.name, 'ja') || byCount(a, b);
  };
  return { count: byCount, latest: byLatest, name: byName }[sortKey] || byCount;
};

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
  const [returned] = useState(() => peekScreenState(STATE_KEY)); // 店舗詳細から戻ってきたか
  const [sortKey, setSortKey] = useState(loadSort);
  const [searchText, setSearchText] = useState(''); // 店舗名の検索（チェーン名・支店名。空白・大文字小文字・全角半角は区別しない）
  const scrolledRef = useRef(false);
  const openName = onOpenChainChange ? openChain : localOpen;
  const setOpenName = onOpenChainChange || setLocalOpen;

  const changeSort = (value) => {
    setSortKey(value);
    try {
      localStorage.setItem(SORT_STORAGE_KEY, value);
    } catch {
      // 覚えられなくても、この画面では使える
    }
  };

  // チェーンごとにまとめる（並びは、選んだ並び替え）
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
        // 同じチェーンの中の店舗（支店名つきの店舗名ごと）
        const byStore = new Map();
        group.receipts.forEach((r) => {
          const storeName = r.store_name || UNREGISTERED;
          if (!byStore.has(storeName)) byStore.set(storeName, { name: storeName, count: 0, latest: '' });
          const store = byStore.get(storeName);
          store.count += 1;
          if ((r.purchase_date || '') > store.latest) store.latest = r.purchase_date || '';
        });
        const stores = Array.from(byStore.values()).sort(compareStores(sortKey));
        return { ...group, count: group.receipts.length, stores, storeCount: stores.length };
      })
      .sort(compareStores(sortKey));
  }, [receipts, sortKey]);

  // 検索: チェーン名に当たれば、そのチェーンの店舗は全部。支店名だけに当たれば、当たった店舗だけ（そのチェーンは開いて見せる）
  const query = normalizeForSearch(searchText);
  const visibleChains = useMemo(() => {
    if (!query) return chains.map((chain) => ({ ...chain, shown: chain.stores, forceOpen: false }));
    return chains
      .map((chain) => {
        if (normalizeForSearch(chain.name).includes(query)) return { ...chain, shown: chain.stores, forceOpen: false };
        const shown = chain.stores.filter((store) => normalizeForSearch(store.name).includes(query));
        return { ...chain, shown, forceOpen: true };
      })
      .filter((chain) => chain.shown.length > 0);
  }, [chains, query]);

  // 戻ってきたら、開いた店舗の行が見える位置まで動かす（一覧が並んだあとに、1 回だけ）
  useEffect(() => {
    if (loading || scrolledRef.current) return;
    scrolledRef.current = true;
    if (!returned) return;
    const row = Array.from(document.querySelectorAll('[data-store-name]')).find((el) => el.getAttribute('data-store-name') === returned.storeName);
    row?.scrollIntoView({ block: 'center' });
    clearScreenState(STATE_KEY);
  }, [loading, returned]);

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
          <div className="store-toolbar">
            <div className="store-search-field">
              <Icon name="search" size={18} className="store-search-icon" />
              <input
                type="search"
                className="store-search-input"
                placeholder="店舗名で探す"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="店舗名で探す"
                enterKeyHint="search"
              />
            </div>
            <label className="store-sort-chip">
              <span className="visually-hidden">並び替え</span>
              <select value={sortKey} onChange={(e) => changeSort(e.target.value)} aria-label="並び替え">
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={14} />
            </label>
          </div>
        )}

        {!loading && chains.length > 0 && visibleChains.length === 0 && (
          <div className="no-stores-message">「{searchText.trim()}」に合う店舗はありません</div>
        )}

        {!loading && visibleChains.length > 0 && (
          <div className="store-chain-list">
            {visibleChains.map((chain) => {
              const isOpen = chain.forceOpen || openName === chain.name;
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
                      {chain.shown.map((store) => (
                        <li key={store.name}>
                          <button
                            type="button"
                            className="store-receipt-row"
                            data-store-name={store.name}
                            onClick={() => {
                              rememberScreenState(STATE_KEY, { storeName: store.name });
                              if (onSelectStore) onSelectStore(store.name);
                            }}
                          >
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
