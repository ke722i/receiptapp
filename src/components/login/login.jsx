import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './login.css';
import appLogo from '../../assets/logo.png';
import { fetchLoginAnnouncements, formatDateTime } from '../../utils/announcements';
import Icon from '../icon/icon';
import { loadLoginPrefs, rememberLoginPrefs } from '../../utils/authSession';

export default function Login({ onNavigateToRegister, onLoginSuccess }) {
  // 前回の選択（自動ログイン・ユーザー ID の保存）。保存した ID は、最初から入れておく
  const [prefs] = useState(loadLoginPrefs);
  const [userId, setUserId] = useState(prefs.savedId);
  const [autoLogin, setAutoLogin] = useState(prefs.autoLogin);
  const [saveId, setSaveId] = useState(prefs.saveId);
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  // ログイン画面のお知らせ（管理者が「ログイン画面にも出す」にしたもの。ログインしていなくても読める）
  const [notes, setNotes] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchLoginAnnouncements().then((list) => {
      if (!cancelled) setNotes(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const trimmedId = userId.trim();
      const internalEmail = `${trimmedId.toLowerCase()}@app.internal`;

      // Supabase Authentication によるログイン処理
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: password,
      });

      if (error) {
        throw error;
      }

      rememberLoginPrefs({ autoLogin, saveId, userId: trimmedId });
      if (data?.user && onLoginSuccess) {
        onLoginSuccess(data.user, trimmedId);
      }
    } catch (error) {
      console.error('Login Error:', error);
      setErrorMessage('ログインに失敗しました。ユーザーIDとパスワードを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-section">
          <img src={appLogo} alt="レシート即！メモ" className="app-logo" />
        </div>

        {notes.length > 0 && (
          <div className="login-notices">
            {notes.map((a) => (
              <div key={a.id} className={`login-notice ${a.level === 'high' ? 'is-high' : ''}`} role="note">
                <p className="login-notice-title">
                  <span aria-hidden="true" className="login-notice-icon"><Icon name={a.level === 'high' ? 'alert' : 'megaphone'} size={16} /></span>
                  {a.title}
                </p>
                {a.body && <p className="login-notice-body">{a.body}</p>}
                {a.ends_at && <p className="login-notice-ends">{formatDateTime(a.ends_at)} まで</p>}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {errorMessage && (
            <div className="error-message" style={{ color: 'var(--danger)', marginBottom: '10px', fontSize: '14px' }}>
              {errorMessage}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="userId">ユーザーID</label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="ユーザーIDを入力"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
              autoComplete="current-password"
              required
            />
          </div>

          {/* ログイン状態を保つ・ユーザー ID を覚える（utils/authSession.js） */}
          <div className="login-options">
            <label className="login-option">
              <input type="checkbox" checked={autoLogin} onChange={(e) => setAutoLogin(e.target.checked)} />
              <span>
                自動ログイン
                <small>ログアウトするまで、ログインしたままにします</small>
              </span>
            </label>
            <label className="login-option">
              <input type="checkbox" checked={saveId} onChange={(e) => setSaveId(e.target.checked)} />
              <span>
                ユーザーIDを保存
                <small>次から、ユーザーIDを入力しなくてよくなります</small>
              </span>
            </label>
            {!autoLogin && <p className="login-option-note">ブラウザを閉じると、ログアウトします。共用の端末では、こちらにしてください。</p>}
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="register-section">
          <p className="register-text">アカウントをお持ちでない方</p>
          <button
            type="button"
            className="register-button"
            onClick={onNavigateToRegister}
          >
            新規登録はこちら
          </button>
        </div>
      </div>
    </div>
  );
}