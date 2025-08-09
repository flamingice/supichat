import { NextResponse } from 'next/server';

export async function POST() {
  const id = crypto.randomUUID();
  return NextResponse.json({ id });
}


