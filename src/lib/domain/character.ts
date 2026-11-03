import type { ClassRole, Stat, StatusKind, VisionType } from "./enums.js";

export const SCHEMA_VERSION = 1;

export interface HybridChoices {
  language: string | null;
  vision: VisionType | null;
  expertiseSource: string | null;
  positiveStat: Stat | null;
  negativeStat: Stat | null;
  bonusStat: Stat | null;
  nonCombatPassive: string | null;
  combatPassive: string | null;
}

export interface HybridSelection {
  secondary: string;
  choices: HybridChoices;
}

export interface AncestrySelection {
  primary: string;
  hybrid: HybridSelection | null;
}

export interface ChosenAbility {
  partyLevel: number;
  ability: string;
}

export interface BackgroundSelection {
  background: string;
  chosenAbilities: ChosenAbility[];
}

export interface ClassTrack {
  class: string;
  role: ClassRole;
  level: number;
  x: number;
  unlockedActions: string[];
  unlockedPassives: string[];
}

export interface Resources {
  currentHp: number;
  energy: number;
  exhaustion: number;
}

export interface StatusEntry {
  id: string;
  name: string;
  kind: StatusKind;
  note: string;
}

export interface Equipment {
  mainHand: string | null;
  armor: string | null;
  offHand: string | null;
  accessories: string[];
}

export interface InventoryEntry {
  item: string | null;
  quantity: number;
  customName: string | null;
}

export interface Currency {
  gold: number;
  shards: number;
}

export interface PassiveSlots {
  nonCombat: string[];
  combat: string[];
}

export interface Overrides {
  maxHp: number | null;
}

export interface CharacterV1 {
  schemaVersion: number;
  id: string;
  name: string;
  notes: string;
  mainClass: string;
  ancestry: AncestrySelection;
  backgrounds: BackgroundSelection[];
  classes: ClassTrack[];
  partyLevel: number;
  statPips: Partial<Record<Stat, number>>;
  resources: Resources;
  statuses: StatusEntry[];
  equipment: Equipment;
  inventory: InventoryEntry[];
  currency: Currency;
  passiveSlots: PassiveSlots;
  overrides: Overrides;
}

// ---------------------------------------------------------------------------
// Wire (kebab-case) conversion. Saves on disk / in localStorage use the v1
// kebab-case schema; the app works with camelCase objects.
// ---------------------------------------------------------------------------

