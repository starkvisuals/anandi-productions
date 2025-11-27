'use client';
import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const STATUS = {
  'pending': { label: 'Pending', bg: '#fef3c7', color: '#92400e' },
  'selected': { label: 'Selected', bg: '#dbeafe', color: '#1e40af' },
  'assigned': { label: 'Assigned', bg: '#e0e7ff', color: '#3730a3' },
  'in-progress': { label: 'In Progress', bg: '#fae8ff', color: '#86198f' },
  'review-ready': { label: 'Review Ready', bg: '#fef3c7', color: '#92400e' },
  'changes-requested': { label: 'Changes', bg: '#fee2e2', color: '#991b1b' },
  'approved': { label: 'Approved', bg: '#d1fae5', color: '#065f46' },
  'delivered': { label: 'Delivered', bg: '#cffafe', color: '#155e75' },
};

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; return 'other'; };

const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };

const StarRating = ({ rating = 0, onChange, size = 20, readonly = false }) => {
  const [hover, setHover] = useState(0);
  return <div style={{ display: 'flex', gap: '4px' }}>{[1,2,3,4,5].map(star => <span key={star} onClick={() => !readonly && onChange?.(star === rating ? 0 : star)} onMouseEnter={() => !readonly && setHover(star)} onMouseLeave={() => !readonly && setHover(0)} style={{ cursor: readonly ? 'default' : 'pointer', fontSize: size, color: star <= (hover || rating) ? '#fbbf24' : '#3a3a4a' }}>★</span>)}</div>;
};

// Get project by share token
const getProjectByShareToken = async (token) => {
  try {
    const snap = await getDocs(collection(db, 'projects'));
    const projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const p of projects) {
      const link = (p.shareLinks || []).find(l => l.token === token && l.active);
      if (link) return { project: p, link };
    }
    return null;
  } catch (e) {
    console.error('Error fetching project:', e);
    return null;
  }
};

// Update project
const updateProjectData = async (id, data) => {
  try {
    await updateDoc(doc(db, 'projects', id), data);
  } catch (e) {
    console.error('Error updating project:', e);
  }
};

