use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::enums::{ClassRole, Stat, StatusKind, VisionType};

pub const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct CharacterV1 {
    pub schema_version: u32,
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub notes: String,
    pub main_class: String,
    pub ancestry: AncestrySelection,
    pub backgrounds: Vec<BackgroundSelection>,
    pub classes: Vec<ClassTrack>,
    pub party_level: u8,
    pub stat_pips: BTreeMap<Stat, u8>,
    pub resources: Resources,
    #[serde(default)]
    pub statuses: Vec<StatusEntry>,
    pub equipment: Equipment,
    #[serde(default)]
    pub inventory: Vec<InventoryEntry>,
    pub currency: Currency,
    pub passive_slots: PassiveSlots,
    #[serde(default)]
    pub overrides: Overrides,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct AncestrySelection {
    pub primary: String,
    #[serde(default)]
    pub hybrid: Option<HybridSelection>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridSelection {
    pub secondary: String,
    #[serde(default)]
    pub choices: HybridChoices,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct HybridChoices {
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub vision: Option<VisionType>,
    #[serde(default)]
    pub expertise_source: Option<String>,
    #[serde(default)]
    pub positive_stat: Option<Stat>,
    #[serde(default)]
    pub negative_stat: Option<Stat>,
    #[serde(default)]
    pub bonus_stat: Option<Stat>,
    #[serde(default)]
    pub non_combat_passive: Option<String>,
    #[serde(default)]
    pub combat_passive: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct BackgroundSelection {
    pub background: String,
    #[serde(default)]
    pub chosen_abilities: Vec<ChosenAbility>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct ChosenAbility {
    pub party_level: u8,
    pub ability: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct ClassTrack {
    pub class: String,
    pub role: ClassRole,
    pub level: u8,
    pub x: u8,
    #[serde(default)]
    pub unlocked_actions: Vec<String>,
    #[serde(default)]
    pub unlocked_passives: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Resources {
    pub current_hp: i32,
    pub energy: i32,
    pub exhaustion: i32,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct StatusEntry {
    pub id: String,
    pub name: String,
    pub kind: StatusKind,
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Equipment {
    #[serde(default)]
    pub main_hand: Option<String>,
    #[serde(default)]
    pub armor: Option<String>,
    #[serde(default)]
    pub off_hand: Option<String>,
    #[serde(default)]
    pub accessories: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct InventoryEntry {
    #[serde(default)]
    pub item: Option<String>,
    pub quantity: u16,
    #[serde(default)]
    pub custom_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Currency {
    pub gold: u32,
    pub shards: u32,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct PassiveSlots {
    #[serde(default)]
    pub non_combat: Vec<String>,
    #[serde(default)]
    pub combat: Vec<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub struct Overrides {
    #[serde(default)]
    pub max_hp: Option<i32>,
}
