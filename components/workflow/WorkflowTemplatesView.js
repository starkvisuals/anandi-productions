'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { getTemplates } from '../../lib/workflow/helpers';

export default function WorkflowTemplatesView({ t, theme, userProfile }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rows = await getTemplates(db);
        if (alive) setTemplates(rows);
      } catch (err) {
        console.error('[WorkflowTemplatesView] load failed', err);
        if (alive) setError(err.message || 'Failed to load templates');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleNew = () => {
    console.log('[WorkflowTemplatesView] New Template (A8 will wire this)');
  };
  const handleEdit = (tpl) => {
    console.log('[WorkflowTemplatesView] Edit', tpl.id);
  };
  const handleDuplicate = (tpl) => {
    console.log('[WorkflowTemplatesView] Duplicate', tpl.id);
  };
  const handleArchive = (tpl) => {
    console.log('[WorkflowTemplatesView] Archive', tpl.id);
  };

  const renderIcon = (tpl) => {
    const bg = tpl.color || '#6366f1';
    const char = tpl.icon && tpl.icon.length <= 4
      ? tpl.icon
      : (tpl.name ? tpl.name.charAt(0).toUpperCase() : '?');
    return (
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 10,
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 22,
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {char}
      </div>
    );
  };

  const btnBase = {
    padding: '6px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    border: `1px solid ${t.borderLight}`,
    background: t.bgInput,
    color: t.text,
    cursor: 'pointer',
  };

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>
            Workflow Templates
          </h1>
          <p style={{ fontSize: 13, color: t.textMuted, margin: '4px 0 0 0' }}>
            Define the block sequence projects follow from kickoff to delivery.
          </p>
        </div>
        <button
          onClick={handleNew}
          disabled
          title="Template editor coming in A8"
          style={{
            ...btnBase,
            padding: '8px 14px',
            fontSize: 13,
            background: t.accent,
            color: '#fff',
            border: 'none',
            opacity: 0.5,
            cursor: 'not-allowed',
          }}
        >
          + New Template
        </button>
      </div>

      {/* Loading / error / empty / grid */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
          Loading templates...
        </div>
      )}

      {!loading && error && (
        <div style={{
          padding: 16,
          background: t.bgCard,
          border: `1px solid ${t.border}`,
          borderRadius: t.cardRadius,
          color: '#ef4444',
          fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && templates.length === 0 && (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: t.bgCard,
          border: `1px dashed ${t.border}`,
          borderRadius: t.cardRadius,
          color: t.textMuted,
          fontSize: 13,
        }}>
          No workflow templates yet.
        </div>
      )}

      {!loading && !error && templates.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}>
          {templates.map((tpl) => {
            const blockCount = Array.isArray(tpl.blocks) ? tpl.blocks.length : 0;
            const isSystem = !!tpl.isSystemDefault;
            return (
              <div
                key={tpl.id}
                style={{
                  background: t.bgCard,
                  border: `1px solid ${t.border}`,
                  borderRadius: t.cardRadius,
                  padding: 16,
                  boxShadow: t.shadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {/* Top row: icon + name + badge */}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {renderIcon(tpl)}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: t.text }}>
                        {tpl.name || 'Untitled'}
                      </span>
                      {isSystem && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: t.bgSecondary,
                          color: t.textMuted,
                          border: `1px solid ${t.borderLight}`,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                        }}>
                          System default
                        </span>
                      )}
                    </div>
                    {tpl.description && (
                      <p style={{
                        fontSize: 13,
                        color: t.textMuted,
                        margin: '6px 0 0 0',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {tpl.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer: block count */}
                <div style={{
                  fontSize: 12,
                  color: t.textMuted,
                  paddingTop: 8,
                  borderTop: `1px solid ${t.borderLight}`,
                }}>
                  {blockCount} block{blockCount === 1 ? '' : 's'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleEdit(tpl)}
                    disabled={isSystem}
                    title={isSystem ? 'Clone to edit' : 'Edit template'}
                    style={{
                      ...btnBase,
                      opacity: isSystem ? 0.5 : 1,
                      cursor: isSystem ? 'not-allowed' : 'pointer',
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDuplicate(tpl)}
                    style={btnBase}
                  >
                    Duplicate
                  </button>
                  {!isSystem && (
                    <button
                      onClick={() => handleArchive(tpl)}
                      style={btnBase}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
