'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { 
  getProjects, 
  getProjectsForUser, 
  createProject, 
  updateProject,
  getUsers,
  getFreelancers,
  getClients,
  getCoreTeam,
  createUser,
  updateUser,
  deleteUser,
  addAssetToProject,
  uploadAssetFile,
  addActivityLog,
  addCategoryToProject,
  addTeamMember,
  removeTeamMember,
  addClientContact,
  TEAM_ROLES,
  CORE_ROLES,
  STATUS,
  generateId,
  generateInviteToken,
} from '@/lib/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ============ SAMPLE IMAGES ============
const SAMPLE_IMAGES = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop',
];

// ============ COLLECTIONS ============
const COLLECTIONS = [
  { id: 'all', name: 'All Collections', icon: '📋' },
  { id: 'videos', name: 'Videos', icon: '🎬', filter: a => a.type === 'video' },
  { id: 'images', name: 'Images', icon: '🖼️', filter: a => a.type === 'image' || a.type === 'still' },
  { id: 'needs-review', name: 'Needs Review', icon: '👀', filter: a => a.status === 'review-ready' || a.status === 'feedback-pending' },
];

// ============ HELPERS ============
const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
const formatTimeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// ============ UI COMPONENTS ============
const Badge = ({ status }) => {
  const s = STATUS[status];
  if (!s) return null;
  return (
    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const r = TEAM_ROLES[role] || CORE_ROLES[role];
  if (!r) return null;
  return (
    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: `${r.color}20`, color: r.color }}>
      {r.icon} {r.label}
    </span>
  );
};

