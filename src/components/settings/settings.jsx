import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { deleteAllReceiptsFromDatabase } from '../../utils/receiptDb';
import './settings.css';

export default function Settings({
  onBack,
  onDeleteReceiptData,
  onDeleteAccount,
}) {
  const [retentionPeriod, setRetentionPeriod] = useState('90');
  const [userInfo, setUserInfo] = useState({ displayName: '読み込み中...' });

  // ログインユーザー情報を Supabase から取得して整形
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // メールアドレスがある場合は @ 以前を取得、無ければ ID を使用
        const rawName = user.email ? user.email.split('@')[0] : user.id;
        
        // @app.internal などの文字列を削除
        const cleanName = rawName.replace('@app.internal', '');

        setUserInfo({
          displayName: cleanName,
        });
      }
    };
    fetchUser();
  }, []);

  // レシートデータ削除ハンドラー（Supabaseの全削除関数を呼び出し）
  const handleDeleteReceipts = async () => {
    if (window.confirm('レシートデータを削除してもよろしいですか？')) {
      const res = await deleteAllReceiptsFromDatabase();
      if (res.success) {
        if (onDeleteReceiptData) onDeleteReceiptData(); // 親コンポーネント側の状態(State)を更新
        alert('レシートデータを削除しました。');
      } else {
        alert(`削除に失敗しました: ${res.error}`);
      }
    }
  };

  // アカウント削除ハンドラー
  const handleDeleteUserAccount = () => {
    if (
      window.confirm(
        'アカウントを削除してもよろしいですか？アカウント情報およびデータがすべて消去されます。'
      )
    ) {
      if (onDeleteAccount) onDeleteAccount();
      alert('アカウントを削除しました。');
    }
  };

  return (
    <div className="settings-container">
      {/* ヘッダー */}
      <header className="settings-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">設定</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* メインコンテンツ */}
      <main className="settings-main">
        {/* 1. アカウント・ユーザー情報 */}
        <section className="settings-section">
          <h2 className="section-header">ユーザー情報</h2>
          <div className="settings-card">
            <div className="settings-row">
              <span className="row-label">ユーザー</span>
              <span className="row-value">{userInfo.displayName}</span>
            </div>
          </div>
        </section>

        {/* 2. データ設定 */}
        <section className="settings-section">
          <h2 className="section-header">データ設定</h2>
          <div className="settings-card">
            {/* 保存期間プルダウン */}
            <div className="settings-row">
              <label htmlFor="retention-period" className="row-label">
                レシートの保存期間
              </label>
              <select
                id="retention-period"
                className="select-input"
                value={retentionPeriod}
                onChange={(e) => setRetentionPeriod(e.target.value)}
              >
                <option value="120">120日</option>
                <option value="90">90日</option>
                <option value="60">60日</option>
                <option value="30">30日</option>
              </select>
            </div>
          </div>
        </section>

        {/* 3. データ・アカウント管理 */}
        <section className="settings-section">
          <h2 className="section-header danger-header">データ・アカウント管理</h2>
          <div className="settings-card">
            <button
              type="button"
              className="action-button warning-button"
              onClick={handleDeleteReceipts}
            >
              レシートデータを削除する
            </button>

            <button
              type="button"
              className="action-button danger-button"
              onClick={handleDeleteUserAccount}
            >
              アカウントを削除する
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}