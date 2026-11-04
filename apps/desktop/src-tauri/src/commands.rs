// Commandes appelees par la page (`apps/web/src/platform/tauri.ts`). Les fichiers circulent en
// binaire (trame de `frame.rs`, reponse `tauri::ipc::Response`), jamais en base64 dans du JSON.
// Toute lecture ou ecriture d'un chemin passe par le registre d'autorisations (`grants.rs`).

use std::path::{Path, PathBuf};
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewWindow, Window};
#[cfg(not(target_os = "android"))]
use tauri_plugin_dialog::{DialogExt, FileDialogBuilder};
use tauri_plugin_dialog::FilePath;
use tauri_plugin_fs::{FsExt, OpenOptions};

use crate::grants::is_url;
use crate::launch::LaunchFile;
use crate::recents::RecentFile;
use crate::{frame, modules, texts, windows, Shell};

pub const SETTING_EVENT: &str = "forgeoffice://setting-changed";
/// Taille maximale d'un document lu ou ecrit (garde-fou memoire) ; 256 Mio sur mobile (les octets transitent par la page).
pub const MAX_FILE_BYTES: u64 = if cfg!(mobile) { 256 * 1024 * 1024 } else { 1024 * 1024 * 1024 };

#[derive(Deserialize, Clone)]
pub struct Filter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Serialize)]
struct FileHead<'a> {
    name: &'a str,
    path: Option<&'a str>,
}

#[derive(Serialize, Clone)]
pub struct SavedFile {
    name: String,
    path: String,
}

#[derive(Serialize)]
pub struct AppInfo {
    version: String,
    platform: &'static str,
    os: &'static str,
}

#[derive(Serialize, Clone)]
struct SettingChange {
    key: String,
    value: Value,
}

/// Reponse vide = pas de fichier (dialogue annule, jeton inconnu).
pub fn no_file() -> Response {
    Response::new(Vec::<u8>::new())
}

fn file_response(name: &str, path: Option<&str>, bytes: &[u8]) -> Response {
    Response::new(frame::encode(&FileHead { name, path }, bytes))
}

fn raw_body<'a>(request: &'a Request<'_>) -> Result<&'a [u8], String> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err("corps binaire attendu".into()),
    }
}

/// Nom affichable d'un chemin ou d'une URL de contenu (dernier segment, decode).
pub fn display_name(path: &str) -> String {
    if is_url(path) {
        let last = path.trim_end_matches('/').rsplit('/').next().unwrap_or(path);
        let decoded = crate::launch::percent_decode(last);
        return decoded.rsplit(['/', ':']).next().unwrap_or(&decoded).to_string();
    }
    Path::new(path).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| path.to_string())
}

/// Ajoute l'extension du premier filtre si l'utilisateur n'en a pas tape.
pub fn ensure_extension(path: PathBuf, filters: &[Filter]) -> PathBuf {
    if path.extension().is_some() {
        return path;
    }
    match filters.iter().flat_map(|f| f.extensions.iter()).find(|e| *e != "*") {
        Some(ext) => path.with_extension(ext),
        None => path,
    }
}

fn clean_filters(filters: &[Filter]) -> Vec<Filter> {
    filters
        .iter()
        .take(64)
        .map(|f| Filter {
            name: f.name.chars().take(128).collect(),
            extensions: f
                .extensions
                .iter()
                .take(64)
                .map(|e| e.trim_start_matches('.').to_lowercase())
                .filter(|e| !e.is_empty() && e.chars().all(|c| c.is_ascii_alphanumeric() || c == '*'))
                .collect(),
        })
        .filter(|f| !f.extensions.is_empty())
        .collect()
}

#[cfg(not(target_os = "android"))]
pub(crate) fn add_filters<R: Runtime>(mut dialog: FileDialogBuilder<R>, filters: &[Filter], for_open: bool) -> FileDialogBuilder<R> {
    if for_open && filters.len() > 1 {
        let all: Vec<&str> = filters.iter().flat_map(|f| f.extensions.iter().map(String::as_str)).collect();
        dialog = dialog.add_filter(texts::ALL_SUPPORTED, &all);
    }
    for f in filters {
        let exts: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
        dialog = dialog.add_filter(&f.name, &exts);
    }
    if for_open {
        dialog = dialog.add_filter(texts::ALL_FILES, &["*"]);
    }
    dialog
}

#[cfg(not(target_os = "android"))]
pub(crate) fn file_dialog<R: Runtime>(window: &WebviewWindow<R>, title: &str) -> FileDialogBuilder<R> {
    let dialog = window.dialog().file().set_title(title);
    #[cfg(desktop)]
    let dialog = dialog.set_parent(window);
    dialog
}

