import { useState, useRef } from 'react';
import './notices.css';
import { noticePlace } from '../../utils/notices';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import Icon from '../icon/icon';

// DB の日時（UTC）を、日本時間の日付に
const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatPurchaseDate(date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
};

const ACTION_WIDTH = 84; // スワイプで出るボタンの幅（px）

// 1 件の通知。左にスワイプすると、右にボタンが出る。縦のスクロールは、そのまま通す
function NoticeRow({ notice: n, isUnread, isOpen, onOpen, onMarkRead, onMarkUnread, onUndoReassign, onOpenReassign, onOpenRecategorize }) {
  const [drag, setDrag] = useState(null); // 指で動かしている間の位置（px。0〜-ACTION_WIDTH）
  const start = useRef(null); // { x, y, base, axis }
  const isApproved = n.status === 'approved';
  const isAnnouncement = n.kind === 'announcement';
  const isReassign = n.kind === 'reassign';
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState('');
  const handleUndo = async () => {
    setUndoing(true);
    const result = await onUndoReassign(n);
    setUndoing(false);
    setUndoError(result?.success ? '' : result?.error || '元に戻せませんでした。');
  };
  const canSwipe = !n.noRead; // 中のお知らせ（ホームに出るもの）は、既読・未読の切り替えをしない
  const offset = drag ?? (isOpen ? -ACTION_WIDTH : 0);

  const onTouchStart = (e) => {
    if (!canSwipe) return;
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
    onOpen(open ? n.key : null);
  };

  const handleAction = () => {
    (isUnread ? onMarkRead : onMarkUnread)([n.key]);
    onOpen(null);
  };

  return (
    <li className="notice-swipe">
      {canSwipe && (
      <button
        type="button"
        className={`notice-swipe-action ${isUnread ? 'is-read' : 'is-unread'}`}
        style={{ width: ACTION_WIDTH }}
        onClick={handleAction}
        tabIndex={isOpen ? 0 : -1}
      >
        {isUnread ? '既読' : '未読に戻す'}
      </button>
      )}
      <div
        className={`notice-item ${isUnread ? 'is-unread' : ''}`}
        style={{ transform: `translateX(${offset}px)`, transition: drag === null ? 'transform 0.2s' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onClick={() => isOpen && onOpen(null)}
      >
        <span className="notice-mail" aria-hidden="true"><Icon name={isReassign ? (n.moves.length > 0 ? 'undo' : 'bulb') : isAnnouncement ? 'megaphone' : isUnread ? 'mail' : 'check'} size={20} /></span>
        <div className="notice-body">
          {isReassign ? (
            <>
              {n.moves.length > 0 ? (
                <>
                  <p className="notice-title">
                    {isUnread && <span className="notice-new">未読</span>}
                    <span className="notice-result is-announcement">自動で移動</span>
                    「その他」の商品 {n.moves.length} 件を、新しいカテゴリに移しました
                  </p>
                  <ul className="notice-moves">
                    {n.moves.slice(0, 5).map((m) => (
                      <li key={m.id}>
                        {m.name} → {m.to.product}（{[m.to.category, m.to.sub].filter(Boolean).join(' > ')}）
                      </li>
                    ))}
                    {n.moves.length > 5 && <li>ほか {n.moves.length - 5} 件</li>}
                  </ul>
                  {n.undone ? (
                    <p className="notice-note">元に戻しました（この商品は、もう自動では移しません）。</p>
                  ) : (
                    <div className="notice-reassign-actions">
                      <button type="button" className="notice-undo-button" disabled={undoing} onClick={handleUndo}>
                        {undoing ? '戻しています...' : '元に戻す'}
                      </button>
                    </div>
                  )}
                  {undoError && <p className="notice-note notice-error">{undoError}</p>}
                </>
              ) : (
                <p className="notice-title">
                  {isUnread && <span className="notice-new">未読</span>}
                  <span className="notice-result is-announcement">カテゴリ</span>
                  新しいカテゴリに合いそうな商品が {n.recatCount} 件あります
                </p>
              )}
              {n.reviewCount > 0 && (
                <button type="button" className="notice-review-link" onClick={onOpenReassign}>
                  決められなかった商品 {n.reviewCount} 件を、見直す ›
                </button>
              )}
              {n.recatCount > 0 && onOpenRecategorize && (
                <button type="button" className="notice-review-link" onClick={onOpenRecategorize}>
                  ほかの分類で登録した商品 {n.recatCount} 件を、見直す ›
                </button>
              )}
            </>
          ) : isAnnouncement ? (
            <>
              <p className="notice-title">
                {isUnread && <span className="notice-new">未読</span>}
                <span className="notice-result is-announcement">お知らせ</span>
                {n.title}
              </p>
              {n.body && <p className="notice-note notice-announcement-body">{n.body}</p>}
            </>
          ) : (
            <>
              <p className="notice-title">
                {isUnread && <span className="notice-new">未読</span>}
                <span className={`notice-result ${isApproved ? 'is-approved' : 'is-rejected'}`}>
                  {isApproved ? '承認' : '見送り'}
                </span>
                {isApproved ? '提案が承認されました' : '提案は、見送りになりました'}
              </p>
              <p className="notice-place">{noticePlace(n)}</p>
              {n.admin_note && <p className="notice-note">管理者より: {n.admin_note}</p>}
            </>
          )}
          <div className="notice-foot">
            <p className="notice-date">{toJstDate(n.sortAt)}</p>
            {n.noRead ? (
              <span className="notice-read-label">ホームのお知らせ</span>
            ) : isUnread ? (
              <button type="button" className="notice-read-button" onClick={() => onMarkRead([n.key])}>
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
 * 通知の一覧（結果が出たカテゴリの提案: 承認・見送り ＋ お知らせの小・中。utils/notices.js の buildNoticeItems）
 * @param {object[]} notices 並べるもの（新しい順。key・kind を持つ）
 * @param {(number|string)[]} unreadIds まだ読んでいない通知の key（目印を付ける。画面を開いただけでは、既読にならない）
 * @param {(keys: (number|string)[]) => void} onMarkRead 指定した通知を既読にする
 * @param {(keys: (number|string)[]) => void} onMarkUnread 指定した通知を未読に戻す
 * ・通知を左にスワイプすると、「既読」（既読の通知は「未読に戻す」）のボタンが出る（LINE のように）
 * @param {'loading'|'error'|'ready'} status
 */
export default function Notices({ notices = [], unreadIds = [], status = 'ready', onMarkRead, onMarkUnread, onUndoReassign, onOpenReassign, onOpenRecategorize, onBack }) {
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
          <p className="notices-message">通知はありません。<br />提案（カテゴリ・商品名）の結果（承認・見送り）と、運営からのお知らせが、ここに届きます。</p>
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
                key={n.key}
                notice={n}
                isUnread={unreadIds.includes(n.key)}
                isOpen={openId === n.key}
                onOpen={setOpenId}
                onMarkRead={onMarkRead}
                onMarkUnread={onMarkUnread}
                onUndoReassign={onUndoReassign}
                onOpenReassign={onOpenReassign}
                onOpenRecategorize={onOpenRecategorize}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
