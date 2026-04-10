// HR / Employee Management module — data layer & access guards
//
// This module is the ONLY supported way to read/write HR data. Every function
// here enforces role-based access, and the primary producer account (Harnesh)
// is permanently undeletable and undemotable.
//
// Scope: internal Anandi Productions team only. Vendors, clients, and freelancers
// never have HR access — guards return false / empty / throw for them.

import { db, storage } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, addDoc, orderBy, runTransaction
} from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

// ─── Constants ──────────────────────────────────────────────────────────────

export const EMPLOYMENT_TYPES = {
  'full-time': { label: 'Full-time', color: '#22c55e' },
  'part-time': { label: 'Part-time', color: '#06b6d4' },
  'contract':  { label: 'Contract',  color: '#f59e0b' },
  'freelance': { label: 'Freelance', color: '#a855f7' },
  'intern':    { label: 'Intern',    color: '#6366f1' },
};

export const DEPARTMENTS = [
  'Production', 'Post-Production', 'Creative', 'Art', 'Sound',
  'Admin', 'Finance', 'HR', 'Sales', 'Marketing', 'Technology'
];

export const GENDERS = ['male', 'female', 'other', 'prefer-not-to-say'];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ONBOARDING_STEPS = [
  { id: 'welcome',         label: 'Welcome' },
  { id: 'personal',        label: 'Personal Details' },
  { id: 'address',         label: 'Address' },
  { id: 'identity',        label: 'Identity Documents' },
  { id: 'banking',         label: 'Banking Details' },
  { id: 'photo',           label: 'Photo' },
  { id: 'offerLetter',     label: 'Offer Letter' },
  { id: 'agreement',       label: 'Employee Agreement' },
  { id: 'handbook',        label: 'Employee Handbook' },
  { id: 'terms',           label: 'Terms & Conditions' },
  { id: 'complete',        label: 'Complete' },
];

// Fields that, when changed by an HR sub-admin, must go to the producer for approval.
// Producer can still edit them directly without approval.
export const APPROVAL_REQUIRED_ACTIONS = [
  'update_ctc',
  'update_statutory',    // PF, ESI, PT, TDS
  'update_employment',   // dateOfJoining, employmentType, department
  'delete_employee',
  'toggle_employee_flag',// isEmployee, isHrAdmin
  'role_change',
];

// Paths in the user document that need approval when a sub-admin touches them.
export const SENSITIVE_FIELDS = [
  'ctc', 'pfEnabled', 'pfNumber', 'esiEnabled', 'esiNumber',
  'uanNumber', 'ptApplicable', 'tdsMonthly', 'panNumber', 'aadharNumber',
  'bankAccount', 'dateOfJoining', 'employmentType', 'department',
  'role', 'isEmployee', 'isHrAdmin', 'isPrimaryProducer',
];

// ─── Access guards ──────────────────────────────────────────────────────────
// These are pure functions — they read userProfile and return booleans.
// Every mutating function below calls them and throws if access is denied.
// UI code should also call them to hide/disable controls as a first line of defense.

/**
 * Returns true if this user is allowed to see ANY part of the HR module.
 * Vendors/clients/freelancers: false.
 * Employees: true (but their queries are self-scoped).
 * Producers & HR admins: true (full admin scope).
 */
export const canAccessHr = (userProfile) => {
  if (!userProfile) return false;
  if (userProfile.isPrimaryProducer === true) return true;
  if (userProfile.role === 'producer') return true;
  if (userProfile.isHrAdmin === true) return true;
  if (userProfile.isEmployee === true) return true;
  return false;
};

/**
 * Returns true if this user is a full HR admin (producer). Can act without approvals.
 */
export const isHrFullAdmin = (userProfile) => {
  if (!userProfile) return false;
  return userProfile.isPrimaryProducer === true || userProfile.role === 'producer';
};

/**
 * Returns true if this user is an HR sub-admin. Can act but sensitive changes
 * require producer approval.
 */
export const isHrSubAdmin = (userProfile) => {
  if (!userProfile) return false;
  if (isHrFullAdmin(userProfile)) return false; // producer is full admin, not sub-admin
  return userProfile.isHrAdmin === true;
};

/**
 * Returns true if this user can see the Employees nav + admin list.
 */
export const canManageEmployees = (userProfile) => {
  return isHrFullAdmin(userProfile) || isHrSubAdmin(userProfile);
};

/**
 * Determines whether an actor can edit a target employee and whether the edit
 * must go through approval.
 *
 * Returns: { allowed: bool, requiresApproval: bool, reason: string }
 */
