import { characterFromWire, type CharacterV1 } from "./character.js";
import {
  BONUS_STATS,
  isLeveledRequirement,
  MAIN_STATS,
  type ActionType,
  type ClassRole,
  type ClassTier,
  type DamageType,
  type EquipmentSlot,
  type Expertise,
  type GearSlot,
  type Language,
  type MaxHpMode,
  type ModifierTarget,
  type PassiveSlot,
  type PrerequisiteKind,
  type RequirementKind,
  type Role,
  type Stat,
  type StatusKind,
  type VisionType,
} from "./enums.js";
import { parseRules, type Rules } from "./rules.js";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface Requirement {
  kind: RequirementKind;
  level: number | null;
}

export function requirementIsValid(r: Requirement): boolean {
  if (isLeveledRequirement(r.kind)) return r.level != null;
  return r.level == null;
}

export interface ExpertiseModifier {
  expertise: Expertise;
  value: number;
  requirements: Requirement[];
}

export interface AncestryPassive {
  name: string;
  kind: PassiveSlot;
  target: string;
  requirements: Requirement[];
  description: string;
}

export interface Ancestry {
  id: string;
  name: string;
  languages: Language[];
  extraLanguageChoices: number | null;
  vision: VisionType;
  statModifiers: Partial<Record<ModifierTarget, number>>;
  expertiseModifiers: ExpertiseModifier[];
  passives: AncestryPassive[];
  lore: Record<string, string>;
}

export interface StartingItem {
  item: string;
  quantity: number;
}

export interface BackgroundPassive {
  name: string;
  requirements: Requirement[];
  summary: string;
  detail: string;
}

export interface Background {
  id: string;
  name: string;
  craftsman: boolean;
  description: string;
  expertiseModifiers: ExpertiseModifier[];
  startingItems: StartingItem[];
  passives: BackgroundPassive[];
}

export interface Prerequisite {
  kind: PrerequisiteKind;
  class: string | null;
  level: number;
}

export interface ClassPassive {
  name: string;
  target: string;
  requirements: Requirement[];
  description: string;
}

export interface Action {
  name: string;
  kind: ActionType;
  tags: string[];
  cost: string;
  targetRange: string;
  check: string;
  description: string;
}

export interface Class {
  id: string;
  name: string;
  roles: Role[];
  mainStat: Stat;
  tier: ClassTier;
  xStart: number;
  maxHpMode: MaxHpMode;
  prerequisites: Prerequisite[];
  expertiseModifiers: ExpertiseModifier[];
  statModifiers: Partial<Record<ModifierTarget, number>>;
  equipment: Partial<Record<EquipmentSlot, string>>;
  combatModifier: { name: string; description: string };
  ultimate: { name: string; description: string; charge: string[] };
  passives: ClassPassive[];
  actions: Action[];
}

export interface Item {
  id: string;
  name: string;
  slot: GearSlot;
  damageType: DamageType;
  statModifiers: Partial<Record<ModifierTarget, number>>;
  expertiseModifiers: ExpertiseModifier[];
  effect: string;
  stackMax: number;
}

export interface ExpertiseDef {
  id: Expertise;
  name: string;
  mainStat: Stat;
  description: string;
}

export interface LanguageDef {
  id: Language;
  name: string;
  description: string;
}

export interface VisionTypeDef {
  id: VisionType;
  name: string;
  description: string;
}

export interface EnumsConfig {
  classTiers: ClassTier[];
  classRoles: ClassRole[];
  roles: Role[];
  mainStats: Stat[];
  bonusStats: Stat[];
  modifierTargets: ModifierTarget[];
  gearSlots: GearSlot[];
  equipmentSlots: EquipmentSlot[];
  damageTypes: DamageType[];
  passiveSources: string[];
  passiveSlots: PassiveSlot[];
  actionTypes: ActionType[];
  requirementKinds: RequirementKind[];
  prerequisiteKinds: PrerequisiteKind[];
  maxHpModes: MaxHpMode[];
  statShapes: string[];
  statShapeMeanings: string[];
  statusKinds: StatusKind[];
}

