# 承認したカテゴリの提案を、tools/categoryTable.xlsx に足す（半自動。手順は docs/procedures.md「承認した提案の反映」）
#
# 使い方（プロジェクトの直下で）:
#   python tools/apply_proposals.py 提案.csv            # 何を足すかを表示するだけ（Excel は変えない）
#   python tools/apply_proposals.py 提案.csv --apply    # Excel に足す（元のファイルは tools/categoryTable.backup.xlsx に控える）
#   python tools/apply_proposals.py --rebuild           # Excel から categoryData.js を作り直し、Edge Function 用のコピーも更新する
#
# 提案.csv: Supabase の SQL Editor で、承認した提案を出して、結果を CSV でダウンロードしたもの（UTF-8）。
#   必要な列: kind, main_category, category, sub_category, product_name
#   足せる列: products（新しい中分類・小分類に入れる商品名。「、」か「,」で区切る。管理者が決める）
#   例（承認した提案を出す SQL）:
#     select kind, main_category, category, sub_category, product_name, note
#     from public.category_proposals where status = 'approved' order by reviewed_at;
#
# 足し方（Excel の並びは、大分類のシート → 中分類 → 小分類 → 商品名）:
#   ・kind = product: 今ある小分類の、いちばん下に、商品名を足す
#   ・kind = sub:     今ある中分類の、いちばん下に、新しい小分類と、products の商品名を足す
#   ・kind = category: そのシートの、いちばん下に、新しい中分類（と、あれば小分類・商品名）を足す
#   ・商品名が 1 つも無い新しい小分類・中分類は、足さずに報告する（商品名を products に書いてから、もう一度）
#   ・すでにある名前は、飛ばす（2 回実行しても、二重にならない）
import copy
import csv
import os
import re
import shutil
import subprocess
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, 'tools', 'categoryTable.xlsx')
BACKUP = os.path.join(ROOT, 'tools', 'categoryTable.backup.xlsx')


def clean(v):
    return re.sub(r'\s+', ' ', str(v).replace('　', ' ')).strip()


def fold(v):
    """名前を比べるための形（空白・記号・大文字小文字・ひらがな/カタカナの違いを無くす）"""
    import unicodedata
    t = unicodedata.normalize('NFKC', str(v)).lower()
    t = re.sub(r'[^\w]', '', t)
    return ''.join(chr(ord(c) - 0x60) if 'ァ' <= c <= 'ヶ' else c for c in t)


# ---------- Excel を読む（tools/parse_xlsx.py と同じ読み方） ----------
def read_sheet(ws):
    first = [next((i for i in range(1, 8) if ws.cell(r, i).value is not None), None) for r in range(3, ws.max_row + 1)]
    first = [c for c in first if c is not None]
    base = (min(first) - 1) if first else 0
    mids = []
    mid = sub = None
    for r in range(3, ws.max_row + 1):
        a, b, c, d = [ws.cell(r, base + i).value for i in range(1, 5)]
        if isinstance(a, int) and isinstance(b, str):
            mid = {'row': r, 'name': clean(b), 'num': a, 'subs': [], 'last': r}
            mids.append(mid)
            sub = None
        elif isinstance(b, int) and isinstance(c, str) and mid is not None:
            sub = {'row': r, 'name': clean(c), 'num': b, 'products': [], 'last': r}
            mid['subs'].append(sub)
            mid['last'] = r
        elif isinstance(d, str) and sub is not None:
            sub['products'].append({'row': r, 'name': clean(d), 'num': c if isinstance(c, int) else None})
            sub['last'] = r
            mid['last'] = r
    return base, mids


