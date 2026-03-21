'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import SetupWizard from '@/components/SetupWizard';
import LoginPage from '@/components/LoginPage';
import MainApp from '@/components/MainApp';
import SplashScreen from '@/components/SplashScreen';
import Logo from '@/components/Logo';

export default function Home() {
  const { user, userProfile, loading, isSetupComplete } = useAuth();
  const [showSplash, setShowSplash] = useState(false);

  useEffect(() => {
    // Only show splash once per browser session
    if (!sessionStorage.getItem('splashShown')) {
      setShowSplash(true);
    }
  }, []);

  const handleSplashComplete = useCallback(() => {
    sessionStorage.setItem('splashShown', 'true');
    setShowSplash(false);
  }, []);

  // Show splash screen on first visit this session
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // Loading state with animated logo
  if (loading || isSetupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div style={{ animation: 'fadeIn 0.5s ease-out, breathe 2s ease-in-out infinite' }}>
            <Logo variant="icon" size={48} animated={true} theme="dark" />
          </div>
          <div className="text-gray-400 mt-4" style={{ animation: 'fadeIn 0.8s ease-out' }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  // Setup not complete - show wizard
  if (!isSetupComplete) {
    return <SetupWizard />;
  }

  // Not logged in - show login page
  if (!user || !userProfile) {
    return <LoginPage />;
  }

  // Logged in - show main app
  return <MainApp />;
}
