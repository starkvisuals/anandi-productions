export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
export async function POST(request) {
  try {
    const { getJobLinkByToken, createInterview } = await import('@/lib/interview-firestore');
    const {
      token,
      candidateName,
      candidateEmail,
      candidatePhone,
      currentCTC,
      expectedCTC,
      location,
      noticePeriod,
      lastEmployerName,
      lastEmployerPhone,
      whyInterested,
    } = await request.json();

    // Validate token
    const jobLink = await getJobLinkByToken(token);
    if (!jobLink) {
      return NextResponse.json({ error: 'Invalid or expired interview link' }, { status: 404 });
    }

    // Create interview session
    const interview = await createInterview({
      jobLinkId: jobLink.id,
      position: jobLink.position,
      candidateName,
      candidateEmail,
      candidatePhone,
      currentCTC,
      expectedCTC,
      location,
      noticePeriod,
      lastEmployerName,
      lastEmployerPhone,
      whyInterested,
    });

    return NextResponse.json({ success: true, interviewId: interview.id });
  } catch (error) {
    console.error('Start interview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