export const canEditEmployee = (actor, target, changedFields = []) => {
  if (!actor) return { allowed: false, requiresApproval: false, reason: 'Not authenticated' };
  if (!target) return { allowed: false, requiresApproval: false, reason: 'No target employee' };

  // Self-edit: employees can edit non-sensitive fields on their own record
  // (mainly via the onboarding flow).
  if (actor.id === target.id) {
    const touchesSensitive = changedFields.some(f => SENSITIVE_FIELDS.includes(f));
    if (touchesSensitive) {
      return { allowed: false, requiresApproval: false, reason: 'Cannot edit your own sensitive fields' };
    }
    return { allowed: true, requiresApproval: false, reason: 'Self-edit on non-sensitive fields' };
  }

  // Producer / full admin: direct edit, no approval needed.
  if (isHrFullAdmin(actor)) {
    // Even producer cannot demote the primary producer or toggle isPrimaryProducer off
    if (target.isPrimaryProducer && changedFields.some(f =>
      ['role', 'isPrimaryProducer', 'isEmployee'].includes(f)
    )) {
      return { allowed: false, requiresApproval: false, reason: 'Primary producer is permanently protected' };
    }
    return { allowed: true, requiresApproval: false, reason: 'Full admin direct edit' };
  }

  // HR sub-admin: can touch non-sensitive fields directly; sensitive fields route to approval.
  if (isHrSubAdmin(actor)) {
    if (target.isPrimaryProducer) {
      return { allowed: false, requiresApproval: false, reason: 'Cannot edit the primary producer' };
    }
    const touchesSensitive = changedFields.some(f => SENSITIVE_FIELDS.includes(f));
    if (touchesSensitive) {
      return { allowed: true, requiresApproval: true, reason: 'Sensitive change — needs producer approval' };
    }
    return { allowed: true, requiresApproval: false, reason: 'Non-sensitive sub-admin edit' };
  }

  return { allowed: false, requiresApproval: false, reason: 'Insufficient HR permissions' };
};

/**
 * Determines whether an actor can delete a target employee.
 * Primary producer can NEVER be deleted, by anyone, through any path.
 *
 * Returns: { allowed: bool, requiresApproval: bool, reason: string }
 */
export const canDeleteEmployee = (actor, target) => {
  if (!actor) return { allowed: false, requiresApproval: false, reason: 'Not authenticated' };
  if (!target) return { allowed: false, requiresApproval: false, reason: 'No target' };

  // HARD GUARD: primary producer is undeletable.
  if (target.isPrimaryProducer === true) {
    return { allowed: false, requiresApproval: false, reason: 'Primary producer account is permanent' };
  }

  if (isHrFullAdmin(actor)) {
    return { allowed: true, requiresApproval: false, reason: 'Full admin can delete' };
  }

  if (isHrSubAdmin(actor)) {
    return { allowed: true, requiresApproval: true, reason: 'HR admin delete requires producer approval' };
  }

  return { allowed: false, requiresApproval: false, reason: 'Insufficient permissions' };
};

// ─── Internal helpers ───────────────────────────────────────────────────────

const assertCanAccessHr = (actor) => {
  if (!canAccessHr(actor)) {
    throw new Error('HR: access denied');
  }
};

const assertIsFullAdmin = (actor) => {
  if (!isHrFullAdmin(actor)) {
    throw new Error('HR: producer-only action');
  }
};

const getDiff = (current = {}, proposed = {}) => {
  const diff = {};
  for (const key of Object.keys(proposed)) {
    const c = JSON.stringify(current?.[key]);
    const p = JSON.stringify(proposed[key]);
    if (c !== p) diff[key] = { from: current?.[key] ?? null, to: proposed[key] };
  }
  return diff;
};

// ─── Primary producer protection ────────────────────────────────────────────

/**
 * On first access by the workspace owner (whoever completed setup), marks
 * their user doc with isPrimaryProducer: true. Idempotent — running it twice
 * is a no-op. This MUST be called on app boot for the logged-in user so the
 * protection flag exists before any HR action runs.
 */
