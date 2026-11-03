import type {
  ActionType,
  Allowance,
  ClassLevelSource,
  DataStatus,
  EquipmentRule,
  GoldEffectFrequency,
  HybridMaxHp,
  InheritancePeriod,
  ModifierTarget,
  ReactionMode,
  ShardSource,
  ShardUse,
  StarFill,
  StarStatsRule,
  StartingGearFallback,
  StartingItemsSource,
  Stat,
  StatShape,
  StatShapeMeaning,
  StatusFallback,
  StatusKind,
  SubclassAbilityRule,
  SubclassPassiveRule,
  TierUnlockSource,
  UnlockMode,
  XGrowth,
} from "./enums.js";

export interface BonusFromMain {
  stat: Stat;
  per: number;
  grants: { stat: Stat; value: number };
}

export interface BaseStatsRules {
  bonusFromMain: BonusFromMain[];
  baseStats: Partial<Record<ModifierTarget, number>>;
}

export interface CreationStep {
  id: string;
  order: number;
  title: string;
  detail: string;
  classes: string[];
  status: DataStatus | null;
  fallback: string | null;
}

export interface CreationStepsRules {
  id: string;
  name: string;
  sourcePages: string[];
  steps: CreationStep[];
}

export interface HybridAncestryRules {
  id: string;
  name: string;
  sourcePages: string[];
  enabled: boolean;
  inheritance: {
    languages: { choose: number; exclude: string[] };
    vision: { choose: number };
    expertise: { chooseParents: number };
    mainStats: { positive: number; negative: number };
    bonusStats: { choose: number };
    passives: { nonCombat: number; combat: number };
    maxHp: HybridMaxHp;
  };
}

export interface PartyLevelRules {
  id: string;
  name: string;
  sourcePages: string[];
  backgroundAbilityTiers: number[];
  passiveSlots: Record<string, { base: number; extraAt: number[] }>;
  statPips: { maxPerMainStat: number };
  shards: { slots: number };
}

export interface ClassProgressionRules {
  id: string;
  name: string;
  tierChartSource: string;
  classLevelMax: number;
  mainClass: { starStats: StarStatsRule; equipment: EquipmentRule };
  subclass: {
    abilities: SubclassAbilityRule;
    passives: SubclassPassiveRule;
    note: string;
  };
  unlockModel: {
    abilities: UnlockMode;
    stars: UnlockMode;
    note: string;
    classLevelSource: ClassLevelSource;
  };
  stars: { perUnlock: number; fills: StarFill[]; completionReward: string };
  derivedUnlocks: boolean;
  tierUnlockRules: Record<
    string,
    {
      from: TierUnlockSource;
      level: number;
      requiredClasses: number | null;
      enabled: boolean | null;
    }
  >;
}

export interface CombatRules {
  id: string;
  sourcePages: string[];
  actionEconomy: {
    mainPerTurn: number;
    supportPerTurn: number;
    supportIfSkipMove: number;
    reactions: ReactionMode;
  };
  ultimate: { chargeSlots: number; countsAs: ActionType };
  x: { start: number; growth: XGrowth; growthFormula: string };
  energy: { trackedOnSheet: boolean; maxFormula: string };
}

export interface InventoryRules {
  id: string;
  sourcePages: string[];
  inventoryMax: number;
  stackMax: number;
  customItems: Allowance;
  startingItemsSource: StartingItemsSource;
}

export interface StartingGearRules {
  id: string;
  sourcePages: string[];
  status: DataStatus;
  missingSource: string;
  fallback: StartingGearFallback[];
  bundles: { id: string; name: string; class: string; items: string[] }[];
}

export interface StatusEffectRules {
  id: string;
  status: DataStatus;
  missingSource: string;
  fallback: StatusFallback;
  effects: { id: string; name: string; kind: StatusKind; description: string }[];
}

export type GoldEffect =
  | { kind: "dice"; dice: string; stat: Stat; frequency: GoldEffectFrequency }
  | { kind: "multiplier"; multiplier: number };

export interface EconomyRules {
  id: string;
  sourcePages: string[];
  status: DataStatus;
  shards: { gain: ShardSource[]; uses: ShardUse; usesDetail: string; sheetSlots: number };
  gold: {
    starting: Record<string, number>;
    performerPayouts: Record<string, number>;
    merchantDeals: Record<
      string,
      { buyDiscount: number; sellBonus: number; minPrice: number }
    >;
    inheritance: {
      gold: number;
      per: InheritancePeriod;
      source: string;
      partyLevel: number;
    };
    classEffects: Record<string, GoldEffect>;
    coinTossTable: Record<string, number>;
  };
}

export interface StatShapeRules {
  id: string;
  sourcePages: string[];
  shapes: { id: StatShape; meaning: StatShapeMeaning }[];
}

