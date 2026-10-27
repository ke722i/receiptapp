import { useRef } from 'react';
import './cameraModal.css';

export default function CameraModal({ onClose, onImageSelected }) {
  const fileInputRef = useRef(null);

  const handleSelectLibrary = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      onClose();
      if (onImageSelected) onImageSelected(imageUrl);
    }
  };

  return (
    <div className="camera-modal-overlay" onClick={onClose}>
      <div className="camera-action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button type="button" className="back-button" onClick={onClose} aria-label="閉じる">
            ‹
          </button>
          <span className="sheet-title">画像の選択</span>
          <div className="sheet-right-spacer"></div>
        </div>

        <div className="action-buttons-group">
          <button type="button" className="action-option-button primary" onClick={onClose}>
            <span className="option-icon">📷</span>
            <span>カメラで撮る</span>
          </button>

          <button type="button" className="action-option-button secondary" onClick={handleSelectLibrary}>
            <span className="option-icon">🖼️</span>
            <span>写真ライブラリから選択</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}