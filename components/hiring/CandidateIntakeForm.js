'use client';

import { useState } from 'react';

export default function CandidateIntakeForm({ position, onSubmit }) {
  const [form, setForm] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
    currentCTC: '',
    expectedCTC: '',
    location: '',
    noticePeriod: '',
    lastEmployerName: '',
    lastEmployerPhone: '',
    whyInterested: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.candidateName || !form.candidateEmail || !form.candidatePhone) {
      setError('Please fill in all required fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: '#0d0d14',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '12px 14px',
    color: '#e4e4e7',
    fontSize: '14px',
    outline: 'none',
  };

  const labelStyle = {
    display: 'block',
    color: '#9ca3af',
    fontSize: '13px',
    marginBottom: '6px',
    fontWeight: '500',
  };

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px' }}>🎯</div>
        <h2 style={{ color: '#e4e4e7', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>Let's Get Started</h2>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
          Please fill in your details before we begin the interview for <strong style={{ color: '#a78bfa' }}>{position}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Required fields */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '4px 12px', marginBottom: '12px' }}>
            <p style={{ color: '#6366f1', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', margin: '8px 0 4px' }}>Required Information</p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} value={form.candidateName} onChange={e => update('candidateName', e.target.value)} placeholder="Your full name" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inputStyle} type="email" value={form.candidateEmail} onChange={e => update('candidateEmail', e.target.value)} placeholder="your@email.com" required />
            </div>
            <div>
              <label style={labelStyle}>Phone <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inputStyle} value={form.candidatePhone} onChange={e => update('candidatePhone', e.target.value)} placeholder="+91 98765 43210" required />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Current City / Location <span style={{ color: '#ef4444' }}>*</span></label>
            <input style={inputStyle} value={form.location} onChange={e => update('location', e.target.value)} placeholder="e.g. Mumbai, Maharashtra" required />
          </div>
        </div>

        {/* Professional details */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '8px', padding: '4px 12px', marginBottom: '12px' }}>
            <p style={{ color: '#6366f1', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', margin: '8px 0 4px' }}>Professional Details</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Current CTC (Annual)</label>
              <input style={inputStyle} value={form.currentCTC} onChange={e => update('currentCTC', e.target.value)} placeholder="e.g. 4.5 LPA" />
            </div>
            <div>
              <label style={labelStyle}>Expected CTC</label>
              <input style={inputStyle} value={form.expectedCTC} onChange={e => update('expectedCTC', e.target.value)} placeholder="e.g. 6 LPA" />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Notice Period / Availability to Join</label>
            <input style={inputStyle} value={form.noticePeriod} onChange={e => update('noticePeriod', e.target.value)} placeholder="e.g. Immediate / 30 days / 60 days" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Last / Current Employer</label>
              <input style={inputStyle} value={form.lastEmployerName} onChange={e => update('lastEmployerName', e.target.value)} placeholder="Company name" />
            </div>
            <div>
              <label style={labelStyle}>Their Contact Number</label>
              <input style={inputStyle} value={form.lastEmployerPhone} onChange={e => update('lastEmployerPhone', e.target.value)} placeholder="For reference check" />
            </div>
          </div>
        </div>

        {/* Why interested */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Why are you interested in this role? (Brief)</label>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5' }}
            value={form.whyInterested}
            onChange={e => update('whyInterested', e.target.value)}
            placeholder="Tell us briefly what draws you to this opportunity..."
          />
        </div>

        {error && (
          <div style={{ background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: '8px', padding: '12px 16px', color: '#fca5a5', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#374151' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Starting your interview...' : 'Start Interview →'}
        </button>

        <p style={{ color: '#4b5563', fontSize: '12px', textAlign: 'center', marginTop: '16px', lineHeight: '1.6' }}>
          This is a first-round AI interview. Your responses will be reviewed by the hiring team at Anandi Productions.
        </p>
      </form>
    </div>
  );
}
