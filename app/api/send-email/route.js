import { NextResponse } from 'next/server';

// Workflow email template type strings (from lib/workflow/constants.EMAIL_TEMPLATES).
// Membership is used to decide whether to auto-derive subject+body server-side.
const WORKFLOW_TYPES = new Set([
  'selection.requested',
  'selection.reminder',
  'selection.overdue',
  'selection.submitted',
  'approval.requested',
  'approval.granted',
  'approval.corrections.requested',
  'approval.round-limit-hit',
  'approval.reminder',
  'approval.overdue',
  'production.completed',
  'delivery.ready',
  'asset-request.created',
  'asset-request.approved',
  'asset-request.fulfilled',
  'photographer.upload-invite',
  'mention',
  'block.upload.requested',
]);

// Derive a short, mobile-friendly {subject, body} pair from a workflow
// template type + data payload. Degrades gracefully on missing fields.
function absolutizeUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

function getWorkflowCopy(type, data) {
  const d = data || {};
  const project = d.projectName || 'your project';
  const block = d.blockLabel || 'a block';
  const asset = d.assetName || 'an asset';
  const share = absolutizeUrl(d.shareUrl);
  const due = d.dueAt || d.dueDate || '';
  const corrections = d.correctionsCount ?? d.correctionCount;
  const round = d.roundNumber;
  const limit = d.revisionLimit ?? d.roundLimit;
  const picks = d.pickCount;

  switch (type) {
    case 'selection.requested':
      return {
        subject: `Selections needed for ${project}`,
        body: `Please review and make your selections for ${project}.${share ? ` Open: ${share}` : ''}`,
      };
    case 'selection.reminder':
      return {
        subject: `Reminder: selections pending on ${project}`,
        body: `Your selections for ${project} are still pending${due ? ` (due ${due})` : ''}. Please take a moment to review.`,
      };
    case 'selection.overdue':
      return {
        subject: `Overdue: selections on ${project}`,
        body: `Selections for ${project} are overdue${due ? ` (was due ${due})` : ''}. Please review as soon as possible.`,
      };
    case 'selection.submitted':
      return {
        subject: `Selections submitted on ${project}`,
        body: `Client has submitted selections${picks != null ? ` (${picks} picks)` : ''} for ${project}.`,
      };
    case 'approval.requested':
      return {
        subject: `Approval needed on ${project}`,
        body: `Please review and approve the latest work on ${project}.${share ? ` Open: ${share}` : ''}`,
      };
    case 'approval.granted':
      return {
        subject: `Approved: ${project}`,
        body: `Approval has been granted on ${project}. You can proceed to the next step.`,
      };
    case 'approval.corrections.requested':
      return {
        subject: `Corrections requested on ${project}`,
        body: `${corrections != null ? `${corrections} corrections were` : 'Corrections were'} requested on ${project}. Please address them and resubmit.`,
      };
    case 'approval.round-limit-hit':
      return {
        subject: `Revision limit reached on ${project}`,
        body: `Round ${round ?? '?'}${limit != null ? ` of ${limit}` : ''} reached on ${project}. Producer action required.`,
      };
    case 'approval.reminder':
      return {
        subject: `Reminder: approval pending on ${project}`,
        body: `Approval is still pending on ${project}${due ? ` (due ${due})` : ''}. Please review when you can.`,
      };
    case 'approval.overdue':
      return {
        subject: `Overdue: approval on ${project}`,
        body: `Approval for ${project} is overdue${due ? ` (was due ${due})` : ''}. Please review as soon as possible.`,
      };
    case 'production.completed':
      return {
        subject: `Production complete on ${project}`,
        body: `${block} has been marked complete on ${project}.`,
      };
    case 'delivery.ready':
      return {
        subject: `Delivery ready for ${project}`,
        body: `Your final files for ${project} are ready to download.${share ? ` Open: ${share}` : ''}`,
      };
    case 'asset-request.created':
      return {
        subject: `New asset request on ${project}`,
        body: `A new asset request was created on ${project}${d.assetName ? ` for "${d.assetName}"` : ''}. Please review.`,
      };
    case 'asset-request.approved':
      return {
        subject: `Asset request approved on ${project}`,
        body: `Your asset request${d.assetName ? ` for "${d.assetName}"` : ''} on ${project} has been approved.`,
      };
    case 'asset-request.fulfilled':
      return {
        subject: `Asset request fulfilled on ${project}`,
        body: `${d.assetName ? `"${d.assetName}"` : 'Your requested asset'} has been uploaded on ${project}.`,
      };
    case 'photographer.upload-invite':
      return {
        subject: `Upload invite for ${project}`,
        body: `You've been invited to upload photos for ${project}.${share ? ` Open: ${share}` : ''}`,
      };
    case 'mention':
      return {
        subject: `You were mentioned on ${project}`,
        body: `${d.mentionedBy ? `${d.mentionedBy} mentioned you` : 'You were mentioned'} on ${project}. Tap through to view the comment.`,
      };
    case 'block.upload.requested':
      return {
        subject: `Upload requested: ${block}`,
        body: `Please upload your work for ${block} on ${project}${due ? ` (due ${due})` : ''}.`,
      };
    default:
      return { subject: `Update on ${project}`, body: `There's a new update on ${project}.` };
  }
}

