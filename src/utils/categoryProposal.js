import { CATEGORY_TREE } from '../constants/categoryData';
import { PRODUCT_PATHS, OTHER } from './categoryUtils';

/*
 * カテゴリの提案の、画面に依存しない処理
 *  提案できるのは、カテゴリ（中分類・小分類）だけ。商品名は AI が決めるもので、ユーザーは提案しない。
 *   ・kind 'category': 大分類を選び、新しい中分類（小分類も一緒に出してよい）
 *   ・kind 'sub':      大分類と、今ある中分類を選び、新しい小分類
 *  大分類（常温・冷蔵・冷凍・日用品）は、選ぶだけで、提案できない。
 *  選択肢に「その他」は出さない（「その他」は表に入れない決まり。CLAUDE.md「3. カテゴリの仕組み」）。
 *  承認待ちの上限・重複の最終的な判定は、DB の関数 submit_category_proposal が行う。
 */

export const PROPOSAL_PENDING_LIMIT = 20; // DB の関数と同じ値
export const PROPOSAL_NAME_MAX = 40;
export const PROPOSAL_NOTE_MAX = 200;

/** 提案の種類（画面の切り替え） */
export const PROPOSAL_KINDS = [
  { value: 'category', label: '新しい中分類' },
  { value: 'sub', label: '今ある中分類に、新しい小分類' },
];

export const PROPOSAL_STATUS_LABELS = {
  pending: '承認待ち',
  approved: '承認（次の更新で追加）',
  rejected: '見送り',
};

const uniq = (list) => Array.from(new Set(list));
const RESERVED = [OTHER, '未選択'];

/** 大分類の選択肢（表の順） */
export const getProposalMains = () => CATEGORY_TREE.map((top) => top.name).filter((n) => !RESERVED.includes(n));

/** その大分類にある中分類 */
export const getProposalMids = (main) => {
  const top = CATEGORY_TREE.find((t) => t.name === main);
  return top ? uniq(top.categories.map((m) => m.name)).filter((n) => !RESERVED.includes(n)) : [];
};

/** その中分類にある小分類（小分類が無い、古い形式の中分類なら空） */
export const getProposalSubs = (main, category) =>
  uniq(PRODUCT_PATHS.filter((p) => p.main === main && p.category === category && p.sub).map((p) => p.sub)).filter(
    (n) => !RESERVED.includes(n)
  );

/** 入力の文字をそろえる（前後の空白を除き、全角英数・半角カナなどを通常の形に、続く空白は 1 つに） */
export const cleanProposalText = (text) =>
  String(text || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim();

/** 名前を比べるための形（空白・記号・ひらがな/カタカナ・大文字/小文字の違いを無くす）。表示には使わない */
export const foldCategoryName = (text) =>
  cleanProposalText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));

// 表の中の、すべての中分類・小分類（「似た名前が別の場所にある」の注意に使う）
const ALL_PLACES = (() => {
  const list = [];
  CATEGORY_TREE.forEach((top) => {
    top.categories.forEach((mid) => {
      list.push({ level: '中分類', name: mid.name, path: `${top.name} > ${mid.name}` });
      (mid.subCategories || []).forEach((sub) => {
        list.push({ level: '小分類', name: sub.name, path: `${top.name} > ${mid.name} > ${sub.name}` });
      });
    });
  });
  return list;
})();

/** 新しい名前の、共通のチェック（空・長さ・使えない名前）。問題なければ '' */
const nameError = (name, label, required) => {
  if (!name) return required ? `${label}の名前を入れてください。` : '';
  if (name.length > PROPOSAL_NAME_MAX) return `${label}の名前は、${PROPOSAL_NAME_MAX}文字までです。`;
  if (RESERVED.includes(name)) return `「${name}」は、${label}の名前にできません。`;
  return '';
};

/** 同じ親の中に、同じ（そろえると同じ）名前があれば、その名前 */
const findSame = (name, siblings) => siblings.find((s) => foldCategoryName(s) === foldCategoryName(name)) || null;

