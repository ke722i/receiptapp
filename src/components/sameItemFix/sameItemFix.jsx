import { useState } from 'react';
import './sameItemFix.css';
import { applyItemCategories } from '../../utils/receiptDb';
import { formatPath } from '../../utils/categoryUtils';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { showUndoToast } from '../../utils/undoToast';
import { countAllItems } from '../../utils/sameItemFix';

/**
 * 同じ商品の分類をそろえる（utils/sameItemFix.js の結果を見せて、選んだものだけ直す）
 *  ・「同じ」商品は、最初からチェックが付いている。「似ている」商品は、付いていない（別の商品のこともあるので、ユーザーが選ぶ）
 *  ・直したら、数秒「元に戻す」を出す（押すと、直す前の分類に戻す）
 * @param {{ source, items }[]} groups findSameItemFixes の結果
 * @param {() => void} onClose 閉じたとき（直した・あとで、どちらも）
 * @param {(count: number) => void} [onFixed] 直したとき（件数）
 * @param {string} [title]
 */
export default function SameItemFix({ groups, onClose, onFixed, title = '同じ商品の分類をそろえますか？' }) {
  const [checked, setChecked] = useState(
    () => new Set(groups.flatMap((g) => g.items.filter((i) => i.match === 'same').map((i) => i.id)))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleFix = async () => {
    const changes = [];
    const before = [];
    groups.forEach((g) =>
      g.items.forEach((item) => {
        if (!checked.has(item.id)) return;
        changes.push({ id: item.id, ...g.source.path });
        before.push({ id: item.id, ...item.path });
      })
    );
    if (changes.length === 0) return;
    setBusy(true);
    setError('');
    const result = await applyItemCategories(changes);
    setBusy(false);
    if (result.doneIds.length === 0) {
      setError('直せませんでした。通信の状態を確かめて、もう一度押してください。');
      return;
    }
    const done = new Set(result.doneIds.map(String));
    const undoList = before.filter((b) => done.has(String(b.id)));
    showUndoToast({
      message: result.failedIds.length > 0
        ? `${result.doneIds.length} 件を直しました（${result.failedIds.length} 件は直せませんでした）`
        : `${result.doneIds.length} 件の分類を直しました`,
      onUndo: async () => {
        const undo = await applyItemCategories(undoList);
        showUndoToast({ message: undo.success ? '元に戻しました' : '一部を元に戻せませんでした' });
      },
    });
    if (onFixed) onFixed(result.doneIds.length);
    onClose();
  };

  const total = countAllItems(groups);

  return (
    <div className="same-fix-overlay" onClick={busy ? undefined : onClose}>
      <div className="same-fix-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2 className="same-fix-title">{title}</h2>
        <p className="same-fix-lead">
          前に登録したレシートで、同じ・似た商品が {total} 件、違う分類になっています。直すものにチェックを付けてください。
        </p>

        <div className="same-fix-body">
          {groups.map((g) => (
            <section key={`${g.source.printName}>${formatPath(g.source.path, { withProduct: true })}`} className="same-fix-group">
              <div className="same-fix-target">
                <span className="same-fix-target-label">直す先</span>
                <span className="same-fix-target-name">{g.source.path.product}</span>
                <span className="same-fix-target-path">{formatPath(g.source.path)}</span>
                <span className="same-fix-target-from">「{g.source.printName}」で選んだ分類</span>
              </div>
              <ul className="same-fix-list">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <label className="same-fix-row">
                      <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} disabled={busy} />
                      <span className="same-fix-row-text">
                        <span className="same-fix-row-name">
                          {item.itemName}
                          <span className={`same-fix-badge ${item.match === 'same' ? 'is-same' : ''}`}>
                            {item.match === 'same' ? '同じ商品' : '似ている'}
                          </span>
                        </span>
                        <span className="same-fix-row-meta">
                          {[item.storeName, formatPurchaseDate(item.purchaseDate)].filter(Boolean).join(' ・ ')}
                        </span>
                        <span className="same-fix-row-now">
                          今: {item.path.product || item.path.category || '未選択'}
                          {item.path.main && `（${formatPath(item.path)}）`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {error && <p className="same-fix-error">{error}</p>}

        <div className="same-fix-buttons">
          <button type="button" className="same-fix-button same-fix-later" onClick={onClose} disabled={busy}>
            あとで
          </button>
          <button type="button" className="same-fix-button same-fix-ok" onClick={handleFix} disabled={busy || checked.size === 0}>
            {busy ? '直しています…' : `選んだ ${checked.size} 件を直す`}
          </button>
        </div>
      </div>
    </div>
  );
}
