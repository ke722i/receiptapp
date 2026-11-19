import Icon from '../icon/icon';

/** 読み込み中の、空の枠（行の形）。rows: 行の数。thumb: 左に四角を出すか */
export function SkeletonList({ rows = 5, thumb = true }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="読み込み中">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          {thumb && <span className="skeleton-block skeleton-thumb" />}
          <span className="skeleton-lines">
            <span className="skeleton-block skeleton-line" style={{ width: '45%' }} />
            <span className="skeleton-block skeleton-line" style={{ width: `${70 - (i % 3) * 12}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * 空の状態（まだ何も無いとき）の案内。次にすることを、ボタンで示す
 * @param {{ icon: string, title: string, text?: string, actionLabel?: string, onAction?: Function }} props
 */
export function EmptyState({ icon = 'receipt', title, text, actionLabel, onAction, actionIcon }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon name={icon} size={30} />
      </span>
      <p className="empty-state-title">{title}</p>
      {text && <p className="empty-state-text">{text}</p>}
      {actionLabel && onAction && (
        <button type="button" className="empty-state-action" onClick={onAction}>
          {actionIcon && <Icon name={actionIcon} size={18} strokeWidth={2} />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}
