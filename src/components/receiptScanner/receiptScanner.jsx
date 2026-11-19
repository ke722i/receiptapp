import { useRef, useState } from "react";
import "./receiptScanner.css";
import { fileToBase64 } from "../../utils/imageUtils";
import ScanSteps from "../scanSteps/scanSteps";
import Icon from "../icon/icon";

export default function ReceiptScanner({ onBack, onImageSelected }) {
  const [errorMessage, setErrorMessage] = useState("");

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // ファイル選択・撮影時の即時実行処理
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    try {
      // 1. 選択されたファイルを Base64 に変換
      const rawBase64 = await fileToBase64(file);

      // 2. 直ちに親（App.jsx）の onImageSelected を呼んでトリミング画面へ飛ばす
      if (onImageSelected) {
        onImageSelected(rawBase64);
      }
    } catch (err) {
      console.error("Image load error:", err);
      setErrorMessage("画像の読み込みに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="receipt-scanner-container">
      {/* ヘッダー */}
      <header className="scanner-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="scanner-title">レシートスキャン</h1>
        <div className="header-spacer" />
      </header>
      <ScanSteps current={0} />

      {/* メインコンテンツ */}
      <main className="scanner-main">
        {errorMessage && <div className="scanner-error">{errorMessage}</div>}

        {/* プレビュー表示のプレースホルダー */}
        <div className="preview-container">
          <div className="upload-placeholder">
            <div className="placeholder-icon"><Icon name="receipt" size={44} strokeWidth={1.5} /></div>
            <p className="placeholder-text">
              レシートを撮影するか、アルバムから選んでください
            </p>
            <ul className="scanner-tips">
              <li><Icon name="check" size={16} strokeWidth={2.4} />真上から、1 枚ずつ</li>
              <li><Icon name="check" size={16} strokeWidth={2.4} />レシート全体が入るように</li>
              <li><Icon name="check" size={16} strokeWidth={2.4} />明るい所で、影が入らないように</li>
            </ul>
          </div>
        </div>

        {/* 隠し input 要素（カメラ専用） */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* ★ 隠し input 要素（アルバム専用：capture={false} を追加） */}
        <input
          type="file"
          accept="image/*"
          capture={false}
          ref={galleryInputRef}
          onChange={handleFileChange}
          style={{ display: "none" }}
        />

        {/* ボタン操作エリア */}
        <div className="action-button-group">
          <button
            type="button"
            className="action-button primary-btn"
            onClick={() => cameraInputRef.current?.click()}
          >
            <Icon name="camera" size={22} strokeWidth={2} /> カメラで撮影
          </button>
          <button
            type="button"
            className="action-button secondary-btn"
            onClick={() => galleryInputRef.current?.click()}
          >
            <Icon name="image" size={22} strokeWidth={2} /> アルバムから選択
          </button>
        </div>
      </main>
    </div>
  );
}
