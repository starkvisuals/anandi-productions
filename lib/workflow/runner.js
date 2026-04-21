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
import { postActivity, advanceProject, updateBlock, getBlock } from './helpers';
import { getRule } from './rules';

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

  // Emails via /api/send-email — failures isolated so one bad send never
  // blocks SLA writes or block advancement.
  if (sideEffects.emails?.length) {
    const results = await Promise.allSettled(
      sideEffects.emails.map((em) => sendWorkflowEmail(project, em))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(
          `[workflow runner] email ${i} (${sideEffects.emails[i]?.template}) failed:`,
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

async function sendWorkflowEmail(project, emailSpec) {
  const targets = resolveEmailTargets(project, emailSpec.role);
  if (targets.length === 0) return null;

  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: emailSpec.template,
      to: targets,
      data: emailSpec.data,
    }),
  });
  if (!res.ok) {
    throw new Error(`send-email ${emailSpec.template} -> ${res.status}`);
  }
  return res;
}

function resolveEmailTargets(project, role) {
  return (project.teamMembers || [])
    .filter((m) => m.role === role && m.removedAt == null)
    .map((m) => m.email)
    .filter(Boolean);
}
