'use client';

import { useState, useEffect } from 'react';
import { HIRING_ROLES } from '@/lib/interview-questions';

export default function HiringDashboard() {
  const [interviews, setInterviews] = useState([]);
  const [jobLinks, setJobLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPosition, setFilterPosition] = useState('all');
  const [tab, setTab] = useState('candidates'); // candidates | links
  const [creating, setCreating] = useState(false);
  const [newPosition, setNewPosition] = useState('video-editor');
  const [copiedToken, setCopiedToken] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [intRes, linkRes] = await Promise.all([
        fetch('/api/interview/list'),
        fetch('/api/interview/create'),
      ]);
      const intData = await intRes.json();
      const linkData = await linkRes.json();
      if (intData.success) setInterviews(intData.interviews);
      if (linkData.success) setJobLinks(linkData.links);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/interview/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: newPosition }),
      });
      const data = await res.json();
      if (data.success) {
        setJobLinks(prev => [data.link, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const copyLink = (url, token) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleAction = async (interviewId, action) => {
    setActionLoading(interviewId + action);
    try {
      await fetch('/api/interview/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, action }),
      });
      setInterviews(prev =>
        prev.map(i => i.id === interviewId
          ? { ...i, adminAction: action, status: action === 'approved' ? 'approved' : 'rejected' }
          : i)
      );
      if (selected?.id === interviewId) {
        setSelected(prev => ({ ...prev, adminAction: action, status: action === 'approved' ? 'approved' : 'rejected' }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // Filters
  const filtered = interviews.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
    if (filterPosition !== 'all' && i.position !== filterPosition) return false;
    return true;
  });

  const uniquePositions = [...new Set(interviews.map(i => i.position))];

  const scoreColor = (s) => s >= 80 ? '#22c55e' : s >= 60 ? '#f59e0b' : '#ef4444';
  const recBadge = (r) => ({
    'Strong Hire': { bg: '#14532d', color: '#22c55e', border: '#22c55e' },
    'Consider': { bg: '#451a03', color: '#f59e0b', border: '#f59e0b' },
    'Reject': { bg: '#450a0a', color: '#ef4444', border: '#ef4444' },
  }[r] || { bg: '#1e1e2e', color: '#9ca3af', border: '#374151' });

  const statusBadge = (s) => ({
    in_progress: { color: '#60a5fa', bg: '#1e3a5f' },
    completed: { color: '#9ca3af', bg: '#1e1e2e' },
    approved: { color: '#22c55e', bg: '#14532d' },
    rejected: { color: '#ef4444', bg: '#450a0a' },
  }[s] || { color: '#6b7280', bg: '#1e1e2e' });

  return (
    <div style={{ padding: '0' }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'Total Interviews', value: interviews.length, color: '#6366f1' },
          { label: 'Completed', value: interviews.filter(i => ['completed', 'approved', 'rejected'].includes(i.status)).length, color: '#22c55e' },
          { label: 'Pending Review', value: interviews.filter(i => i.status === 'completed' && !i.adminAction).length, color: '#f59e0b' },
          { label: 'Approved', value: interviews.filter(i => i.adminAction === 'approved').length, color: '#a78bfa' },
        ].map(s => (
          <div key={s.label} style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ color: s.color, fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{s.value}</div>
            <div style={{ color: '#6b7280', fontSize: '12px', marginTop: '4px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[['candidates', '👥 Candidates'], ['links', '🔗 Interview Links']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '8px 16px',
              background: tab === key ? '#6366f1' : '#16161f',
              border: `1px solid ${tab === key ? '#6366f1' : '#1e1e2e'}`,
              borderRadius: '8px',
              color: tab === key ? 'white' : '#9ca3af',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'candidates' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filterPosition} onChange={e => setFilterPosition(e.target.value)} style={selectStyle}>
              <option value="all">All Positions</option>
              {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={fetchData} style={{ padding: '8px 14px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '8px', color: '#9ca3af', fontSize: '13px', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Loading interviews...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
              No interviews found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filtered.map(interview => {
                const sc = interview.score;
                const sBadge = statusBadge(interview.status);
                const rBadge = sc ? recBadge(sc.recommendation) : null;

                return (
                  <div
                    key={interview.id}
                    onClick={() => setSelected(interview)}
                    style={{
                      background: '#16161f',
                      border: `1px solid ${selected?.id === interview.id ? '#6366f1' : '#1e1e2e'}`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      cursor: 'pointer',
                      transition: 'border-color 0.2s',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '16px',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ color: '#e4e4e7', fontWeight: '700', fontSize: '15px' }}>{interview.candidateName || 'Unknown'}</span>
                        <span style={{ padding: '2px 8px', background: sBadge.bg, color: sBadge.color, borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{interview.status?.replace('_', ' ').toUpperCase()}</span>
                        {sc?.recommendation && (
                          <span style={{ padding: '2px 8px', background: rBadge.bg, color: rBadge.color, border: `1px solid ${rBadge.border}`, borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                            {sc.recommendation}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '16px', color: '#6b7280', fontSize: '12px' }}>
                        <span>📋 {interview.position}</span>
                        <span>📧 {interview.candidateEmail}</span>
                        <span>📞 {interview.candidatePhone}</span>
                        {interview.location && <span>📍 {interview.location}</span>}
                      </div>
                      {sc?.redFlags?.length > 0 && (
                        <div style={{ marginTop: '6px', color: '#fca5a5', fontSize: '12px' }}>
                          ⚠️ {sc.redFlags[0]}{sc.redFlags.length > 1 ? ` +${sc.redFlags.length - 1} more` : ''}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {sc ? (
                        <div style={{ fontSize: '28px', fontWeight: '800', color: scoreColor(sc.totalScore) }}>
                          {sc.totalScore}<span style={{ fontSize: '14px', color: '#4b5563' }}>/100</span>
                        </div>
                      ) : (
                        <div style={{ color: '#4b5563', fontSize: '13px' }}>No score yet</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'links' && (
        <div>
          {/* Create new link */}
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ color: '#e4e4e7', fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>Create New Interview Link</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select value={newPosition} onChange={e => setNewPosition(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                {Object.entries(HIRING_ROLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.label}</option>
                ))}
              </select>
              <button onClick={createLink} disabled={creating} style={{ padding: '8px 20px', background: '#6366f1', border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: creating ? 'not-allowed' : 'pointer' }}>
                {creating ? 'Creating...' : '+ Create Link'}
              </button>
            </div>
          </div>

          {jobLinks.map(link => (
            <div key={link.id} style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '16px 20px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#e4e4e7', fontWeight: '600', marginBottom: '4px' }}>{link.position}</div>
                <div style={{ color: '#4b5563', fontSize: '12px', fontFamily: 'monospace', background: '#0d0d14', padding: '6px 10px', borderRadius: '6px', wordBreak: 'break-all' }}>{link.url}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px' }}>{link.interviewCount || 0} interviews</div>
                <button
                  onClick={() => copyLink(link.url, link.token)}
                  style={{ padding: '6px 14px', background: copiedToken === link.token ? '#22c55e' : '#0d0d14', border: `1px solid ${copiedToken === link.token ? '#22c55e' : '#1e1e2e'}`, borderRadius: '6px', color: copiedToken === link.token ? 'white' : '#9ca3af', fontSize: '12px', cursor: 'pointer' }}
                >
                  {copiedToken === link.token ? '✓ Copied' : '📋 Copy Link'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selected && (
        <CandidateDetailPanel
          interview={selected}
          onClose={() => setSelected(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
          scoreColor={scoreColor}
          recBadge={recBadge}
        />
      )}
    </div>
  );
}

function CandidateDetailPanel({ interview, onClose, onAction, actionLoading, scoreColor, recBadge }) {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const sc = interview.score;

  const scoreRows = sc ? [
    ['Role Skills', sc.scores?.skills, 25],
    ['Commitment', sc.scores?.commitment, 25],
    ['Work Pressure', sc.scores?.workPressure, 15],
    ['Background', sc.scores?.background, 15],
    ['Values Fit', sc.scores?.values, 10],
    ['Communication', sc.scores?.communication, 10],
  ] : [];

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px', background: '#12121a', borderLeft: '1px solid #1e1e2e', zIndex: 1000, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: '#12121a', zIndex: 10 }}>
        <div>
          <div style={{ color: '#e4e4e7', fontWeight: '700', fontSize: '18px' }}>{interview.candidateName}</div>
          <div style={{ color: '#9ca3af', fontSize: '13px', marginTop: '2px' }}>{interview.position}</div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>✕</button>
      </div>

      <div style={{ padding: '20px', flex: 1 }}>
        {/* Score */}
        {sc && (
          <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '20px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', fontWeight: '800', color: scoreColor(sc.totalScore) }}>
              {sc.totalScore}<span style={{ fontSize: '20px', color: '#4b5563' }}>/100</span>
            </div>
            {sc.recommendation && (
              <div style={{ display: 'inline-block', marginTop: '8px', padding: '4px 14px', background: recBadge(sc.recommendation).bg, color: recBadge(sc.recommendation).color, border: `1px solid ${recBadge(sc.recommendation).border}`, borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                {sc.recommendation}
              </div>
            )}
            {sc.summary && <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '12px', lineHeight: '1.6', textAlign: 'left' }}>{sc.summary}</p>}
          </div>
        )}

        {/* Candidate info */}
        <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <h3 style={{ color: '#a78bfa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Contact Details</h3>
          {[
            ['Email', interview.candidateEmail],
            ['Phone', interview.candidatePhone],
            ['Location', interview.location],
            ['Current CTC', interview.currentCTC],
            ['Expected CTC', interview.expectedCTC],
            ['Notice Period', interview.noticePeriod],
            ['Last Employer', interview.lastEmployerName],
            ['Last Employer Phone', interview.lastEmployerPhone],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #1e1e2e' }}>
              <span style={{ color: '#6b7280', fontSize: '12px' }}>{k}</span>
              <span style={{ color: '#e4e4e7', fontSize: '12px', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Score breakdown */}
        {sc && scoreRows.length > 0 && (
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ color: '#a78bfa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 12px' }}>Score Breakdown</h3>
            {scoreRows.map(([label, val, w]) => val !== undefined && (
              <div key={label} style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ color: '#9ca3af', fontSize: '12px' }}>{label} <span style={{ color: '#4b5563' }}>({w}%)</span></span>
                  <span style={{ color: val >= 7 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444', fontSize: '12px', fontWeight: '700' }}>{val}/10</span>
                </div>
                <div style={{ background: '#1e1e2e', borderRadius: '4px', height: '4px' }}>
                  <div style={{ background: val >= 7 ? '#22c55e' : val >= 5 ? '#f59e0b' : '#ef4444', width: `${val * 10}%`, height: '4px', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Red flags */}
        {sc?.redFlags?.length > 0 && (
          <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <h3 style={{ color: '#ef4444', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 8px' }}>⚠️ Red Flags</h3>
            {sc.redFlags.map((f, i) => <div key={i} style={{ color: '#fca5a5', fontSize: '13px', padding: '3px 0' }}>• {f}</div>)}
          </div>
        )}

        {/* Why hire/reject */}
        {sc && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            {sc.whyHire?.length > 0 && (
              <div style={{ background: '#0a1a0f', border: '1px solid #14532d', borderRadius: '10px', padding: '14px' }}>
                <h4 style={{ color: '#22c55e', fontSize: '11px', margin: '0 0 8px' }}>✅ WHY HIRE</h4>
                {sc.whyHire.map((p, i) => <div key={i} style={{ color: '#86efac', fontSize: '12px', padding: '2px 0' }}>• {p}</div>)}
              </div>
            )}
            {sc.whyReject?.length > 0 && (
              <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '10px', padding: '14px' }}>
                <h4 style={{ color: '#ef4444', fontSize: '11px', margin: '0 0 8px' }}>❌ WHY REJECT</h4>
                {sc.whyReject.map((p, i) => <div key={i} style={{ color: '#fca5a5', fontSize: '12px', padding: '2px 0' }}>• {p}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Transcript toggle */}
        {interview.messages?.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setTranscriptOpen(o => !o)}
              style={{ width: '100%', padding: '10px 16px', background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '10px', color: '#9ca3af', fontSize: '13px', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}
            >
              <span>💬 Full Interview Transcript ({interview.messages.length} messages)</span>
              <span>{transcriptOpen ? '▲' : '▼'}</span>
            </button>
            {transcriptOpen && (
              <div style={{ background: '#0d0d14', border: '1px solid #1e1e2e', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '16px', maxHeight: '400px', overflowY: 'auto' }}>
                {interview.messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: '12px' }}>
                    <div style={{ color: msg.role === 'user' ? '#6366f1' : '#a78bfa', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>
                      {msg.role === 'user' ? interview.candidateName : 'Aria (AI)'}
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '13px', lineHeight: '1.6', paddingLeft: '12px', borderLeft: `2px solid ${msg.role === 'user' ? '#6366f1' : '#4b5563'}` }}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {interview.status === 'completed' && !interview.adminAction && sc && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#12121a' }}>
          <button
            onClick={() => onAction(interview.id, 'rejected')}
            disabled={!!actionLoading}
            style={{ padding: '12px', background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '10px', color: '#ef4444', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >
            {actionLoading === interview.id + 'rejected' ? '...' : '❌ Reject'}
          </button>
          <button
            onClick={() => onAction(interview.id, 'approved')}
            disabled={!!actionLoading}
            style={{ padding: '12px', background: '#14532d', border: '1px solid #22c55e', borderRadius: '10px', color: '#22c55e', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}
          >
            {actionLoading === interview.id + 'approved' ? '...' : '✅ Approve → Round 2'}
          </button>
        </div>
      )}

      {interview.adminAction && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid #1e1e2e', textAlign: 'center', background: '#12121a' }}>
          <span style={{ color: interview.adminAction === 'approved' ? '#22c55e' : '#ef4444', fontSize: '14px', fontWeight: '700' }}>
            {interview.adminAction === 'approved' ? '✅ Approved — Recruiter Notified' : '❌ Rejected — Candidate Notified'}
          </span>
        </div>
      )}
    </div>
  );
}

const selectStyle = {
  padding: '8px 12px',
  background: '#16161f',
  border: '1px solid #1e1e2e',
  borderRadius: '8px',
  color: '#e4e4e7',
  fontSize: '13px',
  cursor: 'pointer',
};
