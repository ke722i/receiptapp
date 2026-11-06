import { useState } from 'react';
import './receiptEdit.css';
import {
  getMainCategories,
  getMidCategories,
  getSubCategories,
  getProducts,
} from '../../utils/categoryUtils';

export default function ReceiptEdit({ isOpen, selectedItems, onClose, onSave }) {
  const [editItems, setEditItems] = useState(selectedItems || []);
  const [prevSelectedItems, setPrevSelectedItems] = useState(selectedItems);

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

  // カテゴリは 大 → 中 → 小 → 商品名 の順に絞り込む。
  // 上の階層を変えたら、それより下は選び直しになるので空に戻す。
  const handleCategoryChange = (index, level, value) => {
    setEditItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (level === 'main') {
          return { ...item, mainCategory: value, category: '未選択', subCategory: '', productName: '' };
        }
        if (level === 'category') {
          return { ...item, category: value || '未選択', subCategory: '', productName: '' };
        }
        if (level === 'sub') {
          return { ...item, subCategory: value, productName: '' };
        }
        return { ...item, productName: value };
      })
    );
  };

  const handleSave = () => {
    onSave(editItems);
    onClose();
  };

  const mainOptions = getMainCategories();

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
          {editItems.map((item, index) => {
            const midOptions = getMidCategories(item.mainCategory);
            const subOptions = getSubCategories(item.mainCategory, item.category);
            const productOptions = getProducts(item.mainCategory, item.category, item.subCategory);
            // 表に無い値（旧データの「未選択」など）は空として扱う
            const categoryValue = midOptions.includes(item.category) ? item.category : '';

            return (
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

                {/* カテゴリ（大 → 中 → 小 → 商品名） */}
                <div className="edit-form-group">
                  <label className="edit-label">大分類</label>
                  <select
                    className="edit-select"
                    value={mainOptions.includes(item.mainCategory) ? item.mainCategory : ''}
                    onChange={(e) => handleCategoryChange(index, 'main', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {mainOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">中分類</label>
                  <select
                    className="edit-select"
                    value={categoryValue}
                    disabled={midOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {midOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">小分類</label>
                  <select
                    className="edit-select"
                    value={subOptions.includes(item.subCategory) ? item.subCategory : ''}
                    disabled={subOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'sub', e.target.value)}
                  >
                    <option value="">該当なし（中分類までで登録）</option>
                    {subOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">商品名（価格比較に使います）</label>
                  <select
                    className="edit-select"
                    value={productOptions.includes(item.productName) ? item.productName : ''}
                    disabled={productOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'product', e.target.value)}
                  >
                    <option value="">該当なし（中分類までで登録）</option>
                    {productOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}