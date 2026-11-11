import { useState } from 'react';
import './receiptEdit.css';
import {
  OTHER,
  getMainCategories,
  getMidCategories,
  getSubCategories,
  getProducts,
  applyCategoryChange,
} from '../../utils/categoryUtils';
import { MAX_VOLUME_LENGTH, normalizeVolume } from '../../utils/volume';

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
  // 上の階層を変えたら下は空に戻し、「その他」を選んだら下は選択不要にする（categoryUtils）
  const handleCategoryChange = (index, level, value) => {
    setEditItems((prev) =>
      prev.map((item, idx) => (idx === index ? applyCategoryChange(item, level, value) : item))
    );
  };

  const handleSave = () => {
    // 容量は全角を半角に・空白を詰めてそろえる（空欄は '' = 不明）
    onSave(editItems.map((item) => ({ ...item, volume: normalizeVolume(item.volume) || '' })));
    onClose();
  };

  const mainOptions = getMainCategories();

  return (
    <div className="receipt-edit-overlay">
      <div className="receipt-edit-container">
        {/* ヘッダー（他の画面と同じ形：左に戻る、中央にタイトル） */}
        <header className="receipt-edit-header">
          <button type="button" className="receipt-edit-back" onClick={onClose} aria-label="戻る">
            ‹
          </button>
          <h2 className="receipt-edit-title">商品の編集 ({editItems.length}件)</h2>
          <div className="receipt-edit-header-spacer" />
        </header>

        {/* 編集領域（慣性スクロール機能付き） */}
        <div className="receipt-edit-body">
          {editItems.map((item, index) => {
            const midOptions = getMidCategories(item.mainCategory);
            const subOptions = getSubCategories(item.mainCategory, item.category);
            const productOptions = getProducts(item.mainCategory, item.category, item.subCategory);
            // 表に無い値（旧データの「未選択」など）は空として扱う
            const categoryValue = midOptions.includes(item.category) ? item.category : '';
            // 「その他」を選んだ階層より下は選択不要
            const mainIsOther = item.mainCategory === OTHER;
            const midIsOther = mainIsOther || item.category === OTHER;
            const subIsOther = midIsOther || item.subCategory === OTHER;
            const placeholder = (parentIsOther) => (parentIsOther ? '選択不要（その他のため）' : '選択してください');

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

                {/* 容量（レシートに印字されていれば自動で入る。無ければ任意で入力、空欄は「不明」） */}
                <div className="edit-form-group">
                  <label className="edit-label">容量（任意）</label>
                  <input
                    type="text"
                    className="edit-input"
                    value={item.volume || ''}
                    maxLength={MAX_VOLUME_LENGTH}
                    placeholder="例: 900ml、1L、10個（わからなければ空欄）"
                    onChange={(e) => handleChange(index, 'volume', e.target.value)}
                  />
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
                    value={mainIsOther ? '' : categoryValue}
                    disabled={mainIsOther || midOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                  >
                    <option value="">{placeholder(mainIsOther)}</option>
                    {midOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">小分類</label>
                  <select
                    className="edit-select"
                    value={!midIsOther && subOptions.includes(item.subCategory) ? item.subCategory : ''}
                    disabled={midIsOther || subOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'sub', e.target.value)}
                  >
                    <option value="">{placeholder(midIsOther)}</option>
                    {subOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">商品名（価格比較に使います）</label>
                  <select
                    className="edit-select"
                    value={!subIsOther && productOptions.includes(item.productName) ? item.productName : ''}
                    disabled={subIsOther || productOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'product', e.target.value)}
                  >
                    <option value="">{placeholder(subIsOther)}</option>
                    {productOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* 「その他」を選んだときの案内（カテゴリの提案ができること） */}
                {[item.mainCategory, item.category, item.subCategory, item.productName].includes(OTHER) && (
                  <p className="edit-proposal-hint">
                    💡 ぴったりの分類が無いときは、設定の「カテゴリを提案する」から、新しい中分類・小分類を提案できます。
                  </p>
                )}
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