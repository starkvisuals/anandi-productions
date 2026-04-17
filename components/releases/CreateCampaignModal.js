'use client';
import { useState } from 'react';
import { createCampaign } from '@/lib/releases';

export default function CreateCampaignModal({ t, onClose, onCreated, userProfile }) {
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const getLink = (id) => typeof window !== 'undefined'
    ? `${window.location.origin}/release/${id}`
    : `/release/${id}`;

  const submit = async (e) => {
    e?.preventDefault();
    if (!label.trim()) { setError('Please enter a campaign label'); return; }
    setError('');
    setSubmitting(true);
    try {
      const result = await createCampaign(userProfile, label);
      setCreated(result);
    } catch (err) {
      setError(err.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const copyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(getLink(created.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback: user can select manually */ }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: t.modalBg || '#14141c', borderRadius: '16px',
          border: `1px solid ${t.border}`, width: '100%', maxWidth: '480px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: t.text }}>
              {created ? 'Campaign Created' : 'New Release Campaign'}
            </h2>
            <div style={{ fontSize: '11px', color: t.textMuted, marginTop: '2px' }}>
              {created ? 'Share this link with models' : 'Create a shareable model release form'}
            </div>
          </div>
          <button onClick={created ? () => { onCreated?.(created); } : onClose} aria-label="Close" style={{ background: 'rgba(128,128,128,0.15)', border: 'none', color: t.textMuted, width: '32px', height: '32px', borderRadius: '50%', fontSize: '18px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '22px' }}>
          {created ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #22c55e, #10b981)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', margin: '0 auto 12px',
                }}>✓</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: t.text }}>{created.label}</div>
              </div>

              <div style={{ padding: '14px 16px', background: t.bgInput, border: `1px solid ${t.border}`, borderRadius: '12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '8px' }}>
                  Shareable Link
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    readOnly
                    value={getLink(created.id)}
                    onClick={e => e.target.select()}
                    style={{
                      flex: 1, padding: '10px 12px', background: t.modalBg || '#0b0b12',
                      border: `1px solid ${t.border}`, borderRadius: '8px', color: t.text,
                      fontSize: '12px', fontFamily: 'ui-monospace, monospace', outline: 'none',
                    }}
                  />
                  <button
                    onClick={copyLink}
                    style={{
                      padding: '10px 14px',
                      background: copied ? '#22c55e' : (t.gradientPrimary || t.primary),
                      color: '#fff', border: 'none', borderRadius: '8px',
                      fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? 'Copied ✓' : 'Copy'}
                  </button>
                </div>
                <div style={{ fontSize: '10px', color: t.textMuted, marginTop: '8px', lineHeight: 1.6 }}>
                  Send this link via WhatsApp or email. Models will fill out personal details, take a photo, sign the release, and agree to do's & don'ts — no login required.
                </div>
              </div>

              <button
                onClick={() => onCreated?.(created)}
                style={{
                  padding: '11px 22px', background: t.gradientPrimary || t.primary,
                  color: '#fff', border: 'none', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '6px' }}>
                  Campaign / Project Label *
                </label>
                <input
                  value={label}
                  onChange={e => setLabel(e.target.value)}
                  placeholder="e.g. Nike Shoot April 2026"
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px', background: t.bgInput,
                    border: `1px solid ${t.border}`, borderRadius: '10px', color: t.text,
                    fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: t.danger || '#ef4444', fontSize: '12px' }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '11px 20px', background: 'transparent', color: t.textMuted, border: `1px solid ${t.border}`, borderRadius: '10px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting} style={{ padding: '11px 22px', background: t.gradientPrimary || t.primary, color: '#fff', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Creating...' : 'Create Campaign'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
