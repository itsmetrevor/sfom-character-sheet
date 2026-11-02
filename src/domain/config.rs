use std::collections::{BTreeMap, BTreeSet};

use include_dir::{include_dir, Dir};
use serde::de::DeserializeOwned;
use serde::Deserialize;
use thiserror::Error;

use super::character::{CharacterV1, SCHEMA_VERSION};
use super::enums::{
    ActionType, ClassRole, ClassTier, DamageType, DataStatus, EquipmentSlot, Expertise, GearSlot,
    Language, MaxHpMode, ModifierTarget, PassiveSlot, PrerequisiteKind, RequirementKind, Role,
    Stat, StatShape, StatShapeMeaning, StatusKind, VisionType,
};
use super::rules::Rules;

static CONFIG_DIR: Dir<'static> = include_dir!("config");

#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("missing embedded config file: {0}")]
    MissingFile(String),
    #[error("embedded config is not valid UTF-8: {0}")]
    InvalidUtf8(String),
    #[error("failed to parse {path}: {source}")]
    Parse {
        path: String,
        #[source]
        source: serde_yaml::Error,
    },
    #[error("config validation failed:\n{0}")]
    Validation(String),
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct EnumsConfig {
    pub class_tiers: Vec<ClassTier>,
    pub class_roles: Vec<ClassRole>,
    pub roles: Vec<Role>,
    pub main_stats: Vec<Stat>,
    pub bonus_stats: Vec<Stat>,
    pub modifier_targets: Vec<ModifierTarget>,
    pub gear_slots: Vec<GearSlot>,
    pub equipment_slots: Vec<EquipmentSlot>,
    pub damage_types: Vec<DamageType>,
    pub passive_sources: Vec<super::enums::PassiveSource>,
    pub passive_slots: Vec<PassiveSlot>,
    pub action_types: Vec<ActionType>,
    pub requirement_kinds: Vec<RequirementKind>,
    pub prerequisite_kinds: Vec<PrerequisiteKind>,
    pub max_hp_modes: Vec<MaxHpMode>,
    pub stat_shapes: Vec<StatShape>,
    pub stat_shape_meanings: Vec<StatShapeMeaning>,
    pub status_kinds: Vec<StatusKind>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ExpertiseDef {
    pub id: Expertise,
    pub name: String,
    pub main_stat: Stat,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct LanguageDef {
    pub id: Language,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct VisionTypeDef {
    pub id: VisionType,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Ancestry {
    pub id: String,
    pub name: String,
    pub languages: Vec<Language>,
    #[serde(default)]
    pub extra_language_choices: Option<u8>,
    pub vision: VisionType,
    pub stat_modifiers: BTreeMap<ModifierTarget, i32>,
    pub expertise_modifiers: Vec<ExpertiseModifier>,
    pub passives: Vec<AncestryPassive>,
    #[serde(default)]
    pub lore: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct AncestryPassive {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: PassiveSlot,
    pub target: String,
    #[serde(default)]
    pub requirements: Vec<Requirement>,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Background {
    pub id: String,
    pub name: String,
    pub craftsman: bool,
    pub description: String,
    pub expertise_modifiers: Vec<ExpertiseModifier>,
    pub starting_items: Vec<StartingItem>,
    pub passives: Vec<BackgroundPassive>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct StartingItem {
    pub item: String,
    pub quantity: u16,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct BackgroundPassive {
    pub name: String,
    #[serde(default)]
    pub requirements: Vec<Requirement>,
    pub summary: String,
    pub detail: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Class {
    pub id: String,
    pub name: String,
    pub roles: Vec<Role>,
    pub main_stat: Stat,
    pub tier: ClassTier,
    pub x_start: u8,
    pub max_hp_mode: MaxHpMode,
    pub prerequisites: Vec<Prerequisite>,
    pub expertise_modifiers: Vec<ExpertiseModifier>,
    pub stat_modifiers: BTreeMap<ModifierTarget, i32>,
    pub equipment: BTreeMap<EquipmentSlot, String>,
    pub combat_modifier: CombatModifier,
    pub ultimate: Ultimate,
    pub passives: Vec<ClassPassive>,
    pub actions: Vec<Action>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Prerequisite {
    pub kind: PrerequisiteKind,
    #[serde(default)]
    pub class: Option<String>,
    pub level: u8,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ClassPassive {
    pub name: String,
    pub target: String,
    #[serde(default)]
    pub requirements: Vec<Requirement>,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Action {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: ActionType,
    pub tags: Vec<String>,
    pub cost: String,
    pub target_range: String,
    pub check: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct CombatModifier {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Ultimate {
    pub name: String,
    pub description: String,
    pub charge: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Item {
    pub id: String,
    pub name: String,
    pub slot: GearSlot,
    pub damage_type: DamageType,
    #[serde(default)]
    pub stat_modifiers: BTreeMap<ModifierTarget, i32>,
    #[serde(default)]
    pub expertise_modifiers: Vec<ExpertiseModifier>,
    pub effect: String,
    pub stack_max: u16,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ExpertiseModifier {
    pub expertise: Expertise,
    pub value: i32,
    #[serde(default)]
    pub requirements: Vec<Requirement>,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Requirement {
    pub kind: RequirementKind,
    #[serde(default)]
    pub level: Option<u8>,
}

impl Requirement {
    pub fn is_valid(&self) -> bool {
        if self.kind.is_leveled() {
            self.level.is_some()
        } else {
            self.level.is_none()
        }
    }
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct GameData {
    pub enums: EnumsConfig,
    pub ancestries: Vec<Ancestry>,
    pub backgrounds: Vec<Background>,
    pub classes: Vec<Class>,
    pub items: Vec<Item>,
    pub expertise: Vec<ExpertiseDef>,
    pub languages: Vec<LanguageDef>,
    pub vision_types: Vec<VisionTypeDef>,
    pub requirements: BTreeMap<RequirementKind, String>,
    pub rules: Rules,
    pub character_template: CharacterV1,
}

impl GameData {
    pub fn load_embedded() -> Result<Self, ConfigError> {
        let game = Self {
            enums: parse_file("_enums.yaml")?,
            ancestries: parse_dir("ancestries")?,
            backgrounds: parse_dir("backgrounds")?,
            classes: parse_dir("classes")?,
            items: parse_dir("items")?,
            expertise: parse_file("expertise.yaml")?,
            languages: parse_file("languages.yaml")?,
            vision_types: parse_file("vision-types.yaml")?,
            requirements: parse_file("requirements.yaml")?,
            rules: Rules {
                base_stats: parse_file("rules/base-stats.yaml")?,
                creation_steps: parse_file("rules/creation-steps.yaml")?,
                hybrid_ancestries: parse_file("rules/hybrid-ancestries.yaml")?,
                party_levels: parse_file("rules/party-levels.yaml")?,
                stat_shapes: parse_file("rules/stat-shapes.yaml")?,
                class_progression: parse_file("rules/class-progression.yaml")?,
                combat: parse_file("rules/combat.yaml")?,
                inventory: parse_file("rules/inventory.yaml")?,
                starting_gear: parse_file("rules/starting-gear.yaml")?,
                status_effects: parse_file("rules/status-effects.yaml")?,
                economy: parse_file("rules/economy.yaml")?,
            },
            character_template: parse_file("_character_template.yaml")?,
        };
        game.validate().map_err(ConfigError::Validation)?;
        Ok(game)
    }

    pub fn ancestry(&self, id: &str) -> Option<&Ancestry> {
        self.ancestries.iter().find(|ancestry| ancestry.id == id)
    }

    pub fn background(&self, id: &str) -> Option<&Background> {
        self.backgrounds
            .iter()
            .find(|background| background.id == id)
    }

    pub fn class(&self, id: &str) -> Option<&Class> {
        self.classes.iter().find(|class| class.id == id)
    }

    pub fn item(&self, id: &str) -> Option<&Item> {
        self.items.iter().find(|item| item.id == id)
    }

    pub fn expertise(&self, id: Expertise) -> Option<&ExpertiseDef> {
        self.expertise.iter().find(|expertise| expertise.id == id)
    }

    pub fn classes_unlocked_by(&self, class_id: &str) -> Vec<&Class> {
        let starter = self
            .class(class_id)
            .map(|class| class.tier == ClassTier::Starter)
            .unwrap_or(false);
        self.classes
            .iter()
            .filter(|class| {
                class
                    .prerequisites
                    .iter()
                    .any(|prerequisite| match prerequisite.kind {
                        PrerequisiteKind::Class => prerequisite.class.as_deref() == Some(class_id),
                        PrerequisiteKind::AnyStarter => starter,
                    })
            })
            .collect()
    }

    fn validate(&self) -> Result<(), String> {
        let mut errors = Vec::new();

        let ancestry_ids = self
            .ancestries
            .iter()
            .map(|a| a.id.as_str())
            .collect::<BTreeSet<_>>();
        let background_ids = self
            .backgrounds
            .iter()
            .map(|b| b.id.as_str())
            .collect::<BTreeSet<_>>();
        let class_ids = self
            .classes
            .iter()
            .map(|c| c.id.as_str())
            .collect::<BTreeSet<_>>();
        let item_ids = self
            .items
            .iter()
            .map(|i| i.id.as_str())
            .collect::<BTreeSet<_>>();

        check_unique(
            "ancestry",
            self.ancestries.iter().map(|a| a.id.as_str()),
            &mut errors,
        );
        check_unique(
            "background",
            self.backgrounds.iter().map(|b| b.id.as_str()),
            &mut errors,
        );
        check_unique(
            "class",
            self.classes.iter().map(|c| c.id.as_str()),
            &mut errors,
        );
        check_unique(
            "item",
            self.items.iter().map(|i| i.id.as_str()),
            &mut errors,
        );
        check_unique(
            "expertise",
            self.expertise.iter().map(|e| e.id.as_str()),
            &mut errors,
        );
        check_unique(
            "language",
            self.languages.iter().map(|l| l.id.as_str()),
            &mut errors,
        );
        check_unique(
            "vision type",
            self.vision_types.iter().map(|v| v.id.as_str()),
            &mut errors,
        );

        if self.expertise.iter().any(|e| e.id == Expertise::Any) {
            errors.push("expertise.yaml must not define the 'any' sentinel".into());
        }

        let requirement_keys = self.requirements.keys().copied().collect::<BTreeSet<_>>();
        let enum_requirement_keys = self
            .enums
            .requirement_kinds
            .iter()
            .copied()
            .collect::<BTreeSet<_>>();
        if requirement_keys != enum_requirement_keys {
            errors.push(format!(
                "requirements.yaml keys do not match requirement-kinds: {:?}",
                requirement_keys.symmetric_difference(&enum_requirement_keys)
            ));
        }

        if !self
            .enums
            .main_stats
            .iter()
            .copied()
            .collect::<BTreeSet<_>>()
            .eq(&Stat::MAIN.iter().copied().collect())
        {
            errors.push("main-stats enum must match Stat::MAIN".into());
        }
        if !self
            .enums
            .bonus_stats
            .iter()
            .copied()
            .collect::<BTreeSet<_>>()
            .eq(&Stat::BONUS.iter().copied().collect())
        {
            errors.push("bonus-stats enum must match Stat::BONUS".into());
        }

        for ancestry in &self.ancestries {
            let owner = format!("ancestry {}", ancestry.id);
            if ancestry.languages.is_empty() {
                errors.push(format!("{owner}: must list at least one language"));
            }
            check_expertise_modifiers(&owner, &ancestry.expertise_modifiers, &mut errors);
            for passive in &ancestry.passives {
                check_requirements(
                    &format!("{owner} passive {}", passive.name),
                    &passive.requirements,
                    &mut errors,
                );
            }
        }

        for background in &self.backgrounds {
            let owner = format!("background {}", background.id);
            check_expertise_modifiers(&owner, &background.expertise_modifiers, &mut errors);
            for item in &background.starting_items {
                if !item_ids.contains(item.item.as_str()) {
                    errors.push(format!("{owner}: unknown starting item {}", item.item));
                }
                if item.quantity == 0 {
                    errors.push(format!(
                        "{owner}: starting item {} has zero quantity",
                        item.item
                    ));
                }
            }
            for passive in &background.passives {
                check_requirements(
                    &format!("{owner} passive {}", passive.name),
                    &passive.requirements,
                    &mut errors,
                );
            }
        }

        for class in &self.classes {
            let owner = format!("class {}", class.id);
            if class.roles.is_empty() {
                errors.push(format!("{owner}: must have at least one role"));
            }
            if class.x_start == 0 {
                errors.push(format!("{owner}: x-start must be greater than zero"));
            }
            check_expertise_modifiers(&owner, &class.expertise_modifiers, &mut errors);
            for slot in class.equipment.keys() {
                if !self.enums.equipment_slots.contains(slot) {
                    errors.push(format!("{owner}: unknown equipment slot {slot}"));
                }
            }
            for slot in [
                EquipmentSlot::MainHand,
                EquipmentSlot::Armor,
                EquipmentSlot::OffHand,
            ] {
                if !class.equipment.contains_key(&slot) {
                    errors.push(format!("{owner}: missing equipment slot {slot}"));
                }
            }
            if class.prerequisites.is_empty() && class.tier != ClassTier::Starter {
                errors.push(format!("{owner}: non-starter class has no prerequisites"));
            }
            for prerequisite in &class.prerequisites {
                match prerequisite.kind {
                    PrerequisiteKind::Class => {
                        let Some(class_id) = &prerequisite.class else {
                            errors.push(format!(
                                "{owner}: class prerequisite is missing its class id"
                            ));
                            continue;
                        };
                        if !class_ids.contains(class_id.as_str()) {
                            errors.push(format!("{owner}: unknown prerequisite class {class_id}"));
                        }
                    }
                    PrerequisiteKind::AnyStarter => {
                        if prerequisite.class.is_some() {
                            errors.push(format!(
                                "{owner}: any-starter prerequisite must not name a class"
                            ));
                        }
                        if class.tier != ClassTier::Tier1 {
                            errors.push(format!(
                                "{owner}: any-starter prerequisite must target a tier-1 class"
                            ));
                        }
                    }
                }
                if prerequisite.level == 0 {
                    errors.push(format!(
                        "{owner}: prerequisite level must be greater than zero"
                    ));
                }
            }
            check_unique(
                &format!("{owner} action"),
                class.actions.iter().map(|a| a.name.as_str()),
                &mut errors,
            );
            check_unique(
                &format!("{owner} passive"),
                class.passives.iter().map(|p| p.name.as_str()),
                &mut errors,
            );
            for action in &class.actions {
                if action.tags.is_empty() {
                    errors.push(format!("{owner}: action {} has no tags", action.name));
                }
            }
            for passive in &class.passives {
                check_requirements(
                    &format!("{owner} passive {}", passive.name),
                    &passive.requirements,
                    &mut errors,
                );
            }
            if class.ultimate.charge.is_empty() {
                errors.push(format!("{owner}: ultimate has no charge conditions"));
            }
        }

        for item in &self.items {
            if item.stack_max == 0 {
                errors.push(format!(
                    "item {}: stack-max must be greater than zero",
                    item.id
                ));
            }
            check_expertise_modifiers(
                &format!("item {}", item.id),
                &item.expertise_modifiers,
                &mut errors,
            );
        }

        self.validate_character_template(
            &ancestry_ids,
            &background_ids,
            &class_ids,
            &item_ids,
            &mut errors,
        );
        self.validate_rules(&class_ids, &item_ids, &mut errors);

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors.join("\n"))
        }
    }

    fn validate_character_template(
        &self,
        ancestry_ids: &BTreeSet<&str>,
        background_ids: &BTreeSet<&str>,
        class_ids: &BTreeSet<&str>,
        item_ids: &BTreeSet<&str>,
        errors: &mut Vec<String>,
    ) {
        let template = &self.character_template;
        if template.schema_version != SCHEMA_VERSION {
            errors.push(format!(
                "character template: schema-version {} is not supported",
                template.schema_version
            ));
        }
        if !class_ids.contains(template.main_class.as_str()) {
            errors.push(format!(
                "character template: unknown main class {}",
                template.main_class
            ));
        }
        if !ancestry_ids.contains(template.ancestry.primary.as_str()) {
            errors.push(format!(
                "character template: unknown ancestry {}",
                template.ancestry.primary
            ));
        }
        if let Some(hybrid) = &template.ancestry.hybrid {
            if !ancestry_ids.contains(hybrid.secondary.as_str()) {
                errors.push(format!(
                    "character template: unknown hybrid ancestry {}",
                    hybrid.secondary
                ));
            }
        }
        for background in &template.backgrounds {
            if !background_ids.contains(background.background.as_str()) {
                errors.push(format!(
                    "character template: unknown background {}",
                    background.background
                ));
                continue;
            }
            let Some(definition) = self.background(&background.background) else {
                continue;
            };
            for chosen in &background.chosen_abilities {
                if !definition.passives.iter().any(|p| p.name == chosen.ability) {
                    errors.push(format!(
                        "character template: unknown ability {} for background {}",
                        chosen.ability, background.background
                    ));
                }
            }
        }
        if !template
            .classes
            .iter()
            .any(|track| track.class == template.main_class && track.role == ClassRole::Main)
        {
            errors.push("character template: main class is not marked as main".into());
        }
        for track in &template.classes {
            if !class_ids.contains(track.class.as_str()) {
                errors.push(format!("character template: unknown class {}", track.class));
                continue;
            }
            let Some(class) = self.class(&track.class) else {
                continue;
            };
            if track.level > self.rules.class_progression.class_level_max {
                errors.push(format!(
                    "character template: class {} level exceeds class-level-max",
                    track.class
                ));
            }
            for action in &track.unlocked_actions {
                if !class.actions.iter().any(|a| &a.name == action) {
                    errors.push(format!(
                        "character template: unknown action {action} for class {}",
                        track.class
                    ));
                }
            }
            for passive in &track.unlocked_passives {
                if !class.passives.iter().any(|p| &p.name == passive) {
                    errors.push(format!(
                        "character template: unknown passive {passive} for class {}",
                        track.class
                    ));
                }
            }
        }
        for (stat, pips) in &template.stat_pips {
            if !Stat::MAIN.contains(stat) {
                errors.push(format!(
                    "character template: stat pip on non-main stat {stat}"
                ));
            }
            if *pips > self.rules.party_levels.stat_pips.max_per_main_stat {
                errors.push(format!("character template: too many stat pips for {stat}"));
            }
        }
        for entry in &template.inventory {
            if entry.quantity == 0 {
                errors.push("character template: inventory entry has zero quantity".into());
            }
            match (&entry.item, &entry.custom_name) {
                (Some(item), _) if !item_ids.contains(item.as_str()) => {
                    errors.push(format!("character template: unknown inventory item {item}"));
                }
                (None, None) => {
                    errors.push(
                        "character template: inventory entry needs an item or custom name".into(),
                    );
                }
                _ => {}
            }
        }
        for status in &template.statuses {
            if status.id.is_empty() {
                errors.push("character template: status id must not be empty".into());
            }
        }
    }

    fn validate_rules(
        &self,
        class_ids: &BTreeSet<&str>,
        item_ids: &BTreeSet<&str>,
        errors: &mut Vec<String>,
    ) {
        let rules = &self.rules;
        if rules.inventory.inventory_max == 0 || rules.inventory.stack_max == 0 {
            errors.push("inventory rules: inventory-max and stack-max must be positive".into());
        }
        if rules.class_progression.class_level_max == 0 {
            errors.push("class progression: class-level-max must be positive".into());
        }
        for step in &rules.creation_steps.steps {
            for class in &step.classes {
                if !class_ids.contains(class.as_str()) {
                    errors.push(format!("creation step {}: unknown class {class}", step.id));
                }
            }
            if step.status == Some(DataStatus::Placeholder) && step.fallback.is_none() {
                errors.push(format!(
                    "creation step {}: placeholder has no fallback",
                    step.id
                ));
            }
        }
        for (slot, rule) in &rules.party_levels.passive_slots {
            if rule.base == 0 {
                errors.push(format!("party levels: passive slot {slot} base is zero"));
            }
        }
        for bundle in &rules.starting_gear.bundles {
            for item in &bundle.items {
                if !item_ids.contains(item.as_str()) {
                    errors.push(format!("starting gear {}: unknown item {item}", bundle.id));
                }
            }
        }
        check_unique(
            "status effect",
            rules.status_effects.effects.iter().map(|e| e.id.as_str()),
            errors,
        );
        if rules.status_effects.effects.is_empty()
            && rules.status_effects.status != DataStatus::Placeholder
        {
            errors.push("status effects: empty catalog must be marked placeholder".into());
        }
    }
}

fn check_unique<'a>(label: &str, ids: impl Iterator<Item = &'a str>, errors: &mut Vec<String>) {
    let mut seen = BTreeSet::new();
    for id in ids {
        if !seen.insert(id) {
            errors.push(format!("duplicate {label} id: {id}"));
        }
    }
}

fn check_requirements(owner: &str, requirements: &[Requirement], errors: &mut Vec<String>) {
    for requirement in requirements {
        if !requirement.is_valid() {
            errors.push(format!("{owner}: malformed requirement {requirement:?}"));
        }
    }
}

fn check_expertise_modifiers(
    owner: &str,
    modifiers: &[ExpertiseModifier],
    errors: &mut Vec<String>,
) {
    for modifier in modifiers {
        if modifier.value == 0 {
            errors.push(format!(
                "{owner}: zero-value expertise modifier for {}",
                modifier.expertise
            ));
        }
        check_requirements(owner, &modifier.requirements, errors);
    }
}

fn parse_file<T: DeserializeOwned>(path: &str) -> Result<T, ConfigError> {
    let source = read_file(path)?;
    serde_yaml::from_str(source).map_err(|source| ConfigError::Parse {
        path: path.to_string(),
        source,
    })
}

fn parse_dir<T: DeserializeOwned>(dir: &str) -> Result<Vec<T>, ConfigError> {
    let dir = CONFIG_DIR
        .get_dir(dir)
        .ok_or_else(|| ConfigError::MissingFile(dir.to_string()))?;
    let mut files = dir
        .files()
        .filter(|file| file.path().extension().is_some_and(|ext| ext == "yaml"))
        .collect::<Vec<_>>();
    files.sort_by(|left, right| left.path().cmp(right.path()));
    files
        .into_iter()
        .map(|file| {
            let path = file.path().to_string_lossy().to_string();
            let source = file
                .contents_utf8()
                .ok_or_else(|| ConfigError::InvalidUtf8(path.clone()))?;
            serde_yaml::from_str(source).map_err(|source| ConfigError::Parse { path, source })
        })
        .collect()
}

fn read_file(path: &str) -> Result<&'static str, ConfigError> {
    let file = CONFIG_DIR
        .get_file(path)
        .ok_or_else(|| ConfigError::MissingFile(path.to_string()))?;
    file.contents_utf8()
        .ok_or_else(|| ConfigError::InvalidUtf8(path.to_string()))
}
