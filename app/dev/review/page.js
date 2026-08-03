'use client';
// app/dev/review/page.js — test harness for the review loop (A1.4).
//
// Visit /dev/review. It mounts <ReviewViewer> (canvas + timeline + comment rail)
// around a single asset per tab and just persists asset patches back to state —
// the same contract MainApp's lightbox will use (A1.5).
//
// Verify:
//   IMAGE — draw pins/shapes → they become comments in the rail; the seeded
//           legacy annotation (green circle) shows on the canvas but NOT in the
//           rail (annotations[] stays readable); edit/resolve/delete; @mention.
//   VIDEO — real local clip (24s): play, PAUSE, annotate → tagged with the
//           timestamp; timeline markers seek + select; timecode chips seek.
// Both in dark + light (toggle top-right).

import { useState } from 'react';
import { ThemeProvider, useTheme, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import ReviewViewer from '@/components/review/ReviewViewer';

// Inline SVG data-URI so the harness never depends on external image hosts.
const SAMPLE_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
       <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0f172a"/>
       </linearGradient></defs>
       <rect width="1200" height="800" fill="url(#g)"/>
       <circle cx="380" cy="300" r="120" fill="#FACC15" opacity="0.9"/>
       <rect x="640" y="360" width="360" height="240" rx="16" fill="#f472b6" opacity="0.85"/>
       <text x="600" y="720" font-family="sans-serif" font-size="34" fill="#94a3b8" text-anchor="middle">Sample frame — draw / drop a pin</text>
     </svg>`
  );
// Real local clip (24s), served same-origin by Next so it actually plays here.
const SAMPLE_VIDEO = '/dev-sample.mp4';

// Seeded video comments: spread timecodes, one general note, one pin (numbered),
// one resolved (dimmed). Their timestamps (3 / 12.5 / 24s) fit the 24s clip.
const SEED_VIDEO_COMMENTS = [
  { id: 'seed-pin', type: 'pin', x: 32, y: 38, color: '#FACC15', videoTimestamp: 3, author: 'You', text: 'Logo lands a beat too early', createdAt: '2026-08-03T10:00:00.000Z' },
  { id: 'seed-note', type: 'general', color: '#3B82F6', videoTimestamp: 12.5, author: 'Riya', text: 'Music swell hits perfectly here', createdAt: '2026-08-03T10:01:00.000Z' },
  { id: 'seed-rect', type: 'rect', x: 18, y: 20, width: 34, height: 24, color: '#EF4444', videoTimestamp: 23, author: 'You', text: 'Grade runs too warm on skin', createdAt: '2026-08-03T10:02:00.000Z', resolved: true },
];

// A legacy annotations[] entry (pre-unification drawing) to prove it stays
// readable on the canvas without appearing in the comment rail.
const LEGACY_IMAGE_ANNOTATIONS = [
  { id: 'legacy-1', type: 'circle', x: 52, y: 26, width: 22, height: 22, color: '#22C55E', createdAt: '2026-07-01T09:00:00.000Z' },
];

const MENTIONABLES = [{ id: 'u1', name: 'Harnesh' }, { id: 'u2', name: 'Riya' }, { id: 'u3', name: 'Kimiko' }];

export default function DevReviewPage() {
  const [mode, setMode] = useState('dark');
  return (
    <ThemeProvider initial={mode} sync={false} key={mode}>
      <Shell mode={mode} setMode={setMode} />
    </ThemeProvider>
  );
}

function Shell({ mode, setMode }) {
  const { t } = useTheme();
  const [tab, setTab] = useState('image');

  const [imageAsset, setImageAsset] = useState({
    id: 'img', type: 'image', url: SAMPLE_IMAGE, feedback: [], annotations: LEGACY_IMAGE_ANNOTATIONS,
  });
  const [videoAsset, setVideoAsset] = useState({
    id: 'vid', type: 'video', url: SAMPLE_VIDEO, feedback: SEED_VIDEO_COMMENTS, annotations: [],
  });

  const isVideo = tab === 'video';
  const asset = isVideo ? videoAsset : imageAsset;
  const setAsset = isVideo ? setVideoAsset : setImageAsset;
  const updateAsset = (patch) => setAsset(prev => ({ ...prev, ...patch }));

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)}
      style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: WEIGHT.semibold, background: tab === id ? t.accent : t.surfaceElev, color: tab === id ? t.onAccent : t.text }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'], padding: SPACE['4'], borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ fontSize: 15 }}>🧪 ReviewViewer — A1.4</strong>
        {tabBtn('image', 'Image')}
        {tabBtn('video', 'Video')}
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: `1px solid ${t.border}`, background: t.surface, color: t.text, cursor: 'pointer', fontSize: 12 }}>
          {mode === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, height: 'calc(100vh - 66px)' }}>
        {/* key remounts the viewer per asset so view state resets on tab switch */}
        <ReviewViewer
          key={tab}
          asset={asset}
          onUpdateAsset={updateAsset}
          currentUser={{ id: 'me', name: 'You' }}
          mentionables={MENTIONABLES}
        />
      </div>
    </div>
  );
}
