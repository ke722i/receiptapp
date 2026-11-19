import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import './login.css';
import appLogo from '../../assets/logo.png';
import { fetchLoginAnnouncements, formatDateTime } from '../../utils/announcements';
import Icon from '../icon/icon';

export default function Login({ onNavigateToRegister, onLoginSuccess }) {
  const [userId, setUserId] = useState('');
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
            <div className="error-message" style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
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
              required
            />
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