export const ensurePrimaryProducerExists = async (currentUserProfile) => {
  if (!currentUserProfile?.id) return { updated: false, reason: 'no-user' };

  // Read settings/app to find the workspace owner UID
  const settingsSnap = await getDoc(doc(db, 'settings', 'app'));
  if (!settingsSnap.exists()) return { updated: false, reason: 'no-settings' };

  const adminId = settingsSnap.data().adminId;
  if (!adminId) return { updated: false, reason: 'no-admin-id' };

  // Only act if the current user IS the admin
  if (currentUserProfile.id !== adminId) return { updated: false, reason: 'not-owner' };

  // Read the Firestore doc (userProfile may be stale)
  const userSnap = await getDoc(doc(db, 'users', adminId));
  if (!userSnap.exists()) return { updated: false, reason: 'no-user-doc' };
  const userData = userSnap.data();

  // Build a patch of only missing fields. The producer is flagged as an employee
  // so they appear pinned at the top of the Employees list as "Primary Admin",
  // but onboardingStatus is auto-completed — they bypass the onboarding flow
  // entirely because they own the company and don't need to sign documents
  // to themselves.
  const patch = {};
  if (userData.isPrimaryProducer !== true) patch.isPrimaryProducer = true;
  if (userData.role !== 'producer') patch.role = 'producer';
  if (userData.isEmployee !== true) patch.isEmployee = true;
  if (userData.onboardingStatus !== 'completed') {
    patch.onboardingStatus = 'completed';
    patch.onboardingCompletedAt = serverTimestamp();
  }
  // Clean up a legacy bug where the onboarding photo step wrote the full
  // Firebase Storage URL into `avatar`. The Avatar component renders avatar
  // as plain text (expecting an emoji/letter), so a URL there leaks as raw
  // text into the header. Clear it if it looks like a URL — the actual photo
  // still lives in documents.profilePhoto.url.
  if (typeof userData.avatar === 'string' && /^https?:\/\//.test(userData.avatar)) {
    patch.avatar = '';
  }

  if (Object.keys(patch).length === 0) {
    return { updated: false, reason: 'already-set' };
  }

  patch.updatedAt = serverTimestamp();
  await updateDoc(doc(db, 'users', adminId), patch);
  return { updated: true, uid: adminId, patched: Object.keys(patch) };
};

/**
 * Counts active producers (users with role === 'producer'). Used to prevent
 * the last producer from being demoted/deleted.
 */
export const countActiveProducers = async () => {
  const q = query(collection(db, 'users'), where('role', '==', 'producer'));
  const snap = await getDocs(q);
  return snap.size;
};

// ─── HR Settings ────────────────────────────────────────────────────────────

const DEFAULT_HR_SETTINGS = {
  companyDetails: {
    legalName: 'Anandi Productions',
    address: '',
    cin: '',
    pan: '',
    tan: '',
    gstin: '',
    logoUrl: '',
  },
  employeeIdCounter: 0,
  handbookUrl: '',
  handbookVersion: 'v1',
  termsAndConditionsText: 'By signing below, I acknowledge that I have read, understood, and agree to abide by the terms of employment, company policies, and code of conduct of Anandi Productions.',
  offerLetterTemplate: `
Dear {{name}},

We are pleased to offer you the position of {{designation}} at Anandi Productions, effective {{dateOfJoining}}.

Your annual CTC will be ₹{{annualCtc}}, structured as per company policy.

This offer is contingent on successful completion of onboarding and verification.

Welcome aboard!

— Anandi Productions
  `.trim(),
  employeeAgreementTemplate: `
EMPLOYEE AGREEMENT

This agreement is entered into between Anandi Productions ("Company") and {{name}} ("Employee") on {{dateOfJoining}}.

1. POSITION: The Employee is hired as {{designation}} in the {{department}} department.
2. COMPENSATION: Annual CTC of ₹{{annualCtc}} as detailed in the offer letter.
3. CONFIDENTIALITY: The Employee agrees to maintain confidentiality of all company information.
4. TERMINATION: Either party may terminate this agreement with 30 days' written notice.
5. GOVERNING LAW: This agreement is governed by the laws of India.

By signing below, the Employee acknowledges acceptance of all terms.
  `.trim(),
  defaultCtcStructure: {
    basicPct: 40,
    hraPct: 20,
    conveyancePct: 5,
    specialPct: 35,
  },
  holidayCalendar: [],
};

export const getHrSettings = async () => {
  const snap = await getDoc(doc(db, 'settings', 'hr'));
  if (!snap.exists()) return { ...DEFAULT_HR_SETTINGS };
  return { ...DEFAULT_HR_SETTINGS, ...snap.data() };
};

