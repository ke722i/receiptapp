import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORY_TREE } from '../constants/categoryData';
import { matchCategoryFromTree } from './categoryUtils';
import { normalizeStoreName } from './storeNameNormalizer';

// APIエラー（503高負荷等）発生時に使用するテスト用ダミーデータ
const DUMMY_PARSED_DATA = {
  store_name: '⚠️【テスト用ダミーデータ】ディオ和泉店',
  store_address: '大阪府和泉市...',
  store_number: '06-0000-0000',
  purchase_date: new Date().toISOString().split('T')[0],
  items: [
    { item_name: 'エクセラ甘さひかえめ', category: '飲料', price: 118, is_discount: false },
    { item_name: '大人の紅茶ストレートティー', category: '飲料', price: 98, is_discount: false },
    { item_name: '具だくさん中華春雨', category: 'インスタント商品', price: 109, is_discount: false },
    { item_name: '米国産豚ロース超うす', category: '加工肉', price: 349, is_discount: true },
  ],
};

// CATEGORY_TREE から大カテゴリ・中カテゴリの名称リストを生成
const getCategoryNameList = () => {
  const names = [];
  CATEGORY_TREE.forEach((main) => {
    main.categories.forEach((cat) => {
      names.push(cat.name);
    });
  });
  return Array.from(new Set(names)); // 重複削除
};

export const parseReceiptImage = async (base64Image) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('APIキーが設定されていません');

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    // 許容するカテゴリ名のリストを文字列化
    const availableCategories = getCategoryNameList().join(', ');

    // 1. プロンプト文を極限まで短縮（推論ステップを削って爆速化）
    const promptText = `レシート画像から情報を抽出してください。

【抽出ルール】
- category: 以下のリストから最も適切なものを1つ選択（リスト外の独自名は絶対に使用禁止）
  [許可されたカテゴリ: ${availableCategories}]
- item_name: 「単100」等の単価表記を除いた純粋な商品名
- price: 複数購入（例: @100、3点 300）の場合、合計額ではなく必ず「1点あたりの単品価格」を数値で取得
- is_discount: 対象商品が値引き・割引されているか(boolean)`;

    // 2. responseSchema でJSON構造とデータ型を厳格に指定（思考時間をゼロへ）
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: promptText },
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            store_name: { type: Type.STRING, nullable: true },
            store_address: { type: Type.STRING, nullable: true },
            store_number: { type: Type.STRING, nullable: true },
            purchase_date: { type: Type.STRING, nullable: true },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  item_name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  price: { type: Type.INTEGER },
                  is_discount: { type: Type.BOOLEAN },
                },
                required: ['item_name', 'category', 'price', 'is_discount'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsedData = JSON.parse(response.text);

    // ★ 店舗名の表記揺れを辞書で高速正規化（例: 「アプロ」「AppRo」→「食品館アプロ」）
    if (parsedData && parsedData.store_name) {
      parsedData.store_name = normalizeStoreName(parsedData.store_name);
    }

    // AI抽出後のカテゴリ補正
    if (parsedData && Array.isArray(parsedData.items)) {
      const categorySet = new Set(getCategoryNameList());

      parsedData.items = parsedData.items.map((item) => {
        const isCategoryValid = item.category && categorySet.has(item.category);
        const finalCategory = isCategoryValid
          ? item.category
          : matchCategoryFromTree(item.item_name);

        return {
          ...item,
          category: finalCategory,
        };
      });
    }

    return { success: true, data: parsedData, isDummy: false };
  } catch (error) {
    console.warn('Gemini API エラー（503高負荷等）が発生したため、テスト用ダミーデータを使用します:', error);

    // エラー時は自動的に「⚠️【テスト用ダミーデータ】」付きのデータを返す
    return {
      success: true,
      data: DUMMY_PARSED_DATA,
      isDummy: true, // ダミーデータフラグ
    };
  }
};