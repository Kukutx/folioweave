import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { portfolioSeo } from "@/portfolio";

function mediaType(src: string) {
  if (src.endsWith(".svg")) return "image/svg+xml";
  if (src.endsWith(".webp")) return "image/webp";
  if (src.endsWith(".jpg") || src.endsWith(".jpeg")) return "image/jpeg";
  if (src.endsWith(".ico")) return "image/x-icon";
  return "image/png";
}

export default function manifest(): MetadataRoute.Manifest {
  const { identity, themeColor, assets } = siteConfig;
  return {
    name: `${identity.name} Portfolio`,
    short_name: identity.name,
    description: portfolioSeo.description,
    start_url: "/",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    icons: [
      {
        src: assets.appleTouchIcon,
        sizes: assets.appleTouchIcon.endsWith(".svg") ? "any" : "180x180",
        type: mediaType(assets.appleTouchIcon),
      },
      {
        src: assets.icon,
        sizes: "any",
        type: mediaType(assets.icon),
      },
    ],
  };
}
