'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProjects, getProjectsForUser, createProject, updateProject, getUsers, getFreelancers, getClients, getCoreTeam, createUser, createShareLink, TEAM_ROLES, CORE_ROLES, STATUS, generateId } from '@/lib/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const DEFAULT_CATEGORIES = [
  { id: 'cgi', name: 'CGI', icon: '🌐', color: '#3b82f6' },
  { id: 'animation', name: 'Animation', icon: '🎭', color: '#a855f7' },
  { id: 'statics', name: 'Statics', icon: '🖼️', color: '#ec4899' },
  { id: 'videos', name: 'Videos', icon: '🎬', color: '#f97316' },
  { id: 'vfx', name: 'VFX', icon: '✨', color: '#10b981' },
  { id: 'audio', name: 'Audio', icon: '🔊', color: '#06b6d4' },
];

const ASPECT_RATIOS = { landscape: 16/10, square: 1, portrait: 10/16 };
const CARD_SIZES = { S: 160, M: 220, L: 300 };

const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const formatDuration = s => { if (!s) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };
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
      { rootMargin: '100px' }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);
  
  const thumbSrc = thumbnail || src;
  
  return (
    <div ref={imgRef} style={{ ...style, position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      {/* Blur placeholder */}
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '24px', opacity: 0.3 }}>🖼️</span>
        </div>
      )}
      {inView && (
        <img 
          src={thumbSrc}
          alt={alt}
          onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: '100%', objectFit: style.objectFit || 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }}
        />
      )}
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
const Modal = ({ title, onClose, children, wide }) => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
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
  const [appearance, setAppearance] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('anandi-appearance');
      if (saved) return JSON.parse(saved);
    }
    return { layout: 'grid', cardSize: 'M', aspectRatio: 'square', thumbScale: 'fill', showInfo: true };
  });
  const [isMobile, setIsMobile] = useState(false);
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);

  // Save appearance to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('anandi-appearance', JSON.stringify(appearance));
    }
  }, [appearance]);

  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check); }, []);
  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const [p, u, f, c, ct] = await Promise.all([getProjectsForUser(userProfile.id, userProfile.role), getUsers(), getFreelancers(), getClients(), getCoreTeam()]); setProjects(p); setUsers(u); setFreelancers(f); setClients(c); setCoreTeam(ct); } catch (e) { console.error(e); } setLoading(false); };
  const showToast = (msg, type = 'info') => setToast({ message: msg, type });
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const refreshProject = async () => { const all = await getProjects(); setProjects(all); };

  const Sidebar = () => (
    <div style={{ width: isMobile ? '100%' : '200px', background: '#12121a', borderRight: isMobile ? 'none' : '1px solid #1e1e2e', borderBottom: isMobile ? '1px solid #1e1e2e' : 'none', height: isMobile ? 'auto' : '100vh', position: isMobile ? 'relative' : 'fixed', left: 0, top: 0, display: 'flex', flexDirection: isMobile ? 'row' : 'column', zIndex: 100 }}>
      {!isMobile && <div style={{ padding: '18px' }}><div style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Production Hub</div></div>}
      <nav style={{ flex: 1, padding: isMobile ? '10px' : '0 10px', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? '6px' : '0' }}>
        {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'projects', icon: '📁', label: 'Projects' }, ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])].map(item => (
          <div key={item.id} onClick={() => { setView(item.id); setSelectedProjectId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '10px 14px' : '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: view === item.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === item.id ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: isMobile ? '0' : '2px' }}><span style={{ fontSize: '14px' }}>{item.icon}</span>{!isMobile && item.label}</div>
        ))}
      </nav>
      {!isMobile && (
        <div style={{ padding: '14px', borderTop: '1px solid #1e1e2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Avatar user={userProfile} size={32} /><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: '11px', fontWeight: '500' }}>{userProfile?.firstName}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div></div></div>
          <button onClick={signOut} style={{ width: '100%', padding: '8px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', cursor: 'pointer' }}>Sign Out</button>
        </div>
      )}
    </div>
  );

  const Dashboard = () => {
    const allAssets = projects.flatMap(p => p.assets || []);
    const stats = [
      { label: 'Active', value: projects.filter(p => p.status === 'active').length, icon: '📁', color: '#6366f1' },
      { label: 'Assets', value: allAssets.length, icon: '🎬', color: '#f97316' },
      { label: 'Pending', value: allAssets.filter(a => a.status === 'pending').length, icon: '⏳', color: '#fbbf24' },
      { label: 'Review', value: allAssets.filter(a => a.status === 'review-ready').length, icon: '👁️', color: '#a855f7' },
    ];
    const recentActivity = projects.flatMap(p => (p.activityLog || []).map(a => ({ ...a, projectName: p.name }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);
    return (
      <div>
        <div style={{ marginBottom: '20px' }}><h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Welcome, {userProfile?.firstName}</h1><p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {stats.map(s => <div key={s.label} style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{s.icon}</div><div><div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div></div></div></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>📁 Recent Projects</h3>
            {projects.slice(0, 4).map(p => {
              const notifs = getProjectNotifs(p);
              const hasNotifs = notifs.pendingReview > 0 || notifs.newFeedback > 0 || notifs.changesRequested > 0;
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('projects'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', border: hasNotifs ? '1px solid rgba(251,191,36,0.3)' : 'none' }}>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{p.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{p.client}</div></div>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {notifs.pendingReview > 0 && <span style={{ padding: '2px 6px', background: '#a855f7', borderRadius: '4px', fontSize: '9px' }}>👁️{notifs.pendingReview}</span>}
                    {notifs.newFeedback > 0 && <span style={{ padding: '2px 6px', background: '#ef4444', borderRadius: '4px', fontSize: '9px' }}>💬{notifs.newFeedback}</span>}
                    <Badge status={p.status} />
                  </div>
                </div>
              );
            })}
            {projects.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No projects</div>}
          </div>
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>🔔 Recent Activity</h3>
            {recentActivity.map(a => <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} /><div><div style={{ fontSize: '12px' }}>{a.message}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{a.projectName} • {formatTimeAgo(a.timestamp)}</div></div></div>)}
            {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No activity</div>}
          </div>
        </div>
      </div>
    );
  };

  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newProj, setNewProj] = useState({ name: '', client: '', type: 'photoshoot', deadline: '', selectedCats: ['statics'] });
    const [creating, setCreating] = useState(false);
    const filtered = projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
      if (!newProj.name || !newProj.client) { showToast('Fill name & client', 'error'); return; }
      setCreating(true);
      try {
        const cats = DEFAULT_CATEGORIES.filter(c => newProj.selectedCats.includes(c.id));
        const proj = await createProject({ name: newProj.name, client: newProj.client, type: newProj.type, deadline: newProj.deadline, status: 'active', categories: cats, assets: [], assignedTeam: [{ odId: userProfile.id, odRole: userProfile.role, isOwner: true }], clientContacts: [], shareLinks: [], activityLog: [{ id: generateId(), type: 'created', message: `Project created by ${userProfile.name}`, userId: userProfile.id, timestamp: new Date().toISOString() }], createdBy: userProfile.id, createdByName: userProfile.name, selectionConfirmed: false });
        setProjects([proj, ...projects]);
        setNewProj({ name: '', client: '', type: 'photoshoot', deadline: '', selectedCats: ['statics'] });
        setShowCreate(false);
        showToast('Project created!', 'success');
      } catch (e) { showToast('Failed', 'error'); }
      setCreating(false);
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
        {projects.length === 0 ? (
          <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>📁</div><h3 style={{ marginBottom: '8px', fontSize: '16px' }}>No Projects Yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', marginBottom: '20px' }}>Create your first project</p>
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ Create Project</Btn>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
            {filtered.map(p => {
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
                    <Badge status={p.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{cnt} assets</span>
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
                <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Type</label><Select value={newProj.type} onChange={v => setNewProj({ ...newProj, type: v })}><option value="photoshoot">Photoshoot</option><option value="ad-film">Ad Film</option><option value="toolkit">Toolkit</option></Select></div>
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

    const renderUser = u => (
      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
        <Avatar user={u} size={40} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{u.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div>
        <RoleBadge role={u.role} />
      </div>
    );

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}><h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Team</h1>{isProducer && <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>}</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>{[{ id: 'core', label: '👑 Core', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{t.label} ({t.data.length})</button>)}</div>
        <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px' }}>
          {tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No core team</div>)}
          {tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No freelancers</div>)}
          {tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No clients</div>)}
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
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkType, setNewLinkType] = useState('client');
    const [newLinkExpiry, setNewLinkExpiry] = useState('');
    const [versionFile, setVersionFile] = useState(null);
    const [uploadingVersion, setUploadingVersion] = useState(false);
    const fileInputRef = useRef(null);
    const versionInputRef = useRef(null);
    const videoRef = useRef(null);

    if (!selectedProject) return null;
    const cats = selectedProject.categories || [];
    const team = (selectedProject.assignedTeam || []).map(t => ({ ...users.find(u => u.id === t.odId), isOwner: t.isOwner })).filter(m => m?.id);
    const shareLinks = (selectedProject.shareLinks || []).filter(l => l.active);
    const editors = [...coreTeam, ...freelancers].filter(u => Object.keys(TEAM_ROLES).includes(u.role));
    const availableTeam = [...coreTeam, ...freelancers].filter(u => !team.find(m => m.id === u.id));

    const getAssets = () => { let a = (selectedProject.assets || []).filter(x => !x.deleted); if (selectedCat) a = a.filter(x => x.category === selectedCat); return a; };
    const assets = getAssets();
    const getCatCount = id => (selectedProject.assets || []).filter(a => !a.deleted && a.category === id).length;
    const cardWidth = CARD_SIZES[appearance.cardSize];
    const aspectRatio = ASPECT_RATIOS[appearance.aspectRatio];

    const handleUpload = async () => {
      if (!uploadFiles.length) return;
      const cat = selectedCat || cats[0]?.id;
      if (!cat) { showToast('Select category', 'error'); return; }
      setShowUpload(false);
      for (const file of uploadFiles) {
        const uid = generateId();
        setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0 } }));
        try {
          const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
          const sRef = ref(storage, path);
          const task = uploadBytesResumable(sRef, file);
          task.on('state_changed', snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })), () => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              const type = getFileType(file);
              
              // Generate and upload thumbnail for images and videos
              let thumbnailUrl = null;
              try {
                let thumbBlob = null;
                if (type === 'image') thumbBlob = await generateThumbnail(file);
                else if (type === 'video') thumbBlob = await generateVideoThumbnail(file);
                
                if (thumbBlob) {
                  const thumbPath = `projects/${selectedProject.id}/${cat}/thumbs/${Date.now()}-thumb.jpg`;
                  const thumbRef = ref(storage, thumbPath);
                  await uploadBytesResumable(thumbRef, thumbBlob);
                  thumbnailUrl = await getDownloadURL(thumbRef);
                }
              } catch (e) { console.log('Thumb generation failed:', e); }
              
              const newAsset = { id: generateId(), name: file.name, type, category: cat, url, path, thumbnail: thumbnailUrl || (type === 'image' ? url : null), fileSize: file.size, mimeType: file.type, status: 'pending', rating: 0, isSelected: false, assignedTo: null, uploadedBy: userProfile.id, uploadedByName: userProfile.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name }], currentVersion: 1, feedback: [], annotations: [], gdriveLink: '' };
              const updatedAssets = [...(selectedProject.assets || []), newAsset];
              const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name}`, timestamp: new Date().toISOString() };
              await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(selectedProject.activityLog || []), activity] });
              await refreshProject();
              setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
            }
          );
        } catch (e) { showToast(`Failed: ${file.name}`, 'error'); }
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
    const handleUpdateStatus = async (assetId, status) => { const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, status } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); if (selectedAsset) setSelectedAsset({ ...selectedAsset, status }); };
    const handleAssign = async (assetId, editorId) => { const editor = editors.find(e => e.id === editorId); const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, assignedTo: editorId, assignedToName: editor?.name, status: editorId ? 'assigned' : a.status } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); };
    const handleSetGdriveLink = async (assetId, link) => { const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, gdriveLink: link, status: link ? 'delivered' : a.status } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); if (selectedAsset) setSelectedAsset({ ...selectedAsset, gdriveLink: link, status: link ? 'delivered' : selectedAsset.status }); showToast('Link saved', 'success'); };
    const handleAddFeedback = async () => { 
      if (!newFeedback.trim() || !selectedAsset) return; 
      const videoTime = selectedAsset.type === 'video' && videoRef.current ? videoRef.current.currentTime : null;
      const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString(), videoTimestamp: videoTime, isDone: false }; 
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a); 
      await updateProject(selectedProject.id, { assets: updated }); 
      await refreshProject(); 
      setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' }); 
      setNewFeedback(''); 
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

          {/* Tabs */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['assets', 'team', 'activity', 'links'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : '1px solid #2a2a3e', borderRadius: '8px', color: '#fff', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{isMobile ? t.charAt(0).toUpperCase() : t}</button>)}
            </div>
            {tab === 'assets' && selectedAssets.size > 0 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{selectedAssets.size}</span>
                <Btn onClick={() => handleBulkSelect(true)} small color="#22c55e">✓</Btn>
                <Btn onClick={() => handleBulkSelect(false)} small outline>✗</Btn>
              </div>
            )}
            {tab === 'assets' && !selectedProject.selectionConfirmed && selectedCount > 0 && isProducer && !isMobile && <Btn onClick={handleConfirmSelection} small color="#f59e0b">🎯 Confirm ({selectedCount})</Btn>}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={{ padding: '12px 16px', background: '#1e1e2e' }}>
              {Object.entries(uploadProgress).map(([id, item]) => <div key={id} style={{ marginBottom: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}><span>{item.name}</span><span>{item.progress}%</span></div><div style={{ background: '#0d0d14', borderRadius: '3px', height: '4px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '3px' }} /></div></div>)}
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
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? (appearance.cardSize === 'L' ? '1fr' : appearance.cardSize === 'S' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)') : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: '12px' }}>
                    {assets.map(a => {
                      const latestVersionDate = getLatestVersionDate(a);
                      const hasNewVersion = latestVersionDate && isNewVersion(latestVersionDate);
                      return (
                        <div key={a.id} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', border: selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e', position: 'relative' }}>
                          <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ position: 'absolute', top: '10px', left: '10px', width: '22px', height: '22px', borderRadius: '6px', background: selectedAssets.has(a.id) ? '#6366f1' : 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>{selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}</div>
                          {a.isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600' }}>⭐</div>}
                          {hasNewVersion && <div style={{ position: 'absolute', top: a.isSelected ? '38px' : '10px', right: '10px', background: '#f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>🆕 v{a.currentVersion}</div>}
                          {(a.annotations?.length > 0) && <div style={{ position: 'absolute', bottom: appearance.showInfo ? '80px' : '10px', right: '10px', background: '#ec4899', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>✏️ {a.annotations.length}</div>}
                          
                          <div onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }} style={{ cursor: 'pointer', height: isMobile ? (appearance.cardSize === 'L' ? '200px' : appearance.cardSize === 'S' ? '80px' : '120px') : `${cardWidth / aspectRatio}px`, background: '#0d0d14', position: 'relative' }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} thumbnail={a.thumbnail} duration={a.duration} style={{ width: '100%', height: '100%' }} /> : a.type === 'audio' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🔊</span></div> : (a.thumbnail || a.url) ? <LazyImage src={a.url} thumbnail={a.thumbnail} style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>📄</span></div>}
                            {a.feedback?.length > 0 && <div style={{ position: 'absolute', bottom: '8px', left: '8px', background: '#ef4444', borderRadius: '10px', padding: '3px 8px', fontSize: '10px' }}>{a.feedback.length}💬</div>}
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
                )}
              </div>
            )}

            {tab === 'team' && (
              <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: '14px' }}>👥 Team ({team.length})</h3>{isProducer && availableTeam.length > 0 && <Btn onClick={() => setShowAddTeam(true)} small>+ Add</Btn>}</div>
                <div style={{ padding: '14px' }}>{team.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No team</div> : team.map(m => <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}><Avatar user={m} size={38} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{m.name} {m.isOwner && <span style={{ fontSize: '10px', color: '#f97316' }}>👑</span>}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{m.email}</div></div><RoleBadge role={m.role} /></div>)}</div>
              </div>
            )}

            {tab === 'activity' && (
              <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}>📋 Activity Log</h3>
                {(selectedProject.activityLog || []).length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No activity</div> : (selectedProject.activityLog || []).slice().reverse().map(log => <div key={log.id} style={{ display: 'flex', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} /><div><div style={{ fontSize: '12px' }}>{log.message}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(log.timestamp)}</div></div></div>)}
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
                {[{ id: 'preview', icon: '👁️', label: 'Preview' }, { id: 'annotate', icon: '✏️', label: 'Annotate' }, { id: 'compare', icon: '📊', label: 'Compare' }].map(t => (
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
                <div style={{ flex: isMobile ? 'none' : 1, display: 'flex', flexDirection: 'column', background: '#0a0a10', minWidth: 0, overflow: 'hidden' }}>
                  {/* Image Container - Responsive within bounds */}
                  <div style={{ flex: isMobile ? 'none' : 1, minHeight: isMobile ? '300px' : 'auto', padding: isMobile ? '12px' : '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {selectedAsset.type === 'video' ? (
                      <video ref={videoRef} src={selectedAsset.url} controls playsInline style={{ maxWidth: '100%', maxHeight: isMobile ? '280px' : '100%', objectFit: 'contain' }} />
                    ) : selectedAsset.type === 'audio' ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔊</div>
                        <audio src={selectedAsset.url} controls style={{ width: '100%', maxWidth: '300px' }} />
                      </div>
                    ) : selectedAsset.type === 'image' ? (
                      <img src={selectedAsset.url} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: isMobile ? '280px' : '100%', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ fontSize: '60px' }}>📄</div>
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {selectedAsset.type === 'video' && (
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>📍 at current time</span>
                      )}
                      <Input value={newFeedback} onChange={setNewFeedback} placeholder="Add feedback..." style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }} />
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
                  <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '12px', background: '#6366f1', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download</a>
                </div>
              </div>
            )}

            {/* Annotate Tab */}
            {assetTab === 'annotate' && selectedAsset.type === 'image' && (
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(85vh - 120px)', overflow: isMobile ? 'auto' : 'hidden' }}>
                <div style={{ flex: 1, padding: isMobile ? '12px' : '20px', overflow: 'auto', background: '#0a0a10' }}>
                  <AnnotationCanvas imageUrl={selectedAsset.url} annotations={selectedAsset.annotations || []} onChange={handleSaveAnnotations} />
                </div>
                {/* Same sidebar as preview */}
                <div style={{ width: isMobile ? '100%' : '240px', background: '#12121a', borderLeft: isMobile ? 'none' : '1px solid #1e1e2e', padding: '16px', overflow: 'auto', flexShrink: 0 }}>
                  <div style={{ marginBottom: '16px' }}><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Rating</div><StarRating rating={selectedAsset.rating} onChange={r => handleRate(selectedAsset.id, r)} size={24} /></div>
                  <Btn onClick={() => handleToggleSelected(selectedAsset.id)} color={selectedAsset.isSelected ? '#22c55e' : undefined} style={{ width: '100%', marginBottom: '16px' }}>{selectedAsset.isSelected ? '⭐ Selected' : '☆ Select'}</Btn>
                  <div style={{ marginBottom: '16px' }}><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Status</div><Select value={selectedAsset.status || 'Pending'} onChange={v => handleStatusChange(selectedAsset.id, v)} options={STATUS_OPTIONS} /></div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Size</span><span>{formatSize(selectedAsset.size)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Type</span><span>{selectedAsset.type}</span></div></div>
                </div>
              </div>
            )}
            {assetTab === 'annotate' && selectedAsset.type !== 'image' && (
              <div style={{ padding: '60px 20px', textAlign: 'center', background: '#0d0d14', margin: '20px', borderRadius: '12px' }}>
                <div style={{ fontSize: '50px', marginBottom: '14px' }}>🎬</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Annotations available for images only</div>
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

  // Annotation Canvas Component
  const AnnotationCanvas = ({ imageUrl, annotations = [], onChange }) => {
    const [annots, setAnnots] = useState(annotations);
    const [tool, setTool] = useState('rect'); // rect, circle, arrow, freehand, text
    const [color, setColor] = useState('#ef4444');
    const [newText, setNewText] = useState('');
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawStart, setDrawStart] = useState(null);
    const [currentPath, setCurrentPath] = useState([]);
    const [dragging, setDragging] = useState(null);
    const [resizing, setResizing] = useState(null);
    const [selectedAnnot, setSelectedAnnot] = useState(null);
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    const COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
    const TOOLS = [
      { id: 'rect', icon: '▢', label: 'Rectangle' },
      { id: 'circle', icon: '○', label: 'Circle' },
      { id: 'arrow', icon: '→', label: 'Arrow' },
      { id: 'freehand', icon: '✎', label: 'Draw' },
      { id: 'text', icon: 'T', label: 'Text' },
    ];

    const getPos = (e) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100
      };
    };

    const handleMouseDown = (e) => {
      if (dragging || resizing) return;
      const pos = getPos(e);
      setDrawStart(pos);
      setIsDrawing(true);
      if (tool === 'freehand') {
        setCurrentPath([pos]);
      }
    };

    const handleMouseMove = (e) => {
      if (dragging) {
        const pos = getPos(e);
        const updated = annots.map(a => a.id === dragging ? { ...a, x: Math.max(0, Math.min(100 - a.width, pos.x - a.width/2)), y: Math.max(0, Math.min(100 - a.height, pos.y - a.height/2)) } : a);
        setAnnots(updated);
        return;
      }
      if (resizing) {
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
      if (tool === 'freehand') {
        setCurrentPath(prev => [...prev, getPos(e)]);
      }
    };

    const handleMouseUp = (e) => {
      if (dragging) { onChange(annots); setDragging(null); return; }
      if (resizing) { onChange(annots); setResizing(null); return; }
      if (!isDrawing || !drawStart) return;
      
      const pos = getPos(e);
      const width = Math.abs(pos.x - drawStart.x);
      const height = Math.abs(pos.y - drawStart.y);
      const x = Math.min(pos.x, drawStart.x);
      const y = Math.min(pos.y, drawStart.y);

      let newAnnot = null;

      if (tool === 'freehand' && currentPath.length > 2) {
        newAnnot = { id: generateId(), type: 'freehand', path: currentPath, color, createdAt: new Date().toISOString(), author: userProfile?.name || 'You' };
      } else if (tool === 'text') {
        if (newText.trim()) {
          newAnnot = { id: generateId(), type: 'text', x: drawStart.x, y: drawStart.y, text: newText, color, createdAt: new Date().toISOString(), author: userProfile?.name || 'You' };
          setNewText('');
        }
      } else if (width > 2 && height > 2) {
        newAnnot = { id: generateId(), type: tool, x, y, width, height, color, text: newText || '', createdAt: new Date().toISOString(), author: userProfile?.name || 'You' };
        setNewText('');
      }

      if (newAnnot) {
        const updated = [...annots, newAnnot];
        setAnnots(updated);
        onChange(updated);
      }

      setIsDrawing(false);
      setDrawStart(null);
      setCurrentPath([]);
    };

    const deleteAnnot = (id) => { 
      const updated = annots.filter(a => a.id !== id); 
      setAnnots(updated); 
      onChange(updated); 
      setSelectedAnnot(null);
    };

    const renderAnnotation = (a) => {
      const isSelected = selectedAnnot === a.id;
      const baseStyle = { position: 'absolute', cursor: 'move' };
      
      if (a.type === 'freehand' && a.path) {
        const minX = Math.min(...a.path.map(p => p.x));
        const minY = Math.min(...a.path.map(p => p.y));
        const maxX = Math.max(...a.path.map(p => p.x));
        const maxY = Math.max(...a.path.map(p => p.y));
        const pathD = a.path.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return (
          <svg key={a.id} style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <path d={pathD} stroke={a.color} strokeWidth="2" fill="none" style={{ pointerEvents: 'stroke' }} />
          </svg>
        );
      }

      if (a.type === 'text') {
        return (
          <div key={a.id} style={{ ...baseStyle, left: `${a.x}%`, top: `${a.y}%`, color: a.color, fontSize: '14px', fontWeight: '600', textShadow: '0 1px 2px rgba(0,0,0,0.8)', border: isSelected ? `1px dashed ${a.color}` : 'none', padding: '2px 4px' }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            {a.text}
            {isSelected && <button onClick={(e) => { e.stopPropagation(); deleteAnnot(a.id); }} style={{ position: 'absolute', top: '-12px', right: '-12px', width: '18px', height: '18px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>}
          </div>
        );
      }

      if (a.type === 'circle') {
        return (
          <div key={a.id} style={{ ...baseStyle, left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2px solid ${a.color}`, borderRadius: '50%', background: `${a.color}20` }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            {a.text && <div style={{ position: 'absolute', top: '-24px', left: '0', background: a.color, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>{a.text}</div>}
            {isSelected && <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '10px', height: '10px', background: a.color, borderRadius: '2px', cursor: 'se-resize' }} />}
            {isSelected && <button onClick={(e) => { e.stopPropagation(); deleteAnnot(a.id); }} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '18px', height: '18px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>}
          </div>
        );
      }

      if (a.type === 'arrow') {
        return (
          <svg key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, overflow: 'visible', cursor: 'move' }}
            onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
            onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
            <defs><marker id={`arrow-${a.id}`} markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill={a.color} /></marker></defs>
            <line x1="0" y1="50%" x2="100%" y2="50%" stroke={a.color} strokeWidth="2" markerEnd={`url(#arrow-${a.id})`} />
            {isSelected && <circle cx="100%" cy="50%" r="6" fill={a.color} style={{ cursor: 'se-resize' }} onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} />}
          </svg>
        );
      }

      // Default: rectangle
      return (
        <div key={a.id} style={{ ...baseStyle, left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2px solid ${a.color}`, borderRadius: '4px', background: `${a.color}20` }}
          onClick={(e) => { e.stopPropagation(); setSelectedAnnot(a.id); }}
          onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
          {a.text && <div style={{ position: 'absolute', top: '-24px', left: '0', background: a.color, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap' }}>{a.text}</div>}
          {isSelected && <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '10px', height: '10px', background: a.color, borderRadius: '2px', cursor: 'se-resize' }} />}
          {isSelected && <button onClick={(e) => { e.stopPropagation(); deleteAnnot(a.id); }} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '18px', height: '18px', background: '#ef4444', border: 'none', borderRadius: '50%', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>×</button>}
        </div>
      );
    };

    return (
      <div>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Tools */}
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
                style={{ width: '32px', height: '32px', background: tool === t.id ? '#6366f1' : 'transparent', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                {t.icon}
              </button>
            ))}
          </div>
          
          {/* Colors */}
          <div style={{ display: 'flex', gap: '4px', background: '#0d0d14', borderRadius: '8px', padding: '4px' }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                style={{ width: '24px', height: '24px', background: c, border: color === c ? '2px solid #fff' : '2px solid transparent', borderRadius: '4px', cursor: 'pointer' }} />
            ))}
          </div>

          {/* Text input for text/shape labels */}
          {(tool === 'text' || tool === 'rect' || tool === 'circle') && (
            <Input value={newText} onChange={setNewText} placeholder={tool === 'text' ? 'Text...' : 'Label (optional)...'} style={{ width: '150px', padding: '6px 10px', fontSize: '12px' }} />
          )}
        </div>

        {/* Canvas */}
        <div ref={containerRef} 
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isDrawing) handleMouseUp({ clientX: 0, clientY: 0 }); }}
          onClick={() => setSelectedAnnot(null)}
          style={{ position: 'relative', background: '#0d0d14', borderRadius: '8px', overflow: 'hidden', cursor: tool === 'freehand' ? 'crosshair' : 'crosshair', userSelect: 'none' }}>
          <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', display: 'block', pointerEvents: 'none' }} />
          
          {/* Render existing annotations */}
          {annots.map(renderAnnotation)}

          {/* Preview while drawing */}
          {isDrawing && drawStart && tool !== 'freehand' && tool !== 'text' && (
            <div style={{ position: 'absolute', left: `${Math.min(drawStart.x, drawStart.x)}%`, top: `${drawStart.y}%`, border: `2px dashed ${color}`, borderRadius: tool === 'circle' ? '50%' : '4px', pointerEvents: 'none', opacity: 0.6 }} />
          )}

          {/* Freehand preview */}
          {isDrawing && tool === 'freehand' && currentPath.length > 1 && (
            <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              <path d={currentPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} stroke={color} strokeWidth="2" fill="none" />
            </svg>
          )}
        </div>

        {/* Annotation List */}
        {annots.length > 0 && (
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {annots.length} annotation{annots.length !== 1 ? 's' : ''} • Click to select, drag to move
          </div>
        )}
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
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Sidebar />
      <div style={{ marginLeft: isMobile ? '0' : '200px', padding: isMobile ? '60px 16px 16px' : '24px' }}>
        {view === 'dashboard' && <Dashboard />}
        {view === 'projects' && !selectedProjectId && <ProjectsList />}
        {view === 'projects' && selectedProjectId && <ProjectDetail />}
        {view === 'team' && <TeamManagement />}
      </div>
    </div>
  );
}
