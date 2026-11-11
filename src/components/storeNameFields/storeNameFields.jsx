import { useId, useState, useRef, useEffect } from 'react';
import './storeNameFields.css';
import { canonicalChainName } from '../../utils/storeNameNormalizer';
import { getStoreNotice } from '../../utils/storeNotice';

/**
 * 店名（チェーン）と店舗名（支店）の入力欄。同じ行に、別の枠で並べる。
 *  ・店名は、辞書の店名を候補に出す（「AEON」などの表記は、枠から出るときに辞書の名前にそろえる）
 *  ・初めて入力された名前のときは、枠の横に赤い「!」を出す。押すと、小さな吹き出しで注意が出る（もう一度押す・外側を押すと閉じる。2 回目からは「!」も出ない）
 *    吹き出しは、枠の上に重ねて出す（画面の中身は動かさない。レシート画像を隠さない）
 * レシートの確認・登録画面と、レシート詳細の編集で、同じものを使う。
 *
 * @param {{ loaded: boolean, chains: Set<string>, stores: Set<string> }} known useKnownStores の結果
 */
export default function StoreNameFields({ chain, branch, onChainChange, onBranchChange, known }) {
  const listId = useId();
  const notice = getStoreNotice(chain, branch, known);
  const suggestions = known?.chains ? Array.from(known.chains) : [];

  // 「!」を押して、注意を開いているか。別の名前の注意に変わったら、閉じた状態に戻る（開いているのは、押した時の文面）
  const [openText, setOpenText] = useState(null);
  const isNoticeOpen = Boolean(notice) && openText === notice.text;
  const fieldsRef = useRef(null);

  // 開いている間、外側を押したら閉じる
  useEffect(() => {
    if (!isNoticeOpen) return undefined;
    const closeIfOutside = (e) => {
      if (fieldsRef.current && !fieldsRef.current.contains(e.target)) setOpenText(null);
    };
    document.addEventListener('pointerdown', closeIfOutside);
    return () => document.removeEventListener('pointerdown', closeIfOutside);
  }, [isNoticeOpen]);

  // 店名の枠から出るとき、辞書の表記にそろえる（例: AEON → イオン）
  const handleChainBlur = () => {
    const canonical = canonicalChainName(chain);
    if (canonical !== chain) onChainChange(canonical);
  };

  return (
    <div className="store-fields" ref={fieldsRef}>
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
        {/* 初めて入力された名前: 枠の横の、赤い「!」。押すと、注意が出る */}
        {notice && (
          <button
            type="button"
            className={`store-notice-button ${isNoticeOpen ? 'is-open' : ''}`}
            aria-label="初めて入力された名前です。押すと、注意が出ます"
            aria-expanded={isNoticeOpen}
            onClick={() => setOpenText(isNoticeOpen ? null : notice.text)}
          >
            !
          </button>
        )}
        <datalist id={listId}>
          {suggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      {/* 注意の吹き出し（「!」を押したときだけ。入力欄の下に重ねて出し、画面の中身は動かさない） */}
      {isNoticeOpen && (
        <div className="store-notice" role="note">
          <span className="store-notice-text">{notice.text}</span>
        </div>
      )}
    </div>
  );
}
