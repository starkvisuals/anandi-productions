import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Vercel Cron: runs daily at 9 AM IST (3:30 AM UTC)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Verify cron secret (set CRON_SECRET in Vercel env vars)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all projects and users
    const [projectsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, 'projects')),
      getDocs(collection(db, 'users'))
    ]);

    const projects = projectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Build per-user digest data
    const digests = [];

    for (const user of users) {
      if (!user.email) continue;

      // Check email preferences
      const prefs = user.emailPreferences || {};
      if (prefs.dailyDigest === false) continue;

      // Find projects this user is involved in
      const userProjects = projects.filter(p => {
        const isTeam = (p.assignedTeam || []).some(tm => tm.odId === user.id);
        const isCreator = p.createdBy === user.id;
        const hasAssets = (p.assets || []).some(a => a.assignedTo === user.id || a.assignedTo === user.email);
        const isProducer = ['producer', 'admin', 'team-lead'].includes(user.role);
        return isTeam || isCreator || hasAssets || isProducer;
      });

      if (userProjects.length === 0) continue;

      // Gather digest items
      const allAssets = userProjects.flatMap(p => (p.assets || []).filter(a => !a.deleted));
      const overdueAssets = allAssets.filter(a => {
        if (!a.dueDate || a.status === 'delivered' || a.status === 'approved') return false;
        return new Date(a.dueDate) < today;
      });
      const dueTomorrow = allAssets.filter(a => {
        if (!a.dueDate || a.status === 'delivered' || a.status === 'approved') return false;
        const due = new Date(a.dueDate);
        return due >= today && due < tomorrow;
      });
      const dueThisWeek = allAssets.filter(a => {
        if (!a.dueDate || a.status === 'delivered' || a.status === 'approved') return false;
        const due = new Date(a.dueDate);
        return due >= tomorrow && due < weekEnd;
      });

      // Recent comments (last 24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentComments = allAssets.flatMap(a =>
        (a.feedback || []).filter(f => new Date(f.timestamp) > oneDayAgo)
      );

      // Recent status changes (from activity log)
      const recentActivity = userProjects.flatMap(p =>
        (p.activityLog || []).filter(a => new Date(a.timestamp) > oneDayAgo)
      );

      // Only send if there's something to report
      if (overdueAssets.length === 0 && dueTomorrow.length === 0 &&
          recentComments.length === 0 && recentActivity.length === 0) {
        continue;
      }

      digests.push({
        user,
        overdue: overdueAssets.length,
        dueTomorrow: dueTomorrow.length,
        dueThisWeek: dueThisWeek.length,
        newComments: recentComments.length,
        recentChanges: recentActivity.length,
        activeProjects: userProjects.filter(p => p.status === 'active').length
      });
    }

    // Send digest emails via existing email API
    const results = [];
    for (const digest of digests) {
      try {
        const emailBody = buildDigestEmail(digest);
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://anandi-productions.vercel.app'}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: digest.user.email,
            subject: `Daily Digest: ${digest.overdue > 0 ? `${digest.overdue} overdue` : 'Your update'}`,
            html: emailBody
          })
        });
        results.push({ email: digest.user.email, success: response.ok });
      } catch (err) {
        results.push({ email: digest.user.email, success: false, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      digestsSent: results.filter(r => r.success).length,
      total: digests.length,
      results
    });
  } catch (error) {
    console.error('Daily digest error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildDigestEmail(digest) {
  const { user, overdue, dueTomorrow, dueThisWeek, newComments, recentChanges, activeProjects } = digest;

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #0a0a14; color: #fff; border-radius: 12px; overflow: hidden;">
      <div style="padding: 24px 24px 16px; background: linear-gradient(135deg, #1a1a2e, #16162a);">
        <h1 style="margin: 0 0 4px; font-size: 18px; font-weight: 700;">Daily Digest</h1>
        <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.5);">Hi ${user.firstName || user.name}, here is your update for today.</p>
      </div>

      <div style="padding: 20px 24px;">
        ${overdue > 0 ? `
          <div style="padding: 12px 16px; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; margin-bottom: 12px;">
            <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${overdue}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.7);">Overdue items need attention</div>
          </div>
        ` : ''}

        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="flex: 1; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700;">${dueTomorrow}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5);">Due tomorrow</div>
          </div>
          <div style="flex: 1; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700;">${dueThisWeek}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5);">Due this week</div>
          </div>
          <div style="flex: 1; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 8px; text-align: center;">
            <div style="font-size: 20px; font-weight: 700;">${newComments}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5);">New comments</div>
          </div>
        </div>

        <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 16px;">
          ${activeProjects} active projects • ${recentChanges} changes today
        </div>

        <a href="https://anandi-productions.vercel.app" style="display: block; text-align: center; padding: 12px; background: #6366f1; color: #fff; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Open Dashboard</a>
      </div>

      <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 10px; color: rgba(255,255,255,0.3); text-align: center;">
        Anandi Productions
      </div>
    </div>
  `;
}
