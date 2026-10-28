import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import './login.css';

export default function Login({ onNavigateToRegister, onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setLoading(true);

    try {
      const internalEmail = `${userId.trim().toLowerCase()}@app.internal`;

      // Supabase Authentication によるログイン処理
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: password,
      });

      if (error) {
        throw error;
      }

      if (data?.user && onLoginSuccess) {
        onLoginSuccess(data.user);
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
          <div className="logo-placeholder">
            <span>アプリロゴ位置</span>
          </div>
        </div>

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