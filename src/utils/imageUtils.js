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

/**
 * 画像を、時計まわりに degrees 度（90 の倍数）回転した、新しい画像（データ URL）を返す。
 *  0 度（360 度）のときは、元の画像をそのまま返す（作り直さないので、画質が落ちない）
 * @param {string} src 元の画像（データ URL）
 * @param {number} degrees 時計まわりの角度（0・90・180・270。負の値も可）
 */
export const rotateImage = (src, degrees) => {
  const turns = (((Math.round(degrees / 90) % 4) + 4) % 4);
  if (turns === 0) return Promise.resolve(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sideways = turns % 2 === 1; // 90・270 度は、縦と横が入れ替わる
      const canvas = document.createElement('canvas');
      canvas.width = sideways ? img.naturalHeight : img.naturalWidth;
      canvas.height = sideways ? img.naturalWidth : img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((turns * Math.PI) / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * 画像を 90 度回したときの、トリミング枠（画像に対する %）の新しい位置。枠は、画像といっしょに回る
 * @param {{ top, left, width, height }} box
 * @param {'cw' | 'ccw'} direction cw: 右（時計まわり）／ ccw: 左（反時計まわり）
 */
export const rotateCropBox = (box, direction) => {
  const { top, left, width, height } = box;
  return direction === 'cw'
    ? { top: left, left: 100 - (top + height), width: height, height: width }
    : { top: 100 - (left + width), left: top, width: height, height: width };
};
