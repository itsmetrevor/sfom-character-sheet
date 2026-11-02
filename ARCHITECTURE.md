# ARCHITECTURE.md

Team-owned architecture and data-contract notes. `docs/` remains reserved for contractee-supplied documents and transcriptions; do not add planning or architecture notes there.

## Product scope (v1)

A fully client-side, phone-first character companion for *Shard - Fragments of Memory*:

- Create characters from ancestry, background(s), and a starting class.
- Browse ancestries, backgrounds, classes, expertise, and rules.
- Track a character sheet manually during play: HP, energy, exhaustion, statuses, equipment, inventory, gold, shards, party level, class levels, and unlocked abilities/passives.
- Compute derived stats where the source data is unambiguous.

Not in v1: combat/action resolution, dice automation, full rules adjudication, Rune-defined formulas, custom class/passive authoring, or multi-device sync. Hybrid ancestries are represented in the data contract but can be deferred in the UI.

## Decisions

- **Stack:** Rust + Dioxus, fully client-side, web/Android/iOS eventually.
- **First target:** web/PWA. The UI stays phone-first and domain logic stays platform-agnostic so Android/iOS adapters can follow.
- **Config:** declarative YAML for content and rules; calculations and validation live in tested Rust. Do not embed a scripting interpreter in v1.
- **State:** plain Rust domain types; Dioxus signals only at the UI boundary.
- **Persistence:** versioned JSON saves behind a storage trait. Web saves use localStorage key `som-v3.characters.v1`; native/mobile saves use a JSON file via `FileStore`. JSON export/import is required.
- **Crate shape:** one Dioxus crate initially, with a pure `domain` module that has no Dioxus or web dependencies. Split into crates only if build or test friction demands it.

## Repository layout

```text
config/
  ancestries/        one entity per YAML file
  backgrounds/       one entity per YAML file
  classes/           one entity per YAML file
  items/             one entity per YAML file
  rules/             game procedures, progression, and rules tables
  _enums.yaml        closed vocabularies (single source of truth)
  requirements.yaml  requirement-kind descriptions
  expertise.yaml     expertise reference data
  languages.yaml     language reference data
  vision-types.yaml  vision reference data
  _character_template.yaml  readable save-schema v1 fixture
docs/               contractee-supplied scans, text, and transcriptions only
src/                future Dioxus app; domain code must stay UI-free
ARCHITECTURE.md     this file
AGENTS.md           agent/workflow guidance
```

## Data model conventions

### Closed vocabularies are enums

`config/_enums.yaml` lists every closed vocabulary. These map to Rust enums, not free-form strings:

- class tiers, class roles, party roles
- main/bonus stats and modifier targets
- gear/equipment slots and damage types
- passive sources/slots and action types
- requirement kinds and prerequisite kinds
- max-HP modes, stat shapes, and status kinds

Adding a new value is a deliberate data-model change: update `_enums.yaml` and the Rust enum together.

### References, not enum names

Cross-file references are ids validated by the loader:

- class references in prerequisites and creation steps
- item references in starting items and inventory
- language, vision, and expertise references

The only class sentinel is `any-starter`; it is modeled as a prerequisite kind, not a class id.

### Prose stays prose

Names, descriptions, checks, target ranges, costs, effects, and lore remain display text. Do not parse rules from prose in v1. When a prose rule affects calculations, add a structured field instead.

Ability/passive names and action tags are open, extensible labels rather than closed enums. They are owner-scoped in saves; add stable per-ability ids only when cross-content references require them.

### Source fidelity and placeholders

Entity files carry `# source: pNNN` where known. Preserve printed values and documented quirks. When adding inferred or missing data, mark it as provisional in the file or in `config/rules/`. Missing source sections are represented as explicit placeholders, not invented content:

- starting gear bundles: `config/rules/starting-gear.yaml`
- status-effect catalog: `config/rules/status-effects.yaml`
- X growth and energy maximum formulas: `config/rules/combat.yaml`

## Rules data

`config/rules/` is the machine-readable home for game procedures:

- `base-stats.yaml` — base spread and bonus-stat grafts.
- `creation-steps.yaml` — ordered creation flow and starting-class list.
- `hybrid-ancestries.yaml` — hybrid inheritance rules.
- `party-levels.yaml` — background tiers, passive slots, stat pips, shard slots.
- `class-progression.yaml` — class level cap, main/subclass rules, unlock and star model.
- `combat.yaml` — action economy, ultimate charge slots, X growth, energy.
- `inventory.yaml` — inventory size, stack size, custom-item policy.
- `starting-gear.yaml` — placeholder for the missing Gear section.
- `status-effects.yaml` — placeholder catalog; v1 uses free-text status labels.
- `economy.yaml` — shards, gold, merchant/performer tables, class gold effects.

The class unlock graph is derived at load time by inverting `prerequisites` and applying `tier-unlock-rules`. Individual action-to-level mappings are not in the source, so v1 stores manual unlock toggles per class.

## Derived stats

The calculation layer consumes explicit inputs, not UI state:

- base stats from `config/rules/base-stats.yaml`
- permanent ancestry bonuses
- the current main class's star stats and `max-hp-mode`
- equipped item `stat-modifiers`
- permanent expertise and stat modifiers
- party-level stat pips
- temporary/status effects only where structured later

Permanent and temporary modifiers are kept separate. If the source is ambiguous, expose an override rather than guessing. `double-con` currently adds `2 × CON` to Max HP as a provisional rule; `overrides.max-hp` always wins. `config/_character_template.yaml` shows the v1 save shape.

