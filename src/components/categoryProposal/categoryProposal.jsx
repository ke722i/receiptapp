import { useState, useEffect, useMemo } from 'react';
import './categoryProposal.css';
import {
  PROPOSAL_PENDING_LIMIT,
  PROPOSAL_NAME_MAX,
  PROPOSAL_NOTE_MAX,
  PROPOSAL_STATUS_LABELS,
  getProposalMains,
  getProposalMids,
  getProposalSubs,
  getExistingProducts,
  validateProposal,
} from '../../utils/categoryProposal';
import { fetchMyProposals, submitCategoryProposal, withdrawCategoryProposal } from '../../utils/categoryProposalDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const EMPTY_FORM = { main: '', category: '', sub: '', product: '', reading: '', note: '' };
const EXISTING_PREVIEW = 8; // 「この場所にある商品」を、最初に見せる数

// DB の日時（UTC）を、日本時間の日付（YYYY-MM-DD）に
const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
};

/**
 * カテゴリ（商品名）の提案（設定画面から開く）
 *  ・今の表の、大・中・小分類の位置を選んで、表に無い商品名を提案する
 *  ・管理者が確認して、承認したものは、次の表の更新で、全員の画面と AI の解析に追加される
 *  ・自分の提案の状況（承認待ち／承認／見送り）を見られる。承認待ちは取り下げられる
 */
