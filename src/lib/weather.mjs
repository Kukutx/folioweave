/**
 * Pure HTTP boundary; Next supplies cache policy, tests supply the transport.
 * @param {{enabled: boolean, location: {latitude: number, longitude: number}, policy: {requestTimeoutMs: number, dataRevalidateSeconds: number}, cacheControl: string}} options
 * @param {typeof fetch} fetcher
 */
export async function weatherResponse(
  { enabled, location, policy, cacheControl },
  fetcher = fetch,
) {
  if (!enabled) return Response.json({ error: "Not Found" }, { status: 404 });
  try {
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,weather_code,is_day",
    });
    const response = await fetcher(
      `https://api.open-meteo.com/v1/forecast?${query}`,
      {
        next: { revalidate: policy.dataRevalidateSeconds },
        signal: AbortSignal.timeout(policy.requestTimeoutMs),
      },
    );
    if (!response.ok) throw new Error(`Weather ${response.status}`);
    const { current } = await response.json();
    if (
      !current ||
      !Number.isFinite(current.temperature_2m) ||
      !Number.isInteger(current.weather_code) ||
      ![0, 1].includes(current.is_day)
    )
      throw new Error("Invalid weather response");
    return Response.json(
      {
        status: "fresh",
        temperature: current.temperature_2m,
        weatherCode: current.weather_code,
        isDay: Boolean(current.is_day),
      },
      { headers: { "Cache-Control": cacheControl } },
    );
  } catch {
    return Response.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
