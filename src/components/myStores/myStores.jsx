import { useState, useEffect, useMemo } from 'react';
import './myStores.css';
import { showUndoToast } from '../../utils/undoToast';
import { SkeletonList } from '../common/common';
import Icon from '../icon/icon';
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
  const [busy, setBusy] = useState(false); // 登録・削除の途中（続けて押せないように）

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

  // 登録・削除は、確認を出さずに、すぐ行う。数秒のあいだ「元に戻す」で取り消せる
  //  （マイ店舗は店舗名だけなので、削除の取り消しは、同じ名前で登録し直す）
  const removeByName = async (storeName) => {
    const mine = await fetchMyStores();
    const row = mine.success ? mine.data.find((s) => s.store_name === storeName) : null;
    return row ? removeMyStore(row.id) : { success: true };
  };

  const runChange = async (action, message, undoAction) => {
    setBusy(true);
    const result = await action();
    if (!result.success) {
      setBusy(false);
      setErrorMessage(result.error);
      return;
    }
    await load();
    setBusy(false);
    showUndoToast({
      message,
      onUndo: async () => {
        const undo = await undoAction();
        if (!undo.success) showUndoToast({ message: `元に戻せませんでした: ${undo.error}` });
        await load();
      },
    });
  };

  const handleAdd = (storeName) =>
    runChange(() => addMyStore(storeName), `「${storeName}」を登録しました`, () => removeByName(storeName));

  const handleRemove = (store) =>
    runChange(() => removeMyStore(store.id), `「${store.store_name}」を削除しました`, () => addMyStore(store.store_name));

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
          <SkeletonList rows={3} thumb={false} />
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
                      <span className="my-stores-icon"><Icon name="star" size={18} filled /></span>
                      <span className="my-stores-name">{store.store_name}</span>
                      <button
                        type="button"
                        className="my-stores-remove"
                        disabled={busy}
                        onClick={() => handleRemove(store)}
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
                          disabled={busy}
                          onClick={() => handleAdd(name)}
                        >
                          <span className="my-stores-icon"><Icon name="store" size={18} /></span>
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

    </div>
  );
}
