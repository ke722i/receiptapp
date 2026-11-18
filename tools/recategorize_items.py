"""DB に入っている明細の「分類」を、印字名から見直す（番号のずれ・Gemini の番号まちがいで、ずれた分類を直す）
使い方（プロジェクトの直下で）:
  1. Supabase の SQL Editor で、次を実行して、結果を CSV で保存し、tools/receipt_json/db_items.csv に置く（No limit にする）
       select i.item_name, i.main_category, i.category, i.sub_category, i.product_name, count(*) as n
       from public.receipt_items i join public.receipts r on r.id = i.receipt_id
       where r.user_id = 'ここにあなたのUID' group by 1,2,3,4,5 order by 2,3,4,5,1;
  2. python tools/recategorize_items.py propose     → tools/receipt_json/分類の確認表.xlsx（印字名ごとの、今の分類と、新しい分類の提案）
  3. Excel を見て、まちがいは、「新しい分類」の 4 つの列（大・中・小・商品名）を直す。変更しないものは「変更する」を消す（空にする）
  （実行の前に、バックアップとして、id つきの CSV を取っておくと、あとで、id ごとに、正確に戻せる:
    select i.id, i.item_name, i.main_category, i.category, i.sub_category, i.product_name from public.receipt_items i
    join public.receipts r on r.id = i.receipt_id where r.user_id = 'ここにあなたのUID' order by i.id;  → tools/receipt_json/db_items_ids.csv）
  4. python tools/recategorize_items.py sql         → tools/receipt_json/recategorize.sql（Excel の「変更する」の行だけを、直す SQL）
     SQL Editor で、「ここにあなたのUID」を直して実行する。
SQL は、「印字名」と「今の分類」が、Excel の行と完全に一致する明細だけを更新する（あとから、アプリで直した分は、触らない）。2 回実行しても、同じ結果になる。
"""
import csv
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / 'tools/receipt_json/db_items.csv'
XLSX_PATH = ROOT / 'tools/receipt_json/分類の確認表.xlsx'
SQL_PATH = ROOT / 'tools/receipt_json/recategorize.sql'
UNDO_PATH = ROOT / 'tools/receipt_json/recategorize_undo.sql'

# ---------- カテゴリ表（今の categoryData.js） ----------
TREE_JSON = subprocess.run(
    ['node', '--input-type=module', '-e',
     "import { CATEGORY_TREE } from './src/constants/categoryData.js'; console.log(JSON.stringify(CATEGORY_TREE));"],
    capture_output=True, text=True, encoding='utf-8', cwd=ROOT, check=True).stdout
TREE = json.loads(TREE_JSON)
PATHS = []  # (main, category, sub, product)
for top in TREE:
    for mid in top['categories']:
        for sub in mid.get('subCategories', []):
            for p in sub.get('items', []):
                PATHS.append((top['name'], mid['name'], sub['name'], p))
BY_PRODUCT = {}
for path in PATHS:
    BY_PRODUCT.setdefault(path[3], []).append(path)
MIDS = {(t['name'], m['name']) for t in TREE for m in t['categories']}
UNSELECTED = (None, '未選択', None, None)


def kk(s):
    """ひらがな → カタカナ、全角半角をそろえる（照合用）"""
    s = unicodedata.normalize('NFKC', s or '').lower()
    return ''.join(chr(ord(c) + 0x60) if 'ぁ' <= c <= 'ゖ' else c for c in s)


def resolve(spec, row=None):
    """目標を、(大, 中, 小, 商品名) にする。spec: 商品名／'大>中>小>商品名'／'大>中'／'未選択'"""
    if spec == '未選択':
        return UNSELECTED
    if '>' in spec:
        parts = spec.split('>')
        if len(parts) == 4:
            assert tuple(parts) in PATHS, spec
            return tuple(parts)
        if len(parts) == 2:
            assert tuple(parts) in MIDS, spec
            return (parts[0], parts[1], None, None)
        raise ValueError(spec)
    found = BY_PRODUCT.get(spec)
    assert found, f'カテゴリ表に商品名が無い: {spec}'
    if len(found) > 1 and row is not None:
        same_main = [p for p in found if p[0] == row['main']]
        if len(same_main) == 1:
            return same_main[0]
    assert len(found) == 1, f'同じ商品名が複数ある: {spec} {found}'
    return found[0]


# ---------- ルール（上から順に、最初に当たったものを使う） ----------
RULES = []  # (正規表現（カタカナにそろえて照合）, 目標, 条件, ルールの名前)


def rule(pattern, target, cond=None, name=''):
    RULES.append((re.compile(kk(pattern)), target, cond, name or pattern))


def is_(main=None, cat=None, sub=None):
    def f(r):
        return (main is None or r['main'] == main) and (cat is None or r['cat'] == cat) and (sub is None or r['sub'] == sub)
    return f


