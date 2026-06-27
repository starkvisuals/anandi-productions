'use client';

import { useState } from 'react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const SLOTS = [
  { key: 'ctcProof', label: 'Current CTC Proof', desc: 'Salary slip, offer letter, or appointment letter', required: false },
  { key: 'relievingLetter', label: 'Relieving Letter', desc: 'From your previous employer (if applicable)', required: false },
  { key: 'recommendationLetter', label: 'Recommendation Letter', desc: 'From a previous manager or colleague', required: false },
];

export default function DocumentUpload({ interviewId, onComplete }) {
  const [files, setFiles] = useState({});
  const [progress, setProgress] = useState({});
  const [uploadedUrls, setUploadedUrls] = useState({});
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (key, file) => {
    if (!file) return;
    setFiles(prev => ({ ...prev, [key]: file }));
    setErrors(prev => ({ ...prev, [key]: '' }));

    const ext = file.name.split('.').pop();
    const path = `documents/${interviewId}/${key}-${Date.now()}.${ext}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        setProgress(prev => ({ ...prev, [key]: pct }));
      },
      (err) => {
        console.error(`Upload failed for ${key}:`, err);
        setErrors(prev => ({ ...prev, [key]: 'Upload failed. Please try again.' }));
        setProgress(prev => ({ ...prev, [key]: 0 }));
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploadedUrls(prev => ({ ...prev, [key]: url }));
      }
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/interview/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, documents: uploadedUrls }),
      });
    } catch (err) {
      console.error('Saving document URLs failed:', err);
    } finally {
      setSubmitting(false);
      onComplete?.();
    }
  };

  const anyUploading = SLOTS.some(s => files[s.key] && !uploadedUrls[s.key] && !errors[s.key]);

  return (
    <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '16px', padding: '40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>📎</div>
        <h2 style={{ color: '#e4e4e7', fontSize: '20px', fontWeight: '700', margin: '0 0 8px' }}>Supporting Documents</h2>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: 0 }}>
          Optional, but helps us verify your background faster. You can skip this and submit anytime.
        </p>
      </div>

      {SLOTS.map(slot => (
        <div key={slot.key} style={{ marginBottom: '16px', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ color: '#e4e4e7', fontSize: '14px', fontWeight: '600' }}>{slot.label}</div>
              <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '2px' }}>{slot.desc}</div>
            </div>
            {uploadedUrls[slot.key] && <span style={{ color: '#22c55e', fontSize: '13px' }}>✓ Uploaded</span>}
          </div>

          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={e => handleFileSelect(slot.key, e.target.files?.[0])}
            disabled={progress[slot.key] > 0 && progress[slot.key] < 100}
            style={{ color: '#9ca3af', fontSize: '13px', width: '100%' }}
          />

          {files[slot.key] && !uploadedUrls[slot.key] && !errors[slot.key] && (
            <div style={{ marginTop: '8px', background: '#1e1e2e', borderRadius: '4px', height: '6px' }}>
              <div style={{ background: '#6366f1', width: `${progress[slot.key] || 0}%`, height: '6px', borderRadius: '4px', transition: 'width 0.2s' }} />
            </div>
          )}

          {errors[slot.key] && (
            <div style={{ color: '#fca5a5', fontSize: '12px', marginTop: '6px' }}>{errors[slot.key]}</div>
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={submitting || anyUploading}
        style={{
          width: '100%',
          padding: '14px',
          marginTop: '8px',
          background: (submitting || anyUploading) ? '#374151' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: '700',
          cursor: (submitting || anyUploading) ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? 'Submitting...' : anyUploading ? 'Uploading...' : 'Finish & Submit →'}
      </button>
    </div>
  );
}
