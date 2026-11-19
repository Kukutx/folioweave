import { cachePolicy } from "@/config/cache";
import { siteConfig } from "@/config/site";
import { weatherResponse } from "@/lib/weather.mjs";

/** The weather service the browser calls directly on static hosts. */
export const WEATHER_SERVICE = "https://api.open-meteo.com";

/**
 * The site's current weather as the /api/weather response. Static hosts have
 * no server (npm run deploy -- firebase sets NEXT_PUBLIC_WEATHER_DIRECT), so
 * there the browser asks the weather service itself, parsed the same way.
 */
export function fetchWeather(signal: AbortSignal): Promise<Response> {
  if (process.env.NEXT_PUBLIC_WEATHER_DIRECT === "1")
    return weatherResponse(
      {
        enabled: siteConfig.features.weather,
        location: siteConfig.location,
        policy: cachePolicy.weather,
        cacheControl: "no-store",
      },
      (input, init) => fetch(input, { ...init, signal }),
    );
  return fetch("/api/weather", { signal });
}