const Avatar = ({ user, size = 32 }) => {
  const role = TEAM_ROLES[user?.role] || CORE_ROLES[user?.role];
  const color = role?.color || '#6366f1';
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${color}40, ${color}20)`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.45, flexShrink: 0 }}>
      {user?.avatar || user?.firstName?.[0] || '?'}
    </div>
  );
};

const Modal = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}>
    <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: wide ? '900px' : '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#16161f', zIndex: 10 }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{title}</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer' }}>×</button>
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  </div>
);

const Toggle = ({ value, onChange }) => (
  <div onClick={() => onChange(!value)} style={{ width: '36px', height: '20px', borderRadius: '10px', background: value ? '#6366f1' : '#2a2a3e', position: 'relative', cursor: 'pointer', transition: 'all 0.2s' }}>
    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: value ? '18px' : '2px', transition: 'all 0.2s' }} />
  </div>
);

// ============ MAIN APP ============
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
  const [showUserModal, setShowUserModal] = useState(null); // 'add' | 'edit' | null
  const [editingUser, setEditingUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const isProducer = ['producer', 'admin', 'team-lead'].includes(userProfile?.role);
  const isFreelancer = userProfile?.isFreelancer;
  const isClient = userProfile?.isClient;

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsData, usersData, freelancersData, clientsData, coreTeamData] = await Promise.all([
        getProjectsForUser(userProfile.id, userProfile.role, userProfile.isClient, userProfile.isFreelancer),
        getUsers(),
        getFreelancers(),
        getClients(),
        getCoreTeam(),
      ]);
      setProjects(projectsData);
      setUsers(usersData);
      setFreelancers(freelancersData);
      setClients(clientsData);
      setCoreTeam(coreTeamData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // ============ SIDEBAR ============
  const Sidebar = () => {
    const navItems = isFreelancer 
      ? [{ id: 'dashboard', icon: '📊', label: 'Dashboard' }, { id: 'workspace', icon: '🎨', label: 'My Workspace' }]
      : [
          { id: 'dashboard', icon: '📊', label: 'Dashboard' }, 
          { id: 'projects', icon: '📁', label: 'Projects' }, 
          ...(isProducer ? [{ id: 'team', icon: '👥', label: 'Team' }] : [])
        ];

    return (
      <div style={{ width: '250px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: '100vh', position: 'fixed', left: 0, top: 0, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '22px', fontWeight: '800', background: 'linear-gradient(135deg, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ANANDI</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>Productions</div>
        </div>
        
        <nav style={{ flex: 1, padding: '0 12px' }}>
          {navItems.map(item => (
            <div 
              key={item.id} 
              onClick={() => { setView(item.id); setSelectedProjectId(null); }}
              style={{ 
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', 
                background: (view === item.id || (view === 'project-detail' && item.id === 'projects')) ? 'rgba(99,102,241,0.15)' : 'transparent', 
                color: (view === item.id || (view === 'project-detail' && item.id === 'projects')) ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '2px' 
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        
        <div style={{ padding: '16px', borderTop: '1px solid #1e1e2e' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <Avatar user={userProfile} size={36} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>{userProfile?.firstName}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{CORE_ROLES[userProfile?.role]?.label || TEAM_ROLES[userProfile?.role]?.label || 'User'}</div>
            </div>
          </div>
          <button onClick={signOut} style={{ width: '100%', padding: '8px', background: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            Sign Out
          </button>
        </div>
      </div>
    );
  };

  // ============ DASHBOARD ============
  const Dashboard = () => {
    const allAssets = projects.flatMap(p => p.assets || []);
    const myAssets = allAssets.filter(a => a.assignedTo === userProfile.id);
    
    const stats = isFreelancer ? [
      { label: 'My Assets', value: myAssets.length, icon: '📁', color: '#6366f1' },
      { label: 'In Progress', value: myAssets.filter(a => a.status === 'in-progress').length, icon: '🔄', color: '#3b82f6' },
      { label: 'With Feedback', value: myAssets.filter(a => a.feedback?.length > 0).length, icon: '💬', color: '#ec4899' },
      { label: 'Completed', value: myAssets.filter(a => ['approved', 'completed'].includes(a.status)).length, icon: '✅', color: '#22c55e' },
    ] : [
      { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length, icon: '📁', color: '#6366f1' },
      { label: 'Total Assets', value: allAssets.length, icon: '🎬', color: '#f97316' },
      { label: 'Needs Review', value: allAssets.filter(a => a.status === 'review-ready').length, icon: '👁️', color: '#a855f7' },
      { label: 'Team Members', value: freelancers.length + coreTeam.length, icon: '👥', color: '#22c55e' },
    ];

    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Welcome back, {userProfile?.firstName}</h1>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>{CORE_ROLES[userProfile?.role]?.label || TEAM_ROLES[userProfile?.role]?.label}</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Projects */}
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px' }}>📁 Recent Projects</h3>
          {projects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
              No projects yet. {isProducer && 'Create your first project!'}
            </div>
          ) : projects.slice(0, 5).map(p => (
            <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project-detail'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#0d0d14', borderRadius: '8px', marginBottom: '8px', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: '500', fontSize: '14px' }}>{p.name}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{p.client} • {p.assets?.length || 0} assets</div>
              </div>
              <Badge status={p.status} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============ PROJECTS LIST ============
  const ProjectsList = () => {
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [newProject, setNewProject] = useState({ name: '', client: '', type: 'ad-film', deadline: '' });
    const [creating, setCreating] = useState(false);

    const filtered = projects.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.client?.toLowerCase().includes(search.toLowerCase()));

    const handleCreate = async () => {
      setCreating(true);
      try {
        const project = await createProject({
          ...newProject,
          status: 'active',
          feedbackToken: `fb-${Date.now()}`,
          createdBy: userProfile.id,
        });
        setProjects([project, ...projects]);
        setNewProject({ name: '', client: '', type: 'ad-film', deadline: '' });
        setShowCreate(false);
      } catch (error) {
        console.error('Error creating project:', error);
      }
      setCreating(false);
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Projects</h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ padding: '10px 14px', paddingLeft: '36px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px', width: '220px' }} 
              placeholder="Search..." 
            />
            {isProducer && (
              <button onClick={() => setShowCreate(true)} style={{ padding: '10px 18px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                + New Project
              </button>
            )}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map(p => {
            const progress = p.assets?.length ? Math.round((p.assets.filter(a => ['approved', 'completed'].includes(a.status)).length / p.assets.length) * 100) : 0;
            return (
              <div key={p.id} onClick={() => { setSelectedProjectId(p.id); setView('project-detail'); }} style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '20px', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>{p.name}</div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>{p.client}</div>
                  </div>
                  <Badge status={p.status} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{p.assets?.length || 0} assets</span>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>{p.assignedTeam?.length || 0} team</span>
                </div>
                <div style={{ background: '#1e1e2e', borderRadius: '3px', height: '4px' }}>
                  <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #22c55e)', borderRadius: '3px' }} />
                </div>
              </div>
            );
          })}
        </div>

        {showCreate && (
          <Modal title="Create Project" onClose={() => setShowCreate(false)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={newProject.name} onChange={e => setNewProject({ ...newProject, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Project Name" />
              <input value={newProject.client} onChange={e => setNewProject({ ...newProject, client: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Client Name" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <select value={newProject.type} onChange={e => setNewProject({ ...newProject, type: e.target.value })} style={{ padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
                  <option value="ad-film">Ad Film</option>
                  <option value="photoshoot">Photoshoot</option>
                  <option value="toolkit">Toolkit</option>
                  <option value="animation">Animation</option>
                </select>
                <input type="date" value={newProject.deadline} onChange={e => setNewProject({ ...newProject, deadline: e.target.value })} style={{ padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} />
              </div>
              <button onClick={handleCreate} disabled={!newProject.name || !newProject.client || creating} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: (newProject.name && newProject.client && !creating) ? 1 : 0.5 }}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // ============ TEAM MANAGEMENT ============
  const TeamManagement = () => {
    const [tab, setTab] = useState('core');
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    const handleCreateUser = async () => {
      if (!newUser.name || !newUser.email || !newUser.password) {
        setError('Name, email and password are required');
        return;
      }
      
      setCreating(true);
      setError('');
      
      try {
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password);
        await updateProfile(userCredential.user, { displayName: newUser.name });
        
        // Create user document in Firestore
        const userData = {
          email: newUser.email,
          name: newUser.name,
          firstName: newUser.name.split(' ')[0],
          role: newUser.type === 'client' ? 'client' : newUser.role,
          phone: newUser.phone,
          avatar: newUser.type === 'client' ? '👔' : (TEAM_ROLES[newUser.role]?.icon || '👤'),
          isCore: newUser.type === 'core',
          isFreelancer: newUser.type === 'freelancer',
          isClient: newUser.type === 'client',
          company: newUser.company || '',
          designation: newUser.designation || '',
          inviteToken: generateInviteToken(),
          createdBy: userProfile.id,
        };
        
        await createUser(userCredential.user.uid, userData);
        
        // Refresh data
        await loadData();
        
        setNewUser({ name: '', email: '', password: '', phone: '', role: 'photo-editor', type: 'freelancer' });
        setShowUserModal(null);
      } catch (err) {
        console.error('Error creating user:', err);
        if (err.code === 'auth/email-already-in-use') {
          setError('This email is already registered');
        } else {
          setError(err.message || 'Failed to create user');
        }
      }
      
      setCreating(false);
    };

    const handleDeleteUser = async (userId) => {
      if (!confirm('Are you sure you want to remove this user?')) return;
      
      try {
        await deleteUser(userId);
        await loadData();
      } catch (err) {
        console.error('Error deleting user:', err);
      }
    };

    const handleUpdateUser = async () => {
      if (!editingUser) return;
      
      try {
        await updateUser(editingUser.id, {
          name: editingUser.name,
          firstName: editingUser.name.split(' ')[0],
          phone: editingUser.phone,
          role: editingUser.role,
          company: editingUser.company,
          designation: editingUser.designation,
        });
        await loadData();
        setEditingUser(null);
        setShowUserModal(null);
      } catch (err) {
        console.error('Error updating user:', err);
      }
    };

    const renderUser = (user) => (
      <div key={user.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
        <Avatar user={user} size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: '500', fontSize: '14px' }}>{user.name}</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
            📧 {user.email} {user.phone && `• 📱 ${user.phone}`}
          </div>
        </div>
        <RoleBadge role={user.role} />
        {isProducer && user.id !== userProfile.id && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setEditingUser(user); setShowUserModal('edit'); }} style={{ padding: '6px 10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', color: '#6366f1', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => handleDeleteUser(user.id)} style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>×</button>
          </div>
        )}
      </div>
    );

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>Team Management</h1>
          {isProducer && (
            <button onClick={() => setShowUserModal('add')} style={{ padding: '10px 18px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              + Add Member
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[{ id: 'core', label: 'Core Team', count: coreTeam.length }, { id: 'freelancers', label: 'Freelancers', count: freelancers.length }, { id: 'clients', label: 'Clients', count: clients.length }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 14px', background: tab === t.id ? '#6366f1' : '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        
        <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
          <div style={{ padding: '20px' }}>
            {tab === 'core' && coreTeam.map(renderUser)}
            {tab === 'freelancers' && freelancers.map(renderUser)}
            {tab === 'clients' && clients.map(renderUser)}
            {((tab === 'core' && coreTeam.length === 0) || (tab === 'freelancers' && freelancers.length === 0) || (tab === 'clients' && clients.length === 0)) && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No users in this category</div>
            )}
          </div>
        </div>

        {/* Add User Modal */}
        {showUserModal === 'add' && (
          <Modal title="Add Team Member" onClose={() => setShowUserModal(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['core', 'freelancer', 'client'].map(type => (
                  <button key={type} onClick={() => setNewUser({ ...newUser, type })} style={{ flex: 1, padding: '10px', background: newUser.type === type ? '#6366f1' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>
                    {type === 'core' ? '👑 Core' : type === 'freelancer' ? '🎨 Freelancer' : '👔 Client'}
                  </button>
                ))}
              </div>
              
              <input value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Full Name *" />
              <input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Email *" />
              <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Password *" />
              <input value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Phone (Optional)" />
              
              {newUser.type !== 'client' && (
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
                  {newUser.type === 'core' ? (
                    Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)
                  ) : (
                    Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)
                  )}
                </select>
              )}
              
              {newUser.type === 'client' && (
                <>
                  <input value={newUser.company || ''} onChange={e => setNewUser({ ...newUser, company: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Company" />
                  <input value={newUser.designation || ''} onChange={e => setNewUser({ ...newUser, designation: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Designation" />
                </>
              )}
              
              {error && <div style={{ padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
              
              <button onClick={handleCreateUser} disabled={creating} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: creating ? 0.5 : 1 }}>
                {creating ? 'Creating...' : 'Add Member'}
              </button>
            </div>
          </Modal>
        )}

        {/* Edit User Modal */}
        {showUserModal === 'edit' && editingUser && (
          <Modal title="Edit Team Member" onClose={() => { setShowUserModal(null); setEditingUser(null); }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Full Name" />
              <input value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Phone" />
              
              {!editingUser.isClient && (
                <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }}>
                  {editingUser.isCore ? (
                    Object.entries(CORE_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)
                  ) : (
                    Object.entries(TEAM_ROLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)
                  )}
                </select>
              )}
              
              {editingUser.isClient && (
                <>
                  <input value={editingUser.company || ''} onChange={e => setEditingUser({ ...editingUser, company: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Company" />
                  <input value={editingUser.designation || ''} onChange={e => setEditingUser({ ...editingUser, designation: e.target.value })} style={{ width: '100%', padding: '10px 12px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '13px' }} placeholder="Designation" />
                </>
              )}
              
              <button onClick={handleUpdateUser} style={{ padding: '12px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                Save Changes
              </button>
            </div>
          </Modal>
        )}
      </div>
    );
  };

  // ============ PROJECT DETAIL ============
  const ProjectDetail = () => {
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedCollection, setSelectedCollection] = useState('all');
    const [tab, setTab] = useState('assets');

    if (!selectedProject) return null;

    const visibleCategories = selectedProject.categories || [];
    
    const getVisibleAssets = () => {
      let assets = selectedProject.assets?.filter(a => !a.deleted) || [];
      if (selectedCategory) assets = assets.filter(a => a.category === selectedCategory);
      const collection = COLLECTIONS.find(c => c.id === selectedCollection);
      if (collection?.filter) assets = assets.filter(collection.filter);
      return assets;
    };

    const visibleAssets = getVisibleAssets();
    const getCategoryCount = (catId) => (selectedProject.assets || []).filter(a => !a.deleted && a.category === catId).length;
    const getTotalSize = () => visibleAssets.reduce((sum, a) => sum + (a.fileSize || 0), 0);

    const teamMembers = (selectedProject.assignedTeam || []).map(t => users.find(u => u.id === t.odId)).filter(Boolean);
    const clientContacts = (selectedProject.clientContacts || []).map(c => users.find(u => u.id === c.odId)).filter(Boolean);

    return (
      <div style={{ display: 'flex', marginLeft: '-250px' }}>
        {/* Secondary Sidebar */}
        <div style={{ width: '250px', background: '#12121a', borderRight: '1px solid #1e1e2e', height: 'calc(100vh - 56px)', position: 'fixed', left: '250px', top: '56px', overflowY: 'auto', zIndex: 40 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Assets</div>
            
            <div onClick={() => { setSelectedCategory(null); setSelectedCollection('all'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: !selectedCategory && selectedCollection === 'all' ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCategory && selectedCollection === 'all' ? '#fff' : 'rgba(255,255,255,0.6)' }}>
              <span>📁</span><span>{selectedProject.name}</span>
            </div>
            
            {visibleCategories.map(cat => (
              <div key={cat.id} onClick={() => { setSelectedCategory(cat.id); setSelectedCollection('all'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', paddingLeft: '28px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: selectedCategory === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCategory === cat.id ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                <span>{cat.icon}</span><span>{cat.name}</span>
              </div>
            ))}
          </div>
          
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e1e2e' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Collections</div>
            {COLLECTIONS.map(col => (
              <div key={col.id} onClick={() => { setSelectedCollection(col.id); setSelectedCategory(null); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', background: selectedCollection === col.id && !selectedCategory ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCollection === col.id && !selectedCategory ? '#fff' : 'rgba(255,255,255,0.6)' }}>
                <span>{col.icon}</span><span>{col.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: '500px' }}>
          {/* Header */}
          <div style={{ height: '56px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', position: 'sticky', top: 0, zIndex: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button onClick={() => { setSelectedProjectId(null); setView('projects'); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '12px', cursor: 'pointer' }}>← Back</button>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>/</span>
              <span>{selectedProject.name}</span>
              {selectedCategory && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                  <span>{visibleCategories.find(c => c.id === selectedCategory)?.name}</span>
                </>
              )}
            </div>
          </div>
          
          {/* Tabs */}
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #1e1e2e', display: 'flex', gap: '8px' }}>
            {['assets', 'team'].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: '6px', color: '#fff', fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize' }}>{t}</button>
            ))}
          </div>
          
          {tab === 'assets' && (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1e1e2e' }}>
                <div />
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {!selectedCategory && `${visibleCategories.length} Folders • `}{visibleAssets.length} Assets • {formatFileSize(getTotalSize())}
                  </span>
                </div>
              </div>
              
              {/* Asset Grid */}
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
                  {/* Folders */}
                  {!selectedCategory && selectedCollection === 'all' && visibleCategories.map(cat => (
                    <div key={cat.id} onClick={() => setSelectedCategory(cat.id)} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent' }}>
                      <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '120px', background: `linear-gradient(135deg, ${cat.color}20, ${cat.color}08)` }}>
                        <span style={{ fontSize: '40px', marginBottom: '8px' }}>{cat.icon}</span>
                      </div>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>{cat.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{getCategoryCount(cat.id)} Items</div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Assets */}
                  {(selectedCategory || selectedCollection !== 'all') && visibleAssets.map(asset => (
                    <div key={asset.id} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', border: '2px solid transparent' }}>
                      <div style={{ position: 'relative', paddingTop: '70%', background: '#0d0d14' }}>
                        {asset.thumbnail ? (
                          <img src={asset.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                            {asset.type === 'video' ? '🎬' : '🖼️'}
                          </div>
                        )}
                      </div>
                      <div style={{ padding: '12px' }}>
                        <div style={{ fontWeight: '500', fontSize: '13px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                          {users.find(u => u.id === asset.uploadedBy)?.firstName || 'Unknown'} • {formatDate(asset.uploadedAt)}
                        </div>
                        <Badge status={asset.status} />
                      </div>
                    </div>
                  ))}
                </div>
                
                {selectedCategory && visibleAssets.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>No assets in this category yet</div>
                )}
              </div>
            </>
          )}
          
          {tab === 'team' && (
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', marginBottom: '20px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e' }}>
                  <h3 style={{ margin: 0, fontSize: '14px' }}>Team Members ({teamMembers.length})</h3>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {teamMembers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No team members assigned</div>
                  ) : teamMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
                      <Avatar user={m} size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '13px' }}>{isClient ? `${TEAM_ROLES[m.role]?.label || ''} ${m.firstName}` : m.name}</div>
                        {!isClient && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{m.email}</div>}
                      </div>
                      <RoleBadge role={m.role} />
                    </div>
                  ))}
                </div>
              </div>
              
              <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2e' }}>
                  <h3 style={{ margin: 0, fontSize: '14px' }}>Client Contacts ({clientContacts.length})</h3>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  {clientContacts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>No client contacts</div>
                  ) : clientContacts.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d0d14', borderRadius: '10px', marginBottom: '8px' }}>
                      <Avatar user={c} size={40} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '500', fontSize: '13px' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{c.designation} • {c.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }} className="spinner">⚙️</div>
          <div style={{ color: 'rgba(255,255,255,0.5)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e4e4e7' }}>
      <Sidebar />
      
      <div style={{ marginLeft: '250px', minHeight: '100vh' }}>
        <div style={{ height: '56px', background: '#12121a', borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
          <button onClick={() => setShowNotifications(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '18px', cursor: 'pointer', position: 'relative' }}>
            🔔
          </button>
        </div>
        
        <div style={{ padding: '24px' }}>
          {view === 'dashboard' && <Dashboard />}
          {view === 'projects' && <ProjectsList />}
          {view === 'team' && <TeamManagement />}
          {view === 'project-detail' && <ProjectDetail />}
        </div>
      </div>

      {showNotifications && (
        <Modal title="Notifications" onClose={() => setShowNotifications(false)}>
          <div style={{ textAlign: 'center', padding: '30px', color: 'rgba(255,255,255,0.4)' }}>
            No new notifications
          </div>
        </Modal>
      )}
    </div>
  );
}
