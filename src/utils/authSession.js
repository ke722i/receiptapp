import { supabase } from '../services/supabaseClient';

/*
 * ログイン状態を保つ（自動ログイン）と、ユーザー ID の保存
 *  ・ログイン状態は Supabase が端末（localStorage）に保存する。画面を更新しても、ログアウトしない
 *  ・ログアウトするのは、ログアウトボタンを押したときだけ（signOut で、端末の保存も消す）
 *  ・ログイン画面で「自動ログイン」を外したときは、ブラウザ（タブ）を閉じたら、次に開いたときにログアウトする。
 *    画面の更新では、ログアウトしない（sessionStorage の印は、更新では消えず、タブを閉じると消える）
 *  ・「ユーザー ID を保存」は、ID だけを端末に覚える。パスワードは、アプリでは保存しない（ブラウザの保存機能に任せる）
 */

const AUTO_LOGIN_KEY = 'receipt_app_auto_login'; // '0' = 自動ログインしない（無ければ、する）
const SAVED_ID_KEY = 'receipt_app_saved_user_id'; // 保存したユーザー ID（無ければ、保存しない）
const ALIVE_KEY = 'receipt_app_session_alive'; // このタブで、ログインしている印（sessionStorage）

const read = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};
const write = (storage, key, value) => {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // 保存できない環境（プライベートブラウズなど）でも、ログインはできる
  }
};

/** ログイン画面のチェックボックスの初期値（前回の選択。初めては、どちらもオン） */
export const loadLoginPrefs = () => {
  const savedId = read(localStorage, SAVED_ID_KEY);
  const first = read(localStorage, AUTO_LOGIN_KEY) === null; // まだ一度もログインしていない端末
  return {
    autoLogin: read(localStorage, AUTO_LOGIN_KEY) !== '0',
    saveId: first || savedId !== null,
    savedId: savedId || '',
  };
};

/** ログインできたときに呼ぶ。選んだ設定を覚える */
export const rememberLoginPrefs = ({ autoLogin, saveId, userId }) => {
  write(localStorage, AUTO_LOGIN_KEY, autoLogin ? '1' : '0');
  write(localStorage, SAVED_ID_KEY, saveId ? userId : null);
  write(sessionStorage, ALIVE_KEY, '1');
};

/** 新規登録のときは、自動ログインにする */
export const rememberRegistered = () => {
  write(localStorage, AUTO_LOGIN_KEY, '1');
  write(sessionStorage, ALIVE_KEY, '1');
};

/**
 * アプリを開いたときに、保存されたログイン状態を確かめる
 *  ・自動ログインを外していて、タブを閉じたあと（印が無い）なら、ログアウトして null
 *  ・ログイン状態が無い・切れていれば null
 * @returns {Promise<object|null>} ログイン中のユーザー
 */
export const restoreSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    const user = data?.session?.user || null;
    if (error || !user) return null;
    if (read(localStorage, AUTO_LOGIN_KEY) === '0' && read(sessionStorage, ALIVE_KEY) !== '1') {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }
    write(sessionStorage, ALIVE_KEY, '1');
    return user;
  } catch {
    return null;
  }
};

/** ログアウト（この端末のログイン状態を消す。ほかの端末は、ログインしたまま） */
export const signOutHere = async () => {
  write(sessionStorage, ALIVE_KEY, null);
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // 通信できなくても、端末の保存は消える
  }
};
