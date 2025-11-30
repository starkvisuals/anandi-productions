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
    bgSecondary: '#12121a',
    bgTertiary: '#16161f',
    bgCard: '#1e1e2e',
    border: '#2a2a3e',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.6)',
    textMuted: 'rgba(255,255,255,0.4)',
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  light: {
    bg: '#f8fafc',
    bgSecondary: '#ffffff',
    bgTertiary: '#f1f5f9',
    bgCard: '#ffffff',
    border: '#e2e8f0',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#94a3b8',
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  }
};

const DEFAULT_CATEGORIES = [
  { id: 'cgi', name: 'CGI', icon: '🌐', color: '#3b82f6' },
  { id: 'animation', name: 'Animation', icon: '🎭', color: '#a855f7' },
  { id: 'statics', name: 'Statics', icon: '🖼️', color: '#ec4899' },
  { id: 'videos', name: 'Videos', icon: '🎬', color: '#f97316' },
  { id: 'vfx', name: 'VFX', icon: '✨', color: '#10b981' },
  { id: 'audio', name: 'Audio', icon: '🔊', color: '#06b6d4' },
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

// Generate thumbnail from image file (400px max)
const generateThumbnail = (file, maxSize = 400) => {
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
        canvas.toBlob(resolve, 'image/jpeg', 0.7);
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
const CardSkeleton = ({ aspectRatio = 1 }) => (
  <div style={{ 
    background: '#16161f', 
    borderRadius: '12px', 
    overflow: 'hidden',
    border: '1px solid #1e1e2e'
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
const Modal = ({ title, onClose, children, wide }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  // ESC key to close
  useEffect(() => { 
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? 0 : '20px' }} onClick={onClose}>
      <div style={{ background: '#16161f', borderRadius: isMobile ? 0 : '16px', border: isMobile ? 'none' : '1px solid #1e1e2e', width: '100%', maxWidth: isMobile ? '100%' : (wide ? '1200px' : '550px'), height: isMobile ? '100%' : (wide ? '85vh' : 'auto'), maxHeight: isMobile ? '100%' : '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #1e1e2e', background: '#16161f', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '10px' }}>{title}</h3>
          <button onClick={onClose} style={{ background: '#1e1e2e', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
};

// Activity Timeline Component
const ActivityTimeline = ({ activities = [], maxItems = 10 }) => {
  const sorted = [...activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, maxItems);
  const getIcon = (type) => {
    const icons = { upload: '⬆️', feedback: '💬', status: '🔄', version: '📦', rating: '⭐', select: '✅', assign: '👤', delete: '🗑️', create: '➕' };
    return icons[type] || '📌';
  };
  if (sorted.length === 0) return <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No activity yet</div>;
  return (
    <div style={{ position: 'relative', paddingLeft: '24px' }}>
      <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: '#2a2a3e' }} />
      {sorted.map((a, i) => (
        <div key={a.id || i} style={{ position: 'relative', paddingBottom: '16px' }}>
          <div style={{ position: 'absolute', left: '-20px', width: '18px', height: '18px', background: '#1e1e2e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', border: '2px solid #2a2a3e' }}>{getIcon(a.type)}</div>
          <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '12px', marginBottom: '4px' }}>{a.message}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(a.timestamp)}</div>
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
const Btn = ({ children, onClick, color = '#6366f1', disabled, small, outline }) => <button onClick={onClick} disabled={disabled} style={{ padding: small ? '8px 12px' : '10px 16px', background: outline ? 'transparent' : color, border: outline ? `1px solid ${color}` : 'none', borderRadius: '8px', color: outline ? color : '#fff', fontSize: small ? '11px' : '13px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>{children}</button>;
const Input = ({ value, onChange, placeholder, type = 'text', style, ...props }) => <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', ...style }} {...props} />;
const Select = ({ value, onChange, children, style }) => <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '13px', ...style }}>{children}</select>;

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

const AppearancePanel = ({ settings, onChange, onClose }) => (
  <div style={{ position: 'absolute', top: '45px', right: '0', background: '#1e1e2e', borderRadius: '12px', border: '1px solid #2a2a3e', padding: '16px', width: '240px', zIndex: 100 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}><span style={{ fontSize: '13px', fontWeight: '600' }}>Appearance</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px' }}>×</button></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Layout</div><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => onChange({ ...settings, layout: 'grid' })} style={{ flex: 1, padding: '8px', background: settings.layout === 'grid' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>⊞ Grid</button><button onClick={() => onChange({ ...settings, layout: 'list' })} style={{ flex: 1, padding: '8px', background: settings.layout === 'list' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>☰ List</button></div></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Card Size</div><div style={{ display: 'flex', gap: '8px' }}>{['S', 'M', 'L'].map(s => <button key={s} onClick={() => onChange({ ...settings, cardSize: s })} style={{ flex: 1, padding: '8px', background: settings.cardSize === s ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{s}</button>)}</div></div>
    <div style={{ marginBottom: '14px' }}><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Aspect Ratio</div><div style={{ display: 'flex', gap: '8px' }}>{['landscape', 'square', 'portrait'].map(a => <button key={a} onClick={() => onChange({ ...settings, aspectRatio: a })} style={{ flex: 1, padding: '8px', background: settings.aspectRatio === a ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{a === 'landscape' ? '▬' : a === 'square' ? '◼' : '▮'}</button>)}</div></div>
    <div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Show Info</span><button onClick={() => onChange({ ...settings, showInfo: !settings.showInfo })} style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', background: settings.showInfo ? '#6366f1' : '#0d0d14', cursor: 'pointer', position: 'relative' }}><div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: settings.showInfo ? '22px' : '2px', transition: 'left 0.2s' }} /></button></div></div>
  </div>
);

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
              border: '1px solid #2a2a3e',
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
                    <button onClick={clearNotifications} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer' }}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              {/* Notifications List */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
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
                            color: 'rgba(255,255,255,0.5)',
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
    
    const columns = [
      { id: 'pending', title: 'Pending', icon: '⏳', color: '#fbbf24' },
      { id: 'assigned', title: 'Assigned', icon: '📋', color: '#3b82f6' },
      { id: 'in-progress', title: 'In Progress', icon: '⚡', color: '#8b5cf6' },
      { id: 'review-ready', title: 'Review Ready', icon: '👁️', color: '#a855f7' },
      { id: 'revision', title: 'Revision', icon: '🔄', color: '#f97316' },
      { id: 'approved', title: 'Approved', icon: '✓', color: '#22c55e' },
    ];
    
    const handleDrop = async (status) => {
      if (!draggedAsset || draggedAsset.status === status) return;
      await onUpdateStatus(draggedAsset.id, status);
      setDraggedAsset(null);
    };
    
    return (
      <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '16px' }}>
        {columns.map(col => {
          const colAssets = assets.filter(a => a.status === col.id);
          
          return (
            <div 
              key={col.id}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(col.id)}
              style={{ 
                minWidth: '250px', 
                background: t.bgTertiary, 
                borderRadius: '12px', 
                border: `1px solid ${t.border}`,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Column Header */}
              <div style={{ 
                padding: '12px 14px', 
                borderBottom: `1px solid ${t.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>{col.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: '600', color: t.text }}>{col.title}</span>
                <span style={{ 
                  marginLeft: 'auto', 
                  fontSize: '11px', 
                  padding: '2px 8px', 
                  background: `${col.color}20`,
                  color: col.color,
                  borderRadius: '10px',
                  fontWeight: '600'
                }}>
                  {colAssets.length}
                </span>
              </div>
              
              {/* Column Content */}
              <div style={{ flex: 1, padding: '8px', minHeight: '200px' }}>
                {colAssets.map(a => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={() => setDraggedAsset(a)}
                    onDragEnd={() => setDraggedAsset(null)}
                    style={{
                      padding: '10px',
                      background: t.bgCard,
                      borderRadius: '8px',
                      marginBottom: '8px',
                      cursor: 'grab',
                      border: `1px solid ${t.border}`,
                      transition: 'transform 0.1s'
                    }}
                  >
                    {a.thumbnail && (
                      <img 
                        src={a.thumbnail} 
                        alt="" 
                        style={{ 
                          width: '100%', 
                          height: '80px', 
                          objectFit: 'cover', 
                          borderRadius: '6px',
                          marginBottom: '8px'
                        }} 
                      />
                    )}
                    <div style={{ fontSize: '12px', fontWeight: '500', color: t.text, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.name}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {a.dueDate && (
                        <span style={{ 
                          fontSize: '10px', 
                          padding: '2px 6px', 
                          background: new Date(a.dueDate) < new Date() ? 'rgba(239,68,68,0.2)' : t.bgTertiary,
                          color: new Date(a.dueDate) < new Date() ? '#ef4444' : t.textSecondary,
                          borderRadius: '4px'
                        }}>
                          📅 {formatDate(a.dueDate)}
                        </span>
                      )}
                      {a.assignedToName && (
                        <span style={{ fontSize: '10px', color: t.textMuted }}>
                          👤 {a.assignedToName.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                
                {colAssets.length === 0 && (
                  <div style={{ 
                    padding: '20px', 
                    textAlign: 'center', 
                    color: t.textMuted, 
                    fontSize: '11px',
                    border: `2px dashed ${t.border}`,
                    borderRadius: '8px'
                  }}>
                    Drop here
                  </div>
                )}
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
          <button onClick={onClose} style={{ background: '#1e1e2e', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}>×</button>
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

  const Sidebar = () => (
    <div style={{ width: isMobile ? '100%' : '200px', background: t.bgSecondary, borderRight: isMobile ? 'none' : `1px solid ${t.border}`, borderBottom: isMobile ? `1px solid ${t.border}` : 'none', height: isMobile ? 'auto' : '100vh', position: isMobile ? 'relative' : 'fixed', left: 0, top: 0, display: 'flex', flexDirection: isMobile ? 'row' : 'column', zIndex: 100 }}>
      {!isMobile && <div style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div><div style={{ fontSize: '8px', color: t.textMuted, marginTop: '2px' }}>Production Hub</div></div><NotificationPanel /></div>}
      
      {/* Search Button */}
      {!isMobile && (
        <div style={{ padding: '0 10px 10px' }}>
          <button 
            onClick={() => setShowGlobalSearch(true)}
            style={{ 
              width: '100%', 
              padding: '10px 12px', 
              background: t.bgCard, 
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
            <span>🔍</span>
            <span style={{ flex: 1 }}>Search</span>
            <span style={{ fontSize: '10px', background: t.bgTertiary, padding: '2px 6px', borderRadius: '4px' }}>/</span>
          </button>
        </div>
      )}
      
      <nav style={{ flex: 1, padding: isMobile ? '10px' : '0 10px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? '6px' : '0', alignItems: isMobile ? 'center' : 'stretch' }}>
        {isMobile && <NotificationPanel />}
        {isMobile && <button onClick={() => setShowGlobalSearch(true)} style={{ padding: '10px', background: 'transparent', border: 'none', cursor: 'pointer' }}><span style={{ fontSize: '16px' }}>🔍</span></button>}
        {[
          { id: 'dashboard', icon: '📊', label: 'Dashboard' }, 
          { id: 'tasks', icon: '✅', label: 'My Tasks' }, 
          { id: 'projects', icon: '📁', label: 'Projects' },
          { id: 'calendar', icon: '📅', label: 'Calendar' },
          ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])
        ].map(item => (
          <div key={item.id} onClick={() => { setView(item.id); setSelectedProjectId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '10px 14px' : '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: view === item.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === item.id ? t.text : t.textSecondary, marginBottom: isMobile ? '0' : '2px' }}><span style={{ fontSize: '14px' }}>{item.icon}</span>{!isMobile && item.label}</div>
        ))}
      </nav>
      {!isMobile && (
        <div style={{ padding: '14px', borderTop: `1px solid ${t.border}` }}>
          {/* Theme Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              style={{ 
                flex: 1,
                padding: '8px', 
                background: t.bgCard, 
                border: `1px solid ${t.border}`, 
                borderRadius: '8px', 
                color: t.textSecondary, 
                fontSize: '11px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Avatar user={userProfile} size={32} /><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: '11px', fontWeight: '500', color: t.text }}>{userProfile?.firstName}</div><div style={{ fontSize: '9px', color: t.textMuted }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div></div></div>
          <button onClick={signOut} style={{ width: '100%', padding: '8px', background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '11px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      )}
    </div>
  );

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
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Welcome, {userProfile?.firstName}</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: s.alert ? 'rgba(239,68,68,0.1)' : '#16161f', borderRadius: '12px', border: s.alert ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1e1e2e', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Alerts Section */}
        {(overdueAssets.length > 0 || pendingReview.length > 0) && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#ef4444' }}>⚠️ Needs Attention</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {overdueAssets.slice(0, 5).map(a => (
                <span key={a.id} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.15)', borderRadius: '6px', fontSize: '11px', color: '#fca5a5' }}>
                  🚨 {a.name} overdue
                </span>
              ))}
              {pendingReview.slice(0, 3).map(a => (
                <span key={a.id} style={{ padding: '6px 12px', background: 'rgba(168,85,247,0.15)', borderRadius: '6px', fontSize: '11px', color: '#c4b5fd' }}>
                  👁️ {a.name} needs review
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
          {/* Active Projects */}
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>📁 Active Projects ({activeProjects.length})</h3>
            </div>
            {activeProjects.slice(0, 5).map(p => {
              const pAssets = (p.assets || []).filter(a => !a.deleted);
              const pOverdue = pAssets.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'delivered').length;
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', border: pOverdue > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{p.client} • {pAssets.length} assets</div>
                  </div>
                  {pOverdue > 0 && <span style={{ padding: '2px 6px', background: '#ef4444', borderRadius: '4px', fontSize: '9px' }}>{pOverdue}⚠️</span>}
                </div>
              );
            })}
            {activeProjects.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No active projects</div>}
          </div>
          
          {/* Team Workload */}
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>👥 Team Workload</h3>
            {teamWorkload.slice(0, 5).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                <Avatar user={m} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{TEAM_ROLES[m.role]?.label || m.role}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: m.overdue > 0 ? '#ef4444' : '#6366f1' }}>{m.totalAssigned}</div>
                  {m.overdue > 0 && <div style={{ fontSize: '9px', color: '#ef4444' }}>{m.overdue} overdue</div>}
                </div>
              </div>
            ))}
            {teamWorkload.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No assigned work</div>}
          </div>
          
          {/* Recent Activity */}
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>🔔 Recent Activity</h3>
            {recentActivity.map(a => (
              <div key={a.id} onClick={() => { setSelectedProjectId(a.projectId); setView('projects'); }} style={{ display: 'flex', gap: '10px', padding: '8px 10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.message}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{a.projectName} • {formatTimeAgo(a.timestamp)}</div>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No activity</div>}
          </div>
        </div>
        
        {/* Completed Projects Section */}
        {completedProjects.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>✓ Completed Projects ({completedProjects.length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '10px' }}>
              {completedProjects.slice(0, 4).map(p => (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ padding: '12px', background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', cursor: 'pointer', opacity: 0.7 }}>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>{p.name}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{p.client}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // PHASE B: Task Management View
  const TasksView = () => {
    const [taskTab, setTaskTab] = useState('today'); // today, week, overdue, all
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', dueDate: '', dueTime: '', priority: 'medium', projectId: '' });
    const [manualTasks, setManualTasks] = useState(() => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(`anandi-tasks-${userProfile?.id}`);
        return saved ? JSON.parse(saved) : [];
      }
      return [];
    });

    // Save manual tasks
    const saveTasks = (tasks) => {
      setManualTasks(tasks);
      if (typeof window !== 'undefined' && userProfile?.id) {
        localStorage.setItem(`anandi-tasks-${userProfile.id}`, JSON.stringify(tasks));
      }
    };

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
                title: asset.name,
                projectId: project.id,
                projectName: project.name,
                assetId: asset.id,
                status: asset.status,
                dueDate: asset.dueDate,
                priority: asset.dueDate && new Date(asset.dueDate) < new Date() ? 'high' : 'medium',
                category: asset.category
              });
            }
          }
        });
      });
      return tasks;
    };

    // Combine auto and manual tasks
    const allTasks = [...getAutoTasks(), ...manualTasks.filter(t => !t.completed)];
    const completedTasks = manualTasks.filter(t => t.completed);

    // Filter tasks by tab
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const filterTasks = (tasks) => {
      switch (taskTab) {
        case 'today':
          return tasks.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
          });
        case 'week':
          return tasks.filter(t => {
            if (!t.dueDate) return false;
            const due = new Date(t.dueDate);
            return due >= today && due <= weekEnd;
          });
        case 'overdue':
          return tasks.filter(t => {
            if (!t.dueDate) return false;
            return new Date(t.dueDate) < today;
          });
        default:
          return tasks;
      }
    };

    const filteredTasks = filterTasks(allTasks);
    const overdueTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
    const todayTasks = allTasks.filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
    });

    // Add manual task
    const addTask = () => {
      if (!newTask.title.trim()) return;
      const task = {
        id: generateId(),
        type: 'manual',
        title: newTask.title,
        dueDate: newTask.dueDate || null,
        dueTime: newTask.dueTime || null,
        priority: newTask.priority,
        projectId: newTask.projectId || null,
        projectName: newTask.projectId ? projects.find(p => p.id === newTask.projectId)?.name : null,
        completed: false,
        createdAt: new Date().toISOString()
      };
      saveTasks([task, ...manualTasks]);
      setNewTask({ title: '', dueDate: '', dueTime: '', priority: 'medium', projectId: '' });
      setShowAddTask(false);
    };

    // Toggle task completion
    const toggleTask = (taskId) => {
      const updated = manualTasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t
      );
      saveTasks(updated);
    };

    // Delete task
    const deleteTask = (taskId) => {
      saveTasks(manualTasks.filter(t => t.id !== taskId));
    };

    const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const statusLabels = { pending: 'Pending', 'in-progress': 'In Progress', 'review-ready': 'Review Ready', revision: 'Revision' };

    const TaskCard = ({ task }) => (
      <div 
        onClick={() => {
          if (task.type === 'auto' && task.projectId) {
            setSelectedProjectId(task.projectId);
            setView('projects');
          }
        }}
        style={{ 
          display: 'flex', 
          gap: '12px', 
          padding: '14px 16px', 
          background: '#16161f', 
          borderRadius: '10px', 
          marginBottom: '8px',
          border: '1px solid #1e1e2e',
          cursor: task.type === 'auto' ? 'pointer' : 'default',
          borderLeft: `3px solid ${priorityColors[task.priority]}`
        }}
      >
        {task.type === 'manual' && (
          <div 
            onClick={(e) => { e.stopPropagation(); toggleTask(task.id); }}
            style={{ 
              width: '20px', 
              height: '20px', 
              borderRadius: '4px', 
              border: '2px solid #3a3a4a', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {task.completed && <span style={{ color: '#22c55e' }}>✓</span>}
          </div>
        )}
        {task.type === 'auto' && (
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '4px', 
            background: 'rgba(99,102,241,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            flexShrink: 0
          }}>
            📁
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px' }}>{task.title}</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {task.projectName && (
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>📁 {task.projectName}</span>
            )}
            {task.status && (
              <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                {statusLabels[task.status] || task.status}
              </span>
            )}
            {task.dueDate && (
              <span style={{ 
                fontSize: '11px', 
                color: new Date(task.dueDate) < today ? '#ef4444' : 'rgba(255,255,255,0.5)'
              }}>
                📅 {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                {task.dueTime && ` at ${task.dueTime}`}
              </span>
            )}
          </div>
        </div>
        {task.type === 'manual' && (
          <button 
            onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '14px' }}
          >
            ×
          </button>
        )}
      </div>
    );

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>My Tasks</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              {allTasks.length} task{allTasks.length !== 1 ? 's' : ''} • {overdueTasks.length} overdue
            </p>
          </div>
          <Btn onClick={() => setShowAddTask(true)} small>+ Add Task</Btn>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          <div style={{ background: overdueTasks.length > 0 ? 'rgba(239,68,68,0.1)' : '#16161f', borderRadius: '10px', padding: '14px', border: overdueTasks.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: overdueTasks.length > 0 ? '#ef4444' : '#fff' }}>{overdueTasks.length}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Overdue</div>
          </div>
          <div style={{ background: '#16161f', borderRadius: '10px', padding: '14px', border: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#f59e0b' }}>{todayTasks.length}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Due Today</div>
          </div>
          <div style={{ background: '#16161f', borderRadius: '10px', padding: '14px', border: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#6366f1' }}>{allTasks.length}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Total Tasks</div>
          </div>
          <div style={{ background: '#16161f', borderRadius: '10px', padding: '14px', border: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#22c55e' }}>{completedTasks.length}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>Completed</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: 'Today', count: todayTasks.length },
            { id: 'week', label: 'This Week' },
            { id: 'overdue', label: 'Overdue', count: overdueTasks.length },
            { id: 'all', label: 'All Tasks' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setTaskTab(tab.id)}
              style={{ 
                padding: '8px 14px', 
                borderRadius: '8px', 
                border: 'none',
                background: taskTab === tab.id ? '#6366f1' : '#1e1e2e',
                color: taskTab === tab.id ? '#fff' : 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{ 
                  background: tab.id === 'overdue' ? '#ef4444' : 'rgba(255,255,255,0.2)', 
                  padding: '2px 6px', 
                  borderRadius: '10px', 
                  fontSize: '10px' 
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div>
          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>
                {taskTab === 'overdue' ? '🎉' : '📋'}
              </div>
              <div style={{ fontSize: '14px' }}>
                {taskTab === 'overdue' ? 'No overdue tasks!' : 'No tasks in this view'}
              </div>
            </div>
          ) : (
            filteredTasks.sort((a, b) => {
              // Sort by due date, then priority
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1;
              if (!b.dueDate) return -1;
              return new Date(a.dueDate) - new Date(b.dueDate);
            }).map(task => <TaskCard key={task.id} task={task} />)
          )}
        </div>

        {/* Completed Tasks */}
        {completedTasks.length > 0 && taskTab === 'all' && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginBottom: '12px' }}>
              ✓ Completed ({completedTasks.length})
            </h3>
            {completedTasks.slice(0, 5).map(task => (
              <div 
                key={task.id}
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '12px 16px', 
                  background: '#16161f', 
                  borderRadius: '8px', 
                  marginBottom: '6px',
                  opacity: 0.6
                }}
              >
                <div 
                  onClick={() => toggleTask(task.id)}
                  style={{ 
                    width: '18px', 
                    height: '18px', 
                    borderRadius: '4px', 
                    background: '#22c55e',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>
                </div>
                <span style={{ fontSize: '13px', textDecoration: 'line-through' }}>{task.title}</span>
              </div>
            ))}
          </div>
        )}

        {/* Add Task Modal */}
        {showAddTask && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#16161f', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid #2a2a3e' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: '18px' }}>Add Task</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Task Title *</label>
                <Input 
                  value={newTask.title} 
                  onChange={(v) => setNewTask({ ...newTask, title: v })} 
                  placeholder="What needs to be done?"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Due Date</label>
                  <Input 
                    type="date" 
                    value={newTask.dueDate} 
                    onChange={(v) => setNewTask({ ...newTask, dueDate: v })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Due Time</label>
                  <Input 
                    type="time" 
                    value={newTask.dueTime} 
                    onChange={(v) => setNewTask({ ...newTask, dueTime: v })} 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Priority</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['low', 'medium', 'high'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setNewTask({ ...newTask, priority: p })}
                      style={{ 
                        flex: 1,
                        padding: '8px', 
                        borderRadius: '8px', 
                        border: newTask.priority === p ? `2px solid ${priorityColors[p]}` : '1px solid #2a2a3e',
                        background: newTask.priority === p ? `${priorityColors[p]}20` : 'transparent',
                        color: priorityColors[p],
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Link to Project (optional)</label>
                <Select value={newTask.projectId} onChange={(v) => setNewTask({ ...newTask, projectId: v })}>
                  <option value="">No project</option>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Btn onClick={() => setShowAddTask(false)} outline style={{ flex: 1 }}>Cancel</Btn>
                <Btn onClick={addTask} disabled={!newTask.title.trim()} style={{ flex: 1 }}>Add Task</Btn>
              </div>
            </div>
          </div>
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

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input value={search} onChange={setSearch} placeholder="🔍 Search..." style={{ width: isMobile ? '140px' : '180px' }} />
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ New</Btn>}
          </div>
        </div>
        
        {/* Active / Completed Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button onClick={() => setProjectTab('active')} style={{ padding: '10px 20px', background: projectTab === 'active' ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            📂 Active <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{activeProjects.length}</span>
          </button>
          <button onClick={() => setProjectTab('completed')} style={{ padding: '10px 20px', background: projectTab === 'completed' ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✅ Completed <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px', fontSize: '11px' }}>{completedProjects.length}</span>
          </button>
        </div>
        
        {displayProjects.length === 0 ? (
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>{projectTab === 'active' ? '📁' : '✅'}</div>
            <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>{projectTab === 'active' ? 'No Active Projects' : 'No Completed Projects'}</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '20px' }}>{projectTab === 'active' ? 'Create your first project' : 'Complete a project to see it here'}</p>
            {isProducer && projectTab === 'active' && <Btn onClick={() => setShowCreate(true)}>+ Create Project</Btn>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {displayProjects.map(p => {
              const cnt = p.assets?.length || 0;
              const approved = p.assets?.filter(a => ['approved', 'delivered'].includes(a.status)).length || 0;
              const notifs = getProjectNotifs(p);
              const totalNotifs = notifs.pendingReview + notifs.newFeedback + notifs.changesRequested + notifs.newVersions;
              
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ background: '#16161f', borderRadius: '12px', border: totalNotifs > 0 ? '1px solid rgba(251,191,36,0.4)' : '1px solid #1e1e2e', padding: '18px', cursor: 'pointer', position: 'relative' }}>
                  {totalNotifs > 0 && (
                    <div style={{ position: 'absolute', top: '-6px', right: '-6px', width: '22px', height: '22px', background: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', border: '2px solid #16161f' }}>{totalNotifs}</div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div><div style={{ fontWeight: '600', fontSize: '15px' }}>{p.name}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{p.client}</div></div>
                    {isProducer && (
                      <button onClick={(e) => handleToggleProjectStatus(p.id, e)} title={p.status === 'active' ? 'Mark Complete' : 'Reopen'} style={{ padding: '6px 10px', background: p.status === 'active' ? '#1e1e2e' : '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
                        {p.status === 'active' ? '✓ Complete' : '↩ Reopen'}
                      </button>
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
                    <div style={{ flex: 1, background: '#1e1e2e', borderRadius: '4px', height: '6px' }}><div style={{ width: `${cnt ? (approved/cnt)*100 : 0}%`, height: '100%', background: '#6366f1', borderRadius: '4px' }} /></div>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{cnt ? Math.round((approved/cnt)*100) : 0}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showCreate && (
          <Modal title="Create Project" onClose={() => setShowCreate(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Name *</label><Input value={newProj.name} onChange={v => setNewProj({ ...newProj, name: v })} placeholder="e.g., RasikaD Photoshoot" /></div>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Client *</label><Input value={newProj.client} onChange={v => setNewProj({ ...newProj, client: v })} placeholder="e.g., Client Name" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Type</label><Select value={newProj.type} onChange={v => setNewProj({ ...newProj, type: v })}><option value="photoshoot">📸 Photoshoot</option><option value="ad-film">🎬 Ad Film</option><option value="toolkit">🧰 Toolkit</option><option value="product-video">📦 Product Video</option><option value="social-media">📱 Social Media</option><option value="corporate">🏢 Corporate Video</option><option value="music-video">🎵 Music Video</option><option value="brand-film">🎯 Brand Film</option><option value="reels">🎞️ Reels/Shorts</option><option value="ecommerce">🛒 E-Commerce</option><option value="event">🎪 Event Coverage</option><option value="documentary">📽️ Documentary</option></Select></div>
                <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Deadline</label><Input type="date" value={newProj.deadline} onChange={v => setNewProj({ ...newProj, deadline: v })} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Categories</label><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{DEFAULT_CATEGORIES.map(cat => <div key={cat.id} onClick={() => setNewProj(p => ({ ...p, selectedCats: p.selectedCats.includes(cat.id) ? p.selectedCats.filter(x => x !== cat.id) : [...p.selectedCats, cat.id] }))} style={{ padding: '8px 12px', background: newProj.selectedCats.includes(cat.id) ? `${cat.color}30` : '#0d0d14', border: `1px solid ${newProj.selectedCats.includes(cat.id) ? cat.color : '#1e1e2e'}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>{cat.icon} {cat.name}</div>)}</div></div>
              <Btn onClick={handleCreate} disabled={!newProj.name || !newProj.client || creating}>{creating ? '⏳...' : '🚀 Create'}</Btn>
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
        <div key={u.id} style={{ background: '#0d0d14', borderRadius: '12px', marginBottom: '12px', overflow: 'hidden', border: '1px solid #1e1e2e' }}>
          {/* User Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderBottom: userProjects.length > 0 ? '1px solid #1e1e2e' : 'none' }}>
            <Avatar user={u} size={48} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{u.name}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>{u.email}</div>
              <RoleBadge role={u.role} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: overdueAssets.length > 0 ? '#ef4444' : activeAssets.length > 0 ? '#6366f1' : 'rgba(255,255,255,0.3)' }}>
                {activeAssets.length}
              </div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
                {overdueAssets.length > 0 ? `${overdueAssets.length} overdue` : 'active tasks'}
              </div>
            </div>
          </div>
          
          {/* Projects */}
          {userProjects.length > 0 && (
            <div style={{ padding: '12px 16px', background: '#0a0a0f' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>ASSIGNED PROJECTS</div>
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
                        background: '#16161f', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        border: '1px solid #2a2a3e',
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
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
              {coreTeam.length + freelancers.length} team members • {clients.length} clients
            </p>
          </div>
          {isProducer && <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>{[{ id: 'core', label: '👑 Core', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{t.label} ({t.data.length})</button>)}</div>
        <div>
          {tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No core team members</div>)}
          {tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No freelancers</div>)}
          {tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No clients</div>)}
        </div>
        {showAdd && (
          <Modal title="Add Team Member" onClose={() => { setShowAdd(false); setError(''); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: '8px' }}>{['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '12px', background: newUser.type === type ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}</button>)}</div>
              <Input value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} placeholder="Name *" />
              <Input value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} placeholder="Email *" type="email" />
              <Input value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="Password *" type="password" />
              {newUser.type !== 'client' && <Select value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</Select>}
              {newUser.type === 'client' && <Input value={newUser.company} onChange={v => setNewUser({ ...newUser, company: v })} placeholder="Company" />}
              {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
              <Btn onClick={handleCreate} disabled={creating}>{creating ? '⏳...' : '✓ Add'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Project Tasks Tab Component - syncs with My Tasks
  const ProjectTasksTab = ({ project, onUpdate }) => {
    const [showAddTask, setShowAddTask] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', dueDate: '', dueTime: '', priority: 'medium', assignedTo: '' });
    
    // Get project tasks from localStorage (synced with My Tasks)
    const getProjectTasks = () => {
      if (typeof window === 'undefined') return [];
      const saved = localStorage.getItem(`anandi-tasks-${userProfile?.id}`);
      const allTasks = saved ? JSON.parse(saved) : [];
      return allTasks.filter(t => t.projectId === project.id);
    };
    
    const [projectTasks, setProjectTasks] = useState(getProjectTasks());
    
    // Refresh tasks when project changes
    useEffect(() => {
      setProjectTasks(getProjectTasks());
    }, [project.id]);
    
    const priorityColors = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };
    const allTeam = [...coreTeam, ...freelancers];
    
    // Add task to project
    const addTask = () => {
      if (!newTask.title.trim()) return;
      const task = {
        id: generateId(),
        type: 'manual',
        title: newTask.title,
        dueDate: newTask.dueDate || null,
        dueTime: newTask.dueTime || null,
        priority: newTask.priority,
        projectId: project.id,
        projectName: project.name,
        assignedTo: newTask.assignedTo || null,
        assignedToName: newTask.assignedTo ? allTeam.find(u => u.id === newTask.assignedTo)?.name : null,
        completed: false,
        createdAt: new Date().toISOString(),
        createdBy: userProfile?.id
      };
      
      // Save to localStorage (global task store)
      const saved = localStorage.getItem(`anandi-tasks-${userProfile?.id}`);
      const allTasks = saved ? JSON.parse(saved) : [];
      const updated = [task, ...allTasks];
      localStorage.setItem(`anandi-tasks-${userProfile.id}`, JSON.stringify(updated));
      
      setProjectTasks([task, ...projectTasks]);
      setNewTask({ title: '', dueDate: '', dueTime: '', priority: 'medium', assignedTo: '' });
      setShowAddTask(false);
      showToast('Task added', 'success');
    };
    
    // Toggle task completion
    const toggleTask = (taskId) => {
      const saved = localStorage.getItem(`anandi-tasks-${userProfile?.id}`);
      const allTasks = saved ? JSON.parse(saved) : [];
      const updated = allTasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t
      );
      localStorage.setItem(`anandi-tasks-${userProfile.id}`, JSON.stringify(updated));
      setProjectTasks(updated.filter(t => t.projectId === project.id));
    };
    
    // Delete task
    const deleteTask = (taskId) => {
      const saved = localStorage.getItem(`anandi-tasks-${userProfile?.id}`);
      const allTasks = saved ? JSON.parse(saved) : [];
      const updated = allTasks.filter(t => t.id !== taskId);
      localStorage.setItem(`anandi-tasks-${userProfile.id}`, JSON.stringify(updated));
      setProjectTasks(updated.filter(t => t.projectId === project.id));
      showToast('Task deleted', 'success');
    };
    
    const activeTasks = projectTasks.filter(t => !t.completed);
    const completedTasks = projectTasks.filter(t => t.completed);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < today);
    
    return (
      <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '14px' }}>✓ Project Tasks ({activeTasks.length})</h3>
            {overdueTasks.length > 0 && (
              <span style={{ fontSize: '11px', color: '#ef4444' }}>{overdueTasks.length} overdue</span>
            )}
          </div>
          <Btn onClick={() => setShowAddTask(true)} small>+ Add Task</Btn>
        </div>
        
        <div style={{ padding: '14px' }}>
          {activeTasks.length === 0 && completedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontSize: '13px' }}>No tasks yet</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Add tasks to track project work</div>
            </div>
          ) : (
            <>
              {/* Active Tasks */}
              {activeTasks.map(task => (
                <div 
                  key={task.id}
                  style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    padding: '12px 14px', 
                    background: '#0d0d14', 
                    borderRadius: '10px', 
                    marginBottom: '8px',
                    borderLeft: `3px solid ${priorityColors[task.priority]}`
                  }}
                >
                  <div 
                    onClick={() => toggleTask(task.id)}
                    style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '4px', 
                      border: '2px solid #3a3a4a', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px' }}>{task.title}</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {task.assignedToName && (
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>👤 {task.assignedToName}</span>
                      )}
                      {task.dueDate && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: new Date(task.dueDate) < today ? '#ef4444' : 'rgba(255,255,255,0.5)'
                        }}>
                          📅 {new Date(task.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                          {task.dueTime && ` ${task.dueTime}`}
                        </span>
                      )}
                      <span style={{ 
                        fontSize: '9px', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        background: `${priorityColors[task.priority]}20`, 
                        color: priorityColors[task.priority],
                        textTransform: 'uppercase'
                      }}>
                        {task.priority}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '16px' }}
                  >
                    ×
                  </button>
                </div>
              ))}
              
              {/* Completed Tasks */}
              {completedTasks.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                    ✓ Completed ({completedTasks.length})
                  </div>
                  {completedTasks.slice(0, 5).map(task => (
                    <div 
                      key={task.id}
                      style={{ 
                        display: 'flex', 
                        gap: '12px', 
                        padding: '10px 14px', 
                        background: '#0d0d14', 
                        borderRadius: '8px', 
                        marginBottom: '6px',
                        opacity: 0.5
                      }}
                    >
                      <div 
                        onClick={() => toggleTask(task.id)}
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '4px', 
                          background: '#22c55e',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0
                        }}
                      >
                        <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>
                      </div>
                      <span style={{ fontSize: '12px', textDecoration: 'line-through' }}>{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Add Task Modal */}
        {showAddTask && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <div style={{ background: '#16161f', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', border: '1px solid #2a2a3e' }}>
              <h2 style={{ margin: '0 0 20px', fontSize: '18px' }}>Add Task to {project.name}</h2>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Task Title *</label>
                <Input 
                  value={newTask.title} 
                  onChange={(v) => setNewTask({ ...newTask, title: v })} 
                  placeholder="What needs to be done?"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Due Date</label>
                  <Input 
                    type="date" 
                    value={newTask.dueDate} 
                    onChange={(v) => setNewTask({ ...newTask, dueDate: v })} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Due Time</label>
                  <Input 
                    type="time" 
                    value={newTask.dueTime} 
                    onChange={(v) => setNewTask({ ...newTask, dueTime: v })} 
                  />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Priority</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['low', 'medium', 'high'].map(p => (
                    <button 
                      key={p}
                      onClick={() => setNewTask({ ...newTask, priority: p })}
                      style={{ 
                        flex: 1,
                        padding: '8px', 
                        borderRadius: '8px', 
                        border: newTask.priority === p ? `2px solid ${priorityColors[p]}` : '1px solid #2a2a3e',
                        background: newTask.priority === p ? `${priorityColors[p]}20` : 'transparent',
                        color: priorityColors[p],
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>Assign To (optional)</label>
                <Select value={newTask.assignedTo} onChange={(v) => setNewTask({ ...newTask, assignedTo: v })}>
                  <option value="">Unassigned</option>
                  {allTeam.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({TEAM_ROLES[u.role]?.label || u.role})</option>
                  ))}
                </Select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Btn onClick={() => setShowAddTask(false)} outline style={{ flex: 1 }}>Cancel</Btn>
                <Btn onClick={addTask} disabled={!newTask.title.trim()} style={{ flex: 1 }}>Add Task</Btn>
              </div>
            </div>
          </div>
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
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [assetTab, setAssetTab] = useState('preview');
    const [selectedAssets, setSelectedAssets] = useState(new Set());
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
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

    // Keyboard shortcuts for navigation (must be before conditional return)
    useEffect(() => {
      if (!selectedAsset || !selectedProject) return;
      const allAssets = (selectedProject.assets || []).filter(x => !x.deleted);
      const filteredAssets = selectedCat ? allAssets.filter(x => x.category === selectedCat) : allAssets;
      const typeOrder = { image: 0, video: 1, audio: 2, other: 3 };
      const sortedAssets = filteredAssets.sort((x, y) => (typeOrder[x.type] || 3) - (typeOrder[y.type] || 3));
      const currentIndex = sortedAssets.findIndex(a => a.id === selectedAsset.id);
      const handleKeyNav = (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          setSelectedAsset(sortedAssets[currentIndex - 1]);
        } else if (e.key === 'ArrowRight' && currentIndex < sortedAssets.length - 1) {
          setSelectedAsset(sortedAssets[currentIndex + 1]);
        }
      };
      window.addEventListener('keydown', handleKeyNav);
      return () => window.removeEventListener('keydown', handleKeyNav);
    }, [selectedAsset, selectedProject, selectedCat]);

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
            
            const updatedAssets = [...(selectedProject.assets || []), newAsset];
            const catName = cats.find(c => c.id === cat)?.name || cat;
            const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name} to ${catName}`, timestamp: new Date().toISOString() };
            await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(selectedProject.activityLog || []), activity] });
            await refreshProject();
            setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
            showToast(useMux ? `Video uploaded! HLS ready in ~30s` : `Video uploaded!`, 'success');
            
          } else {
            // For images and audio, use Firebase Storage
            const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
            const sRef = ref(storage, path);
            const task = uploadBytesResumable(sRef, file);
            
            task.on('state_changed', 
              snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })), 
              () => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); },
              async () => {
                const url = await getDownloadURL(task.snapshot.ref);
                
                // Generate thumbnail for images
                let thumbnailUrl = null;
                try {
                  if (fileType === 'image') {
                    const thumbBlob = await generateThumbnail(file);
                    if (thumbBlob) {
                      const thumbPath = `projects/${selectedProject.id}/${cat}/thumbs/${Date.now()}-thumb.jpg`;
                      const thumbRef = ref(storage, thumbPath);
                      await uploadBytesResumable(thumbRef, thumbBlob);
                      thumbnailUrl = await getDownloadURL(thumbRef);
                    }
                  }
                } catch (e) { console.log('Thumb generation failed:', e); }
                
                const newAsset = { 
                  id: assetId, 
                  name: file.name, 
                  type: fileType, 
                  category: cat, 
                  url, 
                  path, 
                  thumbnail: thumbnailUrl || (fileType === 'image' ? url : null), 
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
                
                const updatedAssets = [...(selectedProject.assets || []), newAsset];
                const catName = cats.find(c => c.id === cat)?.name || cat;
                const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name} to ${catName}`, timestamp: new Date().toISOString() };
                await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(selectedProject.activityLog || []), activity] });
                await refreshProject();
                setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
              }
            );
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
        const newVersion = { version: selectedAsset.currentVersion + 1, url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name };
        const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, url, thumbnail: a.type === 'image' ? url : a.thumbnail, versions: [...(a.versions || []), newVersion], currentVersion: selectedAsset.currentVersion + 1, status: 'review-ready' } : a);
        const activity = { id: generateId(), type: 'version', message: `${userProfile.name} uploaded v${selectedAsset.currentVersion + 1} of ${selectedAsset.name}`, timestamp: new Date().toISOString() };
        await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
        await refreshProject();
        setSelectedAsset({ ...selectedAsset, url, versions: [...(selectedAsset.versions || []), newVersion], currentVersion: selectedAsset.currentVersion + 1, status: 'review-ready' });
        setVersionFile(null);
        showToast('New version uploaded!', 'success');
      } catch (e) { showToast('Failed to upload version', 'error'); }
      setUploadingVersion(false);
    };

    const handleRate = async (assetId, rating) => { const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, rating } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); };
    const handleToggleSelect = async (assetId) => { const asset = (selectedProject.assets || []).find(a => a.id === assetId); const newSelected = !asset?.isSelected; const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); };
    const handleBulkSelect = async (select) => { const updated = (selectedProject.assets || []).map(a => selectedAssets.has(a.id) ? { ...a, isSelected: select, status: select ? 'selected' : 'pending' } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); setSelectedAssets(new Set()); showToast(`${selectedAssets.size} assets ${select ? 'selected' : 'deselected'}`, 'success'); };
    const handleConfirmSelection = async () => { const activity = { id: generateId(), type: 'selection', message: `Selection confirmed by ${userProfile.name}`, timestamp: new Date().toISOString() }; await updateProject(selectedProject.id, { selectionConfirmed: true, activityLog: [...(selectedProject.activityLog || []), activity] }); await refreshProject(); showToast('Selection confirmed! 🎉', 'success'); };
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
      
      // Extract mentions from feedback text
      const mentionRegex = /@([A-Za-z\s]+?)(?=\s|$|@)/g;
      const mentions = [];
      let match;
      while ((match = mentionRegex.exec(newFeedback)) !== null) {
        const mentionedName = match[1].trim();
        const mentionedUser = team.find(m => m.name?.toLowerCase() === mentionedName.toLowerCase());
        if (mentionedUser) mentions.push(mentionedUser);
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

    return (
      <div style={{ display: 'flex', marginLeft: isMobile ? '0' : '-200px', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Category Sidebar */}
        <div style={{ width: isMobile ? '100%' : '180px', background: '#12121a', borderRight: isMobile ? 'none' : '1px solid #1e1e2e', borderBottom: isMobile ? '1px solid #1e1e2e' : 'none', height: isMobile ? 'auto' : 'calc(100vh - 46px)', position: isMobile ? 'relative' : 'fixed', left: isMobile ? 0 : '200px', top: isMobile ? 0 : '46px', overflowX: isMobile ? 'auto' : 'visible', overflowY: isMobile ? 'hidden' : 'auto', zIndex: 40 }}>
          <div style={{ padding: '12px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '6px' }}>
            <div onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : '#1e1e2e', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}><span>📁 All</span><span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{(selectedProject.assets || []).length}</span></div>
            {cats.map(cat => <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : '#1e1e2e', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}><span>{cat.icon} {cat.name}</span><span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '8px' }}>{getCatCount(cat.id)}</span></div>)}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: isMobile ? '0' : '380px' }}>
          {/* Header */}
          <div style={{ height: '50px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
              <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}>← Back</button>
              <span style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedProject.name}</span>
              {!isMobile && <Badge status={selectedProject.status} />}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {isProducer && !isMobile && <Btn onClick={() => setShowShare(true)} small outline>🔗 Share</Btn>}
              <div style={{ position: 'relative' }}>
                <Btn onClick={() => setShowAppearance(!showAppearance)} small outline>⚙️</Btn>
                {showAppearance && <AppearancePanel settings={appearance} onChange={setAppearance} onClose={() => setShowAppearance(false)} />}
              </div>
              {isProducer && <Btn onClick={() => setShowUpload(true)} small color="#22c55e">⬆️{!isMobile && ' Upload'}</Btn>}
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
              <div style={{ padding: '10px 16px', background: '#0d0d14', borderBottom: '1px solid #1e1e2e', display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>⏳ Pending</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#fbbf24' }}>{pending}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>⚡ In Progress</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>{inProgress}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>👁️ Review</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: '#a855f7' }}>{review}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>✓ Done</span>
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
                  <div style={{ width: '120px', height: '6px', background: '#1e1e2e', borderRadius: '3px' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#22c55e' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: progress === 100 ? '#22c55e' : '#6366f1' }}>{progress}%</span>
                </div>
              </div>
            );
          })()}

          {/* Tabs */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['assets', 'tasks', 'team', 'activity', 'links'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{t === 'tasks' ? '✓ Tasks' : (isMobile ? t.charAt(0).toUpperCase() : t)}</button>)}
              {/* Photoshoot Workflow Phase Indicator */}
              {selectedProject.type === 'photoshoot' && (
                <div style={{ marginLeft: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: '#0d0d14', padding: '6px 12px', borderRadius: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Phase:</span>
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
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{selectedAssets.size}</span>
                <Btn onClick={() => handleBulkSelect(true)} small color="#22c55e">✓</Btn>
                <Btn onClick={() => handleBulkSelect(false)} small outline>✗</Btn>
              </div>
            )}
            {tab === 'assets' && !selectedProject.selectionConfirmed && selectedCount > 0 && isProducer && !isMobile && <Btn onClick={handleConfirmSelection} small color="#f59e0b">🎯 Confirm ({selectedCount})</Btn>}
            
            {/* View Mode Toggle */}
            {tab === 'assets' && assets.length > 0 && (
              <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
                <button onClick={() => setViewMode('grid')} style={{ padding: '6px 12px', background: viewMode === 'grid' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>📊 Grid</button>
                <button onClick={() => setViewMode('kanban')} style={{ padding: '6px 12px', background: viewMode === 'kanban' ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>📋 Kanban</button>
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={{ padding: '12px 16px', background: '#1e1e2e' }}>
              {Object.entries(uploadProgress).map(([id, item]) => (
                <div key={id} style={{ marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.name}
                      {item.status && typeof item.status === 'string' && item.status !== 'uploading' && (
                        <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: '4px' }}>{item.status}</span>
                      )}
                    </span>
                    <span>{item.progress}%</span>
                  </div>
                  <div style={{ background: '#0d0d14', borderRadius: '3px', height: '4px' }}>
                    <div style={{ width: `${item.progress}%`, height: '100%', background: item.status?.includes('Mux') || item.status?.includes('Processing') ? '#22c55e' : '#6366f1', borderRadius: '3px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content */}
          <div style={{ padding: '16px' }}>
            {tab === 'assets' && (
              <div>
                {assets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e' }}>
                    <div style={{ fontSize: '50px', marginBottom: '14px' }}>📂</div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '16px' }}>No assets</p>
                    {isProducer && <Btn onClick={() => setShowUpload(true)}>⬆️ Upload</Btn>}
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
                        <button onClick={() => setSelectedCat(null)} style={{ padding: '6px 14px', background: !selectedCat ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>All ({assets.length})</button>
                        <button onClick={() => setSelectedCat('__selected__')} style={{ padding: '6px 14px', background: selectedCat === '__selected__' ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>⭐ Selected ({assets.filter(a => a.isSelected).length})</button>
                        <button onClick={() => setSelectedCat('__not_selected__')} style={{ padding: '6px 14px', background: selectedCat === '__not_selected__' ? '#f97316' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Not Selected ({assets.filter(a => !a.isSelected).length})</button>
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
                        <div key={a.id} style={{ 
                          background: '#16161f', 
                          borderRadius: '10px', 
                          overflow: 'hidden', 
                          border: a.isSelected ? '2px solid #22c55e' : selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e', 
                          position: 'relative',
                          opacity: isDimmed ? 0.5 : 1,
                          transition: 'opacity 0.2s'
                        }}>
                          <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ position: 'absolute', top: '10px', left: '10px', width: '22px', height: '22px', borderRadius: '6px', background: selectedAssets.has(a.id) ? '#6366f1' : 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>{selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}</div>
                          {a.isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600' }}>⭐</div>}
                          {hasNewVersion && <div style={{ position: 'absolute', top: a.isSelected ? '38px' : '10px', right: '10px', background: '#f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>🆕 v{a.currentVersion}</div>}
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
                          
                          <div onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }} style={{ cursor: 'pointer', height: isMobile ? (appearance.cardSize === 'L' ? '200px' : appearance.cardSize === 'S' ? '80px' : '120px') : `${cardWidth / aspectRatio}px`, background: '#0d0d14', position: 'relative' }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} thumbnail={a.thumbnail} duration={a.duration} style={{ width: '100%', height: '100%' }} /> : a.type === 'audio' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🔊</span></div> : (a.thumbnail || a.url) ? <LazyImage src={a.url} thumbnail={a.thumbnail} style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>📄</span></div>}
                            {a.feedback?.length > 0 && <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: '#ef4444', borderRadius: '10px', padding: '3px 8px', fontSize: '10px' }}>{a.feedback.length}💬</div>}
                            {a.dueDate && <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: new Date(a.dueDate) < new Date() ? '#ef4444' : '#22c55e', borderRadius: '10px', padding: '3px 6px', fontSize: '9px' }}>{new Date(a.dueDate) < new Date() ? '⚠️' : '📅'}{Math.abs(Math.ceil((new Date(a.dueDate) - new Date()) / (1000 * 60 * 60 * 24)))}d</div>}
                          </div>
                          {appearance.showInfo && (
                            <div style={{ padding: '10px' }}>
                              <div style={{ fontWeight: '500', fontSize: '11px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>v{a.currentVersion}</span>{a.assignedToName && <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>→{a.assignedToName.split(' ')[0]}</span>}</div>
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

            {tab === 'team' && (
              <div>
                {/* Smart Alerts for Producer */}
                {isProducer && (() => {
                  const projectAssets = (selectedProject.assets || []).filter(a => !a.deleted);
                  const unassigned = projectAssets.filter(a => !a.assignedTo && a.status !== 'delivered' && a.status !== 'approved');
                  const today = new Date(); today.setHours(0,0,0,0);
                  const overdue = projectAssets.filter(a => a.dueDate && new Date(a.dueDate) < today && a.status !== 'delivered' && a.status !== 'approved');
                  const pendingReview = projectAssets.filter(a => a.status === 'review-ready');
                  const noEditor = cats.some(c => c.id === 'videos') && !team.some(m => ['video-editor', 'motion-designer'].includes(m.role));
                  const noCGI = cats.some(c => c.id === 'cgi') && !team.some(m => ['cgi-artist', '3d-artist'].includes(m.role));
                  const hasAlerts = unassigned.length > 0 || overdue.length > 0 || pendingReview.length > 0 || noEditor || noCGI;
                  
                  if (!hasAlerts) return null;
                  
                  return (
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: '#ef4444' }}>⚠️ Alerts</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {unassigned.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                            <span>📋</span>
                            <span style={{ fontSize: '12px', flex: 1 }}><strong>{unassigned.length}</strong> assets need assignment</span>
                            <button onClick={() => setTab('assets')} style={{ padding: '4px 10px', background: '#ef4444', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Assign</button>
                          </div>
                        )}
                        {overdue.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>
                            <span>🚨</span>
                            <span style={{ fontSize: '12px', flex: 1 }}><strong>{overdue.length}</strong> assets overdue</span>
                          </div>
                        )}
                        {pendingReview.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(168,85,247,0.1)', borderRadius: '8px' }}>
                            <span>👁️</span>
                            <span style={{ fontSize: '12px', flex: 1 }}><strong>{pendingReview.length}</strong> assets pending your review</span>
                            <button onClick={() => setTab('assets')} style={{ padding: '4px 10px', background: '#a855f7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Review</button>
                          </div>
                        )}
                        {noEditor && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(249,115,22,0.1)', borderRadius: '8px' }}>
                            <span>🎬</span>
                            <span style={{ fontSize: '12px', flex: 1 }}>No Video Editor assigned to this project</span>
                            <button onClick={() => setShowAddTeam(true)} style={{ padding: '4px 10px', background: '#f97316', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Add</button>
                          </div>
                        )}
                        {noCGI && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px' }}>
                            <span>🌐</span>
                            <span style={{ fontSize: '12px', flex: 1 }}>No CGI Artist assigned to this project</span>
                            <button onClick={() => setShowAddTeam(true)} style={{ padding: '4px 10px', background: '#3b82f6', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Add</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                
                {/* Team Members */}
                <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>👥 Team ({team.length})</h3>
                    {isProducer && <Btn onClick={() => setShowAddTeam(true)} small>+ Add Member</Btn>}
                  </div>
                  <div style={{ padding: '14px' }}>
                    {team.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '10px' }}>👥</div>
                        <div style={{ fontSize: '13px', marginBottom: '8px' }}>No team members yet</div>
                        {isProducer && <Btn onClick={() => setShowAddTeam(true)} small>+ Add Team Member</Btn>}
                      </div>
                    ) : (
                      team.map(m => {
                        const memberAssets = (selectedProject.assets || []).filter(a => !a.deleted && (a.assignedTo === m.id || a.assignedTo === m.email));
                        const activeAssets = memberAssets.filter(a => a.status !== 'delivered' && a.status !== 'approved');
                        const overdueAssets = activeAssets.filter(a => {
                          if (!a.dueDate) return false;
                          const today = new Date(); today.setHours(0,0,0,0);
                          return new Date(a.dueDate) < today;
                        });
                        
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', background: '#0d0d14', borderRadius: '10px', marginBottom: '10px' }}>
                            <Avatar user={m} size={42} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {m.name} 
                                {m.isOwner && <span style={{ fontSize: '10px', color: '#f97316' }}>👑</span>}
                              </div>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{m.email}</div>
                              <div style={{ marginTop: '6px' }}><RoleBadge role={m.role} /></div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              {activeAssets.length > 0 && (
                                <>
                                  <div style={{ fontSize: '18px', fontWeight: '700', color: overdueAssets.length > 0 ? '#ef4444' : '#6366f1' }}>
                                    {activeAssets.length}
                                  </div>
                                  <div style={{ fontSize: '9px', color: overdueAssets.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                                    {overdueAssets.length > 0 ? `${overdueAssets.length} overdue` : 'active'}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                
                {/* Suggested Roles Based on Categories */}
                {isProducer && availableTeam.length > 0 && (() => {
                  const suggestedRoles = [];
                  if (cats.some(c => c.id === 'videos') && !team.some(m => ['video-editor', 'motion-designer'].includes(m.role))) {
                    suggestedRoles.push({ role: 'video-editor', reason: 'Videos category needs editor' });
                  }
                  if (cats.some(c => c.id === 'cgi') && !team.some(m => ['cgi-artist', '3d-artist'].includes(m.role))) {
                    suggestedRoles.push({ role: 'cgi-artist', reason: 'CGI category needs artist' });
                  }
                  if (cats.some(c => c.id === 'animation') && !team.some(m => ['motion-designer', 'animator'].includes(m.role))) {
                    suggestedRoles.push({ role: 'motion-designer', reason: 'Animation category needs designer' });
                  }
                  if (cats.some(c => c.id === 'vfx') && !team.some(m => ['vfx-artist'].includes(m.role))) {
                    suggestedRoles.push({ role: 'vfx-artist', reason: 'VFX category needs artist' });
                  }
                  if (cats.some(c => c.id === 'audio') && !team.some(m => ['sound-engineer', 'audio-editor'].includes(m.role))) {
                    suggestedRoles.push({ role: 'sound-engineer', reason: 'Audio category needs engineer' });
                  }
                  
                  const suggestedMembers = suggestedRoles.map(sr => {
                    const member = availableTeam.find(t => t.role === sr.role);
                    return member ? { ...member, reason: sr.reason } : null;
                  }).filter(Boolean);
                  
                  if (suggestedMembers.length === 0) return null;
                  
                  return (
                    <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', marginTop: '16px' }}>
                      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e' }}>
                        <h3 style={{ margin: 0, fontSize: '14px' }}>💡 Suggested Team Members</h3>
                      </div>
                      <div style={{ padding: '14px' }}>
                        {suggestedMembers.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
                            <Avatar user={m} size={36} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: '500', fontSize: '12px' }}>{m.name}</div>
                              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{m.reason}</div>
                            </div>
                            <Btn onClick={async () => {
                              const updatedTeam = [...(selectedProject.assignedTeam || []), { odId: m.id, isOwner: false }];
                              await updateProject(selectedProject.id, { assignedTeam: updatedTeam });
                              await refreshProject();
                              showToast(`${m.name} added to team`, 'success');
                            }} small>+ Add</Btn>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {tab === 'activity' && (
              <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}>📋 Activity Timeline</h3>
                <ActivityTimeline activities={selectedProject.activityLog || []} maxItems={20} />
              </div>
            )}

            {tab === 'links' && (
              <div>
                {isProducer && (
                  <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>🔗 Create Share Link</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: '10px', alignItems: 'end' }}>
                      <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Name</label><Input value={newLinkName} onChange={setNewLinkName} placeholder="e.g., Client Review" /></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Type</label><Select value={newLinkType} onChange={setNewLinkType}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select></div>
                      <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Expiry (optional)</label><Input type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                      <Btn onClick={handleCreateLink}>Create</Btn>
                    </div>
                  </div>
                )}
                <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Active Links ({shareLinks.length})</h3>
                  {shareLinks.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No share links</div> : shareLinks.map(link => {
                    const isExpired = link.expiresAt && new Date(link.expiresAt) < new Date();
                    return (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: isExpired ? 'rgba(239,68,68,0.1)' : '#0d0d14', borderRadius: '10px', marginBottom: '8px', border: isExpired ? '1px solid rgba(239,68,68,0.3)' : 'none' }}>
                        <span style={{ fontSize: '24px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>{link.name}{isExpired && <span style={{ fontSize: '9px', padding: '2px 6px', background: '#ef4444', borderRadius: '4px' }}>EXPIRED</span>}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{link.type} • {formatTimeAgo(link.createdAt)}{link.expiresAt && !isExpired && <span> • Expires {formatDate(link.expiresAt)}</span>}</div></div>
                        <div style={{ display: 'flex', gap: '6px' }}><Btn onClick={() => copyLink(link.token)} small outline>📋</Btn>{isProducer && <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>🗑️</button>}</div>
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
          <Modal title="Upload Assets" onClose={() => { setShowUpload(false); setUploadFiles([]); }}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div style={{ textAlign: 'center', padding: '40px', border: '2px dashed #2a2a3e', borderRadius: '12px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '44px', marginBottom: '12px' }}>📤</div>
                <p style={{ margin: 0, fontSize: '14px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Click to select files'}</p>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
              </div>
              {uploadFiles.length > 0 && <div style={{ maxHeight: '140px', overflow: 'auto', background: '#0d0d14', borderRadius: '8px', padding: '10px' }}>{uploadFiles.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}><span>{f.name}</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{formatFileSize(f.size)}</span></div>)}</div>}
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Category</label><Select value={selectedCat || cats[0]?.id || ''} onChange={setSelectedCat}>{cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select></div>
              <Btn onClick={handleUpload} disabled={!uploadFiles.length} color="#22c55e">⬆️ Upload {uploadFiles.length} Files</Btn>
            </div>
          </Modal>
        )}

        {/* Share Modal */}
        {showShare && (
          <Modal title="Share Project" onClose={() => setShowShare(false)}>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Input value={newLinkName} onChange={setNewLinkName} placeholder="Link name" />
                <Select value={newLinkType} onChange={setNewLinkType}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Expiry</label><Input type="date" value={newLinkExpiry} onChange={setNewLinkExpiry} /></div>
                <div style={{ display: 'flex', alignItems: 'end' }}><Btn onClick={handleCreateLink}>Create</Btn></div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Active ({shareLinks.length})</div>
                {shareLinks.map(link => (
                  <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '12px' }}>{link.name}</div></div>
                    <Btn onClick={() => copyLink(link.token)} small outline>Copy</Btn>
                    <button onClick={() => handleDeleteLink(link.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '6px', color: '#ef4444', fontSize: '10px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          </Modal>
        )}

        {/* Add Team Modal */}
        {showAddTeam && (
          <Modal title="Add Team Member" onClose={() => setShowAddTeam(false)}>
            <div style={{ padding: '20px', maxHeight: '400px', overflow: 'auto' }}>{availableTeam.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>All added</div> : availableTeam.map(u => <div key={u.id} onClick={() => handleAddTeam(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}><Avatar user={u} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{u.name}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div><RoleBadge role={u.role} /></div>)}</div>
          </Modal>
        )}

        {/* ASSET PREVIEW MODAL - FIXED IMAGE SIZING */}
        {selectedAsset && (
          <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)} wide>
            {/* Asset Tabs */}
            <div style={{ display: 'flex', gap: '6px', padding: '12px 20px', borderBottom: '1px solid #1e1e2e', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ id: 'preview', icon: '👁️', label: 'Preview' }, { id: 'compare', icon: '📊', label: 'Compare' }].map(t => (
                  <button key={t.id} onClick={() => setAssetTab(t.id)} style={{ padding: '8px 14px', background: assetTab === t.id ? '#6366f1' : 'transparent', border: assetTab === t.id ? 'none' : '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{t.icon} {!isMobile && t.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedAsset.annotations?.length > 0 && <span style={{ padding: '4px 10px', background: '#ec4899', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>✏️ {selectedAsset.annotations.length}</span>}
                {selectedAsset.currentVersion > 1 && isNewVersion(getLatestVersionDate(selectedAsset)) && <span style={{ padding: '4px 10px', background: '#f97316', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>🆕 v{selectedAsset.currentVersion}</span>}
              </div>
            </div>

            {/* Preview Tab */}
            {assetTab === 'preview' && (
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(85vh - 120px)', overflow: isMobile ? 'auto' : 'hidden' }}>
                {/* LEFT: Preview Area */}
                <div style={{ flex: isMobile ? 'none' : 1, display: 'flex', flexDirection: 'column', background: '#0a0a10', minWidth: 0, overflow: 'auto' }}>
                  {/* Content Area */}
                  <div style={{ flex: isMobile ? 'none' : 1, minHeight: isMobile ? '300px' : 'auto', padding: isMobile ? '12px' : '20px', overflow: 'auto' }}>
                    {selectedAsset.type === 'video' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                        {selectedAsset.muxPlaybackId ? (
                          /* Mux HLS Player for smooth streaming */
                          <MuxPlayer
                            ref={videoRef}
                            playbackId={selectedAsset.muxPlaybackId}
                            poster={selectedAsset.thumbnail}
                            onTimeUpdate={(time) => setVideoTime(time)}
                            onDurationChange={(dur) => setVideoDuration(dur)}
                            controls={true}
                            showTimecode={false}
                            style={{ maxWidth: '100%', maxHeight: isMobile ? '280px' : '55vh' }}
                          />
                        ) : selectedAsset.muxUploadId && !selectedAsset.url ? (
                          /* Video is processing on Mux - show status */
                          <div style={{ textAlign: 'center', padding: '40px' }}>
                            <div style={{ width: '50px', height: '50px', border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
                            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>Processing video for HLS streaming...</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Usually takes 30-60 seconds</div>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/mux/upload?uploadId=${selectedAsset.muxUploadId}`);
                                  const data = await res.json();
                                  if (data.asset?.playbackId) {
                                    // Update asset with playbackId
                                    const updatedAssets = selectedProject.assets.map(a => 
                                      a.id === selectedAsset.id ? { ...a, muxPlaybackId: data.asset.playbackId, thumbnail: data.asset.thumbnailUrl || a.thumbnail } : a
                                    );
                                    await updateProject(selectedProject.id, { assets: updatedAssets });
                                    await refreshProject();
                                    showToast('HLS ready!', 'success');
                                  } else {
                                    showToast('Still processing...', 'info');
                                  }
                                } catch (e) { showToast('Check failed', 'error'); }
                              }}
                              style={{ marginTop: '16px', padding: '8px 16px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                            >
                              Check Status
                            </button>
                            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                          </div>
                        ) : (
                          /* Fallback to regular video for Firebase-only assets */
                          <video 
                            ref={videoRef} 
                            src={selectedAsset.url} 
                            controls 
                            playsInline 
                            onTimeUpdate={(e) => setVideoTime(e.target.currentTime)}
                            onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                            style={{ maxWidth: '100%', maxHeight: isMobile ? '280px' : '55vh', objectFit: 'contain' }} 
                          />
                        )}
                        <div style={{ marginTop: '10px', padding: '6px 14px', background: '#1e1e2e', borderRadius: '8px', fontSize: '14px', fontFamily: 'monospace', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#22c55e' }}>
                            {Math.floor(videoTime / 3600).toString().padStart(2, '0')}:{Math.floor((videoTime % 3600) / 60).toString().padStart(2, '0')}:{Math.floor(videoTime % 60).toString().padStart(2, '0')}:{Math.floor((videoTime % 1) * 24).toString().padStart(2, '0')}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                          <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {Math.floor(videoDuration / 3600).toString().padStart(2, '0')}:{Math.floor((videoDuration % 3600) / 60).toString().padStart(2, '0')}:{Math.floor(videoDuration % 60).toString().padStart(2, '0')}:00
                          </span>
                          {selectedAsset.muxPlaybackId && (
                            <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.2)', padding: '2px 8px', borderRadius: '4px', marginLeft: '8px' }}>HLS</span>
                          )}
                        </div>
                      </div>
                    ) : selectedAsset.type === 'audio' ? (
                      <div style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔊</div>
                        <audio src={selectedAsset.url} controls style={{ width: '100%', maxWidth: '300px' }} />
                      </div>
                    ) : selectedAsset.type === 'image' ? (
                      <AnnotationCanvas imageUrl={selectedAsset.url} annotations={selectedAsset.annotations || []} onChange={handleSaveAnnotations} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px', fontSize: '60px' }}>📄</div>
                    )}
                  </div>
                  
                  {/* Feedback Section */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e2e', background: '#12121a', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>💬 Feedback ({selectedAsset.feedback?.length || 0})</span>
                      {(selectedAsset.feedback || []).filter(f => !f.isDone).length > 0 && (
                        <span style={{ fontSize: '10px', padding: '2px 8px', background: '#ef4444', borderRadius: '10px' }}>
                          {(selectedAsset.feedback || []).filter(f => !f.isDone).length} pending
                        </span>
                      )}
                    </div>
                    <div style={{ maxHeight: '120px', overflow: 'auto', marginBottom: '8px' }}>
                      {(selectedAsset.feedback || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>No feedback yet</div>
                      ) : (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{ padding: '10px', background: fb.isDone ? '#1a2e1a' : '#1e1e2e', borderRadius: '6px', marginBottom: '6px', borderLeft: fb.isDone ? '3px solid #22c55e' : '3px solid #ef4444', opacity: fb.isDone ? 0.7 : 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '10px', fontWeight: '600' }}>{fb.userName}</span>
                              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>{formatTimeAgo(fb.timestamp)}</span>
                              {fb.videoTimestamp !== null && fb.videoTimestamp !== undefined && (
                                <span 
                                  onClick={() => { if (videoRef.current) { videoRef.current.currentTime = fb.videoTimestamp; videoRef.current.play(); } }}
                                  style={{ fontSize: '9px', color: '#6366f1', marginLeft: '8px', cursor: 'pointer', background: 'rgba(99,102,241,0.2)', padding: '1px 6px', borderRadius: '4px' }}
                                >
                                  ▶ {Math.floor(fb.videoTimestamp / 60)}:{String(Math.floor(fb.videoTimestamp % 60)).padStart(2, '0')}
                                </span>
                              )}
                            </div>
                            {canMarkFeedbackDone && (
                              <button 
                                onClick={(e) => handleToggleFeedbackDone(fb.id, e)}
                                style={{ background: fb.isDone ? '#22c55e' : '#3a3a4a', border: 'none', borderRadius: '4px', padding: '4px 8px', fontSize: '9px', color: '#fff', cursor: 'pointer', marginLeft: '8px', flexShrink: 0 }}
                              >
                                {fb.isDone ? '✓ Done' : '○ Pending'}
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', textDecoration: fb.isDone ? 'line-through' : 'none', color: fb.isDone ? 'rgba(255,255,255,0.5)' : '#fff' }}>{fb.text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
                      {selectedAsset.type === 'video' && (
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>📍 at current time</span>
                      )}
                      <div style={{ flex: 1, position: 'relative' }}>
                        <input 
                          ref={feedbackInputRef}
                          value={newFeedback} 
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewFeedback(val);
                            // Check for @ mentions
                            const lastAt = val.lastIndexOf('@');
                            if (lastAt !== -1 && lastAt === val.length - 1) {
                              setShowMentions(true);
                              setMentionSearch('');
                            } else if (lastAt !== -1 && !val.substring(lastAt + 1).includes(' ')) {
                              setShowMentions(true);
                              setMentionSearch(val.substring(lastAt + 1).toLowerCase());
                            } else {
                              setShowMentions(false);
                            }
                          }}
                          placeholder="Add feedback... (@ to mention)"
                          style={{ width: '100%', padding: '8px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                        />
                        {/* Mentions Dropdown */}
                        {showMentions && (
                          <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '8px', marginBottom: '4px', maxHeight: '150px', overflow: 'auto', zIndex: 100 }}>
                            {team.filter(m => m.name?.toLowerCase().includes(mentionSearch)).slice(0, 5).map(member => (
                              <div key={member.id} onClick={() => {
                                const lastAt = newFeedback.lastIndexOf('@');
                                const newVal = newFeedback.substring(0, lastAt) + `@${member.name} `;
                                setNewFeedback(newVal);
                                setShowMentions(false);
                                feedbackInputRef.current?.focus();
                              }} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}
                              onMouseEnter={(e) => e.target.style.background = '#2a2a3e'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>{member.name?.[0]}</div>
                                {member.name}
                              </div>
                            ))}
                            {team.filter(m => m.name?.toLowerCase().includes(mentionSearch)).length === 0 && (
                              <div style={{ padding: '8px 12px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No team members found</div>
                            )}
                          </div>
                        )}
                      </div>
                      <Btn onClick={handleAddFeedback} disabled={!newFeedback.trim()} small>Send</Btn>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Details Sidebar - Fixed width */}
                <div style={{ width: isMobile ? '100%' : '280px', background: '#16161f', borderLeft: isMobile ? 'none' : '1px solid #1e1e2e', overflow: 'auto', padding: '16px', flexShrink: 0 }}>
                  {/* Rating */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Rating</label>
                    <StarRating rating={selectedAsset.rating} onChange={r => { handleRate(selectedAsset.id, r); setSelectedAsset({ ...selectedAsset, rating: r }); }} size={24} />
                  </div>

                  {/* Tags */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>🏷️ Tags</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {PREDEFINED_TAGS.map(tag => {
                        const isActive = (selectedAsset.tags || []).includes(tag.id);
                        return (
                          <button key={tag.id} onClick={async () => {
                            const newTags = isActive 
                              ? (selectedAsset.tags || []).filter(t => t !== tag.id)
                              : [...(selectedAsset.tags || []), tag.id];
                            const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, tags: newTags } : a);
                            setSelectedAsset({ ...selectedAsset, tags: newTags });
                            await updateProject(selectedProject.id, { assets: updated });
                          }} style={{ padding: '4px 10px', background: isActive ? `${tag.color}30` : '#0d0d14', border: `1px solid ${isActive ? tag.color : '#2a2a3e'}`, borderRadius: '12px', color: isActive ? tag.color : 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer', fontWeight: '500' }}>
                            {tag.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selection Toggle */}
                  <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected, status: !selectedAsset.isSelected ? 'selected' : 'pending' }); }} style={{ width: '100%', padding: '12px', background: selectedAsset.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer', fontWeight: '600', marginBottom: '14px' }}>
                    {selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}
                  </button>

                  {/* Status */}
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Status</label>
                    <Select value={selectedAsset.status} onChange={v => handleUpdateStatus(selectedAsset.id, v)} style={{ padding: '8px 10px', fontSize: '12px' }}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </Select>
                  </div>

                  {/* Assign */}
                  {isProducer && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Assign To</label>
                      <Select value={selectedAsset.assignedTo || ''} onChange={v => handleAssign(selectedAsset.id, v)} style={{ padding: '8px 10px', fontSize: '12px' }}>
                        <option value="">-- Unassigned --</option>
                        {editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </Select>
                    </div>
                  )}

                  {/* Due Date */}
                  {isProducer && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>📅 Due Date</label>
                      <input 
                        type="date" 
                        value={selectedAsset.dueDate?.split('T')[0] || ''} 
                        onChange={async (e) => {
                          const dueDate = e.target.value ? new Date(e.target.value).toISOString() : null;
                          const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, dueDate } : a);
                          setSelectedAsset({ ...selectedAsset, dueDate });
                          await updateProject(selectedProject.id, { assets: updated });
                          // Notify assigned person
                          if (selectedAsset.assignedTo && dueDate) {
                            const assignee = editors.find(e => e.id === selectedAsset.assignedTo);
                            if (assignee?.email) sendEmailNotification(assignee.email, `Due date set: ${selectedAsset.name}`, `Due: ${formatDate(dueDate)}`);
                          }
                        }}
                        style={{ width: '100%', padding: '8px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                      />
                      {selectedAsset.dueDate && (
                        <div style={{ marginTop: '6px', fontSize: '10px', color: new Date(selectedAsset.dueDate) < new Date() ? '#ef4444' : '#22c55e', fontWeight: '600' }}>
                          {new Date(selectedAsset.dueDate) < new Date() ? '⚠️ Overdue!' : `⏳ ${Math.ceil((new Date(selectedAsset.dueDate) - new Date()) / (1000 * 60 * 60 * 24))} days left`}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Version Upload */}
                  <div style={{ marginBottom: '14px', padding: '12px', background: '#0d0d14', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📦 Versions</span>
                      <span style={{ padding: '3px 8px', background: selectedAsset.currentVersion > 1 && isNewVersion(getLatestVersionDate(selectedAsset)) ? '#f97316' : '#1e1e2e', borderRadius: '4px', fontSize: '10px' }}>v{selectedAsset.currentVersion}</span>
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>
                      {(selectedAsset.versions || []).map((v, i) => <span key={i}>{i > 0 && ' → '}v{v.version}</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input ref={versionInputRef} type="file" style={{ display: 'none' }} onChange={e => setVersionFile(e.target.files?.[0] || null)} />
                      <button onClick={() => versionInputRef.current?.click()} style={{ flex: 1, padding: '8px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{versionFile ? versionFile.name.substring(0, 12) + '...' : '+ New Version'}</button>
                      {versionFile && <Btn onClick={handleUploadVersion} small disabled={uploadingVersion}>{uploadingVersion ? '⏳' : '⬆️'}</Btn>}
                    </div>
                  </div>

                  {/* GDrive Link */}
                  {selectedAsset.status === 'approved' && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>📁 GDrive Link</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Input value={selectedAsset.gdriveLink || ''} onChange={v => setSelectedAsset({ ...selectedAsset, gdriveLink: v })} placeholder="Paste link" style={{ flex: 1, padding: '8px', fontSize: '11px' }} />
                        <Btn onClick={() => handleSetGdriveLink(selectedAsset.id, selectedAsset.gdriveLink)} small>Save</Btn>
                      </div>
                    </div>
                  )}
                  {selectedAsset.gdriveLink && <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px', background: 'rgba(34,197,94,0.15)', borderRadius: '8px', color: '#22c55e', fontSize: '11px', textAlign: 'center', textDecoration: 'none', marginBottom: '14px', fontWeight: '600' }}>📁 Open High-Res</a>}

                  {/* File Details */}
                  <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '12px', marginBottom: '14px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Type</span><span>{selectedAsset.mimeType?.split('/')[1] || selectedAsset.type}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div>
                  </div>

                  {/* Download */}
                  <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px', background: '#6366f1', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', textAlign: 'center', textDecoration: 'none', marginBottom: '10px' }}>⬇️ Download</a>
                  
                  {/* Delete Asset (Soft Delete) */}
                  {isProducer && (
                    <button onClick={async () => {
                      if (!confirm(`Delete "${selectedAsset.name}"? It will be permanently removed after 30 days.`)) return;
                      const deletedAt = new Date().toISOString();
                      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, deleted: true, deletedAt } : a);
                      const activity = { id: generateId(), type: 'delete', message: `${userProfile.name} deleted ${selectedAsset.name}`, timestamp: new Date().toISOString() };
                      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
                      setSelectedAsset(null);
                      await refreshProject();
                      showToast('Asset moved to trash', 'success');
                    }} style={{ width: '100%', padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#ef4444', fontSize: '11px', cursor: 'pointer', fontWeight: '500' }}>
                      🗑️ Delete Asset
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Compare Tab */}
            {assetTab === 'compare' && (
              <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
                <VersionComparison versions={selectedAsset.versions || []} currentVersion={selectedAsset.currentVersion} />
              </div>
            )}
          </Modal>
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

      let newAnnot = null;
      const author = typeof userProfile !== 'undefined' ? userProfile?.name : 'You';

      if (tool === 'freehand' && currentPath.length > 2) {
        newAnnot = { id: generateId(), type: 'freehand', path: currentPath, color, createdAt: new Date().toISOString(), author };
      } else if (tool === 'text' && newText.trim()) {
        newAnnot = { id: generateId(), type: 'text', x: drawStart.x, y: drawStart.y, text: newText, color, createdAt: new Date().toISOString(), author };
        setNewText('');
      } else if (width > 2 || height > 2) {
        newAnnot = { id: generateId(), type: tool, x, y, width: Math.max(width, 5), height: Math.max(height, 5), color, text: newText || '', createdAt: new Date().toISOString(), author };
        setNewText('');
      }

      if (newAnnot) {
        const updated = [...annots, newAnnot];
        setAnnots(updated);
        onChange(updated);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setCurrentEnd(null);
      setCurrentPath([]);
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
        return (
          <svg key={a.id} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            <path d={pathD} stroke={a.color} strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ strokeWidth: '3px' }} />
          </svg>
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
        return (
          <svg key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, overflow: 'visible', cursor: 'move', zIndex: 10 }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            <defs><marker id={`arr-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke={a.color} strokeWidth="3" markerEnd={`url(#arr-${a.id})`} />
          </svg>
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
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                style={{ width: '32px', height: '32px', background: tool === t.id ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                {t.icon}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: '24px', height: '24px', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer' }} />
            ))}
          </div>
          {(tool === 'text' || tool === 'rect' || tool === 'circle') && (
            <Input value={newText} onChange={setNewText} placeholder={tool === 'text' ? 'Text...' : 'Label...'} style={{ width: '100px', padding: '6px 10px', fontSize: '11px' }} />
          )}
          {/* Zoom controls */}
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px', marginLeft: 'auto' }}>
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
            <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
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
        
        {annots.length > 0 && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '6px', flexShrink: 0, textAlign: 'center' }}>{annots.length} annotation{annots.length !== 1 ? 's'  : ''} • Pinch to zoom</div>}
      </div>
    );
  };

  // Version Comparison Component
  const VersionComparison = ({ versions = [], currentVersion }) => {
    const [leftV, setLeftV] = useState(versions.length > 1 ? versions.length - 2 : 0);
    const [rightV, setRightV] = useState(versions.length - 1);
    if (versions.length < 2) return <div style={{ textAlign: 'center', padding: '40px', background: '#0d0d14', borderRadius: '12px' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Upload more versions to compare</div></div>;
    const left = versions[leftV];
    const right = versions[rightV];
    return (
      <div>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Select value={leftV} onChange={v => setLeftV(parseInt(v))} style={{ width: '140px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
          <span style={{ color: 'rgba(255,255,255,0.3)', alignSelf: 'center' }}>vs</span>
          <Select value={rightV} onChange={v => setRightV(parseInt(v))} style={{ width: '140px' }}>{versions.map((v, i) => <option key={i} value={i}>v{v.version}</option>)}</Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #1e1e2e', fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}><span>v{left.version}</span><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{formatDate(left.uploadedAt)}</span></div>
            <div style={{ padding: '12px' }}><img src={left.url} alt="" loading="lazy" style={{ width: '100%', borderRadius: '6px' }} /></div>
          </div>
          <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #1e1e2e', fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}><span>v{right.version} {right.version === currentVersion && <span style={{ color: '#22c55e' }}>✓</span>}</span><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{formatDate(right.uploadedAt)}</span></div>
            <div style={{ padding: '12px' }}><img src={right.url} alt="" loading="lazy" style={{ width: '100%', borderRadius: '6px' }} /></div>
          </div>
        </div>
      </div>
    );
  };

  // Main Render
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
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
        .fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <GlobalSearch />
      <Sidebar />
      <div style={{ marginLeft: isMobile ? '0' : '200px', padding: isMobile ? '60px 16px 16px' : '24px', background: t.bg, minHeight: '100vh' }}>
        {view === 'dashboard' && <Dashboard />}
        {view === 'tasks' && <TasksView />}
        {view === 'projects' && !selectedProjectId && <ProjectsList />}
        {view === 'projects' && selectedProjectId && <ProjectDetail />}
        {view === 'calendar' && <CalendarView />}
        {view === 'team' && <TeamManagement />}
      </div>
    </div>
  );
}
