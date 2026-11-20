// Fileオブジェクトを Base64 文字列に変換
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * canvas の領域を、すぐ手放す（iPhone の Safari は、使い終わった canvas を、なかなか解放しない。
 *  何度も撮影・トリミングを繰り返すと、領域が足りなくなり、あとの画像が真っ黒になることがある）
 */
export const releaseCanvas = (canvas) => {
  try {
    canvas.width = 0;
    canvas.height = 0;
  } catch {
    // 手放せなくても、画像の処理には影響しない
  }
};

/** canvas が、真っ黒（または、完全な透明）になっていないか。小さく縮めて、数か所の色を見る */
export const isCanvasBlank = (canvas) => {
  try {
    const probe = document.createElement('canvas');
    probe.width = 16;
    probe.height = 16;
    const ctx = probe.getContext('2d');
    ctx.drawImage(canvas, 0, 0, 16, 16);
    const { data } = ctx.getImageData(0, 0, 16, 16);
    releaseCanvas(probe);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 12 && data[i + 3] > 0) return false; // 明るい点が 1 つでもあれば、描けている
    }
    return true;
  } catch {
    return false; // 調べられないときは、そのまま使う
  }
};

/**
 * 画像の一部を切り抜いて、JPEG（データ URL）にする
 *  ・出力は、長い辺が maxSide（既定 2400px）まで（このあと 1280px に縮めるので、画質は足りる。canvas の大きさの上限に引っかからない）
 *  ・真っ黒になったときは、小さくして、作り直す（2 回まで）
 * @param {HTMLImageElement} img
 * @param {{ x: number, y: number, width: number, height: number }} rect 元の画像の上の、切り抜く範囲
 */
export const cropImageToDataUrl = (img, rect, maxSide = 2400, quality = 0.9) => {
  const { x, y, width, height } = rect;
  let scale = Math.min(1, maxSide / Math.max(width, height));
  let result = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // 透明な部分が、黒くならないように、白で塗っておく
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
    const blank = isCanvasBlank(canvas);
    result = canvas.toDataURL('image/jpeg', quality);
    releaseCanvas(canvas);
    if (!blank) return result;
    scale *= 0.5; // 真っ黒だった: 小さくして、やり直す
  }
  return result;
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
      ctx.fillStyle = '#ffffff'; // 透明な部分が、黒くならないように
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
      releaseCanvas(canvas);
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
      const rotated = canvas.toDataURL('image/jpeg', 0.92);
      releaseCanvas(canvas);
      resolve(rotated);
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
