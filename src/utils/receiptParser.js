import { GoogleGenAI } from '@google/genai';
import { CATEGORY_TREE } from '../constants/categoryData';
import { matchCategoryFromTree } from './categoryUtils';

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

    const promptText = `
添付されたレシート画像を解析し、正確なJSONフォーマットのみで出力してください。
Markdown装飾（\`\`\`json 等）や説明文は一切含めないでください。

【カテゴリ指定ルール】
category フィールドには、必ず以下の【許可されたカテゴリリスト】の中から最も適切なものを1つ選んで設定してください。リストにない独自のカテゴリ名は使用禁止です。

【許可されたカテゴリリスト】
${availableCategories}

【抽出ルール】
1. store_name: 店舗名（文字列。読み取れない場合は null）。
2. store_address: 店舗住所（読み取れない場合は null）。
3. store_number: 店舗の電話番号（読み取れない場合は null）。
4. purchase_date: 購入日付 (YYYY-MM-DD 形式。読み取れない場合は null)。
5. items: 購入商品の配列。各要素には以下を含めること:
   - item_name: 商品名（「単100」などの単価表記は除外し、純粋な商品名のみ抽出）
   - category: 商品のカテゴリ名（例: 食品, 飲料, 日用品, 生鮮食品, 乳製品, お菓子 等）。
   - price: 商品の「単品価格（単価）」を数値（整数）で抽出。
     ※【超重要】複数購入（例: 「単100」「@100」「3点 300」等）で合計金額と単価の両方が印字されている場合、合計金額（300）ではなく、必ず1点あたりの単品価格（100）を取得してください。
   - is_discount: 対象商品が値引き・割引されているかどうか (true / false)。

【出力JSONフォーマット】
{
  "store_name": "〇〇スーパー 渋谷店",
  "store_address": "東京都渋谷区...",
  "store_number": "03-1234-5678",
  "purchase_date": "2026-10-29",
  "items": [
    {
      "item_name": "牛乳 1L",
      "category": "乳製品",
      "price": 218,
      "is_discount": false
    }
  ]
}
`;

    // gemini-2.5-flash または gemini-1.5-flash を指定
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
      },
    });

    const responseText = response.text;
    const jsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

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