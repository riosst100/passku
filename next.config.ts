import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content Security Policy without nonces (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 * nonces would force dynamic rendering, while the service worker relies on a static, cacheable shell
 * for offline use. 'unsafe-inline' is needed for Next's inline hydration scripts, but everything else
 * is locked to this origin; most importantly connect-src 'self', so an injected script can't send the
 * unlocked vault key to another server with fetch/XHR/WebSocket.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // HTTPS only for a year, including subdomains of this host.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Older browsers' equivalent of frame-ancestors 'none' (no clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Allow HMR/dev-resource requests from any *.local hostname (e.g. passku.local)
  // and the LAN IP, so local domain mapping tools work without editing this file.
  allowedDevOrigins: ["*.local", "10.145.252.226"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
