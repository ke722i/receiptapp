import { useState } from 'react';
import './receiptHistoryDetail.css';
import { deleteReceiptFromDatabase, updateReceiptInDatabase } from '../../utils/receiptDb';
import { OTHER } from '../../utils/categoryUtils';
import { formatPurchaseDate, normalizePurchaseDate } from '../../utils/purchaseDate';
import { normalizeVolume } from '../../utils/volume';
import ReceiptImagePreview from '../receiptImagePreview/receiptImagePreview';
import { useReceiptImage, setReceiptHidden } from '../../utils/receiptCache';
import { showUndoToast } from '../../utils/undoToast';
import { needsCheckReason } from '../../utils/needsCheck';
import { recordCategoryCorrections, pathOf } from '../../utils/categoryCorrectionDb';
import Icon from '../icon/icon';
import { splitStoreName, joinStoreName } from '../../utils/storeNameNormalizer';
import ReceiptEdit from '../receiptEdit/receiptEdit';
import VolumeButton from '../volumeButton/volumeButton';
import ConfirmDialog from '../confirmDialog/confirmDialog';
import StoreNameFields from '../storeNameFields/storeNameFields';
import { useKnownStores } from '../storeNameFields/useKnownStores';

// DB の明細（や古い形式の明細）を、編集画面と同じ形（camelCase）にそろえる
const toViewItem = (item) => ({
  id: item.id ?? null,
  printName: item.item_name || item.printName || '',
  price: item.price || 0,
  isDiscount:
    typeof item.is_discount === 'boolean'
      ? item.is_discount
      : Boolean(item.discount && item.discount !== 'なし'),
  mainCategory: item.main_category || '',
  category: item.category || '未選択',
  subCategory: item.sub_category || '',
  productName: item.product_name || '',
  volume: item.volume || '',
});

// 編集画面の形 → DB の列（保存用）
const toDbFields = (item) => ({
  id: item.id,
  item_name: item.printName,
  main_category: item.mainCategory || null,
  category: item.category || '未選択',
  sub_category: item.subCategory || null,
  product_name: item.productName || null,
  price: Number(item.price) || 0,
  is_discount: Boolean(item.isDiscount),
  volume: normalizeVolume(item.volume),
});

// 変更の有無（容量は、そろえた形で比べる）
const isItemChanged = (a, b) =>
  a.printName !== b.printName ||
  Number(a.price) !== Number(b.price) ||
  Boolean(a.isDiscount) !== Boolean(b.isDiscount) ||
  a.mainCategory !== b.mainCategory ||
  a.category !== b.category ||
  a.subCategory !== b.subCategory ||
  a.productName !== b.productName ||
  (normalizeVolume(a.volume) || '') !== (normalizeVolume(b.volume) || '');

