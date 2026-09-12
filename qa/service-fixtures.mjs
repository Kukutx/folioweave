import { loadQaProfile } from "./profile.mjs";

export const freshWeather = Object.freeze({
  status: "fresh",
  temperature: 21,
  weatherCode: 0,
  isDay: true,
});

/** Browser UI contracts never depend on an upstream service's availability. */
export async function installServiceFixtures(
  context,
  profile = loadQaProfile(),
  base = process.env.BASE_URL || "http://127.0.0.1:4181",
) {
  const origin = new URL(base).origin;
  await context.route(
    (url) => url.origin === origin && url.pathname === "/api/weather",
    (route) =>
      route.fulfill({
        status: profile.features.weather ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(
          profile.features.weather ? freshWeather : { error: "Not Found" },
        ),
      }),
  );
}
