import { useState, useEffect, useCallback } from 'react';
import '../categoryProposal/categoryProposal.css';
import './adminProposals.css';
import { fetchAdminProposals, decideProposals } from '../../utils/adminDb';
import { describeProposal } from '../../utils/categoryProposal';
import { buildApprovedCsv, downloadCsv } from '../../utils/proposalCsv';
import { formatPurchaseDate } from '../../utils/purchaseDate';

const TABS = [
  { value: 'pending', label: '承認待ち' },
  { value: 'approved', label: '承認' },
  { value: 'rejected', label: '見送り' },
];
const APPROVE_DEFAULT_NOTE = '次の更新で追加します';
// ワンボタンで、メモの欄に入れる定型文（入れたあとも、自由に直せる）
const NOTE_TEMPLATES = {
  approve: [
    { label: '追加します', text: 'ご提案ありがとうございます。次の更新で追加します。' },
    { label: '近い形で追加', text: 'ご提案ありがとうございます。近い名前にそろえて、次の更新で追加します。' },
  ],
  reject: [
    { label: 'すでにある', text: 'すでに同じ内容がありますので、見送りました。' },
    { label: '分け方に合わない', text: '今のカテゴリの分け方に合わないため、見送りました。' },
    { label: '内容が不明', text: '内容を確認できなかったため、見送りました。' },
    { label: '今回は見送り', text: 'ご提案ありがとうございます。今回は見送りました。' },
  ],
};

// DB の日時（UTC）を、日本時間の日付に
const toJstDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatPurchaseDate(date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
};
const groupKey = (g) => g.ids.join('-');

/**
 * 管理者画面: カテゴリの提案の承認・見送り（ホームのハンバーガーメニューの「管理者」から。管理者のアカウントだけ）
 *  ・同じ提案は、人数でまとめて 1 枚のカードにする。ボタン 1 つで、全員分を承認・見送りにする
 *  ・メモは、提案した人の通知に出る（承認でメモが空なら「次の更新で追加します」）
 *  ・承認・見送りの一覧から、承認待ちに戻せる。承認した提案は、CSV で保存できる（tools/apply_proposals.py に渡す）
 *  ・承認しただけでは、表（Excel）にも AI にも出ない（docs/claude/proposal-approval.md）
 */
export default function AdminProposals({ onBack }) {
  const [tab, setTab] = useState('pending');
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading'); // loading / ready / error
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState({}); // カードごとのメモ
  const [busyKey, setBusyKey] = useState(null);
  const [message, setMessage] = useState(null); // { type, text }

  const load = useCallback(async (which) => {
    const result = await fetchAdminProposals(which);
    if (result.success) {
      setGroups(result.data);
      setStatus('ready');
    } else {
      setError(result.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminProposals(tab).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setGroups(result.data);
        setStatus('ready');
      } else {
        setError(result.error);
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const changeTab = (value) => {
    if (value === tab) return;
    setStatus('loading');
    setMessage(null);
    setTab(value);
  };

  const decide = async (group, nextStatus) => {
    const key = groupKey(group);
    let note = (drafts[key] || '').trim();
    if (nextStatus === 'approved' && !note) note = APPROVE_DEFAULT_NOTE;
    setBusyKey(key);
    const result = await decideProposals(group.ids, nextStatus, note);
    setBusyKey(null);
    const { title } = describeProposal(group);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    const verb = { approved: '承認しました', rejected: '見送りにしました', pending: '承認待ちに戻しました' }[nextStatus];
    setMessage({ type: 'success', text: `${title}を${verb}（${result.count}人分）。` });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    load(tab);
  };

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">提案の承認</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          同じ提案は、人数でまとめています。ボタン 1 つで、全員分を承認・見送りにします。メモは、提案した人の通知に出ます。
          承認しただけでは、表と AI には出ません（承認した提案を CSV で保存して、表に足す作業が必要です）。
        </p>

        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`admin-tab ${tab === t.value ? 'is-active' : ''}`}
              onClick={() => changeTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {message && (
          <p className={message.type === 'success' ? 'proposal-success' : 'proposal-error proposal-error-box'} role="status">
            {message.text}
          </p>
        )}

        {tab === 'approved' && status === 'ready' && groups.length > 0 && (
          <div className="admin-csv">
            <button type="button" className="admin-csv-button" onClick={() => downloadCsv(buildApprovedCsv(groups))}>
              承認した提案を CSV で保存
            </button>
            <p className="admin-csv-note">
              保存した CSV を、パソコンの tools/proposals/ に置いて、「承認したものを追加して」と伝えると、表に足します。
              新しい中分類・小分類は、products の列に商品名（「、」区切り）を書き足してください。
            </p>
          </div>
        )}

        {status === 'loading' && <p className="proposal-message">読み込み中...</p>}
        {status === 'error' && <p className="proposal-error">{error}</p>}
        {status === 'ready' && groups.length === 0 && (
          <p className="proposal-message">{TABS.find((t) => t.value === tab).label}の提案はありません</p>
        )}

        {status === 'ready' && groups.length > 0 && (
          <ul className="admin-list">
            {groups.map((g) => {
              const key = groupKey(g);
              const { title, place } = describeProposal(g);
              const busy = busyKey === key;
              return (
                <li key={key} className="proposal-card admin-card">
                  <div className="admin-card-head">
                    <span className="admin-card-title">{title}</span>
                    <span className="admin-people">{g.people}人</span>
                  </div>
                  <span className="proposal-item-path">{place}</span>
                  {g.notes && g.notes.length > 0 && <span className="proposal-item-path">商品の例: {g.notes.join(' / ')}</span>}
                  <span className="proposal-item-date">
                    最初の提案: {toJstDate(g.first_at)}
                    {g.reviewed_at && ` ／ 確認: ${toJstDate(g.reviewed_at)}`}
                  </span>
                  {tab !== 'pending' && g.admin_note && <span className="proposal-item-admin">メモ: {g.admin_note}</span>}

                  {tab === 'pending' ? (
                    <>
                      {['approve', 'reject'].map((kind) => (
                        <div key={kind} className="admin-templates" role="group" aria-label={kind === 'approve' ? '承認の定型文' : '見送りの定型文'}>
                          <span className="admin-templates-label">{kind === 'approve' ? '承認' : '見送り'}</span>
                          {NOTE_TEMPLATES[kind].map((t) => (
                            <button
                              key={t.label}
                              type="button"
                              className={`admin-template is-${kind}`}
                              onClick={() => setDrafts((prev) => ({ ...prev, [key]: t.text }))}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      ))}
                      <textarea
                        className="proposal-input proposal-textarea admin-note-input"
                        rows={2}
                        maxLength={200}
                        placeholder={`メモ（任意。通知に出ます。承認で空なら「${APPROVE_DEFAULT_NOTE}」）`}
                        value={drafts[key] || ''}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                        aria-label="提案した人へのメモ"
                      />
                      <div className="admin-actions">
                        <button type="button" className="admin-reject" disabled={busy} onClick={() => decide(g, 'rejected')}>
                          見送り
                        </button>
                        <button type="button" className="admin-approve" disabled={busy} onClick={() => decide(g, 'approved')}>
                          {busy ? '処理中...' : '承認'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="admin-actions">
                      <button type="button" className="admin-undo" disabled={busy} onClick={() => decide(g, 'pending')}>
                        {busy ? '処理中...' : '承認待ちに戻す'}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
