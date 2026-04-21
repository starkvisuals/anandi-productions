'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, Reorder } from 'framer-motion';
import { db } from '../../lib/firebase';
import { createTemplate, updateTemplate, getTemplate } from '../../lib/workflow/helpers';
import {
  BLOCK_TYPES,
  WORKFLOW_ROLES,
  UPLOAD_VARIANTS,
  PRODUCTION_SPECIALTIES,
  APPROVAL_MODES,
  DEFAULT_SLA_HOURS,
} from '../../lib/workflow/constants';

// ─── Helpers ───────────────────────────────────────────────────────────────

let __tempId = 0;
const nextTempId = () => `tmp-${Date.now()}-${++__tempId}`;

const TYPE_OPTIONS = Object.values(BLOCK_TYPES);
const ROLE_OPTIONS = Object.values(WORKFLOW_ROLES);
const UPLOAD_VARIANT_OPTIONS = Object.values(UPLOAD_VARIANTS);
const PRODUCTION_SPECIALTY_OPTIONS = Object.values(PRODUCTION_SPECIALTIES);
const APPROVAL_MODE_OPTIONS = Object.values(APPROVAL_MODES);

const defaultSLAForType = (type) => {
  switch (type) {
    case BLOCK_TYPES.UploadBlock:     return DEFAULT_SLA_HOURS.UPLOAD;
    case BLOCK_TYPES.SelectionRound:  return DEFAULT_SLA_HOURS.SELECTION;
    case BLOCK_TYPES.ApprovalRound:   return DEFAULT_SLA_HOURS.APPROVAL;
    case BLOCK_TYPES.ProductionBlock: return DEFAULT_SLA_HOURS.PRODUCTION;
    case BLOCK_TYPES.Checkpoint:      return DEFAULT_SLA_HOURS.CHECKPOINT;
    default: return null;
  }
};

const makeBlankBlock = (type = BLOCK_TYPES.UploadBlock) => ({
  _id: nextTempId(),
  type,
  variant: type === BLOCK_TYPES.UploadBlock ? UPLOAD_VARIANTS.RAWS : null,
  specialty: type === BLOCK_TYPES.ProductionBlock ? PRODUCTION_SPECIALTIES.EDIT : null,
  mode: type === BLOCK_TYPES.ApprovalRound ? APPROVAL_MODES.CORRECTION_OR_APPROVE : null,
  label: '',
  defaultRole: WORKFLOW_ROLES.PRODUCER,
  defaultSLAHours: defaultSLAForType(type),
  config: {},
  configText: '{}',
  configError: null,
});

// Attach temp ids + JSON-text form to a block as it arrives from Firestore
const hydrateBlock = (b) => ({
  _id: nextTempId(),
  type: b.type || BLOCK_TYPES.UploadBlock,
  variant: b.variant ?? null,
  specialty: b.specialty ?? null,
  mode: b.mode ?? null,
  label: b.label || '',
  defaultRole: b.defaultRole || WORKFLOW_ROLES.PRODUCER,
  defaultSLAHours: (b.defaultSLAHours ?? null),
  config: b.config || {},
  configText: JSON.stringify(b.config || {}, null, 2),
  configError: null,
});

// ─── Modal ─────────────────────────────────────────────────────────────────