any_main = None
NOT_IN_PRODUCE = lambda r: r['main'] != '野菜果物'  # noqa: E731

# --- 分類の対象外（お金・袋・百均の雑貨）→ 未選択 ---
for pat in [r'^送料$', r'ポイント割引', r'自動割引', r'名入れ料金', r'^見切り品', r'メビウス', r'バルーン', r'フェルト', r'ハッピークラッカー',
            r'散らからないクラッカー', r'ココナッツボタン', r'スマホスタンド', r'スリムファイル', r'つっぱり棒用棚', r'エコール', r'装飾チャーム',
            r'口元空間', r'^百均(?!.*(保存用ポリ|レインコート))', r'接触冷感', r'耐衝撃', r'星光', r'ピュアモルト', r'ディズニーソース', r'^テリア', r'ハローファーム', r'^とのものも',
            r'冷たくしておいしい', r'エスセレクト Profe', r'オミセデアゲ', r'Rグレディ', r'^オリジナル$']:
    rule(pat, '未選択', None, '雑貨・不明')

# --- 袋 ---
rule(r'レジ袋|ショッパー|クラフト紙袋|ハンドルバッグ|クラフトジップ袋|^袋$|便利な袋|レジフクロ', '日用品>キッチン消耗品・ゴミ処理>ゴミ袋・ポリ袋>レジ袋', None, '袋')

# --- 日用品 ---
rule(r'ふせん', 'メモ帳・付箋', is_('日用品'), 'ふせん')
rule(r'ライター', 'ライター', is_('日用品'), 'ライター')
rule(r'リチウムコイン', 'コイン電池', is_('日用品'), '電池')
rule(r'LED自転車', '電球・LED電球', is_('日用品'), 'LED')
rule(r'クローゼットハンガー', 'ハンガー', is_('日用品'), 'ハンガー')
rule(r'今治リバーシブル', 'フェイスタオル', is_('日用品'), 'タオル')
rule(r'ソックス|ソッ$', '靴下', is_('日用品'), '靴下')
rule(r'ナイーブ.*(替|BD|ハワイ)', 'ボディソープ', is_('日用品'), 'ボディソープ')
rule(r'アルカリ電解水', '住居用洗剤', is_('日用品'), '洗剤')
rule(r'スクレーパー', '掃除用ブラシ', is_('日用品'), '掃除')
rule(r'トイレマジックリン', 'トイレ用洗剤', is_('日用品'), '洗剤')
rule(r'キュキュット', '食器用洗剤', is_('日用品'), '洗剤')
rule(r'ボールド', '洗濯用洗剤（ジェルボール）', is_('日用品'), '洗剤')
rule(r'粘着シートスペア|エス強粘着|粘着スペア', '粘着クリーナー（コロコロ）', is_('日用品'), '粘着')
rule(r'おそうじシート', '使い捨て掃除シート', is_('日用品'), '掃除シート')
rule(r'ベンザブロック', '風邪薬', is_('日用品'), '薬')
rule(r'マスク', '不織布マスク', is_('日用品'), 'マスク')
rule(r'デンタ|クリーンN?ミント', '歯磨き粉', is_('日用品'), '歯磨き')
rule(r'UVリキッドファンデ|UVメイクアップベース|薬用 ?UV', '化粧品', is_('日用品'), '化粧品')
rule(r'マツエク|サロンラッシュ|リボンティント', '化粧品', is_('日用品'), '化粧品')
rule(r'YOLU|ヘアオイル', 'トリートメント', is_('日用品'), 'ヘアケア')
rule(r'ふっくら１１歳|ふっくら11歳', 'ペットフード', is_('日用品'), 'ペット')
rule(r'ゴン太', 'ペット用おやつ', is_('日用品'), 'ペット')
rule(r'おしりふき', 'おしりふき', is_('日用品'), 'おしりふき')
rule(r'オアシストイレ', 'トイレットペーパー', is_('日用品'), 'トイレットペーパー')
rule(r'水切りネット|排水口ﾘﾝｸﾞ|排水口リング|ミズキリストッキング', '水切りネット', is_('日用品'), '水切りネット')
rule(r'BIBIGO|ビビゴ|スイギョウザ|水マンドゥ', '餃子', is_('日用品'), '冷凍餃子')
rule(r'グリエハンバーグ', 'ハンバーグ', is_('日用品'), '冷凍ハンバーグ')
rule(r'ねぎ餃子', '餃子(生・チルド)', None, '餃子')
rule(r'国産はまぐり', 'はまぐり', is_('日用品'), '貝')
rule(r'活しじみ', 'しじみ', is_('日用品'), '貝')

