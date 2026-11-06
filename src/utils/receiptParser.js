import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORY_TREE } from '../constants/categoryData';
import { matchCategoryPathFromTree } from './categoryUtils';
import { normalizeStoreName } from './storeNameNormalizer';

// APIエラー（503高負荷等）発生時に使用するテスト用ダミーデータ
const DUMMY_PARSED_DATA = {
  store_name: '⚠️【テスト用ダミーデータ】ディオ和泉店',
  store_address: '大阪府和泉市...',
  store_number: '06-0000-0000',
  purchase_date: new Date().toISOString().split('T')[0],
  items: [
    { item_name: 'エクセラ甘さひかえめ', main_category: '常温', category: '飲料', sub_category: 'コーヒー(ペットボトル・缶)', product_name: 'ペットボトルコーヒー', price: 118, is_discount: false },
    { item_name: '大人の紅茶ストレートティー', main_category: '常温', category: '飲料', sub_category: 'お茶・紅茶(ペットボトル・缶)', product_name: '紅茶', price: 98, is_discount: false },
    { item_name: '具だくさん中華春雨', main_category: '常温', category: '料理の素・つゆ・スープ類', sub_category: '即席スープ・味噌汁', product_name: '春雨スープ', price: 109, is_discount: false },
    { item_name: '米国産豚ロース超うす', main_category: null, category: '未選択', sub_category: null, product_name: null, price: 349, is_discount: true },
  ],
};

/*
 * AI に渡すカテゴリ表を作る。
 *  ・中分類に M番号、商品（極小分類）に P番号 を振る
 *  ・AI は名前ではなく番号で答えるので、同じ名前の商品・中分類があっても取り違えない
 *  ・番号はこの解析1回の中だけで使う（DBには名前で保存する）
 */
const buildCatalog = () => {
  const mids = new Map(); // 'M1' -> { main, category }
  const products = new Map(); // 'P1' -> { main, category, sub, product }
  const lines = [];

  CATEGORY_TREE.forEach((top) => {
    top.categories.forEach((mid) => {
      const mCode = `M${mids.size + 1}`;
      mids.set(mCode, { main: top.name, category: mid.name });
      lines.push(`【${mCode} ${top.name}>${mid.name}】`);

      (mid.subCategories || []).forEach((sub) => {
        const parts = (sub.items || []).map((product) => {
          const pCode = `P${products.size + 1}`;
          products.set(pCode, { main: top.name, category: mid.name, sub: sub.name, product });
          return `${pCode} ${product}`;
        });
        lines.push(`  ${sub.name}: ${parts.join('、')}`);
      });
    });
  });

  return { mids, products, text: lines.join('\n') };
};

// 表は変わらないので1度だけ作る
const CATALOG = buildCatalog();

// AI の答え（番号）を 4階層の名前に変換する
const resolveCategory = (item) => {
  const product = CATALOG.products.get(String(item.product_code || '').trim());
  if (product) {
    return {
      main_category: product.main,
      category: product.category,
      sub_category: product.sub,
      product_name: product.product,
    };
  }

  // 商品が決まらない → 中分類まで
  const mid = CATALOG.mids.get(String(item.mid_code || '').trim());
  if (mid) {
    return { main_category: mid.main, category: mid.category, sub_category: null, product_name: null };
  }

  // AI の番号が不正 → 商品名の文字列一致で中分類まで推定
  const guessed = matchCategoryPathFromTree(item.item_name);
  if (guessed) {
    return { main_category: guessed.main, category: guessed.category, sub_category: null, product_name: null };
  }

  return { main_category: null, category: '未選択', sub_category: null, product_name: null };
};

export const parseReceiptImage = async (base64Image) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) throw new Error('APIキーが設定されていません');

    const ai = new GoogleGenAI({ apiKey });
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const promptText = `レシート画像から情報を抽出してください。

【抽出ルール】
- item_name: 「単100」等の単価表記を除いた純粋な商品名
- price: 複数購入（例: @100、3点 300）の場合、合計額ではなく必ず「1点あたりの単品価格」を数値で取得
- is_discount: 対象商品が値引き・割引されているか(boolean)
- product_code: 下の「カテゴリ表」から、その商品に最も当てはまる商品の P番号 を1つ（例: "P12"）。
  当てはまる商品がなければ必ず null（無理に当てはめない）。
- mid_code: その商品が属する中分類の M番号（例: "M3"）。product_code を選んだ場合はその商品がある中分類。
  商品は決められなくても中分類が分かるなら M番号を入れる。中分類も分からなければ null。
- 番号は表に載っているものだけを使うこと。

【カテゴリ表（【M番号 大分類>中分類】の下に 小分類: P番号 商品名 が並ぶ）】
${CATALOG.text}`;

    // responseSchema でJSON構造とデータ型を厳格に指定
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
                  price: { type: Type.INTEGER },
                  is_discount: { type: Type.BOOLEAN },
                  product_code: { type: Type.STRING, nullable: true },
                  mid_code: { type: Type.STRING, nullable: true },
                },
                required: ['item_name', 'price', 'is_discount'],
              },
            },
          },
          required: ['items'],
        },
      },
    });

    const parsedData = JSON.parse(response.text);

    // ★ 店舗名の表記揺れを辞書で正規化（例: 「アプロ」「AppRo」→「食品館アプロ」）
    if (parsedData && parsedData.store_name) {
      parsedData.store_name = normalizeStoreName(parsedData.store_name);
    }

    // 番号 → 4階層の名前に変換（表に無い番号はここで捨てる）
    if (parsedData && Array.isArray(parsedData.items)) {
      parsedData.items = parsedData.items.map((item) => {
        const { product_code, mid_code, ...rest } = item;
        return { ...rest, ...resolveCategory({ ...item, product_code, mid_code }) };
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