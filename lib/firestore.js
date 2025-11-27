import { db } from './firebase';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

export const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
export const generateShareToken = () => Math.random().toString(36).substr(2, 12) + Date.now().toString(36);

export const TEAM_ROLES = {
  'photo-editor': { label: 'Photo Editor', icon: '🖼️', color: '#ec4899' },
  'video-editor': { label: 'Video Editor', icon: '🎬', color: '#f97316' },
  'colorist': { label: 'Colorist', icon: '🎨', color: '#a855f7' },
  'vfx-artist': { label: 'VFX Artist', icon: '✨', color: '#10b981' },
  'sound-designer': { label: 'Sound Designer', icon: '🔊', color: '#06b6d4' },
  'motion-designer': { label: 'Motion Designer', icon: '🎭', color: '#6366f1' },
  'cgi-artist': { label: 'CGI Artist', icon: '🌐', color: '#3b82f6' },
};

export const CORE_ROLES = {
  'producer': { label: 'Producer', icon: '👑', color: '#f59e0b' },
  'admin': { label: 'Admin', icon: '⚙️', color: '#ef4444' },
  'team-lead': { label: 'Team Lead', icon: '🎯', color: '#8b5cf6' },
  'coordinator': { label: 'Coordinator', icon: '📋', color: '#22c55e' },
};

export const STATUS = {
  'pending': { label: 'Pending', bg: '#fef3c7', color: '#92400e' },
  'selected': { label: 'Selected', bg: '#dbeafe', color: '#1e40af' },
  'assigned': { label: 'Assigned', bg: '#e0e7ff', color: '#3730a3' },
  'in-progress': { label: 'In Progress', bg: '#fae8ff', color: '#86198f' },
  'review-ready': { label: 'Review Ready', bg: '#fef3c7', color: '#92400e' },
  'changes-requested': { label: 'Changes', bg: '#fee2e2', color: '#991b1b' },
  'approved': { label: 'Approved', bg: '#d1fae5', color: '#065f46' },
  'delivered': { label: 'Delivered', bg: '#cffafe', color: '#155e75' },
};

export const createUser = async (uid, data) => { const ref = doc(db, 'users', uid); await setDoc(ref, { ...data, id: uid, createdAt: serverTimestamp() }); return { id: uid, ...data }; };
export const getUser = async (uid) => { const snap = await getDoc(doc(db, 'users', uid)); return snap.exists() ? { id: snap.id, ...snap.data() } : null; };
export const getUsers = async () => { const snap = await getDocs(collection(db, 'users')); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };
export const updateUser = async (uid, data) => { await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }); };
export const deleteUser = async (uid) => { await deleteDoc(doc(db, 'users', uid)); };
export const getFreelancers = async () => { const q = query(collection(db, 'users'), where('isFreelancer', '==', true)); const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };
export const getClients = async () => { const q = query(collection(db, 'users'), where('isClient', '==', true)); const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };
export const getCoreTeam = async () => { const q = query(collection(db, 'users'), where('isCore', '==', true)); const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };

export const createProject = async (data) => { const id = generateId(); const ref = doc(db, 'projects', id); const proj = { ...data, id, shareLinks: [], createdAt: serverTimestamp() }; await setDoc(ref, proj); return proj; };
export const getProjects = async () => { const snap = await getDocs(collection(db, 'projects')); return snap.docs.map(d => ({ id: d.id, ...d.data() })); };
export const getProject = async (id) => { const snap = await getDoc(doc(db, 'projects', id)); return snap.exists() ? { id: snap.id, ...snap.data() } : null; };
export const updateProject = async (id, data) => { await updateDoc(doc(db, 'projects', id), { ...data, updatedAt: serverTimestamp() }); };
export const deleteProject = async (id) => { await deleteDoc(doc(db, 'projects', id)); };
export const getProjectsForUser = async (userId, role) => {
  if (['producer', 'admin', 'team-lead'].includes(role)) return getProjects();
  const all = await getProjects();
  return all.filter(p => p.assignedTeam?.some(t => t.odId === userId) || p.clientContacts?.some(c => c.odId === userId) || p.createdBy === userId);
};

export const createShareLink = async (projectId, data) => {
  const token = generateShareToken();
  const link = { id: generateId(), token, projectId, ...data, createdAt: new Date().toISOString(), active: true };
  const proj = await getProject(projectId);
  await updateProject(projectId, { shareLinks: [...(proj.shareLinks || []), link] });
  return link;
};

export const getProjectByShareToken = async (token) => {
  const all = await getProjects();
  for (const p of all) {
    const link = (p.shareLinks || []).find(l => l.token === token && l.active);
    if (link) return { project: p, link };
  }
  return null;
};

export const deactivateShareLink = async (projectId, linkId) => {
  const proj = await getProject(projectId);
  await updateProject(projectId, { shareLinks: (proj.shareLinks || []).map(l => l.id === linkId ? { ...l, active: false } : l) });
};

export const getSettings = async () => { const snap = await getDoc(doc(db, 'settings', 'app')); return snap.exists() ? snap.data() : null; };
export const saveSettings = async (data) => { await setDoc(doc(db, 'settings', 'app'), { ...data, updatedAt: serverTimestamp() }); };