/** Wire shape of public/config/index.json (kebab-case keys). */
export interface ConfigIndex {
  version: number;
  core: {
    enums: string;
    requirements: string;
    expertise: string;
    languages: string;
    "vision-types": string;
    "character-template": string;
  };
  entities: {
    ancestries: string[];
    backgrounds: string[];
    classes: string[];
    items: string[];
  };
  rules: {
    "base-stats": string;
    "creation-steps": string;
    "hybrid-ancestries": string;
    "party-levels": string;
    "stat-shapes": string;
    "class-progression": string;
    combat: string;
    inventory: string;
    "starting-gear": string;
    "status-effects": string;
    economy: string;
  };
}

type Wire = Record<string, unknown>;

function req<T>(wire: Wire, key: string, owner: string): T {
  const value = wire[key];
  if (value === undefined) throw new Error(`${owner}: missing ${key}`);
  return value as T;
}

function opt<T>(wire: Wire, key: string, fallback: T): T {
  const value = wire[key];
  return value === undefined ? fallback : (value as T);
}

function parseRequirement(wire: unknown, owner: string): Requirement {
  const w = wire as Wire;
  return {
    kind: req<RequirementKind>(w, "kind", owner),
    level: (w["level"] as number | undefined) ?? null,
  };
}

function parseRequirements(wire: unknown, owner: string): Requirement[] {
  if (wire === undefined) return [];
  if (!Array.isArray(wire)) throw new Error(`${owner}: requirements must be an array`);
  return wire.map((item) => parseRequirement(item, owner));
}

function parseExpertiseModifier(wire: unknown, owner: string): ExpertiseModifier {
  const w = wire as Wire;
  return {
    expertise: req<Expertise>(w, "expertise", owner),
    value: req<number>(w, "value", owner),
    requirements: parseRequirements(w["requirements"], owner),
  };
}

function parseExpertiseModifiers(wire: unknown, owner: string): ExpertiseModifier[] {
  if (wire === undefined) return [];
  if (!Array.isArray(wire)) throw new Error(`${owner}: expertise-modifiers must be an array`);
  return wire.map((item) => parseExpertiseModifier(item, owner));
}

function parseStatModifiers(wire: unknown): Partial<Record<ModifierTarget, number>> {
  if (wire === undefined) return {};
  return { ...(wire as Record<ModifierTarget, number>) };
}

function parseAncestry(wire: unknown): Ancestry {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "ancestry"),
    name: req<string>(w, "name", "ancestry"),
    languages: req<Language[]>(w, "languages", "ancestry"),
    extraLanguageChoices: (w["extra-language-choices"] as number | undefined) ?? null,
    vision: req<VisionType>(w, "vision", "ancestry"),
    statModifiers: parseStatModifiers(w["stat-modifiers"]),
    expertiseModifiers: parseExpertiseModifiers(w["expertise-modifiers"], "ancestry"),
    passives: opt<unknown[]>(w, "passives", []).map((item) => {
      const p = item as Wire;
      return {
        name: req<string>(p, "name", "ancestry passive"),
        kind: req<PassiveSlot>(p, "type", "ancestry passive"),
        target: req<string>(p, "target", "ancestry passive"),
        requirements: parseRequirements(p["requirements"], "ancestry passive"),
        description: req<string>(p, "description", "ancestry passive"),
      };
    }),
    lore: { ...opt<Record<string, string>>(w, "lore", {}) },
  };
}

function parseBackground(wire: unknown): Background {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "background"),
    name: req<string>(w, "name", "background"),
    craftsman: req<boolean>(w, "craftsman", "background"),
    description: req<string>(w, "description", "background"),
    expertiseModifiers: parseExpertiseModifiers(w["expertise-modifiers"], "background"),
    startingItems: opt<unknown[]>(w, "starting-items", []).map((item) => {
      const s = item as Wire;
      return {
        item: req<string>(s, "item", "starting item"),
        quantity: req<number>(s, "quantity", "starting item"),
      };
    }),
    passives: opt<unknown[]>(w, "passives", []).map((item) => {
      const p = item as Wire;
      return {
        name: req<string>(p, "name", "background passive"),
        requirements: parseRequirements(p["requirements"], "background passive"),
        summary: req<string>(p, "summary", "background passive"),
        detail: req<string>(p, "detail", "background passive"),
      };
    }),
  };
}

