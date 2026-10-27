import { useState } from 'react';
import './settings.css';

export default function Settings({
  onBack,
  userId = 'User_12345',
  onDeleteReceiptData,
  onDeleteAllData,
  onDeleteAccount,
}) {
  const [retentionPeriod, setRetentionPeriod] = useState('90'); // デフォルト90日
  const [showDemoData, setShowDemoData] = useState(false);

  // 各削除ボタンのハンドラー
  const handleDeleteReceipts = () => {
    if (window.confirm('レシートデータを削除してもよろしいですか？')) {
      if (onDeleteReceiptData) onDeleteReceiptData();
      alert('レシートデータを削除しました。');
    }
  };

  const handleDeleteAll = () => {
    if (
      window.confirm(
        'すべてのデータを削除してもよろしいですか？この操作は取り消せません。'
      )
    ) {
      if (onDeleteAllData) onDeleteAllData();
      alert('すべてのデータを削除しました。');
    }
  };

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
              <span className="row-label">ユーザー名 (ID)</span>
              <span className="row-value">{userId}</span>
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

            {/* デモデータ表示切り替え */}
            <div className="settings-row">
              <label htmlFor="demo-data-toggle" className="row-label">
                デモデータの表示
              </label>
              <input
                type="checkbox"
                id="demo-data-toggle"
                className="checkbox-input"
                checked={showDemoData}
                onChange={(e) => setShowDemoData(e.target.checked)}
              />
            </div>
          </div>
        </section>

        {/* 3. 危険エリア (削除関連ボタン) */}
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
              onClick={handleDeleteAll}
            >
              データを削除する
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