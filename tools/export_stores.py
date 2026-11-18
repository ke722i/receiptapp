"""取り扱い店舗（店名の辞書）の一覧を、Excel にする
使い方（プロジェクトの直下で）:
    python tools/export_stores.py            → misc/excel/取り扱い店舗一覧.xlsx（出力先を、引数で変えてもよい）
元は、src/utils/storeNameNormalizer.js の STORE_RULES（店を足したら、ここを直して、もう一度実行する）。
"""
import os
import re
import sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

SRC = 'src/utils/storeNameNormalizer.js'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'misc/excel/取り扱い店舗一覧.xlsx'
os.makedirs(os.path.dirname(OUT) or '.', exist_ok=True)

text = open(SRC, encoding='utf-8').read()
body = text[text.index('const STORE_RULES = ['):]
body = body[:body.index('\n];')]

section = '主要な店（最初に登録した店）'
pending_notes = []
rows = []
for line in body.splitlines()[1:]:
    s = line.strip()
    m = re.match(r'//\s*-{3,}\s*(.+?)\s*-{3,}', s)
    if m:
        section = m.group(1)
        pending_notes = []
        continue
    if s.startswith('//'):
        pending_notes.append(s[2:].strip().lstrip('※').strip())
        continue
    m = re.match(r"\{\s*keywords:\s*\[(.*?)\],\s*normalized:\s*'(.*?)'\s*\}", s)
    if m:
        keywords = re.findall(r"'(.*?)'", m.group(1))
        rows.append((section, m.group(2), keywords, ' / '.join(pending_notes)))
        pending_notes = []
        continue
    if not s:
        pending_notes = []

HEAD_FILL = PatternFill('solid', fgColor='C62828')
HEAD_FONT = Font(bold=True, color='FFFFFF')
THIN = Side(style='thin', color='BDBDBD')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical='top')
CENTER = Alignment(wrap_text=True, vertical='center', horizontal='center')

wb = Workbook()
ws = wb.active
ws.title = '取り扱い店舗'
titles = ['No', '区分', '店名（アプリでの表示名）', '認識する書き方（キーワード）', '備考']
for i, (t, w) in enumerate(zip(titles, [6, 22, 28, 60, 60]), 1):
    c = ws.cell(row=1, column=i, value=t)
    c.fill, c.font, c.alignment, c.border = HEAD_FILL, HEAD_FONT, CENTER, BORDER
    ws.column_dimensions[get_column_letter(i)].width = w
for n, (sec, name, kws, note) in enumerate(rows, 1):
    values = [n, sec, name, ' ／ '.join(kws), note]
    for i, v in enumerate(values, 1):
        c = ws.cell(row=n + 1, column=i, value=v)
        c.alignment, c.border = WRAP, BORDER
ws.freeze_panes = 'D2'
ws.auto_filter.ref = f'A1:E{len(rows) + 1}'

# 区分ごとの件数
ws2 = wb.create_sheet('区分ごとの件数')
for i, (t, w) in enumerate(zip(['区分', '店の数'], [30, 10]), 1):
    c = ws2.cell(row=1, column=i, value=t)
    c.fill, c.font, c.alignment, c.border = HEAD_FILL, HEAD_FONT, CENTER, BORDER
    ws2.column_dimensions[get_column_letter(i)].width = w
counts = {}
for sec, *_ in rows:
    counts[sec] = counts.get(sec, 0) + 1
for r, (sec, n) in enumerate(counts.items(), 2):
    ws2.cell(row=r, column=1, value=sec).border = BORDER
    ws2.cell(row=r, column=2, value=n).border = BORDER
r = len(counts) + 2
ws2.cell(row=r, column=1, value='合計').font = Font(bold=True)
ws2.cell(row=r, column=2, value=f'=SUM(B2:B{r - 1})').font = Font(bold=True)

# 使い方
ws3 = wb.create_sheet('使い方')
ws3.column_dimensions['A'].width = 100
notes = [
    '取り扱い店舗（店名の辞書）',
    'レシートの店名を、同じ店としてそろえるための辞書です（src/utils/storeNameNormalizer.js の STORE_RULES）。',
    '・「認識する書き方」のどれかが店名に含まれていれば、その店として扱い、アプリでの表示名にそろえます（全角・半角・大文字小文字・空白・記号の違いは区別しません）。',
    '・店名は「店名 支店名」の形で保存します（例: 「ディオ 和泉店」）。',
    '・辞書にない店でも、レシートの登録・価格比較は使えます（最初の空白までを店名として扱います）。ただし、初めて入力された店名には「!」が出ます。',
    '・新しい店を足したいときは、開発者に伝えてください（辞書に追加して、再公開します）。',
]
for i, t in enumerate(notes, 1):
    c = ws3.cell(row=i, column=1, value=t)
    c.alignment = WRAP
    if i == 1:
        c.font = Font(bold=True, size=14)
wb.move_sheet('使い方', offset=-2)
wb.save(OUT)
print(f'出力: {OUT} / 店 {len(rows)} 件 / 区分 {len(counts)}')
for sec, n in counts.items():
    print(f'  {sec}: {n}')
