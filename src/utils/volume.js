// 容量（例: "900ml" "1L" "10個" "6枚切"）の入力・表示用

export const MAX_VOLUME_LENGTH = 30; // DB の上限と同じ

/**
 * 保存する容量にそろえる。全角は半角に、空白は詰める。空欄は null（容量不明）。
 *  レシートに印字されていない商品は、ユーザーが入力しなければ null のまま。
 */
export const normalizeVolume = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize('NFKC').replace(/\s+/g, '').trim();
  if (!text) return null;
  return text.slice(0, MAX_VOLUME_LENGTH);
};