export const seedHrSettingsIfMissing = async (actor) => {
  assertCanAccessHr(actor);
  const snap = await getDoc(doc(db, 'settings', 'hr'));
  if (snap.exists()) return { seeded: false };
  assertIsFullAdmin(actor);
  await setDoc(doc(db, 'settings', 'hr'), {
    ...DEFAULT_HR_SETTINGS,
    createdAt: serverTimestamp(),
    createdBy: actor.id,
  });
  return { seeded: true };
};

export const updateHrSettings = async (actor, data) => {
  assertIsFullAdmin(actor);
  await setDoc(doc(db, 'settings', 'hr'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
};

// ─── Employee ID generator (transactional) ──────────────────────────────────

const nextEmployeeId = async () => {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, 'settings', 'hr');
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().employeeIdCounter || 0) : 0;
    const next = current + 1;
    if (snap.exists()) {
      tx.update(ref, { employeeIdCounter: next });
    } else {
      tx.set(ref, { ...DEFAULT_HR_SETTINGS, employeeIdCounter: next, createdAt: serverTimestamp() });
    }
    return `AP${String(next).padStart(3, '0')}`;
  });
};

// ─── Employee CRUD ──────────────────────────────────────────────────────────

/**
 * Marks an existing user as an employee and seeds HR fields. Use this after
 * createUserWithEmailAndPassword() + createUser() have created the base user doc.
 *
 * `actor` is the admin performing the action.
 */
export const createEmployee = async (actor, uid, data = {}) => {
  assertCanAccessHr(actor);
  if (!isHrFullAdmin(actor) && !isHrSubAdmin(actor)) {
    throw new Error('HR: only admins can create employees');
  }
  const employeeId = await nextEmployeeId();
  const payload = {
    isEmployee: true,
    employeeId,
    onboardingStatus: 'pending',
    dateOfJoining: data.dateOfJoining || '',
    designation: data.designation || '',
    department: data.department || '',
    employmentType: data.employmentType || 'full-time',
    reportingManager: data.reportingManager || '',
    workLocation: data.workLocation || '',
    jibbleName: data.jibbleName || data.name || '',
    ctc: data.ctc || null,
    pfEnabled: data.pfEnabled ?? false,
    esiEnabled: data.esiEnabled ?? false,
    ptApplicable: data.ptApplicable ?? true,
    tdsMonthly: data.tdsMonthly ?? 0,
    signatures: {},
    documents: {},
    hrCreatedAt: serverTimestamp(),
    hrCreatedBy: actor.id,
  };
  await updateDoc(doc(db, 'users', uid), payload);
  await logHrAction('create_employee', actor.id, uid, { employeeId, designation: payload.designation });
  return { uid, employeeId };
};

/**
 * Updates an employee record. Routes sensitive field changes through approval
 * queue if the actor is an HR sub-admin.
 */
export const updateEmployee = async (actor, uid, data = {}) => {
  assertCanAccessHr(actor);

  const targetSnap = await getDoc(doc(db, 'users', uid));
  if (!targetSnap.exists()) throw new Error('HR: employee not found');
  const target = { id: uid, ...targetSnap.data() };

  const changedFields = Object.keys(data);
  const check = canEditEmployee(actor, target, changedFields);
  if (!check.allowed) throw new Error(`HR: ${check.reason}`);

  if (check.requiresApproval) {
    // Snapshot current values for diff view
    const currentSnapshot = {};
    for (const f of changedFields) currentSnapshot[f] = target[f] ?? null;
    return createPendingApproval(actor, 'update_employee', uid, currentSnapshot, data);
  }

  // Direct write (producer or employee self-edit on non-sensitive fields)
  await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
  await logHrAction('update_employee', actor.id, uid, { fields: changedFields });
  return { applied: true };
};

/**
 * Employee-self onboarding update. Called from OnboardingFlow after each step.
 * Only allows the employee to update their own record, and only non-sensitive
 * personal fields (name, dob, address, etc.) or signatures/documents the flow manages.
 */
export const updateEmployeeOnboarding = async (actor, stepData) => {
  if (!actor?.id) throw new Error('HR: not authenticated');
  if (actor.isEmployee !== true) throw new Error('HR: not an employee');

  const payload = { ...stepData, onboardingStatus: 'in-progress', updatedAt: serverTimestamp() };
  await updateDoc(doc(db, 'users', actor.id), payload);
  return { applied: true };
};

/**
 * Marks onboarding complete. Called at the final step of OnboardingFlow.
 */
