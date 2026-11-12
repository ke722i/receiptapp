import { useState, useEffect, useMemo, useRef } from 'react';
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
import Notices from './components/notices/notices';
import { fetchReceiptById } from './utils/receiptDb';
import { isOpenablePath } from './utils/categoryUtils';
import { createManualReceiptData } from './utils/manualReceipt';
import { loadFavorites, saveFavorites, toggleFavorite, isFavorite } from './utils/favorites';
import { decidedNotices, loadReadIds, saveReadIds, unreadIds } from './utils/notices';
import { fetchMyProposals } from './utils/categoryProposalDb';

const STORAGE_KEY_VIEW_HISTORY = 'receipt_app_view_history'; // 閲覧履歴は廃止（お気に入りに変えた）。以前の保存だけを消す
const STORAGE_KEY_USER_ID = 'receipt_app_user_id';
const STORAGE_KEY_AVATAR = 'receipt_app_avatar'; // 選んだアイコン（すぐ表示するための控え。本体は、アカウントの情報）

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
  const [proposalBackScreen, setProposalBackScreen] = useState('settings'); // カテゴリの提案から戻る画面
  const [productSearchText, setProductSearchText] = useState(''); // 商品詳細を開いたときの、印字名の検索の文字
  // 選択中の商品（{ main, category, sub, product }。同名の商品を場所で区別する）
  const [selectedProduct, setSelectedProduct] = useState(null);

  // ログインユーザーID（localStorage から復元、初期値 'User_12345'）
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_USER_ID) || 'User_12345';
  });

  // ユーザーアイコン（用意された画像の id。選んでいなければ空）。アカウントの情報（user_metadata.avatar）が本体
  const [avatarId, setAvatarId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_AVATAR) || '';
    } catch {
      return '';
    }
  });
  const changeAvatar = (id) => {
    setAvatarId(id || '');
    try {
      if (id) localStorage.setItem(STORAGE_KEY_AVATAR, id);
      else localStorage.removeItem(STORAGE_KEY_AVATAR);
    } catch {
      // 控えを保存できなくても、アカウントの情報には保存されている
    }
  };

  // 以前の閲覧履歴の保存を消す（ホームの「閲覧履歴」は、お気に入りに変えた）
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_VIEW_HISTORY);
    } catch {
      // 消せなくても、使わない
    }
  }, []);

  // お気に入りの商品（端末に保存。ユーザーごと）
  const [favVersion, setFavVersion] = useState(0);
  const favorites = useMemo(() => loadFavorites(userId), [userId, favVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleToggleFavorite = (path) => {
    saveFavorites(userId, toggleFavorite(favorites, path));
    setFavVersion((v) => v + 1);
  };

  // 通知（承認されたカテゴリの提案）。ホームを開くたびに、自分の提案を 1 回読む（軽い問い合わせ）。
  //  「読んだ」は端末に覚える。通知の画面を開いたとき、開く前の「読んだ」を控えて、未読の目印に使う
  const [notices, setNotices] = useState({ status: 'loading', list: [] });
  const [readVersion, setReadVersion] = useState(0);
  const readIds = useMemo(() => loadReadIds(userId), [userId, readVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [readIdsOnOpen, setReadIdsOnOpen] = useState([]);
  const unreadList = unreadIds(notices.list, readIds);
  // 通知を、読んだことにする（端末に覚える）
  const markNoticesRead = (list) => {
    const all = list.map((n) => n.id);
    saveReadIds(userId, [...new Set([...loadReadIds(userId), ...all])]);
    setReadVersion((v) => v + 1);
  };
  const screenRef = useRef(currentScreen);
  useEffect(() => {
    screenRef.current = currentScreen;
  }, [currentScreen]);
  const noticeRequest = useRef(0);
  useEffect(() => {
    if (currentScreen !== 'home') return;
    const requestId = ++noticeRequest.current;
    fetchMyProposals().then((result) => {
      if (requestId !== noticeRequest.current) return; // 古い問い合わせの結果は使わない
      if (!result.success) {
        setNotices({ status: 'error', list: [] });
        return;
      }
      const list = decidedNotices(result.data);
      setNotices({ status: 'ready', list });
      // 読み込み中に通知の画面を開いていたときは、そのまま読んだことにする
      if (screenRef.current === 'notices') markNoticesRead(list);
    });
  }, [currentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン成功ハンドラー
  const handleLoginSuccess = (userObj, rawInputUserId) => {
    const extractedId =
      rawInputUserId ||
      userObj?.user_metadata?.user_id ||
      userObj?.email?.split('@')[0] ||
      'User_12345';

    setUserId(extractedId);
    localStorage.setItem(STORAGE_KEY_USER_ID, extractedId);
    changeAvatar(userObj?.user_metadata?.avatar || ''); // 別の端末で選んだアイコンも出る
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
    changeAvatar(userObj?.user_metadata?.avatar || ''); // 新しいアカウントは、まだ選んでいない（前のアカウントの控えを消す）
    setCurrentScreen('home');
  };

  // 商品選択時のハンドラー（閲覧履歴追加 ＆ 詳細画面遷移）
  //  path: { main, category, sub, product }
  //  options.itemSearch: ホームの検索で、印字名から開いたときの文字（商品詳細の、印字名の検索に入れておく）
  const handleSelectProduct = (path, options = {}) => {
    if (!isOpenablePath(path)) return; // 表の商品、またはホームのカテゴリの「その他」
    setSelectedProduct(path);
    setProductSearchText(options.itemSearch || '');
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
          avatarId={avatarId}
          favorites={favorites}
          unreadCount={notices.status === 'ready' ? unreadList.length : 0}
          onOpenNotices={() => {
            setReadIdsOnOpen(readIds);
            if (notices.status === 'ready') markNoticesRead(notices.list);
            setCurrentScreen('notices');
          }}
          onLogout={() => setCurrentScreen('login')}
          onNavigateToSettings={() => setCurrentScreen('settings')}
          onOpenCategoryProposal={() => {
            setProposalBackScreen('home');
            setCurrentScreen('categoryProposal');
          }}
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
          avatarId={avatarId}
          onAvatarChange={changeAvatar}
          onBack={() => setCurrentScreen('home')}
          onDeleteAccount={() => setCurrentScreen('login')}
          onOpenCategoryProposal={() => {
            setProposalBackScreen('settings');
            setCurrentScreen('categoryProposal');
          }}
        />
      )}
      {currentScreen === 'notices' && (
        <Notices
          notices={notices.list}
          unreadIds={unreadIds(notices.list, readIdsOnOpen)}
          status={notices.status}
          onBack={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'categoryProposal' && (
        <CategoryProposal onBack={() => setCurrentScreen(proposalBackScreen)} />
      )}
      {currentScreen === 'productDetail' && (
        <ProductDetail
          product={selectedProduct}
          initialSearchText={productSearchText}
          isFavorite={isFavorite(favorites, selectedProduct)}
          onToggleFavorite={handleToggleFavorite}
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
          onManualEntry={({ compressedImage }) => {
            // AI で解析できなかったとき: 空の確認画面で、商品を手で入力して登録する
            setParsedReceiptData(createManualReceiptData());
            if (compressedImage) setSelectedImage(compressedImage);
            setCurrentScreen('receiptConfirm');
          }}
        />
      )}

      {/* STEP 3: レシート解析結果の確認・データ保存 */}
      {currentScreen === 'receiptConfirm' && (
        <ReceiptConfirm
          key={parsedReceiptData?._scanId || 'receipt-confirm-screen'}
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