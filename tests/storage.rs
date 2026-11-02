use som_v3::domain::character::SCHEMA_VERSION;
use som_v3::domain::storage::{CharacterStore, MemoryStore, StorageError};
use som_v3::domain::GameData;

fn template() -> som_v3::domain::character::CharacterV1 {
    GameData::load_embedded()
        .expect("embedded config should load")
        .character_template
}

#[test]
fn memory_store_round_trips_characters() {
    let store = MemoryStore::new();
    let character = template();

    assert!(store.list().unwrap().is_empty());
    store.save(&character).unwrap();

    let saved = store
        .get(&character.id)
        .unwrap()
        .expect("character should exist");
    assert_eq!(saved, character);
    assert_eq!(store.list().unwrap().len(), 1);

    store.delete(&character.id).unwrap();
    assert!(store.list().unwrap().is_empty());
}

#[test]
fn saving_same_id_replaces_instead_of_duplicating() {
    let store = MemoryStore::new();
    let mut character = template();
    store.save(&character).unwrap();

    character.name = "Renamed".into();
    store.save(&character).unwrap();

    let characters = store.list().unwrap();
    assert_eq!(characters.len(), 1);
    assert_eq!(characters[0].name, "Renamed");
}

#[test]
fn unsupported_schema_versions_are_rejected() {
    let store = MemoryStore::new();
    let mut character = template();
    character.schema_version = SCHEMA_VERSION + 1;

    assert!(matches!(
        store.save(&character),
        Err(StorageError::UnsupportedVersion(_))
    ));
}

#[test]
fn character_json_round_trips() {
    let character = template();
    let json = serde_json::to_string(&character).expect("character should serialize");
    let parsed: som_v3::domain::character::CharacterV1 =
        serde_json::from_str(&json).expect("character should deserialize");
    assert_eq!(parsed, character);
}

#[test]
fn export_and_import_round_trip_characters() {
    let source = MemoryStore::new();
    let character = template();
    source.save(&character).unwrap();

    let exported = source.export_json().unwrap();
    assert!(exported.contains("Jimmy John"));

    let destination = MemoryStore::new();
    assert_eq!(destination.import_json(&exported).unwrap(), 1);
    assert_eq!(destination.list().unwrap(), vec![character]);
}

#[test]
fn import_accepts_a_single_character_object() {
    let character = template();
    let json = serde_json::to_string(&character).unwrap();
    let store = MemoryStore::new();

    assert_eq!(store.import_json(&json).unwrap(), 1);
    assert_eq!(store.list().unwrap().len(), 1);
}

#[test]
fn import_rejects_malformed_json() {
    let store = MemoryStore::new();
    assert!(matches!(
        store.import_json("not json"),
        Err(StorageError::Json(_))
    ));
}

#[test]
fn file_store_round_trips_without_browser_storage() {
    use som_v3::domain::storage::{AppStore, FileStore};
    use std::time::{SystemTime, UNIX_EPOCH};

    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("som-v3-test-{}-{unique}", std::process::id()));
    let path = dir.join("characters.json");

    let character = template();
    let file_store = FileStore::new(&path);
    file_store.save(&character).unwrap();
    assert_eq!(file_store.list().unwrap(), vec![character.clone()]);
    assert_eq!(
        file_store.get(&character.id).unwrap(),
        Some(character.clone())
    );

    let app_store = AppStore::File(FileStore::new(&path));
    assert_eq!(app_store.list().unwrap(), vec![character.clone()]);
    app_store.delete(&character.id).unwrap();
    assert!(app_store.list().unwrap().is_empty());

    let _ = std::fs::remove_dir_all(&dir);
}
