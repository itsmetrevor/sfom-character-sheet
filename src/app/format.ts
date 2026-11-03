import type {
  Background,
  CharacterV1,
  Class,
  ClassTrack,
  GameData,
  InventoryEntry,
} from "../lib/domain/index.js";
import type { Ancestry, ModifierTarget } from "../lib/domain/index.js";
import type { ExpertiseModifier } from "../lib/domain/index.js";

export function ancestryLabel(game: GameData, character: CharacterV1): string {
  return (
    game.ancestry(character.ancestry.primary)?.name ?? character.ancestry.primary
  );
}

export function backgroundLabel(game: GameData, character: CharacterV1): string {
  if (character.backgrounds.length === 0) return "—";
  return character.backgrounds
    .map(
      (selection) =>
        game.background(selection.background)?.name ?? selection.background,
    )
    .join(" / ");
}

export function classLabel(game: GameData, character: CharacterV1): string {
  return game.class(character.mainClass)?.name ?? character.mainClass;
}

export function subclassLabel(game: GameData, character: CharacterV1): string {
  const subclasses = character.classes
    .filter((track) => track.role === "sub")
    .map((track) => game.class(track.class)?.name ?? track.class);
  return subclasses.length === 0 ? "—" : subclasses.join(" / ");
}

export function classLevel(character: CharacterV1): number {
  return (
    character.classes.find((track) => track.role === "main")?.level ?? 0
  );
}

export function tierLabel(tier: Class["tier"]): string {
  switch (tier) {
    case "starter":
      return "STARTER CLASSES";
    case "tier-1":
      return "TIER 1 CLASSES";
    case "tier-2":
      return "TIER 2 CLASSES";
    case "tier-3":
      return "TIER 3 CLASSES";
    case "tier-4":
      return "TIER 4 CLASSES";
    case "ultimate":
      return "ULTIMATE CLASS";
  }
}

export function classInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return words
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function roleText(cls: Class): string {
  return cls.roles.join("/");
}

export function equipmentValue(game: GameData, value: string | null): string {
  if (!value) return "";
  return game.item(value)?.name ?? value;
}

export function inventoryName(game: GameData, entry: InventoryEntry): string {
  if (entry.item) {
    return game.item(entry.item)?.name ?? entry.customName ?? "UNKNOWN ITEM";
  }
  return entry.customName ?? "UNKNOWN ITEM";
}

export function languageText(ancestry: Ancestry): string {
  return ancestry.languages.join(", ");
}

export function modifierSummary(
  modifiers: Partial<Record<ModifierTarget, number>>,
): string {
  const entries = Object.entries(modifiers) as [ModifierTarget, number][];
  if (entries.length === 0) return "NO STAT MODIFIERS";
  return entries
    .map(([target, value]) => `${target} ${value >= 0 ? "+" : ""}${value}`)
    .join(", ");
}

export function expertiseSummary(
  modifiers: ExpertiseModifier[],
  classLevelValue: number | null,
): string {
  const values = modifiers
    .filter((modifier) =>
      modifier.requirements.every((requirement) => {
        if (requirement.kind === "constant") return true;
        if (requirement.kind === "class-level") {
          return (
            classLevelValue != null &&
            requirement.level != null &&
            classLevelValue >= requirement.level
          );
        }
        return false;
      }),
    )
    .map(
      (modifier) =>
        `${modifier.expertise} ${modifier.value >= 0 ? "+" : ""}${modifier.value}`,
    );
  return values.length === 0 ? "NO EXPERTISE MODIFIERS" : values.join(", ");
}

export function mainClassTrack(character: CharacterV1): ClassTrack | undefined {
  return (
    character.classes.find((track) => track.role === "main") ??
    character.classes.find((track) => track.class === character.mainClass)
  );
}

export function backgroundAbilityAt(
  background: Background,
  partyLevel: number,
): string {
  const chosen = background.passives.find((passive) =>
    passive.requirements.some(
      (r) => r.kind === "party-level" && r.level === partyLevel,
    ),
  );
  return chosen?.name ?? background.passives[0]?.name ?? "—";
}
