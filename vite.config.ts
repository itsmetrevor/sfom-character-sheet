import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Push a client event when bundled YAML changes so the app refetches
 *  GameData without a full page reload (state is preserved). */
function configHmr(): Plugin {
  return {
    name: "som-config-hmr",
    handleHotUpdate({ file, server }) {
      if (file.includes("public/config/")) {
        server.ws.send({ type: "custom", event: "som-config-changed" });
        return [];
      }
      return undefined;
    },
  };
}

// GitHub Pages project site. Keep in sync with the workflow base-path check.
// If the repo is renamed, update this and the Pages workflow.
export default defineConfig({
  base: "/sfom-character-sheet/",
  publicDir: "public",
  plugins: [react(), configHmr()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
  },
});
