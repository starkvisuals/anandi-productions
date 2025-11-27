'use client';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProjects, getProjectsForUser, createProject, updateProject, getUsers, getFreelancers, getClients, getCoreTeam, createUser, updateUser, deleteUser, TEAM_ROLES, CORE_ROLES, STATUS, generateId } from '@/lib/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const DEFAULT_CATEGORIES = [
  { id: 'cgi', name: 'CGI', icon: '🌐', color: '#3b82f6' },
  { id: 'animation', name: 'Animated Film', icon: '🎭', color: '#a855f7' },
  { id: 'statics', name: 'Statics', icon: '🖼️', color: '#ec4899' },
  { id: 'videos', name: 'Videos', icon: '🎬', color: '#f97316' },
  { id: 'vfx', name: 'VFX', icon: '✨', color: '#10b981' },
  { id: 'audio', name: 'Audio', icon: '🔊', color: '#06b6d4' },
];

const COLLECTIONS = [
  { id: 'all', name: 'All Assets', icon: '📋' },
  { id: 'videos', name: 'Videos', icon: '🎬', filter: a => a.type === 'video' },
  { id: 'images', name: 'Images', icon: '🖼️', filter: a => a.type === 'image' },
  { id: 'needs-review', name: 'Needs Review', icon: '👀', filter: a => a.status === 'review-ready' },
];

