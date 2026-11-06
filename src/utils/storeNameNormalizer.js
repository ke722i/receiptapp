// 店舗名エイリアス辞書（新しい店舗が増えてもここに追加するだけ）
//  ・keywords は大文字小文字・全角半角・空白や記号（. - ・ など）を区別せず照合される
//  ・店名の先頭に近い位置で一致したルールを優先（同じ位置なら長い語、それも同じなら上のルール）
//  ・店舗名は「チェーン名 支店名」の形で保存する（例: 「ディオ 和泉店」）。
//    辞書に一致した部分だけを統一名にし、支店名は残す。
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

  // ---------- 食品スーパー（大阪府） ----------
  { keywords: ['万代'], normalized: '万代' },
  { keywords: ['関西スーパー', 'kansaisuper'], normalized: '関西スーパー' },
  { keywords: ['阪急オアシス', 'hankyuoasis'], normalized: '阪急オアシス' },
  { keywords: ['イズミヤ', 'izumiya'], normalized: 'イズミヤ' },
  { keywords: ['コノミヤ', 'konomiya'], normalized: 'コノミヤ' },
  // ※ 「玉出」だけだと地名（支店名）と区別できないので、キーワードにしない
  { keywords: ['タマデ', 'tamade'], normalized: 'スーパー玉出' },
  { keywords: ['ダイエー', 'daiei'], normalized: 'ダイエー' },
  { keywords: ['マックスバリュ', 'maxvalu'], normalized: 'マックスバリュ' },
  { keywords: ['ビッグ・エー', 'ビッグエー'], normalized: 'ビッグ・エー' },
  { keywords: ['業務スーパー'], normalized: '業務スーパー' },
  { keywords: ['ロピア', 'lopia'], normalized: 'ロピア' },
  { keywords: ['サンディ', 'sandy'], normalized: 'サンディ' },
  { keywords: ['サンプラザ'], normalized: 'サンプラザ' },
  { keywords: ['トップワールド'], normalized: 'トップワールド' },
  { keywords: ['フレンドマート'], normalized: 'フレンドマート' },
  { keywords: ['平和堂'], normalized: '平和堂' },
  { keywords: ['アルプラザ'], normalized: 'アルプラザ' },
  { keywords: ['オークワ'], normalized: 'オークワ' },
  { keywords: ['いかりスーパー'], normalized: 'いかりスーパー' },
  { keywords: ['kohyo', 'コーヨー'], normalized: 'KOHYO' },
  { keywords: ['成城石井'], normalized: '成城石井' },

  // ---------- コンビニ ----------
  // ※ 「ローソンストア100」「ナチュラルローソン」は別のお店として分ける
  { keywords: ['ローソンストア100', 'lawsonstore100'], normalized: 'ローソンストア100' },
  { keywords: ['ナチュラルローソン', 'naturallawson'], normalized: 'ナチュラルローソン' },
  { keywords: ['ローソン', 'lawson'], normalized: 'ローソン' },
  { keywords: ['ミニストップ', 'ministop'], normalized: 'ミニストップ' },
  { keywords: ['デイリーヤマザキ', 'dailyyamazaki'], normalized: 'デイリーヤマザキ' },
  { keywords: ['ニューデイズ', 'newdays'], normalized: 'NewDays' },
  { keywords: ['ポプラ', '生活彩家'], normalized: 'ポプラ' },

  // ---------- ドラッグストア ----------
  { keywords: ['キリン堂', 'kirindo'], normalized: 'キリン堂' },
  { keywords: ['ダイコクドラッグ'], normalized: 'ダイコクドラッグ' },
  { keywords: ['ドラッグコスモス', 'コスモス薬品'], normalized: 'ドラッグコスモス' },
  { keywords: ['スギ薬局', 'スギドラッグ'], normalized: 'スギ薬局' },
  { keywords: ['ウエルシア', 'ウェルシア', 'welcia'], normalized: 'ウエルシア' },
  { keywords: ['マツモトキヨシ', 'マツキヨ', 'matsumotokiyoshi'], normalized: 'マツモトキヨシ' },
  { keywords: ['ココカラファイン', 'cocokarafine'], normalized: 'ココカラファイン' },
  { keywords: ['ツルハ', 'tsuruha'], normalized: 'ツルハドラッグ' },
  { keywords: ['サンドラッグ', 'sundrug'], normalized: 'サンドラッグ' },
  { keywords: ['ダックス'], normalized: 'ダックス' },
  { keywords: ['ドラッグセガミ', 'セガミ'], normalized: 'ドラッグセガミ' },
  { keywords: ['ドラッグユタカ'], normalized: 'ドラッグユタカ' },
];

