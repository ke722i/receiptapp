import { useEffect, useState } from 'react';

/*
 * 新しい版の公開に、開いたままのタブが気づく
 *  ・ビルドのたびに /version.json（ビルドの番号）を書き出している（vite.config.js）
 *  ・この画面のビルドの番号（__BUILD_ID__）と、公開中の /version.json を比べて、違えば「新しい版があります」を出す
 *  ・確かめるのは、開いて 30 秒後・10 分ごと・アプリに戻ったとき（別のタブ・アプリから戻ったとき）
 *  ・自動では再読み込みしない（入力中の内容が消えないように）。ユーザーが「更新する」を押す
 *  ・開発中（npm run dev）は、確かめない
 */

const CHECK_EVERY_MS = 10 * 60 * 1000;
const FIRST_CHECK_MS = 30 * 1000;
// eslint-disable-next-line no-undef
const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : '';

const fetchLatestBuild = async () => {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.build === 'string' ? data.build : null;
  } catch {
    return null; // 通信できないときは、何もしない
  }
};

/** 新しい版が公開されているか（true になったら、画面に「更新する」を出す） */
export function useAppUpdate() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD || !CURRENT) return undefined;
    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      const latest = await fetchLatestBuild();
      if (!stopped && latest && latest !== CURRENT) setAvailable(true);
    };
    const first = setTimeout(check, FIRST_CHECK_MS);
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return available;
}

/** 新しい版を読み込む（キャッシュを使わずに読み直す） */
export const reloadToLatest = () => {
  const url = new URL(window.location.href);
  url.searchParams.set('v', Date.now().toString(36)); // 古い index.html を使わないように、URL を少し変える
  window.location.replace(url.toString());
};
