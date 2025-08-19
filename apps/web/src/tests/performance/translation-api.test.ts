import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { performance } from 'perf_hooks';

// Current implementation (no caching)
class CurrentTranslationService {
  private apiKey: string;
  private apiUrl: string;

  constructor(apiKey: string, apiUrl: string = 'https://api-free.deepl.com/v2/translate') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async translate(text: string, targetLang: string): Promise<string> {
    const body = new URLSearchParams({ text, target_lang: targetLang });
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    return data?.translations?.[0]?.text ?? '';
  }
}

// Optimized implementation (with LRU cache and deduplication)
class OptimizedTranslationService {
  private apiKey: string;
  private apiUrl: string;
  private cache = new Map<string, { value: string; timestamp: number }>();
  private inFlight = new Map<string, Promise<string>>();
  private maxCacheSize = 1000;
  private cacheTtl = 300000; // 5 minutes

  constructor(apiKey: string, apiUrl: string = 'https://api-free.deepl.com/v2/translate') {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl;
  }

  async translate(text: string, targetLang: string): Promise<string> {
    const cacheKey = `${text}:${targetLang}`;
    const now = Date.now();

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < this.cacheTtl) {
      return cached.value;
    }

    // Check if request is already in flight (deduplication)
    const inFlightPromise = this.inFlight.get(cacheKey);
    if (inFlightPromise) {
      return inFlightPromise;
    }

    // Make new request
    const promise = this.makeRequest(text, targetLang);
    this.inFlight.set(cacheKey, promise);

    try {
      const result = await promise;
      
      // Cache the result
      this.cache.set(cacheKey, { value: result, timestamp: now });
      this.evictOldEntries();
      
      return result;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async makeRequest(text: string, targetLang: string): Promise<string> {
    const body = new URLSearchParams({ text, target_lang: targetLang });
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const data = await response.json();
    return data?.translations?.[0]?.text ?? '';
  }

  private evictOldEntries() {
    if (this.cache.size <= this.maxCacheSize) return;

    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by timestamp and remove oldest
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      inFlightCount: this.inFlight.size
    };
  }

  clearCache() {
    this.cache.clear();
    this.inFlight.clear();
  }
}

describe('Translation API Performance Tests', () => {
  let currentService: CurrentTranslationService;
  let optimizedService: OptimizedTranslationService;
  let fetchMock: any;

  beforeEach(() => {
    // Mock fetch to simulate API calls
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    currentService = new CurrentTranslationService('test-key');
    optimizedService = new OptimizedTranslationService('test-key');

    // Default successful response
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        translations: [{ text: 'translated text' }]
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should measure cache hit performance', async () => {
    const testTexts = [
      'Hello world',
      'How are you?',
      'Good morning',
      'Hello world', // duplicate
      'How are you?', // duplicate
      'Thank you'
    ];

    // Test current implementation (no cache)
    fetchMock.mockClear();
    const currentStart = performance.now();
    
    for (const text of testTexts) {
      await currentService.translate(text, 'ES');
    }
    
    const currentEnd = performance.now();
    const currentTime = currentEnd - currentStart;
    const currentApiCalls = fetchMock.mock.calls.length;

    // Test optimized implementation (with cache)
    fetchMock.mockClear();
    const optimizedStart = performance.now();
    
    for (const text of testTexts) {
      await optimizedService.translate(text, 'ES');
    }
    
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;
    const optimizedApiCalls = fetchMock.mock.calls.length;

    console.log(`\n📊 Translation API Performance Results:`);
    console.log(`Current implementation: ${currentTime.toFixed(2)}ms, ${currentApiCalls} API calls`);
    console.log(`Optimized implementation: ${optimizedTime.toFixed(2)}ms, ${optimizedApiCalls} API calls`);
    console.log(`API call reduction: ${((currentApiCalls - optimizedApiCalls) / currentApiCalls * 100).toFixed(1)}%`);
    console.log(`Cache stats:`, optimizedService.getCacheStats());

    // Optimized should make fewer API calls due to caching
    expect(optimizedApiCalls).toBeLessThan(currentApiCalls);
    expect(optimizedApiCalls).toBe(4); // Only unique texts
    expect(currentApiCalls).toBe(6); // All texts including duplicates
  });

  it('should measure deduplication effectiveness', async () => {
    const promises: Promise<string>[] = [];
    
    // Simulate 10 concurrent requests for the same text
    fetchMock.mockClear();
    const start = performance.now();
    
    for (let i = 0; i < 10; i++) {
      promises.push(optimizedService.translate('Hello world', 'ES'));
    }
    
    const results = await Promise.all(promises);
    const end = performance.now();
    const time = end - start;
    const apiCalls = fetchMock.mock.calls.length;

    console.log(`\n🔄 Deduplication Test Results:`);
    console.log(`10 concurrent identical requests: ${time.toFixed(2)}ms, ${apiCalls} API calls`);
    console.log(`All results identical:`, results.every(r => r === results[0]));

    // Should only make 1 API call despite 10 concurrent requests
    expect(apiCalls).toBe(1);
    expect(results).toHaveLength(10);
    expect(results.every(r => r === 'translated text')).toBe(true);
  });

  it('should measure cache eviction performance', async () => {
    const maxCacheSize = 1000;
    const textsToCache = maxCacheSize + 500; // Exceed cache size

    fetchMock.mockClear();
    const start = performance.now();

    // Fill cache beyond capacity
    for (let i = 0; i < textsToCache; i++) {
      await optimizedService.translate(`text ${i}`, 'ES');
    }

    const end = performance.now();
    const time = end - start;
    const stats = optimizedService.getCacheStats();

    console.log(`\n💾 Cache Eviction Test Results:`);
    console.log(`Cached ${textsToCache} items in ${time.toFixed(2)}ms`);
    console.log(`Final cache size: ${stats.size} (max: ${maxCacheSize})`);
    console.log(`API calls made: ${fetchMock.mock.calls.length}`);

    // Cache should be limited to maxCacheSize
    expect(stats.size).toBeLessThanOrEqual(maxCacheSize);
    expect(fetchMock.mock.calls.length).toBe(textsToCache); // Each unique text requires 1 call
  });

  it('should measure cache TTL behavior', async () => {
    const originalDateNow = Date.now;
    let mockTime = 1000000;
    
    vi.stubGlobal('Date', { ...Date, now: () => mockTime });

    // Cache a translation
    await optimizedService.translate('test text', 'ES');
    expect(fetchMock.mock.calls.length).toBe(1);

    // Request same translation immediately (should hit cache)
    fetchMock.mockClear();
    await optimizedService.translate('test text', 'ES');
    expect(fetchMock.mock.calls.length).toBe(0);

    // Advance time beyond TTL (5 minutes)
    mockTime += 301000; // 5 minutes + 1 second
    
    // Request should miss cache and make new API call
    await optimizedService.translate('test text', 'ES');
    expect(fetchMock.mock.calls.length).toBe(1);

    console.log(`\n⏰ Cache TTL Test: Cache expired after 5 minutes as expected`);

    vi.stubGlobal('Date', { ...Date, now: originalDateNow });
  });

  it('should validate translation accuracy', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        translations: [{ text: 'Hola mundo' }]
      })
    });

    const result = await optimizedService.translate('Hello world', 'ES');
    expect(result).toBe('Hola mundo');
    expect(fetchMock.mock.calls.length).toBe(1);

    // Second request should hit cache
    const cachedResult = await optimizedService.translate('Hello world', 'ES');
    expect(cachedResult).toBe('Hola mundo');
    expect(fetchMock.mock.calls.length).toBe(1); // No additional API call
  });
});