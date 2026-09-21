import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build output (.next/standalone with its own server.js and only
  // the traced node_modules) so the Docker image can run without the full repo or
  // a `next start`. Required by the VPS/Coolify deploy; ignored by Vercel.
  output: "standalone",

  // sharp (a native binary) feathers the embed-card avatar in app/api/card-image.
  // Marking it external loads it from node_modules at runtime instead of bundling
  // it, so the correct platform binary is used on Vercel and in the standalone image.
  serverExternalPackages: ["sharp"],

  async rewrites() {
    // Pretty embed URL: gitfut.com/<username>.png -> the card image route. The
    // username charset matches GitHub's (alphanumerics + hyphens), and it only
    // matches the .png suffix, so this never shadows real static assets in
    // /public. Returned as an afterFiles rewrite (a plain array), so /public
    // files still win over it regardless.
    return [
      { source: "/:username([a-zA-Z0-9-]+).png", destination: "/api/card-image/:username" },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "gitfut",

  project: "gitfut",
  sentryUrl: process.env.NEXT_PUBLIC_SENTRY_URL,

  // Always report the source-map upload: the Docker build has no CI flag, and a
  // silent failure there means every production stack trace comes back minified.
  silent: false,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
