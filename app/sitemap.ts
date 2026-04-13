import { APP_URL } from "@/app/lib/config";
import type { MetadataRoute } from "next";


export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url:             APP_URL,
      lastModified:    now,
      changeFrequency: "weekly",
      priority:        1.0,
    },
    {
      url:             `${APP_URL}/pricing`,
      lastModified:    now,
      changeFrequency: "monthly",
      priority:        0.9,
    },
    {
      url:             `${APP_URL}/login`,
      lastModified:    now,
      changeFrequency: "yearly",
      priority:        0.5,
    },
  ];
}
