"""TEST_ITEMS.md を、テスターが結果を書き込める Excel（.xlsx）に変換する。

使い方（プロジェクトの直下で）:
    python tools/export_test_items.py [入力の md] [出力の xlsx]
    既定: TEST_ITEMS.md → TEST_ITEMS.xlsx

シート:
    使い方 / 集計 / 機能一覧 / 単体テスト / 結合テスト / 見た目の確認 / 不具合一覧 / 既知の未対応 / 変更履歴 / 付録(開発者向け)
集計:
    合格率 = OK ÷（項目数 − 対象外）。全体・シートごと・区分ごとを、数式で自動計算する。
注意:
    作り直すと、Excel に書き込んだ結果は、消える（上書きされる）。
    テスターに渡したあとは、項目書を更新しても、渡した Excel を作り直さず、別名で出力して、差分だけ反映すること。
"""
import re
import sys
from datetime import date

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

SRC = sys.argv[1] if len(sys.argv) > 1 else "TEST_ITEMS.md"
DST = sys.argv[2] if len(sys.argv) > 2 else "TEST_ITEMS.xlsx"

RED = "E53935"  # アプリのヘッダーと同じ赤
THIN = Side(style="thin", color="CCCCCC")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
HEADER_FILL = PatternFill("solid", fgColor=RED)
HEADER_FONT = Font(bold=True, color="FFFFFF")
SECTION_FILL = PatternFill("solid", fgColor="FDECEA")
WRAP_TOP = Alignment(wrap_text=True, vertical="top")
CENTER_TOP = Alignment(horizontal="center", vertical="top")


def clean(text):
    """Markdown の記号（バッククォート・太字）を取り除く"""
    text = text.replace("`", "").replace("**", "")
    return text.strip()


def split_row(line):
    """表の1行（| a | b | c |）を、セルのリストにする"""
    return [clean(c) for c in line.strip().strip("|").split("|")]


def is_separator(line):
    return bool(re.match(r"^\|\s*-{2,}", line))


with open(SRC, encoding="utf-8") as f:
    LINES = [l.rstrip("\n") for l in f]


def section_range(start_prefix, end_prefix=None):
    """「## 〜」で始まる章の、行の範囲（開始, 終了）を返す"""
    start = next(i for i, l in enumerate(LINES) if l.startswith(start_prefix))
    end = len(LINES)
    for i in range(start + 1, len(LINES)):
        if LINES[i].startswith("## ") and (end_prefix is None or LINES[i].startswith(end_prefix) or True):
            end = i
            break
    return start, end


def parse_tables(start, end):
    """範囲の中の、表を全部読む。小見出し（###）・「前提:」の行も、いっしょに記録する"""
    tables = []
    heading = ""
    premise = ""
    i = start
    while i < end:
        line = LINES[i]
        if line.startswith("### "):
            heading = clean(line[4:])
            premise = ""
        elif line.startswith("前提:"):
            premise = clean(line[3:])
        elif line.startswith("|") and i + 1 < end and is_separator(LINES[i + 1]):
            header = split_row(line)
            rows = []
            i += 2
            while i < end and LINES[i].startswith("|"):
                rows.append(split_row(LINES[i]))
                i += 1
            tables.append({"heading": heading, "premise": premise, "header": header, "rows": rows})
            continue
        i += 1
    return tables


def style_header(ws, widths):
    for col, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col)].width = width
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    ws.row_dimensions[1].height = 24


