export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { saveDocumentUrls } = await import('@/lib/interview-firestore');
    const { interviewId, documents } = await request.json();
    if (!interviewId) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    await saveDocumentUrls(interviewId, documents || {});

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save documents error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