# --- 冷凍アイス（常温の菓子に入っていたもの）---
ICE = '冷凍>デザート・スイーツ・アイス>アイス類・氷>アイスクリーム類'
rule(r'ガリガリ君|アイス ?BOX|赤城 ?ブラック', '冷凍>デザート・スイーツ・アイス>アイス類・氷>かき氷・シャーベット', is_('常温', '菓子'), 'アイス')
rule(r'BRULEEMI|ＢＲＵＬＥＥＭＩ|エッセル|クーリッシュ|グリコ NEWジャ|セルフチョコクラッ|チョコモナカ|パピコ|モナ王|ピノ|ビスケットサンド|ルマンドムース|雪見だいふく|パナップ',
     ICE, is_('常温', '菓子', '和菓子(常温)'), 'アイス')
rule(r'クーリッシュ', ICE, is_('冷凍'), 'アイス')
rule(r'スクールマンゴー', '炭酸飲料', is_('冷凍'), '飲料')

# --- 飲料（常温）---
D = is_('常温', '飲料')
# 乾物（ナッツ・ドライフルーツ）に入っていた飲み物
rule(r'ポカリスエット', 'スポーツドリンク', is_('常温'), 'スポーツドリンク')
rule(r'ノミズ', 'ミネラルウォーター', is_('常温'), '水')
rule(r'オチャヤサン', '緑茶', is_('常温'), '茶')
rule(r'コーン茶', 'コーン茶', D, '茶')
rule(r'ジャスミン', 'ジャスミン茶', D, '茶')
rule(r'ルイボス', 'ルイボスティー', D, '茶')
rule(r'お[～〜~]?いお茶玄米|玄米茶', '玄米茶', D, '茶')
rule(r'ポカリ|アクエリ|ダカラ|DAKARA|スポーツ', 'スポーツドリンク', D, 'スポーツドリンク')
rule(r'ミネラルウォーター|天然水$|^ワカヤマユアサノミズ|ノミズ', 'ミネラルウォーター', D, '水')
rule(r'野菜生活|野菜ジュース|1日分の野菜', '野菜ジュース', is_('常温', '飲料', 'お茶・紅茶(ペットボトル・缶)'), '野菜ジュース')
rule(r'サンキスト|森永 ?P?フルーツ|森永 食物繊維|家族の潤い', '紙パックジュース', D, '紙パック')
rule(r'コカ|ペプシ|ファンタ|サイダー|ドデカミン|スカッシュ|スカ$|ギルティ|マッチ|炭酸|ソーダ|モンスター|レモネード|クリームソーダ|ドク[タラ]|スコール|カナダドライ|冷檸檬|ジンジャー|コーラ|がぶ飲み|CCレモン',
     '炭酸飲料', is_('常温', '飲料', 'ジュース・清涼飲料'), '炭酸')
rule(r'コカ|ペプシ|ファンタ|サイダー|ドデカミン|スカッシュ|ギルティ|マッチ|炭酸|ソーダ|モンスター|レモネード|コーラ|CCレモン|カナダドライ', '炭酸飲料',
     is_('常温', '飲料', 'お茶・紅茶(ペットボトル・缶)'), '炭酸')
rule(r'カルピスリッチ|味わいカルピス', '機能性飲料', is_('常温', '飲料'), '機能性飲料')
rule(r'三ツ矢', '炭酸飲料', is_('常温', '飲料'), '炭酸')
rule(r'ファイアワンデイ|ファイアラテ', 'ペットボトルコーヒー', is_('常温', '飲料', 'お茶・紅茶(ペットボトル・缶)'), 'コーヒー')
rule(r'キレートレモン|クー(オレンジ|りんご)|Qoo|ミニッツメイド|ピクニック|オレンジマン|果汁|ジュース', '果汁ジュース', is_('常温', '飲料', 'ジュース・清涼飲料'), 'ジュース')
rule(r'ティーバ', 'ティーバッグ', D, 'ティーバッグ')
rule(r'LW ?ｳｰﾛﾝ|ウーロン|烏龍', '烏龍茶', D, '茶')
rule(r'麦茶|ムギチャ|むぎ茶', '麦茶', D, '茶')
rule(r'お[～〜~]?いお茶|綾鷹|伊右衛門|生茶|緑茶|ほうじ茶|抹茶', '緑茶', D, '茶')
rule(r'紅茶|ティー|ミルクティ|チャイ|ﾃｨｰ', '紅茶', D, '茶')
rule(r'ネスレ ?ココア', '粉末ココア', D, 'ココア')
rule(r'カフェ抹茶ラテ', '粉末緑茶', D, '抹茶')
rule(r'ボトル|クラフトボス|ブレンディ ?低糖|ブレンディ ボトル', 'ペットボトルコーヒー', D, 'コーヒー')
rule(r'^１９６無糖|^196無糖', '缶チューハイ', is_('常温', '飲料'), 'チューハイ')
rule(r'アサヒビール ?スタイル', '発泡酒', is_('常温', '飲料'), '発泡酒')

# --- 酒類 ---
rule(r'カプリコ', 'チョコレート', is_('常温', '酒類'), 'お菓子')
rule(r'マイクポップコーン', 'ポップコーン', is_('常温', '酒類'), 'お菓子')

