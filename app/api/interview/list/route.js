export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
export async function GET() {
  try {
    const { getAllInterviews } = await import('@/lib/interview-firestore');
    const interviews = await getAllInterviews();
    return NextResponse.json({ success: true, interviews });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