def add_result_columns(ws, result_col, last_row):
    """「結果」の列に、OK / NG / 対象外 の選択肢と、色を付ける"""
    letter = get_column_letter(result_col)
    rng = f"{letter}2:{letter}{max(last_row, 2) + 200}"  # 項目を足しても使えるよう、余裕を持たせる
    dv = DataValidation(type="list", formula1='"OK,NG,対象外"', allow_blank=True)
    dv.error = "OK・NG・対象外 から選んでください"
    dv.errorTitle = "結果"
    ws.add_data_validation(dv)
    dv.add(rng)
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"OK"'], fill=PatternFill("solid", bgColor="C8E6C9", fgColor="C8E6C9")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"NG"'], fill=PatternFill("solid", bgColor="FFCDD2", fgColor="FFCDD2")))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"対象外"'], fill=PatternFill("solid", bgColor="E0E0E0", fgColor="E0E0E0")))
    # 日付の列（結果の次）は、日付の表示にする
    for r in range(2, last_row + 1):
        ws.cell(row=r, column=result_col + 1).number_format = "yyyy-mm-dd"


def fill_sheet(ws, headers, data, widths, result_col=None):
    ws.append(headers)
    for row in data:
        ws.append(row)
    style_header(ws, widths)
    for r in range(2, ws.max_row + 1):
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=r, column=c)
            cell.alignment = WRAP_TOP
            cell.border = BORDER
        ws.cell(row=r, column=1).font = Font(bold=True)
        if result_col:
            ws.cell(row=r, column=result_col).alignment = CENTER_TOP
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{ws.max_row}"
    if result_col:
        add_result_columns(ws, result_col, ws.max_row)


wb = Workbook()

# ---------- 使い方 ----------
ws = wb.active
ws.title = "使い方"
s, e = section_range("## 1. テストを行う方へ")
lines = LINES[s:e]
ws.column_dimensions["A"].width = 120
in_code = False
for l in lines:
    if l.startswith("```"):
        in_code = not in_code
        continue
    if l.startswith("## "):
        ws.append([clean(l[3:])])
        c = ws.cell(row=ws.max_row, column=1)
        c.font = Font(bold=True, size=14, color="FFFFFF")
        c.fill = HEADER_FILL
        continue
    if l.startswith("### "):
        ws.append([clean(l[4:])])
        c = ws.cell(row=ws.max_row, column=1)
        c.font = Font(bold=True, size=12)
        c.fill = SECTION_FILL
        continue
    text = clean(l)
    if text.startswith("- "):
        text = "・" + text[2:]
    elif text.startswith("  - "):
        text = "　　・" + text[4:]
    if in_code:
        ws.append([text])
        ws.cell(row=ws.max_row, column=1).font = Font(name="MS Gothic")
    else:
        ws.append([text])
    ws.cell(row=ws.max_row, column=1).alignment = Alignment(wrap_text=True, vertical="top")
ws.sheet_properties.tabColor = RED

# ---------- 機能一覧 ----------
s, e = section_range("## 2. 機能の一覧と状態")
feature = parse_tables(s, e)[0]
ws = wb.create_sheet("機能一覧")
fill_sheet(ws, feature["header"], feature["rows"], [8, 44, 28, 70])

# ---------- 単体テスト ----------
s, e = section_range("## 3. 単体テスト")
unit_rows = []
for t in parse_tables(s, e):
    header = t["header"]
    group = re.sub(r"^3-([A-Z0-9]+)\.\s*", r"\1. ", t["heading"])
    for r in t["rows"]:
        r = r + [""] * (len(header) - len(r))
        d = dict(zip(header, r))

        def pick(*names):
            """列の名前が、括弧つき（例: 「操作（店名 / 店舗名 を入力して、登録）」）でも、読み取る"""
            for name in names:
                for key, value in d.items():
                    if key == name or key.startswith(name + "（"):
                        if value:
                            return value
            return ""

        action = pick("操作", "確認すること")
        # 見出しの括弧の中の説明（例: 「操作（店名 / 店舗名 を入力して、登録）」）を、操作の頭に付ける
        #（「AEON / 堺店」のように、入力する値だけが書かれた行にだけ付ける）
        for key in header:
            if key.startswith("操作（") and key.endswith("）") and re.match(r"^[^ ]+ / [^ ]+", action):
                action = f"{key[3:-1]}：{action}"
        expected = pick("期待結果", "期待")
        premise = pick("前提") or t["premise"]
        unit_rows.append([d["ID"], group, premise, action, expected, "", None, "", d.get("メモ", "")])
