// Mise a jour automatique (bureau) : tauri-plugin-updater, paquet signe (minisign) verifie avant
// installation, installeur Windows en mode passif ; l'exe portable remplace son propre executable
// (entree `<os>-<arch>-portable` de latest.json, voir portable.rs). Verification au demarrage puis toutes les 6 h,
// sauf si le reglage `updates.auto` vaut `false`. La page est prevenue par l'evenement
// `forgeoffice://update-available` et installe par `update_install` (progression 0..1).

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, Runtime};

#[cfg(mobile)]
use crate::texts;

#[cfg(desktop)]
pub const UPDATE_EVENT: &str = "forgeoffice://update-available";

#[derive(Serialize, Clone, Debug)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
}

#[cfg(desktop)]
mod desktop {
    use std::time::Duration;

    use tauri::{AppHandle, Emitter, Manager, Runtime};
    use tauri_plugin_updater::{Updater, UpdaterExt};

    use super::{UpdateInfo, UPDATE_EVENT};
    use crate::{portable, texts, Shell};

    const FIRST_CHECK: Duration = Duration::from_secs(20);
    const INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

    /// L'exe portable lit sa propre entree du manifeste (`windows-x86_64-portable`...).
    fn updater<R: Runtime>(app: &AppHandle<R>) -> Result<Updater, String> {
        let mut builder = app.updater_builder();
        if portable::PORTABLE_BUILD {
            if let Some(target) = tauri_plugin_updater::target() {
                builder = builder.target(format!("{target}-portable"));
            }
        }
        builder.build().map_err(|e| texts::err_update(&e.to_string()))
    }

    pub async fn check<R: Runtime>(app: &AppHandle<R>) -> Result<Option<UpdateInfo>, String> {
        let updater = updater(app)?;
        let update = updater.check().await.map_err(|e| texts::err_update(&e.to_string()))?;
        Ok(update.map(|u| UpdateInfo { version: u.version.clone(), notes: u.body.clone().unwrap_or_default() }))
    }

    pub async fn install<R: Runtime>(app: &AppHandle<R>, progress: tauri::ipc::Channel<f64>) -> Result<(), String> {
        let update = updater(app)?
            .check()
            .await
            .map_err(|e| texts::err_update(&e.to_string()))?
            .ok_or_else(|| texts::ERR_NO_UPDATE.to_string())?;
        let shell = app.state::<Shell>();
        shell.log.info(&format!("installation de la mise a jour {}", update.version));
        let mut received: u64 = 0;
        let on_chunk = |chunk: usize, total: Option<u64>| {
            received += chunk as u64;
            if let Some(total) = total.filter(|t| *t > 0) {
                let _ = progress.send(received as f64 / total as f64); // fenetre fermee entre-temps : sans effet
            }
        };
        let on_done = || {
            let _ = progress.send(1.0); // idem
        };
        if portable::PORTABLE_BUILD {
            // download() verifie la signature minisign avant de rendre les octets.
            let bytes = update.download(on_chunk, on_done).await.map_err(|e| texts::err_update(&e.to_string()))?;
            let exe = std::env::current_exe().map_err(|e| texts::err_update(&e.to_string()))?;
            portable::replace_exe(&exe, &bytes).map_err(|e| texts::err_update(&e.to_string()))?;
            shell.log.info(&format!("executable portable remplace : {}", exe.display()));
            return portable::relaunch(app, &exe).map_err(|e| texts::err_update(&e.to_string()));
        }
        update.download_and_install(on_chunk, on_done).await.map_err(|e| texts::err_update(&e.to_string()))?;
        // Windows : l'installeur a deja ferme l'application. macOS / Linux : relance sur la nouvelle version.
        app.restart();
    }

    /// Fil de fond : premiere verification 20 s apres le demarrage, puis toutes les 6 h.
    pub fn start_background<R: Runtime>(app: AppHandle<R>) {
        if cfg!(debug_assertions) {
            return; // version de developpement : pas de requete reseau automatique
        }
        let worker = app.clone();
        let spawned = std::thread::Builder::new().name("fo-updates".into()).spawn(move || {
            let app = worker;
            std::thread::sleep(FIRST_CHECK);
            loop {
                let shell = app.state::<Shell>();
                if shell.settings.auto_updates() {
                    match tauri::async_runtime::block_on(check(&app)) {
                        Ok(Some(info)) => {
                            shell.log.info(&format!("mise a jour disponible : {}", info.version));
                            if let Err(e) = app.emit(UPDATE_EVENT, info) {
                                shell.log.warn(&format!("annonce de mise a jour : {e}"));
                            }
                        }
                        Ok(None) => shell.log.info("application a jour"),
                        Err(e) => shell.log.warn(&e),
                    }
                }
                std::thread::sleep(INTERVAL);
            }
        });
        if let Err(e) = spawned {
            app.state::<Shell>().log.error(&format!("verification des mises a jour : {e}"));
        }
    }
}

#[cfg(desktop)]
pub use desktop::start_background;

#[tauri::command]
pub async fn update_check<R: Runtime>(app: AppHandle<R>) -> Result<Option<UpdateInfo>, String> {
    #[cfg(desktop)]
    return desktop::check(&app).await;
    #[cfg(mobile)]
    {
        let _ = app;
        Err(texts::ERR_UPDATES_MOBILE.into())
    }
}

#[tauri::command]
pub async fn update_install<R: Runtime>(app: AppHandle<R>, on_progress: Channel<f64>) -> Result<(), String> {
    #[cfg(desktop)]
    return desktop::install(&app, on_progress).await;
    #[cfg(mobile)]
    {
        let _ = (app, on_progress);
        Err(texts::ERR_UPDATES_MOBILE.into())
    }
}
