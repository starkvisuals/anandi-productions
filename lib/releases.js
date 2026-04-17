// lib/releases.js — Firestore CRUD for release campaigns + submissions.

import { db, storage } from './firebase';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from 'firebase/firestore';
import { ref as sRef, uploadBytesResumable, uploadString, getDownloadURL } from 'firebase/storage';

// ─── Campaign CRUD ──────────────────────────────────────────────────────────

const campaignsRef = () => collection(db, 'release_campaigns');

const generateCampaignId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

export const createCampaign = async (actor, label) => {
  if (!actor?.id) throw new Error('Not authenticated');
  const id = generateCampaignId();
  await setDoc(doc(db, 'release_campaigns', id), {
    label: label.trim(),
    createdAt: serverTimestamp(),
    createdBy: actor.id,
    createdByName: actor.name || actor.email || '',
    projectId: null,
    submissionCount: 0,
    status: 'active', // active | archived
  });
  return { id, label: label.trim() };
};

export const getCampaigns = async () => {
  const snap = await getDocs(query(campaignsRef(), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getCampaign = async (campaignId) => {
  const snap = await getDoc(doc(db, 'release_campaigns', campaignId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const updateCampaign = async (campaignId, data) => {
  await updateDoc(doc(db, 'release_campaigns', campaignId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const archiveCampaign = async (campaignId) => {
  await updateCampaign(campaignId, { status: 'archived' });
};

// ─── Submission CRUD ────────────────────────────────────────────────────────

const submissionsRef = (campaignId) =>
  collection(db, 'release_campaigns', campaignId, 'submissions');

export const createSubmission = async (campaignId, data) => {
  // Public — no auth check. Validate campaign exists.
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error('Invalid release link');
  if (campaign.status !== 'active') throw new Error('This release form is no longer accepting submissions');

  const docRef = await addDoc(submissionsRef(campaignId), {
    ...data,
    submittedAt: serverTimestamp(),
  });

  // Increment submission count
  await updateDoc(doc(db, 'release_campaigns', campaignId), {
    submissionCount: (campaign.submissionCount || 0) + 1,
  });

  return { id: docRef.id };
};

export const getSubmissions = async (campaignId) => {
  const snap = await getDocs(query(submissionsRef(campaignId), orderBy('submittedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getSubmission = async (campaignId, submissionId) => {
  const snap = await getDoc(doc(db, 'release_campaigns', campaignId, 'submissions', submissionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

export const deleteSubmission = async (campaignId, submissionId) => {
  await deleteDoc(doc(db, 'release_campaigns', campaignId, 'submissions', submissionId));
};

// ─── Storage helpers ────────────────────────────────────────────────────────

export const uploadReleasePhoto = async (campaignId, file) => {
  const path = `releases/${campaignId}/${Date.now()}-photo.jpg`;
  const ref = sRef(storage, path);
  const task = uploadBytesResumable(ref, file);
  await new Promise((resolve, reject) => {
    task.on('state_changed', null, reject, resolve);
  });
  const url = await getDownloadURL(task.snapshot.ref);
  return { url, path };
};

export const uploadReleaseSignature = async (campaignId, dataUrl) => {
  const path = `releases/${campaignId}/${Date.now()}-signature.png`;
  const ref = sRef(storage, path);
  const snap = await uploadString(ref, dataUrl, 'data_url');
  const url = await getDownloadURL(snap.ref);
  return { url, path };
};
