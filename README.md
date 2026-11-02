# Shard - Fragments of Memory

Phone-first, fully client-side character companion for the homebrew tabletop game *Shard - Fragments of Memory*.

Current state: Phase 4. The app loads validated YAML config, creates and tracks characters, edits the full sheet, exports/imports JSON, and ships as an installable offline-capable PWA. Native/mobile storage is prepared through the `mobile` feature and a file-backed store.

## Requirements

- Nix with flakes enabled
- Android Studio/SDK/NDK or Xcode only for native mobile builds; web/PWA needs only the devshell

## Commands

```bash
nix develop

# Domain config/tests (no Dioxus, fast, native)
cargo test --no-default-features --lib --tests
cargo clippy --no-default-features --lib -- -D warnings

# Full app check and web build
cargo check
cargo clippy --all-targets --features web -- -D warnings
dx serve --platform web
dx build --platform web

# PWA / offline test build
dx build --release --platform web
```

`cargo fmt --check` is part of CI.

## PWA and offline

The web build is a PWA with `manifest.json`, icons, and a service worker. It is published as a GitHub Pages project site at `https://itsmetrevor.github.io/sfom-character-sheet/`, so `Dioxus.toml` sets `base_path = "sfom-character-sheet"` and all manifest/service-worker/public paths are relative.

The service worker is not active under `dx serve`; test it against a release build served under the project subpath:

```bash
dx build --release --platform web
mkdir -p /tmp/pages/sfom-character-sheet
cp -a target/dx/som-v3/release/web/public/. /tmp/pages/sfom-character-sheet/
nix shell nixpkgs#python3 --command python3 -m http.server 8080 --directory /tmp/pages
```

Open `http://localhost:8080/sfom-character-sheet/`, let the service worker install, then disable networking or stop the server and reload. Bump `CACHE_VERSION` in `public/sw.js` whenever the app shell changes.

## GitHub Pages deployment

`.github/workflows/pages.yml` builds the release bundle with Nix, cleans stale hashed assets, uploads `target/dx/som-v3/release/web/public`, and deploys it with GitHub Pages.

In the repository settings, set Pages to deploy from **GitHub Actions**. If the repository is renamed, update `base_path` in `Dioxus.toml` and the base-path check in the workflow. The Cargo package and build output remain `som-v3` / `target/dx/som-v3`; only the Pages base path follows the repo name. If Pages serves `.wasm` without the preferred `application/wasm` type, the generated wasm-bindgen loader falls back automatically.

`dx serve --platform web` serves the app under `/sfom-character-sheet/` as well.

## Mobile

Dioxus mobile builds use the `mobile` Cargo feature (selected by `dx` for `--android`/`--ios`) and a native file-backed store instead of browser localStorage.

```bash
dx serve --android
dx serve --ios
```

These require the Android SDK/NDK or Xcode and the matching Rust targets. Those toolchains are not included in the current flake, and mobile builds are not part of CI yet.

## Layout

- `config/` — embedded game data: entity YAML plus `config/rules/`
- `src/domain/` — pure Rust config loader, enums, rules, calculations, and browser/file/memory storage
- `src/app.rs` — Dioxus shell, creation, list, and read-only sheet
- `src/editor.rs` — full sheet editor
- `src/settings.rs` — JSON export/import and PWA/storage notes
- `src/main.rs` — app launcher
- `public/` — manifest, service worker, icons, and styles copied to the web root
- `index.html` — PWA shell (Dioxus injects the wasm loader)
- `docs/` — contractee-supplied documents and transcriptions only
- `ARCHITECTURE.md` — scope, data contract, save schema, delivery plan
- `AGENTS.md` — agent workflow notes

The YAML is embedded at compile time. Editing `config/` requires a rebuild; `dx serve` watches it during development.

Save-format identifiers still use the historical `som-v3` name (`som-v3.characters.v1` for localStorage and the native data directory). They are intentionally not tied to the repository name.

## Data status

The starting-gear bundle source and status-effect rules are not present in the supplied handbook transcription. `config/rules/starting-gear.yaml` and `config/rules/status-effects.yaml` are explicit placeholders; do not invent values without checking the source.
