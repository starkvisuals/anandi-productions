'use client';
import { useState, useMemo } from 'react';

const DEFAULT_CATEGORIES = [
  { id: 'cgi', name: 'CGI', icon: '🧊', color: '#3b82f6' },
  { id: 'animation', name: 'Animation', icon: '🎬', color: '#a855f7' },
  { id: 'statics', name: 'Statics', icon: '📷', color: '#ec4899' },
  { id: 'videos', name: 'Videos', icon: '🎥', color: '#f97316' },
  { id: 'vfx', name: 'VFX', icon: '✨', color: '#10b981' },
  { id: 'audio', name: 'Audio', icon: '🎵', color: '#06b6d4' },
];

const PROJECT_TYPES = [
  { value: 'photoshoot', label: 'Photoshoot' },
  { value: 'ad-film', label: 'Ad Film' },
  { value: 'toolkit', label: 'Toolkit' },
  { value: 'product-video', label: 'Product Video' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'corporate', label: 'Corporate Video' },
  { value: 'music-video', label: 'Music Video' },
  { value: 'brand-film', label: 'Brand Film' },
  { value: 'reels', label: 'Reels/Shorts' },
  { value: 'ecommerce', label: 'E-Commerce' },
  { value: 'event', label: 'Event Coverage' },
  { value: 'documentary', label: 'Documentary' },
];

const BUILT_IN_TEMPLATES = [
  { id: 'photoshoot-basic', name: 'Basic Photoshoot', type: 'photoshoot', categories: ['statics'], workflow: 'direct', maxRevisions: 3, turnaroundHours: 24, formats: ['jpeg'], sizes: [] },
  { id: 'photoshoot-full', name: 'Full Photoshoot', type: 'photoshoot', categories: ['statics', 'videos'], workflow: 'standard', maxRevisions: 3, turnaroundHours: 24, formats: ['jpeg', 'tiff'], sizes: ['1080p'] },
  { id: 'ad-film', name: 'Ad Film', type: 'ad-film', categories: ['videos', 'vfx', 'audio', 'cgi'], workflow: 'agency', maxRevisions: 5, turnaroundHours: 48, formats: ['mp4', 'mov', 'psd'], sizes: ['4k', '1080p'] },
  { id: 'product-video', name: 'Product Video', type: 'product-video', categories: ['videos', 'cgi'], workflow: 'standard', maxRevisions: 3, turnaroundHours: 24, formats: ['mp4', 'mov'], sizes: ['1080p'] },
  { id: 'social-media', name: 'Social Media Pack', type: 'social-media', categories: ['statics', 'videos'], workflow: 'direct', maxRevisions: 2, turnaroundHours: 12, formats: ['jpeg', 'png', 'mp4'], sizes: ['1080p', 'instagram-square', 'story'] },
  { id: 'reels', name: 'Reels/Shorts', type: 'reels', categories: ['videos'], workflow: 'direct', maxRevisions: 2, turnaroundHours: 12, formats: ['mp4'], sizes: ['story'] },
];

const DELIVERABLE_FORMATS = [
  { id: 'jpeg', label: 'JPEG', icon: '🖼' },
  { id: 'tiff', label: 'TIFF', icon: '🖼' },
  { id: 'png', label: 'PNG', icon: '🖼' },
  { id: 'psd', label: 'PSD', icon: '🎨' },
  { id: 'mp4', label: 'MP4', icon: '🎬' },
  { id: 'mov', label: 'MOV', icon: '🎬' },
  { id: 'wav', label: 'WAV', icon: '🎵' },
  { id: 'mp3', label: 'MP3', icon: '🎵' },
];

const SIZE_PRESETS = [
  { id: '4k', label: '4K (3840×2160)' },
  { id: '1080p', label: '1080p (1920×1080)' },
  { id: '720p', label: '720p (1280×720)' },
  { id: 'instagram-square', label: 'Instagram Square (1080×1080)' },
  { id: 'story', label: 'Story/Reels (1080×1920)' },
  { id: 'facebook-cover', label: 'Facebook Cover (820×312)' },
  { id: 'youtube-thumb', label: 'YouTube Thumbnail (1280×720)' },
];