# --- 菓子（スナック菓子）---
SN = is_('常温', '菓子')
rule(r'栗どら|大どら|ふわどら', 'どら焼き', SN, '和菓子')
rule(r'串団子', '団子', SN, '和菓子')
rule(r'トリュフアソート|ゼロカカオ', 'チョコレート', SN, 'チョコ')
rule(r'ポップコーン|マイクポップ', 'ポップコーン', SN, 'ポップコーン')
rule(r'チップスター|ポテトチップ|ポテチ|ピザポテト|カラムーチョ|堅あげ|オーザック|ア・ラ・ポテト|ポテコ|ガチじゃが|キャニスター|じゃがバター味|関西だし|チップス(うすしお|コンソメ)', 'ポテトチップス', SN, 'ポテトチップス')
rule(r'うまい輪|たこやき亭|さやえんどう|じゃがりこ|とんがりコーン|ハウスとんがり|明治カール|スコーン|サッポロポテト|サッポロバーベ|サッポロッツブ|ポリンキー|ボリンキー|おっとっと|エアリアル|ドリトス|ビッグカツ|タラタラ|ラーメン丸|いか姿あげ|鶏皮チップス|すずめの卵|ミニサラダ|ドデカチーズ|パックル|バックル|コク旨カレ|味カレー|PGアメリカン|ＴＶ薄切り芋',
     'スナック', SN, 'スナック')

rule(r'ぶっといチョコ|チョコボール', 'チョコレート', SN, 'チョコ')
rule(r'アンリ 焼菓子|フィナンシェ', '焼き菓子', SN, '焼き菓子')
rule(r'大福', 'もち菓子', SN, '和菓子')
rule(r'フルーチェマスカット', 'ゼリーの素', SN, 'デザートの素')
rule(r'やわらか＆もちもち食パン', '食パン', is_('常温'), 'パン')
rule(r'スイートチョコリン', '菓子パン', is_('常温'), 'パン')
rule(r'コーンソフトバター', '惣菜パン', is_('常温'), 'パン')
rule(r'あおさ粉', 'ふりかけ', is_('常温'), 'ふりかけ')
# --- 麺類（インスタント）---
N = is_('常温', '麺類')
rule(r'どん兵衛.*(そば|蕎麦)|とろろそば|ぶったまそば', 'カップそば', N, '麺')
rule(r'皿うどん', '中華麺', N, '麺')
rule(r'ちゃんぽ', '即席ちゃんぽん', N, '麺')
rule(r'スープはるさめ', '即席春雨麺', N, '麺')
rule(r'日清 ?焼そば(5食|バラ袋|$)|日清焼そば5食', '袋焼きそば', N, '麺')
rule(r'UFO|油そば|まぜそ|夜店|ごつ盛りソース|焼そばスパイシー|超大盛焼そば', 'カップ焼きそば', N, '麺')
rule(r'^焼そば$', 'カップ焼きそば', N, '麺')
rule(r'サッポロ一番|アンパンマンらーめ|チキンラーメン|正麺|棒ラーメン|ごつ盛り醤油', '袋ラーメン', N, '麺')
rule(r'鍋焼|きつね|あっさりおいしいカップ', 'カップうどん', N, '麺')
rule(r'シーフードヌードル|塩ラーメン|ゆず香る塩|ラーメン|豚キムチ|タンメ|醤油とんこつ|ごつ盛り|濃厚', 'カップラーメン', N, '麺')
rule(r'岡井.*うどん', 'うどん', N, '麺')
rule(r'岡井.*そば', 'そば', N, '麺')
rule(r'コパン(コーン|濃厚)', 'ポタージュスープ', N, 'スープ')
rule(r'ミツカンカンタンス', '酢', N, '酢')

