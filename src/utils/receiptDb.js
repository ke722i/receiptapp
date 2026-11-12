import { supabase } from '../services/supabaseClient';
import { formatPurchaseDate } from './purchaseDate';
import { normalizeVolume } from './volume';
import { isOpenablePath } from './categoryUtils';

// ---------- 自分の明細の印字名（ホームの検索で使う。読み込んだら覚えておく） ----------
// レシートの保存・編集・削除のときは、覚えた内容を捨てて、次に使うときに読み直す
let myItemNamesCache = null; // { userId, promise }
const forgetMyItemNames = () => {
  myItemNamesCache = null;
};

const ITEM_NAMES_PAGE = 1000; // Supabase が 1 回に返す行の上限に合わせる
const ITEM_NAMES_MAX = 20000; // 読み込む明細の上限（極端に多いときの守り）

/**
 * 自分のレシートの明細の、印字名と商品の分類（商品名があるものだけ）。購入日の新しい順
 * @returns {Promise<{ success: boolean, data?: { itemName, path, purchaseDate }[], error?: string }>}
 */
export const fetchMyItemNames = async () => {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id;
    if (!userId) throw new Error('ログインし直してください。');
    if (myItemNamesCache && myItemNamesCache.userId === userId) return myItemNamesCache.promise;

    const load = async () => {
      const rows = [];
      for (let from = 0; from < ITEM_NAMES_MAX; from += ITEM_NAMES_PAGE) {
        const { data, error } = await supabase
          .from('receipt_items')
          .select('id, item_name, main_category, category, sub_category, product_name, receipts!inner ( purchase_date, user_id )')
          .eq('receipts.user_id', userId)
          .not('product_name', 'is', null)
          .order('id', { ascending: false })
          .range(from, from + ITEM_NAMES_PAGE - 1);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < ITEM_NAMES_PAGE) break;
      }
      const list = rows
        .filter((row) => row.item_name && row.product_name)
        .map((row) => ({
          itemName: row.item_name,
          path: {
            main: row.main_category,
            category: row.category,
            sub: row.sub_category || null,
            product: row.product_name,
          },
          purchaseDate: row.receipts?.purchase_date || '',
        }))
        .sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)));
      return { success: true, data: list };
    };

    const promise = load().catch((error) => {
      forgetMyItemNames(); // 失敗したら、次は読み直す
      console.error('Fetch item names failed:', error);
      return { success: false, error: '印字名を読み込めませんでした。' };
    });
    myItemNamesCache = { userId, promise };
    return promise;
  } catch (error) {
    return { success: false, error: error.message || '印字名を読み込めませんでした。' };
  }
};

/**
 * レシート本体と明細を Supabase DB に一括保存するユーティリティ
 */
export const saveReceiptToDatabase = async (receiptData, itemsData) => {
  forgetMyItemNames();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('ログインユーザーの取得に失敗しました。');
    }

    // 1. レシート本体の保存（image_url を含める）
    const { data: insertedReceipt, error: receiptError } = await supabase
      .from('receipts')
      .insert([
        {
          user_id: user.id,
          store_name: receiptData.store_name || '',
          store_address: receiptData.store_address || '',
          store_number: receiptData.store_number || '',
          purchase_date: receiptData.purchase_date || new Date().toISOString().split('T')[0],
          image_url: receiptData.image_url || receiptData.imageSrc || null,
        },
      ])
      .select()
      .single();

    if (receiptError) throw receiptError;

    // 2. 明細データの整形（item_name を優先的に取得）
    const formattedItems = itemsData.map((item, index) => ({
      receipt_id: insertedReceipt.id,
      item_name: item.item_name || item.printName || item.name || `商品 ${index + 1}`, // ★ 渡された商品名を正しく取得
      // 4階層カテゴリ（商品が決まらない明細は sub_category / product_name が null）
      main_category: item.main_category || null, // 大分類
      category: item.category || '未選択', // 中分類
      sub_category: item.sub_category || null, // 小分類
      product_name: item.product_name || null, // 商品名（極小分類）
      price: Number(item.price) || 0,
      is_discount: Boolean(item.is_discount || item.isDiscount),
      volume: normalizeVolume(item.volume), // 容量（不明なら null）
    }));

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(formattedItems);

    if (itemsError) throw itemsError;

    return {
      success: true,
      receiptId: insertedReceipt.id,
    };
  } catch (error) {
    console.error('Database save operation failed:', error);
    return {
      success: false,
      error: error.message || 'データベースへの保存処理に失敗しました。',
    };
  }
};

