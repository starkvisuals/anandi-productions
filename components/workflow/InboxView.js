import { useState, useEffect, useCallback } from 'react';
import { db } from '../../lib/firebase';
import { getInboxForUser } from '../../lib/workflow/helpers';
import { BLOCK_STATUS } from '../../lib/workflow/constants';

function formatSLACountdown(dueDate) {
  if (!dueDate) return null;
  const due = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
  const diffMs = due - Date.now();
  if (diffMs < 0) return { label: 'Overdue', color: '#ef4444' };
  const hours = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  if (hours < 12) return { label: `${hours}h ${mins}m remaining`, color: '#ef4444' };
  if (hours < 24) return { label: `${hours}h remaining`, color: '#f59e0b' };
  const days = Math.floor(hours / 24);
  return { label: `${days}d ${hours % 24}h remaining`, color: null };
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function InboxView({ userId, userRoles, projects, t, theme, onNavigateToProject, onCountChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInbox = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await getInboxForUser(db, userId, userRoles || []);
      setItems(results);
      if (onCountChange) onCountChange(results.length);
    } catch (err) {
      console.error('InboxView fetch error:', err);
      setError('Failed to load inbox. Try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [userId, userRoles, onCountChange]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  const getProjectName = (projectId) => {
    const project = (projects || []).find(p => p.id === projectId);
    return project?.name || project?.title || 'Unknown Project';
  };

  // Group: in-progress first, then pending
  const inProgress = items.filter(i => i.status === BLOCK_STATUS.IN_PROGRESS);
  const pending = items.filter(i => i.status === BLOCK_STATUS.PENDING);
  const grouped = [...inProgress, ...pending];

  const statusBadge = (status) => {
    const isInProgress = status === BLOCK_STATUS.IN_PROGRESS;
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: isInProgress ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
        color: isInProgress ? '#22c55e' : '#f59e0b',
        border: `1px solid ${isInProgress ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
      }}>
        {isInProgress ? 'In Progress' : 'Pending'}
      </span>
    );
  };

  const typePill = (type) => (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '6px',
      fontSize: '11px',
      fontWeight: 500,
      background: t.bgSecondary || 'rgba(128,128,128,0.12)',
      color: t.textSecondary || '#888',
      border: `1px solid ${t.border || 'rgba(128,128,128,0.2)'}`,
      marginLeft: '6px',
    }}>
      {type || 'Block'}
    </span>
  );

  const roleChip = (role) => {
    if (!role) return null;
    return (
      <span style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 500,
        background: 'rgba(99,102,241,0.12)',
        color: '#818cf8',
        border: '1px solid rgba(99,102,241,0.25)',
      }}>
        {capitalize(role)}
      </span>
    );
  };

  const cardStyle = {
    background: t.bgCard || t.bgSecondary || '#1a1a2e',
    border: `1px solid ${t.border || 'rgba(255,255,255,0.08)'}`,
    borderRadius: t.cardRadius || '12px',
    boxShadow: t.shadow || '0 2px 8px rgba(0,0,0,0.15)',
    padding: '16px',
    marginBottom: '12px',
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: t.text || '#fff' }}>
            My Inbox
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: t.textSecondary || '#888' }}>
            Workflow tasks assigned to you
          </p>
        </div>
        <button
          onClick={fetchInbox}
          disabled={loading}
          style={{
            padding: '8px 14px',
            background: 'rgba(128,128,128,0.12)',
            border: `1px solid ${t.border || 'rgba(128,128,128,0.2)'}`,
            borderRadius: '8px',
            color: t.textSecondary || '#888',
            fontSize: '13px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'rgba(128,128,128,0.2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(128,128,128,0.12)'; }}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: t.textSecondary || '#888' }}>
          <div style={{ fontSize: '14px' }}>Loading your inbox…</div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{
          ...cardStyle,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444',
          textAlign: 'center',
          padding: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && grouped.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎉</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text || '#fff', marginBottom: '6px' }}>
            You have no pending workflow tasks
          </div>
          <div style={{ fontSize: '13px', color: t.textSecondary || '#888' }}>
            Check back later or ask your producer for updates.
          </div>
        </div>
      )}

      {/* Items */}
      {!loading && !error && grouped.map((item) => {
        const sla = formatSLACountdown(item.dueDate);
        const projectName = getProjectName(item.projectId);
        return (
          <div key={item.path || item.id} style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Project name */}
                <div style={{ fontWeight: 700, fontSize: '14px', color: t.text || '#fff', marginBottom: '6px' }}>
                  {projectName}
                </div>

                {/* Block label + type */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: t.text || '#fff' }}>
                    {item.label || item.name || item.type || 'Unnamed Block'}
                  </span>
                  {typePill(item.type)}
                </div>

                {/* Chips row */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: sla ? '8px' : '0' }}>
                  {roleChip(item.assignedRole)}
                  {statusBadge(item.status)}
                </div>

                {/* SLA countdown */}
                {sla && (
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: sla.color || (t.textSecondary || '#888'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}>
                    <span>⏱</span>
                    <span>{sla.label}</span>
                  </div>
                )}
              </div>

              {/* Go to Project button */}
              <button
                onClick={() => onNavigateToProject && onNavigateToProject(item.projectId)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  background: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '8px',
                  color: '#818cf8',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
              >
                Go to Project →
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
