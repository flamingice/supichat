import { NextResponse } from 'next/server';
import { translateLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limit';
import { getTranslationService } from '@/lib/translation-service';

export async function POST(req: Request) {
  // Rate limiting with optimized limiter
  const rateLimitKey = getRateLimitKey(req, 'translate');
  const rateLimit = translateLimiter.isAllowed(rateLimitKey);
  
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetTime!);
  }

  let text: string = '';
  let targetLang: string = 'EN';
  let sourceLang: string | undefined;
  
  try {
    const body = await req.json();
    text = String(body?.text ?? '');
    targetLang = String(body?.targetLang ?? 'EN');
    sourceLang = body?.sourceLang ? String(body.sourceLang) : undefined;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!text.trim()) {
    return NextResponse.json({ translated: '' }, { status: 200 });
  }

  try {
    const translationService = getTranslationService();
    const translated = await translationService.translate(text, targetLang, sourceLang);
    
    // Include cache statistics in development
    const stats = process.env.NODE_ENV === 'development' ? {
      cacheHitRatio: translationService.getCacheHitRatio(),
      stats: translationService.getStats()
    } : undefined;

    return NextResponse.json({ 
      translated,
      ...(stats && { debug: stats })
    });
  } catch (err: any) {
    console.error('[Translation API] Error:', err);
    return NextResponse.json({ 
      error: 'Translation error', 
      details: String(err?.message || err) 
    }, { status: 500 });
  }
}

// Health endpoint to check translation service status
export async function GET() {
  try {
    const translationService = getTranslationService();
    const stats = translationService.getStats();
    
    return NextResponse.json({
      status: 'ok',
      service: 'translation',
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        cacheHitRatio: translationService.getCacheHitRatio()
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      service: 'translation',
      timestamp: new Date().toISOString(),
      error: String(error)
    }, { status: 500 });
  }
}




