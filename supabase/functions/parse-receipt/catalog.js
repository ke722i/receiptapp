import { CATEGORY_TREE } from '../_shared/categoryData.js';

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

/**
 * レシートの商品名から、いちばん長く一致した商品の 大分類＋中分類 を返す
 *  ※ 文字列の一致だけでは商品名までは決めきれないため、商品名・小分類は返さない
 */
const matchCategoryPath = (itemName) => {
  if (!itemName) return null;
  let best = null;
  let bestLength = 0;
  CATALOG.products.forEach((p) => {
    if (p.product.length > bestLength && itemName.includes(p.product)) {
      bestLength = p.product.length;
      best = { main: p.main, category: p.category };
    }
  });
  return best;
};

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
  const guessed = matchCategoryPath(item.item_name);
  if (guessed) {
    return { main_category: guessed.main, category: guessed.category, sub_category: null, product_name: null };
  }

  return { main_category: null, category: '未選択', sub_category: null, product_name: null };
};

/** AI の答えの番号を 4階層の名前に変換する（表に無い番号はここで捨てる） */
export const resolveItems = (parsedData) => {
  if (!parsedData || !Array.isArray(parsedData.items)) return parsedData;
  return {
    ...parsedData,
    items: parsedData.items.map((item) => ({
      item_name: item.item_name,
      price: item.price,
      is_discount: item.is_discount,
      ...resolveCategory(item),
    })),
  };
};

export const PROMPT_TEXT = `レシート画像から情報を抽出してください。

【抽出ルール】
- store_name: レシートに印字された店舗名。チェーン名と支店名を半角スペースで区切り、支店名まで書く
  （例: 「ディオ 和泉店」「イオン 堺北花田店」）。支店名が印字されていなければチェーン名だけでよい。
- store_address: 店舗の住所。印字がなければ null
- store_number: 店舗の電話番号。印字がなければ null
- purchase_date: 購入日。必ず YYYY-MM-DD 形式（例: 2026-11-06）で書く。
  和暦（令和など）や2桁の年は西暦に直す。時刻は含めない。読み取れなければ null
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

// JSON の構造とデータ型を厳格に指定する
export const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    store_name: { type: 'STRING', nullable: true },
    store_address: { type: 'STRING', nullable: true },
    store_number: { type: 'STRING', nullable: true },
    purchase_date: { type: 'STRING', nullable: true },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item_name: { type: 'STRING' },
          price: { type: 'INTEGER' },
          is_discount: { type: 'BOOLEAN' },
          product_code: { type: 'STRING', nullable: true },
          mid_code: { type: 'STRING', nullable: true },
        },
        required: ['item_name', 'price', 'is_discount'],
      },
    },
  },
  required: ['items'],
};
