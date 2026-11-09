import { useState } from 'react';
import './receiptHistoryDetail.css';
import { deleteReceiptFromDatabase } from '../../utils/receiptDb';
import { OTHER } from '../../utils/categoryUtils';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ReceiptImagePreview from '../receiptImagePreview/receiptImagePreview';

export default function ReceiptHistoryDetail({ receipt, onBack, onDelete }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false); // 削除完了モーダル用
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!receipt) return null;

  // Supabase フィールド名とモック（プロパティ）の互換マッピング
  const storeName = receipt.store_name || receipt.storeName || '店舗名未登録';
  const purchaseDate = receipt.purchase_date || receipt.purchaseDate || '';
  const imageSrc = receipt.image_url || receipt.imageSrc || null;
  const items = receipt.receipt_items || receipt.items || [];

  // 削除確定時の処理（receiptDb.js を使用して Supabase DB から削除）
  const handleConfirmDelete = async () => {
    setErrorMessage('');
    setIsDeleting(true);

    const result = await deleteReceiptFromDatabase(receipt.id);
    setIsDeleting(false);
    setShowDeleteModal(false);

    if (result.success) {
      setShowSuccessModal(true); // 削除完了モーダルを表示
    } else {
      setErrorMessage(result.error);
    }
  };

  // 完了モーダルの「OK」クリック時
  const handleSuccessOk = () => {
    setShowSuccessModal(false);
    if (onDelete) {
      onDelete(receipt.id);
    }
    if (onBack) {
      onBack();
    }
  };

  return (
    <div className="receipt-detail-container">
      {/* 1. ヘッダー */}
      <header className="receipt-detail-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート詳細</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="receipt-detail-main">
        {errorMessage && (
          <div style={{ color: '#c62828', backgroundColor: '#ffebee', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
            {errorMessage}
          </div>
        )}

        {/* 2. 店舗情報・日付・画像 */}
        <section className="receipt-info-card">
          <div className="info-text-group">
            <div className="info-row">
              <span className="info-label">店舗名</span>
              <span className="info-value">{storeName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">購入日時</span>
              <span className="info-value">{formatPurchaseDate(purchaseDate)}</span>
            </div>
          </div>

          <ReceiptImagePreview src={imageSrc} alt="レシート写真" />
        </section>

        {/* 3. 商品リスト表 */}
        <section className="table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th>レシート印字名</th>
                <th>値段</th>
                <th>カテゴリ</th>
                <th>値引き</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => {
                  const printName = item.item_name || item.printName || `商品 ${index + 1}`;
                  const price = item.price || 0;
                  const category = item.category || '未選択';
                  const isDiscount =
                    typeof item.is_discount === 'boolean'
                      ? item.is_discount
                      : item.discount && item.discount !== 'なし';

                  return (
                    <tr key={item.id || index}>
                      <td className="item-name-cell">{printName}</td>
                      <td className="price-cell">{price}円</td>
                      <td className="category-cell">
                        {/* 大分類がその他なら中分類もその他なので、大分類の表示は省く */}
                        {item.main_category && item.main_category !== OTHER && (
                          <div style={{ fontSize: '10px', color: '#999999' }}>{item.main_category}</div>
                        )}
                        {category}
                        {item.product_name && (
                          <div className="product-label">{item.product_name}</div>
                        )}
                      </td>
                      <td className="discount-cell">
                        {isDiscount ? <span className="discount-yes">あり</span> : <span className="discount-none">－</span>}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', color: '#888888', padding: '16px' }}>
                    明細データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* 4. 目立たない削除ボタン */}
        <div className="delete-action-area">
          <button
            type="button"
            className="subtle-delete-button"
            onClick={() => setShowDeleteModal(true)}
            disabled={isDeleting}
          >
            このレシートを削除する
          </button>
        </div>
      </main>

      {/* 5. 削除確認カスタムモーダル */}
      {showDeleteModal && (
        <div className="custom-modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="custom-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="custom-modal-title">削除の確認</h2>
            <p className="custom-modal-message">
              このレシートデータを削除しても<br />よろしいですか？
            </p>
            <div className="custom-modal-button-group">
              <button
                type="button"
                className="custom-modal-button cancel-button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="custom-modal-button delete-button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. 削除完了カスタムモーダル */}
      {showSuccessModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-card">
            <div className="success-icon-check">✓</div>
            <h2 className="custom-modal-title">削除完了</h2>
            <p className="custom-modal-message">
              レシートデータを正常に削除しました。
            </p>
            <div className="custom-modal-button-group">
              <button
                type="button"
                className="custom-modal-button ok-button"
                style={{
                  flex: '0 0 auto',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '140px',
                  height: '42px',
                  padding: '0 24px',
                  backgroundColor: '#007aff',
                  color: '#ffffff',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '21px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0, 122, 255, 0.3)',
                }}
                onClick={handleSuccessOk}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}