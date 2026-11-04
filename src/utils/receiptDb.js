import { supabase } from '../services/supabaseClient';

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
      category: item.category || '未選択',
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