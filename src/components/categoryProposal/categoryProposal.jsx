import { useState, useEffect, useMemo } from 'react';
import './categoryProposal.css';
import {
  PROPOSAL_PENDING_LIMIT,
  PROPOSAL_NAME_MAX,
  PROPOSAL_NOTE_MAX,
  PROPOSAL_KINDS,
  PROPOSAL_STATUS_LABELS,
  getProposalMains,
  getProposalMids,
  getProposalSubs,
  getProposalProducts,
  validateProposal,
  describeProposal,
} from '../../utils/categoryProposal';
import { fetchMyProposals, submitCategoryProposal, withdrawCategoryProposal } from '../../utils/categoryProposalDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const EMPTY_FORM = { kind: 'category', main: '', category: '', sub: '', product: '', note: '' };

// DB の日時（UTC）を、日本時間の日付（YYYY-MM-DD）に
const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
};

/** 今ある分類の一覧（重ねて提案しないための参考）。最初は 1 行だけ。ボタンを押すと、中身が出る */
function ExistingList({ title, names }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="proposal-existing">
      <button type="button" className="proposal-existing-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>{open ? `${title}（${names.length}）` : `${title}を表示する`}</span>
        <span className="proposal-existing-arrow" aria-hidden="true">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && <p className="proposal-existing-list">{names.join('、') || 'まだありません'}</p>}
    </div>
  );
}