function parseClass(wire: unknown): Class {
  const w = wire as Wire;
  const combatModifier = req<Wire>(w, "combat-modifier", "class");
  const ultimate = req<Wire>(w, "ultimate", "class");
  return {
    id: req<string>(w, "id", "class"),
    name: req<string>(w, "name", "class"),
    roles: req<Role[]>(w, "roles", "class"),
    mainStat: req<Stat>(w, "main-stat", "class"),
    tier: req<ClassTier>(w, "tier", "class"),
    xStart: req<number>(w, "x-start", "class"),
    maxHpMode: req<MaxHpMode>(w, "max-hp-mode", "class"),
    prerequisites: opt<unknown[]>(w, "prerequisites", []).map((item) => {
      const p = item as Wire;
      return {
        kind: req<PrerequisiteKind>(p, "kind", "prerequisite"),
        class: (p["class"] as string | undefined) ?? null,
        level: req<number>(p, "level", "prerequisite"),
      };
    }),
    expertiseModifiers: parseExpertiseModifiers(w["expertise-modifiers"], "class"),
    statModifiers: parseStatModifiers(w["stat-modifiers"]),
    equipment: { ...(opt<Record<EquipmentSlot, string>>(w, "equipment", {} as Record<EquipmentSlot, string>)) },
    combatModifier: {
      name: req<string>(combatModifier, "name", "combat-modifier"),
      description: req<string>(combatModifier, "description", "combat-modifier"),
    },
    ultimate: {
      name: req<string>(ultimate, "name", "ultimate"),
      description: req<string>(ultimate, "description", "ultimate"),
      charge: req<string[]>(ultimate, "charge", "ultimate"),
    },
    passives: opt<unknown[]>(w, "passives", []).map((item) => {
      const p = item as Wire;
      return {
        name: req<string>(p, "name", "class passive"),
        target: req<string>(p, "target", "class passive"),
        requirements: parseRequirements(p["requirements"], "class passive"),
        description: req<string>(p, "description", "class passive"),
      };
    }),
    actions: opt<unknown[]>(w, "actions", []).map((item) => {
      const a = item as Wire;
      return {
        name: req<string>(a, "name", "action"),
        kind: req<ActionType>(a, "type", "action"),
        tags: req<string[]>(a, "tags", "action"),
        cost: req<string>(a, "cost", "action"),
        targetRange: req<string>(a, "target-range", "action"),
        check: req<string>(a, "check", "action"),
        description: req<string>(a, "description", "action"),
      };
    }),
  };
}

function parseItem(wire: unknown): Item {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "item"),
    name: req<string>(w, "name", "item"),
    slot: req<GearSlot>(w, "slot", "item"),
    damageType: req<DamageType>(w, "damage-type", "item"),
    statModifiers: parseStatModifiers(w["stat-modifiers"]),
    expertiseModifiers: parseExpertiseModifiers(w["expertise-modifiers"], "item"),
    effect: req<string>(w, "effect", "item"),
    stackMax: req<number>(w, "stack-max", "item"),
  };
}

function parseEnumsConfig(wire: unknown): EnumsConfig {
  const w = wire as Wire;
  return {
    classTiers: req<ClassTier[]>(w, "class-tiers", "enums"),
    classRoles: req<ClassRole[]>(w, "class-roles", "enums"),
    roles: req<Role[]>(w, "roles", "enums"),
    mainStats: req<Stat[]>(w, "main-stats", "enums"),
    bonusStats: req<Stat[]>(w, "bonus-stats", "enums"),
    modifierTargets: req<ModifierTarget[]>(w, "modifier-targets", "enums"),
    gearSlots: req<GearSlot[]>(w, "gear-slots", "enums"),
    equipmentSlots: req<EquipmentSlot[]>(w, "equipment-slots", "enums"),
    damageTypes: req<DamageType[]>(w, "damage-types", "enums"),
    passiveSources: req<string[]>(w, "passive-sources", "enums"),
    passiveSlots: req<PassiveSlot[]>(w, "passive-slots", "enums"),
    actionTypes: req<ActionType[]>(w, "action-types", "enums"),
    requirementKinds: req<RequirementKind[]>(w, "requirement-kinds", "enums"),
    prerequisiteKinds: req<PrerequisiteKind[]>(w, "prerequisite-kinds", "enums"),
    maxHpModes: req<MaxHpMode[]>(w, "max-hp-modes", "enums"),
    statShapes: req<string[]>(w, "stat-shapes", "enums"),
    statShapeMeanings: req<string[]>(w, "stat-shape-meanings", "enums"),
    statusKinds: req<StatusKind[]>(w, "status-kinds", "enums"),
  };
}

