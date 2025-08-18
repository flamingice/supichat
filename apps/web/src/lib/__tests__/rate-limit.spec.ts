import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as RL from '../rate-limit-basic';

describe('RateLimiter (simple)', () => {
  const now = new Date('2025-01-01T00:00:00Z').getTime();

  beforeEach(() => {
    vi.setSystemTime(now);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to max requests within window, then blocks', () => {
    // Lines 30-44: first window, increment, then block at max
    const key = 'test:ip';
    let allowedCount = 0;
    for (let i = 0; i < 30; i++) {
      const res = RL.translateLimiter.isAllowed(key);
      if (res.allowed) allowedCount++;
    }
    const blocked = RL.translateLimiter.isAllowed(key);
    expect(allowedCount).toBe(30);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('resets after window expiry', () => {
    // Lines 30-35: new window after resetTime
    const key = 'window:ip';
    for (let i = 0; i < 30; i++) RL.translateLimiter.isAllowed(key);
    const blocked = RL.translateLimiter.isAllowed(key);
    expect(blocked.allowed).toBe(false);

    // Advance 61 seconds
    vi.setSystemTime(now + 61_000);
    const afterReset = RL.translateLimiter.isAllowed(key);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBeGreaterThan(0);
  });

  it('getRateLimitKey prefers x-forwarded-for over x-real-ip', () => {
    // Lines 60-66: x-forwarded-for precedence
    const req = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
        'x-real-ip': '9.9.9.9',
      },
    });
    const key = RL.getRateLimitKey(req, 'prefix');
    expect(key).toBe('prefix:1.2.3.4');
  });

  it('createRateLimitResponse sets Retry-After and headers correctly', async () => {
    // Lines 68-85: response fields
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const reset = Date.now() + 5500;
    const res = RL.createRateLimitResponse(reset);
    expect(res.status).toBe(429);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    expect(res.headers.get('X-RateLimit-Reset')).toMatch(/2025-01-01T00:00:0/);
    // Math.ceil(5.5s) -> 6 seconds
    expect(res.headers.get('Retry-After')).toBe('6');

    const body = await res.json();
    expect(body.error).toBe('Rate limit exceeded');
    expect(body.resetTime).toBe(new Date(reset).toISOString());
  });

  it('executes cleanup branch deterministically when Math.random < 0.01', () => {
    // Line 26: random cleanup trigger; ensure it runs but remains behaviourally correct
    const rnd = vi.spyOn(Math, 'random').mockReturnValue(0); // force cleanup
    const key = 'cleanup:ip';
    const first = RL.roomLimiter.isAllowed(key);
    expect(first.allowed).toBe(true);

    // Advance beyond window to ensure there is something to clean
    vi.setSystemTime(now + 61_000);
    const second = RL.roomLimiter.isAllowed(key);
    expect(second.allowed).toBe(true);
    rnd.mockRestore();
  });
});