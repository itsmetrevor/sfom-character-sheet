use std::collections::BTreeMap;

use som_v3::domain::character::{
    AncestrySelection, CharacterV1, ClassTrack, Currency, Equipment, Overrides, PassiveSlots,
    Resources,
};
use som_v3::domain::derive_character;
use som_v3::domain::enums::{ClassRole, Expertise, Stat};
use som_v3::domain::GameData;

fn game() -> GameData {
    GameData::load_from_dir(concat!(env!("CARGO_MANIFEST_DIR"), "/public/config"))
        .expect("runtime config should load")
}

fn blank_character(main_class: &str) -> CharacterV1 {
    CharacterV1 {
        schema_version: 1,
        id: "calc-test".into(),
        name: "Calc Test".into(),
        notes: String::new(),
        main_class: main_class.into(),
        ancestry: AncestrySelection {
            primary: "enatt".into(),
            hybrid: None,
        },
        backgrounds: Vec::new(),
        classes: vec![ClassTrack {
            class: main_class.into(),
            role: ClassRole::Main,
            level: 1,
            x: 1,
            unlocked_actions: Vec::new(),
            unlocked_passives: Vec::new(),
        }],
        party_level: 0,
        stat_pips: BTreeMap::new(),
        resources: Resources {
            current_hp: 0,
            energy: 0,
            exhaustion: 0,
        },
        statuses: Vec::new(),
        equipment: Equipment {
            main_hand: None,
            armor: None,
            off_hand: None,
            accessories: Vec::new(),
        },
        inventory: Vec::new(),
        currency: Currency { gold: 0, shards: 0 },
        passive_slots: PassiveSlots {
            non_combat: Vec::new(),
            combat: Vec::new(),
        },
        overrides: Overrides::default(),
    }
}

#[test]
fn derives_fixture_scholar_stats() {
    let game = game();
    let derived = derive_character(&game, &game.character_template);

    assert_eq!(derived.max_hp, 39);
    assert_eq!(derived.main[&Stat::Str], 1);
    assert_eq!(derived.main[&Stat::Dex], 1);
    assert_eq!(derived.main[&Stat::Con], 2);
    assert_eq!(derived.main[&Stat::Mnd], 5);
    assert_eq!(derived.main[&Stat::Int], 2);
    assert_eq!(derived.main[&Stat::Luk], 1);

    assert_eq!(derived.bonus[&Stat::Jmp], 1);
    assert_eq!(derived.bonus[&Stat::Agl], 5);
    assert_eq!(derived.bonus[&Stat::Def], 13);
    assert_eq!(derived.bonus[&Stat::Res], 14);
    assert_eq!(derived.bonus[&Stat::Nrg], 1);
    assert_eq!(derived.bonus[&Stat::For], 2);

    assert_eq!(derived.expertise[&Expertise::Crafting], 2);
    assert_eq!(derived.expertise[&Expertise::Knowledge], 1);
    assert_eq!(derived.expertise[&Expertise::Perception], 1);
    assert_eq!(derived.expertise[&Expertise::Resistance], 2);
    assert_eq!(derived.expertise[&Expertise::Strength], 0);
}

#[test]
fn double_con_and_equipment_are_applied() {
    let game = game();
    let mut character = blank_character("gladiator");
    character.equipment.armor = Some("bronze-armor".into());

    let derived = derive_character(&game, &character);

    assert_eq!(derived.main[&Stat::Con], 4);
    assert_eq!(derived.max_hp, 52);
    assert_eq!(derived.bonus[&Stat::Def], 16);
    assert_eq!(derived.bonus[&Stat::Res], 12);
    assert_eq!(derived.bonus[&Stat::For], 2);
    assert_eq!(derived.expertise[&Expertise::Resistance], 2);
    assert!(derived.notes.iter().any(|note| note.contains("double-con")));
}

#[test]
fn manual_max_hp_override_wins() {
    let game = game();
    let mut character = blank_character("gladiator");
    character.overrides.max_hp = Some(99);

    let derived = derive_character(&game, &character);

    assert_eq!(derived.max_hp, 99);
    assert!(derived
        .notes
        .iter()
        .any(|note| note.contains("manual override")));
}

#[test]
fn class_expertise_unlocks_respect_class_level() {
    let game = game();
    let mut character = blank_character("gladiator");
    character.classes[0].level = 4;

    let derived = derive_character(&game, &character);

    assert_eq!(derived.expertise[&Expertise::Constitution], 1);
    assert_eq!(derived.expertise[&Expertise::ThrowCatch], 1);
}