export interface RawGameFiles {
  enums: unknown;
  ancestries: unknown[];
  backgrounds: unknown[];
  classes: unknown[];
  items: unknown[];
  expertise: unknown;
  languages: unknown;
  visionTypes: unknown;
  requirements: unknown;
  rules: {
    baseStats: unknown;
    creationSteps: unknown;
    hybridAncestries: unknown;
    partyLevels: unknown;
    statShapes: unknown;
    classProgression: unknown;
    combat: unknown;
    inventory: unknown;
    startingGear: unknown;
    statusEffects: unknown;
    economy: unknown;
  };
  characterTemplate: unknown;
}

export interface GameDataSnapshot {
  enums: EnumsConfig;
  ancestries: Ancestry[];
  backgrounds: Background[];
  classes: Class[];
  items: Item[];
  expertise: ExpertiseDef[];
  languages: LanguageDef[];
  visionTypes: VisionTypeDef[];
  requirements: Record<string, string>;
  rules: Rules;
  characterTemplate: CharacterV1;
}

export function assembleGameData(files: RawGameFiles): GameDataSnapshot {
  const snapshot: GameDataSnapshot = {
    enums: parseEnumsConfig(files.enums),
    ancestries: files.ancestries.map(parseAncestry),
    backgrounds: files.backgrounds.map(parseBackground),
    classes: files.classes.map(parseClass),
    items: files.items.map(parseItem),
    expertise: (files.expertise as unknown[]).map((item) => {
      const e = item as Wire;
      return {
        id: req<Expertise>(e, "id", "expertise"),
        name: req<string>(e, "name", "expertise"),
        mainStat: req<Stat>(e, "main-stat", "expertise"),
        description: req<string>(e, "description", "expertise"),
      };
    }),
    languages: (files.languages as unknown[]).map((item) => {
      const l = item as Wire;
      return {
        id: req<Language>(l, "id", "language"),
        name: req<string>(l, "name", "language"),
        description: req<string>(l, "description", "language"),
      };
    }),
    visionTypes: (files.visionTypes as unknown[]).map((item) => {
      const v = item as Wire;
      return {
        id: req<VisionType>(v, "id", "vision type"),
        name: req<string>(v, "name", "vision type"),
        description: req<string>(v, "description", "vision type"),
      };
    }),
    requirements: { ...(files.requirements as Record<string, string>) },
    rules: parseRules(files.rules),
    characterTemplate: characterFromWire(files.characterTemplate),
  };
  const errors = validateGameData(snapshot);
  if (errors.length > 0) {
    throw new ConfigError(`config validation failed:\n${errors.join("\n")}`);
  }
  return snapshot;
}

export class GameData {
  constructor(private readonly data: GameDataSnapshot) {}

  get enums(): EnumsConfig {
    return this.data.enums;
  }
  get ancestries(): Ancestry[] {
    return this.data.ancestries;
  }
  get backgrounds(): Background[] {
    return this.data.backgrounds;
  }
  get classes(): Class[] {
    return this.data.classes;
  }
  get items(): Item[] {
    return this.data.items;
  }
  get expertise(): ExpertiseDef[] {
    return this.data.expertise;
  }
  get languages(): LanguageDef[] {
    return this.data.languages;
  }
  get visionTypes(): VisionTypeDef[] {
    return this.data.visionTypes;
  }
  get requirements(): Record<string, string> {
    return this.data.requirements;
  }
  get rules(): Rules {
    return this.data.rules;
  }
  get characterTemplate(): CharacterV1 {
    return this.data.characterTemplate;
  }

