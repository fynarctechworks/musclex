import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { siteUrl } from '@/lib/site';

/**
 * design.md names Geist as the brand face and Inter only as an open-source
 * substitute. The real variable faces ship in this repo (copied from
 * `frontend/src/app/fonts/`), so the marketing site uses them directly —
 * which also means the build has no dependency on Google Fonts at all.
 */
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-mono',
  weight: '100 900',
  display: 'swap',
});

const title = 'MuscleX: the operating system for fitness businesses';
const description =
  'MuscleX is an AI-powered gym management platform: memberships, check-in, classes, payments, staff, marketing and a member mobile app, across every branch, in one system.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s | MuscleX',
  },
  description,
  applicationName: 'MuscleX',
  keywords: [
    'gym management software',
    'fitness studio software',
    'gym CRM',
    'membership management',
    'gym check-in software',
    'multi-branch gym software',
    'fitness club management',
  ],
  openGraph: {
    type: 'website',
    siteName: 'MuscleX',
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-canvas text-foreground">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-body-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
