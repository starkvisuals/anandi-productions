import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/Toast';
import FocusRing from '@/components/ui/FocusRing';

// The design system specifies Inter as the UI typeface, but it was never
// actually loaded — the app fell back to the system sans. next/font self-hosts
// it at build (no runtime request, CSP-safe) and exposes it as --font-inter,
// which globals.css applies to the whole app.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

export const metadata = {
  title: 'Anandi Productions',
  description: 'Production Management System',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* ThemeProvider is the source of design tokens for the new component
            library (components/ui/**). Legacy code (MainApp.js) still reads
            from its own THEMES map — safe to co-exist during Phase 2 migration. */}
        <ThemeProvider>
          <FocusRing />
          <ToastProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
