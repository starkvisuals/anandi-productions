'use client';
// app/dev/review/page.js — A1.1 test harness for ReviewCanvas.
//
// Visit /dev/review. Verify:
//   IMAGE — pick pin/rect/circle/arrow/freehand/text, draw, drop pins; select a
//           pin (it highlights); delete via the × ; zoom.
//   VIDEO — play, PAUSE, draw → item gets tagged with the timestamp (see the
//           JSON log); scrub away → the item hides; scrub back within the window
//           → it reappears; selecting an item always shows it.
// Both in dark + light (toggle top-right).

import { useState } from 'react';
import { ThemeProvider, useTheme, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import ReviewCanvas from '@/components/review/ReviewCanvas';

// Inline SVG data-URI so the harness never depends on external image hosts
// (the preview sandbox blocks them). Real app uses Firebase Storage URLs.
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
// Small, CORS-friendly sample video.
const SAMPLE_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

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
  const [imageItems, setImageItems] = useState([]);
  const [videoItems, setVideoItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const items = tab === 'image' ? imageItems : videoItems;
  const setItems = tab === 'image' ? setImageItems : setVideoItems;

  const addItem = (it) => setItems(prev => [...prev, it]);
  const updateItem = (id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  const deleteItem = (id) => { setItems(prev => prev.filter(i => i.id !== id)); if (selectedId === id) setSelectedId(null); };

  const media = tab === 'image'
    ? { type: 'image', src: SAMPLE_IMAGE }
    : { type: 'video', src: SAMPLE_VIDEO };

  const tabBtn = (id, label) => (
    <button onClick={() => { setTab(id); setSelectedId(null); }}
      style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: WEIGHT.semibold, background: tab === id ? t.accent : t.surfaceElev, color: tab === id ? t.onAccent : t.text }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'], padding: SPACE['4'], borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ fontSize: 15 }}>🧪 ReviewCanvas — A1.1</strong>
        {tabBtn('image', 'Image')}
        {tabBtn('video', 'Video')}
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: `1px solid ${t.border}`, background: t.surface, color: t.text, cursor: 'pointer', fontSize: 12 }}>
          {mode === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 300px' }}>
        <div style={{ minHeight: 0, height: 'calc(100vh - 66px)' }}>
          {/* key forces a fresh canvas when switching image/video */}
          <ReviewCanvas
            key={tab}
            media={media}
            items={items}
            onAddItem={addItem}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* Live items log (stands in for the comment sidebar coming in A1.2) */}
        <aside style={{ borderLeft: `1px solid ${t.border}`, background: t.surface, padding: SPACE['3'], overflowY: 'auto', height: 'calc(100vh - 66px)' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: t.textMuted, marginBottom: SPACE['2'] }}>{items.length} items</div>
          {items.length === 0 && <div style={{ fontSize: 12, color: t.textMuted }}>Draw on the {tab} to create items. Video items get a timestamp; scrub to see them show/hide.</div>}
          {items.map((it, i) => (
            <button key={it.id} onClick={() => setSelectedId(it.id)}
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6, padding: SPACE['2'], borderRadius: RADIUS.sm, border: `1px solid ${it.id === selectedId ? t.accent : t.border}`, background: it.id === selectedId ? `${t.accent}14` : t.surfaceElev, color: t.text, cursor: 'pointer', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: it.color, marginRight: 6, verticalAlign: 'middle' }} />
              {i + 1}. {it.type}{it.videoTimestamp != null ? ` @ ${it.videoTimestamp.toFixed(1)}s` : ''}
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
