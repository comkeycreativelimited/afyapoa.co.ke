import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '../components/Providers';

export const metadata: Metadata = {
  title: 'COMKEY AFYA POA — Sovereign Healthcare SaaS',
  description: 'Multi-Tenant HMIS SaaS for Kenyan Healthcare Facilities (Levels 2-6)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 antialiased font-sans text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
