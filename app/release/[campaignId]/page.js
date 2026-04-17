'use client';
import { useState, useEffect } from 'react';
import { getCampaign } from '@/lib/releases';
import ReleaseFormWizard from '@/components/releases/ReleaseFormWizard';
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

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh', background: '#f8f9fa', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a2e', letterSpacing: '2px', marginBottom: '16px' }}>
          ANANDI PRODUCTIONS
        </div>
        <div style={{ fontSize: '14px', color: '#6b7280' }}>Loading...</div>
      </div>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#f8f9fa', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        maxWidth: '400px', background: '#fff', borderRadius: '16px',
        padding: '32px 28px', textAlign: 'center',
        border: '1px solid #e5e7eb', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ fontSize: '20px', fontWeight: 800, color: '#1a1a2e', letterSpacing: '2px', marginBottom: '20px' }}>
          ANANDI PRODUCTIONS
        </div>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', background: '#fef2f2',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '24px', margin: '0 auto 16px',
        }}>⚠️</div>
        <p style={{ fontSize: '15px', color: '#1a1a2e', fontWeight: 600, margin: '0 0 8px' }}>
          {message}
        </p>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
          Please contact Anandi Productions if you believe this is an error.
        </p>
      </div>
    </div>
  );
}
