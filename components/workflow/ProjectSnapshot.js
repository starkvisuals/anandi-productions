'use client';
import { useState } from 'react';

const THEMES = {
  dark:  { bgCard: '#1e1e28', bgInput: '#0d0d12', bgSecondary: '#111118', border: '#2a2a3a', borderLight: '#1e1e2e', text: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)', textMuted: 'rgba(255,255,255,0.4)', primary: '#6366f1', success: '#22c55e', cardRadius: '16px', shadow: '0 8px 32px rgba(0,0,0,0.5)' },
  light: { bgCard: '#ffffff', bgInput: '#f8f9fb', bgSecondary: '#ffffff', border: '#e0e3e8', borderLight: '#ebedf0', text: '#111827', textSecondary: '#4b5563', textMuted: '#9ca3af', primary: '#6366f1', success: '#16a34a', cardRadius: '16px', shadow: '0 8px 32px rgba(0,0,0,0.1)' },
};

function formatDeadline(deadline) {
  if (!deadline) return 'No deadline';
  const d = deadline?.toDate ? deadline.toDate() : new Date(deadline);
  if (isNaN(d)) return 'No deadline';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function countTeamMembers(project) {
  const individual = Array.isArray(project?.assignedTeam) ? project.assignedTeam.length : 0;
  const groups = Array.isArray(project?.teamGroups) ? project.teamGroups.length : 0;
  return individual + groups;
}

function TypeBadge({ type, t }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: '600', padding: '2px 7px',
      borderRadius: '8px', background: `${t.primary}20`, color: t.primary,
      letterSpacing: '0.02em', textTransform: 'uppercase',
    }}>{type || '—'}</span>
  );
}

function StatTile({ label, children, t }) {
  return (
    <div style={{
      flex: '1 1 calc(50% - 6px)', minWidth: '120px',
      background: t.bgInput, borderRadius: '10px',
      border: `1px solid ${t.borderLight}`,
      padding: '12px 14px',
    }}>
      <div style={{ fontSize: '10px', color: t.textMuted, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: '600', color: t.text }}>{children}</div>
    </div>
  );
}

function MiniProgressBar({ done, total, t }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ height: '4px', borderRadius: '2px', background: t.border, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: t.success, borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

export default function ProjectSnapshot({
  project = {},
  blocks = [],
  currentBlock = null,
  deliverables = [],
  t: tProp,
  theme = 'dark',
}) {
  const t = tProp || THEMES[theme] || THEMES.dark;
  const [open, setOpen] = useState(true);

  const memberCount = countTeamMembers(project);
  const totalDel = deliverables.length;
  const doneDel  = deliverables.filter(d => d.done === true && (d.qty ?? 0) > 0).length;

  return (
    <div style={{
      background: t.bgCard, borderRadius: t.cardRadius, border: `1px solid ${t.border}`,
      boxShadow: t.shadow, overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'transparent', border: 'none',
          borderBottom: open ? `1px solid ${t.border}` : 'none',
          color: t.text, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: t.textMuted, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▸</span>
          Project Overview
        </span>
        {!open && currentBlock && (
          <span style={{ fontSize: '11px', color: t.textMuted }}>{currentBlock.label}</span>
        )}
      </button>

      {open && (
        <div style={{ padding: '16px 18px' }}>
          {/* Stat tiles — 2×2 responsive wrap */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: totalDel > 0 ? '16px' : '0' }}>
            {/* Stage */}
            <StatTile label="Stage" t={t}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{currentBlock?.label || 'Not started'}</span>
                {currentBlock?.type && <TypeBadge type={currentBlock.type} t={t} />}
              </div>
            </StatTile>

            {/* Team */}
            <StatTile label="Team" t={t}>
              {memberCount > 0 ? `${memberCount} member${memberCount !== 1 ? 's' : ''}` : '—'}
            </StatTile>

            {/* Deliverables */}
            <StatTile label="Deliverables" t={t}>
              {totalDel > 0 ? (
                <>
                  <span>{doneDel}/{totalDel}</span>
                  <MiniProgressBar done={doneDel} total={totalDel} t={t} />
                </>
              ) : '—'}
            </StatTile>

            {/* Deadline */}
            <StatTile label="Deadline" t={t}>
              {formatDeadline(project.deadline)}
            </StatTile>
          </div>

          {/* Deliverables compact list */}
          {totalDel > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {deliverables.map((d, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', background: t.bgInput, borderRadius: '8px',
                  border: `1px solid ${t.borderLight}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                      background: d.done ? t.success : 'transparent',
                      border: `1.5px solid ${d.done ? t.success : t.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {d.done && <span style={{ color: '#fff', fontSize: '9px', lineHeight: 1 }}>✓</span>}
                    </span>
                    <span style={{ fontSize: '12px', color: t.text }}>{d.name || '(unnamed)'}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: t.textMuted }}>
                    {d.qty ? `${d.qty} ${d.type || ''}` : d.type || ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
