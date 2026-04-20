'use client';
import { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProjects, getProject, getProjectsForUser, createProject, updateProject, deleteProject, getUsers, getFreelancers, getClients, getCoreTeam, createUser, deleteUser, createShareLink, TEAM_ROLES, CORE_ROLES, STATUS, generateId } from '@/lib/firestore';
import { useKeyboardShortcuts, SHORTCUT_GROUPS } from '@/lib/useKeyboardShortcuts';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';
import CreateProjectModal from './CreateProjectModal';
import dynamic from 'next/dynamic';
import { canAccessHr, canManageEmployees, isHrFullAdmin, ensurePrimaryProducerExists, listPendingApprovals } from '@/lib/hr';
import EmployeeModule from './hr/EmployeeModule';
import ReleasesModule from './releases/ReleasesModule';
import OnboardingFlow from './hr/OnboardingFlow';
import AnnotationCanvas from './AnnotationCanvas';
import ComparePanel from './ComparePanel';

// Dynamic import MuxPlayer to avoid SSR issues
const MuxPlayer = dynamic(() => import('./MuxPlayer'), { ssr: false });

// Mux Helper Functions
const uploadToMux = async (file, projectId, assetId) => {
  try {
    // Get direct upload URL from our API
    const response = await fetch('/api/mux/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, assetId, filename: file.name })
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to get upload URL');
    }
    
    const { uploadUrl, uploadId } = data;
    
    if (!uploadUrl) {
      throw new Error('No upload URL returned from Mux');
    }
    
    // Upload file directly to Mux
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });
    
    if (!uploadResponse.ok) throw new Error('Failed to upload to Mux');
    
    return { uploadId, success: true };
  } catch (error) {
    console.error('Mux upload error:', error);
    return { error: error.message, success: false };
  }
};

const checkMuxUploadStatus = async (uploadId) => {
  try {
    const response = await fetch(`/api/mux/upload?uploadId=${uploadId}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Mux status check error:', error);
    return { success: false, error: error.message };
  }
};

// Get Mux thumbnail URL
const getMuxThumbnail = (playbackId, options = {}) => {
  if (!playbackId) return null;
  const { time = 0, width = 640 } = options;
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=${time}&width=${width}`;
};

// Theme Context
const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

// Theme definitions
const THEMES = {
  dark: {
    bg: '#0a0a0f',
    bgSecondary: '#111118',
    bgTertiary: '#18181f',
    bgCard: '#1e1e28',
    bgInput: '#0d0d12',
    bgHover: '#252530',
    border: '#2a2a3a',
    borderLight: '#1e1e2e',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.4)',
    primary: '#6366f1',
    primaryHover: '#5558dd',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    accent: '#a855f7',
    modalBg: '#14141c',
    shadow: '0 8px 32px rgba(0,0,0,0.5)',
    // Glassmorphic tokens
    bgGlass: 'rgba(30,30,45,0.7)',
    bgGlassBorder: 'rgba(255,255,255,0.08)',
    blur: 'blur(16px)',
    cardRadius: '16px',
    shadowGlass: '0 4px 24px rgba(0,0,0,0.2)',
    gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    gradientSuccess: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    gradientDanger: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  },
  light: {
    bg: '#f5f7fa',
    bgSecondary: '#ffffff',
    bgTertiary: '#f0f2f5',
    bgCard: '#ffffff',
    bgInput: '#f8f9fb',
    bgHover: '#e8eaed',
    border: '#e0e3e8',
    borderLight: '#ebedf0',
    text: '#111827',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    primary: '#6366f1',
    primaryHover: '#5558dd',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    accent: '#9333ea',
    modalBg: '#ffffff',
    shadow: '0 8px 32px rgba(0,0,0,0.1)',
    // Glassmorphic tokens
    bgGlass: 'rgba(255,255,255,0.7)',
    bgGlassBorder: 'rgba(0,0,0,0.06)',
    blur: 'blur(16px)',
    cardRadius: '16px',
    shadowGlass: '0 4px 24px rgba(0,0,0,0.06)',
    gradientPrimary: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    gradientSuccess: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
    gradientDanger: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  }
};

// SVG Icons (Lucide-style)
const Icons = {
  dashboard: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  tasks: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  folder: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  calendar: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  search: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  sun: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  logout: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevronLeft: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>,
  chevronRight: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,6 15,12 9,18"/></svg>,
  menu: (color) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  plus: (color) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  upload: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  share: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  settings: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  edit: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  grid: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  kanban: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="8" rx="1"/></svg>,
  play: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5,3 19,12 5,21 5,3"/></svg>,
  image: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg>,
  video: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><polygon points="10,9 15,12 10,15 10,9"/></svg>,
  file: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  clock: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
  check: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>,
  alert: (color) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  star: (color, filled) => <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/></svg>,
  eye: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  download: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  link: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
  message: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  refresh: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23,4 23,10 17,10"/><polyline points="1,20 1,14 7,14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
  copy: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  filter: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46 22,3"/></svg>,
  user: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  cgi: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>,
  animation: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
  vfx: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  audio: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>,
  document: (color) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>,
};

const DEFAULT_CATEGORIES = [
  { id: 'cgi', name: 'CGI', icon: 'cgi', color: '#3b82f6' },
  { id: 'animation', name: 'Animation', icon: 'animation', color: '#a855f7' },
  { id: 'statics', name: 'Statics', icon: 'image', color: '#ec4899' },
  { id: 'videos', name: 'Videos', icon: 'video', color: '#f97316' },
  { id: 'vfx', name: 'VFX', icon: 'vfx', color: '#10b981' },
  { id: 'audio', name: 'Audio', icon: 'audio', color: '#06b6d4' },
];

// Project Templates
const PROJECT_TEMPLATES = [
  { id: 'photoshoot-basic', name: 'Basic Photoshoot', type: 'photoshoot', categories: ['statics'], description: 'Simple photoshoot with statics only' },
  { id: 'photoshoot-full', name: 'Full Photoshoot', type: 'photoshoot', categories: ['statics', 'videos'], description: 'Photoshoot with BTS videos' },
  { id: 'ad-film', name: 'Ad Film', type: 'ad-film', categories: ['videos', 'vfx', 'audio', 'cgi'], description: 'Full ad film production' },
  { id: 'product-video', name: 'Product Video', type: 'product-video', categories: ['videos', 'cgi'], description: 'Product showcase video' },
  { id: 'social-media', name: 'Social Media Pack', type: 'social-media', categories: ['statics', 'videos'], description: 'Social media content package' },
  { id: 'toolkit', name: 'Brand Toolkit', type: 'toolkit', categories: ['statics', 'videos', 'cgi', 'animation'], description: 'Complete brand toolkit' },
  { id: 'reels', name: 'Reels/Shorts', type: 'reels', categories: ['videos'], description: 'Short-form vertical content' },
];

const ASPECT_RATIOS = { landscape: 16/10, square: 1, portrait: 10/16 };
const CARD_SIZES = { S: 160, M: 220, L: 300 };

const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };

/**
 * Recursively reads a FileSystemEntry (file or directory) from a drag-and-drop event.
 * Returns a flat array of File objects, each with webkitRelativePath set to its path
 * relative to the top-level dropped item (e.g. "7up/img001.jpg").
 */
async function readFolderEntry(entry, parentPath = '') {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file(file => {
        const fullPath = parentPath ? `${parentPath}/${file.name}` : file.name;
        try {
          Object.defineProperty(file, 'webkitRelativePath', { value: fullPath, writable: false, configurable: true });
        } catch (_) {}
        resolve([file]);
      }, () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const allEntries = [];
    // readEntries returns max 100 items at a time — loop until empty
    await new Promise(resolve => {
      const readBatch = () => reader.readEntries(batch => {
        if (!batch.length) return resolve();
        allEntries.push(...batch);
        readBatch();
      }, () => resolve());
      readBatch();
    });
    const childPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
    const nested = await Promise.all(allEntries.map(e => readFolderEntry(e, childPath)));
    return nested.flat();
  }
  return [];
}
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const formatDuration = s => { if (!s) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };
// Professional timecode format (HH:MM:SS:FF at 24fps)
const formatTimecode = (seconds, fps = 24) => {
  if (!seconds && seconds !== 0) return '00:00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * fps);
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}:${f.toString().padStart(2,'0')}`;
};
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; if (f.type?.startsWith('audio/')) return 'audio'; return 'other'; };
const isNewVersion = (uploadedAt) => { if (!uploadedAt) return false; const hours = (Date.now() - new Date(uploadedAt).getTime()) / (1000 * 60 * 60); return hours < 24; };
const isRecent = (timestamp, hours = 24) => { if (!timestamp) return false; return (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60) < hours; };

// Get base name without extension and version suffix for auto-matching
const getBaseName = (filename) => {
  // Remove extension
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  // Remove common version suffixes like _v2, -v3, _final, _edit, etc.
  return withoutExt.replace(/[-_](v\d+|final|edit|edited|revised|rev\d*|r\d+)$/i, '').toLowerCase().trim();
};

// Find matching asset by filename
const findMatchingAsset = (filename, assets) => {
  const baseName = getBaseName(filename);
  return assets.find(a => !a.deleted && getBaseName(a.name) === baseName);
};

// Generate optimized thumbnail from image file (smaller for grid)
const generateThumbnail = (file, maxSize = 300) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        // Make it square crop from center for consistent grid
        const size = Math.min(w, h);
        const sx = (w - size) / 2;
        const sy = (h - size) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);
        canvas.toBlob(resolve, 'image/jpeg', 0.6); // Lower quality for faster load
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// Generate preview image (larger but still optimized for lightbox)
const generatePreview = (file, maxSize = 1200) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
        else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(resolve, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

// Generate video thumbnail from first frame
const generateVideoThumbnail = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadeddata = () => {
      video.currentTime = 1; // Skip to 1 second
    };
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 400;
      let w = video.videoWidth, h = video.videoHeight;
      if (w > h) { if (w > maxSize) { h = h * maxSize / w; w = maxSize; } }
      else { if (h > maxSize) { w = w * maxSize / h; h = maxSize; } }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', 0.7);
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  });
};

// LazyImage with Intersection Observer - loads only when visible
const LazyImage = ({ src, thumbnail, alt = '', style = {}, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const imgRef = useRef(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '300px' } // Load even earlier
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);
  
  // Use thumbnail for grid view, full src for modal
  const displaySrc = thumbnail || src;
  
  return (
    <div ref={imgRef} style={{ ...style, position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      {/* Shimmer Skeleton */}
      {!loaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #1a1a2e 25%, #252538 50%, #1a1a2e 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {Icons.image && Icons.image('rgba(255,255,255,0.15)')}
        </div>
      )}
      {inView && (
        <img 
          src={displaySrc}
          alt={alt}
          loading="eager"
          decoding="async"
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s ease-out' }}
        />
      )}
    </div>
  );
};

// Skeleton Loader Component (theme-aware)
const Skeleton = ({ width = '100%', height = 20, borderRadius = 4, style = {}, theme = 'dark' }) => {
  const st = THEMES[theme] || THEMES.dark;
  return (
    <div style={{
      width,
      height,
      borderRadius,
      background: theme === 'light'
        ? `linear-gradient(90deg, ${st.bgTertiary} 25%, ${st.bgHover} 50%, ${st.bgTertiary} 75%)`
        : `linear-gradient(90deg, ${st.bgTertiary} 25%, ${st.bgHover} 50%, ${st.bgTertiary} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
      ...style
    }} />
  );
};

// Card Skeleton for loading states (theme-aware)
const CardSkeleton = ({ aspectRatio = 1, theme = 'dark' }) => {
  const t = THEMES[theme];
  return (
    <div style={{
      background: t.bgCard,
      borderRadius: '12px',
      overflow: 'hidden',
      border: `1px solid ${t.border}`
    }}>
      <div style={{ paddingBottom: `${aspectRatio * 100}%`, position: 'relative' }}>
        <Skeleton theme={theme} width="100%" height="100%" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
      </div>
      <div style={{ padding: '12px' }}>
        <Skeleton theme={theme} width="70%" height={14} style={{ marginBottom: 8 }} />
        <Skeleton theme={theme} width="40%" height={10} />
      </div>
    </div>
  );
};

const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const RoleBadge = ({ role }) => { const r = TEAM_ROLES[role] || CORE_ROLES[role] || { label: role, color: '#6366f1' }; return <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>{r.icon || ''} {r.label}</span>; };
const Avatar = ({ user, size = 32 }) => {
  const c = (TEAM_ROLES[user?.role] || CORE_ROLES[user?.role])?.color || '#6366f1';
  // Prefer an explicit uploaded photo from the HR documents map, then fall
  // back to a non-URL avatar (emoji/letter). If `avatar` accidentally contains
  // a URL (legacy data), render it as an image so we never leak raw text.
  const photoUrl = user?.documents?.profilePhoto?.url
    || (typeof user?.avatar === 'string' && /^https?:\/\//.test(user.avatar) ? user.avatar : null);
  const avatarText = !photoUrl && typeof user?.avatar === 'string' && !/^https?:\/\//.test(user.avatar)
    ? user.avatar
    : (user?.firstName?.[0] || '?');
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: photoUrl
        ? `url(${photoUrl}) center/cover`
        : `linear-gradient(135deg, ${c}40, ${c}20)`,
      border: `2px solid ${c}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.4,
      flexShrink: 0,
      color: '#fff',
      fontWeight: 600,
      overflow: 'hidden',
    }}>
      {!photoUrl && avatarText}
    </div>
  );
};

// Notification Badge Component
const NotifBadge = ({ count, icon, color, title }) => count > 0 ? (
  <span title={title} style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600', background: color, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
    {icon} {count}
  </span>
) : null;

// Get project notifications
const getProjectNotifs = (project) => {
  const assets = project.assets || [];
  const newUploads = assets.filter(a => isRecent(a.uploadedAt, 24)).length;
  const pendingReview = assets.filter(a => a.status === 'review-ready').length;
  const newFeedback = assets.reduce((count, a) => count + (a.feedback || []).filter(f => isRecent(f.timestamp, 24)).length, 0);
  const changesRequested = assets.filter(a => a.status === 'changes-requested').length;
  const newVersions = assets.filter(a => { const v = a.versions || []; return v.length > 1 && isRecent(v[v.length - 1].uploadedAt, 24); }).length;
  return { newUploads, pendingReview, newFeedback, changesRequested, newVersions };
};

// Full Screen Image/Video Modal
const Modal = ({ title, onClose, children, wide, size, theme = 'dark' }) => {
  const t = THEMES[theme];
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  const sizeMap = { sm: '420px', md: '550px', lg: '800px', xl: '1200px', full: '95vw' };
  const resolvedSize = size || (wide ? 'xl' : 'md');
  const maxW = sizeMap[resolvedSize] || sizeMap.md;
  const isLarge = resolvedSize === 'xl' || resolvedSize === 'full' || resolvedSize === 'lg';
  const isDark = theme === 'dark';
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? 0 : '20px', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <motion.div
        className="modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        style={{ background: t.modalBg, borderRadius: isMobile ? 0 : '16px', border: isMobile ? 'none' : `1px solid ${t.border}`, width: '100%', maxWidth: isMobile ? '100%' : maxW, height: isMobile ? '100%' : (isLarge ? '85vh' : 'auto'), maxHeight: isMobile ? '100%' : '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: isDark ? '0 25px 60px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5)' : '0 25px 60px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.1)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${t.border}`, background: isDark ? 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%)' : 'linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.03) 100%)', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '10px', color: t.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(128,128,128,0.15)', border: 'none', backdropFilter: 'blur(8px)', color: t.textSecondary, width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,128,128,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(128,128,128,0.15)'}>{Icons.close(t.textSecondary)}</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: t.bgSecondary }}>{children}</div>
      </motion.div>
    </motion.div>
  );
};

// Activity Timeline Component
const ActivityTimeline = ({ activities = [], maxItems = 10, theme = 'dark' }) => {
  const t = THEMES[theme];
  const sorted = [...activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, maxItems);
  const getIcon = (type) => {
    const iconMap = { upload: 'upload', feedback: 'message', status: 'refresh', version: 'file', rating: 'star', select: 'check', assign: 'user', delete: 'trash', create: 'plus' };
    return iconMap[type] || 'file';
  };
  if (sorted.length === 0) return <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted, fontSize: '13px' }}>No activity yet</div>;
  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: t.border }} />
      {sorted.map((a, i) => (
        <div key={a.id || i} style={{ position: 'relative', paddingBottom: '16px' }}>
          <div style={{ position: 'absolute', left: '-20px', width: '18px', height: '18px', background: t.bgCard, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.border}` }}>{Icons[getIcon(a.type)] ? Icons[getIcon(a.type)](t.textMuted) : null}</div>
          <div style={{ background: t.bgInput, borderRadius: '8px', padding: '10px 12px', border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: '12px', marginBottom: '4px', color: t.text }}>{a.message}</div>
            <div style={{ fontSize: '10px', color: t.textMuted }}>{formatTimeAgo(a.timestamp)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Predefined tags for assets
const PREDEFINED_TAGS = [
  { id: 'hero', label: 'Hero', color: '#ef4444' },
  { id: 'bts', label: 'BTS', color: '#f97316' },
  { id: 'detail', label: 'Detail', color: '#fbbf24' },
  { id: 'portrait', label: 'Portrait', color: '#22c55e' },
  { id: 'landscape', label: 'Landscape', color: '#3b82f6' },
  { id: 'product', label: 'Product', color: '#8b5cf6' },
  { id: 'lifestyle', label: 'Lifestyle', color: '#ec4899' },
  { id: 'final', label: 'Final', color: '#10b981' },
];

// File Format Requirements
const FILE_FORMATS = {
  photo: [
    { id: 'jpg-web', label: 'JPG Web (sRGB)', ext: 'jpg', category: 'web' },
    { id: 'jpg-print', label: 'JPG Print (CMYK)', ext: 'jpg', category: 'print' },
    { id: 'png', label: 'PNG (Transparent)', ext: 'png', category: 'web' },
    { id: 'tiff', label: 'TIFF (Print Ready)', ext: 'tiff', category: 'print' },
    { id: 'psd', label: 'PSD (Layered)', ext: 'psd', category: 'source' },
    { id: 'raw', label: 'RAW Original', ext: 'raw', category: 'source' },
    { id: 'dng', label: 'DNG', ext: 'dng', category: 'source' },
  ],
  video: [
    { id: 'mp4-web', label: 'MP4 H.264 (Web)', ext: 'mp4', category: 'web' },
    { id: 'mp4-hq', label: 'MP4 H.265 (High Quality)', ext: 'mp4', category: 'delivery' },
    { id: 'mov-prores', label: 'MOV ProRes', ext: 'mov', category: 'source' },
    { id: 'mov-raw', label: 'MOV RAW', ext: 'mov', category: 'source' },
  ]
};

// Size/Adapt Requirements
const SIZE_PRESETS = {
  photo: [
    { id: 'original', label: 'Original Size', width: null, height: null },
    { id: '4k', label: '4K (3840px)', width: 3840, height: null },
    { id: 'web-large', label: 'Web Large (2400px)', width: 2400, height: null },
    { id: 'web-medium', label: 'Web Medium (1920px)', width: 1920, height: null },
    { id: 'web-small', label: 'Web Small (1200px)', width: 1200, height: null },
    { id: 'social-square', label: 'Social 1:1 (1080x1080)', width: 1080, height: 1080, ratio: '1:1' },
    { id: 'social-portrait', label: 'Social 4:5 (1080x1350)', width: 1080, height: 1350, ratio: '4:5' },
    { id: 'social-story', label: 'Stories 9:16 (1080x1920)', width: 1080, height: 1920, ratio: '9:16' },
    { id: 'thumbnail', label: 'Thumbnail (400px)', width: 400, height: null },
  ],
  video: [
    { id: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 },
    { id: '2k', label: '2K (2560x1440)', width: 2560, height: 1440 },
    { id: '1080p', label: 'Full HD (1920x1080)', width: 1920, height: 1080 },
    { id: '720p', label: 'HD (1280x720)', width: 1280, height: 720 },
    { id: 'square', label: 'Square 1:1 (1080x1080)', width: 1080, height: 1080, ratio: '1:1' },
    { id: 'portrait', label: 'Portrait 4:5 (1080x1350)', width: 1080, height: 1350, ratio: '4:5' },
    { id: 'vertical', label: 'Vertical 9:16 (1080x1920)', width: 1080, height: 1920, ratio: '9:16' },
  ]
};

// Task Templates
const TASK_TEMPLATES = {
  'team-onboarding': {
    name: 'Team Onboarding',
    icon: '',
    description: 'Checklist for onboarding new team members',
    subtasks: [
      { title: 'Send welcome email with login credentials', assignRole: 'producer' },
      { title: 'Share project access and folder structure', assignRole: 'producer' },
      { title: 'Introduce to team via group chat', assignRole: 'producer' },
      { title: 'Schedule intro call / walkthrough', assignRole: 'producer' },
      { title: 'Share brand guidelines & style guide', assignRole: 'producer' },
      { title: 'Verify software & tool access', assignRole: 'producer' },
    ]
  },
  'pre-production': {
    name: 'Pre-Production Checklist',
    icon: '',
    description: 'Preparation tasks before shoot',
    subtasks: [
      { title: 'Confirm shoot date & location', assignRole: 'producer' },
      { title: 'Finalize shot list / storyboard', assignRole: 'producer' },
      { title: 'Arrange equipment & gear', assignRole: 'producer' },
      { title: 'Confirm crew & talent', assignRole: 'producer' },
      { title: 'Share call sheet with team', assignRole: 'producer' },
      { title: 'Backup storage & cards ready', assignRole: 'producer' },
      { title: 'Props & wardrobe confirmed', assignRole: 'producer' },
    ]
  },
  'delivery-checklist': {
    name: 'Delivery Checklist',
    icon: '',
    description: 'Final delivery preparation',
    subtasks: [
      { title: 'Export all approved assets in required formats', assignRole: 'editor' },
      { title: 'Quality check all files', assignRole: 'producer' },
      { title: 'Organize folder structure as per client specs', assignRole: 'editor' },
      { title: 'Create delivery notes / readme', assignRole: 'producer' },
      { title: 'Upload to delivery platform / Drive', assignRole: 'editor' },
      { title: 'Send delivery confirmation to client', assignRole: 'producer' },
      { title: 'Archive project files', assignRole: 'editor' },
    ]
  },
  'post-production': {
    name: 'Post-Production Workflow',
    icon: '',
    description: 'Standard post workflow tasks',
    subtasks: [
      { title: 'Ingest & backup raw footage', assignRole: 'editor' },
      { title: 'Create project structure & proxy files', assignRole: 'editor' },
      { title: 'Rough cut / first assembly', assignRole: 'editor' },
      { title: 'Color correction & grading', assignRole: 'colorist' },
      { title: 'Audio sync & cleanup', assignRole: 'editor' },
      { title: 'Graphics & text overlays', assignRole: 'motion' },
      { title: 'Final review & export', assignRole: 'editor' },
    ]
  },
  'client-review': {
    name: 'Client Review Prep',
    icon: '',
    description: 'Prepare for client presentation',
    subtasks: [
      { title: 'Export review-ready files (watermarked)', assignRole: 'editor' },
      { title: 'Upload to review portal / Frame.io', assignRole: 'editor' },
      { title: 'Create review link with expiry', assignRole: 'producer' },
      { title: 'Send review email to client', assignRole: 'producer' },
      { title: 'Schedule feedback call if needed', assignRole: 'producer' },
    ]
  }
};

// Intelligent Subtask Suggestions based on keywords
const SUBTASK_SUGGESTIONS = {
  // Delivery related
  'deliver': ['Export final files in required formats', 'Quality check all deliverables', 'Upload to client drive', 'Send delivery confirmation email'],
  'delivery': ['Export final files in required formats', 'Quality check all deliverables', 'Upload to client drive', 'Send delivery confirmation email'],
  'export': ['Export in 4K resolution', 'Export for social media (1080x1080, 1080x1920)', 'Export web-optimized version', 'Create proxy files'],
  'final': ['Run final quality check', 'Get client approval', 'Archive source files', 'Create backup copies'],
  // Edit related
  'edit': ['Review raw footage', 'Create rough cut', 'Add transitions & effects', 'Audio sync & cleanup', 'Color correction', 'Add graphics/text', 'Final review'],
  'video': ['Import & organize footage', 'Create rough assembly', 'Fine cut editing', 'Color grade', 'Audio mix', 'Add lower thirds', 'Export for review'],
  'color': ['Apply base correction', 'Match shots for consistency', 'Create look/mood', 'Secondary corrections', 'Final grade review'],
  'grade': ['Apply base correction', 'Match shots for consistency', 'Create look/mood', 'Secondary corrections', 'Final grade review'],
  'grading': ['Apply base correction', 'Match shots for consistency', 'Create look/mood', 'Secondary corrections', 'Final grade review'],
  // Motion/Animation related
  'motion': ['Create storyboard/animatic', 'Build assets & elements', 'Animate key scenes', 'Add transitions', 'Sound design', 'Final render'],
  'animation': ['Create storyboard/animatic', 'Build assets & elements', 'Animate key scenes', 'Add transitions', 'Sound design', 'Final render'],
  'cgi': ['Model 3D assets', 'Setup lighting & materials', 'Render passes', 'Compositing', 'Final output'],
  '3d': ['Model 3D assets', 'Setup lighting & materials', 'Render passes', 'Compositing', 'Final output'],
  // Photo related
  'photo': ['Cull & select best shots', 'Basic corrections', 'Retouching', 'Color grading', 'Export in required sizes'],
  'retouch': ['Skin cleanup', 'Remove blemishes', 'Frequency separation', 'Dodge & burn', 'Final polish'],
  'photoshoot': ['Scout location', 'Arrange equipment', 'Coordinate with talent', 'Setup lighting', 'Direct & shoot', 'Backup cards'],
  // Review related
  'review': ['Prepare review files', 'Upload to review platform', 'Share review link', 'Collect feedback', 'Implement changes'],
  'feedback': ['Review all feedback points', 'Prioritize changes', 'Implement revisions', 'Quality check', 'Send for re-review'],
  'revision': ['Review change requests', 'Make required edits', 'Quality check changes', 'Export revised version', 'Send for approval'],
  'changes': ['Review change requests', 'Make required edits', 'Quality check changes', 'Export revised version', 'Send for approval'],
  // Client related
  'client': ['Schedule meeting', 'Prepare presentation', 'Share deliverables', 'Collect feedback', 'Follow up'],
  'meeting': ['Prepare agenda', 'Gather materials', 'Send calendar invite', 'Prepare notes', 'Follow up on action items'],
  'presentation': ['Prepare slides/deck', 'Rehearse key points', 'Setup tech/screen sharing', 'Send pre-read materials'],
  // Project related
  'project': ['Define scope & timeline', 'Assign team members', 'Setup project folders', 'Create task breakdown', 'Kickoff meeting'],
  'kickoff': ['Share project brief', 'Assign responsibilities', 'Set milestones', 'Schedule check-ins'],
  'planning': ['Define deliverables', 'Create timeline', 'Allocate resources', 'Identify risks', 'Get approvals'],
  // Specific brands (Lays, PepsiCo common)
  'lays': ['Review brand guidelines', 'Prepare product shots', 'Create hero compositions', 'Background variants', 'Social media crops'],
  'pepsi': ['Review brand guidelines', 'Prepare product shots', 'Create hero compositions', 'Background variants', 'Social media crops'],
  'hero': ['Setup hero lighting', 'Multiple angle options', 'Swap backgrounds', 'Final composite', 'Client options'],
  // Upload related
  'upload': ['Organize files properly', 'Verify file names', 'Check file sizes', 'Upload to platform', 'Verify upload success', 'Share access'],
  // Social media
  'social': ['Adapt for Instagram (1:1, 4:5, 9:16)', 'Adapt for Facebook', 'Adapt for LinkedIn', 'Add captions/text', 'Schedule posts'],
  'instagram': ['Create feed post (1:1)', 'Create story (9:16)', 'Create reel version', 'Add hashtags'],
  'reel': ['Edit to 60 sec max', 'Add trending audio', 'Create hook in first 3 sec', 'Add captions'],
};

// Auto-task settings defaults
const DEFAULT_NOTIFICATION_SETTINGS = {
  autoTaskDueBefore: 24, // hours before project deadline
  clientNotifications: {
    onAssetReady: false,
    onVersionUpload: false,
    onAllRevisionsComplete: true,
    onMilestoneReached: true,
  },
  teamNotifications: {
    onTaskAssigned: true,
    onDueApproaching: true,
    onOverdue: true,
    onFeedbackReceived: true,
    onSubtaskComplete: true,
  }
};

// Email notification via Resend API
const sendEmailNotification = async (to, subject, body, type = 'default', data = {}) => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body, type, data })
    });
    const result = await response.json();
    if (result.success) console.log('Email sent:', subject);
    return result.success;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

const Toast = ({ message, type, onClose }) => {
  const duration = 3500;
  useEffect(() => { const t = setTimeout(onClose, duration); return () => clearTimeout(t); }, [onClose]);
  const colorMap = { success: '#22c55e', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };
  const bg = colorMap[type] || colorMap.info;
  const iconEl = type === 'success' ? Icons.check('#fff') : type === 'error' ? Icons.close('#fff') : type === 'warning' ? Icons.alert('#fff') : Icons.alert('#fff');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', background: bg, borderRadius: '12px', color: '#fff', fontSize: '13px', fontWeight: '500', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', minWidth: '260px', maxWidth: '400px', overflow: 'hidden' }}>
      <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{iconEl}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}>{Icons.close('#fff')}</button>
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'rgba(255,255,255,0.3)', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}><div style={{ height: '100%', background: 'rgba(255,255,255,0.7)', animation: `toastProgress ${duration}ms linear forwards`, width: '100%' }} /></div>
    </div>
  );
};
const Btn = ({ children, onClick, color = '#6366f1', disabled, small, outline, theme = 'dark' }) => {
  const t = THEMES[theme];
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? '8px 14px' : '10px 18px', background: outline ? 'transparent' : color, border: outline ? `1px solid ${color}` : 'none', borderRadius: '8px', color: outline ? color : '#fff', fontSize: small ? '11px' : '13px', fontWeight: '500', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s' }}>{children}</button>;
};
const Input = ({ value, onChange, placeholder, type = 'text', style, theme = 'dark', ...props }) => {
  const t = THEMES[theme];
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: '100%', padding: '10px 14px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '13px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.15s', ...style }} {...props} />;
};
const Select = ({ value, onChange, children, style, theme = 'dark' }) => {
  const t = THEMES[theme];
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '13px', outline: 'none', ...style }}>{children}</select>;
};

const StarRating = ({ rating = 0, onChange, size = 18, readonly = false }) => {
  const [hover, setHover] = useState(0);
  return <div style={{ display: 'flex', gap: '3px' }}>{[1,2,3,4,5].map(star => <span key={star} onClick={() => !readonly && onChange?.(star === rating ? 0 : star)} onMouseEnter={() => !readonly && setHover(star)} onMouseLeave={() => !readonly && setHover(0)} style={{ cursor: readonly ? 'default' : 'pointer', fontSize: size, color: star <= (hover || rating) ? '#fbbf24' : '#3a3a4a', transition: 'color 0.1s' }}>★</span>)}</div>;
};

const VideoThumbnail = ({ src, thumbnail, muxPlaybackId, duration, style }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [scrubPos, setScrubPos] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  // Compute best poster/thumbnail URL
  const posterUrl = thumbnail || (muxPlaybackId ? `https://image.mux.com/${muxPlaybackId}/thumbnail.jpg?width=400&height=300&fit_mode=smartcrop` : null);
  const videoSrc = src || (muxPlaybackId ? `https://stream.mux.com/${muxPlaybackId}.m3u8` : null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '100px' }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMove = (clientX, rect) => {
    if (!videoRef.current || !isLoaded) return;
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setScrubPos(pos);
    videoRef.current.currentTime = pos * (videoRef.current.duration || 0);
  };

  const handleMouseMove = (e) => handleMove(e.clientX, e.currentTarget.getBoundingClientRect());
  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, e.currentTarget.getBoundingClientRect());
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: '#1a1a2e', ...style }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
      onTouchStart={() => setIsHovering(true)}
      onTouchEnd={() => setIsHovering(false)}
      onTouchMove={handleTouchMove}
    >
      {/* Show thumbnail/poster first */}
      {posterUrl && !thumbError && !isLoaded && (
        <img src={posterUrl} alt="" onError={() => setThumbError(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {(!posterUrl || thumbError) && !isLoaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #1a1a2e 0%, #2d1b69 100%)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"><polygon points="5,3 19,12 5,21"/></svg>
          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>VIDEO</span>
        </div>
      )}
      {inView && videoSrc && !muxPlaybackId && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          preload="metadata"
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s' }}
        />
      )}
      {isHovering && isLoaded && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scrubPos * 100}%`, width: '2px', background: '#ef4444', pointerEvents: 'none' }} />}
      {duration && <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{formatDuration(duration)}</div>}
      {!isLoaded && !posterUrl && <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '9px' }}>Video</div>}
    </div>
  );
};

const AppearancePanel = ({ settings, onChange, onClose, theme = 'dark' }) => {
  const t = THEMES[theme];
  return (
  <div style={{ position: 'absolute', top: '45px', right: '0', background: t.bgCard, borderRadius: '12px', border: `1px solid ${t.border}`, padding: '16px', width: '240px', zIndex: 100 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}><span style={{ fontSize: '13px', fontWeight: '600', color: t.text }}>Appearance</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: '16px' }}>×</button></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Layout</div><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => onChange({ ...settings, layout: 'grid' })} style={{ flex: 1, padding: '8px', background: settings.layout === 'grid' ? t.primary : t.bgInput, border: `1px solid ${settings.layout === 'grid' ? t.primary : t.border}`, borderRadius: '6px', color: settings.layout === 'grid' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>⊞ Grid</button><button onClick={() => onChange({ ...settings, layout: 'list' })} style={{ flex: 1, padding: '8px', background: settings.layout === 'list' ? t.primary : t.bgInput, border: `1px solid ${settings.layout === 'list' ? t.primary : t.border}`, borderRadius: '6px', color: settings.layout === 'list' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>☰ List</button></div></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Card Size</div><div style={{ display: 'flex', gap: '8px' }}>{['S', 'M', 'L'].map(s => <button key={s} onClick={() => onChange({ ...settings, cardSize: s })} style={{ flex: 1, padding: '8px', background: settings.cardSize === s ? t.primary : t.bgInput, border: `1px solid ${settings.cardSize === s ? t.primary : t.border}`, borderRadius: '6px', color: settings.cardSize === s ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>{s}</button>)}</div></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Aspect Ratio</div><div style={{ display: 'flex', gap: '8px' }}>{['landscape', 'square', 'portrait'].map(a => <button key={a} onClick={() => onChange({ ...settings, aspectRatio: a })} style={{ flex: 1, padding: '8px', background: settings.aspectRatio === a ? t.primary : t.bgInput, border: `1px solid ${settings.aspectRatio === a ? t.primary : t.border}`, borderRadius: '6px', color: settings.aspectRatio === a ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>{a === 'landscape' ? '▬' : a === 'square' ? '◼' : '▮'}</button>)}</div></div>
    <div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '11px', color: t.textMuted }}>Show Info</span><button onClick={() => onChange({ ...settings, showInfo: !settings.showInfo })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: settings.showInfo ? t.primary : t.bgInput, cursor: 'pointer', position: 'relative' }}><div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: settings.showInfo ? '22px' : '2px', transition: 'left 0.2s' }} /></button></div></div>
  </div>
);
};

export default function MainApp() {
  const { userProfile, signOut } = useAuth();
  const [view, setView] = useState('dashboard');
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [clients, setClients] = useState([]);
  const [coreTeam, setCoreTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [toast, setToast] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Sidebar Collapsed State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-sidebar-collapsed');
      return saved === 'true';
    }
    return false;
  });
  
  // Company Settings (logo, name)
  const [companySettings, setCompanySettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-company-settings');
      if (saved) return JSON.parse(saved);
    }
    return { name: 'ANANDI', logoDark: null, logoLight: null };
  });
  const [showCompanySettings, setShowCompanySettings] = useState(false);
  
  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-theme');
      if (saved) return saved;
      // Check system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });
  const t = THEMES[theme]; // Current theme colors
  
  // Global Search State
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  
  // View Mode State (grid, kanban, calendar)
  const [viewMode, setViewMode] = useState('grid');
  
  // Client Portal Mode
  const isClientView = userProfile?.role === 'client' || userProfile?.isClient;
  
  const [appearance, setAppearance] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-appearance');
      if (saved) return JSON.parse(saved);
    }
    return { layout: 'grid', cardSize: 'M', aspectRatio: 'square', thumbScale: 'fill', showInfo: true };
  });
  const [isMobile, setIsMobile] = useState(false);
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);
  const isAgency = userProfile?.role === 'agency';

  // HR access derived values. canManageEmployeesNow gates the Employees nav;
  // canAccessHrNow gates the onboarding flow. Vendors/clients/freelancers fail both.
  const isHrAdminUser = userProfile?.isHrAdmin === true;
  const isPrimaryProducer = userProfile?.isPrimaryProducer === true;
  const canManageEmployeesNow = canManageEmployees(userProfile);
  const isEmployeeUser = userProfile?.isEmployee === true;
  // Primary producer (workspace owner) bypasses onboarding entirely — they ARE the company,
  // they don't need to sign offer letters to themselves. Vendors/clients/freelancers don't
  // have isEmployee so they also bypass. Only real employees with pending status get the gate.
  const needsOnboarding = isEmployeeUser && !isPrimaryProducer && userProfile?.onboardingStatus !== 'completed';
  const [hrPendingCount, setHrPendingCount] = useState(0);

  // Global keyboard shortcuts
  const [showShortcuts, setShowShortcuts] = useState(false);
  useKeyboardShortcuts({
    handlers: {
      'cmd+1': () => { setView('dashboard'); setSelectedProjectId(null); },
      'cmd+2': () => { setView('tasks'); setSelectedProjectId(null); },
      'cmd+3': () => { setView('projects'); setSelectedProjectId(null); },
      'cmd+4': () => { setView('calendar'); setSelectedProjectId(null); },
      'cmd+5': () => { if (isProducer) { setView('team'); setSelectedProjectId(null); } },
      'cmd+6': () => { if (canManageEmployees(userProfile)) { setView('employees'); setSelectedProjectId(null); } },
      'cmd+k': () => setShowGlobalSearch(true),
      'escape': () => { if (showShortcuts) setShowShortcuts(false); else if (showGlobalSearch) setShowGlobalSearch(false); },
      '?': () => setShowShortcuts(!showShortcuts),
    },
    enabled: !showCompanySettings,
  });

  // Save theme to localStorage and apply to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // HR bootstrap: on first load for the workspace owner, mark them as the
  // primary producer so they become permanently undeletable. Idempotent.
  useEffect(() => {
    if (!userProfile?.id) return;
    ensurePrimaryProducerExists(userProfile).catch(err => {
      console.warn('ensurePrimaryProducerExists failed:', err?.message);
    });
  }, [userProfile?.id]);

  // HR pending approvals badge (producer only)
  useEffect(() => {
    if (!userProfile?.id || !isHrFullAdmin(userProfile)) {
      setHrPendingCount(0);
      return;
    }
    listPendingApprovals(userProfile)
      .then(list => setHrPendingCount(list.length))
      .catch(() => setHrPendingCount(0));
  }, [userProfile?.id, view]);
  
  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
      const handleChange = (e) => {
        const savedTheme = localStorage.getItem('anandi-theme');
        if (!savedTheme || savedTheme === 'system') {
          setTheme(e.matches ? 'light' : 'dark');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Save appearance to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-appearance', JSON.stringify(appearance));
    }
  }, [appearance]);

  // Save sidebar collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-sidebar-collapsed', sidebarCollapsed.toString());
    }
  }, [sidebarCollapsed]);

  // Save company settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-company-settings', JSON.stringify(companySettings));
    }
  }, [companySettings]);

  // Load notifications from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && userProfile?.id) {
      const saved = localStorage.getItem(`anandi-notifs-${userProfile.id}`);
      if (saved) setNotifications(JSON.parse(saved));
    }
  }, [userProfile?.id]);

  // Save notifications to localStorage
  const saveNotifications = (notifs) => {
    setNotifications(notifs);
    if (typeof window !== 'undefined' && userProfile?.id) {
      localStorage.setItem(`anandi-notifs-${userProfile.id}`, JSON.stringify(notifs));
    }
  };

  // Add notification helper
  const addNotification = (notif) => {
    const newNotif = {
      id: generateId(),
      ...notif,
      timestamp: new Date().toISOString(),
      read: false
    };
    const updated = [newNotif, ...notifications].slice(0, 50); // Keep max 50
    saveNotifications(updated);
    return newNotif;
  };

  // Mark notification as read
  const markAsRead = (notifId) => {
    const updated = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
    saveNotifications(updated);
  };

  // Mark all as read
  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
  };

  // Clear all notifications
  const clearNotifications = () => {
    saveNotifications([]);
  };

  // Check deadlines and create notifications
  const checkDeadlines = (projectsList) => {
    if (!userProfile || !isProducer) return;
    
    const now = new Date();
    const newNotifs = [];
    
    projectsList.forEach(project => {
      (project.assets || []).forEach(asset => {
        if (!asset.dueDate || asset.deleted || asset.status === 'delivered' || asset.status === 'approved') return;
        
        const dueDate = new Date(asset.dueDate);
        const daysUntil = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        const notifKey = `deadline-${asset.id}-${daysUntil}`;
        
        // Check if we already notified about this
        const alreadyNotified = notifications.some(n => n.key === notifKey);
        if (alreadyNotified) return;
        
        if (daysUntil < 0) {
          // Overdue
          newNotifs.push({
            key: notifKey,
            type: 'deadline_overdue',
            icon: '!',
            title: 'Deadline Overdue',
            message: `"${asset.name}" is ${Math.abs(daysUntil)} day(s) overdue`,
            projectId: project.id,
            assetId: asset.id,
            priority: 'high'
          });
        } else if (daysUntil === 0) {
          // Due today
          newNotifs.push({
            key: notifKey,
            type: 'deadline_today',
            icon: '!',
            title: 'Due Today',
            message: `"${asset.name}" is due today`,
            projectId: project.id,
            assetId: asset.id,
            priority: 'high'
          });
        } else if (daysUntil === 1) {
          // Due tomorrow
          newNotifs.push({
            key: notifKey,
            type: 'deadline_reminder',
            icon: '',
            title: 'Due Tomorrow',
            message: `"${asset.name}" is due tomorrow`,
            projectId: project.id,
            assetId: asset.id,
            priority: 'medium'
          });
        } else if (daysUntil === 3) {
          // Due in 3 days
          newNotifs.push({
            key: notifKey,
            type: 'deadline_reminder',
            icon: '',
            title: 'Deadline in 3 Days',
            message: `"${asset.name}" is due in 3 days`,
            projectId: project.id,
            assetId: asset.id,
            priority: 'low'
          });
        }
      });
      
      // Check for missing assignments (Producer alerts)
      if (isProducer && project.status === 'active') {
        const unassigned = (project.assets || []).filter(a => !a.deleted && !a.assignedTo && a.status !== 'delivered' && a.status !== 'approved');
        if (unassigned.length > 0) {
          const notifKey = `unassigned-${project.id}-${unassigned.length}`;
          const alreadyNotified = notifications.some(n => n.key === notifKey);
          if (!alreadyNotified) {
            newNotifs.push({
              key: notifKey,
              type: 'alert',
              icon: '!',
              title: 'Unassigned Assets',
              message: `${unassigned.length} asset(s) in "${project.name}" need assignment`,
              projectId: project.id,
              priority: 'medium'
            });
          }
        }
        
        // Check for stale projects (no activity in 7 days)
        const lastActivity = project.activityLog?.[project.activityLog.length - 1]?.timestamp;
        if (lastActivity) {
          const daysSinceActivity = Math.floor((now - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
          if (daysSinceActivity >= 7) {
            const notifKey = `stale-${project.id}`;
            const alreadyNotified = notifications.some(n => n.key === notifKey);
            if (!alreadyNotified) {
              newNotifs.push({
                key: notifKey,
                type: 'alert',
                icon: '',
                title: 'Stale Project',
                message: `"${project.name}" has no activity for ${daysSinceActivity} days`,
                projectId: project.id,
                priority: 'low'
              });
            }
          }
        }
      }
    });
    
    // Add new notifications
    if (newNotifs.length > 0) {
      const updated = [...newNotifs.map(n => ({ ...n, id: generateId(), timestamp: new Date().toISOString(), read: false })), ...notifications].slice(0, 50);
      saveNotifications(updated);
    }
  };

  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => { const check = () => { setIsMobile(window.innerWidth < 768); setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1200); }; check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => { loadData(); }, []);
  
  const loadData = async () => { 
    setLoading(true); 
    try { 
      const [p, u, f, c, ct] = await Promise.all([getProjectsForUser(userProfile.id, userProfile.role), getUsers(), getFreelancers(), getClients(), getCoreTeam()]); 
      setProjects(p); 
      setUsers(u); 
      setFreelancers(f); 
      setClients(c); 
      setCoreTeam(ct);
      // Check deadlines after loading
      setTimeout(() => checkDeadlines(p), 1000);
    } catch (e) { console.error(e); } 
    setLoading(false); 
  };
  const showToast = (msg, type = 'info') => setToast({ message: msg, type });
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const refreshProject = async () => {
    if (!selectedProjectId) return;
    try {
      const updated = await getProject(selectedProjectId);
      if (updated) {
        setProjects(prev => prev.map(p => p.id === selectedProjectId ? updated : p));
      }
    } catch (e) { console.error('refreshProject error:', e); }
  };

  // ==================== ADVANCED TASK MANAGEMENT ====================
  
  // Global Tasks State
  const [globalTasks, setGlobalTasks] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-global-tasks');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  // Notification Settings (producer controlled)
  const [notificationSettings, setNotificationSettings] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-notification-settings');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_SETTINGS;
    }
    return DEFAULT_NOTIFICATION_SETTINGS;
  });
  
  // Save global tasks
  const saveGlobalTasks = (tasks) => {
    setGlobalTasks(tasks);
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-global-tasks', JSON.stringify(tasks));
    }
  };
  
  // Save notification settings
  const saveNotificationSettings = (settings) => {
    setNotificationSettings(settings);
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-notification-settings', JSON.stringify(settings));
    }
  };
  
  // Create a new task
  const createTask = (taskData) => {
    const task = {
      id: generateId(),
      title: taskData.title || '',
      description: taskData.description || '',
      type: taskData.type || 'team', // personal, team, project, feedback
      status: taskData.status || 'pending', // pending, in-progress, review, done
      priority: taskData.priority || 'medium', // low, medium, high, urgent
      createdBy: userProfile?.id,
      createdByName: userProfile?.name,
      assignedTo: taskData.assignedTo || [], // Array of user IDs
      projectId: taskData.projectId || null,
      projectName: taskData.projectId ? projects.find(p => p.id === taskData.projectId)?.name : null,
      assetId: taskData.assetId || null,
      feedbackId: taskData.feedbackId || null,
      feedbackText: taskData.feedbackText || null,
      dueDate: taskData.dueDate || null,
      dueTime: taskData.dueTime || null,
      recurring: taskData.recurring || { enabled: false, frequency: 'weekly', days: [], endDate: null },
      subtasks: taskData.subtasks || [],
      attachments: taskData.attachments || [],
      activity: [{
        action: 'created',
        by: userProfile?.id,
        byName: userProfile?.name,
        timestamp: new Date().toISOString()
      }],
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    
    const updated = [task, ...globalTasks];
    saveGlobalTasks(updated);
    
    // Send notifications to assignees
    if (task.assignedTo.length > 0 && notificationSettings.teamNotifications.onTaskAssigned) {
      task.assignedTo.forEach(assigneeId => {
        const assignee = [...users, ...freelancers, ...coreTeam].find(u => u.id === assigneeId);
        if (assignee && assignee.email && assignee.id !== userProfile?.id) {
          sendEmailNotification(
            assignee.email,
            `New task assigned: ${task.title}`,
            `${userProfile?.name} assigned you a task: "${task.title}"${task.projectName ? ` in project ${task.projectName}` : ''}`
          );
          addNotification({
            type: 'task_assigned',
            icon: '',
            title: 'Task Assigned',
            message: `You've been assigned: "${task.title}"`,
            taskId: task.id
          });
        }
      });
    }
    
    return task;
  };
  
  // Update a task
  const updateTask = (taskId, updates) => {
    const updated = globalTasks.map(t => {
      if (t.id === taskId) {
        const newTask = { ...t, ...updates };
        // Add activity log
        newTask.activity = [
          { action: 'updated', by: userProfile?.id, byName: userProfile?.name, timestamp: new Date().toISOString(), changes: Object.keys(updates) },
          ...t.activity
        ];
        return newTask;
      }
      return t;
    });
    saveGlobalTasks(updated);
  };
  
  // Toggle task completion
  const toggleTaskComplete = (taskId) => {
    const task = globalTasks.find(t => t.id === taskId);
    if (!task) return;
    
    const isNowComplete = task.status !== 'done';
    const updated = globalTasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          status: isNowComplete ? 'done' : 'pending',
          completedAt: isNowComplete ? new Date().toISOString() : null,
          activity: [
            { action: isNowComplete ? 'completed' : 'reopened', by: userProfile?.id, byName: userProfile?.name, timestamp: new Date().toISOString() },
            ...t.activity
          ]
        };
      }
      return t;
    });
    saveGlobalTasks(updated);
  };
  
  // Toggle subtask completion
  const toggleSubtask = (taskId, subtaskId) => {
    const updated = globalTasks.map(t => {
      if (t.id === taskId) {
        const newSubtasks = t.subtasks.map(st => 
          st.id === subtaskId ? { ...st, done: !st.done, completedAt: !st.done ? new Date().toISOString() : null } : st
        );
        return {
          ...t,
          subtasks: newSubtasks,
          activity: [
            { action: 'subtask_toggled', subtaskId, by: userProfile?.id, byName: userProfile?.name, timestamp: new Date().toISOString() },
            ...t.activity
          ]
        };
      }
      return t;
    });
    saveGlobalTasks(updated);
    
    // Check if all subtasks are done
    const task = updated.find(t => t.id === taskId);
    if (task && task.subtasks.length > 0 && task.subtasks.every(st => st.done)) {
      showToast('All subtasks completed!', 'success');
    }
  };
  
  // Add subtask
  const addSubtask = (taskId, subtaskTitle, assignedTo = null) => {
    const subtask = {
      id: generateId(),
      title: subtaskTitle,
      done: false,
      assignedTo: assignedTo,
      createdAt: new Date().toISOString()
    };
    
    const updated = globalTasks.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: [...t.subtasks, subtask],
          activity: [
            { action: 'subtask_added', subtaskTitle, by: userProfile?.id, byName: userProfile?.name, timestamp: new Date().toISOString() },
            ...t.activity
          ]
        };
      }
      return t;
    });
    saveGlobalTasks(updated);
  };
  
  // Delete task
  const deleteTask = (taskId) => {
    const updated = globalTasks.filter(t => t.id !== taskId);
    saveGlobalTasks(updated);
    showToast('Task deleted', 'info');
  };
  
  // Add attachment to task
  const addTaskAttachment = async (taskId, file) => {
    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, `task-attachments/${taskId}/${file.name}`);
      await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      const attachment = {
        id: generateId(),
        name: file.name,
        url: url,
        type: file.type,
        size: file.size,
        uploadedBy: userProfile?.id,
        uploadedByName: userProfile?.name,
        uploadedAt: new Date().toISOString()
      };
      
      const updated = globalTasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            attachments: [...t.attachments, attachment],
            activity: [
              { action: 'attachment_added', fileName: file.name, by: userProfile?.id, byName: userProfile?.name, timestamp: new Date().toISOString() },
              ...t.activity
            ]
          };
        }
        return t;
      });
      saveGlobalTasks(updated);
      showToast('Attachment added', 'success');
    } catch (error) {
      console.error('Attachment upload error:', error);
      showToast('Failed to upload attachment', 'error');
    }
  };
  
  // Create task from feedback (auto-task generation)
  const createTaskFromFeedback = (feedback, asset, project) => {
    // Calculate due date based on settings
    const projectDeadline = project.deadline ? new Date(project.deadline) : null;
    let dueDate = null;
    
    if (projectDeadline) {
      dueDate = new Date(projectDeadline);
      dueDate.setHours(dueDate.getHours() - notificationSettings.autoTaskDueBefore);
    } else {
      // Default to 24 hours from now if no project deadline
      dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + 24);
    }
    
    // Determine assignee based on asset type/category
    let assignedTo = [];
    if (asset.assignedTo) {
      assignedTo = [asset.assignedTo];
    }
    
    const task = createTask({
      type: 'feedback',
      title: `REVISION: ${asset.name} - "${feedback.text.slice(0, 40)}${feedback.text.length > 40 ? '...' : ''}"`,
      description: feedback.text,
      projectId: project.id,
      assetId: asset.id,
      feedbackId: feedback.id,
      feedbackText: feedback.text,
      assignedTo: assignedTo,
      dueDate: dueDate.toISOString().split('T')[0],
      priority: 'high',
    });
    
    showToast('Revision task created automatically', 'info');
    return task;
  };
  
  // Create task from template
  const createTaskFromTemplate = (templateId, projectId = null, assignees = {}) => {
    const template = TASK_TEMPLATES[templateId];
    if (!template) return null;
    
    const subtasks = template.subtasks.map(st => ({
      id: generateId(),
      title: st.title,
      done: false,
      assignedTo: assignees[st.assignRole] || null,
      createdAt: new Date().toISOString()
    }));
    
    const task = createTask({
      type: 'team',
      title: template.name,
      description: template.description,
      projectId: projectId,
      priority: 'medium',
      subtasks: subtasks,
      assignedTo: Object.values(assignees).filter(Boolean),
    });
    
    showToast(`Created "${template.name}" with ${subtasks.length} subtasks`, 'success');
    return task;
  };
  
  // Send manual notification to client
  const sendClientNotification = async (clientEmail, subject, message, projectId = null) => {
    try {
      await sendEmailNotification(clientEmail, subject, message, 'client_update', { projectId });
      showToast('Client notification sent', 'success');
      return true;
    } catch (error) {
      showToast('Failed to send notification', 'error');
      return false;
    }
  };
  
  // Get all team members for assignment
  const allTeamMembers = [...users, ...freelancers, ...coreTeam].filter(u => u.id !== userProfile?.id);
  
  // ==================== END TASK MANAGEMENT ====================

  // Notification Panel Component
  const NotificationPanel = () => {
    const unreadCount = notifications.filter(n => !n.read).length;
    
    return (
      <div style={{ position: 'relative' }}>
        {/* Bell Icon */}
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          style={{
            position: 'relative',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '8px',
            transition: 'background 0.2s'
          }}
        >
          {Icons.bell(t.textSecondary)}
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '10px',
              fontWeight: '700',
              padding: '2px 5px',
              borderRadius: '10px',
              minWidth: '16px',
              textAlign: 'center'
            }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
        
        {/* Dropdown Panel */}
        {showNotifications && (
          <>
            <div className="modal-backdrop" onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div className="modal-content" style={{
              position: 'fixed',
              top: isMobile ? '60px' : '50px',
              left: isMobile ? '10px' : 'auto',
              right: isMobile ? '10px' : '24px',
              width: isMobile ? 'auto' : '360px',
              maxHeight: '480px',
              background: t.bgSecondary,
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              zIndex: 200,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '14px 16px',
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: '600', fontSize: '14px', color: t.text }}>Notifications</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} style={{ background: 'transparent', border: 'none', color: t.primary, fontSize: '11px', cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button onClick={clearNotifications} style={{ background: 'transparent', border: 'none', color: t.textMuted, fontSize: '11px', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              {/* Notifications List */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: t.textMuted }}>
                    <div style={{ marginBottom: '10px', opacity: 0.4 }}>{Icons.bell(t.textMuted)}</div>
                    <div style={{ fontSize: '13px' }}>No notifications</div>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div 
                      key={notif.id}
                      onClick={() => {
                        markAsRead(notif.id);
                        if (notif.projectId) {
                          setSelectedProjectId(notif.projectId);
                          setView('projects');
                          // If it's an assignment notification, go to team tab
                          if (notif.type === 'alert' && notif.title?.includes('Unassigned')) {
                            setTimeout(() => {
                              // Try to find and click team tab
                              const teamTab = document.querySelector('[data-tab="team"]');
                              if (teamTab) teamTab.click();
                            }, 100);
                          }
                        } else if (notif.type === 'team' || notif.title?.includes('Team') || notif.title?.includes('Editor')) {
                          setView('team');
                        }
                        setShowNotifications(false);
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${t.border}`,
                        cursor: 'pointer',
                        background: notif.read ? 'transparent' : `${t.primary}12`,
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '20px' }}>{notif.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            fontSize: '13px', 
                            fontWeight: notif.read ? '400' : '600',
                            marginBottom: '4px'
                          }}>
                            {notif.title}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: t.textMuted,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {notif.message}
                          </div>
                          <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px' }}>
                            {formatTimeAgo(notif.timestamp)}
                          </div>
                        </div>
                        {!notif.read && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.primary, flexShrink: 0, marginTop: '6px' }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // Global Search Component
  const GlobalSearch = () => {
    const searchInputRef = useRef(null);
    const allAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted).map(a => ({ ...a, projectName: p.name, projectId: p.id })));
    
    useEffect(() => {
      if (showGlobalSearch && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [showGlobalSearch]);
    
    const searchResults = globalSearchQuery.trim() ? (() => {
      const q = globalSearchQuery.toLowerCase();
      const matchedProjects = projects.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.client?.toLowerCase().includes(q)
      ).slice(0, 5);
      const matchedAssets = allAssets.filter(a => 
        a.name?.toLowerCase().includes(q) ||
        (a.tags || []).some(tag => tag.toLowerCase().includes(q))
      ).slice(0, 10);
      const matchedTeam = [...coreTeam, ...freelancers].filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
      ).slice(0, 5);
      return { projects: matchedProjects, assets: matchedAssets, team: matchedTeam };
    })() : { projects: [], assets: [], team: [] };
    
    if (!showGlobalSearch) return null;
    
    return (
      <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', justifyContent: 'center', paddingTop: '100px' }} onClick={() => { setShowGlobalSearch(false); setGlobalSearchQuery(''); }}>
        <div className="modal-content" style={{ width: '600px', maxWidth: '90vw', background: t.bgSecondary, borderRadius: '16px', border: `1px solid ${t.border}`, overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          {/* Search Input */}
          <div style={{ padding: '16px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
            {Icons.search(t.textMuted)}
            <input
              ref={searchInputRef}
              type="text"
              value={globalSearchQuery}
              onChange={e => setGlobalSearchQuery(e.target.value)}
              placeholder="Search projects, assets, team..."
              style={{ 
                flex: 1, 
                background: 'transparent', 
                border: 'none', 
                outline: 'none', 
                fontSize: '16px', 
                color: t.text 
              }}
            />
            <span style={{ fontSize: '11px', color: t.textMuted, background: t.bgCard, padding: '4px 8px', borderRadius: '4px' }}>ESC</span>
          </div>
          
          {/* Results */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
            {!globalSearchQuery.trim() ? (
              <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                <div style={{ fontSize: '14px' }}>Type to search across all projects and assets</div>
                <div style={{ fontSize: '11px', marginTop: '8px' }}>Tip: Press / to open search anytime</div>
              </div>
            ) : (
              <>
                {/* Projects */}
                {searchResults.projects.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, padding: '8px 12px', textTransform: 'uppercase' }}>Projects</div>
                    {searchResults.projects.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => { setSelectedProjectId(p.id); setView('projects'); setShowGlobalSearch(false); setGlobalSearchQuery(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bgCard}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ fontSize: '12px', fontWeight: '600', color: t.textMuted, width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${t.primary}20`, borderRadius: '4px' }}>P</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: t.text }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: t.textMuted }}>{p.client}</div>
                        </div>
                        <Badge status={p.status} />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Assets */}
                {searchResults.assets.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, padding: '8px 12px', textTransform: 'uppercase' }}>Assets</div>
                    {searchResults.assets.map(a => (
                      <div 
                        key={a.id} 
                        onClick={() => { setSelectedProjectId(a.projectId); setView('projects'); setShowGlobalSearch(false); setGlobalSearchQuery(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bgCard}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {a.thumbnail ? (
                          <img src={a.thumbnail} alt="" style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bgCard, borderRadius: '6px', border: `1px solid ${t.border}` }}>{a.type === 'video' ? 'VID' : a.type === 'image' ? 'IMG' : 'DOC'}</span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: '11px', color: t.textMuted }}>{a.projectName}</div>
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 6px', background: t.bgCard, borderRadius: '4px', color: t.textSecondary }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Team */}
                {searchResults.team.length > 0 && (
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, padding: '8px 12px', textTransform: 'uppercase' }}>Team</div>
                    {searchResults.team.map(m => (
                      <div 
                        key={m.id} 
                        onClick={() => { setView('team'); setShowGlobalSearch(false); setGlobalSearchQuery(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                        onMouseEnter={e => e.currentTarget.style.background = t.bgCard}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <Avatar user={m} size={36} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: t.text }}>{m.name}</div>
                          <div style={{ fontSize: '11px', color: t.textMuted }}>{m.email}</div>
                        </div>
                        <RoleBadge role={m.role} />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* No Results */}
                {searchResults.projects.length === 0 && searchResults.assets.length === 0 && searchResults.team.length === 0 && (
                  <div style={{ padding: '40px', textAlign: 'center', color: t.textMuted }}>
                    <div style={{ marginBottom: '10px', opacity: 0.4 }}>{Icons.search(t.textMuted)}</div>
                    <div style={{ fontSize: '14px' }}>No results for "{globalSearchQuery}"</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Calendar View Component
  const CalendarView = () => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [draggedAsset, setDraggedAsset] = useState(null);
    
    const allAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted && a.dueDate).map(a => ({ ...a, projectName: p.name, projectId: p.id, _type: 'asset' })));
    const allTasks = (globalTasks || []).filter(t => t.dueDate && t.status !== 'done').map(t => ({ ...t, name: t.title, _type: 'task' }));
    const allCalendarItems = [...allAssets, ...allTasks];

    // Generate calendar days
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    
    const getItemsForDay = (day) => {
      if (!day) return [];
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return allCalendarItems.filter(a => a.dueDate?.startsWith(dateStr));
    };
    
    const handleDrop = async (day) => {
      if (!draggedAsset || !day) return;
      const newDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const project = projects.find(p => p.id === draggedAsset.projectId);
      if (!project) return;
      
      const updatedAssets = (project.assets || []).map(a => 
        a.id === draggedAsset.id ? { ...a, dueDate: newDate } : a
      );
      await updateProject(project.id, { assets: updatedAssets });
      await refreshProject();
      showToast('Deadline updated!', 'success');
      setDraggedAsset(null);
    };
    
    const today = new Date();
    const isToday = (day) => day && year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: t.text }}>Calendar</h1>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' }}>◀</button>
            <span style={{ fontSize: '14px', fontWeight: '600', color: t.text, minWidth: '160px', textAlign: 'center' }}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, cursor: 'pointer', fontSize: '14px', transition: 'background 0.2s' }}>▶</button>
            <div style={{ width: '1px', height: '20px', background: t.border, margin: '0 2px' }} />
            <button onClick={() => setCurrentMonth(new Date())} style={{ padding: '8px 14px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '20px', color: t.text, cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s' }}>Today</button>
          </div>
        </div>

        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '4px' }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} style={{ padding: '10px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: `${t.border}40`, border: `1px solid ${t.border}`, borderRadius: '14px', overflow: 'hidden' }}>
          {days.map((day, idx) => {
            const dayAssets = getItemsForDay(day);
            const isPast = day && new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const hasEvents = dayAssets.length > 0;
            const statusColors = { approved: '#22c55e', 'in-progress': '#6366f1', pending: '#f59e0b', revision: '#f97316' };

            return (
              <div
                key={idx}
                className={hasEvents ? 'hover-lift' : ''}
                onDragOver={e => { if (day) e.preventDefault(); }}
                onDrop={() => handleDrop(day)}
                style={{
                  minHeight: '110px',
                  padding: '8px',
                  background: t.bgCard,
                  borderLeft: isToday(day) ? '3px solid #6366f1' : 'none',
                  opacity: day ? (isPast ? 0.5 : 1) : 0.3,
                  transition: 'all 0.2s',
                  cursor: day ? 'default' : 'auto',
                  position: 'relative'
                }}
              >
                {day && (
                  <>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: isPast ? t.textMuted : t.text,
                      marginBottom: '6px',
                      transition: 'all 0.3s'
                    }}>
                      {day}
                    </div>

                    {/* Event bars */}
                    {dayAssets.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {dayAssets.slice(0, 2).map(a => {
                          const isTask = a._type === 'task';
                          const priorityColors = { urgent: '#ef4444', high: '#f97316', medium: '#fbbf24', low: '#22c55e' };
                          const bgColor = isTask
                            ? `${priorityColors[a.priority] || '#8b5cf6'}15`
                            : (a.status === 'approved' ? 'rgba(34,197,94,0.15)' : isPast ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)');
                          const borderColor = isTask
                            ? (priorityColors[a.priority] || '#8b5cf6')
                            : (statusColors[a.status] || t.primary);
                          return (
                            <div
                              key={a.id}
                              draggable={!isTask}
                              onDragStart={() => !isTask && setDraggedAsset(a)}
                              onDragEnd={() => setDraggedAsset(null)}
                              onClick={() => { if (a.projectId) { setSelectedProjectId(a.projectId); setView('projects'); } }}
                              style={{
                                padding: '3px 6px',
                                background: bgColor,
                                borderLeft: `2px solid ${borderColor}`,
                                borderRadius: '0 4px 4px 0',
                                fontSize: '11px',
                                cursor: isTask ? 'pointer' : 'grab',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: t.text,
                                transition: 'all 0.15s'
                              }}
                            >
                              {isTask ? '✓ ' : ''}{a.name}
                            </div>
                          );
                        })}
                        {dayAssets.length > 2 && <div style={{ fontSize: '11px', color: t.primary, fontWeight: '500', paddingLeft: '6px' }}>+{dayAssets.length - 2} more</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Kanban View Component (for assets)
  const KanbanView = ({ assets, onUpdateStatus, projectId }) => {
    const [draggedAsset, setDraggedAsset] = useState(null);
    
    // Reduced to 5 columns to fit better
    const columns = [
      { id: 'pending', title: 'Pending', color: '#fbbf24' },
      { id: 'in-progress', title: 'In Progress', color: '#8b5cf6' },
      { id: 'review-ready', title: 'Review', color: '#a855f7' },
      { id: 'revision', title: 'Revision', color: '#f97316' },
      { id: 'approved', title: 'Approved', color: '#22c55e' },
    ];
    
    const handleDrop = async (status) => {
      if (!draggedAsset || draggedAsset.status === status) return;
      await onUpdateStatus(draggedAsset.id, status);
      setDraggedAsset(null);
    };
    
    return (
      <div style={{ 
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '8px',
        width: '100%'
      }}>
        {columns.map(col => {
          const colAssets = assets.filter(a => a.status === col.id);
          
          return (
            <div 
              key={col.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
              style={{ 
                background: t.bgTertiary, 
                borderRadius: '8px', 
                border: `1px solid ${t.border}`,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0
              }}
            >
              {/* Column Header */}
              <div style={{ 
                padding: '8px 10px', 
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: col.color, flexShrink: 0 }} />
                <span style={{ fontSize: '10px', fontWeight: '600', color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.title}</span>
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: '9px', 
                  padding: '2px 5px', 
                  background: `${col.color}20`,
                  color: col.color,
                  borderRadius: '6px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {colAssets.length}
                </span>
              </div>
              
              {/* Column Content */}
              <div style={{ flex: 1, padding: '6px', minHeight: '120px', maxHeight: '350px', overflowY: 'auto' }}>
                {colAssets.length === 0 ? (
                  <div style={{ 
                    padding: '16px 8px', 
                    textAlign: 'center', 
                    color: t.textMuted,
                    fontSize: '9px',
                    border: `1px dashed ${t.border}`,
                    borderRadius: '6px'
                  }}>
                    Drop here
                  </div>
                ) : colAssets.map(a => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDraggedAsset(a)}
                    onDragEnd={() => setDraggedAsset(null)}
                    onClick={() => setSelectedAsset(a)}
                    style={{
                      padding: '6px',
                      background: t.bgCard,
                      borderRadius: '6px',
                      marginBottom: '6px',
                      cursor: 'grab',
                      border: `1px solid ${draggedAsset?.id === a.id ? col.color : t.border}`,
                      transition: 'all 0.15s',
                      opacity: draggedAsset?.id === a.id ? 0.5 : 1
                    }}
                  >
                    {a.thumbnail && (
                      <div style={{ 
                        width: '100%', 
                        paddingBottom: '100%', /* 1:1 Square aspect ratio */
                        position: 'relative',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        background: t.bgInput
                      }}>
                        <img 
                          src={a.thumbnail} 
                          alt="" 
                          style={{ 
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover'
                          }} 
                        />
                        {/* Rating overlay */}
                        {a.rating > 0 && (
                          <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 4px', fontSize: '9px' }}>
                            {a.rating}/5 ★
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '10px', fontWeight: '500', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name?.replace(/\.[^/.]+$/, '').substring(0, 20)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // File Comparison Component
  const FileComparison = ({ version1, version2, onClose }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef(null);
    
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percent);
    };
    
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1200, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#ef4444' }}>◀ v{version1.version}</span>
            <span style={{ fontSize: '14px', color: t.text }}>Compare</span>
            <span style={{ fontSize: '14px', color: '#22c55e' }}>v{version2.version} ▶</span>
          </div>
          <button onClick={onClose} style={{ background: t.bgCard, border: 'none', color: t.text, width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>
        
        {/* Comparison Area */}
        <div 
          ref={containerRef}
          onMouseMove={handleMouseMove}
          style={{ flex: 1, position: 'relative', cursor: 'col-resize', overflow: 'hidden' }}
        >
          {/* Before (v1) */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <img src={version1.url} alt="Before" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          
          {/* After (v2) - clipped */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
            <img src={version2.url} alt="After" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          
          {/* Slider */}
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            bottom: 0, 
            left: `${sliderPosition}%`, 
            width: '4px', 
            background: '#fff',
            transform: 'translateX(-50%)',
            cursor: 'col-resize'
          }}>
            <div style={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)', 
              width: '40px', 
              height: '40px', 
              background: '#fff', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              ⟷
            </div>
          </div>
          
          {/* Labels */}
          <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(239,68,68,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
            Before (v{version1.version})
          </div>
          <div style={{ position: 'absolute', bottom: '20px', right: '20px', background: 'rgba(34,197,94,0.9)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
            After (v{version2.version})
          </div>
        </div>
      </div>
    );
  };

  const Sidebar = () => {
    const sidebarWidth = sidebarCollapsed ? '60px' : '240px';
    const navItems = [
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', shortcut: '\u2318 1' },
      { id: 'tasks', icon: 'tasks', label: 'My Tasks', shortcut: '\u2318 2' },
      { id: 'projects', icon: 'folder', label: 'Projects', shortcut: '\u2318 3' },
      { id: 'calendar', icon: 'calendar', label: 'Calendar', shortcut: '\u2318 4' },
      ...(isClientView ? [{ id: 'downloads', icon: 'download', label: 'Downloads', shortcut: '\u2318 5' }] : []),
      ...(isProducer ? [{ id: 'team', icon: 'users', label: 'Team', shortcut: isClientView ? '\u2318 6' : '\u2318 5' }] : []),
      ...(canManageEmployeesNow ? [{ id: 'employees', icon: 'user', label: 'Employees', shortcut: '\u2318 6', badge: hrPendingCount }] : []),
      ...(isProducer || canManageEmployeesNow ? [{ id: 'releases', icon: 'document', label: 'Releases', shortcut: '\u2318 7' }] : [])
    ];

    return (
      <div style={{
        width: isMobile ? '100%' : sidebarWidth,
        background: t.bgSecondary,
        borderRight: isMobile ? 'none' : `1px solid ${t.borderLight}`,
        borderBottom: isMobile ? `1px solid ${t.border}` : 'none',
        height: isMobile ? 'auto' : '100vh',
        position: isMobile ? 'relative' : 'fixed',
        left: 0,
        top: 0,
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        zIndex: 1100,
        transition: 'width 0.2s ease'
      }}>
        {/* Logo Section */}
        {!isMobile && (
          <div style={{
            padding: sidebarCollapsed ? '16px 10px 14px' : '18px 16px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            borderBottom: `1px solid ${t.borderLight}`
          }}>
            <Logo
              variant={sidebarCollapsed ? 'icon' : 'full'}
              size={sidebarCollapsed ? 28 : 32}
              theme={theme}
            />
          </div>
        )}

        {/* Search Button */}
        {!isMobile && (
          <div style={{ padding: '10px' }}>
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="glass"
              style={{
                width: '100%',
                padding: sidebarCollapsed ? '10px' : '9px 12px',
                background: t.bgInput,
                border: `1px solid ${t.borderLight}`,
                borderRadius: '10px',
                color: t.textMuted,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: '8px',
                textAlign: 'left',
                transition: 'all 0.2s ease'
              }}
            >
              {Icons.search(t.textMuted)}
              {!sidebarCollapsed && <span style={{ flex: 1 }}>Search</span>}
              {!sidebarCollapsed && (
                <span style={{
                  fontSize: '10px',
                  background: t.bgTertiary,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  color: t.textMuted,
                  fontFamily: 'monospace'
                }}>/</span>
              )}
            </button>
          </div>
        )}

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: isMobile ? '6px 8px' : '8px 10px',
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          gap: '4px',
          alignItems: isMobile ? 'center' : 'stretch',
          overflowY: isMobile ? 'visible' : 'auto'
        }}>
          {isMobile && <NotificationPanel />}
          {isMobile && (
            <button
              onClick={() => setShowGlobalSearch(true)}
              style={{ padding: '10px', minHeight: '44px', minWidth: '44px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {Icons.search(t.textSecondary)}
            </button>
          )}
          {navItems.map(item => {
            const isActive = view === item.id;
            return (
              <div
                key={item.id}
                onClick={() => { setView(item.id); setSelectedProjectId(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: sidebarCollapsed ? '10px' : '9px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: isActive ? '600' : '400',
                  background: isActive ? `${t.primary}15` : 'transparent',
                  color: isActive ? t.primary : t.textSecondary,
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  ...(isMobile && isActive ? { borderBottom: `2px solid ${t.primary}`, borderRadius: '0', background: `${t.primary}10` } : {}),
                  ...(isMobile ? { padding: '10px 12px', minHeight: '44px', minWidth: '44px', justifyContent: 'center' } : {})
                }}
                title={sidebarCollapsed ? item.label : ''}
                onMouseEnter={e => {
                  if (!isActive && !isMobile) {
                    e.currentTarget.style.background = t.bgHover;
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive && !isMobile) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }
                }}
              >
                {/* Active gradient bar */}
                {isActive && !isMobile && (
                  <div style={{
                    position: 'absolute',
                    left: '0',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '60%',
                    borderRadius: '0 3px 3px 0',
                    background: `linear-gradient(180deg, ${t.primary}, ${t.accent || t.primary})`,
                  }} />
                )}
                {Icons[item.icon] && Icons[item.icon](isActive ? t.primary : t.textSecondary)}
                {!isMobile && !sidebarCollapsed && (
                  <>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span style={{
                        background: t.danger,
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '999px',
                        minWidth: '16px',
                        textAlign: 'center',
                        lineHeight: '1.2',
                      }}>{item.badge}</span>
                    )}
                    <span style={{
                      fontSize: '10px',
                      color: t.textMuted,
                      opacity: 0.5,
                      fontFamily: 'monospace',
                      fontWeight: '400'
                    }}>{item.shortcut}</span>
                  </>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom Section */}
        {!isMobile && (
          <div style={{ padding: sidebarCollapsed ? '8px' : '12px 14px', borderTop: `1px solid ${t.borderLight}`, flexShrink: 0 }}>
            {/* User Profile Card */}
            {!sidebarCollapsed ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px',
                marginBottom: '8px',
                background: t.bgCard,
                border: `1px solid ${t.borderLight}`,
                borderRadius: '10px'
              }}>
                <Avatar user={userProfile} size={32} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.firstName}</div>
                  <div style={{ fontSize: '10px', color: t.textMuted }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div>
                </div>
                <NotificationPanel />
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <NotificationPanel />
              </div>
            )}

            {/* Action buttons row */}
            <div style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '8px',
              flexDirection: sidebarCollapsed ? 'column' : 'row',
              flexWrap: 'wrap'
            }}>
              {/* Theme Toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                style={{
                  flex: sidebarCollapsed ? 'none' : 1,
                  minWidth: 0,
                  width: sidebarCollapsed ? '100%' : 'auto',
                  padding: '7px 6px',
                  background: t.bgCard,
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '8px',
                  color: t.textSecondary,
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              >
                {theme === 'dark' ? Icons.sun(t.textSecondary) : Icons.moon(t.textSecondary)}
                {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
              </button>

              {/* Settings */}
              {isProducer && (
                <button
                  onClick={() => setShowCompanySettings(true)}
                  style={{
                    flex: sidebarCollapsed ? 'none' : 1,
                    minWidth: 0,
                    width: sidebarCollapsed ? '100%' : 'auto',
                    padding: '7px 6px',
                    background: 'transparent',
                    border: `1px solid ${t.borderLight}`,
                    borderRadius: '8px',
                    color: t.textSecondary,
                    fontSize: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                  title="Company Settings"
                >
                  {Icons.settings(t.textSecondary)}
                  {!sidebarCollapsed && <span>Settings</span>}
                </button>
              )}

              {/* Sign Out */}
              <button
                onClick={signOut}
                style={{
                  flex: sidebarCollapsed ? 'none' : 1,
                  minWidth: 0,
                  width: sidebarCollapsed ? '100%' : 'auto',
                  padding: '7px 6px',
                  background: 'transparent',
                  border: `1px solid ${t.borderLight}`,
                  borderRadius: '8px',
                  color: t.textSecondary,
                  fontSize: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
                title="Sign Out"
              >
                {Icons.logout(t.textSecondary)}
                {!sidebarCollapsed && <span>Exit</span>}
              </button>
            </div>

            {/* Collapse Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease',
                opacity: 0.5
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = t.bgHover; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? Icons.chevronRight(t.textMuted) : Icons.chevronLeft(t.textMuted)}
            </button>
          </div>
        )}
      </div>
    );
  };

  const Dashboard = () => {
    const activeProjects = projects.filter(p => p.status === 'active');
    const completedProjects = projects.filter(p => p.status === 'completed');
    const allAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    // Calculate stats
    const overdueAssets = allAssets.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'delivered' && a.status !== 'approved');
    const dueThisWeek = allAssets.filter(a => {
      if (!a.dueDate) return false;
      const due = new Date(a.dueDate);
      return due >= today && due <= weekEnd && a.status !== 'delivered' && a.status !== 'approved';
    });
    const pendingReview = allAssets.filter(a => a.status === 'review-ready');
    const inProgress = allAssets.filter(a => a.status === 'in-progress');
    
    const recentActivity = projects.flatMap(p => (p.activityLog || []).map(a => ({ ...a, projectName: p.name, projectId: p.id }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    
    // Team workload
    const teamWorkload = [...coreTeam, ...freelancers].map(member => {
      const assignedAssets = allAssets.filter(a => a.assignedTo === member.id || a.assignedTo === member.email);
      const activeAssigned = assignedAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
      return { ...member, totalAssigned: activeAssigned.length, overdue: activeAssigned.filter(a => a.dueDate && new Date(a.dueDate) < today).length };
    }).filter(m => m.totalAssigned > 0).sort((a, b) => b.totalAssigned - a.totalAssigned);
    
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    const revisionAssets = allAssets.filter(a => a.status === 'revision');
    const approvedDelivered = allAssets.filter(a => a.status === 'approved' || a.status === 'delivered');
    const overallProgress = allAssets.length > 0 ? Math.round((approvedDelivered.length / allAssets.length) * 100) : 0;

    // Activity grouping helper
    const groupActivity = (items) => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const groups = { today: [], yesterday: [], earlier: [] };
      items.forEach(item => {
        const ts = new Date(item.timestamp);
        if (ts >= todayStart) groups.today.push(item);
        else if (ts >= yesterdayStart) groups.yesterday.push(item);
        else groups.earlier.push(item);
      });
      return groups;
    };
    const activityGroups = groupActivity(recentActivity);

    // Activity icon based on message content
    const getActivityIcon = (msg) => {
      if (!msg) return 'bell';
      const m = msg.toLowerCase();
      if (m.includes('upload') || m.includes('added')) return 'upload';
      if (m.includes('comment') || m.includes('message')) return 'message';
      if (m.includes('approv') || m.includes('deliver')) return 'check';
      if (m.includes('review')) return 'eye';
      if (m.includes('creat') || m.includes('new')) return 'plus';
      if (m.includes('edit') || m.includes('updat')) return 'edit';
      if (m.includes('assign')) return 'user';
      return 'bell';
    };

    // Glass card style helper
    const glassCard = (extra = {}) => ({
      background: t.bgGlass,
      backdropFilter: t.blur,
      WebkitBackdropFilter: t.blur,
      borderRadius: t.cardRadius,
      border: `1px solid ${t.bgGlassBorder}`,
      boxShadow: t.shadowGlass,
      ...extra,
    });

    // Needs Attention items
    const attentionItems = [];
    overdueAssets.forEach(a => {
      const proj = projects.find(p => p.id === a.projectId || (p.assets || []).some(pa => pa.id === a.id));
      attentionItems.push({ type: 'overdue', asset: a, projectName: proj?.name || 'Unknown', color: '#ef4444', label: 'Overdue', priority: 1 });
    });
    allAssets.filter(a => a.status === 'revision').forEach(a => {
      const proj = projects.find(p => (p.assets || []).some(pa => pa.id === a.id));
      attentionItems.push({ type: 'revision', asset: a, projectName: proj?.name || 'Unknown', color: '#f97316', label: 'Changes requested', priority: 2 });
    });
    pendingReview.forEach(a => {
      const proj = projects.find(p => (p.assets || []).some(pa => pa.id === a.id));
      attentionItems.push({ type: 'review', asset: a, projectName: proj?.name || 'Unknown', color: '#a855f7', label: 'Needs review', priority: 3 });
    });
    attentionItems.sort((a, b) => a.priority - b.priority);

    return (
      <div style={{ overflow: 'auto', paddingBottom: '32px' }}>
        {/* 1. Command Strip */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: t.text }}>{greeting}, {userProfile?.firstName}</h1>
            <span style={{ fontSize: '13px', color: t.textMuted }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
            {(() => {
              const pills = [];
              if (overdueAssets.length > 0) pills.push({ label: `${overdueAssets.length} Overdue`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: 'alert' });
              if (pendingReview.length > 0) pills.push({ label: `${pendingReview.length} Pending Review`, color: '#a855f7', bg: 'rgba(168,85,247,0.1)', icon: 'eye' });
              if (revisionAssets.length > 0) pills.push({ label: `${revisionAssets.length} Changes Requested`, color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: 'edit' });
              if (pills.length === 0) pills.push({ label: 'All clear', color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: 'check' });
              return pills.map(pill => (
                <button key={pill.label} onClick={() => setView('tasks')} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer', border: 'none', background: pill.bg, color: pill.color,
                }}>
                  {Icons[pill.icon] && Icons[pill.icon](pill.color)}
                  {pill.label}
                </button>
              ));
            })()}
          </div>
        </div>

        {/* 2. Pulse Bar */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '28px', padding: '20px 0 16px', flexWrap: 'wrap' }}>
          {[
            { label: 'Active Projects', value: activeProjects.length, color: '#6366f1' },
            { label: 'Due This Week', value: dueThisWeek.length, color: '#f59e0b' },
            { label: 'Overdue', value: overdueAssets.length, color: overdueAssets.length > 0 ? '#ef4444' : '#64748b' },
            { label: 'Pending Review', value: pendingReview.length, color: '#a855f7' },
            { label: 'In Progress', value: inProgress.length, color: '#22c55e' },
            { label: 'Completed', value: completedProjects.length, color: '#64748b' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'left' }}>
              <div style={{ fontSize: isMobile ? '22px' : '28px', fontWeight: 700, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: '11px', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>{m.label}</div>
            </div>
          ))}
        </div>
        <div style={{ height: '3px', background: t.border, borderRadius: '2px', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${overallProgress}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
        </div>

        {/* 4. Netflix Project Row */}
        {(() => {
          const typeGradients = {
            'photoshoot': 'linear-gradient(135deg, #ec489930, #a855f720)',
            'ad-film': 'linear-gradient(135deg, #f9731630, #ef444420)',
            'product-video': 'linear-gradient(135deg, #3b82f630, #06b6d420)',
            'toolkit': 'linear-gradient(135deg, #6366f130, #a855f720)',
            'social-media': 'linear-gradient(135deg, #ec489930, #f9731620)',
            'corporate': 'linear-gradient(135deg, #64748b30, #3b82f620)',
            'music-video': 'linear-gradient(135deg, #a855f730, #ec489920)',
            'brand-film': 'linear-gradient(135deg, #f97316, #ef444420)',
            'reels': 'linear-gradient(135deg, #f43f5e30, #a855f720)',
            'ecommerce': 'linear-gradient(135deg, #10b98130, #3b82f620)',
            'event': 'linear-gradient(135deg, #fbbf2430, #f9731620)',
            'documentary': 'linear-gradient(135deg, #78716c30, #a855f720)',
          };
          return (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: t.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Recent Projects
                  <span style={{ fontSize: '11px', color: t.textMuted, fontWeight: '400' }}>({activeProjects.length})</span>
                </h3>
                <button onClick={() => setView('projects')} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>View All →</button>
              </div>
              <div className="netflix-row">
                {activeProjects.slice(0, 8).map(p => {
                  const pAssets = (p.assets || []).filter(a => !a.deleted);
                  const pApproved = pAssets.filter(a => a.status === 'approved' || a.status === 'delivered').length;
                  const progressPct = pAssets.length > 0 ? Math.round((pApproved / pAssets.length) * 100) : 0;
                  const firstThumb = (p.assets || []).find(a => !a.deleted && a.type === 'image' && a.thumbnailUrl);
                  const pendingCount = pAssets.filter(a => a.status === 'review-ready' || a.status === 'revision').length;
                  return (
                    <div
                      key={p.id}
                      onClick={() => { setSelectedProjectId(p.id); setView('projects'); }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = t.border; }}
                      style={{
                        width: isMobile ? '160px' : '200px',
                        borderRadius: t.cardRadius,
                        overflow: 'hidden',
                        background: t.bgGlass,
                        backdropFilter: t.blur,
                        WebkitBackdropFilter: t.blur,
                        border: `1px solid ${t.bgGlassBorder}`,
                        boxShadow: t.shadowGlass,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {/* Thumbnail area */}
                      <div style={{
                        height: isMobile ? '100px' : '140px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: firstThumb ? `url(${firstThumb.thumbnailUrl}) center/cover` : (typeGradients[p.type] || 'linear-gradient(135deg, #6366f130, #a855f720)'),
                      }}>
                        {!firstThumb && (
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1px' }}>{(p.type || 'project').replace(/-/g, ' ')}</span>
                        )}
                        {/* Status dot */}
                        <div style={{
                          position: 'absolute', top: '8px', right: '8px',
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: p.status === 'active' ? '#22c55e' : '#6366f1',
                        }} />
                        {/* Notification badge */}
                        {pendingCount > 0 && (
                          <div style={{
                            position: 'absolute', top: '6px', left: '6px',
                            minWidth: '18px', height: '18px', borderRadius: '9px',
                            background: '#ef4444', color: '#fff',
                            fontSize: '10px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 4px',
                          }}>{pendingCount}</div>
                        )}
                      </div>
                      {/* Content area */}
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{p.client}</div>
                        <div style={{ marginTop: '10px', height: '3px', background: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px', textAlign: 'right' }}>{progressPct}%</div>
                      </div>
                    </div>
                  );
                })}
                {activeProjects.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: t.textMuted, fontSize: '12px' }}>No active projects</div>}
              </div>
            </div>
          );
        })()}

        {/* 5. Two-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: '16px' }}>
          {/* Left Column (60%) — Needs Attention */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                {Icons.alert(t.textSecondary)}
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: t.text }}>Needs Attention</h3>
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {attentionItems.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
                    {Icons.check('#22c55e')}
                    <div style={{ fontSize: '13px', color: t.textMuted, marginTop: '8px' }}>Nothing needs your attention</div>
                  </div>
                ) : (
                  attentionItems.map((item, idx) => {
                    const proj = projects.find(p => (p.assets || []).some(pa => pa.id === item.asset.id));
                    return (
                      <div
                        key={`${item.type}-${item.asset.id}-${idx}`}
                        onClick={() => { if (proj) { setSelectedProjectId(proj.id); setView('projects'); } }}
                        style={{
                          padding: '12px 14px',
                          background: t.bgGlass,
                          backdropFilter: t.blur,
                          WebkitBackdropFilter: t.blur,
                          borderRadius: '12px',
                          marginBottom: '8px',
                          borderLeft: `3px solid ${item.color}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{item.asset.name}</div>
                          <div style={{ fontSize: '11px', color: t.textMuted, flexShrink: 0, marginLeft: '8px' }}>{formatTimeAgo(item.asset.dueDate || item.asset.updatedAt || '')}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: t.textMuted }}>{item.projectName}</span>
                          <span style={{
                            fontSize: '10px',
                            color: item.color,
                            background: `${item.color}1a`,
                            padding: '1px 8px',
                            borderRadius: '10px',
                            fontWeight: 500,
                          }}>{item.label}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column (40%) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* Activity Feed */}
            <div>
              <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {Icons.bell(t.textSecondary)} Activity
              </h3>
              <div className="stagger-children" style={{ maxHeight: isMobile ? '250px' : '320px', overflowY: 'auto', position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: `${t.border}`, borderRadius: '1px' }} />
                {Object.entries(activityGroups).map(([group, items]) => items.length > 0 && (
                  <div key={group} style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', paddingLeft: '22px' }}>
                      {group === 'today' ? 'Today' : group === 'yesterday' ? 'Yesterday' : 'Earlier'}
                    </div>
                    {items.map(a => {
                      const actIcon = getActivityIcon(a.message);
                      return (
                        <div key={a.id} className="animate-fadeInUp" onClick={() => { setSelectedProjectId(a.projectId); setView('projects'); }} style={{ display: 'flex', gap: '10px', padding: '6px 0', cursor: 'pointer', position: 'relative' }}>
                          {/* Timeline dot */}
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: t.bgCard, border: `2px solid #6366f1`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                            <div style={{ transform: 'scale(0.55)' }}>{Icons[actIcon] && Icons[actIcon]('#6366f1')}</div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0, paddingBottom: '8px' }}>
                            <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{a.message}</div>
                            <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px' }}>
                              <span style={{ color: '#6366f1', cursor: 'pointer' }}>{a.projectName}</span> {'\u2022'} {formatTimeAgo(a.timestamp)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '32px', color: t.textMuted, fontSize: '12px', position: 'relative' }}>No recent activity</div>}
              </div>
            </div>

            {/* Team Workload (compact) */}
            {teamWorkload.length > 0 && (
              <div style={{ ...glassCard({ padding: isMobile ? '14px' : '20px' }) }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {Icons.users(t.textSecondary)} Team Workload
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: isMobile ? '200px' : '260px', overflowY: 'auto' }}>
                  {teamWorkload.slice(0, 6).map(m => {
                    const loadColor = m.totalAssigned >= 8 ? '#ef4444' : m.totalAssigned >= 5 ? '#f59e0b' : '#22c55e';
                    const loadPct = Math.min((m.totalAssigned / 10) * 100, 100);
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar user={m} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: loadColor, flexShrink: 0, marginLeft: '6px' }}>{m.totalAssigned}{m.overdue > 0 && <span style={{ color: '#ef4444', fontSize: '9px' }}> ({m.overdue} late)</span>}</span>
                          </div>
                          <div style={{ height: '4px', background: `${t.border}`, borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${loadPct}%`, background: loadColor, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  // PHASE B: Advanced Task Management View - Card-Based Kanban UI
  const TasksView = () => {
    // View mode: 'kanban' | 'grid' | 'list'
    const [viewMode, setViewMode] = useState('kanban');
    const [taskTab, setTaskTab] = useState('all'); // all, my, team, today, week, overdue
    const [projectFilter, setProjectFilter] = useState('all');
    const [showAddTask, setShowAddTask] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [expandedTask, setExpandedTask] = useState(null);
    const [editingTask, setEditingTask] = useState(null);
    const [hoveredTask, setHoveredTask] = useState(null);
    const [draggedTask, setDraggedTask] = useState(null);
    const [dragOverColumn, setDragOverColumn] = useState(null);
    
    // Quick add state with enhanced features
    const [quickAdd, setQuickAdd] = useState({
      text: '',
      date: new Date().toISOString().split('T')[0],
      projectId: '',
      assignedTo: [],
      priority: 'medium',
      showOptions: false
    });
    
    // Subtask suggestions state
    const [suggestedSubtasks, setSuggestedSubtasks] = useState([]);
    const [newSubtaskText, setNewSubtaskText] = useState('');
    
    // New task form state
    const [newTask, setNewTask] = useState({
      title: '',
      description: '',
      type: 'team',
      priority: 'medium',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '',
      projectId: '',
      assignedTo: [],
      recurring: { enabled: false, frequency: 'weekly', days: [], endDate: '' },
      subtasks: [],
    });
    
    // Template form state
    const [templateProjectId, setTemplateProjectId] = useState('');
    const [templateAssignees, setTemplateAssignees] = useState({});
    const [selectedTemplate, setSelectedTemplate] = useState('');
    
    // Kanban columns
    const COLUMNS = [
      { id: 'pending', title: 'To Do', color: '#6366f1' },
      { id: 'in-progress', title: 'In Progress', color: '#f59e0b' },
      { id: 'review', title: 'Review', color: '#8b5cf6' },
      { id: 'done', title: 'Done', color: '#22c55e' }
    ];
    
    // Priority colors and icons
    const priorityColors = { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const priorityIcons = { urgent: '!!', high: '!', medium: '--', low: '~' };

    // Get intelligent subtask suggestions based on task title
    const getSubtaskSuggestions = (title) => {
      if (!title) return [];
      const words = title.toLowerCase().split(/\s+/);
      const suggestions = new Set();
      
      words.forEach(word => {
        // Direct match
        if (SUBTASK_SUGGESTIONS[word]) {
          SUBTASK_SUGGESTIONS[word].forEach(s => suggestions.add(s));
        }
        // Partial match (word starts with key)
        Object.keys(SUBTASK_SUGGESTIONS).forEach(key => {
          if (word.startsWith(key) || key.startsWith(word)) {
            SUBTASK_SUGGESTIONS[key].forEach(s => suggestions.add(s));
          }
        });
      });
      
      return Array.from(suggestions).slice(0, 6);
    };
    
    // Update suggestions when title changes
    useEffect(() => {
      if (newTask.title || quickAdd.text) {
        const title = newTask.title || quickAdd.text;
        setSuggestedSubtasks(getSubtaskSuggestions(title));
      } else {
        setSuggestedSubtasks([]);
      }
    }, [newTask.title, quickAdd.text]);
    
    // Get auto-generated tasks from assigned assets
    const getAutoTasks = () => {
      const tasks = [];
      projects.forEach(project => {
        (project.assets || []).forEach(asset => {
          if (asset.deleted) return;
          if (asset.assignedTo === userProfile?.id || asset.assignedTo === userProfile?.email) {
            if (asset.status !== 'delivered' && asset.status !== 'approved') {
              tasks.push({
                id: `auto-${asset.id}`,
                type: 'auto',
                title: `${asset.name}`,
                projectId: project.id,
                projectName: project.name,
                assetId: asset.id,
                status: asset.status === 'pending' ? 'pending' : 'in-progress',
                dueDate: asset.dueDate || project.deadline,
                priority: asset.dueDate && new Date(asset.dueDate) < new Date() ? 'high' : 'medium',
                category: asset.category,
                assignedTo: [asset.assignedTo],
                subtasks: [],
                createdBy: 'system'
              });
            }
          }
        });
      });
      return tasks;
    };
    
    // Combine all tasks
    const allTasks = [...getAutoTasks(), ...globalTasks];
    
    // Date helpers
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    // Filter tasks
    const filterTasks = (tasks) => {
      let filtered = tasks;
      
      switch (taskTab) {
        case 'my':
          filtered = filtered.filter(t => 
            t.createdBy === userProfile?.id || 
            (t.assignedTo || []).includes(userProfile?.id) ||
            t.type === 'auto'
          );
          break;
        case 'team':
          filtered = filtered.filter(t => t.type !== 'personal');
          break;
        case 'today':
          filtered = filtered.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          });
          break;
        case 'week':
          filtered = filtered.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= today && due <= weekEnd;
          });
          break;
        case 'overdue':
          filtered = filtered.filter(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < today && t.status !== 'done';
          });
          break;
      }
      
      if (projectFilter !== 'all') {
        filtered = filtered.filter(t => t.projectId === projectFilter);
      }
      
      return filtered;
    };
    
    const filteredTasks = filterTasks(allTasks);
    
    // Stats
    const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'done');
    const todayTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });
    const activeTasks = allTasks.filter(t => t.status !== 'done');
    const completedTasks = allTasks.filter(t => t.status === 'done');
    
    // Group tasks by status for Kanban
    const tasksByStatus = COLUMNS.reduce((acc, col) => {
      acc[col.id] = filteredTasks.filter(t => t.status === col.id);
      return acc;
    }, {});
    
    // Quick add with enhanced options
    const handleQuickAdd = () => {
      if (!quickAdd.text.trim()) return;
      
      const project = projects.find(p => p.id === quickAdd.projectId);
      createTask({
        title: quickAdd.text,
        type: quickAdd.assignedTo.length > 0 ? 'team' : (isProducer ? 'team' : 'personal'),
        dueDate: quickAdd.date,
        priority: quickAdd.priority,
        projectId: quickAdd.projectId || null,
        projectName: project?.name || null,
        assignedTo: quickAdd.assignedTo,
      });
      
      setQuickAdd({
        text: '',
        date: new Date().toISOString().split('T')[0],
        projectId: '',
        assignedTo: [],
        priority: 'medium',
        showOptions: false
      });
      showToast('Task added', 'success');
    };
    
    // Handle add task from modal
    const handleAddTask = () => {
      if (!newTask.title.trim()) return;
      const project = projects.find(p => p.id === newTask.projectId);
      createTask({
        ...newTask,
        projectName: project?.name || null
      });
      setNewTask({
        title: '',
        description: '',
        type: 'team',
        priority: 'medium',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '',
        projectId: '',
        assignedTo: [],
        recurring: { enabled: false, frequency: 'weekly', days: [], endDate: '' },
        subtasks: [],
      });
      setShowAddTask(false);
      showToast('Task created', 'success');
    };
    
    // Handle template creation
    const handleCreateFromTemplate = () => {
      if (!selectedTemplate) return;
      createTaskFromTemplate(selectedTemplate, templateProjectId || null, templateAssignees);
      setShowTemplates(false);
      setSelectedTemplate('');
      setTemplateProjectId('');
      setTemplateAssignees({});
    };
    
    // Drag and drop handlers
    const handleDragStart = (e, task) => {
      if (task.type === 'auto') return;
      setDraggedTask(task);
      e.dataTransfer.effectAllowed = 'move';
    };
    
    const handleDragOver = (e, columnId) => {
      e.preventDefault();
      setDragOverColumn(columnId);
    };
    
    const handleDragLeave = () => {
      setDragOverColumn(null);
    };
    
    const handleDrop = (e, columnId) => {
      e.preventDefault();
      if (draggedTask && draggedTask.status !== columnId) {
        updateTask(draggedTask.id, { status: columnId });
        showToast(`Moved to ${COLUMNS.find(c => c.id === columnId)?.title}`, 'success');
      }
      setDraggedTask(null);
      setDragOverColumn(null);
    };
    
    // Inline edit handler
    const handleInlineEdit = (taskId, field, value) => {
      updateTask(taskId, { [field]: value });
    };
    
    // Get all team members for assignee picker
    const allTeamMembers = [...users, ...freelancers, ...coreTeam];
    
    // Compact Task Card Component
    const TaskCard = ({ task, compact = true }) => {
      const isExpanded = expandedTask === task.id;
      const isHovered = hoveredTask === task.id;
      const isEditing = editingTask === task.id;
      const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'done';
      const isDragging = draggedTask?.id === task.id;
      const completedSubtasks = (task.subtasks || []).filter(st => st.done).length;
      const totalSubtasks = (task.subtasks || []).length;
      const assignees = (task.assignedTo || []).map(id => 
        allTeamMembers.find(u => u.id === id)
      ).filter(Boolean);
      
      // Editable title state
      const [editTitle, setEditTitle] = useState(task.title);
      
      const handleSaveEdit = () => {
        if (editTitle.trim() && editTitle !== task.title) {
          updateTask(task.id, { title: editTitle });
        }
        setEditingTask(null);
      };
      
      return (
        <div
          className="hover-lift"
          draggable={task.type !== 'auto'}
          onDragStart={(e) => handleDragStart(e, task)}
          onMouseEnter={() => setHoveredTask(task.id)}
          onMouseLeave={() => setHoveredTask(null)}
          style={{
            background: t.bgGlass,
            backdropFilter: t.blur,
            WebkitBackdropFilter: t.blur,
            borderRadius: '14px',
            borderLeft: `3px solid ${priorityColors[task.priority] || priorityColors.medium}`,
            borderRight: `1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : isDragging ? t.primary : t.bgGlassBorder}`,
            borderTop: `1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : isDragging ? t.primary : t.bgGlassBorder}`,
            borderBottom: `1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : isDragging ? t.primary : t.bgGlassBorder}`,
            boxShadow: t.shadowGlass,
            marginBottom: '10px',
            overflow: 'hidden',
            transition: 'all 0.2s',
            opacity: isDragging ? 0.5 : 1,
            cursor: task.type === 'auto' ? 'default' : 'grab',
          }}
        >
          
          {/* Card content */}
          <div style={{ padding: '12px' }}>
            {/* Top row: checkbox + title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
              {/* Checkbox */}
              <div 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (task.type !== 'auto') toggleTaskComplete(task.id);
                }}
                style={{ 
                  width: '20px', 
                  height: '20px', 
                  borderRadius: '5px', 
                  border: task.status === 'done' ? 'none' : `2px solid ${t.border}`,
                  background: task.status === 'done' ? t.success : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: task.type === 'auto' ? 'default' : 'pointer',
                  flexShrink: 0,
                  marginTop: '2px'
                }}
              >
                {task.status === 'done' && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}
              </div>
              
              {/* Title */}
              {isEditing ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  style={{
                    flex: 1,
                    background: t.bgInput,
                    border: `1px solid ${t.primary}`,
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: t.text,
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              ) : (
                <div
                  onDoubleClick={() => task.type !== 'auto' && setEditingTask(task.id)}
                  style={{
                    flex: 1,
                    fontWeight: '500',
                    fontSize: '13px',
                    color: t.text,
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    opacity: task.status === 'done' ? 0.6 : 1,
                    lineHeight: '1.4',
                    cursor: task.type === 'auto' ? 'default' : 'text',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {task.type === 'feedback' && 'Feedback: '}
                  {task.type === 'auto' && 'Auto: '}
                  {task.title}
                </div>
              )}
              
              {/* Priority indicator */}
              <span style={{ fontSize: '12px', flexShrink: 0 }} title={task.priority}>
                {priorityIcons[task.priority]}
              </span>
            </div>
            
            {/* Meta row */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: isExpanded ? '12px' : 0 }}>
              {task.projectName && (
                <span style={{ 
                  fontSize: '10px', 
                  color: t.primary, 
                  background: `${t.primary}15`, 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  whiteSpace: 'nowrap',
                  maxWidth: '100px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {task.projectName}
                </span>
              )}
              {task.dueDate && (
                <span style={{ 
                  fontSize: '10px', 
                  color: isOverdue ? '#ef4444' : t.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {totalSubtasks > 0 && (
                <span style={{
                  fontSize: '10px',
                  color: completedSubtasks === totalSubtasks ? t.success : t.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    display: 'inline-block',
                    width: '36px',
                    height: '4px',
                    background: `${t.border}`,
                    borderRadius: '2px',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <span style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                      background: completedSubtasks === totalSubtasks ? t.success : t.primary,
                      borderRadius: '2px',
                      transition: 'width 0.3s'
                    }} />
                  </span>
                  {completedSubtasks}/{totalSubtasks} done
                </span>
              )}
              {(task.attachments || []).length > 0 && (
                <span style={{ fontSize: '10px', color: t.textMuted }}>Att: {task.attachments.length}</span>
              )}
              
              {/* Assignees - push to right */}
              <div style={{ marginLeft: 'auto', display: 'flex' }}>
                {assignees.slice(0, 2).map((u, i) => (
                  <div 
                    key={u.id}
                    style={{ 
                      width: '22px', 
                      height: '22px', 
                      borderRadius: '50%', 
                      background: `hsl(${(u.name || '').charCodeAt(0) * 10}, 60%, 50%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '600',
                      color: '#fff',
                      marginLeft: i > 0 ? '-6px' : 0,
                      border: `2px solid ${t.bgCard}`
                    }}
                    title={u.name}
                  >
                    {(u.name || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
                {assignees.length > 2 && (
                  <div style={{ 
                    width: '22px', height: '22px', borderRadius: '50%', 
                    background: t.bgTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', color: t.textMuted, marginLeft: '-6px', border: `2px solid ${t.bgCard}`
                  }}>+{assignees.length - 2}</div>
                )}
              </div>
            </div>
            
            {/* Expanded content */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '12px', marginTop: '4px' }}>
                {/* Description */}
                {task.description && (
                  <p style={{ fontSize: '12px', color: t.textSecondary, margin: '0 0 12px', lineHeight: '1.5' }}>
                    {task.description}
                  </p>
                )}
                
                {/* Feedback text if feedback task */}
                {task.feedbackText && (
                  <div style={{ 
                    background: `${t.accent}15`, 
                    borderRadius: '6px', 
                    padding: '10px', 
                    marginBottom: '12px',
                    borderLeft: `3px solid ${t.accent}`
                  }}>
                    <div style={{ fontSize: '10px', color: t.accent, marginBottom: '4px', fontWeight: '600' }}>Original Feedback</div>
                    <div style={{ fontSize: '12px', color: t.text }}>{task.feedbackText}</div>
                  </div>
                )}
                
                {/* Subtasks */}
                {(task.subtasks || []).length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: t.textMuted, marginBottom: '6px', fontWeight: '600' }}>SUBTASKS</div>
                    {task.subtasks.map(st => (
                      <div 
                        key={st.id}
                        onClick={() => task.type !== 'auto' && toggleSubtask(task.id, st.id)}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          padding: '6px 0',
                          cursor: task.type === 'auto' ? 'default' : 'pointer'
                        }}
                      >
                        <div style={{ 
                          width: '16px', height: '16px', borderRadius: '4px',
                          border: st.done ? 'none' : `1.5px solid ${t.border}`,
                          background: st.done ? t.success : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {st.done && <span style={{ color: '#fff', fontSize: '9px' }}>✓</span>}
                        </div>
                        <span style={{ 
                          fontSize: '12px', 
                          color: t.text,
                          textDecoration: st.done ? 'line-through' : 'none',
                          opacity: st.done ? 0.6 : 1,
                          flex: 1
                        }}>{st.title}</span>
                        {st.assignedTo && (
                          <span style={{ fontSize: '10px', color: t.textMuted }}>
                            @{allTeamMembers.find(u => u.id === st.assignedTo)?.name?.split(' ')[0] || 'Unassigned'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Add subtask */}
                {task.type !== 'auto' && (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      value={newSubtaskText}
                      onChange={(e) => setNewSubtaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSubtaskText.trim()) {
                          addSubtask(task.id, newSubtaskText);
                          setNewSubtaskText('');
                        }
                      }}
                      placeholder="Add subtask..."
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        background: t.bgInput,
                        border: `1px solid ${t.border}`,
                        borderRadius: '6px',
                        color: t.text,
                        fontSize: '12px',
                        outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => {
                        if (newSubtaskText.trim()) {
                          addSubtask(task.id, newSubtaskText);
                          setNewSubtaskText('');
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        background: t.primary,
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >+</button>
                  </div>
                )}
                
                {/* Attachments */}
                {(task.attachments || []).length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', color: t.textMuted, marginBottom: '6px', fontWeight: '600' }}>ATTACHMENTS</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {task.attachments.map(att => (
                        <a 
                          key={att.id}
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 10px',
                            background: t.bgInput,
                            borderRadius: '6px',
                            fontSize: '11px',
                            color: t.primary,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Att: {att.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Quick Actions */}
                {task.type !== 'auto' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <label style={{
                      padding: '6px 12px',
                      background: t.bgInput,
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: t.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      Att: Add File
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          if (e.target.files?.[0]) {
                            await addTaskAttachment(task.id, e.target.files[0]);
                            showToast('File attached', 'success');
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => {
                        if (confirm('Delete this task?')) {
                          deleteTask(task.id);
                          setExpandedTask(null);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(239,68,68,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Expand/collapse indicator on hover */}
          {(isHovered || isExpanded) && task.type !== 'auto' && (
            <div 
              onClick={() => setExpandedTask(isExpanded ? null : task.id)}
              style={{ 
                textAlign: 'center', 
                padding: '4px', 
                background: t.bgTertiary,
                cursor: 'pointer',
                fontSize: '10px',
                color: t.textMuted
              }}
            >
              {isExpanded ? '▲ Collapse' : '▼ Expand'}
            </div>
          )}
        </div>
      );
    };
    
    // Kanban Column Component
    const KanbanColumn = ({ column }) => {
      const columnTasks = tasksByStatus[column.id] || [];
      const isDropTarget = dragOverColumn === column.id;

      return (
        <div
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, column.id)}
          style={{
            flex: 1,
            minWidth: '260px',
            maxWidth: '320px',
            background: isDropTarget ? `${column.color}08` : t.bgSecondary,
            borderRadius: '14px',
            display: 'flex',
            flexDirection: 'column',
            border: isDropTarget ? `2px dashed ${column.color}` : `1px solid ${t.border}`,
            transition: 'all 0.2s',
            overflow: 'hidden'
          }}
        >
          {/* Colored top border */}
          <div style={{ height: '4px', background: column.color }} />

          {/* Column header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: column.color, flexShrink: 0 }} />
            <span style={{ fontWeight: '600', fontSize: '13px', color: t.text }}>{column.title}</span>
            <span style={{
              marginLeft: 'auto',
              background: `${column.color}20`,
              color: column.color,
              padding: '3px 10px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: '700'
            }}>{columnTasks.length}</span>
          </div>

          {/* Tasks */}
          <div className="stagger-children" style={{
            flex: 1,
            padding: '12px',
            overflowY: 'auto',
            minHeight: '200px'
          }}>
            {columnTasks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '30px 10px',
                color: t.textMuted,
                fontSize: '12px',
                opacity: 0.7,
                border: isDropTarget ? 'none' : `1px dashed ${t.border}`,
                borderRadius: '10px'
              }}>
                {isDropTarget ? 'Drop here' : 'No tasks'}
              </div>
            ) : (
              columnTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>

          {/* Add task button at bottom */}
          <div
            onClick={() => setShowAddTask(true)}
            style={{
              padding: '10px 16px',
              textAlign: 'center',
              fontSize: '12px',
              color: t.textMuted,
              cursor: 'pointer',
              borderTop: `1px solid ${t.border}`,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span style={{ fontSize: '14px', opacity: 0.6 }}>+</span> Add task
          </div>
        </div>
      );
    };
    
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: t.bg }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          borderBottom: `1px solid ${t.border}`,
          background: t.bgSecondary
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: t.text }}>Tasks</h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Btn theme={theme} onClick={() => setShowTemplates(true)} small outline>Templates</Btn>
              <Btn theme={theme} onClick={() => setShowAddTask(true)} small>+ New Task</Btn>
              {isProducer && <Btn theme={theme} onClick={() => setShowSettings(true)} small outline>{Icons.settings(t.textSecondary)}</Btn>}
            </div>
          </div>
          
          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Overdue', value: overdueTasks.length, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
              { label: 'Due Today', value: todayTasks.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
              { label: 'Active', value: activeTasks.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
              { label: 'Done', value: completedTasks.length, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
            ].map(stat => (
              <div key={stat.label} style={{ 
                background: stat.bg, 
                borderRadius: '10px', 
                padding: '12px 16px',
                borderLeft: `4px solid ${stat.color}`
              }}>
                <div style={{ fontSize: '22px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: t.textMuted }}>{stat.label}</div>
              </div>
            ))}
          </div>
          
          {/* Quick Add Bar */}
          <div style={{ 
            background: t.bgCard, 
            borderRadius: '12px', 
            padding: '12px 16px',
            border: `1px solid ${t.border}`,
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                value={quickAdd.text}
                onChange={(e) => setQuickAdd({ ...quickAdd, text: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleQuickAdd()}
                onFocus={() => setQuickAdd({ ...quickAdd, showOptions: true })}
                placeholder="+ Quick add task... (press Enter)"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: t.bgInput,
                  border: `1px solid ${t.border}`,
                  borderRadius: '8px',
                  color: t.text,
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <input
                type="date"
                value={quickAdd.date}
                onChange={(e) => setQuickAdd({ ...quickAdd, date: e.target.value })}
                style={{
                  padding: '10px 12px',
                  background: t.bgInput,
                  border: `1px solid ${t.border}`,
                  borderRadius: '8px',
                  color: t.text,
                  fontSize: '12px',
                  outline: 'none',
                  width: '130px'
                }}
              />
              <Btn theme={theme} onClick={handleQuickAdd} disabled={!quickAdd.text.trim()}>Add</Btn>
            </div>
            
            {/* Expanded quick add options */}
            {quickAdd.showOptions && quickAdd.text && (
              <div style={{ 
                marginTop: '12px', 
                paddingTop: '12px', 
                borderTop: `1px solid ${t.border}`,
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
              }}>
                {/* Project selector */}
                <div style={{ minWidth: '150px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Project</label>
                  <select
                    value={quickAdd.projectId}
                    onChange={(e) => setQuickAdd({ ...quickAdd, projectId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: t.bgInput,
                      border: `1px solid ${t.border}`,
                      borderRadius: '6px',
                      color: t.text,
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">No project</option>
                    {projects.filter(p => p.status === 'active').map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                
                {/* Priority selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Priority</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <button
                        key={p}
                        onClick={() => setQuickAdd({ ...quickAdd, priority: p })}
                        style={{
                          padding: '6px 10px',
                          background: quickAdd.priority === p ? priorityColors[p] : t.bgInput,
                          border: `1px solid ${quickAdd.priority === p ? priorityColors[p] : t.border}`,
                          borderRadius: '6px',
                          color: quickAdd.priority === p ? '#fff' : t.textSecondary,
                          fontSize: '11px',
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {priorityIcons[p]} {p}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Assignee picker */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Assign to</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {allTeamMembers.slice(0, 6).map(u => {
                      const isSelected = quickAdd.assignedTo.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          onClick={() => {
                            if (isSelected) {
                              setQuickAdd({ ...quickAdd, assignedTo: quickAdd.assignedTo.filter(id => id !== u.id) });
                            } else {
                              setQuickAdd({ ...quickAdd, assignedTo: [...quickAdd.assignedTo, u.id] });
                            }
                          }}
                          style={{
                            padding: '4px 8px',
                            background: isSelected ? t.primary : t.bgInput,
                            border: `1px solid ${isSelected ? t.primary : t.border}`,
                            borderRadius: '12px',
                            color: isSelected ? '#fff' : t.textSecondary,
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span style={{ 
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: `hsl(${(u.name || '').charCodeAt(0) * 10}, 60%, 50%)`,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '8px', color: '#fff'
                          }}>{(u.name || '?').charAt(0).toUpperCase()}</span>
                          {u.name?.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                
                {/* AI Suggestions */}
                {suggestedSubtasks.length > 0 && (
                  <div style={{ width: '100%', marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: t.accent, marginBottom: '6px' }}>
                      AI Suggested subtasks (click to add)
                    </label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {suggestedSubtasks.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setNewTask({
                              ...newTask,
                              title: quickAdd.text,
                              projectId: quickAdd.projectId,
                              assignedTo: quickAdd.assignedTo,
                              priority: quickAdd.priority,
                              dueDate: quickAdd.date,
                              subtasks: [...newTask.subtasks, { id: generateId(), title: suggestion, done: false }]
                            });
                            setShowAddTask(true);
                          }}
                          style={{
                            padding: '5px 10px',
                            background: `${t.accent}15`,
                            border: `1px solid ${t.accent}30`,
                            borderRadius: '6px',
                            color: t.accent,
                            fontSize: '11px',
                            cursor: 'pointer',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={suggestion}
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Filter Tabs & View Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Tabs - pill styled */}
            <div style={{ display: 'flex', gap: '4px', background: t.bgCard, borderRadius: '10px', padding: '3px', border: `1px solid ${t.border}` }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Tasks' },
                { id: 'team', label: 'Team' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'overdue', label: 'Overdue', count: overdueTasks.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTaskTab(tab.id)}
                  style={{
                    padding: '7px 14px',
                    background: taskTab === tab.id ? t.primary : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: taskTab === tab.id ? '#fff' : t.textSecondary,
                    fontSize: '12px',
                    fontWeight: taskTab === tab.id ? '600' : '400',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      padding: '1px 6px',
                      borderRadius: '8px',
                      fontSize: '9px',
                      fontWeight: '700',
                      background: taskTab === tab.id ? 'rgba(255,255,255,0.25)' : '#ef444425',
                      color: taskTab === tab.id ? '#fff' : '#ef4444'
                    }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>
            
            {/* Filters & View Toggle */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  background: t.bgCard,
                  border: `1px solid ${t.border}`,
                  borderRadius: '10px',
                  color: t.text,
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  paddingRight: '28px',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23888' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center'
                }}
              >
                <option value="all">All Projects</option>
                {projects.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              
              <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px' }}>
                {[
                  { id: 'kanban', icon: '◫' },
                  { id: 'grid', icon: '⊞' },
                  { id: 'list', icon: '☰' }
                ].map(v => (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id)}
                    style={{
                      padding: '6px 10px',
                      background: viewMode === v.id ? t.primary : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      color: viewMode === v.id ? '#fff' : t.textSecondary,
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}
                    title={v.id}
                  >
                    {v.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          {viewMode === 'kanban' ? (
            /* Kanban View */
            <div style={{ 
              display: 'flex', 
              gap: '16px', 
              minHeight: '100%',
              overflowX: 'auto',
              paddingBottom: '20px'
            }}>
              {COLUMNS.map(column => (
                <KanbanColumn key={column.id} column={column} />
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            /* Grid View */
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
              gap: '16px' 
            }}>
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))}
              {filteredTasks.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: t.textMuted }}>
                  No tasks found
                </div>
              )}
            </div>
          ) : (
            /* List View */
            <div style={{ maxWidth: '800px' }}>
              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} compact={false} />
              ))}
              {filteredTasks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: t.textMuted }}>
                  No tasks found
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Add Task Modal */}
        {showAddTask && (
          <Modal theme={theme} title="New Task" onClose={() => setShowAddTask(false)}>
            <div style={{ padding: '20px', overflow: 'auto', maxHeight: '70vh' }}>
              {/* Title */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Title *</label>
                <Input theme={theme} value={newTask.title} onChange={(v) => setNewTask({ ...newTask, title: v })} placeholder="Task title" />
              </div>
              
              {/* Description */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Add details..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: t.bgInput,
                    border: `1px solid ${t.border}`,
                    borderRadius: '8px',
                    color: t.text,
                    fontSize: '13px',
                    resize: 'vertical',
                    minHeight: '80px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              
              {/* Row: Type + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Type</label>
                  <Select theme={theme} value={newTask.type} onChange={(v) => setNewTask({ ...newTask, type: v })}>
                    <option value="personal">Personal</option>
                    <option value="team">Team</option>
                    <option value="project">Project</option>
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Priority</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <button key={p} onClick={() => setNewTask({ ...newTask, priority: p })} style={{ flex: 1, padding: '8px', background: newTask.priority === p ? priorityColors[p] : t.bgInput, border: `1px solid ${newTask.priority === p ? priorityColors[p] : t.border}`, borderRadius: '6px', color: newTask.priority === p ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>
                        {priorityIcons[p]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Row: Due Date + Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Due Date</label>
                  <Input theme={theme} type="date" value={newTask.dueDate} onChange={(v) => setNewTask({ ...newTask, dueDate: v })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Time (optional)</label>
                  <Input theme={theme} type="time" value={newTask.dueTime} onChange={(v) => setNewTask({ ...newTask, dueTime: v })} />
                </div>
              </div>
              
              {/* Project */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Link to Project</label>
                <Select theme={theme} value={newTask.projectId} onChange={(v) => setNewTask({ ...newTask, projectId: v })}>
                  <option value="">None</option>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              
              {/* Assignees */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Assign To</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {allTeamMembers.map(u => {
                    const isSelected = newTask.assignedTo.includes(u.id);
                    return (
                      <button key={u.id} onClick={() => {
                        if (isSelected) {
                          setNewTask({ ...newTask, assignedTo: newTask.assignedTo.filter(id => id !== u.id) });
                        } else {
                          setNewTask({ ...newTask, assignedTo: [...newTask.assignedTo, u.id] });
                        }
                      }} style={{
                        padding: '6px 12px',
                        background: isSelected ? t.primary : t.bgInput,
                        border: `1px solid ${isSelected ? t.primary : t.border}`,
                        borderRadius: '16px',
                        color: isSelected ? '#fff' : t.textSecondary,
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                        {u.name?.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* AI Subtask Suggestions */}
              {suggestedSubtasks.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: t.accent, marginBottom: '6px' }}>
                    AI AI Suggested Subtasks
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {suggestedSubtasks.map((s, i) => {
                      const isAdded = newTask.subtasks.some(st => st.title === s);
                      return (
                        <button key={i} onClick={() => {
                          if (!isAdded) {
                            setNewTask({ ...newTask, subtasks: [...newTask.subtasks, { id: generateId(), title: s, done: false }] });
                          }
                        }} style={{
                          padding: '6px 10px',
                          background: isAdded ? `${t.success}20` : `${t.accent}15`,
                          border: `1px solid ${isAdded ? t.success : t.accent}30`,
                          borderRadius: '6px',
                          color: isAdded ? t.success : t.accent,
                          fontSize: '11px',
                          cursor: isAdded ? 'default' : 'pointer',
                          opacity: isAdded ? 0.7 : 1
                        }}>
                          {isAdded ? '✓' : '+'} {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Subtasks */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Subtasks</label>
                {newTask.subtasks.map((st, i) => (
                  <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: t.text }}>{st.title}</span>
                    <button onClick={() => setNewTask({ ...newTask, subtasks: newTask.subtasks.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Input theme={theme} value={newSubtaskText} onChange={setNewSubtaskText} placeholder="Add subtask..." onKeyDown={(e) => {
                    if (e.key === 'Enter' && newSubtaskText.trim()) {
                      setNewTask({ ...newTask, subtasks: [...newTask.subtasks, { id: generateId(), title: newSubtaskText, done: false }] });
                      setNewSubtaskText('');
                    }
                  }} />
                  <Btn theme={theme} onClick={() => {
                    if (newSubtaskText.trim()) {
                      setNewTask({ ...newTask, subtasks: [...newTask.subtasks, { id: generateId(), title: newSubtaskText, done: false }] });
                      setNewSubtaskText('');
                    }
                  }} small>+</Btn>
                </div>
              </div>
              
              {/* Recurring */}
              <div style={{ marginBottom: '20px', padding: '14px', background: t.bgInput, borderRadius: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: newTask.recurring.enabled ? '12px' : 0 }}>
                  <span style={{ fontSize: '12px', color: t.text }}>Recurring task</span>
                  <button onClick={() => setNewTask({ ...newTask, recurring: { ...newTask.recurring, enabled: !newTask.recurring.enabled } })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: newTask.recurring.enabled ? t.primary : t.bgTertiary, cursor: 'pointer', position: 'relative' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: newTask.recurring.enabled ? '22px' : '2px', transition: 'left 0.2s' }} />
                  </button>
                </div>
                {newTask.recurring.enabled && (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <Select theme={theme} value={newTask.recurring.frequency} onChange={(v) => setNewTask({ ...newTask, recurring: { ...newTask.recurring, frequency: v } })} style={{ flex: 1 }}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </Select>
                    <Input theme={theme} type="date" value={newTask.recurring.endDate} onChange={(v) => setNewTask({ ...newTask, recurring: { ...newTask.recurring, endDate: v } })} placeholder="End date" style={{ flex: 1 }} />
                  </div>
                )}
              </div>
              
              {/* Submit */}
              <Btn theme={theme} onClick={handleAddTask} disabled={!newTask.title.trim()} style={{ width: '100%' }} color="#22c55e">
                Create Task
              </Btn>
            </div>
          </Modal>
        )}
        
        {/* Templates Modal */}
        {showTemplates && (
          <Modal theme={theme} title="Task Templates" onClose={() => setShowTemplates(false)}>
            <div style={{ padding: '20px', overflow: 'auto', maxHeight: '70vh' }}>
              {!selectedTemplate ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {Object.entries(TASK_TEMPLATES).map(([id, template]) => (
                    <div key={id} onClick={() => setSelectedTemplate(id)} style={{
                      padding: '16px',
                      background: t.bgCard,
                      borderRadius: '12px',
                      border: `1px solid ${t.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ fontSize: '28px', marginBottom: '10px' }}>{template.icon}</div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: t.text, marginBottom: '4px' }}>{template.name}</div>
                      <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>{template.description}</div>
                      <div style={{ fontSize: '10px', color: t.primary }}>{template.subtasks.length} subtasks</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  <button onClick={() => setSelectedTemplate('')} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', marginBottom: '16px', fontSize: '12px' }}>← Back to templates</button>
                  
                  <div style={{ padding: '16px', background: t.bgCard, borderRadius: '12px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '32px' }}>{TASK_TEMPLATES[selectedTemplate].icon}</span>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '16px', color: t.text }}>{TASK_TEMPLATES[selectedTemplate].name}</div>
                        <div style={{ fontSize: '12px', color: t.textMuted }}>{TASK_TEMPLATES[selectedTemplate].description}</div>
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>SUBTASKS</div>
                    {TASK_TEMPLATES[selectedTemplate].subtasks.map((st, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: `1px solid ${t.border}` }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `2px solid ${t.border}` }} />
                        <span style={{ flex: 1, fontSize: '12px', color: t.text }}>{st.title}</span>
                        <span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'capitalize' }}>{st.assignRole}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Link to Project (optional)</label>
                    <Select theme={theme} value={templateProjectId} onChange={setTemplateProjectId}>
                      <option value="">No project</option>
                      {projects.filter(p => p.status === 'active').map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  
                  <Btn theme={theme} onClick={handleCreateFromTemplate} style={{ width: '100%' }} color="#22c55e">
                    Create from Template
                  </Btn>
                </div>
              )}
            </div>
          </Modal>
        )}
        
        {/* Settings Modal */}
        {showSettings && isProducer && (
          <Modal theme={theme} title="Task & Notification Settings" onClose={() => setShowSettings(false)}>
            <div style={{ padding: '20px', overflow: 'auto', maxHeight: '70vh' }}>
              {/* Auto-task timing */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: t.text, marginBottom: '10px' }}>Auto-Task Due Time</div>
                <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '10px' }}>When feedback creates a task, set due date before project deadline</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[24, 48, 72].map(h => (
                    <button key={h} onClick={() => setNotificationSettings({ ...notificationSettings, autoTaskDueBefore: h })} style={{
                      flex: 1, padding: '10px', background: notificationSettings.autoTaskDueBefore === h ? t.primary : t.bgInput,
                      border: `1px solid ${notificationSettings.autoTaskDueBefore === h ? t.primary : t.border}`,
                      borderRadius: '8px', color: notificationSettings.autoTaskDueBefore === h ? '#fff' : t.textSecondary,
                      fontSize: '12px', cursor: 'pointer'
                    }}>{h}h before</button>
                  ))}
                </div>
              </div>
              
              {/* Client notifications */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: t.text, marginBottom: '10px' }}>Client Auto-Notifications</div>
                <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '10px' }}>Control when clients receive email updates</div>
                {[
                  { key: 'onAssetReady', label: 'Asset ready for review' },
                  { key: 'onVersionUpload', label: 'New version uploaded' },
                  { key: 'onAllRevisionsComplete', label: 'All revisions complete' },
                  { key: 'onMilestoneReached', label: 'Milestone reached' }
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: '12px', color: t.text }}>{item.label}</span>
                    <button onClick={() => setNotificationSettings({
                      ...notificationSettings,
                      clientNotifications: { ...notificationSettings.clientNotifications, [item.key]: !notificationSettings.clientNotifications[item.key] }
                    })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: notificationSettings.clientNotifications[item.key] ? t.success : t.bgTertiary, cursor: 'pointer', position: 'relative' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: notificationSettings.clientNotifications[item.key] ? '22px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                ))}
              </div>
              
              {/* Team notifications */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: t.text, marginBottom: '10px' }}>Team Auto-Notifications</div>
                {[
                  { key: 'onTaskAssigned', label: 'Task assigned' },
                  { key: 'onDueApproaching', label: 'Due date approaching (24h)' },
                  { key: 'onOverdue', label: 'Task overdue' },
                  { key: 'onFeedbackReceived', label: 'Feedback received' },
                  { key: 'onSubtaskComplete', label: 'Subtask completed' }
                ].map(item => (
                  <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: '12px', color: t.text }}>{item.label}</span>
                    <button onClick={() => setNotificationSettings({
                      ...notificationSettings,
                      teamNotifications: { ...notificationSettings.teamNotifications, [item.key]: !notificationSettings.teamNotifications[item.key] }
                    })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: notificationSettings.teamNotifications[item.key] ? t.success : t.bgTertiary, cursor: 'pointer', position: 'relative' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: notificationSettings.teamNotifications[item.key] ? '22px' : '2px', transition: 'left 0.2s' }} />
                    </button>
                  </div>
                ))}
              </div>
              
              <Btn theme={theme} onClick={() => setShowSettings(false)} style={{ width: '100%' }}>Done</Btn>
            </div>
          </Modal>
        )}
        {/* Keyboard Shortcuts */}
        {isProducer && !isClientView && (
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', padding: '20px 0 0', marginTop: '8px', borderTop: `1px solid ${t.border}` }}>
            {[
              { key: 'N', label: 'New Project', action: () => setView('projects') },
              { key: 'U', label: 'Upload', action: () => setView('projects') },
              { key: 'T', label: 'Add Team', action: () => setView('team') },
            ].map(s => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: t.textMuted, cursor: 'pointer' }} onClick={s.action}>
                <span style={{ display: 'inline-flex', width: '20px', height: '20px', alignItems: 'center', justifyContent: 'center', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '10px', fontWeight: '600', color: t.textSecondary }}>{s.key}</span>
                {s.label}
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: t.textMuted }}>
              <span style={{ display: 'inline-flex', height: '20px', alignItems: 'center', justifyContent: 'center', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '10px', fontWeight: '600', color: t.textSecondary, padding: '0 6px' }}>⌘K</span>
              Search
            </div>
          </div>
        )}
      </div>
    );
  };

  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [projectTab, setProjectTab] = useState('all');

    // Filter by search and tab
    const activeProjects = projects.filter(p => p.status === 'active' && (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase())));
    const completedProjects = projects.filter(p => p.status === 'completed' && (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase())));
    const allFilteredProjects = projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase()));
    const displayProjects = projectTab === 'all' ? allFilteredProjects : projectTab === 'active' ? activeProjects : completedProjects;

    const handleCreate = async (config) => {
      try {
        const proj = await createProject({
          name: config.name, client: config.client, type: config.type, deadline: config.deadline,
          status: 'active', categories: config.categories || [], assets: [],
          assignedTeam: [
            { odId: userProfile.id, odRole: userProfile.role, isOwner: true },
            ...(config.individuals || []).map(m => ({ odId: m.id, odRole: m.role })),
          ],
          clientContacts: [], shareLinks: [],
          workflowType: config.workflowType || 'standard',
          maxRevisions: config.maxRevisions || 3,
          autoTurnaround: config.autoTurnaround !== false,
          turnaroundHours: config.turnaroundHours || 24,
          approvalChain: config.approvalChain || ['producer', 'client'],
          teamGroups: config.teamGroups || [],
          deliverableFormats: config.deliverableFormats || [],
          deliverableSizes: config.deliverableSizes || [],
          templateId: config.templateId || null,
          agencyContacts: config.agencyContacts || [],
          activityLog: [{ id: generateId(), type: 'created', message: `Project created by ${userProfile.name}`, userId: userProfile.id, timestamp: new Date().toISOString() }],
          createdBy: userProfile.id, createdByName: userProfile.name,
          selectionConfirmed: false, workflowPhase: 'selection',
        });
        setProjects([proj, ...projects]);
        setShowCreate(false);
        showToast('Project created!', 'success');
      } catch (e) { showToast('Failed to create project', 'error'); throw e; }
    };
    
    const handleToggleProjectStatus = async (projId, e) => {
      e.stopPropagation();
      const proj = projects.find(p => p.id === projId);
      const newStatus = proj.status === 'active' ? 'completed' : 'active';
      const activity = { id: generateId(), type: 'status', message: `Project marked as ${newStatus} by ${userProfile.name}`, timestamp: new Date().toISOString() };
      await updateProject(projId, { status: newStatus, activityLog: [...(proj.activityLog || []), activity] });
      await refreshProject();
      showToast(`Project ${newStatus}!`, 'success');
    };
    
    const handleDeleteProject = async (projId, e) => {
      e.stopPropagation();
      const proj = projects.find(p => p.id === projId);
      if (!confirm(`Delete "${proj.name}"?\n\nThis will permanently delete the project and all its assets. This action cannot be undone.`)) return;
      try {
        await deleteProject(projId);
        setProjects(projects.filter(p => p.id !== projId));
        showToast('Project deleted', 'success');
      } catch (err) {
        showToast('Failed to delete project', 'error');
      }
    };

    const typeGradients = {
      'photoshoot': 'linear-gradient(135deg, #ec489930, #a855f720)',
      'ad-film': 'linear-gradient(135deg, #f9731630, #ef444420)',
      'product-video': 'linear-gradient(135deg, #3b82f630, #06b6d420)',
      'toolkit': 'linear-gradient(135deg, #6366f130, #a855f720)',
      'social-media': 'linear-gradient(135deg, #ec489930, #f9731620)',
      'corporate': 'linear-gradient(135deg, #64748b30, #3b82f620)',
      'music-video': 'linear-gradient(135deg, #a855f730, #ec489920)',
      'brand-film': 'linear-gradient(135deg, #f97316, #ef444420)',
      'reels': 'linear-gradient(135deg, #f43f5e30, #a855f720)',
      'ecommerce': 'linear-gradient(135deg, #10b98130, #3b82f620)',
      'event': 'linear-gradient(135deg, #fbbf2430, #f9731620)',
      'documentary': 'linear-gradient(135deg, #78716c30, #a855f720)',
    };


    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: t.text }}>Projects</h1>
          {isProducer && (
            <button onClick={() => setShowCreate(true)} style={{
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${t.primary}, ${t.accent || '#8b5cf6'})`,
              border: 'none', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: `0 4px 14px ${t.primary}40`
            }}>+ New Project</button>
          )}
        </div>

        {/* Filter bar: tabs + search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}`, marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            {[
              { id: 'all', label: 'All', count: allFilteredProjects.length },
              { id: 'active', label: 'Active', count: activeProjects.length },
              { id: 'completed', label: 'Completed', count: completedProjects.length },
            ].map(tab => (
              <button key={tab.id} onClick={() => setProjectTab(tab.id)} style={{
                padding: '10px 0', fontSize: '13px', cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: projectTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                color: projectTab === tab.id ? t.text : t.textMuted,
                fontWeight: projectTab === tab.id ? '600' : '400',
                transition: 'all 0.2s',
              }}>
                {tab.label} <span style={{ fontSize: '11px', color: t.textMuted, marginLeft: '4px' }}>({tab.count})</span>
              </button>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <Input theme={theme} value={search} onChange={setSearch} placeholder="Search..." style={{ width: isMobile ? '140px' : '200px' }} />
          </div>
        </div>

        {displayProjects.length === 0 ? (
          <div className="animate-fadeIn" style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: t.cardRadius, border: `1px solid ${t.bgGlassBorder}`, padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', margin: '0 auto 20px', background: `${t.primary}15`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Icons.folder(t.textMuted)}
            </div>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600' }}>{projectTab === 'active' ? 'No projects yet' : 'No Completed Projects'}</h3>
            <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '24px', maxWidth: '300px', margin: '0 auto 24px' }}>{projectTab === 'active' ? 'Create your first project to get started with production management' : 'Complete a project to see it here'}</p>
            {isProducer && projectTab === 'active' && <Btn theme={theme} onClick={() => setShowCreate(true)}>+ Create your first project</Btn>}
          </div>
        ) : (
          <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {displayProjects.map(p => {
              const cnt = p.assets?.filter(a => !a.deleted).length || 0;
              const approved = p.assets?.filter(a => !a.deleted && ['approved', 'delivered'].includes(a.status)).length || 0;
              const notifs = getProjectNotifs(p);
              const totalNotifs = notifs.pendingReview + notifs.newFeedback + notifs.changesRequested + notifs.newVersions;
              const teamMembers = (p.assignedTeam || []).map(tm => users.find(u => u.id === tm.odId)).filter(Boolean);
              const progressPct = cnt ? Math.round((approved / cnt) * 100) : 0;
              const firstThumb = p.assets?.find(a => !a.deleted && a.type === 'image' && a.thumbnailUrl);

              return (
                <div key={p.id} className="hover-lift hover-glow animate-fadeInUp" onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: t.cardRadius, border: totalNotifs > 0 ? '1px solid rgba(251,191,36,0.4)' : `1px solid ${t.bgGlassBorder}`, boxShadow: t.shadowGlass, cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.2s ease' }}>
                  {/* Gradient Top Area */}
                  <div style={{ height: '90px', background: firstThumb ? `url(${firstThumb.thumbnailUrl}) center/cover` : (typeGradients[p.type] || typeGradients['photoshoot']), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {!firstThumb && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '500' }}>{p.type?.replace('-', ' ') || 'Project'}</span>}
                    {/* Status chip top-right */}
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      <Badge status={p.status} />
                    </div>
                    {/* Notification dots top-left */}
                    {totalNotifs > 0 && (
                      <div style={{ position: 'absolute', top: '10px', left: '10px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {notifs.pendingReview > 0 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px #a855f7' }} title="Pending reviews" />}
                        {notifs.newFeedback > 0 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} title="New feedback" />}
                        {notifs.changesRequested > 0 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316', boxShadow: '0 0 6px #f97316' }} title="Changes requested" />}
                        {notifs.newVersions > 0 && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} title="New versions" />}
                      </div>
                    )}
                    {/* Producer actions overlay */}
                    {isProducer && (
                      <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                        <button onClick={(e) => handleToggleProjectStatus(p.id, e)} title={p.status === 'active' ? 'Mark Complete' : 'Reopen'} style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {Icons.check('#fff')} {p.status === 'active' ? 'Complete' : 'Reopen'}
                        </button>
                        <button onClick={(e) => handleDeleteProject(p.id, e)} title="Delete Project" style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.7)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>
                          {Icons.trash('#fff')}
                        </button>
                      </div>
                    )}
                  </div>
                  {/* Content Area */}
                  <div style={{ padding: '14px 16px 16px' }}>
                    {/* Name + Client */}
                    <div style={{ fontWeight: '700', fontSize: '14px', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '12px' }}>{p.client}</div>
                    {/* Progress bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ flex: 1, background: t.bgCard, borderRadius: '3px', height: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? '#22c55e' : `linear-gradient(90deg, ${t.primary}, #a855f7)`, borderRadius: '3px', transition: 'width 0.4s ease' }} />
                      </div>
                      <span style={{ fontSize: '10px', color: t.textMuted, fontWeight: '600', minWidth: '28px', textAlign: 'right' }}>{progressPct}%</span>
                    </div>
                    {/* Bottom row: team avatars, deadline, asset count */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* Team avatar stack */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {teamMembers.slice(0, 3).map((member, i) => (
                          <div key={member.id} style={{ marginLeft: i > 0 ? '-8px' : '0', zIndex: 3 - i }}>
                            <Avatar user={member} size={24} />
                          </div>
                        ))}
                        {teamMembers.length > 3 && (
                          <div style={{ marginLeft: '-8px', width: '24px', height: '24px', borderRadius: '50%', background: t.bgCard, border: `2px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: t.textMuted, fontWeight: '600', zIndex: 0 }}>
                            +{teamMembers.length - 3}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* Deadline */}
                        {p.deadline && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: t.textMuted }}>
                            {Icons.calendar(t.textMuted)}
                            <span>{formatDate(p.deadline)}</span>
                          </div>
                        )}
                        {/* Asset count */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: t.textMuted }}>
                          {Icons.file(t.textMuted)}
                          <span>{cnt}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showCreate && (
          <CreateProjectModal
            theme={theme}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
            teamMembers={[...coreTeam, ...freelancers].filter(m => m.id !== userProfile?.id)}
          />
        )}
      </div>
    );
  };

  const TeamManagement = () => {
    const [tab, setTab] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');
    const [teamSearch, setTeamSearch] = useState('');

    const handleCreate = async () => {
      if (!newUser.name || !newUser.email || !newUser.password) { setError('Fill required fields'); return; }
      if (newUser.password.length < 6) { setError('Password min 6 chars'); return; }
      setCreating(true); setError('');
      try {
        const cred = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
        await updateProfile(cred.user, { displayName: newUser.name });
        await createUser(cred.user.uid, { email: newUser.email, name: newUser.name, firstName: newUser.name.split(' ')[0], role: newUser.type === 'client' ? 'client' : newUser.role, phone: newUser.phone, avatar: newUser.type === 'client' ? '' : (TEAM_ROLES[newUser.role]?.icon || ''), isCore: newUser.type === 'core', isFreelancer: newUser.type === 'freelancer', isClient: newUser.type === 'client', company: newUser.company, createdBy: userProfile.id });
        await loadData();
        setNewUser({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '' });
        setShowAdd(false);
        showToast('Added!', 'success');
      } catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'Email exists' : e.message); }
      setCreating(false);
    };

    const renderUser = u => {
      const userProjects = projects.filter(p => {
        const isTeamMember = (p.assignedTeam || []).some(tm => tm.odId === u.id);
        const hasAssignedAssets = (p.assets || []).some(a => a.assignedTo === u.id || a.assignedTo === u.email);
        return isTeamMember || hasAssignedAssets;
      });
      const assignedAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted && (a.assignedTo === u.id || a.assignedTo === u.email)));
      const activeAssets = assignedAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
      const today = new Date(); today.setHours(0,0,0,0);
      const overdueAssets = activeAssets.filter(a => a.dueDate && new Date(a.dueDate) < today);

      return (
        <div key={u.id} className="team-row" style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '12px', marginBottom: '8px', border: `1px solid ${t.bgGlassBorder}`, cursor: 'pointer', transition: 'all 0.2s' }}>
          <Avatar user={u} size={36} />
          <div style={{ flex: 1, marginLeft: '12px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>{u.name}</div>
            <div style={{ fontSize: '11px', color: t.textMuted }}>{u.email}</div>
          </div>
          <RoleBadge role={u.role} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '16px' }}>
            <span style={{ fontSize: '12px', color: t.textMuted }}>{activeAssets.length} active</span>
            {overdueAssets.length > 0 && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />}
          </div>
          {userProjects.length > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setSelectedProjectId(userProjects[0].id); setView('projects'); }} style={{ marginLeft: '12px', padding: '6px 8px', background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          )}
          {isProducer && u.id !== userProfile?.id && (
            <button onClick={async (e) => { e.stopPropagation(); if (!confirm(`Remove ${u.name}? This will delete their account permanently.`)) return; try { await deleteUser(u.id); await loadData(); showToast(`${u.name} removed`, 'success'); } catch (err) { showToast('Failed to remove user', 'error'); } }} style={{ marginLeft: '8px', padding: '6px 8px', background: 'none', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.danger, cursor: 'pointer', fontSize: '11px', transition: 'all 0.2s', opacity: 0.5 }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.5'} title="Remove user">
              {Icons.trash(t.danger)}
            </button>
          )}
        </div>
      );
    };

    const allMembers = [...coreTeam, ...freelancers, ...clients];
    const getFilteredMembers = (list) => {
      if (!teamSearch) return list;
      const q = teamSearch.toLowerCase();
      return list.filter(u => (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
    };
    const displayMembers = tab === 'all' ? getFilteredMembers(allMembers) : tab === 'core' ? getFilteredMembers(coreTeam) : tab === 'freelancers' ? getFilteredMembers(freelancers) : getFilteredMembers(clients);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: t.text }}>Team</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: t.textMuted }}>
              {coreTeam.length + freelancers.length} team members • {clients.length} clients
            </p>
          </div>
          {isProducer && (
            <button onClick={() => setShowAdd(true)} style={{
              padding: '10px 20px',
              background: `linear-gradient(135deg, ${t.primary}, ${t.accent || '#8b5cf6'})`,
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: `0 4px 14px ${t.primary}40`,
              transition: 'all 0.2s'
            }}>
              <span style={{ fontSize: '16px' }}>+</span> Add Member
            </button>
          )}
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            value={teamSearch}
            onChange={e => setTeamSearch(e.target.value)}
            placeholder="Search team members..."
            style={{ width: '100%', padding: '10px 14px 10px 36px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '10px', color: t.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Underline tabs */}
        <div style={{ display: 'flex', gap: '24px', borderBottom: `1px solid ${t.border}`, marginBottom: '20px' }}>
          {[{ id: 'all', label: `All (${allMembers.length})` }, { id: 'core', label: `Core Team (${coreTeam.length})` }, { id: 'freelancers', label: `Freelancers (${freelancers.length})` }, { id: 'clients', label: `Clients (${clients.length})` }].map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              style={{
                padding: '10px 0',
                fontSize: '13px',
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                borderBottom: tab === tabItem.id ? '2px solid #6366f1' : '2px solid transparent',
                color: tab === tabItem.id ? t.text : t.textMuted,
                fontWeight: tab === tabItem.id ? 600 : 400,
                transition: 'all 0.2s'
              }}
            >
              {tabItem.label}
            </button>
          ))}
        </div>

        {/* Team list */}
        <div>
          {displayMembers.length > 0 ? displayMembers.map(renderUser) : null}
        </div>
        {/* Empty state */}
        {displayMembers.length === 0 && (
          <div className="animate-fadeInUp" style={{ background: t.bgCard, borderRadius: '16px', border: `1px solid ${t.border}`, textAlign: 'center', padding: '60px 20px', color: t.textMuted }}>
            <div style={{ marginBottom: '16px', opacity: 0.5 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: '6px', color: t.textSecondary }}>{teamSearch ? 'No matching members' : 'No team members yet'}</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>{teamSearch ? 'Try a different search term' : `Add your first ${tab === 'core' ? 'core team member' : tab === 'freelancers' ? 'freelancer' : tab === 'clients' ? 'client' : 'team member'} to get started`}</div>
          </div>
        )}
        {showAdd && (
          <Modal theme={theme} title="Add Team Member" onClose={() => { setShowAdd(false); setError(''); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px' }}>{['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '12px', background: newUser.type === type ? t.primary : t.bgCard, border: `1px solid ${newUser.type === type ? t.primary : t.border}`, borderRadius: '8px', color: newUser.type === type ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>{type === 'core' ? 'Core' : type === 'freelancer' ? 'Freelancer' : 'Client'}</button>)}</div>
              <Input theme={theme} value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} placeholder="Name *" />
              <Input theme={theme} value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} placeholder="Email *" type="email" />
              <Input theme={theme} value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="Password *" type="password" />
              {newUser.type !== 'client' && <Select theme={theme} value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</Select>}
              {newUser.type === 'client' && <Input theme={theme} value={newUser.company} onChange={v => setNewUser({ ...newUser, company: v })} placeholder="Company" />}
              {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
              <Btn theme={theme} onClick={handleCreate} disabled={creating}>{creating ? <><span className="spinner" style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} /> Adding...</> : 'Add'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Project Tasks Tab Component - syncs with My Tasks
  const ProjectTasksTab = ({ project, onUpdate }) => {
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', dueDate: '', dueTime: '', priority: 'medium', assignedTo: [] });
    const [newSubtask, setNewSubtask] = useState('');
    const [expandedTask, setExpandedTask] = useState(null);
    
    // Get project tasks from globalTasks (properly interlinked)
    const projectTasks = globalTasks.filter(t => t.projectId === project.id);
    
    const priorityColors = { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const priorityIcons = { urgent: '!!', high: '!', medium: '--', low: '~' };
    const allTeam = [...coreTeam, ...freelancers, ...users].filter(u => 
      (project.assignedTeam || []).some(t => t.odId === u.id) || u.role === 'producer'
    );
    
    // Get subtask suggestions
    const getSuggestions = (title) => {
      if (!title) return [];
      const words = title.toLowerCase().split(/\s+/);
      const suggestions = new Set();
      words.forEach(word => {
        if (SUBTASK_SUGGESTIONS[word]) {
          SUBTASK_SUGGESTIONS[word].forEach(s => suggestions.add(s));
        }
        Object.keys(SUBTASK_SUGGESTIONS).forEach(key => {
          if (word.includes(key) || key.includes(word)) {
            SUBTASK_SUGGESTIONS[key].slice(0, 2).forEach(s => suggestions.add(s));
          }
        });
      });
      return Array.from(suggestions).slice(0, 4);
    };
    
    const suggestions = getSuggestions(newTask.title);
    
    // Add task using global createTask
    const handleAddTask = () => {
      if (!newTask.title.trim()) return;
      createTask({
        ...newTask,
        type: 'project',
        projectId: project.id,
        projectName: project.name,
        assignedTo: newTask.assignedTo,
        subtasks: newTask.subtasks || []
      });
      setNewTask({ title: '', dueDate: '', dueTime: '', priority: 'medium', assignedTo: [], subtasks: [] });
      setShowAddTask(false);
    };
    
    const activeTasks = projectTasks.filter(t => t.status !== 'done');
    const completedTasks = projectTasks.filter(t => t.status === 'done');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
    
    return (
      <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}` }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px' }}>✓ Project Tasks ({activeTasks.length})</h3>
            {overdueTasks.length > 0 && (
              <span style={{ fontSize: '11px', color: '#ef4444' }}>{overdueTasks.length} overdue</span>
            )}
          </div>
          <Btn theme={theme} onClick={() => setShowAddTask(true)} small>+ Add Task</Btn>
        </div>
        
        <div style={{ padding: '14px' }}>
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: t.textMuted }}>
              <div style={{ marginBottom: '12px', opacity: 0.5 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
              <div style={{ fontSize: '13px' }}>No tasks yet</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Tasks created here sync with the Tasks tab</div>
            </div>
          ) : (
            <>
              {/* Active Tasks */}
              {activeTasks.map(task => {
                const isExpanded = expandedTask === task.id;
                const isOverdue = task.dueDate && new Date(task.dueDate) < today;
                const assignees = (task.assignedTo || []).map(id => allTeam.find(u => u.id === id)).filter(Boolean);
                const completedSubs = (task.subtasks || []).filter(s => s.done).length;
                const totalSubs = (task.subtasks || []).length;
                
                return (
                  <div 
                    key={task.id}
                    style={{
                      background: t.bgGlass,
                      backdropFilter: t.blur,
                      WebkitBackdropFilter: t.blur,
                      borderRadius: '12px',
                      marginBottom: '8px',
                      border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : t.bgGlassBorder}`,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ height: '3px', background: priorityColors[task.priority] }} />
                    <div 
                      style={{ display: 'flex', gap: '12px', padding: '12px 14px', cursor: 'pointer' }}
                      onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    >
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                        style={{ 
                          width: '20px', height: '20px', borderRadius: '5px', 
                          border: `2px solid ${t.border}`, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px', color: t.text }}>
                          {task.type === 'feedback' && 'Feedback: '}{task.title}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {task.dueDate && (
                            <span style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : t.textMuted }}>
                              Due: {formatDate(task.dueDate)}
                            </span>
                          )}
                          {totalSubs > 0 && (
                            <span style={{ fontSize: '11px', color: completedSubs === totalSubs ? t.success : t.textMuted }}>
                              Subs: {completedSubs}/{totalSubs}
                            </span>
                          )}
                          <span style={{ fontSize: '10px' }}>{priorityIcons[task.priority]}</span>
                        </div>
                      </div>
                      {assignees.length > 0 && (
                        <div style={{ display: 'flex' }}>
                          {assignees.slice(0, 2).map((u, i) => (
                            <div key={u.id} style={{ 
                              width: '24px', height: '24px', borderRadius: '50%', 
                              background: `hsl(${(u.name || '').charCodeAt(0) * 10}, 60%, 50%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', color: '#fff', marginLeft: i > 0 ? '-6px' : 0,
                              border: `2px solid ${t.bgCard}`
                            }} title={u.name}>
                              {(u.name || '?').charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      )}
                      <span style={{ color: t.textMuted, fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${t.border}` }}>
                        {task.feedbackText && (
                          <div style={{ background: `${t.accent}15`, borderRadius: '6px', padding: '10px', margin: '10px 0', borderLeft: `3px solid ${t.accent}` }}>
                            <div style={{ fontSize: '10px', color: t.accent, marginBottom: '4px', fontWeight: '600' }}>Original Feedback</div>
                            <div style={{ fontSize: '12px', color: t.text }}>{task.feedbackText}</div>
                          </div>
                        )}
                        
                        {(task.subtasks || []).length > 0 && (
                          <div style={{ marginTop: '10px' }}>
                            {task.subtasks.map(st => (
                              <div key={st.id} onClick={() => toggleSubtask(task.id, st.id)} style={{ 
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer'
                              }}>
                                <div style={{ 
                                  width: '16px', height: '16px', borderRadius: '4px',
                                  border: st.done ? 'none' : `1.5px solid ${t.border}`,
                                  background: st.done ? t.success : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                  {st.done && <span style={{ color: '#fff', fontSize: '9px' }}>✓</span>}
                                </div>
                                <span style={{ fontSize: '12px', color: t.text, textDecoration: st.done ? 'line-through' : 'none', opacity: st.done ? 0.6 : 1 }}>{st.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                          <input
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newSubtask.trim()) {
                                addSubtask(task.id, newSubtask);
                                setNewSubtask('');
                              }
                            }}
                            placeholder="Add subtask..."
                            style={{ flex: 1, padding: '8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.text, fontSize: '11px', outline: 'none' }}
                          />
                          <button onClick={() => deleteTask(task.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>{Icons.trash('#ef4444')}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '12px', color: t.textMuted, marginBottom: '8px' }}>✓ Completed ({completedTasks.length})</div>
                  {completedTasks.slice(0, 5).map(task => (
                    <div key={task.id} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px', opacity: 0.6 }}>
                      <div onClick={() => toggleTaskComplete(task.id)} style={{ width: '18px', height: '18px', borderRadius: '4px', background: t.success, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>
                      </div>
                      <span style={{ fontSize: '12px', textDecoration: 'line-through', color: t.textMuted }}>{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Add Task Modal */}
        {showAddTask && (
          <Modal theme={theme} title="Add Project Task" onClose={() => setShowAddTask(false)}>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Task Title *</label>
                <Input theme={theme} value={newTask.title} onChange={v => setNewTask({ ...newTask, title: v })} placeholder="What needs to be done?" />
              </div>
              
              {suggestions.length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: t.accent, marginBottom: '6px' }}>AI Suggested subtasks</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {suggestions.map((s, i) => {
                      const added = (newTask.subtasks || []).some(st => st.title === s);
                      return (
                        <button key={i} onClick={() => {
                          if (!added) setNewTask({ ...newTask, subtasks: [...(newTask.subtasks || []), { id: generateId(), title: s, done: false }] });
                        }} style={{
                          padding: '4px 8px', background: added ? `${t.success}20` : `${t.accent}15`,
                          border: `1px solid ${added ? t.success : t.accent}30`, borderRadius: '6px',
                          color: added ? t.success : t.accent, fontSize: '10px', cursor: added ? 'default' : 'pointer'
                        }}>{added ? '✓' : '+'} {s}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Due Date</label>
                  <Input theme={theme} type="date" value={newTask.dueDate} onChange={v => setNewTask({ ...newTask, dueDate: v })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Priority</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['low', 'medium', 'high', 'urgent'].map(p => (
                      <button key={p} onClick={() => setNewTask({ ...newTask, priority: p })} style={{
                        flex: 1, padding: '8px 4px', background: newTask.priority === p ? priorityColors[p] : t.bgInput,
                        border: `1px solid ${newTask.priority === p ? priorityColors[p] : t.border}`,
                        borderRadius: '6px', color: newTask.priority === p ? '#fff' : t.textSecondary,
                        fontSize: '10px', cursor: 'pointer'
                      }}>{priorityIcons[p]}</button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Assign To (project team)</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {allTeam.map(u => {
                    const selected = (newTask.assignedTo || []).includes(u.id);
                    return (
                      <button key={u.id} onClick={() => {
                        if (selected) setNewTask({ ...newTask, assignedTo: newTask.assignedTo.filter(id => id !== u.id) });
                        else setNewTask({ ...newTask, assignedTo: [...(newTask.assignedTo || []), u.id] });
                      }} style={{
                        padding: '6px 10px', background: selected ? t.primary : t.bgInput,
                        border: `1px solid ${selected ? t.primary : t.border}`, borderRadius: '14px',
                        color: selected ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer'
                      }}>{u.name?.split(' ')[0]}</button>
                    );
                  })}
                </div>
              </div>
              
              {(newTask.subtasks || []).length > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Subtasks</label>
                  {newTask.subtasks.map((st, i) => (
                    <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ flex: 1, fontSize: '12px', color: t.text }}>• {st.title}</span>
                      <button onClick={() => setNewTask({ ...newTask, subtasks: newTask.subtasks.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              
              <Btn theme={theme} onClick={handleAddTask} disabled={!newTask.title.trim()} style={{ width: '100%' }} color="#22c55e">Create Task</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Downloads View - Client download center
  const DownloadsView = () => {
    // Get all approved assets from projects where user is assigned
    const myProjects = projects.filter(p => 
      (p.assignedTeam || []).some(m => m.id === userProfile?.id) || 
      (p.clientContacts || []).some(c => c.id === userProfile?.id) ||
      p.client === userProfile?.name
    );
    
    const approvedAssets = myProjects.flatMap(project => 
      (project.assets || [])
        .filter(a => !a.deleted && ['approved', 'delivered'].includes(a.status))
        .map(a => ({ ...a, projectName: project.name, projectId: project.id }))
    );
    
    const [selectedForDownload, setSelectedForDownload] = useState(new Set());
    
    const toggleSelect = (assetId) => {
      setSelectedForDownload(prev => {
        const next = new Set(prev);
        if (next.has(assetId)) next.delete(assetId);
        else next.add(assetId);
        return next;
      });
    };
    
    const selectAll = () => {
      if (selectedForDownload.size === approvedAssets.length) {
        setSelectedForDownload(new Set());
      } else {
        setSelectedForDownload(new Set(approvedAssets.map(a => a.id)));
      }
    };
    
    // Group by project
    const byProject = {};
    approvedAssets.forEach(a => {
      if (!byProject[a.projectId]) byProject[a.projectId] = { name: a.projectName, assets: [] };
      byProject[a.projectId].assets.push(a);
    });
    
    const fileTypeIcon = (type) => type === 'image' ? 'IMG' : type === 'video' ? 'VID' : 'DOC';

    return (
      <div>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: t.text }}>Download Center</h1>
            <p style={{ fontSize: '13px', color: t.textMuted, margin: '6px 0 0' }}>{approvedAssets.length} approved assets ready for download</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={selectAll} style={{
              padding: '10px 18px',
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: '10px',
              color: t.text,
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}>
              {selectedForDownload.size === approvedAssets.length ? 'Deselect All' : 'Subs: Select All'}
            </button>
            {selectedForDownload.size > 0 && (
              <button onClick={() => {
                const assetsToDownload = approvedAssets.filter(a => selectedForDownload.has(a.id));
                assetsToDownload.forEach(asset => {
                  const link = document.createElement('a');
                  link.href = asset.url;
                  link.download = asset.name;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                });
                showToast(`Downloading ${assetsToDownload.length} files...`, 'success');
              }} style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '600',
                boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                Download ({selectedForDownload.size})
              </button>
            )}
          </div>
        </div>

        {Object.keys(byProject).length === 0 ? (
          <div className="animate-fadeInUp" style={{ textAlign: 'center', padding: '80px 20px', color: t.textMuted, background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: t.cardRadius, border: `1px solid ${t.bgGlassBorder}` }}>
            <div style={{ marginBottom: '16px', opacity: 0.5 }}><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg></div>
            <div style={{ fontSize: '16px', fontWeight: '500', color: t.textSecondary, marginBottom: '6px' }}>No approved assets available yet</div>
            <div style={{ fontSize: '12px', color: t.textMuted }}>Assets will appear here once they are approved</div>
          </div>
        ) : (
          Object.entries(byProject).map(([projectId, data]) => (
            <div key={projectId} style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: t.cardRadius, padding: '20px', marginBottom: '20px', border: `1px solid ${t.bgGlassBorder}`, boxShadow: t.shadowGlass }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: t.text }}>{data.name}</h3>
                <span style={{
                  fontSize: '11px',
                  color: t.primary,
                  background: `${t.primary}12`,
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>{data.assets.length} files</span>
              </div>
              <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                {data.assets.map(asset => (
                  <div key={asset.id} className="hover-lift" onClick={() => toggleSelect(asset.id)} style={{
                    background: t.bgInput,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    border: selectedForDownload.has(asset.id) ? '2px solid #22c55e' : `1px solid ${t.border}`,
                    transition: 'all 0.2s'
                  }}>
                    <div style={{ aspectRatio: '4/3', background: t.bgTertiary, position: 'relative' }}>
                      {asset.type === 'image' ? (
                        <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '36px' }}>{fileTypeIcon(asset.type)}</span>
                          <span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>{asset.type || 'file'}</span>
                        </div>
                      )}
                      {selectedForDownload.has(asset.id) && (
                        <div style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: '#fff', boxShadow: '0 2px 6px rgba(34,197,94,0.4)' }}>✓</div>
                      )}
                      {asset.highResFiles?.length > 0 && (
                        <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '4px', padding: '2px 8px', fontSize: '8px', fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>HD</div>
                      )}
                    </div>
                    <div style={{ padding: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{asset.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: t.textMuted }}>{fileTypeIcon(asset.type)}</span>
                        <span style={{ fontSize: '10px', color: t.textMuted }}>v{asset.currentVersion} • {formatFileSize(asset.fileSize)}</span>
                      </div>
                      {asset.highResFiles?.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {asset.highResFiles.map((f, i) => (
                            <a key={i} href={f.url} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
                              padding: '3px 8px',
                              background: 'rgba(34,197,94,0.15)',
                              borderRadius: '6px',
                              fontSize: '9px',
                              color: '#22c55e',
                              textDecoration: 'none',
                              fontWeight: '500',
                              transition: 'background 0.2s'
                            }}>
                              {f.formatLabel?.split(' ')[0] || f.format}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  // Project Decks Tab - Upload decks, embed Google Slides
  const ProjectDecksTab = ({ project, onUpdate }) => {
    const [showAddDeck, setShowAddDeck] = useState(false);
    const [deckType, setDeckType] = useState('upload'); // upload, embed
    const [deckPhase, setDeckPhase] = useState('pre-production'); // pre-production, production, delivery
    const [embedUrl, setEmbedUrl] = useState('');
    const [deckName, setDeckName] = useState('');
    const [uploading, setUploading] = useState(false);
    const deckInputRef = useRef(null);
    
    // Get decks from project
    const decks = project.decks || [];
    
    // Group by phase
    const preProduction = decks.filter(d => d.phase === 'pre-production');
    const production = decks.filter(d => d.phase === 'production');
    const delivery = decks.filter(d => d.phase === 'delivery');
    
    // Extract Google Slides ID from URL
    const getGoogleSlidesEmbedUrl = (url) => {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
      }
      return url;
    };
    
    // Handle deck upload
    const handleUploadDeck = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setUploading(true);
      try {
        const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('@/lib/firebase');
        
        const fileRef = ref(storage, `projects/${project.id}/decks/${Date.now()}-${file.name}`);
        await uploadBytesResumable(fileRef, file);
        const url = await getDownloadURL(fileRef);
        
        const newDeck = {
          id: generateId(),
          name: deckName || file.name,
          type: 'file',
          phase: deckPhase,
          url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userProfile?.id,
          uploadedByName: userProfile?.name
        };
        
        await updateProject(project.id, { decks: [...decks, newDeck] });
        onUpdate();
        setShowAddDeck(false);
        setDeckName('');
        showToast('Deck uploaded!', 'success');
      } catch (err) {
        console.error('Deck upload error:', err);
        showToast('Upload failed', 'error');
      }
      setUploading(false);
    };
    
    // Handle embed add
    const handleAddEmbed = async () => {
      if (!embedUrl) return;
      
      const newDeck = {
        id: generateId(),
        name: deckName || 'Google Slides Presentation',
        type: 'embed',
        phase: deckPhase,
        embedUrl: getGoogleSlidesEmbedUrl(embedUrl),
        originalUrl: embedUrl,
        addedAt: new Date().toISOString(),
        addedBy: userProfile?.id,
        addedByName: userProfile?.name
      };
      
      await updateProject(project.id, { decks: [...decks, newDeck] });
      onUpdate();
      setShowAddDeck(false);
      setDeckName('');
      setEmbedUrl('');
      showToast('Presentation added!', 'success');
    };
    
    // Delete deck
    const handleDeleteDeck = async (deckId) => {
      if (!confirm('Delete this presentation?')) return;
      const updated = decks.filter(d => d.id !== deckId);
      await updateProject(project.id, { decks: updated });
      onUpdate();
      showToast('Deleted', 'success');
    };
    
    // Deck card component
    const DeckCard = ({ deck }) => {
      const [showPreview, setShowPreview] = useState(false);
      
      return (
        <>
          <div style={{ background: t.bgCard, borderRadius: '10px', border: `1px solid ${t.border}`, overflow: 'hidden', marginBottom: '10px' }}>
            <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '8px', background: deck.type === 'embed' ? 'rgba(234,179,8,0.2)' : 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {deck.type === 'embed' ? '' : 'DOC'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '500', fontSize: '13px', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deck.name}</div>
                <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px' }}>
                  {deck.type === 'embed' ? 'Google Slides' : formatFileSize(deck.fileSize)} • {formatTimeAgo(deck.addedAt || deck.uploadedAt)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {deck.type === 'embed' ? (
                  <button onClick={() => setShowPreview(true)} style={{ padding: '6px 10px', background: t.primary, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>View</button>
                ) : (
                  <a href={deck.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 10px', background: t.primary, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', textDecoration: 'none' }}>Open</a>
                )}
                {isProducer && (
                  <button onClick={() => handleDeleteDeck(deck.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>{Icons.trash('#ef4444')}</button>
                )}
              </div>
            </div>
          </div>
          
          {/* Preview Modal for Embeds */}
          {showPreview && deck.type === 'embed' && (
            <Modal theme={theme} title={deck.name} onClose={() => setShowPreview(false)} wide>
              <div style={{ padding: '0', height: '70vh' }}>
                <iframe
                  src={deck.embedUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  title={deck.name}
                />
              </div>
            </Modal>
          )}
        </>
      );
    };
    
    // Phase section component
    const PhaseSection = ({ title, icon, phaseName, items }) => (
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '16px' }}>{icon}</span>
          <h4 style={{ margin: 0, fontSize: '13px', color: t.text }}>{title}</h4>
          <span style={{ fontSize: '11px', color: t.textMuted }}>({items.length})</span>
        </div>
        {items.length === 0 ? (
          <div style={{ padding: '20px', background: t.bgInput, borderRadius: '8px', textAlign: 'center', color: t.textMuted, fontSize: '12px' }}>
            No {title.toLowerCase()} decks yet
          </div>
        ) : (
          items.map(deck => <DeckCard key={deck.id} deck={deck} />)
        )}
      </div>
    );
    
    return (
      <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}` }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px' }}>Decks & Presentations</h3>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>Upload PDFs, PPTs or embed Google Slides</div>
          </div>
          {isProducer && <Btn theme={theme} onClick={() => setShowAddDeck(true)} small>+ Add Deck</Btn>}
        </div>
        
        <div style={{ padding: '16px' }}>
          <PhaseSection title="Pre-Production" icon="" phaseName="pre-production" items={preProduction} />
          <PhaseSection title="Production" icon="" phaseName="production" items={production} />
          <PhaseSection title="Delivery" icon="" phaseName="delivery" items={delivery} />
        </div>
        
        {/* Add Deck Modal */}
        {showAddDeck && (
          <Modal theme={theme} title="Add Presentation" onClose={() => setShowAddDeck(false)}>
            <div style={{ padding: '20px' }}>
              {/* Type selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setDeckType('upload')} style={{ flex: 1, padding: '10px', background: deckType === 'upload' ? t.primary : t.bgInput, border: `1px solid ${deckType === 'upload' ? t.primary : t.border}`, borderRadius: '8px', color: deckType === 'upload' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>DOC Upload File</button>
                  <button onClick={() => setDeckType('embed')} style={{ flex: 1, padding: '10px', background: deckType === 'embed' ? t.primary : t.bgInput, border: `1px solid ${deckType === 'embed' ? t.primary : t.border}`, borderRadius: '8px', color: deckType === 'embed' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>Google Slides</button>
                </div>
              </div>
              
              {/* Phase selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Phase</label>
                <Select theme={theme} value={deckPhase} onChange={setDeckPhase}>
                  <option value="pre-production">VID Pre-Production</option>
                  <option value="production">Production</option>
                  <option value="delivery">Delivery</option>
                </Select>
              </div>
              
              {/* Name */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Name (optional)</label>
                <Input theme={theme} value={deckName} onChange={setDeckName} placeholder="Presentation name" />
              </div>
              
              {deckType === 'upload' ? (
                <div style={{ marginBottom: '16px' }}>
                  <div onClick={() => deckInputRef.current?.click()} style={{ padding: '30px', border: `2px dashed ${t.border}`, borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ marginBottom: '8px', opacity: 0.5 }}><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                    <div style={{ fontSize: '12px', color: t.textMuted }}>Click to upload PDF, PPT, or PPTX</div>
                    <input ref={deckInputRef} type="file" accept=".pdf,.ppt,.pptx" style={{ display: 'none' }} onChange={handleUploadDeck} />
                  </div>
                  {uploading && <div style={{ textAlign: 'center', marginTop: '10px', color: t.primary, fontSize: '12px' }}>Uploading...</div>}
                </div>
              ) : (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Google Slides URL</label>
                  <Input theme={theme} value={embedUrl} onChange={setEmbedUrl} placeholder="https://docs.google.com/presentation/d/..." />
                  <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px' }}>Paste the share link from Google Slides</div>
                </div>
              )}
              
              {deckType === 'embed' && (
                <Btn theme={theme} onClick={handleAddEmbed} disabled={!embedUrl} style={{ width: '100%' }} color="#22c55e">Add Presentation</Btn>
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  };

  const ProjectDetail = () => {
    const [tab, setTab] = useState('assets');
    const [selectedCat, setSelectedCat] = useState(null);
    const [showUpload, setShowUpload] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showAppearance, setShowAppearance] = useState(false);
    const [showAddTeam, setShowAddTeam] = useState(false);
    const [showEditProject, setShowEditProject] = useState(false);
    const [editProjectData, setEditProjectData] = useState({ name: '', client: '', categories: [], requiredFormats: [], requiredSizes: [], maxRevisions: 0 });
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [assetTab, setAssetTab] = useState('preview');
    const [sidebarSection, setSidebarSection] = useState({ assignment: true, versions: true, feedback: true, details: false });
    const [sidebarActionsOpen, setSidebarActionsOpen] = useState(false);
    const [replyingTo, setReplyingTo] = useState(null);
    const [replyText, setReplyText] = useState('');
    const [showCropper, setShowCropper] = useState(false);
    const [selectedAssets, setSelectedAssets] = useState(new Set());
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadMode, setUploadMode] = useState('files'); // 'files' | 'folder'
    const [folderGroups, setFolderGroups] = useState({}); // { subfolderName: [files] }
    const [catMappings, setCatMappings] = useState({}); // { subfolderName: categoryId | '__new__' }
    const [showAddCat, setShowAddCat] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, catId? }
    const [renamingCat, setRenamingCat] = useState(null); // catId being renamed
    const [renameValue, setRenameValue] = useState('');
    const [unmatchedFiles, setUnmatchedFiles] = useState([]); // Files that need manual matching
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [newFeedback, setNewFeedback] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [filterStars, setFilterStars] = useState(0);
    const [filterStatus, setFilterStatus] = useState('all');
    const [colorFilter, setColorFilter] = useState(null); // 'red' | 'yellow' | 'green' | null
    const [sortBy, setSortBy] = useState('newest');
    const [showComparePanel, setShowComparePanel] = useState(false);
    const [compareAssetIds, setCompareAssetIds] = useState([]);
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkType, setNewLinkType] = useState('client');
    const [newLinkExpiry, setNewLinkExpiry] = useState('');
    const [versionFile, setVersionFile] = useState(null);
    const [uploadingVersion, setUploadingVersion] = useState(false);
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const fileCategoriesRef = useRef(new Map()); // File → categoryId override (set by folder upload)
    const versionInputRef = useRef(null);
    const videoRef = useRef(null);
    const feedbackInputRef = useRef(null);
    const [videoTime, setVideoTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [videoVolume, setVideoVolume] = useState(1);
    const [videoMuted, setVideoMuted] = useState(false);
    const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [videoControlsVisible, setVideoControlsVisible] = useState(true);
    const [videoHoverTime, setVideoHoverTime] = useState(null);
    const [videoHoverX, setVideoHoverX] = useState(0);
    const [videoBuffered, setVideoBuffered] = useState(0);
    const videoControlsTimer = useRef(null);
    const scrubBarRef = useRef(null);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [assetPanelCollapsed, setAssetPanelCollapsed] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [showSelectionOverview, setShowSelectionOverview] = useState(false);
    const hlsRef = useRef(null);
    const [highlightedFeedbackId, setHighlightedFeedbackId] = useState(null);
    const [shuttleSpeed, setShuttleSpeed] = useState(0); // -4,-2,-1,0,1,2,4
    const [isScrubbing, setIsScrubbing] = useState(false);
    const videoContainerRef = useRef(null);
    const [videoFocused, setVideoFocused] = useState(false);
    const videoTimeRAF = useRef(null);
    const handleVideoTimeUpdate = useCallback((e) => {
      if (videoTimeRAF.current) return;
      videoTimeRAF.current = requestAnimationFrame(() => {
        setVideoTime(e.target.currentTime);
        videoTimeRAF.current = null;
      });
    }, []);
    const videoFeedbackMarkers = useMemo(() => (selectedAsset?.feedback || []).filter(fb => fb.videoTimestamp != null), [selectedAsset?.feedback]);
    const visibleVideoAnnotations = useMemo(() => {
      if (!selectedAsset?.annotations || selectedAsset?.type !== 'video') return [];
      return selectedAsset.annotations.filter(a => a.videoTimestamp != null && Math.abs(a.videoTimestamp - videoTime) < 0.5);
    }, [selectedAsset?.annotations, selectedAsset?.type, videoTime]);

    // Auto-pause video when entering annotate tab (side-effect must live in useEffect, not in render)
    useEffect(() => {
      if (assetTab === 'annotate' && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setVideoPlaying(false);
      }
    }, [assetTab]);

    const handleVideoScrubMove = useCallback((e) => {
      if (!scrubBarRef.current) return;
      const rect = scrubBarRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVideoHoverTime(pct * (videoDuration || 0));
      setVideoHoverX(e.clientX - rect.left);
      if (isScrubbing && videoRef.current) videoRef.current.currentTime = pct * (videoDuration || 0);
    }, [videoDuration, isScrubbing]);
    
    // Zoom system state
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isLoadingHighRes, setIsLoadingHighRes] = useState(false);
    const [highResLoaded, setHighResLoaded] = useState(false);
    const imageContainerRef = useRef(null);
    const lastPinchDistance = useRef(0);

    // HLS.js initialization for Mux videos (Chrome/Firefox)
    useEffect(() => {
      if (!selectedAsset?.muxPlaybackId || !videoRef.current) return;
      
      const video = videoRef.current;
      const hlsUrl = `https://stream.mux.com/${selectedAsset.muxPlaybackId}.m3u8`;
      
      // Check if HLS is natively supported (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        return;
      }
      
      // For Chrome/Firefox, use HLS.js
      const loadHls = async () => {
        try {
          // Dynamically import HLS.js
          const Hls = (await import('hls.js')).default;
          
          if (Hls.isSupported()) {
            // Cleanup previous instance
            if (hlsRef.current) {
              hlsRef.current.destroy();
            }
            
            const hls = new Hls({
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
            });
            
            hlsRef.current = hls;
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              // Video is ready to play
            });
            
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                console.error('HLS fatal error:', data);
                // Fallback to direct URL if available
                if (selectedAsset.url) {
                  video.src = selectedAsset.url;
                }
              }
            });
          }
        } catch (e) {
          console.error('HLS.js load error:', e);
          // Fallback to direct source
          video.src = hlsUrl;
        }
      };
      
      loadHls();
      
      return () => {
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
      };
    }, [selectedAsset?.muxPlaybackId, selectedAsset?.id]);

    // Close speed menu on outside click
    useEffect(() => {
      if (!showSpeedMenu) return;
      const handleClick = () => setShowSpeedMenu(false);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }, [showSpeedMenu]);

    // Close context menu on outside click
    useEffect(() => {
      if (!contextMenu) return;
      const handleClick = () => setContextMenu(null);
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }, [contextMenu]);

    // Global mouse up to stop scrubbing
    useEffect(() => {
      if (!isScrubbing) return;
      const handleUp = () => setIsScrubbing(false);
      const handleMove = (e) => {
        if (!scrubBarRef.current || !videoRef.current) return;
        const rect = scrubBarRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        videoRef.current.currentTime = pct * (videoDuration || 0);
      };
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('mousemove', handleMove);
      return () => { window.removeEventListener('mouseup', handleUp); window.removeEventListener('mousemove', handleMove); };
    }, [isScrubbing, videoDuration]);

    // Reverse shuttle emulation (HTML5 video doesn't support negative playbackRate)
    useEffect(() => {
      if (shuttleSpeed >= 0 || !videoRef.current) return;
      const vid = videoRef.current;
      vid.pause();
      const step = Math.abs(shuttleSpeed) / 24; // frames per tick based on shuttle speed
      const interval = setInterval(() => {
        if (vid.currentTime <= 0) { clearInterval(interval); setShuttleSpeed(0); setVideoPlaying(false); return; }
        vid.currentTime = Math.max(0, vid.currentTime - step);
      }, 1000 / 24);
      return () => clearInterval(interval);
    }, [shuttleSpeed]);

    // Auto-hide video controls after 3s inactivity
    useEffect(() => {
      if (!selectedAsset || selectedAsset.type !== 'video') return;
      const resetTimer = () => {
        setVideoControlsVisible(true);
        if (videoControlsTimer.current) clearTimeout(videoControlsTimer.current);
        videoControlsTimer.current = setTimeout(() => {
          if (videoPlaying) setVideoControlsVisible(false);
        }, 3000);
      };
      const container = videoContainerRef.current;
      if (!container) return;
      const handleEnter = () => setVideoControlsVisible(true);
      const handleLeave = () => { if (videoPlaying) setVideoControlsVisible(false); };
      container.addEventListener('mousemove', resetTimer);
      container.addEventListener('mouseenter', handleEnter);
      container.addEventListener('mouseleave', handleLeave);
      resetTimer();
      return () => {
        container.removeEventListener('mousemove', resetTimer);
        container.removeEventListener('mouseenter', handleEnter);
        container.removeEventListener('mouseleave', handleLeave);
        if (videoControlsTimer.current) clearTimeout(videoControlsTimer.current);
      };
    }, [selectedAsset?.id, selectedAsset?.type, videoPlaying]);

    // Update buffered range
    useEffect(() => {
      if (!videoRef.current || selectedAsset?.type !== 'video') return;
      const vid = videoRef.current;
      const updateBuffered = () => {
        if (vid.buffered.length > 0) setVideoBuffered(vid.buffered.end(vid.buffered.length - 1));
      };
      vid.addEventListener('progress', updateBuffered);
      return () => vid.removeEventListener('progress', updateBuffered);
    }, [selectedAsset?.id, selectedAsset?.type]);

    // Reset zoom when asset changes
    useEffect(() => {
      setZoomLevel(1);
      setPanPosition({ x: 0, y: 0 });
      setHighResLoaded(false);
      setIsLoadingHighRes(false);
    }, [selectedAsset?.id]);

    // Keyboard shortcuts for navigation (must be before conditional return)
    useEffect(() => {
      if (!selectedAsset || !selectedProject) return;
      const allAssets = (selectedProject.assets || []).filter(x => !x.deleted);
      const filteredAssets = selectedCat ? allAssets.filter(x => x.category === selectedCat) : allAssets;
      const typeOrder = { image: 0, video: 1, audio: 2, other: 3 };
      const sortedAssets = filteredAssets.sort((x, y) => (typeOrder[x.type] || 3) - (typeOrder[y.type] || 3));
      const currentIndex = sortedAssets.findIndex(a => a.id === selectedAsset.id);
      const handleKeyNav = async (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        // Arrow navigation — but NOT when video is focused (frame stepping takes priority)
        if (selectedAsset.type === 'video' && videoFocused && videoRef.current) {
          const vid = videoRef.current;
          if (e.shiftKey && e.key === 'ArrowLeft') {
            e.preventDefault();
            vid.currentTime = Math.max(0, vid.currentTime - 1);
          } else if (e.shiftKey && e.key === 'ArrowRight') {
            e.preventDefault();
            vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            vid.pause(); setVideoPlaying(false); setShuttleSpeed(0);
            vid.currentTime = Math.max(0, vid.currentTime - 1/24);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            vid.pause(); setVideoPlaying(false); setShuttleSpeed(0);
            vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 1/24);
          }
        } else {
          if (e.key === 'ArrowLeft' && currentIndex > 0) {
            setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex - 1]);
          } else if (e.key === 'ArrowRight' && currentIndex < sortedAssets.length - 1) {
            setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex + 1]);
          }
        }
        
        // 1-5 for ratings
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
          e.preventDefault();
          const rating = parseInt(e.key);
          const newRating = selectedAsset.rating === rating ? 0 : rating; // Toggle if same
          const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, rating: newRating } : a);
          setSelectedAsset({ ...selectedAsset, rating: newRating });
          await updateProject(selectedProject.id, { assets: updated });
          await refreshProject();
          showToast(`Rated ${newRating > 0 ? '★'.repeat(newRating) : 'cleared'}`, 'success');
        }
        
        // S for toggle select
        if (e.key === 's' || e.key === 'S') {
          e.preventDefault();
          const newSelected = !selectedAsset.isSelected;
          const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, isSelected: newSelected } : a);
          setSelectedAsset({ ...selectedAsset, isSelected: newSelected });
          await updateProject(selectedProject.id, { assets: updated });
          await refreshProject();
          showToast(newSelected ? 'Selected' : 'Deselected', 'success');
        }
        
        // Color label shortcuts: P=red pick, M=yellow maybe, G=green alt, U=clear
        if (e.key === 'p' || e.key === 'P') { e.preventDefault(); await handleColorLabel(selectedAsset.id, 'red'); showToast('🔴 Marked as Pick', 'success'); }
        if (e.key === 'm' || e.key === 'M') { e.preventDefault(); await handleColorLabel(selectedAsset.id, 'yellow'); showToast('🟡 Marked as Maybe', 'success'); }
        if (e.key === 'g' || e.key === 'G') { e.preventDefault(); await handleColorLabel(selectedAsset.id, 'green'); showToast('🟢 Marked as Alt', 'success'); }
        if (e.key === 'u' || e.key === 'U') { e.preventDefault(); const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, colorLabel: null } : a); setSelectedAsset({ ...selectedAsset, colorLabel: null }); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); showToast('Label cleared', 'success'); }

        // Escape — exit annotation mode first, then close lightbox
        if (e.key === 'Escape') {
          if (assetTab === 'annotate') {
            setAssetTab('preview');
            return;
          }
          setSelectedAsset(null);
        }
        
        // F for fullscreen
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setIsFullscreen(!isFullscreen);
        }
        
        // Zoom shortcuts (for images)
        if (selectedAsset.type === 'image' && assetTab === 'preview') {
          // + or = for zoom in
          if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            setZoomLevel(z => Math.min(5, Math.round((z + 0.1) * 10) / 10));
          }
          // - for zoom out
          if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            setZoomLevel(z => {
              const newZ = Math.max(0.25, Math.round((z - 0.1) * 10) / 10);
              if (newZ <= 1) setPanPosition({ x: 0, y: 0 });
              return newZ;
            });
          }
          // 0 to reset zoom
          if (e.key === '0') {
            e.preventDefault();
            setZoomLevel(1);
            setPanPosition({ x: 0, y: 0 });
          }
        }

        // Video keyboard shortcuts — J/K/L shuttle system (disabled during annotation)
        if (selectedAsset.type === 'video' && videoRef.current && assetTab !== 'annotate') {
          const vid = videoRef.current;
          // K or Space = toggle play/pause, reset shuttle
          if (e.key === ' ' || e.key === 'k' || e.key === 'K') {
            e.preventDefault();
            setShuttleSpeed(0);
            vid.playbackRate = 1;
            setVideoPlaybackRate(1);
            if (vid.paused) { vid.play(); setVideoPlaying(true); } else { vid.pause(); setVideoPlaying(false); }
          }
          // J = reverse shuttle (-1x, -2x, -4x)
          if (e.key === 'j' || e.key === 'J') {
            e.preventDefault();
            setShuttleSpeed(prev => {
              const speeds = [0, -1, -2, -4];
              const idx = speeds.indexOf(prev);
              const newSpeed = idx >= 0 && idx < speeds.length - 1 ? speeds[idx + 1] : speeds[speeds.length - 1];
              if (newSpeed === 0) { vid.pause(); setVideoPlaying(false); }
              else { vid.pause(); setVideoPlaying(false); }
              return newSpeed;
            });
          }
          // L = forward shuttle (1x, 2x, 4x)
          if (e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            setShuttleSpeed(prev => {
              const speeds = [0, 1, 2, 4];
              const idx = speeds.indexOf(prev);
              const newSpeed = idx >= 0 && idx < speeds.length - 1 ? speeds[idx + 1] : speeds[speeds.length - 1];
              vid.playbackRate = newSpeed; setVideoPlaybackRate(newSpeed);
              vid.play(); setVideoPlaying(true);
              return newSpeed;
            });
          }
          // , and . = frame step (kept for compatibility)
          if (e.key === ',') {
            e.preventDefault();
            vid.pause(); setVideoPlaying(false); setShuttleSpeed(0);
            vid.currentTime = Math.max(0, vid.currentTime - 1/24);
          }
          if (e.key === '.') {
            e.preventDefault();
            vid.pause(); setVideoPlaying(false); setShuttleSpeed(0);
            vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 1/24);
          }
          // [ and ] = speed decrease/increase
          if (e.key === '[') {
            e.preventDefault();
            const speeds = [0.25, 0.5, 1, 1.5, 2, 4];
            const idx = speeds.indexOf(vid.playbackRate);
            if (idx > 0) { vid.playbackRate = speeds[idx - 1]; setVideoPlaybackRate(speeds[idx - 1]); }
          }
          if (e.key === ']') {
            e.preventDefault();
            const speeds = [0.25, 0.5, 1, 1.5, 2, 4];
            const idx = speeds.indexOf(vid.playbackRate);
            if (idx < speeds.length - 1) { vid.playbackRate = speeds[idx + 1]; setVideoPlaybackRate(speeds[idx + 1]); }
          }
        }
      };
      window.addEventListener('keydown', handleKeyNav);
      return () => window.removeEventListener('keydown', handleKeyNav);
    }, [selectedAsset, selectedProject, selectedCat, isFullscreen, assetTab, zoomLevel, videoPlaying, videoPlaybackRate, videoFocused]);

    // Auto-pause video when entering annotation mode
    useEffect(() => {
      if (assetTab === 'annotate' && selectedAsset?.type === 'video' && videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setVideoPlaying(false);
        setShuttleSpeed(0);
      }
    }, [assetTab, selectedAsset?.type]);

    if (!selectedProject) return null;
    const cats = selectedProject.categories || [];
    const team = (selectedProject.assignedTeam || []).map(t => ({ ...users.find(u => u.id === t.odId), isOwner: t.isOwner })).filter(m => m?.id);
    const shareLinks = (selectedProject.shareLinks || []).filter(l => l.active);
    const editors = [...coreTeam, ...freelancers].filter(u => Object.keys(TEAM_ROLES).includes(u.role));
    const availableTeam = [...coreTeam, ...freelancers].filter(u => !team.find(m => m.id === u.id));

    const getAssets = () => {
      let a = (selectedProject.assets || []).filter(x => !x.deleted);
      if (selectedCat) {
        if (selectedCat === '__videos__') a = a.filter(x => x.type === 'video');
        else if (selectedCat === '__selected__') a = a.filter(x => x.isSelected);
        else if (selectedCat === '__not_selected__') a = a.filter(x => !x.isSelected);
        else a = a.filter(x => x.category === selectedCat);
      }
      const typeOrder = { image: 0, video: 1, audio: 2, other: 3 };
      return a.sort((x, y) => (typeOrder[x.type] || 3) - (typeOrder[y.type] || 3));
    };
    const assets = getAssets();

    // Apply filters
    let displayAssets = [...assets];
    if (filterStars > 0) displayAssets = displayAssets.filter(a => (a.rating || 0) >= filterStars);
    if (filterStatus !== 'all') displayAssets = displayAssets.filter(a => a.status === filterStatus);
    if (colorFilter) displayAssets = displayAssets.filter(a => a.colorLabel === colorFilter);
    if (sortBy === 'rating-desc') displayAssets = [...displayAssets].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    if (sortBy === 'rating-asc') displayAssets = [...displayAssets].sort((a, b) => (a.rating || 0) - (b.rating || 0));
    if (sortBy === 'name') displayAssets = [...displayAssets].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const getCatCount = id => (selectedProject.assets || []).filter(a => !a.deleted && a.category === id).length;
    const cardWidth = CARD_SIZES[appearance.cardSize];
    const aspectRatio = ASPECT_RATIOS[appearance.aspectRatio];

    const handleUpload = async (forcedFiles) => {
      const toProcess = forcedFiles ?? uploadFiles;
      if (!toProcess.length) return;
      setShowUpload(false);

      for (const file of toProcess) {
        const uid = generateId();
        const fileType = getFileType(file);

        // Per-file category override (set by folder upload), or fall back to selectedCat
        let cat = fileCategoriesRef.current.get(file) ?? selectedCat;
        if (!cat) {
          if (fileType === 'video') {
            cat = cats.find(c => c.id === 'videos')?.id || cats.find(c => c.id === 'animation')?.id || cats[0]?.id;
          } else if (fileType === 'image') {
            cat = cats.find(c => c.id === 'statics')?.id || cats.find(c => c.id === 'cgi')?.id || cats[0]?.id;
          } else if (fileType === 'audio') {
            cat = cats.find(c => c.id === 'audio')?.id || cats[0]?.id;
          } else {
            cat = cats[0]?.id;
          }
        }
        
        if (!cat) { showToast('No category available', 'error'); return; }
        
        setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0, status: 'uploading' } }));
        
        try {
          const assetId = generateId();
          
          // For videos, upload directly to Mux CDN (fast, like Frame.io)
          if (fileType === 'video') {
            const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
            
            setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: 2, status: 'Getting CDN URL...' } }));
            
            // Get Mux direct upload URL
            let muxUploadId = null;
            let muxUploadUrl = null;
            let useMux = false;
            
            try {
              const muxResponse = await fetch('/api/mux/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: selectedProject.id, assetId, filename: file.name })
              });
              const muxData = await muxResponse.json();
              
              if (muxData.success && muxData.uploadUrl) {
                muxUploadId = muxData.uploadId;
                muxUploadUrl = muxData.uploadUrl;
                useMux = true;
              }
            } catch (e) {
              console.log('Mux not available, using Firebase');
            }
            
            let url = null;
            
            if (useMux) {
              // Upload directly to Mux CDN (fast - no double upload!)
              setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: 5, status: 'Uploading to CDN...' } }));
              
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', muxUploadUrl);
                
                xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) {
                    const progress = 5 + Math.round((e.loaded / e.total) * 85);
                    setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress, status: 'Uploading...' } }));
                  }
                };
                
                xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'));
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(file);
              });
              
            } else {
              // Fallback to Firebase
              setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: 5, status: 'Uploading...' } }));
              const sRef = ref(storage, path);
              const uploadTask = uploadBytesResumable(sRef, file);
              
              await new Promise((resolve, reject) => {
                uploadTask.on('state_changed',
                  (snap) => {
                    const progress = 5 + Math.round((snap.bytesTransferred / snap.totalBytes) * 85);
                    setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress, status: 'Uploading...' } }));
                  },
                  reject,
                  resolve
                );
              });
              url = await getDownloadURL(uploadTask.snapshot.ref);
            }
            
            setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: 92, status: 'Creating thumbnail...' } }));
            
            // Generate thumbnail
            let thumbnailUrl = null;
            try {
              const thumbBlob = await generateVideoThumbnail(file);
              if (thumbBlob) {
                const thumbPath = `projects/${selectedProject.id}/${cat}/thumbs/${Date.now()}-thumb.jpg`;
                const thumbRef = ref(storage, thumbPath);
                await uploadBytesResumable(thumbRef, thumbBlob);
                thumbnailUrl = await getDownloadURL(thumbRef);
              }
            } catch (e) { console.log('Thumb failed:', e); }
            
            setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: 98, status: 'Saving...' } }));
            
            // Save asset immediately - don't wait for Mux processing!
            const newAsset = {
              id: assetId,
              name: file.name,
              type: 'video',
              category: cat,
              url, // Firebase URL or null for Mux-only
              path,
              thumbnail: thumbnailUrl,
              muxUploadId, // Used to fetch playbackId when viewing
              muxPlaybackId: null, // Will be fetched on-demand
              fileSize: file.size,
              mimeType: file.type,
              status: 'pending',
              rating: 0,
              isSelected: false,
              colorLabel: null,
              assignedTo: null,
              uploadedBy: userProfile.id,
              uploadedByName: userProfile.name,
              uploadedAt: new Date().toISOString(),
              versions: [{ version: 1, url, muxUploadId, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name }],
              currentVersion: 1,
              feedback: [],
              annotations: [],
              gdriveLink: ''
            };
            
            // Fetch fresh project data before updating to avoid race conditions
            const freshProjects = await getProjects();
            const freshProject = freshProjects.find(p => p.id === selectedProject.id);
            const currentAssets = freshProject?.assets || [];
            
            const updatedAssets = [...currentAssets, newAsset];
            const catName = cats.find(c => c.id === cat)?.name || cat;
            const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name} to ${catName}`, timestamp: new Date().toISOString() };
            await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(freshProject?.activityLog || []), activity] });
            await refreshProject();
            setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
            showToast(useMux ? `Video uploaded! HLS ready in ~30s` : `Video uploaded!`, 'success');
            
          } else {
            // For images and audio, use Firebase Storage
            const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
            const sRef = ref(storage, path);
            const task = uploadBytesResumable(sRef, file);
            
            // Wrap in Promise to properly await
            await new Promise((resolve, reject) => {
              task.on('state_changed', 
                snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })), 
                (error) => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); reject(error); },
                async () => {
                  try {
                    const url = await getDownloadURL(task.snapshot.ref);
                    
                    // Generate optimized thumbnail and preview for images
                    let thumbnailUrl = null;
                    let previewUrl = null;
                    try {
                      if (fileType === 'image') {
                        setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], status: 'Optimizing...' } }));
                        
                        // Generate small thumbnail for grid (300px square)
                        const thumbBlob = await generateThumbnail(file);
                        if (thumbBlob) {
                          const thumbPath = `projects/${selectedProject.id}/${cat}/thumbs/${Date.now()}-thumb.jpg`;
                          const thumbRef = ref(storage, thumbPath);
                          await uploadBytesResumable(thumbRef, thumbBlob);
                          thumbnailUrl = await getDownloadURL(thumbRef);
                        }
                        
                        // Generate preview for lightbox (1200px)
                        const previewBlob = await generatePreview(file);
                        if (previewBlob) {
                          const previewPath = `projects/${selectedProject.id}/${cat}/preview/${Date.now()}-preview.jpg`;
                          const previewRef = ref(storage, previewPath);
                          await uploadBytesResumable(previewRef, previewBlob);
                          previewUrl = await getDownloadURL(previewRef);
                        }
                      }
                    } catch (e) { console.log('Image optimization failed:', e); }
                    
                    const newAsset = { 
                      id: assetId, 
                      name: file.name, 
                      type: fileType, 
                      category: cat, 
                      url, 
                      path, 
                      thumbnail: thumbnailUrl || (fileType === 'image' ? url : null),
                      preview: previewUrl || thumbnailUrl || url, // Use preview for lightbox
                      fileSize: file.size, 
                      mimeType: file.type, 
                      status: 'pending', 
                      rating: 0,
                      isSelected: false,
                      colorLabel: null,
                      assignedTo: null,
                      uploadedBy: userProfile.id, 
                      uploadedByName: userProfile.name, 
                      uploadedAt: new Date().toISOString(), 
                      versions: [{ version: 1, url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name }], 
                      currentVersion: 1, 
                      feedback: [], 
                      annotations: [], 
                      gdriveLink: '' 
                    };
                    
                    // Fetch fresh project data before updating to avoid race conditions
                    const freshProjects = await getProjects();
                    const freshProject = freshProjects.find(p => p.id === selectedProject.id);
                    const currentAssets = freshProject?.assets || [];
                    
                    const updatedAssets = [...currentAssets, newAsset];
                    const catName = cats.find(c => c.id === cat)?.name || cat;
                    const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name} to ${catName}`, timestamp: new Date().toISOString() };
                    await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(freshProject?.activityLog || []), activity] });
                    await refreshProject();
                    setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
                    resolve();
                  } catch (e) {
                    reject(e);
                  }
                }
              );
            });
          }
        } catch (e) { 
          console.error('Upload error:', e);
          showToast(`Failed: ${file.name}`, 'error'); 
          setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
        }
      }
      if (!forcedFiles) setUploadFiles([]);
      fileCategoriesRef.current.clear();
    };

    // ─── Folder upload: parse subfolder structure → auto-create categories ───
    const CAT_COLORS_POOL = ['#6366f1','#ec4899','#f97316','#22c55e','#06b6d4','#a855f7','#f59e0b','#3b82f6','#10b981','#ef4444'];
    const slugifyCat = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || generateId();

    const handleFolderSelect = (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      // Group by first subfolder (2nd path segment = subfolder under the selected root)
      const groups = {};
      for (const file of files) {
        const parts = (file.webkitRelativePath || file.name).split('/');
        // parts[0] = selected folder name, parts[1] = subfolder (if any)
        const subfolder = parts.length > 2 ? parts[1] : (parts.length === 2 ? parts[0] : '__root__');
        if (!groups[subfolder]) groups[subfolder] = [];
        groups[subfolder].push(file);
      }
      setFolderGroups(groups);
      setCatMappings({});
    };

    const handleFolderUpload = async () => {
      if (!Object.keys(folderGroups).length) return;
      setShowUpload(false);

      // 1. Determine or create categories for each subfolder
      let currentCats = [...(selectedProject.categories || [])];
      const catIdFor = {}; // { subfolderName: categoryId }
      const newCats = [];

      for (const [subName, files] of Object.entries(folderGroups)) {
        const overrideId = catMappings[subName];
        if (overrideId && overrideId !== '__new__') {
          catIdFor[subName] = overrideId;
          continue;
        }
        // Try fuzzy match with existing category names
        const existing = currentCats.find(c =>
          c.name.toLowerCase() === subName.toLowerCase() ||
          c.id === slugifyCat(subName)
        );
        if (existing) {
          catIdFor[subName] = existing.id;
        } else {
          // Auto-create new category
          const id = slugifyCat(subName) !== '' ? slugifyCat(subName) : generateId();
          const color = CAT_COLORS_POOL[(newCats.length + currentCats.length) % CAT_COLORS_POOL.length];
          const newCat = { id, name: subName === '__root__' ? 'Uploads' : subName, icon: 'image', color };
          newCats.push(newCat);
          currentCats.push(newCat);
          catIdFor[subName] = id;
        }
      }

      // 2. Save new categories to Firestore before upload starts
      if (newCats.length > 0) {
        await updateProject(selectedProject.id, { categories: currentCats });
        await refreshProject();
        showToast(`Created ${newCats.length} new folder${newCats.length > 1 ? 's' : ''}: ${newCats.map(c => c.name).join(', ')}`, 'success');
      }

      // 3. Build per-file category map and flat file list
      fileCategoriesRef.current.clear();
      const allFiles = [];
      for (const [subName, files] of Object.entries(folderGroups)) {
        for (const file of files) {
          fileCategoriesRef.current.set(file, catIdFor[subName]);
          allFiles.push(file);
        }
      }

      // 4. Kick off the existing upload pipeline with the flat file list
      setFolderGroups({});
      setCatMappings({});
      await handleUpload(allFiles);
    };

    // Add a new custom category to the project quickly (from + button in category bar)
    const handleAddCategory = async () => {
      const name = newCatName.trim();
      if (!name) return;
      const id = slugifyCat(name) || generateId();
      const usedIds = new Set((selectedProject.categories || []).map(c => c.id));
      const finalId = usedIds.has(id) ? `${id}-${generateId()}` : id;
      const color = CAT_COLORS_POOL[(selectedProject.categories || []).length % CAT_COLORS_POOL.length];
      const newCat = { id: finalId, name, icon: 'image', color };
      const updated = [...(selectedProject.categories || []), newCat];
      await updateProject(selectedProject.id, { categories: updated });
      await refreshProject();
      setNewCatName('');
      setShowAddCat(false);
      setSelectedCat(finalId);
      showToast(`Folder "${name}" created`, 'success');
    };

    // ─── Drag-and-drop: files + folders dropped directly onto the asset grid ──
    const handleAssetAreaDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingOver(true);
    };
    const handleAssetAreaDragLeave = (e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingOver(false);
    };
    const handleAssetAreaDrop = async (e) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const items = Array.from(e.dataTransfer.items || []);
      const entries = items.map(i => i.webkitGetAsEntry?.()).filter(Boolean);

      if (!entries.length) {
        // No FileSystem API — fall back to plain file list
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length) { setUploadFiles(files); setUploadMode('files'); setShowUpload(true); }
        return;
      }

      // Read all entries (files + folders) recursively
      const fileArrays = await Promise.all(entries.map(entry => readFolderEntry(entry)));
      const allFiles = fileArrays.flat().filter(f => !f.name.startsWith('.'));

      const hasDir = entries.some(e => e.isDirectory);
      if (hasDir) {
        // Group by the top-level dropped folder name (first path segment)
        const groups = {};
        for (const file of allFiles) {
          const parts = (file.webkitRelativePath || file.name).split('/');
          const group = parts.length > 1 ? parts[0] : '__root__';
          if (!groups[group]) groups[group] = [];
          groups[group].push(file);
        }
        setFolderGroups(groups);
        setUploadMode('folder');
        setShowUpload(true);
      } else {
        setUploadFiles(allFiles);
        setUploadMode('files');
        setShowUpload(true);
      }
    };

    // ─── Right-click context menu ──────────────────────────────────────────────
    const handleContextMenu = (e, catId = null) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, catId });
    };

    const handleDeleteCategory = async (catId) => {
      if (!confirm(`Delete folder "${cats.find(c => c.id === catId)?.name}"? Assets inside will still exist but won't be in this folder.`)) return;
      const updated = (selectedProject.categories || []).filter(c => c.id !== catId);
      await updateProject(selectedProject.id, { categories: updated });
      await refreshProject();
      if (selectedCat === catId) setSelectedCat(null);
      setContextMenu(null);
    };

    const handleRenameCategory = async (catId, newName) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      const updated = (selectedProject.categories || []).map(c => c.id === catId ? { ...c, name: trimmed } : c);
      await updateProject(selectedProject.id, { categories: updated });
      await refreshProject();
      setRenamingCat(null);
      setRenameValue('');
      setContextMenu(null);
    };

    const handleUploadVersion = async () => {
      if (!versionFile || !selectedAsset) return;
      setUploadingVersion(true);
      try {
        const path = `projects/${selectedProject.id}/${selectedAsset.category}/${Date.now()}-v${selectedAsset.currentVersion + 1}-${versionFile.name}`;
        const sRef = ref(storage, path);
        await uploadBytesResumable(sRef, versionFile);
        const url = await getDownloadURL(sRef);
        
        // Check if there's pending feedback (indicates a revision cycle)
        const hasPendingFeedback = (selectedAsset.feedback || []).some(f => !f.isDone);
        const currentRound = selectedAsset.revisionRound || 1;
        const newRound = hasPendingFeedback ? currentRound + 1 : currentRound;

        // Check max revisions limit
        const maxRevisions = selectedProject.maxRevisions || 0;
        if (maxRevisions > 0 && newRound > maxRevisions) {
          showToast(`Max revisions (${maxRevisions}) reached! Request additional rounds from producer.`, 'error');
          setUploadingVersion(false);
          return;
        }

        const newVersion = {
          version: selectedAsset.currentVersion + 1,
          url,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userProfile.name,
          revisionRound: newRound
        };

        // Mark all pending feedback as resolved when new version is uploaded
        const updatedFeedback = (selectedAsset.feedback || []).map(f => f.isDone ? f : { ...f, isDone: true, resolvedInVersion: selectedAsset.currentVersion + 1 });

        // Build round history
        const roundHistory = [...(selectedAsset.roundHistory || [])];
        if (hasPendingFeedback && newRound > currentRound) {
          roundHistory.push({
            round: currentRound,
            feedbackCount: (selectedAsset.feedback || []).filter(f => (f.round || 1) === currentRound).length,
            resolvedAt: new Date().toISOString(),
            versionId: selectedAsset.currentVersion + 1,
          });
        }

        // Clear turnaround deadline on version upload
        const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? {
          ...a,
          url,
          thumbnail: a.type === 'image' ? url : a.thumbnail,
          versions: [...(a.versions || []), newVersion],
          currentVersion: selectedAsset.currentVersion + 1,
          status: 'review-ready',
          revisionRound: newRound,
          feedback: updatedFeedback,
          roundHistory,
          turnaroundDeadline: null,
        } : a);

        const activities = [{
          id: generateId(),
          type: 'version',
          message: `${userProfile.name} uploaded v${selectedAsset.currentVersion + 1} of ${selectedAsset.name}${newRound > currentRound ? ` (Revision R${newRound})` : ''}`,
          timestamp: new Date().toISOString()
        }];
        if (newRound > currentRound) {
          activities.push({ id: generateId(), type: 'round', message: `Round ${newRound} started for ${selectedAsset.name}`, timestamp: new Date().toISOString() });
        }
        const activity = activities[0];
        
        await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), ...activities] });
        await refreshProject();
        setSelectedAsset({ ...selectedAsset, url, versions: [...(selectedAsset.versions || []), newVersion], currentVersion: selectedAsset.currentVersion + 1, status: 'review-ready', revisionRound: newRound, feedback: updatedFeedback, roundHistory, turnaroundDeadline: null });
        setVersionFile(null);
        showToast(`v${selectedAsset.currentVersion + 1} uploaded!${newRound > currentRound ? ` Round ${newRound}` : ''}`, 'success');
        
        // Notify client/producer when new version is ready
        const clientsToNotify = team.filter(m => ['producer', 'client', 'admin'].includes(m.role));
        for (const client of clientsToNotify) {
          if (client.email && client.id !== userProfile.id) {
            sendEmailNotification(client.email, `New version ready: ${selectedAsset.name}`, `${userProfile.name} uploaded v${selectedAsset.currentVersion + 1} of "${selectedAsset.name}" and it's ready for review.`);
          }
        }
      } catch (e) { showToast('Failed to upload version', 'error'); }
      setUploadingVersion(false);
    };

    const handleRate = async (assetId, rating) => { const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, rating } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); };
    const handleToggleSelect = async (assetId) => { const asset = (selectedProject.assets || []).find(a => a.id === assetId); const newSelected = !asset?.isSelected; const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); };
    const handleColorLabel = async (assetId, label) => {
      const asset = (selectedProject.assets || []).find(a => a.id === assetId);
      const newLabel = asset?.colorLabel === label ? null : label; // toggle off if same
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, colorLabel: newLabel } : a);
      setSelectedAsset(prev => prev?.id === assetId ? { ...prev, colorLabel: newLabel } : prev);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
    };
    const handleBulkSelect = async (select) => { const updated = (selectedProject.assets || []).map(a => selectedAssets.has(a.id) ? { ...a, isSelected: select, status: select ? 'selected' : 'pending' } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); setSelectedAssets(new Set()); showToast(`${selectedAssets.size} assets ${select ? 'selected' : 'deselected'}`, 'success'); };
    const handleBulkDelete = async () => {
      if (!confirm(`Delete ${selectedAssets.size} assets? This cannot be undone.`)) return;
      const deletedAt = new Date().toISOString();
      const updated = (selectedProject.assets || []).map(a => selectedAssets.has(a.id) ? { ...a, deleted: true, deletedAt } : a);
      const activity = { id: generateId(), type: 'delete', message: `${userProfile.name} deleted ${selectedAssets.size} assets`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      setSelectedAssets(new Set());
      showToast(`${selectedAssets.size} assets deleted`, 'success');
    };
    
    // Enhanced selection confirmation with notifications
    const handleConfirmSelection = async () => {
      const selectedAssetsList = (selectedProject.assets || []).filter(a => !a.deleted && (a.isSelected || a.rating === 5));
      if (selectedAssetsList.length === 0) {
        showToast('No assets selected!', 'error');
        return;
      }
      
      const activity = { 
        id: generateId(), 
        type: 'selection', 
        message: `Selection confirmed by ${userProfile.name} (${selectedAssetsList.length} assets)`, 
        timestamp: new Date().toISOString(),
        userId: userProfile.id
      };
      
      // Update project
      await updateProject(selectedProject.id, { 
        selectionConfirmed: true, 
        selectionConfirmedAt: new Date().toISOString(),
        selectionConfirmedBy: userProfile.id,
        selectionConfirmedByName: userProfile.name,
        workflowPhase: 'editing',
        activityLog: [...(selectedProject.activityLog || []), activity] 
      });
      
      // Get editors and team members to notify
      const editorsToNotify = team.filter(m => ['editor', 'video-editor', 'colorist', 'retoucher', 'photo-editor'].includes(m.role));
      const producersToNotify = team.filter(m => ['producer', 'admin', 'team-lead'].includes(m.role));
      
      // Create in-app notifications
      const notifications = [];
      [...editorsToNotify, ...producersToNotify].forEach(member => {
        if (member.id !== userProfile.id) {
          notifications.push({
            id: generateId(),
            type: 'selection',
            title: 'Selection Confirmed',
            message: `${userProfile.name} confirmed selection for ${selectedProject.name} (${selectedAssetsList.length} assets ready for editing)`,
            projectId: selectedProject.id,
            projectName: selectedProject.name,
            userId: member.id,
            timestamp: new Date().toISOString(),
            read: false
          });
        }
      });
      
      // Save notifications (merge with existing)
      if (notifications.length > 0) {
        const existingNotifs = JSON.parse(localStorage.getItem('anandi-notifications') || '[]');
        localStorage.setItem('anandi-notifications', JSON.stringify([...notifications, ...existingNotifs].slice(0, 100)));
      }
      
      // Send email notifications to editors
      for (const editor of editorsToNotify) {
        if (editor.email) {
          await sendEmailNotification(
            editor.email,
            `Selection Confirmed: ${selectedProject.name}`,
            `${userProfile.name} has confirmed the selection for "${selectedProject.name}".\n\n${selectedAssetsList.length} assets are ready for editing.\n\nPlease log in to start working on the selected assets.`
          );
        }
      }
      
      await refreshProject();
      setShowSelectionOverview(false);
      showToast(`Selection confirmed! ${editorsToNotify.length} editor(s) notified `, 'success');
    };
    const handleUpdateStatus = async (assetId, status) => {
      const asset = (selectedProject.assets || []).find(a => a.id === assetId);
      let finalStatus = status;
      let extraFields = {};

      // Auto-handoff: when marked 'review-ready', check handoff chain
      if (status === 'review-ready' && asset) {
        const chains = selectedProject.handoffChains || [];
        const applicableChain = chains.find(c => c.scope === 'all' || c.scopeId === asset.category);
        if (applicableChain && applicableChain.stages?.length > 0) {
          const currentTeamGroup = asset.assignedTeamGroupId;
          const sortedStages = [...applicableChain.stages].sort((a, b) => a.order - b.order);
          const currentIdx = currentTeamGroup ? sortedStages.findIndex(s => s.teamGroupId === currentTeamGroup) : -1;
          const nextStage = sortedStages[currentIdx + 1];
          if (nextStage) {
            // Hand off to next team
            const nextGroup = (selectedProject.teamGroups || []).find(g => g.id === nextStage.teamGroupId);
            const nextAssignee = nextGroup?.leadId || nextGroup?.members?.[0]?.id || null;
            extraFields = {
              assignedTeamGroupId: nextStage.teamGroupId,
              assignedTeamGroupName: nextStage.teamGroupName,
              assignedTo: nextAssignee,
              pipelineStage: currentIdx + 1,
            };
            finalStatus = 'assigned';
            // Notify next team
            if (nextGroup?.members) {
              for (const m of nextGroup.members) {
                const member = [...coreTeam, ...freelancers].find(u => u.id === m.id);
                if (member?.email) sendEmailNotification(member.email, `Handoff: ${asset.name}`, `Asset "${asset.name}" has been handed off to ${nextStage.teamGroupName} for the next stage.`);
              }
            }
          }
        }
      }

      // Agency workflow: when review-ready and no more handoff stages, route to agency-review first
      if (finalStatus === 'review-ready' && selectedProject.workflowType === 'agency' && !extraFields.assignedTeamGroupName) {
        finalStatus = 'agency-review';
        // Notify agency contacts
        const agencyContacts = selectedProject.agencyContacts || [];
        for (const contact of agencyContacts) {
          if (contact.email) sendEmailNotification(contact.email, `Ready for Agency Review: ${asset?.name}`, `Asset "${asset?.name}" in project "${selectedProject.name}" is ready for your review.`, 'agency-review');
        }
      }

      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, status: finalStatus, ...extraFields } : a);
      const activity = { id: generateId(), type: extraFields.assignedTeamGroupName ? 'handoff' : finalStatus === 'agency-review' ? 'agency-review' : 'status', message: extraFields.assignedTeamGroupName ? `${userProfile.name} completed ${asset?.name || 'asset'} → handed off to ${extraFields.assignedTeamGroupName}` : finalStatus === 'agency-review' ? `${userProfile.name} sent ${asset?.name || 'asset'} for agency review` : `${userProfile.name} changed ${asset?.name || 'asset'} to ${status}`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      if (selectedAsset) setSelectedAsset({ ...selectedAsset, status: finalStatus, ...extraFields });
      // Notify assigned person on status change
      if (asset?.assignedTo) {
        const assignee = editors.find(e => e.id === asset.assignedTo);
        if (assignee?.email) sendEmailNotification(assignee.email, `Status changed: ${asset.name}`, `New status: ${finalStatus}`);
      }
    };
    const handleAssign = async (assetId, editorId) => { 
      const editor = editors.find(e => e.id === editorId); 
      const asset = (selectedProject.assets || []).find(a => a.id === assetId);
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, assignedTo: editorId, assignedToName: editor?.name, status: editorId ? 'assigned' : a.status } : a); 
      const activity = { id: generateId(), type: 'assign', message: `${userProfile.name} assigned ${asset?.name || 'asset'} to ${editor?.name || 'unassigned'}`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] }); 
      await refreshProject(); 
      // Email notification to assigned person
      if (editor?.email) sendEmailNotification(editor.email, `New assignment: ${asset?.name}`, `You have been assigned to work on ${asset?.name} in project ${selectedProject.name}`);
    };
    const handleSetGdriveLink = async (assetId, link) => { const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, gdriveLink: link, status: link ? 'delivered' : a.status } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); if (selectedAsset) setSelectedAsset({ ...selectedAsset, gdriveLink: link, status: link ? 'delivered' : selectedAsset.status }); showToast('Link saved', 'success'); };
    const handleAddFeedback = async () => { 
      if (!newFeedback.trim() || !selectedAsset) return; 
      const videoTime = selectedAsset.type === 'video' && videoRef.current ? videoRef.current.currentTime : null;
      
      // Extract mentions from feedback text - match against all available users
      const allMentionable = [...new Map([...team, ...freelancers, ...coreTeam].map(m => [m.id, m])).values()];
      const mentionRegex = /@([A-Za-z\s]+?)(?=\s|$|@|,|\.)/g;
      const mentions = [];
      let match;
      while ((match = mentionRegex.exec(newFeedback)) !== null) {
        const mentionedName = match[1].trim();
        const mentionedUser = allMentionable.find(m => m.name?.toLowerCase() === mentionedName.toLowerCase());
        if (mentionedUser && !mentions.find(m => m.id === mentionedUser.id)) mentions.push(mentionedUser);
      }
      
      const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString(), videoTimestamp: videoTime, isDone: false, mentions: mentions.map(m => m.id), round: selectedAsset.revisionRound || 1 };
      const updatedFeedback = [...(selectedAsset.feedback || []), fb];
      // Set turnaround deadline if auto-turnaround enabled
      const turnaroundHrs = selectedProject.turnaroundHours || 24;
      const turnaroundDeadline = selectedProject.autoTurnaround !== false ? new Date(Date.now() + turnaroundHrs * 60 * 60 * 1000).toISOString() : selectedAsset.turnaroundDeadline;
      // Update local state first to keep modal open
      setSelectedAsset({ ...selectedAsset, feedback: updatedFeedback, status: 'changes-requested', turnaroundDeadline });
      setNewFeedback('');
      setShowMentions(false);
      // Then update database in background with activity log
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: updatedFeedback, status: 'changes-requested', turnaroundDeadline } : a);
      const activity = { id: generateId(), type: 'feedback', message: `${userProfile.name} added feedback on ${selectedAsset.name}${mentions.length > 0 ? ` (mentioned ${mentions.map(m => m.name).join(', ')})` : ''}`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] }); 
      
      // Auto-create revision task from feedback (for clients and producers)
      if (isClientView || isProducer) {
        createTaskFromFeedback(fb, selectedAsset, selectedProject);
      }
      
      // Email notification to assigned person
      if (selectedAsset.assignedTo) {
        const assignee = editors.find(e => e.id === selectedAsset.assignedTo);
        if (assignee?.email) sendEmailNotification(assignee.email, `New feedback: ${selectedAsset.name}`, `${userProfile.name} commented: "${newFeedback}"`, 'feedback');
      }
      
      // Email notifications to mentioned users
      for (const mentioned of mentions) {
        if (mentioned.email && mentioned.id !== selectedAsset.assignedTo) {
          sendEmailNotification(mentioned.email, `You were mentioned: ${selectedAsset.name}`, `${userProfile.name} mentioned you: "${newFeedback}"`, 'mention');
        }
      }
    };
    
    const handleToggleFeedbackDone = async (feedbackId, e) => {
      if (e) e.stopPropagation();
      const updatedFeedback = (selectedAsset.feedback || []).map(fb => fb.id === feedbackId ? { ...fb, isDone: !fb.isDone } : fb);
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: updatedFeedback } : a);
      // Update local state first to prevent modal closing
      setSelectedAsset({ ...selectedAsset, feedback: updatedFeedback });
      // Then update database in background
      await updateProject(selectedProject.id, { assets: updated });
    };

    const handleAddReply = async (feedbackId) => {
      if (!replyText.trim()) return;
      const reply = { id: generateId(), text: replyText, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString() };
      const updatedFeedback = (selectedAsset.feedback || []).map(fb => fb.id === feedbackId ? { ...fb, replies: [...(fb.replies || []), reply] } : fb);
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: updatedFeedback } : a);
      setSelectedAsset({ ...selectedAsset, feedback: updatedFeedback });
      setReplyText('');
      setReplyingTo(null);
      await updateProject(selectedProject.id, { assets: updated });
    };

    // Can mark feedback done: producers, editors, video editors, freelancers - NOT clients
    const canMarkFeedbackDone = ['producer', 'admin', 'team-lead', 'editor', 'video-editor', 'colorist', 'animator', 'vfx-artist', 'sound-designer'].includes(userProfile?.role);
    const handleSaveAnnotations = async (annotations) => {
      const oldAnnotations = selectedAsset.annotations || [];
      const updatedAssets = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, annotations } : a);
      setSelectedAsset(prev => ({ ...prev, annotations }));
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, assets: updatedAssets } : p));
      try { await updateProject(selectedProject.id, { assets: updatedAssets }); } catch (e) { console.error('Save annotations error:', e); }
      // Auto-create task from new annotations with text notes
      const newAnnots = annotations.filter(a => a.text && !oldAnnotations.some(o => o.id === a.id));
      newAnnots.forEach(annot => {
        createTaskFromFeedback({ id: annot.id, text: `[Annotation] ${annot.text}`, timestamp: annot.createdAt }, selectedAsset, selectedProject);
      });
    };
    const handleSaveVideoAnnotations = async (annotations) => {
      const timestamp = videoTime;
      const tagged = annotations.map(a => a.videoTimestamp != null ? a : { ...a, videoTimestamp: timestamp });
      const allAnnotations = selectedAsset.annotations || [];
      const otherAnnotations = allAnnotations.filter(
        a => !(a.videoTimestamp != null && Math.abs(a.videoTimestamp - timestamp) < 0.5)
      );
      const merged = [...otherAnnotations, ...tagged];
      const updatedAssets = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, annotations: merged } : a);
      setSelectedAsset(prev => ({ ...prev, annotations: merged }));
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? { ...p, assets: updatedAssets } : p));
      try { await updateProject(selectedProject.id, { assets: updatedAssets }); } catch (e) { console.error('Save video annotations error:', e); }
      // Auto-create task from new video annotations with text notes
      const newAnnots = tagged.filter(a => a.text && !allAnnotations.some(o => o.id === a.id));
      newAnnots.forEach(annot => {
        createTaskFromFeedback({ id: annot.id, text: `[Video @${formatTimecode(annot.videoTimestamp)}] ${annot.text}`, timestamp: annot.createdAt }, selectedAsset, selectedProject);
      });
    };
    const handleCreateLink = async () => { if (!newLinkName) { showToast('Enter name', 'error'); return; } const linkData = { name: newLinkName, type: newLinkType, createdBy: userProfile.id }; if (newLinkExpiry) linkData.expiresAt = new Date(newLinkExpiry).toISOString(); await createShareLink(selectedProject.id, linkData); await refreshProject(); setNewLinkName(''); setNewLinkExpiry(''); showToast('Link created!', 'success'); };
    const handleDeleteLink = async (linkId) => { const updated = (selectedProject.shareLinks || []).map(l => l.id === linkId ? { ...l, active: false } : l); await updateProject(selectedProject.id, { shareLinks: updated }); await refreshProject(); showToast('Link deleted', 'success'); };
    const copyLink = token => { navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); showToast('Copied!', 'success'); };
    const handleAddTeam = async uid => { const u = users.find(x => x.id === uid); if (!u) return; const updated = [...(selectedProject.assignedTeam || []), { odId: uid, odRole: u.role }]; await updateProject(selectedProject.id, { assignedTeam: updated }); await refreshProject(); setShowAddTeam(false); };

    const selectedCount = assets.filter(a => a.isSelected).length;
    const getLatestVersionDate = (asset) => { const versions = asset.versions || []; if (versions.length > 1) return versions[versions.length - 1].uploadedAt; return null; };
    const totalAssetCount = (selectedProject.assets || []).filter(a => !a.deleted).length;
    const videoCount = (selectedProject.assets || []).filter(a => !a.deleted && a.type === 'video').length;

    const bannerGradients = {
      'photoshoot': 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 40%, #4a1942 100%)',
      'ad-film': 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 40%, #4a1a0a 100%)',
      'product-video': 'linear-gradient(135deg, #0a1a2e 0%, #152d4e 40%, #0a2a42 100%)',
      'toolkit': 'linear-gradient(135deg, #0a0a2e 0%, #1b1b4e 40%, #2a0a42 100%)',
      'social-media': 'linear-gradient(135deg, #2e0a1a 0%, #4e1b2d 40%, #420a2a 100%)',
      'corporate': 'linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #1a2332 100%)',
      'music-video': 'linear-gradient(135deg, #1a0a2e 0%, #3d154e 40%, #2a0a42 100%)',
      'brand-film': 'linear-gradient(135deg, #1a1a0a 0%, #3d2d15 40%, #42300a 100%)',
      'reels': 'linear-gradient(135deg, #2e0a1a 0%, #4e152d 40%, #42192a 100%)',
      'ecommerce': 'linear-gradient(135deg, #0a2e1a 0%, #154e2d 40%, #0a4222 100%)',
      'event': 'linear-gradient(135deg, #2e1a0a 0%, #4e3515 40%, #42280a 100%)',
      'documentary': 'linear-gradient(135deg, #1a1a1a 0%, #2e2e2e 40%, #1a1a2e 100%)',
    };

    return (
      <div style={{ marginLeft: '0' }}>
        {/* Main Content - full width within the content area */}
        <div style={{ flex: 1 }}>
          {/* Project Banner */}
          <div className="animate-fadeIn" style={{ height: isMobile ? '120px' : '140px', background: bannerGradients[selectedProject.type] || bannerGradients['photoshoot'], position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: isMobile ? '12px 16px' : '20px 24px', overflow: 'hidden' }}>
            {/* Subtle pattern overlay */}
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 20%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(168,85,247,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />
            {/* Back button */}
            <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ position: 'absolute', top: isMobile ? '10px' : '16px', left: isMobile ? '12px' : '20px', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', borderRadius: '20px', zIndex: 2 }}>
              {Icons.chevronLeft('#fff')} Projects
            </button>
            {/* Banner content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h1 style={{ margin: '0 0 6px', fontSize: isMobile ? '20px' : '26px', fontWeight: '700', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedProject.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{selectedProject.client}</span>
                <Badge status={selectedProject.status} />
                {selectedProject.deadline && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                    {Icons.calendar('rgba(255,255,255,0.5)')} {formatDate(selectedProject.deadline)}
                  </span>
                )}
                {/* Photoshoot Workflow Phase Indicator */}
                {selectedProject.type === 'photoshoot' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: selectedProject.workflowPhase === 'review' ? '#22c55e' : '#fbbf24' }}>
                      {selectedProject.workflowPhase === 'review' ? 'Review' : 'Selection'}
                    </span>
                    {isProducer && selectedProject.workflowPhase !== 'review' && selectedProject.selectionConfirmed && (
                      <button onClick={async () => {
                        const activity = { id: generateId(), type: 'status', message: `${userProfile.name} started review phase`, timestamp: new Date().toISOString() };
                        await updateProject(selectedProject.id, { workflowPhase: 'review', activityLog: [...(selectedProject.activityLog || []), activity] });
                        await refreshProject();
                        showToast('Review phase started!', 'success');
                      }} style={{ padding: '3px 8px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
                        Start Review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Bar: Categories (left) + Actions (right) */}
          <div style={{ padding: '10px 16px', background: t.bgSecondary, borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', position: 'sticky', top: '56px', zIndex: 30 }}>
            {/* Category pill tabs - horizontally scrollable */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', overflowX: 'auto', flex: 1, paddingBottom: '2px', scrollbarWidth: 'none' }}>
              <button onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: !selectedCat ? `${t.primary}20` : t.bgCard, color: !selectedCat ? t.primary : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${!selectedCat ? t.primary + '40' : t.border}`, transition: 'all 0.2s ease' }}>
                {Icons.folder(!selectedCat ? t.primary : t.textSecondary)} All <span style={{ fontSize: '10px', opacity: 0.7, background: !selectedCat ? `${t.primary}15` : t.bgInput, padding: '1px 6px', borderRadius: '8px' }}>{totalAssetCount}</span>
              </button>
              <button onClick={() => setSelectedCat('__videos__')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: selectedCat === '__videos__' ? `${t.primary}20` : t.bgCard, color: selectedCat === '__videos__' ? t.primary : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${selectedCat === '__videos__' ? t.primary + '40' : t.border}`, transition: 'all 0.2s ease' }}>
                {Icons.video(selectedCat === '__videos__' ? t.primary : t.textSecondary)} Videos <span style={{ fontSize: '10px', opacity: 0.7, background: selectedCat === '__videos__' ? `${t.primary}15` : t.bgInput, padding: '1px 6px', borderRadius: '8px' }}>{videoCount}</span>
              </button>
              {cats.map(cat => (
                renamingCat === cat.id ? (
                  <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRenameCategory(cat.id, renameValue);
                        if (e.key === 'Escape') { setRenamingCat(null); setRenameValue(''); }
                      }}
                      style={{ padding: '5px 10px', background: t.bgCard, border: `1px solid ${t.primary}`, borderRadius: '20px', color: t.text, fontSize: '12px', outline: 'none', width: '120px' }}
                    />
                    <button onClick={() => handleRenameCategory(cat.id, renameValue)} style={{ padding: '5px 10px', background: t.primary, border: 'none', borderRadius: '20px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>✓</button>
                    <button onClick={() => { setRenamingCat(null); setRenameValue(''); }} style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '20px', color: t.textMuted, fontSize: '12px', cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCat(cat.id)}
                    onContextMenu={isProducer ? (e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, catId: cat.id }); } : undefined}
                    title={isProducer ? 'Right-click to rename or delete' : cat.name}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', background: selectedCat === cat.id ? `${cat.color}20` : t.bgCard, color: selectedCat === cat.id ? cat.color : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${selectedCat === cat.id ? cat.color + '40' : t.border}`, transition: 'all 0.2s ease' }}
                  >
                    {Icons[cat.icon] ? Icons[cat.icon](selectedCat === cat.id ? cat.color : t.textSecondary) : Icons.file(selectedCat === cat.id ? cat.color : t.textSecondary)} {cat.name} <span style={{ fontSize: '10px', opacity: 0.7, background: selectedCat === cat.id ? `${cat.color}15` : t.bgInput, padding: '1px 6px', borderRadius: '8px' }}>{getCatCount(cat.id)}</span>
                  </button>
                )
              ))}
              {/* + New Folder button */}
              {isProducer && !showAddCat && (
                <button onClick={() => setShowAddCat(true)} title="Add new folder" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', background: 'transparent', color: t.textMuted, border: `1px dashed ${t.border}`, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                  + Folder
                </button>
              )}
              {isProducer && showAddCat && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input autoFocus value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setShowAddCat(false); setNewCatName(''); } }} placeholder="Folder name…" style={{ padding: '5px 10px', background: t.bgCard, border: `1px solid ${t.primary}`, borderRadius: '20px', color: t.text, fontSize: '12px', outline: 'none', width: '130px' }} />
                  <button onClick={handleAddCategory} style={{ padding: '5px 10px', background: t.primary, border: 'none', borderRadius: '20px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>✓</button>
                  <button onClick={() => { setShowAddCat(false); setNewCatName(''); }} style={{ padding: '5px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '20px', color: t.textMuted, fontSize: '12px', cursor: 'pointer' }}>✕</button>
                </div>
              )}
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
              {isProducer && <Btn theme={theme} onClick={() => setShowUpload(true)} small color="#22c55e">{Icons.upload('#fff')}{!isMobile && ' Upload'}</Btn>}
              {isProducer && !isMobile && <Btn theme={theme} onClick={() => setShowShare(true)} small outline>{Icons.share(t.primary)}{!isMobile && ' Share'}</Btn>}
              {isProducer && (
                <button
                  onClick={() => {
                    setEditProjectData({
                      name: selectedProject.name,
                      client: selectedProject.client || '',
                      categories: selectedProject.categories || [],
                      status: selectedProject.status || 'active',
                      type: selectedProject.type || 'photoshoot',
                      requiredFormats: selectedProject.requiredFormats || [],
                      requiredSizes: selectedProject.requiredSizes || [],
                      maxRevisions: selectedProject.maxRevisions || 0,
                      versionUploadRoles: selectedProject.versionUploadRoles || ['producer', 'editor'],
                      approvalWorkflow: selectedProject.approvalWorkflow || 'producer',
                      notifyOnUpload: selectedProject.notifyOnUpload ?? true,
                      notifyOnVersion: selectedProject.notifyOnVersion ?? true,
                      notifyOnApproval: selectedProject.notifyOnApproval ?? true,
                      notifyOnDeadline: selectedProject.notifyOnDeadline ?? true
                    });
                    setShowEditProject(true);
                  }}
                  style={{ background: t.bgCard, border: `1px solid ${t.border}`, cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', color: t.textSecondary, fontSize: '12px' }}
                  title="Edit Project"
                >
                  {Icons.edit(t.textSecondary)}{!isMobile && ' Edit'}
                </button>
              )}
              <div style={{ position: 'relative' }}>
                <Btn theme={theme} onClick={() => setShowAppearance(!showAppearance)} small outline>{Icons.settings(t.primary)}</Btn>
                {showAppearance && <AppearancePanel settings={appearance} onChange={setAppearance} onClose={() => setShowAppearance(false)} theme={theme} />}
              </div>
            </div>
          </div>

          {/* Quick Stats Bar */}
          {!isMobile && (() => {
            const projectAssets = (selectedProject.assets || []).filter(a => !a.deleted);
            const today = new Date(); today.setHours(0,0,0,0);
            const pending = projectAssets.filter(a => a.status === 'pending').length;
            const inProgress = projectAssets.filter(a => a.status === 'in-progress' || a.status === 'assigned').length;
            const review = projectAssets.filter(a => a.status === 'review-ready').length;
            const approved = projectAssets.filter(a => a.status === 'approved' || a.status === 'delivered').length;
            const overdue = projectAssets.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'delivered' && a.status !== 'approved').length;
            const progress = projectAssets.length ? Math.round((approved / projectAssets.length) * 100) : 0;

            return (
              <div style={{ padding: '8px 16px', background: t.bgInput, borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>Pending</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#fbbf24' }}>{pending}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>In Progress</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#3b82f6' }}>{inProgress}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>Review</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#a855f7' }}>{review}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>Done</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e' }}>{approved}</span>
                  </div>
                  {overdue > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: 'rgba(239,68,68,0.15)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#ef4444' }}>Overdue</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#ef4444' }}>{overdue}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '120px', height: '5px', background: t.bgCard, borderRadius: '3px' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22c55e' : 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: progress === 100 ? '#22c55e' : '#6366f1' }}>{progress}%</span>
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['assets', 'tasks', 'decks', 'team', 'activity', 'links'].map(t => <button key={t} data-tab={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : `1px solid ${THEMES[theme].border}`, borderRadius: '8px', color: tab === t ? '#fff' : THEMES[theme].text, fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{t === 'tasks' ? '✓ Tasks' : t === 'decks' ? 'Decks' : (isMobile ? t.charAt(0).toUpperCase() : t)}</button>)}
            </div>
            {tab === 'assets' && selectedAssets.size > 0 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: t.textMuted }}>{selectedAssets.size} selected</span>
                {selectedAssets.size >= 2 && selectedAssets.size <= 4 && (
                  <Btn theme={theme} onClick={() => { setCompareAssetIds([...selectedAssets]); setShowComparePanel(true); }} small color="#6366f1" title="Compare selected images side by side">⊞ Compare</Btn>
                )}
                <Btn theme={theme} onClick={() => handleBulkSelect(true)} small color="#22c55e" title="Mark as Selected">✓</Btn>
                <Btn theme={theme} onClick={() => handleBulkSelect(false)} small outline title="Deselect">✗</Btn>
                {isProducer && <Btn theme={theme} onClick={handleBulkDelete} small color="#ef4444" title="Delete Selected"></Btn>}
              </div>
            )}
            {tab === 'assets' && !selectedProject.selectionConfirmed && selectedCount > 0 && (isProducer || userProfile?.role === 'client') && !isMobile && <Btn theme={theme} onClick={() => setShowSelectionOverview(true)} small color="#f59e0b">Confirm ({selectedCount})</Btn>}
            {tab === 'assets' && unmatchedFiles.length > 0 && <Btn theme={theme} onClick={() => setShowMatchModal(true)} small color="#ef4444">Match Files ({unmatchedFiles.length})</Btn>}

            {/* View Mode Toggle */}
            {tab === 'assets' && assets.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '6px 12px', background: viewMode === 'grid' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: viewMode === 'grid' ? '#fff' : t.text, fontSize: '11px', cursor: 'pointer' }}>Grid</button>
                <button onClick={() => setViewMode('list')} style={{ padding: '6px 12px', background: viewMode === 'list' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: viewMode === 'list' ? '#fff' : t.text, fontSize: '11px', cursor: 'pointer' }}>List</button>
                <button onClick={() => setViewMode('kanban')} style={{ padding: '6px 12px', background: viewMode === 'kanban' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: viewMode === 'kanban' ? '#fff' : t.text, fontSize: '11px', cursor: 'pointer' }}>Kanban</button>
              </div>
            )}
          </div>

          {/* Upload Progress - Floating Panel */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={{ 
              position: 'fixed', 
              bottom: '20px', 
              right: '20px', 
              width: '320px', 
              maxHeight: '400px',
              background: t.bgCard, 
              borderRadius: '12px', 
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              border: `1px solid ${t.border}`,
              zIndex: 1000,
              overflow: 'hidden'
            }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>{Icons.upload(t.primary)} Uploading {Object.keys(uploadProgress).length} files...</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                </div>
              </div>
              <div style={{ maxHeight: '340px', overflow: 'auto', padding: '8px 12px' }}>
                {Object.entries(uploadProgress).map(([id, item]) => (
                  <div key={id} style={{ marginBottom: '10px', padding: '8px', background: t.bgInput, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>{item.name}</span>
                      <span style={{ fontWeight: '600', color: item.progress === 100 ? '#22c55e' : '#6366f1' }}>{item.progress}%</span>
                    </div>
                    {item.status && typeof item.status === 'string' && item.status !== 'uploading' && (
                      <div style={{ fontSize: '9px', color: '#6366f1', marginBottom: '4px' }}>{item.status}</div>
                    )}
                    <div style={{ background: t.bgCard, borderRadius: '3px', height: '3px' }}>
                      <div style={{ width: `${item.progress}%`, height: '100%', background: item.progress === 100 ? '#22c55e' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab Content */}
          <div style={{ padding: '16px' }}>
            {tab === 'assets' && (
              <div
                style={{ width: '100%', position: 'relative' }}
                onDragOver={isProducer ? handleAssetAreaDragOver : undefined}
                onDragLeave={isProducer ? handleAssetAreaDragLeave : undefined}
                onDrop={isProducer ? handleAssetAreaDrop : undefined}
                onContextMenu={isProducer ? (e) => handleContextMenu(e) : undefined}
              >
                {/* Drag-over overlay */}
                {isDraggingOver && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: `${t.primary}18`, border: `3px dashed ${t.primary}`, borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', pointerEvents: 'none' }}>
                    <div style={{ fontSize: '48px' }}>📁</div>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: t.primary }}>Drop folders or files here</div>
                    <div style={{ fontSize: '12px', color: t.textMuted }}>Each folder becomes a category automatically</div>
                  </div>
                )}
                {assets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `2px dashed ${t.border}`, cursor: isProducer ? 'default' : 'default' }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>📁</div>
                    <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '6px' }}>No assets yet</p>
                    {isProducer && <p style={{ color: t.textMuted, fontSize: '11px', marginBottom: '16px' }}>Drag folders from Finder, or click Upload</p>}
                    {isProducer && <Btn theme={theme} onClick={() => setShowUpload(true)}>Upload</Btn>}
                  </div>
                ) : viewMode === 'kanban' ? (
                  <KanbanView
                    assets={assets}
                    onUpdateStatus={handleUpdateStatus}
                    projectId={selectedProject.id}
                  />
                ) : viewMode === 'list' ? (
                  <div>
                    {/* List View Header */}
                    <div style={{ display: 'grid', gridTemplateColumns: '40px 48px 1fr 100px 90px 80px 90px 80px', gap: '8px', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${t.border}`, fontSize: '10px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <span></span>
                      <span>Thumb</span>
                      <span>Name</span>
                      <span>Status</span>
                      <span>Assigned</span>
                      <span>Rating</span>
                      <span>Due Date</span>
                      <span>Version</span>
                    </div>
                    {/* List View Rows */}
                    {displayAssets
                      .filter(a => {
                        if (selectedCat === '__selected__') return a.isSelected;
                        if (selectedCat === '__not_selected__') return !a.isSelected;
                        return true;
                      })
                      .map(a => {
                      const hasNewVersion = getLatestVersionDate(a) && isNewVersion(getLatestVersionDate(a));
                      return (
                        <div key={a.id} className="hover-lift" onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }}
                          style={{ display: 'grid', gridTemplateColumns: '40px 48px 1fr 100px 90px 80px 90px 80px', gap: '8px', alignItems: 'center', padding: '10px 12px', borderBottom: `1px solid ${t.borderLight}`, cursor: 'pointer', transition: 'background 0.15s', borderRadius: '6px', background: selectedAssets.has(a.id) ? `${t.primary}10` : 'transparent' }}
                          onMouseEnter={e => e.currentTarget.style.background = selectedAssets.has(a.id) ? `${t.primary}15` : t.bgHover}
                          onMouseLeave={e => e.currentTarget.style.background = selectedAssets.has(a.id) ? `${t.primary}10` : 'transparent'}
                        >
                          {/* Checkbox */}
                          <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ width: '22px', height: '22px', borderRadius: '6px', background: selectedAssets.has(a.id) ? '#6366f1' : t.bgInput, border: `1.5px solid ${selectedAssets.has(a.id) ? '#6366f1' : t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>{selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '11px' }}>✓</span>}</div>
                          {/* Thumbnail */}
                          <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', background: t.bgInput, flexShrink: 0 }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} thumbnail={a.thumbnail} muxPlaybackId={a.muxPlaybackId} style={{ width: '40px', height: '40px' }} /> : (a.thumbnail || a.url) ? <LazyImage src={a.url} thumbnail={a.thumbnail} style={{ width: '40px', height: '40px', objectFit: 'cover' }} /> : <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{a.type === 'audio' ? '🎵' : '📄'}</div>}
                          </div>
                          {/* Name + type */}
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {a.name}
                              {a.isSelected && <span style={{ background: '#22c55e', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '700' }}>SEL</span>}
                              {hasNewVersion && <span style={{ background: '#f97316', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '700' }}>NEW</span>}
                            </div>
                            <div style={{ fontSize: '10px', color: t.textMuted }}>{a.type?.toUpperCase()} {a.category ? `• ${a.category}` : ''}</div>
                          </div>
                          {/* Status */}
                          <div>{(() => { const sc = STATUS[a.status] || STATUS.pending; return <span style={{ padding: '3px 8px', background: sc.bg, color: sc.color, borderRadius: '10px', fontSize: '9px', fontWeight: '600' }}>{sc.label}</span>; })()}</div>
                          {/* Assigned */}
                          <div style={{ fontSize: '10px', color: a.assignedToName ? t.text : t.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.assignedToName || '—'}</div>
                          {/* Rating */}
                          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '1px' }}>{[1,2,3,4,5].map(star => <span key={star} onClick={() => handleRate(a.id, star)} style={{ cursor: 'pointer', fontSize: '12px', color: star <= (a.rating || 0) ? '#fbbf24' : `${t.textMuted}40` }}>★</span>)}</div>
                          {/* Due Date */}
                          <div style={{ fontSize: '10px', color: a.dueDate ? (new Date(a.dueDate) < new Date() ? '#ef4444' : t.text) : t.textMuted }}>{a.dueDate ? new Date(a.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}</div>
                          {/* Version */}
                          <div style={{ fontSize: '11px', color: t.textMuted }}>v{a.currentVersion || 1}{a.revisionRound > 0 && <span style={{ marginLeft: '4px', color: '#8b5cf6', fontWeight: '600' }}>R{a.revisionRound}</span>}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    {/* Photoshoot Selection Phase Filter */}
                    {selectedProject.type === 'photoshoot' && selectedProject.selectionConfirmed && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <button onClick={() => setSelectedCat(null)} style={{ padding: '6px 14px', background: !selectedCat ? t.primary : t.bgCard, border: `1px solid ${!selectedCat ? t.primary : t.border}`, borderRadius: '8px', color: !selectedCat ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>All ({assets.length})</button>
                        <button onClick={() => setSelectedCat('__selected__')} style={{ padding: '6px 14px', background: selectedCat === '__selected__' ? t.success : t.bgCard, border: `1px solid ${selectedCat === '__selected__' ? t.success : t.border}`, borderRadius: '8px', color: selectedCat === '__selected__' ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>Selected ({assets.filter(a => a.isSelected).length})</button>
                        <button onClick={() => setSelectedCat('__not_selected__')} style={{ padding: '6px 14px', background: selectedCat === '__not_selected__' ? t.warning : t.bgCard, border: `1px solid ${selectedCat === '__not_selected__' ? t.warning : t.border}`, borderRadius: '8px', color: selectedCat === '__not_selected__' ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>Not Selected ({assets.filter(a => !a.isSelected).length})</button>
                      </div>
                    )}

                {/* Filter & Sort Bar */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <select value={filterStars} onChange={e => setFilterStars(Number(e.target.value))} style={{ padding: '6px 10px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '8px', color: t.text, fontSize: '11px', cursor: 'pointer' }}>
                    <option value={0}>All Ratings</option>
                    <option value={5}>5 Stars</option>
                    <option value={4}>4+ Stars</option>
                    <option value={3}>3+ Stars</option>
                    <option value={2}>2+ Stars</option>
                    <option value={1}>1+ Stars</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '8px', color: t.text, fontSize: '11px', cursor: 'pointer' }}>
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="selected">Selected</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="approved">Approved</option>
                    <option value="revision">Revision</option>
                    <option value="delivered">Delivered</option>
                  </select>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 10px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '8px', color: t.text, fontSize: '11px', cursor: 'pointer' }}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="rating-desc">Rating: High to Low</option>
                    <option value="rating-asc">Rating: Low to High</option>
                    <option value="name">Name A-Z</option>
                  </select>
                  {/* Color label filter pills */}
                  {[{ key: 'red', color: '#ef4444', label: '● Pick' }, { key: 'yellow', color: '#f59e0b', label: '● Maybe' }, { key: 'green', color: '#22c55e', label: '● Alt' }].map(({ key, color, label }) => (
                    <button key={key} onClick={() => setColorFilter(colorFilter === key ? null : key)} style={{ padding: '6px 12px', background: colorFilter === key ? color : t.bgCard, border: `1px solid ${colorFilter === key ? color : t.border}`, borderRadius: '20px', color: colorFilter === key ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: colorFilter === key ? '600' : '400', transition: 'all 0.15s' }}>
                      <span style={{ color: colorFilter === key ? '#fff' : color }}>{label.split(' ')[0]}</span>
                      <span>{label.split(' ')[1]}</span>
                      <span style={{ opacity: 0.7, fontSize: '10px' }}>({(assets || []).filter(a => a.colorLabel === key).length})</span>
                    </button>
                  ))}
                  {(filterStars > 0 || filterStatus !== 'all' || colorFilter) && (
                    <button onClick={() => { setFilterStars(0); setFilterStatus('all'); setColorFilter(null); setSortBy('newest'); }} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>Clear filters</button>
                  )}
                  <span style={{ fontSize: '10px', color: t.textMuted, marginLeft: 'auto' }}>{displayAssets.length} assets</span>
                </div>

                    <div className="stagger-children" style={{ display: 'grid', gridTemplateColumns: isMobile ? (appearance.cardSize === 'L' ? '1fr' : appearance.cardSize === 'S' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)') : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: '12px' }}>
                    {displayAssets
                      .filter(a => {
                        if (selectedCat === '__selected__') return a.isSelected;
                        if (selectedCat === '__not_selected__') return !a.isSelected;
                        return true;
                      })
                      .map(a => {
                      const latestVersionDate = getLatestVersionDate(a);
                      const hasNewVersion = latestVersionDate && isNewVersion(latestVersionDate);
                      const isPhotoshootSelection = selectedProject.type === 'photoshoot' && selectedProject.workflowPhase !== 'review';
                      const isDimmed = selectedProject.type === 'photoshoot' && selectedProject.workflowPhase === 'review' && !a.isSelected;
                      
                      return (
                        <div key={a.id} className="asset-card hover-lift animate-fadeInUp" style={{
                          background: t.bgTertiary,
                          borderRadius: '12px',
                          overflow: 'hidden',
                          border: a.isSelected ? '2px solid #22c55e' : selectedAssets.has(a.id) ? '2px solid #6366f1' : `1px solid ${t.border}`,
                          boxShadow: selectedAssets.has(a.id) ? '0 0 0 3px rgba(99,102,241,0.3), 0 4px 16px rgba(99,102,241,0.15)' : hasNewVersion ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
                          animation: hasNewVersion ? 'pulseGlow 2.5s ease-in-out infinite' : undefined,
                          position: 'relative',
                          opacity: isDimmed ? 0.5 : 1,
                          transition: 'opacity 0.2s, border-color 0.2s, box-shadow 0.2s'
                        }}>
                          <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ position: 'absolute', top: '10px', left: '10px', width: '22px', height: '22px', borderRadius: '6px', background: selectedAssets.has(a.id) ? '#6366f1' : 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>{selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}</div>
                          {/* Quick delete button - shows on hover */}
                          {isProducer && (
                            <button 
                              className="card-delete-btn"
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (!confirm(`Delete "${a.name}"?`)) return; 
                                const updated = (selectedProject.assets || []).map(x => x.id === a.id ? { ...x, deleted: true, deletedAt: new Date().toISOString() } : x); 
                                await updateProject(selectedProject.id, { assets: updated }); 
                                await refreshProject(); 
                                showToast('Deleted', 'success'); 
                              }} 
                              style={{ position: 'absolute', top: '10px', right: a.isSelected ? '48px' : '10px', width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s, background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.8)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.6)'}
                            >{Icons.trash('rgba(255,255,255,0.9)')}</button>
                          )}
                          {a.isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600', color: '#fff' }}>Selected</div>}
                          {hasNewVersion && <div style={{ position: 'absolute', top: a.isSelected ? '38px' : '10px', right: '10px', background: '#f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>v{a.currentVersion}</div>}
                          {a.revisionRound > 0 && <div style={{ position: 'absolute', top: a.isSelected ? (hasNewVersion ? '66px' : '38px') : (hasNewVersion ? '38px' : '10px'), left: '10px', background: a.revisionRound >= (selectedProject.maxRevisions || 999) ? '#ef4444' : '#8b5cf6', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>R{a.revisionRound}</div>}
                          {(a.annotations?.length > 0) && <div style={{ position: 'absolute', bottom: appearance.showInfo ? '80px' : '10px', right: '10px', background: '#ec4899', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}> {a.annotations.length}</div>}
                          {/* Tags display */}
                          {a.tags?.length > 0 && (
                            <div style={{ position: 'absolute', top: a.isSelected ? (hasNewVersion ? '66px' : '38px') : (hasNewVersion ? '38px' : '10px'), right: '10px', display: 'flex', gap: '4px', zIndex: 5 }}>
                              {a.tags.slice(0, 2).map(tagId => {
                                const tag = PREDEFINED_TAGS.find(t => t.id === tagId);
                                return tag ? <span key={tagId} style={{ background: tag.color, padding: '2px 6px', borderRadius: '4px', fontSize: '8px', fontWeight: '600' }}>{tag.label}</span> : null;
                              })}
                              {a.tags.length > 2 && <span style={{ background: '#6366f1', padding: '2px 6px', borderRadius: '4px', fontSize: '8px' }}>+{a.tags.length - 2}</span>}
                            </div>
                          )}
                          
                          <div className="asset-thumb-area" onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }} style={{ cursor: 'pointer', height: isMobile ? (appearance.cardSize === 'L' ? '200px' : appearance.cardSize === 'S' ? '80px' : '120px') : `${cardWidth / aspectRatio}px`, background: t.bgInput, position: 'relative', overflow: 'hidden' }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} thumbnail={a.thumbnail} muxPlaybackId={a.muxPlaybackId} duration={a.duration} style={{ width: '100%', height: '100%' }} /> : a.type === 'audio' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}></span></div> : (a.thumbnail || a.url) ? <LazyImage src={a.url} thumbnail={a.thumbnail} style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>DOC</span></div>}
                            {/* Version badge - top left */}
                            {a.currentVersion > 1 && <div style={{ position: 'absolute', top: '8px', left: '40px', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: '10px', padding: '2px 8px', fontSize: '9px', color: '#fff', fontWeight: '600', zIndex: 4 }}>v{a.currentVersion}</div>}
                            {/* Status dot - top right */}
                            {a.status && (() => { const statusColors = { pending: '#fbbf24', selected: '#3b82f6', assigned: '#6366f1', 'in-progress': '#a855f7', 'review-ready': '#f59e0b', 'changes-requested': '#ef4444', approved: '#22c55e', delivered: '#06b6d4', 'agency-review': '#0ea5e9' }; return <div style={{ position: 'absolute', top: '10px', right: a.isSelected ? '48px' : '10px', width: '8px', height: '8px', borderRadius: '50%', background: statusColors[a.status] || '#6b7280', border: '2px solid rgba(0,0,0,0.4)', zIndex: 4 }} title={STATUS[a.status]?.label || a.status} />; })()}
                            {/* Frosted glass overlay on hover - asset name + type */}
                            <div className="asset-hover-overlay" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 10px', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0, transition: 'opacity 0.2s ease', zIndex: 3 }}>
                              <span style={{ fontSize: '12px' }}>{a.type === 'video' ? 'VID' : a.type === 'audio' ? '' : a.type === 'image' ? 'IMG' : 'DOC'}</span>
                              <span style={{ fontSize: '10px', color: '#fff', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{a.name}</span>
                            </div>
                            {a.feedback?.length > 0 && <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: '#ef4444', borderRadius: '10px', padding: '3px 8px', fontSize: '10px', zIndex: 4 }}>{a.feedback.length}</div>}
                            {a.dueDate && <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: new Date(a.dueDate) < new Date() ? '#ef4444' : '#22c55e', borderRadius: '10px', padding: '3px 6px', fontSize: '9px', zIndex: 4 }}>{new Date(a.dueDate) < new Date() ? 'Overdue ' : ''}{Math.abs(Math.ceil((new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24)))}d</div>}
                            {/* Color label stripe — Capture One style */}
                            {a.colorLabel && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: a.colorLabel === 'red' ? '#ef4444' : a.colorLabel === 'yellow' ? '#f59e0b' : '#22c55e', zIndex: 7 }} />}
                            {/* Always visible star rating overlay */}
                            {!appearance.showInfo && (
                              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', borderRadius: '12px', padding: '3px 8px', display: 'flex', gap: '2px', zIndex: 5 }}>
                                {[1,2,3,4,5].map(star => (
                                  <span key={star} onClick={(e) => { e.stopPropagation(); handleRate(a.id, star); }} style={{ cursor: 'pointer', fontSize: isMobile ? '12px' : '14px', color: star <= (a.rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>★</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {appearance.showInfo && (
                            <div style={{ padding: '10px' }}>
                              <div style={{ fontWeight: '500', fontSize: '11px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}><span style={{ fontSize: '10px', color: t.textMuted }}>v{a.currentVersion}</span>{a.assignedToName && <span style={{ fontSize: '9px', color: t.textMuted }}>→{a.assignedToName.split(' ')[0]}</span>}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><StarRating rating={a.rating} onChange={r => handleRate(a.id, r)} size={isMobile ? 14 : 16} /><Badge status={a.status} /></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'tasks' && (
              <ProjectTasksTab project={selectedProject} onUpdate={refreshProject} />
            )}

            {tab === 'decks' && (
              <ProjectDecksTab project={selectedProject} onUpdate={refreshProject} />
            )}

            {tab === 'team' && (
              <div>
                {/* Team Groups */}
                {(selectedProject.teamGroups || []).length > 0 && (
                  <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, marginBottom: '16px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Team Groups ({(selectedProject.teamGroups || []).length})</h3>
                      {isProducer && <Btn theme={theme} onClick={() => {
                        const name = prompt('New team group name:');
                        if (!name?.trim()) return;
                        const newGroup = { id: generateId(), name: name.trim(), members: [], leadId: null };
                        const groups = [...(selectedProject.teamGroups || []), newGroup];
                        updateProject(selectedProject.id, { teamGroups: groups }).then(() => refreshProject());
                        showToast(`Group "${name.trim()}" created`, 'success');
                      }} small>+ Add Group</Btn>}
                    </div>
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(selectedProject.teamGroups || []).map(group => (
                        <div key={group.id} style={{ background: `${t.bgCard}CC`, backdropFilter: 'blur(12px)', border: `1px solid ${t.borderLight}`, borderRadius: '12px', padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: t.text }}>{group.name}</div>
                            {isProducer && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button onClick={() => {
                                  const memberId = prompt('Enter member email to add:');
                                  if (!memberId) return;
                                  const member = [...coreTeam, ...freelancers].find(m => m.email?.toLowerCase() === memberId.toLowerCase());
                                  if (!member) { showToast('Member not found', 'error'); return; }
                                  if (group.members.some(m => m.id === member.id)) { showToast('Already in group', 'error'); return; }
                                  const groups = (selectedProject.teamGroups || []).map(g => g.id === group.id ? { ...g, members: [...g.members, { id: member.id, name: member.name, role: member.role }] } : g);
                                  updateProject(selectedProject.id, { teamGroups: groups }).then(() => refreshProject());
                                  showToast(`${member.name} added`, 'success');
                                }} style={{ padding: '4px 8px', background: `${t.primary}15`, border: `1px solid ${t.primary}30`, borderRadius: '6px', color: t.primary, fontSize: '10px', cursor: 'pointer' }}>+ Member</button>
                                <button onClick={async () => {
                                  if (!confirm(`Delete group "${group.name}"?`)) return;
                                  const groups = (selectedProject.teamGroups || []).filter(g => g.id !== group.id);
                                  await updateProject(selectedProject.id, { teamGroups: groups });
                                  await refreshProject();
                                  showToast('Group deleted', 'success');
                                }} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>✕</button>
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(group.members || []).length === 0 && <span style={{ fontSize: '11px', color: t.textMuted }}>No members yet</span>}
                            {(group.members || []).map(m => (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: t.bgInput, borderRadius: '20px', fontSize: '11px', color: t.text }}>
                                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: `${t.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>{m.name?.[0]}</span>
                                {m.name}
                                {group.leadId === m.id && <span style={{ fontSize: '8px', background: `${t.warning}30`, color: t.warning, padding: '1px 5px', borderRadius: '4px' }}>Lead</span>}
                                {isProducer && <>
                                  <span onClick={async () => {
                                    const groups = (selectedProject.teamGroups || []).map(g => g.id === group.id ? { ...g, leadId: g.leadId === m.id ? null : m.id } : g);
                                    await updateProject(selectedProject.id, { teamGroups: groups });
                                    await refreshProject();
                                  }} style={{ cursor: 'pointer', fontSize: '10px', color: t.textMuted }} title="Toggle lead">⭐</span>
                                  <span onClick={async () => {
                                    const groups = (selectedProject.teamGroups || []).map(g => g.id === group.id ? { ...g, members: g.members.filter(gm => gm.id !== m.id), leadId: g.leadId === m.id ? null : g.leadId } : g);
                                    await updateProject(selectedProject.id, { teamGroups: groups });
                                    await refreshProject();
                                  }} style={{ cursor: 'pointer', color: t.textMuted, fontSize: '12px' }}>×</span>
                                </>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Handoff Chains */}
                {isProducer && (selectedProject.teamGroups || []).length >= 2 && (
                  <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, marginBottom: '16px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Handoff Pipeline</h3>
                      <Btn theme={theme} onClick={async () => {
                        const chains = [...(selectedProject.handoffChains || []), { id: generateId(), scope: 'all', scopeId: null, stages: (selectedProject.teamGroups || []).map((g, i) => ({ teamGroupId: g.id, teamGroupName: g.name, order: i })) }];
                        await updateProject(selectedProject.id, { handoffChains: chains });
                        await refreshProject();
                        showToast('Pipeline created', 'success');
                      }} small>+ Add Pipeline</Btn>
                    </div>
                    <div style={{ padding: '14px' }}>
                      {(selectedProject.handoffChains || []).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '12px' }}>
                          No handoff pipelines configured. When Team A marks an asset complete, it auto-assigns to Team B.
                        </div>
                      )}
                      {(selectedProject.handoffChains || []).map(chain => (
                        <div key={chain.id} style={{ background: t.bgInput, borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', color: t.textMuted }}>Scope: {chain.scope === 'all' ? 'All Assets' : chain.scopeId}</span>
                            <button onClick={async () => {
                              const chains = (selectedProject.handoffChains || []).filter(c => c.id !== chain.id);
                              await updateProject(selectedProject.id, { handoffChains: chains });
                              await refreshProject();
                            }} style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: '14px' }}>×</button>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {(chain.stages || []).sort((a, b) => a.order - b.order).map((stage, i) => (
                              <div key={stage.teamGroupId} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ padding: '5px 12px', background: `${t.primary}20`, border: `1px solid ${t.primary}40`, borderRadius: '8px', fontSize: '11px', color: t.primary, fontWeight: '600' }}>{stage.teamGroupName}</span>
                                {i < (chain.stages || []).length - 1 && <span style={{ color: t.textMuted, fontSize: '16px' }}>→</span>}
                              </div>
                            ))}
                            <span style={{ padding: '5px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', fontSize: '11px', color: '#22c55e', fontWeight: '600' }}>Review</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Project Team - Flat Member List */}
                <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}` }}>
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>Project Members ({team.length})</h3>
                    {isProducer && <Btn theme={theme} onClick={() => setShowAddTeam(true)} small>+ Add Member</Btn>}
                  </div>
                  <div style={{ padding: '14px' }}>
                    {team.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted }}>
                        <div style={{ fontSize: '13px', marginBottom: '8px' }}>No team members assigned</div>
                        {isProducer && <Btn theme={theme} onClick={() => setShowAddTeam(true)} small>+ Add Team Member</Btn>}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {team.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: t.bgInput, borderRadius: '10px', border: m.isOwner ? '1px solid rgba(249,115,22,0.3)' : `1px solid ${t.border}` }}>
                            <Avatar user={m} size={44} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                                {m.isOwner && <span style={{ fontSize: '10px', color: '#f97316', flexShrink: 0 }}>Owner</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                              <div style={{ marginTop: '6px' }}><RoleBadge role={m.role} /></div>
                            </div>
                            {isProducer && !m.isOwner && (
                              <button onClick={async () => {
                                if (!confirm(`Remove ${m.name} from this project?`)) return;
                                const updatedTeam = (selectedProject.assignedTeam || []).filter(t => t.odId !== m.id);
                                await updateProject(selectedProject.id, { assignedTeam: updatedTeam });
                                await refreshProject();
                                showToast(`${m.name} removed`, 'success');
                              }} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Suggested Roles Based on Project Type */}
                {isProducer && availableTeam.length > 0 && (() => {
                  const suggestedRoles = [];
                  const projectType = selectedProject.type || 'photoshoot';
                  
                  // Role suggestions based on project type
                  if (['video-production', 'ad-film', 'social-content'].includes(projectType)) {
                    if (!team.some(m => ['video-editor', 'editor'].includes(m.role))) {
                      suggestedRoles.push({ roles: ['video-editor', 'editor'], reason: 'Video project needs an editor' });
                    }
                    if (!team.some(m => ['colorist', 'color-grader'].includes(m.role))) {
                      suggestedRoles.push({ roles: ['colorist', 'color-grader'], reason: 'Video project needs colorist' });
                    }
                  }
                  if (['cgi-animation', 'motion-graphics'].includes(projectType)) {
                    if (!team.some(m => ['cgi-artist', '3d-artist', 'motion-designer'].includes(m.role))) {
                      suggestedRoles.push({ roles: ['cgi-artist', '3d-artist', 'motion-designer'], reason: 'CGI/Motion project needs artist' });
                    }
                  }
                  if (['photoshoot', 'product-photography', 'retouch-only'].includes(projectType)) {
                    if (!team.some(m => ['retoucher', 'photo-editor'].includes(m.role))) {
                      suggestedRoles.push({ roles: ['retoucher', 'photo-editor'], reason: 'Photo project needs retoucher' });
                    }
                  }
                  if (['post-production', 'ad-film'].includes(projectType)) {
                    if (!team.some(m => ['sound-engineer', 'audio-editor', 'sound'].includes(m.role))) {
                      suggestedRoles.push({ roles: ['sound-engineer', 'audio-editor', 'sound'], reason: 'Post-production needs sound engineer' });
                    }
                  }
                  
                  const suggestedMembers = suggestedRoles.map(sr => {
                    const member = availableTeam.find(t => sr.roles.includes(t.role));
                    return member ? { ...member, reason: sr.reason } : null;
                  }).filter(Boolean);
                  
                  if (suggestedMembers.length === 0) return null;
                  
                  return (
                    <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, marginTop: '16px' }}>
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
                        <h3 style={{ margin: 0, fontSize: '14px' }}>Suggested for {projectType.replace('-', ' ')}</h3>
                      </div>
                      <div style={{ padding: '14px' }}>
                        {suggestedMembers.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: t.bgInput, borderRadius: '10px', marginBottom: '8px' }}>
                            <Avatar user={m} size={36} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', fontSize: '12px' }}>{m.name}</div>
                              <div style={{ fontSize: '10px', color: t.textMuted }}>{m.reason}</div>
                            </div>
                            <Btn theme={theme} onClick={async () => {
                              const updatedTeam = [...(selectedProject.assignedTeam || []), { odId: m.id, isOwner: false }];
                              await updateProject(selectedProject.id, { assignedTeam: updatedTeam });
                              await refreshProject();
                              showToast(`${m.name} added to project`, 'success');
                            }} small>+ Add</Btn>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Client Contacts */}
                {isProducer && (
                  <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, marginTop: '16px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>Client Contacts ({(selectedProject.clientContacts || []).length})</h3>
                    </div>
                    <div style={{ padding: '14px' }}>
                      {(selectedProject.clientContacts || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '12px' }}>
                          No client contacts added yet
                        </div>
                      ) : (
                        (selectedProject.clientContacts || []).map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '20px' }}>{Icons.users(t.textMuted)}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: '500' }}>{c.name || 'Client'}</div>
                              <div style={{ fontSize: '10px', color: t.textMuted }}>{c.email}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'activity' && (
              <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}> Activity Timeline</h3>
                <ActivityTimeline activities={selectedProject.activityLog || []} maxItems={20} theme={theme} />
              </div>
            )}

            {tab === 'links' && (
              <div>
                {isProducer && (
                  <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, padding: '16px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}> Create Share Link</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Name</label><Input theme={theme} value={newLinkName} onChange={setNewLinkName} placeholder="e.g., Client Review" /></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Type</label><Select theme={theme} value={newLinkType} onChange={setNewLinkType}><option value="client">Client</option><option value="editor">Editor</option></Select></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Expiry (optional)</label><Input theme={theme} type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                      <Btn theme={theme} onClick={handleCreateLink}>Create</Btn>
                    </div>
                  </div>
                )}
                <div style={{ background: t.bgGlass, backdropFilter: t.blur, WebkitBackdropFilter: t.blur, borderRadius: '14px', border: `1px solid ${t.bgGlassBorder}`, padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Active Links ({shareLinks.length})</h3>
                  {shareLinks.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted, fontSize: '12px' }}>No share links</div> : shareLinks.map(link => {
                    const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                    return (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: isExpired ? 'rgba(239,68,68,0.1)' : t.bgInput, borderRadius: '10px', marginBottom: '8px', border: isExpired ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${t.border}` }}>
                        <span style={{ display: 'flex', alignItems: 'center' }}>{link.type === 'client' ? Icons.users(t.textMuted) : Icons.link(t.textMuted)}</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>{link.name}{isExpired && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#ef4444', borderRadius: '4px' }}>EXPIRED</span>}</div><div style={{ fontSize: '10px', color: t.textMuted }}>{link.type} • {formatTimeAgo(link.createdAt)}{link.expiresAt && !isExpired && <span> • Expires {formatDate(link.expiresAt)}</span>}</div></div>
                        <div style={{ display: 'flex', gap: '6px' }}><Btn theme={theme} onClick={() => copyLink(link.token)} small outline>Copy</Btn>{isProducer && <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>{Icons.trash('#ef4444')}</button>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        {/* Upload Modal */}
        {showUpload && (
          <Modal theme={theme} title="Upload Assets" onClose={() => { setShowUpload(false); setUploadFiles([]); setFolderGroups({}); setCatMappings({}); setUploadMode('files'); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '10px', padding: '4px' }}>
                {[{ id: 'files', label: '📎 Select Files' }, { id: 'folder', label: '📁 Upload Folder' }].map(m => (
                  <button key={m.id} onClick={() => { setUploadMode(m.id); setUploadFiles([]); setFolderGroups({}); setCatMappings({}); }} style={{ flex: 1, padding: '8px', background: uploadMode === m.id ? t.primary : 'transparent', border: 'none', borderRadius: '8px', color: uploadMode === m.id ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer', fontWeight: uploadMode === m.id ? '600' : '400', transition: 'all 0.15s' }}>{m.label}</button>
                ))}
              </div>

              {uploadMode === 'files' ? (
                <>
                  <div style={{ textAlign: 'center', padding: '40px', border: `2px dashed ${t.border}`, borderRadius: '12px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                    <div style={{ marginBottom: '12px', opacity: 0.5 }}><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
                    <p style={{ margin: 0, fontSize: '14px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Click to select files'}</p>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: t.textMuted }}>Images, videos, audio, documents</p>
                    <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
                  </div>
                  {uploadFiles.length > 0 && <div style={{ maxHeight: '140px', overflow: 'auto', background: t.bgInput, borderRadius: '8px', padding: '10px' }}>{uploadFiles.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{f.name}</span><span style={{ color: t.textMuted, flexShrink: 0 }}>{formatFileSize(f.size)}</span></div>)}</div>}
                  <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Category (folder)</label><Select theme={theme} value={selectedCat || cats[0]?.id || ''} onChange={setSelectedCat}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                  <Btn theme={theme} onClick={handleUpload} disabled={!uploadFiles.length} color="#22c55e">Upload {uploadFiles.length || ''} Files</Btn>
                </>
              ) : (
                <>
                  {/* Folder picker */}
                  <div style={{ textAlign: 'center', padding: '32px', border: `2px dashed ${Object.keys(folderGroups).length ? t.primary : t.border}`, borderRadius: '12px', cursor: 'pointer', background: Object.keys(folderGroups).length ? `${t.primary}08` : 'transparent', transition: 'all 0.2s' }} onClick={() => folderInputRef.current?.click()}>
                    <div style={{ fontSize: '36px', marginBottom: '10px' }}>📁</div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                      {Object.keys(folderGroups).length ? `${Object.keys(folderGroups).length} sub-folder${Object.keys(folderGroups).length > 1 ? 's' : ''} detected` : 'Select a folder'}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: t.textMuted }}>Subfolders become categories automatically</p>
                    <input ref={folderInputRef} type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={handleFolderSelect} />
                  </div>

                  {/* Subfolder → category mapping preview */}
                  {Object.keys(folderGroups).length > 0 && (
                    <div style={{ background: t.bgInput, borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}`, fontSize: '11px', color: t.textMuted, fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}>
                        <span>SUBFOLDER</span><span>→ CATEGORY</span>
                      </div>
                      {Object.entries(folderGroups).map(([sub, files]) => {
                        const overrideId = catMappings[sub];
                        const existingMatch = (selectedProject.categories || []).find(c =>
                          c.name.toLowerCase() === sub.toLowerCase() || c.id === sub.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                        );
                        const displayCatName = overrideId
                          ? ((selectedProject.categories || []).find(c => c.id === overrideId)?.name || overrideId)
                          : existingMatch ? existingMatch.name : sub;
                        const isNew = !overrideId && !existingMatch;
                        return (
                          <div key={sub} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${t.border}`, gap: '10px' }}>
                            <span style={{ fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {sub === '__root__' ? '(root)' : sub}</span>
                            <span style={{ fontSize: '10px', color: t.textMuted, flexShrink: 0 }}>{files.length} files</span>
                            <span style={{ fontSize: '11px', color: isNew ? '#f59e0b' : '#22c55e', flexShrink: 0, fontWeight: '600' }}>→ {displayCatName}{isNew ? ' ✦new' : ''}</span>
                            <select value={overrideId || ''} onChange={e => setCatMappings(m => ({ ...m, [sub]: e.target.value || undefined }))} style={{ fontSize: '10px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.text, padding: '2px 4px', cursor: 'pointer', maxWidth: '100px' }}>
                              <option value="">Auto</option>
                              {(selectedProject.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {Object.keys(folderGroups).length > 0 && (
                    <div style={{ fontSize: '11px', color: t.textMuted, padding: '4px 0' }}>
                      {Object.values(folderGroups).flat().length} total files across {Object.keys(folderGroups).length} folders
                    </div>
                  )}

                  <Btn theme={theme} onClick={handleFolderUpload} disabled={!Object.keys(folderGroups).length} color="#22c55e">
                    📁 Upload {Object.values(folderGroups).flat().length || ''} Files
                  </Btn>
                </>
              )}
            </div>
          </Modal>
        )}

        {/* Share Modal */}
        {showShare && (
          <Modal theme={theme} title="Share Project" onClose={() => setShowShare(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input theme={theme} value={newLinkName} onChange={setNewLinkName} placeholder="Link name" />
                <Select theme={theme} value={newLinkType} onChange={setNewLinkType}><option value="client">Client</option><option value="editor">Editor</option></Select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Expiry</label><Input theme={theme} type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                <div style={{ display: 'flex', alignItems: 'end' }}><Btn theme={theme} onClick={handleCreateLink}>Create</Btn></div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Active ({shareLinks.length})</div>
                {shareLinks.map(link => (
                  <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ display: 'flex', alignItems: 'center' }}>{link.type === 'client' ? Icons.users(t.textMuted) : Icons.link(t.textMuted)}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '12px' }}>{link.name}</div></div>
                    <Btn theme={theme} onClick={() => copyLink(link.token)} small outline>Copy</Btn>
                    <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>{Icons.trash('#ef4444')}</button>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {/* Add Team Modal */}
        {showAddTeam && (
          <Modal theme={theme} title="Add Team Member" onClose={() => setShowAddTeam(false)}>
            <div style={{ padding: '20px', maxHeight: '400px', overflow: 'auto' }}>{availableTeam.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted, fontSize: '12px' }}>All added</div> : availableTeam.map(u => <div key={u.id} onClick={() => handleAddTeam(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: t.bgInput, borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}><Avatar user={u} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px', color: t.text }}>{u.name}</div><div style={{ fontSize: '10px', color: t.textMuted }}>{u.email}</div></div><RoleBadge role={u.role} /></div>)}</div>
          </Modal>
        )}

        {/* Edit Project Modal */}
        {showEditProject && (() => {
          const editTab = editProjectData._tab || 'general';
          const setEditTab = (tab) => setEditProjectData(d => ({ ...d, _tab: tab }));
          const projectTeam = selectedProject.assignedTeam || [];
          const allMembers = [...users, ...freelancers, ...coreTeam].filter((m, i, arr) => m?.id && arr.findIndex(x => x?.id === m.id) === i);
          const availableMembers = allMembers.filter(m => !projectTeam.some(t => t.odId === m.id));

          return (
          <Modal theme={theme} title="Edit Project" onClose={() => setShowEditProject(false)} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '75vh' }}>
              {/* Tab Navigation */}
              <div style={{ display: 'flex', gap: '0', borderBottom: `1px solid ${t.border}`, padding: '0 20px', flexShrink: 0 }}>
                {[
                  { id: 'general', label: 'General', icon: '📋' },
                  { id: 'team', label: 'Team', icon: '👥' },
                  { id: 'deliverables', label: 'Deliverables', icon: '📦' },
                  { id: 'workflow', label: 'Workflow', icon: '⚙️' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setEditTab(tab.id)} style={{ padding: '12px 16px', background: 'none', border: 'none', borderBottom: editTab === tab.id ? '2px solid #6366f1' : '2px solid transparent', color: editTab === tab.id ? '#6366f1' : t.textSecondary, fontSize: '12px', fontWeight: editTab === tab.id ? '600' : '400', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '14px' }}>{tab.icon}</span>{!isMobile && tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
                {/* General Tab */}
                {editTab === 'general' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Project Name</label>
                        <Input value={editProjectData.name} onChange={(v) => setEditProjectData({ ...editProjectData, name: v })} placeholder="Project name" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Client</label>
                        <Input value={editProjectData.client} onChange={(v) => setEditProjectData({ ...editProjectData, client: v })} placeholder="Client name" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Status</label>
                        <Select theme={theme} value={editProjectData.status} onChange={(v) => setEditProjectData({ ...editProjectData, status: v })}>
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="on-hold">On Hold</option>
                          <option value="archived">Archived</option>
                        </Select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Project Type</label>
                        <Select theme={theme} value={editProjectData.type || 'photoshoot'} onChange={(v) => setEditProjectData({ ...editProjectData, type: v })}>
                          <option value="photoshoot">Photoshoot</option>
                          <option value="video-production">Video Production</option>
                          <option value="ad-film">Ad Film</option>
                          <option value="toolkit">Toolkit</option>
                          <option value="cgi-animation">CGI/Animation</option>
                          <option value="social-content">Social Content</option>
                          <option value="product-photography">Product Photography</option>
                          <option value="event-coverage">Event Coverage</option>
                          <option value="retouch-only">Retouch Only</option>
                          <option value="color-grade">Color Grade Only</option>
                          <option value="post-production">Post Production</option>
                          <option value="motion-graphics">Motion Graphics</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Categories</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {DEFAULT_CATEGORIES.map(cat => {
                          const isActive = editProjectData.categories?.some(c => c.id === cat.id);
                          return (
                            <button key={cat.id} onClick={() => {
                              if (isActive) setEditProjectData({ ...editProjectData, categories: editProjectData.categories.filter(c => c.id !== cat.id) });
                              else setEditProjectData({ ...editProjectData, categories: [...(editProjectData.categories || []), cat] });
                            }} style={{ padding: '7px 12px', background: isActive ? `${cat.color}20` : t.bgInput, border: `1px solid ${isActive ? cat.color : t.border}`, borderRadius: '8px', color: isActive ? cat.color : t.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                              {Icons[cat.icon] && Icons[cat.icon](isActive ? cat.color : t.textMuted)}
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Tab */}
                {editTab === 'team' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>Team Members</div>
                        <div style={{ fontSize: '10px', color: t.textMuted }}>{projectTeam.length} member{projectTeam.length !== 1 ? 's' : ''} assigned</div>
                      </div>
                    </div>
                    {/* Current Team */}
                    {projectTeam.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {projectTeam.map(tm => {
                          const member = allMembers.find(m => m.id === tm.odId);
                          if (!member) return null;
                          const roleInfo = TEAM_ROLES[member.role] || CORE_ROLES[member.role] || { label: member.role || 'Member', color: '#6b7280' };
                          return (
                            <div key={tm.odId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: t.bgInput, borderRadius: '10px', border: `1px solid ${t.borderLight}` }}>
                              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: `${roleInfo.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: roleInfo.color, flexShrink: 0 }}>{(member.name || '?')[0].toUpperCase()}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '12px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</div>
                                <div style={{ fontSize: '10px', color: roleInfo.color, fontWeight: '500' }}>{roleInfo.label}{member.email ? ` • ${member.email}` : ''}</div>
                              </div>
                              {isProducer && (
                                <button onClick={async () => {
                                  const updated = projectTeam.filter(x => x.odId !== tm.odId);
                                  await updateProject(selectedProject.id, { assignedTeam: updated });
                                  await refreshProject();
                                  showToast(`${member.name} removed`, 'success');
                                }} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer', fontWeight: '500', flexShrink: 0 }}>Remove</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', background: t.bgInput, borderRadius: '10px', border: `1px dashed ${t.border}` }}>
                        <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.4 }}>👥</div>
                        <div style={{ fontSize: '12px', color: t.textMuted }}>No team members assigned yet</div>
                      </div>
                    )}
                    {/* Add Member */}
                    {isProducer && availableMembers.length > 0 && (
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Add Team Member</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select id="addMemberSelect" style={{ flex: 1, padding: '8px 10px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '11px' }}>
                            <option value="">Select member...</option>
                            {availableMembers.map(m => {
                              const ri = TEAM_ROLES[m.role] || CORE_ROLES[m.role] || { label: m.role || 'Member' };
                              return <option key={m.id} value={m.id}>{m.name} ({ri.label})</option>;
                            })}
                          </select>
                          <Btn theme={theme} onClick={async () => {
                            const sel = document.getElementById('addMemberSelect');
                            const uid = sel?.value;
                            if (!uid) return;
                            const u = allMembers.find(x => x.id === uid);
                            if (!u) return;
                            const updated = [...projectTeam, { odId: uid, odRole: u.role }];
                            await updateProject(selectedProject.id, { assignedTeam: updated });
                            await refreshProject();
                            sel.value = '';
                            showToast(`${u.name} added`, 'success');
                          }} small>+ Add</Btn>
                        </div>
                      </div>
                    )}
                    {/* Client Contacts */}
                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '14px', marginTop: '4px' }}>
                      <div style={{ fontSize: '11px', color: t.textMuted, fontWeight: '500', marginBottom: '8px' }}>Client Contacts</div>
                      {(selectedProject.clientContacts || []).length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {(selectedProject.clientContacts || []).map(c => (
                            <span key={c.odId || c.id} style={{ padding: '4px 10px', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '8px', fontSize: '10px', color: '#0ea5e9' }}>{c.name || c.odId}</span>
                          ))}
                        </div>
                      ) : <div style={{ fontSize: '11px', color: t.textMuted }}>No client contacts</div>}
                    </div>
                  </div>
                )}

                {/* Deliverables Tab */}
                {editTab === 'deliverables' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Required Photo Formats</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {FILE_FORMATS.photo.map(fmt => {
                          const isActive = (editProjectData.requiredFormats || []).includes(fmt.id);
                          return <button key={fmt.id} onClick={() => { const updated = isActive ? (editProjectData.requiredFormats || []).filter(f => f !== fmt.id) : [...(editProjectData.requiredFormats || []), fmt.id]; setEditProjectData({ ...editProjectData, requiredFormats: updated }); }} style={{ padding: '6px 12px', background: isActive ? 'rgba(99,102,241,0.15)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '8px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '11px', cursor: 'pointer', fontWeight: isActive ? '600' : '400' }}>{fmt.label}</button>;
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Required Video Formats</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {FILE_FORMATS.video.map(fmt => {
                          const isActive = (editProjectData.requiredFormats || []).includes(fmt.id);
                          return <button key={fmt.id} onClick={() => { const updated = isActive ? (editProjectData.requiredFormats || []).filter(f => f !== fmt.id) : [...(editProjectData.requiredFormats || []), fmt.id]; setEditProjectData({ ...editProjectData, requiredFormats: updated }); }} style={{ padding: '6px 12px', background: isActive ? 'rgba(99,102,241,0.15)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '8px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '11px', cursor: 'pointer', fontWeight: isActive ? '600' : '400' }}>{fmt.label}</button>;
                        })}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Photo Sizes/Adapts</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {SIZE_PRESETS.photo.map(size => {
                            const isActive = (editProjectData.requiredSizes || []).includes(size.id);
                            return <button key={size.id} onClick={() => { const updated = isActive ? (editProjectData.requiredSizes || []).filter(s => s !== size.id) : [...(editProjectData.requiredSizes || []), size.id]; setEditProjectData({ ...editProjectData, requiredSizes: updated }); }} style={{ padding: '5px 10px', background: isActive ? 'rgba(34,197,94,0.15)' : t.bgInput, border: `1px solid ${isActive ? '#22c55e' : t.border}`, borderRadius: '8px', color: isActive ? '#22c55e' : t.textSecondary, fontSize: '10px', cursor: 'pointer', fontWeight: isActive ? '600' : '400' }}>{size.label}</button>;
                          })}
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Video Sizes</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {SIZE_PRESETS.video.map(size => {
                            const isActive = (editProjectData.requiredSizes || []).includes(size.id);
                            return <button key={size.id} onClick={() => { const updated = isActive ? (editProjectData.requiredSizes || []).filter(s => s !== size.id) : [...(editProjectData.requiredSizes || []), size.id]; setEditProjectData({ ...editProjectData, requiredSizes: updated }); }} style={{ padding: '5px 10px', background: isActive ? 'rgba(34,197,94,0.15)' : t.bgInput, border: `1px solid ${isActive ? '#22c55e' : t.border}`, borderRadius: '8px', color: isActive ? '#22c55e' : t.textSecondary, fontSize: '10px', cursor: 'pointer', fontWeight: isActive ? '600' : '400' }}>{size.label}</button>;
                          })}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', alignItems: 'end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Max Revision Rounds</label>
                        <input type="number" min="0" max="20" value={editProjectData.maxRevisions || 0} onChange={(e) => setEditProjectData({ ...editProjectData, maxRevisions: parseInt(e.target.value) || 0 })} style={{ width: '80px', padding: '8px 10px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '12px' }} />
                        <span style={{ fontSize: '9px', color: t.textMuted, marginLeft: '6px' }}>0 = unlimited</span>
                      </div>
                      <div style={{ background: 'rgba(99,102,241,0.08)', borderRadius: '10px', padding: '10px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '6px', color: '#6366f1' }}>Quick Presets</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {[
                            { label: 'Photo', formats: ['jpg-web', 'psd', 'tiff'], sizes: ['original', 'web-large', 'social-square', 'social-portrait'], max: 3, roles: ['producer', 'editor', 'retoucher'] },
                            { label: 'Video', formats: ['mp4-web', 'mp4-hq', 'mov-prores'], sizes: ['1080p', '4k', 'square', 'vertical'], max: 5, roles: ['producer', 'editor', 'colorist', 'vfx', 'sound'] },
                            { label: 'Social', formats: ['jpg-web', 'png'], sizes: ['social-square', 'social-portrait', 'social-story'], max: 2, roles: ['producer', 'editor'] },
                          ].map(preset => (
                            <button key={preset.label} onClick={() => setEditProjectData({ ...editProjectData, requiredFormats: preset.formats, requiredSizes: preset.sizes, maxRevisions: preset.max, versionUploadRoles: preset.roles })} style={{ padding: '4px 8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '6px', fontSize: '9px', cursor: 'pointer', color: t.text }}>{preset.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Workflow Tab */}
                {editTab === 'workflow' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Who can upload new versions?</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {[{ id: 'producer', label: 'Producer' }, { id: 'editor', label: 'Editor' }, { id: 'colorist', label: 'Colorist' }, { id: 'vfx', label: 'VFX Artist' }, { id: 'retoucher', label: 'Retoucher' }, { id: 'sound', label: 'Sound' }].map(role => {
                          const isActive = (editProjectData.versionUploadRoles || ['producer', 'editor']).includes(role.id);
                          return <button key={role.id} onClick={() => { const current = editProjectData.versionUploadRoles || ['producer', 'editor']; const updated = isActive ? current.filter(r => r !== role.id) : [...current, role.id]; setEditProjectData({ ...editProjectData, versionUploadRoles: updated }); }} style={{ padding: '6px 12px', background: isActive ? 'rgba(99,102,241,0.15)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '8px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '11px', cursor: 'pointer', fontWeight: isActive ? '600' : '400' }}>{role.label}</button>;
                        })}
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500' }}>Approval Workflow</label>
                      <Select theme={theme} value={editProjectData.approvalWorkflow || 'producer'} onChange={(v) => setEditProjectData({ ...editProjectData, approvalWorkflow: v })}>
                        <option value="producer">Producer Only</option>
                        <option value="client">Client Approval Required</option>
                        <option value="both">Producer + Client</option>
                      </Select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '8px', fontWeight: '500' }}>Auto-Notifications</label>
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '8px' }}>
                        {[
                          { id: 'notifyOnUpload', label: 'Notify client on upload' },
                          { id: 'notifyOnVersion', label: 'Notify on new version' },
                          { id: 'notifyOnApproval', label: 'Notify team on approval' },
                          { id: 'notifyOnDeadline', label: 'Deadline reminders' },
                        ].map(opt => (
                          <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px', padding: '8px 10px', background: t.bgInput, borderRadius: '8px', border: `1px solid ${t.borderLight}` }}>
                            <input type="checkbox" checked={editProjectData[opt.id] ?? true} onChange={(e) => setEditProjectData({ ...editProjectData, [opt.id]: e.target.checked })} style={{ accentColor: '#6366f1' }} />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', gap: '10px', padding: '16px 20px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
                <Btn
                  onClick={async () => {
                    const { _tab, ...data } = editProjectData;
                    await updateProject(selectedProject.id, {
                      name: data.name, client: data.client, status: data.status, type: data.type,
                      categories: data.categories, requiredFormats: data.requiredFormats,
                      requiredSizes: data.requiredSizes, maxRevisions: data.maxRevisions,
                      versionUploadRoles: data.versionUploadRoles, approvalWorkflow: data.approvalWorkflow,
                      notifyOnUpload: data.notifyOnUpload, notifyOnVersion: data.notifyOnVersion,
                      notifyOnApproval: data.notifyOnApproval, notifyOnDeadline: data.notifyOnDeadline
                    });
                    await refreshProject();
                    setShowEditProject(false);
                    showToast('Project updated', 'success');
                  }}
                >Save Changes</Btn>
                <Btn theme={theme} onClick={() => setShowEditProject(false)} outline>Cancel</Btn>
              </div>
            </div>
          </Modal>
          );
        })()}

        {/* ASSET PREVIEW MODAL - FULL FEATURED LIGHTBOX WITH NAVIGATION */}
        {selectedAsset && (() => {
          // Get sorted assets for navigation
          const allAssets = (selectedProject.assets || []).filter(x => !x.deleted);
          const filteredAssets = selectedCat ? allAssets.filter(x => x.category === selectedCat) : allAssets;
          const typeOrder = { image: 0, video: 1, audio: 2, other: 3 };
          const sortedAssets = filteredAssets.sort((x, y) => (typeOrder[x.type] || 3) - (typeOrder[y.type] || 3));
          const currentIndex = sortedAssets.findIndex(a => a.id === selectedAsset.id);
          const hasPrev = currentIndex > 0;
          const hasNext = currentIndex < sortedAssets.length - 1;
          
          const goToPrev = () => { if (hasPrev) { setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex - 1]); } };
          const goToNext = () => { if (hasNext) { setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex + 1]); } };
          
          // Touch swipe handling
          const minSwipeDistance = 50;
          const onTouchStartHandler = (e) => {
            setTouchEnd(null);
            setTouchStart(e.targetTouches[0].clientX);
          };
          const onTouchMoveHandler = (e) => setTouchEnd(e.targetTouches[0].clientX);
          const onTouchEndHandler = () => {
            if (!touchStart || !touchEnd) return;
            const distance = touchStart - touchEnd;
            if (Math.abs(distance) > minSwipeDistance) {
              if (distance > 0 && hasNext) goToNext();
              if (distance < 0 && hasPrev) goToPrev();
            }
          };
          
          return (
          <div
            className="modal-backdrop"
            style={{ position: 'fixed', top: 0, bottom: 0, right: 0, left: isMobile ? 0 : '60px', background: t.bg, zIndex: 1000, display: 'flex', flexDirection: 'column' }}
            onTouchStart={onTouchStartHandler}
            onTouchMove={onTouchMoveHandler}
            onTouchEnd={onTouchEndHandler}
          >
            {/* Top Bar */}
            {!isFullscreen && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: t.bgSecondary, flexShrink: 0, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setSelectedAsset(null)} style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '50%', color: '#fff', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>✕</button>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: t.text }}>{selectedAsset.name}</div>
                  <div style={{ fontSize: '11px', color: t.textMuted }}>{currentIndex + 1} of {sortedAssets.length} • v{selectedAsset.currentVersion}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* Quick Rating in header */}
                <div style={{ display: 'flex', gap: '2px', marginRight: '4px' }}>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} onClick={() => { handleRate(selectedAsset.id, star); setSelectedAsset({ ...selectedAsset, rating: star }); }} style={{ cursor: 'pointer', fontSize: '16px', color: star <= (selectedAsset.rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>★</span>
                  ))}
                </div>
                {/* Color label swatches — P=red, M=yellow, G=green, U=clear */}
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginRight: '8px', padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[{ label: 'red', color: '#ef4444', title: 'Pick (P)' }, { label: 'yellow', color: '#f59e0b', title: 'Maybe (M)' }, { label: 'green', color: '#22c55e', title: 'Alt (G)' }].map(({ label, color, title }) => (
                    <div key={label} onClick={() => handleColorLabel(selectedAsset.id, label)} title={title} style={{ width: '14px', height: '14px', borderRadius: '50%', background: color, cursor: 'pointer', border: selectedAsset.colorLabel === label ? '2px solid #fff' : '2px solid transparent', opacity: selectedAsset.colorLabel && selectedAsset.colorLabel !== label ? 0.4 : 1, transition: 'all 0.15s', boxShadow: selectedAsset.colorLabel === label ? `0 0 6px ${color}` : 'none' }} />
                  ))}
                  {selectedAsset.colorLabel && <div onClick={() => handleColorLabel(selectedAsset.id, selectedAsset.colorLabel)} title="Clear (U)" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', paddingLeft: '2px', lineHeight: 1 }}>✕</div>}
                </div>
                {/* Fullscreen toggle */}
                <button onClick={() => setIsFullscreen(true)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>⛶ {!isMobile && 'Fullscreen'}</button>
                {/* Tab buttons */}
                {[{ id: 'preview', icon: '', label: 'Preview' }, { id: 'annotate', icon: '', label: 'Annotate' }, { id: 'compare', icon: '', label: 'Compare' }, { id: 'activity', icon: '', label: 'Activity' }].map(tb => (
                  <button key={tb.id} onClick={() => setAssetTab(tb.id)} style={{ padding: '6px 12px', background: assetTab === tb.id ? 'rgba(99,102,241,0.9)' : 'rgba(255,255,255,0.06)', border: assetTab === tb.id ? 'none' : '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: assetTab === tb.id ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: '11px', cursor: 'pointer', fontWeight: assetTab === tb.id ? '600' : '400', transition: 'all 0.2s' }}>{tb.icon} {!isMobile && tb.label}</button>
                ))}
              </div>
            </div>
            )}
            
            {/* Fullscreen Mode Exit Button */}
            {isFullscreen && (
              <button onClick={() => setIsFullscreen(false)} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20, padding: '10px 16px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '50px', color: '#fff', fontSize: '12px', cursor: 'pointer', transition: 'background 0.2s' }}>✕ Exit Fullscreen</button>
            )}
            
            {/* Fullscreen Rating + Selection */}
            {isFullscreen && (
              <div style={{ position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                {/* Big Stars */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.8)', borderRadius: '16px', padding: '12px 20px' }}>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} onClick={() => { handleRate(selectedAsset.id, star); setSelectedAsset({ ...selectedAsset, rating: star }); }} style={{ cursor: 'pointer', fontSize: '32px', color: star <= (selectedAsset.rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.3)', transition: 'transform 0.1s' }} onMouseEnter={(e) => e.target.style.transform = 'scale(1.2)'} onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}>★</span>
                  ))}
                </div>
                {/* Selection Toggle Button */}
                <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected }); }} style={{ padding: '12px 24px', background: selectedAsset.isSelected ? '#22c55e' : 'rgba(255,255,255,0.15)', border: selectedAsset.isSelected ? 'none' : '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                  {selectedAsset.isSelected ? 'Selected' : '☆ Mark as Selected'}
                </button>
                {/* Confirm Selection Button - only show if there are selections */}
                {!selectedProject.selectionConfirmed && selectedCount > 0 && (isProducer || userProfile?.role === 'client') && (
                  <button onClick={() => { setIsFullscreen(false); setShowSelectionOverview(true); }} style={{ padding: '10px 20px', background: '#f59e0b', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    Confirm Selection ({selectedCount})
                  </button>
                )}
              </div>
            )}
            
            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
              {/* Left Navigation Arrow — offset past the asset panel */}
              {hasPrev && (
                <button onClick={goToPrev} className="hover-lift" style={{ position: 'absolute', left: isMobile ? '8px' : (isFullscreen || assetPanelCollapsed ? '20px' : '216px'), top: '50%', transform: 'translateY(-50%)', width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: isMobile ? '16px' : '20px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>‹</button>
              )}

              {/* Right Navigation Arrow — offset before the sidebar */}
              {hasNext && (
                <button onClick={goToNext} className="hover-lift" style={{ position: 'absolute', right: isMobile || isFullscreen ? '20px' : (isTablet ? '276px' : '316px'), top: '50%', transform: 'translateY(-50%)', width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: isMobile ? '16px' : '20px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>›</button>
              )}
              
              {/* Preview/Annotate Tab */}
              {(assetTab === 'preview' || assetTab === 'annotate') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
                  {/* LEFT: Asset Overview Panel (collapsible) */}
                  {!isMobile && !isFullscreen && (
                    <div style={{ width: assetPanelCollapsed ? '0px' : '200px', background: t.bgSecondary, borderRight: assetPanelCollapsed ? 'none' : `1px solid ${t.border}`, overflow: 'hidden', transition: 'width 0.2s ease', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                      {!assetPanelCollapsed && (
                        <>
                          <div style={{ padding: '10px 12px', borderBottom: `1px solid ${t.borderLight}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: t.text }}>Assets ({sortedAssets.length})</span>
                            <button onClick={() => setAssetPanelCollapsed(true)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: '14px', padding: '2px' }} title="Collapse panel">‹</button>
                          </div>
                          <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
                            {sortedAssets.map((asset, idx) => (
                              <div
                                key={asset.id}
                                onClick={() => { setImageLoading(true); setSelectedAsset(asset); setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px',
                                  background: asset.id === selectedAsset.id ? `${t.primary}20` : 'transparent',
                                  border: asset.id === selectedAsset.id ? `1px solid ${t.primary}40` : '1px solid transparent',
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => { if (asset.id !== selectedAsset.id) e.currentTarget.style.background = t.bgHover; }}
                                onMouseLeave={e => { if (asset.id !== selectedAsset.id) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: t.bgInput, border: `1px solid ${t.borderLight}` }}>
                                  {asset.type === 'image' ? (
                                    <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: t.textMuted }}>{asset.type === 'video' ? 'VID' : asset.type === 'audio' ? 'AUD' : 'DOC'}</div>
                                  )}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '10px', fontWeight: '500', color: asset.id === selectedAsset.id ? t.text : t.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                    {asset.rating > 0 && <span style={{ fontSize: '8px', color: '#fbbf24' }}>{'★'.repeat(asset.rating)}</span>}
                                    {asset.isSelected && <span style={{ fontSize: '7px', color: t.success, fontWeight: '700' }}>SEL</span>}
                                    {asset.feedback?.length > 0 && <span style={{ fontSize: '7px', color: t.danger, background: `${t.danger}20`, padding: '0 3px', borderRadius: '3px' }}>{asset.feedback.length}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* Asset Panel Toggle (when collapsed) */}
                  {!isMobile && !isFullscreen && assetPanelCollapsed && (
                    <button onClick={() => setAssetPanelCollapsed(false)} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', zIndex: 15, width: '24px', height: '60px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '0 8px 8px 0', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }} title="Show asset panel">›</button>
                  )}
                  {/* CENTER: Preview/Annotation Area */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: t.bg, minWidth: 0, overflow: 'hidden' }}>
                    {/* Content Area */}
                    <div onClick={(e) => { if (assetTab === 'annotate' && e.target === e.currentTarget) setAssetTab('preview'); }} style={{ flex: 1, display: 'flex', alignItems: assetTab === 'annotate' ? 'stretch' : 'center', justifyContent: assetTab === 'annotate' ? 'stretch' : 'center', padding: assetTab === 'annotate' ? 0 : (isMobile ? '8px 40px' : '16px 70px'), overflow: 'hidden' }}>
                      {selectedAsset.type === 'video' ? (
                        selectedAsset.muxUploadId && !selectedAsset.url && !selectedAsset.muxPlaybackId ? (
                          <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{ width: '50px', height: '50px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Processing video...</div>
                            <button onClick={async () => { try { const res = await fetch(`/api/mux/upload?uploadId=${selectedAsset.muxUploadId}`); const data = await res.json(); if (data.asset?.playbackId) { const updatedAssets = selectedProject.assets.map(a => a.id === selectedAsset.id ? { ...a, muxPlaybackId: data.asset.playbackId, thumbnail: data.asset.thumbnailUrl || a.thumbnail } : a); await updateProject(selectedProject.id, { assets: updatedAssets }); await refreshProject(); showToast('Ready!', 'success'); } else { showToast('Still processing...', 'info'); } } catch (e) { showToast('Check failed', 'error'); } }} style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>Check</button>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                          </div>
                        ) : (
                        /* === CUSTOM VIDEO PLAYER (Frame.io-style) === */
                        <div
                          ref={videoContainerRef}
                          tabIndex={0}
                          onFocus={() => setVideoFocused(true)}
                          onBlur={() => setVideoFocused(false)}
                          onClick={() => videoContainerRef.current?.focus()}
                          style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', outline: 'none', cursor: 'pointer' }}
                        >
                          {/* Video Element (no native controls) */}
                          <video
                            ref={videoRef} playsInline
                            preload="metadata"
                            src={selectedAsset.muxPlaybackId ? undefined : selectedAsset.url}
                            poster={selectedAsset.muxPlaybackId ? (selectedAsset.thumbnail || `https://image.mux.com/${selectedAsset.muxPlaybackId}/thumbnail.jpg`) : (selectedAsset.thumbnailUrl || undefined)}
                            onTimeUpdate={handleVideoTimeUpdate}
                            onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                            onCanPlay={() => setVideoLoading && setVideoLoading(false)}
                            onPlay={() => setVideoPlaying(true)}
                            onPause={() => setVideoPlaying(false)}
                            onEnded={() => { setVideoPlaying(false); setShuttleSpeed(0); }}
                            onClick={(e) => { e.stopPropagation(); const vid = videoRef.current; if (vid.paused) { vid.play(); } else { vid.pause(); } }}
                            style={{ maxWidth: '100%', maxHeight: 'calc(100% - 80px)', objectFit: 'contain', background: '#000', borderRadius: '8px 8px 0 0' }}
                          >
                            {selectedAsset.muxPlaybackId && <source src={`https://stream.mux.com/${selectedAsset.muxPlaybackId}.m3u8`} type="application/x-mpegURL" />}
                          </video>

                          {/* Big Play Button Overlay (when paused) */}
                          {!videoPlaying && videoDuration > 0 && (
                            <div onClick={(e) => { e.stopPropagation(); videoRef.current?.play(); }} style={{ position: 'absolute', top: 'calc(50% - 40px)', left: '50%', transform: 'translate(-50%, -50%)', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.8)'; e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.1)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)'; }}>
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20"/></svg>
                            </div>
                          )}

                          {/* Shuttle Speed Indicator */}
                          {shuttleSpeed !== 0 && (
                            <div style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 14px', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', borderRadius: '8px', fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', color: shuttleSpeed < 0 ? '#f59e0b' : '#22c55e', letterSpacing: '0.5px' }}>
                              {shuttleSpeed < 0 ? '◀◀' : '▶▶'} {Math.abs(shuttleSpeed)}x
                            </div>
                          )}

                          {/* === Control Bar === */}
                          <div style={{
                            position: 'relative', width: '100%', maxWidth: '100%',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                            borderRadius: '0 0 8px 8px', padding: '0',
                            opacity: videoControlsVisible || !videoPlaying ? 1 : 0,
                            transition: 'opacity 0.3s ease',
                            pointerEvents: videoControlsVisible || !videoPlaying ? 'auto' : 'none'
                          }}>

                            {/* Scrub Bar with Comment Markers */}
                            <div style={{ padding: '8px 12px 0 12px' }}>
                              <div
                                ref={scrubBarRef}
                                onMouseDown={(e) => {
                                  setIsScrubbing(true);
                                  const rect = scrubBarRef.current.getBoundingClientRect();
                                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                  if (videoRef.current) videoRef.current.currentTime = pct * (videoDuration || 0);
                                }}
                                onMouseMove={handleVideoScrubMove}
                                onMouseUp={() => setIsScrubbing(false)}
                                onMouseLeave={() => { if (!isScrubbing) setVideoHoverTime(null); }}
                                onTouchStart={(e) => {
                                  setIsScrubbing(true);
                                  const rect = scrubBarRef.current.getBoundingClientRect();
                                  const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                                  if (videoRef.current) videoRef.current.currentTime = pct * (videoDuration || 0);
                                }}
                                onTouchMove={(e) => {
                                  e.preventDefault();
                                  const rect = scrubBarRef.current.getBoundingClientRect();
                                  const pct = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
                                  if (videoRef.current) videoRef.current.currentTime = pct * (videoDuration || 0);
                                }}
                                onTouchEnd={() => setIsScrubbing(false)}
                                className="video-scrub-bar"
                                style={{ position: 'relative', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', userSelect: 'none' }}
                              >
                                {/* Track bg — expands on hover via CSS class */}
                                <div className="scrub-track" style={{ position: 'absolute', left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', top: '50%', transform: 'translateY(-50%)', transition: 'height 0.15s' }} />
                                {/* Buffered */}
                                <div className="scrub-track" style={{ position: 'absolute', left: 0, height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', top: '50%', transform: 'translateY(-50%)', width: `${videoDuration ? (videoBuffered / videoDuration) * 100 : 0}%`, transition: 'width 0.3s, height 0.15s' }} />
                                {/* Progress */}
                                <div className="scrub-track" style={{ position: 'absolute', left: 0, height: '4px', background: '#6366f1', borderRadius: '2px', top: '50%', transform: 'translateY(-50%)', width: `${videoDuration ? (videoTime / videoDuration) * 100 : 0}%`, transition: 'height 0.15s' }} />
                                {/* Playhead */}
                                <div style={{ position: 'absolute', left: `${videoDuration ? (videoTime / videoDuration) * 100 : 0}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', background: '#6366f1', border: '2px solid #fff', boxShadow: '0 0 6px rgba(0,0,0,0.5)', transition: isScrubbing ? 'none' : 'left 0.1s', zIndex: 3 }} />

                                {/* Comment Markers — with expanded hit area */}
                                {videoFeedbackMarkers.map(fb => (
                                  <div
                                    key={fb.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (videoRef.current) videoRef.current.currentTime = fb.videoTimestamp;
                                      setHighlightedFeedbackId(fb.id);
                                      setTimeout(() => setHighlightedFeedbackId(null), 3000);
                                    }}
                                    title={`${fb.userName}: ${fb.text.substring(0, 50)}${fb.text.length > 50 ? '...' : ''}`}
                                    style={{
                                      position: 'absolute',
                                      left: `${videoDuration ? (fb.videoTimestamp / videoDuration) * 100 : 0}%`,
                                      top: '50%', transform: 'translate(-50%, -50%)',
                                      width: '24px', height: '24px', borderRadius: '50%',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      zIndex: 2, cursor: 'pointer'
                                    }}
                                  >
                                    <div style={{
                                      width: '8px', height: '8px', borderRadius: '50%',
                                      background: fb.isDone ? '#22c55e' : '#f59e0b',
                                      border: '1.5px solid rgba(0,0,0,0.5)',
                                      boxShadow: highlightedFeedbackId === fb.id ? `0 0 8px 2px ${fb.isDone ? '#22c55e' : '#f59e0b'}` : '0 1px 3px rgba(0,0,0,0.4)',
                                      transition: 'box-shadow 0.2s, transform 0.15s',
                                      transform: highlightedFeedbackId === fb.id ? 'scale(1.4)' : 'scale(1)'
                                    }} />
                                  </div>
                                ))}

                                {/* Hover Timecode Tooltip — clamped to bounds */}
                                {videoHoverTime !== null && scrubBarRef.current && (
                                  <div style={{ position: 'absolute', bottom: '22px', left: `${Math.max(30, Math.min(videoHoverX, scrubBarRef.current.getBoundingClientRect().width - 30))}px`, transform: 'translateX(-50%)', padding: '3px 8px', background: 'rgba(0,0,0,0.9)', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', color: '#fff', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 10 }}>
                                    {formatTimecode(videoHoverTime)}
                                  </div>
                                )}
                              </div>
                            </div>
                            {/* Scrub bar hover expansion CSS */}
                            <style>{`.video-scrub-bar:hover .scrub-track { height: 6px !important; }`}</style>

                            {/* Controls Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px 10px 12px' }}>
                              {/* Play/Pause */}
                              <button aria-label={videoPlaying ? 'Pause' : 'Play'} onClick={(e) => { e.stopPropagation(); const vid = videoRef.current; if (vid.paused) { vid.play(); } else { vid.pause(); } setShuttleSpeed(0); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                {videoPlaying ? (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                                ) : (
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20"/></svg>
                                )}
                              </button>

                              {/* Frame Back */}
                              <button aria-label="Previous frame" onClick={(e) => { e.stopPropagation(); const vid = videoRef.current; vid.pause(); setVideoPlaying(false); setShuttleSpeed(0); vid.currentTime = Math.max(0, vid.currentTime - 1/24); }} title="Frame back (←)" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', fontSize: '12px', borderRadius: '4px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15,18 9,12 15,6"/></svg>
                              </button>

                              {/* Frame Forward */}
                              <button aria-label="Next frame" onClick={(e) => { e.stopPropagation(); const vid = videoRef.current; vid.pause(); setVideoPlaying(false); setShuttleSpeed(0); vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 1/24); }} title="Frame forward (→)" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', fontSize: '12px', borderRadius: '4px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9,6 15,12 9,18"/></svg>
                              </button>

                              {/* Timecode */}
                              <div style={{ padding: '2px 10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: '#22c55e', background: 'rgba(0,0,0,0.4)', letterSpacing: '0.5px', flexShrink: 0 }}>
                                {formatTimecode(videoTime)} <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span> {formatTimecode(videoDuration)}
                              </div>

                              <div style={{ flex: 1 }} />

                              {/* Volume */}
                              <button aria-label={videoMuted ? 'Unmute' : 'Mute'} onClick={(e) => { e.stopPropagation(); const newMuted = !videoMuted; setVideoMuted(newMuted); if (videoRef.current) videoRef.current.muted = newMuted; }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                {videoMuted || videoVolume === 0 ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5" fill="currentColor"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
                                )}
                              </button>
                              <input
                                type="range" min="0" max="1" step="0.05"
                                value={videoMuted ? 0 : videoVolume}
                                onChange={(e) => { e.stopPropagation(); const v = parseFloat(e.target.value); setVideoVolume(v); setVideoMuted(v === 0); if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; } }}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: '60px', height: '3px', cursor: 'pointer', accentColor: '#6366f1' }}
                              />

                              {/* Speed */}
                              <div style={{ position: 'relative' }}>
                                <button aria-label={`Playback speed ${videoPlaybackRate}x`} onClick={(e) => { e.stopPropagation(); setShowSpeedMenu(!showSpeedMenu); }} style={{ background: videoPlaybackRate !== 1 ? 'rgba(99,102,241,0.3)' : 'none', border: videoPlaybackRate !== 1 ? '1px solid rgba(99,102,241,0.5)' : 'none', borderRadius: '4px', color: videoPlaybackRate !== 1 ? '#a5b4fc' : 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '2px 6px', fontSize: '10px', fontWeight: '600', fontFamily: 'monospace' }}>
                                  {videoPlaybackRate}x
                                </button>
                                {showSpeedMenu && (
                                  <div style={{ position: 'absolute', bottom: '100%', right: 0, marginBottom: '4px', background: 'rgba(20,20,30,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px', minWidth: '60px', zIndex: 100 }}>
                                    {[0.25, 0.5, 1, 1.5, 2, 4].map(spd => (
                                      <div key={spd} onClick={(e) => { e.stopPropagation(); if (videoRef.current) { videoRef.current.playbackRate = spd; setVideoPlaybackRate(spd); } setShowSpeedMenu(false); setShuttleSpeed(0); }} style={{ padding: '5px 10px', fontSize: '11px', color: videoPlaybackRate === spd ? '#6366f1' : 'rgba(255,255,255,0.7)', fontWeight: videoPlaybackRate === spd ? '700' : '400', cursor: 'pointer', borderRadius: '4px', fontFamily: 'monospace', textAlign: 'center' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                        {spd}x
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Fullscreen */}
                              <button aria-label="Toggle fullscreen" onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }} title="Fullscreen (F)" style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15,3 21,3 21,9"/><polyline points="9,21 3,21 3,15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                              </button>
                            </div>

                            {/* Keyboard Shortcut Hint */}
                            {videoFocused && !videoPlaying && videoDuration > 0 && assetTab !== 'annotate' && (
                              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '8px', padding: '6px 12px', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', borderRadius: '6px', fontSize: '9px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap', pointerEvents: 'none', display: 'flex', gap: '10px' }}>
                                <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>J/K/L</b> shuttle</span>
                                <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>←→</b> frame</span>
                                <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>⇧←→</b> 1s</span>
                                <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>,.</b> frame</span>
                                <span><b style={{ color: 'rgba(255,255,255,0.8)' }}>[]</b> speed</span>
                              </div>
                            )}
                          </div>

                          {/* Video Annotation Overlay — pauses video and overlays drawing tools */}
                          {assetTab === 'annotate' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 80px)', zIndex: 15, cursor: 'crosshair' }}
                            >
                              {/* Annotating frame badge */}
                              <div style={{ position: 'absolute', top: '8px', left: '50%', transform: 'translateX(-50%)', zIndex: 25, padding: '6px 14px', background: 'rgba(99,102,241,0.9)', borderRadius: '20px', fontSize: '11px', color: '#fff', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', backdropFilter: 'blur(8px)', pointerEvents: 'none' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                                Annotating at {formatTimecode(videoTime)}
                              </div>
                              <AnnotationCanvas
                                videoOverlay={true}
                                annotations={visibleVideoAnnotations}
                                onChange={handleSaveVideoAnnotations}
                                t={t}
                                theme={theme}
                                userName={userProfile?.name}
                              />
                            </div>
                          )}

                          {/* Readonly video annotation markers — show at matching timestamps during preview */}
                          {assetTab === 'preview' && visibleVideoAnnotations.length > 0 && (
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 80px)', pointerEvents: 'none', zIndex: 5 }}>
                              {visibleVideoAnnotations.map(a => {
                                if (a.type === 'freehand' && a.path) {
                                  const pathD = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                  return <svg key={a.id} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}><path d={pathD} stroke={a.color} strokeWidth="0.5" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px' }} /></svg>;
                                }
                                if (a.type === 'text') return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, color: '#fff', fontSize: '13px', fontWeight: '600', padding: '4px 10px', background: a.color, borderRadius: '4px', maxWidth: '200px', wordBreak: 'break-word', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', pointerEvents: 'none', opacity: 0.85 }}>{a.text}</div>;
                                if (a.type === 'circle') return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '50%', background: `${a.color}15`, boxSizing: 'border-box', pointerEvents: 'none', opacity: 0.85 }} />;
                                if (a.type === 'arrow') return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, pointerEvents: 'none', opacity: 0.85 }}><svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}><defs><marker id={`vo-arr-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs><line x1="0" y1="50" x2="100" y2="50" stroke={a.color} strokeWidth="3" markerEnd={`url(#vo-arr-${a.id})`} vectorEffect="non-scaling-stroke" /></svg></div>;
                                return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '3px', background: `${a.color}15`, boxSizing: 'border-box', pointerEvents: 'none', opacity: 0.85 }} />;
                              })}
                            </div>
                          )}
                        </div>
                        )
                      ) : selectedAsset.type === 'audio' ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ marginBottom: '20px', opacity: 0.5 }}><svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg></div>
                          <audio src={selectedAsset.url} controls style={{ width: '100%', maxWidth: '300px' }} />
                        </div>
                      ) : selectedAsset.type === 'image' ? (
                        assetTab === 'annotate' ? (
                          <AnnotationCanvas
                            imageUrl={selectedAsset.url}
                            annotations={selectedAsset.annotations || []}
                            onChange={handleSaveAnnotations}
                            t={t}
                            theme={theme}
                            userName={userProfile?.name}
                          />
                        ) : (
                          <div 
                            ref={imageContainerRef}
                            style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                          >
                            {/* Zoom Controls - Top Right */}
                            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 20, display: 'flex', gap: '2px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '3px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                              <button
                                onClick={() => { setZoomLevel(z => { const newZ = Math.max(0.25, Math.round((z - 0.1) * 10) / 10); if (newZ <= 1) setPanPosition({ x: 0, y: 0 }); return newZ; }); }}
                                style={{ width: '30px', height: '30px', background: 'transparent', border: 'none', borderRadius: '7px', color: t.text, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Zoom out (-)"
                              >-</button>
                              <button
                                onClick={() => { setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}
                                style={{ padding: '0 8px', height: '30px', background: zoomLevel === 1 ? `${t.primary}20` : 'transparent', border: 'none', borderRadius: '7px', color: t.text, fontSize: '11px', cursor: 'pointer', fontWeight: '500', minWidth: '44px' }}
                                title="Fit to screen"
                              >{zoomLevel === 1 ? 'Fit' : Math.round(zoomLevel * 100) + '%'}</button>
                              <button
                                onClick={() => { setZoomLevel(z => Math.min(5, Math.round((z + 0.1) * 10) / 10)); }}
                                style={{ width: '30px', height: '30px', background: 'transparent', border: 'none', borderRadius: '7px', color: t.text, fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Zoom in (+)"
                              >+</button>
                              <div style={{ width: '1px', background: t.border, margin: '4px 1px' }} />
                              <button
                                onClick={() => { setZoomLevel(1); setPanPosition({ x: 0, y: 0 }); }}
                                style={{ padding: '0 6px', height: '30px', background: 'transparent', border: 'none', borderRadius: '7px', color: t.textMuted, fontSize: '10px', cursor: 'pointer' }}
                                title="Fit"
                              >Fit</button>
                              <button
                                onClick={() => { setZoomLevel(3); setPanPosition({ x: 0, y: 0 }); }}
                                style={{ padding: '0 6px', height: '30px', background: zoomLevel >= 3 ? `${t.primary}20` : 'transparent', border: 'none', borderRadius: '7px', color: t.textMuted, fontSize: '10px', cursor: 'pointer' }}
                                title="3x zoom"
                              >3x</button>
                              {selectedAsset.type === 'image' && (
                                <>
                                  <div style={{ width: '1px', background: t.border, margin: '4px 1px' }} />
                                  <button
                                    onClick={() => setShowCropper(true)}
                                    style={{ padding: '0 8px', height: '30px', background: 'transparent', border: 'none', borderRadius: '7px', color: t.textMuted, fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Crop & Export"
                                  ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.13 1L6 16a2 2 0 002 2h15"/><path d="M1 6.13L16 6a2 2 0 012 2v15"/></svg>Crop</button>
                                </>
                              )}
                            </div>

                            {/* Floating Annotation Toolbar — quick-switch to annotate mode */}
                            {!isFullscreen && assetTab === 'preview' && (
                              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: '2px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '10px', padding: '3px', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
                                {[
                                  { tool: 'freehand', title: 'Draw annotation', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg> },
                                  { tool: 'rect', title: 'Draw rectangle', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> },
                                  { tool: 'text', title: 'Add text note', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 10H3"/><path d="M21 6H3"/><path d="M21 14H3"/><path d="M17 18H3"/></svg> },
                                ].map(btn => (
                                  <button
                                    key={btn.tool}
                                    onClick={() => setAssetTab('annotate')}
                                    style={{ width: '32px', height: '32px', background: 'transparent', border: 'none', borderRadius: '7px', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = `${t.primary}20`; e.currentTarget.style.color = t.primary; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = t.textSecondary; }}
                                    title={btn.title}
                                  >{btn.icon}</button>
                                ))}
                              </div>
                            )}

                            {/* Loading High-Res Indicator */}
                            {isLoadingHighRes && (
                              <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 20, background: 'rgba(0,0,0,0.7)', borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '14px', height: '14px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '11px', color: t.textMuted }}>Loading full resolution...</span>
                              </div>
                            )}
                            
                            {/* High-Res Loaded Badge */}
                            {highResLoaded && zoomLevel > 1.5 && (
                              <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 20, background: 'rgba(34,197,94,0.9)', borderRadius: '6px', padding: '4px 10px', fontSize: '10px', color: '#fff', fontWeight: '600' }}>
                                ✓ Full Resolution
                              </div>
                            )}
                            
                            {/* Zoomable Image Container */}
                            <div 
                              style={{ 
                                flex: 1, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                overflow: 'hidden',
                                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                                touchAction: 'none'
                              }}
                              onWheel={(e) => {
                                e.preventDefault();
                                // Smooth proportional zoom: use multiplicative scaling for consistent feel
                                // Trackpad deltaY is typically 1-30, mouse wheel is 100+
                                const absDelta = Math.abs(e.deltaY);
                                // Small multiplier for smooth increments: trackpad ~1-3% per event, mouse wheel ~8%
                                const factor = absDelta > 50 ? 1.08 : (1 + Math.min(absDelta * 0.003, 0.04));
                                const direction = e.deltaY > 0 ? 1 / factor : factor;
                                setZoomLevel(z => {
                                  const newZoom = Math.max(0.5, Math.min(5, Math.round(z * direction * 100) / 100));
                                  // Reset pan if zooming out to fit
                                  if (newZoom <= 1) setPanPosition({ x: 0, y: 0 });
                                  // Load high-res if zooming in past threshold
                                  if (newZoom > 1.5 && !highResLoaded && selectedAsset.url !== selectedAsset.preview) {
                                    setIsLoadingHighRes(true);
                                  }
                                  return newZoom;
                                });
                              }}
                              onMouseDown={(e) => {
                                if (zoomLevel > 1) {
                                  e.preventDefault();
                                  setIsDragging(true);
                                  setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
                                }
                              }}
                              onMouseMove={(e) => {
                                if (isDragging && zoomLevel > 1) {
                                  setPanPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
                                }
                              }}
                              onMouseUp={() => setIsDragging(false)}
                              onMouseLeave={() => setIsDragging(false)}
                              onTouchStart={(e) => {
                                if (e.touches.length === 2) {
                                  // Pinch zoom start
                                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                                  lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
                                } else if (e.touches.length === 1 && zoomLevel > 1) {
                                  // Pan start
                                  setIsDragging(true);
                                  setDragStart({ x: e.touches[0].clientX - panPosition.x, y: e.touches[0].clientY - panPosition.y });
                                }
                              }}
                              onTouchMove={(e) => {
                                if (e.touches.length === 2) {
                                  // Pinch zoom
                                  e.preventDefault();
                                  const dx = e.touches[0].clientX - e.touches[1].clientX;
                                  const dy = e.touches[0].clientY - e.touches[1].clientY;
                                  const dist = Math.sqrt(dx * dx + dy * dy);
                                  if (lastPinchDistance.current > 0) {
                                    const scale = dist / lastPinchDistance.current;
                                    setZoomLevel(z => {
                                      const newZoom = Math.max(0.5, Math.min(5, z * scale));
                                      if (newZoom > 1.5 && !highResLoaded && selectedAsset.url !== selectedAsset.preview) {
                                        setIsLoadingHighRes(true);
                                      }
                                      return newZoom;
                                    });
                                  }
                                  lastPinchDistance.current = dist;
                                } else if (e.touches.length === 1 && isDragging && zoomLevel > 1) {
                                  // Pan
                                  setPanPosition({ x: e.touches[0].clientX - dragStart.x, y: e.touches[0].clientY - dragStart.y });
                                }
                              }}
                              onTouchEnd={(e) => {
                                if (e.touches.length < 2) lastPinchDistance.current = 0;
                                if (e.touches.length === 0) setIsDragging(false);
                              }}
                              onDoubleClick={() => {
                                if (zoomLevel < 1.5) {
                                  setZoomLevel(2);
                                  if (!highResLoaded && selectedAsset.url !== selectedAsset.preview) {
                                    setIsLoadingHighRes(true);
                                  }
                                } else {
                                  setZoomLevel(1);
                                  setPanPosition({ x: 0, y: 0 });
                                }
                              }}
                            >
                              {imageLoading && (
                                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ animation: 'breathe 2s ease-in-out infinite' }}>
                                    <Logo variant="icon" size={32} animated={false} theme={theme} />
                                  </div>
                                  <span style={{ fontSize: '11px', color: t.textMuted }}>Loading preview...</span>
                                </div>
                              )}
                              {/* Image wrapper — transform applied once to wrapper, both layers stay aligned */}
                              <div style={{
                                position: 'relative',
                                display: 'inline-block',
                                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                                transformOrigin: 'center center',
                                transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                                maxWidth: zoomLevel <= 1 ? '100%' : 'none',
                                maxHeight: zoomLevel <= 1 ? '100%' : 'none',
                              }}>
                                {/* Low-res preview — always shown, sizes the wrapper */}
                                <img
                                  src={selectedAsset.preview || selectedAsset.thumbnail || selectedAsset.url}
                                  alt={selectedAsset.name}
                                  style={{
                                    display: 'block',
                                    maxWidth: zoomLevel <= 1 ? '100%' : 'none',
                                    maxHeight: zoomLevel <= 1 ? 'calc(100vh - 260px)' : 'none',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                    opacity: imageLoading ? 0 : 1,
                                    transition: 'opacity 0.2s',
                                    userSelect: 'none',
                                    pointerEvents: 'none'
                                  }}
                                  draggable={false}
                                  onLoad={() => setImageLoading(false)}
                                />
                                {/* High-res layer — same size, fades in on top, perfectly aligned */}
                                {(isLoadingHighRes || highResLoaded) && (
                                  <img
                                    src={selectedAsset.url}
                                    alt=""
                                    style={{
                                      position: 'absolute',
                                      top: 0, left: 0,
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'contain',
                                      borderRadius: '4px',
                                      opacity: highResLoaded ? 1 : 0,
                                      transition: 'opacity 0.3s ease-in',
                                      userSelect: 'none',
                                      pointerEvents: 'none'
                                    }}
                                    draggable={false}
                                    onLoad={() => {
                                      setIsLoadingHighRes(false);
                                      setHighResLoaded(true);
                                    }}
                                  />
                                )}
                                {/* Readonly annotation overlay — shows existing annotations in preview mode */}
                                {(selectedAsset.annotations || []).length > 0 && (
                                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                                    {(selectedAsset.annotations || []).map(a => {
                                      if (a.type === 'freehand' && a.path) {
                                        const pathD = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                                        return (
                                          <svg key={a.id} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                                            <path d={pathD} stroke={a.color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px' }} />
                                          </svg>
                                        );
                                      }
                                      if (a.type === 'text') {
                                        return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, color: '#fff', fontSize: '13px', fontWeight: '600', padding: '4px 10px', background: a.color, borderRadius: '4px', maxWidth: '200px', wordBreak: 'break-word', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', pointerEvents: 'none', opacity: 0.85 }}>{a.text}</div>;
                                      }
                                      if (a.type === 'circle') {
                                        return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '50%', background: `${a.color}15`, boxSizing: 'border-box', pointerEvents: 'none', opacity: 0.85 }} />;
                                      }
                                      if (a.type === 'arrow') {
                                        return (
                                          <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, pointerEvents: 'none', opacity: 0.85 }}>
                                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                                              <defs><marker id={`ro-arr-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
                                              <line x1="0" y1="50" x2="100" y2="50" stroke={a.color} strokeWidth="3" markerEnd={`url(#ro-arr-${a.id})`} vectorEffect="non-scaling-stroke" />
                                            </svg>
                                          </div>
                                        );
                                      }
                                      // Rectangle (default)
                                      return <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2.5px solid ${a.color}`, borderRadius: '3px', background: `${a.color}15`, boxSizing: 'border-box', pointerEvents: 'none', opacity: 0.85 }} />;
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Zoom hint for desktop */}
                            {!isMobile && zoomLevel === 1 && !imageLoading && (
                              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '6px 12px', fontSize: '10px', color: t.textMuted, pointerEvents: 'none', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                                Scroll to zoom • Double-click to zoom • Drag to pan
                              </div>
                            )}

                            {/* Mobile hint */}
                            {isMobile && zoomLevel === 1 && !imageLoading && (
                              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '6px 12px', fontSize: '10px', color: t.textMuted, pointerEvents: 'none', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
                                Pinch to zoom • Double-tap to zoom
                              </div>
                            )}
                          </div>
                        )
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '60px' }}>DOC</div>
                      )}
                    </div>
                    
                    {/* Feedback moved to right sidebar */}
                  </div>
                  
                  {/* RIGHT: Details Sidebar — Clean Collapsible Panels */}
                  {!isMobile && !isFullscreen && (
                    <div style={{ width: isTablet ? '260px' : '300px', background: t.bgSecondary, borderLeft: `1px solid ${t.borderLight}`, overflow: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
                      {/* Sidebar Header */}
                      <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0, background: t.bgCard }}>
                        {/* Asset name + type */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: `linear-gradient(135deg, ${t.primary}20, ${t.primary}10)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>
                            {selectedAsset.type === 'image' ? '🖼' : selectedAsset.type === 'video' ? '🎬' : selectedAsset.type === 'audio' ? '🎵' : '📄'}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>{selectedAsset.name}</div>
                            <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px' }}>v{selectedAsset.currentVersion} • {selectedAsset.mimeType?.split('/')[1]?.toUpperCase() || selectedAsset.type?.toUpperCase()}</div>
                          </div>
                          {/* Three-dot actions menu */}
                          <div style={{ position: 'relative' }}>
                            <button onClick={() => setSidebarActionsOpen(!sidebarActionsOpen)} style={{ width: '28px', height: '28px', background: 'transparent', border: `1px solid ${t.borderLight}`, borderRadius: '8px', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⋯</button>
                            {sidebarActionsOpen && (<>
                              <div onClick={() => setSidebarActionsOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} />
                              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: `${t.bgCard}F0`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.border}`, borderRadius: '10px', padding: '4px', minWidth: '160px', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                                <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', textDecoration: 'none', color: t.text, fontSize: '11px' }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{Icons.download(t.textSecondary)} Download Preview</a>
                                {selectedAsset.gdriveLink && <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', textDecoration: 'none', color: t.text, fontSize: '11px' }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>🔗 Open High-Res</a>}
                                <div onClick={() => { navigator.clipboard.writeText(window.location.href); showToast('Link copied!', 'success'); setSidebarActionsOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: t.text, fontSize: '11px' }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>📋 Copy Share Link</div>
                                {isProducer && <>
                                  <div style={{ height: '1px', background: t.borderLight, margin: '4px 0' }} />
                                  <div onClick={async () => { setSidebarActionsOpen(false); if (!confirm(`Delete "${selectedAsset.name}"?`)) return; const deletedAt = new Date().toISOString(); const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, deleted: true, deletedAt } : a); const activity = { id: generateId(), type: 'delete', message: `${userProfile.name} deleted ${selectedAsset.name}`, timestamp: new Date().toISOString() }; await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] }); setSelectedAsset(null); await refreshProject(); showToast('Deleted', 'success'); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: '#ef4444', fontSize: '11px' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{Icons.trash('#ef4444')} Delete Asset</div>
                                </>}
                              </div>
                            </>)}
                          </div>
                        </div>
                        {/* Status pill + round indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {(() => { const sc = { pending: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }, selected: { bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }, assigned: { bg: 'rgba(99,102,241,0.15)', color: '#6366f1' }, 'in-progress': { bg: 'rgba(168,85,247,0.15)', color: '#a855f7' }, 'review-ready': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }, 'changes-requested': { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' }, approved: { bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }, delivered: { bg: 'rgba(6,182,212,0.15)', color: '#06b6d4' } }; const s = sc[selectedAsset.status] || sc.pending; return <span style={{ padding: '4px 10px', background: s.bg, color: s.color, borderRadius: '20px', fontSize: '10px', fontWeight: '600' }}>{STATUS[selectedAsset.status]?.label || 'Pending'}</span>; })()}
                          {(() => {
                            const round = selectedAsset.revisionRound || 1;
                            const maxR = selectedProject.maxRevisions || 3;
                            const atLimit = round >= maxR;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {Array.from({ length: maxR }).map((_, i) => (
                                  <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: i < round ? (atLimit ? '#ef4444' : '#8b5cf6') : `${t.textMuted}40`, transition: 'background 0.2s' }} />
                                ))}
                                <span style={{ fontSize: '9px', color: atLimit ? '#ef4444' : t.textMuted, marginLeft: '2px', fontWeight: atLimit ? '700' : '400' }}>R{round}/{maxR}</span>
                              </div>
                            );
                          })()}
                          <div style={{ flex: 1 }} />
                          <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected, status: !selectedAsset.isSelected ? 'selected' : 'pending' }); }} style={{ padding: '4px 12px', background: selectedAsset.isSelected ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'transparent', border: selectedAsset.isSelected ? 'none' : `1px solid ${t.border}`, borderRadius: '20px', color: selectedAsset.isSelected ? '#fff' : t.textMuted, fontSize: '10px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>{selectedAsset.isSelected ? '✓ Selected' : '☆ Select'}</button>
                        </div>
                      </div>

                      {/* Collapsible Sections Container */}
                      <div style={{ padding: '8px 10px 20px', flex: 1, overflow: 'auto' }}>

                        {/* Section 1: Assignment */}
                        <div style={{ marginBottom: '8px', background: t.bgCard, border: `1px solid ${t.borderLight}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <button onClick={() => setSidebarSection(s => ({ ...s, assignment: !s.assignment }))} style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.text, fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                              Assignment
                              {selectedAsset.assignedTo && <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', background: `${t.primary}15`, color: t.primary, textTransform: 'none' }}>{editors.find(e => e.id === selectedAsset.assignedTo)?.name?.split(' ')[0] || 'Assigned'}</span>}
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: sidebarSection.assignment ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6,9 12,15 18,9"/></svg>
                          </button>
                          {sidebarSection.assignment && (
                            <div style={{ padding: '0 14px 14px 14px' }}>
                              {/* Pipeline Stage Indicator */}
                              {(selectedProject.handoffChains || []).length > 0 && selectedAsset.pipelineStage !== undefined && (() => {
                                const chain = (selectedProject.handoffChains || []).find(c => c.scope === 'all' || c.scopeId === selectedAsset.category);
                                if (!chain) return null;
                                const sortedStages = [...(chain.stages || [])].sort((a, b) => a.order - b.order);
                                return (
                                  <div style={{ marginBottom: '10px', padding: '8px', background: t.bgInput, borderRadius: '8px' }}>
                                    <label style={{ display: 'block', fontSize: '9px', color: t.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Pipeline</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      {sortedStages.map((stage, i) => (
                                        <div key={stage.teamGroupId} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '9px', fontWeight: '600', background: i === (selectedAsset.pipelineStage || 0) ? `${t.primary}30` : i < (selectedAsset.pipelineStage || 0) ? 'rgba(34,197,94,0.2)' : t.bgHover, color: i === (selectedAsset.pipelineStage || 0) ? t.primary : i < (selectedAsset.pipelineStage || 0) ? '#22c55e' : t.textMuted }}>{stage.teamGroupName}</span>
                                          {i < sortedStages.length - 1 && <span style={{ color: t.textMuted, fontSize: '10px' }}>→</span>}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              {/* Turnaround Timer */}
                              {selectedAsset.turnaroundDeadline && (() => {
                                const deadline = new Date(selectedAsset.turnaroundDeadline);
                                const now = new Date();
                                const hoursLeft = Math.max(0, (deadline - now) / (1000 * 60 * 60));
                                const isOverdue = hoursLeft <= 0;
                                const isUrgent = hoursLeft < 2;
                                const isWarning = hoursLeft < 12;
                                const color = isOverdue ? '#ef4444' : isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#22c55e';
                                const label = isOverdue ? 'Overdue!' : hoursLeft < 1 ? `${Math.round(hoursLeft * 60)}m left` : `${Math.round(hoursLeft)}h left`;
                                return (
                                  <div style={{ marginBottom: '10px', padding: '8px 10px', background: `${color}10`, border: `1px solid ${color}30`, borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: isUrgent ? 'pulse 1.5s ease-in-out infinite' : 'none' }}>
                                    <div>
                                      <div style={{ fontSize: '9px', color: t.textMuted, textTransform: 'uppercase' }}>Turnaround</div>
                                      <div style={{ fontSize: '12px', fontWeight: '700', color }}>{label}</div>
                                    </div>
                                    {!isProducer && (
                                      <button onClick={async () => {
                                        const reason = prompt('Reason for extension request:');
                                        if (!reason) return;
                                        const activity = { id: generateId(), type: 'extension-request', message: `${userProfile.name} requested a turnaround extension for ${selectedAsset.name}: "${reason}"`, timestamp: new Date().toISOString() };
                                        await updateProject(selectedProject.id, { activityLog: [...(selectedProject.activityLog || []), activity] });
                                        showToast('Extension requested', 'success');
                                      }} style={{ padding: '4px 8px', background: `${color}20`, border: `1px solid ${color}40`, borderRadius: '6px', color, fontSize: '9px', cursor: 'pointer', fontWeight: '600' }}>Request Extension</button>
                                    )}
                                  </div>
                                );
                              })()}
                              {isProducer && (
                                <>
                                  <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Status</label>
                                    <Select theme={theme} value={selectedAsset.status} onChange={v => handleUpdateStatus(selectedAsset.id, v)} style={{ fontSize: '11px' }}>
                                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                                    </Select>
                                  </div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Assign To</label>
                                    <Select theme={theme} value={selectedAsset.assignedTo || ''} onChange={v => handleAssign(selectedAsset.id, v)} style={{ fontSize: '11px' }}>
                                      <option value="">-- Unassigned --</option>
                                      {(selectedProject.teamGroups || []).length > 0 && (selectedProject.teamGroups || []).map(g => (
                                        <optgroup key={g.id} label={`${g.name}`}>
                                          {(g.members || []).map(m => <option key={m.id} value={m.id}>{m.name} {g.leadId === m.id ? '(Lead)' : ''}</option>)}
                                        </optgroup>
                                      ))}
                                      <optgroup label="All Team">
                                        {editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                      </optgroup>
                                    </Select>
                                    {selectedAsset.assignedTeamGroupName && <div style={{ marginTop: '4px', fontSize: '9px', color: t.primary }}>Team: {selectedAsset.assignedTeamGroupName}</div>}
                                  </div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Due Date</label>
                                    <input type="date" value={selectedAsset.dueDate?.split('T')[0] || ''} onChange={async (e) => { const dueDate = e.target.value ? new Date(e.target.value).toISOString() : null; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, dueDate } : a); setSelectedAsset({ ...selectedAsset, dueDate }); await updateProject(selectedProject.id, { assets: updated }); if (selectedAsset.assignedTo && dueDate) { const assignee = editors.find(e => e.id === selectedAsset.assignedTo); if (assignee?.email) sendEmailNotification(assignee.email, `Due date set: ${selectedAsset.name}`, `Due: ${formatDate(dueDate)}`); } }} style={{ width: '100%', padding: '8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '11px', boxSizing: 'border-box' }} />
                                    {selectedAsset.dueDate && <div style={{ marginTop: '4px', fontSize: '10px', color: new Date(selectedAsset.dueDate) < new Date() ? '#ef4444' : '#22c55e', fontWeight: '600' }}>{new Date(selectedAsset.dueDate) < new Date() ? 'Overdue!' : `In ${Math.ceil((new Date(selectedAsset.dueDate) - new Date()) / (1000 * 60 * 60 * 24))} days`}</div>}
                                  </div>
                                </>
                              )}
                              {/* Agency Review Actions */}
                              {selectedAsset.status === 'agency-review' && (isAgency || isProducer) && (
                                <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#0ea5e9', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>
                                    Agency Review
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px' }}>
                                    <button onClick={async () => {
                                      await handleUpdateStatus(selectedAsset.id, 'approved');
                                      const activity = { id: generateId(), type: 'agency-approved', message: `${userProfile.name} (Agency) approved ${selectedAsset.name}`, timestamp: new Date().toISOString() };
                                      await updateProject(selectedProject.id, { activityLog: [...(selectedProject.activityLog || []), activity] });
                                      showToast('Asset approved by agency', 'success');
                                    }} style={{ flex: 1, padding: '7px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Approve</button>
                                    <button onClick={async () => {
                                      await handleUpdateStatus(selectedAsset.id, 'changes-requested');
                                      const activity = { id: generateId(), type: 'agency-changes', message: `${userProfile.name} (Agency) requested changes on ${selectedAsset.name}`, timestamp: new Date().toISOString() };
                                      await updateProject(selectedProject.id, { activityLog: [...(selectedProject.activityLog || []), activity] });
                                      showToast('Changes requested', 'info');
                                    }} style={{ flex: 1, padding: '7px', background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '8px', color: '#ef4444', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>Request Changes</button>
                                  </div>
                                </div>
                              )}

                              {/* Tags */}
                              <div>
                                <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Tags</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                  {PREDEFINED_TAGS.map(tag => {
                                    const isActive = (selectedAsset.tags || []).includes(tag.id);
                                    return (
                                      <button key={tag.id} onClick={async () => { const newTags = isActive ? (selectedAsset.tags || []).filter(t => t !== tag.id) : [...(selectedAsset.tags || []), tag.id]; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, tags: newTags } : a); setSelectedAsset({ ...selectedAsset, tags: newTags }); await updateProject(selectedProject.id, { assets: updated }); }} style={{ padding: '3px 8px', background: isActive ? `${tag.color}30` : t.bgInput, border: `1px solid ${isActive ? tag.color : t.border}`, borderRadius: '10px', color: isActive ? tag.color : t.textMuted, fontSize: '9px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.15s' }}>{tag.label}</button>
                                    );
                                  })}
                                </div>
                              </div>
                              {/* Round Controls (Producer Only) */}
                              {isProducer && (selectedAsset.revisionRound || 1) > 0 && (
                                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${t.borderLight}` }}>
                                  <label style={{ display: 'block', fontSize: '9px', color: t.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Round Controls</label>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    <button onClick={async () => {
                                      const maxR = selectedProject.maxRevisions || 3;
                                      const currentR = selectedAsset.revisionRound || 1;
                                      if (currentR < maxR) { showToast('Not at limit yet', 'info'); return; }
                                      const newMax = maxR + 1;
                                      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? a : a);
                                      await updateProject(selectedProject.id, { maxRevisions: newMax, activityLog: [...(selectedProject.activityLog || []), { id: generateId(), type: 'round', message: `${userProfile.name} granted extra revision round (now ${newMax} max)`, timestamp: new Date().toISOString() }] });
                                      await refreshProject();
                                      showToast(`Max rounds increased to ${newMax}`, 'success');
                                    }} style={{ padding: '4px 8px', background: `${t.primary}15`, border: `1px solid ${t.primary}30`, borderRadius: '6px', color: t.primary, fontSize: '9px', cursor: 'pointer' }}>+ Extra Round</button>
                                    <button onClick={async () => {
                                      if (!confirm('Force close this round? All unresolved feedback will be marked done.')) return;
                                      const updatedFeedback = (selectedAsset.feedback || []).map(f => f.isDone ? f : { ...f, isDone: true, forceClosed: true });
                                      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: updatedFeedback, turnaroundDeadline: null } : a);
                                      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), { id: generateId(), type: 'round', message: `${userProfile.name} force-closed round for ${selectedAsset.name}`, timestamp: new Date().toISOString() }] });
                                      setSelectedAsset({ ...selectedAsset, feedback: updatedFeedback, turnaroundDeadline: null });
                                      await refreshProject();
                                      showToast('Round force-closed', 'success');
                                    }} style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '9px', cursor: 'pointer' }}>Force Close Round</button>
                                    {selectedAsset.turnaroundDeadline && (
                                      <button onClick={async () => {
                                        const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, turnaroundDeadline: null } : a);
                                        await updateProject(selectedProject.id, { assets: updated });
                                        setSelectedAsset({ ...selectedAsset, turnaroundDeadline: null });
                                        showToast('Timer cleared', 'success');
                                      }} style={{ padding: '4px 8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px', color: '#f59e0b', fontSize: '9px', cursor: 'pointer' }}>Clear Timer</button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Section 2: Versions */}
                        <div style={{ marginBottom: '8px', background: t.bgCard, border: `1px solid ${t.borderLight}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <button onClick={() => setSidebarSection(s => ({ ...s, versions: !s.versions }))} style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.text, fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                              Versions
                              <span style={{ padding: '2px 8px', background: selectedAsset.currentVersion > 1 && isNewVersion(getLatestVersionDate(selectedAsset)) ? 'rgba(249,115,22,0.15)' : t.bgHover, color: selectedAsset.currentVersion > 1 && isNewVersion(getLatestVersionDate(selectedAsset)) ? '#f97316' : t.textSecondary, borderRadius: '10px', fontSize: '9px', fontWeight: '700', textTransform: 'none' }}>v{selectedAsset.currentVersion}</span>
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: sidebarSection.versions ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6,9 12,15 18,9"/></svg>
                          </button>
                          {sidebarSection.versions && (
                            <div style={{ padding: '0 14px 14px 14px' }}>
                              {/* Version stack */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
                                {(selectedAsset.versions || []).map((v, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: v.version === selectedAsset.currentVersion ? 'rgba(99,102,241,0.12)' : 'transparent', borderRadius: '8px', border: v.version === selectedAsset.currentVersion ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent', transition: 'background 0.15s' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '6px', overflow: 'hidden', background: t.bgHover, flexShrink: 0 }}>
                                      {v.thumbnail ? <img src={v.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: t.textMuted, fontWeight: '600' }}>v{v.version}</div>}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '11px', fontWeight: '600', color: v.version === selectedAsset.currentVersion ? '#6366f1' : t.textSecondary }}>Version {v.version}</div>
                                      {v.uploadedAt && <div style={{ fontSize: '10px', color: t.textMuted }}>{formatTimeAgo(v.uploadedAt)}</div>}
                                    </div>
                                    {v.version === selectedAsset.currentVersion ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} /> : (selectedAsset.versions || []).length > 1 && (
                                      <button onClick={(e) => { e.stopPropagation(); setAssetTab('compare'); }} title={`Compare v${v.version} with current`} style={{ width: '22px', height: '22px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '5px', color: t.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = t.primary; e.currentTarget.style.color = t.primary; }} onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {/* Compare button */}
                              {(selectedAsset.versions || []).length > 1 && (
                                <button onClick={() => setAssetTab('compare')} style={{ width: '100%', padding: '7px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '10px', cursor: 'pointer', marginBottom: '8px', transition: 'border-color 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onMouseEnter={e => e.currentTarget.style.borderColor = t.primary} onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
                                  Compare Versions
                                </button>
                              )}
                              {/* Upload new version */}
                              {(() => {
                                const allowedRoles = selectedProject.versionUploadRoles || ['producer', 'editor'];
                                const roleMap = { 'producer': ['producer', 'admin', 'team-lead'], 'editor': ['editor', 'photo-editor', 'video-editor'], 'colorist': ['colorist', 'color-grader'], 'vfx': ['vfx', 'vfx-artist', 'motion-graphics'], 'retoucher': ['retoucher'], 'sound': ['sound', 'sound-designer', 'audio-engineer'] };
                                const userRoles = Object.entries(roleMap).filter(([, mapped]) => mapped.includes(userProfile?.role)).map(([key]) => key);
                                const canUploadVersion = isProducer || userRoles.some(r => allowedRoles.includes(r));
                                return canUploadVersion ? (
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <input ref={versionInputRef} type="file" style={{ display: 'none' }} onChange={e => setVersionFile(e.target.files?.[0] || null)} />
                                    <button onClick={() => versionInputRef.current?.click()} style={{ flex: 1, padding: '8px', background: t.bgInput, border: `1px dashed ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '10px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{versionFile ? versionFile.name.substring(0, 15) + '...' : '+ Upload New Version'}</button>
                                    {versionFile && <button onClick={handleUploadVersion} disabled={uploadingVersion} style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>{uploadingVersion ? '...' : 'Upload'}</button>}
                                  </div>
                                ) : null;
                              })()}
                              {/* GDrive Link */}
                              {selectedAsset.status === 'approved' && isProducer && (
                                <div style={{ marginTop: '8px' }}>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <Input theme={theme} value={selectedAsset.gdriveLink || ''} onChange={v => setSelectedAsset({ ...selectedAsset, gdriveLink: v })} placeholder="Paste GDrive link..." style={{ flex: 1, padding: '6px 8px', fontSize: '10px' }} />
                                    <button onClick={() => handleSetGdriveLink(selectedAsset.id, selectedAsset.gdriveLink)} style={{ padding: '6px 10px', background: t.success, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>✓</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Section 3: Feedback */}
                        <div style={{ marginBottom: '8px', background: t.bgCard, border: `1px solid ${t.borderLight}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <button onClick={() => setSidebarSection(s => ({ ...s, feedback: !s.feedback }))} style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.text, fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                              Feedback
                              {(selectedAsset.feedback || []).filter(f => !f.isDone).length > 0 && (
                                <span style={{ fontSize: '9px', padding: '2px 8px', borderRadius: '10px', fontWeight: '600', background: 'rgba(239,68,68,0.12)', color: '#ef4444', textTransform: 'none' }}>{(selectedAsset.feedback || []).filter(f => !f.isDone).length} open</span>
                              )}
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: sidebarSection.feedback ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6,9 12,15 18,9"/></svg>
                          </button>
                          {sidebarSection.feedback && (
                            <div style={{ padding: '0 14px 14px 14px' }}>
                              <div style={{ maxHeight: '220px', overflow: 'auto', marginBottom: '8px' }}>
                                {(selectedAsset.feedback || []).length === 0 ? (
                                  <div style={{ fontSize: '11px', color: t.textMuted, textAlign: 'center', padding: '12px 0' }}>No feedback yet
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                                      {['Approved', 'Needs revision', 'Love this', 'Change color', 'Crop differently'].map(q => (
                                        <button key={q} onClick={() => setNewFeedback(q)} style={{ padding: '4px 8px', background: `${t.primary}15`, border: `1px solid ${t.primary}30`, borderRadius: '10px', color: t.textMuted, fontSize: '9px', cursor: 'pointer' }}>{q}</button>
                                      ))}
                                    </div>
                                  </div>
                                ) : (selectedAsset.feedback || []).map(fb => (
                                  <div key={fb.id} id={`feedback-${fb.id}`} style={{ display: 'flex', gap: '8px', marginBottom: '8px', opacity: fb.isDone ? 0.6 : 1, transition: 'all 0.3s', ...(highlightedFeedbackId === fb.id ? { background: `${t.primary}20`, borderRadius: '10px', padding: '6px', margin: '-6px -6px 2px -6px', boxShadow: `0 0 0 2px ${t.primary}40` } : {}) }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: fb.isDone ? 'rgba(34,197,94,0.3)' : `${t.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', flexShrink: 0, color: t.text, marginTop: '2px' }}>{fb.userName?.[0] || '?'}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ padding: '8px 10px', background: fb.isDone ? 'rgba(34,197,94,0.08)' : t.bgInput, borderRadius: '4px 12px 12px 12px', border: `1px solid ${fb.isDone ? 'rgba(34,197,94,0.2)' : highlightedFeedbackId === fb.id ? t.primary : t.borderLight}` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: '10px', fontWeight: '600', color: t.text }}>{fb.userName}</span>
                                            <span style={{ fontSize: '10px', color: t.textMuted }}>{formatTimeAgo(fb.timestamp)}</span>
                                            {fb.videoTimestamp !== null && fb.videoTimestamp !== undefined && (
                                              <span onClick={() => { if (videoRef.current) { videoRef.current.currentTime = fb.videoTimestamp; videoRef.current.pause(); setVideoPlaying(false); } setHighlightedFeedbackId(fb.id); setTimeout(() => setHighlightedFeedbackId(null), 3000); }} style={{ fontSize: '9px', color: t.primary, cursor: 'pointer', background: `${t.primary}20`, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>@ {formatTimecode(fb.videoTimestamp)}</span>
                                            )}
                                          </div>
                                          <button onClick={(e) => handleToggleFeedbackDone(fb.id, e)} style={{ background: fb.isDone ? 'rgba(34,197,94,0.3)' : t.bgInput, border: `1px solid ${fb.isDone ? 'rgba(34,197,94,0.4)' : t.borderLight}`, borderRadius: '8px', padding: '2px 8px', fontSize: '9px', color: fb.isDone ? '#22c55e' : t.textMuted, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>{fb.isDone ? '✓ Done' : 'Done?'}</button>
                                        </div>
                                        <div style={{ fontSize: '11px', color: t.textSecondary, lineHeight: '1.4' }}>{fb.text}</div>
                                        {/* Reply button + count */}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                                          <button onClick={() => { setReplyingTo(replyingTo === fb.id ? null : fb.id); setReplyText(''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: '10px', color: t.primary, cursor: 'pointer', fontWeight: '500' }}>Reply</button>
                                          {(fb.replies || []).length > 0 && <span style={{ fontSize: '10px', color: t.textMuted }}>{(fb.replies || []).length} {(fb.replies || []).length === 1 ? 'reply' : 'replies'}</span>}
                                        </div>
                                      </div>
                                      {/* Threaded replies */}
                                      {(fb.replies || []).length > 0 && (
                                        <div style={{ marginTop: '4px', marginLeft: '8px', borderLeft: `2px solid ${t.borderLight}`, paddingLeft: '8px' }}>
                                          {(fb.replies || []).map(r => (
                                            <div key={r.id} style={{ marginBottom: '4px', padding: '5px 8px', background: t.bgHover, borderRadius: '4px 8px 8px 8px', fontSize: '10px' }}>
                                              <span style={{ fontWeight: '600', color: t.text }}>{r.userName}</span>
                                              <span style={{ color: t.textMuted, marginLeft: '6px' }}>{formatTimeAgo(r.timestamp)}</span>
                                              <div style={{ color: t.textSecondary, marginTop: '2px', lineHeight: '1.3' }}>{r.text}</div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {/* Reply input */}
                                      {replyingTo === fb.id && (
                                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                          <input value={replyText} onChange={e => setReplyText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddReply(fb.id); if (e.key === 'Escape') { setReplyingTo(null); setReplyText(''); } }} placeholder="Reply..." autoFocus style={{ flex: 1, padding: '5px 8px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '8px', color: t.text, fontSize: '10px' }} />
                                          <button onClick={() => handleAddReply(fb.id)} disabled={!replyText.trim()} style={{ padding: '5px 8px', background: replyText.trim() ? t.primary : t.bgInput, border: 'none', borderRadius: '8px', color: replyText.trim() ? '#fff' : t.textMuted, fontSize: '9px', cursor: replyText.trim() ? 'pointer' : 'default' }}>Send</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {/* Feedback input */}
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                                {selectedAsset.type === 'video' && <span style={{ fontSize: '9px', color: t.primary, background: `${t.primary}20`, padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', flexShrink: 0 }}>{Math.floor(videoTime / 60)}:{String(Math.floor(videoTime % 60)).padStart(2, '0')}</span>}
                                <div style={{ flex: 1, position: 'relative' }}>
                                  <input ref={feedbackInputRef} value={newFeedback} onChange={(e) => { const val = e.target.value; setNewFeedback(val); const lastAt = val.lastIndexOf('@'); if (lastAt !== -1 && lastAt === val.length - 1) { setShowMentions(true); setMentionSearch(''); } else if (lastAt !== -1 && !val.substring(lastAt + 1).includes(' ')) { setShowMentions(true); setMentionSearch(val.substring(lastAt + 1).toLowerCase()); } else { setShowMentions(false); } }} onKeyDown={(e) => { if (e.key === 'Enter' && !showMentions) handleAddFeedback(); if (e.key === 'Escape') setShowMentions(false); }} placeholder="Add feedback... (@mention)" style={{ width: '100%', padding: '8px 10px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '10px', color: t.text, fontSize: '11px', boxSizing: 'border-box', transition: 'border-color 0.15s' }} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.borderLight} />
                                  {showMentions && (() => {
                                    const allMentionable = [...new Map([...team, ...freelancers, ...coreTeam].map(m => [m.id, m])).values()];
                                    const filtered = allMentionable.filter(m => m.name?.toLowerCase().includes(mentionSearch)).slice(0, 5);
                                    return (
                                      <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: `${t.bgCard}F0`, backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: `1px solid ${t.border}`, borderRadius: '10px', marginBottom: '4px', maxHeight: '150px', overflow: 'auto', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
                                        {filtered.map(member => (
                                          <div key={member.id} onClick={() => { const lastAt = newFeedback.lastIndexOf('@'); setNewFeedback(newFeedback.substring(0, lastAt) + `@${member.name} `); setShowMentions(false); feedbackInputRef.current?.focus(); }} style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = t.bgHover} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: `${t.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', color: t.primary }}>{member.name?.[0]}</div>
                                            <span style={{ color: t.text }}>{member.name}</span>
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <button onClick={handleAddFeedback} disabled={!newFeedback.trim()} style={{ padding: '8px 12px', background: newFeedback.trim() ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : t.bgInput, border: 'none', borderRadius: '10px', color: newFeedback.trim() ? '#fff' : t.textMuted, fontSize: '10px', fontWeight: '600', cursor: newFeedback.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>Send</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Section 4: File Details (collapsed by default) */}
                        <div style={{ marginBottom: '8px', background: t.bgCard, border: `1px solid ${t.borderLight}`, borderRadius: '12px', overflow: 'hidden' }}>
                          <button onClick={() => setSidebarSection(s => ({ ...s, details: !s.details }))} style={{ width: '100%', padding: '10px 12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: t.text, fontSize: '11px', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                              File Details
                            </div>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: sidebarSection.details ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6,9 12,15 18,9"/></svg>
                          </button>
                          {sidebarSection.details && (
                            <div style={{ padding: '0 14px 14px 14px', fontSize: '11px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: t.textMuted }}>Size</span><span style={{ color: t.textSecondary }}>{formatFileSize(selectedAsset.fileSize)}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: t.textMuted }}>Type</span><span style={{ color: t.textSecondary }}>{selectedAsset.mimeType?.split('/')[1] || selectedAsset.type}</span></div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><span style={{ color: t.textMuted }}>Uploaded</span><span style={{ color: t.textSecondary }}>{formatDate(selectedAsset.uploadedAt)}</span></div>
                              {/* Deliverables Checklist */}
                              {((selectedProject.requiredFormats?.length > 0) || (selectedProject.requiredSizes?.length > 0)) && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${t.borderLight}` }}>
                                  <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '6px', color: t.text }}>Required Deliverables</div>
                                  {selectedProject.requiredFormats?.length > 0 && (
                                    <div style={{ marginBottom: '6px' }}>
                                      <div style={{ fontSize: '9px', color: t.textMuted, marginBottom: '4px' }}>Formats:</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {selectedProject.requiredFormats.map(fmtId => {
                                          const fmt = [...FILE_FORMATS.photo, ...FILE_FORMATS.video].find(f => f.id === fmtId);
                                          const isUploaded = (selectedAsset.uploadedFormats || []).includes(fmtId);
                                          return fmt ? <span key={fmtId} style={{ padding: '2px 6px', background: isUploaded ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isUploaded ? '#22c55e' : '#ef4444'}`, borderRadius: '4px', fontSize: '9px', color: isUploaded ? '#22c55e' : '#ef4444' }}>{isUploaded ? '✓' : '○'} {fmt.label.split(' ')[0]}</span> : null;
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {selectedProject.requiredSizes?.length > 0 && (
                                    <div>
                                      <div style={{ fontSize: '9px', color: t.textMuted, marginBottom: '4px' }}>Sizes:</div>
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                        {selectedProject.requiredSizes.map(sizeId => {
                                          const size = [...SIZE_PRESETS.photo, ...SIZE_PRESETS.video].find(s => s.id === sizeId);
                                          const isUploaded = (selectedAsset.uploadedSizes || []).includes(sizeId);
                                          return size ? <span key={sizeId} style={{ padding: '2px 6px', background: isUploaded ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isUploaded ? '#22c55e' : '#ef4444'}`, borderRadius: '4px', fontSize: '9px', color: isUploaded ? '#22c55e' : '#ef4444' }}>{isUploaded ? '✓' : '○'} {size.label.split(' ')[0]}</span> : null;
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {selectedProject.maxRevisions > 0 && (
                                    <div style={{ marginTop: '6px', fontSize: '10px', color: (selectedAsset.revisionRound || 0) >= selectedProject.maxRevisions ? '#ef4444' : t.textMuted }}>
                                      Revisions: {selectedAsset.revisionRound || 0} / {selectedProject.maxRevisions}
                                      {(selectedAsset.revisionRound || 0) >= selectedProject.maxRevisions && ' — Limit reached'}
                                    </div>
                                  )}
                                </div>
                              )}
                              {/* High-Res Downloads */}
                              {selectedAsset.status === 'approved' && selectedAsset.highResFiles?.length > 0 && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${t.borderLight}` }}>
                                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#22c55e', marginBottom: '6px' }}>High-Res Downloads</div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {selectedAsset.highResFiles.map((file, idx) => (
                                      <a key={idx} href={file.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: t.bgInput, borderRadius: '6px', textDecoration: 'none', color: t.text, fontSize: '10px', transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = t.bgInput}>
                                        <span>{file.formatLabel || file.format}</span>
                                        <span style={{ color: '#22c55e', fontSize: '12px' }}>↓</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Editor High-Res Upload */}
                              {selectedAsset.status === 'approved' && !isProducer && userProfile?.role !== 'client' && (selectedProject.requiredFormats || []).length > 0 && (
                                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${t.borderLight}` }}>
                                  <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '6px' }}>Upload High-Res</div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {selectedProject.requiredFormats.map(fmtId => {
                                      const fmt = [...FILE_FORMATS.photo, ...FILE_FORMATS.video].find(f => f.id === fmtId);
                                      const isUploaded = selectedAsset.highResFiles?.some(f => f.format === fmtId);
                                      return fmt ? (
                                        <label key={fmtId} style={{ padding: '4px 8px', background: isUploaded ? 'rgba(34,197,94,0.2)' : t.bgInput, border: `1px solid ${isUploaded ? '#22c55e' : t.border}`, borderRadius: '6px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                                            const file = e.target.files?.[0]; if (!file) return;
                                            try { showToast('Uploading...', 'info'); const path = `projects/${selectedProject.id}/highres/${selectedAsset.id}/${fmtId}-${file.name}`; const sRef = ref(storage, path); await uploadBytesResumable(sRef, file); const url = await getDownloadURL(sRef); const highResFile = { format: fmtId, formatLabel: fmt.label, url, fileName: file.name, uploadedAt: new Date().toISOString() }; const existingFiles = (selectedAsset.highResFiles || []).filter(f => f.format !== fmtId); const updatedAsset = { ...selectedAsset, highResFiles: [...existingFiles, highResFile] }; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? updatedAsset : a); await updateProject(selectedProject.id, { assets: updated }); setSelectedAsset(updatedAsset); await refreshProject(); showToast(`${fmt.label} uploaded!`, 'success'); const allUploaded = selectedProject.requiredFormats.every(f => [...existingFiles, highResFile].some(h => h.format === f)); if (allUploaded) { team.filter(m => ['client', 'producer'].includes(m.role)).forEach(c => { if (c.email) sendEmailNotification(c.email, `High-res files ready: ${selectedAsset.name}`, `All required formats uploaded.`); }); } } catch (err) { showToast('Upload failed', 'error'); }
                                          }} />
                                          {isUploaded ? '✓' : '+'} {fmt.label.split(' ')[0]}
                                        </label>
                                      ) : null;
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Compare Tab */}
              {assetTab === 'compare' && (
                <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
                  <VersionComparison versions={selectedAsset.versions || []} currentVersion={selectedAsset.currentVersion} assetType={selectedAsset.type} />
                </div>
              )}

              {/* Activity Tab */}
              {assetTab === 'activity' && (
                <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
                  <ActivityFeed asset={selectedAsset} project={selectedProject} />
                </div>
              )}
            </div>
            
            {/* Bottom Thumbnail Strip */}
            {sortedAssets.length > 1 && !isFullscreen && (
              <div style={{ padding: '10px 16px', background: t.bgSecondary, overflowX: 'auto', flexShrink: 0, borderTop: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {sortedAssets.map((asset) => (
                    <div key={asset.id} onClick={() => setSelectedAsset(asset)} style={{ width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden', border: asset.id === selectedAsset.id ? `2px solid ${t.primary}` : `1px solid ${t.border}`, boxShadow: asset.id === selectedAsset.id ? `0 0 0 2px ${t.primary}40` : 'none', cursor: 'pointer', flexShrink: 0, opacity: asset.id === selectedAsset.id ? 1 : 0.6, position: 'relative', transition: 'opacity 0.2s, box-shadow 0.2s' }}>
                      {asset.type === 'image' ? <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : asset.type === 'video' ? <div style={{ width: '100%', height: '100%', background: t.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{asset.thumbnail ? <img src={asset.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>VID</span>}</div> : <div style={{ width: '100%', height: '100%', background: t.bgCard, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{asset.type === 'audio' ? '' : 'DOC'}</div>}
                      {asset.rating > 0 && <div style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', borderRadius: '3px', padding: '1px 3px', fontSize: '8px' }}>{'★'.repeat(asset.rating)}</div>}
                      {asset.isSelected && <div style={{ position: 'absolute', top: '2px', right: '2px', background: '#22c55e', borderRadius: '3px', padding: '1px 3px', fontSize: '8px', color: '#fff' }}>{'\u2713'}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Mobile Bottom Actions */}
            {isMobile && !isFullscreen && (
              <div style={{ padding: '10px 16px', background: t.bgTertiary, borderTop: `1px solid ${t.border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected }); }} style={{ flex: 1, padding: '10px', background: selectedAsset.isSelected ? '#22c55e' : t.bgInput, border: `1px solid ${selectedAsset.isSelected ? '#22c55e' : t.border}`, borderRadius: '8px', color: selectedAsset.isSelected ? '#fff' : t.text, fontSize: '11px' }}>{selectedAsset.isSelected ? 'Selected' : '☆ Select'}</button>
                <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: t.primary, borderRadius: '8px', color: '#fff', fontSize: '11px', textAlign: 'center', textDecoration: 'none' }}>Download</a>
              </div>
            )}
            
            {/* Mobile Swipe Hint */}
            {isMobile && sortedAssets.length > 1 && !isFullscreen && (
              <div style={{ textAlign: 'center', padding: '6px', fontSize: '10px', color: t.textMuted, background: t.bgSecondary }}>← Swipe or use arrows →</div>
            )}
          </div>
          );
        })()}

        {/* Image Cropper Modal */}
        {showCropper && selectedAsset?.type === 'image' && selectedAsset?.url && (
          <ImageCropperModal imageUrl={selectedAsset.url} imageName={selectedAsset.name} onClose={() => setShowCropper(false)} />
        )}

        {/* SELECTION OVERVIEW MODAL */}
        {showSelectionOverview && (() => {
          const allProjectAssets = (selectedProject.assets || []).filter(a => !a.deleted);
          const selectedAssetsList = allProjectAssets.filter(a => a.isSelected || a.rating === 5);
          const fiveStarAssets = selectedAssetsList.filter(a => a.rating === 5);
          const otherSelected = selectedAssetsList.filter(a => a.rating !== 5 && a.isSelected);
          const redPicks = allProjectAssets.filter(a => a.colorLabel === 'red');
          const yellowMaybe = allProjectAssets.filter(a => a.colorLabel === 'yellow');
          const editorsOnProject = team.filter(m => ['editor', 'video-editor', 'colorist', 'retoucher', 'photo-editor'].includes(m.role));

          const ColorThumbGrid = ({ items, borderColor, minSize = '80px' }) => (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${minSize}, 1fr))`, gap: '6px' }}>
              {items.slice(0, 24).map(asset => (
                <div key={asset.id} onClick={() => { setShowSelectionOverview(false); setSelectedAsset(asset); setAssetTab('preview'); }} style={{ aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: `2px solid ${borderColor}`, position: 'relative', cursor: 'pointer' }}>
                  {asset.type === 'image' ? <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{asset.type === 'video' ? 'VID' : 'DOC'}</div>}
                  {asset.rating > 0 && <div style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', borderRadius: '3px', padding: '1px 4px', fontSize: '8px', color: '#fbbf24' }}>{'★'.repeat(asset.rating)}</div>}
                  {asset.colorLabel && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: asset.colorLabel === 'red' ? '#ef4444' : asset.colorLabel === 'yellow' ? '#f59e0b' : '#22c55e' }} />}
                </div>
              ))}
              {items.length > 24 && <div style={{ aspectRatio: '1', borderRadius: '6px', background: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: t.textMuted }}>+{items.length - 24}</div>}
            </div>
          );

          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: t.bgCard, borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Confirm Selection</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: t.textMuted }}>Review your picks before sending to production</p>
                  </div>
                  <button onClick={() => setShowSelectionOverview(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: t.textMuted }}>✕</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                  {/* Summary Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '24px' }}>
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>{redPicks.length}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>🔴 Red Picks</div>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>{yellowMaybe.length}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>🟡 Shortlist</div>
                    </div>
                    <div style={{ background: t.bgInput, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#fbbf24' }}>{fiveStarAssets.length}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>⭐ 5-Star</div>
                    </div>
                    <div style={{ background: t.bgInput, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#22c55e' }}>{otherSelected.length}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>✓ Selected</div>
                    </div>
                    <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#6366f1' }}>{selectedAssetsList.length}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>Total to Edit</div>
                    </div>
                  </div>

                  {/* Red Picks section */}
                  {redPicks.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Red Picks — Must Edit ({redPicks.length})
                      </h4>
                      <ColorThumbGrid items={redPicks} borderColor="#ef4444" minSize="90px" />
                    </div>
                  )}

                  {/* Yellow Shortlist section */}
                  {yellowMaybe.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} /> Yellow Shortlist — Maybe ({yellowMaybe.length})
                      </h4>
                      <ColorThumbGrid items={yellowMaybe} borderColor="#f59e0b" />
                    </div>
                  )}

                  {/* 5-Star Assets Grid */}
                  {fiveStarAssets.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#fbbf24' }}>★★★★★</span> 5-Star Picks ({fiveStarAssets.length})
                      </h4>
                      <ColorThumbGrid items={fiveStarAssets} borderColor="#fbbf24" minSize="90px" />
                    </div>
                  )}

                  {/* Other Selected Assets */}
                  {otherSelected.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: t.textSecondary }}>Other Selected ({otherSelected.length})</h4>
                      <ColorThumbGrid items={otherSelected} borderColor="#22c55e" />
                    </div>
                  )}
                  
                  {/* Notification Preview */}
                  <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '14px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#6366f1' }}>Notifications will be sent to:</h4>
                    {editorsOnProject.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {editorsOnProject.map(editor => (
                          <div key={editor.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: t.bgInput, padding: '6px 10px', borderRadius: '20px', fontSize: '11px' }}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>{editor.name?.[0]}</div>
                            {editor.name}
                            <span style={{ color: t.textMuted }}>({ROLES.find(r => r.id === editor.role)?.label || editor.role})</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '11px', color: t.textMuted }}>No editors assigned to this project. Add team members first.</p>
                    )}
                  </div>
                  
                  {selectedAssetsList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
                      <div style={{ marginBottom: '12px', opacity: 0.5 }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/></svg></div>
                      <p style={{ margin: 0 }}>No assets selected yet. Rate assets with 5 stars or mark them as selected.</p>
                    </div>
                  )}
                </div>
                
                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.bgTertiary }}>
                  <button onClick={() => setShowSelectionOverview(false)} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleConfirmSelection} disabled={selectedAssetsList.length === 0} style={{ padding: '12px 28px', background: selectedAssetsList.length > 0 ? '#22c55e' : t.bgInput, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: selectedAssetsList.length > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ✓ Confirm Selection ({selectedAssetsList.length})
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MANUAL MATCH MODAL */}
        {showMatchModal && unmatchedFiles.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: t.bgCard, borderRadius: '16px', width: '100%', maxWidth: '900px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header */}
              <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}> Match Uploaded Files</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: t.textMuted }}>{unmatchedFiles.length} files need to be matched to existing assets</p>
                </div>
                <button onClick={() => setShowMatchModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: t.textMuted }}>✕</button>
              </div>
              
              {/* Content */}
              <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                {unmatchedFiles.map((file, idx) => {
                  const existingAssets = (selectedProject?.assets || []).filter(a => !a.deleted);
                  return (
                    <div key={idx} style={{ background: t.bgInput, borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        {/* Uploaded File Preview */}
                        <div style={{ flexShrink: 0 }}>
                          <div style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: `2px solid #6366f1`, background: t.bgCard }}>
                            {file.preview ? (
                              <img src={file.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>DOC</div>
                            )}
                          </div>
                          <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px', textAlign: 'center' }}>New</div>
                        </div>
                        
                        {/* Arrow */}
                        <div style={{ display: 'flex', alignItems: 'center', fontSize: '20px', color: t.textMuted, paddingTop: '25px' }}>→</div>
                        
                        {/* Match Selection */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>{file.name}</div>
                          <div style={{ fontSize: '10px', color: t.textMuted, marginBottom: '10px' }}>Select an existing asset to add this as a new version:</div>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '150px', overflow: 'auto' }}>
                            {existingAssets.map(asset => (
                              <div 
                                key={asset.id} 
                                onClick={() => {
                                  const updated = unmatchedFiles.map((f, i) => i === idx ? { ...f, matchedTo: asset.id } : f);
                                  setUnmatchedFiles(updated);
                                }}
                                style={{ 
                                  width: '60px', textAlign: 'center', cursor: 'pointer',
                                  padding: '6px', borderRadius: '8px',
                                  border: file.matchedTo === asset.id ? '2px solid #22c55e' : `1px solid ${t.border}`,
                                  background: file.matchedTo === asset.id ? 'rgba(34,197,94,0.1)' : 'transparent'
                                }}
                              >
                                <div style={{ width: '48px', height: '48px', borderRadius: '6px', overflow: 'hidden', margin: '0 auto 4px', background: t.bgCard }}>
                                  {asset.thumbnail || asset.url ? (
                                    <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{asset.type === 'video' ? 'VID' : 'DOC'}</div>
                                  )}
                                </div>
                                <div style={{ fontSize: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name.substring(0, 10)}...</div>
                                <div style={{ fontSize: '8px', color: t.textMuted }}>v{asset.currentVersion}</div>
                              </div>
                            ))}
                          </div>
                          
                          {/* Option to create new */}
                          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                            <button onClick={() => {
                              const updated = unmatchedFiles.map((f, i) => i === idx ? { ...f, matchedTo: null, createNew: true } : f);
                              setUnmatchedFiles(updated);
                            }} style={{ padding: '6px 12px', background: file.createNew ? 'rgba(99,102,241,0.2)' : 'transparent', border: `1px solid ${file.createNew ? '#6366f1' : t.border}`, borderRadius: '6px', color: file.createNew ? '#6366f1' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>
                              + Create as New Asset
                            </button>
                            {file.matchedTo && (
                              <span style={{ fontSize: '10px', color: '#22c55e', alignSelf: 'center' }}>✓ Matched to {existingAssets.find(a => a.id === file.matchedTo)?.name.substring(0, 15)}...</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Footer */}
              <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.bgTertiary }}>
                <div style={{ fontSize: '11px', color: t.textMuted }}>
                  {unmatchedFiles.filter(f => f.matchedTo || f.createNew).length} / {unmatchedFiles.length} files assigned
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setShowMatchModal(false); setUnmatchedFiles([]); }} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={async () => {
                    // Process matched files
                    for (const file of unmatchedFiles) {
                      if (file.matchedTo) {
                        // Add as version to matched asset
                        const asset = (selectedProject.assets || []).find(a => a.id === file.matchedTo);
                        if (asset) {
                          const newVersion = asset.currentVersion + 1;
                          const newVersionEntry = { version: newVersion, url: file.url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name };
                          const updatedAsset = { ...asset, currentVersion: newVersion, versions: [...(asset.versions || []), newVersionEntry], url: file.url, thumbnail: file.thumbnail || asset.thumbnail };
                          const updatedAssets = (selectedProject.assets || []).map(a => a.id === asset.id ? updatedAsset : a);
                          await updateProject(selectedProject.id, { assets: updatedAssets });
                        }
                      } else if (file.createNew) {
                        // Create as new asset - already uploaded, just need to add to assets
                        const newAsset = {
                          id: file.assetId || generateId(),
                          name: file.name,
                          type: file.type,
                          category: file.category || (selectedProject.categories?.[0]?.id),
                          url: file.url,
                          thumbnail: file.thumbnail,
                          fileSize: file.size,
                          mimeType: file.mimeType,
                          status: 'pending',
                          rating: 0,
                          isSelected: false,
                          uploadedBy: userProfile.id,
                          uploadedByName: userProfile.name,
                          uploadedAt: new Date().toISOString(),
                          versions: [{ version: 1, url: file.url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name }],
                          currentVersion: 1,
                          feedback: [],
                          annotations: []
                        };
                        const updatedAssets = [...(selectedProject.assets || []), newAsset];
                        await updateProject(selectedProject.id, { assets: updatedAssets });
                      }
                    }
                    await refreshProject();
                    setShowMatchModal(false);
                    setUnmatchedFiles([]);
                    showToast('Files processed!', 'success');
                  }} disabled={unmatchedFiles.filter(f => f.matchedTo || f.createNew).length === 0} style={{ padding: '10px 24px', background: unmatchedFiles.filter(f => f.matchedTo || f.createNew).length > 0 ? '#22c55e' : t.bgInput, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: unmatchedFiles.filter(f => f.matchedTo || f.createNew).length > 0 ? 'pointer' : 'default' }}>
                    ✓ Process Files
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT-CLICK CONTEXT MENU */}
        {contextMenu && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 3000,
              background: t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
              minWidth: '180px',
              overflow: 'hidden',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            {/* New Folder option (always visible) */}
            <button
              onClick={() => { setShowAddCat(true); setContextMenu(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 14px',
                background: 'transparent', border: 'none',
                color: t.text, fontSize: '13px', cursor: 'pointer',
                textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.bgSecondary}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              📁 New Folder
            </button>

            {/* Folder-specific options */}
            {contextMenu.catId && (() => {
              const cat = (selectedProject.categories || []).find(c => c.id === contextMenu.catId);
              if (!cat) return null;
              return (
                <>
                  <div style={{ height: '1px', background: t.border, margin: '2px 0' }} />
                  <button
                    onClick={() => {
                      setRenamingCat(contextMenu.catId);
                      setRenameValue(cat.name);
                      setContextMenu(null);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '10px 14px',
                      background: 'transparent', border: 'none',
                      color: t.text, fontSize: '13px', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = t.bgSecondary}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    ✏️ Rename &ldquo;{cat.name}&rdquo;
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(contextMenu.catId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '10px 14px',
                      background: 'transparent', border: 'none',
                      color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    🗑 Delete &ldquo;{cat.name}&rdquo;
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {/* COMPARE PANEL */}
        {showComparePanel && compareAssetIds.length >= 2 && (
          <ComparePanel
            assets={(selectedProject.assets || []).filter(a => compareAssetIds.includes(a.id))}
            t={t}
            theme={theme}
            onRate={(assetId, rating) => { handleRate(assetId, rating); }}
            onSelect={(assetId) => handleToggleSelect(assetId)}
            onColorLabel={(assetId, label) => handleColorLabel(assetId, label)}
            onOpenLightbox={(asset) => { setShowComparePanel(false); setSelectedAsset(asset); setAssetTab('preview'); }}
            onClose={() => setShowComparePanel(false)}
          />
        )}

        </div>
      </div>
    );
  };

  // Image Cropper Modal — Canvas-based crop with aspect ratio presets and export
  const ImageCropperModal = ({ imageUrl, imageName, onClose }) => {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [cropRect, setCropRect] = useState(null);
    const [draggingHandle, setDraggingHandle] = useState(null);
    const [dragStart, setDragStart] = useState(null);
    const [aspectRatio, setAspectRatio] = useState(null); // null = free
    const [exportFormat, setExportFormat] = useState('jpeg');
    const [exportQuality, setExportQuality] = useState(92);
    const containerRef = useRef(null);
    const [displaySize, setDisplaySize] = useState({ w: 0, h: 0, offsetX: 0, offsetY: 0, scale: 1 });

    const presets = [
      { label: 'Free', ratio: null },
      { label: '1:1', ratio: 1 },
      { label: '4:5', ratio: 4 / 5 },
      { label: '9:16', ratio: 9 / 16 },
      { label: '16:9', ratio: 16 / 9 },
      { label: '3:4', ratio: 3 / 4 },
      { label: '4:3', ratio: 4 / 3 },
    ];

    // Load image and calculate display size
    useEffect(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        const container = containerRef.current;
        if (!container) return;
        const maxW = container.clientWidth - 40;
        const maxH = container.clientHeight - 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        const offsetX = (container.clientWidth - w) / 2;
        const offsetY = (container.clientHeight - h) / 2;
        setDisplaySize({ w, h, offsetX, offsetY, scale });
        setCropRect({ x: 0, y: 0, w: img.width, h: img.height });
        setImgLoaded(true);
      };
      img.src = imageUrl;
    }, [imageUrl]);

    // Draw canvas
    useEffect(() => {
      if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const { w, h, offsetX, offsetY, scale } = displaySize;
      canvas.width = containerRef.current?.clientWidth || 800;
      canvas.height = containerRef.current?.clientHeight || 600;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw image
      ctx.drawImage(imgRef.current, offsetX, offsetY, w, h);
      // Darken outside crop
      if (cropRect) {
        const cx = offsetX + cropRect.x * scale;
        const cy = offsetY + cropRect.y * scale;
        const cw = cropRect.w * scale;
        const ch = cropRect.h * scale;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, canvas.width, cy);
        ctx.fillRect(0, cy, cx, ch);
        ctx.fillRect(cx + cw, cy, canvas.width - cx - cw, ch);
        ctx.fillRect(0, cy + ch, canvas.width, canvas.height - cy - ch);
        // Crop border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cw, ch);
        // Rule of thirds
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 3; i++) {
          ctx.beginPath(); ctx.moveTo(cx + cw * i / 3, cy); ctx.lineTo(cx + cw * i / 3, cy + ch); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(cx, cy + ch * i / 3); ctx.lineTo(cx + cw, cy + ch * i / 3); ctx.stroke();
        }
        // Corner handles
        const hs = 8;
        ctx.fillStyle = '#fff';
        [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]].forEach(([hx, hy]) => {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
        // Dimensions label
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(cx + cw / 2 - 40, cy + ch + 8, 80, 20);
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(cropRect.w)} × ${Math.round(cropRect.h)}`, cx + cw / 2, cy + ch + 22);
      }
    }, [imgLoaded, cropRect, displaySize]);

    // Mouse handlers for crop dragging
    const getImageCoords = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      return { mx, my, ix: (mx - displaySize.offsetX) / displaySize.scale, iy: (my - displaySize.offsetY) / displaySize.scale };
    };

    const handleMouseDown = (e) => {
      if (!cropRect || !imgRef.current) return;
      const { mx, my } = getImageCoords(e);
      const { offsetX, offsetY, scale } = displaySize;
      const cx = offsetX + cropRect.x * scale;
      const cy = offsetY + cropRect.y * scale;
      const cw = cropRect.w * scale;
      const ch = cropRect.h * scale;
      const hs = 12;
      // Check corners
      const corners = [
        { x: cx, y: cy, handle: 'tl' }, { x: cx + cw, y: cy, handle: 'tr' },
        { x: cx, y: cy + ch, handle: 'bl' }, { x: cx + cw, y: cy + ch, handle: 'br' },
      ];
      for (const c of corners) {
        if (Math.abs(mx - c.x) < hs && Math.abs(my - c.y) < hs) {
          setDraggingHandle(c.handle);
          setDragStart({ mx, my, rect: { ...cropRect } });
          return;
        }
      }
      // Check inside crop = move
      if (mx > cx && mx < cx + cw && my > cy && my < cy + ch) {
        setDraggingHandle('move');
        setDragStart({ mx, my, rect: { ...cropRect } });
      }
    };

    const handleMouseMove = (e) => {
      if (!draggingHandle || !dragStart || !imgRef.current) return;
      const { mx, my } = getImageCoords(e);
      const dx = (mx - dragStart.mx) / displaySize.scale;
      const dy = (my - dragStart.my) / displaySize.scale;
      const orig = dragStart.rect;
      const imgW = imgRef.current.width;
      const imgH = imgRef.current.height;
      let newRect = { ...orig };

      if (draggingHandle === 'move') {
        newRect.x = Math.max(0, Math.min(imgW - orig.w, orig.x + dx));
        newRect.y = Math.max(0, Math.min(imgH - orig.h, orig.y + dy));
      } else {
        if (draggingHandle.includes('l')) { newRect.x = Math.max(0, orig.x + dx); newRect.w = orig.w - (newRect.x - orig.x); }
        if (draggingHandle.includes('r')) { newRect.w = Math.max(20, orig.w + dx); }
        if (draggingHandle.includes('t')) { newRect.y = Math.max(0, orig.y + dy); newRect.h = orig.h - (newRect.y - orig.y); }
        if (draggingHandle.includes('b')) { newRect.h = Math.max(20, orig.h + dy); }
        // Constrain to image
        if (newRect.x + newRect.w > imgW) newRect.w = imgW - newRect.x;
        if (newRect.y + newRect.h > imgH) newRect.h = imgH - newRect.y;
        // Apply aspect ratio
        if (aspectRatio) {
          if (draggingHandle.includes('r') || draggingHandle.includes('l')) {
            newRect.h = newRect.w / aspectRatio;
          } else {
            newRect.w = newRect.h * aspectRatio;
          }
        }
      }
      if (newRect.w > 10 && newRect.h > 10) setCropRect(newRect);
    };

    useEffect(() => {
      if (!draggingHandle) return;
      const handleUp = () => { setDraggingHandle(null); setDragStart(null); };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleUp); };
    }, [draggingHandle, dragStart]);

    // Apply preset ratio
    const applyRatio = (ratio) => {
      setAspectRatio(ratio);
      if (ratio && imgRef.current && cropRect) {
        const imgW = imgRef.current.width;
        const imgH = imgRef.current.height;
        let w = cropRect.w, h = cropRect.h;
        if (w / h > ratio) { w = h * ratio; } else { h = w / ratio; }
        const x = Math.max(0, Math.min(imgW - w, cropRect.x + (cropRect.w - w) / 2));
        const y = Math.max(0, Math.min(imgH - h, cropRect.y + (cropRect.h - h) / 2));
        setCropRect({ x, y, w, h });
      }
    };

    // Export
    const handleExport = () => {
      if (!imgRef.current || !cropRect) return;
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = Math.round(cropRect.w);
      exportCanvas.height = Math.round(cropRect.h);
      const ctx = exportCanvas.getContext('2d');
      ctx.drawImage(imgRef.current, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h);
      const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      const dataUrl = exportCanvas.toDataURL(mimeType, exportQuality / 100);
      const link = document.createElement('a');
      const ext = exportFormat === 'png' ? 'png' : 'jpg';
      link.download = `${(imageName || 'cropped').replace(/\.[^.]+$/, '')}_cropped.${ext}`;
      link.href = dataUrl;
      link.click();
      showToast('Image exported!', 'success');
    };

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Crop & Export</span>
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '3px' }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => applyRatio(p.ratio)} style={{
                  padding: '5px 10px', background: (aspectRatio === p.ratio || (aspectRatio === null && p.ratio === null)) ? t.primary : 'transparent',
                  border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', fontWeight: '500'
                }}>{p.label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '11px' }}>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
            </select>
            {exportFormat === 'jpeg' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Quality</span>
                <input type="range" min="10" max="100" value={exportQuality} onChange={e => setExportQuality(Number(e.target.value))} style={{ width: '80px', accentColor: t.primary }} />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', minWidth: '28px' }}>{exportQuality}%</span>
              </div>
            )}
            <button onClick={handleExport} style={{ padding: '7px 20px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Export</button>
            <button onClick={onClose} style={{ padding: '7px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
        {/* Canvas area */}
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <canvas ref={canvasRef} onMouseDown={handleMouseDown} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: draggingHandle === 'move' ? 'move' : draggingHandle ? 'nwse-resize' : 'crosshair' }} />
          {!imgLoaded && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>Loading image...</div>}
        </div>
      </div>
    );
  };

  // Activity Feed Component — Chronological feed with filtering and event icons
  const ActivityFeed = ({ asset, project }) => {
    const [actFilter, setActFilter] = useState('all');

    // Gather all events for this asset from project activity log + asset feedback
    const events = useMemo(() => {
      const items = [];
      const assetName = asset?.name || '';

      // Project-level activities that mention this asset
      (project?.activityLog || []).forEach(a => {
        if (a.message?.includes(assetName) || a.type === 'created') {
          items.push({ ...a, source: 'project' });
        }
      });

      // Asset feedback as events
      (asset?.feedback || []).forEach(fb => {
        items.push({ id: fb.id, type: 'feedback', message: `${fb.userName} added feedback: "${fb.text.substring(0, 80)}${fb.text.length > 80 ? '...' : ''}"`, timestamp: fb.timestamp, userId: fb.userId, userName: fb.userName, round: fb.round, source: 'feedback', feedbackId: fb.id, isDone: fb.isDone, videoTimestamp: fb.videoTimestamp });
        // Feedback replies
        (fb.replies || []).forEach(r => {
          items.push({ id: r.id, type: 'reply', message: `${r.userName} replied: "${r.text.substring(0, 80)}${r.text.length > 80 ? '...' : ''}"`, timestamp: r.timestamp, userId: r.userId, userName: r.userName, source: 'reply', parentId: fb.id });
        });
      });

      // Version uploads
      (asset?.versions || []).forEach(v => {
        if (v.uploadedAt) {
          items.push({ id: `ver-${v.version}`, type: 'version', message: `Version ${v.version} uploaded${v.uploadedBy ? ` by ${v.uploadedBy}` : ''}`, timestamp: v.uploadedAt, source: 'version' });
        }
      });

      // Round history
      (asset?.roundHistory || []).forEach(rh => {
        if (rh.resolvedAt) {
          items.push({ id: `round-${rh.round}`, type: 'round', message: `Round ${rh.round} completed — ${rh.feedbackCount} feedback items resolved`, timestamp: rh.resolvedAt, source: 'round' });
        }
      });

      return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [asset, project]);

    const eventIcon = (type) => {
      switch (type) {
        case 'feedback': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
        case 'reply': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><polyline points="9,17 4,12 9,7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>, color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' };
        case 'version': case 'upload': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
        case 'status': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
        case 'round': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2"><polyline points="23,4 23,10 17,10"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/></svg>, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' };
        case 'extension-request': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>, color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
        case 'agency-review': case 'agency-approved': case 'agency-changes': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>, color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)' };
        case 'handoff': return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>, color: '#ec4899', bg: 'rgba(236,72,153,0.12)' };
        default: return { icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, color: t.textMuted, bg: t.bgHover };
      }
    };

    const filters = [
      { id: 'all', label: 'All' },
      { id: 'feedback', label: 'Feedback' },
      { id: 'version', label: 'Versions' },
      { id: 'status', label: 'Status' },
      { id: 'round', label: 'Rounds' },
    ];

    const filtered = actFilter === 'all' ? events : events.filter(e => e.type === actFilter || (actFilter === 'feedback' && e.type === 'reply') || (actFilter === 'version' && e.type === 'upload'));

    return (
      <div>
        {/* Filter bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {filters.map(f => (
            <button key={f.id} onClick={() => setActFilter(f.id)} style={{
              padding: '5px 12px', background: actFilter === f.id ? t.primary : t.bgInput,
              border: actFilter === f.id ? 'none' : `1px solid ${t.border}`, borderRadius: '6px',
              color: actFilter === f.id ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer', fontWeight: actFilter === f.id ? '600' : '400'
            }}>{f.label}{f.id !== 'all' && <span style={{ marginLeft: '4px', opacity: 0.6 }}>({events.filter(e => e.type === f.id || (f.id === 'feedback' && e.type === 'reply') || (f.id === 'version' && e.type === 'upload')).length})</span>}</button>
          ))}
        </div>

        {/* Timeline */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: t.textMuted, fontSize: '13px' }}>No activity yet</div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '28px' }}>
            {/* Timeline line */}
            <div style={{ position: 'absolute', left: '11px', top: '4px', bottom: '4px', width: '2px', background: t.borderLight, borderRadius: '1px' }} />

            {filtered.map((event, idx) => {
              const { icon, color, bg } = eventIcon(event.type);
              return (
                <div key={event.id || idx} style={{ position: 'relative', marginBottom: '12px', paddingBottom: '4px' }}>
                  {/* Timeline dot */}
                  <div style={{ position: 'absolute', left: '-28px', top: '2px', width: '24px', height: '24px', borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${t.bgSecondary}`, zIndex: 1 }}>
                    {icon}
                  </div>
                  {/* Event card */}
                  <div style={{ padding: '10px 12px', background: `${t.bgCard}AA`, borderRadius: '10px', border: `1px solid ${t.borderLight}` }}>
                    <div style={{ fontSize: '12px', color: t.text, lineHeight: '1.4' }}>{event.message}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: t.textMuted }}>{formatTimeAgo(event.timestamp)}</span>
                      {event.round && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: '600' }}>R{event.round}</span>}
                      {event.videoTimestamp != null && <span style={{ fontSize: '9px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: '600' }}>{Math.floor(event.videoTimestamp / 60)}:{String(Math.floor(event.videoTimestamp % 60)).padStart(2, '0')}</span>}
                      {event.isDone && <span style={{ fontSize: '9px', color: t.success }}>Resolved</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Version Comparison Component — Side-by-Side, Overlay, Swipe modes + Video support
  const VersionComparison = ({ versions = [], currentVersion, assetType = 'image' }) => {
    const [leftV, setLeftV] = useState(versions.length > 1 ? versions.length - 2 : 0);
    const [rightV, setRightV] = useState(versions.length - 1);
    const [compareMode, setCompareMode] = useState('side-by-side');
    const [overlayOpacity, setOverlayOpacity] = useState(50);
    const [swipePos, setSwipePos] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const swipeRef = useRef(null);
    const leftVideoRef = useRef(null);
    const rightVideoRef = useRef(null);
    const [videoPlaying, setVideoPlaying] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0 });

    if (versions.length < 2) return <div style={{ textAlign: 'center', padding: '40px', background: t.bgInput, borderRadius: '12px' }}><div style={{ marginBottom: '12px', opacity: 0.5 }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div><div style={{ color: t.textMuted, fontSize: '13px' }}>Upload more versions to compare</div></div>;

    const left = versions[leftV];
    const right = versions[rightV];
    const isVideo = assetType === 'video' || left?.url?.includes('.mp4') || left?.muxPlaybackId;

    // Swipe drag handler
    const handleSwipeMove = (e) => {
      if (!isDragging || !swipeRef.current) return;
      const rect = swipeRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = ((clientX - rect.left) / rect.width) * 100;
      setSwipePos(Math.max(2, Math.min(98, pos)));
    };

    useEffect(() => {
      if (!isDragging) return;
      const handleUp = () => setIsDragging(false);
      window.addEventListener('mousemove', handleSwipeMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleSwipeMove);
      window.addEventListener('touchend', handleUp);
      return () => { window.removeEventListener('mousemove', handleSwipeMove); window.removeEventListener('mouseup', handleUp); window.removeEventListener('touchmove', handleSwipeMove); window.removeEventListener('touchend', handleUp); };
    }, [isDragging]);

    // Synced video playback
    const toggleVideoPlay = () => {
      if (!leftVideoRef.current || !rightVideoRef.current) return;
      if (videoPlaying) { leftVideoRef.current.pause(); rightVideoRef.current.pause(); }
      else { leftVideoRef.current.play(); rightVideoRef.current.play(); }
      setVideoPlaying(!videoPlaying);
    };
    const syncVideoTime = (sourceRef, targetRef) => {
      if (targetRef.current && sourceRef.current) targetRef.current.currentTime = sourceRef.current.currentTime;
    };

    // Zoom controls
    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(5, z + (e.deltaY > 0 ? -0.1 : 0.1))));
    };

    // Pan handlers
    const handlePanStart = (e) => {
      if (zoom <= 1) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    };
    const handlePanMove = (e) => {
      if (!isPanning) return;
      setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
    };

    useEffect(() => {
      if (!isPanning) return;
      const handleUp = () => setIsPanning(false);
      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handleUp);
      return () => { window.removeEventListener('mousemove', handlePanMove); window.removeEventListener('mouseup', handleUp); };
    }, [isPanning]);

    const modeButtons = [
      { id: 'side-by-side', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>, label: 'Side by Side' },
      { id: 'overlay', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="12" r="7"/><circle cx="14" cy="12" r="7"/></svg>, label: 'Overlay' },
      { id: 'swipe', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><polyline points="9,10 12,7 15,10"/><polyline points="9,14 12,17 15,14"/></svg>, label: 'Swipe' },
    ];

    const imgTransform = zoom !== 1 ? `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)` : undefined;

    const getVideoSrc = (v) => v?.muxPlaybackId ? `https://stream.mux.com/${v.muxPlaybackId}.m3u8` : v?.url;

    return (
      <div>
        {/* Controls bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Mode selector */}
          <div style={{ display: 'flex', gap: '2px', background: t.bgInput, borderRadius: '8px', padding: '3px' }}>
            {modeButtons.map(m => (
              <button key={m.id} onClick={() => setCompareMode(m.id)} title={m.label} style={{
                padding: '6px 10px', background: compareMode === m.id ? t.primary : 'transparent', border: 'none',
                borderRadius: '6px', color: compareMode === m.id ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s'
              }}>{m.icon} {!isMobile && m.label}</button>
            ))}
          </div>

          {/* Overlay opacity slider */}
          {compareMode === 'overlay' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
              <span style={{ fontSize: '10px', color: t.textMuted }}>v{left.version}</span>
              <input type="range" min="0" max="100" value={overlayOpacity} onChange={e => setOverlayOpacity(Number(e.target.value))}
                style={{ width: '100px', accentColor: t.primary }} />
              <span style={{ fontSize: '10px', color: t.textMuted }}>v{right.version}</span>
            </div>
          )}

          {/* Zoom controls */}
          {!isVideo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={{ width: '24px', height: '24px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.textSecondary, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
              <span style={{ fontSize: '10px', color: t.textMuted, minWidth: '32px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.25))} style={{ width: '24px', height: '24px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.textSecondary, cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              {zoom !== 1 && <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ padding: '2px 6px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.textMuted, cursor: 'pointer', fontSize: '10px' }}>Reset</button>}
            </div>
          )}

          {/* Version selectors — right aligned */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: 'auto' }}>
            <Select theme={theme} value={leftV} onChange={v => setLeftV(parseInt(v))} style={{ width: '100px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
            <span style={{ color: t.textMuted, fontSize: '11px' }}>vs</span>
            <Select theme={theme} value={rightV} onChange={v => setRightV(parseInt(v))} style={{ width: '100px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
          </div>
        </div>

        {/* Video playback controls */}
        {isVideo && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', justifyContent: 'center' }}>
            <button onClick={toggleVideoPlay} style={{ padding: '6px 16px', background: t.primary, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {videoPlaying ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</> : <><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Play Both</>}
            </button>
            <button onClick={() => { if (leftVideoRef.current) { leftVideoRef.current.currentTime = 0; syncVideoTime(leftVideoRef, rightVideoRef); } }} style={{ padding: '6px 12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>Restart</button>
          </div>
        )}

        {/* Comparison viewport */}
        <div style={{ background: t.bgInput, borderRadius: '12px', overflow: 'hidden', position: 'relative' }} onWheel={handleWheel}>

          {/* === Side by Side === */}
          {compareMode === 'side-by-side' && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2px' }}>
              {[{ v: left, label: `v${left.version}`, ref: leftVideoRef }, { v: right, label: `v${right.version}`, ref: rightVideoRef }].map(({ v, label, ref }, idx) => (
                <div key={idx} style={{ position: 'relative', overflow: 'hidden', cursor: zoom > 1 ? 'grab' : 'default' }} onMouseDown={handlePanStart}>
                  <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.7)', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#fff', backdropFilter: 'blur(4px)' }}>{label}</div>
                  <div style={{ position: 'absolute', bottom: '8px', right: '8px', zIndex: 2, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{v?.uploadedAt ? formatDate(v.uploadedAt) : ''}</div>
                  {isVideo ? (
                    <video ref={ref} src={getVideoSrc(v)} onSeeked={() => syncVideoTime(ref, idx === 0 ? rightVideoRef : leftVideoRef)} style={{ width: '100%', height: '350px', objectFit: 'contain', background: '#000' }} />
                  ) : (
                    <img src={v?.url} alt={label} loading="lazy" style={{ width: '100%', height: '350px', objectFit: 'contain', background: '#000', transform: imgTransform, transformOrigin: 'center center', transition: isPanning ? 'none' : 'transform 0.1s' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* === Overlay Mode === */}
          {compareMode === 'overlay' && (
            <div style={{ position: 'relative', height: '450px', overflow: 'hidden', cursor: zoom > 1 ? 'grab' : 'default' }} onMouseDown={handlePanStart}>
              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2, background: 'rgba(0,0,0,0.7)', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#fff', backdropFilter: 'blur(4px)' }}>v{left.version}</div>
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 2, background: 'rgba(99,102,241,0.7)', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#fff', backdropFilter: 'blur(4px)' }}>v{right.version}</div>
              {isVideo ? (
                <>
                  <video ref={leftVideoRef} src={getVideoSrc(left)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                  <video ref={rightVideoRef} src={getVideoSrc(right)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: overlayOpacity / 100 }} />
                </>
              ) : (
                <>
                  <img src={left?.url} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', transform: imgTransform, transformOrigin: 'center center' }} />
                  <img src={right?.url} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: overlayOpacity / 100, transform: imgTransform, transformOrigin: 'center center', mixBlendMode: 'normal' }} />
                </>
              )}
              <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', borderRadius: '8px', padding: '6px 14px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(4px)' }}>
                Opacity: {overlayOpacity}%
              </div>
            </div>
          )}

          {/* === Swipe Mode === */}
          {compareMode === 'swipe' && (
            <div ref={swipeRef} style={{ position: 'relative', height: '450px', overflow: 'hidden', cursor: 'ew-resize', userSelect: 'none' }}
              onMouseDown={(e) => { if (Math.abs(e.nativeEvent.offsetX - (swipeRef.current.clientWidth * swipePos / 100)) < 30) setIsDragging(true); }}
              onTouchStart={(e) => setIsDragging(true)}>
              {/* Right/bottom layer (v2) */}
              {isVideo ? (
                <video ref={rightVideoRef} src={getVideoSrc(right)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <img src={right?.url} alt="" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              )}
              {/* Left/top layer (v1) clipped */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: `${swipePos}%`, height: '100%', overflow: 'hidden' }}>
                {isVideo ? (
                  <video ref={leftVideoRef} src={getVideoSrc(left)} style={{ width: swipeRef.current?.clientWidth || '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <img src={left?.url} alt="" style={{ width: swipeRef.current?.clientWidth || '100%', height: '100%', objectFit: 'contain' }} />
                )}
              </div>
              {/* Swipe handle */}
              <div style={{ position: 'absolute', top: 0, left: `${swipePos}%`, width: '3px', height: '100%', background: '#fff', transform: 'translateX(-50%)', boxShadow: '0 0 12px rgba(0,0,0,0.5)', zIndex: 2 }}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '32px', height: '32px', background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5"><polyline points="8,4 4,12 8,20"/><polyline points="16,4 20,12 16,20"/></svg>
                </div>
              </div>
              {/* Labels */}
              <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3, background: 'rgba(0,0,0,0.7)', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#fff' }}>v{left.version}</div>
              <div style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 3, background: 'rgba(99,102,241,0.7)', padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#fff' }}>v{right.version}</div>
            </div>
          )}
        </div>

        {/* Version info footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', padding: '10px 14px', background: t.bgInput, borderRadius: '8px', fontSize: '11px' }}>
          <div><span style={{ color: t.textMuted }}>v{left.version}: </span><span style={{ color: t.textSecondary }}>{left?.uploadedAt ? formatDate(left.uploadedAt) : 'Original'}</span></div>
          <div><span style={{ color: t.textMuted }}>v{right.version}: </span><span style={{ color: t.textSecondary }}>{right?.uploadedAt ? formatDate(right.uploadedAt) : 'Latest'}</span>{right.version === currentVersion && <span style={{ color: t.success, marginLeft: '6px' }}>Current</span>}</div>
        </div>
      </div>
    );
  };

  // Stable component references to prevent unmount/remount on parent state changes (e.g. theme toggle).
  // Each ref holds the latest implementation; the useMemo wrapper keeps a stable function identity
  // so React treats it as the same component across renders, preventing unmount/remount cycles.
  // The wrapper calls the implementation directly (not via JSX) to avoid creating a new component type.
  const _dashboardRef = useRef(null); _dashboardRef.current = Dashboard;
  const StableDashboard = useMemo(() => (props) => _dashboardRef.current(props), []);
  const _tasksViewRef = useRef(null); _tasksViewRef.current = TasksView;
  const StableTasksView = useMemo(() => (props) => _tasksViewRef.current(props), []);
  const _projectsListRef = useRef(null); _projectsListRef.current = ProjectsList;
  const StableProjectsList = useMemo(() => (props) => _projectsListRef.current(props), []);
  const _projectDetailRef = useRef(null); _projectDetailRef.current = ProjectDetail;
  const StableProjectDetail = useMemo(() => (props) => _projectDetailRef.current(props), []);
  const _calendarViewRef = useRef(null); _calendarViewRef.current = CalendarView;
  const StableCalendarView = useMemo(() => (props) => _calendarViewRef.current(props), []);
  const _teamManagementRef = useRef(null); _teamManagementRef.current = TeamManagement;
  const StableTeamManagement = useMemo(() => (props) => _teamManagementRef.current(props), []);
  const _downloadsViewRef = useRef(null); _downloadsViewRef.current = DownloadsView;
  const StableDownloadsView = useMemo(() => (props) => _downloadsViewRef.current(props), []);

  // Onboarding gate: employees with incomplete onboarding see the full-screen
  // OnboardingFlow instead of the normal app. Vendors/clients/freelancers never
  // reach this because they don't have isEmployee: true.
  if (needsOnboarding) {
    return <OnboardingFlow theme={theme} t={t} />;
  }

  // Main Render
  return (
    <div style={{ minHeight: '100vh', background: t.bgInput, color: t.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Global CSS for hover rules */}
      <style>{`
        .asset-card:hover .card-delete-btn { opacity: 1 !important; }
        .asset-card:hover .asset-hover-overlay { opacity: 1 !important; }
        .asset-thumb-area:hover .asset-hover-overlay { opacity: 1 !important; }
      `}</style>
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, x: 80, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 2000 }}
          >
            <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
          </motion.div>
        )}
      </AnimatePresence>
      <GlobalSearch />
      
      {/* Company Settings Modal */}
      {showCompanySettings && (
        <Modal theme={theme} title="Company Settings" onClose={() => setShowCompanySettings(false)}>
          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Company Name</label>
              <Input 
                value={companySettings.name} 
                onChange={(v) => setCompanySettings({ ...companySettings, name: v })} 
                placeholder="Company name" 
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Logo (Dark Mode)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {companySettings.logoDark && (
                  <div style={{ width: '100px', height: '40px', background: t.bgInput, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                    <img src={companySettings.logoDark} alt="Dark logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setCompanySettings({ ...companySettings, logoDark: ev.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ fontSize: '12px', color: t.textSecondary }}
                />
                {companySettings.logoDark && (
                  <button 
                    onClick={() => setCompanySettings({ ...companySettings, logoDark: null })}
                    style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px' }}>Recommended: SVG or PNG with transparent background</div>
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Logo (Light Mode)</label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {companySettings.logoLight && (
                  <div style={{ width: '100px', height: '40px', background: '#f0f2f5', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                    <img src={companySettings.logoLight} alt="Light logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setCompanySettings({ ...companySettings, logoLight: ev.target.result });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ fontSize: '12px', color: t.textSecondary }}
                />
                {companySettings.logoLight && (
                  <button 
                    onClick={() => setCompanySettings({ ...companySettings, logoLight: null })}
                    style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '4px' }}>For light mode - use darker colors</div>
            </div>
            
            <div style={{ marginTop: '10px', padding: '12px', background: t.bgTertiary, borderRadius: '8px' }}>
              <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Preview</div>
              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ background: '#0a0a0f', padding: '12px 16px', borderRadius: '8px' }}>
                  {companySettings.logoDark ? (
                    <img src={companySettings.logoDark} alt="Dark" style={{ height: '24px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>{companySettings.name}</span>
                  )}
                </div>
                <div style={{ background: '#f5f7fa', padding: '12px 16px', borderRadius: '8px' }}>
                  {companySettings.logoLight ? (
                    <img src={companySettings.logoLight} alt="Light" style={{ height: '24px', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#111' }}>{companySettings.name}</span>
                  )}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <Btn theme={theme} onClick={() => { setShowCompanySettings(false); showToast('Settings saved', 'success'); }}>
                Save Settings
              </Btn>
              <Btn theme={theme} onClick={() => setShowCompanySettings(false)} outline>Cancel</Btn>
            </div>
          </div>
        </Modal>
      )}
      
      <Sidebar />
      <div style={{ marginLeft: isMobile ? '0' : (sidebarCollapsed ? '60px' : '240px'), background: t.bg, minHeight: '100vh', transition: 'margin-left 0.2s ease' }}>
        {/* Top Header Bar */}
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: '56px',
          background: t.bg,
          borderBottom: `1px solid ${t.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
            <span style={{ color: t.text, fontWeight: '600' }}>
              {view === 'dashboard' ? 'Dashboard' :
               view === 'tasks' ? 'My Tasks' :
               view === 'projects' ? 'Projects' :
               view === 'calendar' ? 'Calendar' :
               view === 'team' ? 'Team' :
               view === 'downloads' ? 'Downloads' : ''}
            </span>
            {view === 'projects' && selectedProjectId && selectedProject && (
              <>
                <span style={{ color: t.textMuted }}>{Icons.chevronRight(t.textMuted)}</span>
                <span style={{ color: t.textSecondary, fontWeight: '500' }}>{selectedProject.name}</span>
              </>
            )}
          </div>

          {/* Right side actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {/* Search trigger */}
            <button
              onClick={() => setShowGlobalSearch(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: t.bgInput,
                border: `1px solid ${t.border}`,
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                color: t.textMuted,
                fontSize: '13px',
                transition: 'border-color 0.2s',
              }}
            >
              {Icons.search(t.textMuted)}
              <span>Search</span>
              <span style={{ fontSize: '10px', background: t.bgTertiary, padding: '2px 6px', borderRadius: '4px', fontWeight: '600', color: t.textSecondary }}>
                {navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K
              </span>
            </button>

            {/* Notification bell */}
            <NotificationPanel />

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.2s',
              }}
            >
              {theme === 'dark' ? Icons.sun(t.textSecondary) : Icons.moon(t.textSecondary)}
            </button>

            {/* User avatar */}
            <div style={{ marginLeft: '4px' }}>
              <Avatar user={userProfile} size={32} />
            </div>
          </div>
        </header>

        {/* Content with page transition */}
        <AnimatePresence mode="wait">
          <motion.div
            key={view + (selectedProjectId || '')}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ padding: isMobile ? '16px' : '24px' }}
          >
            {view === 'dashboard' && <StableDashboard />}
            {view === 'tasks' && <StableTasksView />}
            {view === 'projects' && !selectedProjectId && <StableProjectsList />}
            {view === 'projects' && selectedProjectId && <StableProjectDetail />}
            {view === 'calendar' && <StableCalendarView />}
            {view === 'team' && <StableTeamManagement />}
            {view === 'downloads' && <StableDownloadsView />}
            {view === 'employees' && canManageEmployeesNow && <EmployeeModule t={t} />}
            {view === 'releases' && <ReleasesModule t={t} userProfile={userProfile} />}
          </motion.div>
        </AnimatePresence>

        {/* Keyboard Shortcut Cheat Sheet */}
        {showShortcuts && (
          <div className="modal-backdrop" onClick={() => setShowShortcuts(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: t.modalBg, borderRadius: '16px', padding: '24px', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflow: 'auto', border: `1px solid ${t.borderLight}`, boxShadow: t.shadow }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: t.text }}>Keyboard Shortcuts</h2>
                <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', color: t.textMuted, cursor: 'pointer', fontSize: '18px' }}>x</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {SHORTCUT_GROUPS.map(group => (
                  <div key={group.title}>
                    <h3 style={{ fontSize: '11px', fontWeight: '600', color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>{group.title}</h3>
                    {group.shortcuts.map(s => (
                      <div key={s.description} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${t.borderLight}` }}>
                        <span style={{ fontSize: '12px', color: t.textSecondary }}>{s.description}</span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          {s.keys.map(k => (
                            <kbd key={k} style={{ padding: '2px 8px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', color: t.text, fontWeight: '600' }}>{k}</kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: t.textMuted }}>
                Press <kbd style={{ padding: '1px 6px', background: t.bgInput, border: `1px solid ${t.borderLight}`, borderRadius: '3px', fontSize: '10px', fontFamily: 'monospace' }}>?</kbd> to toggle this panel
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