/**
 * 保存済みのレシートの内容を更新する（レシート詳細の編集）
 *  ・レシート本体（店舗名・購入日）と、変更のあった明細だけを更新する
 *  ・自分のレシートだけが対象（DB の RLS と、user_id の条件の両方で守る）
 *  ・明細は 1 件ずつ更新するため、途中で失敗すると一部だけ更新された状態になりうる。その場合はエラーを返す
 * @param {number|string} receiptId
 * @param {{ store_name: string, purchase_date: string } | null} receiptFields 変更が無ければ null
 * @param {{ id, item_name, main_category, category, sub_category, product_name, price, is_discount, volume }[]} itemUpdates
 */
export const updateReceiptInDatabase = async (receiptId, receiptFields, itemUpdates = []) => {
  forgetMyItemNames();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('ログインユーザーの取得に失敗しました。');
    }

    if (receiptFields) {
      const { data, error } = await supabase
        .from('receipts')
        .update({
          store_name: receiptFields.store_name || '',
          purchase_date: receiptFields.purchase_date,
        })
        .eq('id', receiptId)
        .eq('user_id', user.id)
        .select('id');

      if (error) throw error;
      // RLS で対象外の行は、エラーにならず 0 件になる
      if (!data || data.length === 0) {
        throw new Error('レシートを更新できませんでした。');
      }
    }

    const failedIds = [];
    await Promise.all(
      itemUpdates.map(async (item) => {
        const { data, error } = await supabase
          .from('receipt_items')
          .update({
            item_name: item.item_name || '',
            main_category: item.main_category || null,
            category: item.category || '未選択',
            sub_category: item.sub_category || null,
            product_name: item.product_name || null,
            price: Number(item.price) || 0,
            is_discount: Boolean(item.is_discount),
            volume: normalizeVolume(item.volume),
          })
          .eq('id', item.id)
          .eq('receipt_id', receiptId)
          .select('id');

        if (error || !data || data.length === 0) failedIds.push(item.id);
      })
    );

    if (failedIds.length > 0) {
      throw new Error(`${failedIds.length}件の商品を更新できませんでした。もう一度お試しください。`);
    }

    return { success: true };
  } catch (error) {
    console.error('Update receipt failed:', error);
    return {
      success: false,
      error: error.message || 'レシートの更新に失敗しました。',
    };
  }
};

/**
 * 同じ店名・同じ購入日・同じ合計金額の、自分のレシートがすでにあるか（登録の前の、二重登録の確認）
 *  読み込めなかったときは、止めないよう「無い」として返す
 * @param {{ store_name: string, purchase_date: string }} receipt
 * @param {number} total 明細の値段の合計
 * @returns {Promise<boolean>}
 */
export const hasDuplicateReceipt = async (receipt, total) => {
  try {
    const { data, error } = await supabase
      .from('receipts')
      .select('id, receipt_items (price)')
      .eq('store_name', receipt.store_name || '')
      .eq('purchase_date', receipt.purchase_date);
    if (error || !data) return false;
    return data.some((r) => (r.receipt_items || []).reduce((sum, item) => sum + Number(item.price || 0), 0) === total);
  } catch {
    return false;
  }
};

/**
 * ログイン中ユーザーのレシート履歴を取得する
 */
