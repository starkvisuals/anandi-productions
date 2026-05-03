'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getProjectBlocks } from '@/lib/workflow/helpers';
import UploadBlockView from '@/components/workflow/blocks/UploadBlockView';

const THEMES = {
  dark: {
    bg: '#0a0a0f',
    bgCard: '#1e1e28',
    bgInput: '#0d0d12',
    border: '#2a2a3a',
    borderLight: '#1e1e2e',
    text: '#ffffff',
    textSecondary: 'rgba(255,255,255,0.7)',
    textMuted: 'rgba(255,255,255,0.4)',
    primary: '#6366f1',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    accent: '#a855f7',
    cardRadius: '12px',
    shadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
};

export default function PhotographerUploadPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [block, setBlock] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const q = query(collection(db, 'projects'), where('photographerUploadToken', '==', token));
        const snap = await getDocs(q);
        if (snap.empty) {
          setErrorMsg('Invalid or expired link');
          setLoading(false);
          return;
        }
        const projectDoc = snap.docs[0];
        const projectData = { ...projectDoc.data(), id: projectDoc.id };
        setProject(projectData);

        const blocks = await getProjectBlocks(db, projectData.id);
        const uploadBlock = blocks.find(
          b => b.type === 'UploadBlock' && b.variant === 'raws' && b.status !== 'done'
        );
        if (!uploadBlock) {
          setErrorMsg('Upload period has ended.');
          setLoading(false);
          return;
        }
        setBlock(uploadBlock);
      } catch (err) {
        console.error('[PhotographerUploadPage] error:', err);
        setErrorMsg('Failed to load upload page.');
      }
      setLoading(false);
    })();
  }, [token]);

  const t = THEMES.dark;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>
      <div style={{ textAlign: 'center', color: t.textMuted, fontSize: 14 }}>Loading...</div>
    </div>
  );

  if (errorMsg) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.bg, color: t.text, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', padding: 20 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: t.text }}>{errorMsg}</h2>
        <p style={{ color: t.textMuted, fontSize: 14 }}>Please contact the production team if you think this is a mistake.</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', color: t.text }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.5px', color: t.primary, marginBottom: 2 }}>
            Photographer Upload
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: t.text }}>
            {project.name}
            {project.client && <span style={{ color: t.textMuted, fontWeight: 400, marginLeft: 8, fontSize: 14 }}>— {project.client}</span>}
          </div>
        </div>
      </div>

      {/* Upload block */}
      <UploadBlockView
        project={project}
        block={block}
        actorId="photographer"
        isProducer={false}
        t={{ surface: t.bgCard, border: t.border, text: t.text, muted: t.textMuted }}
        theme="dark"
        onBlockAdvance={() => {}}
      />
    </div>
  );
}
