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

import { useState, useRef } from 'react';
import { ThemeProvider, useTheme, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import ReviewCanvas from '@/components/review/ReviewCanvas';
import CommentSidebar from '@/components/review/CommentSidebar';
import VideoTimeline from '@/components/review/VideoTimeline';

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
// Small, CORS-friendly sample video. (The preview sandbox blocks external media,
// so real playback / duration won't load here — the timeline below is exercised
// with the seeded comments + DEMO_DURATION instead. Real app uses Mux/Storage.)
const SAMPLE_VIDEO = 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
const DEMO_DURATION = 30; // seconds — stands in for real metadata in the sandbox

// Seeded video comments so the timeline markers are demonstrable offline:
// spread timecodes, one general note, one pin (numbered), one resolved (dimmed).
const SEED_VIDEO_COMMENTS = [
  { id: 'seed-pin', type: 'pin', x: 32, y: 38, color: '#FACC15', videoTimestamp: 3, author: 'You', text: 'Logo lands a beat too early', createdAt: '2026-08-03T10:00:00.000Z' },
  { id: 'seed-note', type: 'general', color: '#3B82F6', videoTimestamp: 12.5, author: 'Riya', text: 'Music swell hits perfectly here', createdAt: '2026-08-03T10:01:00.000Z' },
  { id: 'seed-rect', type: 'rect', x: 18, y: 20, width: 34, height: 24, color: '#EF4444', videoTimestamp: 24, author: 'You', text: 'Grade runs too warm on skin', createdAt: '2026-08-03T10:02:00.000Z', resolved: true },
];

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
  const [videoItems, setVideoItems] = useState(SEED_VIDEO_COMMENTS);
  const [selectedId, setSelectedId] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(DEMO_DURATION);
  const videoRef = useRef(null);

  const isVideo = tab === 'video';
  const items = isVideo ? videoItems : imageItems;
  const setItems = isVideo ? setVideoItems : setImageItems;

  // New items carry comment fields (author) so the sidebar can own them.
  const addItem = (it) => setItems(prev => [...prev, { author: 'You', ...it }]);
  const updateItem = (id, patch) => setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  const deleteItem = (id) => { setItems(prev => prev.filter(i => i.id !== id)); if (selectedId === id) setSelectedId(null); };

  // General comment (no drawing) from the sidebar composer.
  const postComment = ({ text, videoTimestamp }) => {
    const id = Math.random().toString(36).slice(2, 10);
    setItems(prev => [...prev, { id, type: 'general', text, videoTimestamp, color: '#FACC15', author: 'You', createdAt: new Date().toISOString() }]);
    setSelectedId(id);
  };

  // Seek the shared video element (sidebar timecode chips + timeline markers).
  // Optimistically move the playhead too so the UI responds even when the real
  // <video> hasn't loaded (sandbox); real playback overwrites this via timeupdate.
  const seekTo = (seconds) => {
    setCurrentTime(seconds);
    const v = videoRef.current;
    if (v) { v.currentTime = seconds; v.pause(); }
  };

  const media = isVideo
    ? { type: 'video', src: SAMPLE_VIDEO }
    : { type: 'image', src: SAMPLE_IMAGE };

  const MENTIONABLES = [{ id: 'u1', name: 'Harnesh' }, { id: 'u2', name: 'Riya' }, { id: 'u3', name: 'Kimiko' }];

  const tabBtn = (id, label) => (
    <button onClick={() => { setTab(id); setSelectedId(null); }}
      style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: WEIGHT.semibold, background: tab === id ? t.accent : t.surfaceElev, color: tab === id ? t.onAccent : t.text }}>{label}</button>
  );

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'], padding: SPACE['4'], borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ fontSize: 15 }}>🧪 Review — A1.3</strong>
        {tabBtn('image', 'Image')}
        {tabBtn('video', 'Video')}
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: `1px solid ${t.border}`, background: t.surface, color: t.text, cursor: 'pointer', fontSize: 12 }}>
          {mode === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 320px' }}>
        <div style={{ minHeight: 0, height: 'calc(100vh - 66px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
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
              videoRef={videoRef}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setVideoDuration}
            />
          </div>
          {isVideo && (
            <VideoTimeline
              duration={videoDuration}
              currentTime={currentTime}
              comments={items}
              selectedId={selectedId}
              onSeek={seekTo}
              onSelect={setSelectedId}
            />
          )}
        </div>

        <CommentSidebar
          key={tab}
          comments={items}
          currentUser={{ id: 'me', name: 'You' }}
          mediaType={media.type}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSeek={seekTo}
          onUpdate={updateItem}
          onDelete={deleteItem}
          onPost={postComment}
          currentTime={currentTime}
          mentionables={MENTIONABLES}
        />
      </div>
    </div>
  );
}