/** 別の場所に、同じ・似た名前があれば、注意の文 */
const similarWarning = (name, exceptPath) => {
  const folded = foldCategoryName(name);
  if (folded.length < 2) return null;
  const hits = ALL_PLACES.filter((p) => {
    if (p.path === exceptPath) return false;
    const f = foldCategoryName(p.name);
    return f === folded || f.includes(folded) || folded.includes(f);
  }).slice(0, 3);
  if (hits.length === 0) return null;
  return `「${name}」に似た分類が、すでにあります（${hits.map((h) => `${h.level}: ${h.path}`).join('、')}）。重ならないか、確かめてください。`;
};

/**
 * 提案の入力を確かめる。
 * @param {{ kind: 'category' | 'sub', main, category, sub, note }} input
 *   kind 'category' のとき: category は新しい中分類の名前、sub は任意の新しい小分類の名前
 *   kind 'sub' のとき:      category は今ある中分類（選んだもの）、sub は新しい小分類の名前
 * @returns {{ value: { kind, main, category, sub, note }, errors: Record<string, string>, warnings: string[] }}
 *   errors が空なら送れる。warnings は送れるが、知らせたいこと
 */
export const validateProposal = (input) => {
  const kind = input.kind === 'sub' ? 'sub' : 'category';
  const value = {
    kind,
    main: cleanProposalText(input.main),
    category: cleanProposalText(input.category),
    sub: cleanProposalText(input.sub) || null,
    note: cleanProposalText(input.note) || null,
  };
  const errors = {};
  const warnings = [];

  if (!getProposalMains().includes(value.main)) {
    errors.main = '大分類を選んでください。';
  }

  if (kind === 'category') {
    // 新しい中分類（と、任意の小分類）
    const catErr = nameError(value.category, '中分類', true);
    if (catErr) {
      errors.category = catErr;
    } else if (!errors.main) {
      const same = findSame(value.category, getProposalMids(value.main));
      if (same) {
        errors.category = `中分類「${same}」は、${value.main}に、すでにあります。小分類を足したいときは、「${PROPOSAL_KINDS[1].label}」を選んでください。`;
      } else {
        const w = similarWarning(value.category, null);
        if (w) warnings.push(w);
      }
    }
    const subErr = nameError(value.sub, '小分類', false);
    if (subErr) {
      errors.sub = subErr;
    } else if (value.sub && foldCategoryName(value.sub) === foldCategoryName(value.category)) {
      errors.sub = '小分類の名前が、中分類と同じです。';
    }
  } else {
    // 今ある中分類に、新しい小分類
    if (!errors.main && !getProposalMids(value.main).includes(value.category)) {
      errors.category = '中分類を選んでください。';
    }
    const subErr = nameError(value.sub, '小分類', true);
    if (subErr) {
      errors.sub = subErr;
    } else if (!errors.main && !errors.category) {
      const same = findSame(value.sub, getProposalSubs(value.main, value.category));
      if (same) {
        errors.sub = `小分類「${same}」は、この中分類に、すでにあります。`;
      } else {
        const w = similarWarning(value.sub, null);
        if (w) warnings.push(w);
      }
    }
  }

  if (value.note && value.note.length > PROPOSAL_NOTE_MAX) {
    errors.note = `メモは、${PROPOSAL_NOTE_MAX}文字までです。`;
  }

  return { value, errors, warnings };
};

/**
 * 自分の提案の一覧に出す、見出しと場所。
 * @param {{ kind, main_category, category, sub_category, product_name }} p DB の行
 */
export const describeProposal = (p) => {
  if (p.kind === 'sub') {
    return { title: `小分類「${p.sub_category}」`, place: `${p.main_category} > ${p.category} に追加` };
  }
  if (p.kind === 'product') {
    // 以前の形式（商品名の提案）
    return {
      title: `商品名「${p.product_name}」（以前の形式）`,
      place: [p.main_category, p.category, p.sub_category].filter(Boolean).join(' > '),
    };
  }
  return {
    title: p.sub_category ? `中分類「${p.category}」と小分類「${p.sub_category}」` : `中分類「${p.category}」`,
    place: `${p.main_category} に追加`,
  };
};
