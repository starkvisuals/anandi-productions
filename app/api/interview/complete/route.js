export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { buildScoringPrompt } from '@/lib/interview-questions';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ADMIN_EMAIL = 'info@harneshjoshi.com';

export async function POST(request) {
  try {
    const { interviewId } = await request.json();
    if (!interviewId) return NextResponse.json({ error: 'Interview ID required' }, { status: 400 });

    const { getInterview, completeInterview } = await import('@/lib/interview-firestore');
    const interview = await getInterview(interviewId);
    if (!interview) return NextResponse.json({ error: 'Interview not found' }, { status: 404 });
    if (interview.status === 'completed') return NextResponse.json({ success: true, score: interview.score });

    // Build transcript
    const transcript = interview.messages
      .map(m => `${m.role === 'user' ? interview.candidateName : 'Aria (AI Interviewer)'}: ${m.content}`)
      .join('\n\n');

    // Score interview using Claude with tool use for structured output
    const scoringResponse = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      tools: [{
        name: 'score_interview',
        description: 'Score the interview and provide structured evaluation',
        input_schema: {
          type: 'object',
          properties: {
            scores: {
              type: 'object',
              properties: {
                skills: { type: 'number', description: 'Role-specific skills score 0-10' },
                commitment: { type: 'number', description: 'Commitment and loyalty score 0-10' },
                workPressure: { type: 'number', description: 'Work pressure handling score 0-10' },
                background: { type: 'number', description: 'Background and stability score 0-10' },
                values: { type: 'number', description: 'Values and culture fit score 0-10' },
                communication: { type: 'number', description: 'Communication clarity score 0-10' },
              },
              required: ['skills', 'commitment', 'workPressure', 'background', 'values', 'communication'],
            },
            whyHire: {
              type: 'array',
              items: { type: 'string' },
              description: 'Bullet points for why to hire this candidate (3-5 points)',
            },
            whyReject: {
              type: 'array',
              items: { type: 'string' },
              description: 'Bullet points for why not to hire (3-5 points)',
            },
            redFlags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Specific red flags detected in the interview (if any)',
            },
            recommendation: {
              type: 'string',
              enum: ['Strong Hire', 'Consider', 'Reject'],
              description: 'Overall hiring recommendation',
            },
            summary: {
              type: 'string',
              description: 'Brief 2-3 sentence summary of the candidate',
            },
          },
          required: ['scores', 'whyHire', 'whyReject', 'redFlags', 'recommendation', 'summary'],
        },
      }],
      tool_choice: { type: 'tool', name: 'score_interview' },
      messages: [{
        role: 'user',
        content: buildScoringPrompt(transcript, interview),
      }],
    });

    // Extract tool result
    const toolUse = scoringResponse.content.find(b => b.type === 'tool_use');
    if (!toolUse) throw new Error('No scoring result from AI');

    const { scores, whyHire, whyReject, redFlags, recommendation, summary } = toolUse.input;

    // Calculate weighted total score
    const weights = {
      skills: 0.25,
      commitment: 0.25,
      workPressure: 0.15,
      background: 0.15,
      values: 0.10,
      communication: 0.10,
    };
    const totalScore = Math.round(
      Object.entries(scores).reduce((sum, [key, val]) => sum + (val * (weights[key] || 0) * 10), 0)
    );

    const score = {
      scores,
      totalScore,
      whyHire,
      whyReject,
      redFlags,
      recommendation,
      summary,
    };

    // Save to Firestore
    await completeInterview(interviewId, score);

    // Send emails
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';
    const appUrl = `${baseUrl}/hiring`;

    // 1. Send admin report email
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Interview Complete — ${interview.candidateName} | ${interview.position} | Score: ${totalScore}/100`,
      type: 'interview_report',
      candidateName: interview.candidateName,
      position: interview.position,
      totalScore,
      recommendation,
      score,
      interview,
      appUrl,
    });

    // 2. Send auto-rejection if score < 60
    if (totalScore < 60) {
      await sendEmail({
        to: interview.candidateEmail,
        subject: 'Your Application at Anandi Productions',
        type: 'interview_rejection',
        candidateName: interview.candidateName,
        position: interview.position,
      });
    }

    return NextResponse.json({ success: true, score });
  } catch (error) {
    console.error('Complete interview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendEmail({ to, subject, type, candidateName, position, totalScore, recommendation, score, interview, appUrl }) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';

    let html = '';

    if (type === 'interview_report') {
      const scoreColor = totalScore >= 80 ? '#22c55e' : totalScore >= 60 ? '#f59e0b' : '#ef4444';
      const recColor = recommendation === 'Strong Hire' ? '#22c55e' : recommendation === 'Consider' ? '#f59e0b' : '#ef4444';

      const scoreRows = [
        ['Role-Specific Skills', score.scores.skills, 25],
        ['Commitment & Loyalty', score.scores.commitment, 25],
        ['Work Pressure Handling', score.scores.workPressure, 15],
        ['Background & Stability', score.scores.background, 15],
        ['Values & Culture Fit', score.scores.values, 10],
        ['Communication Clarity', score.scores.communication, 10],
      ];

      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #0d0d14; color: #e4e4e7; border-radius: 16px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">📋</div>
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">New Interview Completed</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">Anandi Productions Hiring System</p>
          </div>

          <div style="padding: 32px;">
            <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #a78bfa; margin: 0 0 16px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Candidate Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #9ca3af; width: 160px;">Name</td><td style="color: #e4e4e7; font-weight: 600;">${candidateName}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Position</td><td style="color: #e4e4e7;">${position}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Email</td><td style="color: #e4e4e7;">${interview.candidateEmail}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Phone</td><td style="color: #e4e4e7;">${interview.candidatePhone}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Location</td><td style="color: #e4e4e7;">${interview.location || '—'}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Current CTC</td><td style="color: #e4e4e7;">${interview.currentCTC || '—'}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Expected CTC</td><td style="color: #e4e4e7;">${interview.expectedCTC || '—'}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Notice Period</td><td style="color: #e4e4e7;">${interview.noticePeriod || '—'}</td></tr>
                <tr><td style="padding: 6px 0; color: #9ca3af;">Last Employer</td><td style="color: #e4e4e7;">${interview.lastEmployerName || '—'}</td></tr>
              </table>
            </div>

            <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
              <div style="font-size: 56px; font-weight: 800; color: ${scoreColor};">${totalScore}<span style="font-size: 24px; color: #6b7280;">/100</span></div>
              <div style="display: inline-block; margin-top: 8px; padding: 6px 16px; background: ${recColor}22; border: 1px solid ${recColor}; border-radius: 20px; color: ${recColor}; font-weight: 700; font-size: 14px;">${recommendation}</div>
              ${score.summary ? `<p style="color: #9ca3af; font-size: 14px; margin: 16px 0 0; line-height: 1.6;">${score.summary}</p>` : ''}
            </div>

            <div style="background: #16161f; border: 1px solid #1e1e2e; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #a78bfa; margin: 0 0 16px; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Score Breakdown</h2>
              ${scoreRows.map(([label, val, weight]) => `
                <div style="margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #e4e4e7; font-size: 13px;">${label}</span>
                    <span style="color: #a78bfa; font-weight: 700;">${val}/10 <span style="color: #6b7280; font-weight: 400;">(${weight}%)</span></span>
                  </div>
                  <div style="background: #1e1e2e; border-radius: 4px; height: 6px;">
                    <div style="background: ${val >= 7 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444'}; width: ${val * 10}%; height: 6px; border-radius: 4px;"></div>
                  </div>
                </div>
              `).join('')}
            </div>

            ${score.redFlags && score.redFlags.length > 0 ? `
            <div style="background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <h2 style="color: #ef4444; margin: 0 0 12px; font-size: 16px;">⚠️ Red Flags</h2>
              ${score.redFlags.map(f => `<div style="color: #fca5a5; font-size: 14px; padding: 4px 0; padding-left: 16px; position: relative;">• ${f}</div>`).join('')}
            </div>` : ''}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
              <div style="background: #0a1a0f; border: 1px solid #14532d; border-radius: 12px; padding: 20px;">
                <h3 style="color: #22c55e; margin: 0 0 12px; font-size: 14px;">✅ Why Hire</h3>
                ${(score.whyHire || []).map(p => `<div style="color: #86efac; font-size: 13px; padding: 3px 0;">• ${p}</div>`).join('')}
              </div>
              <div style="background: #1a0a0a; border: 1px solid #7f1d1d; border-radius: 12px; padding: 20px;">
                <h3 style="color: #ef4444; margin: 0 0 12px; font-size: 14px;">❌ Why Reject</h3>
                ${(score.whyReject || []).map(p => `<div style="color: #fca5a5; font-size: 13px; padding: 3px 0;">• ${p}</div>`).join('')}
              </div>
            </div>

            <div style="text-align: center;">
              <a href="${appUrl}" style="display: inline-block; padding: 14px 32px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">View Full Dashboard & Transcript</a>
            </div>
          </div>

          <div style="padding: 20px; text-align: center; border-top: 1px solid #1e1e2e;">
            <p style="color: #4b5563; font-size: 12px; margin: 0;">Anandi Productions AI Hiring System</p>
          </div>
        </div>
      `;
    } else if (type === 'interview_rejection') {
      html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #1e1e2e 0%, #16161f 100%); padding: 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px; font-weight: 700;">Anandi Productions</h1>
            <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Application Update</p>
          </div>
          <div style="padding: 40px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">Dear ${candidateName},</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">Thank you for taking the time to interview for the <strong>${position}</strong> position at Anandi Productions. We genuinely appreciate your interest in joining our team.</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 16px;">After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current requirements. This was a difficult decision given the level of interest we received.</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 24px;">We encourage you to continue developing your skills and to keep an eye on our future openings. We wish you the very best in your career journey.</p>
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0;">Warm regards,<br/><strong>Team Anandi Productions</strong></p>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Anandi Productions • Creative Production House</p>
          </div>
        </div>
      `;
    }

    if (!process.env.RESEND_API_KEY) {
      console.log(`Email skipped (no key): ${subject}`);
      return;
    }

    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Anandi Productions <onboarding@resend.dev>';

    await resend.emails.send({ from: fromEmail, to: [to], subject, html });
  } catch (err) {
    console.error('Email send error:', err);
  }
}
