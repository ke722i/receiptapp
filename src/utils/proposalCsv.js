// 承認した提案を、tools/apply_proposals.py に渡す CSV にする（管理者画面の「CSV で保存」）
//  列: kind, main_category, category, sub_category, product_name, note, products
//  products は空（新しい中分類・小分類に入れる商品名は、管理者が書き足す）。Excel でも文字化けしないよう、先頭に BOM を付ける

const BOM = String.fromCharCode(0xfeff); // Excel で文字化けしないように
const COLUMNS = ['kind', 'main_category', 'category', 'sub_category', 'product_name', 'note', 'products'];

const cell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** @param {{ kind, main_category, category, sub_category, product_name, notes }[]} groups 管理者の一覧（承認） */
export const buildApprovedCsv = (groups) => {
  const rows = (groups || []).map((g) =>
    [g.kind, g.main_category, g.category, g.sub_category, g.product_name, (g.notes || []).join(' / '), ''].map(cell).join(',')
  );
  return `${BOM}${[COLUMNS.join(','), ...rows].join('\r\n')}\r\n`;
};

/** CSV を、端末に保存する（ファイル名: approved_proposals_YYYYMMDD.csv） */
export const downloadCsv = (text, now = new Date()) => {
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `approved_proposals_${ymd}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
