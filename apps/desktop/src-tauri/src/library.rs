// Bibliotheque privee de l'appli (mobile) : sur Android il n'y a pas de chemin de fichier, le selecteur
// du systeme donne des URI `content://`. Tout document ouvert ou recu est donc copie ici (dossier prive
// de l'appli), puis enregistre en place ; l'export vers l'exterieur passe par le systeme (Enregistrer
// sous, Partager). Ce module ne touche que le disque : il est teste sur le poste de developpement.

#![cfg_attr(not(target_os = "android"), allow(dead_code))]

use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};

/// Dossier des copies provisoires (import en cours, export en cours).
pub const STAGING: &str = ".tmp";

/// Nom de fichier sur : pas de separateur, pas de caractere de controle, 150 caracteres au plus.
pub fn clean_name(name: &str) -> String {
    let last = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = last.chars().filter(|c| !c.is_control() && !":*?\"<>|".contains(*c)).take(150).collect();
    let cleaned = cleaned.trim().trim_start_matches('.').to_string();
    if cleaned.is_empty() { "document".to_string() } else { cleaned }
}

/// Dossier provisoire de la bibliotheque (cree au besoin).
pub fn staging(library: &Path) -> io::Result<PathBuf> {
    let dir = library.join(STAGING);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Supprime les restes d'un import ou d'un export interrompu.
pub fn clear_staging(library: &Path) {
    if let Ok(entries) = fs::read_dir(library.join(STAGING)) {
        for entry in entries.flatten() {
            let _ = fs::remove_file(entry.path());
        }
    }
}

fn same_content(a: &Path, b: &Path) -> io::Result<bool> {
    if fs::metadata(a)?.len() != fs::metadata(b)?.len() {
        return Ok(false);
    }
    let (mut fa, mut fb) = (fs::File::open(a)?, fs::File::open(b)?);
    let (mut ba, mut bb) = (vec![0u8; 64 * 1024], vec![0u8; 64 * 1024]);
    loop {
        let n = fa.read(&mut ba)?;
        if n == 0 {
            return Ok(true);
        }
        fb.read_exact(&mut bb[..n])?;
        if ba[..n] != bb[..n] {
            return Ok(false);
        }
    }
}

fn candidate(library: &Path, name: &str, n: u32) -> PathBuf {
    if n <= 1 {
        return library.join(name);
    }
    match name.rsplit_once('.') {
        Some((stem, ext)) if !stem.is_empty() => library.join(format!("{stem} ({n}).{ext}")),
        _ => library.join(format!("{name} ({n})")),
    }
}

/// Range le fichier provisoire `staged` dans la bibliotheque sous `name`. Meme nom et meme contenu :
/// le document existant est reutilise ; meme nom et contenu different : `nom (2).ext` (jamais d'ecrasement).
pub fn adopt(library: &Path, staged: &Path, name: &str) -> io::Result<PathBuf> {
    let name = clean_name(name);
    for n in 1..1000 {
        let target = candidate(library, &name, n);
        match fs::symlink_metadata(&target) {
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                if fs::rename(staged, &target).is_err() {
                    fs::copy(staged, &target)?;
                    let _ = fs::remove_file(staged);
                }
                return Ok(target);
            }
            Err(e) => return Err(e),
            Ok(meta) if meta.is_file() && same_content(&target, staged)? => {
                let _ = fs::remove_file(staged);
                return Ok(target);
            }
            Ok(_) => {}
        }
    }
    Err(io::Error::new(io::ErrorKind::AlreadyExists, "trop de documents portent ce nom"))
}

/// Nom libre dans la bibliotheque pour un nouveau document vide (`Base de données (2).fodb`).
pub fn free_path(library: &Path, name: &str) -> io::Result<PathBuf> {
    let name = clean_name(name);
    (1..1000)
        .map(|n| candidate(library, &name, n))
        .find(|p| !p.exists())
        .ok_or_else(|| io::Error::new(io::ErrorKind::AlreadyExists, "trop de documents portent ce nom"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fo-lib-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn stage(lib: &Path, bytes: &[u8]) -> PathBuf {
        let p = staging(lib).unwrap().join(crate::launch::new_token());
        fs::write(&p, bytes).unwrap();
        p
    }

    #[test]
    fn noms_nettoyes() {
        assert_eq!(clean_name("../../etc/passwd"), "passwd");
        assert_eq!(clean_name("a:b*c?.docx"), "abc.docx");
        assert_eq!(clean_name(""), "document");
        assert_eq!(clean_name(".bashrc"), "bashrc");
    }

    #[test]
    fn meme_contenu_reutilise_contenu_different_numerote() {
        let lib = temp("adopt");
        let a = adopt(&lib, &stage(&lib, b"un"), "rapport.docx").unwrap();
        assert_eq!(a, lib.join("rapport.docx"));
        let same = adopt(&lib, &stage(&lib, b"un"), "rapport.docx").unwrap();
        assert_eq!(same, a);
        let other = adopt(&lib, &stage(&lib, b"deux"), "rapport.docx").unwrap();
        assert_eq!(other, lib.join("rapport (2).docx"));
        assert_eq!(fs::read(&a).unwrap(), b"un");
        assert_eq!(fs::read_dir(lib.join(STAGING)).unwrap().count(), 0);
        assert_eq!(free_path(&lib, "rapport.docx").unwrap(), lib.join("rapport (3).docx"));
        fs::remove_dir_all(lib).unwrap();
    }
}
