import { useState, useRef } from 'react';
import './receiptScanner.css';
import { fileToBase64, resizeImage } from '../../utils/imageUtils';
import { parseReceiptImage } from '../../utils/receiptParser';

export default function ReceiptScanner({ onBack, onAnalysisComplete }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // ファイル選択・撮影共通処理
  const handleImageSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    try {
      // 1. Base64化 ＆ リサイズ
      const rawBase64 = await fileToBase64(file);
      const resizedBase64 = await resizeImage(rawBase64);
      setSelectedImage(resizedBase64);
    } catch (err) {
      console.error('Image load error:', err);
      setErrorMessage('画像の読み込みに失敗しました。');
    }
  };

  // AI解析実行
  const handleStartAnalysis = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setErrorMessage('');

    const result = await parseReceiptImage(selectedImage);

    setIsAnalyzing(false);

    if (result.success) {
      // 解析成功時、親コンポーネントの確認画面（receiptConfirm など）へ遷移
      if (onAnalysisComplete) {
        onAnalysisComplete(result.data, selectedImage);
      }
    } else {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="receipt-scanner-container">
      {/* ヘッダー */}
      <header className="scanner-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ←
        </button>
        <h1 className="scanner-title">レシートスキャン</h1>
        <div className="header-spacer" />
      </header>

      {/* メインコンテンツ */}
      <main className="scanner-main">
        {errorMessage && <div className="scanner-error">{errorMessage}</div>}

        {/* 画像プレビューエリア */}
        <div className="preview-container">
          {selectedImage ? (
            <div className="preview-wrapper">
              <img src={selectedImage} alt="選択されたレシート" className="preview-image" />
              <button
                type="button"
                className="re-take-button"
                onClick={() => setSelectedImage(null)}
                disabled={isAnalyzing}
              >
                再撮影 / 変更
              </button>
            </div>
          ) : (
            <div className="upload-placeholder">
              <div className="placeholder-icon">📄</div>
              <p className="placeholder-text">レシートを撮影するか<br />アルバムから選択してください</p>
            </div>
          )}
        </div>

        {/* 隠し input 要素（カメラ & アルバム用） */}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleImageSelected}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          accept="image/*"
          ref={galleryInputRef}
          onChange={handleImageSelected}
          style={{ display: 'none' }}
        />

        {/* ボタン操作エリア */}
        {!selectedImage ? (
          <div className="action-button-group">
            <button
              type="button"
              className="action-button primary-btn"
              onClick={() => cameraInputRef.current?.click()}
            >
              📷 カメラで撮影
            </button>
            <button
              type="button"
              className="action-button secondary-btn"
              onClick={() => galleryInputRef.current?.click()}
            >
              🖼️ アルバムから選択
            </button>
          </div>
        ) : (
          <div className="analyze-action-area">
            <button
              type="button"
              className="action-button analyze-btn"
              onClick={handleStartAnalysis}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? '🔍 AI解析中...' : '✨ レシートを解析する'}
            </button>
          </div>
        )}
      </main>

      {/* AI解析中のオーバーレイローディング */}
      {isAnalyzing && (
        <div className="analyzing-overlay">
          <div className="spinner" />
          <p className="analyzing-text">AIがレシートを解析しています...</p>
          <span className="analyzing-sub">商品名・価格・購入日を読み取り中</span>
        </div>
      )}
    </div>
  );
}