import { useState } from 'react';
import './receiptHistoryDetail.css';

export default function ReceiptHistoryDetail({ receipt, onBack, onDelete }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  if (!receipt) return null;

  // 削除確定時の処理
  const handleConfirmDelete = () => {
    setShowDeleteModal(false);
    if (onDelete) {
      onDelete();
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
        {/* 2. 店舗情報・日付・画像 */}
        <section className="receipt-info-card">
          <div className="info-text-group">
            <div className="info-row">
              <span className="info-label">店舗名</span>
              <span className="info-value">{receipt.storeName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">購入日時</span>
              <span className="info-value">{receipt.purchaseDate}</span>
            </div>
          </div>

          <div className="receipt-image-preview">
            {receipt.imageSrc ? (
              <img src={receipt.imageSrc} alt="レシート写真" className="thumbnail-image" />
            ) : (
              <div className="no-image-text">No Image</div>
            )}
          </div>
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
              {receipt.items.map((item) => (
                <tr key={item.id}>
                  <td className="item-name-cell">{item.printName}</td>
                  <td className="price-cell">{item.price}円</td>
                  <td className="category-cell">{item.category}</td>
                  <td className="discount-cell">{item.discount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 4. 目立たない削除ボタン */}
        <div className="delete-action-area">
          <button
            type="button"
            className="subtle-delete-button"
            onClick={() => setShowDeleteModal(true)}
          >
            このレシートを削除する
          </button>
        </div>
      </main>

      {/* 5. 中央配置の削除確認カスタムモーダル */}
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
              >
                キャンセル
              </button>
              <button
                type="button"
                className="custom-modal-button delete-button"
                onClick={handleConfirmDelete}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}