# --- 常温の食材・調味料 ---
rule(r'^ウスターソース', 'ウスターソース', is_('常温', '料理の素・つゆ・スープ類'), 'ソース')
rule(r'トンカツソース', 'とんかつソース', is_('常温', '料理の素・つゆ・スープ類'), 'ソース')
rule(r'プロクオリティ', 'カレールウ', None, 'ルウ')
rule(r'ビーフシチュー', 'レトルトシチュー', is_('常温'), 'シチュー')
rule(r'ほっとシチュークリ', 'シチュールウ', is_('常温'), 'シチュー')
rule(r'久世福万能ごま', 'ごまだれ', is_('常温'), 'ごま')
rule(r'本鰹だし|おんち', '顆粒だし', is_('常温'), 'だし')
rule(r'ソフトパン粉', 'パン粉', is_('常温'), '粉')
rule(r'たこ焼粉', 'たこ焼き粉', is_('常温'), '粉')
rule(r'チューブでバター', 'バター', None, 'バター')
rule(r'ブルガリア|プレーンヨーグルト|ヨーグルト|ダノン|ナチュレ|ビヒダス|ビフィックス|BifiX|恵ナチュレ', 'ヨーグルト', lambda r: r['main'] in ('常温', '冷蔵') and r['cat'] != '菓子' and r['prod'] not in ('乳酸菌飲料', '飲むヨーグルト'), 'ヨーグルト')
rule(r'富良野特選牛|牧場のやさしい想い|おいしい牛乳|浜中産おいしい牛', '牛乳', lambda r: r['main'] == '常温', '牛乳')
rule(r'ホールトマト', 'トマト缶(ホール)', is_('常温'), '缶')
rule(r'おかずのり|韓国味付|ジャパンのり|ｼﾞｬﾊﾞﾝﾉﾘ', '韓国のり', is_('常温'), 'のり')
rule(r'混ぜ込み赤しそ|三島のゆかり|ゆかり', 'ふりかけ', is_('常温'), 'ふりかけ')
rule(r'桜小えび', '干しエビ', is_('常温'), '干しエビ')
rule(r'たけのこ輪切', 'タケノコ水煮', None, 'タケノコ')
rule(r'[ぶぷ]ち浅漬|浅漬|おかず漬物彩り', '浅漬け', None, '漬物')
rule(r'彩りミックスサラダ', 'サラダミックス', None, 'サラダ')
rule(r'ピュアセレクト', 'マヨネーズ', is_('常温'), 'マヨネーズ')
rule(r'リコピンリッチトマ', 'ケチャップ', is_('常温'), 'ケチャップ')
rule(r'ニンニクポンズ|味ぽん', 'ポン酢', is_('常温'), 'ポン酢')
rule(r'たこ焼ソース', 'お好みソース', is_('常温'), 'ソース')
rule(r'ヘルシークリア', 'なたね油', is_('常温'), '油')
rule(r'フルーティスシャインマ', 'ぶどう', is_('常温'), '果物')
rule(r'OSAKA RICE|マイコシヒカリ', '白米', is_('常温'), '米')
rule(r'DケチャップD76', 'ケチャップ', is_('常温'), 'ケチャップ')
rule(r'お料理自慢料理酒', '料理酒', is_('常温'), '料理酒')
rule(r'日清W具材たこ焼粉', 'たこ焼き粉', is_('常温'), '粉')

# --- パン（常温）---
B = is_('常温', 'パン・シリアル')
rule(r'シュークリームカス', 'シュークリーム', B, 'パン')
rule(r'ブランデーケーキ', '焼き菓子', B, 'パン')
rule(r'ロールケーキ|ロールC', '焼き菓子', is_('常温'), 'ケーキ')
rule(r'赤りんご', 'りんご', B, '果物')
rule(r'明太子チーズナン', 'ナン(生・チルド)', B, 'ナン')
rule(r'サムソーチーズ|チーズクリームくるみ|ベーコンポテトＦＲ|ベーコンポテトFR|明太ポテトフランス|ミートボール', '惣菜パン', is_('常温', '飲料'), 'パン')
rule(r'２種さつま芋|2種さつま芋', '菓子パン', is_('常温', '飲料'), 'パン')
rule(r'シスコーン|コーンフレーク', 'コーンフレーク', is_('常温', 'パン・シリアル', 'シリアル'), 'シリアル')
rule(r'スイートポテト|蒸しぱん|蒸しパン|蒸しケーキ', '菓子パン', B, 'パン')
rule(r'食パン|ブレッド|麦穂|B&B|レーズンゴールド|ロイヤルブレッド|デニッシュブレッド|チョコとミルクのデニッ', '食パン', B, 'パン')
rule(r'クロワッサン(?!サンド)|わっさ', 'クロワッサン', is_('常温'), 'パン')
rule(r'ベーグル', 'ベーグル', B, 'パン')
rule(r'ロール(パン)?$|バターロー|ルヴァン|ミルクロール|マーガリンロール|くるみロ|ベルギーチョコロール|シュガーロール|切ったロール|ネオレーズン|レーズンバターロール', 'ロールパン', B, 'パン')
rule(r'ソース|焼そば|焼きそば|やきそば|マルゲリ|ネギ|カレ|ポーク|ハムマヨ|ハム|たまご|タマゴ|玉子|ツナ|ポテト(?!チップ)|ベーコン|ソーセージ|ウインナー|カレー|ピザ|ハンバーガー|チーズ|明太|マヨ|ミートボール|コロッケ|カツ|サンド|ドッグ|てりやき|ランチパック|ナポリ',
     '惣菜パン', B, 'パン')
rule(r'.', '菓子パン', lambda r: r['main'] == '常温' and r['cat'] == 'パン・シリアル' and r['sub'] != 'シリアル', 'パン（その他）')

