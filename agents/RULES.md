# Rules Notes

Converted from `config/rules/` — human-readable summary of the rules config items.
Source files: `hybrid-ancestries.yaml`, `party-levels.yaml`, `stat-shapes.yaml`.

## 1. Hybrid Ancestries (`hybrid-ancestries.yaml`)

- **id:** `hybrid-ancestries`
- **name:** Hybrid Ancestries
- **description:** Rules for characters combining two ancestries. Pick one option from each parent ancestry per category; hybrids trade raw toughness for versatility.

**Inheritance** — pick one per category:

- **languages:** Pick 1 language besides Common (each parent contributes its language list; choose one non-Common language total).
- **vision:** Pick 1 vision type from either parent.
- **expertise:** Pick 1 parent's full expertise set.
- **main-mods:**
  - **positive:** Pick 1 positive modifier from either parent.
  - **negative:** Pick 1 negative modifier from either parent.
- **bonus-stat:** Pick 1 bonus stat from either parent.
- **passives:**
  - **non-combat:** Pick 1 non-combat passive from either parent.
  - **combat:** Pick 1 combat passive from either parent.
- **max-hp:** Use the lower of the two parents' max-hp values.

## 2. Party Level unlocks (`party-levels.yaml`)

- **id:** `party-levels`
- **name:** Party Level unlocks
- **source-pages:** p002-p004

- **background-abilities:** `[0, 3, 6, 9]` — background tiers unlock at these Party Levels.
- **non-combat-passive-slots:**
  - **base:** 2
  - **extra-at:** `[4]` — +1 slot at Party Level 4.
- **combat-passive-slots:**
  - **base:** 3
  - **extra-at:** `[8]` — +1 slot at Party Level 8.
- **stat-upgrade:** Fill diamond pips for permanent Main Stat rewards, at most twice each.
- **x-growth:** X modifies damage/effects, grows with Party Level, starts at 1.
- **class-level-max:** 20
- **ultimate-charge-slots:** 10

## 3. Stat Shapes (`stat-shapes.yaml`)

- **id:** `stat-shapes`
- **name:** Stat Shapes
- **source-pages:** p004

- **square:** permanent (never changes)
- **circle:** temporary (gear, passives, effects; changes)
- **star:** class stats (follow current Main Class)
- **diamond-pip:** permanent +1 Main stat from Party Level rewards (max twice per Main stat)
