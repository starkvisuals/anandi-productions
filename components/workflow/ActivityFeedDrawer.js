'use client';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const THEMES = {
  dark:  { bgCard: '#1e1e28', bgInput: '#0d0d12', bgSecondary: '#111118', border: '#2a2a3a', borderLight: '#1e1e2e', text: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)', textMuted: 'rgba(255,255,255,0.4)', primary: '#6366f1', success: '#22c55e', warning: '#f59e0b', danger: '#ef4444', accent: '#a855f7' },
  light: { bgCard: '#ffffff', bgInput: '#f8f9fb', bgSecondary: '#ffffff', border: '#e0e3e8', borderLight: '#ebedf0', text: '#111827', textSecondary: '#4b5563', textMuted: '#9ca3af', primary: '#6366f1', success: '#16a34a', warning: '#d97706', danger: '#dc2626', accent: '#9333ea' },
};

const FILTERS = ['All', 'Uploads', 'Approvals', 'Comments', 'Mentions'];

function matchesFilter(item, filter) {
  if (filter === 'All') return true;
  const type = (item.type || '').toLowerCase();
  if (filter === 'Uploads')   return type.includes('asset') || type.includes('upload');
  if (filter === 'Approvals') return type.includes('approval');
  if (filter === 'Comments')  return type.includes('comment');
  if (filter === 'Mentions')  return type === 'mention';
  return false;
}

function dotColor(type, t) {
  const lc = (type || '').toLowerCase();
  if (lc.includes('asset') || lc.includes('upload')) return t.primary;
  if (lc.includes('approval')) return t.success;
  if (lc.includes('comment')) return t.warning;
  if (lc === 'mention') return t.accent;
  return t.textMuted;
}

function formatTimeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '';
  const diffMs = Date.now() - d.getTime();
  const diffSec = diffMs / 1000;
  if (diffSec < 60)   return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function SkeletonRow({ t }) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: `1px solid ${t.borderLight}` }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.border, flexShrink: 0, marginTop: '5px' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ height: '10px', borderRadius: '4px', background: t.border, width: '60%' }} />
        <div style={{ height: '10px', borderRadius: '4px', background: t.borderLight, width: '85%' }} />
      </div>
    </div>
  );
}

function ActivityItem({ item, t }) {
  const color = dotColor(item.type, t);
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: `1px solid ${t.borderLight}` }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0, marginTop: '5px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', color: t.text, lineHeight: '1.45' }}>
          <span style={{ fontWeight: '600' }}>{item.actorName || 'Someone'}</span>
          {' '}{item.message || item.type}
        </div>
        <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '3px' }}>
          {formatTimeAgo(item.createdAt)}
        </div>
      </div>
    </div>
  );
}

export default function ActivityFeedDrawer({ projectId, isOpen, onClose, t: tProp, theme = 'dark' }) {
  const t = tProp || THEMES[theme] || THEMES.dark;
  const [activities, setActivities] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [activeFilter, setFilter]   = useState('All');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    setActivities([]);
    getDocs(query(
      collection(db, 'projects', projectId, 'activity'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )).then(snap => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  const filtered = activities.filter(a => matchesFilter(a, activeFilter));

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 1199, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, width: '300px', height: '100vh',
        background: t.bgCard, borderLeft: `1px solid ${t.border}`,
        zIndex: 1200, display: 'flex', flexDirection: 'column',
        transform: `translateX(${isOpen ? 0 : 300}px)`,
        transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 16px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <span style={{ fontSize: '14px', fontWeight: '600', color: t.text }}>Activity</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: t.textMuted,
            fontSize: '18px', cursor: 'pointer', lineHeight: 1, padding: '0 4px',
          }}>×</button>
        </div>

        {/* Filter chips */}
        <div style={{
          display: 'flex', gap: '6px', padding: '10px 12px',
          borderBottom: `1px solid ${t.borderLight}`, overflowX: 'auto',
          scrollbarWidth: 'none', flexShrink: 0,
        }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '500',
              background: activeFilter === f ? t.primary : t.bgInput,
              color: activeFilter === f ? '#fff' : t.textMuted,
              border: `1px solid ${activeFilter === f ? t.primary : t.border}`,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{f}</button>
          ))}
        </div>

        {/* Feed */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
          {loading ? (
            [0, 1, 2].map(i => <SkeletonRow key={i} t={t} />)
          ) : filtered.length === 0 ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: t.textMuted, fontSize: '13px',
            }}>No activity yet</div>
          ) : (
            filtered.map(item => <ActivityItem key={item.id} item={item} t={t} />)
          )}
        </div>
      </div>
    </>
  );
}