# --- 冷蔵・乳製品・加工品 ---
rule(r'味付けモズク|もずく', 'もずく', is_('冷蔵'), 'もずく')
rule(r'ユデニホンソバ|岡井食産和そば|生そば', '生そば', is_('冷蔵'), '麺')
rule(r'エスセレクト千切りキ', '千切りキャベツ', None, '野菜')
rule(r'味のりおにぎり|塩にぎり', 'お弁当', is_('冷蔵'), 'おにぎり')
rule(r'ジャンボアメリカン|ｼﾞｬﾝﾎﾞｱﾒﾘｶﾝ|ファミチキ|メロメロプルコギ|手羽唐揚げ|オーロラチキンバーガー|ミートドリア|焼きカレードリア|中華名菜 酢豚', 'お惣菜', is_('冷蔵'), '惣菜')
rule(r'^ちゃんぽん$', '生中華麺', is_('冷蔵'), '麺')
rule(r'大学蜜芋|さつまいも甘煮', 'さつまいも煮', is_('冷蔵'), '惣菜')
rule(r'羽根つき餃', '餃子(生・チルド)', is_('冷蔵'), '餃子')
rule(r'^ポテトサラダ$', 'サラダ類', is_('冷蔵'), '惣菜')
rule(r'タケダハム', 'ハム', is_('冷蔵'), 'ハム')
rule(r'ゴールデンウインナ', 'ソーセージ・ウインナー', is_('冷蔵'), 'ウインナー')
rule(r'新鮮玉子', '卵', is_('冷蔵'), '卵')
rule(r'ごちそう生活', '卵', None, '卵')
rule(r'もっちり.*厚揚|便利美味しい絹厚揚|濃厚もっちり絹厚揚', '厚揚げ', is_('冷蔵'), '厚揚げ')
rule(r'やわらか油あげ|味付けうどんあげ', '油揚げ', is_('冷蔵'), '油揚げ')
rule(r'板こん', 'こんにゃく', is_('冷蔵'), 'こんにゃく')
rule(r'糸こん|黒糸', 'しらたき', None, 'しらたき')
rule(r'とろ[〜~]?りチーズ', 'チーズ', None, 'チーズ')
rule(r'スジャータホイップ', '生クリーム', None, 'クリーム')
rule(r'京(鳳|風)京都木綿', '豆腐', None, '豆腐')
rule(r'BP国産大根おろし', '大根', None, '野菜')
rule(r'土佐黒もんぶり|生たら切身', '冷凍魚', is_('冷凍'), '魚')
rule(r'辛子明太子', '辛子明太子', is_('冷凍'), '魚卵')
rule(r'えびグラタン', '冷凍グラタン', is_('冷凍', '食卓用メインおかず'), 'グラタン')
rule(r'本格炒め炒飯', 'チャーハン', is_('冷凍', '食卓用メインおかず'), 'チャーハン')
rule(r'神戸名物そばめし', 'そばめし', is_('冷凍'), 'そばめし')
rule(r'自家製ソースのピザ', '冷凍ピザ', is_('冷凍'), 'ピザ')
rule(r'新鮮玉子|ごちそう生活', '卵', None, '卵')

# --- 野菜・果物・きのこ ---
V = lambda r: r['main'] == '野菜果物' or (r['main'] == '常温' and r['cat'] == '乾物・粉類・豆類' and r['sub'] == '乾物・削り節')  # noqa: E731
VX = lambda r: V(r) or r['main'] == '常温'  # noqa: E731
rule(r'もやし', 'もやし', lambda r: V(r) and r['sub'] != 'カット野菜・サラダ', '野菜')
rule(r'えのき', 'えのき', V, 'きのこ')
rule(r'ぶなしめじ|平茸|しめじ', 'しめじ', V, 'きのこ')
rule(r'エリンギ', 'エリンギ', V, 'きのこ')
rule(r'なめこ', 'なめこ', V, 'きのこ')
rule(r'椎茸|しいたけ', 'しいたけ', V, 'きのこ')
rule(r'^(ミニ)?ブロッコリー$', 'ブロッコリー', V, '野菜')
rule(r'^ピーマン$', 'ピーマン', V, '野菜')
rule(r'キュウリ|胡瓜(?!巻)', 'きゅうり', V, '野菜')
rule(r'^ニラ$', 'ニラ', V, '野菜')
rule(r'国内産皮むき銀杏', '野菜果物>根菜・いも類', None, '銀杏')
rule(r'ほうれん草', 'ほうれん草', V, '野菜')
rule(r'小松菜', '小松菜', V, '野菜')
rule(r'レンコン', 'れんこん', V, '野菜')
rule(r'青首大根|^ダイコン', '大根', V, '野菜')
rule(r'にんにく', 'にんにく', V, '野菜')
rule(r'玉ねぎ|たまねぎ|タマネギ|玉葱', '玉ねぎ', V, '野菜')
rule(r'しろねぎ|白ネギ|白葱', '長ねぎ', V, '野菜')
rule(r'きざみねぎ|刻みねぎ|カットねぎ|青ねぎ|^カット九条ねぎ', '青ねぎ・万能ねぎ', V, '野菜')
rule(r'人参|にんじん', 'にんじん', V, '野菜')
rule(r'じゃがいも|きたあかり|メークイン', 'じゃがいも', lambda r: V(r) or r['main'] is None, '野菜')
rule(r'ながいも|長いも', '長芋', V, '野菜')
rule(r'^トマト3玉|^トマト', 'トマト', V, '野菜')
rule(r'^カットトマト$', 'トマト缶(カット)', V, '缶')
rule(r'南瓜|かぼちゃ', 'かぼちゃ', is_('常温'), '野菜')
rule(r'はくさい|白才|白菜', '白菜', is_('常温'), '野菜')
rule(r'袋入りパセリ', 'パセリ', V, '野菜')
rule(r'10品目大根|ベビーリーフ|和風サラダ用', 'サラダミックス', is_('野菜果物'), 'サラダ')
rule(r'スウィーティオバナ', 'バナナ', V, '果物')
rule(r'赤りんごバラ', 'りんご', is_('野菜果物'), '果物')
rule(r'キュウリバラ', 'きゅうり', V, '野菜')

