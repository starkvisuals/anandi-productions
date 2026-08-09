'use client';
// app/dev/assets/page.js — preview harness for LazyImage + AssetCard (A2.1 / A3.1 / A3.3).
//
// Visit /dev/assets. Verify:
//   - blur-up: thumbnails fade from blurred placeholder → full (no flash)
//   - hover lift; selected ring (brand yellow) on the picked card
//   - color-label dot, selection check (✓), rating stars (click to rate),
//     feedback-count badge, status chip
//   - RIGHT-CLICK a card → clean grouped menu (Share / Copy URL / Download /
//     Rename / — / Delete in red); toast on each
//   - dark + light (toggle top-right)

import { useState } from 'react';
import { ThemeProvider, useTheme, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import AssetCard from '@/components/assets/AssetCard';

const swatch = (bg, label) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="${bg}"/><text x="200" y="160" font-family="sans-serif" font-size="26" fill="#ffffff" text-anchor="middle" opacity="0.85">${label}</text></svg>`
  );

const MOCK = [
  { id: 'a1', name: 'Hero_final_v3.jpg', type: 'image', url: swatch('#4338ca', 'IMG 1'), thumbnail: swatch('#4338ca', ''), rating: 4, colorLabel: 'yellow', status: 'delivered', feedback: [{}, {}] },
  { id: 'a2', name: 'Campaign_teaser.mp4', type: 'video', url: '#', thumbnail: swatch('#0f766e', 'VID'), duration: 84, rating: 5, isSelected: true, status: 'selected', feedback: [{}] },
  { id: 'a3', name: 'Look_02_backlit.jpg', type: 'image', url: swatch('#b91c1c', 'IMG 3'), thumbnail: swatch('#b91c1c', ''), rating: 2, colorLabel: 'red', status: 'changes-requested', feedback: [{}, {}, {}] },
  { id: 'a4', name: 'Scratch_track.wav', type: 'audio', url: '#', rating: 0 },
  { id: 'a5', name: 'Moodboard.pdf', type: 'other', url: '#', rating: 0, colorLabel: 'blue' },
  { id: 'a6', name: 'Look_05_wide.jpg', type: 'image', url: swatch('#7c3aed', 'IMG 6'), thumbnail: swatch('#7c3aed', ''), rating: 3, status: 'approved' },
];

export default function DevAssetsPage() {
  const [mode, setMode] = useState('dark');
  return (
    <ThemeProvider initial={mode} sync={false} key={mode}>
      <ToastProvider>
        <Shell mode={mode} setMode={setMode} />
      </ToastProvider>
    </ThemeProvider>
  );
}

function Shell({ mode, setMode }) {
  const { t } = useTheme();
  const toast = useToast();
  const [assets, setAssets] = useState(MOCK);
  const [activeId, setActiveId] = useState('a2');

  const patch = (id, fn) => setAssets(prev => prev.map(a => (a.id === id ? fn(a) : a)));

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'], padding: SPACE['4'], borderBottom: `1px solid ${t.border}` }}>
        <strong style={{ fontSize: 15 }}>🧪 AssetCard — A3.1 / A3.3 · LazyImage — A2.1</strong>
        <span style={{ fontSize: 12, color: t.textMuted }}>right-click a card for the menu</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}
          style={{ padding: `${SPACE['2']} ${SPACE['3']}`, borderRadius: RADIUS.md, border: `1px solid ${t.border}`, background: t.surface, color: t.text, cursor: 'pointer', fontSize: 12 }}>
          {mode === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </header>

      <div style={{ padding: SPACE['5'], display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: SPACE['4'], maxWidth: 1100, margin: '0 auto' }}>
        {assets.map(a => (
          <AssetCard
            key={a.id}
            asset={a}
            selected={a.id === activeId}
            onOpen={() => { setActiveId(a.id); toast.info(`Open ${a.name}`); }}
            onToggleSelect={() => { patch(a.id, x => ({ ...x, isSelected: !x.isSelected })); }}
            onRate={(n) => { patch(a.id, x => ({ ...x, rating: n })); toast.success(`Rated ${n}★`); }}
            onShare={() => toast.info(`Share ${a.name}`)}
            onCopyUrl={() => toast.success('URL copied')}
            onDownload={() => toast.info(`Download ${a.name}`)}
            onRename={() => toast.info(`Rename ${a.name}`)}
            onDelete={() => { setAssets(prev => prev.filter(x => x.id !== a.id)); toast.info(`Deleted ${a.name}`); }}
          />
        ))}
      </div>
    </div>
  );
}
