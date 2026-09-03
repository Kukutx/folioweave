import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  const { identity, themeColor } = siteConfig;
  return {
    name: `${identity.name} Portfolio`,
    short_name: identity.name,
    description:
      `Product design portfolio of ${identity.name}, featuring product work, case studies, writing, and photography.`,
    start_url: "/",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    icons: [
      {
        src: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
    ],
  };
}
