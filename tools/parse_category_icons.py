# 使い方（プロジェクトの直下で）: python tools/parse_category_icons.py
#  tools/categoryIcon.xlsx を読んで、アイコン（ファイル名）と商品名の対応を調べ、
#  src/constants/categoryIconData.js を作る（生成物。直接編集しない）。問題点は画面に出す。
#  詳しい手順は docs/claude/icons.md
import difflib, json, os, subprocess, sys
import openpyxl
from openpyxl.cell.rich_text import CellRichText, TextBlock

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, 'tools', 'categoryIcon.xlsx')
OUT = os.path.join(ROOT, 'src', 'constants', 'categoryIconData.js')
SVG_DIR = os.path.join(ROOT, 'src', 'assets', 'categoryIcons')
# 同じ商品名が、別の中分類にもあって、中分類ごとに、アイコンを変えたいもの（例: 魚の「ぶり」は、切り身・丸魚は「さかなたち」、刺身・寿司ネタは「すし」）
#  tools/categoryIconOverrides.json: [{ main, product, default（ふだんのアイコン）, by_category（中分類 → アイコン）}]
OVERRIDES_PATH = os.path.join(ROOT, 'tools', 'categoryIconOverrides.json')
OVERRIDES = json.load(open(OVERRIDES_PATH, encoding='utf-8')) if os.path.exists(OVERRIDES_PATH) else []
OVERRIDE_ICONS = {(o['main'], o['product']): {o['default'], *o.get('by_category', {}).values()} for o in OVERRIDES}

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
            if key in OVERRIDE_ICONS and icon in OVERRIDE_ICONS[key]:
                seen_product.setdefault(key, icon)
                continue  # 中分類ごとに、アイコンを分ける指定（categoryIconOverrides.json）。下で、まとめて作る
            if key in seen_product and seen_product[key] != icon:
                problems['dup_product'].append(f'「{main} {name}」が、{seen_product[key]} と {icon} の 2 つにある')
                continue
            seen_product[key] = icon
            entries.append((icon, name, main))

# 作ったデータ: 大分類 → 商品名 → アイコン名
data = {}
for icon, name, main in entries:
    data.setdefault(main, {})[name] = icon
# 中分類ごとに、アイコンを変える商品: 大分類 → 商品名 → 中分類 → アイコン名（ふだんのアイコンは、上の data に入れる）
overrides_data = {}
used_icons = set()
cats_of = {(t['name'], p): set() for t in tree for m in t['categories'] for s in m['subCategories'] for p in s['items']}
for t in tree:
    for m in t['categories']:
        for s in m['subCategories']:
            for p in s['items']:
                cats_of[(t['name'], p)].add(m['name'])
for o in OVERRIDES:
    main, name = o['main'], o['product']
    if (main, name) not in cats_of:
        problems['unknown'].append(f'categoryIconOverrides.json: 「{main} {name}」は今の表に無い')
        continue
    for cat in o.get('by_category', {}):
        if cat not in cats_of[(main, name)]:
            problems['unknown'].append(f'categoryIconOverrides.json: 「{main} {name}」は、中分類「{cat}」には無い（{"・".join(sorted(cats_of[(main, name)]))}）')
    data.setdefault(main, {})[name] = o['default']
    overrides_data.setdefault(main, {})[name] = dict(o.get('by_category', {}))
    used_icons.update([o['default'], *o.get('by_category', {}).values()])
# アイコンが無い商品（新しく足した商品・提案で増えた商品）に使う、同じ小分類・同じ中分類の、いちばん多く使われているアイコン
#  大分類 → 中分類 → { default: 中分類のアイコン, subs: { 小分類: 小分類のアイコン } }
from collections import Counter
fallback = {}
for t in tree:
    for m in t['categories']:
        mid_count = Counter()
        subs = {}
        for s in m['subCategories']:
            sub_count = Counter()
            for p in s['items']:
                ic = data.get(t['name'], {}).get(p)
                if ic:
                    mid_count[ic] += 1
                    sub_count[ic] += 1
            if sub_count:
                subs[s['name']] = sub_count.most_common(1)[0][0]
        if mid_count:
            fallback.setdefault(t['name'], {})[m['name']] = {'default': mid_count.most_common(1)[0][0], 'subs': subs}
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    f.write('// 商品ごとのアイコン（大分類 → 商品名 → アイコンのファイル名。拡張子なし）\n')
    f.write('// ※ tools/categoryIcon.xlsx から tools/parse_category_icons.py で自動生成。直接編集しない（docs/claude/icons.md）\n')
    f.write('export const CATEGORY_ICON_MAP = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n')
    f.write('\n// 同じ商品名でも、中分類ごとに、アイコンを変えるもの（大分類 → 商品名 → 中分類 → アイコンのファイル名）。ここに無い中分類は、上の CATEGORY_ICON_MAP のアイコン\n')
    f.write('export const CATEGORY_ICON_OVERRIDES = ' + json.dumps(overrides_data, ensure_ascii=False, indent=2) + ';\n')
    f.write('\n// アイコンが無い商品に使う、同じ小分類・同じ中分類で、いちばん多く使われているアイコン（大分類 → 中分類 → { default, subs: { 小分類 } }）\n')
    f.write('export const CATEGORY_ICON_FALLBACK = ' + json.dumps(fallback, ensure_ascii=False, indent=2) + ';\n')

icons = sorted(set(seen_icon))
for ic in sorted(used_icons):
    if ic not in seen_icon:
        problems['unknown'].append(f'categoryIconOverrides.json: アイコン「{ic}」は、Excel の B 列に無い')
missing_svg = [i for i in icons if not os.path.exists(os.path.join(SVG_DIR, i + '.svg'))]
no_icon = [(m, n) for m, names in products.items() for n in sorted(names) if n not in data.get(m, {})]
print(f'アイコン {len(icons)} 個、対応した商品名 {len(entries)} 件、表の商品名 {sum(len(v) for v in products.values())} 件')
print(f'SVG ファイルが無いアイコン: {len(missing_svg)} 個（{SVG_DIR}）')
for k, label in [('unknown', '表に無い商品名'), ('color_mismatch', '色と大分類が合わない'), ('ambiguous', '色で決められない'),
                 ('dup_icon', 'アイコン名の重複'), ('dup_product', '商品名が複数のアイコンにある')]:
    print(f'★{label}: {len(problems[k])} 件')
    for p in problems[k][:40]:
        print('   ', p)
print(f'アイコンの無い商品名: {len(no_icon)} 件（同じ小分類→同じ中分類の、いちばん多いアイコンを、代わりに使う）')
for m, n in no_icon[:20]:
    print('   ', m, n)
