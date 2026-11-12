import openpyxl, json, re, sys
p = sys.argv[1]
wb = openpyxl.load_workbook(p)
def clean(v):
    return re.sub(r'\s+', ' ', str(v).replace('　',' ')).strip()
tree = []
warnings = []
for ws in wb.worksheets:
    top = {'name': clean(ws.title), 'categories': []}
    mid = sub = None
    # 中分類が書かれている列。ふつうは A 列だが、シートによって 1 列右にずれていることがある（例: 野菜果物）。
    #  3 行目以降の、いちばん左に値のある列を「中分類の列」とみなす（番号の列 → 名前の列の順に並ぶ）
    base = 0
    first_cols = [
        next((i for i in range(1, 8) if ws.cell(r, i).value is not None), None)
        for r in range(3, ws.max_row + 1)
    ]
    first_cols = [c for c in first_cols if c is not None]
    if first_cols:
        base = min(first_cols) - 1
        if base:
            warnings.append((ws.title, 3, f'列が {base} つ右にずれているシート（自動で合わせた）', None))
    for r in range(3, ws.max_row + 1):
        a, b, c, d = [ws.cell(r, base + i).value for i in range(1, 5)]
        if isinstance(a, int) and isinstance(b, str):
            mid = {'name': clean(b), 'subCategories': []}; top['categories'].append(mid); sub = None
        elif isinstance(b, int) and isinstance(c, str):
            if mid is None: warnings.append((ws.title, r, '中分類の前に小分類', c)); continue
            sub = {'name': clean(c), 'items': []}; mid['subCategories'].append(sub)
        elif d is not None and isinstance(d, str):
            if sub is None: warnings.append((ws.title, r, '小分類の前に極小分類', d)); continue
            if not isinstance(c, int): warnings.append((ws.title, r, '番号なしの極小分類(採用)', d))
            sub['items'].append(clean(d))
        elif any(v is not None for v in (a, b, c, d)):
            warnings.append((ws.title, r, '未解釈の行', (a, b, c, d)))
    tree.append(top)
json.dump({'tree': tree, 'warnings': warnings}, open('parsed_tree.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)