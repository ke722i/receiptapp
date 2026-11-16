import { useState, useRef } from 'react';
import './notices.css';
import { noticePlace } from '../../utils/notices';
import { formatPurchaseDate } from '../../utils/purchaseDate';

const ACTION_WIDTH = 84; // スワイプで出るボタンの幅（px）

// 1 件の通知。左にスワイプすると、右にボタンが出る。縦のスクロールは、そのまま通す
function NoticeRow({ notice: n, isUnread, isOpen, onOpen, onMarkRead, onMarkUnread }) {
  const [drag, setDrag] = useState(null); // 指で動かしている間の位置（px。0〜-ACTION_WIDTH）
  const start = useRef(null); // { x, y, base, axis }
  const isApproved = n.status === 'approved';
  const offset = drag ?? (isOpen ? -ACTION_WIDTH : 0);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, base: isOpen ? -ACTION_WIDTH : 0, axis: null };
  };
  const onTouchMove = (e) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (s.axis === 'x') setDrag(Math.max(-ACTION_WIDTH, Math.min(0, s.base + dx)));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== 'x') {
      setDrag(null);
      return;
    }
    const open = (drag ?? s.base) < -ACTION_WIDTH / 2;
    setDrag(null);
    onOpen(open ? n.id : null);
  };

  const handleAction = () => {
    (isUnread ? onMarkRead : onMarkUnread)([n.id]);
    onOpen(null);
  };

  return (
    <li className="notice-swipe">
      <button
        type="button"
        className={`notice-swipe-action ${isUnread ? 'is-read' : 'is-unread'}`}
        style={{ width: ACTION_WIDTH }}
        onClick={handleAction}
        tabIndex={isOpen ? 0 : -1}
      >
        {isUnread ? '既読' : '未読に戻す'}
      </button>
      <div
        className={`notice-item ${isUnread ? 'is-unread' : ''}`}
        style={{ transform: `translateX(${offset}px)`, transition: drag === null ? 'transform 0.2s' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => isOpen && onOpen(null)}
      >
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
          <div className="notice-foot">
            <p className="notice-date">{formatPurchaseDate((n.reviewed_at || n.created_at || '').slice(0, 10))}</p>
            {isUnread ? (
              <button type="button" className="notice-read-button" onClick={() => onMarkRead([n.id])}>
                既読にする
              </button>
            ) : (
              <span className="notice-read-label">既読</span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * 通知の一覧（結果が出たカテゴリの提案: 承認・見送り）
 * @param {object[]} notices 結果が出た提案（新しい順）
 * @param {number[]} unreadIds まだ読んでいない通知の id（目印を付ける。画面を開いただけでは、既読にならない）
 * @param {(ids: number[]) => void} onMarkRead 指定した通知を既読にする
 * @param {(ids: number[]) => void} onMarkUnread 指定した通知を未読に戻す
 * ・通知を左にスワイプすると、「既読」（既読の通知は「未読に戻す」）のボタンが出る（LINE のように）
 * @param {'loading'|'error'|'ready'} status
 */
export default function Notices({ notices = [], unreadIds = [], status = 'ready', onMarkRead, onMarkUnread, onBack }) {
  const [openId, setOpenId] = useState(null); // 左にスワイプして、ボタンを出している通知
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
          <div className="notices-toolbar">
            <span className="notices-unread-count">未読 {unreadIds.length} 件</span>
            <button type="button" className="notices-readall" disabled={unreadIds.length === 0} onClick={() => onMarkRead(unreadIds)}>
              すべて既読にする
            </button>
          </div>
        )}

        {status === 'ready' && notices.length > 0 && (
          <ul className="notices-list">
            {notices.map((n) => (
              <NoticeRow
                key={n.id}
                notice={n}
                isUnread={unreadIds.includes(n.id)}
                isOpen={openId === n.id}
                onOpen={setOpenId}
                onMarkRead={onMarkRead}
                onMarkUnread={onMarkUnread}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
