import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @kouland/ui ships TypeScript source, so Next compiles it with the app.
  transpilePackages: ["@kouland/ui"],
  // Website photos come from Unsplash's CDN (see src/content/images.ts).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
};

export default withNextIntl(nextConfig);
