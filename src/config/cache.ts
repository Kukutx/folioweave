type PublicCachePolicy = {
  dataRevalidateSeconds: number;
  clientMaxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  requestTimeoutMs: number;
};

export const cachePolicy = {
  weather: {
    dataRevalidateSeconds: 600,
    clientMaxAgeSeconds: 300,
    staleWhileRevalidateSeconds: 600,
    requestTimeoutMs: 5_000,
  },
  podcasts: {
    dataRevalidateSeconds: 21_600,
    clientMaxAgeSeconds: 3_600,
    staleWhileRevalidateSeconds: 21_600,
    requestTimeoutMs: 10_000,
  },
} satisfies Record<string, PublicCachePolicy>;

export function publicCacheControl(policy: PublicCachePolicy) {
  return `public, max-age=${policy.clientMaxAgeSeconds}, stale-while-revalidate=${policy.staleWhileRevalidateSeconds}`;
}
