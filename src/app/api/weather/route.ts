import { NextResponse } from "next/server";
import { cachePolicy, publicCacheControl } from "@/config/cache";
import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

export async function GET() {
  const policy = cachePolicy.weather;
  try {
    const query = new URLSearchParams({
      latitude: String(siteConfig.location.latitude),
      longitude: String(siteConfig.location.longitude),
      current: "temperature_2m,weather_code,is_day",
    });
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${query}`,
      {
        next: { revalidate: policy.dataRevalidateSeconds },
        signal: AbortSignal.timeout(policy.requestTimeoutMs),
      },
    );
    if (!response.ok) throw new Error(`Weather ${response.status}`);
    const data = await response.json();
    return NextResponse.json(
      {
        temperature: data.current?.temperature_2m ?? null,
        weatherCode: data.current?.weather_code ?? 2,
        isDay: Boolean(data.current?.is_day),
      },
      { headers: { "Cache-Control": publicCacheControl(policy) } },
    );
  } catch {
    return NextResponse.json(
      { temperature: null, weatherCode: 2, isDay: true },
      { headers: { "Cache-Control": publicCacheControl(policy) } },
    );
  }
}