const THEMES = {
  dark: {
    bg: '#0a0a0f', bgSecondary: '#111118', bgTertiary: '#18181f', bgCard: '#1e1e28',
    bgInput: '#0d0d12', bgHover: '#252530', border: '#2a2a3a', borderLight: '#1e1e2e',
    text: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)', textMuted: 'rgba(255,255,255,0.4)',
    primary: '#6366f1', primaryHover: '#5558dd', success: '#22c55e', warning: '#f59e0b',
    danger: '#ef4444', accent: '#a855f7', modalBg: '#14141c',
  },
  light: {
    bg: '#f5f7fa', bgSecondary: '#ffffff', bgTertiary: '#f0f2f5', bgCard: '#ffffff',
    bgInput: '#f8f9fb', bgHover: '#e8eaed', border: '#e0e3e8', borderLight: '#ebedf0',
    text: '#111827', textSecondary: '#4b5563', textMuted: '#9ca3af',
    primary: '#6366f1', primaryHover: '#5558dd', success: '#16a34a', warning: '#d97706',
    danger: '#dc2626', accent: '#9333ea', modalBg: '#ffffff',
  },
};

const STEP_LABELS = ['Basics', 'Workflow', 'Teams', 'Deliverables', 'Summary'];

export default function CreateProjectModal({ onClose, onCreate, theme = 'dark', teamMembers = [], savedTemplates = [] }) {
  const t = THEMES[theme];
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('photoshoot');
  const [deadline, setDeadline] = useState('');
  const [selectedCats, setSelectedCats] = useState(['statics']);
  const [templateId, setTemplateId] = useState('');

  // Step 2: Workflow
  const [workflowType, setWorkflowType] = useState('standard');
  const [maxRevisions, setMaxRevisions] = useState(3);
  const [autoTurnaround, setAutoTurnaround] = useState(true);
  const [turnaroundHours, setTurnaroundHours] = useState(24);
  const [approvalChain, setApprovalChain] = useState('producer-client');

  // Step 3: Teams
  const [teamGroups, setTeamGroups] = useState([]);
  const [individuals, setIndividuals] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // Step 4: Deliverables
  const [formats, setFormats] = useState([]);
  const [sizes, setSizes] = useState([]);

  // Step 5: Summary
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const allTemplates = useMemo(() => [...BUILT_IN_TEMPLATES, ...savedTemplates], [savedTemplates]);

  const applyTemplate = (tplId) => {
    setTemplateId(tplId);
    if (!tplId) return;
    const tpl = allTemplates.find(t => t.id === tplId);
    if (!tpl) return;
    setType(tpl.type || 'photoshoot');
    setSelectedCats(tpl.categories || ['statics']);
    setWorkflowType(tpl.workflow || 'standard');
    setMaxRevisions(tpl.maxRevisions || 3);
    setTurnaroundHours(tpl.turnaroundHours || 24);
    setFormats(tpl.formats || []);
    setSizes(tpl.sizes || []);
  };

  const canProceed = () => {
    if (step === 0) return name.trim() && client.trim();
    return true;
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const chainMap = {
        'producer': ['producer'],
        'producer-client': ['producer', 'client'],
        'producer-agency-client': ['producer', 'agency', 'client'],
      };
      await onCreate({
        name: name.trim(),
        client: client.trim(),
        type,
        deadline,
        categories: DEFAULT_CATEGORIES.filter(c => selectedCats.includes(c.id)),
        workflowType,
        maxRevisions,
        autoTurnaround,
        turnaroundHours,
        approvalChain: chainMap[approvalChain] || ['producer', 'client'],
        teamGroups,
        individuals,
        deliverableFormats: formats,
        deliverableSizes: sizes,
        saveAsTemplate,
        templateName: saveAsTemplate ? templateName : null,
        templateId: templateId || null,
      });
      onClose();
    } catch (e) {
      console.error('Create failed:', e);
    }
    setCreating(false);
  };

  const filteredMembers = useMemo(() => {
    if (!teamSearch) return teamMembers;
    const q = teamSearch.toLowerCase();
    return teamMembers.filter(m => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q));
  }, [teamMembers, teamSearch]);

  const addTeamGroup = () => {
    if (!newGroupName.trim()) return;
    setTeamGroups([...teamGroups, { id: Date.now().toString(), name: newGroupName.trim(), members: [], leadId: null }]);
    setNewGroupName('');
    setAddingGroup(false);
  };

  const removeTeamGroup = (id) => setTeamGroups(teamGroups.filter(g => g.id !== id));

  const addMemberToGroup = (groupId, member) => {
    setTeamGroups(teamGroups.map(g => g.id === groupId && !g.members.some(m => m.id === member.id) ? { ...g, members: [...g.members, member] } : g));
  };

  const removeMemberFromGroup = (groupId, memberId) => {
    setTeamGroups(teamGroups.map(g => g.id === groupId ? { ...g, members: g.members.filter(m => m.id !== memberId), leadId: g.leadId === memberId ? null : g.leadId } : g));
  };

  const setGroupLead = (groupId, memberId) => {
    setTeamGroups(teamGroups.map(g => g.id === groupId ? { ...g, leadId: memberId } : g));
  };

  const toggleIndividual = (member) => {
    setIndividuals(prev => prev.some(m => m.id === member.id) ? prev.filter(m => m.id !== member.id) : [...prev, member]);
  };

  const toggleFormat = (id) => setFormats(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  const toggleSize = (id) => setSizes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleCat = (id) => setSelectedCats(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);

  // Shared input style
  const inputStyle = { width: '100%', padding: '10px 14px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '10px', color: t.text, fontSize: '13px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s' };
  const labelStyle = { display: 'block', fontSize: '11px', color: t.textMuted, marginBottom: '6px', fontWeight: '500', letterSpacing: '0.3px', textTransform: 'uppercase' };
  const cardStyle = { background: `${t.bgCard}CC`, backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: `1px solid ${t.border}`, borderRadius: '12px', padding: '16px' };
  const chipStyle = (active, color) => ({ padding: '7px 14px', background: active ? `${color}25` : t.bgInput, border: `1px solid ${active ? color : t.border}`, borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: active ? color : t.textSecondary, transition: 'all 0.15s', fontWeight: active ? '600' : '400' });

  // ── Step Renderers ──

  const renderBasics = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Template selector */}
      <div style={cardStyle}>
        <label style={labelStyle}>Start from template</label>
        <select value={templateId} onChange={e => applyTemplate(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">Start from scratch</option>
          <optgroup label="Built-in Templates">
            {BUILT_IN_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
          {savedTemplates.length > 0 && <optgroup label="Your Templates">
            {savedTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Project Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., RasikaD Summer Campaign" style={inputStyle} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
        </div>
        <div>
          <label style={labelStyle}>Client *</label>
          <input value={client} onChange={e => setClient(e.target.value)} placeholder="e.g., Brand Name" style={inputStyle} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label style={labelStyle}>Project Type</label>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            {PROJECT_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Deadline</label>
          <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Categories</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DEFAULT_CATEGORIES.map(cat => (
            <div key={cat.id} onClick={() => toggleCat(cat.id)} style={chipStyle(selectedCats.includes(cat.id), cat.color)}>
              {cat.icon} {cat.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderWorkflow = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Workflow Type Cards */}
      <div>
        <label style={labelStyle}>Workflow Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            { id: 'direct', label: 'Direct', desc: 'Producer → Client', icon: '→', color: '#22c55e' },
            { id: 'standard', label: 'Standard', desc: 'Producer → Teams → Client', icon: '⇉', color: '#6366f1' },
            { id: 'agency', label: 'Agency', desc: 'Producer → Teams → Agency → Client', icon: '⇶', color: '#f59e0b' },
          ].map(wf => (
            <div key={wf.id} onClick={() => setWorkflowType(wf.id)} style={{
              ...cardStyle,
              cursor: 'pointer',
              borderColor: workflowType === wf.id ? wf.color : t.border,
              background: workflowType === wf.id ? `${wf.color}12` : `${t.bgCard}CC`,
              textAlign: 'center',
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px', opacity: 0.8 }}>{wf.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: workflowType === wf.id ? wf.color : t.text, marginBottom: '4px' }}>{wf.label}</div>
              <div style={{ fontSize: '10px', color: t.textMuted, lineHeight: '1.4' }}>{wf.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Revision Rounds */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Max Revision Rounds</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={() => setMaxRevisions(Math.max(1, maxRevisions - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer', fontSize: '16px' }}>−</button>
              <span style={{ fontSize: '18px', fontWeight: '700', color: t.primary, minWidth: '24px', textAlign: 'center' }}>{maxRevisions}</span>
              <button onClick={() => setMaxRevisions(Math.min(10, maxRevisions + 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.bgInput, border: `1px solid ${t.border}`, color: t.text, cursor: 'pointer', fontSize: '16px' }}>+</button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Auto-Turnaround</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div onClick={() => setAutoTurnaround(!autoTurnaround)} style={{ width: '40px', height: '22px', borderRadius: '11px', background: autoTurnaround ? t.success : t.bgInput, border: `1px solid ${autoTurnaround ? t.success : t.border}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: autoTurnaround ? '21px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </div>
              {autoTurnaround && (
                <select value={turnaroundHours} onChange={e => setTurnaroundHours(Number(e.target.value))} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: '12px' }}>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>72 hours</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval Chain */}
      <div>
        <label style={labelStyle}>Final Approval</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'producer', label: 'Producer only', desc: 'You give final sign-off' },
            { id: 'producer-client', label: 'Producer + Client', desc: 'Client must approve before delivery' },
            { id: 'producer-agency-client', label: 'Producer + Agency + Client', desc: 'Agency reviews before client sees it' },
          ].map(chain => (
            <div key={chain.id} onClick={() => setApprovalChain(chain.id)} style={{
              display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
              background: approvalChain === chain.id ? `${t.primary}15` : t.bgInput,
              border: `1px solid ${approvalChain === chain.id ? t.primary : t.border}`,
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${approvalChain === chain.id ? t.primary : t.textMuted}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {approvalChain === chain.id && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.primary }} />}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: t.text }}>{chain.label}</div>
                <div style={{ fontSize: '11px', color: t.textMuted }}>{chain.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTeams = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '12px', color: t.textMuted, lineHeight: '1.5' }}>
        Add named team groups (e.g., "CGI Team", "Retouching") or assign individuals directly. You can always change this later.
      </div>

      {/* Team Groups */}
      {teamGroups.map(group => (
        <div key={group.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: t.text }}>{group.name}</span>
            <button onClick={() => removeTeamGroup(group.id)} style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
          </div>
          {/* Members in group */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {group.members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: t.bgInput, borderRadius: '20px', fontSize: '11px', color: t.text }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: `${t.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' }}>{m.name?.[0]}</span>
                {m.name}
                {group.leadId === m.id && <span style={{ fontSize: '9px', background: `${t.warning}30`, color: t.warning, padding: '1px 5px', borderRadius: '4px' }}>Lead</span>}
                <span onClick={() => setGroupLead(group.id, m.id)} style={{ cursor: 'pointer', fontSize: '10px', color: t.textMuted }} title="Set as lead">⭐</span>
                <span onClick={() => removeMemberFromGroup(group.id, m.id)} style={{ cursor: 'pointer', color: t.textMuted, fontSize: '13px' }}>×</span>
              </div>
            ))}
            {group.members.length === 0 && <span style={{ fontSize: '11px', color: t.textMuted }}>No members yet</span>}
          </div>
          {/* Add member to group */}
          <div style={{ position: 'relative' }}>
            <input placeholder="Search team members..." value={teamSearch} onChange={e => setTeamSearch(e.target.value)} style={{ ...inputStyle, fontSize: '11px', padding: '7px 10px' }} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => { setTimeout(() => setTeamSearch(''), 200); e.target.style.borderColor = t.border; }} />
            {teamSearch && filteredMembers.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: `${t.bgCard}F5`, backdropFilter: 'blur(16px)', border: `1px solid ${t.border}`, borderRadius: '10px', maxHeight: '150px', overflowY: 'auto', zIndex: 10, padding: '4px' }}>
                {filteredMembers.filter(m => !group.members.some(gm => gm.id === m.id)).slice(0, 8).map(m => (
                  <div key={m.id} onMouseDown={() => { addMemberToGroup(group.id, m); setTeamSearch(''); }} style={{ padding: '8px 10px', fontSize: '12px', color: t.text, borderRadius: '6px', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = t.bgHover} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    {m.name} <span style={{ color: t.textMuted, fontSize: '10px' }}>{m.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add Group */}
      {addingGroup ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Team group name..." style={{ ...inputStyle, flex: 1 }} autoFocus onKeyDown={e => e.key === 'Enter' && addTeamGroup()} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />
          <button onClick={addTeamGroup} style={{ padding: '8px 16px', background: t.primary, border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>Add</button>
          <button onClick={() => { setAddingGroup(false); setNewGroupName(''); }} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingGroup(true)} style={{ padding: '10px', background: `${t.primary}10`, border: `1px dashed ${t.primary}50`, borderRadius: '10px', color: t.primary, fontSize: '12px', cursor: 'pointer', fontWeight: '500', transition: 'all 0.15s' }}>
          + Add Team Group
        </button>
      )}

      {/* Or Individual Assignment */}
      <div>
        <label style={{ ...labelStyle, marginTop: '8px' }}>Or assign individuals directly</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {teamMembers.slice(0, 20).map(m => {
            const selected = individuals.some(i => i.id === m.id);
            return (
              <div key={m.id} onClick={() => toggleIndividual(m)} style={{
                padding: '6px 12px', borderRadius: '20px', fontSize: '11px', cursor: 'pointer',
                background: selected ? `${t.primary}20` : t.bgInput,
                border: `1px solid ${selected ? t.primary : t.border}`,
                color: selected ? t.primary : t.textSecondary,
                transition: 'all 0.15s',
              }}>
                {m.name}
              </div>
            );
          })}
          {teamMembers.length === 0 && <span style={{ fontSize: '11px', color: t.textMuted }}>No team members available</span>}
        </div>
      </div>
    </div>
  );

  const renderDeliverables = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ fontSize: '12px', color: t.textMuted, lineHeight: '1.5' }}>
        Optional: set file format and size requirements. Editors will see these as a checklist before marking work complete.
      </div>

      <div>
        <label style={labelStyle}>Required Formats</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {DELIVERABLE_FORMATS.map(f => (
            <div key={f.id} onClick={() => toggleFormat(f.id)} style={chipStyle(formats.includes(f.id), t.primary)}>
              {f.icon} {f.label}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Required Sizes / Resolutions</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SIZE_PRESETS.map(s => (
            <div key={s.id} onClick={() => toggleSize(s.id)} style={chipStyle(sizes.includes(s.id), t.accent)}>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSummary = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Summary cards */}
      <div style={cardStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div><span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>Project</span><div style={{ fontSize: '14px', fontWeight: '600', color: t.text, marginTop: '2px' }}>{name}</div></div>
          <div><span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>Client</span><div style={{ fontSize: '14px', fontWeight: '600', color: t.text, marginTop: '2px' }}>{client}</div></div>
          <div><span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>Type</span><div style={{ fontSize: '13px', color: t.textSecondary, marginTop: '2px' }}>{PROJECT_TYPES.find(p => p.value === type)?.label}</div></div>
          <div><span style={{ fontSize: '10px', color: t.textMuted, textTransform: 'uppercase' }}>Deadline</span><div style={{ fontSize: '13px', color: deadline ? t.textSecondary : t.textMuted, marginTop: '2px' }}>{deadline || 'Not set'}</div></div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>Workflow</div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '12px', color: t.text }}><span style={{ color: t.textMuted }}>Type: </span><span style={{ fontWeight: '600', textTransform: 'capitalize' }}>{workflowType}</span></div>
          <div style={{ fontSize: '12px', color: t.text }}><span style={{ color: t.textMuted }}>Rounds: </span><span style={{ fontWeight: '600' }}>{maxRevisions}</span></div>
          <div style={{ fontSize: '12px', color: t.text }}><span style={{ color: t.textMuted }}>Turnaround: </span><span style={{ fontWeight: '600' }}>{autoTurnaround ? `${turnaroundHours}hr` : 'Off'}</span></div>
          <div style={{ fontSize: '12px', color: t.text }}><span style={{ color: t.textMuted }}>Approval: </span><span style={{ fontWeight: '600' }}>{approvalChain.replace(/-/g, ' → ')}</span></div>
        </div>
      </div>

      {selectedCats.length > 0 && (
        <div style={cardStyle}>
          <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>Categories</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {selectedCats.map(id => { const cat = DEFAULT_CATEGORIES.find(c => c.id === id); return cat ? <span key={id} style={{ padding: '4px 10px', background: `${cat.color}20`, color: cat.color, borderRadius: '6px', fontSize: '11px' }}>{cat.icon} {cat.name}</span> : null; })}
          </div>
        </div>
      )}

      {(teamGroups.length > 0 || individuals.length > 0) && (
        <div style={cardStyle}>
          <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>Team</div>
          {teamGroups.map(g => <div key={g.id} style={{ fontSize: '12px', color: t.text, marginBottom: '4px' }}><span style={{ fontWeight: '600' }}>{g.name}:</span> {g.members.map(m => m.name).join(', ') || 'No members'}</div>)}
          {individuals.length > 0 && <div style={{ fontSize: '12px', color: t.text }}><span style={{ fontWeight: '600' }}>Individuals:</span> {individuals.map(i => i.name).join(', ')}</div>}
        </div>
      )}

      {(formats.length > 0 || sizes.length > 0) && (
        <div style={cardStyle}>
          <div style={{ fontSize: '11px', color: t.textMuted, marginBottom: '8px', textTransform: 'uppercase', fontWeight: '500' }}>Deliverables</div>
          {formats.length > 0 && <div style={{ fontSize: '12px', color: t.text, marginBottom: '4px' }}><span style={{ color: t.textMuted }}>Formats: </span>{formats.map(f => f.toUpperCase()).join(', ')}</div>}
          {sizes.length > 0 && <div style={{ fontSize: '12px', color: t.text }}><span style={{ color: t.textMuted }}>Sizes: </span>{sizes.map(s => SIZE_PRESETS.find(p => p.id === s)?.label || s).join(', ')}</div>}
        </div>
      )}

      {/* Save as template */}
      <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div onClick={() => setSaveAsTemplate(!saveAsTemplate)} style={{ width: '40px', height: '22px', borderRadius: '11px', background: saveAsTemplate ? t.primary : t.bgInput, border: `1px solid ${saveAsTemplate ? t.primary : t.border}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: saveAsTemplate ? '21px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: t.text, fontWeight: '500' }}>Save as template for reuse</div>
          {saveAsTemplate && <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name..." style={{ ...inputStyle, marginTop: '8px', fontSize: '12px', padding: '8px 10px' }} onFocus={e => e.target.style.borderColor = t.primary} onBlur={e => e.target.style.borderColor = t.border} />}
        </div>
      </div>
    </div>
  );

  const stepRenderers = [renderBasics, renderWorkflow, renderTeams, renderDeliverables, renderSummary];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div style={{ background: t.modalBg, borderRadius: '16px', border: `1px solid ${t.border}`, width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}`, background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 100%)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: t.text }}>Create Project</h3>
            <button onClick={onClose} style={{ background: 'rgba(128,128,128,0.15)', border: 'none', color: t.textSecondary, width: '32px', height: '32px', borderRadius: '50%', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
            {STEP_LABELS.map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < STEP_LABELS.length - 1 ? 1 : 'none' }}>
                <div onClick={() => { if (i < step || (i <= step)) setStep(i); }} style={{
                  width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: '600', cursor: i <= step ? 'pointer' : 'default', transition: 'all 0.2s', flexShrink: 0,
                  background: i < step ? t.success : i === step ? t.primary : t.bgInput,
                  color: i <= step ? '#fff' : t.textMuted,
                  border: `2px solid ${i < step ? t.success : i === step ? t.primary : t.border}`,
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: '10px', color: i === step ? t.text : t.textMuted, marginLeft: '6px', fontWeight: i === step ? '600' : '400', whiteSpace: 'nowrap' }}>{label}</div>
                {i < STEP_LABELS.length - 1 && <div style={{ flex: 1, height: '2px', background: i < step ? t.success : t.border, margin: '0 8px', transition: 'background 0.2s' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', background: t.bgSecondary }}>
          {stepRenderers[step]()}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: t.modalBg }}>
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()} style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textSecondary, fontSize: '13px', cursor: 'pointer' }}>
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step < 4 && step > 1 && (
              <button onClick={() => setStep(4)} style={{ padding: '9px 18px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '8px', color: t.textMuted, fontSize: '12px', cursor: 'pointer' }}>
                Skip to summary
              </button>
            )}
            {step < 4 ? (
              <button onClick={() => setStep(step + 1)} disabled={!canProceed()} style={{
                padding: '9px 22px', background: canProceed() ? `linear-gradient(135deg, ${t.primary}, ${t.accent})` : t.bgInput,
                border: 'none', borderRadius: '8px', color: canProceed() ? '#fff' : t.textMuted,
                fontSize: '13px', fontWeight: '500', cursor: canProceed() ? 'pointer' : 'not-allowed', transition: 'all 0.15s',
              }}>
                Next
              </button>
            ) : (
              <button onClick={handleCreate} disabled={creating || !name.trim() || !client.trim()} style={{
                padding: '9px 26px', background: creating ? t.bgInput : `linear-gradient(135deg, ${t.success}, #16a34a)`,
                border: 'none', borderRadius: '8px', color: '#fff',
                fontSize: '13px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}>
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
