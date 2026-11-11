import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './receiptImagePreview.css';

const OPEN_MS = 300;
const CLOSE_MS = 220;
const EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 拡大表示の動き。サムネイルの位置・大きさから、画面の中央の大きな表示へ「にゅーっと」広げる。
 * 閉じるときは逆向きに、サムネイルへ縮む。
 */
const animateFrame = (thumb, frame, overlay, direction) => {
  if (!thumb || !frame || prefersReducedMotion()) return null;

  const from = thumb.getBoundingClientRect();
  const to = frame.getBoundingClientRect();
  if (!to.width) return null;

  const scale = from.width / to.width;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const small = { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0.4 };
  const big = { transform: 'none', opacity: 1 };

  const opening = direction === 'open';
  const options = { duration: opening ? OPEN_MS : CLOSE_MS, easing: EASING, fill: 'forwards' };

  overlay?.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], options);
  return frame.animate(opening ? [small, big] : [big, small], options);
};

/**
 * レシート画像のサムネイル。画像があるときは、押すと大きく表示する（外側のタップ・Esc で閉じる）。
 * サムネイルの大きさや枠は、使う画面側の CSS（receipt-image-preview など）で決める。
 */
export default function ReceiptImagePreview({ src, alt = 'レシート写真' }) {
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);
  const thumbRef = useRef(null);
  const frameRef = useRef(null);
  const overlayRef = useRef(null);

  // 開くとき: 描画の前に、サムネイルの位置から広がる動きを始める
  useLayoutEffect(() => {
    if (!open) return;
    closingRef.current = false;
    animateFrame(thumbRef.current, frameRef.current, overlayRef.current, 'open');
  }, [open]);

  // 閉じるとき: サムネイルへ縮む動きが終わってから、表示を消す
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const animation = animateFrame(thumbRef.current, frameRef.current, overlayRef.current, 'close');
    if (!animation) {
      setOpen(false);
      return;
    }
    animation.finished.then(() => setOpen(false)).catch(() => setOpen(false));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, close]);

  if (!src) {
    return (
      <div className="receipt-image-preview">
        <div className="no-image-text">No Image</div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        ref={thumbRef}
        className="receipt-image-preview receipt-image-open"
        onClick={() => setOpen(true)}
        aria-label="レシート画像を大きく表示"
      >
        <img src={src} alt={alt} className="thumbnail-image" />
      </button>

      {open && (
        <div
          ref={overlayRef}
          className="image-viewer-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="レシート画像"
          onClick={close}
        >
          {/* クロップ済みの画像の全体を、画面に収めて表示する（スクロールしない）。拡大は、ユーザーが、ピンチ操作などで行う */}
          <div ref={frameRef} className="image-viewer-frame" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={alt} className="image-viewer-image" />
          </div>
        </div>
      )}
    </>
  );
}
