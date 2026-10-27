import './receiptHistoryList.css';

export default function ReceiptHistoryList({ onBack, onSelectReceiptDetail, receipts = [] }) {
  // デモデータ（親からデータを受け取っていない場合の初期表示用）
  const defaultReceipts = [
    {
      id: 1,
      storeName: '〇〇スーパー 〇〇店',
      purchaseDate: '2026/10/27',
      imageSrc: null,
      items: [
        { id: 1, printName: 'ギュウニュウ1L', category: '牛乳', price: 218, discount: '-40円' },
        { id: 2, printName: 'タマゴ L10P', category: '卵', price: 248, discount: 'なし' },
        { id: 3, printName: 'ヨーグルト 400', category: 'ヨーグルト', price: 198, discount: 'なし' },
        { id: 4, printName: 'セブントウフ', category: '豆腐', price: 58, discount: 'なし' },
        { id: 5, printName: 'KJ オイル 600', category: '未選択', price: 298, discount: 'なし' },
      ],
    },
    {
      id: 2,
      storeName: '△△ドラッグストア',
      purchaseDate: '2026/10/20',
      imageSrc: null,
      items: [
        { id: 1, printName: 'ティッシュペーパー5P', category: '日用品', price: 328, discount: 'なし' },
        { id: 2, printName: 'ミネラルウォーター2L', category: '飲料', price: 98, discount: 'なし' },
      ],
    },
  ];

  const displayList = receipts.length > 0 ? receipts : defaultReceipts;

  return (
    <div className="receipt-history-container">
      {/* 1. ヘッダー */}
      <header className="receipt-history-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート一覧</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. メインコンテンツ（カード一覧） */}
      <main className="receipt-history-main">
        {displayList.length === 0 ? (
          <div className="no-receipts-message">登録されたレシートはありません</div>
        ) : (
          <div className="receipt-grid">
            {displayList.map((receipt) => (
              <div
                key={receipt.id}
                className="receipt-card"
                onClick={() => onSelectReceiptDetail(receipt)}
              >
                {/* サムネイル画像 */}
                <div className="receipt-card-image-box">
                  {receipt.imageSrc ? (
                    <img src={receipt.imageSrc} alt="レシート写真" className="receipt-card-image" />
                  ) : (
                    <div className="receipt-placeholder-icon">📄</div>
                  )}
                </div>

                {/* 店舗名・日付 */}
                <div className="receipt-card-info">
                  <span className="receipt-card-date">{receipt.purchaseDate}</span>
                  <span className="receipt-card-store">{receipt.storeName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}