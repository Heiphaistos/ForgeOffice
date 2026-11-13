// Registre des chemins que la page web a le droit de faire lire ou ecrire.
// Un chemin n'y entre que par la coquille : dialogue natif, ligne de commande / association
// de fichiers, liste des recents, ou fichier deja enregistre. La page ne peut jamais y ajouter
// un chemin de son propre chef : un `readFile("C:/Windows/...")` venu d'un script est refuse.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub struct Grants {
    keys: Mutex<HashSet<String>>,
    /// Dossiers racines ouverts par la coquille (explorateur) : la page n'y accede que par chemin relatif.
    folders: Mutex<HashSet<String>>,
}

impl Grants {
    pub fn grant(&self, path: &str) {
        if let Some(key) = key_of(path) {
            lock(&self.keys).insert(key);
        }
    }

    pub fn allows(&self, path: &str) -> bool {
        key_of(path).is_some_and(|key| lock(&self.keys).contains(&key))
    }

    pub fn grant_folder(&self, path: &str) {
        if let Some(key) = key_of(path) {
            lock(&self.folders).insert(key);
        }
    }

    pub fn allows_folder(&self, path: &str) -> bool {
        key_of(path).is_some_and(|key| lock(&self.folders).contains(&key))
    }

    pub fn revoke(&self, path: &str) {
        if let Some(key) = key_of(path) {
            lock(&self.keys).remove(&key);
        }
    }
}

/// Verrou qui survit a un panic d'un autre fil (les donnees restent coherentes : ensembles et listes).
pub fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(std::sync::PoisonError::into_inner)
}

/// URL de contenu (Android `content://`, iOS `file://`) : gardee telle quelle.
pub fn is_url(path: &str) -> bool {
    match path.split_once("://") {
        Some((scheme, _)) => scheme.len() > 1 && scheme.chars().all(|c| c.is_ascii_alphanumeric() || "+-.".contains(c)),
        None => false,
    }
}

/// Cle de comparaison : chemin absolu, resolu (`..`, liens), insensible a la casse sous Windows.
/// None pour un chemin relatif ou vide, qui n'est jamais autorise.
pub fn key_of(path: &str) -> Option<String> {
    if path.is_empty() || path.contains('\0') {
        return None;
    }
    if is_url(path) {
        return Some(path.to_string());
    }
    let raw = Path::new(path);
    if !raw.is_absolute() {
        return None;
    }
    let resolved = normalize(raw);
    let text = resolved.to_string_lossy().to_string();
    Some(if cfg!(windows) { text.to_lowercase() } else { text })
}

/// Resout le chemin sur le disque (ou son dossier parent pour un fichier pas encore cree).
pub fn normalize(path: &Path) -> PathBuf {
    if let Ok(full) = std::fs::canonicalize(path) {
        return simplify(full);
    }
    if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
        if let Ok(dir) = std::fs::canonicalize(parent) {
            return simplify(dir).join(name);
        }
    }
    lexical(path)
}

/// Retire le prefixe `\?\` que `canonicalize` ajoute sous Windows.
fn simplify(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy();
    if let Some(rest) = text.strip_prefix(r"\?\UNC\") {
        return PathBuf::from(format!(r"\{rest}"));
    }
    if let Some(rest) = text.strip_prefix(r"\?\") {
        return PathBuf::from(rest);
    }
    path
}

/// Normalisation sans acces disque : retire `.` et resout `..`.
fn lexical(path: &Path) -> PathBuf {
    use std::path::Component;
    let mut out = PathBuf::new();
    for part in path.components() {
        match part {
            Component::CurDir => {}
            Component::ParentDir => {
                out.pop();
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fo-grants-{name}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn un_chemin_autorise_est_reconnu() {
        let dir = temp_dir("ok");
        let file = dir.join("rapport.docx");
        std::fs::write(&file, b"x").unwrap();
        let grants = Grants::default();
        let path = file.to_string_lossy().to_string();
        assert!(!grants.allows(&path));
        grants.grant(&path);
        assert!(grants.allows(&path));
        grants.revoke(&path);
        assert!(!grants.allows(&path));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_detour_par_dossier_parent_designe_le_meme_fichier() {
        let dir = temp_dir("parent");
        std::fs::create_dir_all(dir.join("sous")).unwrap();
        let file = dir.join("a.xlsx");
        std::fs::write(&file, b"x").unwrap();
        let grants = Grants::default();
        grants.grant(&file.to_string_lossy());
        let detour = dir.join("sous").join("..").join("a.xlsx");
        assert!(grants.allows(&detour.to_string_lossy()));
        assert!(!grants.allows(&dir.join("b.xlsx").to_string_lossy()));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_dossier_autorise_n_autorise_pas_les_fichiers_ni_l_inverse() {
        let dir = temp_dir("racine");
        let file = dir.join("a.md");
        std::fs::write(&file, b"x").unwrap();
        let grants = Grants::default();
        grants.grant_folder(&dir.to_string_lossy());
        assert!(grants.allows_folder(&dir.to_string_lossy()));
        assert!(!grants.allows(&file.to_string_lossy()), "un dossier ouvert ne donne pas la lecture libre de read_path");
        assert!(!grants.allows_folder(&dir.join("sous").to_string_lossy()), "seule la racine choisie est autorisee");
        assert!(!grants.allows_folder("relatif"));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_voisin_ou_un_dossier_n_est_pas_autorise() {
        let dir = temp_dir("voisin");
        let file = dir.join("a.docx");
        std::fs::write(&file, b"x").unwrap();
        let grants = Grants::default();
        grants.grant(&file.to_string_lossy());
        assert!(!grants.allows(&dir.to_string_lossy()));
        assert!(!grants.allows(&dir.join("a.docx.bak").to_string_lossy()));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn les_chemins_relatifs_vides_ou_nuls_sont_refuses() {
        let grants = Grants::default();
        grants.grant("rapport.docx");
        grants.grant("");
        assert!(!grants.allows("rapport.docx"));
        assert!(!grants.allows(""));
        assert!(!grants.allows("C:/a\0b"));
        assert_eq!(key_of("../etc/passwd"), None);
    }

    #[test]
    fn un_fichier_pas_encore_cree_est_autorise_par_son_dossier() {
        let dir = temp_dir("nouveau");
        let grants = Grants::default();
        let file = dir.join("nouveau.pptx");
        grants.grant(&file.to_string_lossy());
        std::fs::write(&file, b"x").unwrap();
        assert!(grants.allows(&file.to_string_lossy()));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn les_url_de_contenu_mobiles_sont_comparees_telles_quelles() {
        let grants = Grants::default();
        let uri = "content://com.android.providers.documents/document/42";
        grants.grant(uri);
        assert!(grants.allows(uri));
        assert!(!grants.allows("content://com.android.providers.documents/document/43"));
        assert!(!is_url(r"C:\Users\a.docx"));
        assert!(is_url("file:///tmp/a.docx"));
    }

    #[cfg(windows)]
    #[test]
    fn sous_windows_la_casse_est_ignoree() {
        let dir = temp_dir("casse");
        let file = dir.join("Rapport.DOCX");
        std::fs::write(&file, b"x").unwrap();
        let grants = Grants::default();
        grants.grant(&file.to_string_lossy());
        assert!(grants.allows(&file.to_string_lossy().to_uppercase()));
        std::fs::remove_dir_all(dir).unwrap();
    }
}
