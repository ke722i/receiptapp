import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { deleteAllReceiptsFromDatabase } from '../../utils/receiptDb';
import { fetchSharePrices, updateSharePrices } from '../../utils/myStoreDb';
import { TERMS, PRIVACY, SHARING_SUMMARY } from '../../constants/legal';
import LegalModal from '../legalModal/legalModal';
import Avatar from '../avatar/avatar';
import { AVATARS } from '../../constants/avatars';
import Icon from '../icon/icon';
import { deleteMyAccount } from '../../utils/accountDb';
import { THEME_OPTIONS, loadTheme, saveTheme } from '../../utils/theme';
import './settings.css';
import '../confirmDialog/confirmDialog.css';

export default function Settings({
  avatarId = '',
  onAvatarChange,
  onBack,
  onLogout,
  onOpenMyStores,
  onOpenAdminHome,
  onDeleteAccount,
  onOpenCategoryProposal,
  onOpenReassign,
  onOpenRecategorize,
  isAdmin = false,
}) {
  const [userInfo, setUserInfo] = useState({ displayName: '読み込み中...' });
  // 価格データの匿名提供（オプトイン。初期はオフ）
  const [sharePrices, setSharePrices] = useState(false);
  const [shareLoading, setShareLoading] = useState(true);
  const [shareSaving, setShareSaving] = useState(false);
  const [shareError, setShareError] = useState('');
  const [legalDoc, setLegalDoc] = useState(null); // 表示中の利用規約 / プライバシーポリシー
  // 表示（自動・ライト・ダーク）。押すと、すぐ切り替わり、端末に覚える（utils/theme.js）
  const [theme, setTheme] = useState(loadTheme);
  const changeTheme = (value) => {
    setTheme(value);
    saveTheme(value);
  };

  useEffect(() => {
    let cancelled = false;
    fetchSharePrices().then((result) => {
      if (cancelled) return;
      if (result.success) setSharePrices(result.data);
      else setShareError(result.error);
      setShareLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleShare = async (next) => {
    setShareError('');
    setShareSaving(true);
    setSharePrices(next);
    const result = await updateSharePrices(next);
    setShareSaving(false);
    if (!result.success) {
      setSharePrices(!next); // 保存できなければ元に戻す
      setShareError(result.error);
    }
  };

  // ユーザーアイコン（用意された画像から選ぶ）。選んだ画像の id を、アカウントの情報（user_metadata.avatar）に保存する
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const handleSelectAvatar = async (id) => {
    if (avatarSaving || id === avatarId) return;
    const previous = avatarId;
    setAvatarError('');
    setAvatarSaving(true);
    if (onAvatarChange) onAvatarChange(id); // すぐ表示を変える
    const { error } = await supabase.auth.updateUser({ data: { avatar: id || null } });
    setAvatarSaving(false);
    if (error) {
      if (onAvatarChange) onAvatarChange(previous); // 保存できなければ元に戻す
      setAvatarError('アイコンを保存できませんでした。通信を確認して、もう一度お試しください。');
    }
  };

  // ログインユーザー情報を Supabase から取得して整形
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // メールアドレスがある場合は @ 以前を取得、無ければ ID を使用
        const rawName = user.email ? user.email.split('@')[0] : user.id;
        
        // @app.internal などの文字列を削除
        const cleanName = rawName.replace('@app.internal', '');

        setUserInfo({
          displayName: cleanName,
        });
      }
    };
    fetchUser();
  }, []);

  // レシートデータ削除ハンドラー（Supabaseの全削除関数を呼び出し）
  const handleDeleteReceipts = async () => {
    if (window.confirm('レシートデータを削除してもよろしいですか？')) {
      const res = await deleteAllReceiptsFromDatabase();
      if (res.success) {
        alert('レシートデータを削除しました。');
      } else {
        alert(`削除に失敗しました: ${res.error}`);
      }
    }
  };

  // アカウントの削除（元に戻せないので、パスワードで本人を確かめてから消す。utils/accountDb.js）
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const closeDelete = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteError('');
  };
  const handleDeleteUserAccount = async (e) => {
    e.preventDefault();
    if (!deletePassword) {
      setDeleteError('パスワードを入力してください。');
      return;
    }
    setDeleteBusy(true);
    setDeleteError('');
    const result = await deleteMyAccount(deletePassword);
    setDeleteBusy(false);
    if (!result.success) {
      setDeleteError(result.error);
      return;
    }
    setDeleteOpen(false);
    if (onDeleteAccount) onDeleteAccount();
  };

  return (
    <div className="settings-container">
      {/* ヘッダー */}
      <header className="settings-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="戻る"
        >
          ‹
        </button>
        <h1 className="header-title">設定</h1>
        <div className="header-right-spacer"></div>
      </header>

      {/* メインコンテンツ */}
      <main className="settings-main">
        {/* 1. アカウント・ユーザー情報 */}
        <section className="settings-section">
          <h2 className="section-header">ユーザー情報</h2>
          <div className="settings-card">
            <div className="settings-row">
              <span className="row-label">ユーザー</span>
              <span className="settings-user">
                <Avatar avatarId={avatarId} size={36} />
                <span className="row-value">{userInfo.displayName}</span>
                {isAdmin && <span className="admin-badge">管理者</span>}
              </span>
            </div>

            {/* アイコン: 用意された画像から選ぶ（押すとすぐ変わる） */}
            <div className="avatar-picker">
              <span className="row-label">アイコン</span>
              <div className="avatar-choices" role="radiogroup" aria-label="アイコンを選ぶ">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!avatarId}
                  aria-label="標準"
                  className={`avatar-choice ${!avatarId ? 'is-selected' : ''}`}
                  disabled={avatarSaving}
                  onClick={() => handleSelectAvatar('')}
                >
                  <Avatar size={52} />
                </button>
                {AVATARS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={avatarId === a.id}
                    aria-label={a.label}
                    className={`avatar-choice ${avatarId === a.id ? 'is-selected' : ''}`}
                    disabled={avatarSaving}
                    onClick={() => handleSelectAvatar(a.id)}
                  >
                    <Avatar avatarId={a.id} size={52} />
                  </button>
                ))}
              </div>
              {avatarError && <p className="settings-error avatar-error">{avatarError}</p>}
            </div>
          </div>
        </section>

        {/* よく使うもの（以前は、ホームの左上のメニューにあったもの） */}
        <section className="settings-section">
          <h2 className="section-header">メニュー</h2>
          <div className="settings-card settings-menu">
            {onOpenMyStores && (
              <button type="button" className="settings-menu-row" onClick={onOpenMyStores}>
                <span className="settings-menu-icon"><Icon name="star" size={20} /></span>
                <span className="settings-menu-text">
                  <span className="settings-menu-label">マイ店舗</span>
                  <span className="settings-menu-sub">よく行く店舗を登録して、価格を比べる</span>
                </span>
                <Icon name="chevronRight" size={18} className="settings-menu-arrow" />
              </button>
            )}
            {/* 管理者のアカウントだけに出る（一般のユーザーの画面とは分ける） */}
            {isAdmin && onOpenAdminHome && (
              <button type="button" className="settings-menu-row" onClick={onOpenAdminHome}>
                <span className="settings-menu-icon is-admin"><Icon name="shield" size={20} /></span>
                <span className="settings-menu-text">
                  <span className="settings-menu-label">管理者ホーム</span>
                  <span className="settings-menu-sub">提案の承認・お知らせ・利用状況</span>
                </span>
                <Icon name="chevronRight" size={18} className="settings-menu-arrow" />
              </button>
            )}
          </div>
        </section>

        {/* 表示の明るさ */}
        <section className="settings-section">
          <h2 className="section-header">表示</h2>
          <div className="settings-card">
            <div className="theme-choices" role="radiogroup" aria-label="表示の明るさ">
              {THEME_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === o.value}
                  className={`theme-choice ${theme === o.value ? 'is-selected' : ''}`}
                  onClick={() => changeTheme(o.value)}
                >
                  <Icon name={o.value === 'dark' ? 'moon' : o.value === 'light' ? 'sun' : 'auto'} size={20} />
                  {o.label}
                </button>
              ))}
            </div>
            <div className="settings-note settings-note-last">
              <p>「自動」は、スマホの設定（ダークモード）に合わせます。</p>
            </div>
          </div>
        </section>

        {/* 2. 価格データの共有（オプトイン） */}
        <section className="settings-section">
          <h2 className="section-header">価格データの共有</h2>
          <div className="settings-card">
            <div className="settings-row">
              <label htmlFor="share-prices" className="row-label">
                価格データを匿名で提供する
              </label>
              <input
                id="share-prices"
                type="checkbox"
                className="checkbox-input"
                checked={sharePrices}
                disabled={shareLoading || shareSaving}
                onChange={(e) => handleToggleShare(e.target.checked)}
              />
            </div>
            <div className="settings-note">
              <p>
                オンにすると、あなたのレシートの{SHARING_SUMMARY.shared.join('・')}が、
                他のユーザーの「マイ店舗の価格比較」に匿名で表示されます。
              </p>
              <p>
                {SHARING_SUMMARY.notShared.join('・')}は表示されません。いつでもオフにできます。
              </p>
              {shareError && <p className="settings-error">{shareError}</p>}
            </div>
            <div className="settings-links">
              <button type="button" className="link-button" onClick={() => setLegalDoc(TERMS)}>
                利用規約
              </button>
              <button type="button" className="link-button" onClick={() => setLegalDoc(PRIVACY)}>
                プライバシーポリシー
              </button>
            </div>
          </div>
        </section>

        {/* カテゴリの提案（表に無い商品名を、管理者に提案する） */}
        <section className="settings-section">
          <h2 className="section-header">カテゴリ</h2>
          <div className="settings-card">
            <button type="button" className="action-button proposal-open-button" onClick={onOpenCategoryProposal}>
              カテゴリを提案する ›
            </button>
            {onOpenReassign && (
              <button type="button" className="action-button proposal-open-button" onClick={onOpenReassign}>
                「その他」の商品を見直す ›
              </button>
            )}
            {onOpenRecategorize && (
              <button type="button" className="action-button proposal-open-button" onClick={onOpenRecategorize}>
                ほかの分類で登録した商品を見直す ›
              </button>
            )}
            <div className="settings-note settings-note-last">
              <p>
                ぴったりの分類が無いときに、新しい中分類・小分類・商品名を提案できます。管理者が確認して、承認したものは、次の更新で、すべてのユーザーの表に追加されます。
                新しい商品名が増えたとき、「その他」で登録した商品のうち、レシートの印字名で決められるものは、自動で移します。決められないものは、「見直す」で選べます。
                「その他」以外の分類（例: 緑茶）で登録した商品のうち、印字名に、新しい商品名（例: ほうじ茶）が入っているものは、自動では移さず、通知と「ほかの分類で登録した商品を見直す」で、移すかを聞きます。
              </p>
            </div>
          </div>
        </section>

        {/* 4. データ・アカウント管理 */}
        <section className="settings-section">
          <h2 className="section-header danger-header">データ・アカウント管理</h2>
          <div className="settings-card">
            <button
              type="button"
              className="action-button warning-button"
              onClick={handleDeleteReceipts}
            >
              レシートデータを削除する
            </button>

            <button
              type="button"
              className="action-button danger-button"
              onClick={() => setDeleteOpen(true)}
            >
              アカウントを削除する
            </button>
          </div>
        </section>

        {onLogout && (
          <button type="button" className="settings-logout" onClick={onLogout}>
            <Icon name="logout" size={20} />
            ログアウト
          </button>
        )}
      </main>

      {legalDoc && <LegalModal doc={legalDoc} onClose={() => setLegalDoc(null)} />}

      {/* アカウントの削除（パスワードで本人を確かめる） */}
      {deleteOpen && (
        <div className="confirm-dialog-overlay" onClick={closeDelete}>
          <form
            className="confirm-dialog-card account-delete-card"
            role="dialog"
            aria-modal="true"
            aria-label="アカウントの削除"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleDeleteUserAccount}
          >
            <h2 className="confirm-dialog-title">アカウントの削除</h2>
            <p className="confirm-dialog-message">
              アカウントと、すべてのレシート・マイ店舗・お気に入りなどのデータを削除します。
              <b>元に戻せません。</b>
              <br />
              続けるときは、パスワードを入力してください。
            </p>
            <input
              type="password"
              className="account-delete-input"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="パスワード"
              autoComplete="current-password"
              aria-label="パスワード"
              disabled={deleteBusy}
              autoFocus
            />
            {deleteError && <p className="account-delete-error" role="alert">{deleteError}</p>}
            <div className="confirm-dialog-buttons">
              <button type="button" className="confirm-dialog-button confirm-dialog-cancel" onClick={closeDelete} disabled={deleteBusy}>
                やめる
              </button>
              <button type="submit" className="confirm-dialog-button confirm-dialog-danger" disabled={deleteBusy}>
                {deleteBusy ? '削除中...' : '削除する'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}