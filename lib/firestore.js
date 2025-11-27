import { db, storage } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

// ============ USERS ============

export const getUsers = async () => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUsersByRole = async (role) => {
  const q = query(collection(db, 'users'), where('role', '==', role));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getFreelancers = async () => {
  const q = query(collection(db, 'users'), where('isFreelancer', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getClients = async () => {
  const q = query(collection(db, 'users'), where('isClient', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getCoreTeam = async () => {
  const q = query(collection(db, 'users'), where('isCore', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getUser = async (userId) => {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const createUser = async (userId, userData) => {
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    createdAt: new Date().toISOString(),
  });
  return { id: userId, ...userData };
};

export const updateUser = async (userId, updates) => {
  await updateDoc(doc(db, 'users', userId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteUser = async (userId) => {
  await deleteDoc(doc(db, 'users', userId));
};

// ============ PROJECTS ============

export const getProjects = async () => {
  const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getProject = async (projectId) => {
  const docSnap = await getDoc(doc(db, 'projects', projectId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const getProjectsForUser = async (userId, userRole, isClient, isFreelancer) => {
  const projects = await getProjects();
  
  if (['producer', 'admin', 'team-lead'].includes(userRole)) {
    return projects;
  }
  
  if (isClient) {
    return projects.filter(p => p.clientContacts?.some(c => c.odId === userId));
  }
  
  if (isFreelancer) {
    return projects.filter(p => p.assignedTeam?.some(t => t.odId === userId));
  }
  
  return [];
};

export const createProject = async (projectData) => {
  const projectRef = doc(collection(db, 'projects'));
  const project = {
    ...projectData,
    id: projectRef.id,
    createdAt: new Date().toISOString(),
    categories: projectData.categories || getDefaultCategories(),
    assignedTeam: projectData.assignedTeam || [],
    clientContacts: projectData.clientContacts || [],
    assets: [],
    shareLinks: [],
    activityLog: [],
    downloadRequests: [],
  };
  await setDoc(projectRef, project);
  return project;
};

export const updateProject = async (projectId, updates) => {
  await updateDoc(doc(db, 'projects', projectId), {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
};

export const deleteProject = async (projectId) => {
  await deleteDoc(doc(db, 'projects', projectId));
};

// ============ ASSETS ============

export const addAssetToProject = async (projectId, assetData) => {
  const project = await getProject(projectId);
  const newAsset = {
    ...assetData,
    id: generateId(),
    uploadedAt: new Date().toISOString(),
    versions: assetData.versions || [],
    feedback: [],
    currentVersion: 0,
  };
  
  await updateDoc(doc(db, 'projects', projectId), {
    assets: [...(project.assets || []), newAsset],
  });
  
  return newAsset;
};

export const updateAsset = async (projectId, assetId, updates) => {
  const project = await getProject(projectId);
  const updatedAssets = project.assets.map(a => 
    a.id === assetId ? { ...a, ...updates, updatedAt: new Date().toISOString() } : a
  );
  
  await updateDoc(doc(db, 'projects', projectId), {
    assets: updatedAssets,
  });
};

export const deleteAsset = async (projectId, assetId) => {
  const project = await getProject(projectId);
  const updatedAssets = project.assets.filter(a => a.id !== assetId);
  
  await updateDoc(doc(db, 'projects', projectId), {
    assets: updatedAssets,
  });
};

// ============ FILE UPLOAD ============

export const uploadFile = async (file, path) => {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(snapshot.ref);
  return downloadURL;
};

export const uploadAssetFile = async (projectId, file, metadata) => {
  const fileName = `${Date.now()}-${file.name}`;
  const path = `projects/${projectId}/assets/${fileName}`;
  const url = await uploadFile(file, path);
  
  return {
    url,
    fileName,
    path,
    size: file.size,
    type: file.type,
  };
};

export const deleteFile = async (path) => {
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
};

// ============ ACTIVITY LOG ============

export const addActivityLog = async (projectId, activity) => {
  const project = await getProject(projectId);
  const newActivity = {
    id: generateId(),
    ...activity,
    timestamp: new Date().toISOString(),
  };
  
  await updateDoc(doc(db, 'projects', projectId), {
    activityLog: [...(project.activityLog || []), newActivity],
  });
};

// ============ CATEGORIES ============

export const getDefaultCategories = () => [
  { id: 'cgi', name: 'CGI', icon: '🌐', color: '#3b82f6', allowedRoles: ['3d-artist', 'cgi'] },
  { id: 'animation', name: 'Animated Film', icon: '🎭', color: '#a855f7', allowedRoles: ['animator', 'motion-graphics'] },
  { id: 'statics', name: 'Statics', icon: '🖼️', color: '#ec4899', allowedRoles: ['photo-editor'] },
  { id: 'videos', name: 'Videos', icon: '🎬', color: '#f97316', allowedRoles: ['video-editor', 'colorist', 'grader'] },
  { id: 'vfx', name: 'VFX', icon: '✨', color: '#10b981', allowedRoles: ['vfx-artist'] },
  { id: 'audio', name: 'Audio', icon: '🔊', color: '#06b6d4', allowedRoles: ['sound-designer'] },
];

export const addCategoryToProject = async (projectId, category) => {
  const project = await getProject(projectId);
  const newCategory = {
    ...category,
    id: `cat-${Date.now()}`,
    isCustom: true,
  };
  
  await updateDoc(doc(db, 'projects', projectId), {
    categories: [...(project.categories || []), newCategory],
  });
  
  return newCategory;
};

// ============ TEAM MANAGEMENT ============

export const addTeamMember = async (projectId, memberId, role) => {
  const project = await getProject(projectId);
  const newMember = { odId: memberId, odRole: role };
  
  await updateDoc(doc(db, 'projects', projectId), {
    assignedTeam: [...(project.assignedTeam || []), newMember],
  });
};

export const removeTeamMember = async (projectId, memberId) => {
  const project = await getProject(projectId);
  const updatedTeam = project.assignedTeam.filter(t => t.odId !== memberId);
  
  await updateDoc(doc(db, 'projects', projectId), {
    assignedTeam: updatedTeam,
  });
};

export const addClientContact = async (projectId, clientId, isPrimary = false) => {
  const project = await getProject(projectId);
  const newContact = { odId: clientId, isPrimary };
  
  await updateDoc(doc(db, 'projects', projectId), {
    clientContacts: [...(project.clientContacts || []), newContact],
  });
};

// ============ HELPERS ============

export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const generateInviteToken = () => Math.random().toString(36).substr(2, 12);

// ============ ROLE DEFINITIONS ============

export const TEAM_ROLES = {
  'photo-editor': { label: 'Photo Editor', icon: '🖼️', color: '#ec4899' },
  'video-editor': { label: 'Video Editor', icon: '🎬', color: '#8b5cf6' },
  'colorist': { label: 'Colorist', icon: '🎨', color: '#f59e0b' },
  'grader': { label: 'Grader', icon: '🌈', color: '#f97316' },
  'vfx-artist': { label: 'VFX Artist', icon: '✨', color: '#10b981' },
  '3d-artist': { label: '3D Artist', icon: '🌐', color: '#3b82f6' },
  'animator': { label: 'Animator', icon: '🎭', color: '#06b6d4' },
  'motion-graphics': { label: 'Motion Graphics', icon: '📊', color: '#a855f7' },
  'sound-designer': { label: 'Sound Designer', icon: '🔊', color: '#64748b' },
};

export const CORE_ROLES = {
  'producer': { label: 'Producer', icon: '👑', color: '#f97316', accessAll: true },
  'admin': { label: 'Admin', icon: '⚙️', color: '#6366f1', accessAll: true },
  'team-lead': { label: 'Team Lead', icon: '👔', color: '#8b5cf6', accessAll: true },
  'project-lead': { label: 'Project Lead', icon: '📋', color: '#3b82f6', accessAll: true },
};

export const STATUS = {
  pending: { label: 'Pending', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  assigned: { label: 'Assigned', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  'in-progress': { label: 'In Progress', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  'review-ready': { label: 'Needs Review', color: '#a855f7', bg: 'rgba(168,85,247,0.15)' },
  'feedback-pending': { label: 'Feedback Given', color: '#ec4899', bg: 'rgba(236,72,153,0.15)' },
  revisions: { label: 'Revisions', color: '#eab308', bg: 'rgba(234,179,8,0.15)' },
  approved: { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  completed: { label: 'Completed', color: '#22c55e', bg: 'rgba(34,197,94,0.2)' },
};
