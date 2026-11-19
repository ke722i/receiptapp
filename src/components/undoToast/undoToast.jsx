import { useEffect, useState } from 'react';
import './undoToast.css';
import Icon from '../icon/icon';
import { subscribeUndoToast, peekUndoToast, undoToast, closeToast } from '../../utils/undoToast';

/** 画面の下の「元に戻す」つきのお知らせ（App に 1 つだけ置く。出し方は utils/undoToast.js） */
export default function UndoToast({ raised = false }) {
  const [toast, setToast] = useState(peekUndoToast);
  useEffect(() => subscribeUndoToast(setToast), []);
  if (!toast) return null;
  return (
    <div className={`undo-toast ${raised ? 'is-raised' : ''}`} role="status" aria-live="polite" key={toast.id}>
      <span className="undo-toast-message">{toast.message}</span>
      {toast.onUndo && (
        <button type="button" className="undo-toast-undo" onClick={undoToast}>
          <Icon name="undo" size={18} strokeWidth={2} />
          {toast.undoLabel}
        </button>
      )}
      <button type="button" className="undo-toast-close" onClick={closeToast} aria-label="閉じる">
        <Icon name="close" size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