type WireValue =
  | string
  | number
  | boolean
  | null
  | WireValue[]
  | { [key: string]: WireValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function req<T>(value: unknown, what: string): T {
  if (value === undefined) throw new Error(`character is missing ${what}`);
  return value as T;
}

function opt<T>(value: unknown, fallback: T): T {
  return value === undefined ? fallback : (value as T);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("expected an array");
  return value;
}

function parseHybridChoices(wire: unknown): HybridChoices {
  const w = isRecord(wire) ? wire : {};
  return {
    language: (w["language"] as string | null | undefined) ?? null,
    vision: (w["vision"] as VisionType | null | undefined) ?? null,
    expertiseSource: (w["expertise-source"] as string | null | undefined) ?? null,
    positiveStat: (w["positive-stat"] as Stat | null | undefined) ?? null,
    negativeStat: (w["negative-stat"] as Stat | null | undefined) ?? null,
    bonusStat: (w["bonus-stat"] as Stat | null | undefined) ?? null,
    nonCombatPassive:
      (w["non-combat-passive"] as string | null | undefined) ?? null,
    combatPassive: (w["combat-passive"] as string | null | undefined) ?? null,
  };
}

function toWireHybridChoices(c: HybridChoices): Record<string, WireValue> {
  return {
    language: c.language,
    vision: c.vision,
    "expertise-source": c.expertiseSource,
    "positive-stat": c.positiveStat,
    "negative-stat": c.negativeStat,
    "bonus-stat": c.bonusStat,
    "non-combat-passive": c.nonCombatPassive,
    "combat-passive": c.combatPassive,
  };
}

/** Parse a character from its kebab-case wire shape (YAML template or JSON save). */
export function characterFromWire(wire: unknown): CharacterV1 {
  if (!isRecord(wire)) throw new Error("character must be an object");
  const ancestry = req<Record<string, unknown>>(wire["ancestry"], "ancestry");
  const hybridWire = ancestry["hybrid"];
  const equipment = req<Record<string, unknown>>(wire["equipment"], "equipment");
  const resources = req<Record<string, unknown>>(wire["resources"], "resources");
  const currency = req<Record<string, unknown>>(wire["currency"], "currency");
  const passiveSlots = req<Record<string, unknown>>(
    wire["passive-slots"],
    "passive-slots",
  );
  const overridesWire = isRecord(wire["overrides"])
    ? (wire["overrides"] as Record<string, unknown>)
    : {};

  return {
    schemaVersion: req<number>(wire["schema-version"], "schema-version"),
    id: req<string>(wire["id"], "id"),
    name: req<string>(wire["name"], "name"),
    notes: opt<string>(wire["notes"], ""),
    mainClass: req<string>(wire["main-class"], "main-class"),
    ancestry: {
      primary: req<string>(ancestry["primary"], "ancestry.primary"),
      hybrid:
        hybridWire == null
          ? null
          : {
              secondary: req<string>(
                (hybridWire as Record<string, unknown>)["secondary"],
                "ancestry.hybrid.secondary",
              ),
              choices: parseHybridChoices(
                (hybridWire as Record<string, unknown>)["choices"],
              ),
            },
    },
    backgrounds: asArray(wire["backgrounds"]).map((item) => {
      const b = item as Record<string, unknown>;
      return {
        background: req<string>(b["background"], "background.background"),
        chosenAbilities: asArray(b["chosen-abilities"]).map((c) => {
          const cb = c as Record<string, unknown>;
          return {
            partyLevel: req<number>(cb["party-level"], "chosen-ability.party-level"),
            ability: req<string>(cb["ability"], "chosen-ability.ability"),
          };
        }),
      };
    }),
    classes: asArray(wire["classes"]).map((item) => {
      const t = item as Record<string, unknown>;
      return {
        class: req<string>(t["class"], "class-track.class"),
        role: req<ClassRole>(t["role"], "class-track.role"),
        level: req<number>(t["level"], "class-track.level"),
        x: req<number>(t["x"], "class-track.x"),
        unlockedActions: opt<string[]>(t["unlocked-actions"], []),
        unlockedPassives: opt<string[]>(t["unlocked-passives"], []),
      };
    }),
    partyLevel: req<number>(wire["party-level"], "party-level"),
    statPips: { ...((wire["stat-pips"] as Record<Stat, number> | undefined) ?? {}) },
    resources: {
      currentHp: req<number>(resources["current-hp"], "resources.current-hp"),
      energy: req<number>(resources["energy"], "resources.energy"),
      exhaustion: req<number>(resources["exhaustion"], "resources.exhaustion"),
    },
    statuses: asArray(wire["statuses"]).map((item) => {
      const s = item as Record<string, unknown>;
      return {
        id: req<string>(s["id"], "status.id"),
        name: req<string>(s["name"], "status.name"),
        kind: req<StatusKind>(s["kind"], "status.kind"),
        note: opt<string>(s["note"], ""),
      };
    }),
    equipment: {
      mainHand: (equipment["main-hand"] as string | null | undefined) ?? null,
      armor: (equipment["armor"] as string | null | undefined) ?? null,
      offHand: (equipment["off-hand"] as string | null | undefined) ?? null,
      accessories: opt<string[]>(equipment["accessories"], []),
    },
    inventory: asArray(wire["inventory"]).map((item) => {
      const e = item as Record<string, unknown>;
      return {
        item: (e["item"] as string | null | undefined) ?? null,
        quantity: req<number>(e["quantity"], "inventory.quantity"),
        customName: (e["custom-name"] as string | null | undefined) ?? null,
      };
    }),
    currency: {
      gold: req<number>(currency["gold"], "currency.gold"),
      shards: req<number>(currency["shards"], "currency.shards"),
    },
    passiveSlots: {
      nonCombat: opt<string[]>(passiveSlots["non-combat"], []),
      combat: opt<string[]>(passiveSlots["combat"], []),
    },
    overrides: {
      maxHp: (overridesWire["max-hp"] as number | null | undefined) ?? null,
    },
  };
}

/** Serialize a character to its kebab-case wire shape (matches Rust serde output). */
export function characterToWire(character: CharacterV1): Record<string, WireValue> {
  return {
    "schema-version": character.schemaVersion,
    id: character.id,
    name: character.name,
    notes: character.notes,
    "main-class": character.mainClass,
    ancestry: {
      primary: character.ancestry.primary,
      hybrid: character.ancestry.hybrid
        ? {
            secondary: character.ancestry.hybrid.secondary,
            choices: toWireHybridChoices(character.ancestry.hybrid.choices),
          }
        : null,
    },
    backgrounds: character.backgrounds.map((b) => ({
      background: b.background,
      "chosen-abilities": b.chosenAbilities.map((c) => ({
        "party-level": c.partyLevel,
        ability: c.ability,
      })),
    })),
    classes: character.classes.map((t) => ({
      class: t.class,
      role: t.role,
      level: t.level,
      x: t.x,
      "unlocked-actions": t.unlockedActions,
      "unlocked-passives": t.unlockedPassives,
    })),
    "party-level": character.partyLevel,
    "stat-pips": { ...character.statPips } as Record<string, WireValue>,
    resources: {
      "current-hp": character.resources.currentHp,
      energy: character.resources.energy,
      exhaustion: character.resources.exhaustion,
    },
    statuses: character.statuses.map((s) => ({
      id: s.id,
      name: s.name,
      kind: s.kind,
      note: s.note,
    })),
    equipment: {
      "main-hand": character.equipment.mainHand,
      armor: character.equipment.armor,
      "off-hand": character.equipment.offHand,
      accessories: [...character.equipment.accessories],
    },
    inventory: character.inventory.map((e) => ({
      item: e.item,
      quantity: e.quantity,
      "custom-name": e.customName,
    })),
    currency: {
      gold: character.currency.gold,
      shards: character.currency.shards,
    },
    "passive-slots": {
      "non-combat": [...character.passiveSlots.nonCombat],
      combat: [...character.passiveSlots.combat],
    },
    overrides: {
      "max-hp": character.overrides.maxHp,
    },
  };
}

export function slugify(value: string, fallback = "character"): string {
  let slug = "";
  for (const ch of value) {
    if (/[a-zA-Z0-9]/.test(ch)) {
      slug += ch.toLowerCase();
    } else if (!slug.endsWith("-")) {
      slug += "-";
    }
  }
  slug = slug.replace(/^-+|-+$/g, "");
  return slug === "" ? fallback : slug;
}
