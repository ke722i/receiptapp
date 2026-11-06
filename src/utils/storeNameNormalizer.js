// 店舗名エイリアス辞書（新しい店舗が増えてもここに追加するだけ）
//  ・keywords は大文字小文字・全角半角・空白や記号（. - ・ など）を区別せず照合される
//  ・上にあるルールほど優先
const STORE_RULES = [
  // 「Apporo」はレシートOCRでよく出る誤読
  { keywords: ['appro', 'apporo', 'アプロ'], normalized: '食品館アプロ' },
  { keywords: ['aeon', 'イオン'], normalized: 'イオン' },
  { keywords: ['life', 'ライフ'], normalized: 'ライフ' },
  { keywords: ['seven-eleven', '7-eleven', 'セブンイレブン', 'セブン'], normalized: 'セブン-イレブン' },
  { keywords: ['familymart', 'ファミマ', 'ファミリーマート'], normalized: 'ファミリーマート' },
  { keywords: ['lamu', 'ラムー'], normalized: 'ラ・ムー' },
  // ※ 'DO' のような短い英字は、他の英単語にも含まれて誤判定するため使わない
  { keywords: ['ディオ'], normalized: 'ディオ' },
];

// 照合用の正規化: 全角→半角、小文字化、空白・記号の除去
const normalizeForMatch = (text) =>
  String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.,\-_・･'’"“”()（）]/g, '');

// キーワード側も同じ規則で正規化しておく（起動時に1度だけ）
const PREPARED_RULES = STORE_RULES.map((rule) => ({
  normalized: rule.normalized,
  keywords: rule.keywords.map(normalizeForMatch).filter(Boolean),
}));

/**
 * 読み取った店舗名を統一表記に変換する関数
 */
export const normalizeStoreName = (rawName) => {
  if (!rawName || !String(rawName).trim()) return '店舗名未登録';

  const target = normalizeForMatch(rawName);

  const matched = PREPARED_RULES.find((rule) =>
    rule.keywords.some((keyword) => target.includes(keyword))
  );

  return matched ? matched.normalized : String(rawName).trim();
};