import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performance } from 'perf_hooks';

// Import optimized implementations
import { OptimizedTranslationService } from '@/lib/translation-service';
import { translateLimiter } from '@/lib/rate-limit';

// Basic implementation for comparison
import { translateLimiter as basicLimiter } from '@/lib/rate-limit-basic';

describe('Optimized Implementation Comparison Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should demonstrate rate limiter performance improvements', async () => {
    const numRequests = 5000;
    const numKeys = 500;

    console.log(`\n🔄 Rate Limiter Performance Comparison (${numRequests} requests, ${numKeys} keys):`);

    // Test basic implementation
    const basicStart = performance.now();
    for (let i = 0; i < numRequests; i++) {
      const key = `user${i % numKeys}`;
      basicLimiter.isAllowed(key);
    }
    const basicEnd = performance.now();
    const basicTime = basicEnd - basicStart;

    // Test optimized implementation
    const optimizedStart = performance.now();
    for (let i = 0; i < numRequests; i++) {
      const key = `user${i % numKeys}`;
      translateLimiter.isAllowed(key);
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    console.log(`Basic rate limiter: ${basicTime.toFixed(2)}ms`);
    console.log(`Optimized rate limiter: ${optimizedTime.toFixed(2)}ms`);
    console.log(`Performance improvement: ${((basicTime - optimizedTime) / basicTime * 100).toFixed(1)}%`);

    // Get stats
    const stats = translateLimiter.getStats();
    console.log(`Optimized store size: ${stats.storeSize}/${stats.maxStoreSize}`);

    expect(optimizedTime).toBeLessThanOrEqual(basicTime * 1.1); // Allow 10% margin
  });

  it('should demonstrate translation service cache effectiveness', async () => {
    // Mock fetch for testing
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          translations: [{ text: `translated ${callCount}` }]
        })
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const service = new OptimizedTranslationService('test-key');

    console.log(`\n📚 Translation Service Cache Effectiveness:`);

    // Test cache hits with repeated translations
    const texts = [
      'Hello world',
      'How are you?', 
      'Good morning',
      'Hello world', // repeat
      'How are you?', // repeat
      'Good morning', // repeat
      'New text'
    ];

    const start = performance.now();
    
    for (const text of texts) {
      await service.translate(text, 'ES');
    }
    
    const end = performance.now();
    const stats = service.getStats();

    console.log(`Translation time: ${(end - start).toFixed(2)}ms`);
    console.log(`Total requests: ${stats.totalRequests}`);
    console.log(`Cache hits: ${stats.cacheHits}`);
    console.log(`Cache misses: ${stats.cacheMisses}`);
    console.log(`Cache hit ratio: ${(service.getCacheHitRatio() * 100).toFixed(1)}%`);
    console.log(`API calls made: ${callCount} (expected: 4 unique texts)`);
    console.log(`API call reduction: ${((texts.length - callCount) / texts.length * 100).toFixed(1)}%`);

    expect(stats.cacheHits).toBeGreaterThan(0);
    expect(callCount).toBe(4); // Only 4 unique texts should make API calls
    expect(service.getCacheHitRatio()).toBeGreaterThan(0.4); // > 40% cache hit ratio
  });

  it('should demonstrate memory usage improvements', async () => {
    const initialMemory = process.memoryUsage();
    console.log(`\n💾 Memory Usage Analysis:`);
    console.log(`Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

    // Simulate heavy usage
    const service = new OptimizedTranslationService('test-key');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translations: [{ text: 'translated' }] })
    });
    vi.stubGlobal('fetch', mockFetch);

    // Create many translations to test cache eviction
    const promises = [];
    for (let i = 0; i < 2000; i++) {
      promises.push(service.translate(`text ${i}`, 'ES'));
    }
    await Promise.all(promises);

    const afterTranslations = process.memoryUsage();
    console.log(`After 2000 translations: ${(afterTranslations.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    const stats = service.getStats();
    console.log(`Cache size: ${stats.cacheSize} (should be ≤ 1000 due to eviction)`);
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      const afterGC = process.memoryUsage();
      console.log(`After GC: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    }

    // Cache should be limited by eviction policy
    expect(stats.cacheSize).toBeLessThanOrEqual(1000);
  });

  it('should demonstrate batching effectiveness', async () => {
    const service = new OptimizedTranslationService('test-key');
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          translations: [{ text: `translated ${callCount}` }]
        })
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    console.log(`\n⚡ Batch Translation Performance:`);

    const texts = [
      'Hello', 'World', 'Test', 'Batch', 'Translation',
      'Hello', 'World', 'Test' // Some duplicates
    ];

    const start = performance.now();
    const results = await service.translateBatch(texts, 'ES');
    const end = performance.now();

    console.log(`Batch translation time: ${(end - start).toFixed(2)}ms`);
    console.log(`Input texts: ${texts.length}`);
    console.log(`Unique texts: ${new Set(texts).size}`);
    console.log(`API calls made: ${callCount}`);
    console.log(`Results length: ${results.length}`);

    expect(results).toHaveLength(texts.length);
    expect(callCount).toBe(new Set(texts).size); // Only unique texts should make API calls
  });

  it('should benchmark concurrent request deduplication', async () => {
    const service = new OptimizedTranslationService('test-key');
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      return new Promise(resolve => {
        // Simulate network delay
        setTimeout(() => {
          resolve({
            ok: true,
            json: () => Promise.resolve({
              translations: [{ text: `translated ${callCount}` }]
            })
          });
        }, 10);
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    console.log(`\n🚀 Concurrent Request Deduplication:`);

    // Make 20 concurrent requests for the same text
    const promises = Array.from({ length: 20 }, () => 
      service.translate('concurrent test', 'ES')
    );

    const start = performance.now();
    const results = await Promise.all(promises);
    const end = performance.now();

    console.log(`20 concurrent requests completed in: ${(end - start).toFixed(2)}ms`);
    console.log(`API calls made: ${callCount} (should be 1)`);
    console.log(`All results identical: ${results.every(r => r === results[0])}`);
    console.log(`Deduplication effectiveness: ${((20 - callCount) / 20 * 100).toFixed(1)}%`);

    expect(callCount).toBe(1); // Only 1 API call should be made
    expect(results.every(r => r === results[0])).toBe(true);
  });

  it('should measure overall performance metrics', async () => {
    console.log(`\n📊 Overall Performance Summary:`);
    
    // Rate limiter efficiency
    const rateLimiterStats = translateLimiter.getStats();
    console.log(`Rate Limiter:`);
    console.log(`  - Store size: ${rateLimiterStats.storeSize}/${rateLimiterStats.maxStoreSize}`);
    console.log(`  - Last cleanup: ${rateLimiterStats.lastCleanup}`);
    
    // Translation service efficiency
    const service = new OptimizedTranslationService('test-key');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ translations: [{ text: 'test' }] })
    });
    vi.stubGlobal('fetch', mockFetch);

    // Quick test run
    await service.translate('test1', 'ES');
    await service.translate('test1', 'ES'); // Cache hit
    await service.translate('test2', 'ES');
    
    const translationStats = service.getStats();
    console.log(`Translation Service:`);
    console.log(`  - Cache hit ratio: ${(service.getCacheHitRatio() * 100).toFixed(1)}%`);
    console.log(`  - Average response time: ${translationStats.avgResponseTime.toFixed(2)}ms`);
    console.log(`  - Total requests: ${translationStats.totalRequests}`);
    console.log(`  - Cache size: ${translationStats.cacheSize}`);

    // Performance expectations
    expect(service.getCacheHitRatio()).toBeGreaterThan(0.2); // > 20% cache hits
    expect(translationStats.avgResponseTime).toBeLessThan(1000); // < 1s average
  });
});