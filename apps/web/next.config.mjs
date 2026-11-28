import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Optional: forward /backend/* to the API, so the browser only talks to the website's own address. Needed when the
 * website and the API are on two *.up.railway.app addresses: browsers treat those as two different sites and would
 * not keep the CRM signed in. Set API_PROXY_TARGET (the API root without /api, e.g. http://api.railway.internal:8080)
 * and NEXT_PUBLIC_API_URL=/backend/api before the build. Leave it unset when the API is on api.kouland.com.
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return apiProxyTarget ? [{ source: "/backend/:path*", destination: `${apiProxyTarget}/:path*` }] : [];
  },
  reactStrictMode: true,
  // @kouland/ui ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ["@kouland/ui"],
  // Website photos come from Unsplash's CDN (see src/content/images.ts).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default withNextIntl(nextConfig);
