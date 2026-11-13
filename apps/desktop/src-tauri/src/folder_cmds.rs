// Dossier ouvert sur le vrai disque (explorateur du Bloc-notes) : choix par le dialogue natif, lecture, ecriture atomique,
// creation, renommage, copie, suppression vers la CORBEILLE DU SYSTEME. Aucun chemin n'est accepte de la page : elle ne
// connait que la racine choisie (registre `grants.rs`) et des chemins relatifs, verifies ici (pas de `..`, pas de lien
// symbolique qui sortirait de la racine).

use std::fs;
use std::io;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use tauri::ipc::{Request, Response};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use crate::{frame, texts, Shell};

/// Nombre maximal d'elements renvoyes pour un dossier (le reste est ignore, la page le dit).
pub const MAX_ENTRIES: usize = 20_000;
const MAX_DEPTH: usize = 32;
/// Taille maximale d'un fichier lu par l'explorateur.
pub const MAX_FOLDER_FILE: u64 = 64 * 1024 * 1024;

#[derive(Serialize, Debug, PartialEq)]
pub struct Entry {
    pub rel: String,
    pub dir: bool,
    pub size: u64,
}

#[derive(Serialize)]
pub struct PickedFolder {
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    /// Millisecondes depuis l'epoque.
    modified_at: u64,
    size: u64,
}

// --- Logique sans Tauri (testee) ---

/// Chemin relatif accepte : segments normaux separes par « / », sans `..`, sans `.`, sans lecteur ni antislash.
pub fn clean_rel(rel: &str) -> Result<Vec<&str>, String> {
    if rel.is_empty() || rel.contains('\0') || rel.contains('\\') || rel.starts_with('/') {
        return Err(texts::ERR_BAD_PATH.into());
    }
    let parts: Vec<&str> = rel.split('/').collect();
    if parts.iter().any(|p| p.is_empty() || *p == "." || *p == ".." || p.contains(':')) {
        return Err(texts::ERR_BAD_PATH.into());
    }
    Ok(parts)
}

/// `root` + `rel`, apres verification que le resultat reste dans la racine (liens symboliques compris).
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let parts = clean_rel(rel)?;
    let base = crate::grants::normalize(root);
    fs::metadata(&base).map_err(|e| texts::err_read(&e.to_string()))?;
    let mut target = base.clone();
    for part in &parts {
        target.push(part);
        // Un lien symbolique deja present qui pointe hors de la racine est refuse.
        if let Ok(meta) = fs::symlink_metadata(&target) {
            if meta.file_type().is_symlink() {
                let real = crate::grants::normalize(&target);
                if !real.starts_with(&base) {
                    return Err(texts::ERR_BAD_PATH.into());
                }
            }
        }
    }
    debug_assert!(target.components().all(|c| !matches!(c, Component::ParentDir)));
    Ok(target)
}

/// Arborescence a plat (dossiers avant leur contenu), sans suivre les liens symboliques.
pub fn list_tree(root: &Path) -> io::Result<Vec<Entry>> {
    let mut out = Vec::new();
    walk(root, "", 0, &mut out)?;
    Ok(out)
}

fn walk(dir: &Path, prefix: &str, depth: usize, out: &mut Vec<Entry>) -> io::Result<()> {
    if depth > MAX_DEPTH {
        return Ok(());
    }
    let mut children: Vec<_> = fs::read_dir(dir)?.filter_map(Result::ok).collect();
    children.sort_by_key(|c| c.file_name());
    for child in children {
        if out.len() >= MAX_ENTRIES {
            return Ok(());
        }
        let Ok(meta) = fs::symlink_metadata(child.path()) else { continue };
        if meta.file_type().is_symlink() {
            continue;
        }
        let name = child.file_name().to_string_lossy().to_string();
        let rel = if prefix.is_empty() { name } else { format!("{prefix}/{name}") };
        if meta.is_dir() {
            out.push(Entry { rel: rel.clone(), dir: true, size: 0 });
            walk(&child.path(), &rel, depth + 1, out)?;
        } else if meta.is_file() {
            out.push(Entry { rel, dir: false, size: meta.len() });
        }
    }
    Ok(())
}

