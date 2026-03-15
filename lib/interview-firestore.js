import { db } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, serverTimestamp, addDoc
} from 'firebase/firestore';

// ─── Job Links ────────────────────────────────────────────────────────────────

export const createJobLink = async (position, createdBy) => {
  const token = Math.random().toString(36).substr(2, 8) + Date.now().toString(36);
  const id = doc(collection(db, 'job_links')).id;
  const data = {
    id,
    token,
    position,
    createdBy,
    active: true,
    createdAt: serverTimestamp(),
    interviewCount: 0,
  };
  await setDoc(doc(db, 'job_links', id), data);
  return { ...data, createdAt: new Date().toISOString() };
};

export const getJobLinkByToken = async (token) => {
  const q = query(collection(db, 'job_links'), where('token', '==', token), where('active', '==', true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

export const getAllJobLinks = async () => {
  const snap = await getDocs(collection(db, 'job_links'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const deactivateJobLink = async (id) => {
  await updateDoc(doc(db, 'job_links', id), { active: false });
};

// ─── Interviews ───────────────────────────────────────────────────────────────

export const createInterview = async (data) => {
  const ref = doc(collection(db, 'interviews'));
  const interview = {
    ...data,
    id: ref.id,
    messages: [],
    status: 'in_progress',
    score: null,
    adminAction: null,
    createdAt: serverTimestamp(),
    completedAt: null,
  };
  await setDoc(ref, interview);

  // Increment job link counter
  if (data.jobLinkId) {
    const linkRef = doc(db, 'job_links', data.jobLinkId);
    const linkSnap = await getDoc(linkRef);
    if (linkSnap.exists()) {
      await updateDoc(linkRef, { interviewCount: (linkSnap.data().interviewCount || 0) + 1 });
    }
  }

  return { ...interview, id: ref.id, createdAt: new Date().toISOString() };
};

export const getInterview = async (id) => {
  const snap = await getDoc(doc(db, 'interviews', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateInterviewMessages = async (id, messages) => {
  await updateDoc(doc(db, 'interviews', id), { messages });
};

export const completeInterview = async (id, score) => {
  await updateDoc(doc(db, 'interviews', id), {
    status: 'completed',
    score,
    completedAt: serverTimestamp(),
  });
};

export const getAllInterviews = async () => {
  const q = query(collection(db, 'interviews'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getInterviewsByStatus = async (status) => {
  const q = query(collection(db, 'interviews'), where('status', '==', status));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const setAdminAction = async (id, action) => {
  await updateDoc(doc(db, 'interviews', id), {
    adminAction: action,
    adminActionAt: serverTimestamp(),
    status: action === 'approved' ? 'approved' : 'rejected',
  });
};
