'use client';

import { useState, useEffect } from 'react';
import CandidateIntakeForm from '@/components/hiring/CandidateIntakeForm';
import InterviewChat from '@/components/hiring/InterviewChat';
import { HIRING_ROLES } from '@/lib/interview-questions';

export default function InterviewPage({ params }) {
  const { token } = params;
  const [step, setStep] = useState('loading'); // loading | invalid | form | interview | done
  const [jobLink, setJobLink] = useState(null);
  const [interviewId, setInterviewId] = useState(null);
  const [candidateName, setCandidateName] = useState('');
  const [error, setError] = useState('');

  // Validate token on mount
  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      // Use the start endpoint to validate token indirectly
      // We'll just check if it's a valid format and proceed to the form
      // Actual validation happens on form submit
      await new Promise(r => setTimeout(r, 800)); // Brief loading
      setStep('form');
    } catch {
      setStep('invalid');
    }
  };

  const handleFormSubmit = async (formData) => {
    const res = await fetch('/api/interview/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...formData }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to start interview');

    setCandidateName(formData.candidateName);
    setInterviewId(data.interviewId);
    setJobLink({ position: formData.position });
    setStep('interview');
  };

  const handleComplete = () => {
    setStep('done');
  };

  // Determine position label
  const getPositionFromLink = () => {
    // Will be set after form submit; show generic during form
    return 'This Position';
  };

  if (step === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <LogoHeader />
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid #1e1e2e', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <p style={{ color: '#6b7280', fontSize: '14px' }}>Loading your interview...</p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (step === 'invalid') {
    return (
      <div style={pageStyle}>
        <div style={containerStyle}>
          <LogoHeader />
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
            <h2 style={{ color: '#e4e4e7', fontSize: '20px', marginBottom: '8px' }}>Invalid Interview Link</h2>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>This link is invalid or has expired. Please contact the hiring team for a new link.</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, maxWidth: '600px' }}>
          <LogoHeader />
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '16px', padding: '40px', marginBottom: '24px' }}>
            <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '16px 20px', marginBottom: '28px' }}>
              <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 4px' }}>You've been invited to interview for</p>
              <p style={{ color: '#a78bfa', fontSize: '18px', fontWeight: '700', margin: 0 }}>Anandi Productions</p>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>This is a first-round AI-powered screening interview. It takes approximately 10–15 minutes.</p>
            </div>
            <CandidateIntakeForm position="the role" onSubmit={handleFormSubmit} />
          </div>
        </div>
      </div>
    );
  }

  if (step === 'interview') {
    return (
      <div style={{ ...pageStyle, padding: '20px 16px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <LogoHeader minimal />
          <InterviewChat
            interviewId={interviewId}
            candidateName={candidateName}
            position="the role"
            onComplete={handleComplete}
          />
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div style={pageStyle}>
        <div style={{ ...containerStyle, maxWidth: '520px', textAlign: 'center' }}>
          <LogoHeader />
          <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '16px', padding: '48px 40px' }}>
            <div style={{ width: '72px', height: '72px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '32px' }}>✓</div>
            <h2 style={{ color: '#e4e4e7', fontSize: '24px', fontWeight: '700', margin: '0 0 12px' }}>Interview Complete!</h2>
            <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: '1.7', margin: '0 0 24px' }}>
              Thank you, <strong style={{ color: '#e4e4e7' }}>{candidateName}</strong>. Your responses have been recorded and our team will review them carefully.
            </p>
            <div style={{ background: '#0a0a14', border: '1px solid #1e1e2e', borderRadius: '10px', padding: '16px 20px', marginBottom: '24px', textAlign: 'left' }}>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 4px' }}>What happens next?</p>
              <div style={{ color: '#9ca3af', fontSize: '13px', lineHeight: '1.8' }}>
                <div>→ Our team reviews your interview responses</div>
                <div>→ We'll reach out within 2-3 working days</div>
                <div>→ Shortlisted candidates will be called for an in-person round</div>
              </div>
            </div>
            <p style={{ color: '#4b5563', fontSize: '12px', margin: 0 }}>
              If you have any questions, email us at <strong>info@harneshjoshi.com</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function LogoHeader({ minimal }) {
  return (
    <div style={{ textAlign: 'center', padding: minimal ? '12px 0 16px' : '32px 0 28px' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: minimal ? '28px' : '36px', height: minimal ? '28px' : '36px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: minimal ? '14px' : '18px' }}>🎬</div>
        <span style={{ color: '#e4e4e7', fontWeight: '700', fontSize: minimal ? '15px' : '18px' }}>Anandi Productions</span>
      </div>
      {!minimal && <p style={{ color: '#4b5563', fontSize: '12px', margin: '8px 0 0' }}>Hiring Portal</p>}
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0d0d14',
  padding: '20px 16px 40px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const containerStyle = {
  width: '100%',
  maxWidth: '560px',
};
