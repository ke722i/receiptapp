import { supabase } from '../services/supabaseClient';
import { formatPurchaseDate } from './purchaseDate';

/**
 * レシート本体と明細を Supabase DB に一括保存するユーティリティ
 */
export const saveReceiptToDatabase = async (receiptData, itemsData) => {
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
 * 画像データ(image_url)は重いので取得しない。
 * @param {{ main: string, category: string, sub: string, product: string }} path
 */
export const fetchProductPriceHistory = async (path) => {
  try {
    if (!path || !path.product) {
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
        receipts!inner ( purchase_date, store_name, user_id )
      `)
      .eq('main_category', path.main)
      .eq('category', path.category)
      .eq('product_name', path.product)
      .eq('receipts.user_id', user.id);

    // 小分類が無い表の形式にも対応（null は eq ではなく is で比較）
    query = path.sub ? query.eq('sub_category', path.sub) : query.is('sub_category', null);

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