import type { MetadataRoute } from 'next';
import { library } from '@/content/library';

const BASE = 'https://starrytv.vercel.app';

/**
 * Two pages and a hundred anchors.
 *
 * The books are not separate routes yet — they are fragments of the hub — so
 * they are not listed individually here. Phase 4 gives each published review its
 * own `/review/[slug]`, and that is when this file starts earning its keep.
 * Genre anchors are included because they are the coarse divisions people
 * actually link to.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/tv`, changeFrequency: 'monthly', priority: 0.8 },
    ...library.map((g) => ({
      url: `${BASE}/#${g.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
