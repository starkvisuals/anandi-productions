// components/workflow/WorkflowTimeline.js
// G6: Compact vertical sidebar showing all workflow blocks and their status.
const STATUS_ICON = {
  done:        { icon: '✓', color: '#22c55e' },
  'in-progress': { icon: '▶', color: null /* accent */ },
  pending:     { icon: '○', color: null /* muted */ },
  locked:      { icon: '—', color: null /* muted */ },
  skipped:     { icon: '↷', color: null /* muted */ },
};

const TYPE_LABEL = {
  UploadBlock:   'Upload',
  SelectionRound:'Selection',
  ProductionBlock:'Production',
  ApprovalRound: 'Approval',
  AdaptBlock:    'Adapt',
  DeliveryBlock: 'Delivery',
  Checkpoint:    'Checkpoint',
  Parallel:      'Parallel',
};

export default function WorkflowTimeline({ blocks, currentBlockId, t, theme }) {
  if (!blocks || blocks.length === 0) return null;

  const surface   = t?.bgCard    || (theme === 'dark' ? '#1a1a1a' : '#ffffff');
  const border    = t?.border    || (theme === 'dark' ? '#2a2a35' : '#e4e4e7');
  const text      = t?.text      || (theme === 'dark' ? '#f1f5f9' : '#0f172a');
  const textMuted = t?.textMuted || (theme === 'dark' ? '#94a3b8' : '#64748b');
  const accent    = t?.accent    || '#6366f1';
  const success   = t?.success   || '#22c55e';

  return (
    <div style={{
      width: 250,
      flexShrink: 0,
      background: surface,
      borderRight: `1px solid ${border}`,
      padding: '12px 0',
      overflowY: 'auto',
      maxHeight: '100%',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: textMuted,
        padding: '0 14px 10px',
      }}>
        Workflow
      </div>

      <div style={{ position: 'relative' }}>
        {blocks.map((block, idx) => {
          const isCurrent = block.id === currentBlockId;
          const status = block.status || 'pending';
          const isLocked = status === 'locked';
          const isDone = status === 'done';
          const isSkipped = status === 'skipped';

          const si = STATUS_ICON[status] || STATUS_ICON.pending;
          const iconColor = si.color || (isCurrent ? accent : textMuted);

          const blockLabel = block.config?.label || block.label || TYPE_LABEL[block.type] || block.type || 'Block';
          const typeLabel = TYPE_LABEL[block.type] || block.type || '';
          const isLast = idx === blocks.length - 1;

          return (
            <div
              key={block.id}
              style={{
                display: 'flex',
                alignItems: 'stretch',
                opacity: isLocked ? 0.4 : 1,
                position: 'relative',
              }}
            >
              {/* Left: icon + connector */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 32,
                flexShrink: 0,
                paddingLeft: 14,
              }}>
                {/* Status icon */}
                <div style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isCurrent ? accent : (isDone ? success : 'transparent'),
                  border: isCurrent || isDone ? 'none' : `2px solid ${border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: isCurrent || isDone ? '#fff' : iconColor,
                  flexShrink: 0,
                  marginTop: 10,
                  zIndex: 1,
                  position: 'relative',
                }}>
                  {si.icon}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div style={{
                    width: 2,
                    flexGrow: 1,
                    minHeight: 12,
                    background: isDone ? success : border,
                    opacity: isDone ? 0.5 : 0.4,
                    marginTop: 2,
                  }} />
                )}
              </div>

              {/* Right: content */}
              <div style={{
                flex: 1,
                padding: '8px 12px 8px 8px',
                borderLeft: isCurrent ? `3px solid ${accent}` : '3px solid transparent',
                marginLeft: 4,
              }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: isCurrent ? 700 : (isDone ? 400 : 500),
                  color: isDone ? textMuted : text,
                  lineHeight: 1.3,
                }}>
                  {blockLabel}
                </div>
                {typeLabel && (
                  <span style={{
                    display: 'inline-block',
                    marginTop: 3,
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: isCurrent ? `${accent}22` : (isDone ? `${success}18` : `${border}88`),
                    color: isCurrent ? accent : (isDone ? success : textMuted),
                  }}>
                    {typeLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
