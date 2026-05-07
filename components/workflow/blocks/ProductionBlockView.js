// components/workflow/blocks/ProductionBlockView.js
// F1: Post-production task block — edit, grading, VFX, audio, etc.
// Editor sees their brief + "Mark Complete"; producer sees status + "Force Complete".
// F2: Producer can pin/unpin project assets as references via toggleReferencePin.
import { useState } from 'react';
import { db } from '../../../lib/firebase';
import { toggleReferencePin } from '../../../lib/workflow/helpers';

const SPECIALTY_LABELS = {
  edit:     'Video Editing',
  grading:  'Color Grading',
  vfx:      'VFX',
  audio:    'Audio Mix',
  music:    'Music',
  supers:   'Supers/Titles',
  'ai-gen': 'AI Generation',
  generic:  'Production Task',
};

const STATUS_COLORS = {
  'in-progress': '#f59e0b',
  done:          '#22c55e',
  locked:        '#6b7280',
  pending:       '#6b7280',
};

const STATUS_LABELS = {
  'in-progress': 'In Progress',
  done:          'Done',
  locked:        'Locked',
  pending:       'Pending',
};

export default function ProductionBlockView({
  project,
  block,
  actorId,
  isProducer,
  actorRole,
  t,
  theme,
  onBlockAdvance,
}) {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(null);
  const [pinning, setPinning] = useState(null); // assetId currently being toggled
  const [localPinnedIds, setLocalPinnedIds] = useState(block.config?.referenceAssetIds || []);

  const handleTogglePin = async (assetId) => {
    if (!isProducer) return;
    setPinning(assetId);
    try {
      await toggleReferencePin(db, project.id, block.id, assetId);
      setLocalPinnedIds(prev =>
        prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]
      );
    } catch (e) {
      console.error('[ProductionBlockView] pin error', e);
    }
    setPinning(null);
  };

  if (!block) return null;

  const { label, status, assignedRole, config = {}, slaHours } = block;
  const { specialty, notes, referenceAssetIds = [] } = config;

  // Resolve reference assets from project.assets — use localPinnedIds for optimistic updates
  const projectAssets = project?.assets || [];
  const refAssets = localPinnedIds.length > 0
    ? projectAssets.filter(a => localPinnedIds.includes(a.id))
    : [];

  const specialtyLabel = specialty ? (SPECIALTY_LABELS[specialty] || specialty) : SPECIALTY_LABELS.generic;
  const statusColor = STATUS_COLORS[status] || '#6b7280';
  const statusLabel = STATUS_LABELS[status] || status;

  // Pending corrections (unresolved, most recent round first)
  const pendingCorrections = (block.corrections || [])
    .filter(c => !c.resolved)
    .sort((a, b) => b.round - a.round);

  // Who can act
  const isAssignee = actorRole === assignedRole;
  const canMarkComplete = isAssignee && status === 'in-progress';
  const canForceComplete = isProducer && status === 'in-progress';

  // Theme tokens with fallbacks
  const surface  = t?.surface  || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const surface2 = t?.surface2 || (theme === 'dark' ? '#111117' : '#f4f4f5');
  const border   = t?.border   || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text     = t?.text     || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted= t?.textMuted|| (theme === 'dark' ? '#94a3b8' : '#64748b');
  const primary  = t?.primary  || '#6366f1';
  const success  = t?.success  || '#22c55e';
  const warning  = t?.warning  || '#f59e0b';

  const handleMarkComplete = async () => {
    if (completing) return;
    setCompleting(true);
    setError(null);
    try {
      await onBlockAdvance();
    } catch (err) {
      console.error('[ProductionBlockView] onBlockAdvance error:', err);
      setError(err?.message || 'Failed to mark complete. Please try again.');
      setCompleting(false);
    }
  };

  const handleForceComplete = async () => {
    if (completing) return;
    const confirmed = window.confirm(
      `Force-complete "${label}"?\n\nThis will advance the workflow without the assignee marking it done.`
    );
    if (!confirmed) return;
    setCompleting(true);
    setError(null);
    try {
      await onBlockAdvance();
    } catch (err) {
      console.error('[ProductionBlockView] force-complete error:', err);
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

  const valueStyle = {
    fontSize: 14,
    color: text,
  };

  return (
    <div style={cardStyle}>

      {/* Header */}
      <div style={{ ...sectionStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: primary, marginBottom: 6 }}>
            Production Block
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: text, marginBottom: 10 }}>
            {label || 'Untitled Task'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {/* Specialty badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: `${primary}18`, border: `1px solid ${primary}40`,
              borderRadius: 6, padding: '3px 10px',
              fontSize: 12, fontWeight: 500, color: primary,
            }}>
              {specialtyLabel}
            </span>
            {/* Assigned role badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: surface2, border: `1px solid ${border}`,
              borderRadius: 6, padding: '3px 10px',
              fontSize: 12, color: textMuted,
            }}>
              {assignedRole ? `Assigned to: ${assignedRole}` : 'Unassigned'}
            </span>
            {/* SLA */}
            {slaHours != null && (
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                background: surface2, border: `1px solid ${border}`,
                borderRadius: 6, padding: '3px 10px',
                fontSize: 12, color: textMuted,
              }}>
                SLA: {slaHours}h
              </span>
            )}
          </div>
        </div>

        {/* Status badge */}
        <span style={{
          flexShrink: 0,
          display: 'inline-flex', alignItems: 'center',
          background: `${statusColor}18`, border: `1px solid ${statusColor}50`,
          borderRadius: 20, padding: '4px 12px',
          fontSize: 12, fontWeight: 600, color: statusColor,
          whiteSpace: 'nowrap',
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Brief */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Brief</div>
        <div style={{
          ...valueStyle,
          background: surface2,
          border: `1px solid ${border}`,
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 13,
          lineHeight: 1.6,
          color: notes ? text : textMuted,
          fontStyle: notes ? 'normal' : 'italic',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {notes || 'No brief provided.'}
        </div>
      </div>

      {/* Reference Assets — shown when there are pinned refs, or always for producers */}
      {(refAssets.length > 0 || isProducer) && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Reference Assets</div>
          {refAssets.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {refAssets.map(asset => {
                const thumbUrl = asset.url || asset.previewUrl || asset.hiResUrl;
                const isPinned = localPinnedIds.includes(asset.id);
                return (
                  <div
                    key={asset.id}
                    title={asset.name || asset.originalName || asset.id}
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: `2px solid ${isPinned ? primary : border}`,
                      background: surface2,
                      flexShrink: 0,
                      position: 'relative',
                      opacity: pinning === asset.id ? 0.5 : 1,
                      transition: 'border-color 0.15s, opacity 0.15s',
                    }}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={asset.name || 'Reference'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        loading="lazy"
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20, color: textMuted,
                      }}>
                        ?
                      </div>
                    )}
                    {isProducer && (
                      <button
                        onClick={() => handleTogglePin(asset.id)}
                        title={isPinned ? 'Unpin reference' : 'Pin as reference'}
                        style={{
                          position: 'absolute', top: 2, right: 2,
                          background: isPinned ? primary : 'rgba(0,0,0,0.55)',
                          border: 'none',
                          borderRadius: 4,
                          width: 18, height: 18,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff',
                          cursor: 'pointer',
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        📌
                      </button>
                    )}
                  </div>
                );
              })}
              {/* Placeholder for unresolved IDs */}
              {localPinnedIds.length > refAssets.length && (
                <div style={{ fontSize: 12, color: textMuted, alignSelf: 'center', marginLeft: 4 }}>
                  +{localPinnedIds.length - refAssets.length} not found
                </div>
              )}
            </div>
          )}

          {/* Pin from grid — producers only */}
          {isProducer && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: textMuted, marginBottom: 6 }}>
                Pin assets as references:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(project.assets || []).slice(0, 20).map(asset => {
                  const pinned = localPinnedIds.includes(asset.id);
                  return (
                    <div
                      key={asset.id}
                      onClick={() => handleTogglePin(asset.id)}
                      title={asset.name || asset.originalName || asset.id}
                      style={{
                        position: 'relative',
                        width: 56, height: 56,
                        borderRadius: 6,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: `2px solid ${pinned ? primary : border}`,
                        opacity: pinning === asset.id ? 0.5 : 1,
                        transition: 'border-color 0.15s, opacity 0.15s',
                        background: surface2,
                        flexShrink: 0,
                      }}
                    >
                      {asset.previewUrl && (
                        <img src={asset.previewUrl} alt={asset.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      {pinned && (
                        <div style={{
                          position: 'absolute', top: 2, right: 2,
                          background: primary, borderRadius: 3,
                          width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 8, color: '#fff',
                        }}>📌</div>
                      )}
                    </div>
                  );
                })}
                {(project.assets || []).length > 20 && (
                  <div style={{ fontSize: 11, color: textMuted, alignSelf: 'center' }}>
                    + {(project.assets || []).length - 20} more — use the asset grid to pin
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Corrections to address */}
      {pendingCorrections.length > 0 && (
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}` }}>
          <div style={{ marginBottom: 0, padding: 12, background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
              Corrections to address (Round {pendingCorrections[0].round}):
            </div>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {pendingCorrections[0].items.map((item, i) => (
                <li key={i} style={{ fontSize: 12, color: textMuted, marginBottom: 4 }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Assignee: Mark Complete */}
        {canMarkComplete && (
          <button
            onClick={handleMarkComplete}
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
            {completing ? (
              <>Completing...</>
            ) : (
              <>✓ Mark as Complete</>
            )}
          </button>
        )}

        {/* Producer: Force Complete */}
        {canForceComplete && (
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

        {/* Read-only state for other roles */}
        {!canMarkComplete && !canForceComplete && (
          <span style={{ fontSize: 13, color: textMuted }}>
            {status === 'done'
              ? 'This task has been completed.'
              : status === 'locked'
              ? 'This task is locked.'
              : 'Waiting for the assignee to complete this task.'}
          </span>
        )}

        {/* Error */}
        {error && (
          <span style={{ fontSize: 13, color: '#ef4444', marginLeft: 4 }}>{error}</span>
        )}
      </div>
    </div>
  );
}
