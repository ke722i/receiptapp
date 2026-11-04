import { useState, useEffect } from 'react';
import Login from './components/login/login';
import Register from './components/register/register';
import Home from './components/home/home';
import Settings from './components/settings/settings';
import ProductDetail from './components/productDetail/productDetail';
import ProductHistoryList from './components/productHistoryList/productHistoryList';
import ReceiptScanner from './components/receiptScanner/receiptScanner';
import ImageConfirm from './components/imageConfirm/imageConfirm';
import CropImage from './components/cropImage/cropImage';
import ReceiptConfirm from './components/receiptConfirm/receiptConfirm';
import ReceiptSuccess from './components/receiptSuccess/receiptSuccess';
import ReceiptHistoryList from './components/receiptHistoryList/receiptHistoryList';
import ReceiptHistoryDetail from './components/receiptHistoryDetail/receiptHistoryDetail';

const STORAGE_KEY_VIEW_HISTORY = 'receipt_app_view_history';
const STORAGE_KEY_USER_ID = 'receipt_app_user_id';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedImage, setSelectedImage] = useState(null);
  const [parsedReceiptData, setParsedReceiptData] = useState(null); // AI解析データ用
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState('牛乳');
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);

  // ログインユーザーID（localStorage から復元、初期値 'User_12345'）
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_USER_ID) || 'User_12345';
  });

  // 閲覧履歴（App レベルで管理）
  const [viewHistory, setViewHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VIEW_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_HISTORY, JSON.stringify(viewHistory));
    } catch (err) {
      console.error('Failed to save view history:', err);
    }
  }, [viewHistory]);

  // ログイン成功ハンドラー
  const handleLoginSuccess = (userObj, rawInputUserId) => {
    const extractedId =
      rawInputUserId ||
      userObj?.user_metadata?.user_id ||
      userObj?.email?.split('@')[0] ||
      'User_12345';

    setUserId(extractedId);
    localStorage.setItem(STORAGE_KEY_USER_ID, extractedId);
    setCurrentScreen('home');
  };

  // 新規登録成功ハンドラー
  const handleRegisterSuccess = (userObj, rawInputUserId) => {
    const extractedId =
      rawInputUserId ||
      userObj?.user_metadata?.user_id ||
      userObj?.email?.split('@')[0] ||
      'User_12345';

    setUserId(extractedId);
    localStorage.setItem(STORAGE_KEY_USER_ID, extractedId);
    setCurrentScreen('home');
  };

  // 商品選択時のハンドラー（閲覧履歴追加 ＆ 詳細画面遷移）
  const handleSelectProduct = (productName) => {
    if (productName) {
      setSelectedProductName(productName);
      setViewHistory((prev) => {
        const filtered = prev.filter((item) => item.name !== productName);
        const newItem = {
          id: Date.now().toString(),
          name: productName,
          icon: '🛍️',
        };
        return [newItem, ...filtered].slice(0, 5);
      });
    }
    setCurrentScreen('productDetail');
  };

  const handleCloseDeleteSuccess = () => {
    setShowDeleteSuccessModal(false);
    setCurrentScreen('receiptHistoryList');
  };

  return (
    <div className="app">
      {/* ログイン・新規登録 */}
      {currentScreen === 'login' && (
        <Login
          onNavigateToRegister={() => setCurrentScreen('register')}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {currentScreen === 'register' && (
        <Register
          onNavigateToLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )}

      {/* ホーム画面 */}
      {currentScreen === 'home' && (
        <Home
          userId={userId}
          viewHistory={viewHistory}
          onLogout={() => setCurrentScreen('login')}
          onNavigateToSettings={() => setCurrentScreen('settings')}
          onNavigateToHistory={() => setCurrentScreen('receiptHistoryList')}
          onNavigateToCategory={handleSelectProduct}
          onSelectProduct={handleSelectProduct}
          onOpenCamera={() => setCurrentScreen('receiptScanner')} // Scanner画面へ遷移
        />
      )}

      {/* 設定・商品詳細・履歴 */}
      {currentScreen === 'settings' && (
        <Settings
          onBack={() => setCurrentScreen('home')}
          onDeleteAccount={() => setCurrentScreen('login')}
        />
      )}
      {currentScreen === 'productDetail' && (
        <ProductDetail
          productName={selectedProductName}
          onBack={() => setCurrentScreen('home')}
          onViewAllHistory={() => setCurrentScreen('productHistoryList')}
        />
      )}
      {currentScreen === 'productHistoryList' && (
        <ProductHistoryList
          productName={selectedProductName}
          onBack={() => setCurrentScreen('productDetail')}
        />
      )}

      {/* レシートスキャン（撮影・画像選択・解析） */}
      {currentScreen === 'receiptScanner' && (
        <ReceiptScanner
          onBack={() => setCurrentScreen('home')}
          onAnalysisComplete={(data, image) => {
            setParsedReceiptData({ ...data, _scanId: Date.now() });
            setSelectedImage(image);
            setCurrentScreen('receiptConfirm');
          }}
        />
      )}

      {/* レシート確認・保存 */}
      {currentScreen === 'imageConfirm' && (
        <ImageConfirm
          imageSrc={selectedImage}
          onBack={() => setCurrentScreen('receiptScanner')}
          onNavigateToCrop={() => setCurrentScreen('cropImage')}
          onAnalysisComplete={() => setCurrentScreen('receiptConfirm')}
        />
      )}
      {currentScreen === 'cropImage' && (
        <CropImage
          imageSrc={selectedImage}
          onBack={() => setCurrentScreen('imageConfirm')}
          onCropComplete={(cropped) => {
            setSelectedImage(cropped);
            setCurrentScreen('imageConfirm');
          }}
        />
      )}
      {currentScreen === 'receiptConfirm' && (
        <ReceiptConfirm
          key={parsedReceiptData?.purchase_date || 'receipt-confirm-screen'}
          imageSrc={selectedImage}
          parsedData={parsedReceiptData}
          onBack={() => setCurrentScreen('receiptScanner')}
          onSaveComplete={() => setCurrentScreen('receiptSuccess')}
        />
      )}
      {currentScreen === 'receiptSuccess' && (
        <ReceiptSuccess
          onGoHome={() => setCurrentScreen('home')}
        />
      )}

      {/* レシート写真一覧＆詳細 */}
      {currentScreen === 'receiptHistoryList' && (
        <ReceiptHistoryList
          onBack={() => setCurrentScreen('home')}
          onSelectReceiptDetail={(receipt) => {
            setSelectedReceipt(receipt);
            setCurrentScreen('receiptHistoryDetail');
          }}
        />
      )}
      {currentScreen === 'receiptHistoryDetail' && (
        <ReceiptHistoryDetail
          receipt={selectedReceipt}
          onBack={() => setCurrentScreen('receiptHistoryList')}
          onDelete={() => {
            setShowDeleteSuccessModal(true);
          }}
        />
      )}

      {/* 削除完了モーダル */}
      {showDeleteSuccessModal && (
        <div className="custom-modal-overlay" onClick={handleCloseDeleteSuccess}>
          <div className="custom-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="custom-modal-icon">✓</div>
            <h2 className="custom-modal-title">削除完了</h2>
            <p className="custom-modal-message">
              レシートデータを正常に削除しました。
            </p>
            <button
              type="button"
              className="custom-modal-button primary-button"
              onClick={handleCloseDeleteSuccess}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;