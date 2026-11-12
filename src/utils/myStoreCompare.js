import { unitPriceOf } from './volume';

// マイ店舗の価格比較の、画面に依存しない処理

/** 期間の選択肢（最長は半年）。既定は 1 週間 */
export const PERIOD_OPTIONS = [
  { days: 7, label: '1週間' },
  { days: 14, label: '2週間' },
  { days: 30, label: '1か月' },
  { days: 90, label: '3か月' },
  { days: 183, label: '半年' },
];
export const DEFAULT_PERIOD_DAYS = 7;
export const MAX_PERIOD_DAYS = 183; // 半年

/**
 * 「何日前まで」の、いちばん古い購入日（YYYY-MM-DD、日本時間）。
 *  DB の関数 get_my_store_prices と同じ計算（1〜183 日に収め、日本時間の今日から引く）
 */
export const sinceDate = (days, now = new Date()) => {
  const clamped = Math.min(Math.max(Number(days) || DEFAULT_PERIOD_DAYS, 1), MAX_PERIOD_DAYS);
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCDate(jst.getUTCDate() - clamped);
  return jst.toISOString().slice(0, 10);
};

/**
 * 自分の購入履歴（fetchProductPriceHistory の結果）から、価格比較に出す「自分の行」を取り出す。
 *  ・マイ店舗に登録した店舗のものだけ。期間内のものだけ。0 円以下・10 万円以上は除く（DB の関数と同じ条件）
 *  ・自分の行には、印字名（商品名）と、レシートの ID も付ける（他のユーザーの行には付かない）
 * @param {{ shop, dateValue, price, volume, isDiscount, itemName, receiptId }[]} history
 * @param {{ store_name: string }[]} myStores
 */
export const pickOwnRows = (history, myStores, days, now = new Date()) => {
  const names = new Set(myStores.map((store) => store.store_name));
  const since = sinceDate(days, now);
  return (history || [])
    .filter(
      (h) =>
        names.has(h.shop) &&
        /^\d{4}-\d{2}-\d{2}/.test(h.dateValue || '') &&
        h.dateValue.slice(0, 10) >= since &&
        h.price > 0 &&
        h.price < 100000
    )
    .map((h) => ({
      storeName: h.shop,
      price: h.price,
      volume: h.volume || null,
      isDiscount: Boolean(h.isDiscount),
      isMine: true,
      purchaseDate: h.dateValue.slice(0, 10),
      itemName: h.itemName || null,
      receiptId: h.receiptId,
    }));
};

/**
 * 価格の一覧を、マイ店舗ごとにまとめる。
 *  ・データのある店舗を、最安値の安い順に並べ、データの無い店舗は後ろに回す（登録順）
 *  ・店舗の中は価格の安い順。同じ価格なら自分のレシートを先に
 * @param {{ store_name: string }[]} myStores 登録しているマイ店舗
 * @param {{ storeName, price, isMine }[]} rows fetchMyStorePrices の結果
 */
export const groupPricesByStore = (myStores, rows) => {
  const groups = myStores.map((store) => {
    const storeRows = rows
      .filter((row) => row.storeName === store.store_name)
      .sort((a, b) => a.price - b.price || Number(b.isMine) - Number(a.isMine));
    const mineRows = storeRows.filter((row) => row.isMine);
    const othersRows = storeRows.filter((row) => !row.isMine);
    return {
      storeName: store.store_name,
      rows: storeRows,
      // 画面では、自分のレシートと他のユーザーのレシートを、別のカードに分けて出す
      mineRows,
      othersRows,
      minPrice: storeRows.length ? storeRows[0].price : null,
      mineCount: mineRows.length,
      othersCount: othersRows.length,
    };
  });

  const withData = groups.filter((g) => g.rows.length > 0).sort((a, b) => a.minPrice - b.minPrice);
  const withoutData = groups.filter((g) => g.rows.length === 0);
  return [...withData, ...withoutData];
};

/** 店舗名の検索（全角半角・大文字小文字・空白を区別しない） */
const toSearchText = (text) =>
  String(text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');

export const matchesStoreQuery = (storeName, query) => {
  const q = toSearchText(query);
  return !q || toSearchText(storeName).includes(q);
};

/** 並び順の選択肢（マイ店舗の価格比較） */
export const SORT_OPTIONS = [
  { value: 'price', label: '値段順' },
  { value: 'unit', label: '単価順' },
];

/**
 * 単価の安い順に並べる（新しい配列を返す）。
 *  ・単価は、同じ種類（g どうし・ml どうし・個どうし…）でしか比べられないので、
 *    その中でいちばん多い種類を先に、単価の安い順に並べる。ほかの種類は、そのあとに、種類ごとに単価順
 *  ・単価が出せない行（容量が空など）は、最後に、値段の安い順
 * @param {{ price, volume }[]} rows
 */
export const sortRowsByUnitPrice = (rows) => {
  const withUnit = rows.map((row) => ({ row, unit: unitPriceOf(row.price, row.volume) }));
  const counts = new Map();
  withUnit.forEach(({ unit }) => {
    if (unit) counts.set(unit.family, (counts.get(unit.family) || 0) + 1);
  });
  const rank = (family) => {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return sorted.findIndex(([f]) => f === family);
  };
  return withUnit
    .sort((a, b) => {
      if (!a.unit && !b.unit) return a.row.price - b.row.price;
      if (!a.unit) return 1;
      if (!b.unit) return -1;
      return rank(a.unit.family) - rank(b.unit.family) || a.unit.value - b.unit.value || a.row.price - b.row.price;
    })
    .map(({ row }) => row);
};
