import './updateBanner.css';
import Icon from '../icon/icon';
import { useAppUpdate, reloadToLatest } from '../../utils/appUpdate';

/** 新しい版が公開されたとき、画面の上に出す（押すと、新しい版を読み込む。utils/appUpdate.js） */
export default function UpdateBanner() {
  const available = useAppUpdate();
  if (!available) return null;
  return (
    <div className="update-banner" role="status">
      <Icon name="sparkle" size={18} />
      <span className="update-banner-text">新しい版があります</span>
      <button type="button" className="update-banner-button" onClick={reloadToLatest}>
        更新する
      </button>
    </div>
  );
}
