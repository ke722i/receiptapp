import { useState, useEffect, useMemo } from 'react';
import './myStores.css';
import ConfirmDialog from '../confirmDialog/confirmDialog';
import {
  fetchMyStores,
  addMyStore,
  removeMyStore,
  fetchComparableStores,
} from '../../utils/myStoreDb';
import { matchesStoreQuery } from '../../utils/myStoreCompare';

const MAX_CANDIDATES = 50; // 候補は多すぎると探しにくいので、検索で絞ってもらう

/**
 * マイ店舗の登録・削除
 *  登録した店舗は、商品詳細の「マイ店舗の価格比較」に出る
 */
export default function MyStores({ onBack }) {
  const [myStores, setMyStores] = useState([]);
  const [allStores, setAllStores] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  // 確認中の操作: { type: 'add', storeName } / { type: 'remove', id, storeName }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [mine, all] = await Promise.all([fetchMyStores(), fetchComparableStores()]);
    if (!mine.success || !all.success) {
      setErrorMessage((!mine.success ? mine.error : all.error) || '読み込みに失敗しました。');
    } else {
      setErrorMessage('');
      setMyStores(mine.data);
      setAllStores(all.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyStores(), fetchComparableStores()]).then(([mine, all]) => {
      if (cancelled) return;
      if (!mine.success || !all.success) {
        setErrorMessage((!mine.success ? mine.error : all.error) || '読み込みに失敗しました。');
      } else {
        setMyStores(mine.data);
        setAllStores(all.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 登録できる店舗（登録済みは除く）を、検索の文字で絞る
  const registered = useMemo(() => new Set(myStores.map((s) => s.store_name)), [myStores]);
  const candidates = useMemo(
    () => allStores.filter((name) => !registered.has(name) && matchesStoreQuery(name, query)),
    [allStores, registered, query]
  );

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    const result =
      pending.type === 'add' ? await addMyStore(pending.storeName) : await removeMyStore(pending.id);
    setBusy(false);
    setPending(null);
    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }
    await load();
  };

  return (
    <div className="my-stores-container">
      <header className="my-stores-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">マイ店舗</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="my-stores-main">
        <p className="my-stores-note">
          よく行く店舗を登録すると、商品詳細の「マイ店舗の価格比較」で、自分のレシートと、
          価格データを提供している他のユーザーのレシートの価格を比べられます。
        </p>

        {errorMessage && <div className="my-stores-error">{errorMessage}</div>}

        {loading ? (
          <div className="my-stores-message">データを読み込み中...</div>
        ) : (
          <>
            {/* 登録中の店舗 */}
            <section className="my-stores-section">
              <h2 className="my-stores-section-title">登録中の店舗（{myStores.length}）</h2>
              {myStores.length === 0 ? (
                <div className="my-stores-card my-stores-empty">まだ登録されていません</div>
              ) : (
                <ul className="my-stores-card my-stores-list">
                  {myStores.map((store) => (
                    <li key={store.id} className="my-stores-row">
                      <span className="my-stores-icon">⭐</span>
                      <span className="my-stores-name">{store.store_name}</span>
                      <button
                        type="button"
                        className="my-stores-remove"
                        onClick={() => setPending({ type: 'remove', id: store.id, storeName: store.store_name })}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 店舗を追加 */}
            <section className="my-stores-section">
              <h2 className="my-stores-section-title">店舗を追加</h2>
              <input
                type="search"
                className="my-stores-search"
                placeholder="店舗名で検索（例: ディオ、和泉）"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                enterKeyHint="search"
              />
              {candidates.length === 0 ? (
                <div className="my-stores-card my-stores-empty">
                  {allStores.length === 0
                    ? '登録できる店舗がありません（レシートを登録すると、その店舗が選べるようになります）'
                    : '該当する店舗がありません'}
                </div>
              ) : (
                <>
                  <ul className="my-stores-card my-stores-list">
                    {candidates.slice(0, MAX_CANDIDATES).map((name) => (
                      <li key={name}>
                        <button
                          type="button"
                          className="my-stores-row my-stores-candidate"
                          onClick={() => setPending({ type: 'add', storeName: name })}
                        >
                          <span className="my-stores-icon">🏪</span>
                          <span className="my-stores-name">{name}</span>
                          <span className="my-stores-add">＋ 登録</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {candidates.length > MAX_CANDIDATES && (
                    <p className="my-stores-more">
                      ほか {candidates.length - MAX_CANDIDATES} 店舗。店舗名で絞り込んでください。
                    </p>
                  )}
                </>
              )}
              <p className="my-stores-note">
                自分のレシートの店舗と、価格データを提供している他のユーザーのレシートの店舗から選べます。
              </p>
            </section>
          </>
        )}
      </main>

      {pending && (
        <ConfirmDialog
          title={pending.type === 'add' ? '店舗の登録' : '店舗の削除'}
          message={
            pending.type === 'add'
              ? `「${pending.storeName}」をマイ店舗に登録しますか？`
              : `「${pending.storeName}」をマイ店舗から削除しますか？`
          }
          confirmLabel={pending.type === 'add' ? '登録する' : '削除する'}
          danger={pending.type === 'remove'}
          busy={busy}
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
