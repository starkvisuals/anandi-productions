'use client';
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProjects, getProjectsForUser, createProject, updateProject, getUsers, getFreelancers, getClients, getCoreTeam, createUser, createShareLink, TEAM_ROLES, CORE_ROLES, STATUS, generateId } from '@/lib/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import dynamic from 'next/dynamic';

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
  { id: 'photoshoot-basic', name: '📸 Basic Photoshoot', type: 'photoshoot', categories: ['statics'], description: 'Simple photoshoot with statics only' },
  { id: 'photoshoot-full', name: '📸 Full Photoshoot', type: 'photoshoot', categories: ['statics', 'videos'], description: 'Photoshoot with BTS videos' },
  { id: 'ad-film', name: '🎬 Ad Film', type: 'ad-film', categories: ['videos', 'vfx', 'audio', 'cgi'], description: 'Full ad film production' },
  { id: 'product-video', name: '📦 Product Video', type: 'product-video', categories: ['videos', 'cgi'], description: 'Product showcase video' },
  { id: 'social-media', name: '📱 Social Media Pack', type: 'social-media', categories: ['statics', 'videos'], description: 'Social media content package' },
  { id: 'toolkit', name: '🧰 Brand Toolkit', type: 'toolkit', categories: ['statics', 'videos', 'cgi', 'animation'], description: 'Complete brand toolkit' },
  { id: 'reels', name: '🎞️ Reels/Shorts', type: 'reels', categories: ['videos'], description: 'Short-form vertical content' },
];

const ASPECT_RATIOS = { landscape: 16/10, square: 1, portrait: 10/16 };
const CARD_SIZES = { S: 160, M: 220, L: 300 };

const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
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
          <span style={{ fontSize: '24px', opacity: 0.3 }}>🖼️</span>
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

// Skeleton Loader Component
const Skeleton = ({ width = '100%', height = 20, borderRadius = 4, style = {} }) => (
  <div style={{ 
    width, 
    height, 
    borderRadius,
    background: 'linear-gradient(90deg, #1a1a2e 25%, #252538 50%, #1a1a2e 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    ...style
  }} />
);

// Card Skeleton for loading states
const CardSkeleton = ({ aspectRatio = 1, theme = 'dark' }) => {
  const t = THEMES[theme];
  return (
  <div style={{ 
    background: t.bgTertiary, 
    borderRadius: '12px', 
    overflow: 'hidden',
    border: `1px solid ${t.border}`
  }}>
    <div style={{ paddingBottom: `${aspectRatio * 100}%`, position: 'relative' }}>
      <Skeleton width="100%" height="100%" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} />
    </div>
    <div style={{ padding: '12px' }}>
      <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
      <Skeleton width="40%" height={10} />
    </div>
  </div>
);
};

const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const RoleBadge = ({ role }) => { const r = TEAM_ROLES[role] || CORE_ROLES[role] || { label: role, color: '#6366f1' }; return <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>{r.icon || '👤'} {r.label}</span>; };
const Avatar = ({ user, size = 32 }) => { const c = (TEAM_ROLES[user?.role] || CORE_ROLES[user?.role])?.color || '#6366f1'; return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${c}40, ${c}20)`, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, flexShrink: 0 }}>{user?.avatar || user?.firstName?.[0] || '?'}</div>; };

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
const Modal = ({ title, onClose, children, wide, theme = 'dark' }) => {
  const t = THEMES[theme];
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => { 
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? 0 : '20px', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div style={{ background: t.modalBg, borderRadius: isMobile ? 0 : '16px', border: isMobile ? 'none' : `1px solid ${t.border}`, width: '100%', maxWidth: isMobile ? '100%' : (wide ? '1200px' : '550px'), height: isMobile ? '100%' : (wide ? '85vh' : 'auto'), maxHeight: isMobile ? '100%' : '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: t.shadow }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${t.border}`, background: t.bgTertiary, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '10px', color: t.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: t.bgCard, border: `1px solid ${t.border}`, color: t.textSecondary, width: '32px', height: '32px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icons.close(t.textSecondary)}</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: t.bgSecondary }}>{children}</div>
      </div>
    </div>
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
    icon: '👋',
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
    icon: '🎬',
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
    icon: '📦',
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
    icon: '🎨',
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
    icon: '👔',
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
    if (result.success) console.log('📧 Email sent:', subject);
    return result.success;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
};

const Toast = ({ message, type, onClose }) => { useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]); return <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', padding: '14px 24px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '10px', color: '#fff', fontSize: '13px', fontWeight: '500', zIndex: 2000, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>{message}</div>; };
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

