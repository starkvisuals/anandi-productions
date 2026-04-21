// lib/workflow/rules.js
//
// Pure side-effect descriptors per block type and hook name. The runner (A4)
// interprets the returned object and performs the actual Firestore writes,
// email sends, and advances. Keep every function referentially transparent:
// same input → same output. No I/O here.
//
// Value-namespace reminder: ACTIVITY_TYPES values (e.g. 'block.started') are
// activity-log event names. EMAIL_TEMPLATES values (e.g. 'selection.requested')
// are template IDs resolved by the mailer. Do not swap one for the other.

import { BLOCK_TYPES, EMAIL_TEMPLATES, ACTIVITY_TYPES, WORKFLOW_ROLES } from './constants';

export const BLOCK_RULES = {
  [BLOCK_TYPES.UploadBlock]: {
    onEnter: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_STARTED, payload: { blockId: block.id, label: block.label } },
      emails: [{ role: block.assignedRole, template: EMAIL_TEMPLATES.BLOCK_UPLOAD_REQUESTED, data: { projectName: project.name, blockLabel: block.label } }],
    }),
    onExit: ({ block }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_COMPLETED, payload: { blockId: block.id } },
      advance: true,
    }),
  },

  [BLOCK_TYPES.SelectionRound]: {
    onEnter: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.SELECTION_REQUESTED, payload: { blockId: block.id } },
      emails: [{ role: WORKFLOW_ROLES.CLIENT, template: EMAIL_TEMPLATES.SELECTION_REQUESTED, data: { projectName: project.name, shareUrl: `/share/${project.shareToken}` } }],
      setSLAReminders: [
        { atHoursFromStart: block.slaHours * 0.75, template: EMAIL_TEMPLATES.SELECTION_REMINDER },
        { atHoursFromStart: block.slaHours, template: EMAIL_TEMPLATES.SELECTION_OVERDUE, escalate: true },
      ],
    }),
    onClientSubmit: ({ block, project, snapshotId, pickCount }) => ({
      activity: { type: ACTIVITY_TYPES.SELECTION_SUBMITTED, payload: { blockId: block.id, snapshotId, pickCount } },
      emails: [{ role: WORKFLOW_ROLES.PRODUCER, template: EMAIL_TEMPLATES.SELECTION_SUBMITTED, data: { projectName: project.name, pickCount } }],
      advance: true,
    }),
  },

  [BLOCK_TYPES.ApprovalRound]: {
    onEnter: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.APPROVAL_REQUESTED, payload: { blockId: block.id } },
      emails: [{ role: block.assignedRole || WORKFLOW_ROLES.CLIENT, template: EMAIL_TEMPLATES.APPROVAL_REQUESTED, data: { projectName: project.name } }],
      setSLAReminders: [
        { atHoursFromStart: block.slaHours * 0.75, template: EMAIL_TEMPLATES.SELECTION_REMINDER },
        { atHoursFromStart: block.slaHours, template: EMAIL_TEMPLATES.SELECTION_OVERDUE, escalate: true },
      ],
    }),
    onApprove: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.APPROVAL_GRANTED, payload: { blockId: block.id } },
      emails: [
        { role: WORKFLOW_ROLES.PRODUCER, template: EMAIL_TEMPLATES.APPROVAL_GRANTED, data: { projectName: project.name } },
        { role: WORKFLOW_ROLES.EDITOR, template: EMAIL_TEMPLATES.APPROVAL_GRANTED, data: { projectName: project.name } },
      ],
      advance: true,
    }),
    onRequestCorrections: ({ block, project, correctionCount, roundNumber, roundLimit }) => {
      const roundExceeded = roundNumber > roundLimit;
      return {
        activity: { type: ACTIVITY_TYPES.APPROVAL_CORRECTIONS, payload: { blockId: block.id, correctionCount, roundNumber } },
        emails: roundExceeded
          ? [{ role: WORKFLOW_ROLES.PRODUCER, template: EMAIL_TEMPLATES.APPROVAL_ROUND_LIMIT, data: { projectName: project.name, roundNumber, roundLimit } }]
          : [{ role: WORKFLOW_ROLES.EDITOR, template: EMAIL_TEMPLATES.APPROVAL_CORRECTIONS, data: { projectName: project.name, correctionCount } }],
        stateMutations: { incrementRevisionRound: block.id, pauseIfExceeded: roundExceeded },
      };
    },
  },

  [BLOCK_TYPES.ProductionBlock]: {
    onEnter: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_STARTED, payload: { blockId: block.id } },
      emails: [{ role: block.assignedRole, template: EMAIL_TEMPLATES.BLOCK_UPLOAD_REQUESTED, data: { projectName: project.name, blockLabel: block.label } }],
    }),
    onMarkComplete: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.PRODUCTION_COMPLETED, payload: { blockId: block.id } },
      emails: [{ role: WORKFLOW_ROLES.PRODUCER, template: EMAIL_TEMPLATES.PRODUCTION_COMPLETED, data: { projectName: project.name, blockLabel: block.label } }],
      advance: true,
    }),
  },

  [BLOCK_TYPES.AdaptBlock]: {
    onEnter: ({ block }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_STARTED, payload: { blockId: block.id } },
    }),
    onAllAdaptsDone: ({ block }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_COMPLETED, payload: { blockId: block.id } },
      advance: true,
    }),
  },

  [BLOCK_TYPES.DeliveryBlock]: {
    onEnter: ({ block, project }) => ({
      activity: { type: ACTIVITY_TYPES.DELIVERY_READY, payload: { blockId: block.id } },
      emails: [{ role: WORKFLOW_ROLES.CLIENT, template: EMAIL_TEMPLATES.DELIVERY_READY, data: { projectName: project.name, shareUrl: `/share/${project.shareToken}` } }],
      stateMutations: { unlockHiRes: true },
    }),
  },

  [BLOCK_TYPES.Checkpoint]: {
    onEnter: ({ block }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_STARTED, payload: { blockId: block.id } },
    }),
    onProducerAdvance: ({ block }) => ({
      activity: { type: ACTIVITY_TYPES.BLOCK_COMPLETED, payload: { blockId: block.id } },
      advance: true,
    }),
  },

  [BLOCK_TYPES.Parallel]: {
    onEnter: () => ({}),
    onChildComplete: ({ allDone }) => (allDone ? { advance: true } : {}),
  },
};

export function getRule(blockType, hookName) {
  return BLOCK_RULES[blockType]?.[hookName] ?? null;
}
