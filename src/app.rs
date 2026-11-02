use std::collections::BTreeMap;

use dioxus::prelude::*;

use crate::editor::CharacterEditorScreen;
use crate::settings::SettingsScreen;
use som_v3::domain::character::{
    CharacterV1, ChosenAbility, ClassTrack, Currency, Equipment, InventoryEntry, Overrides,
    PassiveSlots, Resources,
};
use som_v3::domain::config::{Ancestry, Background, Class, GameData};
use som_v3::domain::enums::{
    ClassRole, ClassTier, Expertise, ModifierTarget, PassiveSlot, RequirementKind, Stat,
};
use som_v3::domain::{derive_character, AppStore, CharacterStore};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Screen {
    Home,
    Characters,
    Create,
    Reference,
    Settings,
    Sheet,
    Edit,
}

#[component]
pub fn App() -> Element {
    let loaded = use_hook(|| GameData::load_embedded().map_err(|error| error.to_string()));
    let _ = use_context_provider(|| loaded.clone());

    rsx! {
        Shell {}
    }
}

#[component]
fn Shell() -> Element {
    let loaded = use_context::<Result<GameData, String>>();
    let store = use_hook(AppStore::default);
    let initial = store.list();
    let initial_characters = initial
        .as_ref()
        .map(|list| list.to_vec())
        .unwrap_or_default();
    let initial_error = initial.err().map(|error| error.to_string());

    let characters = use_signal(|| initial_characters);
    let notice = use_signal(|| initial_error);
    let mut screen = use_signal(|| Screen::Home);
    let selected = use_signal(|| None::<String>);

    let notice_text = notice();
    let content = match &loaded {
        Ok(game) => {
            render_current_screen(screen(), game, store, characters, selected, screen, notice)
        }
        Err(error) => rsx! {
            section { class: "panel error-panel",
                h2 { "Config failed to load" }
                pre { class: "error-text", "{error}" }
            }
        },
    };

    rsx! {
        div { class: "app-shell",
            header { class: "topbar",
                div { class: "brand",
                    span { class: "brand-mark", "SHARD" }
                    span { class: "brand-sub", "Fragments of Memory" }
                }
                span { class: "phase-badge", "phase 4 PWA" }
            }

            nav { class: "tabs", aria_label: "Primary navigation",
                button {
                    class: tab_class(screen() == Screen::Home),
                    onclick: move |_| screen.set(Screen::Home),
                    "Home"
                }
                button {
                    class: tab_class(matches!(screen(), Screen::Characters | Screen::Sheet | Screen::Edit)),
                    onclick: move |_| screen.set(Screen::Characters),
                    "Characters"
                }
                button {
                    class: tab_class(screen() == Screen::Create),
                    onclick: move |_| screen.set(Screen::Create),
                    "Create"
                }
                button {
                    class: tab_class(screen() == Screen::Reference),
                    onclick: move |_| screen.set(Screen::Reference),
                    "Reference"
                }
                button {
                    class: tab_class(screen() == Screen::Settings),
                    onclick: move |_| screen.set(Screen::Settings),
                    "Settings"
                }
            }

            main { class: "content",
                if let Some(message) = notice_text {
                    div { class: "notice", role: "status", "{message}" }
                }
                {content}
            }

            footer { class: "footer",
                "Client-side character companion. Saves live in browser storage."
            }
        }
    }
}

