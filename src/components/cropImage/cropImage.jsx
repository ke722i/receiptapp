import { useState, useRef } from 'react';
import './cropImage.css';

export default function CropImage({ imageSrc, onBack, onCropComplete }) {
  // トリミング枠の初期設定（パーセンテージ %）
  const [cropBox, setCropBox] = useState({ top: 10, left: 10, width: 80, height: 80 });
  
  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const dragInfo = useRef(null);

  // ドラッグ開始（ハンドルまたは枠全体の移動）
  const handleStart = (e, handleType) => {
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    dragInfo.current = {
      handleType, // 'move', 'top-left', 'top-right', 'bottom-left', 'bottom-right'
      startX: clientX,
      startY: clientY,
      initialBox: { ...cropBox },
      containerWidth: rect.width,
      containerHeight: rect.height,
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // ドラッグ中（移動・リサイズ計算）
  const handleMove = (e) => {
    if (!dragInfo.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const { handleType, startX, startY, initialBox, containerWidth, containerHeight } = dragInfo.current;

    // 移動距離をパーセンテージに変換
    const deltaX = ((clientX - startX) / containerWidth) * 100;
    const deltaY = ((clientY - startY) / containerHeight) * 100;

    let newBox = { ...initialBox };

    if (handleType === 'move') {
      newBox.left = Math.max(0, Math.min(100 - initialBox.width, initialBox.left + deltaX));
      newBox.top = Math.max(0, Math.min(100 - initialBox.height, initialBox.top + deltaY));
    } else {
      if (handleType.includes('top')) {
        const maxTop = initialBox.top + initialBox.height - 10;
        newBox.top = Math.max(0, Math.min(maxTop, initialBox.top + deltaY));
        newBox.height = initialBox.height - (newBox.top - initialBox.top);
      }
      if (handleType.includes('bottom')) {
        const maxHeight = 100 - initialBox.top;
        newBox.height = Math.max(10, Math.min(maxHeight, initialBox.height + deltaY));
      }
      if (handleType.includes('left')) {
        const maxLeft = initialBox.left + initialBox.width - 10;
        newBox.left = Math.max(0, Math.min(maxLeft, initialBox.left + deltaX));
        newBox.width = initialBox.width - (newBox.left - initialBox.left);
      }
      if (handleType.includes('right')) {
        const maxWidth = 100 - initialBox.left;
        newBox.width = Math.max(10, Math.min(maxWidth, initialBox.width + deltaX));
      }
    }

    setCropBox(newBox);
  };

  // ドラッグ終了
  const handleEnd = () => {
    dragInfo.current = null;
    window.removeEventListener('mousemove', handleMove);
    window.removeEventListener('mouseup', handleEnd);
    window.removeEventListener('touchmove', handleMove);
    window.removeEventListener('touchend', handleEnd);
  };

  // 切り抜き処理を実行
  const handleCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const canvas = document.createElement('canvas');

    const scaleX = img.naturalWidth / 100;
    const scaleY = img.naturalHeight / 100;

    const cropX = cropBox.left * scaleX;
    const cropY = cropBox.top * scaleY;
    const cropWidth = cropBox.width * scaleX;
    const cropHeight = cropBox.height * scaleY;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const croppedImageUrl = canvas.toDataURL('image/jpeg');
    if (onCropComplete) {
      onCropComplete(croppedImageUrl);
    }
  };

  return (
    <div className="crop-container">
      {/* 1. ヘッダー */}
      <header className="crop-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">トリミング</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* 2. トリミング領域 */}
      <main className="crop-main">
        <div className="crop-workspace" ref={containerRef}>
          {imageSrc ? (
            <div className="crop-image-wrapper">
              <img
                ref={imageRef}
                src={imageSrc}
                alt="トリミング対象"
                className="crop-target-image"
              />

              {/* 可動式トリミング枠 */}
              <div
                className="crop-box"
                style={{
                  top: `${cropBox.top}%`,
                  left: `${cropBox.left}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                onMouseDown={(e) => handleStart(e, 'move')}
                onTouchStart={(e) => handleStart(e, 'move')}
              >
                {/* ガイドライン */}
                <div className="crop-grid-line horizontal-1"></div>
                <div className="crop-grid-line horizontal-2"></div>
                <div className="crop-grid-line vertical-1"></div>
                <div className="crop-grid-line vertical-2"></div>

                {/* 4隅の可動用角ハンドル */}
                <span
                  className="crop-corner top-left"
                  onMouseDown={(e) => handleStart(e, 'top-left')}
                  onTouchStart={(e) => handleStart(e, 'top-left')}
                ></span>
                <span
                  className="crop-corner top-right"
                  onMouseDown={(e) => handleStart(e, 'top-right')}
                  onTouchStart={(e) => handleStart(e, 'top-right')}
                ></span>
                <span
                  className="crop-corner bottom-left"
                  onMouseDown={(e) => handleStart(e, 'bottom-left')}
                  onTouchStart={(e) => handleStart(e, 'bottom-left')}
                ></span>
                <span
                  className="crop-corner bottom-right"
                  onMouseDown={(e) => handleStart(e, 'bottom-right')}
                  onTouchStart={(e) => handleStart(e, 'bottom-right')}
                ></span>
              </div>
            </div>
          ) : (
            <div className="crop-placeholder">画像がありません</div>
          )}
        </div>
      </main>

      {/* 3. 下部ボタンバー */}
      <div className="crop-bottom-bar">
        <button
          type="button"
          className="crop-cancel-button"
          onClick={onBack}
        >
          キャンセル
        </button>
        {/* インラインスタイルで赤色と白文字を強適用 */}
        <button
          type="button"
          className="crop-done-button"
          style={{
            backgroundColor: '#ff3b30',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '10px 28px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: 1,
            boxShadow: '0 2px 8px rgba(255, 59, 48, 0.4)',
          }}
          onClick={handleCrop}
        >
          完了
        </button>
      </div>
    </div>
  );
}