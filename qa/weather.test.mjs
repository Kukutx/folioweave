import test from "node:test";
import assert from "node:assert/strict";
import { weatherResponse } from "../src/lib/weather.mjs";

const options = {
  enabled: true,
  location: { latitude: 45, longitude: 9 },
  policy: { requestTimeoutMs: 10, dataRevalidateSeconds: 600 },
  cacheControl: "public, max-age=300",
};
test("disabled weather never calls the transport", async () => {
  const response = await weatherResponse({ ...options, enabled: false }, () => {
    assert.fail("fetch while disabled");
  });
  assert.equal(response.status, 404);
});
test("fresh weather validates upstream data and preserves the cache contract", async () => {
  const response = await weatherResponse(options, async (url, init) => {
    assert.equal(new URL(url).searchParams.get("latitude"), "45");
    assert.equal(init.next.revalidate, 600);
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json({
      current: { temperature_2m: 21, weather_code: 0, is_day: 1 },
    });
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), options.cacheControl);
  assert.deepEqual(await response.json(), {
    status: "fresh",
    temperature: 21,
    weatherCode: 0,
    isDay: true,
  });
});
for (const [name, transport] of Object.entries({
  "HTTP failure": async () => new Response("", { status: 502 }),
  "malformed JSON": async () => new Response("not JSON"),
  "invalid data": async () =>
    Response.json({ current: { temperature_2m: "21" } }),
  "network failure": async () => {
    throw new TypeError("network down");
  },
  timeout: async (_url, { signal }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1000);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    }),
}))
  test(`weather ${name} is explicitly unavailable and never cached`, async () => {
    const response = await weatherResponse(options, transport);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "unavailable" });
  });
