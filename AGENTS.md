# AGENTS.md

## Project goal

- Build a phone-first app across web, Android, and iOS for creating and tracking characters in the homebrew tabletop game "Shard - Fragments of Memory". The app is fully client-side.
- Stack: TypeScript + React + Vite (npm), with the development environment managed by Nix flakes and devshells. Native shells are provided by Capacitor wrapping the same web build.
- Config stays declarative YAML; calculations and validation belong in tested TypeScript under `src/lib/domain/`. Rune is deferred unless config-defined formulas become a hard requirement.
- V1 is a manual character tracker with derived stats, not a combat/rules engine. See `ARCHITECTURE.md` for scope, save schema, and delivery plan.
- `docs/` is reserved for contractee-supplied documents and transcriptions. Put architecture/planning notes in the repo root, not `docs/`.

## Repository state

- Phase 5 is in place: the app was ported from Rust/Dioxus to TypeScript/React/Vite with live HMR preview, keeping the same YAML config, save schema, and phone UI. Earlier phases cover creation, derived stats, full sheet editing/leveling, browser saves, JSON export/import, and the installable offline PWA.
- Phase 0 data normalization is complete: `public/config/rules/` holds game rules, entity files are enum-normalized, and `public/config/_character_template.yaml` is the v1 save fixture.
- YAML is loaded at runtime from `public/config/` via fetch and is not bundled. Editing existing files updates after reload (dev server hot-reloads). Web discovery uses `public/config/index.json`; keep it in sync when adding files. Native (Capacitor) builds serve the same `dist/` bundle.
- Deployment is a GitHub Pages project site at `/sfom-character-sheet/`: `vite.config.ts` sets `base: "/sfom-character-sheet/"` and `index.html`/manifest/service worker use relative public paths. Do not reintroduce root-absolute `/...` public paths; if the repo is renamed, update the Vite base and the workflow's base-path check.
- `public/` is copied verbatim to `dist/` by Vite. `index.html` at the repo root is the Vite entry + PWA shell; do not move it under `docs/` or `public/`.
- `.github/workflows/pages.yml` builds a clean release bundle and deploys it with GitHub Pages; Pages must be set to deploy from GitHub Actions.
- Real content today is the game data in `public/config/` and the handbook material in `docs/`.

## Commands

- `nix develop` - Node.js 24 + npm from the pinned flake.
- `npm test` - domain/config/storage tests (vitest, 19 tests). `npm run typecheck` (`tsc --noEmit`) is part of CI.
- `npm run dev` serves under `/sfom-character-sheet/` with HMR; `npm run build` writes the PWA bundle to `dist/`; `npm run preview` serves the bundle locally.
- Local PWA test: `npm run build`, copy `dist/` into `/tmp/pages/sfom-character-sheet/`, serve `/tmp/pages`, and open `/sfom-character-sheet/`.
- Native shells: `npx cap sync` then `npx cap open android` / `npx cap open ios` (Capacitor; those SDKs are not in the flake and are not CI-tested). The web build is the single UI; Capacitor only wraps `dist/` and provides the Filesystem API.
- Bump `CACHE_VERSION` in `public/sw.js` whenever the app shell changes, or offline clients keep old assets.
- Native storage: web builds use localStorage; Capacitor builds use the Filesystem API with the same JSON shape. The localStorage key `som-v3.characters.v1` and native data-directory name are save-format identifiers, not repo branding. Do not rename them without a migration.

## Source of truth (game data)

- `docs/player-handbook-notes.md` — merged, vision-corrected transcription in handbook page order. Authoritative for rules and stats.
- `docs/handbook-textlayer-extract.md` — raw PDF text layer, auto-generated. Graphic/table pages are missing or garbled; use it for searching, then confirm in the merged notes or page scan.
- `docs/handbook_scan/p001.avif`–`p111.avif` — original scans. Multimodal models cannot read AVIF; convert first (output to `/tmp`, never modify scans):
  `nix-shell -p imagemagick --run "magick docs/handbook_scan/p030.avif -resize 50% /tmp/p030.png"`
  Half resolution is legible; full resolution rarely helps.
- `docs/phone-app/*.avif` — phone UI design mockups; convert with the same command. Treat these as the UI reference: light monochrome wireframe style, not a dark dashboard.
- Ancestry, background, and class files start with `# source: pNNN`; check that page before changing rules data. `items/` files currently have no page citations, so cross-check their values in the handbook.

## `public/config/` conventions

- One entity per YAML file under `ancestries/`, `backgrounds/`, `classes/`, `items/`. The filename stem is the `id` used by cross-file references.
- `public/config/rules/` holds game procedures: base stats, creation, hybrid ancestries, party levels, class progression, combat, inventory, starting gear, status effects, and economy.
- Root shared data: `_enums.yaml` (closed vocabularies), `requirements.yaml`, `expertise.yaml`, `languages.yaml`, `vision-types.yaml`.
- Native builds use Capacitor (`capacitor.config.ts`); the file store falls back to localStorage on web. No Cargo feature flags remain.
- `_enums.yaml` is the source of truth for closed enums. Do not introduce new tier/role/stat/slot/damage/requirement values without updating it (and the matching union in `src/lib/domain/enums.ts`).
- Keys are lowercase kebab-case. Stat abbreviations: `str dex con mnd int luk` (main), `jmp agl def res nrg for` (bonus).
- Normalized shapes:
  - requirements: list of `{ kind: <requirement-kind>, level?: N }`
  - prerequisites: `{ kind: class|any-starter, class?: id, level: N }`
  - `stat-modifiers`: a map of modifier target to integer
  - `expertise-modifiers`: list of `{ expertise: id|any, value: N, requirements?: [...] }`
  - `equipment`: map of slot to allowed-equipment text
  - `combat-modifier`/`ultimate`: mappings, not single-key list items
  - class tiers: `starter`, `tier-1` … `tier-4`, `ultimate`; each class also has `max-hp-mode: normal|double-con`
- `_character_template.yaml` is a readable v1 save fixture, not a schema; TypeScript domain types under `src/lib/domain/` are authoritative and validate it at load time. Domain objects use camelCase; the YAML/JSON wire format stays kebab-case (see `characterFromWire`/`characterToWire`).
- Data is a transcription, not a redesign: preserve printed values; when inferring or correcting, mark it in a comment/detail field (see `public/config/backgrounds/jeweler.yaml`). Missing source sections live as explicit placeholders under `public/config/rules/`.
- Do not split classes into per-passive/per-action files. An audit found all 281 class actions are bespoke (zero cross-class duplicates); ancestry/background/class files are the intended smallest units.

## Known handbook quirks (preserved on purpose)

- Class tier chart (p047) overrides page text for Judge, Negotiator, and Fortune Teller prerequisites.
- p030 index says "Diplomat"; the p041 entry is "Politician" (transcribed as printed).
- Farmer and Wanderer share one printed blurb; Wanderer's text was replaced from its tier abilities and noted in-file.
- Jeweler's printed tier bar belongs to Artist; Jeweler tiers are inferred by Craftsman analogy and flagged in-file.
- Scholar's Main/Support action boxes are blank in the source; no actions were invented.
- Shard Bearer is intentionally absent from `public/config/classes/` (choose-your-own template does not fit the entity shape); docs still transcribe it.
- `public/config/rules/status-effects.yaml` is a placeholder; v1 uses free-text status labels.
