import { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import './register.css';

export default function Register({ onNavigateToLogin, onRegisterSuccess }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // ユーザーID制限の設定
  const MIN_USER_ID_LENGTH = 4;
  const MAX_USER_ID_LENGTH = 16;
  const USER_ID_REGEX = /^[a-zA-Z0-9_-]+$/; // 半角英数字、ハイフン、アンダースコアのみ許可

  // パスワード制限の設定（6〜16文字に変更）
  const MIN_PASSWORD_LENGTH = 6;
  const MAX_PASSWORD_LENGTH = 16;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedUserId = userId.trim();

    // 1. ユーザーIDの文字数・形式バリデーション
    if (trimmedUserId.length < MIN_USER_ID_LENGTH || trimmedUserId.length > MAX_USER_ID_LENGTH) {
      setErrorMessage(`ユーザーIDは${MIN_USER_ID_LENGTH}〜${MAX_USER_ID_LENGTH}文字で入力してください。`);
      return;
    }

    if (!USER_ID_REGEX.test(trimmedUserId)) {
      setErrorMessage('ユーザーIDは半角英数字（ハイフン・アンダースコア可）で入力してください。');
      return;
    }

    // 2. パスワードの文字数バリデーション
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setErrorMessage(`パスワードは${MIN_PASSWORD_LENGTH}〜${MAX_PASSWORD_LENGTH}文字で入力してください。`);
      return;
    }

    // 3. パスワードの一致確認
    if (password !== confirmPassword) {
      setErrorMessage('パスワードと確認用パスワードが一致しません。');
      return;
    }

    setLoading(true);

    try {
      // 内部的な識別用アドレスを生成
      const internalEmail = `${trimmedUserId.toLowerCase()}@app.internal`;

      // Supabaseへのユーザー登録
      const { data, error } = await supabase.auth.signUp({
        email: internalEmail,
        password: password,
        options: {
          data: {
            user_id: trimmedUserId,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          throw new Error('このユーザーIDは既に使用されています。別のIDを入力してください。');
        }
        throw error;
      }

      // 登録成功時
      if (data?.user) {
        alert('アカウントの作成が完了しました！');
        if (onRegisterSuccess) {
          onRegisterSuccess(data.user);
        }
      }
    } catch (error) {
      console.error('Register Error:', error);
      setErrorMessage(error.message || 'アカウント作成に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="logo-section">
          <div className="logo-placeholder">
            <span>アプリロゴ位置</span>
          </div>
        </div>

        <h2 className="register-title">新規アカウント登録</h2>

        <form onSubmit={handleSubmit} className="register-form">
          {errorMessage && (
            <div className="error-message" style={{ color: 'red', marginBottom: '10px', fontSize: '14px' }}>
              {errorMessage}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="register-userId">
              ユーザーID ({MIN_USER_ID_LENGTH}〜{MAX_USER_ID_LENGTH}文字の半角英数字)
            </label>
            <input
              type="text"
              id="register-userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="任意のIDを入力"
              maxLength={MAX_USER_ID_LENGTH}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">
              パスワード ({MIN_PASSWORD_LENGTH}〜{MAX_PASSWORD_LENGTH}文字)
            </label>
            <input
              type="password"
              id="register-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`パスワードを入力（${MIN_PASSWORD_LENGTH}〜${MAX_PASSWORD_LENGTH}文字）`}
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
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
              required
              maxLength={MAX_PASSWORD_LENGTH}
            />
          </div>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? '作成中...' : 'アカウント作成'}
          </button>
        </form>

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