/**
 * カテゴリの提案（設定画面・ホームのお知らせ・商品の編集画面の案内から開く）
 *  ・提案できるのは、新しい中分類／今ある中分類に新しい小分類／今ある小分類に新しい商品名
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

  const isSubKind = form.kind === 'sub';
  const isProductKind = form.kind === 'product';
  const picksMid = isSubKind || isProductKind; // 今ある中分類を選ぶ種類
  const mains = useMemo(() => getProposalMains(), []);
  const mids = useMemo(() => getProposalMids(form.main), [form.main]);
  const subs = useMemo(
    () => (picksMid && form.category ? getProposalSubs(form.main, form.category) : []),
    [picksMid, form.main, form.category]
  );
  const products = useMemo(
    () => (isProductKind && form.sub ? getProposalProducts(form.main, form.category, form.sub) : []),
    [isProductKind, form.main, form.category, form.sub]
  );
  const check = useMemo(() => validateProposal(form), [form]);
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const atLimit = pendingCount >= PROPOSAL_PENDING_LIMIT;

  // 上の項目を選び直したら、下は選び直し。種類を変えたら、名前の欄は空に
  const update = (field, value) => {
    setMessage(null);
    setForm((prev) => {
      const picks = prev.kind === 'sub' || prev.kind === 'product';
      if (field === 'kind') return { ...prev, kind: value, category: '', sub: '', product: '' };
      if (field === 'main' && picks) return { ...prev, main: value, category: '', sub: '', product: '' };
      if (field === 'category' && picks) return { ...prev, category: value, sub: '', product: '' };
      if (field === 'sub' && prev.kind === 'product') return { ...prev, sub: value, product: '' };
      return { ...prev, [field]: value };
    });
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
    const { title } = describeProposal({
      kind: check.value.kind,
      main_category: check.value.main,
      category: check.value.category,
      sub_category: check.value.sub,
      product_name: check.value.product,
    });
    setMessage({ type: 'success', text: `${title}を提案しました。管理者が確認します。` });
    // 種類と大分類は残し、続けて提案しやすくする
    //  商品名の提案は、中分類・小分類も残す（同じ小分類に、続けて足しやすい）
    setForm((prev) => (prev.kind === 'product' ? { ...prev, product: '', note: '' } : { ...prev, category: '', sub: '', note: '' }));
    setTouched(false);
    loadProposals();
  };

  const handleWithdraw = async () => {
    if (!withdrawTarget) return;
    const { title } = describeProposal(withdrawTarget);
    setWithdrawing(true);
    const result = await withdrawCategoryProposal(withdrawTarget.id);
    setWithdrawing(false);
    setWithdrawTarget(null);
    setMessage(result.success ? { type: 'success', text: `${title}の提案を取り下げました。` } : { type: 'error', text: result.error });
    loadProposals();
  };

  const errorOf = (field) => (touched ? check.errors[field] : '');

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
          ぴったりの分類や商品名が無くて「その他」になる商品があるときに、新しい中分類・小分類・商品名を提案してください。
          管理者が確認して、承認したものは、次の更新で、すべてのユーザーの表に追加します（すぐには追加されません）。
        </p>

        {/* 提案の入力 */}
        <form className="proposal-card" onSubmit={handleSubmit} noValidate>
          <h2 className="proposal-section-title">新しいカテゴリ・商品名を提案する</h2>

          <fieldset className="proposal-kinds">
            <legend className="proposal-label">何を追加しますか</legend>
            {PROPOSAL_KINDS.map((k) => (
              <label key={k.value} className={`proposal-kind ${form.kind === k.value ? 'is-selected' : ''}`}>
                <input
                  type="radio"
                  name="proposal-kind"
                  value={k.value}
                  checked={form.kind === k.value}
                  onChange={() => update('kind', k.value)}
                />
                <span>{k.label}</span>
              </label>
            ))}
          </fieldset>

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

          {isProductKind ? (
            <>
              <label className="proposal-field">
                <span className="proposal-label">中分類（今あるもの）</span>
                <select
                  className="proposal-input"
                  value={form.category}
                  disabled={!form.main}
                  onChange={(e) => update('category', e.target.value)}
                >
                  <option value="">{form.main ? '選んでください' : '先に大分類を選んでください'}</option>
                  {mids.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {errorOf('category') && <span className="proposal-error">{errorOf('category')}</span>}
              </label>

              <label className="proposal-field">
                <span className="proposal-label">小分類（今あるもの）</span>
                <select
                  className="proposal-input"
                  value={form.sub}
                  disabled={!form.category}
                  onChange={(e) => update('sub', e.target.value)}
                >
                  <option value="">{form.category ? '選んでください' : '先に中分類を選んでください'}</option>
                  {subs.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {errorOf('sub') && <span className="proposal-error">{errorOf('sub')}</span>}
              </label>

              {form.sub && (
                <ExistingList
                  key={`${form.main}>${form.category}>${form.sub}`}
                  title="この小分類に、今ある商品名"
                  names={products}
                />
              )}

              <label className="proposal-field">
                <span className="proposal-label">新しい商品名</span>
                <input
                  type="text"
                  className="proposal-input"
                  placeholder="例: 冷凍ライチ"
                  maxLength={PROPOSAL_NAME_MAX + 10}
                  value={form.product}
                  onChange={(e) => update('product', e.target.value)}
                />
                {errorOf('product') && <span className="proposal-error">{errorOf('product')}</span>}
              </label>
            </>
          ) : isSubKind ? (
            <>
              <label className="proposal-field">
                <span className="proposal-label">中分類（今あるもの）</span>
                <select
                  className="proposal-input"
                  value={form.category}
                  disabled={!form.main}
                  onChange={(e) => update('category', e.target.value)}
                >
                  <option value="">{form.main ? '選んでください' : '先に大分類を選んでください'}</option>
                  {mids.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {errorOf('category') && <span className="proposal-error">{errorOf('category')}</span>}
              </label>

              {form.category && (
                <ExistingList key={`${form.main}>${form.category}`} title="この中分類に、今ある小分類" names={subs} />
              )}

              <label className="proposal-field">
                <span className="proposal-label">新しい小分類の名前</span>
                <input
                  type="text"
                  className="proposal-input"
                  placeholder="例: ゼリー"
                  maxLength={PROPOSAL_NAME_MAX + 10}
                  value={form.sub}
                  onChange={(e) => update('sub', e.target.value)}
                />
                {errorOf('sub') && <span className="proposal-error">{errorOf('sub')}</span>}
              </label>
            </>
          ) : (
            <>
              {form.main && <ExistingList key={form.main} title={`${form.main}に、今ある中分類`} names={mids} />}

              <label className="proposal-field">
                <span className="proposal-label">新しい中分類の名前</span>
                <input
                  type="text"
                  className="proposal-input"
                  placeholder="例: 園芸用品"
                  maxLength={PROPOSAL_NAME_MAX + 10}
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                />
                {errorOf('category') && <span className="proposal-error">{errorOf('category')}</span>}
              </label>

              <label className="proposal-field">
                <span className="proposal-label">
                  小分類の名前（任意<span className="proposal-label-gap" />中分類の中に作りたいものがあれば）
                </span>
                <input
                  type="text"
                  className="proposal-input"
                  placeholder="例: 肥料・土"
                  maxLength={PROPOSAL_NAME_MAX + 10}
                  value={form.sub}
                  onChange={(e) => update('sub', e.target.value)}
                />
                {errorOf('sub') && <span className="proposal-error">{errorOf('sub')}</span>}
              </label>
            </>
          )}

          <label className="proposal-field">
            <span className="proposal-label">
              どんな商品が入るか（任意<span className="proposal-label-gap" />例を書くと、承認のときの参考になります）
            </span>
            <textarea
              className="proposal-input proposal-textarea"
              placeholder="例: 培養土、肥料、園芸用のはさみ"
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
              {proposals.map((p) => {
                const { title, place } = describeProposal(p);
                return (
                  <li key={p.id} className="proposal-item">
                    <div className="proposal-item-main">
                      <span className="proposal-item-name">{title}</span>
                      <span className={`proposal-status is-${p.status}`}>{PROPOSAL_STATUS_LABELS[p.status] || p.status}</span>
                    </div>
                    <span className="proposal-item-path">{place}</span>
                    {p.note && <span className="proposal-item-path">商品の例: {p.note}</span>}
                    <span className="proposal-item-date">提案日: {formatPurchaseDate(toJstDate(p.created_at))}</span>
                    {p.admin_note && <span className="proposal-item-admin">運営からのメモ: {p.admin_note}</span>}
                    {p.status === 'pending' && (
                      <button type="button" className="proposal-withdraw" onClick={() => setWithdrawTarget(p)}>
                        取り下げる
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      {withdrawTarget && (
        <ConfirmDialog
          title="提案の取り下げ"
          message={`${describeProposal(withdrawTarget).title}の提案を取り下げますか？`}
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
