// lib/workflow/checkSLAReminders.js
// Client-side SLA check: called periodically (or on app load) to fire overdue reminders.
// Returns an array of reminder objects that need to be acted on.

import { getProjectBlocks, updateBlock } from './helpers';
import { BLOCK_STATUS } from './constants';

/**
 * Check all active blocks in a project for SLA reminders that have become due.
 * Returns { fired: [{ blockId, template, escalate }], errors: [] }.
 * Marks each fired reminder as sent by adding a `firedAt` timestamp to it.
 */
export async function checkProjectSLAReminders(db, project) {
  const blocks = await getProjectBlocks(db, project.id);
  const activeBlocks = blocks.filter(b =>
    b.status === BLOCK_STATUS.IN_PROGRESS || b.status === BLOCK_STATUS.PENDING
  );

  const fired = [];
  const errors = [];

  for (const block of activeBlocks) {
    const reminders = block.slaReminders || [];
    if (!reminders.length || !block.startedAt) continue;

    const startedMs = block.startedAt?.toDate
      ? block.startedAt.toDate().getTime()
      : new Date(block.startedAt).getTime();

    const updatedReminders = [...reminders];
    let changed = false;

    for (let i = 0; i < updatedReminders.length; i++) {
      const r = updatedReminders[i];
      if (r.firedAt) continue; // already sent

      const dueMs = startedMs + r.atHoursFromStart * 3600 * 1000;
      if (Date.now() >= dueMs) {
        fired.push({ blockId: block.id, template: r.template, escalate: r.escalate || false, projectId: project.id });
        updatedReminders[i] = { ...r, firedAt: new Date().toISOString() };
        changed = true;
      }
    }

    if (changed) {
      try {
        await updateBlock(db, project.id, block.id, { slaReminders: updatedReminders });
      } catch (e) {
        errors.push({ blockId: block.id, error: e.message });
      }
    }
  }

  return { fired, errors };
}
