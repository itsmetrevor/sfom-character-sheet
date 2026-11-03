# Shard - Fragments of Memory

Phone-first, fully client-side character companion for the homebrew tabletop game *Shard - Fragments of Memory*.

Current state: Phase 5. The app is TypeScript + React + Vite with live HMR preview. It loads validated YAML config, creates and tracks characters, edits the full sheet, exports/imports JSON, and ships as an installable offline-capable PWA. Native storage is prepared through Capacitor wrapping the same web build.

## Requirements

- Nix with flakes enabled (provides Node.js 24 + npm), or any local Node 22+
- Android Studio/SDK or Xcode only for native mobile shells; web/PWA needs only the devshell

## Commands

```bash
nix develop

npm install   # first run (approves the esbuild install script)
npm test      # domain/config/storage tests (vitest)
npm run typecheck
npm run dev       # live preview with HMR under /sfom-character-sheet/
npm run build     # production PWA bundle in dist/
npm run preview   # serve the production bundle locally
```

## PWA and offline

The web build is a PWA with `manifest.json`, icons, and a service worker. It is published as a GitHub Pages project site at `https://itsmetrevor.github.io/sfom-character-sheet/`, so `vite.config.ts` sets `base: "/sfom-character-sheet/"` and all manifest/service-worker/public paths are relative.

The service worker is not active under `npm run dev`; test it against a production build served under the project subpath:

```bash
npm run build
mkdir -p /tmp/pages/sfom-character-sheet
cp -a dist/. /tmp/pages/sfom-character-sheet/
nix shell nixpkgs#python3 --command python3 -m http.server 8080 --directory /tmp/pages
```

Open `http://localhost:8080/sfom-character-sheet/`, let the service worker install, then disable networking or stop the server and reload. Bump `CACHE_VERSION` in `public/sw.js` whenever the app shell changes.

## GitHub Pages deployment

`.github/workflows/pages.yml` typechecks, tests, and builds with npm, uploads `dist`, and deploys it with GitHub Pages.

In the repository settings, set Pages to deploy from **GitHub Actions**. If the repository is renamed, update `base` in `vite.config.ts` and the base-path check in the workflow.

`npm run dev` serves the app under `/sfom-character-sheet/` with HMR as well: code edits refresh instantly, and YAML edits under `public/config/` reload from disk with no rebuild.

## Mobile

Capacitor wraps the same `dist/` web build for Android/iOS (`capacitor.config.ts`) and exposes a native file-backed store (Filesystem API) instead of browser localStorage.

```bash
npx cap sync
npx cap open android
npx cap open ios
```

These require the Android SDK or Xcode. Those toolchains are not included in the current flake, and mobile builds are not part of CI yet.

## Layout

- `public/config/` — runtime game data: entity YAML plus `public/config/rules/`
- `src/lib/domain/` — pure config loader, enums, rules, calculations, and browser/file/memory storage (no React)
- `src/lib/domain/configNode.ts` — Node-only directory loader for tests/tooling (never bundled)
- `src/app/` — React shell, creation, list, sheet/editor/settings screens
- `src/main.tsx` — app entry; `src/styles.css` — bundled phone-first stylesheet (HMR)
- `public/` — PWA files (manifest, icons, service worker) and runtime game config copied to the web root
- `public/config/` — live YAML game data; fetched at runtime, not bundled
- `index.html` — Vite entry + PWA shell
- `capacitor.config.ts` — native wrapper config (Android/iOS shells)
- `docs/` — contractee-supplied documents and transcriptions only
- `ARCHITECTURE.md` — scope, data contract, save schema, delivery plan
- `AGENTS.md` — agent workflow notes

Game data is loaded at runtime from `public/config/`, not bundled. Editing an existing YAML file and reloading is enough; no rebuild is required.

The web loader discovers files through `public/config/index.json` because static hosting cannot list directories. Add a new YAML file to the relevant entity list in `index.json` to make it visible to the web app.

Save-format identifiers still use the historical `som-v3` name (`som-v3.characters.v1` for localStorage and the native data directory). They are intentionally not tied to the repository name.

## Data status

The starting-gear bundle source and status-effect rules are not present in the supplied handbook transcription. `public/config/rules/starting-gear.yaml` and `public/config/rules/status-effects.yaml` are explicit placeholders; do not invent values without checking the source.
