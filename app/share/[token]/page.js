'use client';
import { useState, useEffect, useRef } from 'react';
import { use } from 'react';
import { getProjectByShareToken, updateProject, generateId, STATUS, TEAM_ROLES } from '@/lib/firestore';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const formatDate = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '';
const formatTimeAgo = d => { if (!d) return ''; const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000); if (s < 60) return 'Just now'; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
const formatFileSize = b => { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(1) + ' MB'; };
const getFileType = f => { if (f.type?.startsWith('video/')) return 'video'; if (f.type?.startsWith('image/')) return 'image'; if (f.type?.startsWith('audio/')) return 'audio'; return 'other'; };

const Badge = ({ status }) => { const s = STATUS[status]; return s ? <span style={{ padding: '4px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: '600', background: s.bg, color: s.color }}>{s.label}</span> : null; };
const Modal = ({ title, onClose, children }) => <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose}><div style={{ background: '#16161f', borderRadius: '12px', border: '1px solid #1e1e2e', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1e1e2e' }}><h3 style={{ margin: 0, fontSize: '15px' }}>{title}</h3><button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '20px', cursor: 'pointer' }}>×</button></div><div style={{ padding: '20px' }}>{children}</div></div></div>;

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
  const fileInputRef = useRef(null);

  useEffect(() => { loadProject(); }, [token]);

  const loadProject = async () => {
    try {
      const result = await getProjectByShareToken(token);
      if (!result) { setError('Link expired or invalid'); setLoading(false); return; }
      setProject(result.project);
      setLink(result.link);
    } catch (e) { setError('Failed to load'); }
    setLoading(false);
  };

  const showToast = (msg, type = 'info') => { setToast({ message: msg, type }); setTimeout(() => setToast(null), 3000); };
  const isClient = link?.type === 'client';
  const isEditor = link?.type === 'editor';
  const cats = project?.categories || [];
  const getAssets = () => { let a = (project?.assets || []).filter(x => !x.deleted); if (selectedCat) a = a.filter(x => x.category === selectedCat); return a; };
  const assets = getAssets();
  const getCatCount = id => (project?.assets || []).filter(a => !a.deleted && a.category === id).length;

  const handleAddFeedback = async () => {
    if (!newFeedback.trim() || !feedbackName.trim() || !selectedAsset) { showToast('Enter name and feedback', 'error'); return; }
    const fb = { id: generateId(), text: newFeedback, userName: feedbackName, timestamp: new Date().toISOString(), isExternal: true };
    const updated = (project.assets || []).map(a => a.id === selectedAsset.id ? { ...a, feedback: [...(a.feedback || []), fb], status: 'changes-requested' } : a);
    const activity = { id: generateId(), type: 'feedback', message: `External feedback on ${selectedAsset.name} by ${feedbackName}`, timestamp: new Date().toISOString() };
    await updateProject(project.id, { assets: updated, activityLog: [...(project.activityLog || []), activity] });
    setProject({ ...project, assets: updated });
    setSelectedAsset({ ...selectedAsset, feedback: [...(selectedAsset.feedback || []), fb], status: 'changes-requested' });
    setNewFeedback('');
    showToast('Feedback submitted!', 'success');
  };

  const handleUpload = async () => {
    if (!uploadFiles.length) return;
    const cat = selectedCat || cats[0]?.id;
    if (!cat) { showToast('Select category', 'error'); return; }
    
    for (const file of uploadFiles) {
      const uid = generateId();
      setUploadProgress(p => ({ ...p, [uid]: { name: file.name, progress: 0 } }));
      try {
        const path = `projects/${project.id}/${cat}/${Date.now()}-${file.name}`;
        const sRef = ref(storage, path);
        const task = uploadBytesResumable(sRef, file);
        task.on('state_changed', 
          snap => setUploadProgress(p => ({ ...p, [uid]: { ...p[uid], progress: Math.round((snap.bytesTransferred / snap.totalBytes) * 100) } })),
          () => { showToast(`Failed: ${file.name}`, 'error'); setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; }); },
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            const newAsset = { id: generateId(), name: file.name, type: getFileType(file), category: cat, url, path, thumbnail: getFileType(file) === 'image' ? url : null, fileSize: file.size, mimeType: file.type, status: 'review-ready', uploadedBy: 'external', uploadedByName: link.name, uploadedAt: new Date().toISOString(), versions: [{ version: 1, url, uploadedAt: new Date().toISOString() }], currentVersion: 1, feedback: [] };
            const updatedAssets = [...(project.assets || []), newAsset];
            const activity = { id: generateId(), type: 'upload', message: `${link.name} uploaded ${file.name}`, timestamp: new Date().toISOString() };
            await updateProject(project.id, { assets: updatedAssets, activityLog: [...(project.activityLog || []), activity] });
            setProject({ ...project, assets: updatedAssets });
            setUploadProgress(p => { const n = { ...p }; delete n[uid]; return n; });
            showToast(`Uploaded: ${file.name}`, 'success');
          }
        );
      } catch (e) { showToast(`Failed: ${file.name}`, 'error'); }
    }
    setUploadFiles([]);
  };

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div><div>Loading...</div></div></div>;
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d14', color: '#fff' }}><div style={{ textAlign: 'center' }}><div style={{ fontSize: '50px', marginBottom: '16px' }}>🔗</div><h2>Link Invalid</h2><p style={{ color: 'rgba(255,255,255,0.5)' }}>{error}</p></div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d14', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#e4e4e7' }}>
      {/* Header */}
      <div style={{ background: '#12121a', borderBottom: '1px solid #1e1e2e', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700' }}>{project.name}</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{project.client} • {isClient ? '👔 Client View' : '🎨 Editor View'}</div>
        </div>
        <div style={{ padding: '8px 16px', background: isClient ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)', borderRadius: '6px', fontSize: '12px', color: isClient ? '#22c55e' : '#6366f1' }}>{link.name}</div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: '200px', background: '#12121a', borderRight: '1px solid #1e1e2e', minHeight: 'calc(100vh - 60px)', padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginBottom: '10px' }}>CATEGORIES</div>
          <div onClick={() => setSelectedCat(null)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: !selectedCat ? 'rgba(99,102,241,0.15)' : 'transparent', color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
            📁 All ({(project.assets || []).length})
          </div>
          {cats.map(cat => (
            <div key={cat.id} onClick={() => setSelectedCat(cat.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', background: selectedCat === cat.id ? 'rgba(99,102,241,0.15)' : 'transparent', color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
              {cat.icon} {cat.name} ({getCatCount(cat.id)})
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '20px' }}>
          {/* Editor Upload Section */}
          {isEditor && (
            <div style={{ background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '20px', border: '2px dashed #2a2a3e', borderRadius: '8px', cursor: 'pointer' }} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: '24px' }}>📤</span>
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Click to upload'}</div>
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
                </div>
                {uploadFiles.length > 0 && <button onClick={handleUpload} style={{ padding: '12px 20px', background: '#22c55e', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: '600', cursor: 'pointer' }}>⬆️ Upload</button>}
              </div>
              {Object.keys(uploadProgress).length > 0 && <div style={{ marginTop: '12px' }}>{Object.entries(uploadProgress).map(([id, item]) => <div key={id} style={{ marginBottom: '6px' }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span>{item.name}</span><span>{item.progress}%</span></div><div style={{ background: '#0d0d14', borderRadius: '2px', height: '4px' }}><div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: '2px' }} /></div></div>)}</div>}
            </div>
          )}

          {/* Assets Grid */}
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '16px' }}>{selectedCat ? cats.find(c => c.id === selectedCat)?.name : 'All Assets'} ({assets.length})</div>
          {assets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#16161f', borderRadius: '10px', border: '1px solid #1e1e2e' }}>
              <div style={{ fontSize: '50px', marginBottom: '16px' }}>📂</div>
              <p style={{ color: 'rgba(255,255,255,0.5)' }}>No assets yet</p>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Badge status={a.status} /><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>v{a.currentVersion}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Asset Preview Modal */}
      {selectedAsset && (
        <Modal title={selectedAsset.name} onClose={() => setSelectedAsset(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 250px', gap: '20px' }}>
            <div>
              <div style={{ background: '#0d0d14', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
                {selectedAsset.type === 'video' ? <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: '350px' }} /> :
                 selectedAsset.type === 'audio' ? <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '60px', marginBottom: '16px' }}>🔊</div><audio src={selectedAsset.url} controls style={{ width: '100%' }} /></div> :
                 selectedAsset.type === 'image' ? <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: '350px', objectFit: 'contain' }} /> :
                 <div style={{ padding: '40px', textAlign: 'center' }}><div style={{ fontSize: '60px' }}>📄</div></div>}
              </div>
              {/* Feedback */}
              {isClient && (
                <div style={{ background: '#0d0d14', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px' }}>💬 Feedback ({selectedAsset.feedback?.length || 0})</div>
                  <div style={{ maxHeight: '120px', overflow: 'auto', marginBottom: '10px' }}>
                    {(selectedAsset.feedback || []).map(fb => (
                      <div key={fb.id} style={{ padding: '8px', background: '#16161f', borderRadius: '6px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span style={{ fontSize: '11px', fontWeight: '500' }}>{fb.userName} {fb.isExternal && <span style={{ color: '#6366f1' }}>•</span>}</span><span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{formatTimeAgo(fb.timestamp)}</span></div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)' }}>{fb.text}</div>
                      </div>
                    ))}
                    {(selectedAsset.feedback || []).length === 0 && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>No feedback yet</div>}
                  </div>
                  <input value={feedbackName} onChange={e => setFeedbackName(e.target.value)} placeholder="Your name" style={{ width: '100%', padding: '8px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '12px', marginBottom: '8px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input value={newFeedback} onChange={e => setNewFeedback(e.target.value)} placeholder="Add your feedback..." style={{ flex: 1, padding: '8px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '6px', color: '#fff', fontSize: '12px' }} />
                    <button onClick={handleAddFeedback} style={{ padding: '8px 14px', background: '#6366f1', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer' }}>Send</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <div style={{ marginBottom: '12px' }}><Badge status={selectedAsset.status} /></div>
              <div style={{ background: '#0d0d14', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Size</span><span>{formatFileSize(selectedAsset.fileSize)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Version</span><span>v{selectedAsset.currentVersion}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}><span style={{ color: 'rgba(255,255,255,0.5)' }}>Uploaded</span><span>{formatDate(selectedAsset.uploadedAt)}</span></div>
              </div>
              <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px', background: '#22c55e', borderRadius: '6px', color: '#fff', fontSize: '12px', fontWeight: '600', textAlign: 'center', textDecoration: 'none' }}>⬇️ Download</a>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '12px 20px', background: toast.type === 'success' ? '#22c55e' : toast.type === 'error' ? '#ef4444' : '#3b82f6', borderRadius: '8px', color: '#fff', fontSize: '13px', zIndex: 2000 }}>{toast.message}</div>}
    </div>
  );
}
