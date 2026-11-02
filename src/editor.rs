use dioxus::prelude::*;

use som_v3::domain::character::{
    CharacterV1, ChosenAbility, ClassTrack, InventoryEntry, StatusEntry,
};
use som_v3::domain::enums::{ClassRole, GearSlot, RequirementKind, Stat, StatusKind};
use som_v3::domain::{derive_character, AppStore, CharacterStore, GameData};

const STATUS_KINDS: [StatusKind; 5] = [
    StatusKind::Boon,
    StatusKind::Condition,
    StatusKind::Dot,
    StatusKind::State,
    StatusKind::Other,
];

#[component]
pub(crate) fn CharacterEditorScreen(
    game: GameData,
    character: CharacterV1,
    store: AppStore,
    on_saved: EventHandler<String>,
    on_cancel: EventHandler<()>,
) -> Element {
    let mut draft = use_signal(|| character.clone());
    let mut error = use_signal(|| None::<String>);

    let mut new_status_name = use_signal(String::new);
    let mut new_status_kind = use_signal(|| StatusKind::Condition);
    let mut new_item_id = use_signal(|| {
        game.items
            .first()
            .map(|item| item.id.clone())
            .unwrap_or_default()
    });
    let mut new_item_qty = use_signal(|| 1u16);
    let mut new_custom_item = use_signal(String::new);
    let mut new_custom_qty = use_signal(|| 1u16);
    let mut new_accessory = use_signal(|| {
        game.items
            .iter()
            .find(|item| item.slot == GearSlot::Accessory)
            .map(|item| item.id.clone())
            .unwrap_or_default()
    });
    let initial_class = {
        let existing = character
            .classes
            .iter()
            .map(|track| track.class.as_str())
            .collect::<Vec<_>>();
        game.classes
            .iter()
            .find(|class| !existing.contains(&class.id.as_str()))
            .map(|class| class.id.clone())
            .unwrap_or_default()
    };
    let mut new_class_id = use_signal(|| initial_class);
    let mut new_non_combat = use_signal(String::new);
    let mut new_combat = use_signal(String::new);

    let derived = derive_character(&game, &draft());
    let error_text = error();
    let max_pips = game.rules.party_levels.stat_pips.max_per_main_stat;
    let class_level_max = game.rules.class_progression.class_level_max;
    let background_tiers = game.rules.party_levels.background_ability_tiers.clone();
    let existing_classes = draft()
        .classes
        .iter()
        .map(|track| track.class.clone())
        .collect::<Vec<_>>();
    let store_top = store.clone();
    let store_bottom = store.clone();

    rsx! {
        section { class: "panel sheet-header",
            div {
                p { class: "eyebrow", "Edit character" }
                h2 { "{draft().name}" }
                p { class: "muted", "Changes are local until you save." }
            }
            div { class: "button-row",
                button {
                    class: "primary compact",
                    onclick: move |_| save_character(draft, &store_top, on_saved, error),
                    "Save changes"
                }
                button {
                    class: "secondary compact",
                    onclick: move |_| on_cancel.call(()),
                    "Cancel"
                }
            }
        }

        if let Some(message) = error_text {
            div { class: "notice danger-notice", role: "alert", "{message}" }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Derived preview" } }
            div { class: "stat-grid",
                article { class: "stat-card",
                    span { class: "stat-label", "Max HP" }
                    strong { class: "stat-value", "{derived.max_hp}" }
                    span { class: "stat-detail", "provisional rules" }
                }
                article { class: "stat-card",
                    span { class: "stat-label", "Current HP" }
                    strong { class: "stat-value", "{draft().resources.current_hp}" }
                    span { class: "stat-detail", "manual" }
                }
                article { class: "stat-card",
                    span { class: "stat-label", "Party level" }
                    strong { class: "stat-value", "{draft().party_level}" }
                    span { class: "stat-detail", "P.LVL" }
                }
                article { class: "stat-card",
                    span { class: "stat-label", "Class levels" }
                    strong { class: "stat-value", "{draft().classes.len()}" }
                    span { class: "stat-detail", "tracks" }
                }
            }
            div { class: "stat-chip-grid preview-chips",
                for stat in Stat::MAIN {
                    div { class: "stat-chip",
                        span { "{stat}" }
                        strong { "{derived.main.get(&stat).copied().unwrap_or_default()}" }
                    }
                }
                for stat in Stat::BONUS {
                    div { class: "stat-chip",
                        span { "{stat}" }
                        strong { "{derived.bonus.get(&stat).copied().unwrap_or_default()}" }
                    }
                }
            }
            if !derived.notes.is_empty() {
                ul { class: "note-list",
                    for note in &derived.notes {
                        li { "{note}" }
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Identity" } }
            div { class: "form",
                label { class: "field",
                    span { "Name" }
                    input {
                        r#type: "text",
                        value: "{draft().name}",
                        oninput: move |event| {
                            let mut character = draft();
                            character.name = event.value();
                            draft.set(character);
                        },
                    }
                }
                label { class: "field",
                    span { "Notes" }
                    textarea {
                        rows: "4",
                        value: "{draft().notes}",
                        oninput: move |event| {
                            let mut character = draft();
                            character.notes = event.value();
                            draft.set(character);
                        },
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Resources" } }
            div { class: "form-grid",
                label { class: "field",
                    span { "Current HP" }
                    input {
                        r#type: "number",
                        value: "{draft().resources.current_hp}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<i32>() {
                                let mut character = draft();
                                character.resources.current_hp = value;
                                draft.set(character);
                            }
                        },
                    }
                }
                label { class: "field",
                    span { "Energy" }
                    input {
                        r#type: "number",
                        value: "{draft().resources.energy}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<i32>() {
                                let mut character = draft();
                                character.resources.energy = value;
                                draft.set(character);
                            }
                        },
                    }
                }
                label { class: "field",
                    span { "Exhaustion" }
                    input {
                        r#type: "number",
                        value: "{draft().resources.exhaustion}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<i32>() {
                                let mut character = draft();
                                character.resources.exhaustion = value;
                                draft.set(character);
                            }
                        },
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Leveling" } }
            div { class: "form-grid",
                label { class: "field",
                    span { "Party level" }
                    input {
                        r#type: "number",
                        min: "0",
                        value: "{draft().party_level}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u8>() {
                                let mut character = draft();
                                character.party_level = value;
                                draft.set(character);
                            }
                        },
                    }
                }
                label { class: "field",
                    span { "Gold" }
                    input {
                        r#type: "number",
                        min: "0",
                        value: "{draft().currency.gold}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u32>() {
                                let mut character = draft();
                                character.currency.gold = value;
                                draft.set(character);
                            }
                        },
                    }
                }
                label { class: "field",
                    span { "Shards" }
                    input {
                        r#type: "number",
                        min: "0",
                        value: "{draft().currency.shards}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u32>() {
                                let mut character = draft();
                                character.currency.shards = value;
                                draft.set(character);
                            }
                        },
                    }
                }
            }

            h3 { class: "section-title", "Stat pips" }
            p { class: "muted small", "Maximum {max_pips} per main stat." }
            div { class: "level-list",
                for stat in Stat::MAIN {
                    {
                        let pips = draft().stat_pips.get(&stat).copied().unwrap_or_default();
                        rsx! {
                            div { key: "{stat}", class: "level-row",
                                span { "{stat}" }
                                button {
                                    class: "tiny",
                                    disabled: pips == 0,
                                    onclick: move |_| {
                                        let mut character = draft();
                                        let value = character.stat_pips.entry(stat).or_insert(0);
                                        *value = value.saturating_sub(1);
                                        draft.set(character);
                                    },
                                    "−"
                                }
                                strong { "{pips}" }
                                button {
                                    class: "tiny",
                                    disabled: pips >= max_pips,
                                    onclick: move |_| {
                                        let mut character = draft();
                                        let value = character.stat_pips.entry(stat).or_insert(0);
                                        *value = (*value + 1).min(max_pips);
                                        draft.set(character);
                                    },
                                    "+"
                                }
                            }
                        }
                    }
                }
            }

            h3 { class: "section-title", "Class tracks" }
            p { class: "muted small", "Class level cap is {class_level_max}. Unlocks are manual." }
            for (track_index, track) in draft().classes.iter().enumerate() {
                {
                    let class_name = game
                        .class(&track.class)
                        .map(|class| class.name.clone())
                        .unwrap_or_else(|| track.class.clone());
                    let track_class = game.class(&track.class);
                    let is_sub = track.role == ClassRole::Sub;
                    rsx! {
                        div { key: "{track.class}", class: "track-card",
                            div { class: "level-row",
                                span { "{class_name}" }
                                span { class: "pill", "{track.role}" }
                                button {
                                    class: "tiny",
                                    disabled: track.level == 0,
                                    onclick: move |_| {
                                        let mut character = draft();
                                        let track = &mut character.classes[track_index];
                                        track.level = track.level.saturating_sub(1);
                                        draft.set(character);
                                    },
                                    "−"
                                }
                                strong { "{track.level}" }
                                button {
                                    class: "tiny",
                                    disabled: track.level >= class_level_max,
                                    onclick: move |_| {
                                        let mut character = draft();
                                        let track = &mut character.classes[track_index];
                                        track.level = (track.level + 1).min(class_level_max);
                                        draft.set(character);
                                    },
                                    "+"
                                }
                                label { class: "inline-field",
                                    span { "X" }
                                    input {
                                        r#type: "number",
                                        min: "1",
                                        value: "{track.x}",
                                        oninput: move |event| {
                                            if let Ok(value) = event.value().parse::<u8>() {
                                                let mut character = draft();
                                                character.classes[track_index].x = value.max(1);
                                                draft.set(character);
                                            }
                                        },
                                    }
                                }
                                if is_sub {
                                    button {
                                        class: "danger tiny",
                                        onclick: move |_| {
                                            let mut character = draft();
                                            if track_index < character.classes.len() {
                                                character.classes.remove(track_index);
                                            }
                                            draft.set(character);
                                        },
                                        "Remove"
                                    }
                                }
                            }
                            if let Some(class) = track_class {
                                details { class: "unlock-details",
                                    summary { "Actions and passives" }
                                    div { class: "checkbox-grid",
                                        for action in &class.actions {
                                            {
                                                let action_name = action.name.clone();
                                                let checked = track.unlocked_actions.iter().any(|name| name == &action.name);
                                                rsx! {
                                                    label { class: "check-row",
                                                        input {
                                                            r#type: "checkbox",
                                                            checked,
                                                            onchange: move |_| toggle_action(draft, track_index, action_name.clone()),
                                                        }
                                                        span { "{action.name}" }
                                                    }
                                                }
                                            }
                                        }
                                        for passive in &class.passives {
                                            {
                                                let passive_name = passive.name.clone();
                                                let checked = track.unlocked_passives.iter().any(|name| name == &passive.name);
                                                rsx! {
                                                    label { class: "check-row",
                                                        input {
                                                            r#type: "checkbox",
                                                            checked,
                                                            onchange: move |_| toggle_passive(draft, track_index, passive_name.clone()),
                                                        }
                                                        span { "{passive.name}" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            div { class: "form-grid add-row",
                label { class: "field",
                    span { "Add class track" }
                    select {
                        value: "{new_class_id}",
                        onchange: move |event| new_class_id.set(event.value()),
                        for class in &game.classes {
                            if !existing_classes.contains(&class.id) {
                                option { value: "{class.id}", "{class.name}" }
                            }
                        }
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let class_id = new_class_id();
                        if class_id.is_empty() {
                            return;
                        }
                        let mut character = draft();
                        if !character.classes.iter().any(|track| track.class == class_id) {
                            character.classes.push(ClassTrack {
                                class: class_id,
                                role: ClassRole::Sub,
                                level: 1,
                                x: 1,
                                unlocked_actions: Vec::new(),
                                unlocked_passives: Vec::new(),
                            });
                            draft.set(character);
                        }
                    },
                    "Add subclass"
                }
            }

            h3 { class: "section-title", "Background abilities" }
            if draft().backgrounds.is_empty() {
                p { class: "muted small", "No background selected." }
            } else {
                for (background_index, selection) in draft().backgrounds.iter().enumerate() {
                    if let Some(background) = game.background(&selection.background) {
                        div { key: "{selection.background}", class: "track-card",
                            div { class: "level-row",
                                strong { "{background.name}" }
                                span { class: "pill", "background" }
                            }
                            for tier in &background_tiers {
                                {
                                    let tier = *tier;
                                    let unlocked = draft().party_level >= tier;
                                    let current = selection
                                        .chosen_abilities
                                        .iter()
                                        .find(|chosen| chosen.party_level == tier)
                                        .map(|chosen| chosen.ability.clone())
                                        .unwrap_or_default();
                                    rsx! {
                                        div { key: "{tier}", class: "level-row",
                                            span { "P.LVL {tier}" }
                                            if unlocked {
                                                select {
                                                    value: "{current}",
                                                    onchange: move |event| {
                                                        let value = event.value();
                                                        let mut character = draft();
                                                        let selection = &mut character.backgrounds[background_index];
                                                        selection.chosen_abilities.retain(|chosen| chosen.party_level != tier);
                                                        if !value.is_empty() {
                                                            selection.chosen_abilities.push(ChosenAbility {
                                                                party_level: tier,
                                                                ability: value,
                                                            });
                                                        }
                                                        draft.set(character);
                                                    },
                                                    option { value: "", "—" }
                                                    for passive in &background.passives {
                                                        if passive.requirements.iter().any(|requirement| {
                                                            requirement.kind == RequirementKind::PartyLevel
                                                                && requirement.level == Some(tier)
                                                        }) {
                                                            option { value: "{passive.name}", "{passive.name}" }
                                                        }
                                                    }
                                                }
                                            } else {
                                                span { class: "muted small", "locked" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Statuses" } }
            div { class: "level-list",
                for (index, status) in draft().statuses.iter().enumerate() {
                    div { key: "{index}", class: "level-row",
                        span { "{status.name}" }
                        span { class: "pill", "{status.kind}" }
                        button {
                            class: "danger tiny",
                            onclick: move |_| {
                                let mut character = draft();
                                character.statuses.remove(index);
                                draft.set(character);
                            },
                            "Remove"
                        }
                    }
                }
            }
            div { class: "form-grid add-row",
                label { class: "field",
                    span { "New status" }
                    input {
                        r#type: "text",
                        placeholder: "e.g. Inspired",
                        value: "{new_status_name}",
                        oninput: move |event| new_status_name.set(event.value()),
                    }
                }
                label { class: "field",
                    span { "Kind" }
                    select {
                        value: "{new_status_kind}",
                        onchange: move |event| {
                            if let Some(kind) = status_kind(&event.value()) {
                                new_status_kind.set(kind);
                            }
                        },
                        for kind in STATUS_KINDS {
                            option { value: "{kind}", "{kind}" }
                        }
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let name = new_status_name().trim().to_string();
                        if name.is_empty() {
                            error.set(Some("Status name is required.".into()));
                            return;
                        }
                        let mut character = draft();
                        character.statuses.push(StatusEntry {
                            id: slugify(&name),
                            name,
                            kind: new_status_kind(),
                            note: String::new(),
                        });
                        draft.set(character);
                        new_status_name.set(String::new());
                    },
                    "Add status"
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Equipment" } }
            div { class: "form-grid",
                label { class: "field",
                    span { "Main hand" }
                    select {
                        value: "{draft().equipment.main_hand.clone().unwrap_or_default()}",
                        onchange: move |event| {
                            let value = event.value();
                            let mut character = draft();
                            character.equipment.main_hand = optional(value);
                            draft.set(character);
                        },
                        option { value: "", "—" }
                        for item in game.items.iter().filter(|item| item.slot == GearSlot::MainHand) {
                            option { value: "{item.id}", "{item.name}" }
                        }
                    }
                }
                label { class: "field",
                    span { "Armor" }
                    select {
                        value: "{draft().equipment.armor.clone().unwrap_or_default()}",
                        onchange: move |event| {
                            let value = event.value();
                            let mut character = draft();
                            character.equipment.armor = optional(value);
                            draft.set(character);
                        },
                        option { value: "", "—" }
                        for item in game.items.iter().filter(|item| item.slot == GearSlot::Armor) {
                            option { value: "{item.id}", "{item.name}" }
                        }
                    }
                }
                label { class: "field",
                    span { "Off hand" }
                    select {
                        value: "{draft().equipment.off_hand.clone().unwrap_or_default()}",
                        onchange: move |event| {
                            let value = event.value();
                            let mut character = draft();
                            character.equipment.off_hand = optional(value);
                            draft.set(character);
                        },
                        option { value: "", "—" }
                        for item in game.items.iter().filter(|item| item.slot == GearSlot::OffHand) {
                            option { value: "{item.id}", "{item.name}" }
                        }
                    }
                }
            }
            div { class: "level-list",
                for (index, accessory) in draft().equipment.accessories.iter().enumerate() {
                    div { key: "{index}", class: "level-row",
                        span { "{item_name(&game, accessory)}" }
                        button {
                            class: "danger tiny",
                            onclick: move |_| {
                                let mut character = draft();
                                character.equipment.accessories.remove(index);
                                draft.set(character);
                            },
                            "Remove"
                        }
                    }
                }
            }
            div { class: "form-grid add-row",
                label { class: "field",
                    span { "Add accessory" }
                    select {
                        value: "{new_accessory}",
                        onchange: move |event| new_accessory.set(event.value()),
                        for item in game.items.iter().filter(|item| item.slot == GearSlot::Accessory) {
                            option { value: "{item.id}", "{item.name}" }
                        }
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let id = new_accessory();
                        if id.is_empty() {
                            return;
                        }
                        let mut character = draft();
                        if !character.equipment.accessories.contains(&id) {
                            character.equipment.accessories.push(id);
                            draft.set(character);
                        }
                    },
                    "Add accessory"
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Inventory" } }
            div { class: "level-list",
                for (index, entry) in draft().inventory.iter().enumerate() {
                    div { key: "{index}", class: "inventory-row",
                        span { "{inventory_name(&game, entry)}" }
                        input {
                            r#type: "number",
                            min: "1",
                            value: "{entry.quantity}",
                            oninput: move |event| {
                                if let Ok(value) = event.value().parse::<u16>() {
                                    let mut character = draft();
                                    character.inventory[index].quantity = value.max(1);
                                    draft.set(character);
                                }
                            },
                        }
                        button {
                            class: "danger tiny",
                            onclick: move |_| {
                                let mut character = draft();
                                character.inventory.remove(index);
                                draft.set(character);
                            },
                            "Remove"
                        }
                    }
                }
            }
            div { class: "form-grid add-row",
                label { class: "field",
                    span { "Item" }
                    select {
                        value: "{new_item_id}",
                        onchange: move |event| new_item_id.set(event.value()),
                        for item in &game.items {
                            option { value: "{item.id}", "{item.name}" }
                        }
                    }
                }
                label { class: "field",
                    span { "Qty" }
                    input {
                        r#type: "number",
                        min: "1",
                        value: "{new_item_qty}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u16>() {
                                new_item_qty.set(value.max(1));
                            }
                        },
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let item_id = new_item_id();
                        if item_id.is_empty() {
                            return;
                        }
                        let quantity = new_item_qty().max(1);
                        let mut character = draft();
                        if let Some(entry) = character
                            .inventory
                            .iter_mut()
                            .find(|entry| entry.item.as_deref() == Some(item_id.as_str()))
                        {
                            entry.quantity = entry.quantity.saturating_add(quantity);
                        } else {
                            character.inventory.push(InventoryEntry {
                                item: Some(item_id),
                                quantity,
                                custom_name: None,
                            });
                        }
                        draft.set(character);
                    },
                    "Add item"
                }
            }
            div { class: "form-grid add-row",
                label { class: "field",
                    span { "Custom item" }
                    input {
                        r#type: "text",
                        placeholder: "Item name",
                        value: "{new_custom_item}",
                        oninput: move |event| new_custom_item.set(event.value()),
                    }
                }
                label { class: "field",
                    span { "Qty" }
                    input {
                        r#type: "number",
                        min: "1",
                        value: "{new_custom_qty}",
                        oninput: move |event| {
                            if let Ok(value) = event.value().parse::<u16>() {
                                new_custom_qty.set(value.max(1));
                            }
                        },
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let name = new_custom_item().trim().to_string();
                        if name.is_empty() {
                            return;
                        }
                        let mut character = draft();
                        character.inventory.push(InventoryEntry {
                            item: None,
                            quantity: new_custom_qty().max(1),
                            custom_name: Some(name),
                        });
                        draft.set(character);
                        new_custom_item.set(String::new());
                    },
                    "Add custom"
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Slotted passives" } }
            p { class: "muted small", "Names only in this slice; the slot counts come from party-level rules." }
            div { class: "form-grid",
                label { class: "field",
                    span { "Non-combat" }
                    input {
                        r#type: "text",
                        placeholder: "Passive name",
                        value: "{new_non_combat}",
                        oninput: move |event| new_non_combat.set(event.value()),
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let name = new_non_combat().trim().to_string();
                        if name.is_empty() {
                            return;
                        }
                        let mut character = draft();
                        character.passive_slots.non_combat.push(name);
                        draft.set(character);
                        new_non_combat.set(String::new());
                    },
                    "Add"
                }
            }
            div { class: "level-list",
                for (index, passive) in draft().passive_slots.non_combat.iter().enumerate() {
                    div { key: "{index}", class: "level-row",
                        span { "{passive}" }
                        button {
                            class: "danger tiny",
                            onclick: move |_| {
                                let mut character = draft();
                                character.passive_slots.non_combat.remove(index);
                                draft.set(character);
                            },
                            "Remove"
                        }
                    }
                }
            }
            div { class: "form-grid add-row",
                label { class: "field",
                    span { "Combat" }
                    input {
                        r#type: "text",
                        placeholder: "Passive name",
                        value: "{new_combat}",
                        oninput: move |event| new_combat.set(event.value()),
                    }
                }
                button {
                    class: "secondary",
                    onclick: move |_| {
                        let name = new_combat().trim().to_string();
                        if name.is_empty() {
                            return;
                        }
                        let mut character = draft();
                        character.passive_slots.combat.push(name);
                        draft.set(character);
                        new_combat.set(String::new());
                    },
                    "Add"
                }
            }
            div { class: "level-list",
                for (index, passive) in draft().passive_slots.combat.iter().enumerate() {
                    div { key: "{index}", class: "level-row",
                        span { "{passive}" }
                        button {
                            class: "danger tiny",
                            onclick: move |_| {
                                let mut character = draft();
                                character.passive_slots.combat.remove(index);
                                draft.set(character);
                            },
                            "Remove"
                        }
                    }
                }
            }
        }

        div { class: "button-row save-bar",
            button {
                class: "primary",
                onclick: move |_| save_character(draft, &store_bottom, on_saved, error),
                "Save changes"
            }
            button {
                class: "secondary",
                onclick: move |_| on_cancel.call(()),
                "Cancel"
            }
        }
    }
}

fn save_character(
    draft: Signal<CharacterV1>,
    store: &AppStore,
    on_saved: EventHandler<String>,
    mut error: Signal<Option<String>>,
) {
    let character = draft();
    if character.name.trim().is_empty() {
        error.set(Some("Character name is required.".into()));
        return;
    }
    match store.save(&character) {
        Ok(()) => on_saved.call(character.id),
        Err(save_error) => error.set(Some(save_error.to_string())),
    }
}

fn toggle_action(mut draft: Signal<CharacterV1>, track_index: usize, name: String) {
    let mut character = draft();
    if let Some(track) = character.classes.get_mut(track_index) {
        toggle_named(&mut track.unlocked_actions, &name);
    }
    draft.set(character);
}

fn toggle_passive(mut draft: Signal<CharacterV1>, track_index: usize, name: String) {
    let mut character = draft();
    if let Some(track) = character.classes.get_mut(track_index) {
        toggle_named(&mut track.unlocked_passives, &name);
    }
    draft.set(character);
}

fn toggle_named(values: &mut Vec<String>, name: &str) {
    if let Some(index) = values.iter().position(|value| value == name) {
        values.remove(index);
    } else {
        values.push(name.to_string());
    }
}

fn optional(value: String) -> Option<String> {
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn status_kind(value: &str) -> Option<StatusKind> {
    STATUS_KINDS.into_iter().find(|kind| kind.as_str() == value)
}

fn item_name(game: &GameData, id: &str) -> String {
    game.item(id)
        .map(|item| item.name.clone())
        .unwrap_or_else(|| id.to_string())
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
        "status".to_string()
    } else {
        slug
    }
}
