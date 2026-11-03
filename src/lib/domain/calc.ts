import type {
  ExpertiseModifier,
  GameData,
  Requirement,
} from "./config.js";
import type { CharacterV1 } from "./character.js";
import {
  BONUS_STATS,
  MAIN_STATS,
  modifierTargetAsStat,
  type Expertise,
  type ModifierTarget,
  type RequirementKind,
  type Stat,
} from "./enums.js";

export interface DerivedStats {
  maxHp: number;
  main: Record<Stat, number>;
  bonus: Record<Stat, number>;
  expertise: Record<Exclude<Expertise, "any">, number>;
  notes: string[];
}

const EXPERTISE_IDS: Exclude<Expertise, "any">[] = [
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
];

function statToModifierTarget(stat: Stat): ModifierTarget {
  return stat as ModifierTarget;
}

export function deriveCharacter(game: GameData, character: CharacterV1): DerivedStats {
  const main = {} as Record<Stat, number>;
  const bonus = {} as Record<Stat, number>;
  const notes: string[] = [];

  for (const stat of MAIN_STATS) {
    main[stat] = game.rules.baseStats.baseStats[statToModifierTarget(stat)] ?? 0;
  }
  for (const stat of BONUS_STATS) {
    bonus[stat] = game.rules.baseStats.baseStats[statToModifierTarget(stat)] ?? 0;
  }

  let maxHp = game.rules.baseStats.baseStats["max-hp"] ?? 0;

  const ancestry = game.ancestry(character.ancestry.primary);
  if (ancestry) {
    applyModifiers(ancestry.statModifiers, main, bonus, (v) => {
      maxHp += v;
    });
  }

  const mainClass = game.class(character.mainClass);
  const mainTrack =
    character.classes.find((t) => t.role === "main") ??
    character.classes.find((t) => t.class === character.mainClass);

  if (mainClass) {
    applyModifiers(mainClass.statModifiers, main, bonus, (v) => {
      maxHp += v;
    });
  } else {
    notes.push(`Main class '${character.mainClass}' was not found.`);
  }

  for (const stat of MAIN_STATS) {
    const pips = character.statPips[stat] ?? 0;
    if (pips !== 0) main[stat] = (main[stat] ?? 0) + pips;
  }

  for (const itemId of equippedItems(character)) {
    const item = game.item(itemId);
    if (item) {
      applyModifiers(item.statModifiers, main, bonus, (v) => {
        maxHp += v;
      });
    }
  }

  for (const graft of game.rules.baseStats.bonusFromMain) {
    const source = main[graft.stat] ?? 0;
    if (graft.per > 0) {
      const target = graft.grants.stat as Stat;
      const gain = Math.floor(source / graft.per) * graft.grants.value;
      if (isMainStat(target)) {
        main[target] = (main[target] ?? 0) + gain;
      } else {
        bonus[target] = (bonus[target] ?? 0) + gain;
      }
    }
  }

  if (mainClass && mainClass.maxHpMode === "double-con") {
    const con = main["con"] ?? 0;
    maxHp += con * 2;
    notes.push(
      "Max HP includes 2×CON from double-con mode; this rule is provisional.",
    );
  }

  if (character.overrides.maxHp != null) {
    maxHp = character.overrides.maxHp;
    notes.push("Max HP uses the manual override.");
  }

  const expertise = {} as DerivedStats["expertise"];
  for (const entry of game.expertise) {
    if (entry.id !== "any") expertise[entry.id] = 0;
  }
  // Ensure every known expertise id is present even if the catalog is sparse.
  for (const id of EXPERTISE_IDS) {
    if (!(id in expertise)) expertise[id] = 0;
  }

  if (ancestry) {
    applyExpertiseModifiers(ancestry.expertiseModifiers, null, expertise, notes);
  }

  for (const selection of character.backgrounds) {
    const background = game.background(selection.background);
    if (background) {
      applyExpertiseModifiers(background.expertiseModifiers, null, expertise, notes);
    }
  }

  if (mainClass) {
    applyExpertiseModifiers(
      mainClass.expertiseModifiers,
      mainTrack?.level ?? null,
      expertise,
      notes,
    );
  }

  for (const itemId of equippedItems(character)) {
    const item = game.item(itemId);
    if (item) {
      applyExpertiseModifiers(item.expertiseModifiers, null, expertise, notes);
    }
  }

  notes.push("Passive and ability effects are not applied to derived stats in v1.");

  return { maxHp, main, bonus, expertise, notes };
}

function isMainStat(stat: Stat): boolean {
  return (MAIN_STATS as readonly string[]).includes(stat);
}

function equippedItems(character: CharacterV1): string[] {
  const ids: string[] = [];
  if (character.equipment.mainHand) ids.push(character.equipment.mainHand);
  if (character.equipment.armor) ids.push(character.equipment.armor);
  if (character.equipment.offHand) ids.push(character.equipment.offHand);
  ids.push(...character.equipment.accessories);
  return ids;
}

function applyModifiers(
  modifiers: Partial<Record<ModifierTarget, number>>,
  main: Record<Stat, number>,
  bonus: Record<Stat, number>,
  addMaxHp: (value: number) => void,
): void {
  for (const [target, value] of Object.entries(modifiers) as [
    ModifierTarget,
    number,
  ][]) {
    if (target === "max-hp") {
      addMaxHp(value);
      continue;
    }
    const stat = modifierTargetAsStat(target);
    if (!stat) continue;
    if (isMainStat(stat)) {
      main[stat] = (main[stat] ?? 0) + value;
    } else {
      bonus[stat] = (bonus[stat] ?? 0) + value;
    }
  }
}

function applyExpertiseModifiers(
  modifiers: ExpertiseModifier[],
  classLevel: number | null,
  expertise: DerivedStats["expertise"],
  notes: string[],
): void {
  for (const modifier of modifiers) {
    if (!requirementsMet(modifier.requirements, classLevel)) continue;
    if (modifier.expertise === "any") {
      notes.push(
        `Any Expertise +${modifier.value} is not distributed automatically.`,
      );
    } else {
      const key = modifier.expertise as Exclude<Expertise, "any">;
      expertise[key] = (expertise[key] ?? 0) + modifier.value;
    }
  }
}

function requirementsMet(
  requirements: Requirement[],
  classLevel: number | null,
): boolean {
  return requirements.every((requirement) => {
    const kind = requirement.kind as RequirementKind;
    if (kind === "constant") return true;
    if (kind === "class-level") {
      return (
        classLevel != null &&
        requirement.level != null &&
        classLevel >= requirement.level
      );
    }
    return false;
  });
}
