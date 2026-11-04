import { useState } from 'react';
import { CATEGORY_TREE } from '../../constants/categoryData';
import './categorySelect.css';

export function CategorySelectModal({ isOpen, onClose, onSelectCategory }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openCategories, setOpenCategories] = useState({});

  if (!isOpen) return null;

  const toggleCategory = (categoryId) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const isSearching = searchTerm.trim().length > 0;

  const getFilteredCategories = () => {
    if (!isSearching) return CATEGORY_TREE;

    const term = searchTerm.toLowerCase();
    const result = [];

    CATEGORY_TREE.forEach((topCat) => {
      const matchedCategories = [];

      topCat.categories.forEach((mainCat) => {
        const mainMatches = mainCat.name.toLowerCase().includes(term);
        const mainItemMatches = mainCat.items?.filter((i) =>
          i.toLowerCase().includes(term)
        );

        const matchedSubCats = [];
        mainCat.subCategories?.forEach((subCat) => {
          const subMatches = subCat.name.toLowerCase().includes(term);
          const subItemMatches = subCat.items?.filter((i) =>
            i.toLowerCase().includes(term)
          );

          if (subMatches || (subItemMatches && subItemMatches.length > 0)) {
            matchedSubCats.push({
              ...subCat,
              items: subItemMatches && subItemMatches.length > 0 ? subItemMatches : subCat.items,
            });
          }
        });

        if (
          mainMatches ||
          (mainItemMatches && mainItemMatches.length > 0) ||
          matchedSubCats.length > 0
        ) {
          matchedCategories.push({
            ...mainCat,
            items: mainItemMatches && mainItemMatches.length > 0 ? mainItemMatches : mainCat.items,
            subCategories: matchedSubCats.length > 0 ? matchedSubCats : mainCat.subCategories,
          });
        }
      });

      if (matchedCategories.length > 0) {
        result.push({ ...topCat, categories: matchedCategories });
      }
    });

    return result;
  };

  const filteredTree = getFilteredCategories();

  return (
    <div className="category-select-overlay">
      <div className="category-modal-card">
        {/* 固定ヘッダー */}
        <div className="category-select-header">
          <h3 className="category-select-title">カテゴリを選択</h3>
          <button type="button" className="category-select-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 固定検索バー */}
        <div className="category-search-wrapper">
          <input
            type="text"
            placeholder="カテゴリや商品名で検索 (例: 醤油, 基礎調味料)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="category-search-input"
          />
        </div>

        {/* スクロール領域 */}
        <div className="category-modal-scroll-area">
          {filteredTree.length === 0 ? (
            <div className="no-result-text">該当するカテゴリが見つかりません</div>
          ) : (
            filteredTree.map((topCat) => {
              const isOpenTop = isSearching || !!openCategories[topCat.id];

              return (
                <div key={topCat.id} className="category-group">
                  {/* 階層1: 大分類（常温、冷蔵、冷凍、日用品） */}
                  <button
                    type="button"
                    className={`category-main-button ${isOpenTop ? 'is-open' : ''}`}
                    onClick={() => toggleCategory(topCat.id)}
                  >
                    <span className="category-label">{topCat.name}</span>
                    <span className="category-arrow">{isOpenTop ? '▲' : '▼'}</span>
                  </button>

                  {/* 階層2: 中分類リスト */}
                  {isOpenTop && (
                    <div className="sub-category-list">
                      {topCat.categories.map((mainCat) => {
                        const isOpenMain = isSearching || !!openCategories[mainCat.id];

                        return (
                          <div key={mainCat.id} className="sub-category-group">
                            <button
                              type="button"
                              className={`sub-category-button ${isOpenMain ? 'is-open' : ''}`}
                              onClick={() => toggleCategory(mainCat.id)}
                            >
                              <span className="category-label">{mainCat.name}</span>
                              <span className="sub-arrow">{isOpenMain ? '▲' : '▼'}</span>
                            </button>

                            {/* 階層3 & 4 */}
                            {isOpenMain && (
                              <div className="nested-category-content">
                                {/* 小分類（subCategories）が存在する場合 */}
                                {mainCat.subCategories && mainCat.subCategories.length > 0 && (
                                  <div className="sub-cat-wrapper">
                                    {mainCat.subCategories.map((subCat) => {
                                      const isOpenSub = isSearching || !!openCategories[subCat.id];

                                      return (
                                        <div key={subCat.id} className="leaf-category-group">
                                          <button
                                            type="button"
                                            className={`leaf-category-button ${isOpenSub ? 'is-open' : ''}`}
                                            onClick={() => toggleCategory(subCat.id)}
                                          >
                                            <span>{subCat.name}</span>
                                            <span className="sub-arrow">{isOpenSub ? '▲' : '▼'}</span>
                                          </button>

                                          {/* 商品アイテムリスト */}
                                          {isOpenSub && subCat.items && (
                                            <div className="item-grid-list">
                                              {subCat.items.map((itemName) => (
                                                <button
                                                  key={itemName}
                                                  type="button"
                                                  className="item-select-btn"
                                                  onClick={() => {
                                                    onSelectCategory(itemName);
                                                    onClose();
                                                  }}
                                                >
                                                  {itemName}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {/* 直下に items が存在する場合（冷蔵等） */}
                                {mainCat.items && mainCat.items.length > 0 && (
                                  <div className="item-grid-list direct-items">
                                    {mainCat.items.map((itemName) => (
                                      <button
                                        key={itemName}
                                        type="button"
                                        className="item-select-btn"
                                        onClick={() => {
                                          onSelectCategory(itemName);
                                          onClose();
                                        }}
                                      >
                                        {itemName}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}