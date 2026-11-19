// The response headers every page carries, shared by next.config.ts (Vercel,
// Cloudflare, local) and scripts/deploy.mjs (static hosts, which serve them
// from their own configuration).

/**
 * @param {{ development?: boolean, network?: Record<string, string[]> }} options
 *   `network` holds the extra sources plugins declare per CSP directive
 *   (src/portfolio/security.generated.json).
 * @returns {{ key: string, value: string }[]}
 */
export function securityHeaders({ development = false, network = {} } = {}) {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? " ws: wss:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
  ]
    .map((directive) => {
      const name = directive.split(" ")[0];
      const sources = network[name] ?? [];
      return sources.length ? `${directive} ${sources.join(" ")}` : directive;
    })
    .concat(
      Object.entries(network)
        .filter(([name]) => name === "frame-src")
        .map(([name, sources]) => `${name} 'self' ${sources.join(" ")}`),
    )
    .join("; ");

  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), browsing-topics=()",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
  ];
}