# --- 肉 ---
rule(r'牛肉焼肉用ハラミ|黒毛和牛焼肉', '焼肉用（カルビ）', is_('肉'), '牛肉')
rule(r'交雑牛こま切れ', '牛こま切れ', lambda r: r['main'] in (None, '肉'), '牛肉')
rule(r'霧島牛カレ', 'シチュー用角切り', is_('肉'), '牛肉')
rule(r'三元豚ロー|サンゲントンロース|国内産 ?豚ロー', '豚ロース薄切り', is_('肉'), '豚肉')
rule(r'カナダ産三元豚バラ|国内産豚肉バラうす', '豚バラ薄切り', is_('肉'), '豚肉')
rule(r'国内産豚肉バラかた', '豚バラブロック', is_('肉'), '豚肉')
rule(r'#552_豚味付トンテキ', 'ポークソテー用', is_('肉'), '豚肉')
rule(r'自家製すだち鶏つみ|鶏生だんご', '肉団子', is_('肉'), '鶏肉')
rule(r'若どりモモ角切り|若鶏モモ角切り', '鶏もも肉', is_('肉'), '鶏肉')

# --- 魚 ---
rule(r'押寿司助六|豚ヒレカツ巻|鉄火胡瓜巻', '寿司盛り合わせ', is_('魚'), '寿司')


def propose(row):
    """(新しい分類, ルールの名前) を返す。決まらなければ None"""
    name = kk(row['item_name'])
    for pat, target, cond, rname in RULES:
        if pat.search(name) and (cond is None or cond(row)):
            return resolve(target, row), rname
    return None


# ---------- CSV の読み込み ----------
def nz(v):
    return None if v in ('null', '', None) else v


def load_rows():
    rows = []
    for r in csv.DictReader(open(CSV_PATH, encoding='utf-8-sig')):
        rows.append(dict(item_name=r['item_name'], main=nz(r['main_category']), cat=nz(r['category']), sub=nz(r['sub_category']),
                         prod=nz(r['product_name']), n=int(r['n'])))
    return rows


