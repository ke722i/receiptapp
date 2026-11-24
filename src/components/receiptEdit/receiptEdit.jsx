import { useState, useEffect } from 'react';
import './receiptEdit.css';
import {
  OTHER,
  getMainCategories,
  getMidCategories,
  getSubCategories,
  getProducts,
  applyCategoryChange,
} from '../../utils/categoryUtils';
import { parseVolume, composeVolume, isValidAmount, unitsForItem, defaultUnitForItem, unitPriceText } from '../../utils/volume';
import Icon from '../icon/icon';
import CategoryProposal from '../categoryProposal/categoryProposal';
import { getProposalMains, getProposalMids, getProposalSubs } from '../../utils/categoryProposal';

// 容量は、「数の欄＋単位のプルダウン」で入力する。保存されている容量（"300g" など）を、数と単位に分けて持つ
//  ・分けられない容量（「6枚切」など）は volRaw にそのまま残す。数を入れると、新しい容量に置き換わる
const toEditItem = (item) => {
  const parsed = parseVolume(item.volume);
  return {
    ...item,
    volAmount: parsed ? parsed.amount : '',
    volUnit: parsed ? parsed.unit : defaultUnitForItem(item),
    volRaw: parsed ? '' : item.volume || '',
  };
};

// 編集の欄を除いて、容量を 1 つの文字に戻す（空欄は '' = 不明）
const fromEditItem = (item) => {
  const { volAmount, volUnit, volRaw, ...rest } = item;
  return { ...rest, volume: composeVolume(volAmount, volUnit) || volRaw || '' };
};

// 提案の画面に引き継ぐ、今選んでいる分類（選んである階層までを入れ、その下に、新しいものを提案する）
//  大分類だけ → 新しい中分類 ／ 大分類・中分類 → 新しい小分類 ／ 大・中・小 → 新しい商品名
const proposalFormOf = (item) => {
  if (!getProposalMains().includes(item.mainCategory)) return null;
  const main = item.mainCategory;
  if (!getProposalMids(main).includes(item.category)) return { kind: 'category', main };
  if (!getProposalSubs(main, item.category).includes(item.subCategory)) return { kind: 'sub', main, category: item.category };
  return { kind: 'product', main, category: item.category, sub: item.subCategory };
};

export const VOLUME_INPUT_ID = (index) => `edit-volume-${index}`;
export const NAME_INPUT_ID = (index) => `edit-name-${index}`;

/**
 * 商品の編集画面（確認画面・レシート詳細の編集から開く）
 * @param {boolean} [focusVolume] 開いたときに、1 つ目の商品の容量の欄に、カーソルを入れる（「＋容量」から開いたとき）
 * @param {boolean} [isAdding] 新しい商品を足すとき（「＋ 商品を追加」から開いたとき）。見出しを「商品の追加」にし、印字名の欄にカーソルを入れる
 */
