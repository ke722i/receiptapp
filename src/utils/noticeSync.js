// 通知の「既読」と、お知らせの「閉じた（中の ✕）」「OK（高）」を、DB（アカウントごと）と、端末で、そろえる
//  ・DB: notice_states（supabase/migrations/20261124000000_notice_states.sql）。関数 list_notice_states・set_notice_states から読み書き
//  ・端末（localStorage）は、すぐ表示するための控え。ログインしたとき・ホームや通知の画面を開いたときに、DB の内容で上書きする
//  ・その端末で初めてそろえるときだけ、端末にあった記録（この機能の前のもの）を、DB に足す（移行）。そのあとは DB が正
import { supabase } from '../services/supabaseClient';
import { loadReadIds, saveReadIds } from './notices';
import {
  loadClosedAnnouncements,
  saveClosedAnnouncements,
  loadConfirmedAnnouncements,
  saveConfirmedAnnouncements,
} from './announcements';

const LOCAL = {
  read: [loadReadIds, saveReadIds],
  closed: [loadClosedAnnouncements, saveClosedAnnouncements],
  confirmed: [loadConfirmedAnnouncements, saveConfirmedAnnouncements],
};
const MAX_KEYS = 500; // 関数の 1 回の上限

const migratedKey = (userId) => `receipt_app_notice_synced_${userId}`;
const isMigrated = (userId) => {
  try {
    return localStorage.getItem(migratedKey(userId)) === '1';
  } catch {
    return false;
  }
};
const setMigrated = (userId) => {
  try {
    localStorage.setItem(migratedKey(userId), '1');
  } catch {
    // 覚えられなくても、次にもう一度足すだけ（重複は DB が無視する）
  }
};

// 送っている途中の変更（kind + key → on）。送り終わる前に、そろえる処理が走っても、押した内容が消えないようにする
const pending = new Map();
const pendingId = (kind, key) => `${kind}\u0000${key}`;

/** DB に、足す（on = true）・消す（on = false）。失敗しても、端末の控えはそのまま（次にそろえるときに、DB の内容に戻る） */
export const pushNoticeStates = async (kind, keys, on) => {
  const list = [...new Set((keys || []).map(String))];
  if (list.length === 0) return false;
  list.forEach((k) => pending.set(pendingId(kind, k), on));
  try {
    for (let i = 0; i < list.length; i += MAX_KEYS) {
      const { error } = await supabase.rpc('set_notice_states', { p_kind: kind, p_keys: list.slice(i, i + MAX_KEYS), p_on: on });
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('通知の既読を保存できませんでした', e);
    return false;
  } finally {
    list.forEach((k) => {
      if (pending.get(pendingId(kind, k)) === on) pending.delete(pendingId(kind, k));
    });
  }
};

/** DB の一覧に、送っている途中の変更を重ねる */
const applyPending = (kind, keys) => {
  const set = new Set(keys);
  pending.forEach((on, id) => {
    const [k, key] = id.split('\u0000');
    if (k !== kind) return;
    if (on) set.add(key);
    else set.delete(key);
  });
  return [...set];
};

/** DB と端末をそろえる。そろえたら true（画面を描き直す） */
export const syncNoticeStates = async (userId) => {
  if (!userId) return false;
  let rows;
  try {
    const { data, error } = await supabase.rpc('list_notice_states');
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    console.warn('通知の既読を読めませんでした', e);
    return false;
  }
  const migrate = !isMigrated(userId);
  const results = await Promise.all(
    Object.entries(LOCAL).map(async ([kind, [load, save]]) => {
      const server = rows.filter((r) => r.kind === kind).map((r) => String(r.key));
      let merged = server;
      if (migrate) {
        const localOnly = load(userId).map(String).filter((k) => !server.includes(k));
        if (localOnly.length > 0 && !(await pushNoticeStates(kind, localOnly, true))) return false;
        merged = [...server, ...localOnly];
      }
      save(userId, applyPending(kind, merged));
      return true;
    }),
  );
  if (migrate && results.every(Boolean)) setMigrated(userId);
  return true;
};
