import './notices.css';
import { noticePlace } from '../../utils/notices';
import { formatPurchaseDate } from '../../utils/purchaseDate';

/**
 * 通知の一覧（結果が出たカテゴリの提案: 承認・見送り）
 * @param {object[]} notices 結果が出た提案（新しい順）
 * @param {number[]} unreadIds 開く前に、まだ読んでいなかった通知の id（目印を付ける）
 * @param {'loading'|'error'|'ready'} status
 */
export default function Notices({ notices = [], unreadIds = [], status = 'ready', onBack }) {
  return (
    <div className="notices-container">
      <header className="notices-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">通知</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="notices-main">
        {status === 'loading' && <p className="notices-message">読み込み中...</p>}
        {status === 'error' && <p className="notices-message notices-error">通知を読み込めませんでした。</p>}
        {status === 'ready' && notices.length === 0 && (
          <p className="notices-message">通知はありません。<br />提案（カテゴリ・商品名）の結果（承認・見送り）が出ると、ここにお知らせします。</p>
        )}

        {status === 'ready' && notices.length > 0 && (
          <ul className="notices-list">
            {notices.map((n) => {
              const isUnread = unreadIds.includes(n.id);
              const isApproved = n.status === 'approved';
              return (
                <li key={n.id} className={`notice-item ${isUnread ? 'is-unread' : ''}`}>
                  <span className="notice-mail" aria-hidden="true">{isUnread ? '✉️' : '📭'}</span>
                  <div className="notice-body">
                    <p className="notice-title">
                      {isUnread && <span className="notice-new">未読</span>}
                      <span className={`notice-result ${isApproved ? 'is-approved' : 'is-rejected'}`}>
                        {isApproved ? '承認' : '見送り'}
                      </span>
                      {isApproved ? '提案が承認されました' : '提案は、見送りになりました'}
                    </p>
                    <p className="notice-place">{noticePlace(n)}</p>
                    {n.admin_note && <p className="notice-note">管理者より: {n.admin_note}</p>}
                    <p className="notice-date">
                      {formatPurchaseDate((n.reviewed_at || n.created_at || '').slice(0, 10))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
