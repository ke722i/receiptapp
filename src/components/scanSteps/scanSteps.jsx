import './scanSteps.css';
import Icon from '../icon/icon';

/**
 * 撮影から登録までの、今どこにいるか（撮影 → 範囲 → 読み取り → 確認）
 * @param {number} current 今の段階（0〜3）
 */
const STEPS = ['撮影', '範囲', '読み取り', '確認'];

export default function ScanSteps({ current = 0 }) {
  return (
    <ol className="scan-steps" aria-label={`${STEPS.length} 段階中 ${current + 1} 段階目: ${STEPS[current]}`}>
      {STEPS.map((label, i) => {
        const state = i < current ? 'is-done' : i === current ? 'is-current' : '';
        return (
          <li key={label} className={`scan-step ${state}`}>
            <span className="scan-step-dot">{i < current ? <Icon name="check" size={13} strokeWidth={3} /> : i + 1}</span>
            <span className="scan-step-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