export default function ReceiptHistoryDetail({ receipt, onBack, onDelete, onUpdate }) {
  const [errorMessage, setErrorMessage] = useState('');
  const [needsOnly, setNeedsOnly] = useState(false); // 未選択・その他の商品だけを出す

  // 編集（この画面のまま、店舗名・購入日を入力し、商品は既存の編集画面で直す）
  const [savedReceipt, setSavedReceipt] = useState(null); // 保存したあとの内容（画面に反映する）
  const [isEditing, setIsEditing] = useState(false);
  const [draftChain, setDraftChain] = useState(''); // 店名（チェーン）
  const [draftBranch, setDraftBranch] = useState(''); // 店舗名（支店）
  const [draftDate, setDraftDate] = useState('');
  const [draftItems, setDraftItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isItemEditOpen, setIsItemEditOpen] = useState(false);
  // 「＋容量」から開いた商品（その 1 件だけを、容量の欄にカーソルを入れて開く）
  const [volumeEditId, setVolumeEditId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [pendingExit, setPendingExit] = useState(null); // 'cancel' | 'back'（保存していない変更があるとき）
  // 初めて入力された名前かどうかの判定に使う（辞書と、これまでのレシートの店舗名）
  const [knownStores, rememberStore] = useKnownStores();

  // 一覧から開いたときは、画像を持っていないので、ここで読む（読んだ画像は覚えておく。フックは、下の return より前に呼ぶ）
  const imageSrc = useReceiptImage(receipt);

  if (!receipt) return null;

  // 保存した内容があればそれを、無ければ受け取ったレシートを表示する
  const current = savedReceipt && savedReceipt.id === receipt.id ? savedReceipt : receipt;

  // Supabase フィールド名とモック（プロパティ）の互換マッピング
  const storeName = current.store_name || current.storeName || '店舗名未登録';
  const purchaseDate = current.purchase_date || current.purchaseDate || '';
  const savedItems = (current.receipt_items || current.items || []).map(toViewItem);
  const shownItems = isEditing ? draftItems : savedItems;
  const needsCount = shownItems.filter((item) => needsCheckReason(item)).length;

  // 保存していない変更があるか（店名と店舗名は、つないだ形で比べる）
  const originalDate = normalizePurchaseDate(purchaseDate) || '';
  const originalParts = splitStoreName(current.store_name || current.storeName || '');
  const originalStore = joinStoreName(originalParts.chain, originalParts.branch);
  const draftStore = joinStoreName(draftChain, draftBranch);
  const isReceiptChanged = draftStore !== originalStore || draftDate !== originalDate;
  const isDirty =
    isEditing &&
    (isReceiptChanged || draftItems.some((item, index) => isItemChanged(item, savedItems[index])));

  // --- 編集の開始・終了 ---
  const handleStartEdit = () => {
    setErrorMessage('');
    setSaveMessage('');
    setDraftChain(originalParts.chain);
    setDraftBranch(originalParts.branch);
    setDraftDate(originalDate);
    setDraftItems(savedItems);
    setSelectedIds([]);
    setIsEditing(true);
  };

  const exitEdit = () => {
    setIsEditing(false);
    setSelectedIds([]);
    setIsItemEditOpen(false);
    setVolumeEditId(null);
    setPendingExit(null);
    setErrorMessage('');
  };

  // 取り消し・戻る: 保存していない変更があるときだけ確認する
  const handleCancelEdit = () => {
    if (isDirty) setPendingExit('cancel');
    else exitEdit();
  };

  const handleBack = () => {
    if (isDirty) setPendingExit('back');
    else if (onBack) onBack();
  };

  const handleConfirmExit = () => {
    const wasBack = pendingExit === 'back';
    exitEdit();
    if (wasBack && onBack) onBack();
  };

  // --- 商品の選択（確認画面と同じ） ---
  const handleToggleCheck = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    const ids = draftItems.map((item) => item.id).filter((id) => id !== null);
    setSelectedIds(selectedIds.length === ids.length ? [] : ids);
  };

  // 既存の商品の編集画面から戻った内容を、下書きに反映する
  const handleSaveEditedItems = (updatedItems) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        const updated = updatedItems.find((u) => u.id === item.id);
        return updated ? { ...item, ...updated } : item;
      })
    );
    if (volumeEditId === null) setSelectedIds([]);
    setVolumeEditId(null);
  };

  // 商品の行の「＋容量」（または容量）を押したとき: 編集を始めて（まだなら）、その商品だけの編集画面を開く。
  //  保存は、今までどおり、上の「保存」で行う
  const handleOpenVolumeEdit = (id) => {
    if (id === null) return;
    if (!isEditing) handleStartEdit();
    setVolumeEditId(id);
    setIsItemEditOpen(true);
  };

  const handleCloseItemEdit = () => {
    setIsItemEditOpen(false);
    setVolumeEditId(null);
  };

  // --- 保存 ---
  const handleSave = async () => {
    setErrorMessage('');
    if (!draftChain.trim() && draftBranch.trim()) {
      setErrorMessage('店名を入力してください。');
      return;
    }
    if (!draftDate) {
      setErrorMessage('購入日を入力してください。');
      return;
    }

    const receiptChanged = isReceiptChanged;
    const changedItems = draftItems.filter(
      (item, index) => item.id !== null && isItemChanged(item, savedItems[index])
    );

    // 何も変えていなければ、保存せずに閉じる
    if (!receiptChanged && changedItems.length === 0) {
      exitEdit();
      return;
    }

    setIsSaving(true);
    const result = await updateReceiptInDatabase(
      current.id,
      receiptChanged ? { store_name: draftStore, purchase_date: draftDate } : null,
      changedItems.map(toDbFields)
    );
    setIsSaving(false);

    if (!result.success) {
      setErrorMessage(result.error);
      return;
    }

    // 画面（と、親が持つレシート）を、保存した内容にそろえる
    const rows = new Map(changedItems.map((item) => [item.id, toDbFields(item)]));
    const next = {
      ...current,
      store_name: draftStore,
      purchase_date: draftDate,
      receipt_items: (current.receipt_items || current.items || []).map((raw) =>
        rows.has(raw.id) ? { ...raw, ...rows.get(raw.id) } : raw
      ),
    };
    const before = current; // 保存する前の内容（「元に戻す」で使う）
    const beforeById = new Map(savedItems.map((item) => [item.id, item]));
    setSavedReceipt(next);
    rememberStore(draftStore); // 保存した店舗名は、次からは「初めて」ではない
    if (onUpdate) onUpdate(next);
    exitEdit();
    // 上書きは、確認を出さずに保存し、「元に戻す」で前の内容を保存し直せるようにする
    // 分類を直した行（「元に戻す」をしなかったときだけ、記録する。管理者が確認して、辞書にする）
    const corrections = changedItems
      .map((item) => {
        const old = beforeById.get(item.id);
        return old ? { itemName: old.printName, from: pathOf(old), to: pathOf(item) } : null;
      })
      .filter(Boolean);
    showUndoToast({
      message: '保存しました',
      onCommit: () => recordCategoryCorrections(corrections, 'detail'),
      onUndo: async () => {
        const undo = await updateReceiptInDatabase(
          before.id,
          receiptChanged ? { store_name: before.store_name || before.storeName || '', purchase_date: originalDate || purchaseDate } : null,
          changedItems.map((item) => toDbFields(beforeById.get(item.id)))
        );
        if (!undo.success) {
          showUndoToast({ message: `元に戻せませんでした: ${undo.error}` });
          return;
        }
        setSavedReceipt(before);
        if (onUpdate) onUpdate(before);
        showUndoToast({ message: '元に戻しました' });
      },
    });
  };

  // 削除: 確認のポップアップは出さず、すぐ一覧から消して戻る。
  //  数秒のあいだ「元に戻す」を出し、押されなければ DB から消す（utils/undoToast.js）
  const handleDelete = () => {
    const id = current.id;
    setReceiptHidden(id, true);
    showUndoToast({
      message: 'レシートを削除しました',
      onUndo: () => setReceiptHidden(id, false),
      onCommit: async () => {
        const result = await deleteReceiptFromDatabase(id);
        if (!result.success) {
          setReceiptHidden(id, false);
          showUndoToast({ message: `削除できませんでした: ${result.error}` });
        }
      },
    });
    if (onDelete) onDelete(id);
    if (onBack) onBack();
  };

  const selectedItemsToEdit =
    volumeEditId !== null
      ? draftItems.filter((item) => item.id === volumeEditId)
      : draftItems.filter((item) => selectedIds.includes(item.id));
  const editableIds = draftItems.map((item) => item.id).filter((id) => id !== null);

  return (
    <div className="receipt-detail-container">
      {/* 1. ヘッダー */}
      <header className="receipt-detail-header">
        <button type="button" className="back-button" onClick={handleBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">レシート詳細</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="receipt-detail-main">
        {errorMessage && (
          <div style={{ color: 'var(--danger-dark)', backgroundColor: 'var(--danger-soft)', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
            {errorMessage}
          </div>
        )}

        {saveMessage && !isEditing && <div className="detail-save-message">{saveMessage}</div>}

        {/* 2. 店舗情報・日付・画像（右上に編集ボタン） */}
        <section className="receipt-info-card">
          <div className="info-card-actions">
            {isEditing ? (
              <>
                <button
                  type="button"
                  className="info-action-button info-action-cancel"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className="info-action-button info-action-save"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </>
            ) : (
              <button type="button" className="info-action-button info-action-edit" onClick={handleStartEdit}>
                編集
              </button>
            )}
          </div>

          <div className="info-card-body">
            <div className="info-text-group">
              {isEditing ? (
                <StoreNameFields
                  chain={draftChain}
                  branch={draftBranch}
                  onChainChange={setDraftChain}
                  onBranchChange={setDraftBranch}
                  known={knownStores}
                />
              ) : (
                <div className="info-row">
                  <span className="info-label">店舗名</span>
                  <span className="info-value">{storeName}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">購入日時</span>
                {isEditing ? (
                  /* 表示は「YYYY年MM月DD日」の文字、操作は上に重ねた透明な日付入力欄（確認画面と同じ） */
                  <div className="date-field">
                    <span className="info-input date-display">
                      {formatPurchaseDate(draftDate) || '日付を選択'}
                    </span>
                    <input
                      type="date"
                      className="date-native"
                      value={draftDate}
                      onChange={(e) => setDraftDate(e.target.value)}
                      onClick={(e) => e.target.showPicker?.()}
                      aria-label="購入日時"
                    />
                  </div>
                ) : (
                  <span className="info-value">{formatPurchaseDate(purchaseDate)}</span>
                )}
              </div>
            </div>

            <ReceiptImagePreview src={imageSrc} loading={imageSrc === undefined} alt="レシート写真" />
          </div>
        </section>

        {/* 編集中だけ: 商品の選択バー（確認画面と同じ。編集は既存の編集画面を使う） */}
        {isEditing && (
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
            <button
              type="button"
              className="edit-cell-button"
              onClick={() => setIsItemEditOpen(true)}
              disabled={selectedIds.length === 0}
            >
              選択した商品を編集
            </button>
          </div>
        )}

        {/* 直してほしい商品（未選択・その他）の数。押すと、その商品だけを出す */}
        {needsCount > 0 ? (
          <div className="needs-check-summary">
            <span>
              <Icon name="alert" size={15} strokeWidth={2.2} /> 未選択・その他の商品が {needsCount} 件あります
            </span>
            <button
              type="button"
              className={`needs-check-toggle ${needsOnly ? 'is-on' : ''}`}
              aria-pressed={needsOnly}
              onClick={() => setNeedsOnly((v) => !v)}
            >
              {needsOnly ? 'すべて表示' : 'その商品だけ表示'}
            </button>
          </div>
        ) : null}

        {/* 3. 商品リスト表 */}
        <section className="table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                {isEditing && (
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="すべて選択"
                      checked={editableIds.length > 0 && selectedIds.length === editableIds.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                )}
                <th>レシート印字名</th>
                <th>値段</th>
                <th>カテゴリ</th>
                <th>値引き</th>
              </tr>
            </thead>
            <tbody>
              {shownItems.length > 0 ? (
                shownItems.map((item, index) => {
                  const reason = needsCheckReason(item);
                  if (needsOnly && needsCount > 0 && !reason) return null;
                  return (
                  <tr key={item.id ?? index} className={reason && reason !== 'その他' ? 'needs-check' : ''}>
                    {isEditing && (
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`${item.printName || `商品 ${index + 1}`}を選択`}
                          checked={selectedIds.includes(item.id)}
                          disabled={item.id === null}
                          onChange={() => handleToggleCheck(item.id)}
                        />
                      </td>
                    )}
                    <td className="item-name-cell">
                      {item.printName || `商品 ${index + 1}`}
                      {/* 容量: 空なら「＋容量」、あれば容量。押すと、編集を始めて、その商品の編集画面（容量の欄）が開く */}
                      <VolumeButton
                        volume={item.volume}
                        price={item.price}
                        disabled={item.id === null}
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
                      {item.productName && <div className="product-label">{item.productName}</div>}
                      {reason && <span className={`needs-check-badge ${reason === 'その他' ? 'is-other' : ''}`}>{reason}</span>}
                    </td>
                    <td className="discount-cell">
                      {item.isDiscount ? <span className="discount-yes">あり</span> : <span className="discount-none">－</span>}
                    </td>
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={isEditing ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                    明細データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* 4. 目立たない削除ボタン（編集中は出さない） */}
        {!isEditing && (
          <div className="delete-action-area">
            <button type="button" className="subtle-delete-button" onClick={handleDelete}>
              <Icon name="trash" size={16} /> このレシートを削除する
            </button>
          </div>
        )}
      </main>

      {/* 既存の商品の編集画面（確認画面と同じもの） */}
      <ReceiptEdit
        isOpen={isItemEditOpen}
        selectedItems={selectedItemsToEdit}
        onClose={handleCloseItemEdit}
        onSave={handleSaveEditedItems}
        focusVolume={volumeEditId !== null}
      />

      {/* 保存していない変更があるまま、取り消し・戻るをするとき */}
      {pendingExit && (
        <ConfirmDialog
          title="確認"
          message={pendingExit === 'back' ? '保存できていません\n戻りますか？' : '編集した内容を破棄しますか？'}
          confirmLabel={pendingExit === 'back' ? '戻る' : '破棄する'}
          onConfirm={handleConfirmExit}
          onCancel={() => setPendingExit(null)}
        />
      )}

    </div>
  );
}
