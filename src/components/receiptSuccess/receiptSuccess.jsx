import './receiptSuccess.css';

export default function ReceiptSuccess({ onGoHome }) {
  return (
    <div className="receipt-success-container">
      {/* 画面中央の完了カード */}
      <div className="success-card">
        <div className="success-icon-wrapper">
          <span className="success-icon">✓</span>
        </div>
        
        <h1 className="success-title">保存が完了しました</h1>
        <p className="success-message">
          レシート情報が正常に登録されました。<br />
          購入履歴から確認できます。
        </p>

        {/* ホームに戻るボタン */}
        <button
          type="button"
          className="go-home-button"
          onClick={onGoHome}
        >
          ホームに戻る
        </button>
      </div>
    </div>
  );
}