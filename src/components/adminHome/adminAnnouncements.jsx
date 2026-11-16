import { useState, useEffect, useCallback } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './adminHome.css';
import { fetchAdminAnnouncements, saveAnnouncement, deleteAnnouncement } from '../../utils/adminDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const EMPTY = { id: null, title: '', body: '', active: true };
const TITLE_MAX = 60;
const BODY_MAX = 500;

const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatPurchaseDate(date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
};

/**
 * 管理者: お知らせの配信
 *  ・公開中のお知らせは、全員のホームの上に出る（新しい順に 5 件まで）。ユーザーは「✕」で閉じられる
 *  ・内容を直すと、閉じた人にも、もう一度出る。「公開しない」にすると、下書きとして残る
 */
export default function AdminAnnouncements({ onBack }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('loading');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    const result = await fetchAdminAnnouncements();
    if (result.success) {
      setList(result.data);
      setStatus('ready');
    } else {
      setMessage({ type: 'error', text: result.error });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminAnnouncements().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setList(result.data);
        setStatus('ready');
      } else {
        setMessage({ type: 'error', text: result.error });
        setStatus('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'タイトルを入れてください。' });
      return;
    }
    setSaving(true);
    const result = await saveAnnouncement(form);
    setSaving(false);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({ type: 'success', text: form.id ? 'お知らせを直しました。' : form.active ? 'お知らせを配信しました。' : '下書きとして保存しました。' });
    setForm(EMPTY);
    load();
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    const result = await deleteAnnouncement(target.id);
    setMessage(result.success ? { type: 'success', text: 'お知らせを消しました。' } : { type: 'error', text: result.error });
    if (form.id === target.id) setForm(EMPTY);
    load();
  };

  const toggleActive = async (a) => {
    const result = await saveAnnouncement({ id: a.id, title: a.title, body: a.body, active: !a.active });
    setMessage(
      result.success
        ? { type: 'success', text: a.active ? '公開を終えました（下書きに戻りました）。' : 'お知らせを配信しました。' }
        : { type: 'error', text: result.error }
    );
    load();
  };

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">お知らせの配信</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          公開したお知らせは、全員のホームのいちばん上に出ます（新しい順に 5 件まで）。ユーザーは「✕」で閉じられます。内容を直すと、もう一度出ます。
        </p>

        <form className="proposal-card" onSubmit={handleSave}>
          <h2 className="proposal-section-title">{form.id ? 'お知らせを直す' : '新しいお知らせ'}</h2>
          <label className="proposal-field">
            <span className="proposal-label">タイトル（{TITLE_MAX} 文字まで）</span>
            <input
              type="text"
              className="proposal-input"
              placeholder="例: 展示会にご来場ありがとうございます"
              maxLength={TITLE_MAX}
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </label>
          <label className="proposal-field">
            <span className="proposal-label">本文（任意。{BODY_MAX} 文字まで。改行できます）</span>
            <textarea
              className="proposal-input proposal-textarea"
              rows={4}
              maxLength={BODY_MAX}
              placeholder="例: ぜひレシートを撮影して、価格の比較を試してください。"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
            <span>すぐに公開する（外すと下書き）</span>
          </label>

          {message && (
            <p className={message.type === 'success' ? 'proposal-success' : 'proposal-error proposal-error-box'} role="status">
              {message.text}
            </p>
          )}

          <div className="admin-actions">
            {form.id && (
              <button type="button" className="admin-reject" onClick={() => setForm(EMPTY)}>
                直すのをやめる
              </button>
            )}
            <button type="submit" className="admin-approve" disabled={saving}>
              {saving ? '保存中...' : form.id ? '保存する' : form.active ? '配信する' : '下書きを保存'}
            </button>
          </div>
        </form>

        <section className="admin-home-section">
          <h2 className="proposal-section-title">お知らせの一覧</h2>
          {status === 'loading' && <p className="proposal-message">読み込み中...</p>}
          {status === 'ready' && list.length === 0 && <p className="proposal-message">まだお知らせはありません</p>}
          {status === 'ready' && list.length > 0 && (
            <ul className="admin-list">
              {list.map((a) => (
                <li key={a.id} className="proposal-card admin-card">
                  <div className="admin-card-head">
                    <span className="admin-card-title">{a.title}</span>
                    <span className={`proposal-status ${a.active ? 'is-approved' : 'is-pending'}`}>{a.active ? '公開中' : '下書き'}</span>
                  </div>
                  {a.body && <span className="proposal-item-path announcement-body">{a.body}</span>}
                  <span className="proposal-item-date">更新: {toJstDate(a.updated_at)}</span>
                  <div className="admin-actions">
                    <button type="button" className="admin-reject" onClick={() => setForm({ id: a.id, title: a.title, body: a.body, active: a.active })}>
                      直す
                    </button>
                    <button type="button" className="admin-undo" onClick={() => toggleActive(a)}>
                      {a.active ? '公開を終える' : '公開する'}
                    </button>
                    <button type="button" className="admin-delete" onClick={() => setDeleteTarget(a)}>
                      消す
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          title="お知らせを消す"
          message={`「${deleteTarget.title}」を消しますか？（元に戻せません）`}
          confirmLabel="消す"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
