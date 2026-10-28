import { useState } from 'react';
import './home.css';

export default function Home({
  onLogout,
  onNavigateToCategory,
  onOpenCamera,
  onNavigateToHistory,
  onNavigateToSettings,
  onSelectProduct,
  userId = 'User_12345'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState({});
  const [searchHistory, setSearchHistory] = useState(['牛乳', '食パン', '醤油']); // 検索履歴の初期値

  // 全カテゴリ階層データ構造
  const categoryTree = [
    {
      id: 'ambient_main',
      name: '常温',
      categories: [
        {
          id: 'seasoning_main',
          name: '調味料',
          subCategories: [
            { id: 'basic_seasoning', name: '基礎調味料', items: ['醤油', '味噌', '塩', '砂糖', '酢'] },
            { id: 'sweetener', name: '甘味料', items: ['はちみつ', 'メープルシロップ', 'オリゴ糖', '液体甘味料'] },
            { id: 'cooking_sake', name: '料理酒類', items: ['料理酒', 'みりん', '発酵調味料'] },
            { id: 'cooking_oil', name: '食用油', items: ['サラダ油', 'ゴマ油', 'オリーブオイル', 'こめ油', 'なたね油'] },
            { id: 'dashi', name: 'だし類', items: ['顆粒だし', 'だしパック', '液体だし', '白だし', 'コンソメ', '中華だし'] },
            { id: 'sauce', name: 'ソース類', items: ['ウスターソース', 'とんかつソース', 'お好みソース', '焼きそばソース', 'デミグラスソース', 'チリソース'] },
            { id: 'tare', name: 'たれ類', items: ['焼き肉のたれ', 'すき焼きのたれ', '生姜焼きのたれ', '照り焼きのたれ', '蒲焼のたれ', 'しゃぶしゃぶのたれ', 'めんつゆ'] },
            { id: 'dressing', name: 'ドレッシング類', items: ['和風', '洋風', 'ごま', 'シーザー', 'フレンチ', 'イタリアン', 'ノンオイル'] },
            { id: 'spice', name: '香辛料', items: ['こしょう', '唐辛子', '七味唐辛子', 'カレー粉', '山椒', 'ハーブ', 'スパイスミックス'] },
            { id: 'other_seasoning', name: 'その他調味料', items: ['マヨネーズ', 'ケチャップ', 'マスタード', 'ワサビ', 'からし', 'コチュジャン', '塩こうじ', 'チューブ薬味'] }
          ]
        },
        {
          id: 'noodle_main',
          name: '麺類',
          subCategories: [
            { id: 'dry_noodle', name: '乾麺', items: ['そうめん', 'ひやむぎ', 'うどん', 'そば', 'きしめん', 'ひもかわうどん', '中華麺', 'つけ麺'] },
            { id: 'pasta', name: 'パスタ', items: ['スパゲッティ', 'マカロニ', 'ペンネ', 'フィットチーネ', 'リングイネ', 'ラザニア', 'カッペリーニ'] },
            { id: 'instant_noodle', name: 'インスタント麺', items: ['袋ラーメン', 'カップラーメン', 'カップうどん', 'カップそば', 'カップ焼きそば', '袋焼きそば', '即席ちゃんぽん', '即席担々麺', '即席フォー', '即席春雨麺'] },
            { id: 'asian_noodle', name: '乾燥麺・アジア麺', items: ['ビーフン', '春雨', 'フォー', 'チャプチェ用春雨', 'ライスヌードル'] },
            { id: 'pasta_sauce', name: 'パスタソース', items: ['ミートソース', 'カルボナーラソース', 'ナポリタンソース', 'ペペロンチーノ', 'たらこソース', '和風パスタソース'] },
            { id: 'noodle_soup', name: '麺用つゆ・スープ', items: ['めんつゆ', 'そばつゆ', 'うどんつゆ', 'ラーメンスープ', 'つけ麺スープ', '冷やし中華のたれ', '焼きそばソース', '担々麺の素'] }
          ]
        },
        {
          id: 'dry_food_main',
          name: '乾物・粉類',
          subCategories: [
            { id: 'flour_list', name: '粉類', items: ['小麦粉', '片栗粉', '米粉', 'てんぷら粉', 'お好み焼き粉', 'たこ焼き粉', 'ホットケーキミックス', 'パン粉', '白玉粉', 'だんご粉'] },
            { id: 'dried_seaweed', name: '乾燥海藻', items: ['乾燥わかめ', '昆布', 'ひじき', '焼きのり', 'とろろ昆布', '切り干し大根', '乾燥しいたけ', '乾燥きくらげ'] },
            { id: 'bonito_flakes', name: '乾物・削り節', items: ['鰹節', '煮干し', '削り節'] },
            { id: 'beans', name: '豆類', items: ['小豆', '大豆', '黒豆', '金時豆', 'いりごま', 'すりごま', 'ゴマ塩'] },
            { id: 'other_dry_food', name: 'その他乾物', items: ['高野豆腐', 'かんぴょう', '春雨', '麩', '乾燥湯葉'] }
          ]
        },
        {
          id: 'rice_grains_main',
          name: '米・穀類',
          subCategories: [
            { id: 'rice', name: '米', items: ['白米', '無洗米', '玄米', '発芽玄米', 'もち米', 'パックご飯'] },
            { id: 'cereal_grains', name: '雑穀類', items: ['雑穀米', 'もち麦', '押し麦', 'キヌア', 'アマランサス'] },
            { id: 'wheat_barley', name: '麦類', items: ['大麦', '丸麦', 'オートミール', 'ライ麦'] },
            { id: 'other_grains', name: 'その他穀類', items: ['コーンミール', 'そばの麦', 'ハトムギ'] },
            { id: 'processed_rice', name: '米加工品', items: ['アルファ化米', 'おかゆ', '玄米ご飯', '赤飯', 'おこわ'] }
          ]
        },
        {
          id: 'retort_main',
          name: 'レトルト商品',
          subCategories: [
            { id: 'retort_curry', name: 'カレー類', items: ['レトルトカレー', 'レトルトハヤシ', 'レトルトシチュー', 'スープカレー'] },
            { id: 'donburi_base', name: '丼の素', items: ['牛丼の素', '親子丼の素', '中華丼の素', '麻婆丼の素', '豚丼の素', 'ビビンバの素'] },
            { id: 'retort_pasta_sauce', name: 'パスタソース', items: ['ミートソース', 'カルボナーラソース', 'ナポリタンソース', 'たらこソース', '和風パスタソース'] },
            { id: 'chinese_dish_base', name: '中華料理の素', items: ['麻婆豆腐の素', '回鍋肉の素', '青椒肉絲の素', '八宝菜の素', '酢豚の素'] },
            { id: 'japanese_dish_base', name: '和風料理の素', items: ['炊き込みご飯の素', '釜めしの素', 'おでの素', '角煮の素'] },
            { id: 'porridge_zowsi', name: 'おかゆ・雑炊', items: ['白がゆ', '玉子がゆ', '雑炊'] },
            { id: 'retort_soup', name: 'スープ類', items: ['コーンスープ', 'ミネストローネ', 'クラムチャウダー', 'ポタージュ', '中華スープ'] },
            { id: 'side_dish', name: '惣菜類', items: ['煮豆', 'きんぴらごぼう', 'ひじき煮', '筑前煮', '肉じゃが', 'ハンバーグ', '焼き鳥', 'もつ煮込み'] }
          ]
        },
        {
          id: 'instant_food_main',
          name: 'インスタント商品',
          subCategories: [
            { id: 'instant_noodle_grp', name: '即席麺', items: ['袋ラーメン', 'カップラーメン', 'カップうどん', 'カップそば', 'カップ焼きそば', '即席ちゃんぽん', '即席担々麺'] },
            { id: 'instant_miso_soup', name: '即席みそ汁', items: ['生みそタイプみそ汁', '粉末タイプみそ汁', 'フリーズドライみそ汁', '具だくさんみそ汁'] },
            { id: 'instant_soup', name: '即席スープ', items: ['わかめスープ', '卵スープ', '春雨スープ', 'オニオンスープ', '中華スープ', 'ポタージュスープ'] },
            { id: 'instant_rice', name: '即席ごはん', items: ['アルファ化米', '即席おこわ', 'フリーズドライ雑炊', '即席リゾット'] },
            { id: 'instant_drink', name: '即席飲料', items: ['インスタントコーヒー', '粉末ココア', '粉末緑茶', '粉末紅茶', '粉末スポーツ飲料'] },
            { id: 'instant_dessert', name: '即席デザート', items: ['プリンの素', 'ゼリーの素', '杏仁豆腐の素', 'ババロアの素', 'シャーベットの素'] },
            { id: 'instant_cooking_base', name: '即席料理の素', items: ['麻婆豆腐の素', 'チャーハンの素', '中華丼の素', '炊き込みご飯の素', 'ちらし寿司のもと'] }
          ]
        },
        {
          id: 'canned_food_main',
          name: '缶詰',
          subCategories: [
            { id: 'seafood_canned', name: '魚介缶詰', items: ['ツナ缶', '鯖缶', 'イワシ缶', 'サンマ缶', '鮭缶', 'カニ缶', 'ホタテ缶', '赤貝', 'アサリ缶'] },
            { id: 'meat_canned', name: '肉類缶詰', items: ['焼き鳥缶', 'コンビーフ缶', 'ランチョンミート', '牛肉大和煮缶'] },
            { id: 'vegetable_canned', name: '野菜缶詰', items: ['コーン缶', 'マッシュルーム缶', 'アスパラガス缶'] },
            { id: 'beans_canned', name: '豆缶詰', items: ['大豆缶', 'ミックスビーンズ', 'ひよこ豆缶'] },
            { id: 'fruit_canned', name: '果物缶詰', items: ['ミカン缶', 'パイン缶', '黄桃缶', '白桃缶', 'フルーツミックス缶'] },
            { id: 'other_canned', name: 'その他缶詰', items: ['コンビーフハッシュ缶', 'スープ缶', 'カレー缶'] }
          ]
        },
        {
          id: 'bottled_pouch_main',
          name: '瓶詰・パウチ商品',
          subCategories: [
            { id: 'jams', name: 'ジャム類', items: ['いちごジャム', 'ブルーベリージャム', 'マーマレード', 'リンゴジャム', 'あんずジャム'] },
            { id: 'rice_accompaniment', name: 'ごはんのお供', items: ['なめ茸', '鮭フレーク', '鳥そぼろ', '肉みそ', '海苔の佃煮'] },
            { id: 'condiment_bottled', name: '調味料瓶詰', items: ['粒マスタード', 'オリーブ', 'ピクルス', 'チリソース'] },
            { id: 'tsukudani', name: '佃煮類', items: ['昆布佃煮', 'しぐれ煮', 'あさり佃煮'] },
            { id: 'pickles_relishes', name: '漬物・薬味', items: ['福神漬', 'らっきょう漬', '梅干し'] },
            { id: 'other_bottled', name: 'その他瓶詰', items: ['メンマ', 'ザーサイ', 'フルーツミックス'] }
          ]
        },
        {
          id: 'sweets_main',
          name: '菓子類',
          subCategories: [
            { id: 'snack_sweets', name: 'スナック菓子', items: ['ポテトチップス', 'コーンスナック', 'ポップコーン', 'ポテトスナック', 'パフスナック', 'プレッツェル', '野菜スナック', '豆スナック', 'ミックススナック'] },
            { id: 'chocolate_sweets', name: 'チョコレート菓子', items: ['板チョコレート', 'チョコバー', 'チョコボール', 'アーモンドチョコ', 'マカダミアチョコ', 'ウエハースチョコ', 'パフ入りチョコ', '生チョコレート', 'トリュフチョコ', 'チョコがけ菓子'] },
            { id: 'candy_sweets', name: '飴・キャンディー', items: ['ハードキャンディー', 'ソフトキャンディー', 'のど飴', '果汁キャンディー', 'ミルクキャンディー', '塩飴', 'ドロップ', 'キャラメル'] },
            { id: 'dried_fruit', name: 'ドライフルーツ', items: ['レーズン', 'ドライマンゴー', 'ドライバナナ', 'ドライプルーン', 'ドライイチジク', 'ドライパイナップル'] },
            { id: 'other_sweets', name: 'その他菓子', items: ['ラムネ', 'マシュマロ', 'メレンゲ菓子', '綿菓子', 'カリカリ梅菓子', '詰め合わせ菓子'] },
            { id: 'health_sweets', name: '健康系菓子', items: ['シリアルバー', '栄養調整食品', 'プロテインバー', '食物繊維入り菓子', '低糖質菓子', '糖質オフ菓子', 'カルシウム入り菓子', '鉄分入り菓子', 'ビタミン入り菓子', '大豆バー'] },
            { id: 'biscuit_cookie', name: 'ビスケット・クッキー類', items: ['ビスケット', 'クッキー', 'サブレ', 'クラッカー', 'ウエハース', 'クリームサンド菓子', 'チョコチップクッキー', 'バタークッキー', 'ラングドシャ', 'ルヴァン系クラッカー'] },
            { id: 'rice_sweets', name: '米菓', items: ['せんべい', 'おかき', 'あられ', '揚げせんべい', '濡れせんべい', '海老巻きせんべい', 'えびせんべい', 'ざらめせんべい', 'ソフトせんべい', '詰め合わせ米菓'] },
            { id: 'chewing_gum', name: 'ガム', items: ['板ガム', '粒ガム', 'ボトルガム', '風船ガム'] },
            { id: 'japanese_sweets', name: '和菓子', items: ['ようかん', 'まんじゅう', 'どら焼き', 'どら焼き以外の焼き和菓子', 'もなか', '甘納豆', 'かりんとう', 'きなこ菓子', 'もち菓子', 'あんこ菓子', 'わらび餅', '和菓子詰め合わせ'] },
            { id: 'dagashi', name: '駄菓子', items: ['うまい棒系スナック', '麩菓子', 'きなこ棒', '駄菓子ソースかつ', 'ラムネ菓子', '駄菓子チョコ', '駄菓子せんべい', '水あめ菓子', '駄菓子ガム', '駄菓子詰め合わせ'] },
            { id: 'gummy_jelly', name: 'グミ・ゼリー菓子', items: ['グミ', 'ハードグミ', 'ソフトグミ', '果汁グミ', 'コラーゲン入りグミ', '一口ゼリー', 'こんにゃくゼリー', 'ラムネ菓子', 'タブレット菓子', '清涼菓子'] },
            { id: 'western_baked_sweets', name: '洋菓子・焼き菓子', items: ['バウムクーヘン', 'マドレーヌ', 'パウンドケーキ', 'フィナンシェ', 'マフィン', 'スポンジケーキ', 'パイ菓子', 'シュー菓子', 'ドーナツ', 'カステラ'] },
            { id: 'beans_nuts_sweets', name: '豆菓子・ナッツ類', items: ['落花生', '味付けピーナッツ', '柿の種', 'バターピーナッツ', 'アーモンド', 'カシューナッツ', 'くるみ', 'ミックスナッツ', 'そら豆菓子', '甘納豆以外の豆菓子'] }
          ]
        },
        {
          id: 'bread_main',
          name: 'パン類',
          subCategories: [
            { id: 'shelf_stable_bread', name: '常温保存パン', items: ['ロングライフパン', '保存用パン', '缶入りパン', '個包装パン'] },
            { id: 'pastry_bread', name: '菓子パン', items: ['アンパン', 'クリームパン', 'メロンパン', 'チョコパン', 'ジャムパン', 'デニッシュパン'] },
            { id: 'table_bread', name: '食事パン', items: ['ロールパン', 'クロワッサン', 'フランスパン', 'ベーグル', 'マフィン'] },
            { id: 'sweet_baked_bread', name: '甘味パン・焼き菓子パン', items: ['カステラパン', '蒸しパン', 'スティックパン', 'パンケーキ', 'ワッフル'] }
          ]
        }
      ]
    },
    {
      id: 'chilled_main',
      name: '冷蔵',
      categories: [
        { id: 'dairy_egg_main', name: '乳製品・卵', items: ['牛乳', 'ヨーグルト', 'チーズ', 'マーガリン', '乳酸菌飲料', 'バター', '卵', 'うずら', '豆乳', '生クリーム', 'デザート類'] },
        { id: 'soy_products_main', name: '大豆製品', items: ['納豆', '豆腐', '油揚げ・厚揚げ', '酒粕', '豆腐加工品', 'おから', 'いなり', '湯葉'] },
        { id: 'chilled_beverage_main', name: '飲料', items: ['コーヒー', 'コーンポタージュ'] },
        { id: 'processed_meat_main', name: '加工肉', items: ['ハム・ベーコン', 'ソーセージ', '生ハム', 'サラダチキン', 'チャーシュー', 'ミートボール', 'チキンナゲット', 'ウインナー'] },
        { id: 'fish_paste_main', name: '練り物', items: ['ちくわ', 'かまぼこ', 'はんぺん', 'めんたいこ', 'かにかま', 'ちくわぶ', 'ちーちく', 'したらば', 'さつま揚げ', '玉ねぎ天', 'おでの練り物', 'つみれ'] },
        { id: 'chilled_noodle_main', name: '麺', items: ['中華麺', 'うどん', '焼きそば', 'ほうとう'] },
        { id: 'chilled_processed_food_main', name: '加工製品', items: ['餃子系', 'ピザ', '弁当', 'お惣菜', '焼きそば', '茶碗蒸し', 'サラダ類', 'わんたん', 'ラーメン', 'つけ麺', '焼売系', 'おでん', '肉まん系', 'はるまき', 'うどん', 'めかぶ', 'モズク', '饅頭系', 'ナン', '即席'] },
        { id: 'pickles_main', name: '漬物', items: ['梅干し', 'たくあん', 'キムチ類', 'かぶら', 'なすび', '福神漬', 'らっきょう', 'ショウガ', 'きゅうり'] },
        { id: 'konjac_main', name: 'こんにゃく', items: ['こんにゃく', 'しらたき', 'こんにゃく麺'] },
        { id: 'tsukudani_main', name: '佃煮', items: ['昆布系', 'ちりめん', 'さつまいも', 'まめ'] }
      ]
    },
    {
      id: 'frozen_main',
      name: '冷凍',
      categories: [
        { id: 'bento_frozen_main', name: 'お弁当用冷凍食品', items: ['ミニハンバーグ', 'ミニグラタン', 'ミニコロッケ', 'ミニメンチカツ', '唐揚げ', 'チキンナゲット', 'エビフライ', '白身魚フライ', 'ちくわの磯辺揚げ', 'かぼちゃコロッケ', '野菜かき揚げ', '卵焼き', 'ほうれん草のおひたし', 'きんぴらごぼう', 'ひじき煮', '切り干し大根', '筑前煮', '大学いも', '枝豆', 'ミートボール', 'ウインナー'] },
        { id: 'dinner_side_main', name: '夕食・食卓のおかず', items: ['ハンバーグ', 'とんかつ', 'チキンカツ', 'フライドチキン', 'メンチカツ', 'クリームコロッケ', '焼き鳥', 'つくね', '肉団子', '餃子', '焼売', '小籠包', '春巻き', 'ロールキャベツ', '豚の角煮', '牛すじ煮込み', '麻婆豆腐', '酢豚', '青椒肉絲', '回鍋肉', 'アジフライ', '牡蠣フライ', 'えびチリ'] },
        { id: 'rice_bowl_main', name: 'ご飯もの・丼もの', items: ['冷凍白ご飯', 'チャーハン', 'えびピラフ', 'チキンライス', 'ドライカレー', 'ビビンバ', 'オムライス', 'おこわ', '赤飯', '焼きおにぎり', '冷凍おにぎり', 'ドリア', 'リゾット', '牛丼の具', '親子丼の具', '中華丼の具', 'カツ丼の具', 'そばめし'] },
        { id: 'frozen_noodle_main', name: '麺類', items: ['うどん', '焼きうどん', 'そば', 'ラーメン', 'ちゃんぽん', '焼きそば', 'ミートソースパスタ', 'ナポリタン', 'カルボナーラ', 'たらこパスタ', 'ペペロンチーノ', '担々麺', '汁なし担々麺', 'まぜそば', 'ビーフン', 'フォー'] },
        { id: 'frozen_veg_main', name: '野菜のおかず・副菜', items: ['冷凍ブロッコリー', '冷凍ほうれん草', '冷凍コーン', '冷凍ミックスベジタブル', '冷凍いんげん', '冷凍オクラ', '冷凍かぼちゃ', '冷凍揚げなす'] },
        { id: 'ice_cream_main', name: 'アイス類', items: ['アイス', 'ラクトアイス', '氷'] },
        { id: 'frozen_snack_dessert_main', name: 'おやつ・デザート', items: ['冷凍フライドポテト', '冷凍チュロス', '冷凍ドーナツ', '冷凍シュークリーム', '冷凍エクレア', '冷凍大福', '冷凍わらび餅', '冷凍マカロン', '冷凍マンゴー', '冷凍いちご', '冷凍ブルーベリー', '冷凍ぶどう', '冷凍パイナップル', 'ハッシュドポテト'] }
      ]
    },
    {
      id: 'daily_goods_main',
      name: '日用品',
      categories: [
        {
          id: 'paper_products',
          name: '紙製品',
          subCategories: [
            { id: 'tissue_toilet_paper', name: 'ティッシュ・トイレットペーパー', items: ['ティッシュペーパー', '保湿ティッシュ', 'ポケットティッシュ', 'トイレットペーパー', 'あぶらとり紙'] },
            { id: 'kitchen_paper_towel', name: 'キッチンペーパー・ペーパータオル', items: ['キッチンペーパー', 'ペーパータオル'] },
            { id: 'wet_sheet_wipes', name: 'ウェットシート・おしりふき', items: ['ウェットティッシュ', '除菌シート', 'おしりふき', '赤ちゃん用おむつ替えシート'] }
          ]
        },
        {
          id: 'cleaning_products',
          name: '掃除用品',
          subCategories: [
            { id: 'water_cleaner', name: '水回り洗剤', items: ['浴室用洗剤', 'トイレ用洗剤', 'カビ取り剤', '排水口クリーナー', 'パイプクリーナー'] },
            { id: 'home_cleaner', name: '住居用洗剤・ナチュラル洗剤', items: ['住居用洗剤', '床用洗剤', '重曹・クエン酸'] },
            { id: 'cleaning_tools', name: '掃除道具', items: ['掃除用ブラシ', 'たわし', 'メラミンスポンジ', '雑巾・マイクロファイバークロス', 'ゴム手袋・使い捨て手袋'] },
            { id: 'cleaning_sheet_roller', name: '掃除シート・粘着クリーナー', items: ['フローリングワイパー用シート', '粘着クリーナー（コロコロ）', '使い捨て掃除シート'] }
          ]
        },
        {
          id: 'kitchen_consumables',
          name: 'キッチン消耗品',
          subCategories: [
            { id: 'dishwashing_goods', name: '食器洗い用品', items: ['キッチン用洗剤・クリーナー', '食器用洗剤', '食洗機用洗剤', 'キッチン用漂白剤', '食器用スポンジ', '食器用ふきん'] },
            { id: 'drain_corner_goods', name: '排水口・三角コーナー', items: ['三角コーナー', '排水口カバー', '排水口用ゴミ受け', '水切りネット', '排水溝用ネット', 'ゴミ取りネット'] },
            { id: 'drainer_sponge_holder', name: '水切り・スポンジ置き', items: ['スポンジラック', '食器用水切りマット', '水切りかご'] },
            { id: 'wrap_storage_sheet', name: 'ラップ・保存袋・シート', items: ['食品用ラップ', 'アルミホイル', 'クッキングシート', 'フリーザーバッグ', '保存用ポリ袋'] }
          ]
        },
        {
          id: 'cooking_bento_tools',
          name: '調理・お弁当用品',
          subCategories: [
            { id: 'knife_cooking_tools', name: '包丁・調理ツール', items: ['包丁', 'まな板', 'キッチンばさみ', 'ピーラー', 'おろし器', '缶切り', '栓抜き'] },
            { id: 'kitchen_utensils_containers', name: '調理小物・容器', items: ['菜箸', 'お玉', 'フライ返し', 'しゃもじ', '計量スプーン', '計量カップ', 'ボウル', 'ザル', '製氷皿'] },
            { id: 'bento_water_bottle', name: 'お弁当・水筒', items: ['お弁当箱', '水筒', 'お弁当用カップ', 'バラン', 'お弁当用ピック', 'お弁当用カトラリー'] }
          ]
        },
        {
          id: 'tableware_dining',
          name: '食器・食卓用品',
          subCategories: [
            { id: 'dining_goods', name: '食卓用品', items: ['箸', '箸置き', 'スプーン・フォーク', 'ナイフ', 'ランチョンマット', 'コースター', 'テーブルクロス'] },
            { id: 'disposable_tableware', name: '使い捨て食器', items: ['割りばし', '紙皿', '紙コップ', '使い捨てスプーン', '使い捨てフォーク', 'ストロー'] }
          ]
        },
        {
          id: 'waste_disposable_goods',
          name: 'ゴミ処理・使い捨て用品',
          subCategories: [
            { id: 'trash_bags', name: 'ゴミ袋・ポリ袋', items: ['ゴミ袋', '大型ゴミ袋', '半透明ゴミ袋', '消臭ゴミ袋', '生ゴミ用袋', 'レジ袋', '小型ポリ袋'] },
            { id: 'disposable_goods', name: '使い捨て用品', items: ['使い捨てふきん', '使い捨てエプロン', '使い捨ておしぼり', '使い捨てカイロ'] }
          ]
        },
        {
          id: 'laundry_products',
          name: '洗濯用品',
          subCategories: [
            { id: 'detergent_softener', name: '洗剤・柔軟剤', items: ['洗濯用洗剤（液体・粉末・ジェルボール）', '柔軟剤', 'おしゃれ着用洗剤'] },
            { id: 'bleach_stain_remover', name: '漂白・シミ取り', items: ['部分洗い用洗剤', '漂白剤（酸素系・塩素系）', '衣類用シミ取り剤'] },
            { id: 'washer_clothing_care', name: '洗濯機・衣類ケア', items: ['洗濯槽クリーナー', '衣類用消臭・除菌スプレー'] }
          ]
        },
        {
          id: 'bath_hair_skincare',
          name: 'バス・ヘア・スキンケア',
          subCategories: [
            { id: 'hair_care', name: 'ヘアケア', items: ['シャンプー', 'コンディショナー・リンス', 'トリートメント'] },
            { id: 'body_soap', name: 'ボディソープ・石けん', items: ['ボディソープ', '固形石けん', 'ハンドソープ'] },
            { id: 'cleansing_face', name: '洗顔・クレンジング', items: ['洗顔料', 'メイク落とし', 'メイク落としシート', '洗顔ネット'] },
            { id: 'skincare_moisturizer', name: 'スキンケア・保湿', items: ['化粧水', '乳液', 'ボディクリーム', 'ハンドクリーム'] },
            { id: 'bath_additives', name: '入浴剤', items: ['入浴剤', 'バスソルト'] },
            { id: 'bath_tools', name: '入浴用具', items: ['ボディタオル', 'ボディスポンジ', '軽石'] }
          ]
        },
        {
          id: 'sanitary_firstaid',
          name: '生理・衛生・救急用品',
          subCategories: [
            { id: 'sanitary_goods', name: '生理用品', items: ['生理用ナプキン（昼用・夜用）', '羽つき・羽なしナプキン', 'おりものシート', 'タンポン', '吸水ショーツ', '生理用ショーツ', '生理用ナプキンの処理袋'] },
            { id: 'intimate_care', name: 'デリケートゾーンケア', items: ['デリケートゾーン用ソープ', 'デリケートゾーン用ウェットシート'] },
            { id: 'face_masks', name: 'マスク', items: ['不織布マスク', '子ども用マスク', '立体型マスク'] },
            { id: 'first_aid', name: '救急・応急', items: ['絆創膏', '防水絆創膏', 'ガーゼ', '包帯', 'テーピングテープ', '消毒液', '消毒用ウェットシート'] },
            { id: 'thermometer_cooling', name: '体温・冷却', items: ['体温計', '冷却シート', '冷却ジェル用品'] },
            { id: 'sanitary_items', name: '衛生小物', items: ['綿棒', 'コットン', '耳かき'] }
          ]
        },
        {
          id: 'oral_care',
          name: 'オーラルケア',
          subCategories: [
            { id: 'toothbrushes', name: '歯ブラシ類', items: ['歯ブラシ', '電動歯ブラシ用替えブラシ', '舌ブラシ', '歯ブラシケース'] },
            { id: 'toothpaste_mouthwash', name: '歯磨き・洗口', items: ['歯磨き粉', '子ども用歯磨き粉', '液体歯磨き', 'マウスウォッシュ'] },
            { id: 'interdental_care', name: '歯間ケア', items: ['デンタルフロス', '歯間ブラシ'] },
            { id: 'denture_care', name: '入れ歯ケア', items: ['入れ歯洗浄剤', '入れ歯安定剤'] }
          ]
        },
        {
          id: 'pest_control',
          name: '防虫・殺虫',
          subCategories: [
            { id: 'insecticides', name: '殺虫剤', items: ['殺虫スプレー', 'ゴキブリ用駆除剤', 'ハエ・蚊用殺虫剤', 'アリ用殺虫剤'] },
            { id: 'mosquito_repellent', name: '蚊対策・虫よけ', items: ['蚊取り線香', '蚊取りマット', '電子蚊取り器用薬剤', '虫よけスプレー', '虫よけシート'] },
            { id: 'mite_cockroach_trap', name: 'ダニ・ゴキブリ捕獲', items: ['ダニ対策スプレー', 'ダニ捕獲シート', 'ゴキブリ用捕獲器'] },
            { id: 'clothes_mothproofing', name: '衣類用防虫', items: ['衣類用防虫剤', 'クローゼット用防虫剤'] }
          ]
        },
        {
          id: 'deodorant_fragrance_dehumidifier',
          name: '消臭・芳香・除湿',
          subCategories: [
            { id: 'room_kitchen_deodorant', name: '部屋・キッチン用消臭', items: ['部屋用消臭剤', '置き型消臭剤', 'スプレー型消臭剤', '生ゴミ用消臭剤', '排水口用消臭剤'] },
            { id: 'toilet_fridge_shoe_deodorant', name: 'トイレ・冷蔵庫・靴の消臭', items: ['トイレ用消臭スプレー', '冷蔵庫用脱臭剤', '靴用消臭スプレー', '靴箱用消臭剤'] },
            { id: 'air_freshener', name: '芳香剤', items: ['部屋用芳香剤', 'トイレ用芳香剤', '車用芳香剤'] },
            { id: 'dehumidifier_mold_prevention', name: '除湿・防カビ', items: ['除湿剤', '乾燥剤', '防カビ剤'] }
          ]
        },
        {
          id: 'pet_supplies',
          name: 'ペット用品',
          subCategories: [
            { id: 'pet_food_treats', name: 'フード・おやつ', items: ['犬用・猫用ペットフード', 'ペット用おやつ'] },
            { id: 'pet_toilet_sanitary', name: 'トイレ・衛生', items: ['ペットシーツ', '猫砂', 'ペット用トイレ袋', 'ペット用エチケット袋', 'ペット用ウェットシート', 'ペット用消臭剤'] },
            { id: 'pet_grooming', name: 'お手入れ', items: ['ペット用シャンプー', 'ペット用ブラシ'] },
            { id: 'pet_dishes_toys', name: '食器・おもちゃ', items: ['ペット用食器', 'ペット用おもちゃ'] }
          ]
        },
        {
          id: 'battery_fire',
          name: '電池・火器',
          subCategories: [
            { id: 'batteries', name: '電池', items: ['単1電池', '単2電池', '単3電池', '単4電池', 'ボタン電池', 'コイン電池'] },
            { id: 'fire_tools', name: '火器', items: ['ライター', 'マッチ'] }
          ]
        }
      ]
    }
  ];

  // 全アイテム（商品名）を抽出するヘルパー関数
  const getAllItems = () => {
    const itemSet = new Set();
    categoryTree.forEach((topCat) => {
      topCat.categories.forEach((mainCat) => {
        if (mainCat.subCategories) {
          mainCat.subCategories.forEach((subCat) => {
            subCat.items.forEach((item) => itemSet.add(item));
          });
        }
        if (mainCat.items) {
          mainCat.items.forEach((item) => itemSet.add(item));
        }
      });
    });
    return Array.from(itemSet);
  };

  // 表記揺れ吸収のための文字正規化関数（全角/半角統一・カタカナ化）
  const normalizeText = (str) => {
    if (!str) return '';
    // 全角英数を半角に、全角スペースを半角に
    let normalized = str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
    // ひらがなをカタカナに変換
    normalized = normalized.replace(/[\u3041-\u3096]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
    return normalized.toLowerCase().trim();
  };

  // 高度な検索ソート処理（完全一致 ＞ 前方一致 ＞ 部分一致）
  const getFilteredSuggestions = () => {
    if (!searchQuery.trim()) return [];

    const normQuery = normalizeText(searchQuery);
    const allItems = getAllItems();

    const exactMatches = [];
    const startsWithMatches = [];
    const includesMatches = [];

    allItems.forEach((item) => {
      const normItem = normalizeText(item);

      if (normItem === normQuery) {
        exactMatches.push(item);
      } else if (normItem.startsWith(normQuery)) {
        startsWithMatches.push(item);
      } else if (normItem.includes(normQuery)) {
        includesMatches.push(item);
      }
    });

    // 完全一致 → 前方一致 → 部分一致 の順に結合
    return [...exactMatches, ...startsWithMatches, ...includesMatches];
  };

  const suggestions = getFilteredSuggestions();

  const toggleCategory = (categoryId) => {
    setOpenCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleMenuClick = (action) => {
    setIsMenuOpen(false);
    if (action) action();
  };

  const handleClearSearch = (e) => {
    e.stopPropagation();
    setSearchQuery('');
  };

  const handleSelectSuggestion = (value) => {
    setSearchQuery('');
    setIsSearchFocused(false);

    // 検索履歴に追加（重複削除・最新を先頭に）
    setSearchHistory((prev) => [value, ...prev.filter((item) => item !== value)].slice(0, 5));

    if (onSelectProduct) {
      onSelectProduct(value);
    }
  };

  const frequentItems = [
    { id: 1, name: '卵' },
    { id: 2, name: '牛乳' },
    { id: 3, name: 'サラダ油' },
    { id: 4, name: 'カレールー' },
    { id: 5, name: 'カップ麺' },
  ];

  return (
    <div className="home-container">
      {/* ヘッダー */}
      <header className="home-header">
        <button
          type="button"
          className="hamburger-button"
          onClick={() => setIsMenuOpen(true)}
          aria-label="メニューを開く"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>

        <div className="header-logo-area">
          <div className="header-logo-placeholder">アプリロゴ</div>
        </div>

        <div className="header-right-spacer"></div>
      </header>

      {/* ドロワーメニュー */}
      <div
        className={`drawer-overlay ${isMenuOpen ? 'is-active' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />
      <aside className={`drawer-menu ${isMenuOpen ? 'is-active' : ''}`}>
        <div className="drawer-user-info">
          <div className="user-avatar">👤</div>
          <div className="user-details">
            <span className="user-label">ログインユーザー</span>
            <span className="user-id">{userId}</span>
          </div>
        </div>
        <nav className="drawer-nav">
          <button type="button" className="drawer-item" onClick={() => handleMenuClick()}>
            <span className="drawer-icon">🏠</span><span>ホーム</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onOpenCamera)}>
            <span className="drawer-icon">📷</span><span>レシート撮影</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToHistory)}>
            <span className="drawer-icon">📄</span><span>レシート履歴</span>
          </button>
          <button type="button" className="drawer-item" onClick={() => handleMenuClick(onNavigateToSettings)}>
            <span className="drawer-icon">⚙️</span><span>設定</span>
          </button>
        </nav>
        <div className="drawer-footer">
          <button type="button" className="drawer-item logout-item" onClick={() => handleMenuClick(onLogout)}>
            <span className="drawer-icon">🚪</span><span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* 検索時オーバーレイ */}
      <div
        className={`search-overlay ${isSearchFocused ? 'is-active' : ''}`}
        onClick={() => setIsSearchFocused(false)}
      />

      {/* メイン */}
      <main className="home-main">
        {/* 検索バー */}
        <div className={`search-bar-container ${isSearchFocused ? 'is-focused' : ''}`}>
          <div className="search-input-wrapper">
            <input
              type="search"
              className="search-input"
              placeholder="商品を検索 (例: ぎゅうにゅう, 醤油)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              inputMode="search"
              enterKeyHint="search"
            />
            {isSearchFocused && searchQuery.length > 0 && (
              <button
                type="button"
                className="search-clear-button"
                onClick={handleClearSearch}
                aria-label="検索文字をクリア"
              >
                ✕
              </button>
            )}
          </div>

          {/* 検索候補リスト */}
          {isSearchFocused && (
            <div className="search-suggestions-dropdown">
              {/* 入力中のリアルタイム予測結果 */}
              {searchQuery.trim().length > 0 ? (
                suggestions.length > 0 ? (
                  <ul className="search-suggestions-list">
                    {suggestions.map((item, index) => (
                      <li
                        key={index}
                        className="search-suggestion-item"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(item);
                        }}
                      >
                        <span className="suggestion-icon">🔍</span>
                        <span className="suggestion-text">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="search-no-result">一致する商品が見つかりません</div>
                )
              ) : (
                /* 未入力時：最近検索した商品履歴 */
                <div className="search-history-container">
                  <div className="search-history-header">最近検索した商品</div>
                  <div className="search-history-tags">
                    {searchHistory.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="search-history-tag"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(item);
                        }}
                      >
                        🕒 {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* よく見る */}
        <section className="section-container">
          <h2 className="section-title">よく見る</h2>
          <div className="frequent-scroll-container">
            {frequentItems.map((item) => (
              <div
                key={item.id}
                className="frequent-card"
                onClick={() => {
                  if (onSelectProduct) {
                    onSelectProduct(item.name);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="card-image-placeholder">画像</div>
                <span className="card-name">{item.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* カテゴリ (大分類 -> 中分類 -> サブカテゴリ -> アイテム) */}
        <section className="section-container">
          <h2 className="section-title">カテゴリ</h2>
          <div className="category-accordion-list">
            {categoryTree.map((topCat) => (
              <div key={topCat.id} className="category-group">
                {/* 1段階目：大分類 */}
                <button
                  type="button"
                  className={`category-main-button ${openCategories[topCat.id] ? 'is-open' : ''}`}
                  onClick={() => toggleCategory(topCat.id)}
                >
                  <span className="category-label">{topCat.name}</span>
                  <span className="category-arrow">
                    {openCategories[topCat.id] ? '▲' : '▼'}
                  </span>
                </button>

                {/* 2段階目：中分類 */}
                {openCategories[topCat.id] && (
                  <div className="sub-category-list">
                    {topCat.categories.map((mainCat) => (
                      <div key={mainCat.id} className="sub-category-group">
                        <button
                          type="button"
                          className={`sub-category-button ${openCategories[mainCat.id] ? 'is-open' : ''}`}
                          onClick={() => toggleCategory(mainCat.id)}
                        >
                          <span className="category-label">{mainCat.name}</span>
                          <span className="sub-arrow">
                            {openCategories[mainCat.id] ? '▲' : '▼'}
                          </span>
                        </button>

                        {/* 複数サブカテゴリがある場合 */}
                        {openCategories[mainCat.id] && mainCat.subCategories && (
                          <div className="sub-category-list" style={{ paddingLeft: '12px' }}>
                            {mainCat.subCategories.map((subCat) => (
                              <div key={subCat.id} className="item-category-group">
                                <button
                                  type="button"
                                  className={`sub-category-button ${openCategories[subCat.id] ? 'is-open' : ''}`}
                                  onClick={() => toggleCategory(subCat.id)}
                                >
                                  <span>{subCat.name}</span>
                                  <span className="sub-arrow">
                                    {openCategories[subCat.id] ? '▲' : '▼'}
                                  </span>
                                </button>

                                {openCategories[subCat.id] && (
                                  <div className="item-category-list">
                                    {subCat.items.map((itemName) => (
                                      <button
                                        key={itemName}
                                        type="button"
                                        className="item-category-button"
                                        onClick={() => onNavigateToCategory && onNavigateToCategory(itemName)}
                                      >
                                        {itemName}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 直下にアイテムがある場合 */}
                        {openCategories[mainCat.id] && mainCat.items && (
                          <div className="item-category-list">
                            {mainCat.items.map((itemName) => (
                              <button
                                key={itemName}
                                type="button"
                                className="item-category-button"
                                onClick={() => onNavigateToCategory && onNavigateToCategory(itemName)}
                              >
                                {itemName}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* カメラFAB */}
      <button
        type="button"
        className="camera-fab"
        onClick={onOpenCamera}
        aria-label="カメラ起動"
      >
        <svg className="camera-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
          <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
        </svg>
      </button>
    </div>
  );
}