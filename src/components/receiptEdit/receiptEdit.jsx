import { useState } from 'react';
import './receiptEdit.css';
import { CategorySelectModal } from '../categorySelect/categorySelect';

export default function ReceiptEdit({ isOpen, selectedItems, onClose, onSave }) {
  const [editItems, setEditItems] = useState(selectedItems || []);
  const [prevSelectedItems, setPrevSelectedItems] = useState(selectedItems);

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // レンダリング時の props 変更検出（useEffect 不要パターン）
  if (selectedItems !== prevSelectedItems) {
    setPrevSelectedItems(selectedItems);
    setEditItems(selectedItems || []);
  }

  if (!isOpen) return null;

  const handleChange = (index, field, value) => {
    setEditItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleOpenCategoryModal = (index) => {
    setActiveCategoryIndex(index);
    setIsCategoryModalOpen(true);
  };

  const handleSelectCategory = (categoryName) => {
    if (activeCategoryIndex !== null) {
      handleChange(activeCategoryIndex, 'category', categoryName);
    }
  };

  const handleSave = () => {
    onSave(editItems);
    onClose();
  };

  return (
    <div className="receipt-edit-overlay">
      <div className="receipt-edit-container">
        {/* スマホ用ヘッダー */}
        <header className="receipt-edit-header">
          <h2 className="receipt-edit-title">商品の編集 ({editItems.length}件)</h2>
          <button type="button" className="receipt-edit-close" onClick={onClose} aria-label="閉じる">
            ✕
          </button>
        </header>

        {/* 編集領域（慣性スクロール機能付き） */}
        <div className="receipt-edit-body">
          {editItems.map((item, index) => (
            <div key={item.id || index} className="edit-item-card">
              <div className="edit-form-group">
                <label className="edit-label">レシート印字名</label>
                <input
                  type="text"
                  className="edit-input"
                  value={item.printName}
                  onChange={(e) => handleChange(index, 'printName', e.target.value)}
                />
              </div>

              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label className="edit-label">値段 (円)</label>
                  <input
                    type="number"
                    className="edit-input"
                    value={item.price}
                    onChange={(e) => handleChange(index, 'price', Number(e.target.value))}
                  />
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">値引き</label>
                  <select
                    className="edit-select"
                    value={item.isDiscount ? 'true' : 'false'}
                    onChange={(e) => handleChange(index, 'isDiscount', e.target.value === 'true')}
                  >
                    <option value="false">なし</option>
                    <option value="true">あり</option>
                  </select>
                </div>
              </div>

              <div className="edit-form-group">
                <label className="edit-label">カテゴリ</label>
                <button
                  type="button"
                  className="edit-category-button"
                  onClick={() => handleOpenCategoryModal(index)}
                >
                  <span>🏷️ {item.category || 'カテゴリを選択'}</span>
                  <span>変更 ›</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* スマホ底部固定アクションエリア */}
        <footer className="receipt-edit-footer">
          <button type="button" className="edit-cancel-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="edit-save-button" onClick={handleSave}>
            変更を確定する
          </button>
        </footer>
      </div>

      {/* カテゴリ選択モーダル */}
      <CategorySelectModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSelectCategory={handleSelectCategory}
      />
    </div>
  );
}