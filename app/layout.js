import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme';
import FocusRing from '@/components/ui/FocusRing';

export const metadata = {
  title: 'Anandi Productions',
  description: 'Production Management System',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* ThemeProvider is the source of design tokens for the new component
            library (components/ui/**). Legacy code (MainApp.js) still reads
            from its own THEMES map — safe to co-exist during Phase 2 migration. */}
        <ThemeProvider>
          <FocusRing />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