  ancestry(id: string): Ancestry | undefined {
    return this.data.ancestries.find((a) => a.id === id);
  }

  background(id: string): Background | undefined {
    return this.data.backgrounds.find((b) => b.id === id);
  }

  class(id: string): Class | undefined {
    return this.data.classes.find((c) => c.id === id);
  }

  item(id: string): Item | undefined {
    return this.data.items.find((i) => i.id === id);
  }

  expertiseById(id: Expertise): ExpertiseDef | undefined {
    return this.data.expertise.find((e) => e.id === id);
  }

  classesUnlockedBy(classId: string): Class[] {
    const starter =
      this.class(classId)?.tier === "starter";
    return this.data.classes.filter((c) =>
      c.prerequisites.some((p) =>
        p.kind === "class"
          ? p.class === classId
          : starter,
      ),
    );
  }

  /** Load over HTTP using the web config index (browser + node with fetch). */
  static async loadFromWeb(base: string, fetchImpl: typeof fetch = fetch): Promise<GameData> {
    const indexUrl = joinUrl(base, "index.json");
    let indexText: string;
    try {
      const res = await fetchImpl(indexUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      indexText = await res.text();
    } catch (error) {
      throw new ConfigError(
        `failed to fetch ${indexUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    let index: ConfigIndex;
    try {
      index = JSON.parse(indexText) as ConfigIndex;
    } catch (error) {
      throw new ConfigError(
        `failed to parse config index ${indexUrl}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (index.version !== 1) {
      throw new ConfigError(`unsupported config index version: ${index.version}`);
    }

    const { parse: parseYaml } = await import("yaml");
    const fetchYaml = async (relative: string): Promise<unknown> => {
      const url = joinUrl(base, relative);
      let text: string;
      try {
        const res = await fetchImpl(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      } catch (error) {
        throw new ConfigError(
          `failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        return parseYaml(text);
      } catch (error) {
        throw new ConfigError(
          `failed to parse ${relative}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    const fetchOptional = async (relative: string): Promise<unknown | null> => {
      const url = joinUrl(base, relative);
      let res: Response;
      try {
        res = await fetchImpl(url, { cache: "no-store" });
      } catch (error) {
        throw new ConfigError(
          `failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new ConfigError(`failed to fetch ${url}: HTTP ${res.status}`);
      }
      const text = await res.text();
      try {
        return parseYaml(text);
      } catch (error) {
        throw new ConfigError(
          `failed to parse ${relative}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };

    const ancestries: unknown[] = [];
    for (const file of index.entities.ancestries) {
      const value = await fetchOptional(joinUrl("ancestries", file));
      if (value != null) ancestries.push(value);
    }
    const backgrounds: unknown[] = [];
    for (const file of index.entities.backgrounds) {
      const value = await fetchOptional(joinUrl("backgrounds", file));
      if (value != null) backgrounds.push(value);
    }
    const classes: unknown[] = [];
    for (const file of index.entities.classes) {
      const value = await fetchOptional(joinUrl("classes", file));
      if (value != null) classes.push(value);
    }
    const items: unknown[] = [];
    for (const file of index.entities.items) {
      const value = await fetchOptional(joinUrl("items", file));
      if (value != null) items.push(value);
    }

    const rulesPrefix = "rules";
    const core = index.core;
    const rulesIndex = index.rules;
    const snapshot = assembleGameData({
      enums: await fetchYaml(core.enums),
      ancestries,
      backgrounds,
      classes,
      items,
      expertise: await fetchYaml(core.expertise),
      languages: await fetchYaml(core.languages),
      visionTypes: await fetchYaml(core["vision-types"]),
      requirements: await fetchYaml(core.requirements),
      rules: {
        baseStats: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["base-stats"])),
        creationSteps: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["creation-steps"])),
        hybridAncestries: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["hybrid-ancestries"])),
        partyLevels: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["party-levels"])),
        statShapes: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["stat-shapes"])),
        classProgression: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["class-progression"])),
        combat: await fetchYaml(joinUrl(rulesPrefix, rulesIndex.combat)),
        inventory: await fetchYaml(joinUrl(rulesPrefix, rulesIndex.inventory)),
        startingGear: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["starting-gear"])),
        statusEffects: await fetchYaml(joinUrl(rulesPrefix, rulesIndex["status-effects"])),
        economy: await fetchYaml(joinUrl(rulesPrefix, rulesIndex.economy)),
      },
      characterTemplate: await fetchYaml(core["character-template"]),
    });
    return new GameData(snapshot);
  }

  /** Load at runtime: fetch config/ relative to the app base in browsers. */
  static loadRuntime(): Promise<GameData> {
    const base = `${import.meta.env.BASE_URL}config`;
    return GameData.loadFromWeb(base);
  }
}