## Character save schema v1

```yaml
schema-version: 1
id: string
name: string
notes: string
main-class: class-id
ancestry:
  primary: ancestry-id
  hybrid: null | { secondary: ancestry-id, choices: {...} }
backgrounds:
  - background: background-id
    chosen-abilities:
      - { party-level: 0|3|6|9, ability: string }
classes:
  - class: class-id
    role: main|sub
    level: integer
    x: integer
    unlocked-actions: [string]
    unlocked-passives: [string]
party-level: integer
stat-pips: { str: 0..2, dex: 0..2, con: 0..2, mnd: 0..2, int: 0..2, luk: 0..2 }
resources: { current-hp: integer, energy: integer, exhaustion: integer }
statuses:
  - { id: string, name: string, kind: boon|condition|dot|state|other, note: string }
equipment: { main-hand: string|null, armor: string|null, off-hand: string|null, accessories: [string] }
inventory:
  - { item: item-id|null, quantity: integer, custom-name: string|null }
currency: { gold: integer, shards: integer }
passive-slots: { non-combat: [string], combat: [string] }
overrides: { max-hp: integer|null }
```

Rules:

- `schema-version` must be present; loaders reject unknown future versions and migrate older ones.
- Ability/passive references are owner-scoped names for v1. Add stable per-ability ids before relying on them across content edits.
- Saves are JSON on disk/export even though the example fixture is YAML.
- Unknown item ids are preserved as custom-name entries rather than dropped.
- All saves round-trip through import/export without data loss.

## Runtime architecture

```text
embedded YAML (config/)
        |
        v
GameData loader + validation (domain)
        |
        +--> stat/level calculations (domain)
        |
        +--> CharacterV1 save model (domain)
                    |
                    v
                Storage trait
                 /        \
     WebStore/localStorage  FileStore/app data
                 \        /
              JSON import/export
                    |
                    v
              Dioxus UI signals
```

- Config is embedded at compile time; web/mobile do not read the repository filesystem.
- The loader validates enum values, references, duplicate ids, and required fields once at startup and in tests.
- The UI never parses YAML or computes rules ad hoc; it calls domain functions.
- Autosave is debounced; explicit export/import is always available.

## Platform strategy

1. Web/PWA first: installable shell, offline cache, phone-sized layout. Deployment is a GitHub Pages project site at `/sfom-character-sheet/`; `Dioxus.toml` sets `base_path = "sfom-character-sheet"`, while `index.html`, the manifest, and the service worker use relative public paths so the PWA stays inside that scope.
2. The service worker precaches the stable shell, discovers the hashed wasm/js from `index.html`, and serves a cached app shell for offline navigation. Bump `CACHE_VERSION` in `public/sw.js` when the shell changes.
3. Native/mobile builds enable the `mobile` Cargo feature and use `FileStore` instead of browser localStorage. The current file path is provisional on Android/iOS; mobile toolchains are external to the flake and not CI-tested.
4. Keep routing, storage, and file APIs behind small interfaces.
5. GitHub Actions (`.github/workflows/pages.yml`) builds a clean release artifact and deploys it with GitHub Pages.

## Validation and testing

Required checks once the Rust workspace exists:

- every YAML file parses
- closed vocabularies match `_enums.yaml`
- refs resolve (classes, items, languages, visions, expertise)
- entity counts and unique ids hold
- inverse unlock graph is consistent with class prerequisites
- golden derived-stat cases for base + ancestry + class + equipment + pips
- save round-trip and schema-version migration
- web/PWA release build and an offline reload smoke test served under `/sfom-character-sheet/`
- `cargo fmt --check`, `cargo clippy --features web -D warnings`, `cargo test`, WASM build

## Delivery plan

- **Phase 0 (done):** rules directory, enum-first normalization, save-schema v1, architecture contract.
- **Phase 1 (done):** Cargo/Dioxus/Nix scaffold, embedded config loader, validation tests, app shell.
- **Phase 2 (done):** vertical slice — create an ancestry/background/starter-class character, compute stats, save, reload.
- **Phase 3 (done):** full sheet editing, leveling, statuses, export/import.
- **Phase 4 (done):** installable offline PWA plus the `mobile` feature and native file store.
- **Deployment (done):** GitHub Pages project-site base path, relative PWA paths, and automated Pages deployment.
- **Next:** native Android/iOS validation, then optional post-v1 work such as custom content authoring or multi-device sync.

## Known placeholders and open questions

- Starting gear bundle data is unavailable (Gear section page XX missing).
- Status-effect rules are unavailable; v1 uses free-text labels.
- Class action unlock levels and star completion rewards are not mapped in the source; v1 uses manual toggles.
- Exact X growth and Energy maximum formulas are unresolved.
- Item files lack page citations and need source verification.
- Mobile file storage paths are provisional until tested on Android/iOS.
- The service worker cache version is manual; bump it whenever the shell changes.
- The localStorage key and native app-data directory retain the historical `som-v3` name for save compatibility; rename only with a migration.
- The Pages base path is tied to the repository name (`sfom-character-sheet`); renaming the repo requires updating `base_path` and the workflow base-path check. The Cargo package/output remains `som-v3` / `target/dx/som-v3`.
- Hybrid ancestry UI is deferred, but the schema reserves a place for it.
- The creation UI selects one background; the rules and save schema allow up to two.
- Class level starts at 1 in the creation slice because the source does not define a numeric starting level.
