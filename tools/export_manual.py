"""docs/manual/*.md を、1 つの Excel（タブ分け）にまとめる。あなた用のマニュアル。

使い方（プロジェクトの直下で）:  python tools/export_manual.py   （または npm run manual）
できるもの: マニュアル.xlsx（プロジェクトの直下。Git には入れない）
  ・元は docs/manual/*.md。文章を直したいときは、md を直して（Claude に頼む）、このコマンドで作り直す
  ・Excel を直接直しても、次に作り直すと消える
  ・Excel を開いたままだと、作り直せない（閉じる）
"""
import math
import re
import sys
from pathlib import Path

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'manual'
OUT = ROOT / 'マニュアル.xlsx'

# タブの順番と名前（ファイル名 → タブ名）
SHEETS = [
    ('index.md', 'はじめに'),
    ('commands.md', 'コマンド早見表'),
    ('release-flow.md', '公開の流れ'),
    ('admin.md', '管理者'),
    ('proposal-approval.md', '提案の承認'),
    ('receipt-import.md', 'レシート取り込み'),
    ('category-table.md', 'カテゴリ表・辞書'),
    ('icons.md', 'アイコン'),
    ('db-readonly.md', 'DBを調べる'),
]

GREEN = '1E9E5A'
COL_WIDTHS = [26, 44, 44, 34, 34]  # A〜E
TOTAL_WIDTH = sum(COL_WIDTHS)
thin = Side(style='thin', color='CFE3D8')
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)


def clean(text):
    """md の飾りを取る（太字・コード・リンク）"""
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    text = re.sub(r'`([^`]*)`', r'\1', text)
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'\1（\2）', text)
    return text.strip()


def lines_needed(text, width):
    """全角が多いので、1 文字 = 幅 2 として、折り返しの行数を見積もる"""
    n = 0
    for part in str(text).split('\n'):
        w = sum(2 if ord(ch) > 0x2E80 else 1 for ch in part)
        n += max(1, math.ceil(w / max(width, 1)))
    return n


def parse_table(rows):
    cells = []
    for r in rows:
        parts = [clean(c) for c in r.strip().strip('|').split('|')]
        cells.append(parts)
    # 2 行目は、区切り（---）
    return [cells[0]] + cells[2:] if len(cells) > 1 and set(''.join(cells[1])) <= set('-: ') else cells


def build_sheet(ws, md_text):
    ws.sheet_view.showGridLines = False
    for i, w in enumerate(COL_WIDTHS):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i + 1)].width = w
    row = 1
    lines = md_text.split('\n')
    i = 0

    def put_text(text, *, bold=False, size=11, fill=None, color=None, mono=False, indent=0):
        nonlocal row
        cell = ws.cell(row=row, column=1, value=text)
        ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=len(COL_WIDTHS))
        cell.alignment = Alignment(wrap_text=True, vertical='top', indent=indent)
        cell.font = Font(bold=bold, size=size, color=color, name='Consolas' if mono else None)
        if fill:
            for c in range(1, len(COL_WIDTHS) + 1):
                ws.cell(row=row, column=c).fill = PatternFill('solid', fgColor=fill)
        ws.row_dimensions[row].height = max(18, lines_needed(text, TOTAL_WIDTH - 4 - indent * 2) * (size + 6))
        row += 1

    while i < len(lines):
        line = lines[i].rstrip()
        # コードのかたまり
        if line.strip().startswith('```'):
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i].rstrip())
                i += 1
            i += 1
            for b in block:
                put_text(b, mono=True, fill='EEF3F0', indent=1)
            row += 0
            continue
        # 表
        if line.strip().startswith('|'):
            table = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                table.append(lines[i])
                i += 1
            data = parse_table(table)
            ncol = max(len(r) for r in data)
            for ri, r in enumerate(data):
                height = 1
                for ci in range(ncol):
                    value = r[ci] if ci < len(r) else ''
                    cell = ws.cell(row=row, column=ci + 1, value=value)
                    cell.alignment = Alignment(wrap_text=True, vertical='top')
                    cell.border = BORDER
                    if ri == 0:
                        cell.fill = PatternFill('solid', fgColor=GREEN)
                        cell.font = Font(bold=True, color='FFFFFF')
                    height = max(height, lines_needed(value, COL_WIDTHS[ci] - 2 if ci < len(COL_WIDTHS) else 30))
                ws.row_dimensions[row].height = max(20, height * 17)
                row += 1
            row += 1
            continue
        # 見出し
        m = re.match(r'^(#{1,4})\s+(.*)$', line)
        if m:
            level = len(m.group(1))
            text = clean(m.group(2))
            if level == 1:
                put_text(text, bold=True, size=18, color=GREEN)
                row += 1
            elif level == 2:
                row += 0
                put_text(text, bold=True, size=13, fill='E3F4EA')
            else:
                put_text(text, bold=True, size=12)
            i += 1
            continue
        # 空行
        if not line.strip():
            if row > 1:
                ws.row_dimensions[row].height = 8
                row += 1
            i += 1
            continue
        # 箇条書き・番号つき・文章
        m = re.match(r'^(\s*)[-*]\s+(.*)$', line)
        if m:
            depth = len(m.group(1)) // 2
            put_text('・' + clean(m.group(2)), indent=1 + depth)
        else:
            m = re.match(r'^(\s*)(\d+)\.\s+(.*)$', line)
            if m:
                put_text(f'{m.group(2)}. {clean(m.group(3))}', indent=1 + len(m.group(1)) // 3)
            else:
                put_text(clean(line))
        i += 1
    ws.freeze_panes = None
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1


def main():
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    made = []
    for filename, title in SHEETS:
        path = SRC / filename
        if not path.exists():
            print(f'見つかりません（飛ばしました）: {filename}')
            continue
        ws = wb.create_sheet(title)
        build_sheet(ws, path.read_text(encoding='utf-8'))
        ws.sheet_properties.tabColor = GREEN
        made.append(title)
    try:
        wb.save(OUT)
    except PermissionError:
        print('保存できませんでした。マニュアル.xlsx を開いたままなら、閉じてから、もう一度実行してください。')
        sys.exit(1)
    print(f'書き出しました: {OUT}')
    print('タブ: ' + ' / '.join(made))


if __name__ == '__main__':
    main()
