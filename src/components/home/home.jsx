import { useState, useMemo, useEffect, useRef } from 'react';
import './home.css';
import {
  CATEGORY_TREE,
  INITIAL_SEARCH_HISTORY,
} from '../../constants/categoryData';
import {
  buildItemReadingMap,
  filterSearchSuggestions,
  filterCategorySuggestions,
  buildItemNameIndex,
  filterItemNameSuggestions,
} from '../../utils/searchUtils';
import { fetchMyItemNames } from '../../utils/receiptDb';
import Avatar from '../avatar/avatar';
import ProductIcon from '../productIcon/productIcon';
import {
  findProductPaths,
  formatPath,
  productKey,
  OTHER,
  isOtherPath,
  isOpenablePath,
  otherMainPath,
  otherMidPath,
  otherSubPath,
  otherProductPath,
} from '../../utils/categoryUtils';

const SEARCH_INPUT_ID = 'home-search-input';
const STORAGE_KEY_PROPOSAL_TIP = 'receipt_app_proposal_tip_dismissed'; // カテゴリの提案のお知らせを閉じたか
const STORAGE_KEY_SEARCH_HISTORY = 'receipt_app_search_history';
const STORAGE_KEY_SEARCH_FILTER = 'receipt_app_search_filter'; // 検索の切り替え（最後に選んだもの）

// 検索の対象（検索バーの左のプルダウン）。すべて（カテゴリ・商品名・印字名）／カテゴリだけ／商品名だけ
const SEARCH_FILTERS = [
  { value: 'all', label: 'すべて', placeholder: '例: ぎゅうにゅう' },
  { value: 'category', label: 'カテゴリ', placeholder: '例: ちょうみりょう' },
  { value: 'item', label: '商品名', placeholder: '例: ぎゅうにゅう' },
];
// 「すべて」のときに、種類ごとに出す最大の件数（切り替えたときは、もっと出す）
const ALL_LIMIT = { category: 3, product: 5, item: 5 };
const ONE_LIMIT = { category: 20, product: 10, item: 20 };

// 履歴の1件を商品のパス { main, category, sub, product } にそろえる
//  （以前は商品名の文字列で保存していたので、文字列なら表から探して変換する）
const toProductPath = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return findProductPaths(entry)[0] || null;
  return entry.product || isOtherPath(entry) ? entry : null; // 「その他」の箱（閲覧履歴から開き直す）も
};

