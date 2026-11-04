// Mode portable (Windows) : un seul .exe, interface embarquee.
// - Donnees a cote de l'exe (reglages, recents, journal, profil WebView2) si `portable.flag` est
//   present dans le meme dossier ; sinon dossiers systeme habituels.
// - L'executable compile avec `--features portable` se met a jour en remplacant son propre exe
//   (paquet signe verifie par tauri-plugin-updater, entree `<os>-<arch>-portable` de latest.json).

#[cfg(any(desktop, test))]
use std::ffi::OsString;
use std::fs;
#[cfg(any(desktop, test))]
use std::io;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

pub const FLAG_FILE: &str = "portable.flag";
pub const DATA_DIR: &str = "ForgeOffice-donnees";

/// Executable portable : mise a jour par remplacement de l'exe au lieu d'un installeur.
pub const PORTABLE_BUILD: bool = cfg!(feature = "portable");

/// Dossiers de travail de la coquille.
pub struct Dirs {
    pub data: PathBuf,
    pub logs: PathBuf,
    /// Profil WebView a cote de l'exe (portable) ; None = emplacement par defaut.
    pub webview: Option<PathBuf>,
    /// Mode portable demande mais dossier non inscriptible (repli sur les dossiers systeme).
    pub warning: Option<String>,
}

/// `<dossier de l'exe>/ForgeOffice-donnees` si `portable.flag` est a cote de l'exe.
pub fn data_root_beside(exe: &Path) -> Option<PathBuf> {
    let dir = exe.parent()?;
    dir.join(FLAG_FILE).is_file().then(|| dir.join(DATA_DIR))
}

pub fn dirs<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Dirs> {
    let mut warning = None;
    let beside = if cfg!(desktop) { std::env::current_exe().ok().and_then(|exe| data_root_beside(&exe)) } else { None };
    if let Some(root) = beside {
        match fs::create_dir_all(&root) {
            Ok(()) => {
                return Ok(Dirs { logs: root.join("journal"), webview: Some(root.join("webview")), data: root, warning });
            }
            Err(e) => warning = Some(format!("mode portable impossible ({}) : {e}", root.display())),
        }
    }
    Ok(Dirs { data: app.path().app_data_dir()?, logs: app.path().app_log_dir()?, webview: None, warning })
}

/// `forgeoffice.exe` -> `forgeoffice.exe.old`.
#[cfg(any(desktop, test))]
pub fn old_exe(exe: &Path) -> PathBuf {
    let mut name = OsString::from(exe.as_os_str());
    name.push(".old");
    PathBuf::from(name)
}

/// Remplace l'executable `exe` (en cours d'execution) par `bytes`, deja verifies.
/// Windows autorise le renommage d'un exe lance : l'ancien devient `.old` (supprime au prochain
/// demarrage) et le nouveau prend sa place par ecriture atomique. En cas d'echec, l'ancien revient.
#[cfg(any(desktop, test))]
pub fn replace_exe(exe: &Path, bytes: &[u8]) -> io::Result<()> {
    let old = old_exe(exe);
    let _ = fs::remove_file(&old); // reste d'une mise a jour precedente ; s'il est verrouille, le renommage echouera
    fs::rename(exe, &old)?;
    if let Err(e) = crate::atomic::write_atomic(exe, bytes) {
        let _ = fs::rename(&old, exe); // retour a l'exe d'origine : l'erreur d'ecriture prime
        return Err(e);
    }
    Ok(())
}

/// Supprime `<exe>.old` laisse par une mise a jour (l'ancien processus peut mettre quelques
/// secondes a se terminer : nouvelles tentatives en fond pendant une minute).
#[cfg(desktop)]
pub fn cleanup_old_exe<R: Runtime>(app: &AppHandle<R>) {
    let Ok(exe) = std::env::current_exe() else { return };
    let old = old_exe(&exe);
    if !old.exists() {
        return;
    }
    let worker = app.clone();
    let spawned = std::thread::Builder::new().name("fo-old-exe".into()).spawn(move || {
        for _ in 0..20 {
            if fs::remove_file(&old).is_ok() || !old.exists() {
                return;
            }
            std::thread::sleep(std::time::Duration::from_secs(3));
        }
        worker.state::<crate::Shell>().log.warn(&format!("ancien executable non supprime : {}", old.display()));
    });
    if let Err(e) = spawned {
        app.state::<crate::Shell>().log.warn(&format!("nettoyage de l'ancien executable : {e}"));
    }
}

/// Relance le nouvel exe puis ferme proprement l'instance courante. Le verrou d'instance unique
/// est libere AVANT le lancement, sinon le nouveau processus passerait la main a l'ancien et s'arreterait.
#[cfg(desktop)]
pub fn relaunch<R: Runtime>(app: &AppHandle<R>, exe: &Path) -> io::Result<()> {
    tauri_plugin_single_instance::destroy(app);
    std::process::Command::new(exe).spawn()?;
    app.exit(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fo-portable-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn donnees_a_cote_de_l_exe_seulement_avec_le_drapeau() {
        let dir = temp_dir("flag");
        let exe = dir.join("forgeoffice.exe");
        assert_eq!(data_root_beside(&exe), None);
        fs::write(dir.join(FLAG_FILE), b"").unwrap();
        assert_eq!(data_root_beside(&exe), Some(dir.join(DATA_DIR)));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn remplacement_de_l_executable() {
        let dir = temp_dir("exe");
        let exe = dir.join("forgeoffice.exe");
        fs::write(&exe, b"v1").unwrap();
        fs::write(old_exe(&exe), b"v0").unwrap(); // reste d'une mise a jour precedente
        replace_exe(&exe, b"v2").unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"v2");
        assert_eq!(fs::read(old_exe(&exe)).unwrap(), b"v1");
        assert_eq!(old_exe(&exe), dir.join("forgeoffice.exe.old"));
        // exe absent : rien n'est cree, l'erreur remonte
        assert!(replace_exe(&dir.join("absent.exe"), b"x").is_err());
        assert!(!dir.join("absent.exe").exists());
        fs::remove_dir_all(dir).unwrap();
    }
}
