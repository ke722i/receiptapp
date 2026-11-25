import { useState, useEffect, useMemo, useCallback } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './adminHome.css';
import { fetchAdminUsers, setTestAccount, setAdminRole } from '../../utils/adminDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const SORTS = [
  { value: 'created', label: '登録が新しい順' },
  { value: 'today', label: '今日の解析が多い順' },
  { value: 'week', label: '7 日の解析が多い順' },
  { value: 'total', label: '解析の合計が多い順' },
];
const SORT_KEY = { today: 'parses_today', week: 'parses_7d', total: 'parses_total' };

const toJstDate = (value) => {
  if (!value) return '－';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '－' : formatPurchaseDate(date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }));
};

/**
 * 管理者: アカウントの管理
 *  ・テスト用（価格の共有の上限をかけない）と、管理者の権限を、スイッチで変える（管理者の権限は、確認のあと）
 *  ・ユーザー別の解析の回数（今日・直近 7 日・合計）を見る（1 日 30 回の上限の目安）
 *  ・自分自身の管理者の権限は外せない（DB も止める）
 * @param {string} currentLoginId 今ログインしている管理者のログイン ID（自分の行に印を付け、自分の権限は外せなくする）
 */
export default function AdminUsers({ currentLoginId, onBack }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('created');
  const [busyId, setBusyId] = useState(null);
  const [adminTarget, setAdminTarget] = useState(null); // { user, value }

  const load = useCallback(async () => {
    const result = await fetchAdminUsers();
    if (result.success) {
      setUsers(result.data);
      setStatus('ready');
    } else {
      setMessage({ type: 'error', text: result.error });
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAdminUsers().then((result) => {
      if (cancelled) return;
      if (result.success) {
        setUsers(result.data);
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => !q || String(u.login_id).toLowerCase().includes(q));
    const key = SORT_KEY[sort];
    return key ? [...list].sort((a, b) => b[key] - a[key]) : list;
  }, [users, query, sort]);

  const changeTest = async (u) => {
    setBusyId(u.user_id);
    const result = await setTestAccount(u.user_id, !u.is_test_account);
    setBusyId(null);
    setMessage(
      result.success
        ? { type: 'success', text: `${u.login_id} を${u.is_test_account ? '一般' : 'テスト用'}にしました。` }
        : { type: 'error', text: result.error }
    );
    load();
  };

  const changeAdmin = async () => {
    const { user: u, value } = adminTarget;
    setAdminTarget(null);
    setBusyId(u.user_id);
    const result = await setAdminRole(u.user_id, value);
    setBusyId(null);
    setMessage(
      result.success
        ? { type: 'success', text: `${u.login_id} の管理者の権限を${value ? '付けました' : '外しました'}。` }
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
        <h1 className="header-title">アカウントの管理</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          テスト用: 価格の共有の上限（1 人につき直近 3 件）をかけません。管理者: 管理者ホームと、この画面を使えます。
          解析の回数は、1 人 1 日 30 回が上限です。
        </p>

        <div className="admin-users-tools">
          <input
            type="search"
            autoComplete="off"
            className="proposal-input"
            placeholder="ログイン ID で探す"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="ログイン ID で探す"
          />
          <select className="proposal-input admin-users-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="並び順">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p className={message.type === 'success' ? 'proposal-success' : 'proposal-error proposal-error-box'} role="status">
            {message.text}
          </p>
        )}

        {status === 'loading' && <p className="proposal-message">読み込み中...</p>}
        {status === 'ready' && <p className="admin-users-count">{shown.length} 人</p>}
        {status === 'ready' && (
          <ul className="admin-list">
            {shown.map((u) => {
              const isSelf = u.login_id === currentLoginId;
              const busy = busyId === u.user_id;
              return (
                <li key={u.user_id} className="proposal-card admin-card">
                  <div className="admin-card-head">
                    <span className="admin-card-title">
                      {u.login_id}
                      {isSelf && <span className="admin-self">（自分）</span>}
                    </span>
                    <span className="admin-user-badges">
                      {u.is_admin && <span className="admin-badge">管理者</span>}
                      {u.is_test_account && <span className="admin-test-badge">テスト用</span>}
                    </span>
                  </div>
                  <span className="proposal-item-date">
                    登録: {toJstDate(u.created_at)} ／ 最後のログイン: {toJstDate(u.last_sign_in_at)}
                  </span>
                  <span className="proposal-item-path">
                    レシート {u.receipt_count} 枚 ／ 価格の共有 {u.share_prices ? 'オン' : 'オフ'}
                  </span>
                  <div className="admin-parses">
                    <span className={`admin-parse ${u.parses_today >= 30 ? 'is-limit' : ''}`}>
                      今日 <b>{u.parses_today}</b> / 30
                    </span>
                    <span className="admin-parse">
                      7 日 <b>{u.parses_7d}</b>
                    </span>
                    <span className="admin-parse">
                      合計 <b>{u.parses_total}</b>
                    </span>
                  </div>
                  <div className="admin-toggles">
                    <label className="admin-check">
                      <input type="checkbox" checked={u.is_test_account} disabled={busy} onChange={() => changeTest(u)} />
                      <span>テスト用</span>
                    </label>
                    <label className={`admin-check ${isSelf ? 'is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={u.is_admin}
                        disabled={busy || isSelf}
                        onChange={() => setAdminTarget({ user: u, value: !u.is_admin })}
                      />
                      <span>管理者{isSelf ? '（自分は外せません）' : ''}</span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {adminTarget && (
        <ConfirmDialog
          title={adminTarget.value ? '管理者にする' : '管理者を外す'}
          message={
            adminTarget.value
              ? `${adminTarget.user.login_id} を管理者にしますか？ 提案の承認・お知らせ・アカウントの管理が使えるようになります。`
              : `${adminTarget.user.login_id} の管理者の権限を外しますか？`
          }
          confirmLabel={adminTarget.value ? '管理者にする' : '外す'}
          danger={!adminTarget.value}
          onConfirm={changeAdmin}
          onCancel={() => setAdminTarget(null)}
        />
      )}
    </div>
  );
}
