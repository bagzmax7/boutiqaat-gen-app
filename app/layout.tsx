import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Boutiqaat Studio AI Hub',
  description: 'AI-powered Studio Platform for Boutiqaat Creative Team',
  icons: { icon: '/favicon.ico' },
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
          toastOptions={{
            style: {
              background: '#13131F',
              color: '#F1F5F9',
              border: '1px solid #1E1E30',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#13131F' },
              duration: 4000,
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#13131F' },
              duration: 5000,
            },
            loading: {
              duration: 60000, // auto-dismiss loading toasts after 60s as a safety fallback
            },
          }}
        />
      </body>
    </html>
  );
}
