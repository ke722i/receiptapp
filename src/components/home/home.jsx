import { useState } from 'react';
import './home.css';

export default function Home({
  onLogout,
  onNavigateToCategory,
  onOpenCamera,
  onNavigateToHistory,
  onNavigateToSettings,
  onSelectProduct, // ← プロップスで受け取っていることを確認
  userId = 'User_12345'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState({});

  // デモ用の候補データ定義
  const demoSuggestions = [
    { key: 'ぎゅうにゅう', value: '牛乳' },
    { key: 'ぎゅう', value: '牛乳' },
    { key: '牛乳', value: '牛乳' },
  ];

  // 入力値に応じて表示する候補を判定
  const filteredSuggestions = searchQuery.trim()
    ? demoSuggestions.filter((item) =>
        item.key.includes(searchQuery.trim())
      )
    : [];

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

  // 検索候補またはアイテム選択時の共通処理
  const handleSelectSuggestion = (value) => {
    setSearchQuery(value);
    setIsSearchFocused(false);

    // 「牛乳」が選択された場合に商品詳細画面へ遷移
    if (value === '牛乳' && onSelectProduct) {
      onSelectProduct('牛乳');
    }
  };

  const frequentItems = [
    { id: 1, name: '卵' },
    { id: 2, name: '牛乳' },
    { id: 3, name: 'サラダ油' },
    { id: 4, name: 'カレールー' },
    { id: 5, name: 'カップ麺' },
  ];

  return (
    <div className="home-container">
      {/* ヘッダー領域 */}
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
          <div className="header-logo-placeholder">アプリロゴ</div>
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
            <span className="drawer-icon">📄</span><span>レシート履歴</span>
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

      {/* 検索入力中の背景オーバーレイ */}
      <div
        className={`search-overlay ${isSearchFocused ? 'is-active' : ''}`}
        onClick={() => setIsSearchFocused(false)}
      />

      {/* メインコンテンツ */}
      <main className="home-main">
        {/* 検索バー領域 */}
        <div className={`search-bar-container ${isSearchFocused ? 'is-focused' : ''}`}>
          <div className="search-input-wrapper">
            <input
              type="search"
              className="search-input"
              placeholder="商品を検索..."
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

          {/* 検索候補リスト */}
          {isSearchFocused && filteredSuggestions.length > 0 && (
            <ul className="search-suggestions-list">
              {filteredSuggestions.map((item, index) => (
                <li
                  key={index}
                  className="search-suggestion-item"
                  onMouseDown={(e) => {
                    // inputのblurイベントより先にクリックイベントを発火させるためonMouseDownを使用
                    e.preventDefault();
                    handleSelectSuggestion(item.value);
                  }}
                >
                  <span className="suggestion-icon">🔍</span>
                  <span className="suggestion-text">{item.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* よく見るカード */}
        <section className="section-container">
          <h2 className="section-title">よく見る</h2>
          <div className="frequent-scroll-container">
            {frequentItems.map((item) => (
              <div
                key={item.id}
                className="frequent-card"
                onClick={() => {
                  if (item.name === '牛乳' && onSelectProduct) {
                    onSelectProduct('牛乳');
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-image-placeholder">画像</div>
                <span className="card-name">{item.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* カテゴリ */}
        <section className="section-container">
          <h2 className="section-title">カテゴリ</h2>
          <div className="category-accordion-list">
            <div className="category-group">
              <button
                type="button"
                className={`category-main-button ${openCategories['roomTemp'] ? 'is-open' : ''}`}
                onClick={() => toggleCategory('roomTemp')}
              >
                <span className="category-label">常温</span>
                <span className="category-arrow">
                  {openCategories['roomTemp'] ? '▲' : '▼'}
                </span>
              </button>

              {openCategories['roomTemp'] && (
                <div className="sub-category-list">
                  <div className="sub-category-group">
                    <button
                      type="button"
                      className={`sub-category-button ${openCategories['seasoning'] ? 'is-open' : ''}`}
                      onClick={() => toggleCategory('seasoning')}
                    >
                      <span>調味料</span>
                      <span className="sub-arrow">{openCategories['seasoning'] ? '▲' : '▼'}</span>
                    </button>

                    {openCategories['seasoning'] && (
                      <div className="item-category-list">
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('醤油')}>醤油</button>
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('ポン酢')}>ポン酢</button>
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('ソース')}>ソース</button>
                      </div>
                    )}
                  </div>

                  <div className="sub-category-group">
                    <button
                      type="button"
                      className={`sub-category-button ${openCategories['snack'] ? 'is-open' : ''}`}
                      onClick={() => toggleCategory('snack')}
                    >
                      <span>お菓子</span>
                      <span className="sub-arrow">{openCategories['snack'] ? '▲' : '▼'}</span>
                    </button>

                    {openCategories['snack'] && (
                      <div className="item-category-list">
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('スナック')}>スナック</button>
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('グミ')}>グミ</button>
                        <button type="button" className="item-category-button" onClick={() => onNavigateToCategory && onNavigateToCategory('キャンディ')}>キャンディ</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="category-group">
              <button type="button" className="category-main-button" onClick={() => onNavigateToCategory && onNavigateToCategory('冷蔵')}>
                <span className="category-label">冷蔵</span><span className="category-arrow">›</span>
              </button>
            </div>
            <div className="category-group">
              <button type="button" className="category-main-button" onClick={() => onNavigateToCategory && onNavigateToCategory('冷凍')}>
                <span className="category-label">冷凍</span><span className="category-arrow">›</span>
              </button>
            </div>
            <div className="category-group">
              <button type="button" className="category-main-button" onClick={() => onNavigateToCategory && onNavigateToCategory('日用品')}>
                <span className="category-label">日用品</span><span className="category-arrow">›</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* カメラボタン */}
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