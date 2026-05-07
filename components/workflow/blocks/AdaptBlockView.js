// components/workflow/blocks/AdaptBlockView.js
// G1: Adapt block — checklist of asset adaptations (formats/sizes/platforms).
// Assignee checks off each item; producer sees read-only view + force-complete.
import { useState } from 'react';
import { db } from '../../../lib/firebase';
import { updateAdaptItem } from '../../../lib/workflow/helpers';

export default function AdaptBlockView({
  project,
  block,
  actorId,
  isProducer,
  t,
  theme,
  onBlockAdvance,
}) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const [localAdapts, setLocalAdapts] = useState(block?.config?.adapts || []);

  if (!block) return null;

  const { label, config = {} } = block;
  const { notes, adapts: _adapts } = config;

  // Use localAdapts for optimistic UI
  const adapts = localAdapts;
  const totalCount = adapts.length;
  const doneCount = adapts.filter(a => a.done).length;
  const allDone = totalCount > 0 && doneCount === totalCount;

  // Theme tokens with fallbacks
  const surface   = t?.bgCard    || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const surface2  = t?.bgInput   || (theme === 'dark' ? '#111117' : '#f4f4f5');
  const border    = t?.border    || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text      = t?.text      || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted = t?.textMuted || (theme === 'dark' ? '#94a3b8' : '#64748b');
  const primary   = t?.accent    || t?.primary || '#6366f1';
  const success   = t?.success   || '#22c55e';
  const warning   = t?.warning   || '#f59e0b';

  const handleToggleItem = async (itemId, currentDone) => {
    if (isProducer) return; // read-only for producers
    const newDone = !currentDone;
    // Optimistic update
    setLocalAdapts(prev => prev.map(a => a.id === itemId ? { ...a, done: newDone } : a));
    try {
      await updateAdaptItem(db, project.id, block.id, itemId, newDone);
    } catch (e) {
      console.error('[AdaptBlockView] toggleItem error', e);
      // Roll back optimistic update on error
      setLocalAdapts(prev => prev.map(a => a.id === itemId ? { ...a, done: currentDone } : a));
    }
  };

  const handleAllDone = async () => {
    if (completing) return;
    setCompleting(true);
    setError(null);
    try {
      await onBlockAdvance();
    } catch (err) {
      console.error('[AdaptBlockView] onBlockAdvance error:', err);
      setError(err?.message || 'Failed to complete. Please try again.');
      setCompleting(false);
    }
  };

  const handleForceComplete = async () => {
    if (completing) return;
    const confirmed = window.confirm(
      `Force-complete "${label}"?\n\nThis will advance the workflow even though not all adapt items are checked.`
    );
    if (!confirmed) return;
    setCompleting(true);
    setError(null);
    try {
      await onBlockAdvance();
    } catch (err) {
      console.error('[AdaptBlockView] force-complete error:', err);
      setError(err?.message || 'Failed to force-complete. Please try again.');
      setCompleting(false);
    }
  };

  const cardStyle = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 720,
    margin: '0 auto',
  };

  const sectionStyle = {
    padding: '16px 20px',
    borderBottom: `1px solid ${border}`,
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: textMuted,
    marginBottom: 4,
  };

  return (
    <div style={cardStyle}>

      {/* Header */}
      <div style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: primary, marginBottom: 6 }}>
            Adapt Block
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: text, marginBottom: 10 }}>
            {label || 'Untitled Adaptations'}
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: `${primary}18`, border: `1px solid ${primary}40`,
            borderRadius: 6, padding: '3px 10px',
            fontSize: 12, fontWeight: 500, color: primary,
          }}>
            Adaptations
          </span>
        </div>

        {/* Progress badge */}
        {totalCount > 0 && (
          <span style={{
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center',
            background: allDone ? `${success}18` : `${warning}18`,
            border: `1px solid ${allDone ? success : warning}50`,
            borderRadius: 20, padding: '4px 12px',
            fontSize: 12, fontWeight: 600,
            color: allDone ? success : warning,
            whiteSpace: 'nowrap',
          }}>
            {doneCount} / {totalCount} complete
          </span>
        )}
      </div>

      {/* Notes / Brief */}
      {notes && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Brief</div>
          <div style={{
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.6,
            color: text,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {notes}
          </div>
        </div>
      )}

      {/* Adapt Checklist */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Adapt Items</div>

        {totalCount === 0 ? (
          <div style={{ fontSize: 13, color: textMuted, fontStyle: 'italic', padding: '8px 0' }}>
            No adapt items configured.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            {adapts.map(item => (
              <div
                key={item.id}
                onClick={() => !isProducer && handleToggleItem(item.id, item.done)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '12px 14px',
                  background: item.done ? `${success}0a` : surface2,
                  border: `1px solid ${item.done ? success + '30' : border}`,
                  borderRadius: 8,
                  cursor: isProducer ? 'default' : 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                  opacity: isProducer && !item.done ? 0.8 : 1,
                }}
              >
                {/* Checkbox */}
                <div style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  border: `2px solid ${item.done ? success : border}`,
                  background: item.done ? success : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  {item.done && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 3.5-4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Label + description */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: item.done ? textMuted : text,
                    textDecoration: item.done ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}>
                    {item.label}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: textMuted, marginTop: 3, lineHeight: 1.5 }}>
                      {item.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Assignee: All Done button (only when all checked) */}
        {!isProducer && allDone && (
          <button
            onClick={handleAllDone}
            disabled={completing}
            style={{
              padding: '10px 22px',
              background: completing ? `${success}80` : success,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: completing ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {completing ? 'Completing...' : '✓ All Done — Submit'}
          </button>
        )}

        {/* Assignee waiting state */}
        {!isProducer && !allDone && totalCount > 0 && (
          <span style={{ fontSize: 13, color: textMuted }}>
            Check off all items above to complete this block.
          </span>
        )}

        {/* Producer: Force Complete */}
        {isProducer && (
          <button
            onClick={handleForceComplete}
            disabled={completing}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              color: warning,
              border: `1px solid ${warning}60`,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: completing ? 'default' : 'pointer',
              opacity: completing ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {completing ? 'Working...' : 'Force Complete'}
          </button>
        )}

        {/* Error */}
        {error && (
          <span style={{ fontSize: 13, color: '#ef4444', marginLeft: 4 }}>{error}</span>
        )}
      </div>
    </div>
  );
}