const UNREGISTERED = '店舗名未登録';

// 照合時に無視する文字（空白・記号）
const IGNORED_CHARS = /[\s.,\-_・･'’"“”()（）]/;

// 照合用の正規化: 全角→半角、小文字化、空白・記号の除去
const normalizeForMatch = (text) =>
  String(text)
    .normalize('NFKC')
    .toLowerCase()
    .split('')
    .filter((ch) => !IGNORED_CHARS.test(ch))
    .join('');

// 辞書側も同じ規則で正規化しておく（起動時に1度だけ）。
// 統一名そのもの（例: 「食品館アプロ」）も照合に使い、長い語を先に試す。
const PREPARED_RULES = STORE_RULES.map((rule) => ({
  normalized: rule.normalized,
  patterns: Array.from(
    new Set([rule.normalized, ...rule.keywords].map(normalizeForMatch).filter(Boolean))
  ).sort((a, b) => b.length - a.length),
}));

/**
 * 店舗名がどのチェーンか辞書で探す
 * @returns {{ rule, chars: string[], end: number } | null}
 *   chars: 全角→半角にそろえた店舗名を1文字ずつにしたもの
 *   end:   チェーン名にあたる部分の終わり位置（chars の添字）
 */
const findChain = (name) => {
  const chars = Array.from(String(name).normalize('NFKC').trim());

  // 空白・記号を除いた照合用の文字列と、各文字が chars の何番目かの対応表
  let matchText = '';
  const indexMap = [];
  chars.forEach((ch, i) => {
    const lower = ch.toLowerCase();
    if (IGNORED_CHARS.test(lower)) return;
    for (const c of lower) {
      matchText += c;
      indexMap.push(i);
    }
  });

  // 全ルールの中から、店名の先頭にいちばん近い位置で一致したものを選ぶ。
  // （支店名の地名が別のチェーンに一致するのを防ぐ。例: 「ライフ 玉出店」→ ライフ）
  // 同じ位置なら長い語を優先（例: 「セブン」より「セブンイレブン」）、それも同じなら辞書の上のルール。
  let best = null;
  PREPARED_RULES.forEach((rule) => {
    rule.patterns.forEach((pattern) => {
      const start = matchText.indexOf(pattern);
      if (start < 0) return;
      if (
        !best ||
        start < best.start ||
        (start === best.start && pattern.length > best.length)
      ) {
        best = { rule, start, length: pattern.length };
      }
    });
  });

  if (!best) return null;
  return { rule: best.rule, chars, end: indexMap[best.start + best.length - 1] + 1 };
};

/**
 * 読み取った店舗名を「チェーン名 支店名」の統一表記に変換する関数
 *  例: 「ディオ和泉店」→「ディオ 和泉店」、「AEON堺店」→「イオン 堺店」
 *  辞書にないチェーンは、読み取った店舗名をそのまま返す。
 */
export const normalizeStoreName = (rawName) => {
  if (!rawName || !String(rawName).trim()) return UNREGISTERED;

  const found = findChain(rawName);
  if (!found) return String(rawName).trim();

  // チェーン名より後ろが支店名（括弧や先頭の記号は取り除く）
  const branch = found.chars
    .slice(found.end)
    .join('')
    .replace(/[()]/g, '')
    .replace(/^[\s\-_・.,'’"“”]+/, '')
    .trim();

  return branch ? `${found.rule.normalized} ${branch}` : found.rule.normalized;
};

/**
 * 保存されている店舗名から、チェーン名（集計の単位）を取り出す
 *  ・辞書にあるチェーンは統一名（例: 「ディオ 和泉店」→「ディオ」）
 *  ・辞書にないチェーンは、最初の空白までをチェーン名とみなす（例: 「ニトリ 大阪店」→「ニトリ」）
 *  ・以前の保存データ（チェーン名だけ）はそのままチェーン名になる
 */
export const getChainName = (storeName) => {
  const name = String(storeName || '').trim();
  if (!name || name === UNREGISTERED) return UNREGISTERED;

  const found = findChain(name);
  if (found) return found.rule.normalized;

  return name.split(/\s+/)[0];
};
