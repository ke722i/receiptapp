// AI で解析できなかったとき（混雑・1 日の上限・読み取り失敗）に、レシートを手で入力するための補助

/** 今日の日付（端末の時刻で。YYYY-MM-DD） */
export const todayLocalDate = (now = new Date()) => {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** 手で入力するときの、空のレシート（確認画面に渡す）。_manual で、確認画面に案内を出す */
export const createManualReceiptData = (now = new Date()) => ({
  store_name: '',
  purchase_date: todayLocalDate(now),
  items: [],
  _manual: true,
  _scanId: now.getTime(),
});

/** 「＋ 商品を追加」で開く、新しい商品のひな形（保存するまで、表には足さない） */
export const createBlankItem = (id) => ({
  id,
  printName: '',
  mainCategory: '',
  category: '未選択',
  subCategory: '',
  productName: '',
  volume: '',
  price: '',
  isDiscount: false,
});

/** 表の次の id（今ある id の最大 + 1） */
export const nextItemId = (items) => items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;

/**
 * 登録する前の、商品の確認。問題が無ければ空文字、あれば画面に出す文
 *  ・商品が 1 つも無い
 *  ・印字名が空の商品がある
 *  ・値段が 0 円以下・数でない商品がある
 */
export const validateItemsForRegister = (items) => {
  if (!items || items.length === 0) return '商品を 1 つ以上追加してください。';
  if (items.some((item) => !String(item.printName ?? '').trim())) {
    return 'レシート印字名が空の商品があります。商品を選んで編集してください。';
  }
  if (items.some((item) => !(Number(item.price) > 0))) {
    return '値段が 0 円の商品があります。商品を選んで編集してください。';
  }
  return '';
};
