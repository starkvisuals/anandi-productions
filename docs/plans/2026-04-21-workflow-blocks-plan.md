# Workflow Blocks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Anandi Productions into a modular, stage-driven production workflow app. Phase 1 ships the Photoshoot workflow end-to-end on top of a generic block/template architecture that supports future workflows (AI generation, video retainer, post-only) as data, not code.

**Architecture:** Firestore-backed Lego primitives (UploadBlock, SelectionRound, ProductionBlock, ApprovalRound, AdaptBlock, DeliveryBlock, Checkpoint, Parallel). Templates compose blocks. Projects materialize templates. A rules table drives stage transitions + notifications. A cross-project inbox replaces coordinator work.

**Tech Stack:** Next.js 14, React 18, Firebase/Firestore/Storage, Resend (email), Framer Motion, JSZip. No new core deps; add `papaparse` for CSV export.

**Verification pattern (this codebase has no test framework):**

1. `npx esbuild components/MainApp.js --bundle --outfile=/dev/null --loader:.js=jsx` — syntax check
2. `preview_start` → `preview_screenshot` or manual click-through
3. Firestore console inspection where persistence matters
4. Commit after each green verification

**Design reference:** `docs/plans/2026-04-21-workflow-blocks-design.md`

---

## Phase 1 scope

11 slices, sequenced so each is independently useful:

| Slice | Theme | Tasks |
|---|---|---|
| A | Data layer + helpers + rules table + template seed | A1–A9 |
| B | Project creation from template + deliverables | B1–B5 |
| C | Stage timeline bar + project snapshot + activity feed | C1–C5 |
| D | Upload blocks + resumable uploads + smart naming + watermark + photographer link | D1–D8 |
| E | Selection Round UI (desktop + mobile) + snapshots + CSV export | E1–E9 |
| F | Production block + References pinning + Approval round + revision rounds | F1–F9 |
| G | Adapt block + Delivery block + hi-res gate | G1–G6 |
| H | Inbox + notifications engine + @mentions + SLA timers | H1–H7 |
| I | AssetRequest side-channel | I1–I5 |
| J | Team workload dashboard + calendar sync | J1–J5 |
| K | Polish pass (click-outside, button sizing, mobile, empty/loading/error states) | K1–K7 |

---

## Shared conventions

**Before any task:**
- Working directory: `/Users/harnesh/Claude_Files/anandi-productions`
- Read files before editing them (Edit tool requirement)
- `esbuild` sanity command lives at: `/opt/homebrew/bin/npx esbuild` or `/usr/local/bin/npx esbuild`

**Commit format:**
```
<slice-letter><task>: short imperative summary

1-2 sentence why.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

**Theme tokens** (from `components/MainApp.js` — use for all new UI):
- `t.bgCard`, `t.border`, `t.text`, `t.textMuted`, `t.accent`, `t.cardRadius`, `t.shadow`, `t.gradientPrimary`

**Modal pattern:** reuse `Modal` from `components/MainApp.js:423-460` with `size` and `theme` props.

**Dynamic imports:** new components go under `components/workflow/` and are lazy-loaded in MainApp via `dynamic()` following the existing `StableDashboard` pattern.

---

# SLICE A — Data layer + admin tooling

**Outcome:** Firestore helpers, rules table, constants, seed data, and the Template Editor UI skeleton. No end-user visible feature yet; foundation for everything else.

---

### Task A1: Create workflow constants

**Files:**
- Create: `lib/workflow/constants.js`

**Step 1: Write the module**

Create `lib/workflow/constants.js` with:

```js
// lib/workflow/constants.js

export const BLOCK_TYPES = {
  UploadBlock: 'UploadBlock',
  SelectionRound: 'SelectionRound',
  ProductionBlock: 'ProductionBlock',
  ApprovalRound: 'ApprovalRound',
  AdaptBlock: 'AdaptBlock',
  DeliveryBlock: 'DeliveryBlock',
  Checkpoint: 'Checkpoint',
  Parallel: 'Parallel',
};

export const BLOCK_STATUS = {
  LOCKED: 'locked',
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  SKIPPED: 'skipped',
};

export const WORKFLOW_ROLES = {
  PRODUCER: 'producer',
  CLIENT: 'client',
  EDITOR: 'editor',
  COLORIST: 'colorist',
  VFX: 'vfx',
  AUDIO: 'audio',
  MUSIC: 'music',
  AGENCY: 'agency',
  PHOTOGRAPHER: 'photographer',
};

export const UPLOAD_VARIANTS = {
  RAWS: 'raws',
  REFERENCES: 'references',
  OFFLINE_EDIT: 'offline-edit',
  HI_RES: 'hi-res',
};

export const PRODUCTION_SPECIALTIES = {
  EDIT: 'edit',
  GRADING: 'grading',
  VFX: 'vfx',
  AUDIO: 'audio',
  MUSIC: 'music',
  SUPERS: 'supers',
  AI_GEN: 'ai-gen',
  GENERIC: 'generic',
};

export const APPROVAL_MODES = {
  CORRECTION_OR_APPROVE: 'correction-or-approve',
  PICK_ONE_OF_MANY: 'pick-one-of-many',
};

export const ACTIVITY_TYPES = {
  BLOCK_STARTED: 'block.started',
  BLOCK_COMPLETED: 'block.completed',
  BLOCK_INSERTED: 'block.inserted',
  BLOCK_REMOVED: 'block.removed',
  SELECTION_REQUESTED: 'selection.requested',
  SELECTION_SUBMITTED: 'selection.submitted',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_CORRECTIONS: 'approval.corrections',
  PRODUCTION_COMPLETED: 'production.completed',
  ASSET_UPLOADED: 'asset.uploaded',
  ASSET_VERSION_UPLOADED: 'asset.version.uploaded',
  REFERENCE_PINNED: 'reference.pinned',
  ASSET_REQUEST_CREATED: 'asset-request.created',
  ASSET_REQUEST_APPROVED: 'asset-request.approved',
  ASSET_REQUEST_FULFILLED: 'asset-request.fulfilled',
  COMMENT_POSTED: 'comment.posted',
  MENTION: 'mention',
  TEAM_ADDED: 'team.added',
  TEAM_REMOVED: 'team.removed',
  DELIVERY_READY: 'delivery.ready',
  REVISION_ROUND_EXTRA_REQUESTED: 'revision.extra.requested',
  REVISION_ROUND_EXTRA_RESOLVED: 'revision.extra.resolved',
};

