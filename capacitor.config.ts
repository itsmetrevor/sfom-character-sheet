import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.shard.som",
  appName: "Shard - Fragments of Memory",
  webDir: "dist",
  server: {
    // Served from the GitHub Pages project subpath in web builds.
    // Capacitor serves the bundled dist/ locally on device.
    androidScheme: "https",
  },
};

export default config;
