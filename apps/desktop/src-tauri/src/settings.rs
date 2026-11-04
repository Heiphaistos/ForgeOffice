// Reglages persistants partages par toutes les fenetres : `<dossier de donnees>/settings.json`.
// La page garde une copie en memoire (lecture synchrone du contrat `Settings`) ; chaque ecriture
// passe par ici puis est diffusee aux autres fenetres. La coquille y lit `updates.auto`.

use std::io;
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::{Map, Value};

use crate::grants::lock;

const MAX_KEY: usize = 128;
const MAX_VALUE_BYTES: usize = 256 * 1024;

pub struct SettingsStore {
    file: PathBuf,
    map: Mutex<Map<String, Value>>,
}

impl SettingsStore {
    pub fn load(file: PathBuf) -> Self {
        let map = std::fs::read(&file)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Map<String, Value>>(&bytes).ok())
            .unwrap_or_default();
        SettingsStore { file, map: Mutex::new(map) }
    }

    pub fn all(&self) -> Map<String, Value> {
        lock(&self.map).clone()
    }

    pub fn get(&self, key: &str) -> Option<Value> {
        lock(&self.map).get(key).cloned()
    }

    /// `null` efface le reglage (retour a la valeur par defaut de la page).
    pub fn set(&self, key: &str, value: Value) -> io::Result<()> {
        if key.is_empty() || key.chars().count() > MAX_KEY {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "nom de reglage invalide"));
        }
        if serde_json::to_vec(&value).map(|v| v.len()).unwrap_or(usize::MAX) > MAX_VALUE_BYTES {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "valeur de reglage trop grande"));
        }
        let mut map = lock(&self.map);
        if value.is_null() {
            map.remove(key);
        } else {
            map.insert(key.to_string(), value);
        }
        if let Some(dir) = self.file.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let json = serde_json::to_vec_pretty(&*map).map_err(io::Error::other)?;
        crate::atomic::write_atomic(&self.file, &json)
    }

    /// Verification automatique des mises a jour : active sauf si `updates.auto` vaut `false`.
    pub fn auto_updates(&self) -> bool {
        self.get("updates.auto") != Some(Value::Bool(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn reglages_persistants_et_mise_a_jour_auto() {
        let dir = std::env::temp_dir().join(format!("fo-settings-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let file = dir.join("settings.json");
        let store = SettingsStore::load(file.clone());
        assert!(store.auto_updates());
        store.set("updates.auto", json!(false)).unwrap();
        store.set("theme", json!({ "nom": "sombre" })).unwrap();
        let reloaded = SettingsStore::load(file.clone());
        assert!(!reloaded.auto_updates());
        assert_eq!(reloaded.get("theme"), Some(json!({ "nom": "sombre" })));
        reloaded.set("theme", Value::Null).unwrap();
        assert_eq!(SettingsStore::load(file).get("theme"), None);
        assert!(store.set("", json!(1)).is_err());
        assert!(store.set("x", json!("a".repeat(MAX_VALUE_BYTES))).is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