/// Copie un fichier ou un dossier ; refuse d'ecraser ; ignore les liens symboliques.
pub fn copy_recursive(src: &Path, dst: &Path) -> io::Result<()> {
    if dst.symlink_metadata().is_ok() {
        return Err(io::Error::new(io::ErrorKind::AlreadyExists, texts::ERR_EXISTS));
    }
    let meta = fs::symlink_metadata(src)?;
    if meta.file_type().is_symlink() {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, texts::ERR_BAD_PATH));
    }
    if meta.is_dir() {
        // Une copie dans soi-meme bouclerait a l'infini.
        if dst.starts_with(src) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, texts::ERR_INTO_SELF));
        }
        fs::create_dir(dst)?;
        for child in fs::read_dir(src)?.filter_map(Result::ok) {
            if fs::symlink_metadata(child.path()).is_ok_and(|m| m.file_type().is_symlink()) {
                continue;
            }
            copy_recursive(&child.path(), &dst.join(child.file_name()))?;
        }
        Ok(())
    } else {
        fs::copy(src, dst).map(|_| ())
    }
}

/// Renomme ou deplace sans jamais ecraser ; un dossier ne peut pas entrer dans lui-meme.
pub fn rename_new(src: &Path, dst: &Path) -> io::Result<()> {
    if dst.symlink_metadata().is_ok() {
        return Err(io::Error::new(io::ErrorKind::AlreadyExists, texts::ERR_EXISTS));
    }
    if src.is_dir() && dst.starts_with(src) {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, texts::ERR_INTO_SELF));
    }
    match fs::rename(src, dst) {
        Ok(()) => Ok(()),
        // Autre volume (lien de montage dans le dossier) : copie puis suppression.
        Err(_) if src.exists() => {
            copy_recursive(src, dst)?;
            if src.is_dir() { fs::remove_dir_all(src) } else { fs::remove_file(src) }
        }
        Err(e) => Err(e),
    }
}

pub fn file_info_of(path: &Path) -> io::Result<Option<FileInfo>> {
    match fs::metadata(path) {
        Ok(meta) => {
            let modified_at = meta.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok()).map(|d| d.as_millis() as u64).unwrap_or_default();
            Ok(Some(FileInfo { modified_at, size: meta.len() }))
        }
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}

/// Programme et arguments qui montrent un fichier dans le gestionnaire de fichiers du systeme.
/// Windows : un seul argument brut `/select,"chemin"` (les guillemets doivent rester tels quels pour explorer.exe).
pub fn reveal_plan(os: &str, path: &str) -> (&'static str, Vec<String>) {
    match os {
        "windows" => ("explorer.exe", vec![format!("/select,\"{}\"", path.replace('/', "\\"))]),
        "macos" => ("open", vec!["-R".into(), path.into()]),
        _ => {
            let parent = Path::new(path).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_else(|| "/".into());
            ("xdg-open", vec![parent])
        }
    }
}

// --- Commandes ---

fn granted_root<R: Runtime>(app: &AppHandle<R>, root: &str) -> Result<PathBuf, String> {
    let shell = app.state::<Shell>();
    if !shell.grants.allows_folder(root) {
        shell.log.warn(&format!("dossier refuse (non autorise) : {root}"));
        return Err(texts::ERR_NOT_ALLOWED.into());
    }
    Ok(PathBuf::from(root))
}

async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || crate::panic_guard::proteger(job))
        .await
        .map_err(|e| texts::err_read(&e.to_string()))?
}

fn io_text(e: &io::Error) -> String {
    e.to_string()
}