ws = wb.create_sheet("単体テスト")
fill_sheet(ws, ["ID", "区分", "前提", "操作", "期待結果", "結果", "実施日", "担当", "メモ"], unit_rows, [11, 22, 30, 52, 58, 9, 12, 10, 28], result_col=6)
ws.sheet_properties.tabColor = "4CAF50"

# ---------- 結合テスト ----------
s, e = section_range("## 4. 結合テスト")
it_rows = []
for t in parse_tables(s, e):
    header = t["header"]
    group = re.sub(r"^4-(\d)\.\s*", r"4-\1 ", t["heading"])
    for r in t["rows"]:
        r = r + [""] * (len(header) - len(r))
        d = dict(zip(header, r))
        premise = " ／ ".join(x for x in (t["premise"], d.get("前提", "")) if x)
        it_rows.append([d["ID"], group, premise, d.get("手順", ""), d.get("期待結果", ""), "", None, "", d.get("メモ", "")])
ws = wb.create_sheet("結合テスト")
fill_sheet(ws, ["ID", "区分", "前提", "手順", "期待結果", "結果", "実施日", "担当", "メモ"], it_rows, [9, 24, 30, 60, 58, 9, 12, 10, 28], result_col=6)
ws.sheet_properties.tabColor = "2196F3"

# ---------- 見た目の確認 ----------
s, e = section_range("## 5. 見た目・操作感の確認")
mt = parse_tables(s, e)[0]
mt_rows = [[r[0], r[1], r[2], "", None, "", r[4] if len(r) > 4 else ""] for r in mt["rows"]]
ws = wb.create_sheet("見た目の確認")
fill_sheet(ws, ["ID", "確認すること", "期待", "結果", "実施日", "担当", "メモ"], mt_rows, [11, 36, 66, 9, 12, 10, 28], result_col=4)
ws.sheet_properties.tabColor = "FF9800"

# ---------- 不具合一覧（空） ----------
ws = wb.create_sheet("不具合一覧")
bug_headers = ["番号", "項目ID", "やったこと（手順）", "期待した結果", "実際の結果", "画面に出たメッセージ", "再現性",
               "端末・ブラウザ", "日時", "ログインしたユーザーID", "スクリーンショット", "状態", "開発者のメモ"]
ws.append(bug_headers)
style_header(ws, [7, 12, 40, 30, 30, 28, 12, 22, 16, 18, 18, 14, 30])
for r in range(2, 202):
    ws.cell(row=r, column=1, value=r - 1)
    for c in range(1, len(bug_headers) + 1):
        cell = ws.cell(row=r, column=c)
        cell.alignment = WRAP_TOP
        cell.border = BORDER
    ws.cell(row=r, column=9).number_format = "yyyy-mm-dd hh:mm"
dv1 = DataValidation(type="list", formula1='"毎回,ときどき,1回だけ"', allow_blank=True)
dv2 = DataValidation(type="list", formula1='"未対応,修正済み（再テスト待ち）,再テストOK,対象外"', allow_blank=True)
ws.add_data_validation(dv1)
ws.add_data_validation(dv2)
dv1.add("G2:G201")
dv2.add("L2:L201")
ws.freeze_panes = "C2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(bug_headers))}201"
ws.sheet_properties.tabColor = RED

# ---------- 既知の未対応 ----------
s, e = section_range("## 6. 既知の未対応")
known = []
for l in LINES[s:e]:
    if l.startswith("- "):
        known.append([len(known) + 1, clean(l[2:])])
ws = wb.create_sheet("既知の未対応")
fill_sheet(ws, ["番号", "内容（テスト対象外。バグではなく、今の仕様の穴）"], known, [7, 130])

