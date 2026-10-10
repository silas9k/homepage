const { i18n } = require("./next-i18next.config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: ["@node-rs/argon2"],
  // for serverSideTranslations
  outputFileTracingIncludes: {
    "/**": ["./next-i18next.config.js"],
  },
  // These dependencies ship public test private keys; no runtime code uses them.
  outputFileTracingExcludes: {
    "/**": ["./node_modules/**/ssh2/test/**", "./node_modules/**/xmlrpc/tmp/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
      },
    ],
    unoptimized: true,
  },
  i18n,
};

module.exports = nextConfig;