/// Dialogue natif de choix d'un dossier ; le dossier choisi devient la racine autorisee. null si annule.
#[tauri::command]
pub async fn folder_pick<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) -> Result<Option<PickedFolder>, String> {
    #[cfg(desktop)]
    {
        let picked = crate::commands::file_dialog(&window, texts::OPEN_FOLDER_TITLE).blocking_pick_folder();
        let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(None) };
        let text = path.to_string_lossy().to_string();
        app.state::<Shell>().grants.grant_folder(&text);
        app.state::<Shell>().log.info(&format!("dossier ouvert : {text}"));
        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| text.clone());
        Ok(Some(PickedFolder { name, path: text }))
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, window);
        Err(texts::ERR_DESKTOP_ONLY.into())
    }
}

#[tauri::command]
pub async fn folder_list<R: Runtime>(app: AppHandle<R>, root: String) -> Result<Vec<Entry>, String> {
    let root = granted_root(&app, &root)?;
    blocking(move || list_tree(&root).map_err(|e| texts::err_read(&io_text(&e)))).await
}

#[tauri::command]
pub async fn folder_read<R: Runtime>(app: AppHandle<R>, root: String, rel: String) -> Result<Response, String> {
    let root = granted_root(&app, &root)?;
    let bytes = blocking(move || {
        let path = safe_join(&root, &rel)?;
        let meta = fs::metadata(&path).map_err(|e| texts::err_read(&io_text(&e)))?;
        if !meta.is_file() || meta.len() > MAX_FOLDER_FILE {
            return Err(texts::ERR_TOO_BIG.into());
        }
        fs::read(&path).map_err(|e| texts::err_read(&io_text(&e)))
    })
    .await?;
    Ok(Response::new(bytes))
}

#[derive(Deserialize)]
struct WriteHead {
    root: String,
    rel: String,
}

/// Cree ou remplace un fichier (ecriture atomique) ; trame [en-tete {root, rel}][octets].
#[tauri::command]
pub async fn folder_write<R: Runtime>(app: AppHandle<R>, request: Request<'_>) -> Result<(), String> {
    let raw = frame::request_bytes(&request)?;
    let (head, bytes): (WriteHead, &[u8]) = frame::decode(&raw)?;
    let root = granted_root(&app, &head.root)?;
    let bytes = bytes.to_vec();
    let rel = head.rel;
    blocking(move || {
        let path = safe_join(&root, &rel)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| texts::err_write(&io_text(&e)))?;
        }
        crate::atomic::write_atomic(&path, &bytes).map_err(|e| texts::err_write(&io_text(&e)))
    })
    .await
}

#[tauri::command]
pub async fn folder_mkdir<R: Runtime>(app: AppHandle<R>, root: String, rel: String) -> Result<(), String> {
    let root = granted_root(&app, &root)?;
    blocking(move || {
        let path = safe_join(&root, &rel)?;
        if path.symlink_metadata().is_ok() {
            return Err(texts::ERR_EXISTS.into());
        }
        fs::create_dir_all(&path).map_err(|e| texts::err_write(&io_text(&e)))
    })
    .await
}

#[tauri::command]
pub async fn folder_rename<R: Runtime>(app: AppHandle<R>, root: String, from: String, to: String) -> Result<(), String> {
    let root = granted_root(&app, &root)?;
    blocking(move || rename_new(&safe_join(&root, &from)?, &safe_join(&root, &to)?).map_err(|e| texts::err_write(&io_text(&e)))).await
}

#[tauri::command]
pub async fn folder_copy<R: Runtime>(app: AppHandle<R>, root: String, from: String, to: String) -> Result<(), String> {
    let root = granted_root(&app, &root)?;
    blocking(move || copy_recursive(&safe_join(&root, &from)?, &safe_join(&root, &to)?).map_err(|e| texts::err_write(&io_text(&e)))).await
}

