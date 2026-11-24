import { useState, useMemo, useRef } from 'react';
import './receiptConfirm.css';
import { saveReceiptToDatabase, hasDuplicateReceipt } from '../../utils/receiptDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { OTHER } from '../../utils/categoryUtils';
import { splitStoreName, joinStoreName } from '../../utils/storeNameNormalizer';
import ReceiptEdit from "../receiptEdit/receiptEdit";
import ReceiptImagePreview from "../receiptImagePreview/receiptImagePreview";
import StoreNameFields from "../storeNameFields/storeNameFields";
import { useKnownStores } from "../storeNameFields/useKnownStores";
import VolumeButton from "../volumeButton/volumeButton";
import ConfirmDialog from "../confirmDialog/confirmDialog";
import { createBlankItem, nextItemId, validateItemsForRegister } from '../../utils/manualReceipt';
import { needsCheckReason } from '../../utils/needsCheck';
import { showUndoToast, closeToast } from '../../utils/undoToast';
import ScanSteps from '../scanSteps/scanSteps';
import { recordCategoryCorrections, pathOf } from '../../utils/categoryCorrectionDb';
import Icon from '../icon/icon';

export default function ReceiptConfirm({ imageSrc, parsedData, onBack, onSaveComplete }) {
  // 店名（チェーン）と店舗名（支店）は別の入力欄。AI が読み取った「ディオ 和泉店」は、2 つに分けて入れる
  const [storeChain, setStoreChain] = useState(() => splitStoreName(parsedData?.store_name).chain);
  const [storeBranch, setStoreBranch] = useState(() => splitStoreName(parsedData?.store_name).branch);
  // 初めて入力された名前かどうかの判定に使う（辞書と、これまでのレシートの店舗名）
  const [knownStores] = useKnownStores();
  const [purchaseDate, setPurchaseDate] = useState(
    () => parsedData?.purchase_date || new Date().toISOString().split('T')[0]
  );

  // 商品リスト State
  const [items, setItems] = useState(() => {
    if (parsedData?.items && parsedData.items.length > 0) {
      return parsedData.items.map((item, idx) => ({
        id: idx + 1,
        printName: item.item_name || item.printName || '',
        // 4階層カテゴリ（商品が決まらない場合は subCategory / productName が空）
        mainCategory: item.main_category || '', // 大分類
        category: item.category || '未選択', // 中分類
        subCategory: item.sub_category || '', // 小分類
        productName: item.product_name || '', // 商品名（極小分類）
        volume: item.volume || '', // 容量（印字されていれば AI が入れる。無ければ空 = 不明）
        price: item.price || 0,
        isDiscount: typeof item.is_discount === 'boolean' ? item.is_discount : !!item.isDiscount,
      }));
    }
    return [];
  });

  // AI が付けた分類（行の id → 印字名と分類）。登録のときに、ユーザーが直した分類と比べて、記録する（管理者が確認して、辞書にする）
  //  ・削除した行は、ここからも消す（あとで「＋ 商品を追加」で同じ id になっても、AI の行と取り違えない）
  //  ・手で入力したレシート（AI の答えが無い）は、記録しない
  const aiOriginals = useRef(
    new Map(items.map((item) => [item.id, { itemName: item.printName, path: pathOf(item) }]))
  );

  // チェックされた項目の ID 一覧
  const [selectedIds, setSelectedIds] = useState([]);
  // 編集モーダルの開閉状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // 「＋容量」から開いた商品（その 1 件だけを、容量の欄にカーソルを入れて開く）。チェックの選択は変えない
  const [volumeEditId, setVolumeEditId] = useState(null);
  // 「＋ 商品を追加」で開いた、新しい商品（保存するまで表には足さない。null = 追加ではない）
  const [draftItem, setDraftItem] = useState(null);
  const [needsOnly, setNeedsOnly] = useState(false); // 未選択・その他の商品だけを出す
  // 同じ店・同じ日付・同じ合計のレシートがすでにあるときの確認ポップアップ
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  // AI で解析できず、手で入力するとき（画像確認の「手動で入力する」から来たとき）
  const isManual = !!parsedData?._manual;

  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  // 未保存のまま戻ろうとしたときの確認ポップアップ
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const handleConfirmLeave = () => {
    setShowLeaveModal(false);
    if (onBack) onBack();
  };

  // チェックボックスのトグル（個別に切り替え）
  const handleToggleCheck = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  // 表に出ている商品の id（「その商品だけ表示」のときは、要確認の商品だけ）
  const filterOn = needsOnly && items.some((item) => needsCheckReason(item));
  const visibleIds = items.filter((item) => !filterOn || needsCheckReason(item)).map((item) => item.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  // 全選択・全解除トグル（表に出ている商品だけ。出ていない商品は、選ばない）
  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // 「その商品だけ表示」を切り替える。出なくなる商品は、選択から外す（見えない商品を、まとめて編集・削除しない）
  const handleToggleNeedsOnly = () => {
    if (!needsOnly && items.some((item) => needsCheckReason(item))) {
      setSelectedIds((prev) => prev.filter((id) => items.some((item) => item.id === id && needsCheckReason(item))));
    }
    setNeedsOnly((v) => !v);
  };

  // 編集ボタン押下時の処理
  const handleOpenEditModal = () => {
    if (selectedIds.length === 0) return;
    setVolumeEditId(null);
    setDraftItem(null);
    setIsEditModalOpen(true);
  };

  // 商品の行の「＋容量」（または容量）を押したとき: その商品だけの編集画面を開く
  const handleOpenVolumeEdit = (id) => {
    setDraftItem(null);
    setVolumeEditId(id);
    setIsEditModalOpen(true);
  };

  // 「＋ 商品を追加」: 空の商品で編集画面を開く（印字名の欄にカーソル）
  const handleOpenAddItem = () => {
    setVolumeEditId(null);
    setDraftItem(createBlankItem(nextItemId(items)));
    setIsEditModalOpen(true);
    setErrorMessage('');
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setVolumeEditId(null);
    setDraftItem(null);
  };

  // 選んだ商品を、表から消す（DB にはまだ保存していないので、表から消すだけ）。
  //  確認のポップアップは出さず、すぐ消して、「元に戻す」で消す前の表に戻せる
  const handleDeleteSelected = () => {
    const before = items;
    const count = selectedIds.length;
    const removed = selectedIds
      .filter((id) => aiOriginals.current.has(id))
      .map((id) => [id, aiOriginals.current.get(id)]);
    removed.forEach(([id]) => aiOriginals.current.delete(id));
    setItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
    showUndoToast({
      message: `${count} 件の商品を削除しました`,
      onUndo: () => {
        removed.forEach(([id, original]) => aiOriginals.current.set(id, original));
        setItems(before);
      },
    });
  };

  const needsCount = items.filter((item) => needsCheckReason(item)).length;

  // 編集画面からの保存結果を反映
  const handleSaveEditedItems = (updatedSelectedItems) => {
    if (draftItem) {
      // 追加: 表の最後に足す（チェックの選択は変えない）
      setItems((prev) => [...prev, ...updatedSelectedItems]);
      setDraftItem(null);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        const updated = updatedSelectedItems.find((u) => u.id === item.id);
        // 編集画面は大・中・小・商品名をまとめて整合させて返すので、そのまま上書き
        return updated ? { ...item, ...updated } : item;
      })
    );
    // 編集完了後は選択を解除（「＋容量」から開いたときは、チェックの選択はそのまま）
    if (volumeEditId === null) setSelectedIds([]);
    setVolumeEditId(null);
  };

  // 「この内容で登録する」: 入力の確認 → 二重登録の確認 → 保存
  const handleRegisterToDatabase = async () => {
    setErrorMessage('');
    if (!validateBeforeRegister()) return;

    setIsSaving(true);
    const total = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const isDuplicate = await hasDuplicateReceipt(
      { store_name: joinStoreName(storeChain, storeBranch), purchase_date: purchaseDate },
      total
    );
    setIsSaving(false);
    if (isDuplicate) {
      setShowDuplicateModal(true);
      return;
    }
    await saveReceipt();
  };

  // 入力の確認（問題があれば、画面に出して false）
  const validateBeforeRegister = () => {
    // 商品が無い・印字名が空・値段が 0 円の商品があると、比較に使えないので止める（手で入力したときに起きやすい）
    const itemError = validateItemsForRegister(items);
    if (itemError) {
      setErrorMessage(itemError);
      return false;
    }

    // 店舗名だけ入れて、店名が空だと、店舗別の集計がずれるので止める
    if (!storeChain.trim() && storeBranch.trim()) {
      setErrorMessage('店名を入力してください。');
      return false;
    }
    return true;
  };

  // DB に保存する
  const saveReceipt = async () => {
    setIsSaving(true);

    // 1. 画像URLを含むレシート本体データ（店名と店舗名は、「ディオ 和泉店」の 1 つにつなぐ）
    const receiptData = {
      store_name: joinStoreName(storeChain, storeBranch),
      store_address: parsedData?.store_address || '',
      store_number: parsedData?.store_number || '',
      purchase_date: purchaseDate,
      image_url: imageSrc || '', // ★ レシート画像URLを追加
    };

    // 2. 商品名（item_name）を含む明細データ
    const itemsData = items.map((item) => ({
      item_name: item.printName, // ★ 印字商品名を追加
      main_category: item.mainCategory || null, // 大分類
      category: item.category, // 中分類
      sub_category: item.subCategory || null, // 小分類
      product_name: item.productName || null, // 商品名（該当なしは null）
      volume: item.volume || null, // 容量（不明は null）
      price: Number(item.price),
      is_discount: item.isDiscount,
    }));

    const result = await saveReceiptToDatabase(receiptData, itemsData);
    setIsSaving(false);

    if (result.success) {
      closeToast(); // 登録したあとは、商品の削除を「元に戻す」できない（お知らせを閉じる）
      // AI の分類を直した行を、記録する（待たない。記録できなくても、登録は終わっている）
      if (!isManual) {
        recordCategoryCorrections(
          items
            .filter((item) => aiOriginals.current.has(item.id))
            .map((item) => {
              const original = aiOriginals.current.get(item.id);
              return { itemName: original.itemName, from: original.path, to: pathOf(item) };
            }),
          'confirm'
        );
      }
      if (onSaveComplete) onSaveComplete();
    } else {
      setErrorMessage(result.error);
    }
  };

  // 編集する商品（「＋容量」からは、その 1 件。「選択した商品を編集」からは、チェック中のもの）
  //  「＋ 商品を追加」からは、新しい商品 1 件。配列は開くたびに作り直さない（編集画面が入力を捨てないように）
  const selectedItemsToEdit = useMemo(() => {
    if (draftItem) return [draftItem];
    return volumeEditId !== null
      ? items.filter((item) => item.id === volumeEditId)
      : items.filter((item) => selectedIds.includes(item.id));
  }, [draftItem, volumeEditId, items, selectedIds]);

  return (
    <div className="receipt-confirm-container">
      <header className="receipt-confirm-header">
        <button
          type="button"
          className="back-button"
          onClick={() => setShowLeaveModal(true)}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">レシート内容の確認</h1>
        <div className="header-right-spacer" />
      </header>
      <ScanSteps current={3} />

      <main className="receipt-confirm-main">
        {errorMessage && (
          <div style={{ color: 'var(--danger-dark)', backgroundColor: 'var(--danger-soft)', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
            {errorMessage}
          </div>
        )}

        {isManual && (
          <div className="manual-entry-notice">
            AI で解析できなかったため、手で入力します。店名・購入日を入れ、「＋ 商品を追加」で商品を足してください。
          </div>
        )}

        <section className="receipt-info-card">
          <div className="info-text-group">
            <StoreNameFields
              chain={storeChain}
              branch={storeBranch}
              onChainChange={setStoreChain}
              onBranchChange={setStoreBranch}
              known={knownStores}
            />
            <div className="info-row">
              <span className="info-label">購入日時</span>
              {/* 日付入力欄の表示形式はブラウザの言語で決まるため、「YYYY年MM月DD日」の文字を見せ、
                  本物の入力欄は透明にして上に重ねる（タップすると日付選択が開く） */}
              <div className="date-field">
                <span className="info-input date-display">
                  {formatPurchaseDate(purchaseDate) || '日付を選択'}
                </span>
                <input
                  type="date"
                  className="date-native"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  onClick={(e) => e.target.showPicker?.()}
                  aria-label="購入日時"
                />
              </div>
            </div>
          </div>

          <ReceiptImagePreview src={imageSrc} alt="トリミング画像" />
        </section>

        {/* 編集アクションバー */}
        <div className="selection-bar">
          <span className="text-sm font-medium text-gray-600">
            {selectedIds.length > 0 ? (
              <>
                <span className="selection-label">選択中:</span>{' '}
                <span className="selection-count">{selectedIds.length} 件</span>
              </>
            ) : (
              <>選択中: <b>{selectedIds.length}</b> 件</>
            )}
          </span>
          <div className="selection-actions">
            <button
              type="button"
              className="delete-cell-button"
              onClick={handleDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              削除
            </button>
            <button
              type="button"
              className="edit-cell-button"
              onClick={handleOpenEditModal}
              disabled={selectedIds.length === 0}
            >
              選択した商品を編集
            </button>
          </div>
        </div>

        {/* 直してほしい商品（未選択・その他）。登録の前に、ここを直すと、価格を比べやすくなる */}
        {items.length > 0 && (
          needsCount > 0 ? (
            <div className="needs-check-summary">
              <span>
                <Icon name="alert" size={15} strokeWidth={2.2} /> カテゴリを確認してほしい商品が {needsCount} 件あります
              </span>
              <button
                type="button"
                className={`needs-check-toggle ${needsOnly ? 'is-on' : ''}`}
                aria-pressed={needsOnly}
                onClick={handleToggleNeedsOnly}
              >
                {needsOnly ? 'すべて表示' : 'その商品だけ表示'}
              </button>
            </div>
          ) : (
            <div className="needs-check-summary is-ok">
              <span>
                <Icon name="check" size={15} strokeWidth={2.4} /> すべての商品のカテゴリが決まっています
              </span>
            </div>
          )
        )}

        <section className="table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAll}
                  />
                </th>
                <th>レシート印字名</th>
                <th>値段</th>
                <th>カテゴリ</th>
                <th>値引き</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                    {isManual ? '「＋ 商品を追加」で、商品を入力してください' : '抽出された商品がありません'}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const reason = needsCheckReason(item);
                  if (needsOnly && needsCount > 0 && !reason) return null;
                  return (
                  <tr key={item.id} className={reason && reason !== 'その他' ? 'needs-check' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleCheck(item.id)}
                      />
                    </td>
                    <td className="item-name-cell">
                      {item.printName}
                      {/* 容量: 空なら「＋容量」、あれば容量。押すと、その商品の編集画面（容量の欄）が開く */}
                      <VolumeButton
                        volume={item.volume}
                        price={item.price}
                        onClick={() => handleOpenVolumeEdit(item.id)}
                      />
                    </td>
                    <td className="price-cell">{item.price}円</td>
                    <td className="category-cell">
                      {/* 大分類がその他なら中分類もその他なので、大分類の表示は省く */}
                      {item.mainCategory && item.mainCategory !== OTHER && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.mainCategory}</div>
                      )}
                      {item.category}
                      {item.productName && (
                        <div className="product-label">{item.productName}</div>
                      )}
                      {reason && <span className={`needs-check-badge ${reason === 'その他' ? 'is-other' : ''}`}>{reason}</span>}
                    </td>
                    <td className="discount-cell">
                      {item.isDiscount ? <span className="discount-yes">あり</span> : <span className="discount-none">－</span>}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>

        {/* 商品を手で足す（AI が読み落とした商品にも使える） */}
        <button type="button" className="add-item-button" onClick={handleOpenAddItem}>
          ＋ 商品を追加
        </button>
      </main>

      <footer className="receipt-confirm-footer">
        <button
          type="button"
          className="submit-receipt-button"
          onClick={handleRegisterToDatabase}
          disabled={isSaving}
        >
          {isSaving ? '登録中...' : 'この内容で登録する'}
        </button>
      </footer>

      {/* 新・レシート編集画面（モーダル） */}
      <ReceiptEdit
        isOpen={isEditModalOpen}
        selectedItems={selectedItemsToEdit}
        onClose={handleCloseEditModal}
        onSave={handleSaveEditedItems}
        focusVolume={volumeEditId !== null}
        isAdding={!!draftItem}
      />

      {showDuplicateModal && (
        <ConfirmDialog
          title="同じレシートがあります"
          message="同じ店・同じ購入日・同じ合計金額のレシートが、すでに登録されています。二重に登録していませんか？それでも登録しますか？"
          cancelLabel="やめる"
          confirmLabel="登録する"
          onCancel={() => setShowDuplicateModal(false)}
          onConfirm={() => {
            setShowDuplicateModal(false);
            saveReceipt();
          }}
        />
      )}

      {/* 未保存のまま戻るときの確認ポップアップ */}
      {showLeaveModal && (
        <div className="leave-modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="leave-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="leave-modal-title">確認</h2>
            <p className="leave-modal-message">
              保存できていません<br />戻りますか？
            </p>
            <div className="leave-modal-button-group">
              <button
                type="button"
                className="leave-modal-button leave-modal-cancel"
                onClick={() => setShowLeaveModal(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="leave-modal-button leave-modal-confirm"
                onClick={handleConfirmLeave}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}