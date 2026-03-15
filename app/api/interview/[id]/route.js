export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { getInterview } = await import('@/lib/interview-firestore');
    const interview = await getInterview(id);
    if (!interview) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, interview });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
