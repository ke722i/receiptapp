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
    return {
      storeName: store.store_name,
      rows: storeRows,
      minPrice: storeRows.length ? storeRows[0].price : null,
      mineCount: storeRows.filter((row) => row.isMine).length,
      othersCount: storeRows.filter((row) => !row.isMine).length,
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
