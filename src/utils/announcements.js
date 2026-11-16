import { supabase } from '../services/supabaseClient';

// ホームのお知らせ（管理者が配信したもの）。読めなくても、ホームは今までどおり出す

/** 公開中のお知らせ（新しい順・5 件まで）。読めなければ空 */
export const fetchAnnouncements = async () => {
  const { data, error } = await supabase.rpc('list_announcements');
  return error || !Array.isArray(data) ? [] : data;
};

// 「✕」で閉じたお知らせ（端末に、ユーザーごとに覚える）。内容を直したお知らせは、もう一度出す
const storageKey = (userId) => `receipt_app_closed_announcements_${userId}`;
export const announcementKey = (a) => `${a.id}:${a.updated_at}`;

export const loadClosedAnnouncements = (userId) => {
  try {
    const list = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveClosedAnnouncements = (userId, keys) => {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(keys.slice(-50)));
  } catch {
    // 保存できなくても、この画面では閉じる
  }
};
