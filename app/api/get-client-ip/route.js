import { NextResponse } from 'next/server';

export async function GET(request) {
  const headers = request.headers;
  const xff = headers.get('x-forwarded-for') || '';
  const ip = xff.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown';
  return NextResponse.json({ ip });
}
