// lib/workflow/runner.js
import { postActivity, advanceProject, updateBlock } from './helpers';
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

  // Emails via /api/send-email
  if (sideEffects.emails?.length) {
    for (const em of sideEffects.emails) {
      await sendWorkflowEmail(project, em);
    }
  }

  // SLA reminders — stored on the block for Phase 1 client-side check
  if (sideEffects.setSLAReminders?.length) {
    await updateBlock(db, project.id, block.id, {
      slaReminders: sideEffects.setSLAReminders,
    });
  }

  // State mutations — handled by specific callers (F6 revision increment, G3 hi-res unlock)
  // Runner intentionally does not apply them generically.

  // Advance + recursively fire next block's onEnter
  if (sideEffects.advance) {
    const nextBlockId = await advanceProject(db, project.id, block.id, actorId);
    if (nextBlockId) {
      const nextBlock = await getBlockFresh(db, project.id, nextBlockId);
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

  return fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: emailSpec.template,
      to: targets,
      data: emailSpec.data,
    }),
  });
}

function resolveEmailTargets(project, role) {
  return (project.teamMembers || [])
    .filter((m) => m.role === role && m.removedAt == null)
    .map((m) => m.email)
    .filter(Boolean);
}

async function getBlockFresh(db, projectId, blockId) {
  const { getBlock } = await import('./helpers');
  return getBlock(db, projectId, blockId);
}
