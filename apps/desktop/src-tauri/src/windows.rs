// Fenetres de la suite : une fenetre par document ou par application, toutes construites sur le
// modele `main` de tauri.conf.json (sans decorations sur bureau : la barre de titre Office est
// dessinee par la page ; 800 x 500 minimum). Titre + indicateur de modification, garde a la fermeture.

use std::collections::HashMap;
use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder, Window, WindowEvent};

use crate::grants::lock;
use crate::launch::{new_token, LaunchFile};
use crate::{texts, Shell};

/// Prefixe des etiquettes de fenetre (repris par capabilities/default.json : `fo-*`).
pub const LABEL_PREFIX: &str = "fo-";

#[derive(Default, Clone)]
struct DocState {
    title: String,
    modified: bool,
}

/// Titre et etat « modifie » de chaque fenetre, par etiquette.
#[derive(Default)]
pub struct Docs {
    map: Mutex<HashMap<String, DocState>>,
}

impl Docs {
    /// Met a jour le titre ou l'indicateur et renvoie le titre systeme a afficher.
    fn update(&self, label: &str, title: Option<&str>, modified: Option<bool>) -> String {
        let mut map = lock(&self.map);
        let doc = map.entry(label.to_string()).or_default();
        if let Some(t) = title {
            doc.title = t.chars().take(512).collect();
        }
        if let Some(m) = modified {
            doc.modified = m;
        }
        window_title(&doc.title, doc.modified)
    }

    pub fn is_modified(&self, label: &str) -> bool {
        lock(&self.map).get(label).is_some_and(|d| d.modified)
    }

    fn forget(&self, label: &str) {
        lock(&self.map).remove(label);
    }
}

/// Titre systeme (barre des taches) : `*` devant un document modifie, comme le Bloc-notes.
pub fn window_title(title: &str, modified: bool) -> String {
    let base = if title.trim().is_empty() { texts::APP_NAME } else { title };
    if modified { format!("*{base}") } else { base.to_string() }
}

/// URL d'un module : `index.html?app=word` (+ `&token=...` si un document l'accompagne).
pub fn module_url(app_id: &str, token: Option<&str>) -> String {
    match token {
        Some(t) => format!("index.html?app={app_id}&token={t}"),
        None => format!("index.html?app={app_id}"),
    }
}

/// Ouvre une nouvelle fenetre sur un module, avec un document eventuel.
pub fn open_window<R: Runtime>(app: &AppHandle<R>, app_id: &str, file: Option<LaunchFile>) -> Result<WebviewWindow<R>, String> {
    if !crate::modules::is_app_id(app_id) {
        return Err(texts::ERR_UNKNOWN_APP.into());
    }
    let token = file.map(|f| app.state::<Shell>().launches.put(f));
    let mut config = app
        .config()
        .app
        .windows
        .iter()
        .find(|w| w.label == "main")
        .cloned()
        .unwrap_or_default();
    config.label = format!("{LABEL_PREFIX}{}", &new_token()[..12]);
    config.url = WebviewUrl::App(module_url(app_id, token.as_deref()).into());
    config.create = true;
    let data_dir = app.state::<Shell>().webview_dir.clone();
    let window = WebviewWindowBuilder::from_config(app, &config)
        .map(|b| match data_dir {
            Some(dir) => b.data_directory(dir),
            None => b,
        })
        .and_then(|b| b.build())
        .map_err(|e| format!("Fenêtre impossible : {e}"))?;
    let _ = window.set_focus(); // une fenetre non focalisee reste utilisable
    Ok(window)
}

pub fn set_title<R: Runtime>(window: &Window<R>, title: Option<&str>, modified: Option<bool>) {
    let shell = window.state::<Shell>();
    let text = shell.docs.update(window.label(), title, modified);
    if let Err(e) = window.set_title(&text) {
        shell.log.warn(&format!("titre de fenetre : {e}"));
    }
}

/// Fermeture demandee par le systeme ou la croix : confirmation native si le document est modifie.
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    match event {
        WindowEvent::CloseRequested { api, .. } => {
            let shell = window.state::<Shell>();
            if !shell.docs.is_modified(window.label()) {
                return;
            }
            api.prevent_close();
            confirm_close(window);
        }
        WindowEvent::Destroyed => {
            window.state::<Shell>().docs.forget(window.label());
        }
        _ => {}
    }
}

fn confirm_close<R: Runtime>(window: &Window<R>) {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
    let target = window.clone();
    let dialog = window
        .dialog()
        .message(texts::CLOSE_MESSAGE)
        .title(texts::CLOSE_TITLE)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(texts::CLOSE_CONFIRM.into(), texts::CLOSE_CANCEL.into()));
    #[cfg(desktop)]
    let dialog = dialog.parent(window);
    dialog.show(move |confirmed| {
        if confirmed {
            destroy(&target);
        }
    });
}

/// Fermeture sans confirmation (la page a deja demande a l'utilisateur).
pub fn destroy<R: Runtime>(window: &Window<R>) {
    let shell = window.state::<Shell>();
    shell.docs.forget(window.label());
    if let Err(e) = window.destroy() {
        shell.log.error(&format!("fermeture de fenetre : {e}"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn titre_systeme_et_indicateur() {
        assert_eq!(window_title("Rapport.docx - Texte", false), "Rapport.docx - Texte");
        assert_eq!(window_title("Rapport.docx - Texte", true), "*Rapport.docx - Texte");
        assert_eq!(window_title("  ", false), "ForgeOffice");
        let docs = Docs::default();
        assert_eq!(docs.update("fo-1", Some("Budget"), None), "Budget");
        assert_eq!(docs.update("fo-1", None, Some(true)), "*Budget");
        assert!(docs.is_modified("fo-1") && !docs.is_modified("fo-2"));
        assert_eq!(docs.update("fo-1", Some("Budget 2"), None), "*Budget 2");
        docs.forget("fo-1");
        assert!(!docs.is_modified("fo-1"));
    }

    #[test]
    fn url_de_module() {
        assert_eq!(module_url("word", None), "index.html?app=word");
        assert_eq!(module_url("excel", Some("ab12")), "index.html?app=excel&token=ab12");
    }
}
