// components/workflow/blocks/UploadBlockView.js
import { useState, useRef, useCallback } from 'react';
import { storage, db } from '../../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateId } from '../../../lib/firestore';
import { generateProjectCode, generateSmartName, BLOCK_ABBR } from '../../../lib/workflow/smartName';
import { watermarkImage } from '../../../lib/workflow/watermark';

// --- helpers ---
function fmtBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function getExt(filename) {
  return filename.split('.').pop() || 'jpg';
}

// --- main component ---
export default function UploadBlockView({ project, block, actorId, isProducer, t, theme, onBlockAdvance }) {
  const [queue, setQueue] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  const maxMB = block?.config?.maxFileSizeMB || 50;
  const maxBytes = maxMB * 1024 * 1024;
  const acceptTypes = block?.config?.acceptedMimeTypes || 'image/*';

  const updateItem = useCallback((id, patch) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const uploadFile = useCallback(async (fileEntry) => {
    const { id, file, seq } = fileEntry;
    updateItem(id, { status: 'uploading' });

    // Size check
    if (file.size > maxBytes) {
      updateItem(id, { status: 'error', error: `Exceeds ${maxMB} MB limit` });
      return;
    }

    try {
      const projectCode = generateProjectCode(project.name, project.createdAt);
      const ext = getExt(file.name);
      const smartName = generateSmartName(projectCode, BLOCK_ABBR['UploadBlock'], seq, ext);
      const projectId = project.id;
      const blockId = block.id;

      // Watermark
      const watermarked = await watermarkImage(file, project.name || project.client || 'CONFIDENTIAL');
      const previewBlob = watermarked || file;

      const hiResPath = `projects/${projectId}/blocks/${blockId}/hi-res/${smartName}`;
      const previewPath = `projects/${projectId}/blocks/${blockId}/preview/${smartName}`;

      // Upload hi-res
      const hiResRef = ref(storage, hiResPath);
      const hiResTask = uploadBytesResumable(hiResRef, file);

      await new Promise((resolve, reject) => {
        hiResTask.on('state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 50);
            updateItem(id, { progress: pct });
          },
          reject,
          resolve
        );
      });
      const hiResUrl = await getDownloadURL(hiResTask.snapshot.ref);

      // Upload preview (watermarked)
      const previewRef = ref(storage, previewPath);
      const previewTask = uploadBytesResumable(previewRef, previewBlob);

      await new Promise((resolve, reject) => {
        previewTask.on('state_changed',
          (snap) => {
            const pct = 50 + Math.round((snap.bytesTransferred / snap.totalBytes) * 50);
            updateItem(id, { progress: pct });
          },
          reject,
          resolve
        );
      });
      const previewUrl = await getDownloadURL(previewTask.snapshot.ref);

      // Write asset doc
      const assetId = generateId();
      await setDoc(doc(db, 'projects', projectId, 'assets', assetId), {
        id: assetId,
        projectId,
        blockId,
        name: smartName,
        originalName: file.name,
        type: 'image',
        url: previewUrl,
        hiResUrl,
        hiResUnlocked: false,
        watermarked: true,
        size: file.size,
        mimeType: file.type,
        version: 1,
        uploadedBy: actorId,
        createdAt: serverTimestamp(),
      });

      updateItem(id, { status: 'done', progress: 100, previewUrl });
    } catch (err) {
      console.error('[UploadBlockView] upload error:', err);
      updateItem(id, { status: 'error', error: err.message || 'Upload failed' });
    }
  }, [project, block, actorId, maxBytes, maxMB, updateItem]);

  const addFiles = useCallback((files) => {
    const existing = queue.length;
    const newItems = Array.from(files).map((file, i) => ({
      id: generateId(),
      file,
      seq: existing + i + 1,
      status: 'queued',
      progress: 0,
      error: null,
      previewUrl: null,
    }));
    setQueue(q => [...q, ...newItems]);
    // Kick off uploads immediately
    newItems.forEach(item => uploadFile(item));
  }, [queue.length, uploadFile]);

  // Drag handlers
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };
  const onInputChange = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const retry = (item) => {
    updateItem(item.id, { status: 'queued', progress: 0, error: null });
    uploadFile(item);
  };

  const hasDone = queue.some(i => i.status === 'done');

  const statusColor = (s) => {
    if (s === 'done') return '#22c55e';
    if (s === 'error') return '#ef4444';
    if (s === 'uploading') return '#3b82f6';
    return '#6b7280';
  };

  const bg = t?.surface || '#1a1a1a';
  const border = t?.border || '#333';
  const text = t?.text || '#fff';
  const muted = t?.muted || '#888';

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      <h3 style={{ color: text, marginBottom: 16, fontSize: 18, fontWeight: 600 }}>
        {block?.label || 'Upload Files'}
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#3b82f6' : border}`,
          borderRadius: 12,
          padding: '40px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(59,130,246,0.08)' : bg,
          transition: 'border-color 0.15s, background 0.15s',
          marginBottom: queue.length ? 20 : 0,
        }}
      >
        <div style={{ fontSize: 32, marginBottom: 8 }}>+</div>
        <div style={{ color: text, fontWeight: 500, marginBottom: 4 }}>
          Drop files here or click to browse
        </div>
        <div style={{ color: muted, fontSize: 13 }}>
          {acceptTypes} — max {maxMB} MB per file
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptTypes}
          onChange={onInputChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* File queue */}
      {queue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {queue.map(item => (
            <div
              key={item.id}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 8,
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ color: text, fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                  {item.file.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: muted, fontSize: 12 }}>{fmtBytes(item.file.size)}</span>
                  <span style={{ color: statusColor(item.status), fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
                    {item.status}
                  </span>
                  {item.status === 'error' && (
                    <button
                      onClick={() => retry(item)}
                      style={{ fontSize: 12, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: border, borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${item.progress}%`,
                    background: item.status === 'error' ? '#ef4444' : item.status === 'done' ? '#22c55e' : '#3b82f6',
                    transition: 'width 0.2s',
                    borderRadius: 2,
                  }}
                />
              </div>

              {item.status === 'error' && item.error && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{item.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Producer: Done uploading button */}
      {isProducer && hasDone && (
        <button
          onClick={onBlockAdvance}
          style={{
            marginTop: 24,
            padding: '10px 28px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          Done uploading
        </button>
      )}
    </div>
  );
}
