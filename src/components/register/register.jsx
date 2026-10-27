import { useState } from 'react';
import './register.css';

export default function Register({ onNavigateToLogin, onRegisterSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // 入力内容に関わらず作成完了処理を実行
    if (onRegisterSuccess) {
      onRegisterSuccess();
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        {/* ロゴ領域 */}
        <div className="logo-section">
          <div className="logo-placeholder">
            <span>アプリロゴ位置</span>
          </div>
        </div>

        <h2 className="register-title">新規アカウント登録</h2>

        {/* 新規登録フォーム */}
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="register-userId">ID / メールアドレス</label>
            <input
              type="text"
              id="register-userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="登録するIDまたはメールアドレス"
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">パスワード</label>
            <input
              type="password"
              id="register-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワードを入力"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">パスワード（確認用）</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="パスワードを再入力"
            />
          </div>

          <button type="submit" className="submit-button">
            アカウント作成
          </button>
        </form>

        {/* ログイン画面への戻り線 */}
        <div className="back-to-login-section">
          <button
            type="button"
            className="back-to-login-button"
            onClick={onNavigateToLogin}
          >
            ログイン画面に戻る
          </button>
        </div>
      </div>
    </div>
  );
}