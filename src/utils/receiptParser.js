import { supabase } from '../services/supabaseClient';
import { normalizeStoreName } from './storeNameNormalizer';
import { normalizePurchaseDate } from './purchaseDate';

const DEFAULT_ERROR_MESSAGE = 'レシートの解析に失敗しました。もう一度お試しください。';

// 開発中に解析できないとき（Edge Function 未起動など）に使用するテスト用ダミーデータ
const DUMMY_PARSED_DATA = {
  store_name: '⚠️【テスト用ダミーデータ】ディオ和泉店',
  store_address: '大阪府和泉市...',
  store_number: '06-0000-0000',
  purchase_date: new Date().toISOString().split('T')[0],
  items: [
    { item_name: 'エクセラ甘さひかえめ500ml', main_category: '常温', category: '飲料', sub_category: 'コーヒー(ペットボトル・缶)', product_name: 'ペットボトルコーヒー', price: 118, is_discount: false, volume: '500ml' },
    { item_name: '大人の紅茶ストレートティー', main_category: '常温', category: '飲料', sub_category: 'お茶・紅茶(ペットボトル・缶)', product_name: '紅茶', price: 98, is_discount: false },
    { item_name: '具だくさん中華春雨', main_category: '常温', category: '料理の素・つゆ・スープ類', sub_category: '即席スープ・味噌汁', product_name: '春雨スープ', price: 109, is_discount: false },
    { item_name: '米国産豚ロース超うす', main_category: null, category: '未選択', sub_category: null, product_name: null, price: 349, is_discount: true },
  ],
};

// Edge Function が返したエラーの本文（{ code, message }）を取り出す
const readFunctionError = async (error) => {
  try {
    return await error.context.json();
  } catch {
    return {};
  }
};

/**
 * レシート画像を解析する。
 *  Gemini の呼び出しは Edge Function（supabase/functions/parse-receipt）が行い、
 *  API キーとプロンプトはブラウザに出さない。
 * @returns {{ success: true, data: object, isDummy: boolean } | { success: false, error: string }}
 */
export const parseReceiptImage = async (base64Image) => {
  const { data, error } = await supabase.functions.invoke('parse-receipt', {
    body: { image: base64Image },
  });

  if (error) {
    const { code, message } = await readFunctionError(error);

    // 回数上限は開発中でもそのまま伝える
    if (import.meta.env.DEV && code !== 'quota_exceeded') {
      console.warn('レシート解析に失敗したため、テスト用ダミーデータを使用します:', error);
      return { success: true, data: DUMMY_PARSED_DATA, isDummy: true };
    }

    return { success: false, error: message || DEFAULT_ERROR_MESSAGE };
  }

  const parsedData = data.data;
  return {
    success: true,
    data: {
      ...parsedData,
      // ★ 店舗名の表記揺れを辞書で正規化（例: 「AppRo北店」→「食品館アプロ 北店」）
      store_name: parsedData.store_name ? normalizeStoreName(parsedData.store_name) : parsedData.store_name,
      // ★ 購入日を YYYY-MM-DD にそろえる（読み取れなければ null → 確認画面で今日の日付になる）
      purchase_date: normalizePurchaseDate(parsedData.purchase_date),
    },
    isDummy: false,
  };
};
