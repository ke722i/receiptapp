import { useId } from 'react';
import './storeNameFields.css';
import { canonicalChainName } from '../../utils/storeNameNormalizer';
import { getStoreNotice } from '../../utils/storeNotice';

/**
 * 店名（チェーン）と店舗名（支店）の入力欄。同じ行に、別の枠で並べる。
 *  ・店名は、辞書の店名を候補に出す（「AEON」などの表記は、枠から出るときに辞書の名前にそろえる）
 *  ・初めて入力された名前のときは、枠のすぐ下に吹き出しで知らせる（ポップアップではない。2 回目からは出ない）
 * レシートの確認・登録画面と、レシート詳細の編集で、同じものを使う。
 *
 * @param {{ loaded: boolean, chains: Set<string>, stores: Set<string> }} known useKnownStores の結果
 */
export default function StoreNameFields({ chain, branch, onChainChange, onBranchChange, known }) {
  const listId = useId();
  const notice = getStoreNotice(chain, branch, known);
  const suggestions = known?.chains ? Array.from(known.chains) : [];

  // 店名の枠から出るとき、辞書の表記にそろえる（例: AEON → イオン）
  const handleChainBlur = () => {
    const canonical = canonicalChainName(chain);
    if (canonical !== chain) onChainChange(canonical);
  };

  return (
    <div className="store-fields">
      <div className="store-fields-row">
        <label className="store-field">
          <span className="info-label">店名</span>
          <input
            type="text"
            className="info-input"
            placeholder="例: ディオ"
            value={chain}
            list={listId}
            autoComplete="off"
            onChange={(e) => onChainChange(e.target.value)}
            onBlur={handleChainBlur}
          />
        </label>
        <label className="store-field">
          <span className="info-label">店舗名</span>
          <input
            type="text"
            className="info-input"
            placeholder="例: 和泉店"
            value={branch}
            autoComplete="off"
            onChange={(e) => onBranchChange(e.target.value)}
          />
        </label>
        <datalist id={listId}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {/* 初めて入力された名前: 枠のすぐ下の吹き出し（エラーではないので、赤ではなく黄色） */}
      {notice && (
        <div className="store-notice" role="note">
          <span className="store-notice-icon" aria-hidden="true">💡</span>
          <span className="store-notice-text">{notice.text}</span>
        </div>
      )}
    </div>
  );
}
