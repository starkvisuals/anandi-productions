'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProjects, getProjectsForUser, createProject, updateProject, getUsers, getFreelancers, getClients, getCoreTeam, createUser, updateUser, deleteUser, createShareLink, deactivateShareLink, TEAM_ROLES, CORE_ROLES, STATUS, generateId } from '@/lib/firestore';
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

// Utilities
const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const formatDuration = s => { if (!s) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${sec.toString().padStart(2, '0')}`; };
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; if (f.type?.startsWith('audio/')) return 'audio'; return 'other'; };

// UI Components
const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const RoleBadge = ({ role }) => { const r = TEAM_ROLES[role] || CORE_ROLES[role] || { label: role, color: '#6366f1' }; return <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>{r.icon || '👤'} {r.label}</span>; };
const Avatar = ({ user, size = 32 }) => { const c = (TEAM_ROLES[user?.role] || CORE_ROLES[user?.role])?.color || '#6366f1'; return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${c}40, ${c}20)`, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, flexShrink: 0 }}>{user?.avatar || user?.firstName?.[0] || '?'}</div>; };
const Modal = ({ title, onClose, children, wide }) => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}><div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: wide ? '950px' : '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#16161f', zIndex: 10 }}><h3 style={{ margin: 0, fontSize: '14px' }}>{title}</h3><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer' }}>×</button></div><div style={{ padding: '18px' }}>{children}</div></div></div>;
const Toast = ({ message, type, onClose }) => { useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]); return <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '12px 18px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '500', zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{message}</div>; };
const Btn = ({ children, onClick, color = '#6366f1', disabled, small, outline }) => <button onClick={onClick} disabled={disabled} style={{ padding: small ? '6px 10px' : '8px 14px', background: outline ? 'transparent' : color, border: outline ? `1px solid ${color}` : 'none', borderRadius: '6px', color: outline ? color : '#fff', fontSize: small ? '10px' : '12px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>{children}</button>;
const Input = ({ value, onChange, placeholder, type = 'text', style, ...props }) => <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: '100%', padding: '8px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '12px', ...style }} {...props} />;
const Select = ({ value, onChange, children, style }) => <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '12px', ...style }}>{children}</select>;

// Star Rating Component
const StarRating = ({ rating = 0, onChange, size = 16, readonly = false }) => {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(star => (
        <span key={star} onClick={() => !readonly && onChange?.(star === rating ? 0 : star)} onMouseEnter={() => !readonly && setHover(star)} onMouseLeave={() => !readonly && setHover(0)}
          style={{ cursor: readonly ? 'default' : 'pointer', fontSize: size, color: star <= (hover || rating) ? '#fbbf24' : '#3a3a4a', transition: 'color 0.1s' }}>★</span>
      ))}
    </div>
  );
};