export default function Home({
  onLogout,
  onNavigateToCategory,
  onOpenCamera,
  onNavigateToHistory,
  onNavigateToStores,
  onNavigateToMyStores,
  onNavigateToSettings,
  onOpenCategoryProposal,
  onSelectProduct,
  viewHistory = [],
  userId = 'User_12345',
  avatarId = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState({});
  const [highlightCategory, setHighlightCategory] = useState(null); // 検索から開いた分類（少しのあいだ色を付ける）

  // 検索の切り替え（端末に覚える）
  const [searchFilter, setSearchFilter] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SEARCH_FILTER);
      return SEARCH_FILTERS.some((f) => f.value === saved) ? saved : 'all';
    } catch {
      return 'all';
    }
  });
  const changeSearchFilter = (value) => {
    setSearchFilter(value);
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_FILTER, value);
    } catch {
      // 保存できなくても、この画面では切り替える
    }
  };

  // 自分のレシートの印字名（「すべて」で、検索を始めたときに 1 回だけ読み込む。印字名は「すべて」のときだけ探す）
  const [itemNames, setItemNames] = useState(null); // null: まだ / { index } / { error }

  // カテゴリの提案のお知らせ（「×」で閉じたら、この端末では、もう出さない）
  const [showProposalTip, setShowProposalTip] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_PROPOSAL_TIP) !== '1';
    } catch {
      return true;
    }
  });
  const dismissProposalTip = () => {
    setShowProposalTip(false);
    try {
      localStorage.setItem(STORAGE_KEY_PROPOSAL_TIP, '1');
    } catch {
      // 保存できなくても、この画面では閉じる
    }
  };

  // 検索タグ履歴の初期化
  const [searchHistory, setSearchHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SEARCH_HISTORY);
      const list = saved ? JSON.parse(saved) : (INITIAL_SEARCH_HISTORY || []);
      return list.map(toProductPath).filter(Boolean);
    } catch {
      return [];
    }
  });

  // よみマップの事前生成
  const itemReadingMap = useMemo(() => buildItemReadingMap(), []);

  // リアルタイム検索候補（最大10件・前方一致優先）
  const suggestions = useMemo(
    () => filterSearchSuggestions(searchQuery, itemReadingMap),
    [searchQuery, itemReadingMap]
  );

  // 検索履歴の商品（候補を、履歴を先に並べるために使う）
  const historyKeys = useMemo(() => new Set(searchHistory.map((path) => productKey(path))), [searchHistory]);

  // 候補（商品名）を表の場所ごとに展開する。
  // 同じ名前の商品が複数の場所にある場合（例: 常温の「そば」と冷凍の「そば」）は別々の候補になる。
  const pathSuggestions = useMemo(() => {
    const seen = new Set();
    const list = [];
    suggestions.forEach((name) => {
      findProductPaths(name).forEach((path) => {
        const key = productKey(path);
        if (!seen.has(key)) {
          seen.add(key);
          list.push(path);
        }
      });
    });
    // 検索したことのある商品を、先に出す（YouTube の検索履歴のように）
    const inHistory = list.filter((path) => historyKeys.has(productKey(path)));
    const others = list.filter((path) => !historyKeys.has(productKey(path)));
    return [...inHistory, ...others].slice(0, 10);
  }, [suggestions, historyKeys]);

  // 切り替えに合わせた、検索結果（カテゴリ・商品名・印字名）
  const trimmedQuery = searchQuery.trim();
  const wantsCategories = searchFilter !== 'item';
  const wantsProducts = searchFilter !== 'category';
  const wantsItemNames = searchFilter === 'all';
  const limits = searchFilter === 'all' ? ALL_LIMIT : ONE_LIMIT;
  const categoryResults = useMemo(
    () => (wantsCategories && trimmedQuery ? filterCategorySuggestions(trimmedQuery, limits.category) : []),
    [wantsCategories, trimmedQuery, limits.category]
  );
  const productResults = wantsProducts && trimmedQuery ? pathSuggestions.slice(0, limits.product) : [];
  const itemResults = useMemo(
    () =>
      wantsItemNames && trimmedQuery && itemNames?.index
        ? filterItemNameSuggestions(itemNames.index, trimmedQuery, limits.item)
        : [],
    [wantsItemNames, trimmedQuery, itemNames, limits.item]
  );
  const itemNamesLoading = wantsItemNames && Boolean(trimmedQuery) && itemNames === null;

  // 印字名の読み込み（必要になったときに 1 回だけ。読み込んだものは、DB の処理の側でも覚えている）
  useEffect(() => {
    if (!isSearchFocused || searchFilter !== 'all' || itemNames !== null) return undefined;
    let cancelled = false;
    fetchMyItemNames().then((result) => {
      if (cancelled) return;
      setItemNames(result.success ? { index: buildItemNameIndex(result.data) } : { error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [isSearchFocused, searchFilter, itemNames]);

  // 検索から開いた分類まで、画面を動かす
  useEffect(() => {
    if (!highlightCategory) return undefined;
    document.getElementById(`cat-${highlightCategory}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(() => setHighlightCategory(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightCategory]);

  // 検索キーワード履歴の永続化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(searchHistory));
    } catch (err) {
      console.error('Failed to save search history:', err);
    }
  }, [searchHistory]);

  const toggleCategory = (categoryId) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleMenuClick = (action) => {
    setIsMenuOpen(false);
    if (action) action();
  };

  const handleClearSearch = (e) => {
    e.stopPropagation();
    setSearchQuery('');
  };

  // 検索候補・検索履歴のタップ。
  //  iPhone では、候補を押すと、キーボードが閉じて画面がずれ、指を離す前にタップが取り消されて、
  //  click も touchend も届かないことがある。そのため、指が触れた瞬間（pointerdown）に選ぶ。
  //  選んで画面が移ったあとに、続けて来る click が、移った先の画面の部品を押してしまわないよう、
  //  その click は止める（パソコンのマウスでも同じ動き）。
  const tapAction = (action) => ({
    onMouseDown: (e) => e.preventDefault(), // 入力欄からフォーカスを外さない
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const stopClick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      document.addEventListener('click', stopClick, true);
      setTimeout(() => document.removeEventListener('click', stopClick, true), 700);
      action();
    },
    onClick: action, // pointerdown が使えない環境の、予備
  });
  const tapProps = (path) => tapAction(() => handleSelectProductItem(path));


  const searchBarRef = useRef(null);

  // 検索履歴の保存（画面が移ると、ホームの自動保存は動かないので、変えたらすぐ保存する）
  const saveSearchHistory = (list) => {
    setSearchHistory(list);
    try {
      localStorage.setItem(STORAGE_KEY_SEARCH_HISTORY, JSON.stringify(list));
    } catch (err) {
      console.error('Failed to save search history:', err);
    }
  };

  // 検索を閉じる（カテゴリを選んだとき・Esc キー）
  const closeSearch = () => {
    setIsSearchFocused(false);
    document.getElementById(SEARCH_INPUT_ID)?.blur();
  };

  // 行の右のボタン（検索欄に入れる ↖／履歴から消す ✕）。
  //  行全体は「触れた瞬間に選ぶ」ので、ボタンでは、それを起こさず、ボタンの動作だけをする
  const rowButtonProps = (action) => ({
    onMouseDown: (e) => e.preventDefault(),
    onPointerDown: (e) => {
      e.stopPropagation();
      e.preventDefault();
      action();
    },
    onClick: (e) => e.stopPropagation(),
  });
  const fillSearch = (name) => {
    setSearchQuery(name);
    document.getElementById(SEARCH_INPUT_ID)?.focus();
  };
  const removeFromHistory = (path) => {
    const key = productKey(path);
    saveSearchHistory(searchHistory.filter((item) => productKey(item) !== key));
  };

  // 検索欄の外側を押したら、候補を閉じる。
  //  以前は、画面全体を覆う透明な層を置いていたが、iPhone では、キーボードが開いて画面がずれたとき、
  //  その層が候補のタップを受けてしまい、候補を選べなかった。層は置かず、画面全体の押下を見て閉じる。
  useEffect(() => {
    if (!isSearchFocused) return undefined;
    const closeIfOutside = (e) => {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target)) {
        setIsSearchFocused(false);
        // 暗くなっている所を押したときは、閉じるだけ。下にある部品（カテゴリなど）は動かさない
        const stopClick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
        };
        document.addEventListener('click', stopClick, true);
        setTimeout(() => document.removeEventListener('click', stopClick, true), 700);
      }
    };
    document.addEventListener('pointerdown', closeIfOutside);
    return () => document.removeEventListener('pointerdown', closeIfOutside);
  }, [isSearchFocused]);

  // カテゴリの結果を選んだとき: 検索を閉じて、下のカテゴリ一覧を、その場所まで開く
  const handleSelectCategory = (entry) => {
    setSearchQuery('');
    closeSearch();
    setOpenCategories((prev) => {
      const next = { ...prev };
      entry.ids.forEach((id) => {
        next[id] = true;
      });
      return next;
    });
    setHighlightCategory(entry.ids[entry.ids.length - 1]);
  };

  // 印字名の結果を選んだとき: その商品の商品詳細を、入力した文字で絞り込んだ状態で開く（検索履歴には残さない）
  const handleSelectItemName = (entry) => {
    const text = trimmedQuery;
    setSearchQuery('');
    setIsSearchFocused(false);
    if (onSelectProduct) onSelectProduct(entry.path, { itemSearch: text });
  };

  // Enter: 出ている結果の、いちばん上を選ぶ（商品名 → カテゴリ → 印字名の順に並んでいる）
  const selectFirstResult = () => {
    if (productResults[0]) handleSelectProductItem(productResults[0]);
    else if (categoryResults[0]) handleSelectCategory(categoryResults[0]);
    else if (itemResults[0]) handleSelectItemName(itemResults[0]);
  };

  // 商品タップ時のハンドラー（検索履歴追加 ＆ 親の画面遷移ハンドラー呼出）
  //  path: { main, category, sub, product }（商品は名前ではなく場所で区別する）
  const handleSelectProductItem = (path) => {
    if (!isOpenablePath(path)) return;
    setSearchQuery('');
    setIsSearchFocused(false);

    // 検索タグ履歴更新（最新5件・同じ場所の商品は重複させない）
    const key = productKey(path);
    // 「その他」の箱（ホームのカテゴリの「その他」）は、検索履歴に残さない（商品名で探せないため）
    if (!isOtherPath(path)) saveSearchHistory([path, ...searchHistory.filter((item) => productKey(item) !== key)].slice(0, 5));

    // 親コンポーネント（App.jsx）で閲覧履歴更新と画面遷移を実行
    if (onSelectProduct) {
      onSelectProduct(path);
    } else if (onNavigateToCategory) {
      onNavigateToCategory(path);
    }
  };

  return (
    <div className="home-container">
      {/* ヘッダー */}
      <header className="home-header">
        <button
          type="button"
          className="hamburger-button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="メニューを開く"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        <div className="header-logo-area">
          <div className="header-logo-placeholder">レシート即！メモ</div>
        </div>

        <div className="header-right-spacer"></div>
      </header>

      {/* ドロワーメニュー */}
      <div
        className={`drawer-overlay ${isMenuOpen ? 'is-active' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />
      <aside className={`drawer-menu ${isMenuOpen ? 'is-active' : ''}`}>
        <div className="drawer-user-info">
          <div className="user-avatar">
            <Avatar avatarId={avatarId} size={44} />
          </div>
          <div className="user-details">
            <span className="user-label">ログインユーザー</span>
            <span className="user-id">{userId}</span>
          </div>
        </div>
        <nav className="drawer-nav">
          <button type="button" className="drawer-item" onClick={() => handleMenuClick()}>
            <span className="drawer-icon">🏠</span><span>ホーム</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onOpenCamera)}>
            <span className="drawer-icon">📷</span><span>レシート撮影</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToHistory)}>
            <span className="drawer-icon">📄</span><span>レシート一覧</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToStores)}>
            <span className="drawer-icon">🏪</span><span>店舗別一覧</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToMyStores)}>
            <span className="drawer-icon">⭐</span><span>マイ店舗</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToSettings)}>
            <span className="drawer-icon">⚙️</span><span>設定</span>
          </button>
        </nav>
        <div className="drawer-footer">
          <button type="button" className="drawer-item logout-item" onClick={() => handleMenuClick(onLogout)}>
            <span className="drawer-icon">🚪</span><span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="home-main">
        {/* 検索バー（YouTube のように、押すと、履歴と候補が出る。バーと候補以外は暗くなる） */}
        <div ref={searchBarRef} className={`search-bar-container ${isSearchFocused ? 'is-focused' : ''}`}>
          <div className="search-input-wrapper">
            {/* 検索の対象（すべて／カテゴリ／商品名）。検索バーの左に、いつも出す */}
            <select
              className="search-filter-select"
              value={searchFilter}
              onChange={(e) => {
                changeSearchFilter(e.target.value);
                // 検索中に切り替えたときは、続けて入力できるように、入力欄に戻す
                if (isSearchFocused) document.getElementById(SEARCH_INPUT_ID)?.focus();
              }}
              aria-label="検索の対象"
            >
              {SEARCH_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="search-field">
              <input
                id={SEARCH_INPUT_ID}
                type="search"
                className="search-input"
                placeholder={SEARCH_FILTERS.find((f) => f.value === searchFilter)?.placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    closeSearch();
                    return;
                  }
                  // 変換の確定の Enter は除き、いちばん上の結果を選ぶ
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && trimmedQuery) {
                    e.preventDefault();
                    selectFirstResult();
                  }
                }}
                inputMode="search"
                enterKeyHint="search"
              />
              {isSearchFocused && searchQuery.length > 0 && (
                <button
                  type="button"
                  className="search-clear-button"
                  onClick={handleClearSearch}
                  aria-label="検索文字をクリア"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* 履歴と候補 */}
          {isSearchFocused && (
            <div className="search-suggestions-dropdown">
              {trimmedQuery ? (
                <>
                  {/* 商品名 */}
                  {productResults.length > 0 && (
                    <>
                      {searchFilter === 'all' && <div className="search-section-title">商品名</div>}
                      <ul className="search-suggestions-list">
                        {productResults.map((path) => {
                          const isHistory = historyKeys.has(productKey(path));
                          return (
                            <li key={productKey(path)} className="search-suggestion-item" {...tapProps(path)}>
                              <span className="suggestion-icon">{isHistory ? '🕒' : '🔍'}</span>
                              <span className="suggestion-body">
                                <span className="suggestion-text">{path.product}</span>
                                <span className="suggestion-path">{formatPath(path)}</span>
                              </span>
                              <button
                                type="button"
                                className="suggestion-action"
                                aria-label="検索欄に入れる"
                                {...rowButtonProps(() => fillSearch(path.product))}
                              >
                                ↖
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}

                  {/* カテゴリ */}
                  {categoryResults.length > 0 && (
                    <>
                      {searchFilter === 'all' && <div className="search-section-title">カテゴリ</div>}
                      <ul className="search-suggestions-list">
                        {categoryResults.map((entry) => (
                          <li
                            key={entry.key}
                            className="search-suggestion-item"
                            {...tapAction(() => handleSelectCategory(entry))}
                          >
                            <span className="suggestion-icon">📂</span>
                            <span className="suggestion-body">
                              <span className="suggestion-text">{entry.name}</span>
                              <span className="suggestion-path">
                                {entry.level}
                                {entry.parent ? `（${entry.parent}）` : ''}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {/* 印字名（自分のレシート） */}
                  {itemResults.length > 0 && (
                    <>
                      <div className="search-section-title">レシートの印字名</div>
                      <ul className="search-suggestions-list">
                        {itemResults.map((entry) => (
                          <li
                            key={entry.key}
                            className="search-suggestion-item"
                            {...tapAction(() => handleSelectItemName(entry))}
                          >
                            <span className="suggestion-icon">🧾</span>
                            <span className="suggestion-body">
                              <span className="suggestion-text">{entry.itemName}</span>
                              <span className="suggestion-path">
                                {entry.path.product}（{formatPath(entry.path)}）・{entry.count}件
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {itemNamesLoading && <div className="search-no-result">印字名を読み込み中...</div>}
                  {wantsItemNames && itemNames?.error && (
                    <div className="search-no-result">{itemNames.error}</div>
                  )}
                  {!itemNamesLoading &&
                    categoryResults.length === 0 &&
                    productResults.length === 0 &&
                    itemResults.length === 0 && (
                      <div className="search-no-result">
                        {searchFilter === 'category'
                          ? '一致するカテゴリが見つかりません'
                          : searchFilter === 'item'
                            ? '一致する商品名が見つかりません'
                            : '一致するものが見つかりません'}
                      </div>
                    )}
                </>
              ) : searchHistory.length > 0 ? (
                <ul className="search-suggestions-list">
                  {searchHistory.map((path) => (
                    <li key={productKey(path)} className="search-suggestion-item" {...tapProps(path)}>
                      <span className="suggestion-icon">🕒</span>
                      <span className="suggestion-body">
                        <span className="suggestion-text">{path.product}</span>
                        <span className="suggestion-path">{formatPath(path)}</span>
                      </span>
                      <button
                        type="button"
                        className="suggestion-action"
                        aria-label="検索欄に入れる"
                        {...rowButtonProps(() => fillSearch(path.product))}
                      >
                        ↖
                      </button>
                      <button
                        type="button"
                        className="suggestion-action"
                        aria-label="履歴から消す"
                        {...rowButtonProps(() => removeFromHistory(path))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="search-no-result">検索履歴はありません</div>
              )}
            </div>
          )}
        </div>

        {/* お知らせ: カテゴリの提案ができること */}
        {showProposalTip && onOpenCategoryProposal && (
          <aside className="proposal-tip" aria-label="お知らせ">
            <span className="proposal-tip-icon" aria-hidden="true">💡</span>
            <div className="proposal-tip-body">
              <p className="proposal-tip-title">カテゴリを提案できます</p>
              <p className="proposal-tip-text">
                ぴったりの分類が無くて「その他」になる商品があれば、新しい中分類・小分類を提案してください。承認されると、みんなの表に追加されます。
              </p>
              <button type="button" className="proposal-tip-open" onClick={onOpenCategoryProposal}>
                提案する ›
              </button>
            </div>
            <button type="button" className="proposal-tip-close" onClick={dismissProposalTip} aria-label="お知らせを閉じる">
              ✕
            </button>
          </aside>
        )}

        {/* 閲覧履歴（最後に見た5件） */}
        <section className="section-container">
          <h2 className="section-title">閲覧履歴</h2>
          {viewHistory && viewHistory.length > 0 ? (
            <div className="frequent-scroll-container">
              {viewHistory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="frequent-card"
                  onClick={() => handleSelectProductItem(toProductPath(item.path || item.name))}
                >
                  <div className="card-image-placeholder">
                    <ProductIcon product={item.path} fallback={item.icon || '🛍️'} />
                  </div>
                  <span className="card-name">{item.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '13px', color: '#888', padding: '12px 0' }}>
              閲覧した商品履歴はありません
            </div>
          )}
        </section>

        {/* カテゴリ (大分類 -> 中分類 -> サブカテゴリ -> アイテム) */}
        <section className="section-container">
          <h2 className="section-title">カテゴリ</h2>
          <div className="category-accordion-list">
            {CATEGORY_TREE.map((topCat) => (
              <div key={topCat.id} className="category-group">
                <button
                  type="button"
                  id={`cat-${topCat.id}`}
                  className={`category-main-button ${openCategories[topCat.id] ? 'is-open' : ''} ${highlightCategory === topCat.id ? 'is-highlighted' : ''}`}
                  onClick={() => toggleCategory(topCat.id)}
                >
                  <span className="category-label">{topCat.name}</span>
                  <span className="category-arrow">
                    {openCategories[topCat.id] ? '▲' : '▼'}
                  </span>
                </button>

                {openCategories[topCat.id] && (
                  <div className="sub-category-list">
                    {topCat.categories.map((mainCat) => (
                      <div key={mainCat.id} className="sub-category-group">
                        <button
                          type="button"
                          id={`cat-${mainCat.id}`}
                          className={`sub-category-button ${openCategories[mainCat.id] ? 'is-open' : ''} ${highlightCategory === mainCat.id ? 'is-highlighted' : ''}`}
                          onClick={() => toggleCategory(mainCat.id)}
                        >
                          <span className="category-label">{mainCat.name}</span>
                          <span className="sub-arrow">
                            {openCategories[mainCat.id] ? '▲' : '▼'}
                          </span>
                        </button>

                        {openCategories[mainCat.id] && mainCat.subCategories && (
                          <div className="sub-category-list" style={{ paddingLeft: '12px' }}>
                            {mainCat.subCategories.map((subCat) => (
                              <div key={subCat.id} className="item-category-group">
                                <button
                                  type="button"
                                  id={`cat-${subCat.id}`}
                                  className={`sub-category-button ${openCategories[subCat.id] ? 'is-open' : ''} ${highlightCategory === subCat.id ? 'is-highlighted' : ''}`}
                                  onClick={() => toggleCategory(subCat.id)}
                                >
                                  <span>{subCat.name}</span>
                                  <span className="sub-arrow">
                                    {openCategories[subCat.id] ? '▲' : '▼'}
                                  </span>
                                </button>

                                {openCategories[subCat.id] && (
                                  <div className="item-category-list">
                                    {subCat.items.map((itemName) => (
                                      <button
                                        key={itemName}
                                        type="button"
                                        className="item-category-button"
                                        onClick={() =>
                                          handleSelectProductItem({
                                            main: topCat.name,
                                            category: mainCat.name,
                                            sub: subCat.name,
                                            product: itemName,
                                          })
                                        }
                                      >
                                        {itemName}
                                      </button>
                                    ))}
                                    {/* 商品名の「その他」（編集画面と同じ。商品名に「その他」を選んだ明細） */}
                                    <button
                                      type="button"
                                      className="item-category-button"
                                      onClick={() => handleSelectProductItem(otherProductPath(topCat.name, mainCat.name, subCat.name))}
                                    >
                                      {OTHER}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                            {/* 小分類の「その他」（小分類に「その他」を選んだ明細。下の階層は無いので、押すとすぐ開く） */}
                            <div className="item-category-group">
                              <button
                                type="button"
                                className="sub-category-button"
                                onClick={() => handleSelectProductItem(otherSubPath(topCat.name, mainCat.name))}
                              >
                                <span>{OTHER}</span>
                                <span className="sub-arrow">›</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {openCategories[mainCat.id] && mainCat.items && (
                          <div className="item-category-list">
                            {mainCat.items.map((itemName) => (
                              <button
                                key={itemName}
                                type="button"
                                className="item-category-button"
                                onClick={() =>
                                  handleSelectProductItem({
                                    main: topCat.name,
                                    category: mainCat.name,
                                    sub: null,
                                    product: itemName,
                                  })
                                }
                              >
                                {itemName}
                              </button>
                            ))}
                            {/* 商品名の「その他」（小分類が無い、古い形式の中分類） */}
                            <button
                              type="button"
                              className="item-category-button"
                              onClick={() => handleSelectProductItem(otherProductPath(topCat.name, mainCat.name, null))}
                            >
                              {OTHER}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 中分類の「その他」（中分類に「その他」を選んだ明細。押すとすぐ開く） */}
                    <div className="sub-category-group">
                      <button
                        type="button"
                        className="sub-category-button"
                        onClick={() => handleSelectProductItem(otherMidPath(topCat.name))}
                      >
                        <span className="category-label">{OTHER}</span>
                        <span className="sub-arrow">›</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {/* 大分類の「その他」（大分類に「その他」を選んだ明細。中分類も「その他」になるので、押すとすぐ開く） */}
            <div className="category-group">
              <button
                type="button"
                className="category-main-button"
                onClick={() => handleSelectProductItem(otherMainPath())}
              >
                <span className="category-label">{OTHER}</span>
                <span className="category-arrow">›</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* カメラFAB */}
      <button
        type="button"
        className="camera-fab"
        onClick={onOpenCamera}
        aria-label="カメラ起動"
      >
        <svg className="camera-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
          <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
        </svg>
      </button>
    </div>
  );
}