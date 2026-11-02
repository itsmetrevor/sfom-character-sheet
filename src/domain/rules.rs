use std::collections::BTreeMap;

use serde::Deserialize;

use super::enums::{
    ActionType, Allowance, ClassLevelSource, DataStatus, EquipmentRule, GoldEffectFrequency,
    HybridMaxHp, InheritancePeriod, ModifierTarget, PassiveSlot, ReactionMode, ShardSource,
    ShardUse, StarFill, StarStatsRule, StartingGearFallback, StartingItemsSource, Stat, StatShape,
    StatShapeMeaning, StatusFallback, StatusKind, SubclassAbilityRule, SubclassPassiveRule,
    TierUnlockSource, UnlockMode, XGrowth,
};

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Rules {
    pub base_stats: BaseStatsRules,
    pub creation_steps: CreationStepsRules,
    pub hybrid_ancestries: HybridAncestryRules,
    pub party_levels: PartyLevelRules,
    pub stat_shapes: StatShapeRules,
    pub class_progression: ClassProgressionRules,
    pub combat: CombatRules,
    pub inventory: InventoryRules,
    pub starting_gear: StartingGearRules,
    pub status_effects: StatusEffectRules,
    pub economy: EconomyRules,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct BaseStatsRules {
    pub bonus_from_main: Vec<BonusFromMain>,
    pub base_stats: BTreeMap<ModifierTarget, i32>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct BonusFromMain {
    pub stat: Stat,
    pub per: u8,
    pub grants: StatGrant,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatGrant {
    pub stat: Stat,
    pub value: i32,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct CreationStepsRules {
    pub id: String,
    pub name: String,
    pub source_pages: Vec<String>,
    pub steps: Vec<CreationStep>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct CreationStep {
    pub id: String,
    pub order: u8,
    pub title: String,
    pub detail: String,
    #[serde(default)]
    pub classes: Vec<String>,
    #[serde(default)]
    pub status: Option<DataStatus>,
    #[serde(default)]
    pub fallback: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridAncestryRules {
    pub id: String,
    pub name: String,
    pub source_pages: Vec<String>,
    pub enabled: bool,
    pub inheritance: HybridInheritance,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridInheritance {
    pub languages: HybridLanguageRule,
    pub vision: HybridChoiceRule,
    pub expertise: HybridExpertiseRule,
    pub main_stats: HybridMainStatRule,
    pub bonus_stats: HybridChoiceRule,
    pub passives: HybridPassiveRule,
    pub max_hp: HybridMaxHp,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridLanguageRule {
    pub choose: u8,
    pub exclude: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridChoiceRule {
    pub choose: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridExpertiseRule {
    pub choose_parents: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridMainStatRule {
    pub positive: u8,
    pub negative: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridPassiveRule {
    pub non_combat: u8,
    pub combat: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct PartyLevelRules {
    pub id: String,
    pub name: String,
    pub source_pages: Vec<String>,
    pub background_ability_tiers: Vec<u8>,
    pub passive_slots: BTreeMap<PassiveSlot, PassiveSlotRule>,
    pub stat_pips: StatPipRule,
    pub shards: PartyShardRule,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct PassiveSlotRule {
    pub base: u8,
    pub extra_at: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatPipRule {
    pub max_per_main_stat: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct PartyShardRule {
    pub slots: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ClassProgressionRules {
    pub id: String,
    pub name: String,
    pub source_pages: Vec<String>,
    pub tier_chart_source: String,
    pub class_level_max: u8,
    pub main_class: MainClassRules,
    pub subclass: SubclassRules,
    pub unlock_model: UnlockModel,
    pub stars: StarRules,
    pub derived_unlocks: bool,
    pub tier_unlock_rules: BTreeMap<String, TierUnlockRule>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct MainClassRules {
    pub star_stats: StarStatsRule,
    pub equipment: EquipmentRule,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct SubclassRules {
    pub abilities: SubclassAbilityRule,
    pub passives: SubclassPassiveRule,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct UnlockModel {
    pub abilities: UnlockMode,
    pub stars: UnlockMode,
    pub note: String,
    pub class_level_source: ClassLevelSource,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StarRules {
    pub per_unlock: u8,
    pub fills: Vec<StarFill>,
    pub completion_reward: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct TierUnlockRule {
    pub from: TierUnlockSource,
    pub level: u8,
    #[serde(default)]
    pub required_classes: Option<u8>,
    #[serde(default)]
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct CombatRules {
    pub id: String,
    pub source_pages: Vec<String>,
    pub action_economy: ActionEconomy,
    pub ultimate: UltimateRules,
    pub x: XRule,
    pub energy: EnergyRule,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ActionEconomy {
    pub main_per_turn: u8,
    pub support_per_turn: u8,
    pub support_if_skip_move: u8,
    pub reactions: ReactionMode,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct UltimateRules {
    pub charge_slots: u8,
    pub counts_as: ActionType,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct XRule {
    pub start: u8,
    pub growth: XGrowth,
    pub growth_formula: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct EnergyRule {
    pub tracked_on_sheet: bool,
    pub max_formula: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct InventoryRules {
    pub id: String,
    pub source_pages: Vec<String>,
    pub inventory_max: u8,
    pub stack_max: u8,
    pub custom_items: Allowance,
    pub starting_items_source: StartingItemsSource,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StartingGearRules {
    pub id: String,
    pub source_pages: Vec<String>,
    pub status: DataStatus,
    pub missing_source: String,
    pub fallback: Vec<StartingGearFallback>,
    pub bundles: Vec<StartingGearBundle>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StartingGearBundle {
    pub id: String,
    pub name: String,
    pub class: String,
    pub items: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatusEffectRules {
    pub id: String,
    pub status: DataStatus,
    pub missing_source: String,
    pub fallback: StatusFallback,
    pub effects: Vec<StatusEffectDef>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatusEffectDef {
    pub id: String,
    pub name: String,
    pub kind: StatusKind,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct EconomyRules {
    pub id: String,
    pub source_pages: Vec<String>,
    pub status: DataStatus,
    pub shards: EconomyShards,
    pub gold: GoldRules,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct EconomyShards {
    pub gain: Vec<ShardSource>,
    pub uses: ShardUse,
    pub uses_detail: String,
    pub sheet_slots: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct GoldRules {
    pub starting: BTreeMap<String, u16>,
    pub performer_payouts: BTreeMap<String, u16>,
    pub merchant_deals: BTreeMap<String, MerchantDeal>,
    pub inheritance: InheritanceRules,
    pub class_effects: BTreeMap<String, GoldEffect>,
    pub coin_toss_table: BTreeMap<String, u16>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct MerchantDeal {
    pub buy_discount: i8,
    pub sell_bonus: i8,
    pub min_price: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct InheritanceRules {
    pub gold: u16,
    pub per: InheritancePeriod,
    pub source: String,
    pub party_level: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(untagged)]
pub enum GoldEffect {
    Dice {
        dice: String,
        stat: Stat,
        frequency: GoldEffectFrequency,
    },
    Multiplier {
        multiplier: u16,
    },
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatShapeRules {
    pub id: String,
    pub source_pages: Vec<String>,
    pub shapes: Vec<StatShapeDef>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatShapeDef {
    pub id: StatShape,
    pub meaning: StatShapeMeaning,
}
