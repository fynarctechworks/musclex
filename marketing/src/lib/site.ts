/**
 * Site-wide configuration for the MuscleX marketing website.
 *
 * This app is deliberately standalone: it makes NO calls to the MuscleX API,
 * Supabase, or any tenant data. Every outbound link into the product is built
 * from `appUrl` so the site can point at localhost in dev and the real app
 * host in production, via NEXT_PUBLIC_APP_URL.
 */

/** Where the gym admin app (`frontend/`) is served. */
export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? 'https://app.musclex.infynarc.com';

/** Public origin of THIS marketing site — used for canonical URLs + sitemap. */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3002';

export const routes = {
  home: '/',
  features: '/features',
  memberApp: '/member-app',
  pricing: '/pricing',
  security: '/security',
  contact: '/contact',
  privacy: '/legal/privacy',
  terms: '/legal/terms',
  refund: '/legal/refund',
} as const;

/**
 * Deep links into the product. Every "Start free" / "Log in" CTA on the site
 * routes through here — do not hardcode a product URL in a page.
 */
export const productLinks = {
  /** "Start free" → the admin app's sign-up. */
  signup: `${appUrl}/register`,
  /** "Log in" → the admin app's sign-in. */
  login: `${appUrl}/login`,
} as const;

/**
 * Everything reaches one inbox today.
 *
 * The named aliases are kept so pages can express *intent* ("this is a
 * security report", "this is a sales enquiry") without hardcoding an address.
 * If you later split these into real per-team inboxes, change them here and no
 * page needs touching.
 */
export const contactEmail = 'musclex@infynarc.com';
export const salesEmail = contactEmail;
export const securityEmail = contactEmail;
export const supportEmail = contactEmail;

export const primaryNav = [
  { label: 'Features', href: routes.features },
  { label: 'Member app', href: routes.memberApp },
  { label: 'Pricing', href: routes.pricing },
  { label: 'Security', href: routes.security },
  { label: 'Contact', href: routes.contact },
];

export const footerNav: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: routes.features },
      { label: 'Member app', href: routes.memberApp },
      { label: 'Pricing', href: routes.pricing },
      { label: 'Security', href: routes.security },
    ],
  },
  {
    title: 'Capabilities',
    links: [
      { label: 'Members & memberships', href: `${routes.features}#members` },
      { label: 'Check-in & attendance', href: `${routes.features}#check-in` },
      { label: 'Payments & finance', href: `${routes.features}#finance` },
      { label: 'Marketing & growth', href: `${routes.features}#growth` },
      { label: 'AI advisor', href: `${routes.features}#ai` },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: routes.contact },
      { label: 'Talk to sales', href: `mailto:${salesEmail}` },
      { label: 'Support', href: `mailto:${supportEmail}` },
      { label: 'Report a vulnerability', href: `mailto:${securityEmail}` },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy policy', href: routes.privacy },
      { label: 'Terms of service', href: routes.terms },
      { label: 'Refund policy', href: routes.refund },
    ],
  },
];
