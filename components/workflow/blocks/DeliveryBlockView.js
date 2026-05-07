// components/workflow/blocks/DeliveryBlockView.js
// G2: Terminal delivery block — shown when hi-res is unlocked and project is delivered.
// No onBlockAdvance — this is the final block.
import { useState } from 'react';

const formatDate = (ts) => {
  if (!ts) return null;
  // Firestore Timestamp has .toDate(), plain ISO strings work directly
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function DeliveryBlockView({
  project,
  block,
  actorId,
  isProducer,
  t,
  theme,
}) {
  const [copied, setCopied] = useState(false);

  if (!block || !project) return null;

  // Theme tokens with fallbacks
  const surface   = t?.bgCard    || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const surface2  = t?.bgInput   || (theme === 'dark' ? '#111117' : '#f4f4f5');
  const border    = t?.border    || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text      = t?.text      || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted = t?.textMuted || (theme === 'dark' ? '#94a3b8' : '#64748b');
  const primary   = t?.accent    || t?.primary || '#6366f1';
  const success   = t?.success   || '#22c55e';

  const deliveryDate = formatDate(block.completedAt || block.startedAt);
  const totalAssets = (project.assets || []).filter(a => !a.deleted).length;
  const selectedAssets = (project.assets || []).filter(a => a.isSelected).length;

  const shareUrl = project.shareToken
    ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${project.shareToken}`
    : null;

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
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

      {/* Celebration Header */}
      <div style={{
        ...sectionStyle,
        textAlign: 'center',
        padding: '32px 24px',
        background: `linear-gradient(135deg, ${success}10, ${primary}10)`,
        borderBottom: `1px solid ${border}`,
      }}>
        <div style={{ fontSize: 48, marginBottom: 12, lineHeight: 1 }}>
          {'🎉'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: text, marginBottom: 8 }}>
          Delivery Ready
        </div>
        <div style={{ fontSize: 14, color: textMuted, marginBottom: 16 }}>
          <strong style={{ color: text }}>{project.name}</strong> has been delivered
        </div>

        {/* Hi-Res Unlocked badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${success}18`, border: `1px solid ${success}50`,
          borderRadius: 20, padding: '6px 16px',
          fontSize: 13, fontWeight: 600, color: success,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
          Hi-Res Unlocked
        </span>

        {deliveryDate && (
          <div style={{ marginTop: 12, fontSize: 12, color: textMuted }}>
            Delivered on {deliveryDate}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ ...sectionStyle, display: 'flex', gap: 0 }}>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={labelStyle}>Total Assets</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: text }}>{totalAssets}</div>
        </div>
        <div style={{ width: 1, background: border, margin: '0 4px' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={labelStyle}>Selected</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: primary }}>{selectedAssets}</div>
        </div>
        <div style={{ width: 1, background: border, margin: '0 4px' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={labelStyle}>Hi-Res Status</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: success, marginTop: 6 }}>Unlocked</div>
        </div>
      </div>

      {/* Download note */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Downloads</div>
        <div style={{
          background: `${success}0a`,
          border: `1px solid ${success}25`,
          borderRadius: 8,
          padding: '12px 14px',
          fontSize: 13,
          color: text,
          lineHeight: 1.6,
        }}>
          Client can now download hi-res files from the share link below.
        </div>
      </div>

      {/* Share Link */}
      {shareUrl && (
        <div style={sectionStyle}>
          <div style={labelStyle}>Client Share Link</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              readOnly
              value={shareUrl}
              style={{
                flex: 1,
                padding: '10px 12px',
                background: surface2,
                border: `1px solid ${border}`,
                borderRadius: 8,
                fontSize: 13,
                color: text,
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={e => e.target.select()}
            />
            <button
              onClick={handleCopyLink}
              style={{
                flexShrink: 0,
                padding: '10px 16px',
                background: copied ? `${success}18` : `${primary}18`,
                border: `1px solid ${copied ? success : primary}40`,
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                color: copied ? success : primary,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: textMuted }}>
          This is the final stage. No further workflow actions are required.
        </span>
      </div>
    </div>
  );
}
