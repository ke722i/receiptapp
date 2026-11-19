import { CATEGORY_TREE } from '../_shared/categoryData.js';

/*
 * AI に渡すカテゴリ表を作る。
 *  ・中分類に M番号 を振る（58 個ほど）。商品は、番号を付けず、名前だけを並べる
 *  ・AI は「中分類の M番号」と「その中分類の商品名（表の文字のまま）」で答える
 *    - 商品名は、同じ中分類の中では重ならないので、2 つで商品が 1 つに決まる（ぶり・鯛のように、別の中分類に同じ名前があっても、取り違えない）
 *    - 以前は商品に P番号（1,000 以上）を振って番号で答えさせていたが、AI が近い番号の別の商品を選ぶ「ずれ」が起きたため、名前に変えた（11/19）
 *  ・P番号は、古い答え（Gemini のチャットの JSON など）を読むためだけに、内部で残す（表には出さない）
 *  ・番号は、この表の中だけで使う（DB には名前で保存する）
 */
// 名前の比べ方（全角半角・大文字小文字・空白の違いを無視する。かっこ「（）」と「()」も同じにする）
export const foldName = (text) => String(text ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();

const buildCatalog = () => {
  const mids = new Map(); // 'M1' -> { main, category }
  const products = new Map(); // 'P1' -> { main, category, sub, product }（古い答えのためだけ）
  const byMid = new Map(); // '大分類>中分類' -> Map(畳んだ商品名 -> { main, category, sub, product })
  const byName = new Map(); // 畳んだ商品名 -> [{ main, category, sub, product }]（中分類が合わないときの予備）
  const lines = [];

  CATEGORY_TREE.forEach((top) => {
    top.categories.forEach((mid) => {
      const mCode = `M${mids.size + 1}`;
      mids.set(mCode, { main: top.name, category: mid.name });
      lines.push(`【${mCode} ${top.name}>${mid.name}】`);
      const inMid = new Map();
      byMid.set(`${top.name}>${mid.name}`, inMid);

      (mid.subCategories || []).forEach((sub) => {
        (sub.items || []).forEach((product) => {
          const path = { main: top.name, category: mid.name, sub: sub.name, product };
          products.set(`P${products.size + 1}`, path);
          inMid.set(foldName(product), path);
          const key = foldName(product);
          if (!byName.has(key)) byName.set(key, []);
          byName.get(key).push(path);
        });
        lines.push(`  ${sub.name}: ${(sub.items || []).join('、')}`);
      });
    });
  });

  return { mids, products, byMid, byName, text: lines.join('\n') };
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

const toResult = (path) => ({
  main_category: path.main,
  category: path.category,
  sub_category: path.sub,
  product_name: path.product,
});

/**
 * 中分類と商品名（文字）から、表の商品を探す（Edge Function と、JSON の取り込みツールで使う）
 *  1. 中分類の中に、その商品名があれば、それ
 *  2. 中分類の中に無くても、表全体で、その商品名が 1 か所だけなら、それ（AI が中分類だけ取り違えたとき）
 *  3. 見つからない・2 か所以上（例: ぶり）で決められないときは null
 * @param {{ main: string, category: string } | null} mid
 * @param {string | null} productName
 * @returns {{ main, category, sub, product } | null}
 */
export const findProduct = (mid, productName) => {
  const key = foldName(productName);
  if (!key) return null;
  if (mid) {
    const hit = CATALOG.byMid.get(`${mid.main}>${mid.category}`)?.get(key);
    if (hit) return hit;
  }
  const all = CATALOG.byName.get(key) || [];
  return all.length === 1 ? all[0] : null;
};

/** 中分類が、今の表にあるか */
export const hasMid = (mid) => !!mid && CATALOG.byMid.has(`${mid.main}>${mid.category}`);

// AI の答え（中分類の M番号＋商品名）を 4階層の名前に変換する
const resolveCategory = (item) => {
  const mid = CATALOG.mids.get(String(item.mid_code || '').trim()) || null;

  // 商品名で決める（今の答えの形）
  const found = findProduct(mid, item.product_name);
  if (found) return toResult(found);

  // 古い答えの形（P番号）。今の表の番号として読む
  const product = CATALOG.products.get(String(item.product_code || '').trim());
  if (product && !item.product_name) return toResult(product);

  // 商品が決まらない → 中分類まで
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

/**
 * 容量（例: "900ml" "1L" "10個" "6枚切"）を整える。
 *  印字名に書かれていなければ AI は null を返す。数字を含まない値や長すぎる値は捨てる（DB は 30 文字まで）
 */
const normalizeVolume = (value) => {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').replace(/\s+/g, '').trim();
  if (!text || !/\d/.test(text) || text.length > 30) return null;
  return text;
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
      volume: normalizeVolume(item.volume),
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
- volume: レシートの印字名に容量・数量が書かれていれば、その表記を単位つきで（例: "900ml" "1L" "300g" "10個" "6枚切"）。
  印字名に書かれていなければ必ず null。商品から推測しない。
- mid_code: 下の「カテゴリ表」から、その商品が入る中分類の M番号 を1つ（例: "M3"）。分からなければ null。
- product_name: その中分類（mid_code の【 】の下）に並ぶ商品名から、その商品に最も当てはまるものを1つ、
  **表に書かれた文字のとおりに**写す（例: "牛乳"、"ステーキ用（ヒレ）"）。言いかえ・省略・新しい名前を作らない。
  当てはまる商品名がなければ必ず null（無理に当てはめない。中分類だけ分かれば mid_code だけ入れる）。
- 選び方: まず、商品の種類から大分類（常温・冷蔵・冷凍・日用品・肉・魚・野菜果物）を決め、次に中分類、最後に、その中分類の商品名を選ぶ。
  名前が似ていても、別の中分類の商品名は選ばない（例: 刺身の「ぶり」と、切り身の「ぶり」は別の中分類）。
- M番号は、表に載っているものだけを使うこと。

【カテゴリ表（【M番号 大分類>中分類】の下に 小分類: 商品名、商品名… が並ぶ）】
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
          volume: { type: 'STRING', nullable: true },
          mid_code: { type: 'STRING', nullable: true },
          product_name: { type: 'STRING', nullable: true },
        },
        required: ['item_name', 'price', 'is_discount'],
      },
    },
  },
  required: ['items'],
};
