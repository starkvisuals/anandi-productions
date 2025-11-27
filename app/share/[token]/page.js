'use client';
import { useState, useEffect, useRef } from 'react';
import { use } from 'react';
import { getProjectByShareToken, updateProject, generateId, STATUS } from '@/lib/firestore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d)) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; return 'other'; };

const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const Modal = ({ title, onClose, children }) => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}><div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid #1e1e2e' }}><h3 style={{ margin: 0, fontSize: '14px' }}>{title}</h3><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '18px', cursor: 'pointer' }}>×</button></div><div style={{ padding: '18px' }}>{children}</div></div></div>;
const StarRating = ({ rating = 0, onChange, size = 16, readonly = false }) => {
  const [hover, setHover] = useState(0);
  return <div style={{ display: 'flex', gap: '2px' }}>{[1,2,3,4,5].map(star => <span key={star} onClick={() => !readonly && onChange?.(star === rating ? 0 : star)} onMouseEnter={() => !readonly && setHover(star)} onMouseLeave={() => !readonly && setHover(0)} style={{ cursor: readonly ? 'default' : 'pointer', fontSize: size, color: star <= (hover || rating) ? '#fbbf24' : '#3a3a4a' }}>★</span>)}</div>;
};

export default function SharePage({ params }) {
  const { token } = use(params);
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
  const fileInputRef = useRef(null);

  useEffect(() => { loadProject(); }, [token]);
  const loadProject = async () => { try { const result = await getProjectByShareToken(token); if (!result) { setError('Link expired'); setLoading(false); return; } setProject(result.project); setLink(result.link); } catch (e) { setError('Failed to load'); } setLoading(false); };
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
    await updateProject(project.id, { assets: updated });
    setProject({ ...project, assets: updated });
    if (selectedAsset?.id === assetId) setSelectedAsset({ ...selectedAsset, rating });
  };

  const handleToggleSelect = async (assetId) => {
    const asset = (project.assets || []).find(a => a.id === assetId);
    const newSelected = !asset?.isSelected;
    const updated = (project.assets || []).map(a => a.id === assetId ? { ...a, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' } : a);
    await updateProject(project.id, { assets: updated });
    setProject({ ...project, assets: updated });
    if (selectedAsset?.id === assetId) setSelectedAsset({ ...selectedAsset, isSelected: newSelected, status: newSelected ? 'selected' : 'pending' });
  };

  const handleConfirmSelection = async () => {
    setConfirmingSelection(true);
    const activity = { id: generateId(), type: 'selection', message: `Selection confirmed by ${link.name} (client)`, timestamp: new Date().toISOString() };
    await updateProject(project.id, { selectionConfirmed: true, activityLog: [...(project.activityLog || []), activity] });
    setProject({ ...project, selectionConfirmed: true });
    setConfirmingSelection(false);
    showToast('Selection confirmed! The team has been notified.', 'success');
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.trim() || !feedbackName.trim() || !selectedAsset) { showToast('Enter name and feedback', 'error'); return; }
    const fb = { id: generateId(), text: newFeedback, userName: feedbackName, timestamp: new Date().toISOString(), isExternal: true };
    const updated = (project.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a);
    const activity = { id: generateId(), type: 'feedback', message: `Feedback from ${feedbackName} on ${selectedAsset.name}`, timestamp: new Date().toISOString() };
    await updateProject(project.id, { assets: updated, activityLog: [...(project.activityLog || []), activity] });
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
          await updateProject(project.id, { assets: updatedAssets, activityLog: [...(project.activityLog || []), activity] });
          setProject({ ...project, assets: updatedAssets });
          setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
          showToast('Uploaded!', 'success');
        });
      } catch (e) { showToast('Failed', 'error'); }
    }
    setUploadFiles([]);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff' }}><div>⏳ Loading...</div></div>;
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '50px', marginBottom: '16px' }}>🔗</div><h2>Link Invalid</h2><p style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#e4e4e7' }}>
      {/* Header */}
      <div style={{ background: '#12121a', borderBottom: '1px solid #1e1e2e', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div style={{ fontSize: '16px', fontWeight: '700' }}>{project.name}</div><div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{project.client} • {isClient ? '👔 Client Review' : '🎨 Editor Upload'}</div></div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isClient && !project.selectionConfirmed && selectedCount > 0 && (
            <button onClick={handleConfirmSelection} disabled={confirmingSelection} style={{ padding: '8px 16px', background: '#f59e0b', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              {confirmingSelection ? '⏳...' : `🎯 Confirm Selection (${selectedCount})`}
            </button>
          )}
          {project.selectionConfirmed && <span style={{ padding: '6px 12px', background: 'rgba(34,197,94,0.15)', borderRadius: '6px', fontSize: '10px', color: '#22c55e' }}>✓ Selection Confirmed</span>}
          <span style={{ padding: '6px 12px', background: isClient ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', borderRadius: '6px', fontSize: '10px', color: isClient ? '#22c55e' : '#6366f1' }}>{link.name}</span>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: '180px', background: '#12121a', borderRight: '1px solid #1e1e2e', minHeight: 'calc(100vh - 56px)', padding: '14px' }}>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: '8px' }}>CATEGORIES</div>
          <div onClick={() => setSelectedCat(null)} style={{ padding: '8px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>📁 All ({(project.assets || []).length})</div>
          {cats.map(cat => <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ padding: '8px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>{cat.icon} {cat.name} ({getCatCount(cat.id)})</div>)}
          {isClient && <div style={{ marginTop: '16px', padding: '10px', background: '#1e1e2e', borderRadius: '8px' }}><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>SELECTION</div><div style={{ fontSize: '18px', fontWeight: '700', color: '#fbbf24' }}>{selectedCount}</div><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>images selected</div></div>}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '16px' }}>
          {/* Editor Upload */}
          {isEditor && (
            <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '14px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '20px', border: '2px dashed #2a2a3e', borderRadius: '8px', textAlign: 'center', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: '24px' }}>📤</span><div style={{ fontSize: '11px', marginTop: '6px' }}>{uploadFiles.length ? `${uploadFiles.length} files` : 'Click to upload'}</div>
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
                </div>
                {uploadFiles.length > 0 && <button onClick={handleUpload} style={{ padding: '10px 18px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>⬆️ Upload</button>}
              </div>
              {Object.keys(uploadProgress).length > 0 && <div style={{ marginTop: '10px' }}>{Object.entries(uploadProgress).map(([id, item]) => <div key={id}><div style={{ fontSize: '10px' }}>{item.name} - {item.progress}%</div><div style={{ background: '#0d0d14', borderRadius: '2px', height: '3px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1' }} /></div></div>)}</div>}
            </div>
          )}

          {/* Assets Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {assets.map(a => (
              <div key={a.id} style={{ background: '#16161f', borderRadius: '8px', overflow: 'hidden', border: a.isSelected ? '2px solid #22c55e' : '1px solid #1e1e2e', position: 'relative' }}>
                {a.isSelected && <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#22c55e', borderRadius: '4px', padding: '2px 5px', fontSize: '8px', zIndex: 5 }}>⭐ Selected</div>}
                <div onClick={() => setSelectedAsset(a)} style={{ cursor: 'pointer', height: '140px', background: '#0d0d14' }}>
                  {a.thumbnail ? <img src={a.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: '28px' }}>{a.type === 'video' ? '🎬' : '📄'}</span></div>}
                </div>
                <div style={{ padding: '8px' }}>
                  <div style={{ fontWeight: '500', fontSize: '10px', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <StarRating rating={a.rating} onChange={isClient ? r => handleRate(a.id, r) : undefined} size={12} readonly={!isClient} />
                    <Badge status={a.status} />
                  </div>
                  {isClient && (
                    <button onClick={() => handleToggleSelect(a.id)} style={{ width: '100%', marginTop: '6px', padding: '5px', background: a.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '9px', cursor: 'pointer' }}>
                      {a.isSelected ? '✓ Selected' : '☆ Select'}
                    </button>
                  )}
                  {a.gdriveLink && <a href={a.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '6px', padding: '5px', background: 'rgba(34,197,94,0.15)', borderRadius: '4px', color: '#22c55e', fontSize: '9px', textAlign: 'center', textDecoration: 'none' }}>📁 Download High-Res</a>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Asset Modal */}
      {selectedAsset && (
        <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px' }}>
            <div>
              <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden', marginBottom: '12px' }}>
                {selectedAsset.type === 'video' ? <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: '320px' }} /> : selectedAsset.type === 'image' ? <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain' }} /> : <div style={{ padding: '40px', textAlign: 'center' }}>📄</div>}
              </div>
              {isClient && (
                <div style={{ background: '#0d0d14', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '8px' }}>💬 Feedback</div>
                  <div style={{ maxHeight: '100px', overflow: 'auto', marginBottom: '8px' }}>
                    {(selectedAsset.feedback || []).map(fb => <div key={fb.id} style={{ padding: '6px', background: '#16161f', borderRadius: '5px', marginBottom: '4px' }}><div style={{ fontSize: '9px', fontWeight: '500' }}>{fb.userName}</div><div style={{ fontSize: '10px' }}>{fb.text}</div></div>)}
                  </div>
                  <input value={feedbackName} onChange={e => setFeedbackName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '6px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '5px', color: '#fff', fontSize: '10px', marginBottom: '6px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input value={newFeedback} onChange={e => setNewFeedback(e.target.value)} placeholder="Add feedback..." style={{ flex: 1, padding: '6px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '5px', color: '#fff', fontSize: '10px' }} />
                    <button onClick={handleAddFeedback} style={{ padding: '6px 12px', background: '#6366f1', border: 'none', borderRadius: '5px', color: '#fff', fontSize: '10px', cursor: 'pointer' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              {isClient && (
                <>
                  <div style={{ marginBottom: '10px' }}><div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Rating</div><StarRating rating={selectedAsset.rating} onChange={r => handleRate(selectedAsset.id, r)} size={18} /></div>
                  <button onClick={() => handleToggleSelect(selectedAsset.id)} style={{ width: '100%', padding: '8px', background: selectedAsset.isSelected ? '#22c55e' : '#1e1e2e', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '10px', cursor: 'pointer', marginBottom: '10px' }}>{selectedAsset.isSelected ? '⭐ Selected' : '☆ Mark as Selected'}</button>
                </>
              )}
              <div style={{ background: '#0d0d14', borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}><span style={{ opacity: 0.5 }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}><span style={{ opacity: 0.5 }}>Version</span><span>v{selectedAsset.currentVersion}</span></div>
              </div>
              <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px', background: '#6366f1', borderRadius: '6px', color: '#fff', fontSize: '10px', textAlign: 'center', textDecoration: 'none', marginBottom: '8px' }}>⬇️ Download Preview</a>
              {selectedAsset.gdriveLink && <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '8px', background: '#22c55e', borderRadius: '6px', color: '#fff', fontSize: '10px', textAlign: 'center', textDecoration: 'none' }}>📁 Download High-Res</a>}
            </div>
          </div>
        </Modal>
      )}

      {toast && <div style={{ position: 'fixed', bottom: '20px', right: '20px', padding: '12px 18px', background: toast.type === 'success' ? '#22c55e' : '#ef4444', borderRadius: '8px', color: '#fff', fontSize: '12px', zIndex: 2000 }}>{toast.message}</div>}
    </div>
  );
}