def cmd_propose():
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill, Border, Side
    from openpyxl.utils import get_column_letter
    rows = load_rows()
    out = []
    for r in rows:
        cur = (r['main'], r['cat'], r['sub'], r['prod'])
        res = propose(r)
        if res and res[0] != cur:
            new, why = res
            out.append((r, cur, new, why))
    wb = Workbook()
    ws = wb.active
    ws.title = '変更する分'
    head = ['変更する', '印字名', '件数', '今:大分類', '今:中分類', '今:小分類', '今:商品名', '新:大分類', '新:中分類', '新:小分類', '新:商品名', 'ルール']
    widths = [9, 34, 6, 10, 22, 24, 20, 10, 22, 24, 20, 16]
    fill = PatternFill('solid', fgColor='C62828')
    thin = Side(style='thin', color='BDBDBD')
    for i, (h, w) in enumerate(zip(head, widths), 1):
        c = ws.cell(row=1, column=i, value=h)
        c.fill, c.font, c.alignment = fill, Font(bold=True, color='FFFFFF'), Alignment(horizontal='center', vertical='center', wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = w
    out.sort(key=lambda x: (x[2][0] or '', x[2][1] or '', x[2][2] or '', x[2][3] or '', x[0]['item_name']))
    for n, (r, cur, new, why) in enumerate(out, 2):
        vals = ['○', r['item_name'], r['n'], *[v or '' for v in cur], *[v or '' for v in new], why]
        for i, v in enumerate(vals, 1):
            c = ws.cell(row=n, column=i, value=v)
            c.border = Border(left=thin, right=thin, top=thin, bottom=thin)
            if 8 <= i <= 11:
                c.fill = PatternFill('solid', fgColor='E8F5E9')
    ws.freeze_panes = 'C2'
    ws.auto_filter.ref = f'A1:L{len(out) + 1}'
    ws2 = wb.create_sheet('使い方')
    ws2.column_dimensions['A'].width = 110
    for i, t in enumerate([
        '分類の確認表（DB の明細の分類の見直し）',
        '・「変更する分」シート: 印字名ごとに、今の分類と、新しい分類の提案（緑の列）を並べています。',
        '・まちがいは、緑の列（新:大分類・中分類・小分類・商品名）を、直接、書き直してください。カテゴリ表にある名前を、そのまま書きます。',
        '・「未選択」にする行は、新:大分類・小分類・商品名を空にして、新:中分類に「未選択」と書きます。',
        '・変更しない行は、「変更する」の○を消して（空にして）ください。',
        '・書き終えたら、「python tools/recategorize_items.py sql」で、SQL を作ります（Excel は、閉じてください）。',
        f'・提案した件数: {len(out)} 行（印字名 × 今の分類）。提案が無い行（変更なしと判断したもの）は、この表には出ません。',
    ], 1):
        ws2.cell(row=i, column=1, value=t).alignment = Alignment(wrap_text=True)
    ws2['A1'].font = Font(bold=True, size=14)
    wb.move_sheet('使い方', offset=-1)
    wb.save(XLSX_PATH)
    print(f'確認表を作りました: {XLSX_PATH}')
    print(f'CSV {len(rows)} 行 → 変更の提案 {len(out)} 行（明細 {sum(x[0]["n"] for x in out)} 件）')


def q(v):
    return 'null' if v in (None, '') else "'" + str(v).replace("'", "''") + "'"


def cmd_sql(undo=False):
    from openpyxl import load_workbook
    ws = load_workbook(XLSX_PATH)['変更する分']
    blocks = []
    count = 0
    items = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        flag, name, n, cm, cc, cs, cp, nm, nc, ns, np_, _why = (list(row) + [None] * 12)[:12]
        if not name or str(flag or '').strip() == '':
            continue
        cur = tuple((v or None) for v in (cm, cc, cs, cp))
        new = tuple((v or None) for v in (nm, nc, ns, np_))
        if new == cur:
            continue
        if new[1] is None:
            raise SystemExit(f'新:中分類が空です: {name}')
        if new[3] and (new[0], new[1], new[2], new[3]) not in PATHS:
            raise SystemExit(f'カテゴリ表に無い分類です: {name} → {new}')
        if not new[3] and new[1] != '未選択' and (new[0], new[1]) not in MIDS:
            raise SystemExit(f'カテゴリ表に無い中分類です: {name} → {new}')
        if undo:  # 元に戻す: 「新しい分類」の明細を、「今の分類」に戻す
            cur, new = new, cur
        cond_cur = ' and '.join(f'i.{col} is not distinct from {q(v)}' for col, v in zip(['main_category', 'category', 'sub_category', 'product_name'], cur))
        blocks.append(
            f"  update public.receipt_items i set main_category = {q(new[0])}, category = {q(new[1])}, sub_category = {q(new[2])}, product_name = {q(new[3])}\n"
            f"  from public.receipts r where i.receipt_id = r.id and r.user_id = v_uid and i.item_name = {q(name)} and {cond_cur};\n"
            f"  get diagnostics v_n = row_count; v_total := v_total + v_n;")
        count += 1
        items += int(n or 0)
    title = '元に戻す（recategorize.sql の取り消し）（tools/recategorize_items.py undo で作成）' if undo else '印字名から見直して直す（tools/recategorize_items.py sql で作成）'
    sql = f"""-- DB の明細の分類を、{title}
--  使い方: 「ここにあなたのUID」を、自分のユーザー ID に直して、SQL Editor で実行する
--  {count} 行（印字名 × 今の分類）・見込み {items} 件。「印字名」と「今の分類」が、完全に一致する明細だけを更新する（あとから、アプリで直した分は、触らない）
--  2 回実行しても、同じ結果になる。実行後、メッセージ（NOTICE）に、「更新した明細: ○ 件」が出る
do $$
declare
  v_uid uuid := 'ここにあなたのUID'::uuid;
  v_n integer;
  v_total integer := 0;
begin
{chr(10).join(blocks)}
  raise notice '更新した明細: % 件', v_total;
end $$;
"""
    path = UNDO_PATH if undo else SQL_PATH
    path.write_text(sql, encoding='utf-8')
    print(f'SQL を作りました: {path}（{len(sql) // 1024}KB）/ {count} 行・見込み {items} 件')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'propose':
        cmd_propose()
    elif cmd == 'sql':
        cmd_sql()
    else:
        print(__doc__)
