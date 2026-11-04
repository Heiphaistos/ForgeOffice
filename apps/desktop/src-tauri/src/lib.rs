// Coquille Tauri 2 de ForgeOffice (bureau + mobile). La page web (apps/web) fait tout le travail
// bureautique ; la coquille fournit les services natifs : fichiers (registre d'autorisations,
// ecriture atomique), fenetres par module, recents, reglages, journal, impression, mise a jour.

mod atomic;
mod base_cmds;
mod commands;
mod convert_cmds;
mod frame;
mod grants;
mod launch;
mod logging;
mod modules;
mod portable;
mod recents;
mod settings;
mod texts;
mod updates;
mod windows;

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
    /// Profil WebView a cote de l'exe en mode portable (None = emplacement par defaut).
    pub webview_dir: Option<std::path::PathBuf>,
}

/// Delai maximal entre la demande de sortie et la fin du processus.
const EXIT_DEADLINE: Duration = Duration::from_secs(5);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Windows : sans WebView2 aucune fenetre ne peut s'ouvrir (cas surtout de l'exe portable,
    // l'installeur embarque le programme d'installation de WebView2).
    #[cfg(windows)]
    if tauri::webview_version().is_err() {
        fatal(texts::ERR_WEBVIEW2);
    }
    let builder = tauri::Builder::default();
    // L'instance unique doit etre le premier greffon : une seconde instance passe la main et s'arrete.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
        let args = argv.get(1..).unwrap_or_default();
        open_files_or_hub(app, &launch::files_from_args(args, std::path::Path::new(&cwd)));
    }));
    let builder = builder.plugin(tauri_plugin_dialog::init()).plugin(tauri_plugin_fs::init());
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    let app = builder
        .setup(|app| {
            setup(app.handle())?;
            Ok(())
        })
        .manage(base_cmds::Bases::default())
        .on_window_event(|window, event| {
            windows::on_window_event(window, event);
            base_cmds::on_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            base_cmds::base_open,
            base_cmds::base_create,
            base_cmds::base_copy,
            base_cmds::base_close,
            base_cmds::base_op,
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
            convert_cmds::convert_capacites,
            convert_cmds::convert_run,
            convert_cmds::convert_run_bytes,
            convert_cmds::convert_pick_folder,
            convert_cmds::convert_miniatures,
            convert_cmds::convert_save_into,
        ])
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(on_run_event),
        Err(e) => fatal(&texts::err_start(&e.to_string())),
    }
}

/// Erreur de demarrage : boite de dialogue sous Windows (pas de console), sortie d'erreur ailleurs.
fn fatal(message: &str) -> ! {
    #[cfg(windows)]
    rfd::MessageDialog::new()
        .set_title(texts::APP_NAME)
        .set_description(message)
        .set_level(rfd::MessageLevel::Error)
        .show();
    eprintln!("{message}");
    std::process::exit(1);
}

fn setup<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let dirs = portable::dirs(app)?;
    let log = logging::Logger::new(&dirs.logs);
    install_panic_hook(dirs.logs.clone());
    if let Some(warning) = &dirs.warning {
        log.warn(warning);
    }
    let data_dir = dirs.data;

    let recents = recents::Recents::load(data_dir.join("recents.json"));
    let grants = grants::Grants::default();
    // Les fichiers recents restent relisibles d'une session a l'autre.
    for path in recents.paths() {
        grants.grant(&path);
    }
    log.info(&format!(
        "demarrage de ForgeOffice {} ({} {}{}) donnees : {}",
        app.package_info().version,
        std::env::consts::OS,
        std::env::consts::ARCH,
        if portable::PORTABLE_BUILD { ", portable" } else { "" },
        data_dir.display()
    ));
    app.manage(Shell {
        grants,
        launches: launch::Launches::default(),
        recents,
        settings: settings::SettingsStore::load(data_dir.join("settings.json")),
        log,
        docs: windows::Docs::default(),
        webview_dir: dirs.webview,
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
    {
        if portable::PORTABLE_BUILD {
            portable::cleanup_old_exe(app);
        }
        updates::start_background(app.clone());
    }
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
        let url = windows::module_url(app_id, token.as_deref());
        let navigated = view
            .url()
            .map_err(|e| e.to_string())
            .and_then(|u| u.join(&url).map_err(|e| e.to_string()))
            .and_then(|u| view.navigate(u).map_err(|e| e.to_string()));
        return match navigated {
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