fn render_current_screen(
    screen: Screen,
    game: &GameData,
    store: AppStore,
    characters: Signal<Vec<CharacterV1>>,
    mut selected: Signal<Option<String>>,
    mut nav: Signal<Screen>,
    notice: Signal<Option<String>>,
) -> Element {
    match screen {
        Screen::Home => render_home(game, characters(), nav),
        Screen::Characters => {
            let store = store.clone();
            rsx! {
                CharacterListScreen {
                    game: game.clone(),
                    characters: characters(),
                    on_select: move |id| {
                        selected.set(Some(id));
                        nav.set(Screen::Sheet);
                    },
                    on_new: move |_| nav.set(Screen::Create),
                    on_delete: move |id| delete_character(&store, id, characters, selected, nav, notice),
                }
            }
        }
        Screen::Create => {
            let store = store.clone();
            let store_for_save = store.clone();
            rsx! {
                CreateScreen {
                    game: game.clone(),
                    store,
                    on_saved: move |id| {
                        refresh(&store_for_save, characters, notice);
                        selected.set(Some(id));
                        nav.set(Screen::Sheet);
                    },
                    on_cancel: move |_| nav.set(Screen::Characters),
                }
            }
        }
        Screen::Reference => render_reference(game),
        Screen::Settings => {
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
        Screen::Sheet | Screen::Edit => {
            let editing = screen == Screen::Edit;
            let chosen = selected().and_then(|id| {
                characters()
                    .into_iter()
                    .find(|character| character.id == id)
            });
            match chosen {
                Some(character) if editing => {
                    let store = store.clone();
                    let store_for_save = store.clone();
                    rsx! {
                        CharacterEditorScreen {
                            game: game.clone(),
                            character,
                            store,
                            on_saved: move |id| {
                                refresh(&store_for_save, characters, notice);
                                selected.set(Some(id));
                                nav.set(Screen::Sheet);
                            },
                            on_cancel: move |_| nav.set(Screen::Sheet),
                        }
                    }
                }
                Some(character) => {
                    let store = store.clone();
                    rsx! {
                        CharacterSheetScreen {
                            game: game.clone(),
                            character,
                            on_back: move |_| nav.set(Screen::Characters),
                            on_edit: move |_| nav.set(Screen::Edit),
                            on_delete: move |id| delete_character(&store, id, characters, selected, nav, notice),
                        }
                    }
                }
                None => rsx! {
                    section { class: "panel",
                        h2 { "Character not found" }
                        p { class: "muted", "It may have been deleted or the browser save was cleared." }
                        button {
                            class: "secondary",
                            onclick: move |_| nav.set(Screen::Characters),
                            "Back to characters"
                        }
                    }
                },
            }
        }
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
    mut notice: Signal<Option<String>>,
) {
    match store.delete(&id) {
        Ok(()) => {
            refresh(store, characters, notice);
            selected.set(None);
            nav.set(Screen::Characters);
        }
        Err(error) => notice.set(Some(error.to_string())),
    }
}

fn render_home(game: &GameData, characters: Vec<CharacterV1>, mut nav: Signal<Screen>) -> Element {
    rsx! {
        section { class: "hero",
            p { class: "eyebrow", "Character companion" }
            h1 { "Build a Fragment. Keep the sheet alive." }
            p { class: "lede",
                "Create an ancestry, background, and starter class, then keep the derived sheet in browser storage. Phase 4 adds full sheet editing, leveling, JSON export/import, and offline PWA support."
            }
            div { class: "hero-actions",
                button {
                    class: "primary",
                    onclick: move |_| nav.set(Screen::Create),
                    "Create character"
                }
                button {
                    class: "secondary",
                    onclick: move |_| nav.set(Screen::Characters),
                    "View characters ({characters.len()})"
                }
            }
        }

        section { class: "stat-grid",
            StatCard { label: "Ancestries", value: game.ancestries.len(), detail: "source-backed" }
            StatCard { label: "Backgrounds", value: game.backgrounds.len(), detail: "tier abilities" }
            StatCard { label: "Classes", value: game.classes.len(), detail: "281 actions" }
            StatCard { label: "Items", value: game.items.len(), detail: "seeded catalog" }
        }

        section { class: "panel",
            div { class: "panel-heading",
                h2 { "Your characters" }
                span { class: "pill", "browser storage" }
            }
            if characters.is_empty() {
                div { class: "empty-state",
                    p { "No saved characters yet." }
                    p { class: "muted", "Create one to exercise the full config-to-save path." }
                }
            } else {
                ul { class: "compact-list",
                    for character in &characters {
                        li { key: "{character.id}",
                            strong { "{character.name}" }
                            span { class: "muted small",
                                "{character.main_class} · party level {character.party_level}"
                            }
                        }
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Rules wired" } }
            ul { class: "check-list",
                li { "Class level cap: {game.rules.class_progression.class_level_max}" }
                li { "Background tiers: {join_numbers(&game.rules.party_levels.background_ability_tiers)}" }
                li { "Inventory: {game.rules.inventory.inventory_max} slots, stacks of {game.rules.inventory.stack_max}" }
                li { "Status catalog: {game.rules.status_effects.status}" }
            }
        }
    }
}

#[component]
fn StatCard(label: &'static str, value: usize, detail: &'static str) -> Element {
    rsx! {
        article { class: "stat-card",
            span { class: "stat-label", "{label}" }
            strong { class: "stat-value", "{value}" }
            span { class: "stat-detail", "{detail}" }
        }
    }
}

#[component]
fn CharacterListScreen(
    game: GameData,
    characters: Vec<CharacterV1>,
    on_select: EventHandler<String>,
    on_new: EventHandler<()>,
    on_delete: EventHandler<String>,
) -> Element {
    rsx! {
        section { class: "panel",
            div { class: "panel-heading",
                h2 { "Characters" }
                button {
                    class: "primary compact",
                    onclick: move |_| on_new.call(()),
                    "New character"
                }
            }
            if characters.is_empty() {
                div { class: "empty-state",
                    p { "No saved characters yet." }
                    p { class: "muted", "Create a character from the Create tab." }
                }
            } else {
                ul { class: "character-list",
                    for character in &characters {
                        CharacterCard {
                            key: "{character.id}",
                            game: game.clone(),
                            character: character.clone(),
                            on_select: on_select,
                            on_delete: on_delete,
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn CharacterCard(
    game: GameData,
    character: CharacterV1,
    on_select: EventHandler<String>,
    on_delete: EventHandler<String>,
) -> Element {
    let derived = derive_character(&game, &character);
    let id_for_open = character.id.clone();
    let id_for_delete = character.id.clone();

    rsx! {
        li { class: "character-card",
            div { class: "character-card-main",
                strong { "{character.name}" }
                span { class: "muted small",
                    "{class_label(&game, &character)} · {ancestry_label(&game, &character)}"
                }
                span { class: "muted small",
                    "HP {character.resources.current_hp}/{derived.max_hp} · party level {character.party_level}"
                }
            }
            div { class: "button-row",
                button {
                    class: "secondary compact",
                    onclick: move |_| on_select.call(id_for_open.clone()),
                    "Open"
                }
                button {
                    class: "danger compact",
                    onclick: move |_| on_delete.call(id_for_delete.clone()),
                    "Delete"
                }
            }
        }
    }
}

#[component]
fn CreateScreen(
    game: GameData,
    store: AppStore,
    on_saved: EventHandler<String>,
    on_cancel: EventHandler<()>,
) -> Element {
    let first_ancestry = game
        .ancestries
        .first()
        .map(|ancestry| ancestry.id.clone())
        .unwrap_or_default();
    let first_background = game
        .backgrounds
        .first()
        .map(|background| background.id.clone())
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

    let mut name = use_signal(String::new);
    let mut ancestry_id = use_signal(|| first_ancestry);
    let mut background_id = use_signal(|| first_background);
    let mut class_id = use_signal(|| first_class);
    let mut error = use_signal(|| None::<String>);

    let selected_ancestry = game.ancestry(&ancestry_id());
    let selected_background = game.background(&background_id());
    let selected_class = game.class(&class_id());
    let game_for_create = game.clone();
    let error_text = error();

    rsx! {
        section { class: "panel",
            div { class: "panel-heading",
                h2 { "Create a character" }
                span { class: "pill", "vertical slice" }
            }
            p { class: "muted",
                "Pick one ancestry, one background, and one starter class. The slice starts at party level 0 and class level 1."
            }
            if let Some(message) = error_text {
                div { class: "notice danger-notice", role: "alert", "{message}" }
            }

            div { class: "form",
                label { class: "field",
                    span { "Name" }
                    input {
                        r#type: "text",
                        placeholder: "Name your Fragment",
                        value: "{name}",
                        oninput: move |event| name.set(event.value()),
                    }
                }
                label { class: "field",
                    span { "Ancestry" }
                    select {
                        value: "{ancestry_id}",
                        onchange: move |event| ancestry_id.set(event.value()),
                        for ancestry in &game.ancestries {
                            option {
                                value: "{ancestry.id}",
                                selected: ancestry_id() == ancestry.id,
                                "{ancestry.name}"
                            }
                        }
                    }
                }
                label { class: "field",
                    span { "Background" }
                    select {
                        value: "{background_id}",
                        onchange: move |event| background_id.set(event.value()),
                        for background in &game.backgrounds {
                            option {
                                value: "{background.id}",
                                selected: background_id() == background.id,
                                "{background.name}"
                            }
                        }
                    }
                }
                label { class: "field",
                    span { "Starter class" }
                    select {
                        value: "{class_id}",
                        onchange: move |event| class_id.set(event.value()),
                        for class in &starters {
                            option {
                                value: "{class.id}",
                                selected: class_id() == class.id,
                                "{class.name} · {class.main_stat} · {role_text(class)}"
                            }
                        }
                    }
                }
            }

            div { class: "preview-grid",
                if let Some(ancestry) = selected_ancestry {
                    PreviewCard { title: "Ancestry",
                        {ancestry_preview(ancestry)}
                    }
                }
                if let Some(background) = selected_background {
                    PreviewCard { title: "Background",
                        {background_preview(&game, background)}
                    }
                }
                if let Some(class) = selected_class {
                    PreviewCard { title: "Starter class",
                        {class_preview(class)}
                    }
                }
            }

            div { class: "button-row",
                button {
                    class: "primary",
                    onclick: move |_| {
                        let name_value = name().trim().to_string();
                        if name_value.is_empty() {
                            error.set(Some("Enter a character name.".into()));
                            return;
                        }
                        let Some(character) = build_character(
                            &game_for_create,
                            name_value,
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
                    "Create character"
                }
                button {
                    class: "secondary",
                    onclick: move |_| on_cancel.call(()),
                    "Cancel"
                }
            }
        }
    }
}

#[component]
fn PreviewCard(title: &'static str, children: Element) -> Element {
    rsx! {
        article { class: "preview-card",
            h3 { "{title}" }
            {children}
        }
    }
}

fn ancestry_preview(ancestry: &Ancestry) -> Element {
    rsx! {
        p { class: "muted small",
            "{ancestry.vision} · {language_text(ancestry)}"
        }
        p { class: "small", "{modifier_summary(&ancestry.stat_modifiers)}" }
        p { class: "muted small",
            "{expertise_summary(&ancestry.expertise_modifiers, None)}"
        }
        ul { class: "plain-list",
            for passive in &ancestry.passives {
                li { "{passive.name} ({passive.kind})" }
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
        p { class: "muted small", "{expertise_summary(&background.expertise_modifiers, None)}" }
        p { class: "small", "Starting items: {items}" }
        p { class: "small", "Party-level 0 ability: {ability}" }
    }
}

fn class_preview(class: &Class) -> Element {
    rsx! {
        p { class: "muted small", "{class.tier} · {class.main_stat} · {role_text(class)}" }
        p { class: "small", "{modifier_summary(&class.stat_modifiers)}" }
        p { class: "small",
            "Equipment: {class.equipment.values().cloned().collect::<Vec<_>>().join(\" / \")}"
        }
    }
}

#[component]
fn CharacterSheetScreen(
    game: GameData,
    character: CharacterV1,
    on_back: EventHandler<()>,
    on_edit: EventHandler<()>,
    on_delete: EventHandler<String>,
) -> Element {
    let derived = derive_character(&game, &character);
    let ancestry = ancestry_label(&game, &character);
    let background = character
        .backgrounds
        .first()
        .and_then(|selection| game.background(&selection.background))
        .map(|background| background.name.clone())
        .unwrap_or_else(|| "—".to_string());
    let id_for_delete = character.id.clone();

    rsx! {
        section { class: "panel sheet-header",
            div {
                p { class: "eyebrow", "Character sheet" }
                h2 { "{character.name}" }
                p { class: "muted",
                    "{class_label(&game, &character)} · {ancestry} · {background}"
                }
            }
            div { class: "button-row",
                button {
                    class: "secondary compact",
                    onclick: move |_| on_back.call(()),
                    "Back"
                }
                button {
                    class: "primary compact",
                    onclick: move |_| on_edit.call(()),
                    "Edit"
                }
                button {
                    class: "danger compact",
                    onclick: move |_| on_delete.call(id_for_delete.clone()),
                    "Delete"
                }
            }
        }

        div { class: "stat-grid",
            article { class: "stat-card",
                span { class: "stat-label", "Current HP" }
                strong { class: "stat-value", "{character.resources.current_hp}" }
                span { class: "stat-detail", "max {derived.max_hp}" }
            }
            article { class: "stat-card",
                span { class: "stat-label", "Party level" }
                strong { class: "stat-value", "{character.party_level}" }
                span { class: "stat-detail", "P.LVL" }
            }
            article { class: "stat-card",
                span { class: "stat-label", "Class level" }
                strong { class: "stat-value", "{class_level(&character)}" }
                span { class: "stat-detail", "main class" }
            }
            article { class: "stat-card",
                span { class: "stat-label", "Inventory" }
                strong { class: "stat-value", "{character.inventory.len()}" }
                span { class: "stat-detail", "stacks" }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Main stats" } }
            div { class: "stat-chip-grid",
                for stat in Stat::MAIN {
                    div { class: "stat-chip",
                        span { "{stat}" }
                        strong { "{derived.main.get(&stat).copied().unwrap_or_default()}" }
                    }
                }
            }
            div { class: "panel-heading sub-heading", h2 { "Bonus stats" } }
            div { class: "stat-chip-grid",
                for stat in Stat::BONUS {
                    div { class: "stat-chip",
                        span { "{stat}" }
                        strong { "{derived.bonus.get(&stat).copied().unwrap_or_default()}" }
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Expertise" } }
            div { class: "expertise-grid",
                for entry in &game.expertise {
                    if entry.id != Expertise::Any {
                        div { class: "expertise-row",
                            span { "{entry.name}" }
                            strong { "{derived.expertise.get(&entry.id).copied().unwrap_or_default()}" }
                        }
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Equipment and inventory" } }
            dl { class: "detail-list",
                div { dt { "Main hand" } dd { "{equipment_value(&character.equipment.main_hand)}" } }
                div { dt { "Armor" } dd { "{equipment_value(&character.equipment.armor)}" } }
                div { dt { "Off hand" } dd { "{equipment_value(&character.equipment.off_hand)}" } }
                div { dt { "Accessories" } dd { "{join_or_dash(&character.equipment.accessories)}" } }
            }
            ul { class: "plain-list inventory-list",
                for entry in &character.inventory {
                    li {
                        "{inventory_name(&game, entry)} ×{entry.quantity}"
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Slotted passives" } }
            dl { class: "detail-list",
                div { dt { "Non-combat" } dd { "{join_or_dash(&character.passive_slots.non_combat)}" } }
                div { dt { "Combat" } dd { "{join_or_dash(&character.passive_slots.combat)}" } }
            }
        }

        if !character.statuses.is_empty() {
            section { class: "panel",
                div { class: "panel-heading", h2 { "Statuses" } }
                ul { class: "plain-list",
                    for status in &character.statuses {
                        li { "{status.name} · {status.kind}" }
                    }
                }
            }
        }

        if !character.notes.is_empty() {
            section { class: "panel",
                div { class: "panel-heading", h2 { "Notes" } }
                p { class: "notes", "{character.notes}" }
            }
        }

        if !derived.notes.is_empty() {
            section { class: "panel",
                div { class: "panel-heading", h2 { "Calculation notes" } }
                ul { class: "note-list",
                    for note in &derived.notes {
                        li { "{note}" }
                    }
                }
            }
        }
    }
}

fn render_reference(game: &GameData) -> Element {
    rsx! {
        section { class: "panel",
            div { class: "panel-heading",
                h2 { "Class reference" }
                span { class: "pill", "chart p047 authoritative" }
            }
            p { class: "muted",
                "All 30 data classes are loaded from embedded YAML. Shard Bearer is intentionally absent from the entity set."
            }
            ul { class: "class-list",
                for class in &game.classes {
                    li { key: "{class.id}", class: "class-row",
                        div { class: "class-main",
                            strong { "{class.name}" }
                            span { class: "muted small", "{class.tier} · {class.main_stat} · {role_text(class)}" }
                        }
                        span { class: "class-prereq", "{prerequisite_text(class)}" }
                    }
                }
            }
        }
    }
}

fn build_character(
    game: &GameData,
    name: String,
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
        notes: String::new(),
        main_class: class.id.clone(),
        ancestry: som_v3::domain::character::AncestrySelection {
            primary: ancestry.id.clone(),
            hybrid: None,
        },
        backgrounds: vec![som_v3::domain::character::BackgroundSelection {
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

fn class_label(game: &GameData, character: &CharacterV1) -> String {
    game.class(&character.main_class)
        .map(|class| class.name.clone())
        .unwrap_or_else(|| character.main_class.clone())
}

fn ancestry_label(game: &GameData, character: &CharacterV1) -> String {
    game.ancestry(&character.ancestry.primary)
        .map(|ancestry| ancestry.name.clone())
        .unwrap_or_else(|| character.ancestry.primary.clone())
}

fn class_level(character: &CharacterV1) -> u8 {
    character
        .classes
        .iter()
        .find(|track| track.role == ClassRole::Main)
        .map(|track| track.level)
        .unwrap_or_default()
}

fn inventory_name(game: &GameData, entry: &InventoryEntry) -> String {
    entry
        .item
        .as_deref()
        .and_then(|id| game.item(id))
        .map(|item| item.name.clone())
        .or_else(|| entry.custom_name.clone())
        .unwrap_or_else(|| "Unknown item".to_string())
}

fn equipment_value(value: &Option<String>) -> String {
    value.clone().unwrap_or_else(|| "—".to_string())
}

fn join_or_dash(values: &[String]) -> String {
    if values.is_empty() {
        "—".to_string()
    } else {
        values.join(", ")
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
        return "No stat modifiers".to_string();
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
        "No expertise modifiers".to_string()
    } else {
        values.join(", ")
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

fn prerequisite_text(class: &Class) -> String {
    if class.prerequisites.is_empty() {
        return "Starter".to_string();
    }

    class
        .prerequisites
        .iter()
        .map(|prerequisite| match prerequisite.kind {
            som_v3::domain::enums::PrerequisiteKind::Class => format!(
                "{} {}",
                prerequisite.class.as_deref().unwrap_or("unknown"),
                prerequisite.level
            ),
            som_v3::domain::enums::PrerequisiteKind::AnyStarter => {
                format!("any starter {}", prerequisite.level)
            }
        })
        .collect::<Vec<_>>()
        .join(" + ")
}

fn join_numbers(values: &[u8]) -> String {
    values
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>()
        .join(", ")
}

fn tab_class(active: bool) -> &'static str {
    if active {
        "tab active"
    } else {
        "tab"
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