# ---------- 変更履歴 ----------
s, e = section_range("## 7. 変更履歴")
hist = []
group = ""
for l in LINES[s:e]:
    if l.startswith("### "):
        group = clean(l[4:])
    elif l.startswith("- "):
        body = clean(l[2:])
        left, _, right = body.partition(" → ")
        hist.append([group, left, right])
ws = wb.create_sheet("変更履歴")
fill_sheet(ws, ["日付・内容のまとまり", "変更の内容", "確認する項目（ID）"], hist, [40, 80, 60])

# ---------- 付録（開発者向け） ----------
s, e = section_range("## 8. 付録")
dev = []
sect = ""
for l in LINES[s:e]:
    if l.startswith("### 8-"):
        sect = clean(re.sub(r"^### 8-\d+\.\s*", "", l))
    m = re.match(r"^- \[ \] (DV-[A-Z0-9]+-\d+) (.*)$", l)
    if m:
        body = m.group(2)
        checked = "○" if body.rstrip().endswith("○") else ""
        body = re.sub(r"[\s　]*○\s*$", "", body)
        dev.append([m.group(1), sect, clean(body), checked])
ws = wb.create_sheet("付録(開発者向け)")
fill_sheet(ws, ["ID", "節", "内容（入力 → 期待結果）", "一時"], dev, [15, 38, 120, 7])
ws.sheet_properties.tabColor = "9E9E9E"

# ---------- 集計（合格率） ----------
# 合格率 = OK ÷（項目数 − 対象外）。対象外は、分母から除く。未実施は、合格に数えない。
#   例: 50件・50 OK → 100% ／ 50件・25 OK・25 NG → 50% ／ 50件・45 OK・5 対象外 → 100%
# 数式にしてあるので、「結果」を選ぶたびに、自動で再計算される。
SPARE = 200  # 項目を足しても数えられるよう、余裕を持たせる（add_result_columns と同じ）