export function joinUrl(base: string, relative: string): string {
  return `${base.replace(/\/+$/, "")}/${relative.replace(/^\/+/, "")}`;
}

export function parseConfigIndex(text: string, path: string): ConfigIndex {
  try {
    return JSON.parse(text) as ConfigIndex;
  } catch (error) {
    throw new ConfigError(
      `failed to parse config index ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Validation (mirrors src/domain/config.rs validate)
// ---------------------------------------------------------------------------

export function validateGameData(game: GameDataSnapshot): string[] {
  const errors: string[] = [];

  const ancestryIds = new Set(game.ancestries.map((a) => a.id));
  const backgroundIds = new Set(game.backgrounds.map((b) => b.id));
  const classIds = new Set(game.classes.map((c) => c.id));
  const itemIds = new Set(game.items.map((i) => i.id));

  checkUnique("ancestry", game.ancestries.map((a) => a.id), errors);
  checkUnique("background", game.backgrounds.map((b) => b.id), errors);
  checkUnique("class", game.classes.map((c) => c.id), errors);
  checkUnique("item", game.items.map((i) => i.id), errors);
  checkUnique("expertise", game.expertise.map((e) => e.id), errors);
  checkUnique("language", game.languages.map((l) => l.id), errors);
  checkUnique("vision type", game.visionTypes.map((v) => v.id), errors);

  if (game.expertise.some((e) => e.id === "any")) {
    errors.push("expertise.yaml must not define the 'any' sentinel");
  }

  const requirementKeys = new Set(Object.keys(game.requirements));
  const enumRequirementKeys = new Set(game.enums.requirementKinds);
  if (!setsEqual(requirementKeys, enumRequirementKeys)) {
    const diff = [...symmetricDifference(requirementKeys, enumRequirementKeys)];
    errors.push(`requirements.yaml keys do not match requirement-kinds: ${JSON.stringify(diff)}`);
  }

  if (!setsEqual(new Set(game.enums.mainStats), new Set(MAIN_STATS))) {
    errors.push("main-stats enum must match Stat::MAIN");
  }
  if (!setsEqual(new Set(game.enums.bonusStats), new Set(BONUS_STATS))) {
    errors.push("bonus-stats enum must match Stat::BONUS");
  }

  for (const ancestry of game.ancestries) {
    const owner = `ancestry ${ancestry.id}`;
    if (ancestry.languages.length === 0) {
      errors.push(`${owner}: must list at least one language`);
    }
    checkExpertiseModifiers(owner, ancestry.expertiseModifiers, errors);
    for (const passive of ancestry.passives) {
      checkRequirements(`${owner} passive ${passive.name}`, passive.requirements, errors);
    }
  }

  for (const background of game.backgrounds) {
    const owner = `background ${background.id}`;
    checkExpertiseModifiers(owner, background.expertiseModifiers, errors);
    for (const item of background.startingItems) {
      if (!itemIds.has(item.item)) {
        errors.push(`${owner}: unknown starting item ${item.item}`);
      }
      if (item.quantity === 0) {
        errors.push(`${owner}: starting item ${item.item} has zero quantity`);
      }
    }
    for (const passive of background.passives) {
      checkRequirements(`${owner} passive ${passive.name}`, passive.requirements, errors);
    }
  }

  for (const cls of game.classes) {
    const owner = `class ${cls.id}`;
    if (cls.roles.length === 0) errors.push(`${owner}: must have at least one role`);
    if (cls.xStart === 0) errors.push(`${owner}: x-start must be greater than zero`);
    checkExpertiseModifiers(owner, cls.expertiseModifiers, errors);
    for (const slot of Object.keys(cls.equipment)) {
      if (!(game.enums.equipmentSlots as readonly string[]).includes(slot)) {
        errors.push(`${owner}: unknown equipment slot ${slot}`);
      }
    }
    for (const slot of ["main-hand", "armor", "off-hand"] as const) {
      if (!(slot in cls.equipment)) {
        errors.push(`${owner}: missing equipment slot ${slot}`);
      }
    }
    if (cls.prerequisites.length === 0 && cls.tier !== "starter") {
      errors.push(`${owner}: non-starter class has no prerequisites`);
    }
    for (const prerequisite of cls.prerequisites) {
      if (prerequisite.kind === "class") {
        if (prerequisite.class == null) {
          errors.push(`${owner}: class prerequisite is missing its class id`);
        } else if (!classIds.has(prerequisite.class)) {
          errors.push(`${owner}: unknown prerequisite class ${prerequisite.class}`);
        }
      } else {
        if (prerequisite.class != null) {
          errors.push(`${owner}: any-starter prerequisite must not name a class`);
        }
        if (cls.tier !== "tier-1") {
          errors.push(`${owner}: any-starter prerequisite must target a tier-1 class`);
        }
      }
      if (prerequisite.level === 0) {
        errors.push(`${owner}: prerequisite level must be greater than zero`);
      }
    }
    checkUnique(`${owner} action`, cls.actions.map((a) => a.name), errors);
    checkUnique(`${owner} passive`, cls.passives.map((p) => p.name), errors);
    for (const action of cls.actions) {
      if (action.tags.length === 0) {
        errors.push(`${owner}: action ${action.name} has no tags`);
      }
    }
    for (const passive of cls.passives) {
      checkRequirements(`${owner} passive ${passive.name}`, passive.requirements, errors);
    }
    if (cls.ultimate.charge.length === 0) {
      errors.push(`${owner}: ultimate has no charge conditions`);
    }
  }

  for (const item of game.items) {
    if (item.stackMax === 0) {
      errors.push(`item ${item.id}: stack-max must be greater than zero`);
    }
    checkExpertiseModifiers(`item ${item.id}`, item.expertiseModifiers, errors);
  }

  validateCharacterTemplate(game, ancestryIds, backgroundIds, classIds, itemIds, errors);
  validateRules(game, classIds, itemIds, errors);

  return errors;
}

function validateCharacterTemplate(
  game: GameDataSnapshot,
  ancestryIds: Set<string>,
  backgroundIds: Set<string>,
  classIds: Set<string>,
  itemIds: Set<string>,
  errors: string[],
): void {
  const template = game.characterTemplate;
  if (template.schemaVersion !== 1) {
    errors.push(`character template: schema-version ${template.schemaVersion} is not supported`);
  }
  if (!classIds.has(template.mainClass)) {
    errors.push(`character template: unknown main class ${template.mainClass}`);
  }
  if (!ancestryIds.has(template.ancestry.primary)) {
    errors.push(`character template: unknown ancestry ${template.ancestry.primary}`);
  }
  if (template.ancestry.hybrid && !ancestryIds.has(template.ancestry.hybrid.secondary)) {
    errors.push(`character template: unknown hybrid ancestry ${template.ancestry.hybrid.secondary}`);
  }
  for (const background of template.backgrounds) {
    if (!backgroundIds.has(background.background)) {
      errors.push(`character template: unknown background ${background.background}`);
      continue;
    }
    const definition = game.backgrounds.find((b) => b.id === background.background);
    if (!definition) continue;
    for (const chosen of background.chosenAbilities) {
      if (!definition.passives.some((p) => p.name === chosen.ability)) {
        errors.push(
          `character template: unknown ability ${chosen.ability} for background ${background.background}`,
        );
      }
    }
  }
  if (
    !template.classes.some((t) => t.class === template.mainClass && t.role === "main")
  ) {
    errors.push("character template: main class is not marked as main");
  }
  for (const track of template.classes) {
    if (!classIds.has(track.class)) {
      errors.push(`character template: unknown class ${track.class}`);
      continue;
    }
    const cls = game.classes.find((c) => c.id === track.class);
    if (!cls) continue;
    if (track.level > game.rules.classProgression.classLevelMax) {
      errors.push(`character template: class ${track.class} level exceeds class-level-max`);
    }
    for (const action of track.unlockedActions) {
      if (!cls.actions.some((a) => a.name === action)) {
        errors.push(`character template: unknown action ${action} for class ${track.class}`);
      }
    }
    for (const passive of track.unlockedPassives) {
      if (!cls.passives.some((p) => p.name === passive)) {
        errors.push(`character template: unknown passive ${passive} for class ${track.class}`);
      }
    }
  }
  for (const [stat, pips] of Object.entries(template.statPips)) {
    if (!(MAIN_STATS as readonly string[]).includes(stat)) {
      errors.push(`character template: stat pip on non-main stat ${stat}`);
    }
    if ((pips ?? 0) > game.rules.partyLevels.statPips.maxPerMainStat) {
      errors.push(`character template: too many stat pips for ${stat}`);
    }
  }
  for (const entry of template.inventory) {
    if (entry.quantity === 0) {
      errors.push("character template: inventory entry has zero quantity");
    }
    if (entry.item != null && !itemIds.has(entry.item)) {
      errors.push(`character template: unknown inventory item ${entry.item}`);
    } else if (entry.item == null && entry.customName == null) {
      errors.push("character template: inventory entry needs an item or custom name");
    }
  }
  for (const status of template.statuses) {
    if (status.id === "") {
      errors.push("character template: status id must not be empty");
    }
  }
}

function validateRules(
  game: GameDataSnapshot,
  classIds: Set<string>,
  itemIds: Set<string>,
  errors: string[],
): void {
  const rules = game.rules;
  if (rules.inventory.inventoryMax === 0 || rules.inventory.stackMax === 0) {
    errors.push("inventory rules: inventory-max and stack-max must be positive");
  }
  if (rules.classProgression.classLevelMax === 0) {
    errors.push("class progression: class-level-max must be positive");
  }
  for (const step of rules.creationSteps.steps) {
    for (const cls of step.classes) {
      if (!classIds.has(cls)) {
        errors.push(`creation step ${step.id}: unknown class ${cls}`);
      }
    }
    if (step.status === "placeholder" && step.fallback == null) {
      errors.push(`creation step ${step.id}: placeholder has no fallback`);
    }
  }
  for (const [slot, rule] of Object.entries(rules.partyLevels.passiveSlots)) {
    if (rule.base === 0) {
      errors.push(`party levels: passive slot ${slot} base is zero`);
    }
  }
  for (const bundle of rules.startingGear.bundles) {
    for (const item of bundle.items) {
      if (!itemIds.has(item)) {
        errors.push(`starting gear ${bundle.id}: unknown item ${item}`);
      }
    }
  }
  checkUnique(
    "status effect",
    rules.statusEffects.effects.map((e) => e.id),
    errors,
  );
  if (
    rules.statusEffects.effects.length === 0 &&
    rules.statusEffects.status !== "placeholder"
  ) {
    errors.push("status effects: empty catalog must be marked placeholder");
  }
}

function checkUnique(label: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function checkRequirements(
  owner: string,
  requirements: Requirement[],
  errors: string[],
): void {
  for (const requirement of requirements) {
    if (!requirementIsValid(requirement)) {
      errors.push(
        `${owner}: malformed requirement ${JSON.stringify(requirement)}`,
      );
    }
  }
}

function checkExpertiseModifiers(
  owner: string,
  modifiers: ExpertiseModifier[],
  errors: string[],
): void {
  for (const modifier of modifiers) {
    if (modifier.value === 0) {
      errors.push(`${owner}: zero-value expertise modifier for ${modifier.expertise}`);
    }
    checkRequirements(owner, modifier.requirements, errors);
  }
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function symmetricDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  for (const item of a) if (!b.has(item)) out.add(item);
  for (const item of b) if (!a.has(item)) out.add(item);
  return out;
}