export default function CategoryProposal({ onBack }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [touched, setTouched] = useState(false); // 送るボタンを押したか（押す前は、エラーを出さない）
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text }
  const [proposals, setProposals] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [showAllExisting, setShowAllExisting] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState(null); // 取り下げの確認中の提案
  const [withdrawing, setWithdrawing] = useState(false);

  const loadProposals = async () => {
    setListLoading(true);
    const result = await fetchMyProposals();
    if (result.success) {
      setProposals(result.data);
      setListError('');
    } else {
      setListError(result.error);
    }
    setListLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    fetchMyProposals().then((result) => {
      if (cancelled) return;
      if (result.success) setProposals(result.data);
      else setListError(result.error);
      setListLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const mains = useMemo(() => getProposalMains(), []);
  const mids = useMemo(() => getProposalMids(form.main), [form.main]);
  const subs = useMemo(() => getProposalSubs(form.main, form.category), [form.main, form.category]);
  const placeChosen = form.main && form.category && (subs.length === 0 || form.sub);
  const existing = useMemo(
    () => (placeChosen ? getExistingProducts(form.main, form.category, form.sub || null) : []),
    [placeChosen, form.main, form.category, form.sub]
  );
  const check = useMemo(() => validateProposal(form), [form]);
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const atLimit = pendingCount >= PROPOSAL_PENDING_LIMIT;

  // 上の階層を選び直したら、下は選び直し
  const update = (field, value) => {
    setMessage(null);
    setForm((prev) => {
      if (field === 'main') return { ...prev, main: value, category: '', sub: '' };
      if (field === 'category') return { ...prev, category: value, sub: '' };
      return { ...prev, [field]: value };
    });
    if (field === 'main' || field === 'category' || field === 'sub') setShowAllExisting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setMessage(null);
    if (Object.keys(check.errors).length > 0 || sending || atLimit) return;
    setSending(true);
    const result = await submitCategoryProposal(check.value);
    setSending(false);
    if (!result.success) {
      setMessage({ type: 'error', text: result.error });
      return;
    }
    setMessage({ type: 'success', text: `「${check.value.product}」を提案しました。管理者が確認します。` });
    // 位置は残し、続けて同じ場所に提案しやすくする
    setForm((prev) => ({ ...prev, product: '', reading: '', note: '' }));
    setTouched(false);
    loadProposals();
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    const result = await withdrawCategoryProposal(withdrawTarget.id);
    setWithdrawing(false);
    setWithdrawTarget(null);
    setMessage(
      result.success
        ? { type: 'success', text: `「${withdrawTarget.product_name}」の提案を取り下げました。` }
        : { type: 'error', text: result.error }
    );
    loadProposals();
  };

  const errorOf = (field) => (touched ? check.errors[field] : '');
  const visibleExisting = showAllExisting ? existing : existing.slice(0, EXISTING_PREVIEW);

  return (
    <div className="proposal-container">
      <header className="proposal-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="戻る">
          ‹
        </button>
        <h1 className="header-title">カテゴリの提案</h1>
        <div className="header-right-spacer"></div>
      </header>

      <main className="proposal-main">
        <p className="proposal-intro">
          表に無い商品を、「その他」ではなく、商品名で比べたいときに提案してください。
          管理者が確認して、承認したものは、次の更新で、すべてのユーザーの表に追加されます（すぐには追加されません）。
        </p>

        {/* 提案の入力 */}
        <form className="proposal-card" onSubmit={handleSubmit} noValidate>
          <h2 className="proposal-section-title">新しい商品名を提案する</h2>

          <label className="proposal-field">
            <span className="proposal-label">大分類</span>
            <select className="proposal-input" value={form.main} onChange={(e) => update('main', e.target.value)}>
              <option value="">選んでください</option>
              {mains.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errorOf('main') && <span className="proposal-error">{errorOf('main')}</span>}
          </label>

          <label className="proposal-field">
            <span className="proposal-label">中分類</span>
            <select
              className="proposal-input"
              value={form.category}
              disabled={!form.main}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="">選んでください</option>
              {mids.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {errorOf('category') && <span className="proposal-error">{errorOf('category')}</span>}
          </label>

          {subs.length > 0 && (
            <label className="proposal-field">
              <span className="proposal-label">小分類</span>
              <select className="proposal-input" value={form.sub} onChange={(e) => update('sub', e.target.value)}>
                <option value="">選んでください</option>
                {subs.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              {errorOf('sub') && <span className="proposal-error">{errorOf('sub')}</span>}
            </label>
          )}

          {/* この場所に、今ある商品（重ねて提案しないための参考） */}
          {placeChosen && (
            <div className="proposal-existing">
              <span className="proposal-existing-title">この場所に、今ある商品（{existing.length}）</span>
              <p className="proposal-existing-list">{visibleExisting.join('、') || 'まだありません'}</p>
              {existing.length > EXISTING_PREVIEW && (
                <button type="button" className="proposal-link" onClick={() => setShowAllExisting((v) => !v)}>
                  {showAllExisting ? '閉じる' : `すべて見る（${existing.length}）`}
                </button>
              )}
            </div>
          )}

          <label className="proposal-field">
            <span className="proposal-label">商品名</span>
            <input
              type="text"
              className="proposal-input"
              placeholder="例: ちいかわグミ"
              maxLength={PROPOSAL_NAME_MAX + 10}
              value={form.product}
              onChange={(e) => update('product', e.target.value)}
            />
            {errorOf('product') && <span className="proposal-error">{errorOf('product')}</span>}
          </label>

          <label className="proposal-field">
            <span className="proposal-label">読み仮名（ひらがな。漢字を含む商品名のときは必須）</span>
            <input
              type="text"
              className="proposal-input"
              placeholder="例: ちいかわぐみ"
              maxLength={PROPOSAL_NAME_MAX + 10}
              value={form.reading}
              onChange={(e) => update('reading', e.target.value)}
            />
            {errorOf('reading') && <span className="proposal-error">{errorOf('reading')}</span>}
          </label>

          <label className="proposal-field">
            <span className="proposal-label">メモ（任意。どんな商品か、なぜ必要か）</span>
            <textarea
              className="proposal-input proposal-textarea"
              placeholder="例: よく買うので、店ごとの値段を比べたい"
              maxLength={PROPOSAL_NOTE_MAX + 20}
              rows={3}
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
            />
            {errorOf('note') && <span className="proposal-error">{errorOf('note')}</span>}
          </label>

          {check.warnings.map((text) => (
            <p key={text} className="proposal-warning">
              {text}
            </p>
          ))}

          {message && (
            <p className={message.type === 'success' ? 'proposal-success' : 'proposal-error proposal-error-box'} role="status">
              {message.text}
            </p>
          )}

          <button type="submit" className="proposal-submit" disabled={sending || atLimit}>
            {sending ? '送信中...' : '提案する'}
          </button>
          <p className="proposal-limit-note">
            承認待ち: {pendingCount} / {PROPOSAL_PENDING_LIMIT}件
            {atLimit && '（上限です。結果が出るまで、お待ちください）'}
          </p>
        </form>

        {/* 自分の提案 */}
        <section className="proposal-history">
          <h2 className="proposal-section-title">自分の提案</h2>
          {listLoading && <p className="proposal-message">読み込み中...</p>}
          {!listLoading && listError && <p className="proposal-error">{listError}</p>}
          {!listLoading && !listError && proposals.length === 0 && (
            <p className="proposal-message">まだ提案していません</p>
          )}
          {!listLoading && proposals.length > 0 && (
            <ul className="proposal-list">
              {proposals.map((p) => (
                <li key={p.id} className="proposal-item">
                  <div className="proposal-item-main">
                    <span className="proposal-item-name">{p.product_name}</span>
                    <span className={`proposal-status is-${p.status}`}>{PROPOSAL_STATUS_LABELS[p.status] || p.status}</span>
                  </div>
                  <span className="proposal-item-path">
                    {[p.main_category, p.category, p.sub_category].filter(Boolean).join(' > ')}
                    {p.reading ? `（${p.reading}）` : ''}
                  </span>
                  <span className="proposal-item-date">提案日: {formatPurchaseDate(toJstDate(p.created_at))}</span>
                  {p.admin_note && <span className="proposal-item-admin">運営からのメモ: {p.admin_note}</span>}
                  {p.status === 'pending' && (
                    <button type="button" className="proposal-withdraw" onClick={() => setWithdrawTarget(p)}>
                      取り下げる
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {withdrawTarget && (
        <ConfirmDialog
          title="提案の取り下げ"
          message={`「${withdrawTarget.product_name}」の提案を取り下げますか？`}
          confirmLabel="取り下げる"
          danger
          busy={withdrawing}
          onConfirm={handleWithdraw}
          onCancel={() => setWithdrawTarget(null)}
        />
      )}
    </div>
  );
}
