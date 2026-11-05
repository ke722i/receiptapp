import { useState, useRef } from 'react';
import './cropImage.css';

export default function CropImage({ imageSrc, onBack, onCropComplete }) {
  // トリミング枠の初期表示位置（%）
  const [cropBox, setCropBox] = useState({ top: 10, left: 10, width: 80, height: 80 });
  
  const imageRef = useRef(null);
  const boxRef = useRef(null);
  const dragInfo = useRef(null);

  // ドラッグ開始ハンドラー
  const handleStart = (e, handleType) => {
    e.stopPropagation();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();

    dragInfo.current = {
      handleType,
      startX: clientX,
      startY: clientY,
      initialBox: { ...cropBox },
      imageWidth: rect.width,
      imageHeight: rect.height,
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);
  };

  // ドラッグ移動中
  const handleMove = (e) => {
    if (!dragInfo.current) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const { handleType, startX, startY, initialBox, imageWidth, imageHeight } = dragInfo.current;

    const deltaX = ((clientX - startX) / imageWidth) * 100;
    const deltaY = ((clientY - startY) / imageHeight) * 100;

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

  // ★ 修正点: 表示中の画像寸法（getBoundingClientRect）と元画像寸法（naturalWidth/Height）を正しくマッピング
  const handleCrop = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    const imgRect = img.getBoundingClientRect();
    // 画面上に実際に表示されているトリミング枠の矩形（これを基準にする）
    const boxRect = boxRef.current ? boxRef.current.getBoundingClientRect() : null;
    if (!boxRect) return;

    // 1. 画像が「実際に描画されている領域」を求める
    //    （object-fit: contain 等で img 要素より小さく描画される場合に対応）
    let content = {
      left: imgRect.left,
      top: imgRect.top,
      width: imgRect.width,
      height: imgRect.height,
    };
    const fit = window.getComputedStyle(img).objectFit;
    if (fit === 'contain' || fit === 'scale-down') {
      const ratio = Math.min(
        imgRect.width / img.naturalWidth,
        imgRect.height / img.naturalHeight
      );
      const w = img.naturalWidth * ratio;
      const h = img.naturalHeight * ratio;
      content = {
        left: imgRect.left + (imgRect.width - w) / 2,
        top: imgRect.top + (imgRect.height - h) / 2,
        width: w,
        height: h,
      };
    }

    // 2. 表示サイズ → 元画像サイズの比率
    const scaleX = img.naturalWidth / content.width;
    const scaleY = img.naturalHeight / content.height;

    // 3. 枠の画面位置から元画像上の座標へ変換（画像範囲内にクランプ）
    let cropX = Math.max(0, (boxRect.left - content.left) * scaleX);
    let cropY = Math.max(0, (boxRect.top - content.top) * scaleY);
    let cropWidth = Math.min(img.naturalWidth - cropX, boxRect.width * scaleX);
    let cropHeight = Math.min(img.naturalHeight - cropY, boxRect.height * scaleY);

    cropX = Math.round(cropX);
    cropY = Math.round(cropY);
    cropWidth = Math.round(cropWidth);
    cropHeight = Math.round(cropHeight);

    const canvas = document.createElement('canvas');
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

    const croppedImageUrl = canvas.toDataURL('image/jpeg', 0.9);
    
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

      {/* 2. 注意書きバナー */}
      <div className="crop-notice-banner">
        <p className="crop-notice-text">
          <span className="notice-badge">注意</span>
          カード番号等の個人情報は外し、<strong>「店名・商品名・単価」</strong>が入るように枠を調整してください
        </p>
      </div>

      {/* 3. トリミング領域 */}
      <main className="crop-main">
        <div className="crop-workspace">
          {imageSrc ? (
            /* imgタグの表示領域と完全に合わせるラッパー */
            <div className="crop-image-wrapper" style={{ display: 'inline-block', position: 'relative', lineHeight: 0 }}>
              <img
                ref={imageRef}
                src={imageSrc}
                alt="トリミング対象"
                className="crop-target-image"
                style={{ display: 'block' }}
              />

              {/* 可動式トリミング枠 */}
              <div
                className="crop-box"
                ref={boxRef}
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

                {/* 4辺の可動バー */}
                <span
                  className="crop-edge top"
                  onMouseDown={(e) => handleStart(e, 'top')}
                  onTouchStart={(e) => handleStart(e, 'top')}
                ></span>
                <span
                  className="crop-edge bottom"
                  onMouseDown={(e) => handleStart(e, 'bottom')}
                  onTouchStart={(e) => handleStart(e, 'bottom')}
                ></span>
                <span
                  className="crop-edge left"
                  onMouseDown={(e) => handleStart(e, 'left')}
                  onTouchStart={(e) => handleStart(e, 'left')}
                ></span>
                <span
                  className="crop-edge right"
                  onMouseDown={(e) => handleStart(e, 'right')}
                  onTouchStart={(e) => handleStart(e, 'right')}
                ></span>

                {/* 4隅の操作ハンドル */}
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

      {/* 4. 下部ボタン操作バー */}
      <div className="crop-bottom-bar">
        <button
          type="button"
          className="crop-cancel-button"
          onClick={onBack}
        >
          キャンセル
        </button>
        <button
          type="button"
          className="crop-done-button"
          onClick={handleCrop}
        >
          完了
        </button>
      </div>
    </div>
  );
}