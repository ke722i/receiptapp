import { useState, useEffect, useCallback } from 'react';
import { fetchComparableStores } from '../../utils/myStoreDb';
import { buildKnownStores, rememberStore } from '../../utils/storeNotice';
import { DICTIONARY_CHAIN_NAMES } from '../../utils/storeNameNormalizer';

/**
 * 「知っている店名・店舗名」を読み込む（初めて入力された名前の注意書きに使う）
 *  辞書の店名と、自分や価格データを提供している人のレシートにある店舗名。
 *  読み込めなかったときは loaded が false のまま（注意書きは出さない）。
 * @returns {[known, remember]} remember(storeName): 保存した店舗名を「知っている」ことにする
 */
export const useKnownStores = () => {
  const [known, setKnown] = useState({
    loaded: false,
    chains: new Set(DICTIONARY_CHAIN_NAMES),
    stores: new Set(),
  });

  useEffect(() => {
    let cancelled = false;
    fetchComparableStores().then((result) => {
      if (cancelled || !result.success) return;
      setKnown({ loaded: true, ...buildKnownStores(result.data) });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback((storeName) => {
    setKnown((prev) => rememberStore(prev, storeName));
  }, []);

  return [known, remember];
};
