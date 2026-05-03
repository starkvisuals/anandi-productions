'use client';
import { BLOCK_STATUS } from '../../lib/workflow/constants';

// ─── Theme map (mirrors MainApp THEMES) ───────────────────────────────────────
const THEMES = {
  dark:  { bgCard: '#1e1e28', bgInput: '#0d0d12', border: '#2a2a3a', borderLight: '#1e1e2e', text: '#ffffff', textMuted: 'rgba(255,255,255,0.4)', primary: '#6366f1', success: '#22c55e' },
  light: { bgCard: '#ffffff', bgInput: '#f8f9fb', border: '#e0e3e8', borderLight: '#ebedf0', text: '#111827', textMuted: '#9ca3af', primary: '#6366f1', success: '#16a34a' },
};

// Pulse animation keyframes injected once
let _pulseInjected = false;
function ensurePulse() {
  if (_pulseInjected || typeof document === 'undefined') return;
  _pulseInjected = true;
  const s = document.createElement('style');
  s.textContent = `@keyframes stb-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.75); } }`;
  document.head.appendChild(s);
}

function pillStyle(status, t, isClickable) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
    fontWeight: '500', whiteSpace: 'nowrap', flexShrink: 0,
    cursor: isClickable ? 'pointer' : 'default',
    border: '1px solid transparent', transition: 'opacity 0.15s',
    userSelect: 'none',
  };
  if (status === BLOCK_STATUS.DONE)
    return { ...base, background: t.success, color: '#fff', borderColor: t.success };
  if (status === BLOCK_STATUS.IN_PROGRESS)
    return { ...base, background: t.primary, color: '#fff', borderColor: t.primary };
  if (status === BLOCK_STATUS.LOCKED)
    return { ...base, background: t.bgInput, color: t.textMuted, borderColor: t.borderLight };
  // pending / skipped
  return { ...base, background: t.bgCard, color: t.text, borderColor: t.border };
}

export default function StageTimelineBar({ blocks = [], currentBlockId = '', onBlockClick, theme = 'dark' }) {
  ensurePulse();
  const t = THEMES[theme] || THEMES.dark;

  const sorted = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      overflowX: 'auto', padding: '8px 4px',
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {sorted.map((block, idx) => {
        const isCurrent = block.id === currentBlockId;
        const isLocked  = block.status === BLOCK_STATUS.LOCKED;
        const isDone    = block.status === BLOCK_STATUS.DONE;
        const status    = isCurrent ? BLOCK_STATUS.IN_PROGRESS : block.status;
        const clickable = !isLocked && typeof onBlockClick === 'function';

        return (
          <div key={block.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {idx > 0 && (
              <span style={{ color: t.textMuted, fontSize: '14px', flexShrink: 0 }}>›</span>
            )}
            <div
              style={pillStyle(status, t, clickable)}
              onClick={() => clickable && onBlockClick(block)}
              title={block.label}
            >
              {isDone && <span style={{ fontSize: '10px' }}>✓</span>}
              {isCurrent && !isDone && (
                <span style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: '#fff', flexShrink: 0,
                  animation: 'stb-pulse 1.4s ease-in-out infinite',
                  display: 'inline-block',
                }} />
              )}
              {block.label || block.type}
            </div>
          </div>
        );
      })}
    </div>
  );
}
