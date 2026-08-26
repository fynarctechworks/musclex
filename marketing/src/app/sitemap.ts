import type { MetadataRoute } from 'next';
import { routes, siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const entries: { path: string; priority: number; changeFrequency: 'monthly' | 'yearly' }[] = [
    { path: routes.home, priority: 1, changeFrequency: 'monthly' },
    { path: routes.features, priority: 0.9, changeFrequency: 'monthly' },
    { path: routes.pricing, priority: 0.9, changeFrequency: 'monthly' },
    { path: routes.memberApp, priority: 0.8, changeFrequency: 'monthly' },
    { path: routes.security, priority: 0.7, changeFrequency: 'monthly' },
    { path: routes.contact, priority: 0.6, changeFrequency: 'yearly' },
    // Linked from both app stores as the support URL, so it should be indexed.
    { path: routes.support, priority: 0.6, changeFrequency: 'monthly' },
    { path: routes.privacy, priority: 0.3, changeFrequency: 'yearly' },
    { path: routes.terms, priority: 0.3, changeFrequency: 'yearly' },
    { path: routes.refund, priority: 0.3, changeFrequency: 'yearly' },
  ];

  return entries.map((entry) => ({
    url: `${siteUrl}${entry.path === '/' ? '' : entry.path}`,
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));
}
