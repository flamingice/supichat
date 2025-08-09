import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'web',
    timestamp: new Date().toISOString(),
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/MyChatApp'
  });
}


