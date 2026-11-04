// Coquille Tauri 2 de ForgeOffice (bureau + mobile). La page web (apps/web) fait tout le travail
// bureautique ; la coquille fournit les services natifs : fichiers (registre d'autorisations,
// ecriture atomique), fenetres par module, recents, reglages, journal, impression, mise a jour.

mod atomic;
mod commands;
mod frame;
mod grants;
mod launch;
mod logging;
mod modules;
mod recents;
mod settings;
mod texts;
mod updates;
mod windows;

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Manager, RunEvent, Runtime};

use crate::launch::LaunchFile;

/// Etat partage de la coquille, accessible partout par `app.state::<Shell>()`.
pub struct Shell {
    pub grants: grants::Grants,
    pub launches: launch::Launches,
    pub recents: recents::Recents,
    pub settings: settings::SettingsStore,
    pub log: logging::Logger,
    pub docs: windows::Docs,
}

/// Delai maximal entre la demande de sortie et la fin du processus.
const EXIT_DEADLINE: Duration = Duration::from_secs(5);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // L'instance unique doit etre le premier greffon : une seconde instance passe la main et s'arrete.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        let args = argv.get(1..).unwrap_or_default();
        open_files_or_hub(app, &launch::files_from_args(args, Path::new(&cwd)));
    }));
    let builder = builder.plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .setup(|app| {
            setup(app.handle())?;
            Ok(())
        })
        .on_window_event(windows::on_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::settings_load,
            commands::settings_set,
            commands::open_dialog,
            commands::read_path,
            commands::save_file,
            commands::open_module,
            commands::take_launch,
            commands::recents_list,
            commands::recents_add,
            commands::recents_clear,
            commands::window_set_title,
            commands::window_set_modified,
            commands::window_close,
            commands::print_window,
            commands::log_write,
            updates::update_check,
            updates::update_install,
        ])
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(on_run_event),
        Err(e) => {
            eprintln!("ForgeOffice n'a pas pu demarrer : {e}");
            std::process::exit(1);
        }
    }
}

fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    let log_dir = app.path().app_log_dir()?;
    let log = logging::Logger::new(&log_dir);
    install_panic_hook(log_dir);

    let recents = recents::Recents::load(data_dir.join("recents.json"));
    let grants = grants::Grants::default();
    // Les fichiers recents restent relisibles d'une session a l'autre.
    for path in recents.paths() {
        grants.grant(&path);
    }
    log.info(&format!(
        "demarrage de ForgeOffice {} ({} {})",
        app.package_info().version,
        std::env::consts::OS,
        std::env::consts::ARCH
    ));
    app.manage(Shell {
        grants,
        launches: launch::Launches::default(),
        recents,
        settings: settings::SettingsStore::load(data_dir.join("settings.json")),
        log,
        docs: windows::Docs::default(),
    });

    #[cfg(desktop)]
    let files = {
        let args: Vec<String> = std::env::args().skip(1).collect();
        let cwd = std::env::current_dir().unwrap_or_default();
        launch::files_from_args(&args, &cwd)
    };
    #[cfg(mobile)]
    let files: Vec<std::path::PathBuf> = Vec::new();
    open_files_or_hub(app, &files);

    #[cfg(desktop)]
    updates::start_background(app.clone());
    Ok(())
}

/// Une fenetre par fichier reconnu ; l'accueil si aucun fichier n'a pu etre ouvert.
fn open_files_or_hub<R: Runtime>(app: &AppHandle<R>, files: &[std::path::PathBuf]) {
    let opened = files.iter().filter(|f| open_target(app, f.to_string_lossy().to_string())).count();
    if opened == 0 {
        show_module(app, "hub", None);
    }
}

/// Ouvre un chemin ou une URL de contenu recue du systeme (ligne de commande, association, partage).
fn open_target<R: Runtime>(app: &AppHandle<R>, target: String) -> bool {
    let shell = app.state::<Shell>();
    let Some(app_id) = modules::app_for_file(&commands::display_name(&target)) else {
        shell.log.warn(&format!("format non pris en charge : {target}"));
        return false;
    };
    shell.grants.grant(&target);
    show_module(app, app_id, Some(LaunchFile::Path(target)))
}

/// Bureau : nouvelle fenetre. Mobile : une seule vue, qui charge le module (ou est creee au demarrage).
fn show_module<R: Runtime>(app: &AppHandle<R>, app_id: &str, file: Option<LaunchFile>) -> bool {
    #[cfg(mobile)]
    if let Some(view) = app.webview_windows().into_values().next() {
        let token = file.map(|f| app.state::<Shell>().launches.put(f));
        let target = view.url().and_then(|u| u.join(&windows::module_url(app_id, token.as_deref())).map_err(Into::into));
        return match target.and_then(|u| view.navigate(u)) {
            Ok(()) => true,
            Err(e) => {
                app.state::<Shell>().log.error(&format!("navigation : {e}"));
                false
            }
        };
    }
    match windows::open_window(app, app_id, file) {
        Ok(_) => true,
        Err(e) => {
            app.state::<Shell>().log.error(&e);
            false
        }
    }
}

fn on_run_event<R: Runtime>(app: &AppHandle<R>, event: RunEvent) {
    match event {
        RunEvent::ExitRequested { .. } => arm_exit_deadline(),
        RunEvent::Exit => app.state::<Shell>().log.info("fermeture de ForgeOffice"),
        // macOS (Finder), iOS et Android (« Ouvrir avec ») : fichiers ou URL de contenu.
        #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
        RunEvent::Opened { urls } => {
            for url in urls {
                let target = match url.to_file_path() {
                    Ok(path) => path.to_string_lossy().to_string(),
                    Err(()) => url.to_string(),
                };
                open_target(app, target);
            }
        }
        _ => {}
    }
}

/// Filet de securite : si un composant bloque la sortie, le processus se termine quand meme.
fn arm_exit_deadline() {
    static ARMED: AtomicBool = AtomicBool::new(false);
    if ARMED.swap(true, Ordering::SeqCst) {
        return;
    }
    let spawned = std::thread::Builder::new().name("fo-exit".into()).spawn(|| {
        std::thread::sleep(EXIT_DEADLINE);
        std::process::exit(0);
    });
    if spawned.is_err() {
        std::process::exit(0);
    }
}

/// Un plantage du code natif laisse une trace dans le journal.
fn install_panic_hook(log_dir: std::path::PathBuf) {
    let previous = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        logging::Logger::new(&log_dir).error(&format!("panic : {info}"));
        previous(info);
    }));
}