fn read_any<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<Vec<u8>, String> {
    let bytes = if is_url(path) {
        let target = FilePath::from_str(path).map_err(|e| texts::err_read(&e.to_string()))?;
        app.fs().read(target).map_err(|e| texts::err_read(&e.to_string()))?
    } else {
        let meta = std::fs::metadata(path).map_err(|e| texts::err_read(&e.to_string()))?;
        if meta.len() > MAX_FILE_BYTES {
            return Err(texts::ERR_TOO_BIG.into());
        }
        std::fs::read(path).map_err(|e| texts::err_read(&e.to_string()))?
    };
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(texts::ERR_TOO_BIG.into());
    }
    Ok(bytes)
}

fn write_any<R: Runtime>(app: &AppHandle<R>, path: &str, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(texts::ERR_TOO_BIG.into());
    }
    if is_url(path) {
        // URL de contenu mobile : pas de renommage possible, ecriture directe par le fournisseur.
        use std::io::Write;
        let target = FilePath::from_str(path).map_err(|e| texts::err_write(&e.to_string()))?;
        let mut options = OpenOptions::new();
        options.write(true).truncate(true).create(true);
        let mut file = app.fs().open(target, options).map_err(|e| texts::err_write(&e.to_string()))?;
        file.write_all(bytes).and_then(|_| file.sync_all()).map_err(|e| texts::err_write(&e.to_string()))
    } else {
        crate::atomic::write_atomic(Path::new(path), bytes).map_err(|e| texts::err_write(&e.to_string()))
    }
}

fn read_granted<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<Vec<u8>, String> {
    if !app.state::<Shell>().grants.allows(path) {
        app.state::<Shell>().log.warn(&format!("lecture refusee (non autorisee) : {path}"));
        return Err(texts::ERR_NOT_ALLOWED.into());
    }
    read_any(app, path)
}

/// Fichier deja autorise, renvoye a la page (nom, chemin, octets).
pub fn file_at<R: Runtime>(app: &AppHandle<R>, path: &str) -> Result<Response, String> {
    let bytes = read_granted(app, path)?;
    Ok(file_response(&display_name(path), Some(path), &bytes))
}

#[tauri::command]
pub fn app_info<R: Runtime>(app: AppHandle<R>) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        platform: if cfg!(mobile) { "mobile" } else { "desktop" },
        os: std::env::consts::OS,
    }
}

#[tauri::command]
pub async fn open_dialog<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>, filters: Vec<Filter>) -> Result<Response, String> {
    let Some(path) = pick_path(&app, &window, &filters).await? else {
        return Ok(no_file());
    };
    app.state::<Shell>().grants.grant(&path);
    let bytes = read_any(&app, &path)?;
    app.state::<Shell>().log.info(&format!("ouverture : {path}"));
    Ok(file_response(&display_name(&path), Some(&path), &bytes))
}

/// Android : selecteur du systeme, document copie dans la bibliotheque privee (chemin reel, autorise).
#[cfg(target_os = "android")]
async fn pick_path<R: Runtime>(app: &AppHandle<R>, _window: &WebviewWindow<R>, _filters: &[Filter]) -> Result<Option<String>, String> {
    Ok(crate::android::pick_document(app).await?.map(|p| p.to_string_lossy().to_string()))
}

#[cfg(not(target_os = "android"))]
async fn pick_path<R: Runtime>(_app: &AppHandle<R>, window: &WebviewWindow<R>, filters: &[Filter]) -> Result<Option<String>, String> {
    let filters = clean_filters(filters);
    let dialog = add_filters(file_dialog(window, texts::OPEN_TITLE), &filters, true);
    Ok(dialog.blocking_pick_file().map(|picked| picked.to_string()))
}