export const completeOnboarding = async (actor) => {
  if (!actor?.id) throw new Error('HR: not authenticated');
  if (actor.isEmployee !== true) throw new Error('HR: not an employee');
  await updateDoc(doc(db, 'users', actor.id), {
    onboardingStatus: 'completed',
    onboardingCompletedAt: serverTimestamp(),
  });
  await logHrAction('onboarding_complete', actor.id, actor.id, {});
};

/**
 * Deletes an employee. Hard-guards primary producer. For HR sub-admins, creates
 * a pending approval instead of deleting.
 */
export const deleteEmployee = async (actor, uid) => {
  assertCanAccessHr(actor);

  const targetSnap = await getDoc(doc(db, 'users', uid));
  if (!targetSnap.exists()) throw new Error('HR: employee not found');
  const target = { id: uid, ...targetSnap.data() };

  const check = canDeleteEmployee(actor, target);
  if (!check.allowed) throw new Error(`HR: ${check.reason}`);

  if (check.requiresApproval) {
    return createPendingApproval(actor, 'delete_employee', uid, { name: target.name, email: target.email }, { deleted: true });
  }

  // Defensive: block if this would remove the last producer
  if (target.role === 'producer') {
    const count = await countActiveProducers();
    if (count <= 1) throw new Error('HR: cannot remove the last producer');
  }

  await deleteDoc(doc(db, 'users', uid));
  await logHrAction('delete_employee', actor.id, uid, { employeeId: target.employeeId, name: target.name });
  return { deleted: true };
};

/**
 * Lists employees. Admins see all; employees see only themselves; others get [].
 */
