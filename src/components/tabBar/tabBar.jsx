import './tabBar.css';
import Icon from '../icon/icon';

/**
 * 画面の下に固定するタブ（ホーム・レシート・撮影・店舗・設定）
 *  真ん中の「撮影」は、大きな丸のボタン。親指で届く位置に、よく使う画面をまとめる
 * @param {'home'|'receipts'|'stores'|'settings'} active 今の画面のタブ
 * @param {(tab: string) => void} onSelect 押したタブ（'camera' は撮影）
 */
const TABS = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'receipts', label: 'レシート', icon: 'receipt' },
  { id: 'camera', label: '撮影', icon: 'camera', main: true },
  { id: 'stores', label: '店舗', icon: 'store' },
  { id: 'settings', label: '設定', icon: 'settings' },
];

export default function TabBar({ active, onSelect }) {
  return (
    <nav className="tab-bar" aria-label="メインメニュー">
      {TABS.map((tab) =>
        tab.main ? (
          <button key={tab.id} type="button" className="tab-bar-item tab-bar-main" onClick={() => onSelect(tab.id)}>
            <span className="tab-bar-main-circle">
              <Icon name={tab.icon} size={28} strokeWidth={2} />
            </span>
            <span className="tab-bar-label">{tab.label}</span>
          </button>
        ) : (
          <button
            key={tab.id}
            type="button"
            className={`tab-bar-item ${active === tab.id ? 'is-active' : ''}`}
            aria-current={active === tab.id ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <Icon name={tab.icon} size={24} strokeWidth={active === tab.id ? 2.2 : 1.8} />
            <span className="tab-bar-label">{tab.label}</span>
          </button>
        )
      )}
    </nav>
  );
}