export default function SharePage({ params }) {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [project, setProject] = useState(null);
  const [link, setLink] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [newFeedback, setNewFeedback] = useState('');
  const [feedbackName, setFeedbackName] = useState('');
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [toast, setToast] = useState(null);
  const [confirmingSelection, setConfirmingSelection] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef(null);

  // Get token from params
  useEffect(() => {
    const getToken = async () => {
      const p = await params;
      setToken(p.token);
    };
    getToken();
  }, [params]);

  // Check mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load project
  useEffect(() => {
    if (token) loadProject();
  }, [token]);

  const loadProject = async () => {
    try {
      const result = await getProjectByShareToken(token);
      if (!result) {
        setError('This link is invalid or has expired');
        setLoading(false);
        return;
      }
      setProject(result.project);
      setLink(result.link);
    } catch (e) {
      setError('Failed to load project');
    }
    setLoading(false);
  };

  const showToast = (msg, type = 'info') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };
  const isClient = link?.type === 'client';
  const isEditor = link?.type === 'editor';
  const cats = project?.categories || [];
  const getAssets = () => { let a = (project?.assets || []).filter(x => !x.deleted); if (selectedCat) a = a.filter(x => x.category === selectedCat); return a; };
  const assets = getAssets();
  const getCatCount = id => (project?.assets || []).filter(a => !a.deleted && a.category === id).length;
  const selectedCount = (project?.assets || []).filter(a => a.isSelected).length;

  const handleRate = async (assetId, rating) => {
    const updated = (project.assets || []).map(a => a.id === assetId ? { ...a, rating } : a);
    await updateProjectData(project.id, { assets: updated });
    setProject({ ...project, assets: updated });
    if (selectedAsset?.id === assetId) setSelectedAsset({ ...selectedAsset, rating });
  };

  const handleToggleSelect = async (assetId) => {
    const asset = (project.assets || []).find(a => a.id === assetId);
    const newSelected = !asset?.isSelected;
    const updated = (project.assets || []).map(a => a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a);
    await updateProjectData(project.id, { assets: updated });
    setProject({ ...project, assets: updated });
    if (selectedAsset?.id === assetId) setSelectedAsset({ ...selectedAsset, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' });
  };

  const handleConfirmSelection = async () => {
    setConfirmingSelection(true);
    const activity = { id: generateId(), type: 'selection', message: `Selection confirmed by ${link.name} (client)`, timestamp: new Date().toISOString() };
    await updateProjectData(project.id, { selectionConfirmed: true, activityLog: [...(project.activityLog || []), activity] });
    setProject({ ...project, selectionConfirmed: true });
    setConfirmingSelection(false);
    showToast('Selection confirmed! The team has been notified.', 'success');
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.trim() || !feedbackName.trim() || !selectedAsset) { showToast('Enter name and feedback', 'error'); return; }
    const fb = { id: generateId(), text: newFeedback, userName: feedbackName, timestamp: new Date().toISOString(), isExternal: true };
    const updated = (project.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a);
    const activity = { id: generateId(), type: 'feedback', message: `Feedback from ${feedbackName} on ${selectedAsset.name}`, timestamp: new Date().toISOString() };
    await updateProjectData(project.id, { assets: updated, activityLog: [...(project.activityLog || []), activity] });
    setProject({ ...project, assets: updated });
    setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' });
    setNewFeedback('');
    showToast('Feedback submitted!', 'success');
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    const cat = selectedCat || cats[0]?.id;
    for (const file of uploadFiles) {
      const uid = generateId();
      setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0 } }));
      try {
        const path = `projects/${project.id}/${cat}/${Date.now()}-${file.name}`;
        const sRef = ref(storage, path);
        const task = uploadBytesResumable(sRef, file);
        task.on('state_changed', snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })), () => { showToast('Failed', 'error'); }, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const newAsset = { id: generateId(), name: file.name, type: getFileType(file), category: cat, url, path, thumbnail: getFileType(file) === 'image' ? url : null, fileSize: file.size, mimeType: file.type, status: 'review-ready', uploadedBy: 'external', uploadedByName: link.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url }], currentVersion: 1, feedback: [], rating: 0 };
          const updatedAssets = [...(project.assets || []), newAsset];
          const activity = { id: generateId(), type: 'upload', message: `${link.name} uploaded ${file.name}`, timestamp: new Date().toISOString() };
          await updateProjectData(project.id, { assets: updatedAssets, activityLog: [...(project.activityLog || []), activity] });
          setProject({ ...project, assets: updatedAssets });
          setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
          showToast('Uploaded!', 'success');
        });
      } catch (e) { showToast('Failed', 'error'); }
    }
    setUploadFiles([]);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div><div>Loading...</div></div></div>;
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff', padding: '20px' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '50px', marginBottom: '16px' }}>🔗</div><h2 style={{ marginBottom: '8px' }}>Link Invalid</h2><p style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#e4e4e7' }}>
      {/* Header */}
      <div style={{ background: '#12121a', borderBottom: '1px solid #1e1e2e', padding: isMobile ? '12px 16px' : '14px 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700' }}>{project.name}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{project.client} • {isClient ? '👔 Client Review' : '🎨 Editor Upload'}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isClient && !project.selectionConfirmed && selectedCount > 0 && (
              <button onClick={handleConfirmSelection} disabled={confirmingSelection} style={{ padding: '10px 16px', background: '#f59e0b', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {confirmingSelection ? '⏳...' : `🎯 Confirm Selection (${selectedCount})`}
              </button>
            )}
            {project.selectionConfirmed && <span style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', borderRadius: '8px', fontSize: '11px', color: '#22c55e' }}>✓ Selection Confirmed</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Sidebar - Categories */}
        <div style={{ width: isMobile ? '100%' : '200px', background: '#12121a', borderRight: isMobile ? 'none' : '1px solid #1e1e2e', borderBottom: isMobile ? '1px solid #1e1e2e' : 'none', padding: '16px' }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '6px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div onClick={() => setSelectedCat(null)} style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : '#1e1e2e', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>📁 All ({(project.assets || []).length})</div>
            {cats.map(cat => <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : '#1e1e2e', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{cat.icon} {cat.name} ({getCatCount(cat.id)})</div>)}
          </div>
          {isClient && !isMobile && (
            <div style={{ marginTop: '20px', padding: '14px', background: '#1e1e2e', borderRadius: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>SELECTED</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#fbbf24' }}>{selectedCount}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>images</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: isMobile ? '12px' : '20px' }}>
          {/* Editor Upload */}
          {isEditor && (
            <div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', padding: '24px', border: '2px dashed #2a2a3e', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: '28px' }}>📤</span>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Tap to upload'}</div>
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
                </div>
                {uploadFiles.length > 0 && <button onClick={handleUpload} style={{ padding: '14px 24px', background: '#22c55e', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}>⬆️ Upload</button>}
              </div>
              {Object.keys(uploadProgress).length > 0 && <div style={{ marginTop: '12px' }}>{Object.entries(uploadProgress).map(([id, item]) => <div key={id} style={{ marginBottom: '6px' }}><div style={{ fontSize: '11px', marginBottom: '4px' }}>{item.name} - {item.progress}%</div><div style={{ background: '#0d0d14', borderRadius: '4px', height: '6px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '4px' }} /></div></div>)}</div>}
            </div>
          )}

          {/* Assets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? '10px' : '14px' }}>
            {assets.map(a => (
              <div key={a.id} style={{ background: '#16161f', borderRadius: '10px', overflow: 'hidden', border: a.isSelected ? '2px solid #22c55e' : '1px solid #1e1e2e', position: 'relative' }}>
                {a.isSelected && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#22c55e', borderRadius: '6px', padding: '4px 8px', fontSize: '10px', zIndex: 5, fontWeight: '600' }}>⭐ Selected</div>}
                <div onClick={() => setSelectedAsset(a)} style={{ cursor: 'pointer', height: isMobile ? '120px' : '160px', background: '#0d0d14' }}>
                  {a.thumbnail ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '32px' }}>{a.type === 'video' ? '🎬' : '📄'}</span></div>}
                </div>
                <div style={{ padding: isMobile ? '10px' : '12px' }}>
                  <div style={{ fontWeight: '500', fontSize: '11px', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <StarRating rating={a.rating} onChange={isClient ? r => handleRate(a.id, r) : undefined} size={isMobile ? 16 : 18} readonly={!isClient} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <Badge status={a.status} />
                    {isClient && (
                      <button onClick={(e) => { e.stopPropagation(); handleToggleSelect(a.id); }} style={{ padding: '6px 10px', background: a.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', fontWeight: '600' }}>
                        {a.isSelected ? '✓' : '☆'}
                      </button>
                    )}
                  </div>
                  {a.gdriveLink && <a href={a.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '8px', padding: '8px', background: 'rgba(34,197,94,0.15)', borderRadius: '6px', color: '#22c55e', fontSize: '10px', textAlign: 'center', textDecoration: 'none', fontWeight: '600' }}>📁 Download High-Res</a>}
                </div>
              </div>
            ))}
          </div>
          {assets.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', background: '#16161f', borderRadius: '12px' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div><div style={{ color: 'rgba(255,255,255,0.5)' }}>No assets yet</div></div>}
        </div>
      </div>

      {/* Asset Modal - Full Screen on Mobile */}
      {selectedAsset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: isMobile ? '0' : '20px' }} onClick={() => setSelectedAsset(null)}>
          <div style={{ background: '#16161f', borderRadius: isMobile ? '0' : '16px', width: '100%', maxWidth: isMobile ? '100%' : '900px', height: isMobile ? '100%' : 'auto', maxHeight: isMobile ? '100%' : '90vh', overflow: 'auto', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e2e', position: 'sticky', top: 0, background: '#16161f', zIndex: 10 }}>
              <div style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '10px' }}>{selectedAsset.name}</div>
              <button onClick={() => setSelectedAsset(null)} style={{ background: '#1e1e2e', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '8px', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Image Preview - Large */}
              <div style={{ background: '#0d0d14', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                {selectedAsset.type === 'video' ? (
                  <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: isMobile ? '300px' : '500px' }} />
                ) : selectedAsset.type === 'image' ? (
                  <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: isMobile ? '400px' : '500px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center' }}><span style={{ fontSize: '60px' }}>📄</span></div>
                )}
              </div>

              {/* Actions Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* Rating & Selection */}
                {isClient && (
                  <div style={{ background: '#0d0d14', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Your Rating</div>
                    <StarRating rating={selectedAsset.rating} onChange={r => handleRate(selectedAsset.id, r)} size={28} />
                    <button onClick={() => handleToggleSelect(selectedAsset.id)} style={{ width: '100%', marginTop: '16px', padding: '14px', background: selectedAsset.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>
                      {selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}
                    </button>
                  </div>
                )}

                {/* Details */}
                <div style={{ background: '#0d0d14', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Status</span><Badge status={selectedAsset.status} /></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Size</span><span style={{ fontSize: '12px' }}>{formatFileSize(selectedAsset.fileSize)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>Version</span><span style={{ fontSize: '12px' }}>v{selectedAsset.currentVersion}</span></div>
                  <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '16px', padding: '14px', background: '#6366f1', borderRadius: '10px', color: '#fff', fontSize: '14px', textAlign: 'center', textDecoration: 'none', fontWeight: '600' }}>⬇️ Download Preview</a>
                  {selectedAsset.gdriveLink && <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '10px', padding: '14px', background: '#22c55e', borderRadius: '10px', color: '#fff', fontSize: '14px', textAlign: 'center', textDecoration: 'none', fontWeight: '600' }}>📁 Download High-Res</a>}
                </div>
              </div>

              {/* Feedback Section */}
              {isClient && (
                <div style={{ background: '#0d0d14', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>💬 Feedback ({selectedAsset.feedback?.length || 0})</div>
                  <div style={{ maxHeight: '150px', overflow: 'auto', marginBottom: '12px' }}>
                    {(selectedAsset.feedback || []).length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>No feedback yet</div>
                    ) : (
                      (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{ padding: '10px', background: '#16161f', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600' }}>{fb.userName}</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(fb.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '12px' }}>{fb.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <input value={feedbackName} onChange={e => setFeedbackName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '12px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '14px', marginBottom: '10px', boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input value={newFeedback} onChange={e => setNewFeedback(e.target.value)} placeholder="Add your feedback..." style={{ flex: 1, padding: '12px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#fff', fontSize: '14px' }} />
                    <button onClick={handleAddFeedback} style={{ padding: '12px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: '600' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', padding: '14px 24px', background: toast.type === 'success' ? '#22c55e' : '#ef4444', borderRadius: '10px', color: '#fff', fontSize: '14px', zIndex: 2000, fontWeight: '500' }}>{toast.message}</div>}
    </div>
  );
}
