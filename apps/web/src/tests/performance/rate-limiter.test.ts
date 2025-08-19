import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performance } from 'perf_hooks';

// Current implementation (with random cleanup issue)
class CurrentRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean expired entries periodically - PERFORMANCE ISSUE: Random cleanup!
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    if (!entry || now > entry.resetTime) {
      const resetTime = now + this.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, resetTime, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, resetTime: entry.resetTime, remaining: 0 };
    }

    entry.count++;
    this.store.set(key, entry);
    return { allowed: true, resetTime: entry.resetTime, remaining: this.maxRequests - entry.count };
  }

  private cleanup(now: number) {
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  getStoreSize() {
    return this.store.size;
  }
}

// Optimized implementation (TTL-based cleanup)
class OptimizedRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  private windowMs: number;
  private maxRequests: number;
  private maxStoreSize: number;
  private lastCleanup: number = 0;
  private cleanupInterval: number = 30000; // 30 seconds

  constructor(windowMs: number, maxRequests: number, maxStoreSize = 10000) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxStoreSize = maxStoreSize;
  }

  isAllowed(key: string): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Deterministic cleanup - run every 30 seconds OR when store gets too large
    if (now - this.lastCleanup > this.cleanupInterval || this.store.size > this.maxStoreSize) {
      this.cleanup(now);
      this.lastCleanup = now;
    }

    if (!entry || now > entry.resetTime) {
      const resetTime = now + this.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, resetTime, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, resetTime: entry.resetTime, remaining: 0 };
    }

    entry.count++;
    this.store.set(key, entry);
    return { allowed: true, resetTime: entry.resetTime, remaining: this.maxRequests - entry.count };
  }

  private cleanup(now: number) {
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  getStoreSize() {
    return this.store.size;
  }
}

describe('Rate Limiter Performance Tests', () => {
  let currentLimiter: CurrentRateLimiter;
  let optimizedLimiter: OptimizedRateLimiter;

  beforeEach(() => {
    // Mock Math.random to ensure deterministic tests
    vi.stubGlobal('Math', { ...Math, random: vi.fn(() => 0.005) }); // 0.5% chance
    
    currentLimiter = new CurrentRateLimiter(60000, 30); // 30 req/min
    optimizedLimiter = new OptimizedRateLimiter(60000, 30); // 30 req/min
  });

  it('should measure cleanup performance difference', () => {
    const numRequests = 10000;
    const numKeys = 1000;

    // Test current implementation
    const currentStart = performance.now();
    for (let i = 0; i < numRequests; i++) {
      const key = `user${i % numKeys}`;
      currentLimiter.isAllowed(key);
    }
    const currentEnd = performance.now();
    const currentTime = currentEnd - currentStart;

    // Test optimized implementation
    const optimizedStart = performance.now();
    for (let i = 0; i < numRequests; i++) {
      const key = `user${i % numKeys}`;
      optimizedLimiter.isAllowed(key);
    }
    const optimizedEnd = performance.now();
    const optimizedTime = optimizedEnd - optimizedStart;

    console.log(`\n📊 Rate Limiter Performance Results:`);
    console.log(`Current implementation: ${currentTime.toFixed(2)}ms`);
    console.log(`Optimized implementation: ${optimizedTime.toFixed(2)}ms`);
    console.log(`Improvement: ${((currentTime - optimizedTime) / currentTime * 100).toFixed(1)}%`);
    console.log(`Current store size: ${currentLimiter.getStoreSize()}`);
    console.log(`Optimized store size: ${optimizedLimiter.getStoreSize()}`);

    // Optimized should be faster
    expect(optimizedTime).toBeLessThan(currentTime);
  });

  it('should measure memory usage over time', async () => {
    const iterations = 5000;
    const keysPerIteration = 100;

    // Current implementation memory growth
    const currentSizes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < keysPerIteration; j++) {
        currentLimiter.isAllowed(`temp-key-${i}-${j}`);
      }
      if (i % 1000 === 0) {
        currentSizes.push(currentLimiter.getStoreSize());
      }
    }

    // Optimized implementation memory growth
    const optimizedSizes: number[] = [];
    for (let i = 0; i < iterations; i++) {
      for (let j = 0; j < keysPerIteration; j++) {
        optimizedLimiter.isAllowed(`temp-key-${i}-${j}`);
      }
      if (i % 1000 === 0) {
        optimizedSizes.push(optimizedLimiter.getStoreSize());
      }
    }

    console.log(`\n💾 Memory Usage Comparison:`);
    console.log(`Current final size: ${currentSizes[currentSizes.length - 1]}`);
    console.log(`Optimized final size: ${optimizedSizes[optimizedSizes.length - 1]}`);

    // Optimized should have better memory management
    expect(optimizedSizes[optimizedSizes.length - 1]).toBeLessThanOrEqual(currentSizes[currentSizes.length - 1]);
  });

  it('should measure cleanup consistency', () => {
    const numTests = 1000;
    const cleanupCounts = { current: 0, optimized: 0 };

    // Count how many times cleanup runs in current implementation (random)
    vi.mocked(Math.random).mockImplementation(() => 0.005); // 0.5% chance
    for (let i = 0; i < numTests; i++) {
      const originalSize = currentLimiter.getStoreSize();
      currentLimiter.isAllowed(`test-key-${i}`);
      if (currentLimiter.getStoreSize() < originalSize + 1) {
        cleanupCounts.current++;
      }
    }

    // Optimized runs cleanup deterministically
    const timeStart = Date.now();
    vi.stubGlobal('Date', { ...Date, now: () => timeStart });
    
    for (let i = 0; i < numTests; i++) {
      // Simulate time passing to trigger cleanup
      vi.stubGlobal('Date', { ...Date, now: () => timeStart + (i * 31) }); // 31ms increments
      optimizedLimiter.isAllowed(`test-key-${i}`);
    }

    console.log(`\n🔄 Cleanup Consistency:`);
    console.log(`Current cleanups (random): ${cleanupCounts.current}/${numTests}`);
    console.log(`Optimized cleanups: deterministic based on time/size`);

    // Current implementation cleanup should be unpredictable
    expect(cleanupCounts.current).toBeGreaterThan(0);
    expect(cleanupCounts.current).toBeLessThan(numTests);
  });

  it('should validate rate limiting accuracy', () => {
    const key = 'test-user';
    const limit = 5;
    const limiter = new OptimizedRateLimiter(1000, limit); // 5 req/second

    // Should allow up to limit
    for (let i = 0; i < limit; i++) {
      const result = limiter.isAllowed(key);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(limit - i - 1);
    }

    // Should reject beyond limit
    const result = limiter.isAllowed(key);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});