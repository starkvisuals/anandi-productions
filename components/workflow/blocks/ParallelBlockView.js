// components/workflow/blocks/ParallelBlockView.js
// G5: Placeholder view for Parallel blocks — advance is automatic via the runner.
export default function ParallelBlockView({
  project,
  block,
  actorId,
  isProducer,
  t,
  theme,
}) {
  if (!block) return null;

  const surface   = t?.bgCard    || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const surface2  = t?.bgInput   || (theme === 'dark' ? '#111117' : '#f4f4f5');
  const border    = t?.border    || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text      = t?.text      || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted = t?.textMuted || (theme === 'dark' ? '#94a3b8' : '#64748b');
  const accent    = t?.accent    || '#6366f1';

  const label = block.config?.label || block.label || 'Parallel Tasks';
  const childLabels = block.config?.childLabels || [];

  return (
    <div style={{
      background: surface,
      border: `1px solid ${border}`,
      borderRadius: 12,
      overflow: 'hidden',
      maxWidth: 620,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>⚡</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: text }}>Parallel Tasks</div>
          {label !== 'Parallel Tasks' && (
            <div style={{ fontSize: 11, color: textMuted }}>{label}</div>
          )}
        </div>
      </div>

      {/* Task list */}
      <div style={{ padding: '14px 20px' }}>
        {childLabels.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {childLabels.map((cl, i) => (
              <li key={i} style={{ fontSize: 13, color: text, lineHeight: 1.5 }}>{cl}</li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 13, color: textMuted }}>No sub-tasks configured.</div>
        )}

        <div style={{
          marginTop: 14,
          padding: '10px 14px',
          background: surface2,
          border: `1px solid ${border}`,
          borderRadius: 8,
          fontSize: 12,
          color: textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 15 }}>ℹ️</span>
          All tasks must complete before the workflow advances.
        </div>
      </div>
    </div>
  );
}
