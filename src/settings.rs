use dioxus::prelude::*;

use som_v3::domain::{AppStore, CharacterStore, GameData};

#[component]
pub(crate) fn SettingsScreen(
    game: GameData,
    store: AppStore,
    on_imported: EventHandler<()>,
) -> Element {
    let mut export_text = use_signal(|| store.export_json().unwrap_or_default());
    let mut import_text = use_signal(String::new);
    let mut message = use_signal(|| None::<String>);
    let message_text = message();
    let store_for_refresh = store.clone();
    let store_for_import = store.clone();

    rsx! {
        section { class: "panel",
            div { class: "panel-heading", h2 { "Data status" } }
            dl { class: "detail-list",
                div { dt { "Schema" } dd { "v{game.character_template.schema_version}" } }
                div { dt { "Starting gear" } dd { "{game.rules.starting_gear.status}: {game.rules.starting_gear.missing_source}" } }
                div { dt { "Status effects" } dd { "{game.rules.status_effects.status}: {game.rules.status_effects.missing_source}" } }
                div { dt { "Class unlock model" } dd { "{game.rules.class_progression.unlock_model.abilities}" } }
                div { dt { "X growth" } dd { "{game.rules.combat.x.growth} ({game.rules.combat.x.growth_formula})" } }
            }
        }

        section { class: "panel",
            div { class: "panel-heading",
                h2 { "Save export" }
                button {
                    class: "secondary compact",
                    onclick: move |_| {
                        export_text.set(store_for_refresh.export_json().unwrap_or_else(|error| error.to_string()));
                    },
                    "Refresh"
                }
            }
            p { class: "muted",
                "Copy this JSON to back up all characters. Saves are also kept locally under som-v3.characters.v1."
            }
            textarea {
                class: "code-area",
                rows: "10",
                readonly: true,
                value: "{export_text}",
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Import characters" } }
            p { class: "muted",
                "Paste an exported array or a single character object. Importing replaces characters with the same id."
            }
            textarea {
                class: "code-area",
                rows: "8",
                placeholder: "Paste character JSON here",
                value: "{import_text}",
                oninput: move |event| import_text.set(event.value()),
            }
            if let Some(message) = message_text {
                div { class: "notice", role: "status", "{message}" }
            }
            div { class: "button-row",
                button {
                    class: "primary",
                    onclick: move |_| {
                        if import_text().trim().is_empty() {
                            message.set(Some("Paste character JSON first.".into()));
                            return;
                        }
                        match store_for_import.import_json(&import_text()) {
                            Ok(count) => {
                                message.set(Some(format!("Imported {count} character(s).")));
                                export_text.set(store_for_import.export_json().unwrap_or_default());
                                on_imported.call(());
                            }
                            Err(error) => message.set(Some(error.to_string())),
                        }
                    },
                    "Import"
                }
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Install and offline" } }
            p { class: "muted",
                "Use the browser's Install app or Add to Home Screen action. After the first load, the service worker caches the app shell for offline use."
            }
            p { class: "muted small",
                "Bump CACHE_VERSION in public/sw.js whenever the shell changes."
            }
        }

        section { class: "panel",
            div { class: "panel-heading", h2 { "Storage" } }
            p { class: "muted",
                "Web builds save to localStorage under som-v3.characters.v1. Native/mobile builds save a JSON file in the app data directory. Export/import works without a server."
            }
            p { class: "muted small",
                "Mobile builds use the mobile Cargo feature and native file storage; Android/iOS toolchains live outside this devshell."
            }
            p { class: "muted small",
                "Architecture: ARCHITECTURE.md · Agent guide: AGENTS.md"
            }
        }
    }
}
