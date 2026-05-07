import { useState, useEffect, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { WORKFLOW_ROLES } from '../../lib/workflow/constants';
import {
  getAssetRequests, createAssetRequest, approveAssetRequest,
  fulfillAssetRequest, cancelAssetRequest,
} from '../../lib/workflow/helpers';

const STATUS_STYLES = {
  pending:   { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24', label: 'Pending' },
  approved:  { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6', label: 'Approved' },
  fulfilled: { bg: 'rgba(34,197,94,0.15)',   color: '#22c55e', label: 'Fulfilled' },
  cancelled: { bg: 'rgba(107,114,128,0.15)', color: '#6b7280', label: 'Cancelled' },
};

const FILTERS = ['all', 'pending', 'approved', 'fulfilled'];

export default function AssetRequestsPanel({ project, userProfile, isProducer, t, theme }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formRole, setFormRole] = useState(WORKFLOW_ROLES.EDITOR);
  const [formDueDate, setFormDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fulfillId, setFulfillId] = useState(null);
  const [fulfillNotes, setFulfillNotes] = useState('');
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await getAssetRequests(db, project.id);
      setRequests(data);
    } catch (e) {
      console.error('[AssetRequestsPanel] fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const visible = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      await createAssetRequest(db, project.id, {
        title: formTitle.trim(),
        description: formDescription.trim(),
        assignedRole: formRole,
        assignedTo: null,
        dueDate: formDueDate || null,
        assetId: null,
      }, userProfile.id);
      setFormTitle('');
      setFormDescription('');
      setFormRole(WORKFLOW_ROLES.EDITOR);
      setFormDueDate('');
      setShowForm(false);
      await fetchRequests();
    } catch (err) {
      console.error('[AssetRequestsPanel] create error', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (requestId) => {
    try {
      await approveAssetRequest(db, project.id, requestId, userProfile.id);
      await fetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleFulfill = async (requestId) => {
    try {
      await fulfillAssetRequest(db, project.id, requestId, { notes: fulfillNotes }, userProfile.id);
      setFulfillId(null);
      setFulfillNotes('');
      await fetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleCancel = async (requestId) => {
    try {
      await cancelAssetRequest(db, project.id, requestId, userProfile.id);
      setConfirmCancelId(null);
      await fetchRequests();
    } catch (e) { console.error(e); }
  };

  const inputStyle = {
    width: '100%',
    background: t.bgInput,
    border: `1px solid ${t.border}`,
    borderRadius: '8px',
    padding: '8px 12px',
    color: t.text,
    fontSize: '13px',
    boxSizing: 'border-box',
    outline: 'none',
  };

  const btnBase = {
    padding: '6px 14px',
    borderRadius: '7px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    border: 'none',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: t.text }}>
          Asset Requests
          {requests.length > 0 && (
            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: '500', color: t.textMuted }}>
              ({requests.length})
            </span>
          )}
        </h3>
        {isProducer && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ ...btnBase, background: t.primary || '#6366f1', color: '#fff', padding: '6px 16px' }}
          >
            + New Request
          </button>
        )}
      </div>

      {/* Inline create form */}
      {showForm && isProducer && (
        <form
          onSubmit={handleCreate}
          style={{
            background: t.bgCard,
            border: `1px solid ${t.border}`,
            borderRadius: '10px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: '600', color: t.text, marginBottom: '4px' }}>New Asset Request</div>
          <input
            style={inputStyle}
            placeholder="Title — e.g. Square export of scene 3"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            required
          />
          <textarea
            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
            placeholder="Detailed notes (optional)"
            value={formDescription}
            onChange={e => setFormDescription(e.target.value)}
          />
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <select
              value={formRole}
              onChange={e => setFormRole(e.target.value)}
              style={{ ...inputStyle, width: 'auto', flex: '1 1 140px' }}
            >
              {Object.values(WORKFLOW_ROLES).map(r => (
                <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
              ))}
            </select>
            <input
              type="date"
              style={{ ...inputStyle, width: 'auto', flex: '1 1 140px' }}
              value={formDueDate}
              onChange={e => setFormDueDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowForm(false)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${t.border}`, color: t.textSecondary }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ ...btnBase, background: '#6366f1', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Creating…' : 'Create Request'}
            </button>
          </div>
        </form>
      )}

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              border: filter === f ? 'none' : `1px solid ${t.border}`,
              background: filter === f ? (t.primary || '#6366f1') : 'transparent',
              color: filter === f ? '#fff' : t.textSecondary,
              textTransform: 'capitalize',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: t.textMuted, fontSize: '13px', padding: '12px 0' }}>Loading…</div>
      ) : visible.length === 0 ? (
        <div style={{ color: t.textMuted, fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>
          {filter === 'all' ? 'No asset requests yet' : `No ${filter} requests`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map(r => {
            const ss = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
            return (
              <div
                key={r.id}
                style={{
                  background: t.bgCard,
                  border: `1px solid ${t.border}`,
                  borderRadius: '10px',
                  padding: '14px 16px',
                }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontWeight: '700', fontSize: '13px', color: t.text, flex: 1 }}>{r.title}</span>
                  <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', background: ss.bg, color: ss.color, flexShrink: 0 }}>
                    {ss.label}
                  </span>
                </div>

                {/* Description */}
                {r.description && (
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: t.textSecondary, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {r.description}
                  </p>
                )}

                {/* Meta row */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {r.assignedRole && (
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px', background: t.bgInput, color: t.textMuted, textTransform: 'capitalize' }}>
                      {r.assignedRole}
                    </span>
                  )}
                  {r.dueDate && (
                    <span style={{ fontSize: '10px', color: t.textMuted }}>Due: {r.dueDate}</span>
                  )}
                  {r.notes && r.status === 'fulfilled' && (
                    <span style={{ fontSize: '10px', color: '#22c55e' }}>Note: {r.notes}</span>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Producer: approve pending */}
                  {isProducer && r.status === 'pending' && (
                    <button onClick={() => handleApprove(r.id)} style={{ ...btnBase, background: '#3b82f6', color: '#fff' }}>
                      Approve
                    </button>
                  )}

                  {/* Non-producer: fulfill approved */}
                  {!isProducer && r.status === 'approved' && (
                    fulfillId === r.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                        <textarea
                          style={{ ...inputStyle, minHeight: '56px', resize: 'vertical' }}
                          placeholder="Add notes (optional)"
                          value={fulfillNotes}
                          onChange={e => setFulfillNotes(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleFulfill(r.id)} style={{ ...btnBase, background: '#22c55e', color: '#fff' }}>
                            Confirm Fulfilled
                          </button>
                          <button onClick={() => { setFulfillId(null); setFulfillNotes(''); }} style={{ ...btnBase, background: 'transparent', border: `1px solid ${t.border}`, color: t.textSecondary }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setFulfillId(r.id)} style={{ ...btnBase, background: '#22c55e', color: '#fff' }}>
                        Mark Fulfilled
                      </button>
                    )
                  )}

                  {/* Producer: cancel any non-terminal */}
                  {isProducer && r.status !== 'cancelled' && r.status !== 'fulfilled' && (
                    confirmCancelId === r.id ? (
                      <>
                        <span style={{ fontSize: '12px', color: t.textSecondary }}>Sure?</span>
                        <button onClick={() => handleCancel(r.id)} style={{ ...btnBase, background: '#ef4444', color: '#fff' }}>Yes, Cancel</button>
                        <button onClick={() => setConfirmCancelId(null)} style={{ ...btnBase, background: 'transparent', border: `1px solid ${t.border}`, color: t.textSecondary }}>No</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmCancelId(r.id)} style={{ ...btnBase, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        Cancel
                      </button>
                    )
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
