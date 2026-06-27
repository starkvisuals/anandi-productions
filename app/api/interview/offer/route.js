export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { interviewId, ctc, startDate } = await request.json();
    if (!interviewId || !ctc || !startDate) {
      return NextResponse.json({ error: 'interviewId, ctc, and startDate are required' }, { status: 400 });
    }

    const { getInterview, markOfferSent } = await import('@/lib/interview-firestore');
    const interview = await getInterview(interviewId);
    if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    if (interview.adminAction !== 'approved') {
      return NextResponse.json({ error: 'Candidate must be approved before sending an offer' }, { status: 400 });
    }

    const { generateOfferLetterPdf } = await import('@/lib/offer-letter');
    const issueDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const pdfBytes = await generateOfferLetterPdf({
      candidateName: interview.candidateName,
      position: interview.position,
      ctc,
      startDate,
      issueDate,
    });

    if (process.env.RESEND_API_KEY && interview.candidateEmail) {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL || 'Anandi Productions <onboarding@resend.dev>';

      await resend.emails.send({
        from,
        to: [interview.candidateEmail],
        subject: `Your Offer Letter — Anandi Productions (${interview.position})`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Congratulations, ${interview.candidateName}!</h1>
            </div>
            <div style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.7;">We're delighted to offer you the <strong>${interview.position}</strong> role at Anandi Productions. Please find your offer letter attached.</p>
              <p style="color: #374151; font-size: 16px; line-height: 1.7;">A member of our team will reach out shortly to walk you through the next steps and the full employment contract.</p>
              <p style="color: #374151; font-size: 16px; line-height: 1.7;">Warm regards,<br/><strong>Team Anandi Productions</strong></p>
            </div>
          </div>
        `,
        attachments: [{
          filename: `Offer-Letter-${interview.candidateName.replace(/\s+/g, '-')}.pdf`,
          content: Buffer.from(pdfBytes).toString('base64'),
        }],
      });
    }

    await markOfferSent(interviewId, { ctc, startDate, issueDate });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Offer letter error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
