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

// Utilities
const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB'; return (b/1073741824).toFixed(2) + ' GB'; };
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; if (f.type?.startsWith('audio/')) return 'audio'; return 'other'; };

// Components
const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const RoleBadge = ({ role }) => { const r = TEAM_ROLES[role] || CORE_ROLES[role] || { label: role, color: '#6366f1' }; return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>{r.icon || '👤'} {r.label}</span>; };
const Avatar = ({ user, size = 32 }) => { const r = TEAM_ROLES[user?.role] || CORE_ROLES[user?.role]; const c = r?.color || '#6366f1'; return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${c}40, ${c}20)`, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, flexShrink: 0 }}>{user?.avatar || user?.firstName?.[0] || '?'}</div>; };
const Modal = ({ title, onClose, children, wide }) => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}><div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: wide ? '900px' : '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#16161f', zIndex: 10 }}><h3 style={{ margin: 0, fontSize: '15px' }}>{title}</h3><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer' }}>×</button></div><div style={{ padding: '20px' }}>{children}</div></div></div>;
const Toast = ({ message, type, onClose }) => { useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]); return <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 20px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '500', zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>{message}</div>; };
const Btn = ({ children, onClick, color = '#6366f1', disabled, small, outline }) => <button onClick={onClick} disabled={disabled} style={{ padding: small ? '6px 12px' : '10px 18px', background: outline ? 'transparent' : color, border: outline ? `1px solid ${color}` : 'none', borderRadius: '6px', color: outline ? color : '#fff', fontSize: small ? '11px' : '13px', fontWeight: '600', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>{children}</button>;
const Input = ({ value, onChange, placeholder, type = 'text', ...props }) => <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} {...props} />;
const Select = ({ value, onChange, children }) => <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }}>{children}</select>;

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
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);

  useEffect(() => { loadData(); }, []);
  const loadData = async () => { setLoading(true); try { const [p, u, f, c, ct] = await Promise.all([getProjectsForUser(userProfile.id, userProfile.role, userProfile.isClient, userProfile.isFreelancer), getUsers(), getFreelancers(), getClients(), getCoreTeam()]); setProjects(p); setUsers(u); setFreelancers(f); setClients(c); setCoreTeam(ct); } catch (e) { console.error(e); } setLoading(false); };
  const showToast = (msg, type = 'info') => setToast({ message: msg, type });
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const refreshProject = async () => { if (!selectedProjectId) return; const all = await getProjects(); setProjects(all); };

  // Sidebar
  const Sidebar = () => (
    <div style={{ width: '220px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ padding: '20px' }}><div style={{ fontSize: '20px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Production Hub</div></div>
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'projects', icon: '📁', label: 'Projects' }, ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])].map(item => (
          <div key={item.id} onClick={() => { setView(item.id); setSelectedProjectId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: view === item.id || (view === 'project' && item.id === 'projects') ? 'rgba(99,102,241,0.15)' : 'transparent', color: view === item.id || (view === 'project' && item.id === 'projects') ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}><span style={{ fontSize: '15px' }}>{item.icon}</span>{item.label}</div>
        ))}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}><Avatar user={userProfile} size={36} /><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userProfile?.firstName}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{CORE_ROLES[userProfile?.role]?.label || userProfile?.role}</div></div></div>
        <button onClick={signOut} style={{ width: '100%', padding: '8px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', fontSize: '11px', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );

  // Dashboard
  const Dashboard = () => {
    const allAssets = projects.flatMap(p => p.assets || []);
    const needsReview = allAssets.filter(a => a.status === 'review-ready').length;
    const pendingFeedback = allAssets.filter(a => a.status === 'changes-requested').length;
    const stats = [
      { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, icon: '📁', color: '#6366f1' },
      { label: 'Total Assets', value: allAssets.length, icon: '🎬', color: '#f97316' },
      { label: 'Needs Review', value: needsReview, icon: '👁️', color: '#a855f7' },
      { label: 'Pending Changes', value: pendingFeedback, icon: '🔄', color: '#ef4444' },
    ];
    const recentActivity = projects.flatMap(p => (p.activityLog || []).map(a => ({ ...a, projectName: p.name, projectId: p.id }))).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
    
    return (
      <div>
        <div style={{ marginBottom: '24px' }}><h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Welcome, {userProfile?.firstName}</h1><p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {stats.map(s => <div key={s.label} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '44px', height: '44px', borderRadius: '10px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>{s.icon}</div><div><div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.value}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div></div></div></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}>📁 Recent Projects</h3>
            {projects.slice(0, 5).map(p => <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}><div><div style={{ fontWeight: '500', fontSize: '13px' }}>{p.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{p.client}</div></div><Badge status={p.status} /></div>)}
            {projects.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No projects</div>}
          </div>
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '14px' }}>🔔 Recent Activity</h3>
            {recentActivity.map(a => <div key={a.id} style={{ display: 'flex', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} /><div style={{ flex: 1 }}><div style={{ fontSize: '12px' }}>{a.message}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{a.projectName} • {formatTimeAgo(a.timestamp)}</div></div></div>)}
            {recentActivity.length === 0 && <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No activity</div>}
          </div>
        </div>
      </div>
    );
  };

  // Projects List
  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newProj, setNewProj] = useState({ name: '', client: '', type: 'ad-film', deadline: '', selectedCats: ['statics', 'videos'] });
    const [creating, setCreating] = useState(false);
    const filtered = projects.filter(p => !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
      if (!newProj.name || !newProj.client) { showToast('Fill name & client', 'error'); return; }
      setCreating(true);
      try {
        const cats = DEFAULT_CATEGORIES.filter(c => newProj.selectedCats.includes(c.id));
        const proj = await createProject({ name: newProj.name, client: newProj.client, type: newProj.type, deadline: newProj.deadline, status: 'active', categories: cats, assets: [], assignedTeam: [{ odId: userProfile.id, odRole: userProfile.role, isOwner: true }], clientContacts: [], shareLinks: [], activityLog: [{ id: generateId(), type: 'created', message: `Project created by ${userProfile.name}`, userId: userProfile.id, timestamp: new Date().toISOString() }], createdBy: userProfile.id, createdByName: userProfile.name });
        setProjects([proj, ...projects]);
        setNewProj({ name: '', client: '', type: 'ad-film', deadline: '', selectedCats: ['statics', 'videos'] });
        setShowCreate(false);
        showToast('Project created!', 'success');
      } catch (e) { showToast('Failed to create', 'error'); }
      setCreating(false);
    };

    const toggleCat = id => setNewProj(p => ({ ...p, selectedCats: p.selectedCats.includes(id) ? p.selectedCats.filter(x => x !== id) : [...p.selectedCats, id] }));

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Input value={search} onChange={setSearch} placeholder="🔍 Search..." style={{ width: '200px' }} />
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ New Project</Btn>}
          </div>
        </div>
        {projects.length === 0 ? (
          <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>📁</div>
            <h3 style={{ marginBottom: '8px' }}>No Projects Yet</h3>
            <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Create your first project to get started</p>
            {isProducer && <Btn onClick={() => setShowCreate(true)}>+ Create Project</Btn>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filtered.map(p => {
              const assetCount = p.assets?.length || 0;
              const approved = p.assets?.filter(a => ['approved', 'completed'].includes(a.status)).length || 0;
              const prog = assetCount ? Math.round((approved / assetCount) * 100) : 0;
              return (
                <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project'); }} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div><div style={{ fontWeight: '600', fontSize: '15px' }}>{p.name}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{p.client}</div></div>
                    <Badge status={p.status} />
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{assetCount} assets</span>
                    {p.deadline && <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Due {formatDate(p.deadline)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, background: '#1e1e2e', borderRadius: '3px', height: '4px' }}><div style={{ width: `${prog}%`, height: '100%', background: prog === 100 ? '#22c55e' : '#6366f1', borderRadius: '3px' }} /></div>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{prog}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {showCreate && (
          <Modal title="Create New Project" onClose={() => setShowCreate(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Project Name *</label><Input value={newProj.name} onChange={v => setNewProj({ ...newProj, name: v })} placeholder="e.g., Lays Summer Campaign" /></div>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Client *</label><Input value={newProj.client} onChange={v => setNewProj({ ...newProj, client: v })} placeholder="e.g., PepsiCo" /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Type</label><Select value={newProj.type} onChange={v => setNewProj({ ...newProj, type: v })}><option value="ad-film">Ad Film</option><option value="photoshoot">Photoshoot</option><option value="toolkit">Toolkit</option><option value="social">Social Content</option></Select></div>
                <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Deadline</label><Input type="date" value={newProj.deadline} onChange={v => setNewProj({ ...newProj, deadline: v })} /></div>
              </div>
              <div><label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Categories</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>{DEFAULT_CATEGORIES.map(cat => <div key={cat.id} onClick={() => toggleCat(cat.id)} style={{ padding: '10px', background: newProj.selectedCats.includes(cat.id) ? `${cat.color}20` : '#0d0d14', border: `2px solid ${newProj.selectedCats.includes(cat.id) ? cat.color : '#1e1e2e'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '18px', marginBottom: '4px' }}>{cat.icon}</div><div style={{ fontSize: '10px', color: newProj.selectedCats.includes(cat.id) ? cat.color : 'rgba(255,255,255,0.5)' }}>{cat.name}</div></div>)}</div></div>
              <Btn onClick={handleCreate} disabled={!newProj.name || !newProj.client || creating}>{creating ? '⏳ Creating...' : '🚀 Create Project'}</Btn>
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
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '', designation: '' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
      if (!newUser.name || !newUser.email || !newUser.password) { setError('Fill required fields'); return; }
      if (newUser.password.length < 6) { setError('Password min 6 chars'); return; }
      setCreating(true); setError('');
      try {
        const cred = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
        await updateProfile(cred.user, { displayName: newUser.name });
        await createUser(cred.user.uid, { email: newUser.email, name: newUser.name, firstName: newUser.name.split(' ')[0], role: newUser.type === 'client' ? 'client' : newUser.role, phone: newUser.phone, avatar: newUser.type === 'client' ? '👔' : (TEAM_ROLES[newUser.role]?.icon || '👤'), isCore: newUser.type === 'core', isFreelancer: newUser.type === 'freelancer', isClient: newUser.type === 'client', company: newUser.company, designation: newUser.designation, createdBy: userProfile.id });
        await loadData();
        setNewUser({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '', designation: '' });
        setShowAdd(false);
        showToast('Member added!', 'success');
      } catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'Email already exists' : e.message); }
      setCreating(false);
    };

    const handleDelete = async id => { if (!confirm('Remove this member?')) return; try { await deleteUser(id); await loadData(); showToast('Removed', 'success'); } catch (e) { showToast('Failed', 'error'); } };
    const renderUser = u => (
      <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
        <Avatar user={u} size={42} />
        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{u.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}{u.company ? ` • ${u.company}` : ''}</div></div>
        <RoleBadge role={u.role} />
        {isProducer && u.id !== userProfile.id && <button onClick={() => handleDelete(u.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '16px', cursor: 'pointer' }}>×</button>}
      </div>
    );

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700' }}>Team</h1>
          {isProducer && <Btn onClick={() => setShowAdd(true)}>+ Add Member</Btn>}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {[{ id: 'core', label: '👑 Core Team', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{t.label} ({t.data.length})</button>
          ))}
        </div>
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}>
          {tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No core team members</div>)}
          {tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No freelancers</div>)}
          {tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No clients</div>)}
        </div>
        {showAdd && (
          <Modal title="Add Team Member" onClose={() => { setShowAdd(false); setError(''); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '12px', background: newUser.type === type ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>{type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}</button>)}
              </div>
              <Input value={newUser.name} onChange={v => setNewUser({ ...newUser, name: v })} placeholder="Full Name *" />
              <Input value={newUser.email} onChange={v => setNewUser({ ...newUser, email: v })} placeholder="Email *" type="email" />
              <Input value={newUser.password} onChange={v => setNewUser({ ...newUser, password: v })} placeholder="Password * (min 6 chars)" type="password" />
              <Input value={newUser.phone} onChange={v => setNewUser({ ...newUser, phone: v })} placeholder="Phone (optional)" />
              {newUser.type !== 'client' && <Select value={newUser.role} onChange={v => setNewUser({ ...newUser, role: v })}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</Select>}
              {newUser.type === 'client' && <><Input value={newUser.company} onChange={v => setNewUser({ ...newUser, company: v })} placeholder="Company" /><Input value={newUser.designation} onChange={v => setNewUser({ ...newUser, designation: v })} placeholder="Designation" /></>}
              {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
              <Btn onClick={handleCreate} disabled={creating}>{creating ? '⏳ Adding...' : '✓ Add Member'}</Btn>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Project Detail - Full Workflow
  const ProjectDetail = () => {
    const [tab, setTab] = useState('assets');
    const [selectedCat, setSelectedCat] = useState(null);
    const [showUpload, setShowUpload] = useState(false);
    const [showShare, setShowShare] = useState(false);
    const [showAddTeam, setShowAddTeam] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [showAddCat, setShowAddCat] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadAssignee, setUploadAssignee] = useState('');
    const [newCat, setNewCat] = useState({ name: '', icon: '📁', color: '#6366f1' });
    const [newFeedback, setNewFeedback] = useState('');
    const [newLinkType, setNewLinkType] = useState('client');
    const [newLinkName, setNewLinkName] = useState('');
    const fileInputRef = useRef(null);

    if (!selectedProject) return null;
    const cats = selectedProject.categories || [];
    const team = (selectedProject.assignedTeam || []).map(t => ({ ...users.find(u => u.id === t.odId), isOwner: t.isOwner, assignedRole: t.odRole })).filter(m => m?.id);
    const projClients = (selectedProject.clientContacts || []).map(c => ({ ...users.find(u => u.id === c.odId), isPrimary: c.isPrimary })).filter(c => c?.id);
    const shareLinks = (selectedProject.shareLinks || []).filter(l => l.active);
    const availableTeam = [...coreTeam, ...freelancers].filter(u => !team.find(m => m.id === u.id));
    const availableClients = clients.filter(c => !projClients.find(x => x.id === c.id));
    const editors = [...team.filter(t => Object.keys(TEAM_ROLES).includes(t.role)), ...freelancers];

    const getAssets = () => { let a = (selectedProject.assets || []).filter(x => !x.deleted); if (selectedCat) a = a.filter(x => x.category === selectedCat); return a; };
    const assets = getAssets();
    const getCatCount = id => (selectedProject.assets || []).filter(a => !a.deleted && a.category === id).length;

    // Upload Handler
    const handleUpload = async () => {
      if (!uploadFiles.length) return;
      const cat = selectedCat || cats[0]?.id;
      if (!cat) { showToast('Select a category first', 'error'); return; }
      setShowUpload(false);
      
      for (const file of uploadFiles) {
        const uid = generateId();
        setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0 } }));
        try {
          const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
          const sRef = ref(storage, path);
          const task = uploadBytesResumable(sRef, file);
          
          task.on('state_changed', 
            snap => { setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })); },
            err => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); },
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              const assetId = generateId();
              const newAsset = {
                id: assetId, name: file.name, type: getFileType(file), category: cat, url, path,
                thumbnail: getFileType(file) === 'image' ? url : null,
                fileSize: file.size, mimeType: file.type,
                status: uploadAssignee ? 'assigned' : 'pending',
                assignedTo: uploadAssignee || null,
                assignedToName: uploadAssignee ? editors.find(e => e.id === uploadAssignee)?.name : null,
                uploadedBy: userProfile.id, uploadedByName: userProfile.name,
                uploadedAt: new Date().toISOString(),
                versions: [{ version: 1, url, uploadedAt: new Date().toISOString(), uploadedBy: userProfile.id }],
                currentVersion: 1,
                feedback: [],
                deadline: null,
              };
              const updatedAssets = [...(selectedProject.assets || []), newAsset];
              const activity = { id: generateId(), type: 'upload', message: `${userProfile.name} uploaded ${file.name}`, userId: userProfile.id, timestamp: new Date().toISOString() };
              await updateProject(selectedProject.id, { assets: updatedAssets, activityLog: [...(selectedProject.activityLog || []), activity] });
              await refreshProject();
              setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
              showToast(`Uploaded: ${file.name}`, 'success');
            }
          );
        } catch (e) { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); }
      }
      setUploadFiles([]);
      setUploadAssignee('');
    };

    // Team Handlers
    const handleAddTeam = async uid => {
      const u = users.find(x => x.id === uid);
      if (!u) return;
      const updated = [...(selectedProject.assignedTeam || []), { odId: uid, odRole: u.role }];
      const activity = { id: generateId(), type: 'team', message: `${u.name} added to project`, userId: userProfile.id, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assignedTeam: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      setShowAddTeam(false);
      showToast('Team member added', 'success');
    };

    const handleRemoveTeam = async uid => {
      const updated = (selectedProject.assignedTeam || []).filter(t => t.odId !== uid);
      await updateProject(selectedProject.id, { assignedTeam: updated });
      await refreshProject();
      showToast('Removed', 'success');
    };

    const handleAddClientContact = async cid => {
      const updated = [...(selectedProject.clientContacts || []), { odId: cid, isPrimary: projClients.length === 0 }];
      await updateProject(selectedProject.id, { clientContacts: updated });
      await refreshProject();
      setShowAddClient(false);
      showToast('Client added', 'success');
    };

    // Category Handlers
    const handleAddCat = async () => {
      if (!newCat.name) return;
      const cat = { id: `c-${generateId()}`, name: newCat.name, icon: newCat.icon, color: newCat.color, isCustom: true };
      await updateProject(selectedProject.id, { categories: [...cats, cat] });
      await refreshProject();
      setNewCat({ name: '', icon: '📁', color: '#6366f1' });
      setShowAddCat(false);
      showToast('Category added', 'success');
    };

    const handleDelCat = async id => {
      if (getCatCount(id) > 0) { showToast('Move assets first', 'error'); return; }
      await updateProject(selectedProject.id, { categories: cats.filter(c => c.id !== id) });
      await refreshProject();
      setSelectedCat(null);
      showToast('Deleted', 'success');
    };

    // Asset Handlers
    const handleUpdateStatus = async (aid, status) => {
      const updated = (selectedProject.assets || []).map(a => a.id === aid ? { ...a, status, updatedAt: new Date().toISOString() } : a);
      const activity = { id: generateId(), type: 'status', message: `Asset status changed to ${STATUS[status]?.label}`, userId: userProfile.id, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      if (selectedAsset) setSelectedAsset({ ...selectedAsset, status });
      showToast('Status updated', 'success');
    };

    const handleAssignAsset = async (aid, assigneeId) => {
      const assignee = editors.find(e => e.id === assigneeId);
      const updated = (selectedProject.assets || []).map(a => a.id === aid ? { ...a, assignedTo: assigneeId, assignedToName: assignee?.name, status: assigneeId ? 'assigned' : 'pending' } : a);
      const activity = { id: generateId(), type: 'assign', message: `Asset assigned to ${assignee?.name || 'Unassigned'}`, userId: userProfile.id, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      showToast(assigneeId ? 'Assigned' : 'Unassigned', 'success');
    };

    const handleDeleteAsset = async aid => {
      if (!confirm('Delete this asset?')) return;
      const updated = (selectedProject.assets || []).filter(a => a.id !== aid);
      await updateProject(selectedProject.id, { assets: updated });
      await refreshProject();
      setSelectedAsset(null);
      showToast('Deleted', 'success');
    };

    const handleAddFeedback = async () => {
      if (!newFeedback.trim() || !selectedAsset) return;
      const fb = { id: generateId(), text: newFeedback, userId: userProfile.id, userName: userProfile.name, timestamp: new Date().toISOString() };
      const updated = (selectedProject.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a);
      const activity = { id: generateId(), type: 'feedback', message: `Feedback added on ${selectedAsset.name}`, userId: userProfile.id, timestamp: new Date().toISOString() };
      await updateProject(selectedProject.id, { assets: updated, activityLog: [...(selectedProject.activityLog || []), activity] });
      await refreshProject();
      setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' });
      setNewFeedback('');
      showToast('Feedback added', 'success');
    };

    // Share Link Handlers
    const handleCreateShareLink = async () => {
      if (!newLinkName) { showToast('Enter link name', 'error'); return; }
      const link = await createShareLink(selectedProject.id, { name: newLinkName, type: newLinkType, permissions: newLinkType === 'client' ? ['view', 'feedback'] : ['view', 'upload'], createdBy: userProfile.id });
      await refreshProject();
      setNewLinkName('');
      showToast('Link created!', 'success');
    };

    const handleDeactivateLink = async linkId => {
      await deactivateShareLink(selectedProject.id, linkId);
      await refreshProject();
      showToast('Link deactivated', 'success');
    };

    const copyLink = token => {
      navigator.clipboard.writeText(`${window.location.origin}/share/${token}`);
      showToast('Link copied!', 'success');
    };

    const icons = ['📁', '🎬', '🖼️', '🎭', '✨', '🔊', '📊', '🌐', '🎨', '📸'];
    const colors = ['#3b82f6', '#a855f7', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#6366f1', '#ef4444'];

    return (
      <div style={{ display: 'flex', marginLeft: '-220px' }}>
        {/* Category Sidebar */}
        <div style={{ width: '200px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: 'calc(100vh - 50px)', position: 'fixed', left: '220px', top: '50px', overflowY: 'auto', zIndex: 40 }}>
          <div style={{ padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase' }}>Categories</span>
              {isProducer && <button onClick={() => setShowAddCat(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '14px', cursor: 'pointer' }}>+</button>}
            </div>
            <div onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)' }}>
              📁 All <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>{(selectedProject.assets || []).length}</span>
            </div>
            {cats.map(cat => (
              <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                {cat.icon} {cat.name} <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>{getCatCount(cat.id)}</span>
                {isProducer && cat.isCustom && <button onClick={e => { e.stopPropagation(); handleDelCat(cat.id); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: '12px', cursor: 'pointer' }}>×</button>}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px', borderTop: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Quick Filters</div>
            {[{ id: 'review', label: '👀 Needs Review', filter: a => a.status === 'review-ready' }, { id: 'changes', label: '🔄 Changes Requested', filter: a => a.status === 'changes-requested' }, { id: 'approved', label: '✅ Approved', filter: a => a.status === 'approved' }].map(f => (
              <div key={f.id} style={{ padding: '8px 12px', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{f.label} ({(selectedProject.assets || []).filter(f.filter).length})</div>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: '420px' }}>
          {/* Header */}
          <div style={{ height: '50px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '11px', cursor: 'pointer' }}>← Back</button>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
              <span style={{ fontWeight: '600', fontSize: '14px' }}>{selectedProject.name}</span>
              <Badge status={selectedProject.status} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {isProducer && <Btn onClick={() => setShowShare(true)} small outline>🔗 Share</Btn>}
              {isProducer && <Btn onClick={() => setShowUpload(true)} small color="#22c55e">⬆️ Upload</Btn>}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', gap: '6px' }}>
            {['assets', 'team', 'activity', 'links'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : 'transparent', border: tab === t ? 'none' : '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize' }}>{t === 'links' ? '🔗 Share Links' : t}</button>)}
          </div>

          {/* Upload Progress */}
          {Object.keys(uploadProgress).length > 0 && (
            <div style={{ padding: '12px 20px', background: '#1e1e2e' }}>
              {Object.entries(uploadProgress).map(([id, item]) => (
                <div key={id} style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}><span>{item.name}</span><span>{item.progress}%</span></div>
                  <div style={{ background: '#0d0d14', borderRadius: '2px', height: '3px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '2px', transition: 'width 0.2s' }} /></div>
                </div>
              ))}
            </div>
          )}

          {/* Tab Content */}
          <div style={{ padding: '20px' }}>
            {/* Assets Tab */}
            {tab === 'assets' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{selectedCat ? cats.find(c => c.id === selectedCat)?.name : 'All Assets'} ({assets.length})</div>
                </div>
                {assets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px', background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                    <div style={{ fontSize: '50px', marginBottom: '16px' }}>📂</div>
                    <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>No assets in this category</p>
                    {isProducer && <Btn onClick={() => setShowUpload(true)}>⬆️ Upload Assets</Btn>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                    {assets.map(a => (
                      <div key={a.id} onClick={() => setSelectedAsset(a)} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #1e1e2e' }}>
                        <div style={{ position: 'relative', paddingTop: '70%', background: '#0d0d14' }}>
                          {a.type === 'video' ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🎬</span></div> :
                           a.type === 'audio' ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>🔊</span></div> :
                           a.thumbnail ? <img src={a.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> :
                           <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '36px' }}>📄</span></div>}
                          {a.feedback?.length > 0 && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#ef4444', borderRadius: '10px', padding: '2px 6px', fontSize: '10px' }}>{a.feedback.length} 💬</div>}
                        </div>
                        <div style={{ padding: '10px' }}>
                          <div style={{ fontWeight: '500', fontSize: '12px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{formatFileSize(a.fileSize)} • v{a.currentVersion}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Badge status={a.status} />
                            {a.assignedToName && <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>→ {a.assignedToName.split(' ')[0]}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Team Tab */}
            {tab === 'team' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '13px' }}>👥 Team ({team.length})</h3>
                    {isProducer && availableTeam.length > 0 && <Btn onClick={() => setShowAddTeam(true)} small>+ Add</Btn>}
                  </div>
                  <div style={{ padding: '14px' }}>
                    {team.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No team members</div> :
                      team.map(m => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                          <Avatar user={m} size={36} />
                          <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{m.name} {m.isOwner && <span style={{ fontSize: '9px', color: '#f97316' }}>👑</span>}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{TEAM_ROLES[m.role]?.label || CORE_ROLES[m.role]?.label}</div></div>
                          {isProducer && !m.isOwner && <button onClick={() => handleRemoveTeam(m.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', cursor: 'pointer' }}>×</button>}
                        </div>
                      ))}
                  </div>
                </div>
                <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '13px' }}>👔 Clients ({projClients.length})</h3>
                    {isProducer && availableClients.length > 0 && <Btn onClick={() => setShowAddClient(true)} small>+ Add</Btn>}
                  </div>
                  <div style={{ padding: '14px' }}>
                    {projClients.length === 0 ? <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No clients linked</div> :
                      projClients.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                          <Avatar user={c} size={36} />
                          <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{c.name} {c.isPrimary && <span style={{ fontSize: '9px', color: '#22c55e' }}>Primary</span>}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{c.company}</div></div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {tab === 'activity' && (
              <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '13px' }}>📋 Activity Log</h3>
                {(selectedProject.activityLog || []).length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No activity</div> :
                  (selectedProject.activityLog || []).slice().reverse().map(log => (
                    <div key={log.id} style={{ display: 'flex', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#6366f1', marginTop: '5px', flexShrink: 0 }} />
                      <div><div style={{ fontSize: '12px' }}>{log.message}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{formatTimeAgo(log.timestamp)}</div></div>
                    </div>
                  ))}
              </div>
            )}

            {/* Share Links Tab */}
            {tab === 'links' && (
              <div>
                {isProducer && (
                  <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px', marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '13px' }}>🔗 Create Share Link</h3>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <Input value={newLinkName} onChange={setNewLinkName} placeholder="Link name (e.g., Client Review)" style={{ flex: 1, minWidth: '200px' }} />
                      <Select value={newLinkType} onChange={setNewLinkType} style={{ width: '150px' }}>
                        <option value="client">👔 Client (View + Feedback)</option>
                        <option value="editor">🎨 Editor (View + Upload)</option>
                      </Select>
                      <Btn onClick={handleCreateShareLink}>Create Link</Btn>
                    </div>
                  </div>
                )}
                <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '18px' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '13px' }}>Active Links ({shareLinks.length})</h3>
                  {shareLinks.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No active links</div> :
                    shareLinks.map(link => (
                      <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: link.type === 'client' ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{link.type === 'client' ? '👔' : '🎨'}</div>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '12px' }}>{link.name}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{link.type === 'client' ? 'Client' : 'Editor'} • {formatTimeAgo(link.createdAt)}</div></div>
                        <Btn onClick={() => copyLink(link.token)} small outline>📋 Copy</Btn>
                        {isProducer && <button onClick={() => handleDeactivateLink(link.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer' }}>×</button>}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Modal */}
        {showUpload && (
          <Modal title="Upload Assets" onClose={() => { setShowUpload(false); setUploadFiles([]); setUploadAssignee(''); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ textAlign: 'center', padding: '30px', border: '2px dashed #2a2a3e', borderRadius: '10px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📤</div>
                <p style={{ margin: 0, fontSize: '13px' }}>{uploadFiles.length ? `${uploadFiles.length} file(s) selected` : 'Click to select or drag files'}</p>
                <p style={{ margin: '8px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Images, Videos, Audio supported</p>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
              </div>
              {uploadFiles.length > 0 && (
                <div style={{ maxHeight: '150px', overflow: 'auto', background: '#0d0d14', borderRadius: '8px', padding: '10px' }}>
                  {uploadFiles.map((f, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '4px 0' }}><span>{f.name}</span><span style={{ color: 'rgba(255,255,255,0.4)' }}>{formatFileSize(f.size)}</span></div>)}
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Upload to Category</label>
                <Select value={selectedCat || cats[0]?.id || ''} onChange={v => setSelectedCat(v)}>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </Select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Assign to Editor (Optional)</label>
                <Select value={uploadAssignee} onChange={setUploadAssignee}>
                  <option value="">-- Unassigned --</option>
                  {editors.map(e => <option key={e.id} value={e.id}>{e.name} ({TEAM_ROLES[e.role]?.label || e.role})</option>)}
                </Select>
              </div>
              <Btn onClick={handleUpload} disabled={!uploadFiles.length} color="#22c55e">⬆️ Upload {uploadFiles.length} File{uploadFiles.length !== 1 ? 's' : ''}</Btn>
            </div>
          </Modal>
        )}

        {/* Add Team Modal */}
        {showAddTeam && (
          <Modal title="Add Team Member" onClose={() => setShowAddTeam(false)}>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {availableTeam.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>All team members added</div> :
                availableTeam.map(u => (
                  <div key={u.id} onClick={() => handleAddTeam(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                    <Avatar user={u} size={40} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{u.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div>
                    <RoleBadge role={u.role} />
                  </div>
                ))}
            </div>
          </Modal>
        )}

        {/* Add Client Modal */}
        {showAddClient && (
          <Modal title="Add Client Contact" onClose={() => setShowAddClient(false)}>
            <div style={{ maxHeight: '400px', overflow: 'auto' }}>
              {availableClients.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No clients available. Add clients in Team first.</div> :
                availableClients.map(c => (
                  <div key={c.id} onClick={() => handleAddClientContact(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}>
                    <Avatar user={c} size={40} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{c.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{c.designation} • {c.company}</div></div>
                  </div>
                ))}
            </div>
          </Modal>
        )}

        {/* Add Category Modal */}
        {showAddCat && (
          <Modal title="Add Category" onClose={() => setShowAddCat(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <Input value={newCat.name} onChange={v => setNewCat({ ...newCat, name: v })} placeholder="Category name" />
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Icon</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{icons.map(i => <button key={i} onClick={() => setNewCat({ ...newCat, icon: i })} style={{ width: '36px', height: '36px', background: newCat.icon === i ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>{i}</button>)}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>Color</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{colors.map(c => <button key={c} onClick={() => setNewCat({ ...newCat, color: c })} style={{ width: '28px', height: '28px', background: c, border: newCat.color === c ? '3px solid #fff' : 'none', borderRadius: '6px', cursor: 'pointer' }} />)}</div>
              </div>
              <Btn onClick={handleAddCat} disabled={!newCat.name}>Add Category</Btn>
            </div>
          </Modal>
        )}

        {/* Share Panel Modal */}
        {showShare && (
          <Modal title="Share Project" onClose={() => setShowShare(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Generate shareable links for clients and editors to view/upload assets.</p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Input value={newLinkName} onChange={setNewLinkName} placeholder="Link name" style={{ flex: 1 }} />
                <Select value={newLinkType} onChange={setNewLinkType} style={{ width: '140px' }}>
                  <option value="client">👔 Client</option>
                  <option value="editor">🎨 Editor</option>
                </Select>
                <Btn onClick={handleCreateShareLink}>Create</Btn>
              </div>
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Active Links</div>
                {shareLinks.length === 0 ? <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>No active links</div> :
                  shareLinks.map(link => (
                    <div key={link.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: '#0d0d14', borderRadius: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{link.type === 'client' ? '👔' : '🎨'}</span>
                      <div style={{ flex: 1, fontSize: '12px' }}>{link.name}</div>
                      <Btn onClick={() => copyLink(link.token)} small outline>Copy</Btn>
                    </div>
                  ))}
              </div>
            </div>
          </Modal>
        )}

        {/* Asset Preview Modal with Feedback */}
        {selectedAsset && (
          <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)} wide>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
              <div>
                <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
                  {selectedAsset.type === 'video' ? <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: '400px' }} /> :
                   selectedAsset.type === 'audio' ? <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '60px', marginBottom: '16px' }}>🔊</div><audio src={selectedAsset.url} controls style={{ width: '100%' }} /></div> :
                   selectedAsset.type === 'image' ? <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain' }} /> :
                   <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '60px', marginBottom: '16px' }}>📄</div><a href={selectedAsset.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>Open File</a></div>}
                </div>
                {/* Feedback Section */}
                <div style={{ background: '#0d0d14', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px' }}>💬 Feedback ({selectedAsset.feedback?.length || 0})</div>
                  <div style={{ maxHeight: '150px', overflow: 'auto', marginBottom: '10px' }}>
                    {(selectedAsset.feedback || []).length === 0 ? <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>No feedback yet</div> :
                      (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{ padding: '8px', background: '#16161f', borderRadius: '6px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '11px', fontWeight: '500' }}>{fb.userName}</span><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(fb.timestamp)}</span></div>
                          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{fb.text}</div>
                        </div>
                      ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Input value={newFeedback} onChange={setNewFeedback} placeholder="Add feedback..." style={{ flex: 1 }} />
                    <Btn onClick={handleAddFeedback} small disabled={!newFeedback.trim()}>Send</Btn>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Status</label>
                  <Select value={selectedAsset.status} onChange={v => handleUpdateStatus(selectedAsset.id, v)}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </Select>
                </div>
                {isProducer && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Assigned To</label>
                    <Select value={selectedAsset.assignedTo || ''} onChange={v => handleAssignAsset(selectedAsset.id, v)}>
                      <option value="">-- Unassigned --</option>
                      {editors.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </Select>
                  </div>
                )}
                <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Details</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Type</span><span>{selectedAsset.mimeType}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Version</span><span>v{selectedAsset.currentVersion}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>By</span><span>{selectedAsset.uploadedByName || 'Unknown'}</span></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#22c55e', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download</a>
                  {isProducer && <button onClick={() => handleDeleteAsset(selectedAsset.id)} style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>🗑️</button>}
                </div>
              </div>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // Loading State
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>⚙️</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Loading...</div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  // Main Render
  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e4e4e7' }}>
      <Sidebar />
      <div style={{ marginLeft: '220px', minHeight: '100vh' }}>
        <div style={{ height: '50px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 20px', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
        <div style={{ padding: '20px' }}>
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
