import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OptimizedTranslationService } from '../translation-service';

describe('OptimizedTranslationService', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = realFetch as any;
  });

  it('returns empty string when API key is missing (translate -> early return)', async () => {
    // Lines 50-53: if (!this.apiKey) { console.warn(...); return ''; }
    const svc = new OptimizedTranslationService('');
    const res = await svc.translate('hello', 'de');
    expect(res).toBe('');
    const stats = svc.getStats();
    expect(stats.totalRequests).toBe(1);
  });

  it('serves from cache on subsequent calls with same key (cache hit)', async () => {
    // Lines 109-123: getCachedTranslation and hit increments stats.cacheHits
    const svc = new OptimizedTranslationService('key');
    const json = { translations: [{ text: 'hallo' }] };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => json,
    } as any));
    globalThis.fetch = fetchMock as any;

    const first = await svc.translate('Hello', 'de');
    const second = await svc.translate('hello', 'de'); // same normalized text + same casing of targetLang
    expect(first).toBe('hallo');
    expect(second).toBe('hallo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(svc.getStats().cacheHits).toBe(1);
  });

  it('deduplicates concurrent in-flight requests (single fetch)', async () => {
    // Lines 71-78 and 80-99: inFlight map deduplication
    const svc = new OptimizedTranslationService('key');
    let resolveFetch: ((v: any) => void) | null = null;
    const fetchPromise = new Promise<any>((resolve) => { resolveFetch = resolve; });
    const fetchMock = vi.fn(() => fetchPromise);
    globalThis.fetch = fetchMock as any;

    const p1 = svc.translate('hi', 'en');
    const p2 = svc.translate('hi', 'en');
    expect(fetchMock).toHaveBeenCalledTimes(1); // inFlight set before awaiting
    resolveFetch!({
      ok: true,
      json: async () => ({ translations: [{ text: 'hi' }] }),
    });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('hi');
    expect(r2).toBe('hi');
    expect(svc.getStats().deduplicatedRequests).toBe(1);
  });

  it('expires cache after TTL and refetches', async () => {
    // Lines 113-117: TTL invalidation
    const svc = new OptimizedTranslationService('key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translations: [{ text: 'one' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translations: [{ text: 'two' }] }) });
    globalThis.fetch = fetchMock as any;

    // Seed at t0
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const r1 = await svc.translate('cache-me', 'en');
    expect(r1).toBe('one');

    // Advance beyond 5 minutes TTL
    vi.setSystemTime(new Date('2025-01-01T00:05:01Z'));
    const r2 = await svc.translate('cache-me', 'en');
    expect(r2).toBe('two');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws with detailed message on non-ok response (safeResponseText)', async () => {
    // Lines 181-196 and 93-96: error path
    const svc = new OptimizedTranslationService('key');
    const response = {
      ok: false,
      status: 500,
      text: async () => 'server error',
    };
    globalThis.fetch = vi.fn(async () => response as any) as any;

    await expect(svc.translate('boom', 'en')).rejects.toThrow(
      'Translation request failed: 500 - server error'
    );
  });

  it('translateBatch returns correct order with duplicate inputs', async () => {
    // Lines 220-229: batch translation with deduplication
    const svc = new OptimizedTranslationService('key');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translations: [{ text: 'hallo' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ translations: [{ text: 'welt' }] }) });
    globalThis.fetch = fetchMock as any;

    const texts = ['hello', 'world', 'hello']; // duplicate 'hello'
    const results = await svc.translateBatch(texts, 'de');
    
    expect(results).toEqual(['hallo', 'welt', 'hallo']);
    expect(fetchMock).toHaveBeenCalledTimes(2); // only 2 unique requests
  });

  it('cache eviction under pressure maintains size limit', async () => {
    // Lines 140-158: LRU eviction policy
    const svc = new OptimizedTranslationService('key');
    const fetchMock = vi.fn(async (url, options) => {
      const body = options?.body as string;
      const text = new URLSearchParams(body).get('text') || 'default';
      return {
        ok: true,
        json: async () => ({ translations: [{ text: `translated_${text}` }] }),
      };
    });
    globalThis.fetch = fetchMock as any;

    // Fill cache beyond max size (1000)
    const promises = [];
    for (let i = 0; i < 1100; i++) {
      promises.push(svc.translate(`text_${i}`, 'de'));
    }
    await Promise.all(promises);

    const stats = svc.getStats();
    expect(stats.cacheSize).toBeLessThanOrEqual(1000);
  });

  it('getCacheHitRatio handles edge case when no requests made', () => {
    // Lines 208-211: division by zero protection
    const svc = new OptimizedTranslationService('key');
    expect(svc.getCacheHitRatio()).toBe(0);
  });
});