export interface Rules {
  baseStats: BaseStatsRules;
  creationSteps: CreationStepsRules;
  hybridAncestries: HybridAncestryRules;
  partyLevels: PartyLevelRules;
  statShapes: StatShapeRules;
  classProgression: ClassProgressionRules;
  combat: CombatRules;
  inventory: InventoryRules;
  startingGear: StartingGearRules;
  statusEffects: StatusEffectRules;
  economy: EconomyRules;
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

export function parseBaseStatsRules(wire: unknown): BaseStatsRules {
  const w = wire as Wire;
  return {
    bonusFromMain: opt<unknown[]>(w, "bonus-from-main", []).map((item) => {
      const b = item as Wire;
      const grants = req<Wire>(b, "grants", "bonus-from-main");
      return {
        stat: req<Stat>(b, "stat", "bonus-from-main"),
        per: req<number>(b, "per", "bonus-from-main"),
        grants: {
          stat: req<Stat>(grants, "stat", "bonus-from-main.grants"),
          value: req<number>(grants, "value", "bonus-from-main.grants"),
        },
      };
    }),
    baseStats: { ...(req(w, "base-stats", "base-stats") as Record<ModifierTarget, number>) },
  };
}

export function parseCreationStepsRules(wire: unknown): CreationStepsRules {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "creation-steps"),
    name: req<string>(w, "name", "creation-steps"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    steps: opt<unknown[]>(w, "steps", []).map((item) => {
      const s = item as Wire;
      return {
        id: req<string>(s, "id", "creation-step"),
        order: req<number>(s, "order", "creation-step"),
        title: req<string>(s, "title", "creation-step"),
        detail: req<string>(s, "detail", "creation-step"),
        classes: opt<string[]>(s, "classes", []),
        status: (s["status"] as DataStatus | undefined) ?? null,
        fallback: (s["fallback"] as string | undefined) ?? null,
      };
    }),
  };
}

