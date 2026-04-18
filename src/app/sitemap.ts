import type { MetadataRoute } from 'next'

import { getSiteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl().origin
  const lastModified = new Date()
  return [
    { url: base, lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/login`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/signup`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/reset-password`, lastModified, changeFrequency: 'yearly', priority: 0.5 },
  ]
}
