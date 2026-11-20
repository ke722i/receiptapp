/*
 * 表示の明るさ（ライト・ダーク）
 *  ・設定の「表示」で選ぶ: 自動（スマホの設定に合わせる）／ライト／ダーク。端末に覚える（アカウントごとではない）
 *  ・「自動」は <html> に data-theme を付けない（index.css の @media (prefers-color-scheme: dark) が効く）。
 *    「ライト」「ダーク」は data-theme="light|dark" を付ける（index.css の変数が切り替わる）
 *  ・画面がちらつかないよう、index.html の先頭でも、同じ印を付けている（ここと同じキー）
 *  ・スマホのブラウザの上の帯の色（meta theme-color）も合わせる
 */

const KEY = 'receipt_app_theme';
const HEADER_LIGHT = '#1e9e5a';
const HEADER_DARK = '#14301f';

export const THEME_OPTIONS = [
  { value: 'system', label: '自動' },
  { value: 'dark', label: 'ダーク' },
  { value: 'light', label: 'ライト' },
];

const darkQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** 覚えている表示（無ければ「自動」） */
export const loadTheme = () => {
  try {
    const v = localStorage.getItem(KEY);
    return THEME_OPTIONS.some((o) => o.value === v) ? v : 'system';
  } catch {
    return 'system';
  }
};

/** 今、ダークで表示しているか */
export const isDarkNow = () => {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return Boolean(darkQuery()?.matches);
};

const updateThemeColor = () => {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', isDarkNow() ? HEADER_DARK : HEADER_LIGHT);
};

/** 表示を当てる（保存はしない） */
export const applyTheme = (theme) => {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  updateThemeColor();
};

/** 表示を選んだとき: 覚えて、当てる */
export const saveTheme = (theme) => {
  try {
    if (theme === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // 覚えられなくても、今の画面には当てる
  }
  applyTheme(theme);
};

/** アプリを開いたときに 1 回。「自動」のときは、スマホの設定が変わったら、上の帯の色も合わせる */
export const initTheme = () => {
  applyTheme(loadTheme());
  const q = darkQuery();
  q?.addEventListener?.('change', updateThemeColor);
};
