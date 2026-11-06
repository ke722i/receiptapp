// Fileオブジェクトを Base64 文字列に変換
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

// 大容量画像をCanvasでリサイズ（AI解析のレスポンス速度と送信容量を最適化）
export const resizeImage = (dataUrl, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedDataUrl);
    };
    img.onerror = (error) => reject(error);
  });
};

/**
 * FileオブジェクトまたはDataURLを受け取り、自動でBase64化＆指定サイズに圧縮するラッパー関数
 * @param {File|Blob|string} imageInput - 画像ファイルまたはBase64文字列
 * @param {number} maxWidth - 最大幅 (デフォルト: 1200px)
 * @param {number} maxHeight - 最大高さ (デフォルト: 1200px)
 * @param {number} quality - 圧縮品質 (0.0〜1.0, デフォルト: 0.8)
 * @returns {Promise<string>} 圧縮後の Base64 データ URL
 */
export const compressImage = async (imageInput, maxWidth = 1200, maxHeight = 1200, quality = 0.8) => {
  let dataUrl = imageInput;

  // File / Blob オブジェクトの場合は先に Base64 化
  if (imageInput instanceof File || imageInput instanceof Blob) {
    dataUrl = await fileToBase64(imageInput);
  }

  // リサイズ処理を実行して返却
  return await resizeImage(dataUrl, maxWidth, maxHeight, quality);
};