#[tauri::command]
pub async fn read_path<R: Runtime>(app: AppHandle<R>, path: String) -> Result<Response, String> {
    let bytes = read_granted(&app, &path)?;
    Ok(file_response(&display_name(&path), Some(&path), &bytes))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveHead {
    path: Option<String>,
    suggested_name: String,
    filters: Vec<Filter>,
}

/// « Enregistrer » sur un chemin autorise, ou « Enregistrer sous » (dialogue) si `path` est absent.
#[tauri::command]
pub async fn save_file<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>, request: Request<'_>) -> Result<Option<SavedFile>, String> {
    let (head, bytes): (SaveHead, &[u8]) = frame::decode(raw_body(&request)?)?;
    let shell = app.state::<Shell>();
    let target = match head.path.filter(|p| !p.is_empty()) {
        Some(path) if shell.grants.allows(&path) => path,
        Some(path) => {
            shell.log.warn(&format!("ecriture refusee (non autorisee) : {path}"));
            return Err(texts::ERR_NOT_ALLOWED.into());
        }
        None => {
            let filters = clean_filters(&head.filters);
            let suggested: String = head.suggested_name.chars().filter(|c| !"/\\:*?\"<>|".contains(*c)).take(200).collect();
            match save_as(&app, &window, &filters, &suggested, bytes).await? {
                SaveAs::Cancelled => return Ok(None),
                SaveAs::Done(saved) => return Ok(Some(saved)),
                SaveAs::Chosen(path) => path,
            }
        }
    };
    write_any(&app, &target, bytes)?;
    shell.log.info(&format!("enregistrement : {target} ({} octets)", bytes.len()));
    Ok(Some(SavedFile { name: display_name(&target), path: target }))
}

enum SaveAs {
    Cancelled,
    /// Chemin choisi, a ecrire par l'appelant (bureau).
    #[cfg_attr(target_os = "android", allow(dead_code))]
    Chosen(String),
    /// Deja ecrit (mobile : export vers le systeme + copie dans la bibliotheque).
    #[cfg_attr(not(target_os = "android"), allow(dead_code))]
    Done(SavedFile),
}

/// « Enregistrer sous » : dialogue natif (bureau) ; mobile : creation d'un document par le systeme (Drive, Documents...).
#[cfg(target_os = "android")]
async fn save_as<R: Runtime>(app: &AppHandle<R>, _window: &WebviewWindow<R>, filters: &[Filter], suggested: &str, bytes: &[u8]) -> Result<SaveAs, String> {
    let name = ensure_extension(PathBuf::from(suggested), filters).to_string_lossy().to_string();
    let staged = crate::android::new_staged(app)?;
    std::fs::write(&staged, bytes).map_err(|e| texts::err_write(&e.to_string()))?;
    let Some(path) = crate::android::export_staged(app, &staged, &name).await? else {
        return Ok(SaveAs::Cancelled);
    };
    let path = path.to_string_lossy().to_string();
    Ok(SaveAs::Done(SavedFile { name: display_name(&path), path }))
}

#[cfg(not(target_os = "android"))]
async fn save_as<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, filters: &[Filter], suggested: &str, _bytes: &[u8]) -> Result<SaveAs, String> {
    let dialog = add_filters(file_dialog(window, texts::SAVE_AS_TITLE), filters, false).set_file_name(suggested.to_string());
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(SaveAs::Cancelled);
    };
    let path = match picked {
        FilePath::Path(p) => ensure_extension(p, filters).to_string_lossy().to_string(),
        url => url.to_string(),
    };
    app.state::<Shell>().grants.grant(&path);
    Ok(SaveAs::Chosen(path))
}

#[derive(Deserialize)]
struct ModuleHead {
    app: String,
    path: Option<String>,
    name: Option<String>,
}

/// Ouvre un module : nouvelle fenetre sur bureau (renvoie null), URL a charger sur mobile.
#[tauri::command]
pub async fn open_module<R: Runtime>(app: AppHandle<R>, request: Request<'_>) -> Result<Option<String>, String> {
    let (head, bytes): (ModuleHead, &[u8]) = frame::decode(raw_body(&request)?)?;
    if !modules::is_app_id(&head.app) {
        return Err(texts::ERR_UNKNOWN_APP.into());
    }
    let file = match (head.path.filter(|p| !p.is_empty()), head.name) {
        (Some(path), _) if app.state::<Shell>().grants.allows(&path) => Some(LaunchFile::Path(path)),
        (Some(_), _) => return Err(texts::ERR_NOT_ALLOWED.into()),
        (None, Some(name)) if !bytes.is_empty() => Some(LaunchFile::Bytes { name, bytes: bytes.to_vec() }),
        _ => None,
    };
    if cfg!(mobile) {
        let token = file.map(|f| app.state::<Shell>().launches.put(f));
        return Ok(Some(windows::module_url(&head.app, token.as_deref())));
    }
    windows::open_window(&app, &head.app, file)?;
    Ok(None)
}

/// Document confie a la fenetre par son jeton d'URL (reponse vide si aucun).
#[tauri::command]
pub async fn take_launch<R: Runtime>(app: AppHandle<R>, token: String) -> Result<Response, String> {
    match app.state::<Shell>().launches.get(&token) {
        Some(LaunchFile::Path(path)) => {
            let bytes = read_granted(&app, &path)?;
            Ok(file_response(&display_name(&path), Some(&path), &bytes))
        }
        Some(LaunchFile::Bytes { name, bytes }) => Ok(file_response(&name, None, &bytes)),
        None => Ok(no_file()),
    }
}

