import { useState } from 'react';
import './login.css';

export default function Login({ onNavigateToRegister, onLoginSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // IDやパスワードのチェックを行わず、そのままログイン成功として処理
    if (onLoginSuccess) {
      onLoginSuccess();
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* ロゴ領域 */}
        <div className="logo-section">
          {/* 
            【画像挿入の手順】
            1. 表示したい画像ファイルを src/assets/ に配置（例: logo.png）
            2. import appLogo from '../../assets/logo.png';
            3. <img src={appLogo} alt="アプリロゴ" className="app-logo" />
          */}
          <div className="logo-placeholder">
            <span>アプリロゴ位置</span>
          </div>
        </div>

        {/* ログインフォーム */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="userId">ID / メールアドレス</label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="IDまたはメールアドレスを入力"
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
            />
          </div>

          <button type="submit" className="login-button">
            ログイン
          </button>
        </form>

        {/* 新規登録画面への導線 */}
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