export default function ReceiptEdit({ isOpen, selectedItems, onClose, onSave, focusVolume = false, isAdding = false }) {
  const [editItems, setEditItems] = useState(() => (selectedItems || []).map(toEditItem));
  // 入力を捨てるのは、画面を開いたとき・開いたまま別の商品に変わったときだけ。親の画面が描き直されて、
  //  同じ商品の配列が新しく作られただけのときは、入力中の内容をそのまま残す（カテゴリが「選択してください」に戻る不具合の対策）
  const openKeyOf = (open, items) => (open ? `${isAdding ? 'add' : 'edit'}:${(items || []).map((item) => item.id ?? '').join(',')}` : null);
  const [prevOpenKey, setPrevOpenKey] = useState(() => openKeyOf(isOpen, selectedItems));
  const [volumeErrors, setVolumeErrors] = useState({}); // index → エラー文
  const [proposalIndex, setProposalIndex] = useState(null); // カテゴリの提案を開いている商品（index）
  const [proposedTitles, setProposedTitles] = useState({}); // index → 提案した内容（案内に出す）

  // レンダリング時の props 変更検出（useEffect 不要パターン）
  const openKey = openKeyOf(isOpen, selectedItems);
  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey);
    setEditItems((selectedItems || []).map(toEditItem));
    setVolumeErrors({});
    setProposalIndex(null);
    setProposedTitles({});
  }

  // 「＋容量」から開いたときは、容量の欄にカーソルを入れる
  useEffect(() => {
    if (isOpen && focusVolume) document.getElementById(VOLUME_INPUT_ID(0))?.focus();
    if (isOpen && isAdding) document.getElementById(NAME_INPUT_ID(0))?.focus();
  }, [isOpen, focusVolume, isAdding]);

  if (!isOpen) return null;

  const handleChange = (index, field, value) => {
    setEditItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  // カテゴリは 大 → 中 → 小 → 商品名 の順に絞り込む。
  // 上の階層を変えたら下は空に戻し、「その他」を選んだら下は選択不要にする（categoryUtils）
  const handleCategoryChange = (index, level, value) => {
    setEditItems((prev) =>
      prev.map((item, idx) => (idx === index ? applyCategoryChange(item, level, value) : item))
    );
  };

  // 提案を送れたら、この商品は「その他」にして、登録へ進める（すでに分類を選んでいるときは、そのまま）
  const handleProposed = (title) => {
    const index = proposalIndex;
    setProposalIndex(null);
    setProposedTitles((prev) => ({ ...prev, [index]: title }));
    setEditItems((prev) =>
      prev.map((item, idx) => (idx === index && !getMainCategories().includes(item.mainCategory) ? applyCategoryChange(item, 'main', OTHER) : item))
    );
  };

  const handleSave = () => {
    // 容量の数が正しくないものがあれば、保存しない（その欄に案内を出す）
    const errors = {};
    editItems.forEach((item, index) => {
      if (!isValidAmount(item.volAmount)) errors[index] = '数で入れてください（例: 300、0.5、1/2）。';
    });
    setVolumeErrors(errors);
    if (Object.keys(errors).length > 0) {
      document.getElementById(VOLUME_INPUT_ID(Number(Object.keys(errors)[0])))?.focus();
      return;
    }
    // 容量は「数＋単位」の 1 つの文字に戻す（全角は半角に。空欄は '' = 不明）
    onSave(editItems.map(fromEditItem));
    onClose();
  };

  const mainOptions = getMainCategories();

  return (
    <div className="receipt-edit-overlay">
      <div className="receipt-edit-container">
        {/* ヘッダー（他の画面と同じ形：左に戻る、中央にタイトル） */}
        <header className="receipt-edit-header">
          <button type="button" className="receipt-edit-back" onClick={onClose} aria-label="戻る">
            ‹
          </button>
          <h2 className="receipt-edit-title">{isAdding ? '商品の追加' : `商品の編集 (${editItems.length}件)`}</h2>
          <div className="receipt-edit-header-spacer" />
        </header>

        {/* 編集領域（慣性スクロール機能付き） */}
        <div className="receipt-edit-body">
          {editItems.map((item, index) => {
            const midOptions = getMidCategories(item.mainCategory);
            const subOptions = getSubCategories(item.mainCategory, item.category);
            const productOptions = getProducts(item.mainCategory, item.category, item.subCategory);
            // 表に無い値（旧データの「未選択」など）は空として扱う
            const categoryValue = midOptions.includes(item.category) ? item.category : '';
            // 「その他」を選んだ階層より下は選択不要
            const mainIsOther = item.mainCategory === OTHER;
            const midIsOther = mainIsOther || item.category === OTHER;
            const subIsOther = midIsOther || item.subCategory === OTHER;
            const placeholder = (parentIsOther) => (parentIsOther ? '選択不要（その他のため）' : '選択してください');

            return (
              <div key={item.id || index} className="edit-item-card">
                <div className="edit-form-group">
                  <label className="edit-label" htmlFor={NAME_INPUT_ID(index)}>レシート印字名</label>
                  <input
                    id={NAME_INPUT_ID(index)}
                    type="text"
                    className="edit-input"
                    placeholder="例: 明治おいしい牛乳"
                    value={item.printName}
                    onChange={(e) => handleChange(index, 'printName', e.target.value)}
                  />
                </div>

                <div className="edit-form-row">
                  <div className="edit-form-group">
                    <label className="edit-label">値段 (円)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="edit-input"
                      placeholder="例: 198"
                      value={item.price}
                      onChange={(e) => handleChange(index, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                    />
                  </div>

                  <div className="edit-form-group">
                    <label className="edit-label">値引き</label>
                    <select
                      className="edit-select"
                      value={item.isDiscount ? 'true' : 'false'}
                      onChange={(e) => handleChange(index, 'isDiscount', e.target.value === 'true')}
                    >
                      <option value="false">なし</option>
                      <option value="true">あり</option>
                    </select>
                  </div>
                </div>

                {/* 容量（レシートに印字されていれば自動で入る。無ければ任意で入力、空欄は「不明」）
                    数の欄＋単位のプルダウン。単位は、どの分類でも全部出す（最初に選んでおく単位だけ、分類から推す） */}
                <div className="edit-form-group">
                  <label className="edit-label" htmlFor={VOLUME_INPUT_ID(index)}>
                    容量（任意<span className="edit-label-gap" />入れると、単価で比べられます）
                  </label>
                  <div className="edit-volume-row">
                    <input
                      id={VOLUME_INPUT_ID(index)}
                      type="text"
                      inputMode="decimal"
                      className={`edit-input edit-volume-amount ${volumeErrors[index] ? 'has-error' : ''}`}
                      value={item.volAmount}
                      maxLength={10}
                      placeholder="例: 300"
                      onChange={(e) => handleChange(index, 'volAmount', e.target.value)}
                    />
                    <select
                      className="edit-select edit-volume-unit"
                      value={item.volUnit}
                      onChange={(e) => handleChange(index, 'volUnit', e.target.value)}
                      aria-label="容量の単位"
                    >
                      {Array.from(new Set([...unitsForItem(item), item.volUnit])).map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                  {volumeErrors[index] && <span className="edit-volume-error">{volumeErrors[index]}</span>}
                  {item.volRaw && !item.volAmount && (
                    <span className="edit-volume-note">
                      今の容量: {item.volRaw}（数と単位に分けられないので、このまま残ります。数を入れると、置き換わります）
                    </span>
                  )}
                  {unitPriceText(item.price, composeVolume(item.volAmount, item.volUnit)) && (
                    <span className="edit-volume-note">
                      単価: {unitPriceText(item.price, composeVolume(item.volAmount, item.volUnit))}
                    </span>
                  )}
                </div>

                {/* カテゴリ（大 → 中 → 小 → 商品名） */}
                <div className="edit-form-group">
                  <label className="edit-label">大分類</label>
                  <select
                    className="edit-select"
                    value={mainOptions.includes(item.mainCategory) ? item.mainCategory : ''}
                    onChange={(e) => handleCategoryChange(index, 'main', e.target.value)}
                  >
                    <option value="">選択してください</option>
                    {mainOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">中分類</label>
                  <select
                    className="edit-select"
                    value={mainIsOther ? '' : categoryValue}
                    disabled={mainIsOther || midOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'category', e.target.value)}
                  >
                    <option value="">{placeholder(mainIsOther)}</option>
                    {midOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">小分類</label>
                  <select
                    className="edit-select"
                    value={!midIsOther && subOptions.includes(item.subCategory) ? item.subCategory : ''}
                    disabled={midIsOther || subOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'sub', e.target.value)}
                  >
                    <option value="">{placeholder(midIsOther)}</option>
                    {subOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="edit-form-group">
                  <label className="edit-label">商品名（価格比較に使います）</label>
                  <select
                    className="edit-select"
                    value={!subIsOther && productOptions.includes(item.productName) ? item.productName : ''}
                    disabled={subIsOther || productOptions.length === 0}
                    onChange={(e) => handleCategoryChange(index, 'product', e.target.value)}
                  >
                    <option value="">{placeholder(subIsOther)}</option>
                    {productOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* ぴったりの分類が無いとき: ここから提案できる（提案すると、この商品は「その他」になり、そのまま登録できる） */}
                {proposedTitles[index] ? (
                  <p className="edit-proposal-done">
                    <Icon name="bulb" size={15} /> {proposedTitles[index]}を提案しました。管理者が確認します。この商品は「その他」で登録できます。
                  </p>
                ) : (
                  <p className="edit-proposal-hint">
                    <Icon name="bulb" size={15} /> ぴったりの分類が無いときは、新しい中分類・小分類・商品名を提案できます。
                    <button type="button" className="edit-proposal-button" onClick={() => setProposalIndex(index)}>
                      カテゴリを提案する
                    </button>
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* スマホ底部固定アクションエリア */}
        <footer className="receipt-edit-footer">
          <button type="button" className="edit-cancel-button" onClick={onClose}>
            キャンセル
          </button>
          <button type="button" className="edit-save-button" onClick={handleSave}>
            変更を確定する
          </button>
        </footer>
      </div>
      {proposalIndex !== null && (
        <div className="receipt-edit-proposal-overlay">
          <CategoryProposal
            embedded
            initialForm={proposalFormOf(editItems[proposalIndex] || {})}
            initialNote={editItems[proposalIndex]?.printName ? `レシート印字名: ${String(editItems[proposalIndex].printName).slice(0, 150)}` : ''}
            onBack={() => setProposalIndex(null)}
            onSubmitted={handleProposed}
          />
        </div>
      )}
    </div>
  );
}