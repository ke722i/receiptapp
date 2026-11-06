# 使い方: python3 gen_category_data.py parsed_tree.json readings.tsv 出力先.js
#  readings.tsv: 「商品名<TAB>よみがな（空白区切りで複数可）」の1行1件
import json, sys, collections, re
parsed, readings_tsv, out_js = sys.argv[1:4]
tree = json.load(open(parsed, encoding='utf-8'))['tree']
readings = {}
for line in open(readings_tsv, encoding='utf-8'):
    if line.strip():
        k, v = line.rstrip('\n').split('\t')
        readings[k] = v
all_items = []
for a in tree:
    for m in a['categories']:
        for s in m['subCategories']:
            for it in s['items']:
                if it not in all_items:
                    all_items.append(it)
missing = [x for x in all_items if re.search(r'[\u4e00-\u9fff々]', x) and x not in readings]
if missing:
    print('★よみがな未登録（漢字を含む商品）:', missing)

# 同じ小分類の中で同じ商品名が2回あれば止める（Excelの入力ミス検出）
for a in tree:
    for m in a['categories']:
        for s in m['subCategories']:
            dup = [k for k, v in collections.Counter(s['items']).items() if v > 1]
            assert not dup, (a['name'], m['name'], s['name'], dup)

TOP_IDS = {'常温': 'ambient', '冷蔵': 'chilled', '冷凍': 'frozen', '日用品': 'daily_goods'}
def q(s):
    assert "'" not in s and '\\' not in s, s
    return f"'{s}'"
out = ["// 全カテゴリ階層データ構造（大分類 > 中分類 > 小分類 > 極小分類=商品名）",
       "// ※ Excel「カテゴリ表」から自動生成。手で直す場合も4階層の形を保つこと",
       "export const CATEGORY_TREE = ["]
for ti, top in enumerate(tree):
    p = TOP_IDS.get(top['name'], f'top{ti+1}')
    out += ["  {", f"    id: '{p}_main',", f"    name: {q(top['name'])},", "    categories: ["]
    for mi, mid in enumerate(top['categories'], 1):
        out += ["      {", f"        id: '{p}_m{mi}',", f"        name: {q(mid['name'])},", "        subCategories: ["]
        out.append(',\n'.join(
            f"          {{ id: '{p}_m{mi}_s{si}', name: {q(sub['name'])}, items: [{', '.join(q(x) for x in sub['items'])}] }}"
            for si, sub in enumerate(mid['subCategories'], 1)))
        out += ["        ]", "      }" + ("," if mi < len(top['categories']) else "")]
    out += ["    ]", "  }" + ("," if ti < len(tree) - 1 else "")]
out += ["];", ""]
out += ["// 検索用のよみがな（漢字を含む商品のみ。カタカナ・ひらがなの商品名はそのまま検索できる）",
        "//  空白区切りで複数の読み方を登録できる（例: 'そば粉': 'そばこ'、'単3電池': 'たんさんでんち でんち'）",
        "export const CUSTOM_READING_MAP = {"]
entries = [f"  {q(k)}: {q(readings[k])}" for k in all_items if k in readings]
out.append(',\n'.join(entries))
out += ["};", "", "export const INITIAL_SEARCH_HISTORY = [];", "export const INITIAL_VIEW_HISTORY = [];", ""]
open(out_js, 'w', encoding='utf-8').write('\n'.join(out))
print('generated', out_js)