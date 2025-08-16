import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { text, targetLang } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });
  }

  const model = process.env.OPENAI_TRANSLATE_MODEL || 'gpt-5-mini';
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You are a translation engine. Output only the translation with no extra words.' },
          { role: 'user', content: `Translate to ${targetLang}: ${text}` }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await safeJson(response);
      return NextResponse.json({ error: 'Translation request failed', details: errBody }, { status: response.status });
    }

    const data = await response.json();
    const translated = data?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ translated });
  } catch (err: any) {
    return NextResponse.json({ error: 'Translation error', details: String(err?.message || err) }, { status: 500 });
  }
}

async function safeJson(r: Response) {
  try { return await r.json(); } catch { return await r.text().catch(() => ''); }
}