export const EMAIL_TEMPLATES = {
  SELECTION_REQUESTED: 'selection.requested',
  SELECTION_REMINDER: 'selection.reminder',
  SELECTION_OVERDUE: 'selection.overdue',
  SELECTION_SUBMITTED: 'selection.submitted',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_CORRECTIONS: 'approval.corrections.requested',
  APPROVAL_ROUND_LIMIT: 'approval.round-limit-hit',
  PRODUCTION_COMPLETED: 'production.completed',
  DELIVERY_READY: 'delivery.ready',
  ASSET_REQUEST_CREATED: 'asset-request.created',
  ASSET_REQUEST_APPROVED: 'asset-request.approved',
  ASSET_REQUEST_FULFILLED: 'asset-request.fulfilled',
  PHOTOGRAPHER_UPLOAD_INVITE: 'photographer.upload-invite',
  MENTION: 'mention',
  BLOCK_UPLOAD_REQUESTED: 'block.upload.requested',
};

// Default color label set (7 colors — Capture One style)
export const DEFAULT_COLOR_LABELS = [
  { key: 'red',    label: 'Pick',    hex: '#ef4444' },
  { key: 'yellow', label: 'Maybe',   hex: '#eab308' },
  { key: 'green',  label: 'Alt',     hex: '#22c55e' },
  { key: 'blue',   label: 'Hero',    hex: '#3b82f6' },
  { key: 'purple', label: 'Reject',  hex: '#a855f7' },
  { key: 'orange', label: 'Review',  hex: '#f97316' },
  { key: 'gray',   label: 'Skip',    hex: '#6b7280' },
];

export const DEFAULT_REVISION_LIMIT = 3;
export const DEFAULT_SLA_HOURS = {
  SELECTION: 72,
  APPROVAL: 48,
  PRODUCTION: 72,
  UPLOAD: 168,
  CHECKPOINT: 24,
};
```

**Step 2: Syntax check**

```bash
npx esbuild lib/workflow/constants.js --bundle --outfile=/dev/null --format=esm
```
Expected: no errors.

**Step 3: Commit**

```bash
git add lib/workflow/constants.js
git commit -m "A1: workflow constants (block types, statuses, roles, email templates, colors)"
```

---

### Task A2: Create workflow helpers (block + template CRUD)

**Files:**
- Create: `lib/workflow/helpers.js`

**Step 1: Write the helpers**

```js
// lib/workflow/helpers.js
import { db } from './firebase';  // adjust import path based on existing firestore.js pattern
import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, collectionGroup, Timestamp,
} from 'firebase/firestore';
import { BLOCK_STATUS, BLOCK_TYPES } from './constants';

// --- Templates ---

