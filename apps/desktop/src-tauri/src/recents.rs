// Fichiers recents persistants : `<dossier de donnees>/recents.json`, 50 entrees au plus,
// plus recent en tete, sans doublon. Les fichiers locaux disparus sont retires a la lecture.

use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::grants::{is_url, key_of, lock};

pub const MAX_RECENTS: usize = 50;
const MAX_NAME: usize = 260;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentFile {
    pub app: String,
    pub name: String,
    pub path: String,
    /// Millisecondes depuis l'epoque.
    pub opened_at: u64,
}

pub struct Recents {
    file: PathBuf,
    list: Mutex<Vec<RecentFile>>,
}

impl Recents {
    /// Charge la liste ; un fichier absent ou corrompu donne une liste vide.
    pub fn load(file: PathBuf) -> Self {
        let list: Vec<RecentFile> = std::fs::read(&file)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        let list = list
            .into_iter()
            .filter(|r| crate::modules::is_app_id(&r.app) && key_of(&r.path).is_some())
            .take(MAX_RECENTS)
            .collect();
        Recents { file, list: Mutex::new(list) }
    }

    pub fn paths(&self) -> Vec<String> {
        lock(&self.list).iter().map(|r| r.path.clone()).collect()
    }

    /// Liste a jour : les fichiers locaux supprimes ou deplaces en sont retires (et la liste reenregistree).
    pub fn list(&self) -> io::Result<Vec<RecentFile>> {
        let mut list = lock(&self.list);
        let before = list.len();
        list.retain(|r| still_there(&r.path));
        if list.len() != before {
            self.save(&list)?;
        }
        Ok(list.clone())
    }

    pub fn add(&self, mut entry: RecentFile) -> io::Result<()> {
        entry.name = entry.name.chars().take(MAX_NAME).collect();
        let key = key_of(&entry.path);
        let mut list = lock(&self.list);
        list.retain(|r| key_of(&r.path) != key);
        list.insert(0, entry);
        list.truncate(MAX_RECENTS);
        self.save(&list)
    }

    pub fn remove(&self, path: &str) -> io::Result<()> {
        let key = key_of(path);
        let mut list = lock(&self.list);
        list.retain(|r| key_of(&r.path) != key);
        self.save(&list)
    }

    pub fn clear(&self) -> io::Result<()> {
        let mut list = lock(&self.list);
        list.clear();
        self.save(&list)
    }

    fn save(&self, list: &[RecentFile]) -> io::Result<()> {
        if let Some(dir) = self.file.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let json = serde_json::to_vec_pretty(list).map_err(io::Error::other)?;
        crate::atomic::write_atomic(&self.file, &json)
    }
}

fn still_there(path: &str) -> bool {
    is_url(path) || Path::new(path).is_file()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup(name: &str) -> (PathBuf, Recents) {
        let dir = std::env::temp_dir().join(format!("fo-recents-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let recents = Recents::load(dir.join("donnees").join("recents.json"));
        (dir, recents)
    }

    fn entry(dir: &Path, name: &str, at: u64) -> RecentFile {
        let path = dir.join(name);
        std::fs::write(&path, b"x").unwrap();
        RecentFile { app: "word".into(), name: name.into(), path: path.to_string_lossy().into(), opened_at: at }
    }

    #[test]
    fn ajout_en_tete_sans_doublon_et_persistance() {
        let (dir, recents) = setup("ajout");
        recents.add(entry(&dir, "a.docx", 1)).unwrap();
        recents.add(entry(&dir, "b.docx", 2)).unwrap();
        recents.add(entry(&dir, "a.docx", 3)).unwrap();
        let names: Vec<String> = recents.list().unwrap().into_iter().map(|r| r.name).collect();
        assert_eq!(names, vec!["a.docx", "b.docx"]);
        let reloaded = Recents::load(dir.join("donnees").join("recents.json"));
        let list = reloaded.list().unwrap();
        assert_eq!(list.len(), 2);
        assert_eq!(list[0].opened_at, 3);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn cinquante_entrees_au_plus() {
        let (dir, recents) = setup("max");
        for i in 0..60 {
            recents.add(entry(&dir, &format!("f{i}.xlsx"), i)).unwrap();
        }
        let list = recents.list().unwrap();
        assert_eq!(list.len(), MAX_RECENTS);
        assert_eq!(list[0].name, "f59.xlsx");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn les_fichiers_disparus_sont_retires() {
        let (dir, recents) = setup("disparus");
        let a = entry(&dir, "a.pptx", 1);
        recents.add(a.clone()).unwrap();
        recents.add(entry(&dir, "b.pptx", 2)).unwrap();
        std::fs::remove_file(&a.path).unwrap();
        let list = recents.list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "b.pptx");
        assert_eq!(Recents::load(dir.join("donnees").join("recents.json")).paths().len(), 1);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn fichier_corrompu_ou_entrees_invalides_ignores() {
        let (dir, _) = setup("corrompu");
        let file = dir.join("recents.json");
        std::fs::write(&file, b"{pas du json").unwrap();
        assert!(Recents::load(file.clone()).list().unwrap().is_empty());
        let good = entry(&dir, "ok.docx", 1);
        let bad_app = RecentFile { app: "inconnu".into(), ..good.clone() };
        let relative = RecentFile { path: "relatif.docx".into(), ..good.clone() };
        std::fs::write(&file, serde_json::to_vec(&vec![bad_app, relative, good]).unwrap()).unwrap();
        let list = Recents::load(file).list().unwrap();
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].name, "ok.docx");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn vider_et_retirer() {
        let (dir, recents) = setup("vider");
        let a = entry(&dir, "a.docx", 1);
        recents.add(a.clone()).unwrap();
        recents.add(entry(&dir, "b.docx", 2)).unwrap();
        recents.remove(&a.path).unwrap();
        assert_eq!(recents.list().unwrap().len(), 1);
        recents.clear().unwrap();
        assert!(recents.list().unwrap().is_empty());
        std::fs::remove_dir_all(dir).unwrap();
    }
}
