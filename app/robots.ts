import { APP_URL } from "@/app/lib/config";
import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     ["/", "/pricing", "/login", "/site"],
        disallow:  ["/dashboard", "/storyboard", "/audio", "/projects",
                    "/settings", "/dreamface", "/voiceclone", "/api/"],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
