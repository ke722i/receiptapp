// アカウントごとの設定・記録（お気に入り・検索履歴・カテゴリの提案のお知らせを閉じたか・「その他」の自動移動の記録）を、DB と端末で、そろえる
//  ・DB: user_prefs（supabase/migrations/20261124100000_user_prefs.sql）。関数 list_user_prefs・set_user_pref から読み書き
//  ・端末（localStorage）は、すぐ表示するための控え。変えたときに DB へ送り、ホーム・前面に戻ったときに DB の内容で上書きする
//  ・DB に無くて端末にあるものは、DB に足す（この機能の前の記録の移行）。SQL 未実行のときは、端末だけで動く
import { supabase } from '../services/supabaseClient';

// name → 端末の保存先（形式は、これまでと同じ。proposal_tip だけは、文字 '1'）
const LOCAL_KEYS = {
  favorites: (u) => `receipt_app_favorites_${u}`,
  search_history: (u) => `receipt_app_search_history_${u}`,
  proposal_tip: (u) => `receipt_app_proposal_tip_dismissed_${u}`,
  reassign_fp: (u) => `receipt_app_reassign_fp_${u}`,
  reassign_skip: (u) => `receipt_app_reassign_skip_${u}`,
  reassign_runs: (u) => `receipt_app_reassign_runs_${u}`,
};

const readLocal = (name, userId) => {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS[name](userId));
    if (raw === null) return undefined;
    return name === 'proposal_tip' ? raw === '1' : JSON.parse(raw);
  } catch {
    return undefined;
  }
};
const writeLocal = (name, userId, value) => {
  try {
    localStorage.setItem(LOCAL_KEYS[name](userId), name === 'proposal_tip' ? (value ? '1' : '0') : JSON.stringify(value));
  } catch {
    // 保存できなくても、この画面では動く
  }
};

// 送っている途中の値（name → 値）。送り終わる前に、そろえる処理が走っても、直した内容が消えないようにする
const pending = new Map();
let seq = 0;

/** DB に、値を送る（失敗しても、端末の控えはそのまま）。端末の控えは、呼ぶ側が先に書いておく */
export const pushPref = async (userId, name, value) => {
  if (!userId || !LOCAL_KEYS[name]) return false;
  const mine = (seq += 1);
  pending.set(`${userId}\u0000${name}`, { mine, value });
  try {
    const { error } = await supabase.rpc('set_user_pref', { p_name: name, p_value: value });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('設定を保存できませんでした', e);
    return false;
  } finally {
    if (pending.get(`${userId}\u0000${name}`)?.mine === mine) pending.delete(`${userId}\u0000${name}`);
  }
};

/** DB と端末をそろえる。端末の内容が変わったら true（画面を描き直す） */
export const syncUserPrefs = async (userId) => {
  if (!userId) return false;
  let rows;
  try {
    const { data, error } = await supabase.rpc('list_user_prefs');
    if (error) throw error;
    rows = data || [];
  } catch (e) {
    console.warn('設定を読めませんでした', e);
    return false;
  }
  const server = new Map(rows.map((r) => [r.name, r.value]));
  let changed = false;
  Object.keys(LOCAL_KEYS).forEach((name) => {
    const inFlight = pending.get(`${userId}\u0000${name}`);
    if (inFlight) return; // 送っている途中は、端末の値が新しい
    const local = readLocal(name, userId);
    if (server.has(name)) {
      const value = server.get(name);
      if (JSON.stringify(value) !== JSON.stringify(local)) {
        writeLocal(name, userId, value);
        changed = true;
      }
    } else if (local !== undefined) {
      pushPref(userId, name, local); // 移行: 端末にだけある記録を、DB に足す
    }
  });
  return changed;
};
