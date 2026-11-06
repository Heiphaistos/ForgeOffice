// Pont Rust <-> Kotlin (`ForgePlugin.kt`) : selecteur de documents, export, partage, « Ouvrir avec »,
// impression, plein ecran. Les documents ne quittent jamais la bibliotheque privee (`library.rs`) :
// le Kotlin copie le flux `content://` dans un dossier provisoire, ce module le range puis l'autorise.

use std::path::{Path, PathBuf};

use serde::{de::DeserializeOwned, Deserialize};
use serde_json::{json, Value};
use tauri::plugin::{Builder, PluginHandle, TauriPlugin};
use tauri::{AppHandle, Manager, Runtime};

use crate::{library, Shell};

const IDENTIFIER: &str = "org.heiphaistos.forgeoffice";

struct Forge<R: Runtime>(PluginHandle<R>);

#[derive(Deserialize, Default)]
struct Imported {
    path: Option<String>,
    name: Option<String>,
}

#[derive(Deserialize)]
struct Inbox {
    files: Vec<Imported>,
}

#[derive(Deserialize)]
struct UpdateReply {
    available: bool,
    version: Option<String>,
    notes: Option<String>,
}

#[derive(Deserialize, Default)]
struct Exported {
    name: Option<String>,
}

/// Plugin interne : charge la classe Kotlin `ForgePlugin` de l'application.
pub fn plugin<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("forge-android")
        .setup(|app, api| {
            let handle = api.register_android_plugin(IDENTIFIER, "ForgePlugin")?;
            app.manage(Forge(handle));
            Ok(())
        })
        .build()
}

async fn call<R: Runtime, T: DeserializeOwned>(app: &AppHandle<R>, command: &str, payload: Value) -> Result<T, String> {
    app.state::<Forge<R>>().0.run_mobile_plugin_async(command, payload).await.map_err(|e| e.to_string())
}

fn text<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

pub fn library_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(text)?.join("library");
    std::fs::create_dir_all(&dir).map_err(text)?;
    Ok(dir)
}

/// Nettoie les restes d'un import interrompu (appele au demarrage).
pub fn start<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(dir) = library_dir(app) {
        library::clear_staging(&dir);
    }
}

fn adopt<R: Runtime>(app: &AppHandle<R>, got: Imported) -> Result<Option<PathBuf>, String> {
    let (Some(path), Some(name)) = (got.path, got.name) else { return Ok(None) };
    let target = library::adopt(&library_dir(app)?, Path::new(&path), &name).map_err(text)?;
    app.state::<Shell>().grants.grant(&target.to_string_lossy());
    Ok(Some(target))
}

/// Selecteur de documents du systeme ; le document choisi est copie dans la bibliotheque (None si annule).
pub async fn pick_document<R: Runtime>(app: &AppHandle<R>) -> Result<Option<PathBuf>, String> {
    let staging = library::staging(&library_dir(app)?).map_err(text)?;
    let got: Imported = call(app, "pickDocument", json!({ "dir": staging })).await?;
    adopt(app, got)
}

/// Documents recus par « Ouvrir avec » ou « Partager vers » depuis le dernier appel.
pub async fn take_inbox<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<PathBuf>, String> {
    let staging = library::staging(&library_dir(app)?).map_err(text)?;
    let inbox: Inbox = call(app, "takeInbox", json!({ "dir": staging })).await?;
    let mut paths = Vec::new();
    for got in inbox.files {
        paths.extend(adopt(app, got)?);
    }
    Ok(paths)
}

/// Fichier provisoire a remplir avant `export_staged` (octets du document, ou copie d'une base).
pub fn new_staged<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(library::staging(&library_dir(app)?).map_err(text)?.join(crate::launch::new_token()))
}

/// « Enregistrer sous » : le systeme choisit la destination (Drive, Documents...), le fichier provisoire y est
/// copie, puis range dans la bibliotheque sous le nom choisi. None si annule (le provisoire est supprime).
pub async fn export_staged<R: Runtime>(app: &AppHandle<R>, staged: &Path, name: &str) -> Result<Option<PathBuf>, String> {
    let name = library::clean_name(name);
    let done: Result<Exported, String> = call(app, "exportDocument", json!({ "src": staged, "name": name })).await;
    let Some(chosen) = done.as_ref().ok().and_then(|e| e.name.clone()) else {
        let _ = std::fs::remove_file(staged);
        return done.map(|_| None);
    };
    let target = library::adopt(&library_dir(app)?, staged, &chosen).map_err(text)?;
    app.state::<Shell>().grants.grant(&target.to_string_lossy());
    Ok(Some(target))
}

pub async fn share<R: Runtime>(app: &AppHandle<R>, path: &Path, name: &str) -> Result<(), String> {
    call::<R, Value>(app, "shareDocument", json!({ "path": path, "name": library::clean_name(name) })).await.map(|_| ())
}

pub async fn print<R: Runtime>(app: &AppHandle<R>, title: &str) -> Result<(), String> {
    call::<R, Value>(app, "printPage", json!({ "title": title })).await.map(|_| ())
}

pub async fn set_immersive<R: Runtime>(app: &AppHandle<R>, on: bool) -> Result<(), String> {
    call::<R, Value>(app, "setImmersive", json!({ "on": on })).await.map(|_| ())
}

pub async fn set_bars<R: Runtime>(app: &AppHandle<R>, dark: bool, color: i32) -> Result<(), String> {
    call::<R, Value>(app, "setBars", json!({ "dark": dark, "color": color })).await.map(|_| ())
}

/// Flux signe de mise a jour (Kotlin `Updater`) : `Some` si une version plus recente est annoncee.
pub async fn update_check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<crate::updates::UpdateInfo>, String> {
    let r: UpdateReply = call(app, "updateCheck", json!({})).await.map_err(|e| crate::texts::err_update(&e))?;
    Ok(r.available.then(|| crate::updates::UpdateInfo { version: r.version.unwrap_or_default(), notes: r.notes.unwrap_or_default() }))
}

/// Telecharge, controle et installe la mise a jour ; l'autorisation « applications inconnues » est demandee une seule fois.
pub async fn update_install<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    call::<R, Value>(app, "updateInstall", json!({})).await.map(|_| ()).map_err(|e| {
        if e.contains("permission") { crate::texts::ERR_UPDATE_PERMISSION.to_string() } else { crate::texts::err_update(&e) }
    })
}

pub async fn exit_app<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    call::<R, Value>(app, "exitApp", json!({})).await.map(|_| ())
}
