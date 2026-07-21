import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // The schedule is a build artefact for the television, not a document.
      // Nothing is hidden by this — it is served publicly either way — it just
      // has no business in an index.
      disallow: '/schedule/',
    },
    sitemap: 'https://starrytv.vercel.app/sitemap.xml',
  };
}