export function parseHybridAncestryRules(wire: unknown): HybridAncestryRules {
  const w = wire as Wire;
  const inh = req<Wire>(w, "inheritance", "hybrid-ancestries");
  const lang = req<Wire>(inh, "languages", "hybrid inheritance");
  const vision = req<Wire>(inh, "vision", "hybrid inheritance");
  const expertise = req<Wire>(inh, "expertise", "hybrid inheritance");
  const mainStats = req<Wire>(inh, "main-stats", "hybrid inheritance");
  const bonusStats = req<Wire>(inh, "bonus-stats", "hybrid inheritance");
  const passives = req<Wire>(inh, "passives", "hybrid inheritance");
  return {
    id: req<string>(w, "id", "hybrid-ancestries"),
    name: req<string>(w, "name", "hybrid-ancestries"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    enabled: req<boolean>(w, "enabled", "hybrid-ancestries"),
    inheritance: {
      languages: {
        choose: req<number>(lang, "choose", "hybrid languages"),
        exclude: opt<string[]>(lang, "exclude", []),
      },
      vision: { choose: req<number>(vision, "choose", "hybrid vision") },
      expertise: { chooseParents: req<number>(expertise, "choose-parents", "hybrid expertise") },
      mainStats: {
        positive: req<number>(mainStats, "positive", "hybrid main-stats"),
        negative: req<number>(mainStats, "negative", "hybrid main-stats"),
      },
      bonusStats: { choose: req<number>(bonusStats, "choose", "hybrid bonus-stats") },
      passives: {
        nonCombat: req<number>(passives, "non-combat", "hybrid passives"),
        combat: req<number>(passives, "combat", "hybrid passives"),
      },
      maxHp: req<HybridMaxHp>(inh, "max-hp", "hybrid inheritance"),
    },
  };
}

export function parsePartyLevelRules(wire: unknown): PartyLevelRules {
  const w = wire as Wire;
  const slots = req<Record<string, Wire>>(w, "passive-slots", "party-levels");
  const pips = req<Wire>(w, "stat-pips", "party-levels");
  const shards = req<Wire>(w, "shards", "party-levels");
  const parsedSlots: PartyLevelRules["passiveSlots"] = {};
  for (const [slot, rule] of Object.entries(slots)) {
    parsedSlots[slot] = {
      base: req<number>(rule, "base", `passive slot ${slot}`),
      extraAt: opt<number[]>(rule, "extra-at", []),
    };
  }
  return {
    id: req<string>(w, "id", "party-levels"),
    name: req<string>(w, "name", "party-levels"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    backgroundAbilityTiers: req<number[]>(w, "background-ability-tiers", "party-levels"),
    passiveSlots: parsedSlots,
    statPips: { maxPerMainStat: req<number>(pips, "max-per-main-stat", "stat-pips") },
    shards: { slots: req<number>(shards, "slots", "party shards") },
  };
}

export function parseClassProgressionRules(wire: unknown): ClassProgressionRules {
  const w = wire as Wire;
  const mainClass = req<Wire>(w, "main-class", "class-progression");
  const subclass = req<Wire>(w, "subclass", "class-progression");
  const unlockModel = req<Wire>(w, "unlock-model", "class-progression");
  const stars = req<Wire>(w, "stars", "class-progression");
  const tierRules = req<Record<string, Wire>>(w, "tier-unlock-rules", "class-progression");
  const parsedTierRules: ClassProgressionRules["tierUnlockRules"] = {};
  for (const [key, rule] of Object.entries(tierRules)) {
    parsedTierRules[key] = {
      from: req<TierUnlockSource>(rule, "from", `tier-unlock-rule ${key}`),
      level: req<number>(rule, "level", `tier-unlock-rule ${key}`),
      requiredClasses: (rule["required-classes"] as number | undefined) ?? null,
      enabled: (rule["enabled"] as boolean | undefined) ?? null,
    };
  }
  return {
    id: req<string>(w, "id", "class-progression"),
    name: req<string>(w, "name", "class-progression"),
    tierChartSource: req<string>(w, "tier-chart-source", "class-progression"),
    classLevelMax: req<number>(w, "class-level-max", "class-progression"),
    mainClass: {
      starStats: req<StarStatsRule>(mainClass, "star-stats", "main-class"),
      equipment: req<EquipmentRule>(mainClass, "equipment", "main-class"),
    },
    subclass: {
      abilities: req<SubclassAbilityRule>(subclass, "abilities", "subclass"),
      passives: req<SubclassPassiveRule>(subclass, "passives", "subclass"),
      note: req<string>(subclass, "note", "subclass"),
    },
    unlockModel: {
      abilities: req<UnlockMode>(unlockModel, "abilities", "unlock-model"),
      stars: req<UnlockMode>(unlockModel, "stars", "unlock-model"),
      note: req<string>(unlockModel, "note", "unlock-model"),
      classLevelSource: req<ClassLevelSource>(unlockModel, "class-level-source", "unlock-model"),
    },
    stars: {
      perUnlock: req<number>(stars, "per-unlock", "stars"),
      fills: req<StarFill[]>(stars, "fills", "stars"),
      completionReward: req<string>(stars, "completion-reward", "stars"),
    },
    derivedUnlocks: req<boolean>(w, "derived-unlocks", "class-progression"),
    tierUnlockRules: parsedTierRules,
  };
}

export function parseCombatRules(wire: unknown): CombatRules {
  const w = wire as Wire;
  const economy = req<Wire>(w, "action-economy", "combat");
  const ultimate = req<Wire>(w, "ultimate", "combat");
  const x = req<Wire>(w, "x", "combat");
  const energy = req<Wire>(w, "energy", "combat");
  return {
    id: req<string>(w, "id", "combat"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    actionEconomy: {
      mainPerTurn: req<number>(economy, "main-per-turn", "action-economy"),
      supportPerTurn: req<number>(economy, "support-per-turn", "action-economy"),
      supportIfSkipMove: req<number>(economy, "support-if-skip-move", "action-economy"),
      reactions: req<ReactionMode>(economy, "reactions", "action-economy"),
    },
    ultimate: {
      chargeSlots: req<number>(ultimate, "charge-slots", "ultimate"),
      countsAs: req<ActionType>(ultimate, "counts-as", "ultimate"),
    },
    x: {
      start: req<number>(x, "start", "x"),
      growth: req<XGrowth>(x, "growth", "x"),
      growthFormula: req<string>(x, "growth-formula", "x"),
    },
    energy: {
      trackedOnSheet: req<boolean>(energy, "tracked-on-sheet", "energy"),
      maxFormula: req<string>(energy, "max-formula", "energy"),
    },
  };
}

export function parseInventoryRules(wire: unknown): InventoryRules {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "inventory"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    inventoryMax: req<number>(w, "inventory-max", "inventory"),
    stackMax: req<number>(w, "stack-max", "inventory"),
    customItems: req<Allowance>(w, "custom-items", "inventory"),
    startingItemsSource: req<StartingItemsSource>(w, "starting-items-source", "inventory"),
  };
}

export function parseStartingGearRules(wire: unknown): StartingGearRules {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "starting-gear"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    status: req<DataStatus>(w, "status", "starting-gear"),
    missingSource: req<string>(w, "missing-source", "starting-gear"),
    fallback: req<StartingGearFallback[]>(w, "fallback", "starting-gear"),
    bundles: opt<unknown[]>(w, "bundles", []).map((item) => {
      const b = item as Wire;
      return {
        id: req<string>(b, "id", "starting-gear bundle"),
        name: req<string>(b, "name", "starting-gear bundle"),
        class: req<string>(b, "class", "starting-gear bundle"),
        items: req<string[]>(b, "items", "starting-gear bundle"),
      };
    }),
  };
}

export function parseStatusEffectRules(wire: unknown): StatusEffectRules {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "status-effects"),
    status: req<DataStatus>(w, "status", "status-effects"),
    missingSource: req<string>(w, "missing-source", "status-effects"),
    fallback: req<StatusFallback>(w, "fallback", "status-effects"),
    effects: opt<unknown[]>(w, "effects", []).map((item) => {
      const e = item as Wire;
      return {
        id: req<string>(e, "id", "status effect"),
        name: req<string>(e, "name", "status effect"),
        kind: req<StatusKind>(e, "kind", "status effect"),
        description: req<string>(e, "description", "status effect"),
      };
    }),
  };
}

