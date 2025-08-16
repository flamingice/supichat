import { NextResponse } from 'next/server';
import { roomLimiter, getRateLimitKey, createRateLimitResponse } from '@/lib/rate-limit';

export async function POST(req: Request) {
  // Rate limiting
  const rateLimitKey = getRateLimitKey(req, 'room');
  const rateLimit = roomLimiter.isAllowed(rateLimitKey);
  
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit.resetTime!);
  }

  const id = crypto.randomUUID();
  return NextResponse.json({ id });
}




