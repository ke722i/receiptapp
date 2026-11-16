import { useState, useEffect } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './adminHome.css';
import { fetchAdminStats } from '../../utils/adminDb';

// 利用状況の数字（ラベル・値の取り出し）
const STAT_ITEMS = [
  { label: '登録ユーザー', value: (s) => s.users, sub: (s) => `直近 7 日 +${s.users_7d}` },
  { label: 'レシート', value: (s) => s.receipts, sub: (s) => `直近 7 日 +${s.receipts_7d}` },
  { label: '商品（明細）', value: (s) => s.items },
  { label: '今日の解析', value: (s) => s.parses_today, sub: () => '全員の合計' },
  { label: '価格の共有オン', value: (s) => s.share_users, sub: () => '人' },
  { label: '提案', value: (s) => s.proposals_pending, sub: (s) => `承認待ち（承認 ${s.proposals_approved}・見送り ${s.proposals_rejected}）` },
];

/**
 * 管理者ホーム（管理者のアカウントでログインすると、最初に開く）
 *  ・利用状況の数字と、管理者の機能（提案の承認・お知らせ・アカウントの管理）の入口
 *  ・「一般の画面を見る」で、一般のユーザーと同じホームに行ける（展示・動作の確認用）
 *  ・権限は、DB の関数が確かめる（migrations/20261116000000・20261116100000）
 */
export default function AdminHome({ userId, onOpenProposals, onOpenAnnouncements, onOpenUsers, onOpenGeneralHome, onLogout }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchAdminStats().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setStats(result.data);
        setError('');
      } else {
        setError(result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const pending = stats?.proposals_pending ?? 0;

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <div className="header-right-spacer"></div>
        <h1 className="header-title">管理者ホーム</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <div className="admin-home-account">
          <span>{userId}</span>
          <span className="admin-badge">管理者</span>
        </div>

        <section className="admin-home-section">
          <div className="admin-home-section-head">
            <h2 className="proposal-section-title">利用状況</h2>
            <button type="button" className="admin-home-reload" onClick={() => setReloadKey((k) => k + 1)}>
              ↻ 更新
            </button>
          </div>
          {error && <p className="proposal-error">{error}</p>}
          {!stats && !error && <p className="proposal-message">読み込み中...</p>}
          {stats && (
            <div className="admin-stats">
              {STAT_ITEMS.map((item) => (
                <div key={item.label} className="admin-stat">
                  <span className="admin-stat-label">{item.label}</span>
                  <span className="admin-stat-value">{item.value(stats)}</span>
                  {item.sub && <span className="admin-stat-sub">{item.sub(stats)}</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-home-section">
          <h2 className="proposal-section-title">管理者の機能</h2>
          <div className="admin-menu">
            <button type="button" className="admin-menu-item" onClick={onOpenProposals}>
              <span className="admin-menu-icon" aria-hidden="true">✅</span>
              <span className="admin-menu-text">
                <span className="admin-menu-title">提案の承認</span>
                <span className="admin-menu-sub">カテゴリの提案を、承認・見送りにする</span>
              </span>
              {pending > 0 && <span className="admin-menu-count">{pending}</span>}
              <span className="admin-menu-arrow">›</span>
            </button>
            <button type="button" className="admin-menu-item" onClick={onOpenAnnouncements}>
              <span className="admin-menu-icon" aria-hidden="true">📢</span>
              <span className="admin-menu-text">
                <span className="admin-menu-title">お知らせの配信</span>
                <span className="admin-menu-sub">全員のホームに、お知らせを出す</span>
              </span>
              <span className="admin-menu-arrow">›</span>
            </button>
            <button type="button" className="admin-menu-item" onClick={onOpenUsers}>
              <span className="admin-menu-icon" aria-hidden="true">👥</span>
              <span className="admin-menu-text">
                <span className="admin-menu-title">アカウントの管理</span>
                <span className="admin-menu-sub">テスト用・管理者の権限、ユーザー別の解析の回数</span>
              </span>
              <span className="admin-menu-arrow">›</span>
            </button>
          </div>
        </section>

        <div className="admin-home-footer">
          <button type="button" className="admin-home-general" onClick={onOpenGeneralHome}>
            一般の画面を見る
          </button>
          <button type="button" className="admin-home-logout" onClick={onLogout}>
            ログアウト
          </button>
        </div>
      </main>
    </div>
  );
}