const formatDate = d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTimeAgo = date => { const s = Math.floor((new Date() - new Date(date)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };
const formatFileSize = bytes => { if (!bytes) return '0 B'; if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'; return (bytes / 1073741824).toFixed(2) + ' GB'; };
const getFileType = file => { if (file.type.startsWith('video/')) return 'video'; if (file.type.startsWith('image/')) return 'image'; if (file.type.startsWith('audio/')) return 'audio'; return 'other'; };

const Badge = ({ status }) => { const s = STATUS[status]; if (!s) return null; return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span>; };
const RoleBadge = ({ role }) => { const r = TEAM_ROLES[role] || CORE_ROLES[role]; if (!r) return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: '#6366f120', color: '#6366f1' }}>{role}</span>; return <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>{r.icon} {r.label}</span>; };
const Avatar = ({ user, size = 32 }) => { const r = TEAM_ROLES[user?.role] || CORE_ROLES[user?.role]; const c = r?.color || '#6366f1'; return <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${c}40, ${c}20)`, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0 }}>{user?.avatar || user?.firstName?.[0] || '?'}</div>; };
const Modal = ({ title, onClose, children, wide }) => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}><div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: wide ? '900px' : '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#16161f', zIndex: 10 }}><h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{title}</h3><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer' }}>×</button></div><div style={{ padding: '20px' }}>{children}</div></div></div>;
const Toast = ({ message, type, onClose }) => { useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]); return <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 20px', background: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '8px', color: '#fff', fontSize: '13px', fontWeight: '500', zIndex: 2000 }}>{message}</div>; };

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
  const [showUserModal, setShowUserModal] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [toast, setToast] = useState(null);
  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [p, u, f, c, ct] = await Promise.all([getProjectsForUser(userProfile.id, userProfile.role, userProfile.isClient, userProfile.isFreelancer), getUsers(), getFreelancers(), getClients(), getCoreTeam()]);
      setProjects(p); setUsers(u); setFreelancers(f); setClients(c); setCoreTeam(ct);
    } catch (e) { console.error(e); showToast('Failed to load', 'error'); }
    setLoading(false);
  };

  const showToast = (message, type = 'info') => setToast({ message, type });
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const Sidebar = () => (
    <div style={{ width: '250px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <div style={{ padding: '20px' }}><div style={{ fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Productions</div></div>
      <nav style={{ flex: 1, padding: '0 12px' }}>
        {[{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'projects', icon: '📁', label: 'Projects' }, ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])].map(item => (
          <div key={item.id} onClick={() => { setView(item.id); setSelectedProjectId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: (view === item.id || (view === 'project-detail' && item.id === 'projects')) ? 'rgba(99,102,241,0.15)' : 'transparent', color: (view === item.id || (view === 'project-detail' && item.id === 'projects')) ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' }}><span style={{ fontSize: '16px' }}>{item.icon}</span><span>{item.label}</span></div>
        ))}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}><Avatar user={userProfile} size={36} /><div style={{ flex: 1 }}><div style={{ fontSize: '13px', fontWeight: '500' }}>{userProfile?.firstName}</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{CORE_ROLES[userProfile?.role]?.label || 'User'}</div></div></div>
        <button onClick={signOut} style={{ width: '100%', padding: '8px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Sign Out</button>
      </div>
    </div>
  );

  const Dashboard = () => {
    const allAssets = projects.flatMap(p => p.assets || []);
    const stats = [{ label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, icon: '📁', color: '#6366f1' }, { label: 'Total Assets', value: allAssets.length, icon: '🎬', color: '#f97316' }, { label: 'Needs Review', value: allAssets.filter(a => a.status === 'review-ready').length, icon: '👁️', color: '#a855f7' }, { label: 'Team Members', value: freelancers.length + coreTeam.length, icon: '👥', color: '#22c55e' }];
    return (
      <div>
        <div style={{ marginBottom: '24px' }}><h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Welcome back, {userProfile?.firstName}</h1><p style={{ margin: '8px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{CORE_ROLES[userProfile?.role]?.label || 'User'}</p></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>{stats.map(s => <div key={s.label} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}><div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{s.icon}</div><div><div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div></div></div></div>)}</div>
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>📁 Recent Projects</h3>
          {projects.length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div><p>No projects yet</p></div> : projects.slice(0, 5).map(p => <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project-detail'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', background: '#0d0d14', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}><div><div style={{ fontWeight: '500', fontSize: '14px' }}>{p.name}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{p.client} • {p.assets?.length || 0} assets</div></div><Badge status={p.status} /></div>)}
        </div>
      </div>
    );
  };

  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', client: '', type: 'ad-film', deadline: '', selectedCategories: ['statics', 'videos'] });
    const [creating, setCreating] = useState(false);
    const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
      if (!newProject.name || !newProject.client) { showToast('Fill name and client', 'error'); return; }
      setCreating(true);
      try {
        const cats = DEFAULT_CATEGORIES.filter(c => newProject.selectedCategories.includes(c.id));
        const proj = await createProject({ name: newProject.name, client: newProject.client, type: newProject.type, deadline: newProject.deadline, status: 'active', categories: cats, assets: [], assignedTeam: [{ odId: userProfile.id, odRole: userProfile.role, isOwner: true }], clientContacts: [], activityLog: [{ id: generateId(), type: 'created', message: `Project created by ${userProfile.name}`, userId: userProfile.id, timestamp: new Date().toISOString() }], createdBy: userProfile.id, createdByName: userProfile.name });
        setProjects([proj, ...projects]); setNewProject({ name: '', client: '', type: 'ad-film', deadline: '', selectedCategories: ['statics', 'videos'] }); setShowCreate(false); showToast('Project created!', 'success');
      } catch (e) { showToast('Failed', 'error'); }
      setCreating(false);
    };

    const toggleCat = id => setNewProject(p => ({ ...p, selectedCategories: p.selectedCategories.includes(id) ? p.selectedCategories.filter(x => x !== id) : [...p.selectedCategories, id] }));

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '10px 14px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px', width: '220px' }} placeholder="🔍 Search..." />
            {isProducer && <button onClick={() => setShowCreate(true)} style={{ padding: '10px 18px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ New Project</button>}
          </div>
        </div>
        {projects.length === 0 ? <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '60px', textAlign: 'center' }}><div style={{ fontSize: '50px', marginBottom: '16px' }}>📁</div><h3>No Projects Yet</h3>{isProducer && <button onClick={() => setShowCreate(true)} style={{ marginTop: '20px', padding: '12px 24px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>+ Create Project</button>}</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filtered.map(p => { const prog = p.assets?.length ? Math.round((p.assets.filter(a => ['approved', 'completed'].includes(a.status)).length / p.assets.length) * 100) : 0; return (
              <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project-detail'); }} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}><div><div style={{ fontWeight: '600', fontSize: '16px' }}>{p.name}</div><div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{p.client}</div></div><Badge status={p.status} /></div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{p.assets?.length || 0} assets</span><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>{p.categories?.length || 0} categories</span></div>
                <div style={{ background: '#1e1e2e', borderRadius: '3px', height: '4px' }}><div style={{ width: `${prog}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #22c55e)', borderRadius: '3px' }} /></div>
              </div>
            ); })}
          </div>
        )}
        {showCreate && <Modal title="Create Project" onClose={() => setShowCreate(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Project Name *</label><input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="e.g., Lays Campaign" /></div>
            <div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Client *</label><input value={newProject.client} onChange={e => setNewProject({ ...newProject, client: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="e.g., PepsiCo" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}><div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Type</label><select value={newProject.type} onChange={e => setNewProject({ ...newProject, type: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }}><option value="ad-film">Ad Film</option><option value="photoshoot">Photoshoot</option><option value="toolkit">Toolkit</option></select></div><div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>Deadline</label><input type="date" value={newProject.deadline} onChange={e => setNewProject({ ...newProject, deadline: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} /></div></div>
            <div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '10px' }}>Select Categories</label><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>{DEFAULT_CATEGORIES.map(cat => <div key={cat.id} onClick={() => toggleCat(cat.id)} style={{ padding: '12px', background: newProject.selectedCategories.includes(cat.id) ? `${cat.color}20` : '#0d0d14', border: `2px solid ${newProject.selectedCategories.includes(cat.id) ? cat.color : '#1e1e2e'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center' }}><div style={{ fontSize: '20px', marginBottom: '4px' }}>{cat.icon}</div><div style={{ fontSize: '11px', color: newProject.selectedCategories.includes(cat.id) ? cat.color : 'rgba(255,255,255,0.6)' }}>{cat.name}</div></div>)}</div></div>
            <button onClick={handleCreate} disabled={!newProject.name || !newProject.client || creating} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer', opacity: (newProject.name && newProject.client && !creating) ? 1 : 0.5 }}>{creating ? '⏳ Creating...' : '🚀 Create'}</button>
          </div>
        </Modal>}
      </div>
    );
  };

  const TeamManagement = () => {
    const [tab, setTab] = useState('core');
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
        await loadData(); setNewUser({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer', company: '', designation: '' }); setShowUserModal(null); showToast('Added!', 'success');
      } catch (e) { setError(e.code === 'auth/email-already-in-use' ? 'Email exists' : e.message); }
      setCreating(false);
    };

    const handleDelete = async id => { try { await deleteUser(id); await loadData(); showToast('Removed', 'success'); } catch (e) { showToast('Failed', 'error'); } };
    const handleUpdate = async () => { if (!editingUser) return; try { await updateUser(editingUser.id, { name: editingUser.name, firstName: editingUser.name.split(' ')[0], phone: editingUser.phone, role: editingUser.role }); await loadData(); setEditingUser(null); setShowUserModal(null); showToast('Updated', 'success'); } catch (e) { showToast('Failed', 'error'); } };

    const renderUser = u => <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}><Avatar user={u} size={44} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '14px' }}>{u.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div><RoleBadge role={u.role} />{isProducer && u.id !== userProfile.id && <div style={{ display: 'flex', gap: '6px' }}><button onClick={() => { setEditingUser(u); setShowUserModal('edit'); }} style={{ padding: '6px 12px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>Edit</button><button onClick={() => handleDelete(u.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>×</button></div>}</div>;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}><h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Team</h1>{isProducer && <button onClick={() => setShowUserModal('add')} style={{ padding: '10px 18px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>+ Add</button>}</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>{[{ id: 'core', label: '👑 Core', data: coreTeam }, { id: 'freelancers', label: '🎨 Freelancers', data: freelancers }, { id: 'clients', label: '👔 Clients', data: clients }].map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '10px 16px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{t.label} ({t.data.length})</button>)}</div>
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}>{tab === 'core' && (coreTeam.length ? coreTeam.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No core team</div>)}{tab === 'freelancers' && (freelancers.length ? freelancers.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No freelancers</div>)}{tab === 'clients' && (clients.length ? clients.map(renderUser) : <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No clients</div>)}</div>
        {showUserModal === 'add' && <Modal title="Add Member" onClose={() => { setShowUserModal(null); setError(''); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>{['core', 'freelancer', 'client'].map(type => <button key={type} onClick={() => setNewUser({ ...newUser, type, role: type === 'core' ? 'producer' : type === 'client' ? 'client' : 'photo-editor' })} style={{ flex: 1, padding: '12px', background: newUser.type === type ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>{type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}</button>)}</div>
            <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Name *" />
            <input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Email *" type="email" />
            <input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Password *" type="password" />
            <input value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Phone" />
            {newUser.type !== 'client' && <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }}>{newUser.type === 'core' ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select>}
            {newUser.type === 'client' && <><input value={newUser.company} onChange={e => setNewUser({ ...newUser, company: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Company" /><input value={newUser.designation} onChange={e => setNewUser({ ...newUser, designation: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Designation" /></>}
            {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
            <button onClick={handleCreate} disabled={creating} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer', opacity: creating ? 0.5 : 1 }}>{creating ? '⏳...' : '✓ Add'}</button>
          </div>
        </Modal>}
        {showUserModal === 'edit' && editingUser && <Modal title="Edit Member" onClose={() => { setShowUserModal(null); setEditingUser(null); }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Name" />
            <input value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Phone" />
            {!editingUser.isClient && <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }}>{editingUser.isCore ? Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>) : Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}</select>}
            <button onClick={handleUpdate} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>✓ Save</button>
          </div>
        </Modal>}
      </div>
    );
  };

  const ProjectDetail = () => {
    const [selectedCat, setSelectedCat] = useState(null);
    const [selectedCol, setSelectedCol] = useState('all');
    const [tab, setTab] = useState('assets');
    const [showUpload, setShowUpload] = useState(false);
    const [showAddCat, setShowAddCat] = useState(false);
    const [showAddTeam, setShowAddTeam] = useState(false);
    const [showAddClient, setShowAddClient] = useState(false);
    const [uploadProgress, setUploadProgress] = useState({});
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [newCat, setNewCat] = useState({ name: '', icon: '📁', color: '#6366f1' });
    const fileInputRef = useRef(null);

    if (!selectedProject) return null;
    const cats = selectedProject.categories || [];
    const team = (selectedProject.assignedTeam || []).map(t => ({ ...users.find(u => u.id === t.odId), isOwner: t.isOwner })).filter(m => m.id);
    const projClients = (selectedProject.clientContacts || []).map(c => ({ ...users.find(u => u.id === c.odId), isPrimary: c.isPrimary })).filter(c => c.id);

    const getAssets = () => { let a = selectedProject.assets?.filter(x => !x.deleted) || []; if (selectedCat) a = a.filter(x => x.category === selectedCat); const col = COLLECTIONS.find(c => c.id === selectedCol); if (col?.filter) a = a.filter(col.filter); return a; };
    const assets = getAssets();
    const getCatCount = id => (selectedProject.assets || []).filter(a => !a.deleted && a.category === id).length;
    const getTotalSize = () => assets.reduce((s, a) => s + (a.fileSize || 0), 0);

    const handleUpload = async files => {
      if (!files.length) return;
      const cat = selectedCat || cats[0]?.id;
      if (!cat) { showToast('Select category first', 'error'); return; }
      setShowUpload(false);
      for (const file of files) {
        const uid = generateId();
        setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0 } }));
        try {
          const path = `projects/${selectedProject.id}/${cat}/${Date.now()}-${file.name}`;
          const sRef = ref(storage, path);
          const task = uploadBytesResumable(sRef, file);
          task.on('state_changed', snap => { const prog = Math.round((snap.bytesTransferred / snap.totalBytes) * 100); setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: prog } })); }, err => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); }, async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            const newAsset = { id: generateId(), name: file.name, type: getFileType(file), category: cat, url, thumbnail: getFileType(file) === 'image' ? url : null, path, fileSize: file.size, mimeType: file.type, status: 'pending', uploadedBy: userProfile.id, uploadedByName: userProfile.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url, uploadedAt: new Date().toISOString() }], feedback: [], currentVersion: 1 };
            const updated = [...(selectedProject.assets || []), newAsset];
            await updateProject(selectedProject.id, { assets: updated });
            setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, assets: updated } : x));
            setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
            showToast(`Uploaded: ${file.name}`, 'success');
          });
        } catch (e) { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); }
      }
    };

    const handleDrop = e => { e.preventDefault(); handleUpload(Array.from(e.dataTransfer.files)); };
    const handleAddCat = async () => { if (!newCat.name) return; const cat = { id: `c-${generateId()}`, name: newCat.name, icon: newCat.icon, color: newCat.color, isCustom: true }; const updated = [...cats, cat]; await updateProject(selectedProject.id, { categories: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, categories: updated } : x)); setNewCat({ name: '', icon: '📁', color: '#6366f1' }); setShowAddCat(false); showToast('Added!', 'success'); };
    const handleDelCat = async id => { if ((selectedProject.assets || []).filter(a => a.category === id).length > 0) { showToast('Move assets first', 'error'); return; } const updated = cats.filter(c => c.id !== id); await updateProject(selectedProject.id, { categories: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, categories: updated } : x)); setSelectedCat(null); showToast('Deleted', 'success'); };
    const handleAddTeamMember = async uid => { const u = users.find(x => x.id === uid); if (!u || team.find(m => m.id === uid)) return; const updated = [...(selectedProject.assignedTeam || []), { odId: uid, odRole: u.role }]; await updateProject(selectedProject.id, { assignedTeam: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, assignedTeam: updated } : x)); setShowAddTeam(false); showToast('Added!', 'success'); };
    const handleRemoveTeam = async uid => { const updated = (selectedProject.assignedTeam || []).filter(t => t.odId !== uid); await updateProject(selectedProject.id, { assignedTeam: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, assignedTeam: updated } : x)); showToast('Removed', 'success'); };
    const handleAddClientContact = async cid => { const c = clients.find(x => x.id === cid); if (!c || projClients.find(x => x.id === cid)) return; const updated = [...(selectedProject.clientContacts || []), { odId: cid, isPrimary: projClients.length === 0 }]; await updateProject(selectedProject.id, { clientContacts: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, clientContacts: updated } : x)); setShowAddClient(false); showToast('Added!', 'success'); };
    const handleUpdateStatus = async (aid, status) => { const updated = (selectedProject.assets || []).map(a => a.id === aid ? { ...a, status, updatedAt: new Date().toISOString() } : a); await updateProject(selectedProject.id, { assets: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, assets: updated } : x)); showToast('Updated', 'success'); };
    const handleDeleteAsset = async aid => { const updated = (selectedProject.assets || []).filter(a => a.id !== aid); await updateProject(selectedProject.id, { assets: updated }); setProjects(p => p.map(x => x.id === selectedProject.id ? { ...x, assets: updated } : x)); setSelectedAsset(null); showToast('Deleted', 'success'); };

    const availableTeam = [...coreTeam, ...freelancers].filter(u => !team.find(m => m.id === u.id));
    const availableClients = clients.filter(c => !projClients.find(x => x.id === c.id));
    const icons = ['📁', '🎬', '🖼️', '🎭', '✨', '🔊', '📊', '🌐', '🎨', '📸', '🎥', '💫'];
    const colors = ['#3b82f6', '#a855f7', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#6366f1', '#ef4444', '#22c55e', '#eab308'];

    return (
      <div style={{ display: 'flex', marginLeft: '-250px' }}>
        <div style={{ width: '250px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: 'calc(100vh - 56px)', position: 'fixed', left: '250px', top: '56px', overflowY: 'auto', zIndex: 40 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e2e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase' }}>Categories</div>{isProducer && <button onClick={() => setShowAddCat(true)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '16px', cursor: 'pointer' }}>+</button>}</div>
            <div onClick={() => { setSelectedCat(null); setSelectedCol('all'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: !selectedCat && selectedCol === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCat && selectedCol === 'all' ? '#fff' : 'rgba(255,255,255,0.6)' }}>📁 All<span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>{(selectedProject.assets || []).length}</span></div>
            {cats.map(cat => <div key={cat.id} onClick={() => { setSelectedCat(cat.id); setSelectedCol('all'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)' }}>{cat.icon} {cat.name}<span style={{ marginLeft: 'auto', fontSize: '11px', opacity: 0.5 }}>{getCatCount(cat.id)}</span></div>)}
          </div>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '8px' }}>Collections</div>
            {COLLECTIONS.map(col => <div key={col.id} onClick={() => { setSelectedCol(col.id); setSelectedCat(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: selectedCol === col.id && !selectedCat ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCol === col.id && !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)' }}>{col.icon} {col.name}</div>)}
          </div>
        </div>
        <div style={{ flex: 1, marginLeft: '500px' }} onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
          <div style={{ height: '56px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}>← Back</button><span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span><span style={{ fontWeight: '500' }}>{selectedProject.name}</span>{selectedCat && <><span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span><span>{cats.find(c => c.id === selectedCat)?.name}</span></>}</div>
          </div>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>{['assets', 'team', 'activity'].map(t => <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>)}</div>
            {tab === 'assets' && isProducer && <button onClick={() => setShowUpload(true)} style={{ padding: '8px 16px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>⬆️ Upload</button>}
          </div>
          {Object.keys(uploadProgress).length > 0 && <div style={{ padding: '12px 20px', background: '#1e1e2e' }}>{Object.entries(uploadProgress).map(([id, item]) => <div key={id} style={{ marginBottom: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}><span>{item.name}</span><span>{item.progress}%</span></div><div style={{ background: '#0d0d14', borderRadius: '2px', height: '4px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '2px' }} /></div></div>)}</div>}
          {tab === 'assets' && <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}><div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{selectedCat ? cats.find(c => c.id === selectedCat)?.name : 'All'}</div><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{assets.length} Assets • {formatFileSize(getTotalSize())}</div></div>
            <div style={{ padding: '20px' }}>
              {!selectedCat && selectedCol === 'all' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>{cats.map(cat => <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}><div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100px', background: `linear-gradient(135deg, ${cat.color}20, ${cat.color}08)` }}><span style={{ fontSize: '32px', marginBottom: '8px' }}>{cat.icon}</span></div><div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: '600', fontSize: '13px' }}>{cat.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{getCatCount(cat.id)} items</div></div>{isProducer && cat.isCustom && <button onClick={e => { e.stopPropagation(); handleDelCat(cat.id); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '14px', cursor: 'pointer' }}>×</button>}</div></div>)}</div>}
              {(selectedCat || selectedCol !== 'all') && (assets.length === 0 ? <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}><div style={{ fontSize: '50px', marginBottom: '16px' }}>📂</div><p>No assets</p>{isProducer && <button onClick={() => setShowUpload(true)} style={{ marginTop: '16px', padding: '10px 20px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>⬆️ Upload</button>}</div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>{assets.map(a => <div key={a.id} onClick={() => setSelectedAsset(a)} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer' }}><div style={{ position: 'relative', paddingTop: '65%', background: '#0d0d14' }}>{a.type === 'video' ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f9731620, #f9731608)' }}><span style={{ fontSize: '40px' }}>🎬</span></div> : a.type === 'audio' ? <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #06b6d420, #06b6d408)' }}><span style={{ fontSize: '40px' }}>🔊</span></div> : a.thumbnail ? <img src={a.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '40px' }}>📄</span></div>}</div><div style={{ padding: '12px' }}><div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>{formatFileSize(a.fileSize)} • {formatTimeAgo(a.uploadedAt)}</div><Badge status={a.status} /></div></div>)}</div>)}
            </div>
          </>}
          {tab === 'team' && <div style={{ padding: '20px' }}>
            <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', marginBottom: '20px' }}><div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: '14px' }}>Team ({team.length})</h3>{isProducer && availableTeam.length > 0 && <button onClick={() => setShowAddTeam(true)} style={{ padding: '6px 12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>+ Add</button>}</div><div style={{ padding: '16px 20px' }}>{team.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No team</div> : team.map(m => <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}><Avatar user={m} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{m.name} {m.isOwner && <span style={{ fontSize: '10px', color: '#f97316' }}>👑 Owner</span>}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{m.email}</div></div><RoleBadge role={m.role} />{isProducer && !m.isOwner && <button onClick={() => handleRemoveTeam(m.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: '16px', cursor: 'pointer' }}>×</button>}</div>)}</div></div>
            <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}><div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ margin: 0, fontSize: '14px' }}>Clients ({projClients.length})</h3>{isProducer && availableClients.length > 0 && <button onClick={() => setShowAddClient(true)} style={{ padding: '6px 12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>+ Add</button>}</div><div style={{ padding: '16px 20px' }}>{projClients.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No clients</div> : projClients.map(c => <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}><Avatar user={c} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{c.name} {c.isPrimary && <span style={{ fontSize: '10px', color: '#22c55e' }}>Primary</span>}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{c.designation} • {c.company}</div></div></div>)}</div></div>
          </div>}
          {tab === 'activity' && <div style={{ padding: '20px' }}><div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}><h3 style={{ margin: '0 0 16px', fontSize: '14px' }}>Activity</h3>{(selectedProject.activityLog || []).length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No activity</div> : (selectedProject.activityLog || []).slice().reverse().map(log => <div key={log.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '8px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', marginTop: '6px', flexShrink: 0 }} /><div><div style={{ fontSize: '13px' }}>{log.message}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{formatTimeAgo(log.timestamp)}</div></div></div>)}</div></div>}
        </div>
        {showUpload && <Modal title="Upload" onClose={() => setShowUpload(false)}><div style={{ textAlign: 'center', padding: '40px', border: '2px dashed #2a2a3e', borderRadius: '10px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}><div style={{ fontSize: '50px', marginBottom: '16px' }}>📤</div><p>Drop files or click</p><p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>To: {selectedCat ? cats.find(c => c.id === selectedCat)?.name : cats[0]?.name || 'Select category'}</p><input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleUpload(Array.from(e.target.files))} /></div></Modal>}
        {showAddCat && <Modal title="Add Category" onClose={() => setShowAddCat(false)}><div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}><input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }} placeholder="Name" /><div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Icon</label><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{icons.map(i => <button key={i} onClick={() => setNewCat({ ...newCat, icon: i })} style={{ width: '40px', height: '40px', background: newCat.icon === i ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}>{i}</button>)}</div></div><div><label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Color</label><div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>{colors.map(c => <button key={c} onClick={() => setNewCat({ ...newCat, color: c })} style={{ width: '32px', height: '32px', background: c, border: newCat.color === c ? '3px solid #fff' : 'none', borderRadius: '6px', cursor: 'pointer' }} />)}</div></div><button onClick={handleAddCat} disabled={!newCat.name} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer', opacity: newCat.name ? 1 : 0.5 }}>Add</button></div></Modal>}
        {showAddTeam && <Modal title="Add Team" onClose={() => setShowAddTeam(false)}><div style={{ maxHeight: '400px', overflow: 'auto' }}>{availableTeam.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>All added</div> : availableTeam.map(u => <div key={u.id} onClick={() => handleAddTeamMember(u.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}><Avatar user={u} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{u.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{u.email}</div></div><RoleBadge role={u.role} /></div>)}</div></Modal>}
        {showAddClient && <Modal title="Add Client" onClose={() => setShowAddClient(false)}><div style={{ maxHeight: '400px', overflow: 'auto' }}>{availableClients.length === 0 ? <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No clients. Add in Team first.</div> : availableClients.map(c => <div key={c.id} onClick={() => handleAddClientContact(c.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer' }}><Avatar user={c} size={40} /><div style={{ flex: 1 }}><div style={{ fontWeight: '500', fontSize: '13px' }}>{c.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{c.designation} • {c.company}</div></div></div>)}</div></Modal>}
        {selectedAsset && <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)} wide><div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}><div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden' }}>{selectedAsset.type === 'video' ? <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: '500px' }} /> : selectedAsset.type === 'audio' ? <div style={{ padding: '60px', textAlign: 'center' }}><div style={{ fontSize: '80px', marginBottom: '20px' }}>🔊</div><audio src={selectedAsset.url} controls style={{ width: '100%' }} /></div> : selectedAsset.type === 'image' ? <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: '500px', objectFit: 'contain' }} /> : <div style={{ padding: '60px', textAlign: 'center' }}><div style={{ fontSize: '80px', marginBottom: '20px' }}>📄</div><a href={selectedAsset.url} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>Open</a></div>}</div><div><div style={{ marginBottom: '20px' }}><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Status</div><select value={selectedAsset.status} onChange={e => handleUpdateStatus(selectedAsset.id, e.target.value)} style={{ width: '100%', padding: '10px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff' }}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div><div style={{ marginBottom: '20px' }}><div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '8px' }}>Details</div><div style={{ background: '#0d0d14', borderRadius: '8px', padding: '12px' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Type</span><span>{selectedAsset.mimeType}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>By</span><span>{selectedAsset.uploadedByName || 'Unknown'}</span></div></div></div><div style={{ display: 'flex', gap: '8px' }}><a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download</a><button onClick={() => handleDeleteAsset(selectedAsset.id)} style={{ padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer' }}>🗑️</button></div></div></div></Modal>}
      </div>
    );
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '40px', marginBottom: '16px' }} className="spinner">⚙️</div><div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</div></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e4e4e7' }}>
      <Sidebar />
      <div style={{ marginLeft: '250px', minHeight: '100vh' }}>
        <div style={{ height: '56px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}><div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</div></div>
        <div style={{ padding: '24px' }}>{view === 'dashboard' && <Dashboard />}{view === 'projects' && <ProjectsList />}{view === 'team' && <TeamManagement />}{view === 'project-detail' && <ProjectDetail />}</div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
