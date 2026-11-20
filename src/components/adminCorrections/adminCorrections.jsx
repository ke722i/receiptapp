import { useState, useEffect } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './adminCorrections.css';
import { fetchCategoryCorrections, decideCategoryCorrection, fetchPrintNameRules, deletePrintNameRule } from '../../utils/adminDb';
import { findProductPaths } from '../../utils/categoryUtils';

/*
 * 管理者: 分類の修正（ユーザーが、AI の分類を直したもの）
 *  ・確認待ち: 印字名 × 直した後の分類ごとに、人数・回数でまとめる。承認すると、次の読み取りから、その印字名は、その分類になる
 *  ・承認済み: 今使われている辞書。取り消すと、辞書から消え、記録は確認待ちに戻る
 *  ・見送り: 見送った修正。承認に変えることもできる
 *  ・ユーザー ID・店・購入日・値段は、出さない（DB の関数が、人数と回数だけを返す）
 */

const TABS = [
  { value: 'pending', label: '確認待ち' },
  { value: 'rules', label: '承認済み' },
  { value: 'rejected', label: '見送り' },
];

const toJstDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' }) : '');
const pathText = (main, category, sub, product) => [main, category, sub, product].filter(Boolean).join(' > ');
const rowKey = (r) => [r.item_key, r.to_main, r.to_category, r.to_sub, r.to_product].join('|');

export default function AdminCorrections({ onBack }) {
  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  // 読み直し（タブを変えたとき・承認などのあと）。読み込み中の表示は、押したときに出す
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    setStatus('loading');
    setReloadKey((k) => k + 1);
  };
  useEffect(() => {
    let cancelled = false;
    (tab === 'rules' ? fetchPrintNameRules() : fetchCategoryCorrections(tab)).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setStatus('error');
        setError(result.error);
        return;
      }
      setError('');
      setRows(result.data);
      setStatus('ready');
    });
    return () => {
      cancelled = true;
    };
  }, [tab, reloadKey]);

  const decide = async (row, action) => {
    setBusyKey(rowKey(row));
    setMessage(null);
    const result = await decideCategoryCorrection(row, action);
    setBusyKey(null);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({
      type: 'success',
      text: action === 'approve'
        ? `「${row.item_name}」を承認しました。次の読み取りから、${pathText(row.to_category, row.to_product || row.to_sub)} になります。`
        : `「${row.item_name}」を見送りにしました。`,
    });
    reload();
  };

  const removeRule = async (rule) => {
    setBusyKey(`rule-${rule.id}`);
    setMessage(null);
    const result = await deletePrintNameRule(rule.id);
    setBusyKey(null);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({ type: 'success', text: `「${rule.item_name}」の辞書を取り消しました（記録は、確認待ちに戻りました）。` });
    reload();
  };

  // 直した後の分類が、今のカテゴリ表にあるか（無ければ、承認しても使われない）
  const inTable = (r) =>
    !r.to_product ||
    findProductPaths(r.to_product).some((p) => p.main === r.to_main && p.category === r.to_category && (!r.to_sub || p.sub === r.to_sub));

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">分類の修正</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          ユーザーが、AI の分類を直したものです（登録前の確認画面・登録後のレシート詳細の両方）。承認すると、次の読み取りから、その印字名は自動で、その分類になります（全員に効きます）。
        </p>

        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`admin-tab ${tab === t.value ? 'is-active' : ''}`}
              onClick={() => {
                if (t.value === tab) return;
                setMessage(null);
                setStatus('loading');
                setTab(t.value);
              }}
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

        {status === 'loading' && <p className="proposal-message">読み込み中...</p>}
        {status === 'error' && <p className="proposal-error">{error}</p>}
        {status === 'ready' && rows.length === 0 && (
          <p className="proposal-message">{tab === 'rules' ? '承認した辞書はありません' : `${TABS.find((t) => t.value === tab).label}の修正はありません`}</p>
        )}

        {status === 'ready' && rows.length > 0 && tab !== 'rules' && (
          <ul className="admin-list">
            {rows.map((r) => {
              const key = rowKey(r);
              const busy = busyKey === key;
              return (
                <li key={key} className="proposal-card admin-card">
                  <div className="admin-card-head">
                    <span className="admin-card-title">{r.item_name}</span>
                    <span className="admin-people">{r.people}人・{r.times}回</span>
                  </div>
                  <span className="correction-line">
                    <span className="correction-label">直す前</span>
                    {r.from_summary || '（不明）'}
                  </span>
                  <span className="correction-line is-to">
                    <span className="correction-label">直した後</span>
                    {pathText(r.to_main, r.to_category, r.to_sub, r.to_product)}
                  </span>
                  {r.other_targets > 0 && (
                    <span className="correction-warn">同じ印字名で、別の直し先が {r.other_targets} 件あります。多いほうを承認してください。</span>
                  )}
                  {r.rule_category && (
                    <span className="correction-note">今の辞書: {pathText(r.rule_category, r.rule_product)}（承認すると、置き換わります）</span>
                  )}
                  {!inTable(r) && <span className="correction-warn">直した後の分類が、今のカテゴリ表に無いので、承認しても使われません。</span>}
                  <span className="proposal-item-date">最後の修正: {toJstDate(r.last_at)}</span>
                  <div className="admin-actions">
                    {tab === 'pending' && (
                      <button type="button" className="admin-reject" disabled={busy} onClick={() => decide(r, 'reject')}>
                        見送り
                      </button>
                    )}
                    <button type="button" className="admin-approve" disabled={busy} onClick={() => decide(r, 'approve')}>
                      {busy ? '処理中...' : '承認'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {status === 'ready' && rows.length > 0 && tab === 'rules' && (
          <ul className="admin-list">
            {rows.map((rule) => {
              const busy = busyKey === `rule-${rule.id}`;
              return (
                <li key={rule.id} className="proposal-card admin-card">
                  <div className="admin-card-head">
                    <span className="admin-card-title">{rule.item_name}</span>
                    <span className="admin-people">{rule.people}人</span>
                  </div>
                  <span className="correction-line is-to">
                    <span className="correction-label">分類</span>
                    {pathText(rule.main_category, rule.category, rule.sub_category, rule.product_name)}
                  </span>
                  <span className="proposal-item-date">承認: {toJstDate(rule.approved_at)}</span>
                  <div className="admin-actions">
                    <button type="button" className="admin-undo" disabled={busy} onClick={() => removeRule(rule)}>
                      {busy ? '処理中...' : '取り消す'}
                    </button>
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
