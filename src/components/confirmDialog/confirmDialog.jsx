import './confirmDialog.css';

/**
 * 大事な操作（登録・削除など）の前に出す確認のポップアップ
 *  見た目は、レシート確認画面の「保存できていません」と同じ
 */
export default function ConfirmDialog({
  title = '確認',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-dialog-overlay" onClick={busy ? undefined : onCancel}>
      <div
        className="confirm-dialog-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="confirm-dialog-title">{title}</h2>
        <p className="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-buttons">
          <button
            type="button"
            className="confirm-dialog-button confirm-dialog-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-button ${danger ? 'confirm-dialog-danger' : 'confirm-dialog-ok'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '処理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
