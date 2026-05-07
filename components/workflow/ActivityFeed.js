import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit as firestoreLimit, getDocs } from 'firebase/firestore';

function relativeTime(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const ACTIVITY_DISPLAY = {
  'block.started': { icon: '▶', label: 'Block started' },
  'block.completed': { icon: '✓', label: 'Block completed' },
  'selection.requested': { icon: '📋', label: 'Selection requested' },
  'selection.submitted': { icon: '✅', label: 'Selection submitted' },
  'approval.requested': { icon: '👁', label: 'Approval requested' },
  'approval.granted': { icon: '✅', label: 'Approved' },
  'approval.corrections': { icon: '🔄', label: 'Corrections requested' },
  'production.completed': { icon: '🎬', label: 'Production completed' },
  'delivery.ready': { icon: '🎉', label: 'Delivery ready' },
  'asset.uploaded': { icon: '📁', label: 'Asset uploaded' },
  'comment.posted': { icon: '💬', label: 'Comment posted' },
};

function Skeleton({ t }) {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 0',
          borderBottom: `1px solid ${t.borderLight || 'rgba(128,128,128,0.1)'}`,
          opacity: 0.5,
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: t.border || 'rgba(128,128,128,0.2)',
            flexShrink: 0,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              height: '12px',
              borderRadius: '4px',
              background: t.border || 'rgba(128,128,128,0.2)',
              marginBottom: '6px',
              width: `${60 + i * 10}%`,
            }} />
            <div style={{
              height: '10px',
              borderRadius: '4px',
              background: t.border || 'rgba(128,128,128,0.15)',
              width: '40%',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ActivityFeed({ projectId, t, theme, limit }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setError(null);

    const activityRef = collection(db, 'projects', projectId, 'activity');
    const q = query(activityRef, orderBy('timestamp', 'desc'), firestoreLimit(limit || 20));

    getDocs(q)
      .then(snap => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setActivities(items);
      })
      .catch(err => {
        console.error('ActivityFeed fetch error:', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [projectId, limit]);

  if (!projectId) return null;

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: t.textMuted || t.textSecondary || '#666',
        marginBottom: '10px',
      }}>
        Activity
      </div>

      {loading && <Skeleton t={t} />}

      {!loading && error && (
        <div style={{ fontSize: '12px', color: t.textSecondary || '#888', textAlign: 'center', padding: '16px 0' }}>
          Could not load activity.
        </div>
      )}

      {!loading && !error && activities.length === 0 && (
        <div style={{ fontSize: '12px', color: t.textMuted || t.textSecondary || '#888', textAlign: 'center', padding: '16px 0' }}>
          No activity yet
        </div>
      )}

      {!loading && !error && activities.map(item => {
        const display = ACTIVITY_DISPLAY[item.type] || { icon: '•', label: item.type || 'Activity' };
        const payload = item.payload || item.data || item.summary || '';
        const summary = typeof payload === 'string'
          ? payload
          : payload.count != null
            ? `${display.label} — ${payload.count} picks`
            : display.label;

        return (
          <div key={item.id} style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            padding: '9px 0',
            borderBottom: `1px solid ${t.borderLight || 'rgba(128,128,128,0.08)'}`,
          }}>
            {/* Icon */}
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(128,128,128,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              flexShrink: 0,
            }}>
              {display.icon}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '12px',
                color: t.text || '#fff',
                fontWeight: 500,
                lineHeight: '1.4',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {summary || display.label}
              </div>
              {item.timestamp && (
                <div style={{ fontSize: '11px', color: t.textMuted || t.textSecondary || '#888', marginTop: '2px' }}>
                  {relativeTime(item.timestamp)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
