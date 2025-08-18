import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as RLO from '../rate-limit';

describe('OptimizedRateLimiter (instances)', () => {
  const now = new Date('2025-01-01T00:00:00Z').getTime();

  beforeEach(() => {
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows then blocks when exceeding maxRequests', () => {
    // Lines 35-44, 46-50: allow then deny
    const key = 'opt:test';
    for (let i = 0; i < 10; i++) {
      const res = RLO.roomLimiter.isAllowed(key);
      expect(res.allowed).toBe(true);
    }
    const blocked = RLO.roomLimiter.isAllowed(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after window and performs deterministic cleanup', () => {
    // Lines 29-33: cleanup runs by interval; lines 52-59: expired entries removal
    const key = 'opt:cleanup';
    RLO.translateLimiter.isAllowed(key);
    // Advance beyond 30s cleanup interval and 60s window
    vi.setSystemTime(now + 61_000);
    const after = RLO.translateLimiter.isAllowed(key);
    expect(after.allowed).toBe(true);

    const stats = RLO.translateLimiter.getStats();
    expect(typeof stats.storeSize).toBe('number');
    expect(typeof stats.lastCleanup).toBe('string');
  });
});