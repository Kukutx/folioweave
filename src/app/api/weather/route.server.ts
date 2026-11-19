import { cachePolicy, publicCacheControl } from "@/config/cache";
import { siteConfig } from "@/config/site";
import { weatherResponse } from "@/lib/weather.mjs";

export async function GET() {
  return weatherResponse({
    enabled: siteConfig.features.weather,
    location: siteConfig.location,
    policy: cachePolicy.weather,
    cacheControl: publicCacheControl(cachePolicy.weather),
  });
}
