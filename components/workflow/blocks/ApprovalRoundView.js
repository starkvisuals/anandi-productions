// components/workflow/blocks/ApprovalRoundView.js
// F3: Client/reviewer watches deliverables and either approves or requests corrections.
import { useState, useCallback } from 'react';
import { DEFAULT_REVISION_LIMIT } from '../../../lib/workflow/constants';

// ── Round chip row ─────────────────────────────────────────────────────────────
function RoundChips({ current, total, t }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const isCurrent = n === current;
        const isPast = n < current;
        return (
          <div
            key={n}
            title={`Round ${n}`}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              background: isCurrent
                ? t.primary
                : isPast
                ? t.warning
                : 'transparent',
              color: isCurrent || isPast ? '#fff' : t.textMuted,
              border: isCurrent || isPast
                ? 'none'
                : `2px solid ${t.border}`,
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}

// ── Asset thumbnail row ────────────────────────────────────────────────────────
function AssetThumbnailRow({ assets, t }) {
  if (!assets || assets.length === 0) {
    return (
      <div style={{ color: t.textMuted, fontSize: 13, padding: '8px 0' }}>
        No assets attached to this project yet.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 6,
        paddingTop: 2,
      }}
    >
      {assets.map((asset) => (
        <div
          key={asset.id}
          title={asset.name}
          style={{
            flexShrink: 0,
            width: 100,
            borderRadius: 8,
            overflow: 'hidden',
            border: `1px solid ${t.border}`,
            background: t.bgCard,
          }}
        >
          {asset.previewUrl ? (
            <img
              src={asset.previewUrl}
              alt={asset.name}
              loading="lazy"
              style={{
                width: '100%',
                aspectRatio: '3/2',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                aspectRatio: '3/2',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              🎬
            </div>
          )}
          <div
            style={{
              padding: '5px 7px',
              fontSize: 11,
              color: t.textMuted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {asset.name}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Correction items list ──────────────────────────────────────────────────────
function CorrectionList({ items, onChange, t }) {
  const addItem = useCallback(() => {
    onChange([...items, '']);
  }, [items, onChange]);

  const removeItem = useCallback((idx) => {
    onChange(items.filter((_, i) => i !== idx));
  }, [items, onChange]);

  const updateItem = useCallback((idx, value) => {
    const next = items.slice();
    next[idx] = value;
    onChange(next);
  }, [items, onChange]);

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={item}
            placeholder={`Correction item ${idx + 1}`}
            onChange={e => updateItem(idx, e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: t.bgInput || t.bgCard,
              border: `1px solid ${t.border}`,
              borderRadius: 7,
              color: t.text,
              fontSize: 13,
              outline: 'none',
            }}
          />
          <button
            onClick={() => removeItem(idx)}
            title="Remove item"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'transparent',
              border: `1px solid ${t.border}`,
              color: t.textMuted,
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'border-color 0.13s, color 0.13s',
            }}
          >
            ×
          </button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
        <button
          onClick={addItem}
          style={{
            padding: '7px 14px',
            background: 'transparent',
            border: `1px dashed ${t.primary}`,
            borderRadius: 7,
            color: t.primary,
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'background 0.13s',
          }}
        >
          + Add item
        </button>
        {items.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              padding: '7px 14px',
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: 7,
              color: t.textMuted,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.13s',
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ApprovalRoundView({
  project,
  block,
  actorId,
  isProducer,
  actorRole,
  t,
  theme,
  onApprove,
  onCorrections,
  onGrantExtraRound,
}) {
  const [correctionItems, setCorrectionItems] = useState([]);
  const [actioning, setActioning] = useState(false);

  const roundLimit = block?.config?.roundLimit || DEFAULT_REVISION_LIMIT;
  const currentRound = block?.revisionRound || 1;
  const roundLimitReached = currentRound >= roundLimit;

  const correctionCount = correctionItems.filter(s => s.trim()).length;
  const canRequestCorrections = correctionCount > 0 && !roundLimitReached;

  const assets = project?.assets || [];

  // ── Approve ──
  const handleApprove = useCallback(async () => {
    if (!confirm('Mark as approved? This will advance the project to the next step.')) return;
    setActioning(true);
    try { await onApprove(); } catch (e) { console.error('[ApprovalRound] approve error', e); }
    setActioning(false);
  }, [onApprove]);

  // ── Request corrections ──
  const handleCorrections = useCallback(async () => {
    const items = correctionItems.filter(s => s.trim());
    if (!items.length) return;
    setActioning(true);
    try { await onCorrections(items, items.length); } catch (e) { console.error('[ApprovalRound] corrections error', e); }
    setActioning(false);
  }, [correctionItems, onCorrections]);

  // ── Grant extra round (producer only) ──
  const handleGrantExtraRound = useCallback(async () => {
    if (!confirm('Grant an extra revision round? This will increase the round limit by 1.')) return;
    setActioning(true);
    try { await onGrantExtraRound(); } catch (e) { console.error('[ApprovalRound] grantExtraRound error', e); }
    setActioning(false);
  }, [onGrantExtraRound]);

  const isDone = block?.status === 'done';
  const isLocked = block?.status === 'locked';

  return (
    <div
      style={{
        background: t.bgCard,
        borderRadius: 12,
        border: `1px solid ${t.border}`,
        overflow: 'hidden',
        color: t.text,
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '18px 20px 14px',
          borderBottom: `1px solid ${t.border}`,
          background: t.bg || t.bgCard,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🎬</span>
              {block?.label || 'Client Approval'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: t.textMuted }}>
                Round {currentRound} of {roundLimit}
              </span>
              <RoundChips current={currentRound} total={roundLimit} t={t} />
            </div>
          </div>

          {/* Status pill */}
          {block?.status && (
            <div
              style={{
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background:
                  block.status === 'done'
                    ? `${t.success}22`
                    : block.status === 'in-progress'
                    ? `${t.primary}22`
                    : `${t.border}`,
                color:
                  block.status === 'done'
                    ? t.success
                    : block.status === 'in-progress'
                    ? t.primary
                    : t.textMuted,
                border: `1px solid ${
                  block.status === 'done'
                    ? `${t.success}55`
                    : block.status === 'in-progress'
                    ? `${t.primary}55`
                    : t.border
                }`,
              }}
            >
              {block.status === 'in-progress' ? 'In Progress' : block.status.charAt(0).toUpperCase() + block.status.slice(1)}
            </div>
          )}
        </div>

        {/* Role info */}
        {block?.assignedRole && (
          <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
            Reviewed by: <strong style={{ color: t.text }}>{block.assignedRole}</strong>
            {block.slaHours && (
              <span style={{ marginLeft: 10 }}>· SLA: {block.slaHours}h</span>
            )}
          </div>
        )}
      </div>

      {/* ── Round limit warning banner ── */}
      {roundLimitReached && (
        <div
          style={{
            padding: '12px 20px',
            background: `${t.warning}18`,
            borderBottom: `1px solid ${t.warning}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ color: t.warning, fontSize: 13, fontWeight: 600 }}>
              Round limit reached ({currentRound}/{roundLimit}). The producer has been notified.
            </span>
          </div>
          {isProducer && onGrantExtraRound && (
            <button
              onClick={handleGrantExtraRound}
              disabled={actioning}
              style={{
                padding: '6px 14px',
                borderRadius: 7,
                fontWeight: 600,
                fontSize: 13,
                background: 'transparent',
                color: t.warning,
                border: `1px solid ${t.warning}`,
                cursor: actioning ? 'not-allowed' : 'pointer',
                opacity: actioning ? 0.6 : 1,
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              Grant Extra Round
            </button>
          )}
        </div>
      )}

      {/* ── Assets to review ── */}
      <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Assets to review
        </div>
        <AssetThumbnailRow assets={assets} t={t} />
      </div>

      {/* ── Correction notes (hide if done/locked) ── */}
      {!isDone && !isLocked && (
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: t.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Correction notes
          </div>
          <CorrectionList items={correctionItems} onChange={setCorrectionItems} t={t} />
          {correctionCount > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: t.textMuted }}>
              {correctionCount} item{correctionCount !== 1 ? 's' : ''} to send
            </div>
          )}
        </div>
      )}

      {/* ── Action buttons ── */}
      {!isDone && !isLocked && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: t.bg || t.bgCard,
          }}
        >
          {/* Approve */}
          <button
            onClick={handleApprove}
            disabled={actioning}
            style={{
              padding: '10px 24px',
              borderRadius: 9,
              fontWeight: 700,
              fontSize: 14,
              background: t.success,
              color: '#fff',
              border: 'none',
              cursor: actioning ? 'not-allowed' : 'pointer',
              opacity: actioning ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'opacity 0.15s',
            }}
          >
            ✓ Approve
          </button>

          {/* Request Corrections */}
          <button
            onClick={handleCorrections}
            disabled={actioning || !canRequestCorrections}
            title={
              roundLimitReached
                ? 'Round limit reached — corrections disabled'
                : correctionCount === 0
                ? 'Add at least one correction item'
                : undefined
            }
            style={{
              padding: '10px 24px',
              borderRadius: 9,
              fontWeight: 600,
              fontSize: 14,
              background: 'transparent',
              color: canRequestCorrections ? t.warning : t.textMuted,
              border: `1px solid ${canRequestCorrections ? t.warning : t.border}`,
              cursor: actioning || !canRequestCorrections ? 'not-allowed' : 'pointer',
              opacity: actioning ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            ↩ Request Corrections{correctionCount > 0 ? ` (${correctionCount})` : ''}
          </button>

          {/* Force Approve (producer only) */}
          {isProducer && (
            <button
              onClick={handleApprove}
              disabled={actioning}
              style={{
                padding: '10px 18px',
                borderRadius: 9,
                fontWeight: 500,
                fontSize: 13,
                background: 'transparent',
                color: actioning ? t.textMuted : t.danger || '#ef4444',
                border: `1px solid ${actioning ? t.border : t.danger || '#ef4444'}`,
                cursor: actioning ? 'not-allowed' : 'pointer',
                opacity: actioning ? 0.6 : 1,
                transition: 'all 0.15s',
                marginLeft: 'auto',
              }}
            >
              Force Approve
            </button>
          )}
        </div>
      )}

      {/* ── Done/locked state ── */}
      {(isDone || isLocked) && (
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: isDone ? t.success : t.textMuted,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {isDone ? '✓ Approved — workflow advanced' : '🔒 Locked'}
        </div>
      )}
    </div>
  );
}
