export const DUMMY_PARSED_DATA = {
  store_name: 'スーパーダミー店 (テスト用)',
  purchase_date: new Date().toISOString().split('T')[0],
  items: [
    {
      item_name: 'エクセラ甘さひかえめ',
      price: 118,
      category: '飲料',
      is_discount: false,
    },
    {
      item_name: '大人の紅茶ストレートティー',
      price: 98,
      category: '飲料',
      is_discount: false,
    },
    {
      item_name: '具だくさん中華春雨',
      price: 109,
      category: 'インスタント商品',
      is_discount: false,
    },
    {
      item_name: '米国産豚ロース超うす',
      price: 349,
      category: '加工肉',
      is_discount: true,
    },
  ],
};