const VideoThumbnail = ({ src, thumbnail, duration, style }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const [scrubPos, setScrubPos] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  
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
      {/* Show thumbnail first if available */}
      {thumbnail && !isLoaded && (
        <img src={thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {!thumbnail && !isLoaded && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '24px' }}>🎬</span></div>}
      {inView && (
        <video 
          ref={videoRef} 
          src={src} 
          muted 
          preload="metadata" 
          playsInline
          onLoadedData={() => setIsLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isLoaded ? 1 : 0, transition: 'opacity 0.2s' }} 
        />
      )}
      {isHovering && isLoaded && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scrubPos * 100}%`, width: '2px', background: '#ef4444', pointerEvents: 'none' }} />}
      {duration && <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{formatDuration(duration)}</div>}
      {!isLoaded && <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '9px' }}>🎬</div>}
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

  // Save theme to localStorage and apply to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);
  
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
            icon: '🚨',
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
            icon: '⚠️',
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
            icon: '⏰',
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
            icon: '📅',
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
              icon: '⚠️',
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
                icon: '💤',
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

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => { loadData(); }, []);
  
  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Cmd/Ctrl + K = Open Global Search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
        return;
      }
      
      // Escape = Close search
      if (e.key === 'Escape' && showGlobalSearch) {
        setShowGlobalSearch(false);
        setGlobalSearchQuery('');
        return;
      }
      
      // Don't trigger if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Quick navigation with numbers
      if (e.key === '1' && !e.metaKey && !e.ctrlKey) { setView('dashboard'); }
      if (e.key === '2' && !e.metaKey && !e.ctrlKey) { setView('tasks'); }
      if (e.key === '3' && !e.metaKey && !e.ctrlKey) { setView('projects'); }
      if (e.key === '4' && !e.metaKey && !e.ctrlKey) { setView('team'); }
      if (e.key === '5' && !e.metaKey && !e.ctrlKey) { setView('calendar'); }
      
      // N = New project (if producer and on projects view)
      if (e.key === 'n' && view === 'projects' && isProducer) {
        // Handled in ProjectsList
      }
      
      // T = Toggle theme
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
      }
      
      // / = Open search
      if (e.key === '/') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
      
      // ? = Show keyboard shortcuts help
      if (e.key === '?' && e.shiftKey) {
        showToast('Keys: 1-4 Nav, / Search, T Theme, Esc Close', 'info');
      }
    };
    
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [view, isProducer, showGlobalSearch]);
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
  const refreshProject = async () => { const all = await getProjects(); setProjects(all); };

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
            icon: '📋',
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
      showToast('All subtasks completed! 🎉', 'success');
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
          <span style={{ fontSize: '18px' }}>🔔</span>
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
            <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 199 }} />
            <div style={{
              position: 'fixed',
              top: isMobile ? '60px' : '50px',
              left: isMobile ? '10px' : '210px',
              right: isMobile ? '10px' : 'auto',
              width: isMobile ? 'auto' : '360px',
              maxHeight: '480px',
              background: '#1a1a2e',
              border: `1px solid ${t.border}`,
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              zIndex: 200,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{ 
                padding: '14px 16px', 
                borderBottom: '1px solid #2a2a3e', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}>
                <span style={{ fontWeight: '600', fontSize: '14px' }}>Notifications</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} style={{ background: 'transparent', border: 'none', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>
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
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔕</div>
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
                        borderBottom: '1px solid #2a2a3e',
                        cursor: 'pointer',
                        background: notif.read ? 'transparent' : 'rgba(99,102,241,0.08)',
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
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>
                            {formatTimeAgo(notif.timestamp)}
                          </div>
                        </div>
                        {!notif.read && (
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', flexShrink: 0, marginTop: '6px' }} />
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
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1100, display: 'flex', justifyContent: 'center', paddingTop: '100px' }} onClick={() => { setShowGlobalSearch(false); setGlobalSearchQuery(''); }}>
        <div style={{ width: '600px', maxWidth: '90vw', background: t.bgTertiary, borderRadius: '16px', border: `1px solid ${t.border}`, overflow: 'hidden', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          {/* Search Input */}
          <div style={{ padding: '16px', borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '20px' }}>🔍</span>
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
                        <span style={{ fontSize: '20px' }}>📁</span>
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
                          <span style={{ fontSize: '20px' }}>{a.type === 'video' ? '🎬' : a.type === 'image' ? '🖼️' : '📄'}</span>
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
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
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
    
    const allAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted && a.dueDate).map(a => ({ ...a, projectName: p.name, projectId: p.id })));
    
    // Generate calendar days
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    const days = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(i);
    
    const getAssetsForDay = (day) => {
      if (!day) return [];
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return allAssets.filter(a => a.dueDate?.startsWith(dateStr));
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: t.text }}>📅 Calendar</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} style={{ padding: '8px 14px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, cursor: 'pointer' }}>←</button>
            <span style={{ fontSize: '14px', fontWeight: '600', color: t.text, minWidth: '140px', textAlign: 'center' }}>
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} style={{ padding: '8px 14px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, cursor: 'pointer' }}>→</button>
            <button onClick={() => setCurrentMonth(new Date())} style={{ padding: '8px 14px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '12px' }}>Today</button>
          </div>
        </div>
        
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', marginBottom: '8px' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: '600', color: t.textMuted }}>{d}</div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: t.border, border: `1px solid ${t.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          {days.map((day, idx) => {
            const dayAssets = getAssetsForDay(day);
            const isPast = day && new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            
            return (
              <div 
                key={idx}
                onDragOver={e => { if (day) e.preventDefault(); }}
                onDrop={() => handleDrop(day)}
                style={{ 
                  minHeight: '100px', 
                  padding: '8px', 
                  background: isToday(day) ? 'rgba(99,102,241,0.1)' : t.bgTertiary,
                  opacity: day ? 1 : 0.3
                }}
              >
                {day && (
                  <>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: isToday(day) ? '700' : '500',
                      color: isToday(day) ? '#6366f1' : isPast ? t.textMuted : t.text,
                      marginBottom: '6px'
                    }}>
                      {day}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {dayAssets.slice(0, 3).map(a => (
                        <div 
                          key={a.id}
                          draggable
                          onDragStart={() => setDraggedAsset(a)}
                          onDragEnd={() => setDraggedAsset(null)}
                          onClick={() => { setSelectedProjectId(a.projectId); setView('projects'); }}
                          style={{ 
                            padding: '4px 6px', 
                            background: a.status === 'approved' ? 'rgba(34,197,94,0.2)' : isPast ? 'rgba(239,68,68,0.2)' : 'rgba(99,102,241,0.2)',
                            borderRadius: '4px', 
                            fontSize: '10px', 
                            cursor: 'grab',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: t.text
                          }}
                        >
                          {a.name}
                        </div>
                      ))}
                      {dayAssets.length > 3 && (
                        <div style={{ fontSize: '10px', color: t.textMuted }}>+{dayAssets.length - 3} more</div>
                      )}
                    </div>
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
      { id: 'pending', title: 'Pending', icon: '⏳', color: '#fbbf24' },
      { id: 'in-progress', title: 'In Progress', icon: '⚡', color: '#8b5cf6' },
      { id: 'review-ready', title: 'Review', icon: '👁️', color: '#a855f7' },
      { id: 'revision', title: 'Revision', icon: '🔄', color: '#f97316' },
      { id: 'approved', title: 'Approved', icon: '✓', color: '#22c55e' },
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
                <span style={{ fontSize: '12px' }}>{col.icon}</span>
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
                    color: 'rgba(255,255,255,0.3)', 
                    fontSize: '9px',
                    border: '1px dashed rgba(255,255,255,0.1)',
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
                            {'⭐'.repeat(a.rating)}
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
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2a2a3e' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#ef4444' }}>◀ v{version1.version}</span>
            <span style={{ fontSize: '14px', color: '#fff' }}>Compare</span>
            <span style={{ fontSize: '14px', color: '#22c55e' }}>v{version2.version} ▶</span>
          </div>
          <button onClick={onClose} style={{ background: t.bgCard, border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}>×</button>
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
    const sidebarWidth = sidebarCollapsed ? '60px' : '200px';
    const navItems = [
      { id: 'dashboard', icon: 'dashboard', label: 'Dashboard' }, 
      { id: 'tasks', icon: 'tasks', label: 'My Tasks' }, 
      { id: 'projects', icon: 'folder', label: 'Projects' },
      { id: 'calendar', icon: 'calendar', label: 'Calendar' },
      ...(isClientView ? [{ id: 'downloads', icon: 'download', label: 'Downloads' }] : []),
      ...(isProducer ? [{ id: 'team', icon: 'users', label: 'Team' }] : [])
    ];
    
    return (
      <div style={{ 
        width: isMobile ? '100%' : sidebarWidth, 
        background: t.bgSecondary, 
        borderRight: isMobile ? 'none' : `1px solid ${t.border}`, 
        borderBottom: isMobile ? `1px solid ${t.border}` : 'none', 
        height: isMobile ? 'auto' : '100vh', 
        position: isMobile ? 'relative' : 'fixed', 
        left: 0, 
        top: 0, 
        display: 'flex', 
        flexDirection: isMobile ? 'row' : 'column', 
        zIndex: 100,
        transition: 'width 0.2s ease'
      }}>
        {/* Logo Section */}
        {!isMobile && (
          <div style={{ padding: sidebarCollapsed ? '16px 10px' : '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
            {!sidebarCollapsed && (
              <div style={{ flex: 1 }}>
                {companySettings.logoDark && theme === 'dark' ? (
                  <img src={companySettings.logoDark} alt={companySettings.name} style={{ height: '28px', objectFit: 'contain' }} />
                ) : companySettings.logoLight && theme === 'light' ? (
                  <img src={companySettings.logoLight} alt={companySettings.name} style={{ height: '28px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: '16px', fontWeight: '700', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{companySettings.name}</div>
                )}
                <div style={{ fontSize: '9px', color: t.textMuted, marginTop: '2px' }}>Production Hub</div>
              </div>
            )}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{ 
                background: t.bgCard, 
                border: `1px solid ${t.border}`, 
                borderRadius: '6px', 
                padding: '6px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {sidebarCollapsed ? Icons.chevronRight(t.textSecondary) : Icons.chevronLeft(t.textSecondary)}
            </button>
          </div>
        )}
        
        {/* Search Button */}
        {!isMobile && !sidebarCollapsed && (
          <div style={{ padding: '12px 10px' }}>
            <button 
              onClick={() => setShowGlobalSearch(true)}
              style={{ 
                width: '100%', 
                padding: '10px 12px', 
                background: t.bgInput, 
                border: `1px solid ${t.border}`, 
                borderRadius: '8px', 
                color: t.textMuted, 
                fontSize: '12px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textAlign: 'left'
              }}
            >
              {Icons.search(t.textMuted)}
              <span style={{ flex: 1 }}>Search</span>
              <span style={{ fontSize: '10px', background: t.bgTertiary, padding: '2px 6px', borderRadius: '4px', color: t.textMuted }}>/</span>
            </button>
          </div>
        )}
        
        {/* Collapsed Search */}
        {!isMobile && sidebarCollapsed && (
          <div style={{ padding: '12px 10px' }}>
            <button 
              onClick={() => setShowGlobalSearch(true)}
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: t.bgInput, 
                border: `1px solid ${t.border}`, 
                borderRadius: '8px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {Icons.search(t.textMuted)}
            </button>
          </div>
        )}
        
        {/* Navigation */}
        <nav style={{ flex: 1, padding: isMobile ? '10px' : '8px 10px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '4px', alignItems: isMobile ? 'center' : 'stretch' }}>
          {isMobile && <NotificationPanel />}
          {isMobile && <button onClick={() => setShowGlobalSearch(true)} style={{ padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer' }}>{Icons.search(t.textSecondary)}</button>}
          {navItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => { setView(item.id); setSelectedProjectId(null); }} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                padding: sidebarCollapsed ? '10px' : '10px 12px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '13px', 
                fontWeight: view === item.id ? '500' : '400',
                background: view === item.id ? `${t.primary}15` : 'transparent', 
                color: view === item.id ? t.primary : t.textSecondary,
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                transition: 'all 0.15s'
              }}
              title={sidebarCollapsed ? item.label : ''}
            >
              {Icons[item.icon] && Icons[item.icon](view === item.id ? t.primary : t.textSecondary)}
              {!isMobile && !sidebarCollapsed && <span>{item.label}</span>}
            </div>
          ))}
        </nav>
        
        {/* Bottom Section */}
        {!isMobile && (
          <div style={{ padding: sidebarCollapsed ? '10px' : '14px', borderTop: `1px solid ${t.border}` }}>
            {/* Notification Icon (collapsed) */}
            {sidebarCollapsed && (
              <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
                <NotificationPanel />
              </div>
            )}
            
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ 
                width: '100%',
                padding: sidebarCollapsed ? '10px' : '8px 12px', 
                background: t.bgCard, 
                border: `1px solid ${t.border}`, 
                borderRadius: '8px', 
                color: t.textSecondary, 
                fontSize: '11px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                gap: '8px',
                marginBottom: '10px'
              }}
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              {theme === 'dark' ? Icons.sun(t.textSecondary) : Icons.moon(t.textSecondary)}
              {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            
            {/* User Info */}
            {!sidebarCollapsed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <Avatar user={userProfile} size={32} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: t.text }}>{userProfile?.firstName}</div>
                    <div style={{ fontSize: '10px', color: t.textMuted }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div>
                  </div>
                  {!sidebarCollapsed && <NotificationPanel />}
                </div>
                {isProducer && (
                  <button 
                    onClick={() => setShowCompanySettings(true)} 
                    style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}
                  >
                    {Icons.settings(t.textSecondary)}
                    <span>Company Settings</span>
                  </button>
                )}
                <button onClick={signOut} style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  {Icons.logout(t.textSecondary)}
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                {isProducer && (
                  <button onClick={() => setShowCompanySettings(true)} style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }} title="Company Settings">
                    {Icons.settings(t.textSecondary)}
                  </button>
                )}
                <button onClick={signOut} style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Sign Out">
                  {Icons.logout(t.textSecondary)}
                </button>
              </>
            )}
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
    
    const stats = [
      { label: 'Active Projects', value: activeProjects.length, icon: '📁', color: '#6366f1' },
      { label: 'Due This Week', value: dueThisWeek.length, icon: '📅', color: '#f59e0b' },
      { label: 'Overdue', value: overdueAssets.length, icon: '🚨', color: '#ef4444', alert: overdueAssets.length > 0 },
      { label: 'Pending Review', value: pendingReview.length, icon: '👁️', color: '#a855f7' },
      { label: 'In Progress', value: inProgress.length, icon: '⚡', color: '#22c55e' },
      { label: 'Completed', value: completedProjects.length, icon: '✓', color: '#64748b' },
    ];
    
    const recentActivity = projects.flatMap(p => (p.activityLog || []).map(a => ({ ...a, projectName: p.name, projectId: p.id }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    
    // Team workload
    const teamWorkload = [...coreTeam, ...freelancers].map(member => {
      const assignedAssets = allAssets.filter(a => a.assignedTo === member.id || a.assignedTo === member.email);
      const activeAssigned = assignedAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
      return { ...member, totalAssigned: activeAssigned.length, overdue: activeAssigned.filter(a => a.dueDate && new Date(a.dueDate) < today).length };
    }).filter(m => m.totalAssigned > 0).sort((a, b) => b.totalAssigned - a.totalAssigned);
    
    return (
      <div style={{ overflow: 'auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: isMobile ? '20px' : '24px', fontWeight: '700' }}>Welcome, {userProfile?.firstName}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: t.textMuted }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: s.alert ? 'rgba(239,68,68,0.1)' : t.bgCard, borderRadius: '10px', border: s.alert ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${t.border}`, padding: isMobile ? '12px' : '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', borderRadius: '8px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '14px' : '18px' }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: isMobile ? '9px' : '10px', color: t.textMuted }}>{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Alerts Section */}
        {(overdueAssets.length > 0 || pendingReview.length > 0) && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: isMobile ? '12px' : '16px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13px', color: '#ef4444' }}>⚠️ Needs Attention</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {overdueAssets.slice(0, 5).map(a => (
                <span key={a.id} style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.15)', borderRadius: '6px', fontSize: '10px', color: '#fca5a5' }}>
                  🚨 {a.name.length > 15 ? a.name.substring(0, 15) + '...' : a.name}
                </span>
              ))}
              {pendingReview.slice(0, 3).map(a => (
                <span key={a.id} style={{ padding: '5px 10px', background: 'rgba(168,85,247,0.15)', borderRadius: '6px', fontSize: '10px', color: '#c4b5fd' }}>
                  👁️ {a.name.length > 15 ? a.name.substring(0, 15) + '...' : a.name}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
          {/* Active Projects */}
          <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: isMobile ? '12px' : '16px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '13px' }}>📁 Active ({activeProjects.length})</h3>
            </div>
            <div style={{ maxHeight: isMobile ? '200px' : '280px', overflowY: 'auto' }}>
              {activeProjects.slice(0, 5).map(p => {
                const pAssets = (p.assets || []).filter(a => !a.deleted);
                const pOverdue = pAssets.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'delivered').length;
                return (
                  <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', border: pOverdue > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '500', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize: '10px', color: t.textMuted }}>{p.client} • {pAssets.length} assets</div>
                    </div>
                    {pOverdue > 0 && <span style={{ padding: '2px 6px', background: '#ef4444', borderRadius: '4px', fontSize: '9px', flexShrink: 0, marginLeft: '6px' }}>{pOverdue}⚠️</span>}
                  </div>
                );
              })}
              {activeProjects.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '11px' }}>No active projects</div>}
            </div>
          </div>
          
          {/* Team Workload */}
          <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: isMobile ? '12px' : '16px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13px' }}>👥 Team Workload</h3>
            <div style={{ maxHeight: isMobile ? '200px' : '280px', overflowY: 'auto' }}>
              {teamWorkload.slice(0, 5).map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px' }}>
                  <Avatar user={m} size={28} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: '9px', color: t.textMuted }}>{TEAM_ROLES[m.role]?.label || m.role}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: m.overdue > 0 ? '#ef4444' : '#6366f1' }}>{m.totalAssigned}</div>
                    {m.overdue > 0 && <div style={{ fontSize: '9px', color: '#ef4444' }}>{m.overdue} late</div>}
                  </div>
                </div>
              ))}
              {teamWorkload.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '11px' }}>No assigned work</div>}
            </div>
          </div>
          
          {/* Recent Activity */}
          <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: isMobile ? '12px' : '16px', minWidth: 0 }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '13px' }}>🔔 Recent Activity</h3>
            <div style={{ maxHeight: isMobile ? '200px' : '280px', overflowY: 'auto' }}>
              {recentActivity.map(a => (
                <div key={a.id} onClick={() => { setSelectedProjectId(a.projectId); setView('projects'); }} style={{ display: 'flex', gap: '8px', padding: '8px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '5px', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                    <div style={{ fontSize: '9px', color: t.textMuted }}>{a.projectName} • {formatTimeAgo(a.timestamp)}</div>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '11px' }}>No activity</div>}
            </div>
          </div>
        </div>
        
        {/* Completed Projects Section */}
        {completedProjects.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: t.textSecondary }}>✓ Completed Projects ({completedProjects.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
              {completedProjects.slice(0, 4).map(p => (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ padding: '12px', background: t.bgTertiary, borderRadius: '10px', border: `1px solid ${t.border}`, cursor: 'pointer', opacity: 0.7 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: t.textMuted }}>{p.client}</div>
                </div>
              ))}
            </div>
          </div>
        )}
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
      { id: 'pending', title: 'To Do', icon: '📋', color: '#6366f1' },
      { id: 'in-progress', title: 'In Progress', icon: '⚡', color: '#f59e0b' },
      { id: 'review', title: 'Review', icon: '👀', color: '#8b5cf6' },
      { id: 'done', title: 'Done', icon: '✅', color: '#22c55e' }
    ];
    
    // Priority colors and icons
    const priorityColors = { urgent: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const priorityIcons = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
    
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
          draggable={task.type !== 'auto'}
          onDragStart={(e) => handleDragStart(e, task)}
          onMouseEnter={() => setHoveredTask(task.id)}
          onMouseLeave={() => setHoveredTask(null)}
          style={{ 
            background: t.bgCard, 
            borderRadius: '10px', 
            border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.5)' : isDragging ? t.primary : t.border}`,
            marginBottom: '8px',
            overflow: 'hidden',
            transition: 'all 0.2s',
            opacity: isDragging ? 0.5 : 1,
            cursor: task.type === 'auto' ? 'default' : 'grab',
            transform: isHovered ? 'translateY(-2px)' : 'none',
            boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          {/* Priority stripe */}
          <div style={{ height: '3px', background: priorityColors[task.priority] || priorityColors.medium }} />
          
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
                    cursor: task.type === 'auto' ? 'default' : 'text'
                  }}
                >
                  {task.type === 'feedback' && '🔄 '}
                  {task.type === 'auto' && '📁 '}
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
                  📅 {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {totalSubtasks > 0 && (
                <span style={{ 
                  fontSize: '10px', 
                  color: completedSubtasks === totalSubtasks ? t.success : t.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px'
                }}>
                  ☑️ {completedSubtasks}/{totalSubtasks}
                </span>
              )}
              {(task.attachments || []).length > 0 && (
                <span style={{ fontSize: '10px', color: t.textMuted }}>📎 {task.attachments.length}</span>
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
                          📎 {att.name}
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
                      📎 Add File
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
                    >🗑️ Delete</button>
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
            background: isDropTarget ? `${column.color}10` : t.bgSecondary,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            border: isDropTarget ? `2px dashed ${column.color}` : `1px solid ${t.border}`,
            transition: 'all 0.2s'
          }}
        >
          {/* Column header */}
          <div style={{ 
            padding: '14px 16px', 
            borderBottom: `1px solid ${t.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>{column.icon}</span>
            <span style={{ fontWeight: '600', fontSize: '13px', color: t.text }}>{column.title}</span>
            <span style={{ 
              marginLeft: 'auto',
              background: `${column.color}20`,
              color: column.color,
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: '600'
            }}>{columnTasks.length}</span>
          </div>
          
          {/* Tasks */}
          <div style={{ 
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
                opacity: 0.7
              }}>
                {isDropTarget ? 'Drop here' : 'No tasks'}
              </div>
            ) : (
              columnTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
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
              <Btn theme={theme} onClick={() => setShowTemplates(true)} small outline>📋 Templates</Btn>
              <Btn theme={theme} onClick={() => setShowAddTask(true)} small>+ New Task</Btn>
              {isProducer && <Btn theme={theme} onClick={() => setShowSettings(true)} small outline>⚙️</Btn>}
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
                      ✨ Suggested subtasks (click to add)
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
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'my', label: 'My Tasks' },
                { id: 'team', label: 'Team' },
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'overdue', label: `Overdue ${overdueTasks.length > 0 ? `(${overdueTasks.length})` : ''}` },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTaskTab(tab.id)}
                  style={{
                    padding: '8px 14px',
                    background: taskTab === tab.id ? t.primary : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: taskTab === tab.id ? '#fff' : t.textSecondary,
                    fontSize: '12px',
                    fontWeight: taskTab === tab.id ? '600' : '400',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Filters & View Toggle */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  background: t.bgInput,
                  border: `1px solid ${t.border}`,
                  borderRadius: '8px',
                  color: t.text,
                  fontSize: '12px',
                  outline: 'none'
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
                    <option value="personal">👤 Personal</option>
                    <option value="team">👥 Team</option>
                    <option value="project">📁 Project</option>
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
                    ✨ AI Suggested Subtasks
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
                  <span style={{ fontSize: '12px', color: t.text }}>🔁 Recurring task</span>
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
      </div>
    );
  };

  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newProj, setNewProj] = useState({ name: '', client: '', type: 'photoshoot', deadline: '', selectedCats: ['statics'] });
    const [creating, setCreating] = useState(false);
    const [projectTab, setProjectTab] = useState('active'); // 'active' or 'completed'
    
    // Filter by search and tab
    const activeProjects = projects.filter(p => p.status === 'active' && (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase())));
    const completedProjects = projects.filter(p => p.status === 'completed' && (!search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase())));
    const displayProjects = projectTab === 'active' ? activeProjects : completedProjects;

    const handleCreate = async () => {
      if (!newProj.name || !newProj.client) { showToast('Fill name & client', 'error'); return; }
      setCreating(true);
      try {
        const cats = DEFAULT_CATEGORIES.filter(c => newProj.selectedCats.includes(c.id));
        const proj = await createProject({ name: newProj.name, client: newProj.client, type: newProj.type, deadline: newProj.deadline, status: 'active', categories: cats, assets: [], assignedTeam: [{ odId: userProfile.id, odRole: userProfile.role, isOwner: true }], clientContacts: [], shareLinks: [], activityLog: [{ id: generateId(), type: 'created', message: `Project created by ${userProfile.name}`, userId: userProfile.id, timestamp: new Date().toISOString() }], createdBy: userProfile.id, createdByName: userProfile.name, selectionConfirmed: false, workflowPhase: 'selection' });
        setProjects([proj, ...projects]);
        setNewProj({ name: '', client: '', type: 'photoshoot', deadline: '', selectedCats: ['statics'] });
        setShowCreate(false);
        showToast('Project created!', 'success');
      } catch (e) { showToast('Failed', 'error'); }
      setCreating(false);
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

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input theme={theme} value={search} onChange={setSearch} placeholder="🔍 Search..." style={{ width: isMobile ? '140px' : '180px' }} />
            {isProducer && <Btn theme={theme} onClick={() => setShowCreate(true)}>+ New</Btn>}
          </div>
        </div>
        
        {/* Active / Completed Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setProjectTab('active')} style={{ padding: '10px 20px', background: projectTab === 'active' ? t.primary : t.bgCard, border: `1px solid ${projectTab === 'active' ? t.primary : t.border}`, borderRadius: '8px', color: projectTab === 'active' ? '#fff' : t.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📂 Active <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{activeProjects.length}</span>
          </button>
          <button onClick={() => setProjectTab('completed')} style={{ padding: '10px 20px', background: projectTab === 'completed' ? t.success : t.bgCard, border: `1px solid ${projectTab === 'completed' ? t.success : t.border}`, borderRadius: '8px', color: projectTab === 'completed' ? '#fff' : t.textSecondary, fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✅ Completed <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{completedProjects.length}</span>
          </button>
        </div>
        
        {displayProjects.length === 0 ? (
          <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>{projectTab === 'active' ? '📁' : '✅'}</div>
            <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>{projectTab === 'active' ? 'No Active Projects' : 'No Completed Projects'}</h3>
            <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '20px' }}>{projectTab === 'active' ? 'Create your first project' : 'Complete a project to see it here'}</p>
            {isProducer && projectTab === 'active' && <Btn theme={theme} onClick={() => setShowCreate(true)}>+ Create Project</Btn>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {displayProjects.map(p => {
              const cnt = p.assets?.filter(a => !a.deleted).length || 0;
              const approved = p.assets?.filter(a => !a.deleted && ['approved', 'delivered'].includes(a.status)).length || 0;
              const notifs = getProjectNotifs(p);
              const totalNotifs = notifs.pendingReview + notifs.newFeedback + notifs.changesRequested + notifs.newVersions;
              
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ background: t.bgTertiary, borderRadius: '12px', border: totalNotifs > 0 ? '1px solid rgba(251,191,36,0.4)' : `1px solid ${t.border}`, padding: '18px', cursor: 'pointer', position: 'relative' }}>
                  {totalNotifs > 0 && (
                    <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '22px', height: '22px', background: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', border: `2px solid ${t.bgSecondary}`, color: '#fff' }}>{totalNotifs}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div><div style={{ fontWeight: '600', fontSize: '15px', color: t.text }}>{p.name}</div><div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>{p.client}</div></div>
                    {isProducer && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={(e) => handleToggleProjectStatus(p.id, e)} title={p.status === 'active' ? 'Mark Complete' : 'Reopen'} style={{ padding: '6px 10px', background: p.status === 'active' ? t.bgCard : '#22c55e', border: `1px solid ${t.border}`, borderRadius: '6px', color: p.status === 'active' ? t.textSecondary : '#fff', fontSize: '11px', cursor: 'pointer' }}>
                          {p.status === 'active' ? '✓ Complete' : '↩ Reopen'}
                        </button>
                        <button onClick={(e) => handleDeleteProject(p.id, e)} title="Delete Project" style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{cnt} assets</span>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: p.type === 'photoshoot' ? 'rgba(236,72,153,0.15)' : 'rgba(249,115,22,0.15)', color: p.type === 'photoshoot' ? '#ec4899' : '#f97316' }}>{p.type === 'photoshoot' ? '📸' : '🎬'} {p.type}</span>
                    {notifs.pendingReview > 0 && <NotifBadge count={notifs.pendingReview} icon="👁️" color="#a855f7" title="Pending review" />}
                    {notifs.newFeedback > 0 && <NotifBadge count={notifs.newFeedback} icon="💬" color="#ef4444" title="New feedback" />}
                    {notifs.changesRequested > 0 && <NotifBadge count={notifs.changesRequested} icon="⚠️" color="#f97316" title="Changes requested" />}
                    {notifs.newVersions > 0 && <NotifBadge count={notifs.newVersions} icon="🆕" color="#22c55e" title="New versions" />}
                    {p.selectionConfirmed && <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓ Selection Done</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, background: t.bgCard, borderRadius: '4px', height: '6px' }}><div style={{ width: `${cnt ? (approved/cnt)*100 : 0}%`, height: '100%', background: t.primary, borderRadius: '4px' }} /></div>
                    <span style={{ fontSize: '11px', color: t.textMuted }}>{cnt ? Math.round((approved/cnt)*100) : 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showCreate && (
          <Modal theme={theme} title="Create Project" onClose={() => setShowCreate(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Name *</label><Input theme={theme} value={newProj.name} onChange={v => setNewProj({ ...newProj, name: v })} placeholder="e.g., RasikaD Photoshoot" /></div>
              <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Client *</label><Input theme={theme} value={newProj.client} onChange={v => setNewProj({ ...newProj, client: v })} placeholder="e.g., Client Name" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Type</label><Select theme={theme} value={newProj.type} onChange={v => setNewProj({ ...newProj, type: v })}><option value="photoshoot">📸 Photoshoot</option><option value="ad-film">🎬 Ad Film</option><option value="toolkit">🧰 Toolkit</option><option value="product-video">📦 Product Video</option><option value="social-media">📱 Social Media</option><option value="corporate">🏢 Corporate Video</option><option value="music-video">🎵 Music Video</option><option value="brand-film">🎯 Brand Film</option><option value="reels">🎞️ Reels/Shorts</option><option value="ecommerce">🛒 E-Commerce</option><option value="event">🎪 Event Coverage</option><option value="documentary">📽️ Documentary</option></Select></div>
                <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Deadline</label><Input theme={theme} type="date" value={newProj.deadline} onChange={v => setNewProj({ ...newProj, deadline: v })} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Categories</label><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{DEFAULT_CATEGORIES.map(cat => <div key={cat.id} onClick={() => setNewProj(p => ({ ...p, selectedCats: p.selectedCats.includes(cat.id) ? p.selectedCats.filter(x => x !== cat.id) : [...p.selectedCats, cat.id] }))} style={{ padding: '8px 12px', background: newProj.selectedCats.includes(cat.id) ? `${cat.color}30` : t.bgInput, border: `1px solid ${newProj.selectedCats.includes(cat.id) ? cat.color : t.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: newProj.selectedCats.includes(cat.id) ? cat.color : t.textSecondary }}>{cat.icon} {cat.name}</div>)}</div></div>
              <Btn theme={theme} onClick={handleCreate} disabled={!newProj.name || !newProj.client || creating}>{creating ? '⏳...' : '🚀 Create'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  const TeamManagement = () => {
    const [tab, setTab] = useState('core');
    const [showAdd, setShowAdd] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
      if (!newUser.name || !newUser.email || !newUser.password) { setError('Fill required fields'); return; }
      if (newUser.password.length < 6) { setError('Password min 6 chars'); return; }
      setCreating(true); setError('');
      try {
        const cred = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
        await updateProfile(cred.user, { displayName: newUser.name });
        await createUser(cred.user.uid, { email: newUser.email, name: newUser.name, firstName: newUser.name.split(' ')[0], role: newUser.type === 'client' ? 'client' : newUser.role, phone: newUser.phone, avatar: newUser.type === 'client' ? '👔' : (TEAM_ROLES[newUser.role]?.icon || '👤'), isCore: newUser.type === 'core', isFreelancer: newUser.type === 'freelancer', isClient: newUser.type === 'client', company: newUser.company, createdBy: userProfile.id });
        await loadData();
        setNewUser({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '' });
        setShowAdd(false);
        showToast('Added!', 'success');
      } catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'Email exists' : e.message); }
      setCreating(false);
    };

    const renderUser = u => {
      // Find projects where this user is assigned
      const userProjects = projects.filter(p => {
        const isTeamMember = (p.assignedTeam || []).some(t => t.odId === u.id);
        const hasAssignedAssets = (p.assets || []).some(a => a.assignedTo === u.id || a.assignedTo === u.email);
        return isTeamMember || hasAssignedAssets;
      });
      const assignedAssets = projects.flatMap(p => (p.assets || []).filter(a => !a.deleted && (a.assignedTo === u.id || a.assignedTo === u.email)));
      const activeAssets = assignedAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
      const today = new Date(); today.setHours(0,0,0,0);
      const overdueAssets = activeAssets.filter(a => a.dueDate && new Date(a.dueDate) < today);
      
      return (
        <div key={u.id} style={{ background: t.bgInput, borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', border: `1px solid ${t.border}` }}>
          {/* User Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderBottom: userProjects.length > 0 ? '1px solid #1e1e2e' : 'none' }}>
            <Avatar user={u} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{u.name}</div>
              <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '4px' }}>{u.email}</div>
              <RoleBadge role={u.role} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: overdueAssets.length > 0 ? '#ef4444' : activeAssets.length > 0 ? '#6366f1' : 'rgba(255,255,255,0.3)' }}>
                {activeAssets.length}
              </div>
              <div style={{ fontSize: '10px', color: t.textMuted }}>
                {overdueAssets.length > 0 ? `${overdueAssets.length} overdue` : 'active tasks'}
              </div>
            </div>
          </div>
          
          {/* Projects */}
          {userProjects.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#0a0a0f' }}>
              <div style={{ fontSize: '10px', color: t.textMuted, marginBottom: '8px' }}>ASSIGNED PROJECTS</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {userProjects.map(p => {
                  const pAssets = (p.assets || []).filter(a => !a.deleted && (a.assignedTo === u.id || a.assignedTo === u.email));
                  const pActive = pAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => { setSelectedProjectId(p.id); setView('projects'); }}
                      style={{ 
                        padding: '8px 12px', 
                        background: t.bgTertiary, 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        border: `1px solid ${t.border}`,
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <span>{p.name}</span>
                      {pActive.length > 0 && (
                        <span style={{ 
                          padding: '2px 6px', 
                          background: '#6366f1', 
                          borderRadius: '4px', 
                          fontSize: '9px' 
                        }}>
                          {pActive.length}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Team</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: t.textMuted }}>
              {coreTeam.length + freelancers.length} team members • {clients.length} clients
            </p>
          </div>
          {isProducer && <Btn theme={theme} onClick={() => setShowAdd(true)}>+ Add</Btn>}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>{[{ id: 'core', label: '👑 Core', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(tabItem => <button key={tabItem.id} onClick={() => setTab(tabItem.id)} style={{ padding: '10px 16px', background: tab === tabItem.id ? t.primary : t.bgCard, border: `1px solid ${tab === tabItem.id ? t.primary : t.border}`, borderRadius: '8px', color: tab === tabItem.id ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>{tabItem.label} ({tabItem.data.length})</button>)}</div>
        <div>
          {tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, textAlign: 'center', padding: '40px', color: t.textMuted, fontSize: '12px' }}>No core team members</div>)}
          {tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, textAlign: 'center', padding: '40px', color: t.textMuted, fontSize: '12px' }}>No freelancers</div>)}
          {tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, textAlign: 'center', padding: '40px', color: t.textMuted, fontSize: '12px' }}>No clients</div>)}
        </div>
        {showAdd && (
          <Modal theme={theme} title="Add Team Member" onClose={() => { setShowAdd(false); setError(''); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px' }}>{['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '12px', background: newUser.type === type ? t.primary : t.bgCard, border: `1px solid ${newUser.type === type ? t.primary : t.border}`, borderRadius: '8px', color: newUser.type === type ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>{type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}</button>)}</div>
              <Input theme={theme} value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} placeholder="Name *" />
              <Input theme={theme} value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} placeholder="Email *" type="email" />
              <Input theme={theme} value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="Password *" type="password" />
              {newUser.type !== 'client' && <Select theme={theme} value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</Select>}
              {newUser.type === 'client' && <Input theme={theme} value={newUser.company} onChange={v => setNewUser({ ...newUser, company: v })} placeholder="Company" />}
              {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
              <Btn theme={theme} onClick={handleCreate} disabled={creating}>{creating ? '⏳...' : '✓ Add'}</Btn>
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
    const priorityIcons = { urgent: '🔴', high: '🟠', medium: '🟡', low: '🟢' };
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
      <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}` }}>
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
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
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
                      background: t.bgCard, 
                      borderRadius: '10px', 
                      marginBottom: '8px',
                      border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.4)' : t.border}`,
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
                          {task.type === 'feedback' && '🔄 '}{task.title}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {task.dueDate && (
                            <span style={{ fontSize: '11px', color: isOverdue ? '#ef4444' : t.textMuted }}>
                              📅 {formatDate(task.dueDate)}
                            </span>
                          )}
                          {totalSubs > 0 && (
                            <span style={{ fontSize: '11px', color: completedSubs === totalSubs ? t.success : t.textMuted }}>
                              ☑️ {completedSubs}/{totalSubs}
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
                          <button onClick={() => deleteTask(task.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>🗑️</button>
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
                  <label style={{ display: 'block', fontSize: '11px', color: t.accent, marginBottom: '6px' }}>✨ Suggested subtasks</label>
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
    
    return (
      <div>
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>📥 Download Center</h1>
            <p style={{ fontSize: '12px', color: t.textMuted, margin: '4px 0 0' }}>{approvedAssets.length} approved assets ready for download</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={selectAll} style={{ padding: '8px 16px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text, fontSize: '12px', cursor: 'pointer' }}>
              {selectedForDownload.size === approvedAssets.length ? '☐ Deselect All' : '☑️ Select All'}
            </button>
            {selectedForDownload.size > 0 && (
              <button onClick={() => {
                // Download selected files
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
              }} style={{ padding: '8px 16px', background: '#22c55e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
                ⬇️ Download ({selectedForDownload.size})
              </button>
            )}
          </div>
        </div>
        
        {Object.keys(byProject).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: t.textMuted }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
            <p style={{ margin: 0 }}>No approved assets available yet</p>
          </div>
        ) : (
          Object.entries(byProject).map(([projectId, data]) => (
            <div key={projectId} style={{ background: t.bgCard, borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{data.name}</h3>
                <span style={{ fontSize: '11px', color: t.textMuted }}>{data.assets.length} files</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {data.assets.map(asset => (
                  <div key={asset.id} onClick={() => toggleSelect(asset.id)} style={{ 
                    background: t.bgInput, 
                    borderRadius: '10px', 
                    overflow: 'hidden', 
                    cursor: 'pointer',
                    border: selectedForDownload.has(asset.id) ? '2px solid #22c55e' : '1px solid transparent',
                    transition: 'border 0.2s'
                  }}>
                    <div style={{ aspectRatio: '4/3', background: t.bgTertiary, position: 'relative' }}>
                      {asset.type === 'image' ? (
                        <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>{asset.type === 'video' ? '🎬' : '📄'}</div>
                      )}
                      {selectedForDownload.has(asset.id) && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>✓</div>
                      )}
                      {asset.highResFiles?.length > 0 && (
                        <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: '#22c55e', borderRadius: '4px', padding: '2px 6px', fontSize: '8px', fontWeight: '600' }}>HD</div>
                      )}
                    </div>
                    <div style={{ padding: '8px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                      <div style={{ fontSize: '9px', color: t.textMuted, marginTop: '2px' }}>v{asset.currentVersion} • {formatFileSize(asset.fileSize)}</div>
                      {asset.highResFiles?.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {asset.highResFiles.map((f, i) => (
                            <a key={i} href={f.url} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ padding: '2px 6px', background: 'rgba(34,197,94,0.2)', borderRadius: '4px', fontSize: '8px', color: '#22c55e', textDecoration: 'none' }}>
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
                {deck.type === 'embed' ? '📊' : '📄'}
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
                  <button onClick={() => handleDeleteDeck(deck.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
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
      <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}` }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px' }}>📑 Decks & Presentations</h3>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>Upload PDFs, PPTs or embed Google Slides</div>
          </div>
          {isProducer && <Btn theme={theme} onClick={() => setShowAddDeck(true)} small>+ Add Deck</Btn>}
        </div>
        
        <div style={{ padding: '16px' }}>
          <PhaseSection title="Pre-Production" icon="🎬" phaseName="pre-production" items={preProduction} />
          <PhaseSection title="Production" icon="🎥" phaseName="production" items={production} />
          <PhaseSection title="Delivery" icon="📦" phaseName="delivery" items={delivery} />
        </div>
        
        {/* Add Deck Modal */}
        {showAddDeck && (
          <Modal theme={theme} title="Add Presentation" onClose={() => setShowAddDeck(false)}>
            <div style={{ padding: '20px' }}>
              {/* Type selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Type</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setDeckType('upload')} style={{ flex: 1, padding: '10px', background: deckType === 'upload' ? t.primary : t.bgInput, border: `1px solid ${deckType === 'upload' ? t.primary : t.border}`, borderRadius: '8px', color: deckType === 'upload' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>📄 Upload File</button>
                  <button onClick={() => setDeckType('embed')} style={{ flex: 1, padding: '10px', background: deckType === 'embed' ? t.primary : t.bgInput, border: `1px solid ${deckType === 'embed' ? t.primary : t.border}`, borderRadius: '8px', color: deckType === 'embed' ? '#fff' : t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>📊 Google Slides</button>
                </div>
              </div>
              
              {/* Phase selector */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Phase</label>
                <Select theme={theme} value={deckPhase} onChange={setDeckPhase}>
                  <option value="pre-production">🎬 Pre-Production</option>
                  <option value="production">🎥 Production</option>
                  <option value="delivery">📦 Delivery</option>
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
                    <div style={{ fontSize: '30px', marginBottom: '8px' }}>📤</div>
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
    const [selectedAssets, setSelectedAssets] = useState(new Set());
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [unmatchedFiles, setUnmatchedFiles] = useState([]); // Files that need manual matching
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [newFeedback, setNewFeedback] = useState('');
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState('');
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkType, setNewLinkType] = useState('client');
    const [newLinkExpiry, setNewLinkExpiry] = useState('');
    const [versionFile, setVersionFile] = useState(null);
    const [uploadingVersion, setUploadingVersion] = useState(false);
    const fileInputRef = useRef(null);
    const versionInputRef = useRef(null);
    const videoRef = useRef(null);
    const feedbackInputRef = useRef(null);
    const [videoTime, setVideoTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [showSelectionOverview, setShowSelectionOverview] = useState(false);
    const hlsRef = useRef(null);

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
        
        // Arrow navigation
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex - 1]);
        } else if (e.key === 'ArrowRight' && currentIndex < sortedAssets.length - 1) {
          setImageLoading(true); setSelectedAsset(sortedAssets[currentIndex + 1]);
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
          showToast(newSelected ? '⭐ Selected' : 'Deselected', 'success');
        }
        
        // Escape to close lightbox
        if (e.key === 'Escape') {
          setSelectedAsset(null);
        }
        
        // F for fullscreen
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          setIsFullscreen(!isFullscreen);
        }
      };
      window.addEventListener('keydown', handleKeyNav);
      return () => window.removeEventListener('keydown', handleKeyNav);
    }, [selectedAsset, selectedProject, selectedCat, isFullscreen]);

    if (!selectedProject) return null;
    const cats = selectedProject.categories || [];
    const team = (selectedProject.assignedTeam || []).map(t => ({ ...users.find(u => u.id === t.odId), isOwner: t.isOwner })).filter(m => m?.id);
    const shareLinks = (selectedProject.shareLinks || []).filter(l => l.active);
    const editors = [...coreTeam, ...freelancers].filter(u => Object.keys(TEAM_ROLES).includes(u.role));
    const availableTeam = [...coreTeam, ...freelancers].filter(u => !team.find(m => m.id === u.id));

    const getAssets = () => { 
      let a = (selectedProject.assets || []).filter(x => !x.deleted); 
      if (selectedCat) a = a.filter(x => x.category === selectedCat); 
      const typeOrder = { image: 0, video: 1, audio: 2, other: 3 };
      return a.sort((x, y) => (typeOrder[x.type] || 3) - (typeOrder[y.type] || 3));
    };
    const assets = getAssets();
    const getCatCount = id => (selectedProject.assets || []).filter(a => !a.deleted && a.category === id).length;
    const cardWidth = CARD_SIZES[appearance.cardSize];
    const aspectRatio = ASPECT_RATIOS[appearance.aspectRatio];

    const handleUpload = async () => {
      if (!uploadFiles.length) return;
      setShowUpload(false);
      
      for (const file of uploadFiles) {
        const uid = generateId();
        const fileType = getFileType(file);
        
        // Auto-detect best category based on file type
        let cat = selectedCat;
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
      setUploadFiles([]);
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
        const currentRound = selectedAsset.revisionRound || 0;
        const newRound = hasPendingFeedback ? currentRound + 1 : currentRound;
        
        // Check max revisions limit
        const maxRevisions = selectedProject.maxRevisions || 0;
        if (maxRevisions > 0 && newRound > maxRevisions) {
          showToast(`Max revisions (${maxRevisions}) reached!`, 'error');
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
        
        // Mark all pending feedback as done when new version is uploaded
        const updatedFeedback = (selectedAsset.feedback || []).map(f => f.isDone ? f : { ...f, resolvedInVersion: selectedAsset.currentVersion + 1 });
        
        const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { 
          ...a, 
          url, 
          thumbnail: a.type === 'image' ? url : a.thumbnail, 
          versions: [...(a.versions || []), newVersion], 
          currentVersion: selectedAsset.currentVersion + 1, 
          status: 'review-ready',
          revisionRound: newRound,
          feedback: updatedFeedback
        } : a);
        
        const activity = { 
          id: generateId(), 
          type: 'version', 
          message: `${userProfile.name} uploaded v${selectedAsset.currentVersion + 1} of ${selectedAsset.name}${newRound > currentRound ? ` (Revision R${newRound})` : ''}`, 
          timestamp: new Date().toISOString() 
        };
        
        await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
        await refreshProject();
        setSelectedAsset({ ...selectedAsset, url, versions: [...(selectedAsset.versions || []), newVersion], currentVersion: selectedAsset.currentVersion + 1, status: 'review-ready', revisionRound: newRound, feedback: updatedFeedback });
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
            `🎯 Selection Confirmed: ${selectedProject.name}`,
            `${userProfile.name} has confirmed the selection for "${selectedProject.name}".\n\n${selectedAssetsList.length} assets are ready for editing.\n\nPlease log in to start working on the selected assets.`
          );
        }
      }
      
      await refreshProject();
      setShowSelectionOverview(false);
      showToast(`Selection confirmed! ${editorsToNotify.length} editor(s) notified 🎉`, 'success');
    };
    const handleUpdateStatus = async (assetId, status) => { 
      const asset = (selectedProject.assets || []).find(a => a.id === assetId);
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, status } : a); 
      const activity = { id: generateId(), type: 'status', message: `${userProfile.name} changed ${asset?.name || 'asset'} to ${status}`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] }); 
      await refreshProject(); 
      if (selectedAsset) setSelectedAsset({ ...selectedAsset, status }); 
      // Notify assigned person on status change
      if (asset?.assignedTo) {
        const assignee = editors.find(e => e.id === asset.assignedTo);
        if (assignee?.email) sendEmailNotification(assignee.email, `Status changed: ${asset.name}`, `New status: ${status}`);
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
      
      const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString(), videoTimestamp: videoTime, isDone: false, mentions: mentions.map(m => m.id) }; 
      const updatedFeedback = [...(selectedAsset.feedback || []), fb];
      // Update local state first to keep modal open
      setSelectedAsset({ ...selectedAsset, feedback: updatedFeedback, status: 'changes-requested' }); 
      setNewFeedback(''); 
      setShowMentions(false);
      // Then update database in background with activity log
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: updatedFeedback, status: 'changes-requested' } : a); 
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
    
    // Can mark feedback done: producers, editors, video editors, freelancers - NOT clients
    const canMarkFeedbackDone = ['producer', 'admin', 'team-lead', 'editor', 'video-editor', 'colorist', 'animator', 'vfx-artist', 'sound-designer'].includes(userProfile?.role);
    const handleSaveAnnotations = async (annotations) => { const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, annotations } : a); setSelectedAsset({ ...selectedAsset, annotations }); await updateProject(selectedProject.id, { assets: updated }); };
    const handleCreateLink = async () => { if (!newLinkName) { showToast('Enter name', 'error'); return; } const linkData = { name: newLinkName, type: newLinkType, createdBy: userProfile.id }; if (newLinkExpiry) linkData.expiresAt = new Date(newLinkExpiry).toISOString(); await createShareLink(selectedProject.id, linkData); await refreshProject(); setNewLinkName(''); setNewLinkExpiry(''); showToast('Link created!', 'success'); };
    const handleDeleteLink = async (linkId) => { const updated = (selectedProject.shareLinks || []).map(l => l.id === linkId ? { ...l, active: false } : l); await updateProject(selectedProject.id, { shareLinks: updated }); await refreshProject(); showToast('Link deleted', 'success'); };
    const copyLink = token => { navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); showToast('Copied!', 'success'); };
    const handleAddTeam = async uid => { const u = users.find(x => x.id === uid); if (!u) return; const updated = [...(selectedProject.assignedTeam || []), { odId: uid, odRole: u.role }]; await updateProject(selectedProject.id, { assignedTeam: updated }); await refreshProject(); setShowAddTeam(false); };

    const selectedCount = assets.filter(a => a.isSelected).length;
    const getLatestVersionDate = (asset) => { const versions = asset.versions || []; if (versions.length > 1) return versions[versions.length - 1].uploadedAt; return null; };
    const totalAssetCount = (selectedProject.assets || []).filter(a => !a.deleted).length;
    const videoCount = (selectedProject.assets || []).filter(a => !a.deleted && a.type === 'video').length;

    return (
      <div style={{ display: 'flex', marginLeft: isMobile ? '0' : (sidebarCollapsed ? '-60px' : '-200px'), flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Category Sidebar */}
        <div style={{ width: isMobile ? '100%' : '180px', background: t.bgSecondary, borderRight: isMobile ? 'none' : `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none', height: isMobile ? 'auto' : 'calc(100vh - 46px)', position: isMobile ? 'relative' : 'fixed', left: isMobile ? 0 : (sidebarCollapsed ? '60px' : '200px'), top: isMobile ? 0 : '46px', overflowX: isMobile ? 'auto' : 'visible', overflowY: isMobile ? 'hidden' : 'auto', zIndex: 40, transition: 'left 0.2s ease' }}>
          <div style={{ padding: '12px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '6px' }}>
            <div onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: !selectedCat ? `${t.primary}15` : t.bgCard, color: !selectedCat ? t.text : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${!selectedCat ? t.primary + '30' : t.border}` }}><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{Icons.folder(t.textSecondary)} All</span><span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{totalAssetCount}</span></div>
            <div onClick={() => setSelectedCat('__videos__')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: selectedCat === '__videos__' ? `${t.primary}15` : t.bgCard, color: selectedCat === '__videos__' ? t.text : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${selectedCat === '__videos__' ? t.primary + '30' : t.border}` }}><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{Icons.video(t.textSecondary)} Videos</span><span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{videoCount}</span></div>
            {cats.map(cat => <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: selectedCat === cat.id ? `${t.primary}15` : t.bgCard, color: selectedCat === cat.id ? t.text : t.textSecondary, whiteSpace: 'nowrap', border: `1px solid ${selectedCat === cat.id ? t.primary + '30' : t.border}` }}><span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{Icons[cat.icon] ? Icons[cat.icon](cat.color) : Icons.file(cat.color)} {cat.name}</span><span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{getCatCount(cat.id)}</span></div>)}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: isMobile ? '0' : (sidebarCollapsed ? '240px' : '380px'), transition: 'margin-left 0.2s ease' }}>
          {/* Header */}
          <div style={{ height: '50px', background: t.bgSecondary, borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: t.textMuted, fontSize: '11px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>{Icons.chevronLeft(t.textMuted)} Back</button>
              <span style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.text }}>{selectedProject.name}</span>
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
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                  title="Edit Project"
                >
                  {Icons.edit(t.textMuted)}
                </button>
              )}
              {!isMobile && <Badge status={selectedProject.status} />}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isProducer && !isMobile && <Btn theme={theme} onClick={() => setShowShare(true)} small outline>{Icons.share(t.primary)} Share</Btn>}
              <div style={{ position: 'relative' }}>
                <Btn theme={theme} onClick={() => setShowAppearance(!showAppearance)} small outline>{Icons.settings(t.primary)}</Btn>
                {showAppearance && <AppearancePanel settings={appearance} onChange={setAppearance} onClose={() => setShowAppearance(false)} theme={theme} />}
              </div>
              {isProducer && <Btn theme={theme} onClick={() => setShowUpload(true)} small color="#22c55e">{Icons.upload('#fff')}{!isMobile && ' Upload'}</Btn>}
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
              <div style={{ padding: '10px 16px', background: t.bgInput, borderBottom: `1px solid ${t.border}`, display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>⏳ Pending</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>{pending}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>⚡ In Progress</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>{inProgress}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>👁️ Review</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>{review}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.textMuted }}>✓ Done</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#22c55e' }}>{approved}</span>
                  </div>
                  {overdue > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(239,68,68,0.15)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#ef4444' }}>🚨 Overdue</span>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#ef4444' }}>{overdue}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '120px', height: '6px', background: t.bgCard, borderRadius: '3px' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22c55e' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: progress === 100 ? '#22c55e' : '#6366f1' }}>{progress}%</span>
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['assets', 'tasks', 'decks', 'team', 'activity', 'links'].map(t => <button key={t} data-tab={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{t === 'tasks' ? '✓ Tasks' : t === 'decks' ? '📑 Decks' : (isMobile ? t.charAt(0).toUpperCase() : t)}</button>)}
              {/* Photoshoot Workflow Phase Indicator */}
              {selectedProject.type === 'photoshoot' && (
                <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: t.bgInput, padding: '6px 12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: t.textMuted }}>Phase:</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', color: selectedProject.workflowPhase === 'review' ? '#22c55e' : '#fbbf24' }}>
                    {selectedProject.workflowPhase === 'review' ? '📝 Review' : '👆 Selection'}
                  </span>
                  {isProducer && selectedProject.workflowPhase !== 'review' && selectedProject.selectionConfirmed && (
                    <button onClick={async () => {
                      const activity = { id: generateId(), type: 'status', message: `${userProfile.name} started review phase`, timestamp: new Date().toISOString() };
                      await updateProject(selectedProject.id, { workflowPhase: 'review', activityLog: [...(selectedProject.activityLog || []), activity] });
                      await refreshProject();
                      showToast('Review phase started!', 'success');
                    }} style={{ marginLeft: '6px', padding: '4px 10px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
                      Start Review →
                    </button>
                  )}
                </div>
              )}
            </div>
            {tab === 'assets' && selectedAssets.size > 0 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: t.textMuted }}>{selectedAssets.size} selected</span>
                <Btn theme={theme} onClick={() => handleBulkSelect(true)} small color="#22c55e" title="Mark as Selected">✓</Btn>
                <Btn theme={theme} onClick={() => handleBulkSelect(false)} small outline title="Deselect">✗</Btn>
                {isProducer && <Btn theme={theme} onClick={handleBulkDelete} small color="#ef4444" title="Delete Selected">🗑️</Btn>}
              </div>
            )}
            {tab === 'assets' && !selectedProject.selectionConfirmed && selectedCount > 0 && (isProducer || userProfile?.role === 'client') && !isMobile && <Btn theme={theme} onClick={() => setShowSelectionOverview(true)} small color="#f59e0b">🎯 Confirm ({selectedCount})</Btn>}
            {tab === 'assets' && unmatchedFiles.length > 0 && <Btn theme={theme} onClick={() => setShowMatchModal(true)} small color="#ef4444">🔗 Match Files ({unmatchedFiles.length})</Btn>}
            
            {/* View Mode Toggle */}
            {tab === 'assets' && assets.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '6px 12px', background: viewMode === 'grid' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>📊 Grid</button>
                <button onClick={() => setViewMode('kanban')} style={{ padding: '6px 12px', background: viewMode === 'kanban' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>📋 Kanban</button>
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
                <span style={{ fontWeight: '600', fontSize: '12px' }}>⬆️ Uploading {Object.keys(uploadProgress).length} files...</span>
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
              <div style={{ width: '100%' }}>
                {assets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: '50px', marginBottom: '14px' }}>📂</div>
                    <p style={{ color: t.textMuted, fontSize: '13px', marginBottom: '16px' }}>No assets</p>
                    {isProducer && <Btn theme={theme} onClick={() => setShowUpload(true)}>⬆️ Upload</Btn>}
                  </div>
                ) : viewMode === 'kanban' ? (
                  <KanbanView 
                    assets={assets} 
                    onUpdateStatus={handleUpdateStatus} 
                    projectId={selectedProject.id} 
                  />
                ) : (
                  <div>
                    {/* Photoshoot Selection Phase Filter */}
                    {selectedProject.type === 'photoshoot' && selectedProject.selectionConfirmed && (
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                        <button onClick={() => setSelectedCat(null)} style={{ padding: '6px 14px', background: !selectedCat ? t.primary : t.bgCard, border: `1px solid ${!selectedCat ? t.primary : t.border}`, borderRadius: '8px', color: !selectedCat ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>All ({assets.length})</button>
                        <button onClick={() => setSelectedCat('__selected__')} style={{ padding: '6px 14px', background: selectedCat === '__selected__' ? t.success : t.bgCard, border: `1px solid ${selectedCat === '__selected__' ? t.success : t.border}`, borderRadius: '8px', color: selectedCat === '__selected__' ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>⭐ Selected ({assets.filter(a => a.isSelected).length})</button>
                        <button onClick={() => setSelectedCat('__not_selected__')} style={{ padding: '6px 14px', background: selectedCat === '__not_selected__' ? t.warning : t.bgCard, border: `1px solid ${selectedCat === '__not_selected__' ? t.warning : t.border}`, borderRadius: '8px', color: selectedCat === '__not_selected__' ? '#fff' : t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>Not Selected ({assets.filter(a => !a.isSelected).length})</button>
                      </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? (appearance.cardSize === 'L' ? '1fr' : appearance.cardSize === 'S' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)') : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: '12px' }}>
                    {assets
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
                        <div key={a.id} className="asset-card" style={{ 
                          background: t.bgTertiary, 
                          borderRadius: '10px', 
                          overflow: 'hidden', 
                          border: a.isSelected ? '2px solid #22c55e' : selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e', 
                          position: 'relative',
                          opacity: isDimmed ? 0.5 : 1,
                          transition: 'opacity 0.2s'
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
                              style={{ position: 'absolute', top: '10px', right: a.isSelected ? '48px' : '10px', width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(239,68,68,0.9)', border: 'none', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
                            >🗑️</button>
                          )}
                          {a.isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600' }}>⭐</div>}
                          {hasNewVersion && <div style={{ position: 'absolute', top: a.isSelected ? '38px' : '10px', right: '10px', background: '#f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>🆕 v{a.currentVersion}</div>}
                          {a.revisionRound > 0 && <div style={{ position: 'absolute', top: a.isSelected ? (hasNewVersion ? '66px' : '38px') : (hasNewVersion ? '38px' : '10px'), left: '10px', background: a.revisionRound >= (selectedProject.maxRevisions || 999) ? '#ef4444' : '#8b5cf6', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>R{a.revisionRound}</div>}
                          {(a.annotations?.length > 0) && <div style={{ position: 'absolute', bottom: appearance.showInfo ? '80px' : '10px', right: '10px', background: '#ec4899', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>✏️ {a.annotations.length}</div>}
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
                          
                          <div onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }} style={{ cursor: 'pointer', height: isMobile ? (appearance.cardSize === 'L' ? '200px' : appearance.cardSize === 'S' ? '80px' : '120px') : `${cardWidth / aspectRatio}px`, background: t.bgInput, position: 'relative' }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} thumbnail={a.thumbnail} duration={a.duration} style={{ width: '100%', height: '100%' }} /> : a.type === 'audio' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🔊</span></div> : (a.thumbnail || a.url) ? <LazyImage src={a.url} thumbnail={a.thumbnail} style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>📄</span></div>}
                            {a.feedback?.length > 0 && <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: '#ef4444', borderRadius: '10px', padding: '3px 8px', fontSize: '10px' }}>{a.feedback.length}💬</div>}
                            {a.dueDate && <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: new Date(a.dueDate) < new Date() ? '#ef4444' : '#22c55e', borderRadius: '10px', padding: '3px 6px', fontSize: '9px' }}>{new Date(a.dueDate) < new Date() ? '⚠️' : '📅'}{Math.abs(Math.ceil((new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24)))}d</div>}
                            {/* Always visible star rating overlay */}
                            {!appearance.showInfo && (
                              <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.7)', borderRadius: '12px', padding: '3px 8px', display: 'flex', gap: '2px' }}>
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
                {/* Project Team - Project Level Assignment */}
                <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}` }}>
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>👥 Project Team ({team.length})</h3>
                    {isProducer && <Btn theme={theme} onClick={() => setShowAddTeam(true)} small>+ Add Member</Btn>}
                  </div>
                  <div style={{ padding: '14px' }}>
                    {team.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>👥</div>
                        <div style={{ fontSize: '13px', marginBottom: '8px' }}>No team members assigned to this project</div>
                        {isProducer && <Btn theme={theme} onClick={() => setShowAddTeam(true)} small>+ Add Team Member</Btn>}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                        {team.map(m => (
                          <div key={m.id} style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '14px', 
                            padding: '14px', 
                            background: t.bgInput, 
                            borderRadius: '10px',
                            border: m.isOwner ? '1px solid rgba(249,115,22,0.3)' : `1px solid ${t.border}`
                          }}>
                            <Avatar user={m} size={44} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                                {m.isOwner && <span style={{ fontSize: '10px', color: '#f97316', flexShrink: 0 }}>👑 Owner</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                              <div style={{ marginTop: '6px' }}><RoleBadge role={m.role} /></div>
                            </div>
                            {isProducer && !m.isOwner && (
                              <button 
                                onClick={async () => {
                                  if (!confirm(`Remove ${m.name} from this project?`)) return;
                                  const updatedTeam = (selectedProject.assignedTeam || []).filter(t => t.odId !== m.id);
                                  await updateProject(selectedProject.id, { assignedTeam: updatedTeam });
                                  await refreshProject();
                                  showToast(`${m.name} removed`, 'success');
                                }}
                                style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                              >✕</button>
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
                    <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, marginTop: '16px' }}>
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
                        <h3 style={{ margin: 0, fontSize: '14px' }}>💡 Suggested for {projectType.replace('-', ' ')}</h3>
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
                  <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, marginTop: '16px' }}>
                    <div style={{ padding: '14px 18px', borderBottom: `1px solid ${t.border}` }}>
                      <h3 style={{ margin: 0, fontSize: '14px' }}>👔 Client Contacts ({(selectedProject.clientContacts || []).length})</h3>
                    </div>
                    <div style={{ padding: '14px' }}>
                      {(selectedProject.clientContacts || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px', color: t.textMuted, fontSize: '12px' }}>
                          No client contacts added yet
                        </div>
                      ) : (
                        (selectedProject.clientContacts || []).map((c, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '20px' }}>👔</span>
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
              <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}>📋 Activity Timeline</h3>
                <ActivityTimeline activities={selectedProject.activityLog || []} maxItems={20} theme={theme} />
              </div>
            )}

            {tab === 'links' && (
              <div>
                {isProducer && (
                  <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: '16px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>🔗 Create Share Link</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Name</label><Input theme={theme} value={newLinkName} onChange={setNewLinkName} placeholder="e.g., Client Review" /></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Type</label><Select theme={theme} value={newLinkType} onChange={setNewLinkType}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Expiry (optional)</label><Input theme={theme} type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                      <Btn theme={theme} onClick={handleCreateLink}>Create</Btn>
                    </div>
                  </div>
                )}
                <div style={{ background: t.bgTertiary, borderRadius: '12px', border: `1px solid ${t.border}`, padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Active Links ({shareLinks.length})</h3>
                  {shareLinks.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: t.textMuted, fontSize: '12px' }}>No share links</div> : shareLinks.map(link => {
                    const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                    return (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: isExpired ? 'rgba(239,68,68,0.1)' : t.bgInput, borderRadius: '10px', marginBottom: '8px', border: isExpired ? '1px solid rgba(239,68,68,0.3)' : `1px solid ${t.border}` }}>
                        <span style={{ fontSize: '24px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>{link.name}{isExpired && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#ef4444', borderRadius: '4px' }}>EXPIRED</span>}</div><div style={{ fontSize: '10px', color: t.textMuted }}>{link.type} • {formatTimeAgo(link.createdAt)}{link.expiresAt && !isExpired && <span> • Expires {formatDate(link.expiresAt)}</span>}</div></div>
                        <div style={{ display: 'flex', gap: '6px' }}><Btn theme={theme} onClick={() => copyLink(link.token)} small outline>📋</Btn>{isProducer && <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>🗑️</button>}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <Modal theme={theme} title="Upload Assets" onClose={() => { setShowUpload(false); setUploadFiles([]); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div style={{ textAlign: 'center', padding: '40px', border: '2px dashed #2a2a3e', borderRadius: '12px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>📤</div>
                <p style={{ margin: 0, fontSize: '14px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Click to select files'}</p>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
              </div>
              {uploadFiles.length > 0 && <div style={{ maxHeight: '140px', overflow: 'auto', background: t.bgInput, borderRadius: '8px', padding: '10px' }}>{uploadFiles.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}><span>{f.name}</span><span style={{ color: t.textMuted }}>{formatFileSize(f.size)}</span></div>)}</div>}
              <div><label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Category</label><Select theme={theme} value={selectedCat || cats[0]?.id || ''} onChange={setSelectedCat}>{cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select></div>
              <Btn theme={theme} onClick={handleUpload} disabled={!uploadFiles.length} color="#22c55e">⬆️ Upload {uploadFiles.length} Files</Btn>
            </div>
          </Modal>
        )}

        {/* Share Modal */}
        {showShare && (
          <Modal theme={theme} title="Share Project" onClose={() => setShowShare(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input theme={theme} value={newLinkName} onChange={setNewLinkName} placeholder="Link name" />
                <Select theme={theme} value={newLinkType} onChange={setNewLinkType}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Expiry</label><Input theme={theme} type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                <div style={{ display: 'flex', alignItems: 'end' }}><Btn theme={theme} onClick={handleCreateLink}>Create</Btn></div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px' }}>Active ({shareLinks.length})</div>
                {shareLinks.map(link => (
                  <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: t.bgInput, borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '12px' }}>{link.name}</div></div>
                    <Btn theme={theme} onClick={() => copyLink(link.token)} small outline>Copy</Btn>
                    <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
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
        {showEditProject && (
          <Modal theme={theme} title="Edit Project" onClose={() => setShowEditProject(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflow: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Project Name</label>
                <Input 
                  value={editProjectData.name} 
                  onChange={(v) => setEditProjectData({ ...editProjectData, name: v })} 
                  placeholder="Project name" 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Client</label>
                <Input 
                  value={editProjectData.client} 
                  onChange={(v) => setEditProjectData({ ...editProjectData, client: v })} 
                  placeholder="Client name" 
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Status</label>
                <Select theme={theme} value={editProjectData.status} onChange={(v) => setEditProjectData({ ...editProjectData, status: v })}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="on-hold">On Hold</option>
                  <option value="archived">Archived</option>
                </Select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px' }}>Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {DEFAULT_CATEGORIES.map(cat => {
                    const isActive = editProjectData.categories?.some(c => c.id === cat.id);
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (isActive) {
                            setEditProjectData({ ...editProjectData, categories: editProjectData.categories.filter(c => c.id !== cat.id) });
                          } else {
                            setEditProjectData({ ...editProjectData, categories: [...(editProjectData.categories || []), cat] });
                          }
                        }}
                        style={{
                          padding: '8px 14px',
                          background: isActive ? `${cat.color}20` : t.bgInput,
                          border: `1px solid ${isActive ? cat.color : t.border}`,
                          borderRadius: '8px',
                          color: isActive ? cat.color : t.textSecondary,
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {Icons[cat.icon] && Icons[cat.icon](isActive ? cat.color : t.textMuted)}
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Deliverables Section */}
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '16px', marginTop: '8px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>📦 Deliverables Requirements</h4>
                
                {/* Required Formats */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Required File Formats (Photo)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {FILE_FORMATS.photo.map(fmt => {
                      const isActive = (editProjectData.requiredFormats || []).includes(fmt.id);
                      return (
                        <button key={fmt.id} onClick={() => {
                          const updated = isActive 
                            ? (editProjectData.requiredFormats || []).filter(f => f !== fmt.id)
                            : [...(editProjectData.requiredFormats || []), fmt.id];
                          setEditProjectData({ ...editProjectData, requiredFormats: updated });
                        }} style={{ padding: '4px 10px', background: isActive ? 'rgba(99,102,241,0.2)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '6px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>{fmt.label}</button>
                      );
                    })}
                  </div>
                </div>
                
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Required File Formats (Video)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {FILE_FORMATS.video.map(fmt => {
                      const isActive = (editProjectData.requiredFormats || []).includes(fmt.id);
                      return (
                        <button key={fmt.id} onClick={() => {
                          const updated = isActive 
                            ? (editProjectData.requiredFormats || []).filter(f => f !== fmt.id)
                            : [...(editProjectData.requiredFormats || []), fmt.id];
                          setEditProjectData({ ...editProjectData, requiredFormats: updated });
                        }} style={{ padding: '4px 10px', background: isActive ? 'rgba(99,102,241,0.2)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '6px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>{fmt.label}</button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Required Sizes */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Required Sizes/Adapts (Photo)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {SIZE_PRESETS.photo.map(size => {
                      const isActive = (editProjectData.requiredSizes || []).includes(size.id);
                      return (
                        <button key={size.id} onClick={() => {
                          const updated = isActive 
                            ? (editProjectData.requiredSizes || []).filter(s => s !== size.id)
                            : [...(editProjectData.requiredSizes || []), size.id];
                          setEditProjectData({ ...editProjectData, requiredSizes: updated });
                        }} style={{ padding: '4px 10px', background: isActive ? 'rgba(34,197,94,0.2)' : t.bgInput, border: `1px solid ${isActive ? '#22c55e' : t.border}`, borderRadius: '6px', color: isActive ? '#22c55e' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>{size.label}</button>
                      );
                    })}
                  </div>
                </div>
                
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Required Sizes (Video)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {SIZE_PRESETS.video.map(size => {
                      const isActive = (editProjectData.requiredSizes || []).includes(size.id);
                      return (
                        <button key={size.id} onClick={() => {
                          const updated = isActive 
                            ? (editProjectData.requiredSizes || []).filter(s => s !== size.id)
                            : [...(editProjectData.requiredSizes || []), size.id];
                          setEditProjectData({ ...editProjectData, requiredSizes: updated });
                        }} style={{ padding: '4px 10px', background: isActive ? 'rgba(34,197,94,0.2)' : t.bgInput, border: `1px solid ${isActive ? '#22c55e' : t.border}`, borderRadius: '6px', color: isActive ? '#22c55e' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>{size.label}</button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Max Revisions */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Max Revision Rounds (0 = unlimited)</label>
                  <input type="number" min="0" max="20" value={editProjectData.maxRevisions || 0} onChange={(e) => setEditProjectData({ ...editProjectData, maxRevisions: parseInt(e.target.value) || 0 })} style={{ width: '80px', padding: '8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: t.text, fontSize: '12px' }} />
                </div>
              </div>
              
              {/* Workflow Settings */}
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '16px', marginTop: '8px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>⚙️ Workflow Settings</h4>
                
                {/* Who can upload versions */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Who can upload new versions?</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {[
                      { id: 'producer', label: '👑 Producer' },
                      { id: 'editor', label: '✂️ Editor' },
                      { id: 'colorist', label: '🎨 Colorist' },
                      { id: 'vfx', label: '✨ VFX Artist' },
                      { id: 'retoucher', label: '🖼️ Retoucher' },
                      { id: 'sound', label: '🎵 Sound' },
                    ].map(role => {
                      const isActive = (editProjectData.versionUploadRoles || ['producer', 'editor']).includes(role.id);
                      return (
                        <button key={role.id} onClick={() => {
                          const current = editProjectData.versionUploadRoles || ['producer', 'editor'];
                          const updated = isActive ? current.filter(r => r !== role.id) : [...current, role.id];
                          setEditProjectData({ ...editProjectData, versionUploadRoles: updated });
                        }} style={{ padding: '4px 10px', background: isActive ? 'rgba(99,102,241,0.2)' : t.bgInput, border: `1px solid ${isActive ? '#6366f1' : t.border}`, borderRadius: '6px', color: isActive ? '#6366f1' : t.textSecondary, fontSize: '10px', cursor: 'pointer' }}>{role.label}</button>
                      );
                    })}
                  </div>
                </div>
                
                {/* Approval workflow */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Approval Workflow</label>
                  <Select theme={theme} value={editProjectData.approvalWorkflow || 'producer'} onChange={(v) => setEditProjectData({ ...editProjectData, approvalWorkflow: v })} style={{ width: '100%' }}>
                    <option value="producer">Producer Only</option>
                    <option value="client">Client Approval Required</option>
                    <option value="both">Producer + Client</option>
                  </Select>
                </div>
                
                {/* Auto-notifications */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '8px' }}>Auto-Notifications</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { id: 'notifyOnUpload', label: 'Notify client when assets uploaded' },
                      { id: 'notifyOnVersion', label: 'Notify on new version' },
                      { id: 'notifyOnApproval', label: 'Notify team on approval' },
                      { id: 'notifyOnDeadline', label: 'Send deadline reminders' },
                    ].map(opt => (
                      <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11px' }}>
                        <input type="checkbox" checked={editProjectData[opt.id] ?? true} onChange={(e) => setEditProjectData({ ...editProjectData, [opt.id]: e.target.checked })} style={{ accentColor: '#6366f1' }} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* Project Type Specific Settings */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>Project Type</label>
                  <Select theme={theme} value={editProjectData.type || selectedProject.type || 'photoshoot'} onChange={(v) => setEditProjectData({ ...editProjectData, type: v })} style={{ width: '100%' }}>
                    <option value="photoshoot">📸 Photoshoot</option>
                    <option value="video-production">🎬 Video Production</option>
                    <option value="ad-film">🎥 Ad Film</option>
                    <option value="toolkit">🧰 Toolkit</option>
                    <option value="cgi-animation">✨ CGI/Animation</option>
                    <option value="social-content">📱 Social Content</option>
                    <option value="product-photography">📦 Product Photography</option>
                    <option value="event-coverage">🎉 Event Coverage</option>
                    <option value="retouch-only">🖼️ Retouch Only</option>
                    <option value="color-grade">🎨 Color Grade Only</option>
                    <option value="post-production">🎞️ Post Production</option>
                    <option value="motion-graphics">🌀 Motion Graphics</option>
                  </Select>
                </div>
                
                {/* Quick Presets based on project type */}
                <div style={{ background: 'rgba(99,102,241,0.1)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '8px', color: '#6366f1' }}>💡 Quick Presets</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    <button onClick={() => setEditProjectData({ 
                      ...editProjectData, 
                      requiredFormats: ['jpg-web', 'psd', 'tiff'],
                      requiredSizes: ['original', 'web-large', 'social-square', 'social-portrait'],
                      maxRevisions: 3,
                      versionUploadRoles: ['producer', 'editor', 'retoucher']
                    })} style={{ padding: '4px 8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '9px', cursor: 'pointer', color: t.text }}>
                      📸 Standard Photo
                    </button>
                    <button onClick={() => setEditProjectData({ 
                      ...editProjectData, 
                      requiredFormats: ['mp4-web', 'mp4-hq', 'mov-prores'],
                      requiredSizes: ['1080p', '4k', 'square', 'vertical'],
                      maxRevisions: 5,
                      versionUploadRoles: ['producer', 'editor', 'colorist', 'vfx', 'sound']
                    })} style={{ padding: '4px 8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '9px', cursor: 'pointer', color: t.text }}>
                      🎬 Video Project
                    </button>
                    <button onClick={() => setEditProjectData({ 
                      ...editProjectData, 
                      requiredFormats: ['jpg-web', 'png'],
                      requiredSizes: ['social-square', 'social-portrait', 'social-story'],
                      maxRevisions: 2,
                      versionUploadRoles: ['producer', 'editor']
                    })} style={{ padding: '4px 8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '9px', cursor: 'pointer', color: t.text }}>
                      📱 Social Only
                    </button>
                    <button onClick={() => setEditProjectData({ 
                      ...editProjectData, 
                      requiredFormats: ['jpg-web', 'jpg-print', 'psd', 'tiff', 'png'],
                      requiredSizes: ['original', '4k', 'web-large', 'social-square', 'social-portrait', 'social-story'],
                      maxRevisions: 5,
                      versionUploadRoles: ['producer', 'editor', 'retoucher', 'colorist']
                    })} style={{ padding: '4px 8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '4px', fontSize: '9px', cursor: 'pointer', color: t.text }}>
                      🧰 Full Toolkit
                    </button>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <Btn 
                  onClick={async () => {
                    await updateProject(selectedProject.id, { 
                      name: editProjectData.name, 
                      client: editProjectData.client,
                      status: editProjectData.status,
                      type: editProjectData.type,
                      categories: editProjectData.categories,
                      requiredFormats: editProjectData.requiredFormats,
                      requiredSizes: editProjectData.requiredSizes,
                      maxRevisions: editProjectData.maxRevisions,
                      versionUploadRoles: editProjectData.versionUploadRoles,
                      approvalWorkflow: editProjectData.approvalWorkflow,
                      notifyOnUpload: editProjectData.notifyOnUpload,
                      notifyOnVersion: editProjectData.notifyOnVersion,
                      notifyOnApproval: editProjectData.notifyOnApproval,
                      notifyOnDeadline: editProjectData.notifyOnDeadline
                    });
                    await refreshProject();
                    setShowEditProject(false);
                    showToast('Project updated', 'success');
                  }}
                >
                  Save Changes
                </Btn>
                <Btn theme={theme} onClick={() => setShowEditProject(false)} outline>Cancel</Btn>
              </div>
            </div>
          </Modal>
        )}

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
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}
            onTouchStart={onTouchStartHandler}
            onTouchMove={onTouchMoveHandler}
            onTouchEnd={onTouchEndHandler}
          >
            {/* Top Bar */}
            {!isFullscreen && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(0,0,0,0.6)', flexShrink: 0, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setSelectedAsset(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: '#fff', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>{selectedAsset.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{currentIndex + 1} of {sortedAssets.length} • v{selectedAsset.currentVersion}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {/* Quick Rating in header */}
                <div style={{ display: 'flex', gap: '2px', marginRight: '8px' }}>
                  {[1,2,3,4,5].map(star => (
                    <span key={star} onClick={() => { handleRate(selectedAsset.id, star); setSelectedAsset({ ...selectedAsset, rating: star }); }} style={{ cursor: 'pointer', fontSize: '16px', color: star <= (selectedAsset.rating || 0) ? '#fbbf24' : 'rgba(255,255,255,0.3)' }}>★</span>
                  ))}
                </div>
                {/* Fullscreen toggle */}
                <button onClick={() => setIsFullscreen(true)} style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>⛶ {!isMobile && 'Fullscreen'}</button>
                {/* Tab buttons */}
                {[{ id: 'preview', icon: '👁️', label: 'Preview' }, { id: 'annotate', icon: '✏️', label: 'Annotate' }, { id: 'compare', icon: '📊', label: 'Compare' }].map(tb => (
                  <button key={tb.id} onClick={() => setAssetTab(tb.id)} style={{ padding: '6px 10px', background: assetTab === tb.id ? '#6366f1' : 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{tb.icon} {!isMobile && tb.label}</button>
                ))}
              </div>
            </div>
            )}
            
            {/* Fullscreen Mode Exit Button */}
            {isFullscreen && (
              <button onClick={() => setIsFullscreen(false)} style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 20, padding: '10px 16px', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>✕ Exit Fullscreen</button>
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
                  {selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}
                </button>
                {/* Confirm Selection Button - only show if there are selections */}
                {!selectedProject.selectionConfirmed && selectedCount > 0 && (isProducer || userProfile?.role === 'client') && (
                  <button onClick={() => { setIsFullscreen(false); setShowSelectionOverview(true); }} style={{ padding: '10px 20px', background: '#f59e0b', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                    🎯 Confirm Selection ({selectedCount})
                  </button>
                )}
              </div>
            )}
            
            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
              {/* Left Navigation Arrow */}
              {hasPrev && (
                <button onClick={goToPrev} style={{ position: 'absolute', left: isMobile ? '4px' : '16px', top: '50%', transform: 'translateY(-50%)', width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: isMobile ? '16px' : '20px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
              )}
              
              {/* Right Navigation Arrow */}
              {hasNext && (
                <button onClick={goToNext} style={{ position: 'absolute', right: isMobile || isFullscreen ? '16px' : '320px', top: '50%', transform: 'translateY(-50%)', width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: isMobile ? '16px' : '20px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              )}
              
              {/* Preview/Annotate Tab */}
              {(assetTab === 'preview' || assetTab === 'annotate') && (
                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>
                  {/* LEFT: Preview/Annotation Area */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a0f', minWidth: 0, overflow: 'hidden' }}>
                    {/* Content Area */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '8px 40px' : '16px 70px', overflow: 'hidden' }}>
                      {selectedAsset.type === 'video' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                          {selectedAsset.muxPlaybackId ? (
                            <video ref={videoRef} controls playsInline poster={selectedAsset.thumbnail || `https://image.mux.com/${selectedAsset.muxPlaybackId}/thumbnail.jpg`} onTimeUpdate={(e) => setVideoTime(e.target.currentTime)} onLoadedMetadata={(e) => setVideoDuration(e.target.duration)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: '#000', borderRadius: '8px' }}>
                              <source src={`https://stream.mux.com/${selectedAsset.muxPlaybackId}.m3u8`} type="application/x-mpegURL" />
                            </video>
                          ) : selectedAsset.muxUploadId && !selectedAsset.url ? (
                            <div style={{ textAlign: 'center', padding: '40px' }}>
                              <div style={{ width: '50px', height: '50px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Processing video...</div>
                              <button onClick={async () => { try { const res = await fetch(`/api/mux/upload?uploadId=${selectedAsset.muxUploadId}`); const data = await res.json(); if (data.asset?.playbackId) { const updatedAssets = selectedProject.assets.map(a => a.id === selectedAsset.id ? { ...a, muxPlaybackId: data.asset.playbackId, thumbnail: data.asset.thumbnailUrl || a.thumbnail } : a); await updateProject(selectedProject.id, { assets: updatedAssets }); await refreshProject(); showToast('Ready!', 'success'); } else { showToast('Still processing...', 'info'); } } catch (e) { showToast('Check failed', 'error'); } }} style={{ padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer' }}>🔄 Check</button>
                              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                            </div>
                          ) : (
                            <video ref={videoRef} src={selectedAsset.url} controls playsInline onTimeUpdate={(e) => setVideoTime(e.target.currentTime)} onLoadedMetadata={(e) => setVideoDuration(e.target.duration)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                          )}
                          {/* Timecode */}
                          <div style={{ marginTop: '10px', padding: '6px 12px', background: 'rgba(0,0,0,0.7)', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#22c55e' }}>
                            {formatTimecode(videoTime)} / {formatTimecode(videoDuration)}
                          </div>
                        </div>
                      ) : selectedAsset.type === 'audio' ? (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔊</div>
                          <audio src={selectedAsset.url} controls style={{ width: '100%', maxWidth: '300px' }} />
                        </div>
                      ) : selectedAsset.type === 'image' ? (
                        assetTab === 'annotate' ? (
                          <AnnotationCanvas imageUrl={selectedAsset.url} annotations={selectedAsset.annotations || []} onChange={handleSaveAnnotations} />
                        ) : (
                          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {imageLoading && (
                              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '40px', height: '40px', border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: '11px', color: t.textMuted }}>Loading...</span>
                              </div>
                            )}
                            <img 
                              src={selectedAsset.preview || selectedAsset.thumbnail || selectedAsset.url} 
                              alt={selectedAsset.name} 
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', opacity: imageLoading ? 0 : 1, transition: 'opacity 0.2s' }} 
                              draggable={false}
                              onLoad={() => setImageLoading(false)}
                            />
                          </div>
                        )
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '60px' }}>📄</div>
                      )}
                    </div>
                    
                    {/* Feedback Section */}
                    {!isFullscreen && (
                    <div style={{ padding: '12px 16px', borderTop: `1px solid ${t.border}`, background: t.bgSecondary, flexShrink: 0, maxHeight: isMobile ? '180px' : '200px', overflow: 'auto' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>💬 Feedback ({selectedAsset.feedback?.length || 0})</span>
                        {(selectedAsset.feedback || []).filter(f => !f.isDone).length > 0 && (
                          <span style={{ fontSize: '10px', padding: '2px 8px', background: '#ef4444', borderRadius: '10px' }}>{(selectedAsset.feedback || []).filter(f => !f.isDone).length} pending</span>
                        )}
                      </div>
                      <div style={{ maxHeight: '80px', overflow: 'auto', marginBottom: '8px' }}>
                        {(selectedAsset.feedback || []).length === 0 ? (
                          <div style={{ fontSize: '11px', color: t.textMuted }}>No feedback yet</div>
                        ) : (selectedAsset.feedback || []).map(fb => (
                          <div key={fb.id} style={{ padding: '8px', background: fb.isDone ? 'rgba(34,197,94,0.1)' : t.bgInput, borderRadius: '6px', marginBottom: '6px', borderLeft: fb.isDone ? '3px solid #22c55e' : '3px solid #ef4444', opacity: fb.isDone ? 0.7 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontSize: '10px', fontWeight: '600' }}>{fb.userName}</span>
                                <span style={{ fontSize: '9px', color: t.textMuted, marginLeft: '8px' }}>{formatTimeAgo(fb.timestamp)}</span>
                                {fb.videoTimestamp !== null && fb.videoTimestamp !== undefined && (
                                  <span onClick={() => { if (videoRef.current) { videoRef.current.currentTime = fb.videoTimestamp; videoRef.current.play(); } }} style={{ fontSize: '9px', color: '#6366f1', marginLeft: '8px', cursor: 'pointer', background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: '4px' }}>▶ {Math.floor(fb.videoTimestamp / 60)}:{String(Math.floor(fb.videoTimestamp % 60)).padStart(2, '0')}</span>
                                )}
                              </div>
                              <button onClick={(e) => handleToggleFeedbackDone(fb.id, e)} style={{ background: fb.isDone ? 'rgba(34,197,94,0.2)' : 'transparent', border: `1px solid ${fb.isDone ? '#22c55e' : t.border}`, borderRadius: '4px', padding: '2px 6px', fontSize: '9px', color: fb.isDone ? '#22c55e' : t.textMuted, cursor: 'pointer' }}>{fb.isDone ? '✓' : 'Done'}</button>
                            </div>
                            <div style={{ fontSize: '11px' }}>{fb.text}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                        {selectedAsset.type === 'video' && <span style={{ fontSize: '9px', color: t.textMuted, flexShrink: 0 }}>📍{Math.floor(videoTime / 60)}:{String(Math.floor(videoTime % 60)).padStart(2, '0')}</span>}
                        <div style={{ flex: 1, position: 'relative' }}>
                          <input ref={feedbackInputRef} value={newFeedback} onChange={(e) => { const val = e.target.value; setNewFeedback(val); const lastAt = val.lastIndexOf('@'); if (lastAt !== -1 && lastAt === val.length - 1) { setShowMentions(true); setMentionSearch(''); } else if (lastAt !== -1 && !val.substring(lastAt + 1).includes(' ')) { setShowMentions(true); setMentionSearch(val.substring(lastAt + 1).toLowerCase()); } else { setShowMentions(false); } }} onKeyDown={(e) => { if (e.key === 'Enter' && !showMentions) handleAddFeedback(); if (e.key === 'Escape') setShowMentions(false); }} placeholder="Add feedback... (@ to mention)" style={{ width: '100%', padding: '8px 10px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: '#fff', fontSize: '11px' }} />
                          {/* Mentions Dropdown - includes all available team members */}
                          {showMentions && (() => {
                            // Combine project team, freelancers, and core team for mentions
                            const allMentionable = [...new Map([...team, ...freelancers, ...coreTeam].map(m => [m.id, m])).values()];
                            const filtered = allMentionable.filter(m => m.name?.toLowerCase().includes(mentionSearch)).slice(0, 8);
                            return (
                              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '8px', marginBottom: '4px', maxHeight: '200px', overflow: 'auto', zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.3)' }}>
                                <div style={{ padding: '6px 10px', borderBottom: `1px solid ${t.border}`, fontSize: '9px', color: t.textMuted, fontWeight: '600' }}>MENTION SOMEONE</div>
                                {filtered.map(member => (
                                  <div key={member.id} onClick={() => { const lastAt = newFeedback.lastIndexOf('@'); setNewFeedback(newFeedback.substring(0, lastAt) + `@${member.name} `); setShowMentions(false); feedbackInputRef.current?.focus(); }} style={{ padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', borderBottom: `1px solid ${t.border}` }} onMouseEnter={(e) => e.currentTarget.style.background = t.bgInput} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: team.find(t => t.id === member.id) ? '#6366f1' : '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600' }}>{member.name?.[0]}</div>
                                    <div>
                                      <div style={{ fontWeight: '500' }}>{member.name}</div>
                                      <div style={{ fontSize: '10px', color: t.textMuted }}>{member.role || 'Team Member'} {team.find(t => t.id === member.id) ? '• On this project' : ''}</div>
                                    </div>
                                  </div>
                                ))}
                                {filtered.length === 0 && <div style={{ padding: '12px', color: t.textMuted, fontSize: '11px', textAlign: 'center' }}>No matches found<br/><span style={{ fontSize: '10px' }}>Type a name to search</span></div>}
                              </div>
                            );
                          })()}
                        </div>
                        <button onClick={handleAddFeedback} disabled={!newFeedback.trim()} style={{ padding: '8px 12px', background: newFeedback.trim() ? '#6366f1' : t.bgInput, border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: newFeedback.trim() ? 'pointer' : 'default' }}>Send</button>
                      </div>
                    </div>
                    )}
                  </div>
                  
                  {/* RIGHT: Details Sidebar */}
                  {!isMobile && !isFullscreen && (
                    <div style={{ width: '300px', background: t.bgTertiary, borderLeft: `1px solid ${t.border}`, overflow: 'auto', padding: '14px', flexShrink: 0 }}>
                      {/* Selection Toggle - Prominent */}
                      <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected, status: !selectedAsset.isSelected ? 'selected' : 'pending' }); }} style={{ width: '100%', padding: '12px', background: selectedAsset.isSelected ? '#22c55e' : t.bgCard, border: `1px solid ${selectedAsset.isSelected ? '#22c55e' : t.border}`, borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600', marginBottom: '12px' }}>
                        {selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}
                      </button>
                      
                      {/* Tags */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '6px' }}>🏷️ Tags</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {PREDEFINED_TAGS.map(tag => {
                            const isActive = (selectedAsset.tags || []).includes(tag.id);
                            return (
                              <button key={tag.id} onClick={async () => { const newTags = isActive ? (selectedAsset.tags || []).filter(t => t !== tag.id) : [...(selectedAsset.tags || []), tag.id]; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, tags: newTags } : a); setSelectedAsset({ ...selectedAsset, tags: newTags }); await updateProject(selectedProject.id, { assets: updated }); }} style={{ padding: '3px 8px', background: isActive ? `${tag.color}30` : t.bgInput, border: `1px solid ${isActive ? tag.color : t.border}`, borderRadius: '10px', color: isActive ? tag.color : t.textMuted, fontSize: '9px', cursor: 'pointer', fontWeight: '500' }}>{tag.label}</button>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* Status */}
                      <div style={{ marginBottom: '12px' }}>
                        <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Status</label>
                        <Select theme={theme} value={selectedAsset.status} onChange={v => handleUpdateStatus(selectedAsset.id, v)} style={{ fontSize: '11px' }}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                        </Select>
                      </div>
                      
                      {/* Assign */}
                      {isProducer && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>Assign To</label>
                          <Select theme={theme} value={selectedAsset.assignedTo || ''} onChange={v => handleAssign(selectedAsset.id, v)} style={{ fontSize: '11px' }}>
                            <option value="">-- Unassigned --</option>
                            {editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                          </Select>
                        </div>
                      )}
                      
                      {/* Due Date */}
                      {isProducer && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>📅 Due Date</label>
                          <input type="date" value={selectedAsset.dueDate?.split('T')[0] || ''} onChange={async (e) => { const dueDate = e.target.value ? new Date(e.target.value).toISOString() : null; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, dueDate } : a); setSelectedAsset({ ...selectedAsset, dueDate }); await updateProject(selectedProject.id, { assets: updated }); if (selectedAsset.assignedTo && dueDate) { const assignee = editors.find(e => e.id === selectedAsset.assignedTo); if (assignee?.email) sendEmailNotification(assignee.email, `Due date set: ${selectedAsset.name}`, `Due: ${formatDate(dueDate)}`); } }} style={{ width: '100%', padding: '8px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '6px', color: '#fff', fontSize: '11px' }} />
                          {selectedAsset.dueDate && <div style={{ marginTop: '4px', fontSize: '10px', color: new Date(selectedAsset.dueDate) < new Date() ? '#ef4444' : '#22c55e', fontWeight: '600' }}>{new Date(selectedAsset.dueDate) < new Date() ? '⚠️ Overdue!' : `⏳ ${Math.ceil((new Date(selectedAsset.dueDate) - new Date()) / (1000 * 60 * 60 * 24))} days`}</div>}
                        </div>
                      )}
                      
                      {/* Version Upload - permission based */}
                      {(() => {
                        const allowedRoles = selectedProject.versionUploadRoles || ['producer', 'editor'];
                        const roleMap = { 
                          'producer': ['producer', 'admin', 'team-lead'],
                          'editor': ['editor', 'photo-editor', 'video-editor'],
                          'colorist': ['colorist', 'color-grader'],
                          'vfx': ['vfx', 'vfx-artist', 'motion-graphics'],
                          'retoucher': ['retoucher'],
                          'sound': ['sound', 'sound-designer', 'audio-engineer']
                        };
                        const userRoles = Object.entries(roleMap).filter(([, mapped]) => mapped.includes(userProfile?.role)).map(([key]) => key);
                        const canUploadVersion = isProducer || userRoles.some(r => allowedRoles.includes(r));
                        
                        return canUploadVersion ? (
                          <div style={{ marginBottom: '12px', padding: '10px', background: t.bgInput, borderRadius: '8px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>📦 Versions</span>
                              <span style={{ padding: '2px 6px', background: selectedAsset.currentVersion > 1 && isNewVersion(getLatestVersionDate(selectedAsset)) ? '#f97316' : t.bgCard, borderRadius: '4px', fontSize: '9px' }}>v{selectedAsset.currentVersion}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: t.textMuted, marginBottom: '6px' }}>{(selectedAsset.versions || []).map((v, i) => <span key={i}>{i > 0 && ' → '}v{v.version}</span>)}</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <input ref={versionInputRef} type="file" style={{ display: 'none' }} onChange={e => setVersionFile(e.target.files?.[0] || null)} />
                              <button onClick={() => versionInputRef.current?.click()} style={{ flex: 1, padding: '6px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '6px', color: '#fff', fontSize: '9px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{versionFile ? versionFile.name.substring(0, 10) + '...' : '+ New Version'}</button>
                              {versionFile && <button onClick={handleUploadVersion} disabled={uploadingVersion} style={{ padding: '6px 10px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>{uploadingVersion ? '⏳' : '⬆️'}</button>}
                            </div>
                          </div>
                        ) : (
                          <div style={{ marginBottom: '12px', padding: '10px', background: t.bgInput, borderRadius: '8px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>📦 Versions</span>
                              <span style={{ padding: '2px 6px', background: t.bgCard, borderRadius: '4px', fontSize: '9px' }}>v{selectedAsset.currentVersion}</span>
                            </div>
                            <div style={{ fontSize: '9px', color: t.textMuted }}>{(selectedAsset.versions || []).map((v, i) => <span key={i}>{i > 0 && ' → '}v{v.version}</span>)}</div>
                          </div>
                        );
                      })()}
                      
                      {/* GDrive Link */}
                      {selectedAsset.status === 'approved' && (
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: t.textMuted, marginBottom: '4px' }}>📁 GDrive Link</label>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <Input theme={theme} value={selectedAsset.gdriveLink || ''} onChange={v => setSelectedAsset({ ...selectedAsset, gdriveLink: v })} placeholder="Paste link" style={{ flex: 1, padding: '6px', fontSize: '10px' }} />
                            <button onClick={() => handleSetGdriveLink(selectedAsset.id, selectedAsset.gdriveLink)} style={{ padding: '6px 10px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>✓</button>
                          </div>
                        </div>
                      )}
                      {selectedAsset.gdriveLink && <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px', background: 'rgba(34,197,94,0.15)', borderRadius: '6px', color: '#22c55e', fontSize: '10px', textAlign: 'center', textDecoration: 'none', marginBottom: '12px', fontWeight: '600' }}>📁 Open High-Res</a>}
                      
                      {/* File Details */}
                      <div style={{ background: t.bgInput, borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: t.textMuted }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ color: t.textMuted }}>Type</span><span>{selectedAsset.mimeType?.split('/')[1] || selectedAsset.type}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: t.textMuted }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div>
                      </div>
                      
                      {/* Deliverables Checklist */}
                      {((selectedProject.requiredFormats?.length > 0) || (selectedProject.requiredSizes?.length > 0)) && (
                        <div style={{ background: t.bgInput, borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📦 Required Deliverables
                            {selectedAsset.revisionRound > 0 && <span style={{ padding: '2px 6px', background: '#f97316', borderRadius: '4px', fontSize: '8px' }}>R{selectedAsset.revisionRound}</span>}
                          </div>
                          {/* Required Formats */}
                          {selectedProject.requiredFormats?.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <div style={{ fontSize: '9px', color: t.textMuted, marginBottom: '4px' }}>Formats:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {selectedProject.requiredFormats.map(fmtId => {
                                  const fmt = [...FILE_FORMATS.photo, ...FILE_FORMATS.video].find(f => f.id === fmtId);
                                  const isUploaded = (selectedAsset.uploadedFormats || []).includes(fmtId);
                                  return fmt ? (
                                    <span key={fmtId} style={{ padding: '2px 6px', background: isUploaded ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isUploaded ? '#22c55e' : '#ef4444'}`, borderRadius: '4px', fontSize: '8px', color: isUploaded ? '#22c55e' : '#ef4444' }}>
                                      {isUploaded ? '✓' : '○'} {fmt.label.split(' ')[0]}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                          {/* Required Sizes */}
                          {selectedProject.requiredSizes?.length > 0 && (
                            <div>
                              <div style={{ fontSize: '9px', color: t.textMuted, marginBottom: '4px' }}>Sizes:</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {selectedProject.requiredSizes.map(sizeId => {
                                  const size = [...SIZE_PRESETS.photo, ...SIZE_PRESETS.video].find(s => s.id === sizeId);
                                  const isUploaded = (selectedAsset.uploadedSizes || []).includes(sizeId);
                                  return size ? (
                                    <span key={sizeId} style={{ padding: '2px 6px', background: isUploaded ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.1)', border: `1px solid ${isUploaded ? '#22c55e' : '#ef4444'}`, borderRadius: '4px', fontSize: '8px', color: isUploaded ? '#22c55e' : '#ef4444' }}>
                                      {isUploaded ? '✓' : '○'} {size.label.split(' ')[0]}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          )}
                          {/* Max Revisions Info */}
                          {selectedProject.maxRevisions > 0 && (
                            <div style={{ marginTop: '8px', fontSize: '9px', color: (selectedAsset.revisionRound || 0) >= selectedProject.maxRevisions ? '#ef4444' : t.textMuted }}>
                              Revisions: {selectedAsset.revisionRound || 0} / {selectedProject.maxRevisions}
                              {(selectedAsset.revisionRound || 0) >= selectedProject.maxRevisions && ' ⚠️ Limit reached'}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* High-Res Downloads Section */}
                      {selectedAsset.status === 'approved' && (selectedAsset.highResFiles?.length > 0 || isProducer) && (
                        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600', color: '#22c55e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            📦 High-Res Downloads
                            {!selectedAsset.highResFiles?.length && <span style={{ color: '#ef4444', fontWeight: 'normal' }}>Not uploaded yet</span>}
                          </div>
                          {selectedAsset.highResFiles?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {selectedAsset.highResFiles.map((file, idx) => (
                                <a key={idx} href={file.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', background: t.bgCard, borderRadius: '4px', textDecoration: 'none', color: t.text, fontSize: '10px' }}>
                                  <span>{file.formatLabel || file.format}</span>
                                  <span style={{ color: '#22c55e' }}>⬇️</span>
                                </a>
                              ))}
                            </div>
                          ) : isProducer ? (
                            <div style={{ fontSize: '9px', color: t.textMuted }}>Waiting for editor to upload high-res files</div>
                          ) : null}
                        </div>
                      )}
                      
                      {/* Editor: Upload High-Res Files */}
                      {selectedAsset.status === 'approved' && !isProducer && userProfile?.role !== 'client' && (
                        <div style={{ background: t.bgInput, borderRadius: '8px', padding: '10px', marginBottom: '12px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600', marginBottom: '8px' }}>📤 Upload High-Res Files</div>
                          {(selectedProject.requiredFormats || []).length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {selectedProject.requiredFormats.map(fmtId => {
                                const fmt = [...FILE_FORMATS.photo, ...FILE_FORMATS.video].find(f => f.id === fmtId);
                                const isUploaded = selectedAsset.highResFiles?.some(f => f.format === fmtId);
                                return fmt ? (
                                  <label key={fmtId} style={{ padding: '4px 8px', background: isUploaded ? 'rgba(34,197,94,0.2)' : t.bgCard, border: `1px solid ${isUploaded ? '#22c55e' : t.border}`, borderRadius: '6px', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <input type="file" style={{ display: 'none' }} onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      try {
                                        showToast('Uploading...', 'info');
                                        const path = `projects/${selectedProject.id}/highres/${selectedAsset.id}/${fmtId}-${file.name}`;
                                        const sRef = ref(storage, path);
                                        await uploadBytesResumable(sRef, file);
                                        const url = await getDownloadURL(sRef);
                                        const highResFile = { format: fmtId, formatLabel: fmt.label, url, fileName: file.name, uploadedAt: new Date().toISOString() };
                                        const existingFiles = (selectedAsset.highResFiles || []).filter(f => f.format !== fmtId);
                                        const updatedAsset = { ...selectedAsset, highResFiles: [...existingFiles, highResFile] };
                                        const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? updatedAsset : a);
                                        await updateProject(selectedProject.id, { assets: updated });
                                        setSelectedAsset(updatedAsset);
                                        await refreshProject();
                                        showToast(`${fmt.label} uploaded!`, 'success');
                                        
                                        // Check if all required formats are uploaded
                                        const allUploaded = selectedProject.requiredFormats.every(f => [...existingFiles, highResFile].some(h => h.format === f));
                                        if (allUploaded) {
                                          // Notify client
                                          const clientsToNotify = team.filter(m => ['client', 'producer'].includes(m.role));
                                          for (const client of clientsToNotify) {
                                            if (client.email) {
                                              sendEmailNotification(client.email, `High-res files ready: ${selectedAsset.name}`, `All required formats for "${selectedAsset.name}" have been uploaded and are ready for download.`);
                                            }
                                          }
                                        }
                                      } catch (err) { showToast('Upload failed', 'error'); }
                                    }} />
                                    {isUploaded ? '✓' : '+'} {fmt.label.split(' ')[0]}
                                  </label>
                                ) : null;
                              })}
                            </div>
                          ) : (
                            <div style={{ fontSize: '9px', color: t.textMuted }}>No specific formats required</div>
                          )}
                        </div>
                      )}
                      
                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                        <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#6366f1', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Preview</a>
                      </div>
                      
                      {/* Delete */}
                      {isProducer && (
                        <button onClick={async () => { if (!confirm(`Delete "${selectedAsset.name}"?`)) return; const deletedAt = new Date().toISOString(); const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, deleted: true, deletedAt } : a); const activity = { id: generateId(), type: 'delete', message: `${userProfile.name} deleted ${selectedAsset.name}`, timestamp: new Date().toISOString() }; await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] }); setSelectedAsset(null); await refreshProject(); showToast('Deleted', 'success'); }} style={{ width: '100%', padding: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>🗑️ Delete</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {/* Compare Tab */}
              {assetTab === 'compare' && (
                <div style={{ flex: 1, padding: '20px', overflow: 'auto' }}>
                  <VersionComparison versions={selectedAsset.versions || []} currentVersion={selectedAsset.currentVersion} />
                </div>
              )}
            </div>
            
            {/* Bottom Thumbnail Strip */}
            {sortedAssets.length > 1 && !isFullscreen && (
              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.7)', overflowX: 'auto', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {sortedAssets.map((asset) => (
                    <div key={asset.id} onClick={() => setSelectedAsset(asset)} style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', border: asset.id === selectedAsset.id ? '2px solid #6366f1' : '2px solid transparent', cursor: 'pointer', flexShrink: 0, opacity: asset.id === selectedAsset.id ? 1 : 0.5, position: 'relative' }}>
                      {asset.type === 'image' ? <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : asset.type === 'video' ? <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{asset.thumbnail ? <img src={asset.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>🎬</span>}</div> : <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>{asset.type === 'audio' ? '🔊' : '📄'}</div>}
                      {asset.rating > 0 && <div style={{ position: 'absolute', bottom: '2px', left: '2px', background: 'rgba(0,0,0,0.7)', borderRadius: '3px', padding: '1px 3px', fontSize: '8px' }}>{'★'.repeat(asset.rating)}</div>}
                      {asset.isSelected && <div style={{ position: 'absolute', top: '2px', right: '2px', background: '#22c55e', borderRadius: '3px', padding: '1px 3px', fontSize: '8px' }}>⭐</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Mobile Bottom Actions */}
            {isMobile && !isFullscreen && (
              <div style={{ padding: '10px 16px', background: t.bgTertiary, borderTop: `1px solid ${t.border}`, display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected }); }} style={{ flex: 1, padding: '10px', background: selectedAsset.isSelected ? '#22c55e' : t.bgInput, border: `1px solid ${selectedAsset.isSelected ? '#22c55e' : t.border}`, borderRadius: '8px', color: '#fff', fontSize: '11px' }}>{selectedAsset.isSelected ? '⭐ Selected' : '☆ Select'}</button>
                <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#6366f1', borderRadius: '8px', color: '#fff', fontSize: '11px', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download</a>
              </div>
            )}
            
            {/* Mobile Swipe Hint */}
            {isMobile && sortedAssets.length > 1 && !isFullscreen && (
              <div style={{ textAlign: 'center', padding: '6px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.5)' }}>← Swipe or use arrows →</div>
            )}
          </div>
          );
        })()}

        {/* SELECTION OVERVIEW MODAL */}
        {showSelectionOverview && (() => {
          const selectedAssetsList = (selectedProject.assets || []).filter(a => !a.deleted && (a.isSelected || a.rating === 5));
          const fiveStarAssets = selectedAssetsList.filter(a => a.rating === 5);
          const otherSelected = selectedAssetsList.filter(a => a.rating !== 5 && a.isSelected);
          const editorsOnProject = team.filter(m => ['editor', 'video-editor', 'colorist', 'retoucher', 'photo-editor'].includes(m.role));
          
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: t.bgCard, borderRadius: '16px', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>🎯 Confirm Selection</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: t.textMuted }}>Review selected assets before confirming</p>
                  </div>
                  <button onClick={() => setShowSelectionOverview(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: t.textMuted }}>✕</button>
                </div>
                
                {/* Content */}
                <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
                  {/* Summary Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: t.bgInput, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#fbbf24' }}>{fiveStarAssets.length}</div>
                      <div style={{ fontSize: '11px', color: t.textMuted }}>⭐⭐⭐⭐⭐ Final Picks</div>
                    </div>
                    <div style={{ background: t.bgInput, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#22c55e' }}>{otherSelected.length}</div>
                      <div style={{ fontSize: '11px', color: t.textMuted }}>Other Selected</div>
                    </div>
                    <div style={{ background: t.bgInput, borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#6366f1' }}>{selectedAssetsList.length}</div>
                      <div style={{ fontSize: '11px', color: t.textMuted }}>Total to Edit</div>
                    </div>
                  </div>
                  
                  {/* 5-Star Assets Grid */}
                  {fiveStarAssets.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#fbbf24' }}>★★★★★</span> Final Picks ({fiveStarAssets.length})
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '8px' }}>
                        {fiveStarAssets.map(asset => (
                          <div key={asset.id} style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '2px solid #fbbf24', position: 'relative' }}>
                            {asset.type === 'image' ? (
                              <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>{asset.type === 'video' ? '🎬' : '📄'}</div>
                            )}
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 6px', fontSize: '9px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Other Selected Assets */}
                  {otherSelected.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: t.textSecondary }}>Other Selected ({otherSelected.length})</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '6px' }}>
                        {otherSelected.slice(0, 20).map(asset => (
                          <div key={asset.id} style={{ aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: '1px solid #22c55e', position: 'relative' }}>
                            {asset.type === 'image' ? (
                              <img src={asset.thumbnail || asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: '100%', height: '100%', background: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{asset.type === 'video' ? '🎬' : '📄'}</div>
                            )}
                            {asset.rating > 0 && <div style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.7)', borderRadius: '3px', padding: '1px 4px', fontSize: '8px', color: '#fbbf24' }}>{'★'.repeat(asset.rating)}</div>}
                          </div>
                        ))}
                        {otherSelected.length > 20 && <div style={{ aspectRatio: '1', borderRadius: '6px', background: t.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: t.textMuted }}>+{otherSelected.length - 20}</div>}
                      </div>
                    </div>
                  )}
                  
                  {/* Notification Preview */}
                  <div style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '10px', padding: '14px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#6366f1' }}>📧 Notifications will be sent to:</h4>
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
                      <p style={{ margin: 0, fontSize: '11px', color: t.textMuted }}>⚠️ No editors assigned to this project. Add team members first.</p>
                    )}
                  </div>
                  
                  {selectedAssetsList.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: t.textMuted }}>
                      <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤷</div>
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
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>🔗 Match Uploaded Files</h2>
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
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>📄</div>
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
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{asset.type === 'video' ? '🎬' : '📄'}</div>
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

      </div>
    );
  };

  // Annotation Canvas Component with proper fitting and pinch zoom
  const AnnotationCanvas = ({ imageUrl, annotations = [], onChange }) => {
    const [annots, setAnnots] = useState(annotations);
    const [tool, setTool] = useState('rect');
    const [color, setColor] = useState('#ef4444');
    const [newText, setNewText] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [currentEnd, setCurrentEnd] = useState(null);
    const [dragging, setDragging] = useState(null);
    const [resizing, setResizing] = useState(null);
    const [selectedAnnot, setSelectedAnnot] = useState(null);
    const [zoom, setZoom] = useState(100);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
    const [isPinching, setIsPinching] = useState(false);
    const [pendingAnnot, setPendingAnnot] = useState(null); // For text modal
    const [annotText, setAnnotText] = useState('');
    const lastPinchDistRef = useRef(0);
    const containerRef = useRef(null);
    const imageContainerRef = useRef(null);

    const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
    const TOOLS = [
      { id: 'rect', icon: '▢', label: 'Rectangle' },
      { id: 'circle', icon: '○', label: 'Circle' },
      { id: 'arrow', icon: '→', label: 'Arrow' },
      { id: 'freehand', icon: '✎', label: 'Draw' },
      { id: 'text', icon: 'T', label: 'Text' },
    ];

    // Handle image load
    const handleImageLoad = (e) => {
      setImageLoaded(true);
      setImageDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });
    };

    // Get position relative to image container
    const getPos = (e) => {
      if (!imageContainerRef.current) return { x: 0, y: 0 };
      const rect = imageContainerRef.current.getBoundingClientRect();
      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      return {
        x: Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)),
        y: Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
      };
    };

    // Pinch zoom handlers
    const getTouchDist = (touches) => {
      if (touches.length < 2) return 0;
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        setIsPinching(true);
        lastPinchDistRef.current = getTouchDist(e.touches);
        return;
      }
      if (e.touches.length === 1 && !isPinching) {
        handleStart(e);
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        if (lastPinchDistRef.current > 0) {
          const scale = dist / lastPinchDistRef.current;
          setZoom(z => Math.max(50, Math.min(300, z * scale)));
        }
        lastPinchDistRef.current = dist;
        return;
      }
      if (e.touches.length === 1 && !isPinching) {
        handleMove(e);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        setIsPinching(false);
        lastPinchDistRef.current = 0;
      }
      if (e.touches.length === 0 && !isPinching) {
        handleEnd(e);
      }
    };

    const handleStart = (e) => {
      if (dragging || resizing || isPinching) return;
      e.preventDefault();
      e.stopPropagation();
      const pos = getPos(e);
      setDrawStart(pos);
      setCurrentEnd(pos);
      setIsDrawing(true);
      if (tool === 'freehand') setCurrentPath([pos]);
    };

    const handleMove = (e) => {
      if (isPinching) return;
      
      if (dragging) {
        e.preventDefault();
        const pos = getPos(e);
        const updated = annots.map(a => a.id === dragging ? { ...a, x: Math.max(0, Math.min(100 - (a.width || 5), pos.x - (a.width || 5)/2)), y: Math.max(0, Math.min(100 - (a.height || 5), pos.y - (a.height || 5)/2)) } : a);
        setAnnots(updated);
        return;
      }
      if (resizing) {
        e.preventDefault();
        const pos = getPos(e);
        const annot = annots.find(a => a.id === resizing);
        if (annot) {
          const w = Math.max(3, pos.x - annot.x);
          const h = Math.max(3, pos.y - annot.y);
          const updated = annots.map(a => a.id === resizing ? { ...a, width: w, height: h } : a);
          setAnnots(updated);
        }
        return;
      }
      if (!isDrawing || !drawStart) return;
      e.preventDefault();
      const pos = getPos(e);
      setCurrentEnd(pos);
      if (tool === 'freehand') setCurrentPath(prev => [...prev, pos]);
    };

    const handleEnd = (e) => {
      if (dragging) { setDragging(null); onChange(annots); return; }
      if (resizing) { setResizing(null); onChange(annots); return; }
      if (!isDrawing || !drawStart) return;
      
      const pos = currentEnd || drawStart;
      const width = Math.abs(pos.x - drawStart.x);
      const height = Math.abs(pos.y - drawStart.y);
      const x = Math.min(pos.x, drawStart.x);
      const y = Math.min(pos.y, drawStart.y);

      const author = typeof userProfile !== 'undefined' ? userProfile?.name : 'You';

      // For text tool, show immediately if text is already entered
      if (tool === 'text' && newText.trim()) {
        const newAnnot = { id: generateId(), type: 'text', x: drawStart.x, y: drawStart.y, text: newText, color, createdAt: new Date().toISOString(), author };
        const updated = [...annots, newAnnot];
        setAnnots(updated);
        onChange(updated);
        setNewText('');
      } else if (tool === 'freehand' && currentPath.length > 2) {
        // For freehand, show text modal to add description
        const pending = { id: generateId(), type: 'freehand', path: currentPath, color, createdAt: new Date().toISOString(), author };
        setPendingAnnot(pending);
        setAnnotText('');
      } else if (width > 2 || height > 2) {
        // For shapes (rect, circle, arrow), show text modal
        const pending = { id: generateId(), type: tool, x, y, width: Math.max(width, 5), height: Math.max(height, 5), color, createdAt: new Date().toISOString(), author };
        setPendingAnnot(pending);
        setAnnotText('');
      }

      setIsDrawing(false);
      setDrawStart(null);
      setCurrentEnd(null);
      setCurrentPath([]);
    };

    // Confirm annotation with text
    const confirmAnnotation = () => {
      if (!pendingAnnot) return;
      const finalAnnot = { ...pendingAnnot, text: annotText.trim() || 'No description' };
      const updated = [...annots, finalAnnot];
      setAnnots(updated);
      onChange(updated);
      setPendingAnnot(null);
      setAnnotText('');
    };

    // Cancel pending annotation
    const cancelAnnotation = () => {
      setPendingAnnot(null);
      setAnnotText('');
    };

    const deleteAnnot = (id, e) => { 
      if (e) e.stopPropagation();
      const updated = annots.filter(a => a.id !== id); 
      setAnnots(updated); 
      onChange(updated); 
      setSelectedAnnot(null);
    };

    const renderAnnotation = (a) => {
      const isSelected = selectedAnnot === a.id;
      
      if (a.type === 'freehand' && a.path) {
        const pathD = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        // Calculate bounding box for freehand
        const minX = Math.min(...a.path.map(p => p.x));
        const minY = Math.min(...a.path.map(p => p.y));
        return (
          <div key={a.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible' }}>
              <path d={pathD} stroke={a.color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px', pointerEvents: 'stroke', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }} />
            </svg>
            {a.text && <div style={{ position: 'absolute', left: `${minX}%`, top: `${Math.max(0, minY - 5)}%`, transform: 'translateY(-100%)', background: a.color, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: '600', zIndex: 11, pointerEvents: 'auto' }}>{a.text}</div>}
            {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', left: `${minX}%`, top: `${minY}%`, transform: 'translate(-50%, -50%)', width: '24px', height: '24px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '14px', cursor: 'pointer', zIndex: 12, pointerEvents: 'auto' }}>×</button>}
          </div>
        );
      }

      if (a.type === 'text') {
        return (
          <div key={a.id} 
            style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, color: a.color, fontSize: '16px', fontWeight: '700', textShadow: '0 2px 4px rgba(0,0,0,0.9)', border: isSelected ? `2px dashed ${a.color}` : 'none', padding: '4px 8px', cursor: 'move', background: isSelected ? 'rgba(0,0,0,0.3)' : 'transparent', borderRadius: '4px', zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
            onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            {a.text}
            {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '12px', cursor: 'pointer', lineHeight: '18px' }}>×</button>}
          </div>
        );
      }

      if (a.type === 'circle') {
        return (
          <div key={a.id} 
            style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `3px solid ${a.color}`, borderRadius: '50%', background: `${a.color}20`, cursor: 'move', boxSizing: 'border-box', zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
            onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            {a.text && <div style={{ position: 'absolute', top: '-28px', left: '0', background: a.color, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: '600' }}>{a.text}</div>}
            {isSelected && <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} onTouchStart={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '14px', height: '14px', background: a.color, borderRadius: '3px', cursor: 'se-resize' }} />}
            {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>×</button>}
          </div>
        );
      }

      if (a.type === 'arrow') {
        const centerX = a.x + a.width / 2;
        const centerY = a.y + a.height / 2;
        return (
          <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, cursor: 'move', zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
            onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            {a.text && <div style={{ position: 'absolute', top: '-28px', left: '0', background: a.color, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: '600', zIndex: 11 }}>{a.text}</div>}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs><marker id={`arr-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
              <line x1="0" y1="50" x2="100" y2="50" stroke={a.color} strokeWidth="3" markerEnd={`url(#arr-${a.id})`} vectorEffect="non-scaling-stroke" />
            </svg>
            {isSelected && <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} onTouchStart={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '14px', height: '14px', background: a.color, borderRadius: '3px', cursor: 'se-resize', zIndex: 12 }} />}
            {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '12px', cursor: 'pointer', zIndex: 12 }}>×</button>}
          </div>
        );
      }

      // Rectangle
      return (
        <div key={a.id} 
          style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `3px solid ${a.color}`, borderRadius: '4px', background: `${a.color}20`, cursor: 'move', boxSizing: 'border-box', zIndex: 10 }}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}
          onTouchStart={(e) => { e.stopPropagation(); setDragging(a.id); }}>
          {a.text && <div style={{ position: 'absolute', top: '-28px', left: '0', background: a.color, padding: '4px 10px', borderRadius: '4px', fontSize: '11px', whiteSpace: 'nowrap', fontWeight: '600' }}>{a.text}</div>}
          {isSelected && <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} onTouchStart={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-6px', right: '-6px', width: '14px', height: '14px', background: a.color, borderRadius: '3px', cursor: 'se-resize' }} />}
          {isSelected && <button onClick={(e) => deleteAnnot(a.id, e)} style={{ position: 'absolute', top: '-10px', right: '-10px', width: '20px', height: '20px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>×</button>}
        </div>
      );
    };

    // Draw preview shape
    const renderPreview = () => {
      if (!isDrawing || !drawStart || !currentEnd || tool === 'text') return null;
      if (tool === 'freehand' && currentPath.length > 1) {
        const pathD = currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}><path d={pathD} stroke={color} strokeWidth="0.5" fill="none" strokeLinecap="round" opacity="0.7" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px' }} /></svg>;
      }
      const x = Math.min(drawStart.x, currentEnd.x);
      const y = Math.min(drawStart.y, currentEnd.y);
      const w = Math.abs(currentEnd.x - drawStart.x);
      const h = Math.abs(currentEnd.y - drawStart.y);
      if (w < 1 && h < 1) return null;
      return <div style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`, border: `2px dashed ${color}`, borderRadius: tool === 'circle' ? '50%' : '4px', pointerEvents: 'none', opacity: 0.7, background: `${color}10` }} />;
    };

    // Fit to container - reset zoom
    const handleFitToContainer = () => setZoom(100);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0, padding: '0 4px' }}>
          <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px' }}>
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                style={{ width: '32px', height: '32px', background: tool === t.id ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                {t.icon}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: '24px', height: '24px', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer' }} />
            ))}
          </div>
          {(tool === 'text' || tool === 'rect' || tool === 'circle') && (
            <Input theme={theme} value={newText} onChange={setNewText} placeholder={tool === 'text' ? 'Text...' : 'Label...'} style={{ width: '100px', padding: '6px 10px', fontSize: '11px' }} />
          )}
          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '4px', background: t.bgInput, borderRadius: '8px', padding: '4px', marginLeft: 'auto' }}>
            <button onClick={() => setZoom(z => Math.max(25, z - 25))} style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>−</button>
            <button onClick={handleFitToContainer} style={{ padding: '4px 8px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', background: 'transparent', border: 'none', cursor: 'pointer' }}>{zoom}%</button>
            <button onClick={() => setZoom(z => Math.min(300, z + 25))} style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '16px' }}>+</button>
          </div>
        </div>

        {/* Image container - fits within available space */}
        <div 
          ref={containerRef}
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            overflow: zoom > 100 ? 'auto' : 'hidden',
            background: '#0a0a0f',
            borderRadius: '8px',
            position: 'relative'
          }}>
          
          {/* Loading spinner */}
          {!imageLoaded && (
            <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.textMuted }}>
              Loading...
            </div>
          )}
          
          {/* Image with annotations */}
          <div 
            ref={imageContainerRef}
            onMouseDown={handleStart} 
            onMouseMove={handleMove} 
            onMouseUp={handleEnd} 
            onMouseLeave={handleEnd}
            onTouchStart={handleTouchStart} 
            onTouchMove={handleTouchMove} 
            onTouchEnd={handleTouchEnd}
            onClick={() => setSelectedAnnot(null)}
            style={{ 
              position: 'relative',
              cursor: 'crosshair', 
              userSelect: 'none', 
              touchAction: 'none',
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'center center',
              maxWidth: zoom <= 100 ? '100%' : 'none',
              maxHeight: zoom <= 100 ? '100%' : 'none',
              transition: 'transform 0.1s ease-out'
            }}>
            <img 
              src={imageUrl} 
              alt="" 
              draggable={false}
              onLoad={handleImageLoad}
              style={{ 
                display: 'block',
                maxWidth: zoom <= 100 ? '100%' : `${imageDims.width}px`,
                maxHeight: zoom <= 100 ? 'calc(100vh - 350px)' : `${imageDims.height}px`,
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                pointerEvents: 'none',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.2s'
              }} 
            />
            {imageLoaded && annots.map(renderAnnotation)}
            {imageLoaded && renderPreview()}
          </div>
        </div>
        
        {annots.length > 0 && <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '6px', flexShrink: 0, textAlign: 'center' }}>{annots.length} annotation{annots.length !== 1 ? 's'  : ''} • Pinch to zoom</div>}
        
        {/* Text Modal for Annotation Description */}
        {pendingAnnot && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={cancelAnnotation}>
            <div style={{ background: t.bgCard, borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>✏️ Add Description</h3>
              <p style={{ margin: '0 0 16px', fontSize: '12px', color: t.textMuted }}>What feedback do you want to give about this area?</p>
              <textarea 
                value={annotText} 
                onChange={(e) => setAnnotText(e.target.value)} 
                placeholder="E.g., Fix the color balance here, crop tighter, remove this element..." 
                autoFocus
                style={{ width: '100%', minHeight: '100px', padding: '12px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '8px', color: '#fff', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }} 
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
                <button onClick={cancelAnnotation} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={confirmAnnotation} style={{ padding: '10px 20px', background: pendingAnnot.color, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Add Annotation</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Version Comparison Component
  const VersionComparison = ({ versions = [], currentVersion }) => {
    const [leftV, setLeftV] = useState(versions.length > 1 ? versions.length - 2 : 0);
    const [rightV, setRightV] = useState(versions.length - 1);
    if (versions.length < 2) return <div style={{ textAlign: 'center', padding: '40px', background: t.bgInput, borderRadius: '12px' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div><div style={{ color: t.textMuted, fontSize: '13px' }}>Upload more versions to compare</div></div>;
    const left = versions[leftV];
    const right = versions[rightV];
    return (
      <div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Select theme={theme} value={leftV} onChange={v => setLeftV(parseInt(v))} style={{ width: '140px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
          <span style={{ color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>vs</span>
          <Select theme={theme} value={rightV} onChange={v => setRightV(parseInt(v))} style={{ width: '140px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ background: t.bgInput, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px', borderBottom: `1px solid ${t.border}`, fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}><span>v{left.version}</span><span style={{ color: t.textMuted, fontSize: '10px' }}>{formatDate(left.uploadedAt)}</span></div>
            <div style={{ padding: '12px' }}><img src={left.url} alt="" loading="lazy" style={{ width: '100%', borderRadius: '6px' }} /></div>
          </div>
          <div style={{ background: t.bgInput, borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px', borderBottom: `1px solid ${t.border}`, fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}><span>v{right.version} {right.version === currentVersion && <span style={{ color: '#22c55e' }}>✓</span>}</span><span style={{ color: t.textMuted, fontSize: '10px' }}>{formatDate(right.uploadedAt)}</span></div>
            <div style={{ padding: '12px' }}><img src={right.url} alt="" loading="lazy" style={{ width: '100%', borderRadius: '6px' }} /></div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div style={{ minHeight: '100vh', background: t.bgInput, color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* Global CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .asset-card:hover .card-delete-btn { opacity: 1 !important; }
      `}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
      <div style={{ marginLeft: isMobile ? '0' : (sidebarCollapsed ? '60px' : '200px'), padding: isMobile ? '60px 16px 16px' : '24px', background: t.bg, minHeight: '100vh', transition: 'margin-left 0.2s ease' }}>
        {view === 'dashboard' && <Dashboard />}
        {view === 'tasks' && <TasksView />}
        {view === 'projects' && !selectedProjectId && <ProjectsList />}
        {view === 'projects' && selectedProjectId && <ProjectDetail />}
        {view === 'calendar' && <CalendarView />}
        {view === 'team' && <TeamManagement />}
        {view === 'downloads' && <DownloadsView />}
      </div>
    </div>
  );
}
