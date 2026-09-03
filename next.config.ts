import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` only. The worship team tests the tablet viewer against this
  // machine's dev server over the church LAN, so allow that origin to load
  // /_next/* client bundles and HMR. No effect on `next build` / `next start`.
  allowedDevOrigins: ["10.160.0.60"],
};

export default nextConfig;
