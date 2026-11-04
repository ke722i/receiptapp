// Supabase スキーマ (receipts & receipt_items) に完全準拠した AI 解析プロンプト
export const RECEIPT_PARSE_PROMPT = `
以下のレシート画像から情報を正確に読み取り、指定のJSONフォーマットのみを出力してください。
Markdownのコードブロック（\`\`\`json など）や説明テキストは一切含めず、純粋なJSON文字列のみを返してください。

【出力フォーマット】:
{
  "store_name": "店舗名（不明な場合は空文字）",
  "store_address": "店舗住所（不明な場合は空文字）",
  "store_number": "電話番号または店舗番号（不明な場合は空文字）",
  "purchase_date": "YYYY-MM-DD", // 購入年月日。不明な場合は今日の年月日
  "items": [
    {
      "item_name": "商品名",
      "category": "商品カテゴリ（例: 食料品, 飲料, 日用品, 調味料 など）",
      "price": 0, // 価格（数値のみ、記号不要）
      "is_discount": false // 値引き・割引が適用されている場合は true、通常は false
    }
  ]
}
`;

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
export const MAX_IMAGE_SIZE_MB = 10;