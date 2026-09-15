import type { NextConfig } from "next";

// Deliberately not a full Content-Security-Policy: the app relies on inline `style` attributes
// throughout (background colors, link-overlay positioning, etc.), and a strict `style-src`
// would need real testing against the live app (plus Vercel Analytics' injected script) to get
// right without breaking something. This covers the concrete, well-understood risk instead —
// clickjacking — without that hazard.
const clickjackingHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Every page except /embed/<slug>, which exists specifically to be framed elsewhere.
      { source: "/", headers: clickjackingHeaders },
      { source: "/login", headers: clickjackingHeaders },
      { source: "/setup", headers: clickjackingHeaders },
      { source: "/forgot-password", headers: clickjackingHeaders },
      { source: "/reset-password", headers: clickjackingHeaders },
      { source: "/reset-password/confirm", headers: clickjackingHeaders },
      { source: "/dashboard/:path*", headers: clickjackingHeaders },
      { source: "/f/:slug*", headers: clickjackingHeaders },
    ];
  },
};

export default nextConfig;
