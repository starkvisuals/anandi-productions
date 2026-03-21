'use client';
import { useState, useEffect, useRef } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import Logo from '@/components/Logo';

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
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1,2,3,4,5].map(star => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star === rating ? 0 : star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          style={{
            cursor: readonly ? 'default' : 'pointer',
            fontSize: size,
            color: star <= (hover || rating) ? '#fbbf24' : '#3a3a4a',
            transition: 'color 0.15s ease, transform 0.15s ease',
            transform: !readonly && star <= hover ? 'scale(1.15)' : 'scale(1)',
            display: 'inline-block',
            filter: star <= (hover || rating) ? 'drop-shadow(0 0 4px rgba(251,191,36,0.4))' : 'none',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
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
  const [hoveredCard, setHoveredCard] = useState(null);
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

  const FEEDBACK_MAX_LENGTH = 500;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <Logo variant="icon" size={48} theme="dark" animated />
        <div style={{ marginTop: '20px', fontSize: '14px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>Loading project...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff', padding: '20px' }}>
      <div style={{ textAlign: 'center' }}>
        <Logo variant="icon" size={48} theme="dark" />
        <div style={{ width: '48px', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)', margin: '24px auto' }} />
        <h2 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: '600' }}>Link Invalid</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>{error}</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: '#e4e4e7', display: 'flex', flexDirection: 'column' }}>
      {/* Professional Header */}
      <div style={{
        background: '#0a0a0f',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        padding: isMobile ? '12px 16px' : '14px 28px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px' }}>
            <Logo variant="full" size={36} theme="dark" />
            {!isMobile && (
              <div style={{
                height: '28px',
                width: '1px',
                background: 'rgba(99,102,241,0.25)',
              }} />
            )}
            <div>
              <div style={{
                fontSize: '10px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                color: 'rgba(99,102,241,0.8)',
                marginBottom: '2px',
              }}>
                Project Review
              </div>
              <div style={{ fontSize: isMobile ? '14px' : '15px', fontWeight: '600', color: '#fff' }}>
                {project.name}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              padding: '5px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '500',
              background: isClient ? 'rgba(99,102,241,0.12)' : 'rgba(168,85,247,0.12)',
              color: isClient ? '#818cf8' : '#c084fc',
              border: `1px solid ${isClient ? 'rgba(99,102,241,0.2)' : 'rgba(168,85,247,0.2)'}`,
            }}>
              {isClient ? 'Client Review' : 'Editor Upload'}
            </span>
            {isClient && !project.selectionConfirmed && selectedCount > 0 && (
              <button onClick={handleConfirmSelection} disabled={confirmingSelection} style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(245,158,11,0.3)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}>
                {confirmingSelection ? 'Confirming...' : `Confirm Selection (${selectedCount})`}
              </button>
            )}
            {project.selectionConfirmed && (
              <span style={{
                padding: '8px 14px',
                background: 'rgba(34,197,94,0.1)',
                borderRadius: '8px',
                fontSize: '11px',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.2)',
                fontWeight: '500',
              }}>
                Selection Confirmed
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1 }}>
        {/* Sidebar - Categories */}
        <div style={{
          width: isMobile ? '100%' : '210px',
          background: '#0e0e16',
          borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
          borderBottom: isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '4px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
            <div
              onClick={() => setSelectedCat(null)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: !selectedCat ? '600' : '400',
                background: !selectedCat ? 'rgba(99,102,241,0.12)' : 'transparent',
                color: !selectedCat ? '#fff' : 'rgba(255,255,255,0.5)',
                border: !selectedCat ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              All ({(project.assets || []).filter(a => !a.deleted).length})
            </div>
            {cats.map(cat => (
              <div
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedCat === cat.id ? '600' : '400',
                  background: selectedCat === cat.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                  color: selectedCat === cat.id ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: selectedCat === cat.id ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.icon} {cat.name} ({getCatCount(cat.id)})
              </div>
            ))}
          </div>
          {isClient && !isMobile && (
            <div style={{
              marginTop: '24px',
              padding: '16px',
              background: 'rgba(99,102,241,0.06)',
              borderRadius: '12px',
              border: '1px solid rgba(99,102,241,0.1)',
            }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Selected</div>
              <div style={{ fontSize: '28px', fontWeight: '700', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{selectedCount}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>images</div>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: isMobile ? '12px' : '24px' }}>
          {/* Editor Upload */}
          {isEditor && (
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '24px',
                  border: '2px dashed rgba(99,102,241,0.3)',
                  borderRadius: '12px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s ease, background 0.2s ease',
                  background: 'rgba(99,102,241,0.03)',
                }} onClick={() => fileInputRef.current?.click()}>
                  <span style={{ fontSize: '28px' }}>+</span>
                  <div style={{ fontSize: '12px', marginTop: '8px', color: 'rgba(255,255,255,0.5)' }}>{uploadFiles.length ? `${uploadFiles.length} files selected` : 'Tap to upload'}</div>
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => setUploadFiles(Array.from(e.target.files))} />
                </div>
                {uploadFiles.length > 0 && (
                  <button onClick={handleUpload} style={{
                    padding: '14px 24px',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: '0 2px 12px rgba(34,197,94,0.3)',
                  }}>
                    Upload
                  </button>
                )}
              </div>
              {Object.keys(uploadProgress).length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  {Object.entries(uploadProgress).map(([id, item]) => (
                    <div key={id} style={{ marginBottom: '6px' }}>
                      <div style={{ fontSize: '11px', marginBottom: '4px', color: 'rgba(255,255,255,0.6)' }}>{item.name} - {item.progress}%</div>
                      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '4px', height: '4px' }}>
                        <div style={{ width: `${item.progress}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assets Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(230px, 1fr))',
            gap: isMobile ? '10px' : '16px',
          }}>
            {assets.map(a => (
              <div
                key={a.id}
                onMouseEnter={() => setHoveredCard(a.id)}
                onMouseLeave={() => setHoveredCard(null)}
                style={{
                  background: '#111119',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: a.isSelected
                    ? '2px solid rgba(99,102,241,0.6)'
                    : '1px solid rgba(255,255,255,0.06)',
                  position: 'relative',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  transform: hoveredCard === a.id ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: a.isSelected
                    ? '0 0 20px rgba(99,102,241,0.15)'
                    : hoveredCard === a.id
                      ? '0 8px 24px rgba(0,0,0,0.4)'
                      : '0 2px 8px rgba(0,0,0,0.2)',
                }}
              >
                {a.isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '10px',
                    zIndex: 5,
                    fontWeight: '600',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                  }}>
                    Selected
                  </div>
                )}
                <div onClick={() => setSelectedAsset(a)} style={{
                  cursor: 'pointer',
                  height: isMobile ? '120px' : '170px',
                  background: '#0a0a0f',
                  overflow: 'hidden',
                }}>
                  {a.thumbnail ? (
                    <img src={a.thumbnail} alt="" style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease',
                      transform: hoveredCard === a.id ? 'scale(1.05)' : 'scale(1)',
                    }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '32px', opacity: 0.5 }}>{a.type === 'video' ? '▶' : '◻'}</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: isMobile ? '10px' : '14px' }}>
                  <div style={{
                    fontWeight: '500',
                    fontSize: '12px',
                    marginBottom: '8px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: '#fff',
                  }}>
                    {a.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <StarRating rating={a.rating} onChange={isClient ? r => handleRate(a.id, r) : undefined} size={isMobile ? 14 : 16} readonly={!isClient} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <Badge status={a.status} />
                    {isClient && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleSelect(a.id); }}
                        style={{
                          padding: '6px 12px',
                          background: a.isSelected
                            ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                            : 'rgba(255,255,255,0.06)',
                          border: a.isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {a.isSelected ? '✓' : 'Select'}
                      </button>
                    )}
                  </div>
                  {a.gdriveLink && (
                    <a href={a.gdriveLink} target="_blank" rel="noopener noreferrer" style={{
                      display: 'block',
                      marginTop: '10px',
                      padding: '8px',
                      background: 'rgba(34,197,94,0.08)',
                      borderRadius: '8px',
                      color: '#22c55e',
                      fontSize: '10px',
                      textAlign: 'center',
                      textDecoration: 'none',
                      fontWeight: '600',
                      border: '1px solid rgba(34,197,94,0.15)',
                    }}>
                      Download High-Res
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {assets.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.3 }}>&#9744;</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No assets yet</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '24px 20px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        marginTop: 'auto',
      }}>
        <div style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.25)',
          letterSpacing: '0.5px',
        }}>
          Powered by Anandi Productions
        </div>
      </div>

      {/* Asset Modal - Full Screen on Mobile */}
      {selectedAsset && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '0' : '20px',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }} onClick={() => setSelectedAsset(null)}>
          <div style={{
            background: '#111119',
            borderRadius: isMobile ? '0' : '16px',
            width: '100%',
            maxWidth: isMobile ? '100%' : '900px',
            height: isMobile ? '100%' : 'auto',
            maxHeight: isMobile ? '100%' : '90vh',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            border: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              position: 'sticky',
              top: 0,
              background: '#111119',
              zIndex: 10,
            }}>
              <div style={{ fontWeight: '600', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '10px' }}>{selectedAsset.name}</div>
              <button onClick={() => setSelectedAsset(null)} style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                fontSize: '18px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}>
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              {/* Image Preview - Large */}
              <div style={{ background: '#0a0a0f', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
                {selectedAsset.type === 'video' ? (
                  <video src={selectedAsset.url} controls style={{ width: '100%', maxHeight: isMobile ? '300px' : '500px' }} />
                ) : selectedAsset.type === 'image' ? (
                  <img src={selectedAsset.url} alt="" style={{ width: '100%', maxHeight: isMobile ? '400px' : '500px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ padding: '60px', textAlign: 'center' }}><span style={{ fontSize: '60px', opacity: 0.3 }}>&#9744;</span></div>
                )}
              </div>

              {/* Actions Row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* Rating & Selection */}
                {isClient && (
                  <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '12px',
                    padding: '20px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Your Rating</div>
                    <StarRating rating={selectedAsset.rating} onChange={r => handleRate(selectedAsset.id, r)} size={28} />
                    <button onClick={() => handleToggleSelect(selectedAsset.id)} style={{
                      width: '100%',
                      marginTop: '16px',
                      padding: '14px',
                      background: selectedAsset.isSelected
                        ? 'linear-gradient(135deg, #6366f1, #a855f7)'
                        : 'rgba(255,255,255,0.06)',
                      border: selectedAsset.isSelected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                      boxShadow: selectedAsset.isSelected ? '0 4px 16px rgba(99,102,241,0.3)' : 'none',
                    }}>
                      {selectedAsset.isSelected ? '✓ Selected' : 'Mark as Selected'}
                    </button>
                  </div>
                )}

                {/* Details */}
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Status</span>
                    <Badge status={selectedAsset.status} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Size</span>
                    <span style={{ fontSize: '12px' }}>{formatFileSize(selectedAsset.fileSize)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Version</span>
                    <span style={{ fontSize: '12px' }}>v{selectedAsset.currentVersion}</span>
                  </div>
                  <a href={selectedAsset.url} download target="_blank" rel="noopener noreferrer" style={{
                    display: 'block',
                    marginTop: '16px',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    textAlign: 'center',
                    textDecoration: 'none',
                    fontWeight: '600',
                    boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
                  }}>
                    Download Preview
                  </a>
                  {selectedAsset.gdriveLink && (
                    <a href={selectedAsset.gdriveLink} target="_blank" rel="noopener noreferrer" style={{
                      display: 'block',
                      marginTop: '10px',
                      padding: '14px',
                      background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '14px',
                      textAlign: 'center',
                      textDecoration: 'none',
                      fontWeight: '600',
                      boxShadow: '0 2px 12px rgba(34,197,94,0.3)',
                    }}>
                      Download High-Res
                    </a>
                  )}
                </div>
              </div>

              {/* Feedback Section */}
              {isClient && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>Feedback</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: '600',
                      background: 'rgba(99,102,241,0.12)',
                      color: '#818cf8',
                    }}>
                      {selectedAsset.feedback?.length || 0}
                    </span>
                  </div>
                  <div style={{ maxHeight: '160px', overflow: 'auto', marginBottom: '16px' }}>
                    {(selectedAsset.feedback || []).length === 0 ? (
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', textAlign: 'center', padding: '20px' }}>No feedback yet. Be the first to share your thoughts.</div>
                    ) : (
                      (selectedAsset.feedback || []).map(fb => (
                        <div key={fb.id} style={{
                          padding: '12px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '10px',
                          marginBottom: '8px',
                          border: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: '#818cf8' }}>{fb.userName}</span>
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{formatTimeAgo(fb.timestamp)}</span>
                          </div>
                          <div style={{ fontSize: '12px', lineHeight: '1.5', color: 'rgba(255,255,255,0.7)' }}>{fb.text}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <input
                    value={feedbackName}
                    onChange={e => setFeedbackName(e.target.value)}
                    placeholder="Your name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      marginBottom: '10px',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.15s ease',
                    }}
                  />
                  <div style={{ position: 'relative' }}>
                    <textarea
                      value={newFeedback}
                      onChange={e => {
                        if (e.target.value.length <= FEEDBACK_MAX_LENGTH) {
                          setNewFeedback(e.target.value);
                        }
                      }}
                      placeholder="Share your feedback on this asset..."
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        paddingBottom: '28px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '13px',
                        boxSizing: 'border-box',
                        outline: 'none',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        lineHeight: '1.5',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '12px',
                      fontSize: '10px',
                      color: newFeedback.length > FEEDBACK_MAX_LENGTH * 0.9
                        ? '#f59e0b'
                        : 'rgba(255,255,255,0.25)',
                    }}>
                      {newFeedback.length}/{FEEDBACK_MAX_LENGTH}
                    </div>
                  </div>
                  <button
                    onClick={handleAddFeedback}
                    style={{
                      marginTop: '12px',
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '13px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      width: isMobile ? '100%' : 'auto',
                    }}
                  >
                    Submit Feedback
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '14px 24px',
          background: toast.type === 'success'
            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
            : 'linear-gradient(135deg, #ef4444, #dc2626)',
          borderRadius: '12px',
          color: '#fff',
          fontSize: '13px',
          zIndex: 2000,
          fontWeight: '500',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