export const fetchReceiptHistory = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('ユーザー情報の取得に失敗しました。');
    }

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        receipt_items (*)
      `)
      .eq('user_id', user.id)
      .order('purchase_date', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      data: data || [],
    };
  } catch (error) {
    console.error('Fetch history failed:', error);
    return {
      success: false,
      error: error.message || '履歴の取得に失敗しました。',
    };
  }
};


/**
 * 指定した商品（4階層のパス）の、自分のレシートの購入履歴を取得する
 *  大分類・中分類・小分類・商品名がすべて一致するものだけを返す
 *  （例: 常温の「そば」と冷凍の「そば」は混ざらない）
 * 「その他」の箱（ホームのカテゴリの「その他」）も開ける。空の階層（null）は、空のものだけを探す
 *  （例: 中分類が「その他」の箱 → 小分類・商品名が空の明細だけ）
 * 画像データ(image_url)は重いので取得しない。
 * @param {{ main: string, category: string, sub: string|null, product: string|null }} path
 */
export const fetchProductPriceHistory = async (path) => {
  try {
    if (!isOpenablePath(path)) {
      throw new Error('商品が指定されていません。');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('ユーザー情報の取得に失敗しました。');
    }

    let query = supabase
      .from('receipt_items')
      .select(`
        id,
        receipt_id,
        item_name,
        main_category,
        category,
        sub_category,
        product_name,
        price,
        is_discount,
        volume,
        receipts!inner ( purchase_date, store_name, user_id )
      `)
      .eq('main_category', path.main)
      .eq('category', path.category)
      .eq('receipts.user_id', user.id);

    // 小分類が無い表の形式・「その他」の箱にも対応（null は eq ではなく is で比較）
    query = path.sub ? query.eq('sub_category', path.sub) : query.is('sub_category', null);
    query = path.product ? query.eq('product_name', path.product) : query.is('product_name', null);

    const { data: rows, error } = await query;
    if (error) throw error;

    const history = (rows || [])
      .map((row) => ({
        id: row.id,
        receiptId: row.receipt_id,
        dateValue: row.receipts?.purchase_date || '',
        date: formatPurchaseDate(row.receipts?.purchase_date),
        shop: row.receipts?.store_name || '店舗名未登録',
        itemName: row.item_name || '',
        price: Number(row.price) || 0,
        isDiscount: Boolean(row.is_discount),
        volume: row.volume || null,
      }))
      // 新しい購入日順（同日は価格の安い順）
      .sort((a, b) => b.dateValue.localeCompare(a.dateValue) || a.price - b.price);

    return { success: true, data: history };
  } catch (error) {
    console.error('Fetch product price history failed:', error);
    return {
      success: false,
      error: error.message || '購入履歴の取得に失敗しました。',
    };
  }
};

/**
 * レシート1件を明細つきで取得する（商品詳細画面からレシート詳細へ移動するときに使う）
 */
export const fetchReceiptById = async (receiptId) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('ユーザー情報の取得に失敗しました。');
    }

    const { data, error } = await supabase
      .from('receipts')
      .select(`
        *,
        receipt_items (*)
      `)
      .eq('id', receiptId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return { success: true, data };
  } catch (error) {
    console.error('Fetch receipt failed:', error);
    return {
      success: false,
      error: error.message || 'レシートの取得に失敗しました。',
    };
  }
};

/**
 * 指定レシートの削除
 */
export const deleteReceiptFromDatabase = async (receiptId) => {
  forgetMyItemNames();
  try {
    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('id', receiptId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete operation failed:', error);
    return {
      success: false,
      error: error.message || '削除に失敗しました。',
    };
  }
};

/**
 * ログイン中ユーザーの全レシートデータを削除する
 */
export const deleteAllReceiptsFromDatabase = async () => {
  forgetMyItemNames();
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('ユーザー情報の取得に失敗しました。');

    const { error } = await supabase
      .from('receipts')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete all receipts failed:', error);
    return {
      success: false,
      error: error.message || '全データの削除に失敗しました。',
    };
  }
};