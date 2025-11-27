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

const VideoThumbnail = ({ src, duration, style }) => {
  const videoRef = useRef(null);
  const [scrubPos, setScrubPos] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const handleMouseMove = (e) => { if (!videoRef.current) return; const rect = e.currentTarget.getBoundingClientRect(); const pos = (e.clientX - rect.left) / rect.width; setScrubPos(pos); videoRef.current.currentTime = pos * (videoRef.current.duration || 0); };
  return <div style={{ position: 'relative', width: '100%', height: '100%', ...style }} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} onMouseMove={handleMouseMove}><video ref={videoRef} src={src} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />{isHovering && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scrubPos * 100}%`, width: '2px', background: '#ef4444', pointerEvents: 'none' }} />}{duration && <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px' }}>{formatDuration(duration)}</div>}</div>;
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
  const [appearance, setAppearance] = useState({ layout: 'grid', cardSize: 'M', aspectRatio: 'landscape', thumbScale: 'fill', showInfo: true });
  const [isMobile, setIsMobile] = useState(false);
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);

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
              const newAsset = { id: generateId(), name: file.name, type, category: cat, url, path, thumbnail: type === 'image' ? url : null, fileSize: file.size, mimeType: file.type, status: 'pending', rating: 0, isSelected: false, assignedTo: null, uploadedBy: userProfile.id, uploadedByName: userProfile.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.name }], currentVersion: 1, feedback: [], annotations: [], gdriveLink: '' };
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
    const handleAddFeedback = async () => { if (!newFeedback.trim() || !selectedAsset) return; const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString() }; const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' }); setNewFeedback(''); };
    const handleSaveAnnotations = async (annotations) => { const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, annotations } : a); await updateProject(selectedProject.id, { assets: updated }); await refreshProject(); setSelectedAsset({ ...selectedAsset, annotations }); showToast('Annotations saved', 'success'); };
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
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: '12px' }}>
                    {assets.map(a => {
                      const latestVersionDate = getLatestVersionDate(a);
                      const hasNewVersion = latestVersionDate && isNewVersion(latestVersionDate);
                      return (
                        <div key={a.id} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', border: selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e', position: 'relative' }}>
                          <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ position: 'absolute', top: '10px', left: '10px', width: '22px', height: '22px', borderRadius: '6px', background: selectedAssets.has(a.id) ? '#6366f1' : 'rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>{selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}</div>
                          {a.isSelected && <div style={{ position: 'absolute', top: '10px', right: '10px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600' }}>⭐</div>}
                          {hasNewVersion && <div style={{ position: 'absolute', top: a.isSelected ? '38px' : '10px', right: '10px', background: '#f97316', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>🆕 v{a.currentVersion}</div>}
                          {(a.annotations?.length > 0) && <div style={{ position: 'absolute', bottom: appearance.showInfo ? '80px' : '10px', right: '10px', background: '#ec4899', borderRadius: '6px', padding: '4px 8px', fontSize: '9px', zIndex: 5, fontWeight: '600' }}>✏️ {a.annotations.length}</div>}
                          
                          <div onClick={() => { setSelectedAsset(a); setAssetTab('preview'); }} style={{ cursor: 'pointer', height: isMobile ? '120px' : `${cardWidth / aspectRatio}px`, background: '#0d0d14', position: 'relative' }}>
                            {a.type === 'video' ? <VideoThumbnail src={a.url} duration={a.duration} style={{ width: '100%', height: '100%' }} /> : a.type === 'audio' ? <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🔊</span></div> : a.thumbnail ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>📄</span></div>}
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
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 'calc(85vh - 120px)', overflow: 'hidden' }}>
                {/* LEFT: Preview Area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0a10', minWidth: 0, overflow: 'hidden' }}>
                  {/* Image Container - Responsive within bounds */}
                  <div style={{ flex: 1, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {selectedAsset.type === 'video' ? (
                      <video src={selectedAsset.url} controls style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    ) : selectedAsset.type === 'audio' ? (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '60px', marginBottom: '20px' }}>🔊</div>
                        <audio src={selectedAsset.url} controls style={{ width: '100%', maxWidth: '300px' }} />
                      </div>
                    ) : selectedAsset.type === 'image' ? (
                      <img src={selectedAsset.url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ fontSize: '60px' }}>📄</div>
                    )}
                  </div>
                  
                  {/* Feedback Section */}
                  <div style={{ padding: '14px 20px', borderTop: '1px solid #1e1e2e', background: '#12121a', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>💬 Feedback ({selectedAsset.feedback?.length || 0})</div>
                    <div style={{ maxHeight: '80px', overflow: 'auto', marginBottom: '8px' }}>
                      {(selectedAsset.feedback || []).length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>No feedback yet</div>
                      ) : (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{ padding: '8px', background: '#1e1e2e', borderRadius: '6px', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '600' }}>{fb.userName}</span>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(fb.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '11px' }}>{fb.text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
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
              <div style={{ padding: '20px', overflow: 'auto', flex: 1 }}>
                <AnnotationCanvas imageUrl={selectedAsset.url} annotations={selectedAsset.annotations || []} onChange={handleSaveAnnotations} />
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
    const [newText, setNewText] = useState('');
    const [placing, setPlacing] = useState(false);
    const [dragging, setDragging] = useState(null);
    const [resizing, setResizing] = useState(null);
    const containerRef = useRef(null);

    const handleClick = (e) => {
      if (!placing || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const newAnnot = { id: generateId(), x, y, width: 12, height: 12, text: newText || 'Note', color: '#ef4444', createdAt: new Date().toISOString(), author: 'You' };
      const updated = [...annots, newAnnot];
      setAnnots(updated);
      onChange(updated);
      setPlacing(false);
      setNewText('');
    };

    const handleDrag = (e, id) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      const updated = annots.map(a => a.id === id ? { ...a, x, y } : a);
      setAnnots(updated);
    };

    const handleResize = (e, id) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const annot = annots.find(a => a.id === id);
      if (!annot) return;
      const w = Math.max(5, Math.min(50, ((e.clientX - rect.left) / rect.width) * 100 - annot.x + 3));
      const h = Math.max(5, Math.min(50, ((e.clientY - rect.top) / rect.height) * 100 - annot.y + 3));
      const updated = annots.map(a => a.id === id ? { ...a, width: w, height: h } : a);
      setAnnots(updated);
    };

    const deleteAnnot = (id) => { const updated = annots.filter(a => a.id !== id); setAnnots(updated); onChange(updated); };

    useEffect(() => {
      const handleMouseMove = (e) => { if (dragging) handleDrag(e, dragging); if (resizing) handleResize(e, resizing); };
      const handleMouseUp = () => { if (dragging || resizing) { onChange(annots); setDragging(null); setResizing(null); } };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [dragging, resizing, annots]);

    return (
      <div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <Input value={newText} onChange={setNewText} placeholder="Annotation text..." style={{ flex: 1, minWidth: '150px' }} />
          <Btn onClick={() => setPlacing(true)} color={placing ? '#22c55e' : undefined}>{placing ? '📍 Click image' : '+ Add'}</Btn>
        </div>
        <div ref={containerRef} onClick={handleClick} style={{ position: 'relative', background: '#0d0d14', borderRadius: '8px', overflow: 'hidden', cursor: placing ? 'crosshair' : 'default' }}>
          <img src={imageUrl} alt="" style={{ width: '100%', display: 'block' }} />
          {annots.map(a => (
            <div key={a.id} style={{ position: 'absolute', left: `${a.x}%`, top: `${a.y}%`, width: `${a.width}%`, height: `${a.height}%`, border: `2px solid ${a.color}`, borderRadius: '4px', background: 'rgba(239,68,68,0.15)', cursor: 'move' }} onMouseDown={(e) => { e.stopPropagation(); setDragging(a.id); }}>
              <div style={{ position: 'absolute', top: '-32px', left: '0', background: a.color, padding: '4px 10px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap', minWidth: '100px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontWeight: '600' }}>{a.text}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteAnnot(a.id); }} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, fontSize: '12px', marginLeft: 'auto' }}>×</button>
                </div>
                <div style={{ fontSize: '9px', opacity: 0.8, marginTop: '2px' }}>{a.author || 'Unknown'} • {a.createdAt ? formatDate(a.createdAt) : 'No date'}</div>
              </div>
              <div onMouseDown={(e) => { e.stopPropagation(); setResizing(a.id); }} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '10px', height: '10px', background: a.color, borderRadius: '2px', cursor: 'se-resize' }} />
            </div>
          ))}
        </div>
        {annots.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>{annots.length} annotation{annots.length !== 1 ? 's' : ''} • Drag to move, corner to resize</div>
            <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '12px', maxHeight: '150px', overflowY: 'auto' }}>
              {annots.map((a, idx) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '8px 0', borderBottom: idx < annots.length - 1 ? '1px solid #1e1e2e' : 'none' }}>
                  <div style={{ width: '20px', height: '20px', background: a.color, borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600' }}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: '500' }}>{a.text}</div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{a.author || 'Unknown'} • {a.createdAt ? formatDate(a.createdAt) : 'No date'}</div>
                  </div>
                  <button onClick={() => deleteAnnot(a.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>×</button>
                </div>
              ))}
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
            <div style={{ padding: '12px' }}><img src={left.url} alt="" style={{ width: '100%', borderRadius: '6px' }} /></div>
          </div>
          <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #1e1e2e', fontSize: '12px', fontWeight: '600', display: 'flex', justifyContent: 'space-between' }}><span>v{right.version} {right.version === currentVersion && <span style={{ color: '#22c55e' }}>✓</span>}</span><span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{formatDate(right.uploadedAt)}</span></div>
            <div style={{ padding: '12px' }}><img src={right.url} alt="" style={{ width: '100%', borderRadius: '6px' }} /></div>
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
