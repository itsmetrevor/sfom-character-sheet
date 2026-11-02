use std::collections::BTreeSet;

use som_v3::domain::character::CharacterV1;
use som_v3::domain::enums::{
    ClassTier, DataStatus, EquipmentSlot, Expertise, PrerequisiteKind, RequirementKind, Stat,
};
use som_v3::domain::GameData;

fn game() -> GameData {
    GameData::load_embedded().expect("embedded config should load and validate")
}

#[test]
fn embedded_config_loads_expected_entities() {
    let game = game();

    assert_eq!(game.ancestries.len(), 12);
    assert_eq!(game.backgrounds.len(), 30);
    assert_eq!(game.classes.len(), 30);
    assert_eq!(game.items.len(), 35);
    assert_eq!(game.expertise.len(), 18);
    assert_eq!(game.languages.len(), 12);
    assert_eq!(game.vision_types.len(), 4);
    assert!(game.classes.iter().all(|class| class.id != "shard-bearer"));
    assert!(game
        .expertise
        .iter()
        .all(|entry| entry.id != Expertise::Any));
}

#[test]
fn tiers_are_balanced_and_starters_are_connected() {
    let game = game();
    let starters = game
        .classes
        .iter()
        .filter(|class| class.tier == ClassTier::Starter)
        .count();
    let tier_one = game
        .classes
        .iter()
        .filter(|class| class.tier == ClassTier::Tier1)
        .count();

    assert_eq!(starters, 6);
    assert_eq!(tier_one, 6);

    let tier_one_ids = game
        .classes
        .iter()
        .filter(|class| class.tier == ClassTier::Tier1)
        .map(|class| class.id.as_str())
        .collect::<BTreeSet<_>>();

    for starter in game
        .classes
        .iter()
        .filter(|class| class.tier == ClassTier::Starter)
    {
        let unlocked = game
            .classes_unlocked_by(&starter.id)
            .into_iter()
            .map(|class| class.id.as_str())
            .collect::<BTreeSet<_>>();
        assert!(
            tier_one_ids.is_subset(&unlocked),
            "{} should unlock every tier-1 class",
            starter.id
        );
    }
}

#[test]
fn classes_have_required_structure() {
    let game = game();

    for class in &game.classes {
        for slot in [
            EquipmentSlot::MainHand,
            EquipmentSlot::Armor,
            EquipmentSlot::OffHand,
        ] {
            assert!(
                class.equipment.contains_key(&slot),
                "{} is missing equipment slot {slot}",
                class.id
            );
        }
        assert!(!class.actions.is_empty(), "{} has no actions", class.id);
        assert!(!class.passives.is_empty(), "{} has no passives", class.id);
        assert!(
            class.actions.iter().all(|action| !action.tags.is_empty()),
            "{} has an untagged action",
            class.id
        );

        for prerequisite in &class.prerequisites {
            match prerequisite.kind {
                PrerequisiteKind::Class => {
                    let id = prerequisite.class.as_deref().expect("class prerequisite");
                    assert!(
                        game.class(id).is_some(),
                        "{} references unknown {id}",
                        class.id
                    );
                }
                PrerequisiteKind::AnyStarter => {
                    assert_eq!(class.tier, ClassTier::Tier1);
                }
            }
        }
    }
}

#[test]
fn rules_and_enums_are_wired() {
    let game = game();

    assert_eq!(game.rules.class_progression.class_level_max, 20);
    assert_eq!(
        game.rules.party_levels.background_ability_tiers,
        vec![0, 3, 6, 9]
    );
    assert_eq!(game.rules.party_levels.stat_pips.max_per_main_stat, 2);
    assert_eq!(game.rules.combat.ultimate.charge_slots, 10);
    assert_eq!(game.rules.inventory.inventory_max, 12);
    assert_eq!(game.rules.inventory.stack_max, 5);
    assert_eq!(game.rules.starting_gear.status, DataStatus::Placeholder);
    assert!(game.rules.starting_gear.bundles.is_empty());
    assert_eq!(game.rules.status_effects.status, DataStatus::Placeholder);
    assert!(game.rules.status_effects.effects.is_empty());

    assert_eq!(
        game.enums
            .requirement_kinds
            .iter()
            .copied()
            .collect::<BTreeSet<_>>(),
        game.requirements.keys().copied().collect::<BTreeSet<_>>()
    );
    assert!(game
        .enums
        .requirement_kinds
        .contains(&RequirementKind::ClassLevel));
    assert!(game
        .enums
        .requirement_kinds
        .contains(&RequirementKind::PartyLevel));
}

#[test]
fn template_is_valid_and_round_trips() {
    let game = game();
    let template = &game.character_template;

    assert_eq!(
        template.schema_version,
        som_v3::domain::character::SCHEMA_VERSION
    );
    assert_eq!(template.name, "Jimmy John");
    assert_eq!(template.main_class, "scholar");
    assert_eq!(
        template
            .stat_pips
            .get(&Stat::Mnd)
            .copied()
            .unwrap_or_default(),
        2
    );

    let serialized = serde_yaml::to_string(template).expect("template should serialize");
    let parsed: CharacterV1 =
        serde_yaml::from_str(&serialized).expect("template should deserialize");
    assert_eq!(&parsed, template);
}

#[test]
fn template_references_existing_content() {
    let game = game();
    let template = &game.character_template;

    assert!(game.ancestry(&template.ancestry.primary).is_some());
    for background in &template.backgrounds {
        let definition = game
            .background(&background.background)
            .expect("template background should exist");
        for chosen in &background.chosen_abilities {
            assert!(definition
                .passives
                .iter()
                .any(|passive| passive.name == chosen.ability));
        }
    }
    for track in &template.classes {
        let definition = game
            .class(&track.class)
            .expect("template class should exist");
        for action in &track.unlocked_actions {
            assert!(definition
                .actions
                .iter()
                .any(|candidate| &candidate.name == action));
        }
        for passive in &track.unlocked_passives {
            assert!(definition
                .passives
                .iter()
                .any(|candidate| &candidate.name == passive));
        }
    }
    for entry in &template.inventory {
        if let Some(item) = &entry.item {
            assert!(
                game.item(item).is_some(),
                "template references unknown item {item}"
            );
        }
    }
}
