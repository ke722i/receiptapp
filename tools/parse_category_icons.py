# 使い方（プロジェクトの直下で）: python tools/parse_category_icons.py
#  tools/categoryIcon.xlsx を読んで、アイコン（ファイル名）と商品名の対応を調べ、
#  src/constants/categoryIconData.js を作る（生成物。直接編集しない）。問題点は画面に出す。
#  詳しい手順は docs/icons.md
import difflib, json, os, subprocess, sys
import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, 'tools', 'categoryIcon.xlsx')
OUT = os.path.join(ROOT, 'src', 'constants', 'categoryIconData.js')
SVG_DIR = os.path.join(ROOT, 'src', 'assets', 'categoryIcons')

# 商品名の文字の色 → 大分類（Excel の一番上に書いてある対応）
COLOR_TO_MAIN = {'FF00B050': '常温', 'FF0070C0': '冷蔵', 'FFFFC000': '冷凍', 'FFFF0000': '日用品'}

# 今のカテゴリ表: 大分類 → 商品名の集まり
js = ("import('file:///' + process.argv[1].replace(/\\\\/g,'/') + '/src/constants/categoryData.js')"
      ".then(m=>console.log(JSON.stringify(m.CATEGORY_TREE)))")
tree = json.loads(subprocess.run(['node', '-e', js, ROOT], capture_output=True, text=True, encoding='utf-8', check=True).stdout)
products = {}  # 大分類 → {商品名}
for a in tree:
    products[a['name']] = {it for m in a['categories'] for s in m['subCategories'] for it in s['items']}
mains_of = {}  # 商品名 → [大分類]
for main, names in products.items():
    for n in names:
        mains_of.setdefault(n, []).append(main)

ws = openpyxl.load_workbook(XLSX, rich_text=True).active


def runs(value):
    """セルの文字を (文字, 色) の並びにする（色が無い・黒は None）"""
    if isinstance(value, CellRichText):
        for part in value:
            if isinstance(part, TextBlock):
                c = part.font.color.rgb if part.font and part.font.color and part.font.color.type == 'rgb' else None
                yield str(part), c
            else:
                yield str(part), None
    else:
        yield str(value), None


entries = []   # (アイコン名, 商品名, 大分類)
problems = {'unknown': [], 'ambiguous': [], 'color_mismatch': [], 'dup_icon': [], 'dup_product': []}
seen_icon, seen_product = {}, {}
colored = {}  # 商品名 → 色を付けて書かれた大分類（先に集める）
# 先に、色を付けて書かれた (商品名, 大分類) を集める（色なしの名前が、これを上書きしないように）
for r in range(1, ws.max_row + 1):
    g = ws.cell(r, 7).value
    if g:
        for text, color in runs(g):
            for name in text.split('、'):
                if name.strip() and COLOR_TO_MAIN.get(color):
                    colored.setdefault(name.strip(), set()).add(COLOR_TO_MAIN[color])

for r in range(1, ws.max_row + 1):
    b, g = ws.cell(r, 2).value, ws.cell(r, 7).value
    if not b or not g or str(b).strip() in ('ファイル名 (.svg)',):
        continue
    icon = str(b).strip()
    if icon in seen_icon:
        problems['dup_icon'].append(f'{icon}（{seen_icon[icon]} 行と {r} 行）')
    seen_icon[icon] = r
    # 色ごとの文字をつなぎ、「、」で商品名に分ける（区切りの「、」の色は見ない）
    pieces = []  # (商品名, 色)
    for text, color in runs(g):
        for name in text.split('、'):
            name = name.strip()
            if name:
                pieces.append((name, color))
    # 「、」をまたいで 1 つの商品名の色が変わることは無いので、そのまま使う
    for name, color in pieces:
        want = COLOR_TO_MAIN.get(color)          # 色から決まる大分類（黒・その他の色は None）
        have = mains_of.get(name, [])
        if not have:
            near = difflib.get_close_matches(name, list(mains_of), n=3, cutoff=0.6)  # 表記のゆれ（呑/吞、全角/半角など）の候補
            hint = f'（もしかして: {"、".join(near)}）' if near else ''
            problems['unknown'].append(f'{icon}: 「{name}」は今の表に無い{hint}')
            continue
        if want and want not in have:
            problems['color_mismatch'].append(f'{icon}: 「{name}」は {want} の色だが、表では {"・".join(have)} にある')
            continue
        # 色あり → その大分類だけ。色なし → 名前がある大分類すべて（常温と冷凍に同じ名前があれば、両方に同じアイコン）
        targets = [want] if want else have
        for main in targets:
            if main in colored.get(name, ()) and not want:
                continue  # 色を付けて別のアイコンにした大分類は、色なしで上書きしない
            key = (main, name)
            if key in seen_product and seen_product[key] != icon:
                problems['dup_product'].append(f'「{main} {name}」が、{seen_product[key]} と {icon} の 2 つにある')
                continue
            seen_product[key] = icon
            entries.append((icon, name, main))

# 作ったデータ: 大分類 → 商品名 → アイコン名
data = {}
for icon, name, main in entries:
    data.setdefault(main, {})[name] = icon
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 商品ごとのアイコン（大分類 → 商品名 → アイコンのファイル名。拡張子なし）\n')
    f.write('// ※ tools/categoryIcon.xlsx から tools/parse_category_icons.py で自動生成。直接編集しない（docs/icons.md）\n')
    f.write('export const CATEGORY_ICON_MAP = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')

icons = sorted(set(seen_icon))
missing_svg = [i for i in icons if not os.path.exists(os.path.join(SVG_DIR, i + '.svg'))]
no_icon = [(m, n) for m, names in products.items() for n in sorted(names) if n not in data.get(m, {})]
print(f'アイコン {len(icons)} 個、対応した商品名 {len(entries)} 件、表の商品名 {sum(len(v) for v in products.values())} 件')
print(f'SVG ファイルが無いアイコン: {len(missing_svg)} 個（{SVG_DIR}）')
for k, label in [('unknown', '表に無い商品名'), ('color_mismatch', '色と大分類が合わない'), ('ambiguous', '色で決められない'),
                 ('dup_icon', 'アイコン名の重複'), ('dup_product', '商品名が複数のアイコンにある')]:
    print(f'★{label}: {len(problems[k])} 件')
    for p in problems[k][:40]:
        print('   ', p)
print(f'アイコンの無い商品名: {len(no_icon)} 件')