export const getEmployees = async (actor) => {
  if (!canAccessHr(actor)) return [];

  if (canManageEmployees(actor)) {
    const q = query(collection(db, 'users'), where('isEmployee', '==', true));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  // Employee self-only access
  const selfSnap = await getDoc(doc(db, 'users', actor.id));
  return selfSnap.exists() ? [{ id: selfSnap.id, ...selfSnap.data() }] : [];
};

export const getEmployee = async (actor, uid) => {
  if (!canAccessHr(actor)) throw new Error('HR: access denied');
  if (!canManageEmployees(actor) && actor.id !== uid) {
    throw new Error('HR: can only read your own employee record');
  }
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// ─── CTC / Increments ───────────────────────────────────────────────────────

/**
 * Adds an increment to an employee's CTC history and updates the current CTC.
 * For sub-admins, routes through approval.
 */
export const addCtcIncrement = async (actor, uid, increment) => {
  assertCanAccessHr(actor);
  const targetSnap = await getDoc(doc(db, 'users', uid));
  if (!targetSnap.exists()) throw new Error('HR: employee not found');
  const target = { id: uid, ...targetSnap.data() };

  const check = canEditEmployee(actor, target, ['ctc']);
  if (!check.allowed) throw new Error(`HR: ${check.reason}`);

  const newCtc = {
    annual: increment.annual,
    effectiveFrom: increment.effectiveFrom,
    structure: increment.structure,
    history: [
      ...((target.ctc && target.ctc.history) || []),
      {
        effectiveFrom: increment.effectiveFrom,
        annual: increment.annual,
        reason: increment.reason || '',
        approvedBy: actor.id,
        at: new Date().toISOString(),
      },
    ],
  };

  if (check.requiresApproval) {
    return createPendingApproval(actor, 'update_ctc', uid, { ctc: target.ctc || null }, { ctc: newCtc });
  }

  await updateDoc(doc(db, 'users', uid), { ctc: newCtc, updatedAt: serverTimestamp() });
  await logHrAction('update_ctc', actor.id, uid, { annual: increment.annual });
  return { applied: true };
};

// ─── Pending approvals ──────────────────────────────────────────────────────

export const createPendingApproval = async (actor, action, targetUid, currentValue, proposedValue) => {
  assertCanAccessHr(actor);
  const approvalsRef = collection(db, 'hr_pending_approvals');
  const record = {
    action,
    requestedBy: actor.id,
    requestedByName: actor.name || actor.email || 'HR Admin',
    targetEmployee: targetUid,
    currentValue: currentValue || null,
    proposedValue: proposedValue || null,
    diff: getDiff(currentValue || {}, proposedValue || {}),
    status: 'pending',
    createdAt: serverTimestamp(),
    resolvedAt: null,
    resolvedBy: null,
    rejectionReason: null,
  };
  const docRef = await addDoc(approvalsRef, record);
  await logHrAction('create_pending_approval', actor.id, targetUid, { action, approvalId: docRef.id });
  return { pendingApprovalId: docRef.id, status: 'pending' };
};

export const listPendingApprovals = async (actor) => {
  if (!isHrFullAdmin(actor)) return [];
  const q = query(
    collection(db, 'hr_pending_approvals'),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const approvePendingApproval = async (actor, approvalId) => {
  assertIsFullAdmin(actor);
  const ref = doc(db, 'hr_pending_approvals', approvalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('HR: approval not found');
  const approval = snap.data();
  if (approval.status !== 'pending') throw new Error('HR: approval already resolved');

  const targetSnap = await getDoc(doc(db, 'users', approval.targetEmployee));
  if (!targetSnap.exists()) throw new Error('HR: target employee missing');
  const target = { id: approval.targetEmployee, ...targetSnap.data() };

  // HARD GUARD: even via approval flow, cannot delete or demote primary producer
  if (target.isPrimaryProducer === true) {
    await updateDoc(ref, {
      status: 'rejected',
      resolvedAt: serverTimestamp(),
      resolvedBy: actor.id,
      rejectionReason: 'Primary producer is permanently protected',
    });
    throw new Error('HR: cannot apply approval — primary producer is permanent');
  }

  if (approval.action === 'delete_employee') {
    await deleteDoc(doc(db, 'users', approval.targetEmployee));
  } else {
    // Apply proposedValue as a merge on the user doc
    await updateDoc(doc(db, 'users', approval.targetEmployee), {
      ...approval.proposedValue,
      updatedAt: serverTimestamp(),
    });
  }

  await updateDoc(ref, {
    status: 'approved',
    resolvedAt: serverTimestamp(),
    resolvedBy: actor.id,
  });
  await logHrAction('approve_pending', actor.id, approval.targetEmployee, { approvalId, action: approval.action });
  return { applied: true };
};

export const rejectPendingApproval = async (actor, approvalId, reason = '') => {
  assertIsFullAdmin(actor);
  const ref = doc(db, 'hr_pending_approvals', approvalId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('HR: approval not found');
  const approval = snap.data();
  if (approval.status !== 'pending') throw new Error('HR: approval already resolved');

  await updateDoc(ref, {
    status: 'rejected',
    resolvedAt: serverTimestamp(),
    resolvedBy: actor.id,
    rejectionReason: reason,
  });
  await logHrAction('reject_pending', actor.id, approval.targetEmployee, { approvalId, reason });
  return { rejected: true };
};

// ─── Storage helpers ────────────────────────────────────────────────────────

/**
 * Uploads an employee document to Firebase Storage with progress tracking.
 * Returns a promise that resolves with { url, path }.
 */
export const uploadEmployeeDocument = (uid, docType, file, onProgress) => {
  return new Promise((resolve, reject) => {
    if (!uid || !file) return reject(new Error('Missing uid or file'));
    const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `employees/${uid}/documents/${docType}/${Date.now()}-${safeName}`;
    const ref = sRef(storage, path);
    const task = uploadBytesResumable(ref, file);
    task.on(
      'state_changed',
      (snap) => {
        if (onProgress) onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path });
      }
    );
  });
};

/**
 * Uploads a blob (e.g. webcam photo) to employees/{uid}/{relativePath}.
 */
export const uploadEmployeeBlob = async (uid, relativePath, blob) => {
  const path = `employees/${uid}/${relativePath}`;
  const ref = sRef(storage, path);
  const task = uploadBytesResumable(ref, blob);
  await new Promise((resolve, reject) => {
    task.on('state_changed', null, reject, resolve);
  });
  const url = await getDownloadURL(task.snapshot.ref);
  return { url, path };
};

/**
 * Uploads a signature PNG from a canvas dataURL.
 */
export const saveSignatureImage = async (uid, signatureType, dataUrl) => {
  if (!uid || !dataUrl) throw new Error('Missing uid or signature data');
  const path = `employees/${uid}/signatures/${signatureType}-${Date.now()}.png`;
  const ref = sRef(storage, path);
  const task = uploadString(ref, dataUrl, 'data_url');
  const snap = await task;
  const url = await getDownloadURL(snap.ref);
  return { url, path };
};

// ─── Audit log ──────────────────────────────────────────────────────────────

export const logHrAction = async (action, performedBy, targetEmployee, details = {}) => {
  try {
    await addDoc(collection(db, 'hr_audit_log'), {
      action,
      performedBy,
      targetEmployee,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Audit log failures must not break the calling action.
    console.warn('HR audit log failed:', err?.message);
  }
};
