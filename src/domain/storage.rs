use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::PathBuf;

use thiserror::Error;

use super::character::{CharacterV1, SCHEMA_VERSION};

pub trait CharacterStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError>;
    fn save(&self, character: &CharacterV1) -> Result<(), StorageError>;
    fn delete(&self, id: &str) -> Result<(), StorageError>;

    fn get(&self, id: &str) -> Result<Option<CharacterV1>, StorageError> {
        Ok(self
            .list()?
            .into_iter()
            .find(|character| character.id == id))
    }

    fn export_json(&self) -> Result<String, StorageError> {
        Ok(serde_json::to_string_pretty(&self.list()?)?)
    }

    fn import_json(&self, json: &str) -> Result<usize, StorageError> {
        let characters = match serde_json::from_str::<Vec<CharacterV1>>(json) {
            Ok(characters) => characters,
            Err(_) => vec![serde_json::from_str::<CharacterV1>(json)?],
        };
        for character in &characters {
            if character.schema_version != SCHEMA_VERSION {
                return Err(StorageError::UnsupportedVersion(character.schema_version));
            }
        }
        for character in &characters {
            self.save(character)?;
        }
        Ok(characters.len())
    }
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("browser storage is unavailable")]
    Unavailable,
    #[error("unsupported character schema version: {0}")]
    UnsupportedVersion(u32),
    #[error("storage backend error: {0}")]
    Backend(String),
    #[error("could not encode or decode character data: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Default)]
pub struct MemoryStore {
    characters: RefCell<BTreeMap<String, CharacterV1>>,
}

impl MemoryStore {
    pub fn new() -> Self {
        Self::default()
    }
}

impl CharacterStore for MemoryStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError> {
        Ok(sorted(self.characters.borrow().values()))
    }

    fn save(&self, character: &CharacterV1) -> Result<(), StorageError> {
        if character.schema_version != SCHEMA_VERSION {
            return Err(StorageError::UnsupportedVersion(character.schema_version));
        }
        self.characters
            .borrow_mut()
            .insert(character.id.clone(), character.clone());
        Ok(())
    }

    fn delete(&self, id: &str) -> Result<(), StorageError> {
        self.characters.borrow_mut().remove(id);
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct WebStore;

#[cfg(target_arch = "wasm32")]
impl WebStore {
    const KEY: &'static str = "som-v3.characters.v1";

    fn storage() -> Result<web_sys::Storage, StorageError> {
        web_sys::window()
            .ok_or(StorageError::Unavailable)?
            .local_storage()
            .map_err(|error| StorageError::Backend(format!("{error:?}")))?
            .ok_or(StorageError::Unavailable)
    }

    fn read_map() -> Result<BTreeMap<String, CharacterV1>, StorageError> {
        let raw = Self::storage()?
            .get_item(Self::KEY)
            .map_err(|error| StorageError::Backend(format!("{error:?}")))?;
        match raw {
            Some(raw) => Ok(serde_json::from_str(&raw)?),
            None => Ok(BTreeMap::new()),
        }
    }

    fn write_map(map: &BTreeMap<String, CharacterV1>) -> Result<(), StorageError> {
        let raw = serde_json::to_string(map)?;
        Self::storage()?
            .set_item(Self::KEY, &raw)
            .map_err(|error| StorageError::Backend(format!("{error:?}")))
    }
}

#[cfg(target_arch = "wasm32")]
impl CharacterStore for WebStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError> {
        Ok(sorted(Self::read_map()?.values()))
    }

    fn save(&self, character: &CharacterV1) -> Result<(), StorageError> {
        if character.schema_version != SCHEMA_VERSION {
            return Err(StorageError::UnsupportedVersion(character.schema_version));
        }
        let mut map = Self::read_map()?;
        map.insert(character.id.clone(), character.clone());
        Self::write_map(&map)
    }

    fn delete(&self, id: &str) -> Result<(), StorageError> {
        let mut map = Self::read_map()?;
        map.remove(id);
        Self::write_map(&map)
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl CharacterStore for WebStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError> {
        Err(StorageError::Unavailable)
    }

    fn save(&self, _character: &CharacterV1) -> Result<(), StorageError> {
        Err(StorageError::Unavailable)
    }

    fn delete(&self, _id: &str) -> Result<(), StorageError> {
        Err(StorageError::Unavailable)
    }
}

fn sorted<'a>(characters: impl Iterator<Item = &'a CharacterV1>) -> Vec<CharacterV1> {
    let mut characters = characters.cloned().collect::<Vec<_>>();
    characters.sort_by(|left, right| left.name.cmp(&right.name));
    characters
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileStore {
    path: PathBuf,
}

impl FileStore {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    #[cfg(all(
        not(target_arch = "wasm32"),
        not(any(target_os = "android", target_os = "ios"))
    ))]
    pub fn default_path() -> PathBuf {
        directories::ProjectDirs::from("dev", "shard", "som-v3")
            .map(|dirs| dirs.data_dir().join("characters.json"))
            .unwrap_or_else(|| std::env::temp_dir().join("som-v3").join("characters.json"))
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    pub fn default_path() -> PathBuf {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .unwrap_or_else(std::env::temp_dir)
            .join(".som-v3")
            .join("characters.json")
    }

    fn read_map(&self) -> Result<BTreeMap<String, CharacterV1>, StorageError> {
        if !self.path.exists() {
            return Ok(BTreeMap::new());
        }
        let raw = std::fs::read_to_string(&self.path)
            .map_err(|error| StorageError::Backend(error.to_string()))?;
        Ok(serde_json::from_str(&raw)?)
    }

    fn write_map(&self, map: &BTreeMap<String, CharacterV1>) -> Result<(), StorageError> {
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|error| StorageError::Backend(error.to_string()))?;
        }
        let raw = serde_json::to_string_pretty(map)?;
        std::fs::write(&self.path, raw).map_err(|error| StorageError::Backend(error.to_string()))
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl Default for FileStore {
    fn default() -> Self {
        Self::new(Self::default_path())
    }
}

impl CharacterStore for FileStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError> {
        Ok(sorted(self.read_map()?.values()))
    }

    fn save(&self, character: &CharacterV1) -> Result<(), StorageError> {
        if character.schema_version != SCHEMA_VERSION {
            return Err(StorageError::UnsupportedVersion(character.schema_version));
        }
        let mut map = self.read_map()?;
        map.insert(character.id.clone(), character.clone());
        self.write_map(&map)
    }

    fn delete(&self, id: &str) -> Result<(), StorageError> {
        let mut map = self.read_map()?;
        map.remove(id);
        self.write_map(&map)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AppStore {
    Web(WebStore),
    File(FileStore),
}

impl Default for AppStore {
    fn default() -> Self {
        #[cfg(target_arch = "wasm32")]
        {
            Self::Web(WebStore)
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            Self::File(FileStore::default())
        }
    }
}

impl CharacterStore for AppStore {
    fn list(&self) -> Result<Vec<CharacterV1>, StorageError> {
        match self {
            Self::Web(store) => store.list(),
            Self::File(store) => store.list(),
        }
    }

    fn save(&self, character: &CharacterV1) -> Result<(), StorageError> {
        match self {
            Self::Web(store) => store.save(character),
            Self::File(store) => store.save(character),
        }
    }

    fn delete(&self, id: &str) -> Result<(), StorageError> {
        match self {
            Self::Web(store) => store.delete(id),
            Self::File(store) => store.delete(id),
        }
    }
}
