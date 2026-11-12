// 容量（例: "900ml" "1L" "300g" "10個" "1/2カット"）の入力・表示・単価の計算

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

// ---------- 単位 ----------

/** 選べる単位（この順に並べる） */
export const VOLUME_UNITS = ['g', 'kg', 'ml', 'l', '個', '袋', '本', '切れ', '尾', 'カット'];

// 牛乳・飲料とみなす分類（中分類・小分類の名前）
const DRINK_MIDS = ['飲料', '酒類'];
const DRINK_SUBS = ['牛乳・乳飲料', 'チルド飲料'];

/**
 * 選べる単位。どの分類でも、すべての単位を出す（例外の商品で、ややこしくならないように。ユーザーの指示）
 */
export const unitsForItem = () => VOLUME_UNITS;

/**
 * 容量が空のときに、最初に選んでおく単位（分類から推す。どの単位も選べる）
 *  肉・魚 → g、牛乳・飲料 → ml、野菜・果物 → 個、それ以外 → g
 * @param {{ mainCategory?, category?, subCategory? }} item
 */
export const defaultUnitForItem = (item = {}) => {
  const { mainCategory, category, subCategory } = item;
  if (mainCategory === '肉' || mainCategory === '魚') return 'g';
  if (mainCategory === '野菜果物') return '個';
  if (DRINK_MIDS.includes(category) || DRINK_SUBS.includes(subCategory)) return 'ml';
  return 'g';
};

// 書き方のゆれ → 単位（小文字・全角半角をそろえたあとで引く）
const UNIT_ALIASES = {
  g: 'g', グラム: 'g',
  kg: 'kg', キロ: 'kg', キログラム: 'kg',
  ml: 'ml', cc: 'ml', ミリリットル: 'ml',
  l: 'l', 'ℓ': 'l', リットル: 'l',
  個: '個', 個入: '個', 個入り: '個', コ: '個', ケ: '個',
  袋: '袋', 袋入: '袋',
  本: '本', 本入: '本', 本入り: '本',
  切れ: '切れ', 切: '切れ',
  尾: '尾', 匹: '尾',
  カット: 'カット',
};

// 分数（1/2）を先に試す（先に整数を試すと、「1/2カット」が「1」と「/2カット」に分かれてしまう）
const AMOUNT = '(\\d+/\\d+|\\d+(?:\\.\\d+)?)';
const VOLUME_PATTERN = new RegExp(`^${AMOUNT}(.+)$`);

/** 数（「300」「0.5」「1/2」）を数値に。正しくなければ null */
export const amountValue = (amount) => {
  const text = String(amount ?? '').normalize('NFKC').replace(/\s+/g, '');
  if (/^\d+(\.\d+)?$/.test(text)) {
    const v = Number(text);
    return v > 0 ? v : null;
  }
  const m = text.match(/^(\d+)\/(\d+)$/);
  if (m && Number(m[2]) > 0 && Number(m[1]) > 0) return Number(m[1]) / Number(m[2]);
  return null;
};

/** 数の入力が正しいか（空欄はよい） */
export const isValidAmount = (amount) => {
  const text = String(amount ?? '').trim();
  return text === '' || amountValue(text) !== null;
};

/**
 * 保存されている容量を、数と単位に分ける。分けられない（「6枚切」「500ml×6」など）ときは null
 * @returns {{ amount: string, unit: string } | null}
 */
export const parseVolume = (volume) => {
  const text = normalizeVolume(volume);
  if (!text) return null;
  const m = text.match(VOLUME_PATTERN);
  if (!m) return null;
  const unit = UNIT_ALIASES[m[2].toLowerCase()] || UNIT_ALIASES[m[2]];
  if (!unit || amountValue(m[1]) === null) return null;
  return { amount: m[1], unit };
};

/** 数と単位から、保存する容量の文字を作る（数が空・正しくなければ null） */
export const composeVolume = (amount, unit) => {
  const text = String(amount ?? '').normalize('NFKC').replace(/\s+/g, '');
  if (!text || amountValue(text) === null || !unit) return null;
  return normalizeVolume(`${text}${unit}`);
};

// ---------- 単価 ----------

const COUNT_UNITS = ['個', '袋', '本', '切れ', '尾'];

/**
 * 値段と容量から、単価を出す。出せない（容量が空・分けられない）ときは null
 *  ・g・kg → 100g あたり、ml・l → 100ml あたり
 *  ・個・袋・本・切れ・尾 → 1 つあたり（数が 1 のときは、値段と同じなので出さない）
 *  ・カット → 丸ごと 1 個あたり（「1/2カット」の 2 倍）
 * @returns {{ family: string, value: number, label: string } | null}
 *   family が同じものどうしだけ、比べられる（g と 個 は比べない）
 */
export const unitPriceOf = (price, volume) => {
  const parsed = parseVolume(volume);
  const yen = Number(price);
  if (!parsed || !Number.isFinite(yen) || yen <= 0) return null;
  const amount = amountValue(parsed.amount);
  if (!amount) return null;

  switch (parsed.unit) {
    case 'g':
      return { family: 'g', value: (yen / amount) * 100, label: '100gあたり' };
    case 'kg':
      return { family: 'g', value: (yen / (amount * 1000)) * 100, label: '100gあたり' };
    case 'ml':
      return { family: 'ml', value: (yen / amount) * 100, label: '100mlあたり' };
    case 'l':
      return { family: 'ml', value: (yen / (amount * 1000)) * 100, label: '100mlあたり' };
    case 'カット':
      if (amount === 1) return null;
      return { family: 'カット', value: yen / amount, label: '丸ごと1個あたり' };
    default:
      if (!COUNT_UNITS.includes(parsed.unit) || amount === 1) return null;
      return { family: parsed.unit, value: yen / amount, label: `1${parsed.unit}あたり` };
  }
};

/** 単価の表示（例: 「100gあたり 49円」）。10 円未満は小数 1 けた */
export const formatUnitPrice = (unitPrice) => {
  if (!unitPrice) return '';
  const v = unitPrice.value;
  const shown = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
  return `${unitPrice.label} ${shown}円`;
};

/** 値段と容量から、単価の表示の文字（出せなければ空文字） */
export const unitPriceText = (price, volume) => formatUnitPrice(unitPriceOf(price, volume));
