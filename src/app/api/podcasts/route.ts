import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { cachePolicy, publicCacheControl } from "@/config/cache";
import { podcastFeeds } from "@/config/podcasts";
import { siteConfig } from "@/config/site";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: true,
});

function firstHttp(...values: unknown[]) {
  for (const value of values.flat(3)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value.trim())) {
      return value.trim();
    }
  }
  return "";
}

function pickArtwork(channel: Record<string, unknown>) {
  const itunes = channel["itunes:image"] as Record<string, unknown> | undefined;
  const image = channel.image as Record<string, unknown> | undefined;
  const media = channel["media:thumbnail"] as
    | Record<string, unknown>
    | undefined;
  return firstHttp(itunes?.["@_href"], image?.url, media?.["@_url"]);
}

async function readFeed(feed: (typeof podcastFeeds)[number]) {
  const policy = cachePolicy.podcasts;
  try {
    // Some feeds are several megabytes, above Next's per-entry Data Cache limit.
    // Fetch raw XML uncached, parse it, then cache only the compact summaries.
    const response = await fetch(feed.rss, {
      cache: "no-store",
      signal: AbortSignal.timeout(policy.requestTimeoutMs),
      headers: {
        "User-Agent": `${siteConfig.identity.initials}Portfolio/1.0 (+${siteConfig.origin})`,
      },
    });
    if (!response.ok) throw new Error(String(response.status));

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const channel = (parsed?.rss?.channel ?? parsed?.feed ?? {}) as Record<
      string,
      unknown
    >;
    const title =
      typeof channel.title === "string" ? channel.title : feed.title;
    return { ...feed, title, artwork: pickArtwork(channel) };
  } catch {
    return { ...feed, artwork: "" };
  }
}

const getPodcastSummaries = unstable_cache(
  async () => Promise.all(podcastFeeds.map(readFeed)),
  ["portfolio-podcast-summaries-v2", ...podcastFeeds.map((feed) => feed.rss)],
  {
    revalidate: cachePolicy.podcasts.dataRevalidateSeconds,
    tags: ["portfolio-podcasts"],
  },
);

export async function GET() {
  if (!siteConfig.features.demoRoutes) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const policy = cachePolicy.podcasts;
  const feeds = await getPodcastSummaries();
  return NextResponse.json(feeds, {
    headers: { "Cache-Control": publicCacheControl(policy) },
  });
}