def build_summary(wb, sources, groups):
    """sources: [(シート名, 項目数, 結果の列, 区分の列 or None)]  groups: [(シート名, 区分名)]"""
    ws = wb.create_sheet("集計")
    headers = ["", "項目数", "OK", "NG", "対象外", "未実施", "合格率", "実施率"]
    ws.append(headers)
    style_header(ws, [46, 10, 9, 9, 9, 9, 11, 11])

    def rng(sheet, col, last):
        return f"'{sheet}'!${col}$2:${col}${last + SPARE}"

    def rate_formulas(r):
        # 合格率 = OK ÷（項目数 − 対象外）、実施率 =（OK + NG）÷（項目数 − 対象外）
        ws.cell(row=r, column=6, value=f"=B{r}-C{r}-D{r}-E{r}")
        ws.cell(row=r, column=7, value=f"=IF(B{r}-E{r}<=0,0,C{r}/(B{r}-E{r}))")
        ws.cell(row=r, column=8, value=f"=IF(B{r}-E{r}<=0,0,(C{r}+D{r})/(B{r}-E{r}))")

    # 1 行目: 全体 / 2〜: シートごと
    first, last_row_of_sheets = 3, 2 + len(sources)
    ws.append(["全体（すべてのテスト）"] + [None] * 7)
    for sheet, count, result_col, _ in sources:
        r = ws.max_row + 1
        letter = get_column_letter(result_col)
        ws.append([sheet,
                   f"=COUNTA({rng(sheet, 'A', count + 1)})",
                   f'=COUNTIF({rng(sheet, letter, count + 1)},"OK")',
                   f'=COUNTIF({rng(sheet, letter, count + 1)},"NG")',
                   f'=COUNTIF({rng(sheet, letter, count + 1)},"対象外")'])
        rate_formulas(r)
    # 全体 = シートごとの合計
    for col in "BCDE":
        ws[f"{col}2"] = f"=SUM({col}{first}:{col}{last_row_of_sheets})"
    rate_formulas(2)

    # 区分ごと
    ws.append([])
    ws.append(["区分ごと（単体テスト・結合テスト）", "項目数", "OK", "NG", "対象外", "未実施", "合格率", "実施率"])
    for cell in ws[ws.max_row]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = BORDER
    by_sheet = {s: (c, rc, gc) for s, c, rc, gc in sources}
    for sheet, group in groups:
        count, result_col, group_col = by_sheet[sheet]
        r = ws.max_row + 1
        rl, gl = get_column_letter(result_col), get_column_letter(group_col)
        g = group.replace('"', '""')
        ws.append([f"{sheet} ／ {group}",
                   f'=COUNTIF({rng(sheet, gl, count + 1)},"{g}")',
                   f'=COUNTIFS({rng(sheet, gl, count + 1)},"{g}",{rng(sheet, rl, count + 1)},"OK")',
                   f'=COUNTIFS({rng(sheet, gl, count + 1)},"{g}",{rng(sheet, rl, count + 1)},"NG")',
                   f'=COUNTIFS({rng(sheet, gl, count + 1)},"{g}",{rng(sheet, rl, count + 1)},"対象外")'])
        rate_formulas(r)

    # 見た目
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
        label = row[0].value
        if label is None:
            continue
        is_header = row[0].fill == HEADER_FILL
        for cell in row:
            cell.border = BORDER
            cell.alignment = Alignment(horizontal="left" if cell.column == 1 else "center", vertical="center", wrap_text=True)
        row[6].number_format = "0.0%"
        row[7].number_format = "0.0%"
        if not is_header:
            row[0].font = Font(bold=True)
    for cell in ws[2]:  # 全体の行は、目立たせる
        cell.font = Font(bold=True, size=14)
        cell.fill = SECTION_FILL
    ws.row_dimensions[2].height = 30
    ws["G2"].font = Font(bold=True, size=16, color=RED)

    # 説明
    note_row = ws.max_row + 2
    notes = [
        "【合格率の計算】 OK ÷（項目数 − 対象外）。対象外は、分母から除く。未実施は、合格に数えない。",
        "　例: 50件・50 OK・0 NG・0 対象外 → 100%　／　50件・25 OK・25 NG・0 対象外 → 50%　／　50件・45 OK・0 NG・5 対象外 → 100%",
        "【実施率】（OK + NG）÷（項目数 − 対象外）。どこまで進んだか。",
        "【自動で計算】 各シートの「結果」を選ぶと、この表が自動で更新される。この表の数式は、直さないこと。",
    ]
    for i, text in enumerate(notes):
        c = ws.cell(row=note_row + i, column=1, value=text)
        c.alignment = Alignment(wrap_text=False, vertical="top")
    ws.freeze_panes = "B2"
    ws.sheet_properties.tabColor = "4CAF50"
    # 「使い方」の次（2枚目）に置く
    wb.move_sheet(ws, offset=-(wb.index(ws) - 1))
    return ws


unit_groups = list(dict.fromkeys(r[1] for r in unit_rows))
it_groups = list(dict.fromkeys(r[1] for r in it_rows))
build_summary(
    wb,
    [("単体テスト", len(unit_rows), 6, 2), ("結合テスト", len(it_rows), 6, 2), ("見た目の確認", len(mt_rows), 4, None)],
    [("単体テスト", g) for g in unit_groups] + [("結合テスト", g) for g in it_groups],
)

wb.properties.title = "レシート即！メモ テスト項目書"
wb.properties.creator = "RESOKU運営チーム"
wb.save(DST)

print(f"出力: {DST}")
print(f"  単体テスト {len(unit_rows)} / 結合テスト {len(it_rows)} / 見た目の確認 {len(mt_rows)} / 付録 {len(dev)} / 既知の未対応 {len(known)} / 変更履歴 {len(hist)} / 機能 {len(feature['rows'])}")
