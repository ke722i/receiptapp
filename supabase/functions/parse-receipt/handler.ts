import { PROMPT_TEXT, RESPONSE_SCHEMA, resolveItems } from './catalog.js';

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_TIMEOUT_MS = 60_000;

// 圧縮後のレシート画像は 1MB 前後。大きすぎる送信は Gemini に渡す前に断る
const MAX_IMAGE_BASE64_LENGTH = 6_000_000;

// 認証は Authorization ヘッダーのトークンで行う（Cookie は使わない）ので、送信元は限定しない
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

const fail = (status: number, code: string, message: string) => json(status, { code, message });

/**
 * ログイン確認と回数の消費を 1 回で行う。
 * ユーザーのトークンのまま DB の関数を呼ぶので、無効なトークンは DB が拒否する。
 */
const consumeQuota = async (authorization: string, apikey: string) => {
  const res = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/consume_receipt_parse_quota`,
    {
      method: 'POST',
      headers: { Authorization: authorization, apikey, 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  if (res.status === 401 || res.status === 403) return 'unauthorized';
  if (!res.ok) {
    console.error('quota check failed', res.status);
    return 'error';
  }
  return (await res.json()) === true ? 'ok' : 'exceeded';
};

const callGemini = async (apiKey: string, base64Image: string) => {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: PROMPT_TEXT },
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini API returned no text');
  return JSON.parse(text);
};

export const handleRequest = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'POST で送信してください。');

  const authorization = req.headers.get('Authorization');
  const apikey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey');
  if (!authorization || !apikey) {
    return fail(401, 'unauthorized', 'ログインし直してください。');
  }

  const body = await req.json().catch(() => null);
  const image = typeof body?.image === 'string'
    ? body.image.replace(/^data:image\/\w+;base64,/, '')
    : '';
  if (!image || !/^[A-Za-z0-9+/]+={0,2}$/.test(image)) {
    return fail(400, 'invalid_image', '画像を読み取れませんでした。');
  }
  if (image.length > MAX_IMAGE_BASE64_LENGTH) {
    return fail(413, 'image_too_large', '画像が大きすぎます。');
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    console.error('GEMINI_API_KEY is not set');
    return fail(500, 'server_error', 'レシートの解析に失敗しました。');
  }

  const quota = await consumeQuota(authorization, apikey);
  if (quota === 'unauthorized') return fail(401, 'unauthorized', 'ログインし直してください。');
  if (quota === 'exceeded') {
    return fail(429, 'quota_exceeded', '本日の解析回数の上限に達しました。明日またお試しください。');
  }
  if (quota === 'error') return fail(500, 'server_error', 'レシートの解析に失敗しました。');

  try {
    return json(200, { data: resolveItems(await callGemini(geminiKey, image)) });
  } catch (error) {
    // 画像やキーはログに出さない
    console.error('receipt parse failed', error instanceof Error ? error.message : 'unknown');
    return fail(502, 'parse_failed', 'レシートの解析に失敗しました。もう一度お試しください。');
  }
};
