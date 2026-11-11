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
import StoreList from './components/storeList/storeList';
import MyStores from './components/myStores/myStores';
import CategoryProposal from './components/categoryProposal/categoryProposal';
import { fetchReceiptById } from './utils/receiptDb';
import { productKey } from './utils/categoryUtils';

const STORAGE_KEY_VIEW_HISTORY = 'receipt_app_view_history';
const STORAGE_KEY_USER_ID = 'receipt_app_user_id';

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedImage, setSelectedImage] = useState(null);
  // トリミング画面の「キャンセル」で戻る画面（撮影直後は撮影画面、画像確認からは画像確認）
  const [cropReturnScreen, setCropReturnScreen] = useState('receiptScanner');
  const [parsedReceiptData, setParsedReceiptData] = useState(null); // AI解析データ用
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  // レシート詳細から「戻る」で帰る画面（レシート一覧 / 商品詳細 / 購入履歴一覧）
  const [receiptDetailBackScreen, setReceiptDetailBackScreen] = useState('receiptHistoryList');
  // マイ店舗の画面から「戻る」で帰る画面（ホームのメニュー / 商品詳細）
  const [myStoresBackScreen, setMyStoresBackScreen] = useState('home');
  // 選択中の商品（{ main, category, sub, product }。同名の商品を場所で区別する）
  const [selectedProduct, setSelectedProduct] = useState(null);

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
  //  path: { main, category, sub, product }
  const handleSelectProduct = (path) => {
    if (!path || !path.product) return;
    setSelectedProduct(path);
    const key = productKey(path);
    setViewHistory((prev) => {
      // 以前の履歴（path を持たない）は名前で比較
      const filtered = prev.filter((item) =>
        item.path ? productKey(item.path) !== key : item.name !== path.product
      );
      const newItem = {
        id: Date.now().toString(),
        name: path.product,
        icon: '🛍️',
        path,
      };
      return [newItem, ...filtered].slice(0, 5);
    });
    setCurrentScreen('productDetail');
  };

  // 商品詳細・購入履歴から、そのレシートの詳細画面へ移動
  const handleOpenReceiptFromProduct = async (receiptId, backScreen) => {
    if (!receiptId) return;
    const result = await fetchReceiptById(receiptId);
    if (!result.success) {
      alert(result.error || 'レシートの取得に失敗しました。');
      return;
    }
    setSelectedReceipt(result.data);
    setReceiptDetailBackScreen(backScreen);
    setCurrentScreen('receiptHistoryDetail');
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
          onNavigateToStores={() => setCurrentScreen('storeList')}
          onNavigateToMyStores={() => {
            setMyStoresBackScreen('home');
            setCurrentScreen('myStores');
          }}
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
          onOpenCategoryProposal={() => setCurrentScreen('categoryProposal')}
        />
      )}
      {currentScreen === 'categoryProposal' && (
        <CategoryProposal onBack={() => setCurrentScreen('settings')} />
      )}
      {currentScreen === 'productDetail' && (
        <ProductDetail
          product={selectedProduct}
          onBack={() => setCurrentScreen('home')}
          onViewAllHistory={() => setCurrentScreen('productHistoryList')}
          onSelectReceipt={(id) => handleOpenReceiptFromProduct(id, 'productDetail')}
          onNavigateToMyStores={() => {
            setMyStoresBackScreen('productDetail');
            setCurrentScreen('myStores');
          }}
        />
      )}
      {/* マイ店舗（登録・削除） */}
      {currentScreen === 'myStores' && (
        <MyStores onBack={() => setCurrentScreen(myStoresBackScreen)} />
      )}
      {currentScreen === 'productHistoryList' && (
        <ProductHistoryList
          product={selectedProduct}
          onBack={() => setCurrentScreen('productDetail')}
          onSelectReceipt={(id) => handleOpenReceiptFromProduct(id, 'productHistoryList')}
        />
      )}

      {/* レシートスキャン（画像選択・カメラ撮影） */}
      {currentScreen === 'receiptScanner' && (
        <ReceiptScanner
          onBack={() => setCurrentScreen('home')}
          // 画像が選択/撮影されたら直接 CropImage（トリミング画面）へ遷移！
          onImageSelected={(image) => {
            setSelectedImage(image);
            setCropReturnScreen('receiptScanner'); // 撮影直後のトリミングでキャンセル → 撮影画面へ
            setCurrentScreen('cropImage');
          }}
        />
      )}

      {/* STEP 1: トリミング画面（撮影・選択後に自動表示） */}
      {currentScreen === 'cropImage' && (
        <CropImage
          imageSrc={selectedImage}
          onCancel={() => setCurrentScreen(cropReturnScreen)}
          onCropComplete={(croppedImage) => {
            setSelectedImage(croppedImage); // 切り抜いた安全な画像で更新
            setCurrentScreen('imageConfirm'); // 画像確認・分析画面へ進む
          }}
        />
      )}

      {/* STEP 2: 画像確認・Gemini AI 分析実行画面 */}
      {currentScreen === 'imageConfirm' && (
        <ImageConfirm
          imageSrc={selectedImage}
          onCancel={() => setCurrentScreen('receiptScanner')} // キャンセル → 撮影画面へ
          onNavigateToCrop={() => {
            // 再調整したい場合。トリミングでキャンセルしたらこの画面に戻る
            setCropReturnScreen('imageConfirm');
            setCurrentScreen('cropImage');
          }}
          onAnalysisComplete={({ parsedData, compressedImage }) => {
            setParsedReceiptData({ ...parsedData, _scanId: Date.now() });
            if (compressedImage) setSelectedImage(compressedImage);
            setCurrentScreen('receiptConfirm');
          }}
        />
      )}

      {/* STEP 3: レシート解析結果の確認・データ保存 */}
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
            setReceiptDetailBackScreen('receiptHistoryList');
            setCurrentScreen('receiptHistoryDetail');
          }}
        />
      )}
      {/* 店舗別（同じチェーンをまとめて表示） */}
      {currentScreen === 'storeList' && (
        <StoreList
          onBack={() => setCurrentScreen('home')}
          onSelectReceiptDetail={(receipt) => {
            setSelectedReceipt(receipt);
            setReceiptDetailBackScreen('storeList');
            setCurrentScreen('receiptHistoryDetail');
          }}
        />
      )}
      {currentScreen === 'receiptHistoryDetail' && (
        <ReceiptHistoryDetail
          receipt={selectedReceipt}
          onBack={() => setCurrentScreen(receiptDetailBackScreen)}
          onUpdate={setSelectedReceipt} // 編集して保存した内容を、親が持つレシートにも反映
        />
      )}
    </div>
  );
}

export default App;