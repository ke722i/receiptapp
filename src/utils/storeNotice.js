import {
  DICTIONARY_CHAIN_NAMES,
  canonicalChainName,
  cleanBranchName,
  joinStoreName,
  splitStoreName,
} from './storeNameNormalizer';

/*
 * 「初めて入力された店名・店舗名」の判定（レシートの確認・編集画面の注意書き用）
 *  「知っている」名前 = 辞書の店名 ＋ 自分や、価格データを提供している人のレシートに、すでにある店舗名
 *  2 回目から（自動入力でも手入力でも）注意書きは出さない。
 */

/** 店舗名の一覧から、「知っている店名・店舗名」を作る */
export const buildKnownStores = (storeNames = []) => {
  const chains = new Set(DICTIONARY_CHAIN_NAMES);
  const stores = new Set();
  storeNames.forEach((name) => {
    const { chain, branch } = splitStoreName(name);
    if (!chain) return;
    chains.add(chain);
    stores.add(joinStoreName(chain, branch));
  });
  return { chains, stores };
};

/** 保存した店舗名を、「知っている」ことにする（同じ画面で、続けて編集したときに、もう一度出さないため） */
export const rememberStore = (known, storeName) => {
  const { chain, branch } = splitStoreName(storeName);
  if (!chain) return known;
  return {
    ...known,
    chains: new Set([...known.chains, chain]),
    stores: new Set([...known.stores, joinStoreName(chain, branch)]),
  };
};

/**
 * 吹き出しに出す注意書き。出す必要が無ければ null
 * @param {{ loaded: boolean, chains: Set<string>, stores: Set<string> }} known
 */
export const getStoreNotice = (chain, branch, known) => {
  // 読み込めていないときは、間違った注意書きを出さない
  if (!known?.loaded) return null;

  const chainName = canonicalChainName(chain);
  const branchName = cleanBranchName(branch);
  if (!chainName) return null;

  if (!known.chains.has(chainName)) {
    return {
      type: 'chain',
      text: `「${chainName}」は、初めて入力された店名です。レシートの印字と見比べて、合っているか確認してください。`,
    };
  }

  if (branchName && !known.stores.has(joinStoreName(chainName, branchName))) {
    return {
      type: 'branch',
      text: `「${chainName} ${branchName}」は、初めて入力された店舗名です。レシートの印字と見比べて、合っているか確認してください。`,
    };
  }

  return null;
};
