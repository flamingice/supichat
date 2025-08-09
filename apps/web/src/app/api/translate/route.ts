import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { text, targetLang } = await req.json();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You translate user text. Output only the translation with no extra words.' },
        { role: 'user', content: `Translate to ${targetLang}: ${text}` }
      ]
    })
  });
  const j = await r.json();
  const translated = j?.choices?.[0]?.message?.content ?? '';
  return NextResponse.json({ translated });
}


