import { supabase } from '../services/supabaseClient';

// 管理者が配信したお知らせ（migrations/20261116100000_admin_tools.sql・20261117000000_announcement_levels.sql）
//  level（重要度）: low = 小（通知の画面）/ mid = 中（ホームのスライド。閉じたあとも通知の画面に残る）/ high = 高（ポップアップ）
//  期限（ends_at）を過ぎたものは、DB が返さない。読めなくても、画面は今までどおり出す

export const ANNOUNCEMENT_LEVELS = [
  { value: 'low', label: '小', place: '通知の画面に入る', hint: '知らなくても困らないこと（豆知識・軽い変更）' },
  { value: 'mid', label: '中', place: 'ホームのお知らせに出る', hint: '知ってほしいこと（カテゴリの追加・新しい機能）' },
  { value: 'high', label: '高', place: '使っている人にポップアップで出す', hint: '今すぐ知らないと困ること（メンテナンスの時間）。期限が必要' },
];
export const levelLabel = (level) => ANNOUNCEMENT_LEVELS.find((l) => l.value === level)?.label || '中';

/** 公開中・期限内のお知らせ（ログインしているユーザー。小 30・中 3・高 5 件まで）。読めなければ空 */
export const fetchAnnouncements = async () => {
  const { data, error } = await supabase.rpc('list_announcements');
  return error || !Array.isArray(data) ? [] : data;
};

/** ログイン画面のお知らせ（ログインしていなくても読める。3 件まで）。読めなければ空 */
export const fetchLoginAnnouncements = async () => {
  const { data, error } = await supabase.rpc('list_login_announcements');
  return error || !Array.isArray(data) ? [] : data;
};

// 内容を直したお知らせは、別のものとして扱う（閉じた人・読んだ人にも、もう一度出す）
export const announcementKey = (a) => `${a.id}:${a.updated_at}`;

// 端末に、ユーザーごとに覚える一覧（中の「✕」で閉じたもの / 高の「OK」を押したもの）
const loadList = (key) => {
  try {
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const saveList = (key, list) => {
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(-50)));
  } catch {
    // 保存できなくても、この画面では閉じる
  }
};

const closedKey = (userId) => `receipt_app_closed_announcements_${userId}`;
export const loadClosedAnnouncements = (userId) => loadList(closedKey(userId));
export const saveClosedAnnouncements = (userId, keys) => saveList(closedKey(userId), keys);

const confirmedKey = (userId) => `receipt_app_confirmed_announcements_${userId}`;
export const loadConfirmedAnnouncements = (userId) => loadList(confirmedKey(userId));
export const saveConfirmedAnnouncements = (userId, keys) => saveList(confirmedKey(userId), keys);

/** 日時の表示（日本時間。例: 11/20 22:00） */
export const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** DB の日時 → 入力欄（datetime-local）の値（端末の時刻） */
export const toLocalInput = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 入力欄（datetime-local）の値 → DB に送る日時（空なら null） */
export const fromLocalInput = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
