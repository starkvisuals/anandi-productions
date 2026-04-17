'use client';
import { useState, useEffect, useMemo } from 'react';
import { getCampaigns, getSubmissions, archiveCampaign, deleteSubmission } from '@/lib/releases';
import CreateCampaignModal from './CreateCampaignModal';

export default function ReleasesModule({ t, userProfile }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  const [copied, setCopied] = useState('');

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const list = await getCampaigns();
      setCampaigns(list);
    } catch (err) {
      console.error('Load campaigns error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const loadSubmissions = async (campaign) => {
    setSelectedCampaign(campaign);
    setSelectedSub(null);
    setSubsLoading(true);
    try {
      const subs = await getSubmissions(campaign.id);
      setSubmissions(subs);
    } catch (err) {
      console.error('Load submissions error:', err);
    } finally {
      setSubsLoading(false);
    }
  };

  const getLink = (id) => typeof window !== 'undefined'
    ? `${window.location.origin}/release/${id}`
    : `/release/${id}`;

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(''), 1800);
    } catch { /* */ }
  };

  const handleArchive = async (campaignId) => {
    if (!confirm('Archive this campaign? Models will no longer be able to submit.')) return;
    await archiveCampaign(campaignId);
    loadCampaigns();
  };

  const handleDeleteSub = async (subId) => {
    if (!confirm('Delete this submission? This cannot be undone.')) return;
    await deleteSubmission(selectedCampaign.id, subId);
    loadSubmissions(selectedCampaign);
  };

  const downloadPdf = async (sub) => {
    try {
      const res = await fetch('/api/release/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: selectedCampaign.id, submissionId: sub.id }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Model-Release-${sub.name?.replace(/\s+/g, '-') || 'unknown'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate PDF: ' + err.message);
    }
  };

  // ─── Submission detail view ─────────────────────────────────────────────
  if (selectedSub) {
    const s = selectedSub;
    const fmtDate = (v) => {
      if (!v) return '—';
      const d = v.toDate ? v.toDate() : new Date(v);
      return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div style={{ padding: '20px', maxWidth: '700px' }}>
        <button onClick={() => setSelectedSub(null)} style={backBtn(t)}>← Back to submissions</button>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: t.text, margin: '16px 0 20px' }}>{s.name}</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          {s.photoUrl && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              <img src={s.photoUrl} alt={s.name} style={{ width: '160px', height: '160px', borderRadius: '12px', objectFit: 'cover', border: `2px solid ${t.border}` }} />
            </div>
          )}
          <InfoRow label="Phone" value={s.phone} t={t} />
          <InfoRow label="Aadhar" value={s.aadhar} t={t} />
          <InfoRow label="Date of Birth" value={s.dob} t={t} />
          <InfoRow label="Address" value={s.address} t={t} span />
          <InfoRow label="GPS" value={s.gpsLat && s.gpsLng ? `${s.gpsLat.toFixed(6)}, ${s.gpsLng.toFixed(6)}` : 'Not captured'} t={t} />
          <InfoRow label="Submitted" value={fmtDate(s.submittedAt)} t={t} />
          <InfoRow label="Release Agreed" value={fmtDate(s.agreedReleaseAt)} t={t} />
          <InfoRow label="Conduct Agreed" value={fmtDate(s.agreedDosDontsAt)} t={t} />
          <InfoRow label="IP Address" value={s.signatureIp || '—'} t={t} />
          {s.signatureUrl && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, marginBottom: '6px', textTransform: 'uppercase' }}>Signature</div>
              <img src={s.signatureUrl} alt="Signature" style={{ maxWidth: '300px', borderRadius: '8px', border: `1px solid ${t.border}`, background: '#fff' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => downloadPdf(s)} style={actionBtn(t)}>📄 Download PDF</button>
          <button onClick={() => handleDeleteSub(s.id)} style={{ ...actionBtn(t), color: t.danger || '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>🗑️ Delete</button>
        </div>
      </div>
    );
  }

  // ─── Submissions list for a campaign ────────────────────────────────────
  if (selectedCampaign) {
    return (
      <div style={{ padding: '20px' }}>
        <button onClick={() => { setSelectedCampaign(null); setSubmissions([]); }} style={backBtn(t)}>← Back to campaigns</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 20px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: t.text, margin: 0 }}>{selectedCampaign.label}</h2>
            <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</div>
          </div>
          <button
            onClick={() => copyToClipboard(getLink(selectedCampaign.id), 'link')}
            style={actionBtn(t)}
          >
            {copied === 'link' ? 'Copied ✓' : '🔗 Copy Link'}
          </button>
        </div>

        {subsLoading ? (
          <div style={{ fontSize: '13px', color: t.textMuted, padding: '20px 0' }}>Loading submissions...</div>
        ) : submissions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', background: t.bgInput, borderRadius: '12px', border: `1px solid ${t.border}` }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>No submissions yet</div>
            <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '4px' }}>Share the link with models to start collecting releases</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {submissions.map(sub => {
              const fmtDate = sub.submittedAt?.toDate
                ? sub.submittedAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—';
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 16px', background: t.bgInput,
                    border: `1px solid ${t.border}`, borderRadius: '10px',
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = t.primary}
                  onMouseOut={e => e.currentTarget.style.borderColor = t.border}
                >
                  {sub.photoUrl ? (
                    <img src={sub.photoUrl} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                      {(sub.name || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>{sub.name}</div>
                    <div style={{ fontSize: '11px', color: t.textMuted }}>{sub.phone} · {fmtDate}</div>
                  </div>
                  <div style={{ fontSize: '18px', color: t.textMuted }}>›</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ─── Campaigns list ─────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: t.text, margin: 0 }}>Model Releases</h2>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '2px' }}>Create & manage release campaigns</div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: '10px 18px', background: t.gradientPrimary || t.primary,
            color: '#fff', border: 'none', borderRadius: '10px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          }}
        >
          + New Campaign
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: '13px', color: t.textMuted, padding: '20px 0' }}>Loading...</div>
      ) : campaigns.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', background: t.bgInput, borderRadius: '12px', border: `1px solid ${t.border}` }}>
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: t.text }}>No campaigns yet</div>
          <div style={{ fontSize: '12px', color: t.textMuted, marginTop: '6px', maxWidth: '300px', margin: '6px auto 0' }}>
            Create a release campaign to generate a shareable link for models to sign their release forms.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {campaigns.map(c => {
            const fmtDate = c.createdAt?.toDate
              ? c.createdAt.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—';
            const isArchived = c.status === 'archived';
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '16px 18px', background: t.bgInput,
                  border: `1px solid ${t.border}`, borderRadius: '12px',
                  opacity: isArchived ? 0.6 : 1,
                }}
              >
                <div
                  onClick={() => loadSubmissions(c)}
                  style={{ flex: 1, cursor: 'pointer' }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: t.text }}>
                    {c.label}
                    {isArchived && <span style={{ fontSize: '10px', color: t.textMuted, marginLeft: '8px', fontWeight: 400 }}>ARCHIVED</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '3px' }}>
                    {fmtDate} · {c.submissionCount || 0} submission{(c.submissionCount || 0) !== 1 ? 's' : ''} · by {c.createdByName || 'Admin'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => copyToClipboard(getLink(c.id), c.id)}
                    title="Copy link"
                    style={smallBtn(t)}
                  >
                    {copied === c.id ? '✓' : '🔗'}
                  </button>
                  {!isArchived && (
                    <button
                      onClick={() => handleArchive(c.id)}
                      title="Archive"
                      style={smallBtn(t)}
                    >
                      📦
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          t={t}
          userProfile={userProfile}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadCampaigns(); }}
        />
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, t, span }) => (
  <div style={span ? { gridColumn: '1 / -1' } : {}}>
    <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontSize: '13px', color: t.text, lineHeight: 1.5 }}>{value || '—'}</div>
  </div>
);

const backBtn = (t) => ({
  padding: '8px 14px', background: 'transparent', color: t.textMuted,
  border: `1px solid ${t.border}`, borderRadius: '8px',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
});

const actionBtn = (t) => ({
  padding: '9px 16px', background: 'transparent', color: t.text,
  border: `1px solid ${t.border}`, borderRadius: '8px',
  fontSize: '12px', fontWeight: 600, cursor: 'pointer',
});

const smallBtn = (t) => ({
  width: '34px', height: '34px', background: 'rgba(128,128,128,0.1)',
  border: `1px solid ${t.border}`, borderRadius: '8px',
  fontSize: '14px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
});
