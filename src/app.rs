use std::collections::BTreeMap;

use dioxus::prelude::*;

use crate::editor::CharacterEditorScreen;
use crate::settings::SettingsScreen;
use som_v3::domain::character::{
    AncestrySelection, BackgroundSelection, CharacterV1, ChosenAbility, ClassTrack, Currency,
    Equipment, InventoryEntry, Overrides, PassiveSlots, Resources,
};
use som_v3::domain::config::{Action, Ancestry, Background, Class, GameData};
use som_v3::domain::enums::{
    ActionType, ClassRole, ClassTier, ModifierTarget, PassiveSlot, RequirementKind, Stat,
};
use som_v3::domain::{derive_character, AppStore, CharacterStore};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Screen {
    MainMenu,
    ChooseCharacter,
    CreateCharacter,
    CharacterMenu,
    CharacterSheet,
    Classes,
    Expertise,
    Abilities,
    EditCharacter,
    Options,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CreateStep {
    Ancestry,
    Background,
    Info,
    Class,
    Review,
}

#[component]
pub fn App() -> Element {
    let mut loaded = use_signal(|| None::<Result<GameData, String>>);
    use_future(move || async move {
        let result = GameData::load_runtime()
            .await
            .map_err(|error| error.to_string());
        loaded.set(Some(result));
    });
    let _ = use_context_provider(|| loaded);

    rsx! {
        Shell {}
    }
}

#[component]
fn Shell() -> Element {
    let loaded = use_context::<Signal<Option<Result<GameData, String>>>>();
    let store = use_hook(AppStore::default);
    let initial = store.list();
    let initial_characters = initial
        .as_ref()
        .map(|list| list.to_vec())
        .unwrap_or_default();
    let initial_error = initial.err().map(|error| error.to_string());

    let characters = use_signal(|| initial_characters);
    let notice = use_signal(|| initial_error);
    let mut screen = use_signal(|| Screen::MainMenu);
    let selected = use_signal(|| None::<String>);
    let mut menu_open = use_signal(|| false);

    let notice_text = notice();
    let content = match loaded() {
        None => rsx! {
            section { class: "panel loading-panel",
                h2 { "Loading game data..." }
                p { class: "muted", "Reading runtime YAML from config/." }
            }
        },
        Some(Ok(game)) => {
            render_screen(screen(), &game, store, characters, selected, screen, notice)
        }
        Some(Err(error)) => rsx! {
            section { class: "panel error-panel",
                h2 { "Config failed to load" }
                pre { class: "error-text", "{error}" }
            }
        },
    };

    rsx! {
        div { class: "app-shell",
            {render_header(screen(), screen, menu_open)}
            if menu_open() {
                div { class: "menu-overlay",
                    div { class: "menu-backdrop", onclick: move |_| menu_open.set(false) }
                    nav { class: "menu-drawer", aria_label: "Main navigation",
                        button { onclick: move |_| { screen.set(Screen::MainMenu); menu_open.set(false); }, "MAIN MENU" }
                        button { onclick: move |_| { screen.set(Screen::ChooseCharacter); menu_open.set(false); }, "CHOOSE CHARACTER" }
                        button { onclick: move |_| { screen.set(Screen::CreateCharacter); menu_open.set(false); }, "CREATE CHARACTER" }
                        button { onclick: move |_| { screen.set(Screen::Options); menu_open.set(false); }, "OPTIONS" }
                        button { class: "drawer-close", onclick: move |_| menu_open.set(false), "CLOSE" }
                    }
                }
            }
            main { class: "content",
                if let Some(message) = notice_text {
                    div { class: "notice", role: "status", "{message}" }
                }
                {content}
            }
            footer { class: "footer",
                "A character companion for Shard - Fragments of Memory."
            }
        }
    }
}

fn render_header(screen: Screen, mut nav: Signal<Screen>, mut menu_open: Signal<bool>) -> Element {
    let (title, back) = header_info(screen);
    rsx! {
        header { class: "app-header",
            div { class: "header-slot",
                if let Some(back) = back {
                    button {
                        class: "icon-button",
                        aria_label: "Back",
                        onclick: move |_| nav.set(back),
                        span { class: "back-arrow", "←" }
                    }
                }
            }
            h1 { class: "header-title", "{title}" }
            div { class: "header-slot right",
                button {
                    class: "icon-button menu-toggle",
                    aria_label: "Menu",
                    onclick: move |_| menu_open.set(!menu_open()),
                    span { class: "hamburger-line" }
                    span { class: "hamburger-line" }
                    span { class: "hamburger-line" }
                }
            }
        }
    }
}

fn header_info(screen: Screen) -> (&'static str, Option<Screen>) {
    match screen {
        Screen::MainMenu => ("MAIN MENU", None),
        Screen::ChooseCharacter => ("CHOOSE CHARACTER", Some(Screen::MainMenu)),
        Screen::CreateCharacter => ("CREATE CHARACTER", Some(Screen::MainMenu)),
        Screen::CharacterMenu => ("CHARACTER MENU", Some(Screen::ChooseCharacter)),
        Screen::CharacterSheet => ("CHARACTER SHEET", Some(Screen::CharacterMenu)),
        Screen::Classes => ("CLASSES", Some(Screen::CharacterMenu)),
        Screen::Expertise => ("EXPERTISE", Some(Screen::CharacterMenu)),
        Screen::Abilities => ("ABILITIES", Some(Screen::CharacterMenu)),
        Screen::EditCharacter => ("EDIT CHARACTER", Some(Screen::CharacterMenu)),
        Screen::Options => ("OPTIONS", Some(Screen::MainMenu)),
    }
}

fn render_screen(
    screen: Screen,
    game: &GameData,
    store: AppStore,
    characters: Signal<Vec<CharacterV1>>,
    mut selected: Signal<Option<String>>,
    mut nav: Signal<Screen>,
    notice: Signal<Option<String>>,
) -> Element {
    match screen {
        Screen::MainMenu => render_main_menu(nav),
        Screen::ChooseCharacter => rsx! {
            ChooseCharacterScreen {
                game: game.clone(),
                characters: characters(),
                on_open: move |id| {
                    selected.set(Some(id));
                    nav.set(Screen::CharacterMenu);
                },
                on_new: move |_| nav.set(Screen::CreateCharacter),
            }
        },
        Screen::CreateCharacter => {
            let store = store.clone();
            let store_for_save = store.clone();
            rsx! {
                CreateCharacterScreen {
                    game: game.clone(),
                    store,
                    on_saved: move |id| {
                        refresh(&store_for_save, characters, notice);
                        selected.set(Some(id));
                        nav.set(Screen::CharacterMenu);
                    },
                }
            }
        }
        Screen::Options => {
            let store = store.clone();
            let store_for_refresh = store.clone();
            rsx! {
                SettingsScreen {
                    game: game.clone(),
                    store,
                    on_imported: move |_| refresh(&store_for_refresh, characters, notice),
                }
            }
        }
        Screen::CharacterMenu
        | Screen::CharacterSheet
        | Screen::Classes
        | Screen::Expertise
        | Screen::Abilities
        | Screen::EditCharacter => {
            let Some(character) = selected().and_then(|id| {
                characters()
                    .into_iter()
                    .find(|character| character.id == id)
            }) else {
                return rsx! {
                    section { class: "panel empty-state",
                        h2 { "No character selected" }
                        p { class: "muted", "Choose or create a character first." }
                        button {
                            class: "primary",
                            onclick: move |_| nav.set(Screen::ChooseCharacter),
                            "CHOOSE CHARACTER"
                        }
                    }
                };
            };

            match screen {
                Screen::CharacterMenu => {
                    let store_for_change = store.clone();
                    let store_for_delete = store.clone();
                    rsx! {
                        CharacterMenuScreen {
                            game: game.clone(),
                            character,
                            on_change: move |updated| {
                                update_character(&store_for_change, updated, characters, notice);
                            },
                            on_nav: move |target| nav.set(target),
                            on_edit: move |_| nav.set(Screen::EditCharacter),
                            on_delete: move |id| {
                                delete_character(&store_for_delete, id, characters, selected, nav, notice);
                            },
                        }
                    }
                }
                Screen::CharacterSheet => {
                    let store_for_change = store.clone();
                    let store_for_delete = store.clone();
                    rsx! {
                        CharacterSheetScreen {
                            game: game.clone(),
                            character,
                            on_change: move |updated| {
                                update_character(&store_for_change, updated, characters, notice);
                            },
                            on_edit: move |_| nav.set(Screen::EditCharacter),
                            on_delete: move |id| {
                                delete_character(&store_for_delete, id, characters, selected, nav, notice);
                            },
                        }
                    }
                }
                Screen::Classes => {
                    let store_for_change = store.clone();
                    rsx! {
                        ClassesScreen {
                            game: game.clone(),
                            character,
                            on_change: move |updated| {
                                update_character(&store_for_change, updated, characters, notice);
                            },
                            on_edit: move |_| nav.set(Screen::EditCharacter),
                        }
                    }
                }
                Screen::Expertise => {
                    let store_for_change = store.clone();
                    rsx! {
                        ExpertiseScreen {
                            game: game.clone(),
                            character,
                            on_change: move |updated| {
                                update_character(&store_for_change, updated, characters, notice);
                            },
                            on_edit: move |_| nav.set(Screen::EditCharacter),
                        }
                    }
                }
                Screen::Abilities => {
                    let store_for_change = store.clone();
                    rsx! {
                        AbilitiesScreen {
                            game: game.clone(),
                            character,
                            on_change: move |updated| {
                                update_character(&store_for_change, updated, characters, notice);
                            },
                            on_edit: move |_| nav.set(Screen::EditCharacter),
                        }
                    }
                }
                Screen::EditCharacter => {
                    let editor_store = store.clone();
                    let store_for_save = store.clone();
                    rsx! {
                        CharacterEditorScreen {
                            game: game.clone(),
                            character,
                            store: editor_store,
                            on_saved: move |id| {
                                refresh(&store_for_save, characters, notice);
                                selected.set(Some(id));
                                nav.set(Screen::CharacterSheet);
                            },
                            on_cancel: move |_| nav.set(Screen::CharacterMenu),
                        }
                    }
                }
                _ => unreachable!(),
            }
        }
    }
}

fn render_main_menu(mut nav: Signal<Screen>) -> Element {
    rsx! {
        section { class: "main-menu",
            div { class: "logo",
                div { class: "logo-crystal" }
                div { class: "logo-word", "SHARD" }
                div { class: "logo-sub", "FRAGMENTS OF MEMORY" }
            }
            div { class: "menu-stack",
                button {
                    class: "menu-action strong",
                    onclick: move |_| nav.set(Screen::CreateCharacter),
                    "CREATE CHARACTER"
                }
                button {
                    class: "menu-action strong",
                    onclick: move |_| nav.set(Screen::ChooseCharacter),
                    "CHOOSE CHARACTER"
                }
                button {
                    class: "menu-action quiet",
                    onclick: move |_| nav.set(Screen::Options),
                    "OPTIONS"
                }
            }
        }
    }
}

#[component]
fn ChooseCharacterScreen(
    game: GameData,
    characters: Vec<CharacterV1>,
    on_open: EventHandler<String>,
    on_new: EventHandler<()>,
) -> Element {
    rsx! {
        section { class: "character-list",
            if characters.is_empty() {
                div { class: "empty-box",
                    p { "NO CHARACTERS YET" }
                    p { class: "muted", "Create a Fragment to begin." }
                }
            } else {
                for character in &characters {
                    {
                        let id = character.id.clone();
                        rsx! {
                            button {
                                key: "{character.id}",
                                class: "character-card",
                                onclick: move |_| on_open.call(id.clone()),
                                div { class: "pic-box", "PIC" }
                                div { class: "character-card-info",
                                    strong { "{character.name}" }
                                    span { "{ancestry_label(&game, character)} / {background_label(&game, character)}" }
                                    span { "{class_label(&game, character)} / {subclass_label(&game, character)}" }
                                }
                            }
                        }
                    }
                }
            }
        }
        button {
            class: "menu-action quiet",
            onclick: move |_| on_new.call(()),
            "NEW CHARACTER"
        }
    }
}

#[component]
fn VitalsHeader(
    character: CharacterV1,
    max_hp: i32,
    on_change: EventHandler<CharacterV1>,
    on_edit: EventHandler<()>,
) -> Element {
    let hp = character.resources.current_hp;
    let energy = character.resources.energy;
    let exhaustion = character.resources.exhaustion;
    let hp_down = character.clone();
    let hp_up = character.clone();
    let energy_down = character.clone();
    let energy_up = character.clone();
    let exhaustion_down = character.clone();
    let exhaustion_up = character.clone();

    rsx! {
        section { class: "vitals",
            div { class: "vitals-row",
                div { class: "vital-card health",
                    span { class: "vital-label", "HEALTH POINTS" }
                    div { class: "vital-value", "{hp} / {max_hp}" }
                }
                div { class: "vital-card",
                    span { class: "vital-label", "ENERGY" }
                    div { class: "vital-value", "{energy}" }
                }
                div { class: "vital-card",
                    span { class: "vital-label", "EXHAUSTION" }
                    div { class: "vital-value", "{exhaustion}" }
                }
            }
            div { class: "vitals-controls",
                div { class: "vital-control",
                    div { class: "source-pills",
                        span { class: "source-pill", "P" }
                        span { class: "source-pill", "C" }
                        span { class: "source-pill", "T" }
                    }
                    div { class: "stepper",
                        button {
                            onclick: move |_| {
                                let mut next = hp_down.clone();
                                next.resources.current_hp = (next.resources.current_hp - 1).max(0);
                                on_change.call(next);
                            },
                            "−"
                        }
                        button {
                            onclick: move |_| {
                                let mut next = hp_up.clone();
                                next.resources.current_hp = (next.resources.current_hp + 1).min(max_hp);
                                on_change.call(next);
                            },
                            "+"
                        }
                    }
                }
                div { class: "vital-control",
                    div { class: "stepper",
                        button {
                            onclick: move |_| {
                                let mut next = energy_down.clone();
                                next.resources.energy = (next.resources.energy - 1).max(0);
                                on_change.call(next);
                            },
                            "−"
                        }
                        button {
                            onclick: move |_| {
                                let mut next = energy_up.clone();
                                next.resources.energy += 1;
                                on_change.call(next);
                            },
                            "+"
                        }
                    }
                }
                div { class: "vital-control",
                    div { class: "stepper",
                        button {
                            onclick: move |_| {
                                let mut next = exhaustion_down.clone();
                                next.resources.exhaustion = (next.resources.exhaustion - 1).max(0);
                                on_change.call(next);
                            },
                            "−"
                        }
                        button {
                            onclick: move |_| {
                                let mut next = exhaustion_up.clone();
                                next.resources.exhaustion += 1;
                                on_change.call(next);
                            },
                            "+"
                        }
                    }
                }
            }
            div { class: "status-line",
                span { class: "status-label", "STATUS EFFECTS / BONUSES" }
                button {
                    class: "circle-button",
                    aria_label: "Edit statuses",
                    onclick: move |_| on_edit.call(()),
                    "+"
                }
                for status in &character.statuses {
                    span { class: "status-chip", "{status.name}" }
                }
            }
        }
    }
}

#[component]
fn CharacterMenuScreen(
    game: GameData,
    character: CharacterV1,
    on_change: EventHandler<CharacterV1>,
    on_nav: EventHandler<Screen>,
    on_edit: EventHandler<()>,
    on_delete: EventHandler<String>,
) -> Element {
    let derived = derive_character(&game, &character);
    let id_for_delete = character.id.clone();

    rsx! {
        VitalsHeader {
            character: character.clone(),
            max_hp: derived.max_hp,
            on_change,
            on_edit,
        }
        section { class: "character-menu-list",
            button { class: "menu-row", onclick: move |_| on_nav.call(Screen::CharacterSheet),
                span { class: "menu-circle" }
                span { class: "menu-label", "CHARACTER SHEET" }
            }
            button { class: "menu-row", onclick: move |_| on_nav.call(Screen::Classes),
                span { class: "menu-circle" }
                span { class: "menu-label", "CLASSES" }
            }
            button { class: "menu-row", onclick: move |_| on_nav.call(Screen::Expertise),
                span { class: "menu-circle" }
                span { class: "menu-label", "EXPERTISE" }
            }
            button { class: "menu-row", onclick: move |_| on_nav.call(Screen::Abilities),
                span { class: "menu-circle" }
                span { class: "menu-label", "ABILITIES" }
            }
        }
        div { class: "button-row menu-actions",
            button { class: "secondary compact", onclick: move |_| on_edit.call(()), "EDIT CHARACTER" }
            button { class: "danger compact", onclick: move |_| on_delete.call(id_for_delete.clone()), "DELETE" }
        }
    }
}

#[component]
fn CharacterSheetScreen(
    game: GameData,
    character: CharacterV1,
    on_change: EventHandler<CharacterV1>,
    on_edit: EventHandler<()>,
    on_delete: EventHandler<String>,
) -> Element {
    let derived = derive_character(&game, &character);
    let main_level = class_level(&character);
    let max_class_level = game.rules.class_progression.class_level_max;
    let stack_max = game.rules.inventory.stack_max;
    let id_for_delete = character.id.clone();
    let class_up_character = character.clone();
    let party_up_character = character.clone();

    rsx! {
        VitalsHeader {
            character: character.clone(),
            max_hp: derived.max_hp,
            on_change,
            on_edit,
        }

        section { class: "level-summary",
            div { class: "level-box",
                span { class: "vital-label", "CLASS LEVELS" }
                strong { "{main_level}" }
            }
            div { class: "level-actions",
                button {
                    class: "level-button",
                    onclick: move |_| {
                        let mut next = class_up_character.clone();
                        if let Some(track) = next.classes.iter_mut().find(|track| track.role == ClassRole::Main) {
                            track.level = (track.level + 1).min(max_class_level);
                        }
                        on_change.call(next);
                    },
                    "CLASS LEVEL UP"
                }
                button {
                    class: "level-button",
                    onclick: move |_| {
                        let mut next = party_up_character.clone();
                        next.party_level = next.party_level.saturating_add(1);
                        on_change.call(next);
                    },
                    "PARTY LEVEL UP"
                }
            }
            div { class: "level-box",
                span { class: "vital-label", "PARTY LEVEL" }
                strong { "{character.party_level}" }
            }
        }

        section { class: "info-box",
            span { class: "vital-label", "CHARACTER INFO" }
            strong { "{character.name}" }
            p { "{ancestry_label(&game, &character)} / {background_label(&game, &character)}" }
            p { "{class_label(&game, &character)} / {subclass_label(&game, &character)}" }
            if !character.notes.is_empty() {
                p { class: "notes", "{character.notes}" }
            }
        }

        h2 { class: "section-heading", "MAIN STATS" }
        div { class: "stat-box-grid",
            for stat in Stat::MAIN {
                div { key: "{stat}", class: "stat-box",
                    span { class: "stat-label", "{stat}" }
                    strong { class: "stat-value", "{derived.main.get(&stat).copied().unwrap_or_default()}" }
                    div { class: "source-pills small-pills",
                        span { class: "source-pill", "P" }
                        span { class: "source-pill", "C" }
                        span { class: "source-pill", "T" }
                    }
                }
            }
        }

        h2 { class: "section-heading", "BONUS STATS" }
        div { class: "stat-box-grid",
            for stat in Stat::BONUS {
                div { key: "{stat}", class: "stat-box",
                    span { class: "stat-label", "{stat}" }
                    strong { class: "stat-value", "{derived.bonus.get(&stat).copied().unwrap_or_default()}" }
                    div { class: "source-pills small-pills",
                        span { class: "source-pill", "P" }
                        span { class: "source-pill", "C" }
                        span { class: "source-pill", "T" }
                    }
                }
            }
        }

        h2 { class: "section-heading", "EQUIPMENT" }
        div { class: "equipment-list",
            {equipment_row(&game, "MAIN HAND", &character.equipment.main_hand)}
            {equipment_row(&game, "OFF HAND", &character.equipment.off_hand)}
            {equipment_row(&game, "ARMOR", &character.equipment.armor)}
            if character.equipment.accessories.is_empty() {
                {equipment_row(&game, "ACCESSORY", &None)}
                {equipment_row(&game, "ACCESSORY", &None)}
            } else {
                for accessory in &character.equipment.accessories {
                    {equipment_row(&game, "ACCESSORY", &Some(accessory.clone()))}
                }
            }
        }

        h2 { class: "section-heading", "ITEMS" }
        div { class: "item-list",
            if character.inventory.is_empty() {
                for index in 0..3 {
                    div { key: "{index}", class: "item-row",
                        span { "" }
                        span { class: "quantity", "/{stack_max}" }
                    }
                }
            } else {
                for (index, entry) in character.inventory.iter().enumerate() {
                    div { key: "{index}", class: "item-row",
                        span { "{inventory_name(&game, entry)}" }
                        span { class: "quantity", "{entry.quantity}/{stack_max}" }
                    }
                }
            }
        }

        div { class: "button-row menu-actions",
            button { class: "secondary compact", onclick: move |_| on_edit.call(()), "EDIT CHARACTER" }
            button { class: "danger compact", onclick: move |_| on_delete.call(id_for_delete.clone()), "DELETE" }
        }
    }
}

#[component]
fn ClassesScreen(
    game: GameData,
    character: CharacterV1,
    on_change: EventHandler<CharacterV1>,
    on_edit: EventHandler<()>,
) -> Element {
    let derived = derive_character(&game, &character);
    let tiers = [
        ClassTier::Starter,
        ClassTier::Tier1,
        ClassTier::Tier2,
        ClassTier::Tier3,
        ClassTier::Tier4,
    ];

    rsx! {
        VitalsHeader {
            character: character.clone(),
            max_hp: derived.max_hp,
            on_change,
            on_edit,
        }

        div { class: "button-row class-select",
            button { class: "level-button", onclick: move |_| on_edit.call(()), "SELECT MAIN CLASS" }
            button { class: "level-button", onclick: move |_| on_edit.call(()), "SELECT SUB CLASS" }
        }

        for tier in tiers {
            section { key: "{tier}", class: "class-tier",
                h2 { class: "tier-heading", "{tier_label(tier)}" }
                div { class: "class-grid",
                    for class in game.classes.iter().filter(|class| class.tier == tier) {
                        {
                            let level = character
                                .classes
                                .iter()
                                .find(|track| track.class == class.id)
                                .map(|track| track.level);
                            let current = character
                                .classes
                                .iter()
                                .find(|track| track.class == class.id)
                                .map(|track| track.role);
                            rsx! {
                                div {
                                    key: "{class.id}",
                                    class: if current.is_some() { "class-card current" } else { "class-card" },
                                    div { class: "class-circle", "{class_initials(&class.name)}" }
                                    span { class: "class-name", "{class.name}" }
                                    span { class: "class-level",
                                        if let Some(level) = level { "LEVEL: {level:02}" } else { "LEVEL: --" }
                                    }
                                    if let Some(role) = current {
                                        span { class: "class-role", "{role}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        p { class: "muted small ultimate-note",
            "ULTIMATE CLASS: Shard Bearer is a choose-your-own template and is not tracked in v1."
        }
        div { class: "button-row menu-actions",
            button { class: "secondary compact", onclick: move |_| on_edit.call(()), "EDIT CLASS LEVELS" }
        }
    }
}

#[component]
fn ExpertiseScreen(
    game: GameData,
    character: CharacterV1,
    on_change: EventHandler<CharacterV1>,
    on_edit: EventHandler<()>,
) -> Element {
    let derived = derive_character(&game, &character);

    rsx! {
        VitalsHeader {
            character: character.clone(),
            max_hp: derived.max_hp,
            on_change,
            on_edit,
        }

        for stat in Stat::MAIN {
            section { key: "{stat}", class: "expertise-group",
                div { class: "group-pill", "{stat} EXPERTISE" }
                for entry in game.expertise.iter().filter(|entry| entry.main_stat == stat) {
                    div { key: "{entry.id}", class: "expertise-row",
                        span { class: "expertise-name", "{entry.name}" }
                        div { class: "source-pills",
                            span { class: "source-pill", "S" }
                            span { class: "source-pill", "P" }
                            span { class: "source-pill", "C" }
                            span { class: "source-pill", "T" }
                        }
                        span { class: "expertise-value", "{derived.expertise.get(&entry.id).copied().unwrap_or_default()}" }
                    }
                }
            }
        }

        div { class: "button-row menu-actions",
            button { class: "secondary compact", onclick: move |_| on_edit.call(()), "EDIT EXPERTISE" }
        }
    }
}

#[component]
fn AbilitiesScreen(
    game: GameData,
    character: CharacterV1,
    on_change: EventHandler<CharacterV1>,
    on_edit: EventHandler<()>,
) -> Element {
    let derived = derive_character(&game, &character);
    let mut phase = use_signal(|| "end-turn");
    let main_class = game.class(&character.main_class);
    let class_tracks = character
        .classes
        .iter()
        .filter_map(|track| game.class(&track.class).map(|class| (track, class)))
        .collect::<Vec<_>>();
    let mut main_actions = Vec::new();
    let mut support_actions = Vec::new();
    let mut reactions = Vec::new();

    for (track, class) in &class_tracks {
        for action in &class.actions {
            let locked = !track
                .unlocked_actions
                .iter()
                .any(|name| name == &action.name);
            match action.kind {
                ActionType::Main => main_actions.push((action, locked)),
                ActionType::Support => support_actions.push((action, locked)),
                ActionType::Reaction => reactions.push((action, locked)),
            }
        }
    }

    rsx! {
        VitalsHeader {
            character: character.clone(),
            max_hp: derived.max_hp,
            on_change,
            on_edit,
        }

        section { class: "phase-tracker",
            div { class: "phase-grid",
                button { class: phase_class(phase() == "end-turn"), onclick: move |_| phase.set("end-turn"), "END OF TURN" }
                button { class: phase_class(phase() == "status-step"), onclick: move |_| phase.set("status-step"), "STATUS STEP" }
                button { class: phase_class(phase() == "end-round"), onclick: move |_| phase.set("end-round"), "END OF ROUND" }
                button { class: phase_class(phase() == "refresh"), onclick: move |_| phase.set("refresh"), "REFRESH ABILITIES" }
            }
        }

        section { class: "ability-section",
            h2 { class: "group-pill", "ULTIMATE ABILITY" }
            if let Some(class) = main_class {
                article { class: "ability-card",
                    strong { class: "ability-name", "{class.ultimate.name}" }
                    p { class: "ability-description", "{class.ultimate.description}" }
                    p { class: "ability-meta", "CHARGE: {class.ultimate.charge.join(\" / \")}" }
                }
            } else {
                div { class: "empty-box", "NO MAIN CLASS" }
            }
        }

        section { class: "ability-section",
            h2 { class: "group-pill", "BACKGROUND ABILITIES" }
            if character.backgrounds.is_empty() {
                div { class: "empty-box", "NO BACKGROUND" }
            } else {
                for selection in &character.backgrounds {
                    if let Some(background) = game.background(&selection.background) {
                        for chosen in &selection.chosen_abilities {
                            if let Some(passive) = background.passives.iter().find(|passive| passive.name == chosen.ability) {
                                article { key: "{background.id}-{chosen.ability}", class: "ability-card",
                                    span { class: "ability-owner", "{background.name} / P.LVL {chosen.party_level}" }
                                    strong { class: "ability-name", "{passive.name}" }
                                    p { class: "ability-description", "{passive.summary}" }
                                }
                            }
                        }
                    }
                }
            }
        }

        section { class: "ability-section",
            h2 { class: "group-pill", "PASSIVE ABILITIES" }
            if let Some(ancestry) = game.ancestry(&character.ancestry.primary) {
                for passive in &ancestry.passives {
                    article { key: "ancestry-{passive.name}", class: "ability-card",
                        span { class: "ability-owner", "{ancestry.name} / {passive.kind}" }
                        strong { class: "ability-name", "{passive.name}" }
                        p { class: "ability-description", "{passive.description}" }
                    }
                }
            }
            for (track, class) in &class_tracks {
                for passive in &class.passives {
                    {
                        let locked = !track.unlocked_passives.iter().any(|name| name == &passive.name);
                        rsx! {
                            article { key: "{class.id}-{passive.name}", class: if locked { "ability-card locked" } else { "ability-card" },
                                span { class: "ability-owner", "{class.name} / {track.role}" }
                                strong { class: "ability-name", "{passive.name}" }
                                if locked {
                                    span { class: "lock-tag", "LOCKED" }
                                }
                                p { class: "ability-description", "{passive.description}" }
                            }
                        }
                    }
                }
            }
            for passive in character.passive_slots.non_combat.iter().chain(character.passive_slots.combat.iter()) {
                article { key: "slot-{passive}", class: "ability-card",
                    span { class: "ability-owner", "SLOTTED PASSIVE" }
                    strong { class: "ability-name", "{passive}" }
                }
            }
        }

        {ability_group("MAIN ACTIONS", &main_actions)}
        {ability_group("SUPPORT ACTIONS", &support_actions)}
        {ability_group("REACTIONS", &reactions)}

        div { class: "button-row menu-actions",
            button { class: "secondary compact", onclick: move |_| on_edit.call(()), "EDIT ABILITIES" }
        }
    }
}

fn ability_group(title: &'static str, actions: &[(&Action, bool)]) -> Element {
    rsx! {
        section { class: "ability-section",
            h2 { class: "group-pill", "{title}" }
            if actions.is_empty() {
                div { class: "empty-box", "NONE RECORDED" }
            } else {
                for (action, locked) in actions {
                    ActionCard { action: (*action).clone(), locked: *locked }
                }
            }
        }
    }
}

#[component]
fn ActionCard(action: Action, locked: bool) -> Element {
    rsx! {
        article { class: if locked { "ability-card locked" } else { "ability-card" },
            span { class: "ability-owner", "{action.kind} / {action.tags.join(\" · \")}" }
            strong { class: "ability-name", "{action.name}" }
            if locked {
                span { class: "lock-tag", "LOCKED" }
            }
            p { class: "ability-meta", "{action.cost} · {action.target_range}" }
            p { class: "ability-check", "{action.check}" }
            p { class: "ability-description", "{action.description}" }
        }
    }
}

#[component]
fn CreateCharacterScreen(
    game: GameData,
    store: AppStore,
    on_saved: EventHandler<String>,
) -> Element {
    let first_ancestry = game
        .ancestries
        .first()
        .map(|a| a.id.clone())
        .unwrap_or_default();
    let first_background = game
        .backgrounds
        .first()
        .map(|b| b.id.clone())
        .unwrap_or_default();
    let starters = game
        .classes
        .iter()
        .filter(|class| class.tier == ClassTier::Starter)
        .collect::<Vec<_>>();
    let first_class = starters
        .first()
        .map(|class| class.id.clone())
        .unwrap_or_default();

    let mut step = use_signal(|| CreateStep::Ancestry);
    let mut name = use_signal(String::new);
    let mut notes = use_signal(String::new);
    let mut ancestry_id = use_signal(|| first_ancestry);
    let mut background_id = use_signal(|| first_background);
    let mut class_id = use_signal(|| first_class);
    let mut error = use_signal(|| None::<String>);

    let selected_ancestry = game.ancestry(&ancestry_id());
    let selected_background = game.background(&background_id());
    let selected_class = game.class(&class_id());
    let game_for_save = game.clone();
    let error_text = error();

    rsx! {
        div { class: "step-menu",
            button { class: step_class(step() == CreateStep::Ancestry), onclick: move |_| step.set(CreateStep::Ancestry), "CHOOSE ANCESTRY" }
            button { class: step_class(step() == CreateStep::Background), onclick: move |_| step.set(CreateStep::Background), "CHOOSE BACKGROUND" }
            button { class: step_class(step() == CreateStep::Info), onclick: move |_| step.set(CreateStep::Info), "CHARACTER INFO" }
            button { class: step_class(step() == CreateStep::Class), onclick: move |_| step.set(CreateStep::Class), "CHOOSE STARTING CLASS" }
            button { class: step_class(step() == CreateStep::Review), onclick: move |_| step.set(CreateStep::Review), "FINISH CHARACTER" }
        }

        if let Some(message) = error_text {
            div { class: "notice danger-notice", role: "alert", "{message}" }
        }

        match step() {
            CreateStep::Ancestry => rsx! {
                section { class: "step-panel",
                    h2 { class: "section-heading", "CHOOSE ANCESTRY" }
                    div { class: "field",
                        span { "ANCESTRY" }
                        select {
                            value: "{ancestry_id}",
                            onchange: move |event| ancestry_id.set(event.value()),
                            for ancestry in &game.ancestries {
                                option { value: "{ancestry.id}", selected: ancestry_id() == ancestry.id, "{ancestry.name}" }
                            }
                        }
                    }
                    if let Some(ancestry) = selected_ancestry {
                        {ancestry_preview(ancestry)}
                    }
                    div { class: "button-row",
                        button { class: "primary", onclick: move |_| step.set(CreateStep::Background), "NEXT" }
                    }
                }
            },
            CreateStep::Background => rsx! {
                section { class: "step-panel",
                    h2 { class: "section-heading", "CHOOSE BACKGROUND" }
                    div { class: "field",
                        span { "BACKGROUND" }
                        select {
                            value: "{background_id}",
                            onchange: move |event| background_id.set(event.value()),
                            for background in &game.backgrounds {
                                option { value: "{background.id}", selected: background_id() == background.id, "{background.name}" }
                            }
                        }
                    }
                    if let Some(background) = selected_background {
                        {background_preview(&game, background)}
                    }
                    div { class: "button-row",
                        button { class: "secondary", onclick: move |_| step.set(CreateStep::Ancestry), "BACK" }
                        button { class: "primary", onclick: move |_| step.set(CreateStep::Info), "NEXT" }
                    }
                }
            },
            CreateStep::Info => rsx! {
                section { class: "step-panel",
                    h2 { class: "section-heading", "CHARACTER INFO" }
                    label { class: "field",
                        span { "NAME" }
                        input {
                            r#type: "text",
                            placeholder: "NAME YOUR FRAGMENT",
                            value: "{name}",
                            oninput: move |event| name.set(event.value()),
                        }
                    }
                    label { class: "field",
                        span { "NOTES" }
                        textarea {
                            rows: "4",
                            placeholder: "Backstory, appearance, goals...",
                            value: "{notes}",
                            oninput: move |event| notes.set(event.value()),
                        }
                    }
                    div { class: "button-row",
                        button { class: "secondary", onclick: move |_| step.set(CreateStep::Background), "BACK" }
                        button { class: "primary", onclick: move |_| step.set(CreateStep::Class), "NEXT" }
                    }
                }
            },
            CreateStep::Class => rsx! {
                section { class: "step-panel",
                    h2 { class: "section-heading", "CHOOSE STARTING CLASS" }
                    div { class: "field",
                        span { "STARTER CLASS" }
                        select {
                            value: "{class_id}",
                            onchange: move |event| class_id.set(event.value()),
                            for class in &starters {
                                option { value: "{class.id}", selected: class_id() == class.id, "{class.name} · {class.main_stat} · {role_text(class)}" }
                            }
                        }
                    }
                    if let Some(class) = selected_class {
                        {class_preview(class)}
                    }
                    div { class: "button-row",
                        button { class: "secondary", onclick: move |_| step.set(CreateStep::Info), "BACK" }
                        button { class: "primary", onclick: move |_| step.set(CreateStep::Review), "REVIEW" }
                    }
                }
            },
            CreateStep::Review => rsx! {
                section { class: "step-panel",
                    h2 { class: "section-heading", "FINISH CHARACTER" }
                    div { class: "info-box",
                        strong { "{name}" }
                        p { "{ancestry_id()} / {background_id()}" }
                        p { "{class_id()}" }
                    }
                    div { class: "button-row",
                        button { class: "secondary", onclick: move |_| step.set(CreateStep::Class), "BACK" }
                        button {
                            class: "primary",
                            onclick: move |_| {
                                let name_value = name().trim().to_string();
                                if name_value.is_empty() {
                                    error.set(Some("Enter a character name before finishing.".into()));
                                    step.set(CreateStep::Info);
                                    return;
                                }
                                let Some(character) = build_character(
                                    &game_for_save,
                                    name_value,
                                    notes(),
                                    &ancestry_id(),
                                    &background_id(),
                                    &class_id(),
                                ) else {
                                    error.set(Some("Selected content is missing from config.".into()));
                                    return;
                                };
                                match store.save(&character) {
                                    Ok(()) => on_saved.call(character.id),
                                    Err(save_error) => error.set(Some(save_error.to_string())),
                                }
                            },
                            "CREATE CHARACTER"
                        }
                    }
                }
            },
        }
    }
}

fn build_character(
    game: &GameData,
    name: String,
    notes: String,
    ancestry_id: &str,
    background_id: &str,
    class_id: &str,
) -> Option<CharacterV1> {
    let ancestry = game.ancestry(ancestry_id)?;
    let background = game.background(background_id)?;
    let class = game.class(class_id)?;

    let chosen_ability = background
        .passives
        .iter()
        .find(|passive| {
            passive.requirements.iter().any(|requirement| {
                requirement.kind == RequirementKind::PartyLevel && requirement.level == Some(0)
            })
        })
        .or_else(|| background.passives.first())
        .map(|passive| ChosenAbility {
            party_level: 0,
            ability: passive.name.clone(),
        })
        .into_iter()
        .collect::<Vec<_>>();

    let inventory = background
        .starting_items
        .iter()
        .map(|entry| InventoryEntry {
            item: Some(entry.item.clone()),
            quantity: entry.quantity,
            custom_name: None,
        })
        .collect::<Vec<_>>();

    let passive_slots = PassiveSlots {
        non_combat: ancestry
            .passives
            .iter()
            .filter(|passive| passive.kind == PassiveSlot::NonCombat)
            .map(|passive| passive.name.clone())
            .collect(),
        combat: ancestry
            .passives
            .iter()
            .filter(|passive| passive.kind == PassiveSlot::Combat)
            .map(|passive| passive.name.clone())
            .collect(),
    };

    let mut character = CharacterV1 {
        schema_version: som_v3::domain::character::SCHEMA_VERSION,
        id: format!("{}-{}", slugify(&name), timestamp()),
        name,
        notes,
        main_class: class.id.clone(),
        ancestry: AncestrySelection {
            primary: ancestry.id.clone(),
            hybrid: None,
        },
        backgrounds: vec![BackgroundSelection {
            background: background.id.clone(),
            chosen_abilities: chosen_ability,
        }],
        classes: vec![ClassTrack {
            class: class.id.clone(),
            role: ClassRole::Main,
            level: 1,
            x: class.x_start,
            unlocked_actions: Vec::new(),
            unlocked_passives: Vec::new(),
        }],
        party_level: 0,
        stat_pips: Stat::MAIN.iter().map(|stat| (*stat, 0)).collect(),
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
        inventory,
        currency: Currency { gold: 0, shards: 0 },
        passive_slots,
        overrides: Overrides::default(),
    };

    let derived = derive_character(game, &character);
    character.resources.current_hp = derived.max_hp;
    Some(character)
}

fn update_character(
    store: &AppStore,
    character: CharacterV1,
    mut characters: Signal<Vec<CharacterV1>>,
    mut notice: Signal<Option<String>>,
) {
    match store.save(&character) {
        Ok(()) => match store.list() {
            Ok(list) => {
                characters.set(list);
                notice.set(None);
            }
            Err(error) => notice.set(Some(error.to_string())),
        },
        Err(error) => notice.set(Some(error.to_string())),
    }
}

fn refresh(
    store: &AppStore,
    mut characters: Signal<Vec<CharacterV1>>,
    mut notice: Signal<Option<String>>,
) {
    match store.list() {
        Ok(list) => {
            characters.set(list);
            notice.set(None);
        }
        Err(error) => notice.set(Some(error.to_string())),
    }
}

fn delete_character(
    store: &AppStore,
    id: String,
    characters: Signal<Vec<CharacterV1>>,
    mut selected: Signal<Option<String>>,
    mut nav: Signal<Screen>,
    notice: Signal<Option<String>>,
) {
    match store.delete(&id) {
        Ok(()) => {
            refresh(store, characters, notice);
            selected.set(None);
            nav.set(Screen::ChooseCharacter);
        }
        Err(error) => {
            let mut notice = notice;
            notice.set(Some(error.to_string()));
        }
    }
}

fn equipment_row(game: &GameData, label: &str, value: &Option<String>) -> Element {
    rsx! {
        div { class: "equipment-row",
            span { class: "equipment-circle" }
            span { class: "equipment-label", "{label}" }
            span { class: "equipment-value", "{equipment_value(game, value)}" }
        }
    }
}

fn equipment_value(game: &GameData, value: &Option<String>) -> String {
    value
        .as_deref()
        .and_then(|id| game.item(id))
        .map(|item| item.name.clone())
        .or_else(|| value.clone())
        .unwrap_or_default()
}

fn inventory_name(game: &GameData, entry: &InventoryEntry) -> String {
    entry
        .item
        .as_deref()
        .and_then(|id| game.item(id))
        .map(|item| item.name.clone())
        .or_else(|| entry.custom_name.clone())
        .unwrap_or_else(|| "UNKNOWN ITEM".to_string())
}

fn ancestry_label(game: &GameData, character: &CharacterV1) -> String {
    game.ancestry(&character.ancestry.primary)
        .map(|ancestry| ancestry.name.clone())
        .unwrap_or_else(|| character.ancestry.primary.clone())
}

fn background_label(game: &GameData, character: &CharacterV1) -> String {
    if character.backgrounds.is_empty() {
        return "—".to_string();
    }
    character
        .backgrounds
        .iter()
        .filter_map(|selection| game.background(&selection.background))
        .map(|background| background.name.clone())
        .collect::<Vec<_>>()
        .join(" / ")
}

fn class_label(game: &GameData, character: &CharacterV1) -> String {
    game.class(&character.main_class)
        .map(|class| class.name.clone())
        .unwrap_or_else(|| character.main_class.clone())
}

fn subclass_label(game: &GameData, character: &CharacterV1) -> String {
    let subclasses = character
        .classes
        .iter()
        .filter(|track| track.role == ClassRole::Sub)
        .filter_map(|track| game.class(&track.class))
        .map(|class| class.name.clone())
        .collect::<Vec<_>>();
    if subclasses.is_empty() {
        "—".to_string()
    } else {
        subclasses.join(" / ")
    }
}

fn class_level(character: &CharacterV1) -> u8 {
    character
        .classes
        .iter()
        .find(|track| track.role == ClassRole::Main)
        .map(|track| track.level)
        .unwrap_or_default()
}

fn tier_label(tier: ClassTier) -> &'static str {
    match tier {
        ClassTier::Starter => "STARTER CLASSES",
        ClassTier::Tier1 => "TIER 1 CLASSES",
        ClassTier::Tier2 => "TIER 2 CLASSES",
        ClassTier::Tier3 => "TIER 3 CLASSES",
        ClassTier::Tier4 => "TIER 4 CLASSES",
        ClassTier::Ultimate => "ULTIMATE CLASS",
    }
}

fn class_initials(name: &str) -> String {
    let words = name.split_whitespace().collect::<Vec<_>>();
    if words.len() > 1 {
        words
            .iter()
            .filter_map(|word| word.chars().next())
            .take(2)
            .collect::<String>()
            .to_uppercase()
    } else {
        name.chars().take(2).collect::<String>().to_uppercase()
    }
}

fn phase_class(active: bool) -> &'static str {
    if active {
        "phase-button active"
    } else {
        "phase-button"
    }
}

fn step_class(active: bool) -> &'static str {
    if active {
        "menu-action quiet step-active"
    } else {
        "menu-action quiet"
    }
}

fn role_text(class: &Class) -> String {
    class
        .roles
        .iter()
        .map(|role| role.as_str())
        .collect::<Vec<_>>()
        .join("/")
}

fn ancestry_preview(ancestry: &Ancestry) -> Element {
    rsx! {
        div { class: "preview-card",
            span { class: "vital-label", "ANCESTRY" }
            strong { "{ancestry.name}" }
            p { "{ancestry.vision} · {language_text(ancestry)}" }
            p { class: "muted", "{modifier_summary(&ancestry.stat_modifiers)}" }
            p { class: "muted", "{expertise_summary(&ancestry.expertise_modifiers, None)}" }
            ul { class: "plain-list",
                for passive in &ancestry.passives {
                    li { "{passive.name} ({passive.kind})" }
                }
            }
        }
    }
}

fn background_preview(game: &GameData, background: &Background) -> Element {
    let items = background
        .starting_items
        .iter()
        .map(|entry| {
            let name = game
                .item(&entry.item)
                .map(|item| item.name.clone())
                .unwrap_or_else(|| entry.item.clone());
            format!("{name} ×{}", entry.quantity)
        })
        .collect::<Vec<_>>()
        .join(", ");
    let items = if items.is_empty() {
        "none".to_string()
    } else {
        items
    };
    let ability = background
        .passives
        .first()
        .map(|passive| passive.name.as_str())
        .unwrap_or("—");

    rsx! {
        div { class: "preview-card",
            span { class: "vital-label", "BACKGROUND" }
            strong { "{background.name}" }
            p { class: "muted", "{expertise_summary(&background.expertise_modifiers, None)}" }
            p { "STARTING ITEMS: {items}" }
            p { "P.LVL 0 ABILITY: {ability}" }
        }
    }
}

fn class_preview(class: &Class) -> Element {
    rsx! {
        div { class: "preview-card",
            span { class: "vital-label", "STARTER CLASS" }
            strong { "{class.name}" }
            p { "{class.tier} · {class.main_stat} · {role_text(class)}" }
            p { class: "muted", "{modifier_summary(&class.stat_modifiers)}" }
            p { "EQUIPMENT: {class.equipment.values().cloned().collect::<Vec<_>>().join(\" / \")}" }
        }
    }
}

fn language_text(ancestry: &Ancestry) -> String {
    ancestry
        .languages
        .iter()
        .map(|language| language.as_str())
        .collect::<Vec<_>>()
        .join(", ")
}

fn modifier_summary(modifiers: &BTreeMap<ModifierTarget, i32>) -> String {
    if modifiers.is_empty() {
        return "NO STAT MODIFIERS".to_string();
    }
    modifiers
        .iter()
        .map(|(target, value)| format!("{target} {value:+}"))
        .collect::<Vec<_>>()
        .join(", ")
}

fn expertise_summary(
    modifiers: &[som_v3::domain::config::ExpertiseModifier],
    class_level: Option<u8>,
) -> String {
    let values = modifiers
        .iter()
        .filter(|modifier| {
            modifier
                .requirements
                .iter()
                .all(|requirement| match requirement.kind {
                    RequirementKind::Constant => true,
                    RequirementKind::ClassLevel => class_level
                        .zip(requirement.level)
                        .is_some_and(|(level, required)| level >= required),
                    _ => false,
                })
        })
        .map(|modifier| format!("{} {:+}", modifier.expertise, modifier.value))
        .collect::<Vec<_>>();
    if values.is_empty() {
        "NO EXPERTISE MODIFIERS".to_string()
    } else {
        values.join(", ")
    }
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character.to_ascii_lowercase());
        } else if !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "character".to_string()
    } else {
        slug
    }
}

#[cfg(target_arch = "wasm32")]
fn timestamp() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(not(target_arch = "wasm32"))]
fn timestamp() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}
