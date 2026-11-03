import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages project site. Keep in sync with the workflow base-path check.
// If the repo is renamed, update this and the Pages workflow.
export default defineConfig({
  base: "/sfom-character-sheet/",
  publicDir: "public",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