function parseGoldEffect(wire: unknown, key: string): GoldEffect {
  const e = wire as Wire;
  if (e["multiplier"] !== undefined) {
    return { kind: "multiplier", multiplier: e["multiplier"] as number };
  }
  return {
    kind: "dice",
    dice: req<string>(e, "dice", `gold effect ${key}`),
    stat: req<Stat>(e, "stat", `gold effect ${key}`),
    frequency: req<GoldEffectFrequency>(e, "frequency", `gold effect ${key}`),
  };
}

export function parseEconomyRules(wire: unknown): EconomyRules {
  const w = wire as Wire;
  const shards = req<Wire>(w, "shards", "economy");
  const gold = req<Wire>(w, "gold", "economy");
  const deals = req<Record<string, Wire>>(gold, "merchant-deals", "gold");
  const parsedDeals: EconomyRules["gold"]["merchantDeals"] = {};
  for (const [key, deal] of Object.entries(deals)) {
    parsedDeals[key] = {
      buyDiscount: req<number>(deal, "buy-discount", `merchant deal ${key}`),
      sellBonus: req<number>(deal, "sell-bonus", `merchant deal ${key}`),
      minPrice: req<number>(deal, "min-price", `merchant deal ${key}`),
    };
  }
  const inheritance = req<Wire>(gold, "inheritance", "gold");
  const classEffects = req<Record<string, unknown>>(gold, "class-effects", "gold");
  const parsedEffects: Record<string, GoldEffect> = {};
  for (const [key, effect] of Object.entries(classEffects)) {
    parsedEffects[key] = parseGoldEffect(effect, key);
  }
  return {
    id: req<string>(w, "id", "economy"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    status: req<DataStatus>(w, "status", "economy"),
    shards: {
      gain: req<ShardSource[]>(shards, "gain", "shards"),
      uses: req<ShardUse>(shards, "uses", "shards"),
      usesDetail: req<string>(shards, "uses-detail", "shards"),
      sheetSlots: req<number>(shards, "sheet-slots", "shards"),
    },
    gold: {
      starting: { ...(req(gold, "starting", "gold") as Record<string, number>) },
      performerPayouts: {
        ...(req(gold, "performer-payouts", "gold") as Record<string, number>),
      },
      merchantDeals: parsedDeals,
      inheritance: {
        gold: req<number>(inheritance, "gold", "inheritance"),
        per: req<InheritancePeriod>(inheritance, "per", "inheritance"),
        source: req<string>(inheritance, "source", "inheritance"),
        partyLevel: req<number>(inheritance, "party-level", "inheritance"),
      },
      classEffects: parsedEffects,
      coinTossTable: {
        ...(req(gold, "coin-toss-table", "gold") as Record<string, number>),
      },
    },
  };
}

export function parseStatShapeRules(wire: unknown): StatShapeRules {
  const w = wire as Wire;
  return {
    id: req<string>(w, "id", "stat-shapes"),
    sourcePages: opt<string[]>(w, "source-pages", []),
    shapes: opt<unknown[]>(w, "shapes", []).map((item) => {
      const s = item as Wire;
      return {
        id: req<StatShape>(s, "id", "stat shape"),
        meaning: req<StatShapeMeaning>(s, "meaning", "stat shape"),
      };
    }),
  };
}

export function parseRules(wire: {
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
}): Rules {
  return {
    baseStats: parseBaseStatsRules(wire.baseStats),
    creationSteps: parseCreationStepsRules(wire.creationSteps),
    hybridAncestries: parseHybridAncestryRules(wire.hybridAncestries),
    partyLevels: parsePartyLevelRules(wire.partyLevels),
    statShapes: parseStatShapeRules(wire.statShapes),
    classProgression: parseClassProgressionRules(wire.classProgression),
    combat: parseCombatRules(wire.combat),
    inventory: parseInventoryRules(wire.inventory),
    startingGear: parseStartingGearRules(wire.startingGear),
    statusEffects: parseStatusEffectRules(wire.statusEffects),
    economy: parseEconomyRules(wire.economy),
  };
}

export interface PassiveSlotRule {
  base: number;
  extraAt: number[];
}