#[tauri::command]
pub async fn folder_exists<R: Runtime>(app: AppHandle<R>, root: String, rel: String) -> Result<bool, String> {
    let root = granted_root(&app, &root)?;
    blocking(move || Ok(safe_join(&root, &rel)?.symlink_metadata().is_ok())).await
}

/// Envoie un fichier ou un dossier a la CORBEILLE DU SYSTEME (Corbeille Windows, Corbeille macOS, corbeille FreeDesktop sous Linux).
#[tauri::command]
pub async fn folder_trash<R: Runtime>(app: AppHandle<R>, root: String, rel: String) -> Result<(), String> {
    let root = granted_root(&app, &root)?;
    let handle = app.clone();
    blocking(move || {
        let path = safe_join(&root, &rel)?;
        move_to_trash(&path).map_err(|e| texts::err_trash(&e))?;
        handle.state::<Shell>().log.info(&format!("corbeille : {}", path.display()));
        Ok(())
    })
    .await
}

#[cfg(desktop)]
pub fn move_to_trash(path: &Path) -> Result<(), String> {
    if path.symlink_metadata().is_err() {
        return Err(texts::ERR_NOT_FOUND.into());
    }
    trash::delete(path).map_err(|e| e.to_string())
}

#[cfg(not(desktop))]
pub fn move_to_trash(_path: &Path) -> Result<(), String> {
    Err(texts::ERR_DESKTOP_ONLY.into())
}

/// Date et taille d'un fichier deja autorise, sans le relire (null s'il n'existe plus).
#[tauri::command]
pub async fn file_info<R: Runtime>(app: AppHandle<R>, path: String) -> Result<Option<FileInfo>, String> {
    if !app.state::<Shell>().grants.allows(&path) {
        return Err(texts::ERR_NOT_ALLOWED.into());
    }
    blocking(move || file_info_of(Path::new(&path)).map_err(|e| texts::err_read(&io_text(&e)))).await
}

