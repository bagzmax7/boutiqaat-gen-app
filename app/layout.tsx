import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Boutiqaat Creative AI Studio',
  description: 'AI-powered Studio Platform for Boutiqaat Creative Team',
  icons: { icon: '/Favicon.png' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
      </head>
      <body className="bg-bg-primary text-text-primary antialiased">
        {children}
        <Toaster
          position="top-right"
          containerStyle={{
            top: 20,
            right: 24,
          }}
          toastOptions={{
            style: {
              background: 'rgba(20, 22, 28, 0.92)',
              color: '#F8FAFC',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '8px 14px',
              fontSize: '11.5px',
              fontWeight: '600',
              letterSpacing: '0.01em',
              boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            },
            success: {
              iconTheme: { primary: '#a3e635', secondary: '#14161c' },
              duration: 3500,
            },
            error: {
              iconTheme: { primary: '#F43F5E', secondary: '#14161c' },
              duration: 4500,
            },
            loading: {
              iconTheme: { primary: '#a3e635', secondary: '#14161c' },
              duration: 60000,
            },
          }}
        />
      </body>
    </html>
  );
}
