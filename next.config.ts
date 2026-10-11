import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright ships native browser launchers that must not be bundled.
  serverExternalPackages: ["playwright"],
};

export default nextConfig;