export async function POST(request) {
  try {
    // Check for API key first
    if (!process.env.RESEND_API_KEY) {
      console.log('Email skipped: No API key configured');
      return NextResponse.json({ success: true, skipped: true, reason: 'No API key configured' });
    }

    // Dynamic import Resend
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { to, subject: bodySubject, body: bodyText, type, data } = await request.json();

    const isWorkflow = type && WORKFLOW_TYPES.has(type);

    // Workflow callers (lib/workflow/runner.js) send {type, to, data} only — derive
    // subject+body server-side. Non-workflow callers keep existing contract.
    let subject = bodySubject;
    let body = bodyText;
    if (isWorkflow && !subject) {
      const derived = getWorkflowCopy(type, data || {});
      subject = derived.subject;
      body = body || derived.body;
    }

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Email templates based on type
    const getTemplate = (type, subject, body, data = {}) => {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app';

      const templates = {
        assignment: { gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', icon: '📋', title: 'New Assignment', buttonColor: '#6366f1', buttonText: 'View Assignment' },
        feedback: { gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 100%)', icon: '💬', title: 'New Feedback', buttonColor: '#f97316', buttonText: 'View Feedback' },
        mention: { gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', icon: '🔔', title: 'You were mentioned', buttonColor: '#3b82f6', buttonText: 'View Comment' },
        status: { gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)', icon: '🔄', title: 'Status Update', buttonColor: '#22c55e', buttonText: 'View Project' },
        deadline_reminder: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '⏰', title: 'Deadline Reminder', buttonColor: '#f59e0b', buttonText: 'View Task' },
        deadline_overdue: { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '🚨', title: 'Deadline Overdue', buttonColor: '#ef4444', buttonText: 'View Task' },
        version: { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', icon: '📦', title: 'New Version Uploaded', buttonColor: '#8b5cf6', buttonText: 'View Version' },
        review_ready: { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '👀', title: 'Ready for Review', buttonColor: '#06b6d4', buttonText: 'Review Now' },
        project_complete: { gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: '🎉', title: 'Project Completed', buttonColor: '#22c55e', buttonText: 'View Project' },
        employee_onboarding_invite: { gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', icon: '🎬', title: 'Welcome to Anandi Productions', buttonColor: '#6366f1', buttonText: 'Start Onboarding' },
        payslip: { gradient: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)', icon: '🧾', title: 'Your Payslip', buttonColor: '#16a34a', buttonText: 'View in Portal' },
        employee_onboarding_complete_admin: { gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: '✅', title: 'Employee Onboarding Complete', buttonColor: '#22c55e', buttonText: 'View Employee' },
        employee_document_uploaded: { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '📄', title: 'Document Uploaded', buttonColor: '#06b6d4', buttonText: 'View Document' },
        hr_approval_requested: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '⚠️', title: 'HR Approval Requested', buttonColor: '#f59e0b', buttonText: 'Review Request' },
        hr_approval_resolved: { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', icon: '📬', title: 'HR Approval Resolved', buttonColor: '#8b5cf6', buttonText: 'View Details' },
        model_release_submitted: { gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)', icon: '📋', title: 'Model Release Submitted', buttonColor: '#22c55e', buttonText: 'View in Releases' },

        // Workflow template visual styles (A6).
        'selection.requested': { gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', icon: '🎨', title: 'Selections Needed', buttonColor: '#3b82f6', buttonText: 'Make Selections' },
        'selection.reminder': { gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', icon: '🎨', title: 'Selections Reminder', buttonColor: '#3b82f6', buttonText: 'Make Selections' },
        'selection.overdue': { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '🎨', title: 'Selections Overdue', buttonColor: '#ef4444', buttonText: 'Make Selections' },
        'selection.submitted': { gradient: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', icon: '🎨', title: 'Selections Submitted', buttonColor: '#3b82f6', buttonText: 'View Selections' },
        'approval.requested': { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '✅', title: 'Approval Needed', buttonColor: '#f59e0b', buttonText: 'Review & Approve' },
        'approval.granted': { gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: '✅', title: 'Approval Granted', buttonColor: '#22c55e', buttonText: 'View Project' },
        'approval.corrections.requested': { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '✅', title: 'Corrections Requested', buttonColor: '#f59e0b', buttonText: 'View Corrections' },
        'approval.round-limit-hit': { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '✅', title: 'Revision Limit Reached', buttonColor: '#ef4444', buttonText: 'Review Rounds' },
        'approval.reminder': { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '✅', title: 'Approval Reminder', buttonColor: '#f59e0b', buttonText: 'Review & Approve' },
        'approval.overdue': { gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '✅', title: 'Approval Overdue', buttonColor: '#ef4444', buttonText: 'Review & Approve' },
        'production.completed': { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)', icon: '🎬', title: 'Production Complete', buttonColor: '#8b5cf6', buttonText: 'View Project' },
        'delivery.ready': { gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: '🚚', title: 'Delivery Ready', buttonColor: '#22c55e', buttonText: 'Download Files' },
        'asset-request.created': { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '📎', title: 'Asset Request Created', buttonColor: '#06b6d4', buttonText: 'View Request' },
        'asset-request.approved': { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '📎', title: 'Asset Request Approved', buttonColor: '#06b6d4', buttonText: 'View Request' },
        'asset-request.fulfilled': { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '📎', title: 'Asset Request Fulfilled', buttonColor: '#06b6d4', buttonText: 'View Asset' },
        'photographer.upload-invite': { gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', icon: '📸', title: 'Upload Invite', buttonColor: '#6366f1', buttonText: 'Start Upload' },
        'block.upload.requested': { gradient: 'linear-gradient(135deg, #64748b 0%, #475569 100%)', icon: '📤', title: 'Upload Requested', buttonColor: '#64748b', buttonText: 'Upload Now' },

        default: { gradient: '#6366f1', icon: '📬', title: subject, buttonColor: '#6366f1', buttonText: 'View in Anandi Hub' }
      };

      const t = templates[type] || templates.default;
      // Prefer a workflow shareUrl (absolutized) for the CTA when present.
      const ctaHref = (data && data.shareUrl)
        ? (/^https?:\/\//i.test(data.shareUrl)
            ? data.shareUrl
            : `${appUrl.replace(/\/$/, '')}${data.shareUrl.startsWith('/') ? '' : '/'}${data.shareUrl}`)
        : appUrl;

      return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${t.gradient}; padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">${t.icon}</div>
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">${t.title}</h1>
          </div>
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0;">${body || subject || ''}</p>
            ${data.assetName ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Asset:</strong> ${data.assetName}</p>` : ''}
            ${data.projectName ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Project:</strong> ${data.projectName}</p>` : ''}
            ${data.dueDate ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Due:</strong> ${data.dueDate}</p>` : ''}
            ${data.assignedBy ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 20px 0;"><strong>Assigned by:</strong> ${data.assignedBy}</p>` : ''}
            ${data.name && (type || '').match(/^(employee_|hr_)/) ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Name:</strong> ${data.name}</p>` : ''}
            ${data.designation ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Designation:</strong> ${data.designation}</p>` : ''}
            ${data.dateOfJoining ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Date of joining:</strong> ${data.dateOfJoining}</p>` : ''}
            ${data.invitedBy ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Invited by:</strong> ${data.invitedBy}</p>` : ''}
            ${data.action ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Action:</strong> ${data.action}</p>` : ''}
            ${data.requestedBy ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Requested by:</strong> ${data.requestedBy}</p>` : ''}
            ${data.status ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Status:</strong> ${data.status}</p>` : ''}
            ${data.reason ? `<p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;"><strong>Reason:</strong> ${data.reason}</p>` : ''}
            <div style="text-align: center;">
              <a href="${ctaHref}" style="display: inline-block; margin-top: 20px; padding: 14px 28px; background: ${t.buttonColor}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${t.buttonText}</a>
            </div>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">Anandi Productions • Production Hub</p>
          </div>
        </div>
      `;
    };

    const html = getTemplate(type, subject, body, data || {});
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Anandi Productions <onboarding@resend.dev>';

    const result = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject: subject,
      html: html,
    });

    console.log('Email sent:', result);
    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Email error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 200 });
  }
}