export async function getTemplates(db) {
  const snap = await getDocs(query(collection(db, 'workflowTemplates'), orderBy('name')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getTemplate(db, templateId) {
  const snap = await getDoc(doc(db, 'workflowTemplates', templateId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createTemplate(db, data, actorId) {
  return addDoc(collection(db, 'workflowTemplates'), {
    ...data,
    isSystemDefault: false,
    isActive: true,
    createdBy: actorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTemplate(db, templateId, data, actorId) {
  await updateDoc(doc(db, 'workflowTemplates', templateId), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: actorId,
  });
}

export async function deleteTemplate(db, templateId) {
  // Guard: cannot delete system defaults
  const tpl = await getTemplate(db, templateId);
  if (tpl?.isSystemDefault) throw new Error('Cannot delete system default template');
  await deleteDoc(doc(db, 'workflowTemplates', templateId));
}

// --- Blocks ---

export async function getProjectBlocks(db, projectId) {
  const snap = await getDocs(
    query(collection(db, 'projects', projectId, 'blocks'), orderBy('order'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getBlock(db, projectId, blockId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'blocks', blockId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateBlock(db, projectId, blockId, data) {
  await updateDoc(doc(db, 'projects', projectId, 'blocks', blockId), data);
}

export async function materializeBlocksFromTemplate(db, projectId, template, actorId) {
  const batch = writeBatch(db);
  const blocksRef = collection(db, 'projects', projectId, 'blocks');

  template.blocks.forEach((tBlock, idx) => {
    const blockRef = doc(blocksRef);
    batch.set(blockRef, {
      order: tBlock.order ?? idx + 1,
      type: tBlock.type,
      variant: tBlock.variant ?? null,
      label: tBlock.label,
      status: idx === 0 ? BLOCK_STATUS.PENDING : BLOCK_STATUS.LOCKED,
      assignedRole: tBlock.defaultRole,
      assignedUserId: null,
      dueDate: null,
      slaHours: tBlock.defaultSLAHours ?? null,
      startedAt: idx === 0 ? serverTimestamp() : null,
      completedAt: null,
      completedBy: null,
      config: tBlock.config ?? {},
      inputBlockIds: [],
      createdBy: actorId,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export async function getCurrentBlock(db, projectId) {
  const blocks = await getProjectBlocks(db, projectId);
  return blocks.find(b => b.status === BLOCK_STATUS.PENDING || b.status === BLOCK_STATUS.IN_PROGRESS) || null;
}

export async function advanceProject(db, projectId, completedBlockId, actorId) {
  const blocks = await getProjectBlocks(db, projectId);
  const completed = blocks.find(b => b.id === completedBlockId);
  if (!completed) return null;

  const batch = writeBatch(db);
  batch.update(doc(db, 'projects', projectId, 'blocks', completedBlockId), {
    status: BLOCK_STATUS.DONE,
    completedAt: serverTimestamp(),
    completedBy: actorId,
  });

  const next = blocks.find(b => b.order === completed.order + 1);
  if (next) {
    batch.update(doc(db, 'projects', projectId, 'blocks', next.id), {
      status: BLOCK_STATUS.PENDING,
      startedAt: serverTimestamp(),
      dueDate: next.slaHours
        ? Timestamp.fromMillis(Date.now() + next.slaHours * 3600 * 1000)
        : null,
    });
  }

  batch.update(doc(db, 'projects', projectId), {
    currentBlockId: next?.id ?? null,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return next?.id ?? null;
}

// --- Activity ---

export async function postActivity(db, projectId, event) {
  return addDoc(collection(db, 'projects', projectId, 'activity'), {
    ...event,
    timestamp: serverTimestamp(),
  });
}

// --- Inbox query (cross-project) ---

export async function getInboxForUser(db, userId, userRoles = []) {
  // Blocks assigned directly to user
  const byUserSnap = await getDocs(
    query(
      collectionGroup(db, 'blocks'),
      where('assignedUserId', '==', userId),
      where('status', 'in', [BLOCK_STATUS.PENDING, BLOCK_STATUS.IN_PROGRESS]),
    )
  );

  // Blocks assigned by role with no specific user (any team member can claim)
  const byRoleSnap = userRoles.length > 0
    ? await getDocs(
        query(
          collectionGroup(db, 'blocks'),
          where('assignedRole', 'in', userRoles),
          where('assignedUserId', '==', null),
          where('status', 'in', [BLOCK_STATUS.PENDING, BLOCK_STATUS.IN_PROGRESS]),
        )
      )
    : { docs: [] };

  const combined = new Map();
  [...byUserSnap.docs, ...byRoleSnap.docs].forEach(d => {
    combined.set(d.ref.path, { id: d.id, path: d.ref.path, projectId: d.ref.parent.parent.id, ...d.data() });
  });
  return Array.from(combined.values());
}
```

**Step 2: Syntax check**

```bash
npx esbuild lib/workflow/helpers.js --bundle --outfile=/dev/null --format=esm --external:firebase/firestore --external:./firebase
```
Expected: clean.

**Step 3: Commit**

```bash
git add lib/workflow/helpers.js
git commit -m "A2: workflow helpers — block + template CRUD, advance, inbox query"
```

---

### Task A3: Create the rules table (block transition hooks)

**Files:**
- Create: `lib/workflow/rules.js`

**Step 1: Write the rules**

Implement the `BLOCK_RULES` table per the design doc's "Notification & inbox engine" section. Each block type exports `onEnter`, `onExit`, and optional hooks as pure functions that return a side-effect descriptor (the actual side-effects are applied by a runner in a later task).

```js
// lib/workflow/rules.js
import { BLOCK_TYPES, EMAIL_TEMPLATES, ACTIVITY_TYPES, WORKFLOW_ROLES } from './constants';

// Each hook returns: { notifications, emails, activity, advance, setSLAReminders, stateMutations }
// All fields optional. Runner in lib/workflow/runner.js applies them.

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
```

**Step 2: Syntax check**
```bash
npx esbuild lib/workflow/rules.js --bundle --outfile=/dev/null --format=esm
```

**Step 3: Commit**
```bash
git add lib/workflow/rules.js
git commit -m "A3: block rules table (onEnter/onExit hooks with side-effect descriptors)"
```

---

### Task A4: Create the rules runner

**Files:**
- Create: `lib/workflow/runner.js`

**Step 1: Write the runner**

The runner takes a side-effect descriptor and applies it: posts activity, sends emails, advances blocks, sets SLA reminders.

```js
// lib/workflow/runner.js
import { postActivity, advanceProject, updateBlock } from './helpers';
import { getRule } from './rules';

export async function runHook({ db, project, block, hookName, extra = {}, actorId }) {
  const rule = getRule(block.type, hookName);
  if (!rule) return null;

  const sideEffects = rule({ block, project, ...extra });

  // Apply activity
  if (sideEffects.activity) {
    await postActivity(db, project.id, {
      ...sideEffects.activity,
      actorId,
    });
  }

  // Apply emails via /api/send-email
  if (sideEffects.emails?.length) {
    for (const em of sideEffects.emails) {
      await sendWorkflowEmail(project, em);  // implemented below
    }
  }

  // Apply SLA reminders — stored as block.slaReminders for Phase 1 client-side check
  if (sideEffects.setSLAReminders?.length) {
    await updateBlock(db, project.id, block.id, { slaReminders: sideEffects.setSLAReminders });
  }

  // Apply state mutations
  if (sideEffects.stateMutations) {
    // handled by caller or specific task (revision increment, hi-res unlock) — see F6, G3
  }

  // Apply advance
  if (sideEffects.advance) {
    const nextBlockId = await advanceProject(db, project.id, block.id, actorId);
    if (nextBlockId) {
      // Fire next block's onEnter
      const nextBlock = await getBlockFresh(db, project.id, nextBlockId);
      await runHook({ db, project, block: nextBlock, hookName: 'onEnter', actorId });
    }
  }

  return sideEffects;
}

async function sendWorkflowEmail(project, emailSpec) {
  // Resolve role → user email addresses via project.teamMembers
  const targets = resolveEmailTargets(project, emailSpec.role);
  if (targets.length === 0) return;

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
    .filter(m => m.role === role && m.removedAt == null)
    .map(m => m.email)
    .filter(Boolean);
}

async function getBlockFresh(db, projectId, blockId) {
  const { getBlock } = await import('./helpers');
  return getBlock(db, projectId, blockId);
}
```

**Step 2: Syntax check**
```bash
npx esbuild lib/workflow/runner.js --bundle --outfile=/dev/null --format=esm
```

**Step 3: Commit**
```bash
git add lib/workflow/runner.js
git commit -m "A4: rules runner — applies side-effect descriptors (activity, emails, SLA, advance)"
```

---

### Task A5: Seed the Photoshoot system template

**Files:**
- Create: `scripts/seed-workflow-templates.js`

**Step 1: Write the seed script**

```js
// scripts/seed-workflow-templates.js
// Run locally: node scripts/seed-workflow-templates.js
// Requires firebase-admin credentials (same pattern as other scripts).

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const PHOTOSHOOT_TEMPLATE = {
  name: 'Photoshoot',
  description: 'Standard photoshoot: upload → select → edit → approve → adapt → deliver',
  icon: 'camera',
  color: '#8b5cf6',
  isSystemDefault: true,
  isActive: true,
  createdBy: 'system',
  blocks: [
    { order: 1, type: 'UploadBlock', variant: 'raws', label: 'Upload Raws', defaultRole: 'producer', defaultSLAHours: 168,
      config: { allowPublicLink: true, acceptedMimeTypes: ['image/jpeg','image/png','image/webp'], maxFileSizeMB: 50 } },
    { order: 2, type: 'SelectionRound', label: 'Client Selection', defaultRole: 'client', defaultSLAHours: 72,
      config: { ratingSystems: ['stars','colors'], mobileSwipe: true, allowSnapshots: true, allowCompare: true } },
    { order: 3, type: 'Checkpoint', label: 'Assign Editor', defaultRole: 'producer', defaultSLAHours: 24,
      config: { prompt: 'Selection complete. Assign editor(s) to proceed.', requiredActions: ['assign-editor'] } },
    { order: 4, type: 'ProductionBlock', variant: 'edit', label: 'Edit Work', defaultRole: 'editor', defaultSLAHours: 72,
      config: { specialty: 'edit', allowAssetRequests: true, requireAllAssetsVersioned: true } },
    { order: 5, type: 'ApprovalRound', label: 'Client Approval', defaultRole: 'client', defaultSLAHours: 48,
      config: { mode: 'correction-or-approve', allowAnnotations: true } },
    { order: 6, type: 'AdaptBlock', label: 'Adapts', defaultRole: 'editor', defaultSLAHours: 48,
      config: { requiredAdapts: [
        { name: 'Master', width: null, height: null },
        { name: '1:1', width: 1080, height: 1080 },
        { name: '9:16', width: 1080, height: 1920 },
        { name: '4:5', width: 1080, height: 1350 },
      ], allowCustomPerAsset: true } },
    { order: 7, type: 'DeliveryBlock', label: 'Delivery', defaultRole: 'client', defaultSLAHours: null,
      config: { allowBulkZip: true, unlockHiResOnEnter: true } },
  ],
};

(async () => {
  const ref = db.collection('workflowTemplates').doc('tpl_photoshoot');
  const existing = await ref.get();
  if (existing.exists && existing.data().isSystemDefault) {
    console.log('Photoshoot template already exists. Updating blocks only.');
  }
  await ref.set({
    ...PHOTOSHOOT_TEMPLATE,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: false });
  console.log('Seeded tpl_photoshoot');
  process.exit(0);
})();
```

**Step 2: Dry-run check (do not run yet — requires admin credentials)**

```bash
node -c scripts/seed-workflow-templates.js
```
Expected: no syntax errors.

**Step 3: Run with credentials when available**

```bash
GOOGLE_APPLICATION_CREDENTIALS=./firebase-admin-key.json node scripts/seed-workflow-templates.js
```

Verify in Firebase console: `workflowTemplates/tpl_photoshoot` exists with 7 blocks.

**Step 4: Commit**
```bash
git add scripts/seed-workflow-templates.js
git commit -m "A5: seed script for Photoshoot system template"
```

---

### Task A6: Extend `/api/send-email` with workflow template types

**Files:**
- Modify: `app/api/send-email/route.js`

**Step 1: Read existing route**

```bash
# Identify current template types and Resend integration pattern
```

**Step 2: Add new template handlers**

Add a switch case for each new template type from `EMAIL_TEMPLATES` constant. Each case produces a `{ subject, html, text }` tuple. Keep HTML minimal and brand-consistent with existing templates. Example for `selection.requested`:

```js
case 'selection.requested':
  return {
    subject: `Please review your selection — ${data.projectName}`,
    html: `<p>Your images are ready for selection.</p><p><a href="${data.shareUrl}">Open selection</a></p>`,
    text: `Your images are ready for selection: ${data.shareUrl}`,
  };
```

Add cases for all 15 template types listed in `EMAIL_TEMPLATES` (see constants.js). Keep bodies short — producer/client will read on mobile.

**Step 3: Syntax check**
```bash
npx esbuild app/api/send-email/route.js --bundle --outfile=/dev/null --loader:.js=jsx --external:resend
```

**Step 4: Commit**
```bash
git add app/api/send-email/route.js
git commit -m "A6: email templates for workflow transitions (15 new types)"
```

---

### Task A7: Create Workflow Templates settings page (read-only + clone)

**Files:**
- Create: `components/workflow/WorkflowTemplatesView.js`
- Modify: `components/MainApp.js` (add nav item + route)

**Step 1: Build the view**

Module-level component. Uses `getTemplates` helper. Lists templates as cards with: name, icon, default badge, block count, [Edit] [Duplicate] [Archive] actions. For Phase 1 the [Edit] button is disabled for system defaults (Clone first pattern).

**Step 2: Wire into MainApp**

Add `'workflow-templates'` as a valid `view` value. Add nav item gated on `isProducer`. Render view via dynamic import.

**Step 3: Syntax check + preview**
```bash
npx esbuild components/MainApp.js --bundle --outfile=/dev/null --loader:.js=jsx
```
Start preview; navigate to Settings → Workflow Templates; verify Photoshoot renders with 7-block count.

**Step 4: Commit**
```bash
git add components/workflow/WorkflowTemplatesView.js components/MainApp.js
git commit -m "A7: Workflow Templates settings page (read-only list, clone action)"
```

---

### Task A8: Workflow Template Editor (block reorder + config)

**Files:**
- Create: `components/workflow/WorkflowTemplateEditor.js`

**Step 1: Build editor modal**

Uses `Modal size='xl'`. Shows block list with drag handles (Framer Motion reorder). Each block row: label, type badge, role, SLA, [Edit config]. [+ Add Block] at bottom — pops secondary modal with block-type picker + variant + role + SLA + config. Save button calls `updateTemplate`.

For Phase 1, reorder and add/remove are enough. Rich config UI (e.g., Adapt requiredAdapts matrix) can be textarea-JSON.

**Step 2: Syntax check + preview**

**Step 3: Commit**
```bash
git add components/workflow/WorkflowTemplateEditor.js
git commit -m "A8: Workflow Template Editor (drag reorder, add/remove, config JSON)"
```

---

### Task A9: Slice A integration sanity

**Steps:**
1. Open preview
2. Navigate to Settings → Workflow Templates
3. Clone Photoshoot → name "Photoshoot Custom" → save → verify in Firestore
4. Open the clone in editor → drag block 4 above block 3 → save → verify `order` updated
5. Delete the clone → verify removed from Firestore
6. Attempt to delete the system default → verify guard trips with clear error
7. Commit any fixes if needed

**Commit (if fixes):**
```bash
git commit -am "A9: Slice A sanity fixes"
```

---

# SLICE B — Project creation from template + deliverables

**Outcome:** New projects instantiate a template into blocks. Deliverables checklist captured at creation time.

---

### Task B1: Extend project creation modal with template picker

**Files:**
- Modify: `components/CreateProjectModal.js`

**Step 1: Add "Template" step before Workflow Configuration**

In the existing multi-step modal (from 2026-03-28 overhaul), insert a new step:
- Fetch templates via `getTemplates`
- Render as grid of cards (icon, name, block count)
- Default selection: `tpl_photoshoot`
- Store selected `templateId` in modal state

**Step 2: Commit**
```bash
git commit -am "B1: add template picker step to project creation modal"
```

---

### Task B2: Add deliverables checklist step

**Files:**
- Modify: `components/CreateProjectModal.js`

**Step 1: Add deliverables step**

- List editor: each row = `{ name, type: image|video|other, qty }`
- Defaults for Photoshoot: Hero 5, Product 20, Lifestyle 10, BTS 5, Social cutdowns 3
- Defaults per template type can live in template config (add `template.defaultDeliverables`)
- Producer can add/remove rows

**Step 2: Commit**
```bash
git commit -am "B2: deliverables checklist step in project creation"
```

---

### Task B3: On create, materialize blocks + fire first onEnter

**Files:**
- Modify: `components/CreateProjectModal.js` (or wherever `createProject` is called)
- Modify: `lib/firestore.js` (extend `createProject` to accept templateId + deliverables)

**Step 1: Update createProject**

After project doc is written, call:
1. `materializeBlocksFromTemplate(db, projectId, template, actorId)` from A2
2. Fetch the first block
3. Call `runHook({ block, hookName: 'onEnter', ... })` from A4

Also persist `templateId`, `templateType`, `deliverables[]`, `revisionLimit=3`, `teamMembers[]`.

**Step 2: Verify**

Create a test project → Firestore console → confirm `projects/{pid}/blocks/*` has 7 docs (for Photoshoot) → activity subcollection has `block.started` event → project doc has `currentBlockId` set to block 1's id.

**Step 3: Commit**
```bash
git commit -am "B3: materialize template blocks on project creation + fire first onEnter"
```

---

### Task B4: Photographer upload token generation

**Files:**
- Modify: `components/CreateProjectModal.js` — add "Generate photographer upload link" toggle
- Modify: `lib/firestore.js` — extend createProject to generate random token when toggle on

**Step 1: Token generation**

```js
function generatePhotographerToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
}
```

Store on project as `photographerUploadToken`.

**Step 2: Commit**
```bash
git commit -am "B4: photographer upload token generation on project creation"
```

---

### Task B5: Slice B sanity

- Create a project from Photoshoot template with deliverables + photographer token
- Verify: blocks materialized, first block PENDING, onEnter fired, activity logged, email sent (check Resend dashboard)
- Commit fixes if any

---

# SLICE C — Stage timeline + project snapshot + activity feed

**Outcome:** Project view shows a timeline pill strip, a snapshot section, and a right-drawer activity feed. All read-only overlays that don't break existing UI.

---

### Task C1: StageTimelineBar component

**Files:**
- Create: `components/workflow/StageTimelineBar.js`

Horizontal pill strip showing all blocks for the project. Completed = filled with check, current = animated dot, locked = faded. Clickable (scrolls project to that block's UI section).

Props: `blocks, currentBlockId, onBlockClick, theme`.

**Commit:** `C1: StageTimelineBar component`

---

### Task C2: ProjectSnapshot top section

**Files:**
- Create: `components/workflow/ProjectSnapshot.js`

Shows: project name, client, current stage label, team list, pending-now summary, deliverables progress bars, references gallery, export buttons.

**Commit:** `C2: ProjectSnapshot section`

---

### Task C3: ActivityFeedDrawer component

**Files:**
- Create: `components/workflow/ActivityFeedDrawer.js`

Right-rail drawer (300px wide) toggled by a button in project header. Infinite-scroll recent activity. Each item: avatar, actor name, type-specific formatter, timestamp. Filter chips at top: all / uploads / approvals / comments / @mentions.

**Commit:** `C3: ActivityFeedDrawer with filters`

---

### Task C4: Wire into MainApp project view

**Files:**
- Modify: `components/MainApp.js` — inject Timeline + Snapshot + Feed into project detail view

**Step 1:** Above the existing Assets/Tasks/Decks tab bar, render:
- Timeline
- Snapshot (collapsible)
- Activity feed toggle button

**Step 2:** Graceful degradation — if project has no `blocks` (legacy pre-workflow project), skip timeline/snapshot gracefully.

**Commit:** `C4: wire Timeline + Snapshot + Feed into project view`

---

### Task C5: Slice C preview verification

- Open an existing project without blocks → verify no crash, no timeline shown
- Create new project from template → verify timeline shows, snapshot renders, activity feed shows `block.started`
- Commit fixes

---

# SLICE D — Upload blocks

**Outcome:** UploadBlock UI works; uploads are resumable, smart-named, watermarked; photographer public link works.

---

### Task D1: UploadBlockView component

**Files:**
- Create: `components/workflow/blocks/UploadBlockView.js`

Uses existing `uploadBytesResumable` pattern from `app/vendor/invoice/page.js:97-113`. Drag-drop zone + file picker. Shows per-file progress list with retry. On complete: writes asset doc with `blockId`, `version=1`, `watermarked`, `smartName`.

**Commit:** `D1: UploadBlockView with resumable uploads`

---

### Task D2: Smart file naming

**Files:**
- Create: `lib/workflow/smartName.js`

```js
export function generateProjectCode(projectName, createdAt) {
  const letters = projectName.split(/\s+/).filter(Boolean).map(w => w[0]?.toUpperCase() ?? '').join('').slice(0, 6);
  const year = new Date(createdAt?.toMillis?.() || Date.now()).getFullYear();
  return `${letters}-${year}`;
}

export function generateSmartName(projectCode, blockTypeAbbr, seq, originalExt) {
  const padded = String(seq).padStart(3, '0');
  return `${projectCode}-${blockTypeAbbr}-${padded}.${originalExt}`;
}

export const BLOCK_ABBR = {
  UploadBlock: 'SRC',
  SelectionRound: 'SEL',
  ProductionBlock: 'EDIT',
  ApprovalRound: 'REV',
  AdaptBlock: 'ADAPT',
  DeliveryBlock: 'DEL',
};
```

Integrate into UploadBlockView (Task D1).

**Commit:** `D2: smart file naming helper`

---

### Task D3: Client-side canvas watermarking

**Files:**
- Create: `lib/workflow/watermark.js`

```js
export async function watermarkImage(file, text) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  // Tile watermark diagonally, faint
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = 'white';
  ctx.font = `${Math.max(16, canvas.width / 40)}px sans-serif`;
  ctx.rotate(-Math.PI / 12);
  for (let y = -canvas.height; y < canvas.height * 2; y += 150) {
    for (let x = -canvas.width; x < canvas.width * 2; x += 500) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
}
```

Wire into UploadBlockView — generate watermarked version; upload both original (hi-res, gated) and watermarked (shown).

**Commit:** `D3: client-side watermark generator + dual-upload (hi-res gated)`

---

### Task D4: Photographer public upload route

**Files:**
- Create: `app/photographer-upload/[token]/page.js`

Landing page: validate token against `projects.photographerUploadToken`. If valid, show UploadBlockView scoped to the UploadBlock(raws) of that project. No auth required. Expires when block advances.

**Commit:** `D4: photographer public upload route`

---

### Task D5: Photographer invite email + share modal

**Files:**
- Modify: `components/workflow/blocks/UploadBlockView.js` — add "Invite Photographer" button (producer only)
- Modify: `app/api/send-email/route.js` — `photographer.upload-invite` template

Button opens a small modal: enter email(s), click send → POST to `/api/send-email` with type `photographer.upload-invite`, body includes `${NEXT_PUBLIC_APP_URL}/photographer-upload/${token}`.

**Commit:** `D5: photographer invite email + share modal`

---

### Task D6: Upload onComplete advances the block

When UploadBlock is marked complete (all expected uploads done + producer clicks "Done uploading"), call `runHook({ hookName: 'onExit', ... })`. Next block (SelectionRound) enters → client gets email.

**Commit:** `D6: UploadBlock complete → advance + fire next onEnter`

---

### Task D7: Slice D sanity

- Create new Photoshoot project
- As producer, upload 10 JPEGs via UploadBlock → verify watermarked previews show + hi-res gated
- Mark complete → verify client gets selection email (Resend log)
- Open photographer upload link in incognito → verify scoped upload works without auth

**Commit if fixes:** `D7: Slice D sanity fixes`

---

### Task D8: Resumable upload state persistence

Extend UploadBlockView to persist upload-in-progress state to sessionStorage. On reload, offer "Resume uploads?" banner.

**Commit:** `D8: resumable upload session persistence`

---

# SLICE E — Selection Round (mobile-first)

**Outcome:** Client can rate (stars + 7 colors), filter, compare, swipe on mobile, submit a selection snapshot. Producer can export the selection as CSV.

---

### Task E1: Extend color labels to 7 colors

**Files:**
- Modify: `components/MainApp.js` — replace existing 3-color state with `DEFAULT_COLOR_LABELS` from constants
- Modify: `app/share/[token]/page.js` — same

Extend `handleColorLabel` to accept any of the 7 keys. Update keyboard shortcuts: `P/M/G/B/V/O/K` (Red/Yellow/Green/Blue/Violet/Orange/Gray) + `U` clear.

**Commit:** `E1: extend color labels from 3 → 7 (Capture One parity)`

---

### Task E2: SelectionRoundView component (desktop)

**Files:**
- Create: `components/workflow/blocks/SelectionRoundView.js`

Minimal grid UI for client role. Top bar: project name, N of M rated, [Submit Selection →]. Filter pills. Card: image + 5-star control + 7 color dots + checkbox. Lightbox reuses existing keyboard shortcuts.

Hides all status/version/feedback/revision info from visible UI (role-scoped).

**Commit:** `E2: SelectionRoundView — clean client grid, no post-prod clutter`

---

### Task E3: Mobile swipe card stack

**Files:**
- Create: `components/workflow/blocks/SelectionMobile.js`

Framer Motion card stack. Swipe right → ★ up. Swipe left → skip. Long-press → color palette overlay. Tap → detail (reuses lightbox).

Shown instead of grid when viewport < 768px.

**Commit:** `E3: mobile swipe-to-rate UI`

---

### Task E4: Submit Selection flow + snapshot

**Files:**
- Modify: `components/workflow/blocks/SelectionRoundView.js`

"Submit Selection" button → confirmation modal → create doc in `projects/{pid}/selections/{sid}`:

```js
{
  blockId, createdAt, createdBy,
  assetSnapshot: [ {assetId, rating, colorLabel, note, isFinalPick} ],
  submitted: true,
  note: '...'  // optional client message
}
```

Then `runHook({ block, hookName: 'onClientSubmit', extra: { snapshotId, pickCount } })` → advances block.

**Commit:** `E4: Submit Selection → snapshot + onClientSubmit hook`

---

### Task E5: Selection history UI

**Files:**
- Modify: `components/workflow/blocks/SelectionRoundView.js`

"History" button in top bar → dropdown of previous snapshots. Click → restores picks (updates asset rating/color overlays to match snapshot). Client can create a new snapshot on next submit.

**Commit:** `E5: selection history — browse and restore snapshots`

---

### Task E6: Export Selections CSV

**Files:**
- Modify: `package.json` — add `papaparse: ^5.4.1`
- Create: `lib/workflow/exportSelection.js`
- Modify: producer's project snapshot — add "Export Selection CSV" button

```js
import Papa from 'papaparse';

export function buildSelectionCSV(snapshot, assets) {
  const rows = snapshot.assetSnapshot
    .filter(s => s.isFinalPick)
    .map(s => {
      const a = assets.find(x => x.id === s.assetId);
      return {
        original_filename: a?.name ?? '',
        smart_name: a?.smartName ?? '',
        rating: s.rating,
        color: s.colorLabel || '',
        note: s.note || '',
      };
    });
  return Papa.unparse(rows);
}
```

Button creates Blob and triggers download. Filename: `${project.name}-selection-${date}.csv`.

**Commit:** `E6: export selection CSV (for Capture One hi-res lookup)`

---

### Task E7: Share view integration

**Files:**
- Modify: `app/share/[token]/page.js`

When the client's block is a SelectionRound, render SelectionRoundView. Adjust share token to include block awareness (optional scoped access).

**Commit:** `E7: share view routes to SelectionRoundView when block type matches`

---

### Task E8: Producer view of client's in-progress selection

Producer can read the same block's UI but with read-only star/color state. Includes "Force Submit" action for stuck-client scenarios. Logs to activity with `actorId` noting it was producer override.

**Commit:** `E8: producer read-only view + force-submit override`

---

### Task E9: Slice E sanity

- Create project → upload raws → advance to SelectionRound
- Open share URL on phone → verify mobile swipe works
- Submit selection → verify snapshot created + producer email + block advances to Checkpoint
- Export CSV → open in Numbers → verify 3 columns
- Commit fixes

---

# SLICE F — Production + Approval + revision rounds

**Outcome:** Editor sees brief + references + annotations; uploads V2/V3; client approves or requests corrections with round-limit enforcement.

---

### Task F1: ProductionBlockView (editor side)

**Files:**
- Create: `components/workflow/blocks/ProductionBlockView.js`

Two-pane: left = current asset (latest version), right = brief panel (pinned references + annotations + client notes from previous ApprovalRound). Bottom: "Upload New Version" button per asset. "Mark Complete" button top-right, disabled until `requireAllAssetsVersioned` satisfied.

**Commit:** `F1: ProductionBlockView — brief panel + version upload`

---

### Task F2: References pinning UI

**Files:**
- Create: `components/workflow/ReferencesPanel.js`
- Modify: ProductionBlockView — sidebar with pinned references

Producer uploads references via project snapshot (C2). Pins reference to asset via drag or "Pin" button. Stored in `projects/{pid}/references/{rid}` with `pinnedToAssetIds[]`.

**Commit:** `F2: reference pinning panel + ProjectSnapshot upload`

---

### Task F3: Asset version ladder

**Files:**
- Modify: `lib/firestore.js` — add version utilities

Uploading "new version" creates a new asset doc with `parentAssetId = previousAssetId`, `version = prev + 1`. Lineage queryable. UI shows `V1 ← V2 ← V3` in a dropdown on the lightbox.

**Commit:** `F3: asset version lineage`

---

### Task F4: ApprovalRoundView (client side — correction mode)

**Files:**
- Create: `components/workflow/blocks/ApprovalRoundView.js`

Grid of current-version assets. Click → lightbox with annotation tools + comment box. Bottom bar: [← Prev] [Request Corrections] [Approve ✓] [Next →]. Per-asset annotations saved to `projects/{pid}/annotations`.

**Commit:** `F4: ApprovalRoundView correction-or-approve mode`

---

### Task F5: ApprovalRoundView pick-one-of-many mode

Radio-grid UI for picking one of N options (supers). Single "Submit Choice" button. Chosen option's assetId stored on the block completion payload.

**Commit:** `F5: ApprovalRoundView pick-one-of-many mode (for supers)`

---

### Task F6: Revision round tracking + extra-round flow

**Files:**
- Create: `lib/workflow/revisionRounds.js`

Helper `incrementRevisionRound(projectId, blockId)` reads latest round, creates a new `revisionRounds/{id}` with `roundNumber = prev + 1`. If `> project.revisionLimit`, sets block status to paused and fires `APPROVAL_ROUND_LIMIT` email.

Producer view in inbox → "Client requests round 4 of 3 — approve extra charge?" → modal with cost input → approve creates `status: extra-approved` on round → client sees notice → continues.

**Commit:** `F6: revision rounds + extra-charge approval flow`

---

### Task F7: AssetRequest "Request from Client" button inside ProductionBlockView

**Files:**
- Create: `components/workflow/AssetRequestModal.js`
- Modify: ProductionBlockView

Button → modal: description, urgency. Submit → creates `assetRequests/{rqid}` with `status: pending-producer`. Producer sees in inbox; approves → status: `producer-approved` → client email fires. Client uploads → assets added → status: `fulfilled` → editor email.

(Full flow implemented in SLICE I; this task wires the initial button.)

**Commit:** `F7: AssetRequest button + modal inside ProductionBlock`

---

### Task F8: Wire approve/correct actions to rules runner

On Approve: `runHook({ hookName: 'onApprove' })` → emails + advance.
On Request Corrections: `runHook({ hookName: 'onRequestCorrections', extra: { correctionCount, roundNumber, roundLimit } })` → increments round or triggers extra-charge email.

**Commit:** `F8: wire approve/correct actions to runner`

---

### Task F9: Slice F sanity

- Take test project to ApprovalRound
- Approve → verify block advances + editor email
- Request corrections 3 times → verify 4th triggers extra-charge flow
- Test pick-one-of-many with 3 super options
- Commit fixes

---

# SLICE G — Adapt + Delivery + hi-res gate

**Outcome:** Editor completes adapts against a checklist; client sees clean delivery hub; hi-res unlocks at delivery.

---

### Task G1: AdaptBlockView

**Files:**
- Create: `components/workflow/blocks/AdaptBlockView.js`

Grid: rows = approved masters, columns = required adapts (from `block.config.requiredAdapts`). Each cell: upload button or "View" if uploaded. Block advances when all cells filled.

**Commit:** `G1: AdaptBlockView checklist grid`

---

### Task G2: DeliveryBlockView (client)

**Files:**
- Create: `components/workflow/blocks/DeliveryBlockView.js`

Grid of deliverables grouped by master. Per-row: [Master] [1:1] [9:16] [4:5] download buttons. Top: [Download All ZIP] button → triggers existing `lib/bulk-download.js` pattern.

**Commit:** `G2: DeliveryBlockView with per-adapt + bulk ZIP`

---

### Task G3: Hi-res unlock on DeliveryBlock entry

**Files:**
- Modify: `lib/workflow/runner.js` — handle `stateMutations.unlockHiRes`

When DeliveryBlock enters, batch-update all approved assets: `hiResLocked=false`. Activity feed posts `delivery.ready`.

**Commit:** `G3: hi-res unlock on DeliveryBlock entry`

---

### Task G4: Deliverables validation gate

**Files:**
- Modify: `lib/workflow/runner.js` — block DeliveryBlock completion if `deliverables[].fulfilledCount < qty`

Producer override required if short. Override logs to activity with reason.

**Commit:** `G4: deliverables checklist validation before delivery complete`

---

### Task G5: Download log

**Files:**
- Modify: `components/workflow/blocks/DeliveryBlockView.js`

Each client download posts activity `asset.downloaded` with assetId + clientId + timestamp. Producer snapshot shows "First download: X hrs after delivery ready."

**Commit:** `G5: delivery download log + first-download metric`

---

### Task G6: Slice G sanity

- End-to-end: Photoshoot project from upload → delivery
- Verify hi-res gated through selection + approval, unlocked at delivery
- Verify deliverables gate works (try to complete with unfulfilled checklist)
- Verify bulk ZIP downloads
- Commit fixes

---

# SLICE H — Inbox + SLA + @mentions

**Outcome:** Single cross-project inbox for every user; SLA reminders; @mentions in activity feed.

---

### Task H1: Inbox page

**Files:**
- Create: `app/inbox/page.js`

Server component fetches via `getInboxForUser(db, userId, userRoles)`. Renders groups: Overdue / Today / This Week / Later / Waiting On Others.

**Commit:** `H1: inbox page with grouped actionable items`

---

### Task H2: Inbox grouping logic

**Files:**
- Create: `lib/workflow/inboxGroups.js`

```js
export function groupInboxItems(items, now = Date.now()) {
  const groups = { overdue: [], today: [], thisWeek: [], later: [], waitingOnOthers: [] };
  for (const it of items) {
    const due = it.dueDate?.toMillis?.() ?? null;
    if (!due) { groups.later.push(it); continue; }
    const diff = due - now;
    if (diff < 0) groups.overdue.push(it);
    else if (diff < 24*3600*1000) groups.today.push(it);
    else if (diff < 7*24*3600*1000) groups.thisWeek.push(it);
    else groups.later.push(it);
  }
  return groups;
}
```

**Commit:** `H2: inbox grouping helper`

---

### Task H3: Dashboard inbox widget

**Files:**
- Modify: `components/MainApp.js` dashboard view

Top card: "What's next" with next 3 items across all groups. Click → inbox page.

**Commit:** `H3: dashboard inbox widget`

---

### Task H4: SLA timer checks on inbox load

**Files:**
- Modify: `app/inbox/page.js` or inbox client component

On load, for each block, check `startedAt + slaHours*0.75` and `+slaHours` thresholds. If crossed and reminder not yet sent (track via `block.slaRemindersSent[]`), fire email + post activity + update block.

**Commit:** `H4: SLA reminder firing on inbox load`

---

### Task H5: @mention autocomplete in ActivityFeedDrawer

**Files:**
- Modify: `components/workflow/ActivityFeedDrawer.js`

Rich textarea → typing `@` shows user list (project teamMembers). Selecting → inserts `@userId` token. On submit: posts comment activity with `mentions: [userId]`. Each mentioned user gets email + inbox item.

**Commit:** `H5: @mention autocomplete + notification fanout`

---

### Task H6: In-app notification toasts

**Files:**
- Create: `components/workflow/NotificationToaster.js`

Firestore `onSnapshot` to user's recent activity → toast on new events. Auto-dismiss 5s. Click toast → navigates to target.

**Commit:** `H6: in-app notification toasts`

---

### Task H7: Slice H sanity

- Log in as producer → verify inbox shows blocks across 5 projects
- Log in as editor → verify inbox filters correctly
- Verify SLA reminder fires (set SLA to 1 hour for test, wait, reload inbox)
- @mention someone → verify they get email + toast
- Commit fixes

---

# SLICE I — AssetRequest side-channel

**Outcome:** Editor → Producer → Client → Editor flow works end-to-end.

---

### Task I1: Producer asset-request review panel

**Files:**
- Create: `components/workflow/AssetRequestReview.js`

Rendered inside inbox for producer. List of pending requests. Each: editor name, description, [Approve & Forward to Client] [Reject with reason].

**Commit:** `I1: producer asset-request review panel`

---

### Task I2: Client fulfillment page

**Files:**
- Create: `app/asset-request/[requestId]/page.js`

Public (token-gated) page for client to upload requested files. On submit: assets added to references, request status → `fulfilled`.

**Commit:** `I2: client asset-request fulfillment page`

---

### Task I3: Email chain wiring

Extend send-email types:
- `asset-request.created` → producer
- `asset-request.approved` → client (with link)
- `asset-request.fulfilled` → editor

**Commit:** `I3: asset-request email chain`

---

### Task I4: Editor notification on fulfilled

When status → `fulfilled`: editor gets inbox item + email + reference appears in their brief panel.

**Commit:** `I4: editor notification on asset-request fulfilled`

---

### Task I5: Slice I sanity

- Editor in ProductionBlock → clicks "Request from Client" → fills form → submits
- Producer inbox shows request → approves → client gets email
- Client opens link → uploads font file → editor inbox notified → reference visible in brief
- Commit fixes

---

# SLICE J — Team workload + calendar sync

**Outcome:** Producer sees load balance; all users can subscribe calendars.

---

### Task J1: Team Workload Dashboard page

**Files:**
- Create: `app/team-workload/page.js`

Producer-only. Horizontal bar per team member showing load. Click → modal with block breakdown.

**Commit:** `J1: Team Workload Dashboard`

---

### Task J2: Per-user breakdown modal

Modal from J1. Shows all pending/in-progress blocks for a user across projects. Allows reassignment from here.

**Commit:** `J2: per-user workload breakdown modal`

---

### Task J3: Calendar .ics feed endpoint

**Files:**
- Create: `app/api/calendar/[userId]/[token]/route.js`

Returns .ics text content with VEVENTs for every block assigned to user with a dueDate. Token signed so feed is private. User adds URL as subscribed calendar.

**Commit:** `J3: .ics calendar feed endpoint`

---

### Task J4: User settings: calendar integration

**Files:**
- Modify: user profile page

Button: "Copy my calendar feed URL" → generates token, copies URL. Instructions for Google / Apple.

**Commit:** `J4: user calendar settings + feed URL generator`

---

### Task J5: Slice J sanity

- Open workload dashboard → see 5 team members
- Subscribe a Google calendar to the feed URL → verify blocks appear as events
- Commit fixes

---

# SLICE K — Polish pass

**Outcome:** Click-outside-to-close audit, consistent button sizing, mobile breakpoints, empty/loading/error states.

---

### Task K1: Click-outside-to-close audit

**Files:**
- Audit all modals across the app
- Ensure every Modal uses the existing pattern with backdrop click → onClose

Create test checklist:
- [ ] Modal component in MainApp.js
- [ ] All new workflow modals
- [ ] Asset detail modal
- [ ] Project creation modal
- [ ] Compare panel

**Commit:** `K1: click-outside-to-close audit across all modals`

---

### Task K2: Button size consistency

Create spec doc: `components/workflow/BUTTONS.md`. All action buttons in workflow UIs use 3 sizes:
- sm: 32px
- md: 40px (default)
- lg: 48px (CTAs only)

Audit + fix deviations.

**Commit:** `K2: button size consistency pass`

---

### Task K3: Mobile breakpoints across new surfaces

Test every new view at 375px viewport. Fix overflow, clipping, layout shifts.

**Commit:** `K3: mobile breakpoint fixes for new workflow views`

---

### Task K4: Empty states

Every new list/grid gets a friendly empty state with a CTA or illustration.

- Inbox empty: "All caught up! ☕"
- Workload empty: "No assignments yet"
- Templates empty: "Create your first template"
- Activity empty: "Nothing happened yet"

**Commit:** `K4: empty states for all new workflow surfaces`

---

### Task K5: Loading states (skeleton screens)

Every async load gets a skeleton (not a spinner) matching final layout. Use the existing skeleton pattern if present.

**Commit:** `K5: skeleton loading states for workflow views`

---

### Task K6: Error states with recovery

Every failure path shows clear error + "Retry" CTA. Never silent failure.

**Commit:** `K6: error states with retry paths`

---

### Task K7: Final QA screenshot pass

- Take screenshot of every new surface at 375px + 1440px
- Save to `docs/plans/2026-04-21-workflow-blocks-qa.md` with notes
- Fix anything glaring

**Commit:** `K7: final QA screenshot pass + notes`

---

## Post-Phase-1 smoke test

End-to-end run on real data (the Pepsi Merch project):
1. Create project "Pepsi Merch Shoot — Test" from Photoshoot template, deliverables `[5 hero, 20 product, 10 lifestyle]`
2. Generate photographer link → upload 50 JPEGs via incognito tab
3. Advance UploadBlock → SelectionRound → open share link on phone → swipe-rate 50 → submit 12 picks
4. Producer receives email → opens inbox → sees Checkpoint → assigns editor
5. Editor receives email → opens ProductionBlock → sees 12 selected with pinned brief → uploads V2 for each → marks complete
6. Editor requests Pepsi font → producer approves → client uploads TTF → editor receives
7. Client approves with 2 annotations on one asset → editor uploads V3 → client approves all
8. Editor uploads adapts (1:1, 9:16, 4:5) for each → block advances
9. Client receives delivery email → downloads bulk ZIP
10. Verify activity feed captures all 30+ events
11. Verify inbox for all 3 roles shows correct state throughout
12. Verify no console errors

## Known deferred items (Phase 2+)

- Cloud Function SLA cron (Phase 1 uses client-side)
- Cloud Function watermarking (Phase 1 client-side canvas)
- Full Template Editor rich config UI (Phase 1 has textarea JSON)
- Video / AdFilm / Social / Event template UIs wired end-to-end
- Budget tracker
- Auto-invoicing
- Revenue dashboard
- In-app onboarding tutorials
- Pre-production blocks (MoodBoard/ShotList/CallSheet)
- Agency role approval chain
- HR module (per separate plan)
- MainApp.js refactor (user explicitly deferred)

---

*End of implementation plan. Total: ~75 tasks across 11 slices. Estimate: 10–15 focused working sessions depending on complexity surprises.*
