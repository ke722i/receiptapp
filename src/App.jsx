import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import StoreDetail from './components/storeDetail/storeDetail';
import StoreList from './components/storeList/storeList';
import MyStores from './components/myStores/myStores';
import CategoryProposal from './components/categoryProposal/categoryProposal';
import Notices from './components/notices/notices';
import AdminProposals from './components/adminProposals/adminProposals';
import AdminHome from './components/adminHome/adminHome';
import AdminAnnouncements from './components/adminHome/adminAnnouncements';
import AdminUsers from './components/adminHome/adminUsers';
import {
  fetchAnnouncements,
  announcementKey,
  loadClosedAnnouncements,
  saveClosedAnnouncements,
  loadConfirmedAnnouncements,
  saveConfirmedAnnouncements,
} from './utils/announcements';
import AnnouncementPopup from './components/announcementPopup/announcementPopup';
import ReassignOther from './components/reassignOther/reassignOther';
import { runAutoReassign, undoAutoReassign } from './utils/reassignRun';
import { loadRuns } from './utils/reassignOther';
import { clearReceiptCache } from './utils/receiptCache';
import { checkIsAdmin } from './utils/adminDb';
import { fetchReceiptById } from './utils/receiptDb';
import { isOpenablePath } from './utils/categoryUtils';
import { createManualReceiptData } from './utils/manualReceipt';
import { loadFavorites, saveFavorites, toggleFavorite, isFavorite } from './utils/favorites';
import { decidedNotices, buildNoticeItems, loadReadIds, saveReadIds, unreadIds } from './utils/notices';
import { fetchMyProposals } from './utils/categoryProposalDb';
import TabBar from './components/tabBar/tabBar';
import UndoToast from './components/undoToast/undoToast';

// 下のタブを出す画面と、そのタブ（ほかの画面は、戻るボタンで戻る）
const TAB_OF_SCREEN = {
  home: 'home',
  receiptHistoryList: 'receipts',
  storeList: 'stores',
  settings: 'settings',
};
const SCREEN_OF_TAB = {
  home: 'home',
  receipts: 'receiptHistoryList',
  camera: 'receiptScanner',
  stores: 'storeList',
  settings: 'settings',
};

const STORAGE_KEY_VIEW_HISTORY = 'receipt_app_view_history'; // 閲覧履歴は廃止（お気に入りに変えた）。以前の保存だけを消す
const STORAGE_KEY_USER_ID = 'receipt_app_user_id';
const ANNOUNCEMENT_POLL_MS = 30000; // お知らせを読み直す間隔（ログインしている間）
const STORAGE_KEY_AVATAR = 'receipt_app_avatar'; // 選んだアイコン（すぐ表示するための控え。本体は、アカウントの情報）

