import { NextResponse } from 'next/server';
import { translateLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'translate');
  const rateLimit = translateLimiter.isAllowed(rateLimitKey);
  
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetTime!);
  }
  let text: string = '';
  let targetLang: string = 'EN';
  try {
    const body = await req.json();
    text = String(body?.text ?? '');
    targetLang = String(body?.targetLang ?? 'EN');
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    // Optional soft-fail: return empty translation instead of 500
    return NextResponse.json({ translated: '' }, { status: 200 });
  }

  // Default DeepL endpoint; allow override for free/commercial endpoints
  const apiUrl = process.env.DEEPL_API_URL ||
    (process.env.DEEPL_API_FREE === '1' || process.env.DEEPL_API_FREE === 'true'
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate');

  // DeepL expects uppercase language codes, e.g. EN, DE, JA, ZH
  const target = String(targetLang || 'EN').toUpperCase();

  try {
    const body = new URLSearchParams({ text: String(text || ''), target_lang: target });
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      const errBody = await safeJson(response);
      return NextResponse.json({ error: 'Translation request failed', details: errBody }, { status: response.status });
    }

    const data = await response.json();
    const translated = data?.translations?.[0]?.text ?? '';
    return NextResponse.json({ translated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Translation error', details: String(err?.message || err) }, { status: 500 });
  }
}

async function safeJson(r: Response) {
  try { return await r.json(); } catch { return await r.text().catch(() => ''); }
}




