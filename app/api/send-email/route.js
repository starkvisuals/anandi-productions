import { NextResponse } from 'next/server';

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
    
    const { to, subject, body, type, data } = await request.json();

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
        employee_onboarding_complete_admin: { gradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)', icon: '✅', title: 'Employee Onboarding Complete', buttonColor: '#22c55e', buttonText: 'View Employee' },
        employee_document_uploaded: { gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', icon: '📄', title: 'Document Uploaded', buttonColor: '#06b6d4', buttonText: 'View Document' },
        hr_approval_requested: { gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', icon: '⚠️', title: 'HR Approval Requested', buttonColor: '#f59e0b', buttonText: 'Review Request' },
        hr_approval_resolved: { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', icon: '📬', title: 'HR Approval Resolved', buttonColor: '#8b5cf6', buttonText: 'View Details' },
        model_release_submitted: { gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)', icon: '📋', title: 'Model Release Submitted', buttonColor: '#22c55e', buttonText: 'View in Releases' },
        default: { gradient: '#6366f1', icon: '📬', title: subject, buttonColor: '#6366f1', buttonText: 'View in Anandi Hub' }
      };

      const t = templates[type] || templates.default;

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
              <a href="${appUrl}" style="display: inline-block; margin-top: 20px; padding: 14px 28px; background: ${t.buttonColor}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">${t.buttonText}</a>
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