#[tauri::command]
pub fn recents_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<RecentFile>, String> {
    app.state::<Shell>().recents.list().map_err(|e| e.to_string())
}

#[derive(Deserialize)]
pub struct RecentEntry {
    app: String,
    name: String,
    path: String,
}

#[tauri::command]
pub fn recents_add<R: Runtime>(app: AppHandle<R>, entry: RecentEntry) -> Result<(), String> {
    let shell = app.state::<Shell>();
    if !modules::is_app_id(&entry.app) {
        return Err(texts::ERR_UNKNOWN_APP.into());
    }
    // Seul un fichier deja autorise entre dans les recents (qui autorisent sa relecture).
    if !shell.grants.allows(&entry.path) {
        return Err(texts::ERR_NOT_ALLOWED.into());
    }
    let opened_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    shell
        .recents
        .add(RecentFile { app: entry.app, name: entry.name, path: entry.path, opened_at })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn recents_clear<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    app.state::<Shell>().recents.clear().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn settings_load<R: Runtime>(app: AppHandle<R>) -> Map<String, Value> {
    app.state::<Shell>().settings.all()
}

/// Enregistre un reglage puis le diffuse aux autres fenetres.
#[tauri::command]
pub fn settings_set<R: Runtime>(app: AppHandle<R>, key: String, value: Value) -> Result<(), String> {
    app.state::<Shell>().settings.set(&key, value.clone()).map_err(|e| e.to_string())?;
    app.emit(SETTING_EVENT, SettingChange { key, value }).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn window_set_title<R: Runtime>(window: Window<R>, title: String) {
    windows::set_title(&window, Some(&title), None);
}

#[tauri::command]
pub fn window_set_modified<R: Runtime>(window: Window<R>, modified: bool) {
    windows::set_title(&window, None, Some(modified));
}

/// Fermeture voulue par la page (elle a deja propose d'enregistrer) : sans confirmation.
#[tauri::command]
pub fn window_close<R: Runtime>(window: Window<R>) {
    windows::destroy(&window);
}

/// Impression du contenu de la fenetre (dialogue d'impression du systeme).
/// iOS : erreur, la page se rabat sur `window.print()`.
#[cfg(desktop)]
#[tauri::command]
pub fn print_window<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    window.print().map_err(|e| e.to_string())
}

/// Android : gestionnaire d'impression du systeme (boite « Enregistrer au format PDF »).
#[cfg(target_os = "android")]
#[tauri::command]
pub async fn print_window<R: Runtime>(window: WebviewWindow<R>) -> Result<(), String> {
    crate::android::print(window.app_handle(), &window.title().unwrap_or_default()).await
}

#[cfg(target_os = "ios")]
#[tauri::command]
pub fn print_window<R: Runtime>(_window: WebviewWindow<R>) -> Result<(), String> {
    Err(texts::ERR_PRINT_MOBILE.into())
}

/// Journal de la page : erreurs non rattrapees, avertissements.
#[tauri::command]
pub fn log_write<R: Runtime>(app: AppHandle<R>, level: String, message: String) {
    app.state::<Shell>().log.write(&level, &format!("[page] {message}"));
}

#[cfg(test)]
mod tests {
    use super::*;

    fn filter(name: &str, exts: &[&str]) -> Filter {
        Filter { name: name.into(), extensions: exts.iter().map(|e| e.to_string()).collect() }
    }

    #[test]
    fn extension_ajoutee_si_absente() {
        let filters = vec![filter("Document Word", &["docx"])];
        assert_eq!(ensure_extension(PathBuf::from("/d/lettre"), &filters), PathBuf::from("/d/lettre.docx"));
        assert_eq!(ensure_extension(PathBuf::from("/d/lettre.odt"), &filters), PathBuf::from("/d/lettre.odt"));
        assert_eq!(ensure_extension(PathBuf::from("/d/lettre"), &[]), PathBuf::from("/d/lettre"));
    }

    #[test]
    fn filtres_nettoyes() {
        let cleaned = clean_filters(&[filter("A", &[".DOCX", "d/../x", ""]), filter("Vide", &[])]);
        assert_eq!(cleaned.len(), 1);
        assert_eq!(cleaned[0].extensions, vec!["docx"]);
    }

    #[test]
    fn noms_affichables() {
        assert_eq!(display_name("/home/u/Rapport final.docx"), "Rapport final.docx");
        assert_eq!(
            display_name("content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fbudget.xlsx"),
            "budget.xlsx"
        );
    }
}
