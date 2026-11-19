import './receiptSuccess.css';
import Icon from '../icon/icon';

export default function ReceiptSuccess({ onGoHome, onScanAgain }) {
  return (
    <div className="receipt-success-container">
      {/* 画面中央の完了カード */}
      <div className="success-card">
        <div className="success-icon-wrapper">
          <span className="success-icon"><Icon name="check" size={40} strokeWidth={2.6} /></span>
        </div>
        
        <h1 className="success-title">保存が完了しました</h1>
        <p className="success-message">
          レシート情報が正常に登録されました。<br />
          レシート一覧から確認できます。
        </p>

        {/* ホームに戻るボタン */}
        <button
          type="button"
          className="go-home-button"
          onClick={onGoHome}
        >
          ホームに戻る
        </button>
        {/* 続けて、次のレシートを撮る */}
        {onScanAgain && (
          <button type="button" className="scan-again-button" onClick={onScanAgain}>
            <Icon name="camera" size={20} /> 続けて撮影する
          </button>
        )}
      </div>
    </div>
  );
}