// components/workflow/blocks/CheckpointView.js
// G4: Producer-only gate — review all project assets and advance when ready.
import { useState } from 'react';

export default function CheckpointView({
  project,
  block,
  actorId,
  isProducer,
  t,
  theme,
  onBlockAdvance,
}) {
  const [busy, setBusy] = useState(false);

  if (!block || !project) return null;

  const surface    = t?.bgCard    || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const surface2   = t?.bgInput   || (theme === 'dark' ? '#111117' : '#f4f4f5');
  const border     = t?.border    || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text       = t?.text      || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted  = t?.textMuted || (theme === 'dark' ? '#94a3b8' : '#64748b');
  const accent     = t?.accent    || '#6366f1';
  const success    = t?.success   || '#22c55e';

  const label = block.config?.label || block.label || 'Checkpoint';
  const notes = block.config?.notes || '';
  const assets = (project.assets || []).filter(a => !a.deleted).slice(0, 40);
  const assignedRole = block.assignedRole || 'Producer';

  const cardStyle = {
    background: surface,
    border: `1px solid ${border}`,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 760,
    margin: '0 auto',
  };

  const headerStyle = {
    padding: '16px 20px',
    borderBottom: `1px solid ${border}`,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
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
    marginBottom: 6,
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: 18 }}>🏁</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: text }}>{label}</div>
          <div style={{ fontSize: 11, color: textMuted }}>Checkpoint · {project.name}</div>
        </div>
      </div>

      {/* Notes */}
      {notes && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Notes</div>
          <div style={{ fontSize: 13, color: text, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{notes}</div>
        </div>
      )}

      {/* Asset gallery */}
      {assets.length > 0 && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Project Assets ({assets.length}{assets.length === 40 ? '+' : ''})</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: 6,
          }}>
            {assets.map((asset) => {
              const thumb = asset.thumbnailUrl || asset.url || null;
              return (
                <div
                  key={asset.id}
                  title={asset.name || asset.id}
                  style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    borderRadius: 6,
                    background: surface2,
                    border: `1px solid ${border}`,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={asset.name || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <span style={{ fontSize: 22 }}>🖼️</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Review prompt / action area */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        {isProducer ? (
          <>
            <div style={{ fontSize: 13, color: textMuted }}>
              Review the work above and advance when ready.
            </div>
            <button
              onClick={async () => {
                if (busy || !onBlockAdvance) return;
                setBusy(true);
                try { await onBlockAdvance(); } finally { setBusy(false); }
              }}
              disabled={busy}
              style={{
                padding: '10px 22px',
                background: busy ? `${accent}80` : accent,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'opacity 0.15s',
              }}
            >
              {busy ? 'Advancing...' : 'Advance Workflow ›'}
            </button>
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: surface2,
            border: `1px solid ${border}`,
            borderRadius: 8,
          }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {(assignedRole || 'P').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: text }}>Waiting for producer review</div>
              <div style={{ fontSize: 11, color: textMuted }}>{assignedRole} must advance this step</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
