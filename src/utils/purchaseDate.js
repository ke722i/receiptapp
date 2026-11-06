/**
 * レシートから読み取った購入日を「YYYY-MM-DD」にそろえる
 *  日付入力欄（<input type="date">）は YYYY-MM-DD 以外の値だと空欄になるため。
 *  対応する表記の例:
 *    2026-11-06 / 2026/11/06 / 2026.11.6 / 2026年11月6日(金) / 26/11/06 / 令和8年11月6日 / R8.11.6
 *  読み取れない・実在しない日付のときは null を返す（呼び出し側で今日の日付などに置き換える）。
 */
const ERA_START_YEAR = { 令和: 2018, R: 2018, 平成: 1988, H: 1988 }; // 元号の1年 = 開始年 + 1

const SEP_YEAR = '\\s*[年./\\-]\\s*';
const SEP_MONTH = '\\s*[月./\\-]\\s*';

const toIso = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(y, m - 1, d);
  // 2月30日のような実在しない日付は弾く
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export const normalizePurchaseDate = (raw) => {
  if (!raw) return null;
  const text = String(raw).normalize('NFKC').trim();

  // 和暦（令和8年11月6日 / R8.11.6）
  const era = text.match(
    new RegExp(`(令和|平成|R|H)\\s*(\\d{1,2})${SEP_YEAR}(\\d{1,2})${SEP_MONTH}(\\d{1,2})`, 'i')
  );
  if (era) {
    const key = era[1].length === 1 ? era[1].toUpperCase() : era[1];
    return toIso(ERA_START_YEAR[key] + Number(era[2]), era[3], era[4]);
  }

  // 西暦4桁（2026年11月6日 / 2026/11/06 / 2026-11-06）
  const full = text.match(new RegExp(`(\\d{4})${SEP_YEAR}(\\d{1,2})${SEP_MONTH}(\\d{1,2})`));
  if (full) return toIso(full[1], full[2], full[3]);

  // 西暦2桁（26/11/06）→ 2000年代として扱う
  const short = text.match(new RegExp(`(?<!\\d)(\\d{2})${SEP_YEAR}(\\d{1,2})${SEP_MONTH}(\\d{1,2})`));
  if (short) return toIso(2000 + Number(short[1]), short[2], short[3]);

  return null;
};
