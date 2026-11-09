import { useState } from 'react';
import './receiptConfirm.css';
import { saveReceiptToDatabase } from '../../utils/receiptDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import { OTHER } from '../../utils/categoryUtils';
import { splitStoreName, joinStoreName } from '../../utils/storeNameNormalizer';
import ReceiptEdit from "../receiptEdit/receiptEdit";
import ReceiptImagePreview from "../receiptImagePreview/receiptImagePreview";
import StoreNameFields from "../storeNameFields/storeNameFields";
import { useKnownStores } from "../storeNameFields/useKnownStores";

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

  // チェックされた項目の ID 一覧
  const [selectedIds, setSelectedIds] = useState([]);
  // 編集モーダルの開閉状態
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // 全選択・全解除トグル
  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  // 編集ボタン押下時の処理
  const handleOpenEditModal = () => {
    if (selectedIds.length === 0) return;
    setIsEditModalOpen(true);
  };

  // 編集画面からの保存結果を反映
  const handleSaveEditedItems = (updatedSelectedItems) => {
    setItems((prev) =>
      prev.map((item) => {
        const updated = updatedSelectedItems.find((u) => u.id === item.id);
        // 編集画面は大・中・小・商品名をまとめて整合させて返すので、そのまま上書き
        return updated ? { ...item, ...updated } : item;
      })
    );
    // 編集完了後は選択を解除
    setSelectedIds([]);
  };

  // DB登録処理
  // DB登録処理
  const handleRegisterToDatabase = async () => {
    setErrorMessage('');

    // 店舗名だけ入れて、店名が空だと、店舗別の集計がずれるので止める
    if (!storeChain.trim() && storeBranch.trim()) {
      setErrorMessage('店名を入力してください。');
      return;
    }

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
      price: item.price,
      is_discount: item.isDiscount,
    }));

    const result = await saveReceiptToDatabase(receiptData, itemsData);
    setIsSaving(false);

    if (result.success) {
      if (onSaveComplete) onSaveComplete();
    } else {
      setErrorMessage(result.error);
    }
  };

  // チェック中のアイテムのみを抽出
  const selectedItemsToEdit = items.filter((item) => selectedIds.includes(item.id));

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

      <main className="receipt-confirm-main">
        {errorMessage && (
          <div style={{ color: '#c62828', backgroundColor: '#ffebee', padding: '10px', borderRadius: '8px', fontSize: '13px' }}>
            {errorMessage}
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
          <button
            type="button"
            className="edit-cell-button"
            onClick={handleOpenEditModal}
            disabled={selectedIds.length === 0}
          >
            選択した商品を編集
          </button>
        </div>

        <section className="table-wrapper">
          <table className="receipt-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedIds.length === items.length}
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
                  <td colSpan="5" style={{ textAlign: 'center', color: '#888', padding: '16px' }}>
                    抽出された商品がありません
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => handleToggleCheck(item.id)}
                      />
                    </td>
                    <td className="item-name-cell">
                      {item.printName}
                      {item.volume && <div className="item-volume">{item.volume}</div>}
                    </td>
                    <td className="price-cell">{item.price}円</td>
                    <td className="category-cell">
                      {/* 大分類がその他なら中分類もその他なので、大分類の表示は省く */}
                      {item.mainCategory && item.mainCategory !== OTHER && (
                        <div style={{ fontSize: '10px', color: '#999999' }}>{item.mainCategory}</div>
                      )}
                      {item.category}
                      {item.productName && (
                        <div className="product-label">{item.productName}</div>
                      )}
                    </td>
                    <td className="discount-cell">
                      {item.isDiscount ? <span className="discount-yes">あり</span> : <span className="discount-none">－</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
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
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveEditedItems}
      />

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