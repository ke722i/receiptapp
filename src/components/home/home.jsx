import { useState, useMemo, useEffect, useRef } from 'react';
import './home.css';
import {
  CATEGORY_TREE,
  INITIAL_SEARCH_HISTORY,
} from '../../constants/categoryData';
import { buildItemReadingMap, filterSearchSuggestions } from '../../utils/searchUtils';
import { findProductPaths, formatPath, productKey } from '../../utils/categoryUtils';

const STORAGE_KEY_SEARCH_HISTORY = 'receipt_app_search_history';

// 履歴の1件を商品のパス { main, category, sub, product } にそろえる
//  （以前は商品名の文字列で保存していたので、文字列なら表から探して変換する）
const toProductPath = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return findProductPaths(entry)[0] || null;
  return entry.product ? entry : null;
};

export default function Home({
  onLogout,
  onNavigateToCategory,
  onOpenCamera,
  onNavigateToHistory,
  onNavigateToStores,
  onNavigateToMyStores,
  onNavigateToSettings,
  onSelectProduct,
  viewHistory = [],
  userId = 'User_12345',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState({});

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
    return list.slice(0, 10);
  }, [suggestions]);

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

  // 商品タップ時のハンドラー（検索履歴追加 ＆ 親の画面遷移ハンドラー呼出）
  //  path: { main, category, sub, product }（商品は名前ではなく場所で区別する）
  // 検索候補・検索履歴のタップ。
  //  スマホ（iPhone）では、キーボードが開いたまま画面がずれて、click が届かないことがあるため、
  //  指を離した時点（touchend）で選ぶ。指が動いた（スクロール）ときは選ばない。
  //  touchend で選んだあとの、続けて来る mousedown / click は、preventDefault で止める（二重に選ばない）
  const touchStartPoint = useRef(null);
  const tapProps = (path) => ({
    onMouseDown: (e) => e.preventDefault(), // 入力欄からフォーカスを外さない
    onClick: () => handleSelectProductItem(path), // パソコンのクリック
    onTouchStart: (e) => {
      const t = e.touches[0];
      touchStartPoint.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e) => {
      const start = touchStartPoint.current;
      const t = e.changedTouches[0];
      touchStartPoint.current = null;
      if (!start || Math.abs(t.clientX - start.x) > 10 || Math.abs(t.clientY - start.y) > 10) return;
      e.preventDefault();
      handleSelectProductItem(path);
    },
  });

  const handleSelectProductItem = (path) => {
    if (!path || !path.product) return;
    setSearchQuery('');
    setIsSearchFocused(false);

    // 検索タグ履歴更新（最新5件・同じ場所の商品は重複させない）
    const key = productKey(path);
    setSearchHistory((prev) => [path, ...prev.filter((item) => productKey(item) !== key)].slice(0, 5));

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
          <div className="user-avatar">👤</div>
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

      {/* 検索時背景オーバーレイ */}
      <div
        className={`search-overlay ${isSearchFocused ? 'is-active' : ''}`}
        onClick={() => setIsSearchFocused(false)}
      />

      {/* メインエリア */}
      <main className="home-main">
        {/* 検索バー */}
        <div className={`search-bar-container ${isSearchFocused ? 'is-focused' : ''}`}>
          <div className="search-input-wrapper">
            <input
              type="search"
              className="search-input"
              placeholder="商品を検索 (例: ぎゅうにゅう, 醤油)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
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

          {/* 検索ドロップダウン */}
          {isSearchFocused && (
            <div className="search-suggestions-dropdown">
              {searchQuery.trim().length > 0 ? (
                pathSuggestions.length > 0 ? (
                  <ul className="search-suggestions-list">
                    {pathSuggestions.map((path) => (
                      <li
                        key={productKey(path)}
                        className="search-suggestion-item"
                        {...tapProps(path)}
                      >
                        <span className="suggestion-icon">🔍</span>
                        <span className="suggestion-body">
                          <span className="suggestion-text">{path.product}</span>
                          <span className="suggestion-path">{formatPath(path)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="search-no-result">一致する商品が見つかりません</div>
                )
              ) : (
                <div className="search-history-container">
                  <div className="search-history-header">最近検索した商品</div>
                  {searchHistory.length > 0 ? (
                    <div className="search-history-tags">
                      {searchHistory.map((path) => (
                        <button
                          key={productKey(path)}
                          type="button"
                          className="search-history-tag"
                          title={formatPath(path, { withProduct: true })}
                          {...tapProps(path)}
                        >
                          🕒 {path.product}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="search-no-result" style={{ padding: '8px 0' }}>検索履歴はありません</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

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
                  <div className="card-image-placeholder">{item.icon || '🛍️'}</div>
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
                  className={`category-main-button ${openCategories[topCat.id] ? 'is-open' : ''}`}
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
                          className={`sub-category-button ${openCategories[mainCat.id] ? 'is-open' : ''}`}
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
                                  className={`sub-category-button ${openCategories[subCat.id] ? 'is-open' : ''}`}
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
                                  </div>
                                )}
                              </div>
                            ))}
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
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
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