function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [selectedImage, setSelectedImage] = useState(null);
  // トリミング画面の「キャンセル」で戻る画面（撮影直後は撮影画面、画像確認からは画像確認）
  const [cropReturnScreen, setCropReturnScreen] = useState('receiptScanner');
  const [parsedReceiptData, setParsedReceiptData] = useState(null); // AI解析データ用
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [selectedStoreName, setSelectedStoreName] = useState(''); // 店舗詳細で開く店舗（「チェーン名 支店名」）
  const [storeListOpenChain, setStoreListOpenChain] = useState(null); // 店舗別一覧で開いているチェーン（詳細から戻っても、開いたまま）
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

  // 管理者が配信したお知らせ（小・中・高）。ログインしている間は、30 秒ごと・アプリに戻ったとき・ホームを開いたときに読む（軽い問い合わせ）
  //  小 = 通知の画面 / 中 = ホームのスライド（「✕」で閉じても、通知の画面に残る） / 高 = ポップアップ（「OK」を押すまで）
  const loggedIn = currentScreen !== 'login' && currentScreen !== 'register';
  const [announcements, setAnnouncements] = useState([]);
  const announcementRequest = useRef(0);
  const refreshAnnouncements = useCallback(() => {
    const requestId = ++announcementRequest.current;
    fetchAnnouncements().then((list) => {
      if (requestId === announcementRequest.current) setAnnouncements(list); // 古い問い合わせの結果は使わない
    });
  }, []);
  useEffect(() => {
    if (!loggedIn) return undefined;
    refreshAnnouncements();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refreshAnnouncements();
    }, ANNOUNCEMENT_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAnnouncements();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loggedIn, refreshAnnouncements]);
  useEffect(() => {
    if (currentScreen === 'home') refreshAnnouncements();
  }, [currentScreen, refreshAnnouncements]);

  const [closedVersion, setClosedVersion] = useState(0);
  const closedAnnouncements = useMemo(() => loadClosedAnnouncements(userId), [userId, closedVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const homeAnnouncements = announcements.filter((a) => a.level === 'mid' && !closedAnnouncements.includes(announcementKey(a)));
  const closeAnnouncement = (a) => {
    saveClosedAnnouncements(userId, [...closedAnnouncements, announcementKey(a)]);
    setClosedVersion((v) => v + 1);
  };
  // 高: 「OK」を押していない、いちばん新しいものを、ポップアップで出す
  const [confirmedVersion, setConfirmedVersion] = useState(0);
  const confirmedAnnouncements = useMemo(() => loadConfirmedAnnouncements(userId), [userId, confirmedVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const popupAnnouncement = loggedIn
    ? announcements.find((a) => a.level === 'high' && !confirmedAnnouncements.includes(announcementKey(a)))
    : null;
  const confirmAnnouncement = (a) => {
    saveConfirmedAnnouncements(userId, [...confirmedAnnouncements, announcementKey(a)]);
    setConfirmedVersion((v) => v + 1);
  };

  // 通知の画面（結果が出たカテゴリの提案 + お知らせの小・中）。ホームを開くたびに、自分の提案を 1 回読む（軽い問い合わせ）。
  //  「読んだ」は端末に覚える。通知の画面を開いただけでは、既読にならない（通知ごとの「既読にする」か、「すべて既読にする」）
  //  中のお知らせは、ホームに出るので、未読に数えない（通知の画面では、履歴として出す）
  const [notices, setNotices] = useState({ status: 'loading', list: [] });
  const [readVersion, setReadVersion] = useState(0);
  const readIds = useMemo(() => loadReadIds(userId), [userId, readVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  // 「その他」の商品を、増えたカテゴリへ自動で移した記録（端末に覚える。通知の画面に出す）
  const [runsVersion, setRunsVersion] = useState(0);
  const reassignRuns = useMemo(() => loadRuns(userId), [userId, runsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const noticeItems = buildNoticeItems(notices.list, announcements, reassignRuns);
  const unreadList = unreadIds(noticeItems, readIds);
  // 通知を、読んだことにする（端末に覚える）。keys は、既読にする通知の key
  const markNoticesRead = (keys) => {
    saveReadIds(userId, [...new Set([...loadReadIds(userId), ...keys])]);
    setReadVersion((v) => v + 1);
  };
  // 通知を、未読に戻す
  const markNoticesUnread = (keys) => {
    saveReadIds(userId, loadReadIds(userId).filter((key) => !keys.includes(key)));
    setReadVersion((v) => v + 1);
  };
  // ホームを開いたとき、カテゴリ表の商品が増えていれば、「その他」の商品を、確実なものだけ自動で移す（1 つの端末で、変わった直後の 1 回）
  const reassignChecked = useRef('');
  useEffect(() => {
    if (currentScreen !== 'home' || !userId || reassignChecked.current === userId) return;
    reassignChecked.current = userId;
    runAutoReassign(userId).then((result) => {
      if (result.moved > 0) setRunsVersion((v) => v + 1);
    });
  }, [currentScreen, userId]);
  const handleUndoReassign = async (run) => {
    const result = await undoAutoReassign(userId, run);
    setRunsVersion((v) => v + 1);
    return result;
  };
  const [reassignBackScreen, setReassignBackScreen] = useState('settings');
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
    });
  }, [currentScreen]);

  // 管理者のアカウントか（ホームを開くたびに確かめる。実際の権限は、DB の関数が確かめる）
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (currentScreen !== 'home') return undefined;
    let cancelled = false;
    checkIsAdmin().then((v) => {
      if (!cancelled) setIsAdmin(v);
    });
    return () => {
      cancelled = true;
    };
  }, [currentScreen]);

  // ログイン成功ハンドラー
  const handleLoginSuccess = (userObj, rawInputUserId) => {
    clearReceiptCache(); // 前のアカウントのレシート（覚えた一覧・画像）を出さない
    const extractedId =
      rawInputUserId ||
      userObj?.user_metadata?.user_id ||
      userObj?.email?.split('@')[0] ||
      'User_12345';

    setUserId(extractedId);
    setIsAdmin(false); // 前のアカウントの印を残さない
    localStorage.setItem(STORAGE_KEY_USER_ID, extractedId);
    changeAvatar(userObj?.user_metadata?.avatar || ''); // 別の端末で選んだアイコンも出る
    // 管理者のアカウントなら、管理者ホームを最初に開く（確かめられなかったときは、一般のホーム）
    checkIsAdmin()
      .catch(() => false)
      .then((admin) => {
        setIsAdmin(admin);
        setCurrentScreen(admin ? 'adminHome' : 'home');
      });
  };

  // 新規登録成功ハンドラー
  const handleRegisterSuccess = (userObj, rawInputUserId) => {
    clearReceiptCache(); // 前のアカウントのレシート（覚えた一覧・画像）を出さない
    const extractedId =
      rawInputUserId ||
      userObj?.user_metadata?.user_id ||
      userObj?.email?.split('@')[0] ||
      'User_12345';

    setUserId(extractedId);
    setIsAdmin(false);
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

  const handleLogout = () => {
    clearReceiptCache();
    setCurrentScreen('login');
  };

  const activeTab = TAB_OF_SCREEN[currentScreen] || null;

  return (
    <div className={`app ${activeTab ? 'has-tabbar' : ''}`}>
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
          favorites={favorites}
          announcements={homeAnnouncements}
          onCloseAnnouncement={closeAnnouncement}
          unreadCount={unreadList.length}
          onOpenNotices={() => {
            setCurrentScreen('notices');
          }}
          onOpenCategoryProposal={() => {
            setProposalBackScreen('home');
            setCurrentScreen('categoryProposal');
          }}
          onNavigateToCategory={handleSelectProduct}
          onSelectProduct={handleSelectProduct}
        />
      )}

      {/* 設定・商品詳細・履歴 */}
      {currentScreen === 'settings' && (
        <Settings
          userId={userId}
          avatarId={avatarId}
          onAvatarChange={changeAvatar}
          onBack={() => setCurrentScreen('home')}
          onLogout={handleLogout}
          onOpenMyStores={() => {
            setMyStoresBackScreen('settings');
            setCurrentScreen('myStores');
          }}
          onOpenAdminHome={() => setCurrentScreen('adminHome')}
          onDeleteAccount={() => setCurrentScreen('login')}
          onOpenCategoryProposal={() => {
            setProposalBackScreen('settings');
            setCurrentScreen('categoryProposal');
          }}
          onOpenReassign={() => {
            setReassignBackScreen('settings');
            setCurrentScreen('reassignOther');
          }}
          isAdmin={isAdmin}
        />
      )}
      {/* 管理者の画面（管理者のアカウントでログインすると、管理者ホームから始まる） */}
      {currentScreen === 'adminHome' && (
        <AdminHome
          userId={userId}
          onOpenProposals={() => setCurrentScreen('adminProposals')}
          onOpenAnnouncements={() => setCurrentScreen('adminAnnouncements')}
          onOpenUsers={() => setCurrentScreen('adminUsers')}
          onOpenGeneralHome={() => setCurrentScreen('home')}
          onLogout={handleLogout}
        />
      )}
      {currentScreen === 'adminProposals' && <AdminProposals onBack={() => setCurrentScreen('adminHome')} />}
      {currentScreen === 'adminAnnouncements' && <AdminAnnouncements onBack={() => setCurrentScreen('adminHome')} />}
      {currentScreen === 'adminUsers' && <AdminUsers currentLoginId={userId} onBack={() => setCurrentScreen('adminHome')} />}
      {currentScreen === 'notices' && (
        <Notices
          notices={noticeItems}
          unreadIds={unreadList}
          onMarkRead={(ids) => markNoticesRead(ids)}
          onMarkUnread={(ids) => markNoticesUnread(ids)}
          onUndoReassign={handleUndoReassign}
          onOpenReassign={() => {
            setReassignBackScreen('notices');
            setCurrentScreen('reassignOther');
          }}
          status={noticeItems.length > 0 ? 'ready' : notices.status}
          onBack={() => setCurrentScreen('home')}
        />
      )}
      {currentScreen === 'reassignOther' && <ReassignOther userId={userId} onBack={() => setCurrentScreen(reassignBackScreen)} />}
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
          onScanAgain={() => setCurrentScreen('receiptScanner')}
        />
      )}

      {/* レシート写真一覧＆詳細 */}
      {currentScreen === 'receiptHistoryList' && (
        <ReceiptHistoryList
          onBack={() => setCurrentScreen('home')}
          onOpenCamera={() => setCurrentScreen('receiptScanner')}
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
          onOpenCamera={() => setCurrentScreen('receiptScanner')}
          onOpenMyStores={() => {
            setMyStoresBackScreen('storeList');
            setCurrentScreen('myStores');
          }}
          openChain={storeListOpenChain}
          onOpenChainChange={setStoreListOpenChain}
          onSelectStore={(name) => {
            setSelectedStoreName(name);
            setCurrentScreen('storeDetail');
          }}
        />
      )}
      {/* 店舗詳細（店舗の情報と、その店舗のレシート） */}
      {currentScreen === 'storeDetail' && (
        <StoreDetail
          storeName={selectedStoreName}
          onBack={() => setCurrentScreen('storeList')}
          onSelectReceiptDetail={(receipt) => {
            setSelectedReceipt(receipt);
            setReceiptDetailBackScreen('storeDetail');
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
      {/* 下のタブ（ホーム・レシート・撮影・店舗・設定の画面だけ） */}
      {activeTab && <TabBar active={activeTab} onSelect={(tab) => setCurrentScreen(SCREEN_OF_TAB[tab])} />}
      {/* 削除・上書きのあとの「元に戻す」 */}
      <UndoToast raised={!!activeTab} />
      {/* 重要度「高」のお知らせ（ログインしている間、どの画面でも出す） */}
      {popupAnnouncement && <AnnouncementPopup announcement={popupAnnouncement} onConfirm={() => confirmAnnouncement(popupAnnouncement)} />}
    </div>
  );
}

export default App;