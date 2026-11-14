// Textes visibles produits par la coquille native (dialogues, erreurs remontees a la page).

pub const APP_NAME: &str = "ForgeOffice";
#[cfg(not(target_os = "android"))]
pub const OPEN_TITLE: &str = "Ouvrir";
#[cfg(not(target_os = "android"))]
pub const SAVE_AS_TITLE: &str = "Enregistrer sous";
#[cfg(not(target_os = "android"))]
pub const ALL_FILES: &str = "Tous les fichiers";
#[cfg(not(target_os = "android"))]
pub const ALL_SUPPORTED: &str = "Tous les documents pris en charge";

pub const CLOSE_TITLE: &str = "Modifications non enregistrées";
pub const CLOSE_MESSAGE: &str =
    "Ce document contient des modifications qui n'ont pas été enregistrées. Fermer la fenêtre quand même ?";
pub const CLOSE_CONFIRM: &str = "Fermer sans enregistrer";
pub const CLOSE_CANCEL: &str = "Annuler";

pub const ERR_NOT_ALLOWED: &str =
    "Accès refusé : ce fichier n'a pas été choisi par l'utilisateur (ouvrez-le avec la commande Ouvrir).";
pub const ERR_TOO_BIG: &str =
    if cfg!(mobile) { "Fichier trop volumineux (256 Mo au maximum sur mobile)." } else { "Fichier trop volumineux (1 Go au maximum)." };
pub const ERR_UNKNOWN_APP: &str = "Application inconnue.";
#[cfg(target_os = "ios")]
pub const ERR_UPDATES_MOBILE: &str = "Les mises à jour passent par la boutique d'applications sur mobile.";
#[cfg(target_os = "ios")]
pub const ERR_PRINT_MOBILE: &str = "Impression native indisponible sur iOS.";
#[cfg(not(target_os = "android"))]
pub const ERR_MOBILE_ONLY: &str = "Cette fonction n'existe que sur Android.";
#[cfg(desktop)]
pub const ERR_NO_UPDATE: &str = "Aucune mise à jour disponible.";

#[cfg(windows)]
pub const ERR_WEBVIEW2: &str = "ForgeOffice a besoin de Microsoft Edge WebView2, absent de cet ordinateur.\n\n\
    Installez-le (gratuit) depuis https://go.microsoft.com/fwlink/p/?LinkId=2124703 puis relancez ForgeOffice.\n\
    La version avec installeur l'installe automatiquement.";

pub fn err_start(detail: &str) -> String {
    format!("ForgeOffice n'a pas pu démarrer : {detail}")
}

pub fn err_read(detail: &str) -> String {
    format!("Impossible de lire le fichier : {detail}")
}

pub fn err_write(detail: &str) -> String {
    format!("Impossible d'enregistrer le fichier : {detail}")
}

#[cfg(target_os = "android")]
pub const ERR_UPDATE_PERMISSION: &str =
    "Autorisez l'installation de mises à jour pour Forge Office dans les réglages qui viennent de s'ouvrir, puis réessayez.";

#[cfg(any(desktop, target_os = "android"))]
pub fn err_update(detail: &str) -> String {
    format!("Mise à jour impossible : {detail}")
}

pub const ERR_BAD_PATH: &str = "Chemin refusé : il doit rester dans le dossier ouvert.";
pub const ERR_EXISTS: &str = "Un élément du même nom existe déjà à cet endroit.";
pub const ERR_INTO_SELF: &str = "Impossible de placer un dossier dans lui-même.";
pub const ERR_NOT_FOUND: &str = "Élément introuvable.";
#[cfg(not(desktop))]
pub const ERR_DESKTOP_ONLY: &str = "Cette fonction n'existe que sur l'application de bureau.";
#[cfg(desktop)]
pub const OPEN_FOLDER_TITLE: &str = "Ouvrir un dossier";

pub fn err_trash(detail: &str) -> String {
    format!("Impossible d'envoyer à la corbeille : {detail}")
}

#[cfg(desktop)]
pub fn err_reveal(detail: &str) -> String {
    format!("Impossible d'ouvrir l'explorateur de fichiers : {detail}")
}

/// Aucune fenetre n'a pu etre ouverte au demarrage.
pub fn err_no_window() -> String {
    "ForgeOffice n'a pas pu ouvrir sa fenêtre (voir le journal). Fermez les processus « forgeoffice » ou « msedgewebview2 » restants puis relancez.".to_string()
}
