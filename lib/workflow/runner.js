// lib/workflow/runner.js
//
// Rules runner — applies side-effect descriptors returned by rules.js hooks.
//
// Invariants / footguns for future slice authors:
//   - Email failures are ISOLATED (allSettled + console.error). A dead Resend
//     must never block SLA writes or block advancement.
//   - `fetch('/api/send-email')` uses a RELATIVE url — browser-only. If runner
//     is ever called from a server action / route handler, pass an absolute
//     base URL or move the send to a server-side helper.
//   - `setSLAReminders` OVERWRITES any prior slaReminders array on the block.
//     Callers that need to merge must read-modify-write themselves.
//   - State mutations returned in the descriptor are NOT applied here —
//     specific callers (F6 revision increment, G3 hi-res unlock) own them.
//   - On advance, the recursed onEnter receives the ORIGINAL `project` object,
//     not a re-fetch. Today's rules only read project.name / project.shareToken
//     so this is safe; any future rule touching project.currentBlockId must
//     re-fetch project or this runner must be updated.
import { collection, getDocs } from 'firebase/firestore';
import { postActivity, advanceProject, updateBlock, getBlock } from './helpers';
import { getRule } from './rules';
import { createNotification } from '@/lib/notifications';

export async function runHook({ db, project, block, hookName, extra = {}, actorId }) {
  const rule = getRule(block.type, hookName);
  if (!rule) return null;

  const sideEffects = rule({ block, project, ...extra });

  // Activity
  if (sideEffects.activity) {
    await postActivity(db, project.id, {
      ...sideEffects.activity,
      actorId,
    });
  }

  // Notifications (email + in-app) — failures isolated so one bad send never
  // blocks SLA writes or block advancement. Recipients are resolved from the
  // project's REAL team (assignedTeam → users) and client contacts, not the
  // legacy (empty) project.teamMembers — that's why workflow emails used to
  // reach nobody. Clients/vendors get email only (no in-app bell); internal
  // users get both.
  if (sideEffects.emails?.length) {
    let usersById = {};
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.docs.forEach((d) => { usersById[d.id] = { id: d.id, ...d.data() }; });
    } catch (e) {
      console.error('[workflow runner] user load failed (notifications degraded):', e);
    }

    const results = await Promise.allSettled(
      sideEffects.emails.map((em) => deliverStageNotice({ db, project, block, em, usersById }))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[workflow runner] notice ${i} (${sideEffects.emails[i]?.template}) failed:`,
          r.reason
        );
      }
    });
  }

  // SLA reminders — stored on the block for Phase 1 client-side check.
  // Overwrites any prior reminders on this block.
  if (sideEffects.setSLAReminders?.length) {
    await updateBlock(db, project.id, block.id, {
      slaReminders: sideEffects.setSLAReminders,
    });
  }

  // State mutations — handled by specific callers (F6 revision increment, G3 hi-res unlock).
  // Runner intentionally does not apply them generically; callers inspect the returned
  // sideEffects object to pick them up.

  // Advance + recursively fire next block's onEnter
  if (sideEffects.advance) {
    const nextBlockId = await advanceProject(db, project.id, block.id, actorId);
    if (nextBlockId) {
      const nextBlock = await getBlock(db, project.id, nextBlockId);
      if (nextBlock) {
        await runHook({
          db,
          project,
          block: nextBlock,
          hookName: 'onEnter',
          actorId,
        });
      }
    }
  }

  return sideEffects;
}

// Map a workflow role → the app's stored role values (assignedTeam.odRole /
// CORE_ROLES / TEAM_ROLES) that should receive its notices. Keeps the pure
// workflow vocabulary decoupled from the app's finer-grained job titles.
const ROLE_ALIASES = {
  producer: ['producer', 'admin', 'team-lead', 'coordinator'],
  editor: ['editor', 'video-editor', 'photo-editor', 'motion-designer', 'cgi-artist'],
  colorist: ['colorist'],
  vfx: ['vfx', 'vfx-artist'],
  audio: ['audio', 'sound-designer'],
  music: ['music', 'sound-designer'],
  agency: ['agency'],
  photographer: ['photographer'],
  client: ['client'],
};

// Email-template → in-app notification presentation. Anything not listed gets a
// safe generic fallback so a new template never crashes the notifier.
const NOTIF_META = {
  'block.upload.requested': { type: 'your-turn', title: 'Your turn: upload files' },
  'selection.requested': { type: 'your-turn', title: 'Selection requested' },
  'selection.submitted': { type: 'info', title: 'Client submitted their selection' },
  'approval.requested': { type: 'your-turn', title: 'Approval needed' },
  'approval.granted': { type: 'approval', title: 'Approved' },
  'approval.corrections.requested': { type: 'your-turn', title: 'Corrections requested' },
  'approval.round-limit-hit': { type: 'info', title: 'Revision limit reached' },
  'production.completed': { type: 'info', title: 'Production completed' },
  'delivery.ready': { type: 'delivered', title: 'Delivery ready' },
};

const dedupe = (list) => {
  const seen = new Set();
  return list.filter((r) => {
    const key = r.userId || r.email;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Who should receive a notice for `role` on this project. Priority: an explicit
// per-stage assignee (assignedUserId) always counts; the CLIENT role resolves to
// project.clientContacts (email only, no in-app); every other role resolves via
// assignedTeam→users using ROLE_ALIASES. Fail-safe: if a non-client role matches
// nobody, fall back to the producers so a stage is NEVER silently un-notified.
function resolveRecipients(project, role, block, usersById) {
  const out = [];
  if (block?.assignedUserId && usersById[block.assignedUserId]) {
    const u = usersById[block.assignedUserId];
    out.push({ userId: u.id, email: u.email, name: u.name });
  }

  if (role === 'client') {
    (project.clientContacts || []).forEach((c) => {
      if (c.email) out.push({ email: c.email, name: c.name, isClient: true });
    });
    return dedupe(out);
  }

  const aliases = ROLE_ALIASES[role] || [role];
  (project.assignedTeam || []).forEach((t) => {
    if (aliases.includes(t.odRole)) {
      const u = usersById[t.odId];
      if (u) out.push({ userId: u.id, email: u.email, name: u.name });
    }
  });

  if (out.length === 0) {
    (project.assignedTeam || []).forEach((t) => {
      if (['producer', 'admin', 'team-lead'].includes(t.odRole)) {
        const u = usersById[t.odId];
        if (u) out.push({ userId: u.id, email: u.email, name: u.name });
      }
    });
  }
  return dedupe(out);
}

// Deliver one stage notice: email everyone with an address, and drop an in-app
// notification for internal users (clients/vendors have no bell). Both failure
// modes are swallowed by the caller's allSettled so advancement never blocks.
async function deliverStageNotice({ db, project, block, em, usersById }) {
  const recips = resolveRecipients(project, em.role, block, usersById);
  const emails = recips.map((r) => r.email).filter(Boolean);

  if (emails.length) {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: em.template, to: emails, data: em.data }),
    });
    if (!res.ok) throw new Error(`send-email ${em.template} -> ${res.status}`);
  }

  const meta = NOTIF_META[em.template] || { type: 'info', title: 'Workflow update' };
  const bodyLabel = em.data?.blockLabel || block?.label || '';
  await Promise.allSettled(
    recips
      .filter((r) => r.userId && !r.isClient)
      .map((r) =>
        createNotification({
          userId: r.userId,
          type: meta.type,
          title: meta.title,
          body: bodyLabel ? `${project.name} — ${bodyLabel}` : project.name,
          projectId: project.id,
          blockId: block?.id || null,
          href: `/?project=${project.id}`,
        })
      )
  );
}
