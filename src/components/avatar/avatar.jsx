import './avatar.css';
import { findAvatar } from '../../constants/avatars';

/**
 * ユーザーアイコン（丸く表示）。選んでいなければ（または不明な id なら）、今までの「👤」
 * @param {string} [avatarId] 選んだアイコンの id
 * @param {number} [size] 直径（px）
 */
export default function Avatar({ avatarId, size = 44 }) {
  const avatar = findAvatar(avatarId);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.5 }} aria-hidden="true">
      {avatar ? <img src={avatar.src} alt="" className="avatar-image" draggable="false" /> : '👤'}
    </span>
  );
}
