// Closed vocabularies. Mirrors public/config/_enums.yaml + src/domain/enums.rs.
// Adding a value here is a deliberate data-model change: update _enums.yaml too.

export const CLASS_TIERS = [
  "starter",
  "tier-1",
  "tier-2",
  "tier-3",
  "tier-4",
  "ultimate",
] as const;
export type ClassTier = (typeof CLASS_TIERS)[number];

export const CLASS_ROLES = ["main", "sub"] as const;
export type ClassRole = (typeof CLASS_ROLES)[number];

export const ROLES = ["dps", "tank", "healer", "specialist"] as const;
export type Role = (typeof ROLES)[number];

export const MAIN_STATS = ["str", "dex", "con", "mnd", "int", "luk"] as const;
export type MainStat = (typeof MAIN_STATS)[number];

export const BONUS_STATS = ["jmp", "agl", "def", "res", "nrg", "for"] as const;
export type BonusStat = (typeof BONUS_STATS)[number];

export type Stat = MainStat | BonusStat;
export const ALL_STATS: readonly Stat[] = [...MAIN_STATS, ...BONUS_STATS];

export const MODIFIER_TARGETS = [
  "max-hp",
  "str",
  "dex",
  "con",
  "mnd",
  "int",
  "luk",
  "jmp",
  "agl",
  "def",
  "res",
  "nrg",
  "for",
  "range",
  "damage",
  "magic-damage",
  "melee-damage",
  "restore-hp",
  "damage-taken",
] as const;
export type ModifierTarget = (typeof MODIFIER_TARGETS)[number];

export const GEAR_SLOTS = [
  "main-hand",
  "armor",
  "off-hand",
  "accessory",
  "item",
  "consumable",
  "tool",
  "currency",
] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

export const EQUIPMENT_SLOTS = ["main-hand", "armor", "off-hand"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const DAMAGE_TYPES = [
  "none",
  "slashing",
  "piercing",
  "bludgeoning",
] as const;
export type DamageType = (typeof DAMAGE_TYPES)[number];

export const PASSIVE_SOURCES = ["ancestry", "background", "class"] as const;
export type PassiveSource = (typeof PASSIVE_SOURCES)[number];

export const PASSIVE_SLOTS = ["non-combat", "combat"] as const;
export type PassiveSlot = (typeof PASSIVE_SLOTS)[number];

export const ACTION_TYPES = ["main", "support", "reaction"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const REQUIREMENT_KINDS = [
  "constant",
  "well-rested",
  "class-adept",
  "non-combat",
  "in-combat",
  "class-level",
  "party-level",
  "once-per-round",
  "once-per-combat",
  "reaction",
  "attacked-while-armed",
  "target-approaches",
  "attacked-in-range",
  "attacked",
  "exposed",
  "damaged",
  "failed-check-nearby",
  "target-leaves",
] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

export function isLeveledRequirement(kind: RequirementKind): boolean {
  return kind === "class-level" || kind === "party-level";
}

export const PREREQUISITE_KINDS = ["class", "any-starter"] as const;
export type PrerequisiteKind = (typeof PREREQUISITE_KINDS)[number];

export const MAX_HP_MODES = ["normal", "double-con"] as const;
export type MaxHpMode = (typeof MAX_HP_MODES)[number];

export const STAT_SHAPES = ["square", "circle", "star", "diamond-pip"] as const;
export type StatShape = (typeof STAT_SHAPES)[number];

export const STAT_SHAPE_MEANINGS = [
  "permanent",
  "temporary",
  "class",
  "party-level",
] as const;
export type StatShapeMeaning = (typeof STAT_SHAPE_MEANINGS)[number];

export const STATUS_KINDS = [
  "boon",
  "condition",
  "dot",
  "state",
  "other",
] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

export const DATA_STATUSES = ["placeholder", "partial", "complete"] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const EXPERTISES = [
  "strength",
  "bravado",
  "throw-catch",
  "constitution",
  "concentration",
  "resistance",
  "intelligence",
  "crafting",
  "knowledge",
  "dexterity",
  "stealth",
  "thievery",
  "mind",
  "nature",
  "perception",
  "luck",
  "charisma",
  "deception",
  "any",
] as const;
export type Expertise = (typeof EXPERTISES)[number];

export const LANGUAGES = [
  "common",
  "egrhandi",
  "enattish",
  "halthketan",
  "khanadurian",
  "lagosian",
  "litooran",
  "maulawian",
  "nethander",
  "orinotisian",
  "skrii",
  "uhhrantian",
] as const;
export type Language = (typeof LANGUAGES)[number];

export const VISION_TYPES = [
  "normal",
  "low-light",
  "dark",
  "binocular",
] as const;
export type VisionType = (typeof VISION_TYPES)[number];

export const TIER_UNLOCK_SOURCES = ["any-starter", "tier-4"] as const;
export type TierUnlockSource = (typeof TIER_UNLOCK_SOURCES)[number];

export type StarStatsRule = "follow-main-class";
export type EquipmentRule = "main-class-only";
export type SubclassAbilityRule = "right-side-only";
export type SubclassPassiveRule = "unlocked-only";
export type UnlockMode = "manual";
export type ClassLevelSource = "gm-awards";
export type StarFill = "expertise" | "locked-passives";
export type ReactionMode = "condition-triggered";
export type XGrowth = "party-level";
export type Allowance = "allowed" | "disallowed";
export type StartingItemsSource = "background";
export type StartingGearFallback =
  | "background-starting-items"
  | "manual-inventory-entry";
export type StatusFallback = "free-text-statuses";
export type ShardSource = "specific-party-levels" | "gm-discretion";
export type ShardUse = "inside-and-outside-combat";
export type InheritancePeriod = "week-start";
export type GoldEffectFrequency = "once-per-enemy" | "per-enemy";
export type HybridMaxHp = "lower-of-parents";

/** Maps a ModifierTarget that is a stat to its Stat, else null. */
export function modifierTargetAsStat(target: ModifierTarget): Stat | null {
  switch (target) {
    case "max-hp":
    case "range":
    case "damage":
    case "magic-damage":
    case "melee-damage":
    case "restore-hp":
    case "damage-taken":
      return null;
    default:
      return target as Stat;
  }
}
