import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import '@connecto/design-tokens/css-variables.css';
import './globals.css';

import { AdminProviders } from './providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--connecto-font-admin',
});

export const metadata: Metadata = {
  title: 'Connecto Admin',
  description: 'Connecto admin health screen',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={inter.variable} lang="en">
      <body>
        <AdminProviders>{children}</AdminProviders>
      </body>
    </html>
  );
}
