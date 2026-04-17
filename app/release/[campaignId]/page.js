'use client';
import { useState, useEffect } from 'react';
import { getCampaign } from '@/lib/releases';
import ReleaseFormWizard from '@/components/releases/ReleaseFormWizard';
import Logo from '@/components/Logo';
import { useParams } from 'next/navigation';

export default function ReleasePage() {
  const { campaignId } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!campaignId) return;
    getCampaign(campaignId)
      .then(c => {
        if (!c) setError('This release link is invalid.');
        else if (c.status !== 'active') setError('This release form is no longer accepting submissions.');
        else setCampaign(c);
      })
      .catch(() => setError('Something went wrong. Please try again.'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  return <ReleaseFormWizard campaign={campaign} campaignId={campaignId} />;
}

const pageWrap = {
  minHeight: '100vh',
  background: '#f0f2f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  padding: '24px 16px',
};

function LoadingScreen() {
  return (
    <div style={pageWrap}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <Logo variant="full" size={40} theme="light" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
          <Spinner />
          Loading…
        </div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={pageWrap}>
      <div style={{
        maxWidth: '420px', width: '100%',
        background: '#ffffff', borderRadius: '20px',
        padding: '36px 28px', textAlign: 'center',
        border: '1px solid #e5e7eb', boxShadow: '0 8px 40px rgba(0,0,0,0.07)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <Logo variant="full" size={36} theme="light" />
        </div>

        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: '#fef2f2', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', margin: '0 auto 16px',
        }}>⚠️</div>

        <p style={{ fontSize: '15px', color: '#111827', fontWeight: 600, margin: '0 0 8px' }}>
          {message}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          Please contact Anandi Productions if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: '16px', height: '16px',
      border: '2px solid #e5e7eb', borderTopColor: '#6366f1',
      borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    }} />
  );
}
