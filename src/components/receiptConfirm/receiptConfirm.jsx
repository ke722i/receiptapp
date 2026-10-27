import { useState } from 'react';
import './receiptConfirm.css';

export default function ReceiptConfirm({ imageSrc, onBack, onSaveComplete }) {
  // 画像から抽出した商品データの初期状態
  const [storeName, setStoreName] = useState('〇〇スーパー 〇〇店');
  const [purchaseDate, setPurchaseDate] = useState('2026/10/27');
  
  const [items, setItems] = useState([
    { id: 1, printName: 'ギュウニュウ1L', category: '牛乳', price: 218, discount: '-40円' },
    { id: 2, printName: 'タマゴ L10P', category: '卵', price: 248, discount: 'なし' },
    { id: 3, printName: 'ヨーグルト 400', category: 'ヨーグルト', price: 198, discount: 'なし' },
    { id: 4, printName: 'セブントウフ', category: '豆腐', price: 58, discount: 'なし' },
    { id: 5, printName: 'KJ オイル 600', category: '未選択', price: 298, discount: 'なし' },
  ]);

  // 編集中のアイテムID（nullの場合は編集なし）
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ printName: '', price: 0, category: '', discount: '' });

  // 編集モードの開始
  const handleEditClick = (item) => {
    setEditingId(item.id);
    setEditFormData({ ...item });
  };

  // 編集内容の保存
  const handleSaveEdit = (id) => {
    setItems(items.map((item) => (item.id === id ? editFormData : item)));
    setEditingId(null);
  };

  return (
    <div className="receipt-confirm-container">
      {/* 1. ヘッダー */}
      <header className="receipt-confirm-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート内容の確認</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="receipt-confirm-main">
        {/* 2. 店舗情報・日付・トリミング画像表示エリア */}
        <section className="receipt-info-card">
          <div className="info-text-group">
            <div className="info-row">
              <span className="info-label">店舗名</span>
              <input
                type="text"
                className="info-input"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
            </div>
            <div className="info-row">
              <span className="info-label">購入日時</span>
              <input
                type="text"
                className="info-input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="receipt-image-preview">
            {imageSrc ? (
              <img src={imageSrc} alt="トリミング画像" className="thumbnail-image" />
            ) : (
              <div className="no-image-text">No Image</div>
            )}
          </div>
        </section>

        {/* 3. 注意書きガイド */}
        <div className="notice-banner">
          <span>💡 データが異なっている場合は、各行の「編集」ボタンより手動で修正できます。</span>
        </div>

        {/* 4. レシート商品リスト表 */}
        <section className="table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th>レシート印字名</th>
                <th>値段</th>
                <th>カテゴリ</th>
                <th>値引き</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {editingId === item.id ? (
                    /* 編集モード時 */
                    <>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={editFormData.printName}
                          onChange={(e) => setEditFormData({ ...editFormData, printName: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="table-input num"
                          value={editFormData.price}
                          onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={editFormData.category}
                          onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          className="table-input"
                          value={editFormData.discount}
                          onChange={(e) => setEditFormData({ ...editFormData, discount: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="save-cell-button"
                          onClick={() => handleSaveEdit(item.id)}
                        >
                          保存
                        </button>
                      </td>
                    </>
                  ) : (
                    /* 通常表示時 */
                    <>
                      <td className="item-name-cell">{item.printName}</td>
                      <td className="price-cell">{item.price}円</td>
                      <td className="category-cell">{item.category}</td>
                      <td className="discount-cell">{item.discount}</td>
                      <td>
                        <button
                          type="button"
                          className="edit-cell-button"
                          onClick={() => handleEditClick(item)}
                        >
                          編集
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>

      {/* 5. 登録完了ボタン */}
      <footer className="receipt-confirm-footer">
        <button
          type="button"
          className="submit-receipt-button"
          onClick={onSaveComplete}
        >
          この内容で登録する
        </button>
      </footer>
    </div>
  );
}