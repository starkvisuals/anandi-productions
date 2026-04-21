// lib/workflow/helpers.js
//
// Convention: `db` is passed as the first parameter to every function (unlike
// lib/firestore.js which imports it directly). This enables test injection
// and keeps the rules-runner (A4) composable. Use this pattern for all new
// workflow code.

import {
  collection, doc, addDoc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch, collectionGroup, Timestamp,
} from 'firebase/firestore';
import { BLOCK_STATUS } from './constants';

// --- Templates ---

export async function getTemplates(db) {
  const snap = await getDocs(query(collection(db, 'workflowTemplates'), orderBy('name')));
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function getTemplate(db, templateId) {
  const snap = await getDoc(doc(db, 'workflowTemplates', templateId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
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
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

export async function getBlock(db, projectId, blockId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'blocks', blockId));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
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

// Not safe under concurrent advances — relies on single-actor UI guarantee.
// If multi-actor concurrent advance becomes possible, promote this to
// runTransaction() for read-then-write atomicity.
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

  // TODO(later slice): replace order+1 lookup when insert/remove blocks land — use a nextBlockId pointer or re-sort.
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
  // NOTE: Firestore does not index `== null` comparisons by default, so this query
  // may miss blocks where `assignedUserId` was never set. Planned follow-up: add
  // a `needsAssignment: boolean` field and filter on that instead.
  // See docs/plans/2026-04-21-workflow-blocks-design.md.
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
    combined.set(d.ref.path, { ...d.data(), id: d.id, path: d.ref.path, projectId: d.ref.parent.parent.id });
  });
  return Array.from(combined.values());
}