export default function WorkflowTemplateEditor({ mode, templateId, t, onClose, onSaved }) {
  const [loading, setLoading] = useState(mode !== 'new');
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [blocks, setBlocks] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  // New-block composer state
  const [newType, setNewType] = useState(BLOCK_TYPES.UploadBlock);
  const [newLabel, setNewLabel] = useState('');
  const [newRole, setNewRole] = useState(WORKFLOW_ROLES.PRODUCER);
  const [newSLA, setNewSLA] = useState('');

  // Load template
  useEffect(() => {
    let alive = true;
    if (mode === 'new') {
      setLoading(false);
      return;
    }
    if (!templateId) {
      setLoadError('No template id provided');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const tpl = await getTemplate(db, templateId);
        if (!alive) return;
        if (!tpl) {
          setLoadError('Template not found');
          return;
        }
        const prefixName = mode === 'duplicate' ? `Copy of ${tpl.name || 'Untitled'}` : (tpl.name || '');
        setName(prefixName);
        setDescription(tpl.description || '');
        setIcon(tpl.icon || '');
        setColor(tpl.color || '#6366f1');
        const bs = Array.isArray(tpl.blocks) ? tpl.blocks.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
        setBlocks(bs.map(hydrateBlock));
      } catch (err) {
        console.error('[WorkflowTemplateEditor] load failed', err);
        if (alive) setLoadError(err.message || 'Failed to load template');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [mode, templateId]);

  const title = mode === 'edit' ? 'Edit Template' : mode === 'duplicate' ? 'Duplicate Template' : 'New Template';

  const canSave = useMemo(() => {
    if (!name.trim()) return false;
    if (blocks.length === 0) return false;
    if (blocks.some(b => !b.label.trim())) return false;
    return true;
  }, [name, blocks]);

  // ─── Block edit handlers ────────────────────────────────────────────────
  const updateBlock = (id, patch) => {
    setBlocks(prev => prev.map(b => b._id === id ? { ...b, ...patch } : b));
  };

  const removeBlock = (id) => {
    setBlocks(prev => prev.filter(b => b._id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleTypeChange = (id, newType) => {
    setBlocks(prev => prev.map(b => {
      if (b._id !== id) return b;
      return {
        ...b,
        type: newType,
        variant: newType === BLOCK_TYPES.UploadBlock ? (b.variant || UPLOAD_VARIANTS.RAWS) : null,
        specialty: newType === BLOCK_TYPES.ProductionBlock ? (b.specialty || PRODUCTION_SPECIALTIES.EDIT) : null,
        mode: newType === BLOCK_TYPES.ApprovalRound ? (b.mode || APPROVAL_MODES.CORRECTION_OR_APPROVE) : null,
        defaultSLAHours: b.defaultSLAHours ?? defaultSLAForType(newType),
      };
    }));
  };

  const handleConfigTextChange = (id, text) => {
    setBlocks(prev => prev.map(b => b._id !== id ? b : { ...b, configText: text, configError: null }));
  };

  const handleAddBlock = () => {
    const blk = makeBlankBlock(newType);
    blk.label = newLabel.trim() || '';
    blk.defaultRole = newRole;
    blk.defaultSLAHours = newSLA === '' ? null : Number(newSLA);
    setBlocks(prev => [...prev, blk]);
    setNewLabel('');
    setNewSLA('');
    setExpandedId(blk._id);
  };

  // ─── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError(null);

    // Validate + parse configs
    const parsed = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      let cfg = {};
      try {
        cfg = b.configText && b.configText.trim() ? JSON.parse(b.configText) : {};
      } catch (err) {
        setBlocks(prev => prev.map(x => x._id === b._id ? { ...x, configError: err.message } : x));
        setExpandedId(b._id);
        setSaveError(`Block "${b.label || '(unnamed)'}" has invalid config JSON: ${err.message}`);
        return;
      }
      parsed.push({
        order: i + 1,
        type: b.type,
        variant: b.variant ?? null,
        specialty: b.specialty ?? null,
        mode: b.mode ?? null,
        label: b.label.trim(),
        defaultRole: b.defaultRole,
        defaultSLAHours: b.defaultSLAHours === '' || b.defaultSLAHours == null ? null : Number(b.defaultSLAHours),
        config: cfg,
      });
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      icon: icon.trim(),
      color,
      blocks: parsed,
    };

    setSaving(true);
    try {
      let savedId;
      if (mode === 'edit') {
        await updateTemplate(db, templateId, payload);
        savedId = templateId;
      } else {
        const result = await createTemplate(db, payload);
        // createTemplate returns a DocumentReference from addDoc; keep backward-compat if id string
        savedId = result && typeof result === 'object' && result.id ? result.id : result;
      }
      if (onSaved) await onSaved(savedId);
    } catch (err) {
      console.error('[WorkflowTemplateEditor] save failed', err);
      setSaveError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────
  const inputStyle = {
    padding: '9px 12px',
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 13,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: t.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, display: 'block',
  };
  const btnGhost = {
    padding: '8px 14px', fontSize: 13, fontWeight: 500, borderRadius: 8,
    background: t.bgInput, color: t.text, border: `1px solid ${t.borderLight}`, cursor: 'pointer',
  };
  const btnPrimary = {
    padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8,
    background: t.accent, color: '#fff', border: 'none', cursor: 'pointer',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, maxHeight: '92vh',
          background: t.modalBg || t.bgCard,
          border: `1px solid ${t.border}`, borderRadius: 14,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: t.text }}>{title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnGhost} disabled={saving}>Cancel</button>
            <button
              onClick={handleSave}
              disabled={!canSave || saving}
              style={{ ...btnPrimary, opacity: (!canSave || saving) ? 0.5 : 1, cursor: (!canSave || saving) ? 'not-allowed' : 'pointer' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: t.textMuted, fontSize: 13 }}>
              Loading…
            </div>
          )}
          {!loading && loadError && (
            <div style={{ padding: 16, color: '#ef4444', fontSize: 13 }}>{loadError}</div>
          )}
          {!loading && !loadError && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 340px) 1fr', gap: 24 }}>
              {/* Left: metadata */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Brand Film" />
                </div>
                <div>
                  <label style={labelStyle}>Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Short description…"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Icon</label>
                    <input value={icon} onChange={(e) => setIcon(e.target.value)} style={inputStyle} placeholder="e.g. BF" maxLength={4} />
                  </div>
                  <div>
                    <label style={labelStyle}>Color</label>
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                      style={{ ...inputStyle, padding: 4, height: 38 }} />
                  </div>
                </div>
              </div>

              {/* Right: blocks */}
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.text, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Blocks ({blocks.length})
                  </h3>
                  <span style={{ fontSize: 11, color: t.textMuted }}>Drag ⋮⋮ to reorder</span>
                </div>

                {blocks.length === 0 && (
                  <div style={{
                    padding: 24, textAlign: 'center',
                    border: `1px dashed ${t.border}`, borderRadius: 10,
                    color: t.textMuted, fontSize: 13, marginBottom: 14,
                  }}>
                    No blocks yet. Add one below.
                  </div>
                )}

                <Reorder.Group axis="y" values={blocks} onReorder={setBlocks} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blocks.map((blk, idx) => (
                    <Reorder.Item
                      key={blk._id}
                      value={blk}
                      style={{
                        listStyle: 'none',
                        background: t.bgCard,
                        border: `1px solid ${blk.configError ? '#ef4444' : t.borderLight}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                      }}
                    >
                      <BlockRow
                        blk={blk}
                        idx={idx}
                        t={t}
                        expanded={expandedId === blk._id}
                        onToggle={() => setExpandedId(expandedId === blk._id ? null : blk._id)}
                        onUpdate={(patch) => updateBlock(blk._id, patch)}
                        onTypeChange={(v) => handleTypeChange(blk._id, v)}
                        onConfigTextChange={(txt) => handleConfigTextChange(blk._id, txt)}
                        onRemove={() => removeBlock(blk._id)}
                        inputStyle={inputStyle}
                        labelStyle={labelStyle}
                      />
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                {/* Add block composer */}
                <div style={{
                  marginTop: 14,
                  padding: 12,
                  border: `1px dashed ${t.border}`,
                  borderRadius: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}>
                  <div style={{ gridColumn: '1 / -1', fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    Add Block
                  </div>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} style={inputStyle}>
                    {TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Label" style={inputStyle} />
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={inputStyle}>
                    {ROLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <input
                    type="number"
                    value={newSLA}
                    onChange={(e) => setNewSLA(e.target.value)}
                    placeholder={String(defaultSLAForType(newType) ?? 'SLA hours')}
                    style={inputStyle}
                  />
                  <button onClick={handleAddBlock} style={{ ...btnPrimary, gridColumn: '1 / -1' }}>+ Add Block</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer (save error) */}
        {saveError && (
          <div style={{
            padding: '10px 20px',
            borderTop: `1px solid ${t.border}`,
            color: '#ef4444',
            fontSize: 12,
            background: t.bgCard,
          }}>
            {saveError}
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function BlockRow({ blk, idx, t, expanded, onToggle, onUpdate, onTypeChange, onConfigTextChange, onRemove, inputStyle, labelStyle }) {
  return (
    <div>
      {/* Row header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
        <div
          style={{
            cursor: 'grab',
            padding: '4px 6px',
            color: t.textMuted,
            fontSize: 16,
            lineHeight: 1,
            userSelect: 'none',
          }}
          title="Drag to reorder"
        >
          ⋮⋮
        </div>
        <div style={{
          minWidth: 22, textAlign: 'center', fontSize: 11, color: t.textMuted, fontWeight: 600,
        }}>
          {idx + 1}
        </div>
        <input
          value={blk.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Block label"
          style={{ ...inputStyle, flex: 1 }}
        />
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 10,
          background: t.bgInput, color: t.textMuted, border: `1px solid ${t.borderLight}`,
          whiteSpace: 'nowrap',
        }}>
          {blk.type}
        </span>
        <button
          onClick={onToggle}
          style={{
            padding: '5px 10px', fontSize: 11, borderRadius: 6,
            background: t.bgInput, color: t.text, border: `1px solid ${t.borderLight}`, cursor: 'pointer',
          }}
        >
          {expanded ? 'Collapse' : 'Edit'}
        </button>
        <button
          onClick={onRemove}
          style={{
            padding: '5px 10px', fontSize: 11, borderRadius: 6,
            background: 'transparent', color: '#ef4444', border: `1px solid ${t.borderLight}`, cursor: 'pointer',
          }}
          title="Remove block"
        >
          ×
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 10px 12px 10px', borderTop: `1px solid ${t.borderLight}`, paddingTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={blk.type} onChange={(e) => onTypeChange(e.target.value)} style={inputStyle}>
                {TYPE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Default Role</label>
              <select value={blk.defaultRole} onChange={(e) => onUpdate({ defaultRole: e.target.value })} style={inputStyle}>
                {ROLE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>SLA Hours (blank = none)</label>
              <input
                type="number"
                value={blk.defaultSLAHours ?? ''}
                onChange={(e) => onUpdate({ defaultSLAHours: e.target.value === '' ? null : Number(e.target.value) })}
                style={inputStyle}
                placeholder="Hours"
              />
            </div>
            {blk.type === BLOCK_TYPES.UploadBlock && (
              <div>
                <label style={labelStyle}>Variant</label>
                <select value={blk.variant || ''} onChange={(e) => onUpdate({ variant: e.target.value })} style={inputStyle}>
                  {UPLOAD_VARIANT_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {blk.type === BLOCK_TYPES.ProductionBlock && (
              <div>
                <label style={labelStyle}>Specialty</label>
                <select value={blk.specialty || ''} onChange={(e) => onUpdate({ specialty: e.target.value })} style={inputStyle}>
                  {PRODUCTION_SPECIALTY_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
            {blk.type === BLOCK_TYPES.ApprovalRound && (
              <div>
                <label style={labelStyle}>Approval Mode</label>
                <select value={blk.mode || ''} onChange={(e) => onUpdate({ mode: e.target.value })} style={inputStyle}>
                  {APPROVAL_MODE_OPTIONS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>Config (JSON)</label>
            <textarea
              value={blk.configText}
              onChange={(e) => onConfigTextChange(e.target.value)}
              rows={5}
              style={{
                ...inputStyle,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 12,
                resize: 'vertical',
              }}
            />
            {blk.configError && (
              <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>
                Invalid JSON: {blk.configError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
