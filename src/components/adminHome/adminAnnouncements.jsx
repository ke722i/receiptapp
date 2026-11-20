import { useState, useEffect, useCallback } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './adminHome.css';
import { fetchAdminAnnouncements, saveAnnouncement, deleteAnnouncement } from '../../utils/adminDb';
import { ANNOUNCEMENT_LEVELS, levelLabel, formatDateTime, toLocalInput, fromLocalInput } from '../../utils/announcements';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const EMPTY = { id: null, title: '', body: '', active: true, level: 'mid', endsAt: '', showOnLogin: false };
const TITLE_MAX = 60;
const BODY_MAX = 500;
// 期限をワンボタンで入れる（今からの分）
const ENDS_PRESETS = [
  { label: '30 分', minutes: 30 },
  { label: '1 時間', minutes: 60 },
  { label: '3 時間', minutes: 180 },
  { label: '1 日', minutes: 1440 },
  { label: '1 週間', minutes: 10080 },
];

const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatPurchaseDate(date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
};
const toForm = (a) => ({
  id: a.id,
  title: a.title,
  body: a.body,
  active: a.active,
  level: a.level || 'mid',
  endsAt: toLocalInput(a.ends_at),
  showOnLogin: !!a.show_on_login,
});

/**
 * 管理者: お知らせの配信
 *  ・重要度: 小 = 通知の画面 / 中 = ホームのお知らせ（スライド。3 件まで） / 高 = 使っている人にポップアップ（期限が必要）
 *  ・期限を過ぎると、だれにも出ない。「ログイン画面にも出す」は、ログインしていない人も読める
 *  ・内容を直すと、閉じた人・読んだ人にも、もう一度出る。「公開しない」にすると、下書きとして残る
 */
export default function AdminAnnouncements({ onBack }) {
  const [list, setList] = useState([]);
  const [loadedAt, setLoadedAt] = useState(0); // 一覧を読んだ時刻（期限切れの表示に使う）
  const [status, setStatus] = useState('loading');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const applyResult = useCallback((result) => {
    if (result.success) {
      setList(result.data);
      setLoadedAt(Date.now());
      setStatus('ready');
    } else {
      setMessage({ type: 'error', text: result.error });
      setStatus('error');
    }
  }, []);

  const load = useCallback(async () => {
    applyResult(await fetchAdminAnnouncements());
  }, [applyResult]);

  useEffect(() => {
    let cancelled = false;
    fetchAdminAnnouncements().then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const setEndsIn = (minutes) => {
    setForm((p) => ({ ...p, endsAt: toLocalInput(new Date(Date.now() + minutes * 60000)) }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage({ type: 'error', text: 'タイトルを入れてください。' });
      return;
    }
    if (form.level === 'high' && !form.endsAt) {
      setMessage({ type: 'error', text: '重要度「高」のお知らせには、期限を入れてください。' });
      return;
    }
    setSaving(true);
    const result = await saveAnnouncement({
      id: form.id,
      title: form.title,
      body: form.body,
      active: form.active,
      level: form.level,
      endsAt: fromLocalInput(form.endsAt),
      showOnLogin: form.showOnLogin,
    });
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
    const f = toForm(a);
    const result = await saveAnnouncement({
      id: a.id,
      title: a.title,
      body: a.body,
      active: !a.active,
      level: f.level,
      endsAt: a.ends_at || null,
      showOnLogin: f.showOnLogin,
    });
    setMessage(
      result.success
        ? { type: 'success', text: a.active ? '公開を終えました（下書きに戻りました）。' : 'お知らせを配信しました。' }
        : { type: 'error', text: result.error }
    );
    load();
  };

  const isExpired = (a) => !!a.ends_at && new Date(a.ends_at).getTime() <= loadedAt;
  const selectedLevel = ANNOUNCEMENT_LEVELS.find((l) => l.value === form.level);

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
        <form className="proposal-card" onSubmit={handleSave}>
          <h2 className="proposal-section-title">{form.id ? 'お知らせを直す' : '新しいお知らせ'}</h2>

          <div className="proposal-field">
            <span className="proposal-label">重要度</span>
            <div className="ann-levels" role="radiogroup" aria-label="重要度">
              {ANNOUNCEMENT_LEVELS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={form.level === l.value}
                  className={`ann-level is-${l.value} ${form.level === l.value ? 'is-selected' : ''}`}
                  onClick={() => setForm((p) => ({ ...p, level: l.value }))}
                >
                  <span className="ann-level-name">{l.label}</span>
                  <span className="ann-level-place">{l.place}</span>
                </button>
              ))}
            </div>
            {selectedLevel && <span className="ann-hint">使いどころ: {selectedLevel.hint}</span>}
          </div>

          <label className="proposal-field">
            <span className="proposal-label">タイトル（{TITLE_MAX} 文字まで）</span>
            <input
              type="text"
              className="proposal-input"
              placeholder={form.level === 'high' ? '例: 22:00 からメンテナンスをします' : '例: カテゴリを追加しました'}
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
              placeholder="例: 30 分ほど使えません。入力中のレシートは、先に登録してください。"
              value={form.body}
              onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            />
          </label>

          <div className="proposal-field">
            <span className="proposal-label">期限（{form.level === 'high' ? '必須' : '任意。空なら、公開を終えるまで'}）</span>
            <div className="ann-ends-presets">
              {ENDS_PRESETS.map((p) => (
                <button key={p.label} type="button" className="ann-preset" onClick={() => setEndsIn(p.minutes)}>
                  {p.label}
                </button>
              ))}
              <button type="button" className="ann-preset" onClick={() => setForm((p) => ({ ...p, endsAt: '' }))}>
                なし
              </button>
            </div>
            <input
              type="datetime-local"
              className="proposal-input"
              value={form.endsAt}
              onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
              aria-label="期限の日時"
            />
          </div>

          <label className="admin-check">
            <input type="checkbox" checked={form.showOnLogin} onChange={(e) => setForm((p) => ({ ...p, showOnLogin: e.target.checked }))} />
            <span>ログイン画面にも出す（ログインしていない人も読めます。公開してよい内容だけ）</span>
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
              {list.map((a) => {
                const expired = isExpired(a);
                return (
                  <li key={a.id} className="proposal-card admin-card">
                    <div className="admin-card-head">
                      <span className="admin-card-title">
                        <span className={`ann-level-badge is-${a.level || 'mid'}`}>{levelLabel(a.level)}</span>
                        {a.title}
                      </span>
                      <span className={`proposal-status ${a.active && !expired ? 'is-approved' : 'is-pending'}`}>
                        {!a.active ? '下書き' : expired ? '期限切れ' : '公開中'}
                      </span>
                    </div>
                    {a.body && <span className="proposal-item-path announcement-body">{a.body}</span>}
                    <span className="proposal-item-date">
                      更新: {toJstDate(a.updated_at)}
                      {a.ends_at && ` ／ 期限: ${formatDateTime(a.ends_at)}`}
                      {a.show_on_login && ' ／ ログイン画面にも出す'}
                    </span>
                    <div className="admin-actions">
                      <button type="button" className="admin-reject" onClick={() => setForm(toForm(a))}>
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
                );
              })}
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
