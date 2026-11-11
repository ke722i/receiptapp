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
  validateProposal,
  describeProposal,
} from '../../utils/categoryProposal';
import { fetchMyProposals, submitCategoryProposal, withdrawCategoryProposal } from '../../utils/categoryProposalDb';
import { formatPurchaseDate } from '../../utils/purchaseDate';
import ConfirmDialog from '../confirmDialog/confirmDialog';

const EMPTY_FORM = { kind: 'category', main: '', category: '', sub: '', note: '' };
const EXISTING_PREVIEW = 8; // 「今ある分類」を、最初に見せる数

// DB の日時（UTC）を、日本時間の日付（YYYY-MM-DD）に
const toJstDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
};

/** 今ある分類の一覧（重ねて提案しないための参考） */
function ExistingList({ title, names }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? names : names.slice(0, EXISTING_PREVIEW);
  return (
    <div className="proposal-existing">
      <span className="proposal-existing-title">
        {title}（{names.length}）
      </span>
      <p className="proposal-existing-list">{visible.join('、') || 'まだありません'}</p>
      {names.length > EXISTING_PREVIEW && (
        <button type="button" className="proposal-link" onClick={() => setShowAll((v) => !v)}>
          {showAll ? '閉じる' : `すべて見る（${names.length}）`}
        </button>
      )}
    </div>
  );
}

/**
 * カテゴリの提案（設定画面・ホームのお知らせ・商品の編集画面の案内から開く）
 *  ・提案できるのは、カテゴリ（新しい中分類／今ある中分類に新しい小分類）だけ。商品名は AI が決めるので、提案しない
 *  ・管理者が確認して、承認したものは、管理者が商品名を決めて、次の表の更新で、全員の画面と AI の解析に追加される
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
  const mains = useMemo(() => getProposalMains(), []);
  const mids = useMemo(() => getProposalMids(form.main), [form.main]);
  const subs = useMemo(
    () => (isSubKind && form.category ? getProposalSubs(form.main, form.category) : []),
    [isSubKind, form.main, form.category]
  );
  const check = useMemo(() => validateProposal(form), [form]);
  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const atLimit = pendingCount >= PROPOSAL_PENDING_LIMIT;

  // 上の項目を選び直したら、下は選び直し。種類を変えたら、名前の欄は空に
  const update = (field, value) => {
    setMessage(null);
    setForm((prev) => {
      const subKind = prev.kind === 'sub';
      if (field === 'kind') return { ...prev, kind: value, category: '', sub: '' };
      if (field === 'main' && subKind) return { ...prev, main: value, category: '', sub: '' };
      if (field === 'category' && subKind) return { ...prev, category: value, sub: '' };
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
    });
    setMessage({ type: 'success', text: `${title}を提案しました。管理者が確認します。` });
    // 種類と大分類は残し、続けて提案しやすくする
    setForm((prev) => ({ ...prev, category: '', sub: '', note: '' }));
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
          ぴったりの分類が無くて「その他」になる商品があるときに、新しい中分類・小分類を提案してください。
          管理者が確認して、承認したものは、管理者が商品名を決めて、次の更新で、すべてのユーザーの表に追加します（すぐには追加されません）。
          商品名は、AI が決めるので、提案できません。
        </p>

        {/* 提案の入力 */}
        <form className="proposal-card" onSubmit={handleSubmit} noValidate>
          <h2 className="proposal-section-title">新しいカテゴリを提案する</h2>

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

          {isSubKind ? (
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
                  placeholder="例: ペット用品"
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
                  placeholder="例: ペットフード"
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
              placeholder="例: ドッグフード、キャットフード、猫砂"
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