def insert_row(ws, idx, style_from):
    """idx 行に、空の行を入れる（結合セルもいっしょにずらす。書式は style_from 行から写す）"""
    merged = [(m.min_row, m.max_row, m.min_col, m.max_col) for m in list(ws.merged_cells.ranges) if m.min_row >= idx]
    for m in list(ws.merged_cells.ranges):
        if m.min_row >= idx:
            ws.unmerge_cells(str(m))
    ws.insert_rows(idx)
    for r1, r2, c1, c2 in merged:
        ws.merge_cells(start_row=r1 + 1, end_row=r2 + 1, start_column=c1, end_column=c2)
    src = style_from if style_from < idx else style_from + 1
    for c in range(1, ws.max_column + 1):
        ws.cell(idx, c)._style = copy.copy(ws.cell(src, c)._style)
    if ws.row_dimensions[src].height:
        ws.row_dimensions[idx].height = ws.row_dimensions[src].height


# ---------- 提案を読む ----------
def read_csv(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    items = []
    for r in rows:
        g = lambda k: clean(r.get(k) or '')
        products = [clean(x) for x in re.split(r'[、,]', r.get('products') or '') if clean(x)]
        items.append({
            'kind': g('kind'), 'main': g('main_category'), 'category': g('category'),
            'sub': g('sub_category'), 'product': g('product_name'), 'products': products,
        })
    return items


def plan_and_apply(xlsx, items, apply):
    wb = openpyxl.load_workbook(xlsx)
    report = {'added': [], 'skipped': [], 'problems': []}

    def sheet_info(name):
        ws = wb[name]
        base, mids = read_sheet(ws)
        return ws, base, mids

    for it in items:
        kind, main = it['kind'], it['main']
        label = f"{main} > {it['category']}" + (f" > {it['sub']}" if it['sub'] else '') + (f" > {it['product']}" if it['product'] else '')
        if main not in wb.sheetnames:
            report['problems'].append(f'{label}: 大分類「{main}」のシートがありません')
            continue

        # 毎回読み直す（前の提案で、行がずれているため）
        ws, base, mids = sheet_info(main)
        col = lambda n: base + n  # 1 = 中分類の番号, 2 = 中分類の名前 ...

        mid = next((m for m in mids if fold(m['name']) == fold(it['category'])), None)

        def put_products(at_row, sub, names, style_row):
            """sub の下（at_row の次の行から）に、商品名を足す。足した行数を返す"""
            n = 0
            existing = {fold(p['name']) for p in sub['products']} if sub else set()
            num = max([p['num'] or 0 for p in sub['products']], default=0) if sub else 0
            for name in names:
                if fold(name) in existing:
                    report['skipped'].append(f'{label}: 商品名「{name}」は、すでにあります')
                    continue
                num += 1
                insert_row(ws, at_row + 1 + n, style_row)
                ws.cell(at_row + 1 + n, col(3)).value = num
                ws.cell(at_row + 1 + n, col(4)).value = name
                existing.add(fold(name))
                report['added'].append(f'商品名「{name}」')
                n += 1
            return n

        if kind == 'product':
            if mid is None:
                report['problems'].append(f"{label}: 中分類「{it['category']}」が表にありません")
                continue
            sub = next((s for s in mid['subs'] if fold(s['name']) == fold(it['sub'])), None)
            if sub is None:
                report['problems'].append(f"{label}: 小分類「{it['sub']}」が表にありません")
                continue
            if not it['product']:
                report['problems'].append(f'{label}: 商品名が空です')
                continue
            style = sub['products'][-1]['row'] if sub['products'] else sub['row']
            put_products(sub['last'], sub, [it['product']], style)

        elif kind == 'sub':
            if mid is None:
                report['problems'].append(f"{label}: 中分類「{it['category']}」が表にありません")
                continue
            if any(fold(s['name']) == fold(it['sub']) for s in mid['subs']):
                report['skipped'].append(f"{label}: 小分類「{it['sub']}」は、すでにあります")
                continue
            if not it['products']:
                report['problems'].append(f"{label}: 新しい小分類に入れる商品名がありません（CSV の products 列に書いてください）")
                continue
            sub_style = mid['subs'][0]['row'] if mid['subs'] else mid['row']
            prod_style = next((s['products'][-1]['row'] for s in mid['subs'] if s['products']), mid['last'])
            sub_row = mid['last'] + 1
            insert_row(ws, sub_row, sub_style)
            ws.cell(sub_row, col(2)).value = len(mid['subs']) + 1
            ws.cell(sub_row, col(3)).value = it['sub']
            report['added'].append(f"小分類「{it['sub']}」")
            put_products(sub_row, None, it['products'], prod_style)

        elif kind == 'category':
            if mid is not None:
                report['skipped'].append(f"{label}: 中分類「{it['category']}」は、すでにあります")
                continue
            if not it['sub'] or not it['products']:
                report['problems'].append(f"{label}: 新しい中分類には、小分類と商品名が要ります（CSV の sub_category と products 列に書いてください）")
                continue
            last = mids[-1] if mids else None
            if last is None:
                report['problems'].append(f'{label}: シート「{main}」に、中分類が 1 つもありません')
                continue
            sub_style = last['subs'][0]['row'] if last['subs'] else last['row']
            prod_style = next((s['products'][-1]['row'] for m in reversed(mids) for s in m['subs'] if s['products']), last['last'])
            mid_row = last['last'] + 1
            insert_row(ws, mid_row, last['row'])
            ws.cell(mid_row, col(1)).value = max(m['num'] for m in mids) + 1
            ws.cell(mid_row, col(2)).value = it['category']
            report['added'].append(f"中分類「{it['category']}」")
            insert_row(ws, mid_row + 1, sub_style)
            ws.cell(mid_row + 1, col(2)).value = 1
            ws.cell(mid_row + 1, col(3)).value = it['sub']
            report['added'].append(f"小分類「{it['sub']}」")
            put_products(mid_row + 1, None, it['products'], prod_style)
        else:
            report['problems'].append(f"{label}: 知らない kind「{kind}」です（category / sub / product）")

    if apply and report['added']:
        shutil.copyfile(xlsx, BACKUP)
        wb.save(xlsx)
    return report


def rebuild():
    """Excel から categoryData.js を作り直し、Edge Function 用のコピーを更新する（docs/procedures.md「カテゴリ表の更新手順」の 2〜3, 8）"""
    work = os.path.join(ROOT, 'tools')
    tmp = os.path.join(work, '.parsed_tree_tmp')
    os.makedirs(tmp, exist_ok=True)
    env = dict(os.environ, PYTHONIOENCODING='utf-8')
    subprocess.run([sys.executable, os.path.join(work, 'parse_xlsx.py'), XLSX], cwd=tmp, check=True, env=env)
    out = os.path.join(ROOT, 'src', 'constants', 'categoryData.js')
    subprocess.run([sys.executable, os.path.join(work, 'gen_category_data.py'), os.path.join(tmp, 'parsed_tree.json'),
                    os.path.join(work, 'readings.tsv'), out], check=True, env=env)
    shutil.rmtree(tmp, ignore_errors=True)
    subprocess.run('npm run sync-categories', cwd=ROOT, shell=True, check=True)
    print('\n次: ★よみがな未登録 の警告があれば、tools/readings.tsv に、ひらがなで足して、もう一度 --rebuild。')
    print('その後: npm run build → ユーザーが npm run deploy-functions')


def main():
    args = sys.argv[1:]
    if '--rebuild' in args:
        rebuild()
        return
    paths = [a for a in args if not a.startswith('--')]
    if not paths:
        print(__doc__)
        sys.exit(1)
    apply = '--apply' in args
    xlsx = XLSX
    if '--xlsx' in args:  # 試すとき用（別の Excel を使う）
        xlsx = args[args.index('--xlsx') + 1]
        paths = [p for p in paths if p != xlsx]
    items = read_csv(paths[0])
    report = plan_and_apply(xlsx, items, apply)
    print(f"提案 {len(items)} 件 → {'Excel に足しました' if apply and report['added'] else '足す予定（--apply で足す）' if report['added'] else '足すものはありません'}")
    for a in report['added']:
        print('  ＋', a)
    for s in report['skipped']:
        print('  （飛ばし）', s)
    for p in report['problems']:
        print('  ★', p)
    if apply and report['added']:
        print(f'\n元の Excel は {BACKUP} に控えました。次: python tools/apply_proposals.py --rebuild')


if __name__ == '__main__':
    main()
