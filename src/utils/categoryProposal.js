import { CATEGORY_TREE } from '../constants/categoryData';
import { PRODUCT_PATHS, OTHER, formatPath } from './categoryUtils';

/*
 * カテゴリ（商品名）の提案の、画面に依存しない処理
 *  ・提案できるのは「今の表にある小分類（または中分類）に、商品名を 1 つ足す」ことだけ。
 *    新しい小分類・中分類の提案は、まだ受け付けない
 *  ・位置の選択肢には「その他」を出さない（「その他」は表に入れない決まり。CLAUDE.md「3. カテゴリの仕組み」）
 *  ・承認待ちの上限・重複の最終的な判定は、DB の関数 submit_category_proposal が行う
 */

export const PROPOSAL_PENDING_LIMIT = 20; // DB の関数と同じ値
export const PROPOSAL_NAME_MAX = 40;
export const PROPOSAL_NOTE_MAX = 200;

export const PROPOSAL_STATUS_LABELS = {
  pending: '承認待ち',
  approved: '承認（次の更新で追加）',
  rejected: '見送り',
};

const uniq = (list) => Array.from(new Set(list));

/** 大分類の選択肢（表の順。「その他」は無し） */
export const getProposalMains = () => CATEGORY_TREE.map((top) => top.name).filter((n) => n !== OTHER);

/** 中分類の選択肢 */
export const getProposalMids = (main) => {
  const top = CATEGORY_TREE.find((t) => t.name === main);
  return top ? uniq(top.categories.map((m) => m.name)).filter((n) => n !== OTHER) : [];
};

/** 小分類の選択肢（小分類が無い、古い形式の中分類なら空） */
export const getProposalSubs = (main, category) =>
  uniq(PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub).map((p) => p.sub)).filter(
    (n) => n !== OTHER
  );

/** その位置に、今ある商品名（提案の参考に見せる） */
export const getExistingProducts = (main, category, sub) =>
  uniq(
    PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && (p.sub || '') === (sub || '')).map(
      (p) => p.product
    )
  );

/** 文字をそろえる（前後の空白を除き、全角英数・半角カナなどを通常の形に、続く空白は 1 つに） */
export const cleanProposalText = (text) =>
  String(text || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

/** 読み仮名: カタカナはひらがなにし、空白・「・」は除く。ひらがなと「ー」以外が残れば、そのまま返す（検証で弾く） */
export const cleanReading = (text) =>
  cleanProposalText(text)
    .replace(/[\s・]/g, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/;
const KANA_OR_ASCII = /^[ぁ-ゖァ-ヺー・\x20-\x7e]+$/; // 漢字を含まない（読み仮名が無くても、検索で見つかる）

/**
 * 提案の入力を確かめる。
 * @param {{ main, category, sub, product, reading, note }} input
 * @returns {{ value: object, errors: Record<string, string>, warnings: string[] }}
 *   errors が空なら送れる。warnings は送れるが、知らせたいこと
 */
export const validateProposal = (input) => {
  const value = {
    main: cleanProposalText(input.main),
    category: cleanProposalText(input.category),
    sub: cleanProposalText(input.sub) || null,
    product: cleanProposalText(input.product),
    reading: cleanReading(input.reading) || null,
    note: cleanProposalText(input.note) || null,
  };
  const errors = {};
  const warnings = [];

  // 位置: 表にあるものだけ
  if (!getProposalMains().includes(value.main)) {
    errors.main = '大分類を選んでください。';
  } else if (!getProposalMids(value.main).includes(value.category)) {
    errors.category = '中分類を選んでください。';
  } else {
    const subs = getProposalSubs(value.main, value.category);
    if (subs.length > 0 && !subs.includes(value.sub)) errors.sub = '小分類を選んでください。';
    if (subs.length === 0) value.sub = null;
  }

  // 商品名
  if (!value.product) {
    errors.product = '商品名を入れてください。';
  } else if (value.product.length > PROPOSAL_NAME_MAX) {
    errors.product = `商品名は、${PROPOSAL_NAME_MAX}文字までです。`;
  } else if (value.product === OTHER || value.product === '未選択') {
    errors.product = `「${value.product}」は、商品名にできません。`;
  } else if (!errors.main && !errors.category && !errors.sub) {
    const sameName = PRODUCT_PATHS.filter((p) => p.product === value.product);
    const samePlace = sameName.find(
      (p) => p.main === value.main && p.category === value.category && (p.sub || null) === value.sub
    );
    if (samePlace) {
      errors.product = 'この商品名は、この場所の表に、すでにあります。';
    } else if (sameName.length > 0) {
      warnings.push(`同じ名前の商品が、別の場所にあります（${sameName.map((p) => formatPath(p)).join('、')}）。`);
    }
  }

  // 読み仮名（ひらがな）: 漢字を含む商品名では必須（ひらがなで検索できるようにするため）
  if (value.reading) {
    if (value.reading.length > PROPOSAL_NAME_MAX) {
      errors.reading = `読み仮名は、${PROPOSAL_NAME_MAX}文字までです。`;
    } else if (!HIRAGANA_ONLY.test(value.reading)) {
      errors.reading = '読み仮名は、ひらがなで入れてください。';
    }
  } else if (value.product && !KANA_OR_ASCII.test(value.product)) {
    errors.reading = '漢字を含む商品名は、読み仮名（ひらがな）も入れてください。';
  }

  // メモ
  if (value.note && value.note.length > PROPOSAL_NOTE_MAX) {
    errors.note = `メモは、${PROPOSAL_NOTE_MAX}文字までです。`;
  }

  return { value, errors, warnings };
};
