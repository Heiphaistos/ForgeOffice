// Ecriture atomique d'un fichier : jamais de document a moitie ecrit, meme si le disque se remplit
// ou si la machine s'eteint pendant l'enregistrement.
// 1. ecrit un fichier temporaire dans le meme dossier, force sur le disque (fsync) ;
// 2. garde l'ancien contenu dans une sauvegarde cachee unique `.<nom>.<jeton>.bak` (lien dur, sinon copie) le temps de l'ecriture ;
// 3. remplace la cible par renommage (atomique sur un meme volume) ;
// 4. supprime la sauvegarde. En cas d'echec, la cible d'origine est intacte.

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

pub fn write_atomic(target: &Path, bytes: &[u8]) -> io::Result<()> {
    let dir = target.parent().filter(|d| !d.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let name = target
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "nom de fichier manquant"))?
        .to_string_lossy()
        .to_string();
    let existing = match fs::metadata(target) {
        Ok(meta) if meta.is_dir() => {
            return Err(io::Error::new(io::ErrorKind::IsADirectory, "la cible est un dossier"));
        }
        Ok(meta) if meta.permissions().readonly() => {
            return Err(io::Error::new(io::ErrorKind::PermissionDenied, "le fichier est en lecture seule"));
        }
        Ok(meta) => Some(meta),
        Err(e) if e.kind() == io::ErrorKind::NotFound => None,
        Err(e) => return Err(e),
    };

    let tmp = dir.join(format!(".{name}.{}.tmp", crate::launch::new_token()));
    if let Err(e) = write_synced(&tmp, bytes, existing.as_ref()) {
        let _ = fs::remove_file(&tmp); // nettoyage best-effort : l'erreur d'origine prime
        return Err(e);
    }

    // Nom cache et unique : un `<nom>.bak` de l'utilisateur, a cote du document, n'est jamais touche ni supprime.
    let backup = dir.join(format!(".{name}.{}.bak", crate::launch::new_token()));
    if existing.is_some() {
        if fs::hard_link(target, &backup).is_err() {
            if let Err(e) = fs::copy(target, &backup) {
                let _ = fs::remove_file(&tmp);
                return Err(e);
            }
        }
    }

    if let Err(e) = fs::rename(&tmp, target) {
        let _ = fs::remove_file(&tmp);
        let _ = fs::remove_file(&backup);
        return Err(e);
    }
    if existing.is_some() {
        let _ = fs::remove_file(&backup); // la cible est deja a jour : une sauvegarde restante ne gene pas
    }
    Ok(())
}

fn write_synced(path: &Path, bytes: &[u8], original: Option<&fs::Metadata>) -> io::Result<()> {
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()?;
    drop(file);
    if let Some(meta) = original {
        fs::set_permissions(path, meta.permissions())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fo-atomic-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn entries(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().to_string())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn cree_un_nouveau_fichier_sans_rien_laisser_autour() {
        let dir = temp_dir("nouveau");
        let file = dir.join("lettre.docx");
        write_atomic(&file, b"contenu").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"contenu");
        assert_eq!(entries(&dir), vec!["lettre.docx"]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn remplace_un_fichier_existant_et_retire_la_sauvegarde() {
        let dir = temp_dir("remplace");
        let file = dir.join("budget.xlsx");
        fs::write(&file, b"ancien").unwrap();
        write_atomic(&file, b"nouveau contenu").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"nouveau contenu");
        assert_eq!(entries(&dir), vec!["budget.xlsx"]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn le_fichier_bak_de_l_utilisateur_n_est_jamais_supprime() {
        let dir = temp_dir("bak-utilisateur");
        let file = dir.join("a.pptx");
        fs::write(&file, b"v1").unwrap();
        fs::write(dir.join("a.pptx.bak"), b"copie de l'utilisateur").unwrap();
        write_atomic(&file, b"v2").unwrap();
        assert_eq!(fs::read(&file).unwrap(), b"v2");
        assert_eq!(fs::read(dir.join("a.pptx.bak")).unwrap(), b"copie de l'utilisateur");
        assert_eq!(entries(&dir), vec!["a.pptx", "a.pptx.bak"]);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_echec_laisse_la_cible_intacte() {
        let dir = temp_dir("echec");
        let target = dir.join("dossier.docx");
        fs::create_dir(&target).unwrap();
        assert!(write_atomic(&target, b"x").is_err());
        assert!(target.is_dir());
        assert_eq!(entries(&dir), vec!["dossier.docx"]);
        let missing = dir.join("absent").join("a.docx");
        assert!(write_atomic(&missing, b"x").is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_fichier_en_lecture_seule_n_est_pas_ecrase() {
        let dir = temp_dir("lecture-seule");
        let file = dir.join("verrou.docx");
        fs::write(&file, b"original").unwrap();
        let mut perms = fs::metadata(&file).unwrap().permissions();
        perms.set_readonly(true);
        fs::set_permissions(&file, perms.clone()).unwrap();
        let err = write_atomic(&file, b"nouveau").unwrap_err();
        assert_eq!(err.kind(), io::ErrorKind::PermissionDenied);
        assert_eq!(fs::read(&file).unwrap(), b"original");
        #[allow(clippy::permissions_set_readonly_false)]
        perms.set_readonly(false);
        fs::set_permissions(&file, perms).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn un_gros_fichier_est_ecrit_en_entier() {
        let dir = temp_dir("gros");
        let file = dir.join("gros.pdf");
        let data: Vec<u8> = (0..3_000_000u32).map(|i| (i % 251) as u8).collect();
        write_atomic(&file, &data).unwrap();
        assert_eq!(fs::read(&file).unwrap(), data);
        fs::remove_dir_all(dir).unwrap();
    }
}
