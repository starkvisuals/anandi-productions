export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
const RECRUITER_PLACEHOLDER = process.env.RECRUITER_EMAIL || 'recruiter@anandi-productions.com';

export async function POST(request) {
  try {
    const { getInterview, setAdminAction } = await import('@/lib/interview-firestore');
    const { interviewId, action } = await request.json();
    if (!interviewId || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const interview = await getInterview(interviewId);
    if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });

    await setAdminAction(interviewId, action);

    // If approved, notify recruiter
    if (action === 'approved') {
      await notifyRecruiter(interview);
    }

    // If admin manually rejects, send rejection to candidate
    if (action === 'rejected' && interview.candidateEmail) {
      await sendRejectionEmail(interview);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Action error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function notifyRecruiter(interview) {
  if (!process.env.RESEND_API_KEY) return;

  const score = interview.score || {};
  const suggestedQuestions = generateSuggestedQuestions(interview, score);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #0d0d14; color: #e4e4e7; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 32px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 8px;">✅</div>
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Candidate Approved for Round 2</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0;">Please schedule an in-person interview</p>
      </div>
      <div style="padding: 32px;">
        <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #a78bfa; margin: 0 0 16px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Candidate Profile</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 6px 0; color: #9ca3af; width: 160px;">Name</td><td style="color: #e4e4e7; font-weight: 600;">${interview.candidateName}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Position</td><td style="color: #e4e4e7;">${interview.position}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Phone</td><td style="color: #e4e4e7;"><strong>${interview.candidatePhone}</strong></td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Email</td><td style="color: #e4e4e7;">${interview.candidateEmail}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Location</td><td style="color: #e4e4e7;">${interview.location || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Current CTC</td><td style="color: #e4e4e7;">${interview.currentCTC || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Expected CTC</td><td style="color: #e4e4e7;">${interview.expectedCTC || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Notice Period</td><td style="color: #e4e4e7;">${interview.noticePeriod || '—'}</td></tr>
            <tr><td style="padding: 6px 0; color: #9ca3af;">Last Employer</td><td style="color: #e4e4e7;">${interview.lastEmployerName || '—'} ${interview.lastEmployerPhone ? `(${interview.lastEmployerPhone})` : ''}</td></tr>
          </table>
        </div>

        <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #a78bfa; margin: 0 0 8px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">AI Score</h2>
          <div style="font-size: 42px; font-weight: 800; color: #22c55e;">${score.totalScore || '—'}<span style="font-size: 18px; color: #6b7280;">/100</span></div>
          <div style="color: #86efac; font-size: 14px; margin-top: 4px;">${score.recommendation || ''}</div>
          ${score.summary ? `<p style="color: #9ca3af; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">${score.summary}</p>` : ''}
        </div>

        ${score.redFlags && score.redFlags.length > 0 ? `
        <div style="background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #ef4444; margin: 0 0 12px; font-size: 14px;">⚠️ Points to Probe in Round 2</h2>
          ${score.redFlags.map(f => `<div style="color: #fca5a5; font-size: 13px; padding: 3px 0;">• ${f}</div>`).join('')}
        </div>` : ''}

        <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #a78bfa; margin: 0 0 16px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Suggested Questions for Round 2</h2>
          ${suggestedQuestions.map((q, i) => `<div style="color: #e4e4e7; font-size: 14px; padding: 8px 0; border-bottom: 1px solid #1e1e2e;"><span style="color: #6b7280;">${i + 1}.</span> ${q}</div>`).join('')}
        </div>

        <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px;">
          <h2 style="color: #a78bfa; margin: 0 0 12px; font-size: 14px;">Next Steps</h2>
          <p style="color: #9ca3af; font-size: 14px; line-height: 1.7; margin: 0;">Please call <strong style="color: #e4e4e7;">${interview.candidateName}</strong> at <strong style="color: #6366f1;">${interview.candidatePhone}</strong> to schedule the in-person interview. Let them know they have cleared Round 1 and we look forward to meeting them.</p>
        </div>
      </div>
      <div style="padding: 20px; text-align: center; border-top: 1px solid #1e1e2e;">
        <p style="color: #4b5563; font-size: 12px; margin: 0;">Anandi Productions AI Hiring System</p>
      </div>
    </div>
  `;

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || 'Anandi Productions <onboarding@resend.dev>';

  await resend.emails.send({
    from,
    to: [RECRUITER_PLACEHOLDER],
    subject: `Round 2 — ${interview.candidateName} | ${interview.position} | Score ${interview.score?.totalScore}/100`,
    html,
  });
}

async function sendRejectionEmail(interview) {
  if (!process.env.RESEND_API_KEY || !interview.candidateEmail) return;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
      <div style="background: linear-gradient(135deg, #1e1e2e 0%, #16161f 100%); padding: 32px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Anandi Productions</h1>
      </div>
      <div style="padding: 40px;">
        <p style="color: #374151; font-size: 16px; line-height: 1.7;">Dear ${interview.candidateName},</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.7;">Thank you for your interest in the <strong>${interview.position}</strong> position at Anandi Productions and for the time you spent with us during the interview process.</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.7;">After careful review, we have decided to move forward with other candidates at this time. We appreciate your effort and wish you the very best in your career.</p>
        <p style="color: #374151; font-size: 16px; line-height: 1.7;">Warm regards,<br/><strong>Team Anandi Productions</strong></p>
      </div>
      <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">Anandi Productions • Creative Production House</p>
      </div>
    </div>
  `;

  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL || 'Anandi Productions <onboarding@resend.dev>';

  await resend.emails.send({
    from,
    to: [interview.candidateEmail],
    subject: 'Your Application at Anandi Productions',
    html,
  });
}

function generateSuggestedQuestions(interview, score) {
  const questions = [
    `Can you walk us through a specific project from your portfolio that best represents your work as a ${interview.position}?`,
    `Our team works under very tight deadlines in advertising. What's the most challenging deadline you've successfully met, and how did you manage it?`,
    `Tell us about your ideal working environment and what kind of team culture helps you do your best work.`,
    `Where do you see yourself professionally in the next 2-3 years, and how does this role fit into that plan?`,
  ];

  // Add probing questions based on red flags
  if (score.redFlags && score.redFlags.length > 0) {
    questions.push(`We noticed from your interview that [${score.redFlags[0]}] — could you elaborate on that for us?`);
  }

  // Add commitment-specific question if commitment score is low
  if (score.scores?.commitment < 6) {
    questions.push(`We're looking for someone who can commit long-term. Our last few hires left within 2 months when the workload increased. What would make you stay and grow with us for 2+ years?`);
  }

  return questions.slice(0, 5);
}
