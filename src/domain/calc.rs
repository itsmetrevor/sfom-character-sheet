use std::collections::BTreeMap;

use super::character::CharacterV1;
use super::config::{ExpertiseModifier, GameData, Requirement};
use super::enums::{ClassRole, Expertise, MaxHpMode, ModifierTarget, RequirementKind, Stat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DerivedStats {
    pub max_hp: i32,
    pub main: BTreeMap<Stat, i32>,
    pub bonus: BTreeMap<Stat, i32>,
    pub expertise: BTreeMap<Expertise, i32>,
    pub notes: Vec<String>,
}

pub fn derive_character(game: &GameData, character: &CharacterV1) -> DerivedStats {
    let mut main = BTreeMap::new();
    let mut bonus = BTreeMap::new();
    let mut notes = Vec::new();

    for stat in Stat::MAIN {
        let value = game
            .rules
            .base_stats
            .base_stats
            .get(&modifier_target(stat))
            .copied()
            .unwrap_or_default();
        main.insert(stat, value);
    }
    for stat in Stat::BONUS {
        let value = game
            .rules
            .base_stats
            .base_stats
            .get(&modifier_target(stat))
            .copied()
            .unwrap_or_default();
        bonus.insert(stat, value);
    }

    let mut max_hp = game
        .rules
        .base_stats
        .base_stats
        .get(&ModifierTarget::MaxHp)
        .copied()
        .unwrap_or_default();

    if let Some(ancestry) = game.ancestry(&character.ancestry.primary) {
        apply_modifiers(&ancestry.stat_modifiers, &mut main, &mut bonus, &mut max_hp);
    }

    let main_class = game.class(&character.main_class);
    let main_track = character
        .classes
        .iter()
        .find(|track| track.role == ClassRole::Main)
        .or_else(|| {
            character
                .classes
                .iter()
                .find(|track| track.class == character.main_class)
        });

    if let Some(class) = main_class {
        apply_modifiers(&class.stat_modifiers, &mut main, &mut bonus, &mut max_hp);
    } else {
        notes.push(format!(
            "Main class '{}' was not found.",
            character.main_class
        ));
    }

    for stat in Stat::MAIN {
        let pips = character.stat_pips.get(&stat).copied().unwrap_or_default() as i32;
        if pips != 0 {
            *main.entry(stat).or_default() += pips;
        }
    }

    let equipped = character
        .equipment
        .main_hand
        .iter()
        .chain(character.equipment.armor.iter())
        .chain(character.equipment.off_hand.iter())
        .chain(character.equipment.accessories.iter());
    for item_id in equipped {
        if let Some(item) = game.item(item_id) {
            apply_modifiers(&item.stat_modifiers, &mut main, &mut bonus, &mut max_hp);
        }
    }

    for graft in &game.rules.base_stats.bonus_from_main {
        let source = main.get(&graft.stat).copied().unwrap_or_default();
        if graft.per > 0 {
            *bonus.entry(graft.grants.stat).or_default() +=
                source / i32::from(graft.per) * graft.grants.value;
        }
    }

    if let Some(class) = main_class {
        if class.max_hp_mode == MaxHpMode::DoubleCon {
            let con = main.get(&Stat::Con).copied().unwrap_or_default();
            max_hp += con * 2;
            notes.push(
                "Max HP includes 2×CON from double-con mode; this rule is provisional.".to_string(),
            );
        }
    }

    if let Some(override_hp) = character.overrides.max_hp {
        max_hp = override_hp;
        notes.push("Max HP uses the manual override.".to_string());
    }

    let mut expertise = game
        .expertise
        .iter()
        .filter(|entry| entry.id != Expertise::Any)
        .map(|entry| (entry.id, 0))
        .collect::<BTreeMap<_, _>>();

    if let Some(ancestry) = game.ancestry(&character.ancestry.primary) {
        apply_expertise_modifiers(
            &ancestry.expertise_modifiers,
            None,
            &mut expertise,
            &mut notes,
        );
    }

    for selection in &character.backgrounds {
        if let Some(background) = game.background(&selection.background) {
            apply_expertise_modifiers(
                &background.expertise_modifiers,
                None,
                &mut expertise,
                &mut notes,
            );
        }
    }

    if let Some(class) = main_class {
        let class_level = main_track.map(|track| track.level);
        apply_expertise_modifiers(
            &class.expertise_modifiers,
            class_level,
            &mut expertise,
            &mut notes,
        );
    }

    let equipped = character
        .equipment
        .main_hand
        .iter()
        .chain(character.equipment.armor.iter())
        .chain(character.equipment.off_hand.iter())
        .chain(character.equipment.accessories.iter());
    for item_id in equipped {
        if let Some(item) = game.item(item_id) {
            apply_expertise_modifiers(&item.expertise_modifiers, None, &mut expertise, &mut notes);
        }
    }

    notes.push("Passive and ability effects are not applied to derived stats in v1.".to_string());

    DerivedStats {
        max_hp,
        main,
        bonus,
        expertise,
        notes,
    }
}

fn modifier_target(stat: Stat) -> ModifierTarget {
    match stat {
        Stat::Str => ModifierTarget::Str,
        Stat::Dex => ModifierTarget::Dex,
        Stat::Con => ModifierTarget::Con,
        Stat::Mnd => ModifierTarget::Mnd,
        Stat::Int => ModifierTarget::Int,
        Stat::Luk => ModifierTarget::Luk,
        Stat::Jmp => ModifierTarget::Jmp,
        Stat::Agl => ModifierTarget::Agl,
        Stat::Def => ModifierTarget::Def,
        Stat::Res => ModifierTarget::Res,
        Stat::Nrg => ModifierTarget::Nrg,
        Stat::For => ModifierTarget::For,
    }
}

fn apply_modifiers(
    modifiers: &BTreeMap<ModifierTarget, i32>,
    main: &mut BTreeMap<Stat, i32>,
    bonus: &mut BTreeMap<Stat, i32>,
    max_hp: &mut i32,
) {
    for (target, value) in modifiers {
        match target {
            ModifierTarget::MaxHp => *max_hp += value,
            _ => {
                if let Some(stat) = target.as_stat() {
                    if Stat::MAIN.contains(&stat) {
                        *main.entry(stat).or_default() += value;
                    } else if Stat::BONUS.contains(&stat) {
                        *bonus.entry(stat).or_default() += value;
                    }
                }
            }
        }
    }
}

fn apply_expertise_modifiers(
    modifiers: &[ExpertiseModifier],
    class_level: Option<u8>,
    expertise: &mut BTreeMap<Expertise, i32>,
    notes: &mut Vec<String>,
) {
    for modifier in modifiers {
        if !requirements_met(&modifier.requirements, class_level) {
            continue;
        }
        if modifier.expertise == Expertise::Any {
            notes.push(format!(
                "Any Expertise +{} is not distributed automatically.",
                modifier.value
            ));
        } else {
            *expertise.entry(modifier.expertise).or_default() += modifier.value;
        }
    }
}

fn requirements_met(requirements: &[Requirement], class_level: Option<u8>) -> bool {
    requirements
        .iter()
        .all(|requirement| match requirement.kind {
            RequirementKind::Constant => true,
            RequirementKind::ClassLevel => class_level
                .zip(requirement.level)
                .is_some_and(|(level, required)| level >= required),
            _ => false,
        })
}
