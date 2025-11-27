'use client';

import { useAuth } from '@/lib/auth-context';
import SetupWizard from '@/components/SetupWizard';
import LoginPage from '@/components/LoginPage';
import MainApp from '@/components/MainApp';

export default function Home() {
  const { user, userProfile, loading, isSetupComplete } = useAuth();

  // Loading state
  if (loading || isSetupComplete === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-4xl mb-4 spinner">⚙️</div>
          <div className="text-gray-400">Loading...</div>
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
