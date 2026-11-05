// 店舗名エイリアス辞書（新しい店舗が増えてもここに追加するだけ）
const STORE_RULES = [
  { keywords: ['appro', 'アプロ'], normalized: '食品館アプロ' },
  { keywords: ['aeon', 'イオン', 'イオンスタイル'], normalized: 'イオン' },
  { keywords: ['life', 'ライフ'], normalized: 'ライフ' },
  { keywords: ['seven', '7-eleven', 'セブン'], normalized: 'セブン-イレブン' },
  { keywords: ['familymart', 'ファミマ', 'ファミリーマート'], normalized: 'ファミリーマート' },
  { keywords: ['LAMU', 'lamu'], normalized: 'ラ・ムー' },
  { keywords: ['ディオ', 'DO'], normalized: 'ディオ' }
];

/**
 * 読み取った店舗名を一瞬で統一表記に変換する関数
 */
export const normalizeStoreName = (rawName) => {
  if (!rawName) return '店舗名未登録';
  
  const lowerRaw = rawName.toLowerCase();
  
  // 辞書のキーワードが含まれているか判定
  const matched = STORE_RULES.find(rule => 
    rule.keywords.some(keyword => lowerRaw.includes(keyword))
  );

  return matched ? matched.normalized : rawName.trim();
};