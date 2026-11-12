import './volumeButton.css';
import { unitPriceText } from '../../utils/volume';

/**
 * レシートの表の、商品の行に付ける容量のボタン（確認画面・レシート詳細）
 *  ・容量が空: 「＋容量」。押すと、その商品の編集画面が、容量の欄にカーソルが入った状態で開く
 *  ・容量あり: 容量（例: 「300g ✎」）。押すと、同じく編集画面が開く。単価が出せれば、下に小さく出す
 */
export default function VolumeButton({ volume, price, onClick, disabled = false }) {
  const unitText = volume ? unitPriceText(price, volume) : '';
  return (
    <span className="volume-button-wrap">
      <button
        type="button"
        className={`volume-button ${volume ? 'has-volume' : 'is-empty'}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={volume ? `容量 ${volume}（押すと変更できます）` : '容量を入れる'}
      >
        {volume ? `${volume} ✎` : '＋容量'}
      </button>
      {unitText && <span className="volume-unit-price">{unitText}</span>}
    </span>
  );
}
