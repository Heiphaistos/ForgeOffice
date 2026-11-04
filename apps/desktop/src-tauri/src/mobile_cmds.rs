// Commandes propres au mobile (Android) : « Ouvrir avec », partage, plein ecran, barres systeme,
// sortie de l'appli. Sur bureau elles existent aussi (le contrat de la page est le meme) et ne font rien.

use tauri::ipc::Response;
use tauri::{AppHandle, Runtime};

/// Premier document recu par « Ouvrir avec » / « Partager vers » (reponse vide si aucun).
#[tauri::command]
pub async fn inbox_take<R: Runtime>(app: AppHandle<R>) -> Result<Response, String> {
    #[cfg(target_os = "android")]
    if let Some(path) = crate::android::take_inbox(&app).await?.into_iter().next() {
        use tauri::Manager;
        let path = path.to_string_lossy().to_string();
        app.state::<crate::Shell>().log.info(&format!("document recu : {path}"));
        return crate::commands::file_at(&app, &path);
    }
    let _ = &app;
    Ok(crate::commands::no_file())
}

/// Partage un document de la bibliotheque (message, courriel, Drive...) par la feuille de partage du systeme.
#[tauri::command]
pub async fn share_file<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        use tauri::Manager;
        if !app.state::<crate::Shell>().grants.allows(&path) {
            return Err(crate::texts::ERR_NOT_ALLOWED.into());
        }
        let name = crate::commands::display_name(&path);
        crate::android::share(&app, std::path::Path::new(&path), &name).await
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (&app, &path);
        Err(crate::texts::ERR_MOBILE_ONLY.into())
    }
}

/// Plein ecran immersif (diaporama) : masque ou rend les barres systeme.
#[tauri::command]
pub async fn set_immersive<R: Runtime>(app: AppHandle<R>, on: bool) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return crate::android::set_immersive(&app, on).await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = (&app, on);
        Ok(())
    }
}

/// Couleur de fond derriere les barres systeme (ARGB) et icones claires ou sombres, selon le theme de la page.
#[tauri::command]
pub async fn set_system_bars<R: Runtime>(app: AppHandle<R>, dark: bool, color: i32) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return crate::android::set_bars(&app, dark, color).await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = (&app, dark, color);
        Ok(())
    }
}

/// Quitte l'appli (bouton Retour depuis l'Accueil).
#[tauri::command]
pub async fn exit_app<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return crate::android::exit_app(&app).await;
    #[cfg(not(target_os = "android"))]
    {
        let _ = &app;
        Ok(())
    }
}
