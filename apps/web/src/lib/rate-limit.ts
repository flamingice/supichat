/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a proper rate limiting service
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): { allowed: boolean; resetTime?: number; remaining?: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    // Clean expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    if (!entry || now > entry.resetTime) {
      // First request or expired window
      const resetTime = now + this.windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, resetTime, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, resetTime: entry.resetTime, remaining: 0 };
    }

    // Increment counter
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
}

// Rate limiters for different endpoints
export const translateLimiter = new RateLimiter(60 * 1000, 30); // 30 requests per minute
export const roomLimiter = new RateLimiter(60 * 1000, 10); // 10 room creations per minute

export function getRateLimitKey(req: Request, prefix: string): string {
  // Try to get real IP from headers (for proxy setups)
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0] || realIp || 'unknown';
  return `${prefix}:${ip}`;
}

export function createRateLimitResponse(resetTime: number) {
  const resetDate = new Date(resetTime).toISOString();
  return new Response(
    JSON.stringify({ 
      error: 'Rate limit exceeded', 
      resetTime: resetDate,
      message: 'Too many requests. Please try again later.' 
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Reset': resetDate,
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
      },
    }
  );
}