/// Montre un fichier autorise dans l'explorateur du systeme (explorer /select, open -R, xdg-open).
#[tauri::command]
pub async fn reveal_in_folder<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    #[cfg(desktop)]
    {
        if !app.state::<Shell>().grants.allows(&path) || crate::grants::is_url(&path) {
            return Err(texts::ERR_NOT_ALLOWED.into());
        }
        if !Path::new(&path).exists() {
            return Err(texts::ERR_NOT_FOUND.into());
        }
        let (program, args) = reveal_plan(std::env::consts::OS, &path);
        let mut command = std::process::Command::new(program);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            for arg in &args {
                command.raw_arg(arg);
            }
        }
        #[cfg(not(windows))]
        command.args(&args);
        // explorer.exe renvoie 1 meme en cas de succes : seule l'impossibilite de lancer le programme est une erreur.
        command.spawn().map(|_| ()).map_err(|e| texts::err_reveal(&e.to_string()))
    }
    #[cfg(not(desktop))]
    {
        let _ = (app, path);
        Err(texts::ERR_DESKTOP_ONLY.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("fo-folder-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn chemins_relatifs_surs() {
        assert_eq!(clean_rel("a/b/c.md").unwrap(), vec!["a", "b", "c.md"]);
        for bad in ["", "../x", "a/../b", "/etc/passwd", "a//b", "a\\b", "C:/x", "a/./b", "a/b:c", "x\0y", "a/"] {
            assert!(clean_rel(bad).is_err(), "{bad:?} doit etre refuse");
        }
    }

    #[test]
    fn jointure_dans_la_racine() {
        let root = temp("join");
        fs::create_dir_all(root.join("sous")).unwrap();
        let p = safe_join(&root, "sous/n.md").unwrap();
        assert!(p.starts_with(crate::grants::normalize(&root)));
        assert!(safe_join(&root, "../dehors").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn un_lien_symbolique_hors_racine_est_refuse() {
        let root = temp("lien");
        let outside = temp("lien-dehors");
        std::os::unix::fs::symlink(&outside, root.join("sortie")).unwrap();
        assert!(safe_join(&root, "sortie/secret.txt").is_err());
        fs::write(outside.join("secret.txt"), b"x").unwrap();
        assert!(list_tree(&root).unwrap().is_empty(), "les liens ne sont pas suivis");
        fs::remove_dir_all(root).unwrap();
        fs::remove_dir_all(outside).unwrap();
    }

    #[test]
    fn arborescence_triee_sans_suivre_les_liens() {
        let root = temp("liste");
        fs::create_dir_all(root.join("b/deep")).unwrap();
        fs::write(root.join("a.md"), b"un").unwrap();
        fs::write(root.join("b/deep/c.txt"), b"trois").unwrap();
        let entries = list_tree(&root).unwrap();
        let names: Vec<(&str, bool)> = entries.iter().map(|e| (e.rel.as_str(), e.dir)).collect();
        assert_eq!(names, vec![("a.md", false), ("b", true), ("b/deep", true), ("b/deep/c.txt", false)]);
        assert_eq!(entries[3].size, 5);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn copie_recursive_sans_ecraser_ni_boucler() {
        let root = temp("copie");
        fs::create_dir_all(root.join("d/s")).unwrap();
        fs::write(root.join("d/s/f.txt"), b"x").unwrap();
        copy_recursive(&root.join("d"), &root.join("d2")).unwrap();
        assert_eq!(fs::read(root.join("d2/s/f.txt")).unwrap(), b"x");
        assert!(copy_recursive(&root.join("d"), &root.join("d2")).is_err(), "pas d'ecrasement");
        assert!(copy_recursive(&root.join("d"), &root.join("d/s/in")).is_err(), "pas de copie dans soi-meme");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn renommage_sans_ecraser() {
        let root = temp("renom");
        fs::write(root.join("a.md"), b"a").unwrap();
        fs::write(root.join("b.md"), b"b").unwrap();
        assert!(rename_new(&root.join("a.md"), &root.join("b.md")).is_err());
        assert_eq!(fs::read(root.join("b.md")).unwrap(), b"b");
        rename_new(&root.join("a.md"), &root.join("c.md")).unwrap();
        assert!(!root.join("a.md").exists() && root.join("c.md").exists());
        fs::create_dir_all(root.join("dir")).unwrap();
        assert!(rename_new(&root.join("dir"), &root.join("dir/in")).is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn date_et_taille() {
        let root = temp("info");
        fs::write(root.join("f"), b"abcd").unwrap();
        let info = file_info_of(&root.join("f")).unwrap().unwrap();
        assert_eq!(info.size, 4);
        assert!(info.modified_at > 1_600_000_000_000);
        assert!(file_info_of(&root.join("absent")).unwrap().is_none());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn commande_de_revelation_par_systeme() {
        assert_eq!(reveal_plan("windows", "C:/Docs/a b.txt"), ("explorer.exe", vec!["/select,\"C:\\Docs\\a b.txt\"".to_string()]));
        assert_eq!(reveal_plan("macos", "/Users/u/a.txt"), ("open", vec!["-R".to_string(), "/Users/u/a.txt".to_string()]));
        assert_eq!(reveal_plan("linux", "/home/u/a.txt"), ("xdg-open", vec!["/home/u".to_string()]));
    }

    #[test]
    fn la_corbeille_du_systeme_retire_le_fichier() {
        let root = temp("corbeille");
        let file = root.join("a-supprimer.txt");
        fs::write(&file, b"x").unwrap();
        match move_to_trash(&file) {
            Ok(()) => assert!(!file.exists(), "le fichier a quitte le dossier"),
            // Environnement sans corbeille (conteneur, CI sans bureau) : l'erreur est explicite, le fichier reste.
            Err(e) => {
                eprintln!("corbeille indisponible ici : {e}");
                assert!(file.exists());
            }
        }
        assert!(move_to_trash(&root.join("absent")).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
