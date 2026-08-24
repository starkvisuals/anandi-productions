'use client';
// app/dev/storage-cleanup/page.js — reclaim Firebase Storage from DELETED assets.
//
// Why: the app soft-deletes assets (sets a.deleted=true) but never removes their
// files, so deleted assets keep eating storage → quota-exceeded (see docs).
// This tool frees that space SAFELY:
//   • DRY-RUN first — lists every file it would delete + total size. Nothing is
//     touched until you type DELETE and confirm.
//   • Only files that belong EXCLUSIVELY to deleted assets (a URL still used by
//     any non-deleted asset is skipped — never deletes a live file).
//   • Only Firebase Storage URLs (Mux / external links are ignored).
//
// Run it logged in as an admin. It reads every project, so needs read access.

import { useState } from 'react';
import { ref, deleteObject, getMetadata } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { getProjects } from '@/lib/firestore';

const FILE_KEYS = ['url', 'thumbnail', 'thumbnailUrl', 'preview', 'previewUrl', 'hiResUrl'];
const isFirebaseUrl = (u) =>
  typeof u === 'string' && (u.includes('firebasestorage') || u.includes('appspot.com') || u.startsWith('gs://'));

function assetFileUrls(a) {
  const urls = [];
  FILE_KEYS.forEach((k) => { if (a[k]) urls.push(a[k]); });
  (a.versions || []).forEach((v) => FILE_KEYS.forEach((k) => { if (v[k]) urls.push(v[k]); }));
  return urls.filter(isFirebaseUrl);
}
const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function StorageCleanupPage() {
  const [status, setStatus] = useState('idle'); // idle | scanning | ready | deleting | done
  const [items, setItems] = useState([]); // { url, asset, project, size?, state? }
  const [summary, setSummary] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [log, setLog] = useState('');

  const scan = async () => {
    setStatus('scanning'); setItems([]); setSummary(null); setLog('Loading all projects…');
    try {
      const projects = await getProjects();
      const liveUrls = new Set();
      const deletedRefs = []; // { url, asset, project }
      let deletedAssetCount = 0;
      for (const p of projects) {
        for (const a of (p.assets || [])) {
          const urls = assetFileUrls(a);
          if (a.deleted) {
            deletedAssetCount++;
            urls.forEach((u) => deletedRefs.push({ url: u, asset: a.name || a.id, project: p.name || p.id }));
          } else {
            urls.forEach((u) => liveUrls.add(u));
          }
        }
      }
      // Exclusive-to-deleted, de-duped.
      const seen = new Set();
      const reclaim = [];
      for (const r of deletedRefs) {
        if (liveUrls.has(r.url) || seen.has(r.url)) continue; // safety: skip anything a live asset uses
        seen.add(r.url);
        reclaim.push({ ...r, size: null, state: 'pending' });
      }
      setLog(`Found ${deletedAssetCount} deleted assets → ${reclaim.length} reclaimable files. Fetching sizes…`);
      // Sizes (best-effort; missing files just show 0).
      let total = 0;
      for (const it of reclaim) {
        try { const m = await getMetadata(ref(storage, it.url)); it.size = m.size || 0; total += it.size; }
        catch { it.size = 0; it.state = 'missing'; }
      }
      setItems(reclaim);
      setSummary({ deletedAssetCount, files: reclaim.length, totalBytes: total });
      setStatus('ready');
      setLog(`Dry-run complete. ${reclaim.length} files, ~${fmtMB(total)} reclaimable. Nothing deleted yet.`);
    } catch (e) {
      setStatus('idle'); setLog(`Scan failed: ${e.message}`);
    }
  };

  const runDelete = async () => {
    if (confirm !== 'DELETE') return;
    setStatus('deleting');
    let freed = 0, ok = 0, fail = 0;
    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      const it = updated[i];
      try {
        await deleteObject(ref(storage, it.url));
        it.state = 'deleted'; freed += it.size || 0; ok++;
      } catch (e) {
        it.state = e.code === 'storage/object-not-found' ? 'gone' : 'error'; if (it.state === 'gone') ok++; else fail++;
      }
      if (i % 5 === 0) { setItems([...updated]); setLog(`Deleting… ${i + 1}/${updated.length}`); }
    }
    setItems(updated);
    setStatus('done');
    setLog(`Done. Removed ${ok} files (~${fmtMB(freed)}). ${fail ? `${fail} errors — check the list.` : 'No errors.'}`);
  };

  const totalMB = summary ? fmtMB(summary.totalBytes) : '—';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>🧹 Storage cleanup — reclaim deleted-asset files</h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 0 }}>
          Frees Firebase Storage held by soft-deleted assets. Dry-run first — nothing is deleted until you type DELETE and confirm.
        </p>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '18px 0' }}>
          <button onClick={scan} disabled={status === 'scanning' || status === 'deleting'}
            style={{ padding: '10px 16px', borderRadius: 8, border: 'none', background: '#FACC15', color: '#0A0A0A', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {status === 'scanning' ? 'Scanning…' : '1 · Scan (dry-run)'}
          </button>
          {summary && (
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
              {summary.deletedAssetCount} deleted assets · <strong>{summary.files} files</strong> · <strong style={{ color: '#FACC15' }}>~{totalMB}</strong> reclaimable
            </span>
          )}
        </div>

        {log && <div style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: 16 }}>{log}</div>}

        {status === 'ready' && summary && summary.files > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '14px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#fca5a5' }}>Permanent. Type <strong>DELETE</strong> to enable:</span>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE"
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 13, width: 120 }} />
            <button onClick={runDelete} disabled={confirm !== 'DELETE'}
              style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: confirm === 'DELETE' ? '#ef4444' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, cursor: confirm === 'DELETE' ? 'pointer' : 'not-allowed', fontSize: 13 }}>
              2 · Delete {summary.files} files (~{totalMB})
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.4)', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ flex: 2 }}>Project / Asset</span><span style={{ width: 90 }}>Size</span><span style={{ width: 80 }}>State</span>
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 12, padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)' }}>
                  <span style={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.project} · <span style={{ color: '#fff' }}>{it.asset}</span></span>
                  <span style={{ width: 90, color: 'rgba(255,255,255,0.5)' }}>{it.size ? fmtMB(it.size) : (it.state === 'missing' ? '—' : '…')}</span>
                  <span style={{ width: 80, color: it.state === 'deleted' ? '#22c55e' : it.state === 'error' ? '#ef4444' : it.state === 'gone' || it.state === 'missing' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.5)' }}>{it.state}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'ready' && summary && summary.files === 0 && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>✅ Nothing to reclaim — no orphaned files from deleted assets.</div>
        )}
      </div>
    </div>
  );
}
