import { useState, useEffect, useMemo, useCallback } from 'react';
import '../categoryProposal/categoryProposal.css';
import '../adminProposals/adminProposals.css';
import './reassignOther.css';
import { fetchMyOtherItems, applyItemCategories } from '../../utils/receiptDb';
import { planReassign, groupReview, describeBox, otherBoxOf, candidatesInBox, loadSkipIds, addSkipIds } from '../../utils/reassignOther';
import { productKey, formatPath } from '../../utils/categoryUtils';

// 「その他」の箱の中の商品を、小分類ごとにまとめる（プルダウンの見出し用）
const groupBySub = (paths) => {
  const map = new Map();
  paths.forEach((p) => {
    const label = [p.category, p.sub].filter(Boolean).join(' > ');
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(p);
  });
  return [...map.entries()];
};

/**
 * 「その他」の商品を見直す画面（設定・通知から）
 *  ・「その他」で登録した商品のうち、移し先を選べるもの（同じ印字名・同じ「その他」の箱はまとめる）
 *  ・印字名に商品名が 1 つだけ含まれるものは、最初から選んである（自動で移す処理で漏れたもの）。複数・なしのものは、ユーザーが選ぶ
 *  ・「このままにする」を押したものは、二度と出さない
 */
export default function ReassignOther({ userId, onBack }) {
  const [groups, setGroups] = useState([]);
  const [status, setStatus] = useState('loading'); // loading / ready / error
  const [choices, setChoices] = useState({}); // グループの key → 選んだ商品の productKey
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);

  const applyLoaded = useCallback(
    (result) => {
      if (!result.success) {
        setStatus('error');
        setMessage({ type: 'error', text: result.error });
        return;
      }
      const rows = result.data;
      const plan = planReassign(rows, loadSkipIds(userId));
      // 自動で移す処理で漏れたもの（候補が 1 つ）も、ここに出す（最初から選んでおく）
      const fromAuto = plan.auto.map((m) => {
        const row = rows.find((r) => String(r.id) === String(m.id));
        return { id: m.id, itemName: m.itemName, box: otherBoxOf(row), from: m.from, candidates: [], suggested: [m.to] };
      });
      const list = groupReview([...fromAuto, ...plan.review]).map((g) => ({ ...g, candidates: candidatesInBox(g.box) }));
      setGroups(list);
      setChoices(Object.fromEntries(list.filter((g) => g.suggested.length === 1).map((g) => [g.key, productKey(g.suggested[0])])));
      setStatus('ready');
    },
    [userId]
  );

  const reload = useCallback(async () => {
    applyLoaded(await fetchMyOtherItems());
  }, [applyLoaded]);

  useEffect(() => {
    let cancelled = false;
    fetchMyOtherItems().then((result) => {
      if (!cancelled) applyLoaded(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoaded]);

  const selected = useMemo(() => groups.filter((g) => choices[g.key]), [groups, choices]);
  const selectedCount = selected.reduce((sum, g) => sum + g.ids.length, 0);

  const handleApply = async () => {
    const changes = [];
    selected.forEach((g) => {
      const path = g.candidates.find((c) => productKey(c) === choices[g.key]);
      if (!path) return;
      g.ids.forEach((id) => changes.push({ id, main: path.main, category: path.category, sub: path.sub, product: path.product }));
    });
    if (changes.length === 0) return;
    setSaving(true);
    const result = await applyItemCategories(changes);
    setSaving(false);
    setMessage(
      result.success
        ? { type: 'success', text: `${result.doneIds.length} 件の商品を、移しました。` }
        : { type: 'error', text: `${result.failedIds.length} 件を移せませんでした。もう一度お試しください。` }
    );
    reload();
  };

  const keepAsOther = (g) => {
    addSkipIds(userId, g.ids);
    setGroups((prev) => prev.filter((x) => x.key !== g.key));
    setChoices((prev) => {
      const next = { ...prev };
      delete next[g.key];
      return next;
    });
  };

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">「その他」の商品を見直す</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          「その他」で登録した商品のうち、移せる先がある商品です。移し先を選んで、「移す」を押してください。
          このままでよいものは、「このままにする」を押すと、もう出ません。
        </p>

        {message && (
          <p className={message.type === 'success' ? 'proposal-success' : 'proposal-error proposal-error-box'} role="status">
            {message.text}
          </p>
        )}
        {status === 'loading' && <p className="proposal-message">読み込み中...</p>}
        {status === 'ready' && groups.length === 0 && <p className="proposal-message">見直す商品はありません</p>}

        {status === 'ready' && groups.length > 0 && (
          <ul className="admin-list">
            {groups.map((g) => (
              <li key={g.key} className="proposal-card admin-card">
                <span className="admin-card-title">{g.itemName}</span>
                <span className="proposal-item-path">
                  今: {describeBox(g.box)}
                  {g.ids.length > 1 && ` ／ ${g.ids.length} 件`}
                </span>
                <select
                  className="proposal-input reassign-select"
                  value={choices[g.key] || ''}
                  onChange={(e) => setChoices((prev) => ({ ...prev, [g.key]: e.target.value }))}
                  aria-label={`${g.itemName} の移し先`}
                >
                  <option value="">移し先を選ぶ</option>
                  {g.suggested.length > 1 && (
                    <optgroup label="印字名に含まれている候補">
                      {g.suggested.map((p) => (
                        <option key={`s-${productKey(p)}`} value={productKey(p)}>
                          {p.product}（{formatPath(p)}）
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupBySub(g.candidates).map(([label, paths]) => (
                    <optgroup key={label} label={label}>
                      {paths.map((p) => (
                        <option key={productKey(p)} value={productKey(p)}>
                          {p.product}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <div className="admin-actions">
                  <button type="button" className="admin-reject" onClick={() => keepAsOther(g)}>
                    このままにする
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {status === 'ready' && groups.length > 0 && (
        <div className="reassign-footer">
          <button type="button" className="admin-approve reassign-apply" disabled={saving || selectedCount === 0} onClick={handleApply}>
            {saving ? '移しています...' : `選んだ ${selectedCount} 件を移す`}
          </button>
        </div>
      )}
    </div>
  );
}
