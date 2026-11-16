import './announcementPopup.css';
import { formatDateTime } from '../../utils/announcements';

/**
 * 重要度「高」のお知らせ（メンテナンスの時間など）。ログインしている間、どの画面の上にも出す
 *  ・「OK」を押すまで残る（外側を押しても閉じない）。押したら、その人には、もう出ない（内容が直されたら、もう一度出る）
 *  ・期限を過ぎたものは、DB が返さないので、出ない
 */
export default function AnnouncementPopup({ announcement: a, onConfirm }) {
  return (
    <div className="ann-popup-overlay">
      <div className="ann-popup-card" role="alertdialog" aria-modal="true" aria-labelledby="ann-popup-title">
        <span className="ann-popup-icon" aria-hidden="true">⚠️</span>
        <p className="ann-popup-label">重要なお知らせ</p>
        <h2 id="ann-popup-title" className="ann-popup-title">{a.title}</h2>
        {a.body && <p className="ann-popup-body">{a.body}</p>}
        {a.ends_at && <p className="ann-popup-ends">{formatDateTime(a.ends_at)} まで表示</p>}
        <button type="button" className="ann-popup-ok" onClick={onConfirm}>
          OK
        </button>
      </div>
    </div>
  );
}
