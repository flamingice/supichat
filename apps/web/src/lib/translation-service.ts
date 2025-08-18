/**
 * Optimized translation service with LRU cache and request deduplication
 * Reduces API calls and improves response times for repeated translations
 */

interface CacheEntry {
  value: string;
  timestamp: number;
  accessCount: number;
}

interface TranslationStats {
  cacheHits: number;
  cacheMisses: number;
  deduplicatedRequests: number;
  totalRequests: number;
  cacheSize: number;
  avgResponseTime: number;
}

export class OptimizedTranslationService {
  private apiKey: string;
  private apiUrl: string;
  private cache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<string>>();
  private maxCacheSize = 1000;
  private cacheTtl = 300000; // 5 minutes
  private stats: TranslationStats = {
    cacheHits: 0,
    cacheMisses: 0,
    deduplicatedRequests: 0,
    totalRequests: 0,
    cacheSize: 0,
    avgResponseTime: 0
  };

  constructor(apiKey: string, apiUrl?: string) {
    this.apiKey = apiKey;
    this.apiUrl = apiUrl || (
      process.env.DEEPL_API_FREE === '1' || process.env.DEEPL_API_FREE === 'true'
        ? 'https://api-free.deepl.com/v2/translate'
        : 'https://api.deepl.com/v2/translate'
    );
  }

  async translate(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    if (!this.apiKey) {
      console.warn('[Translation] No API key provided, returning empty translation');
      return '';
    }

    if (!text.trim()) {
      return '';
    }

    const cacheKey = this.getCacheKey(text, targetLang, sourceLang);
    
    // Check cache first
    const cached = this.getCachedTranslation(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      this.updateStats(startTime);
      return cached;
    }

    this.stats.cacheMisses++;

    // Check if request is already in flight (deduplication)
    const inFlightPromise = this.inFlight.get(cacheKey);
    if (inFlightPromise) {
      this.stats.deduplicatedRequests++;
      const result = await inFlightPromise;
      this.updateStats(startTime);
      return result;
    }

    // Make new request
    const promise = this.makeRequest(text, targetLang, sourceLang);
    this.inFlight.set(cacheKey, promise);

    try {
      const result = await promise;
      
      // Cache the result
      this.cacheTranslation(cacheKey, result);
      this.updateStats(startTime);
      
      return result;
    } catch (error) {
      console.error('[Translation] Request failed:', error);
      this.updateStats(startTime);
      throw error;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private getCacheKey(text: string, targetLang: string, sourceLang?: string): string {
    const normalizedText = text.trim().toLowerCase();
    const key = sourceLang 
      ? `${normalizedText}:${sourceLang}:${targetLang}`
      : `${normalizedText}:${targetLang}`;
    return key;
  }

  private getCachedTranslation(cacheKey: string): string | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTtl) {
      this.cache.delete(cacheKey);
      return null;
    }

    // Update access count for LRU
    cached.accessCount++;
    cached.timestamp = now;
    return cached.value;
  }

  private cacheTranslation(cacheKey: string, translation: string): void {
    const now = Date.now();
    
    // Add to cache
    this.cache.set(cacheKey, {
      value: translation,
      timestamp: now,
      accessCount: 1
    });

    // Evict old entries if cache is full
    this.evictOldEntries();
    this.stats.cacheSize = this.cache.size;
  }

  private evictOldEntries(): void {
    if (this.cache.size <= this.maxCacheSize) return;

    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by access count (ascending) then by timestamp (ascending) - LRU
    entries.sort((a, b) => {
      const accessDiff = a[1].accessCount - b[1].accessCount;
      if (accessDiff !== 0) return accessDiff;
      return a[1].timestamp - b[1].timestamp;
    });

    // Remove oldest/least accessed entries
    const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
    toRemove.forEach(([key]) => this.cache.delete(key));

    console.log(`[Translation] Evicted ${toRemove.length} cache entries, size: ${this.cache.size}`);
  }

  private async makeRequest(text: string, targetLang: string, sourceLang?: string): Promise<string> {
    const body = new URLSearchParams({ 
      text: text.trim(), 
      target_lang: targetLang.toUpperCase() 
    });

    if (sourceLang) {
      body.append('source_lang', sourceLang.toUpperCase());
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${this.apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      // Enable keep-alive for connection reuse
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      const errorBody = await this.safeResponseText(response);
      throw new Error(`Translation request failed: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    return data?.translations?.[0]?.text ?? '';
  }

  private async safeResponseText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  private updateStats(startTime: number): void {
    const responseTime = performance.now() - startTime;
    const total = this.stats.totalRequests;
    this.stats.avgResponseTime = ((this.stats.avgResponseTime * (total - 1)) + responseTime) / total;
  }

  getStats(): TranslationStats {
    return { ...this.stats };
  }

  getCacheHitRatio(): number {
    const total = this.stats.cacheHits + this.stats.cacheMisses;
    return total > 0 ? this.stats.cacheHits / total : 0;
  }

  clearCache(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.stats.cacheSize = 0;
    console.log('[Translation] Cache cleared');
  }

  // Batch translation for multiple texts
  async translateBatch(texts: string[], targetLang: string, sourceLang?: string): Promise<string[]> {
    const uniqueTexts = [...new Set(texts)];
    const translations = await Promise.all(
      uniqueTexts.map(text => this.translate(text, targetLang, sourceLang))
    );
    
    const translationMap = new Map(uniqueTexts.map((text, i) => [text, translations[i]]));
    return texts.map(text => translationMap.get(text) || '');
  }
}

// Singleton instance for the app
let translationService: OptimizedTranslationService | null = null;

export function getTranslationService(): OptimizedTranslationService {
  if (!translationService) {
    const apiKey = process.env.DEEPL_API_KEY || '';
    translationService = new OptimizedTranslationService(apiKey);
  }
  return translationService;
}