import { useState, useEffect, useMemo } from 'react';
import './storeList.css';
import { fetchReceiptHistory } from '../../utils/receiptDb';
import { getChainName } from '../../utils/storeNameNormalizer';
import { formatPurchaseDate } from '../../utils/purchaseDate';

/**
 * 店舗別の一覧
 *  同じチェーン（例: 「ディオ 和泉店」「ディオ 堺店」→「ディオ」）のレシートをまとめて表示する。
 *  チェーンをタップすると、そのチェーンのレシートが支店名つきで開く。
 */
export default function StoreList({ onBack, onSelectReceiptDetail }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [openChain, setOpenChain] = useState(null); // 開いているチェーン名

  // Supabase からレシート履歴を取得
  useEffect(() => {
    const load = async () => {
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

    load();
  }, []);

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
      .map((group) => ({
        ...group,
        // 同じチェーンの中の店舗数（支店名つきの店舗名の種類）
        storeCount: new Set(group.receipts.map((r) => r.store_name || '')).size,
      }))
      .sort((a, b) => b.receipts.length - a.receipts.length || b.latest.localeCompare(a.latest));
  }, [receipts]);

  return (
    <div className="store-list-container">
      {/* 1. ヘッダー */}
      <header className="store-list-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">店舗別一覧</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. メインコンテンツ（チェーン別カード） */}
      <main className="store-list-main">
        {loading && <div className="no-stores-message">データを読み込み中...</div>}

        {errorMessage && (
          <div className="no-stores-message" style={{ color: '#c62828' }}>
            {errorMessage}
          </div>
        )}

        {!loading && !errorMessage && chains.length === 0 && (
          <div className="no-stores-message">登録されたレシートはありません</div>
        )}

        {!loading && chains.length > 0 && (
          <div className="store-chain-list">
            {chains.map((chain) => {
              const isOpen = openChain === chain.name;
              return (
                <section key={chain.name} className="store-chain-card">
                  <button
                    type="button"
                    className="store-chain-header"
                    onClick={() => setOpenChain(isOpen ? null : chain.name)}
                    aria-expanded={isOpen}
                  >
                    <span className="store-chain-icon">🏪</span>
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
                      {chain.receipts.map((receipt) => {
                        const itemCount = (receipt.receipt_items || []).length;
                        return (
                          <li key={receipt.id}>
                            <button
                              type="button"
                              className="store-receipt-row"
                              onClick={() => onSelectReceiptDetail && onSelectReceiptDetail(receipt)}
                            >
                              <span className="store-receipt-date">{formatPurchaseDate(receipt.purchase_date)}</span>
                              <span className="store-receipt-store">
                                {receipt.store_name || '店舗名未登録'}
                              </span>
                              <span className="store-receipt-count">{itemCount}点</span>
                            </button>
                          </li>
                        );
                      })}
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
