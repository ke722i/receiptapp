"""分類の間違いの記録（tools/wrongCategory.xlsx）から、「印字名 → 正しい商品」の辞書を作る。

使い方（プロジェクトの直下で）:
    python tools/build_print_dictionary.py            … 辞書を作って、結果を表示する
    python tools/build_print_dictionary.py --check    … 作らずに、結果だけを表示する

できるもの: supabase/functions/parse-receipt/printNameDictionary.js（生成物。手で直さない）
  レシートの解析（Edge Function）と、JSON の取り込み（tools/receipt_json_to_sql.mjs）が、AI の答えのあとに使う。
  作り直したら、npm run deploy-functions でデプロイする。

記録の読み方（シート「ミス」。1 件 = 2 行。結合セル）
  ・J 列 = 商品名（レシートの印字名）
  ・T 列 = カテゴリ。上の行 = 間違っていた分類、下の行 = 正しい分類（「？」は不明）
  ・「追加」の列（AC 列）は使わない（新しい分類は、アプリの提案から足す）
  ・購入日・店名・確認の列は使わない

辞書に入れるもの
  ・正しい分類の名前が、今のカテゴリ表で 1 か所に決まるもの（商品名 → 小分類 → 中分類の順に探す）
  ・同じ印字名で、正しい分類が食い違うものは入れない（どちらが正しいか、決められないため）
  ・「？」・空・未選択・表に無い名前は入れない（結果の表示で知らせる）
"""
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / 'tools' / 'wrongCategory.xlsx'
OUT = ROOT / 'supabase' / 'functions' / 'parse-receipt' / 'printNameDictionary.js'
SHEET = 'ミス'
COL_ITEM = 'J'
COL_CATEGORY = 'T'
UNKNOWN = {'', '?', '？', '未選択', 'その他', '不明'}


def fold(text):
    """catalog.js の foldName と同じ（全角半角・空白・大文字小文字を無視する）"""
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', str(text or ''))).lower()


def load_tree():
    """カテゴリ表（categoryData.js）を、node で読む"""
    js = (ROOT / 'supabase' / 'functions' / '_shared' / 'categoryData.js').as_uri()
    code = f"import('{js}').then((m) => process.stdout.write(JSON.stringify(m.CATEGORY_TREE)))"
    out = subprocess.run(['node', '-e', code], capture_output=True, check=True)
    return json.loads(out.stdout.decode('utf-8'))


def build_index(tree):
    products, subs, mids = {}, {}, {}
    for top in tree:
        for mid in top['categories']:
            mids.setdefault(fold(mid['name']), []).append({'main': top['name'], 'category': mid['name'], 'sub': None, 'product': None})
            for sub in mid.get('subCategories') or []:
                subs.setdefault(fold(sub['name']), []).append({'main': top['name'], 'category': mid['name'], 'sub': sub['name'], 'product': None})
                for item in sub.get('items') or []:
                    products.setdefault(fold(item), []).append({'main': top['name'], 'category': mid['name'], 'sub': sub['name'], 'product': item})
    return products, subs, mids


def resolve(name, index):
    """正しい分類の名前 → 表の場所（1 か所に決まらなければ、理由）。「A>B」の形なら、前の名前で絞る"""
    products, subs, mids = index
    parts = [p for p in re.split(r'[>＞]', str(name)) if p.strip()]
    last = fold(parts[-1]) if parts else ''
    hints = [fold(p) for p in parts[:-1]]
    for level, table in (('商品', products), ('小分類', subs), ('中分類', mids)):
        cands = table.get(last, [])
        if hints:
            cands = [c for c in cands if all(h in {fold(c['main']), fold(c['category']), fold(c['sub'] or '')} for h in hints)]
        if len(cands) == 1:
            return cands[0], level
        if len(cands) > 1:
            return None, f'{level}に同じ名前が {len(cands)} か所（' + ' / '.join(f"{c['main']}>{c['category']}" for c in cands) + '）'
    return None, '今のカテゴリ表に無い'


def read_records():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb[SHEET]
    item_col = openpyxl.utils.column_index_from_string(COL_ITEM)
    cat_col = openpyxl.utils.column_index_from_string(COL_CATEGORY)
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    records = []
    # 1 件 = 2 行（上 = 間違い、下 = 正しい）。印字名のある行を、件の始まりとみなす
    i = 0
    while i < len(rows):
        item = rows[i][item_col - 1]
        if item and str(item).strip():
            wrong = rows[i][cat_col - 1]
            right = rows[i + 1][cat_col - 1] if i + 1 < len(rows) else None
            records.append({'row': i + 2, 'item': str(item).strip(), 'wrong': str(wrong or '').strip(), 'right': str(right or '').strip()})
            i += 2
        else:
            i += 1
    return records


def main():
    check_only = '--check' in sys.argv
    index = build_index(load_tree())
    records = read_records()

    by_key = {}  # 畳んだ印字名 -> {'item', 'paths': {path_json: count}, 'wrong': set()}
    skipped = []
    for r in records:
        if r['right'] in UNKNOWN:
            skipped.append((r, '正しい分類が不明（？・空・未選択）'))
            continue
        path, why = resolve(r['right'], index)
        if not path:
            skipped.append((r, why))
            continue
        e = by_key.setdefault(fold(r['item']), {'item': r['item'], 'paths': {}, 'wrong': set()})
        k = json.dumps(path, ensure_ascii=False, sort_keys=True)
        e['paths'][k] = e['paths'].get(k, 0) + 1
        e['wrong'].add(r['wrong'])

    entries, conflicts = {}, []
    for key, e in sorted(by_key.items()):
        if len(e['paths']) > 1:
            conflicts.append(e)
            continue
        path = json.loads(next(iter(e['paths'])))
        entries[key] = {**path, 'count': sum(e['paths'].values()), 'item': e['item']}

    print(f'記録: {len(records)} 件 → 辞書: {len(entries)} 個の印字名')
    if skipped:
        print(f'\n入れなかった記録: {len(skipped)} 件')
        for r, why in skipped:
            print(f"  {r['row']:>4} 行  {r['item']}  （{r['wrong']} → {r['right'] or '空'}）: {why}")
    if conflicts:
        print(f'\n同じ印字名で、正しい分類が食い違うもの（入れない）: {len(conflicts)} 個')
        for e in conflicts:
            print(f"  {e['item']}: " + ' / '.join(f"{json.loads(k)['category']}>{json.loads(k)['product'] or json.loads(k)['sub'] or ''}（{n} 件）" for k, n in e['paths'].items()))

    if check_only:
        return

    lines = [
        '// 印字名 → 正しい商品の辞書（tools/wrongCategory.xlsx から自動生成。手で直さない）',
        '//  作り直し: python tools/build_print_dictionary.py → npm run deploy-functions',
        '//  キー: 印字名を foldName（全角半角・空白・大文字小文字を無視）で畳んだもの',
        '//  product が null のものは、小分類（sub）または中分類までの指定（AI の答えが、その中にあれば、AI の答えを使う）',
        'export const PRINT_NAME_DICTIONARY = {',
    ]
    for key, v in entries.items():
        val = {'main': v['main'], 'category': v['category'], 'sub': v['sub'], 'product': v['product']}
        lines.append(f"  {json.dumps(key, ensure_ascii=False)}: {json.dumps(val, ensure_ascii=False)}, // {v['item']}（{v['count']} 件）")
    lines.append('};')
    OUT.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'\n書き出しました: {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