// Video Thumbnail with Scrubber
const VideoThumbnail = ({ src, duration, style }) => {
  const videoRef = useRef(null);
  const [scrubPos, setScrubPos] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  
  const handleMouseMove = (e) => {
    if (!videoRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    setScrubPos(pos);
    videoRef.current.currentTime = pos * (videoRef.current.duration || 0);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }} onMouseEnter={() => setIsHovering(true)} onMouseLeave={() => setIsHovering(false)} onMouseMove={handleMouseMove}>
      <video ref={videoRef} src={src} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      {isHovering && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${scrubPos * 100}%`, width: '2px', background: '#ef4444', pointerEvents: 'none' }} />}
      {duration && <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>{formatDuration(duration)}</div>}
    </div>
  );
};

// Appearance Settings Panel
const AppearancePanel = ({ settings, onChange, onClose }) => (
  <div style={{ position: 'absolute', top: '40px', right: '0', background: '#1e1e2e', borderRadius: '10px', border: '1px solid #2a2a3e', padding: '16px', width: '220px', zIndex: 100 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}><span style={{ fontSize: '12px', fontWeight: '600' }}>Appearance</span><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>×</button></div>
    <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Layout</div><div style={{ display: 'flex', gap: '6px' }}><button onClick={() => onChange({ ...settings, layout: 'grid' })} style={{ flex: 1, padding: '6px', background: settings.layout === 'grid' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>⊞ Grid</button><button onClick={() => onChange({ ...settings, layout: 'list' })} style={{ flex: 1, padding: '6px', background: settings.layout === 'list' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>☰ List</button></div></div>
    <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Card Size</div><div style={{ display: 'flex', gap: '6px' }}>{['S', 'M', 'L'].map(s => <button key={s} onClick={() => onChange({ ...settings, cardSize: s })} style={{ flex: 1, padding: '6px', background: settings.cardSize === s ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{s}</button>)}</div></div>
    <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Aspect Ratio</div><div style={{ display: 'flex', gap: '6px' }}>{['landscape', 'square', 'portrait'].map(a => <button key={a} onClick={() => onChange({ ...settings, aspectRatio: a })} style={{ flex: 1, padding: '6px', background: settings.aspectRatio === a ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>{a === 'landscape' ? '▬' : a === 'square' ? '◼' : '▮'}</button>)}</div></div>
    <div style={{ marginBottom: '12px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Thumbnail</div><div style={{ display: 'flex', gap: '6px' }}><button onClick={() => onChange({ ...settings, thumbScale: 'fit' })} style={{ flex: 1, padding: '6px', background: settings.thumbScale === 'fit' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Fit</button><button onClick={() => onChange({ ...settings, thumbScale: 'fill' })} style={{ flex: 1, padding: '6px', background: settings.thumbScale === 'fill' ? '#6366f1' : '#0d0d14', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Fill</button></div></div>
    <div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>Show Info</span><button onClick={() => onChange({ ...settings, showInfo: !settings.showInfo })} style={{ width: '36px', height: '20px', borderRadius: '10px', border: 'none', background: settings.showInfo ? '#6366f1' : '#0d0d14', cursor: 'pointer', position: 'relative' }}><div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: settings.showInfo ? '18px' : '2px', transition: 'left 0.2s' }} /></button></div></div>
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
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const [p, u, f, c, ct] = await Promise.all([getProjectsForUser(userProfile.id, userProfile.role), getUsers(), getFreelancers(), getClients(), getCoreTeam()]); setProjects(p); setUsers(u); setFreelancers(f); setClients(c); setCoreTeam(ct); } catch (e) { console.error(e); } setLoading(false); };
  const showToast = (msg, type = 'info') => setToast({ message: msg, type });
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const refreshProject = async () => { const all = await getProjects(); setProjects(all); };

  // Sidebar
  const Sidebar = () => (
    <div style={{ width: '200px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ padding: '18px' }}><div style={{ fontSize: '18px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Production Hub</div></div>
      <nav style={{ flex: 1, padding: '0 10px' }}>
        {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'projects', icon: '📁', label: 'Projects' }, ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])].map(item => (
          <div key={item.id} onClick={() => { setView(item.id); setSelectedProjectId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: view === item.id || (view === 'project' && item.id === 'projects') ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === item.id || (view === 'project' && item.id === 'projects') ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}><span style={{ fontSize: '14px' }}>{item.icon}</span>{item.label}</div>
        ))}
      </nav>
      <div style={{ padding: '14px', borderTop: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Avatar user={userProfile} size={32} /><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: '11px', fontWeight: '500' }}>{userProfile?.firstName}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div></div></div>
        <button onClick={signOut} style={{ width: '100%', padding: '7px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '10px', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );

  // Dashboard
  const Dashboard = () => {
    const allAssets = projects.flatMap(p => p.assets || []);
    const stats = [
      { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, icon: '📁', color: '#6366f1' },
      { label: 'Total Assets', value: allAssets.length, icon: '🎬', color: '#f97316' },
      { label: 'Pending Selection', value: allAssets.filter(a => a.status === 'pending').length, icon: '⏳', color: '#fbbf24' },
      { label: 'Needs Review', value: allAssets.filter(a => a.status === 'review-ready').length, icon: '👁️', color: '#a855f7' },
    ];
    const recentActivity = projects.flatMap(p => (p.activityLog || []).map(a => ({ ...a, projectName: p.name }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 6);
    
    return (
      <div>
        <div style={{ marginBottom: '20px' }}><h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Welcome, {userProfile?.firstName}</h1><p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {stats.map(s => <div key={s.label} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>{s.icon}</div><div><div style={{ fontSize: '22px', fontWeight: '700', color: s.color }}>{s.value}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div></div></div></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '13px' }}>📁 Recent Projects</h3>
            {projects.slice(0, 4).map(p => <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}><div><div style={{ fontWeight: '500', fontSize: '12px' }}>{p.name}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{p.client}</div></div><Badge status={p.status} /></div>)}
            {projects.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No projects</div>}
          </div>
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '13px' }}>🔔 Recent Activity</h3>
            {recentActivity.map(a => <div key={a.id} style={{ display: 'flex', gap: '8px', padding: '8px', background: '#0d0d14', borderRadius: '6px', marginBottom: '5px' }}><div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366f1', marginTop: '5px', flexShrink: 0 }} /><div><div style={{ fontSize: '11px' }}>{a.message}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{a.projectName} • {formatTimeAgo(a.timestamp)}</div></div></div>)}
            {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No activity</div>}
          </div>
        </div>
      </div>
    );
  };

  // Projects List
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
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input value={search} onChange={setSearch} placeholder="🔍 Search..." style={{ width: '180px' }} />
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ New</Btn>}
          </div>
        </div>
        {projects.length === 0 ? (
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '50px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '14px' }}>📁</div><h3 style={{ marginBottom: '6px', fontSize: '14px' }}>No Projects Yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '16px' }}>Create your first project</p>
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ Create Project</Btn>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {filtered.map(p => {
              const cnt = p.assets?.length || 0;
              const approved = p.assets?.filter(a => ['approved', 'delivered'].includes(a.status)).length || 0;
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project'); }} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}><div><div style={{ fontWeight: '600', fontSize: '14px' }}>{p.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{p.client}</div></div><Badge status={p.status} /></div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}><span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{cnt} assets</span>{p.selectionConfirmed && <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '9px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓ Selection Done</span>}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ flex: 1, background: '#1e1e2e', borderRadius: '3px', height: '4px' }}><div style={{ width: `${cnt ? (approved/cnt)*100 : 0}%`, height: '100%', background: '#6366f1', borderRadius: '3px' }} /></div><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{cnt ? Math.round((approved/cnt)*100) : 0}%</span></div>
                </div>
              );
            })}
          </div>
        )}
        {showCreate && (
          <Modal title="Create Project" onClose={() => setShowCreate(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Name *</label><Input value={newProj.name} onChange={v => setNewProj({ ...newProj, name: v })} placeholder="e.g., RasikaD Photoshoot" /></div>
              <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Client *</label><Input value={newProj.client} onChange={v => setNewProj({ ...newProj, client: v })} placeholder="e.g., Client Name" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Type</label><Select value={newProj.type} onChange={v => setNewProj({ ...newProj, type: v })}><option value="photoshoot">Photoshoot</option><option value="ad-film">Ad Film</option><option value="toolkit">Toolkit</option></Select></div>
                <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Deadline</label><Input type="date" value={newProj.deadline} onChange={v => setNewProj({ ...newProj, deadline: v })} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Categories</label><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{DEFAULT_CATEGORIES.map(cat => <div key={cat.id} onClick={() => setNewProj(p => ({ ...p, selectedCats: p.selectedCats.includes(cat.id) ? p.selectedCats.filter(x => x !== cat.id) : [...p.selectedCats, cat.id] }))} style={{ padding: '6px 10px', background: newProj.selectedCats.includes(cat.id) ? `${cat.color}30` : '#0d0d14', border: `1px solid ${newProj.selectedCats.includes(cat.id) ? cat.color : '#1e1e2e'}`, borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>{cat.icon} {cat.name}</div>)}</div></div>
              <Btn onClick={handleCreate} disabled={!newProj.name || !newProj.client || creating}>{creating ? '⏳...' : '🚀 Create'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Team Management
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
      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
        <Avatar user={u} size={38} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{u.name}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div>
        <RoleBadge role={u.role} />
      </div>
    );

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}><h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Team</h1>{isProducer && <Btn onClick={() => setShowAdd(true)}>+ Add</Btn>}</div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>{[{ id: 'core', label: '👑 Core', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 14px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{t.label} ({t.data.length})</button>)}</div>
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px' }}>
          {tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No core team</div>)}
          {tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No freelancers</div>)}
          {tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No clients</div>)}
        </div>
        {showAdd && (
          <Modal title="Add Team Member" onClose={() => { setShowAdd(false); setError(''); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>{['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '10px', background: newUser.type === type ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>{type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}</button>)}</div>
              <Input value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} placeholder="Name *" />
              <Input value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} placeholder="Email *" type="email" />
              <Input value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="Password *" type="password" />
              {newUser.type !== 'client' && <Select value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</Select>}
              {newUser.type === 'client' && <Input value={newUser.company} onChange={v => setNewUser({ ...newUser, company: v })} placeholder="Company" />}
              {error && <div style={{ padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '11px' }}>{error}</div>}
              <Btn onClick={handleCreate} disabled={creating}>{creating ? '⏳...' : '✓ Add'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Project Detail with Rating, Selection, Appearance
  const ProjectDetail = () => {
    const [tab, setTab] = useState('assets');
    const [selectedCat, setSelectedCat] = useState(null);
    const [showUpload, setShowUpload] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showAppearance, setShowAppearance] = useState(false);
    const [showAddTeam, setShowAddTeam] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [selectedAssets, setSelectedAssets] = useState(new Set());
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [newFeedback, setNewFeedback] = useState('');
    const [newLinkName, setNewLinkName] = useState('');
    const [newLinkType, setNewLinkType] = useState('client');
    const fileInputRef = useRef(null);

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

    // Upload
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
          task.on('state_changed', snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })), 
            () => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              const type = getFileType(file);
              const newAsset = { id: generateId(), name: file.name, type, category: cat, url, path, thumbnail: type === 'image' ? url : null, fileSize: file.size, mimeType: file.type, status: 'pending', rating: 0, isSelected: false, assignedTo: null, uploadedBy: userProfile.id, uploadedByName: userProfile.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url, uploadedAt: new Date().toISOString() }], currentVersion: 1, feedback: [], gdriveLink: '' };
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

    // Rating
    const handleRate = async (assetId, rating) => {
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, rating } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
    };

    // Selection Toggle
    const handleToggleSelect = async (assetId) => {
      const asset = (selectedProject.assets || []).find(a => a.id === assetId);
      const newSelected = !asset?.isSelected;
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
    };

    // Bulk Selection
    const handleBulkSelect = async (select) => {
      const updated = (selectedProject.assets || []).map(a => selectedAssets.has(a.id) ? { ...a, isSelected: select, status: select ? 'selected' : 'pending' } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
      setSelectedAssets(new Set());
      showToast(`${selectedAssets.size} assets ${select ? 'selected' : 'deselected'}`, 'success');
    };

    // Confirm Selection
    const handleConfirmSelection = async () => {
      const activity = { id: generateId(), type: 'selection', message: `Selection confirmed by ${userProfile.name}`, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { selectionConfirmed: true, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      showToast('Selection confirmed! 🎉', 'success');
    };

    // Status Change
    const handleUpdateStatus = async (assetId, status) => {
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, status } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
      if (selectedAsset) setSelectedAsset({ ...selectedAsset, status });
    };

    // Assign Editor
    const handleAssign = async (assetId, editorId) => {
      const editor = editors.find(e => e.id === editorId);
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, assignedTo: editorId, assignedToName: editor?.name, status: editorId ? 'assigned' : a.status } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
    };

    // GDrive Link
    const handleSetGdriveLink = async (assetId, link) => {
      const updated = (selectedProject.assets || []).map(a => a.id === assetId ? { ...a, gdriveLink: link, status: link ? 'delivered' : a.status } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
      if (selectedAsset) setSelectedAsset({ ...selectedAsset, gdriveLink: link, status: link ? 'delivered' : selectedAsset.status });
      showToast('Link saved', 'success');
    };

    // Feedback
    const handleAddFeedback = async () => {
      if (!newFeedback.trim() || !selectedAsset) return;
      const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString() };
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
      setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' });
      setNewFeedback('');
    };

    // Share Links
    const handleCreateLink = async () => {
      if (!newLinkName) { showToast('Enter name', 'error'); return; }
      await createShareLink(selectedProject.id, { name: newLinkName, type: newLinkType, createdBy: userProfile.id });
      await refreshProject();
      setNewLinkName('');
      showToast('Link created!', 'success');
    };

    const copyLink = token => { navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); showToast('Copied!', 'success'); };

    // Add Team
    const handleAddTeam = async uid => {
      const u = users.find(x => x.id === uid);
      if (!u) return;
      const updated = [...(selectedProject.assignedTeam || []), { odId: uid, odRole: u.role }];
      await updateProject(selectedProject.id, { assignedTeam: updated });
      await refreshProject();
      setShowAddTeam(false);
    };

    const selectedCount = assets.filter(a => a.isSelected).length;
    const pendingCount = assets.filter(a => a.status === 'pending').length;

    return (
      <div style={{ display: 'flex', marginLeft: '-200px' }}>
        {/* Category Sidebar */}
        <div style={{ width: '180px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: 'calc(100vh - 46px)', position: 'fixed', left: '200px', top: '46px', overflowY: 'auto', zIndex: 40 }}>
          <div style={{ padding: '10px' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>Categories</div>
            <div onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
              <span>📁 All</span><span style={{ fontSize: '9px', opacity: 0.6 }}>{(selectedProject.assets || []).length}</span>
            </div>
            {cats.map(cat => (
              <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}>
                <span>{cat.icon} {cat.name}</span><span style={{ fontSize: '9px', opacity: 0.6 }}>{getCatCount(cat.id)}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px', borderTop: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>Filters</div>
            {[{ label: '⏳ Pending', f: a => a.status === 'pending' }, { label: '⭐ Selected', f: a => a.isSelected }, { label: '👀 Review', f: a => a.status === 'review-ready' }, { label: '✅ Approved', f: a => a.status === 'approved' }].map((f, i) => (
              <div key={i} style={{ padding: '6px 10px', fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{f.label} ({(selectedProject.assets || []).filter(f.f).length})</div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: '380px' }}>
          {/* Header */}
          <div style={{ height: '46px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '10px', cursor: 'pointer' }}>← Back</button>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span style={{ fontWeight: '600', fontSize: '13px' }}>{selectedProject.name}</span>
              <Badge status={selectedProject.status} />
              {selectedProject.selectionConfirmed && <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '8px', background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>✓ Selection Done</span>}
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {isProducer && <Btn onClick={() => setShowShare(true)} small outline>🔗 Share</Btn>}
              <div style={{ position: 'relative' }}>
                <Btn onClick={() => setShowAppearance(!showAppearance)} small outline>⚙️</Btn>
                {showAppearance && <AppearancePanel settings={appearance} onChange={setAppearance} onClose={() => setShowAppearance(false)} />}
              </div>
              {isProducer && <Btn onClick={() => setShowUpload(true)} small color="#22c55e">⬆️ Upload</Btn>}
            </div>
          </div>

          {/* Tabs & Selection Actions */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['assets', 'team', 'activity', 'links'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 12px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : '1px solid #2a2a3e', borderRadius: '5px', color: '#fff', fontSize: '10px', cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>)}
            </div>
            {tab === 'assets' && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {selectedAssets.size > 0 && (
                  <>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>{selectedAssets.size} selected</span>
                    <Btn onClick={() => handleBulkSelect(true)} small color="#22c55e">✓ Select</Btn>
                    <Btn onClick={() => handleBulkSelect(false)} small outline>✗ Deselect</Btn>
                    <Btn onClick={() => setSelectedAssets(new Set())} small outline>Clear</Btn>
                  </>
                )}
                {!selectedProject.selectionConfirmed && selectedCount > 0 && isProducer && (
                  <Btn onClick={handleConfirmSelection} small color="#f59e0b">🎯 Confirm Selection ({selectedCount})</Btn>
                )}
              </div>
            )}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={{ padding: '10px 16px', background: '#1e1e2e' }}>
              {Object.entries(uploadProgress).map(([id, item]) => (
                <div key={id} style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}><span>{item.name}</span><span>{item.progress}%</span></div>
                  <div style={{ background: '#0d0d14', borderRadius: '2px', height: '3px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '2px' }} /></div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content */}
          <div style={{ padding: '16px' }}>
            {/* Assets Tab */}
            {tab === 'assets' && (
              <div>
                {assets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '50px', background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '14px' }}>No assets</p>
                    {isProducer && <Btn onClick={() => setShowUpload(true)}>⬆️ Upload</Btn>}
                  </div>
                ) : appearance.layout === 'grid' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`, gap: '12px' }}>
                    {assets.map(a => (
                      <div key={a.id} style={{ background: '#16161f', borderRadius: '8px', overflow: 'hidden', border: selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e', position: 'relative' }}>
                        {/* Checkbox */}
                        <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ position: 'absolute', top: '8px', left: '8px', width: '18px', height: '18px', borderRadius: '4px', background: selectedAssets.has(a.id) ? '#6366f1' : 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 5 }}>
                          {selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                        </div>
                        {/* Selection Star */}
                        {a.isSelected && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#22c55e', borderRadius: '4px', padding: '2px 5px', fontSize: '8px', zIndex: 5 }}>⭐ Selected</div>}
                        {/* Thumbnail */}
                        <div onClick={() => setSelectedAsset(a)} style={{ cursor: 'pointer', height: `${cardWidth / aspectRatio}px`, background: '#0d0d14', position: 'relative' }}>
                          {a.type === 'video' ? (
                            <VideoThumbnail src={a.url} duration={a.duration} style={{ width: '100%', height: '100%' }} />
                          ) : a.type === 'audio' ? (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '30px' }}>🔊</span></div>
                          ) : a.thumbnail ? (
                            <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: appearance.thumbScale === 'fill' ? 'cover' : 'contain' }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '30px' }}>📄</span></div>
                          )}
                          {a.feedback?.length > 0 && <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: '#ef4444', borderRadius: '10px', padding: '1px 5px', fontSize: '9px' }}>{a.feedback.length}💬</div>}
                        </div>
                        {/* Info */}
                        {appearance.showInfo && (
                          <div style={{ padding: '8px' }}>
                            <div style={{ fontWeight: '500', fontSize: '10px', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{formatFileSize(a.fileSize)} • v{a.currentVersion}</span>
                              {a.assignedToName && <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>→{a.assignedToName.split(' ')[0]}</span>}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <StarRating rating={a.rating} onChange={r => handleRate(a.id, r)} size={12} />
                              <Badge status={a.status} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  /* List View */
                  <div>
                    {assets.map(a => (
                      <div key={a.id} onClick={() => setSelectedAsset(a)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: '#16161f', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', border: selectedAssets.has(a.id) ? '2px solid #6366f1' : '1px solid #1e1e2e' }}>
                        <div onClick={e => { e.stopPropagation(); setSelectedAssets(s => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; }); }} style={{ width: '18px', height: '18px', borderRadius: '4px', background: selectedAssets.has(a.id) ? '#6366f1' : '#0d0d14', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          {selectedAssets.has(a.id) && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
                        </div>
                        <div style={{ width: '50px', height: '50px', borderRadius: '6px', overflow: 'hidden', background: '#0d0d14', flexShrink: 0 }}>
                          {a.thumbnail ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{a.type === 'video' ? '🎬' : '📄'}</div>}
                        </div>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '11px' }}>{a.name}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{formatFileSize(a.fileSize)}</div></div>
                        <StarRating rating={a.rating} onChange={r => handleRate(a.id, r)} size={14} />
                        <Badge status={a.status} />
                        {a.isSelected && <span style={{ fontSize: '10px' }}>⭐</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Team Tab */}
            {tab === 'team' && (
              <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '12px' }}>👥 Team ({team.length})</h3>
                  {isProducer && availableTeam.length > 0 && <Btn onClick={() => setShowAddTeam(true)} small>+ Add</Btn>}
                </div>
                <div style={{ padding: '12px' }}>
                  {team.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No team</div> :
                    team.map(m => (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                        <Avatar user={m} size={34} />
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '11px' }}>{m.name} {m.isOwner && <span style={{ fontSize: '8px', color: '#f97316' }}>👑</span>}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{m.email}</div></div>
                        <RoleBadge role={m.role} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {tab === 'activity' && (
              <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: '12px' }}>📋 Activity Log</h3>
                {(selectedProject.activityLog || []).length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No activity</div> :
                  (selectedProject.activityLog || []).slice().reverse().map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '8px', padding: '8px', background: '#0d0d14', borderRadius: '6px', marginBottom: '5px' }}>
                      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#6366f1', marginTop: '5px', flexShrink: 0 }} />
                      <div><div style={{ fontSize: '11px' }}>{log.message}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(log.timestamp)}</div></div>
                    </div>
                  ))}
              </div>
            )}

            {/* Links Tab */}
            {tab === 'links' && (
              <div>
                {isProducer && (
                  <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '14px', marginBottom: '16px' }}>
                    <h3 style={{ margin: '0 0 10px', fontSize: '12px' }}>🔗 Create Link</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Input value={newLinkName} onChange={setNewLinkName} placeholder="Link name" style={{ flex: 1 }} />
                      <Select value={newLinkType} onChange={setNewLinkType} style={{ width: '130px' }}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select>
                      <Btn onClick={handleCreateLink}>Create</Btn>
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '8px' }}>Client = View + Rate + Feedback | Editor = View + Upload</div>
                  </div>
                )}
                <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '14px' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '12px' }}>Active Links ({shareLinks.length})</h3>
                  {shareLinks.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>No links</div> :
                    shareLinks.map(link => (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '16px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '11px' }}>{link.name}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{link.type} • {formatTimeAgo(link.createdAt)}</div></div>
                        <Btn onClick={() => copyLink(link.token)} small outline>📋 Copy</Btn>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <Modal title="Upload Assets" onClose={() => { setShowUpload(false); setUploadFiles([]); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '30px', border: '2px dashed #2a2a3e', borderRadius: '10px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>📤</div>
                <p style={{ margin: 0, fontSize: '12px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Click or drag files'}</p>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
              </div>
              {uploadFiles.length > 0 && <div style={{ maxHeight: '120px', overflow: 'auto', background: '#0d0d14', borderRadius: '6px', padding: '8px' }}>{uploadFiles.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0' }}><span>{f.name}</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{formatFileSize(f.size)}</span></div>)}</div>}
              <div><label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Category</label><Select value={selectedCat || cats[0]?.id || ''} onChange={setSelectedCat}>{cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}</Select></div>
              <Btn onClick={handleUpload} disabled={!uploadFiles.length} color="#22c55e">⬆️ Upload {uploadFiles.length} Files</Btn>
            </div>
          </Modal>
        )}

        {/* Share Modal */}
        {showShare && (
          <Modal title="Share Project" onClose={() => setShowShare(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Generate links for clients & editors</p>
              <div style={{ display: 'flex', gap: '8px' }}><Input value={newLinkName} onChange={setNewLinkName} placeholder="Link name" style={{ flex: 1 }} /><Select value={newLinkType} onChange={setNewLinkType} style={{ width: '120px' }}><option value="client">👔 Client</option><option value="editor">🎨 Editor</option></Select><Btn onClick={handleCreateLink}>Create</Btn></div>
              <div style={{ marginTop: '8px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Active Links</div>{shareLinks.map(link => <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#0d0d14', borderRadius: '6px', marginBottom: '4px' }}><span>{link.type === 'client' ? '👔' : '🎨'}</span><span style={{ flex: 1, fontSize: '11px' }}>{link.name}</span><Btn onClick={() => copyLink(link.token)} small outline>Copy</Btn></div>)}</div>
            </div>
          </Modal>
        )}

        {/* Add Team Modal */}
        {showAddTeam && (
          <Modal title="Add Team Member" onClose={() => setShowAddTeam(false)}>
            <div style={{ maxHeight: '350px', overflow: 'auto' }}>
              {availableTeam.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>All added</div> :
                availableTeam.map(u => (
                  <div key={u.id} onClick={() => handleAddTeam(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                    <Avatar user={u} size={36} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '11px' }}>{u.name}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div>
                    <RoleBadge role={u.role} />
                  </div>
                ))}
            </div>
          </Modal>
        )}

        {/* Asset Preview Modal */}
        {selectedAsset && (
          <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)} wide>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
              <div>
                {/* Preview */}
                <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
                  {selectedAsset.type === 'video' ? <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: '380px' }} /> :
                   selectedAsset.type === 'audio' ? <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '50px', marginBottom: '14px' }}>🔊</div><audio src={selectedAsset.url} controls style={{ width: '100%' }} /></div> :
                   selectedAsset.type === 'image' ? <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: '380px', objectFit: 'contain' }} /> :
                   <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '50px' }}>📄</div></div>}
                </div>
                {/* Feedback */}
                <div style={{ background: '#0d0d14', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>💬 Feedback ({selectedAsset.feedback?.length || 0})</div>
                  <div style={{ maxHeight: '120px', overflow: 'auto', marginBottom: '8px' }}>
                    {(selectedAsset.feedback || []).length === 0 ? <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>No feedback</div> :
                      (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{ padding: '6px', background: '#16161f', borderRadius: '5px', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}><span style={{ fontSize: '10px', fontWeight: '500' }}>{fb.userName}</span><span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(fb.timestamp)}</span></div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{fb.text}</div>
                        </div>
                      ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}><Input value={newFeedback} onChange={setNewFeedback} placeholder="Add feedback..." style={{ flex: 1 }} /><Btn onClick={handleAddFeedback} small disabled={!newFeedback.trim()}>Send</Btn></div>
                </div>
              </div>
              <div>
                {/* Rating */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Rating</label>
                  <StarRating rating={selectedAsset.rating} onChange={r => { handleRate(selectedAsset.id, r); setSelectedAsset({ ...selectedAsset, rating: r }); }} size={20} />
                </div>
                {/* Selection Toggle */}
                <div style={{ marginBottom: '12px' }}>
                  <button onClick={() => { handleToggleSelect(selectedAsset.id); setSelectedAsset({ ...selectedAsset, isSelected: !selectedAsset.isSelected, status: !selectedAsset.isSelected ? 'selected' : 'pending' }); }} style={{ width: '100%', padding: '8px', background: selectedAsset.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>
                    {selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}
                  </button>
                </div>
                {/* Status */}
                <div style={{ marginBottom: '12px' }}><label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Status</label><Select value={selectedAsset.status} onChange={v => handleUpdateStatus(selectedAsset.id, v)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
                {/* Assign */}
                {isProducer && (
                  <div style={{ marginBottom: '12px' }}><label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Assign To</label><Select value={selectedAsset.assignedTo || ''} onChange={v => handleAssign(selectedAsset.id, v)}><option value="">-- Unassigned --</option>{editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></div>
                )}
                {/* GDrive Link */}
                {selectedAsset.status === 'approved' && (
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>📁 Google Drive Link</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Input value={selectedAsset.gdriveLink || ''} onChange={v => setSelectedAsset({ ...selectedAsset, gdriveLink: v })} placeholder="Paste GDrive link" style={{ flex: 1 }} />
                      <Btn onClick={() => handleSetGdriveLink(selectedAsset.id, selectedAsset.gdriveLink)} small>Save</Btn>
                    </div>
                  </div>
                )}
                {selectedAsset.gdriveLink && (
                  <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px', background: 'rgba(34,197,94,0.15)', borderRadius: '6px', color: '#22c55e', fontSize: '11px', textAlign: 'center', textDecoration: 'none', marginBottom: '12px' }}>📁 Open High-Res (GDrive)</a>
                )}
                {/* Details */}
                <div style={{ background: '#0d0d14', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>Details</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Version</span><span>v{selectedAsset.currentVersion}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>By</span><span>{selectedAsset.uploadedByName}</span></div>
                </div>
                {/* Download */}
                <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px', background: '#6366f1', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download Preview</a>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Loading
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '36px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⚙️</div><div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Loading...</div><style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style></div></div>;

  // Main Render
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e4e4e7' }}>
      <Sidebar />
      <div style={{ marginLeft: '200px', minHeight: '100vh' }}>
        <div style={{ height: '46px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 16px', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
        <div style={{ padding: '16px' }}>
          {view === 'dashboard' && <Dashboard />}
          {view === 'projects' && <ProjectsList />}
          {view === 'team' && <TeamManagement />}
          {view === 'project' && <ProjectDetail />}
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
