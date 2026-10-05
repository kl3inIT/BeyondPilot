import type { MetadataRoute } from "next";

import { siteOrigin } from "@/lib/site";

/** Pages with their own content, in both languages; coming-soon pages join when they get a screen. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteOrigin,
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: { en: siteOrigin, vi: `${siteOrigin}/vi` } },
    },
  ];
}
