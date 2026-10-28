import { useState } from 'react';
import Login from './components/login/login';
import Register from './components/register/register';
import Home from './components/home/home';
import Settings from './components/settings/settings';
import ProductDetail from './components/productDetail/productDetail';
import ProductHistoryList from './components/productHistoryList/productHistoryList';
import CameraModal from './components/cameraModal/cameraModal';
import ImageConfirm from './components/imageConfirm/imageConfirm';
import CropImage from './components/cropImage/cropImage';
import ReceiptConfirm from './components/receiptConfirm/receiptConfirm';
import ReceiptSuccess from './components/receiptSuccess/receiptSuccess';
import ReceiptHistoryList from './components/receiptHistoryList/receiptHistoryList';
import ReceiptHistoryDetail from './components/receiptHistoryDetail/receiptHistoryDetail';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedProductName, setSelectedProductName] = useState('牛乳');
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);

  // 商品選択時のハンドラー（Home画面等のアイテムクリック時）
  const handleSelectProduct = (productName) => {
    if (productName) {
      setSelectedProductName(productName);
    }
    setCurrentScreen('productDetail');
  };

  // 削除完了モーダルを閉じて一覧へ遷移
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
          onLoginSuccess={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'register' && (
        <Register
          onNavigateToLogin={() => setCurrentScreen('login')}
          onRegisterSuccess={() => setCurrentScreen('home')}
        />
      )}

      {/* ホーム画面 */}
      {currentScreen === 'home' && (
        <Home
          onLogout={() => setCurrentScreen('login')}
          onNavigateToSettings={() => setCurrentScreen('settings')}
          onNavigateToHistory={() => setCurrentScreen('receiptHistoryList')}
          onNavigateToCategory={handleSelectProduct}
          onSelectProduct={handleSelectProduct}
          onOpenCamera={() => setIsCameraModalOpen(true)}
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

      {/* レシート撮影・登録フロー */}
      {currentScreen === 'imageConfirm' && (
        <ImageConfirm
          imageSrc={selectedImage}
          onBack={() => setCurrentScreen('home')}
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
          imageSrc={selectedImage}
          onBack={() => setCurrentScreen('imageConfirm')}
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

      {/* カメラモーダル */}
      {isCameraModalOpen && (
        <CameraModal
          onClose={() => setIsCameraModalOpen(false)}
          onImageSelected={(img) => {
            setSelectedImage(img);
            setCurrentScreen('imageConfirm');
          }}
        />
      )}

      {/* 画面中央の削除完了モーダル（ブラウザalertの代替） */}
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