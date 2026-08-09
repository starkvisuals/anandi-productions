'use client';
// components/assets/AssetCard.js — the asset grid tile (A3.1 + A3.3).
//
// A token-driven, reusable card for the project asset grid. Replaces the inline
// grid tile in MainApp with something consistent and themed:
//   - blur-up thumbnail (image via LazyImage; video shows poster + play + length;
//     audio/doc get an icon)
//   - hover lift; selected ring in brand yellow
//   - color-label dot, selection check, rating stars, feedback-count badge,
//     status chip — all overlaid, all optional/driven by callbacks
//   - RIGHT-CLICK → the Menu primitive: clean grouped app actions with Delete
//     visually set apart in red (A3.3). Only actions whose callbacks are passed
//     appear, so clients and editors get different menus for free.
//
// Props:
//   asset          : { id, name, type:'image'|'video'|'audio'|'other', url, thumbnail,
//                      duration?, rating?, colorLabel?, isSelected?, status?, feedback?[] }
//   selected       : is this the active/checked asset (ring)
//   onOpen         : () => void            — click the tile
//   onToggleSelect : () => void            — the ✓ pick control (optional)
//   onRate         : (n:1..5) => void      — click a star (optional)
//   onShare/onDownload/onCopyUrl/onRename/onDelete : right-click menu actions (each optional)

import { useState } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import { useReducedMotion } from '@/lib/motion';
import { useContextMenu } from '@/components/ui/Menu';
import LazyImage from '@/components/media/LazyImage';

const LABEL_HEX = { red: '#EF4444', yellow: '#FACC15', green: '#22C55E', blue: '#3B82F6', purple: '#A855F7', orange: '#F97316', gray: '#9CA3AF' };
const STAR_GOLD = '#FBBF24';

function fmtDuration(s) {
  if (!s || !Number.isFinite(s)) return null;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function statusChip(status, t) {
  switch (status) {
    case 'changes-requested': return { label: 'Changes', bg: `${t.danger}22`, fg: t.danger };
    case 'selected': return { label: 'Selected', bg: `${t.success}22`, fg: t.success };
    case 'approved': return { label: 'Approved', bg: `${t.success}22`, fg: t.success };
    case 'delivered': return { label: 'Delivered', bg: `${t.accent}22`, fg: t.accent };
    default: return null;
  }
}

export default function AssetCard({
  asset,
  selected = false,
  onOpen,
  onToggleSelect,
  onRate,
  onShare,
  onDownload,
  onCopyUrl,
  onRename,
  onDelete,
}) {
  const { t } = useTheme();
  const reduced = useReducedMotion();
  const [hover, setHover] = useState(false);

  const isImage = asset.type === 'image';
  const isVideo = asset.type === 'video';
  const labelHex = asset.colorLabel ? (LABEL_HEX[asset.colorLabel] || asset.colorLabel) : null;
  const chip = statusChip(asset.status, t);
  const fbCount = asset.feedback?.length || 0;
  const dur = fmtDuration(asset.duration);

  // Right-click menu — only the actions provided.
  const menuItems = [
    onShare && { label: 'Share', icon: <IconShare />, onClick: onShare },
    onCopyUrl && { label: 'Copy URL', icon: <IconLink />, onClick: onCopyUrl },
    onDownload && { label: 'Download', icon: <IconDownload />, onClick: onDownload },
    onRename && { label: 'Rename', icon: <IconEdit />, onClick: onRename },
    onDelete && { divider: true },
    onDelete && { label: 'Delete', icon: <IconTrash />, danger: true, onClick: onDelete },
  ].filter(Boolean);
  const { onContextMenu, menu } = useContextMenu(menuItems);

  return (
    <div
      onClick={onOpen}
      onContextMenu={menuItems.length ? onContextMenu : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        background: t.surface,
        border: `1px solid ${selected ? t.accent : t.border}`,
        boxShadow: selected ? `0 0 0 2px ${t.accent}` : (hover ? t.shadowLg : 'none'),
        cursor: 'pointer',
        transform: hover && !reduced ? 'translateY(-2px)' : 'none',
        transition: reduced ? 'none' : 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
      }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative' }}>
        {isImage || (isVideo && asset.thumbnail) ? (
          <LazyImage src={isImage ? asset.url : asset.thumbnail} thumbnail={asset.thumbnail} alt={asset.name} aspectRatio="4 / 3" objectFit="cover" />
        ) : (
          <div style={{ aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', background: t.surfaceElev, color: t.textMuted }}>
            {isVideo ? <IconFilm /> : asset.type === 'audio' ? <IconAudio /> : <IconDoc />}
          </div>
        )}

        {/* Play glyph + duration for video */}
        {isVideo && (
          <>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <span style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6,4 20,12 6,20" /></svg>
              </span>
            </div>
            {dur && <span style={{ position: 'absolute', bottom: 6, right: 6, fontSize: 10, fontFamily: 'ui-monospace, monospace', color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.sm, padding: '1px 5px' }}>{dur}</span>}
          </>
        )}

        {/* Color label dot */}
        {labelHex && <span style={{ position: 'absolute', top: 8, left: 8, width: 12, height: 12, borderRadius: '50%', background: labelHex, boxShadow: '0 0 0 2px rgba(0,0,0,0.35)' }} />}

        {/* Selection check */}
        {onToggleSelect && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
            aria-label={asset.isSelected ? 'Deselect asset' : 'Select asset'}
            aria-pressed={!!asset.isSelected}
            style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: '50%', border: `1.5px solid ${asset.isSelected ? t.success : 'rgba(255,255,255,0.7)'}`, background: asset.isSelected ? t.success : 'rgba(0,0,0,0.35)', color: '#fff', cursor: 'pointer', display: hover || asset.isSelected ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5" /></svg>
          </button>
        )}

        {/* Feedback count */}
        {fbCount > 0 && (
          <span style={{ position: 'absolute', bottom: 6, left: 6, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: WEIGHT.semibold, color: '#fff', background: 'rgba(0,0,0,0.6)', borderRadius: RADIUS.full, padding: '2px 7px' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            {fbCount}
          </span>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: `${SPACE['2']} ${SPACE['3']}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE['2'] }}>
          <span style={{ flex: 1, fontSize: 12, fontWeight: WEIGHT.medium, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</span>
          {chip && <span style={{ fontSize: 9, fontWeight: WEIGHT.semibold, textTransform: 'uppercase', letterSpacing: '0.03em', color: chip.fg, background: chip.bg, borderRadius: RADIUS.sm, padding: '1px 5px', flexShrink: 0 }}>{chip.label}</span>}
        </div>
        <div style={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} onClick={onRate ? () => onRate(n) : undefined} aria-label={`Rate ${n}`}
              disabled={!onRate}
              style={{ background: 'none', border: 'none', padding: 0, cursor: onRate ? 'pointer' : 'default', color: n <= (asset.rating || 0) ? STAR_GOLD : t.textDisabled, fontSize: 13, lineHeight: 1 }}>★</button>
          ))}
        </div>
      </div>

      {menu}
    </div>
  );
}

// ─── Inline icons (kept local; match the 1.6–2 stroke set used elsewhere) ────
const IconShare = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>;
const IconLink = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>;
const IconDownload = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
const IconEdit = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
const IconTrash = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /></svg>;
const IconFilm = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>;
const IconAudio = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>;
const IconDoc = () => <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>;
