// Textes visibles produits par la coquille native (dialogues, erreurs remontees a la page).

pub const APP_NAME: &str = "ForgeOffice";
pub const OPEN_TITLE: &str = "Ouvrir";
pub const SAVE_AS_TITLE: &str = "Enregistrer sous";
pub const ALL_FILES: &str = "Tous les fichiers";
pub const ALL_SUPPORTED: &str = "Tous les documents pris en charge";

pub const CLOSE_TITLE: &str = "Modifications non enregistrées";
pub const CLOSE_MESSAGE: &str =
    "Ce document contient des modifications qui n'ont pas été enregistrées. Fermer la fenêtre quand même ?";
pub const CLOSE_CONFIRM: &str = "Fermer sans enregistrer";
pub const CLOSE_CANCEL: &str = "Annuler";

pub const ERR_NOT_ALLOWED: &str =
    "Accès refusé : ce fichier n'a pas été choisi par l'utilisateur (ouvrez-le avec la commande Ouvrir).";
pub const ERR_TOO_BIG: &str = "Fichier trop volumineux (1 Go au maximum).";
pub const ERR_UNKNOWN_APP: &str = "Application inconnue.";
#[cfg(mobile)]
pub const ERR_UPDATES_MOBILE: &str = "Les mises à jour passent par la boutique d'applications sur mobile.";
pub const ERR_NO_UPDATE: &str = "Aucune mise à jour disponible.";

pub fn err_read(detail: &str) -> String {
    format!("Impossible de lire le fichier : {detail}")
}

pub fn err_write(detail: &str) -> String {
    format!("Impossible d'enregistrer le fichier : {detail}")
}

pub fn err_update(detail: &str) -> String {
    format!("Mise à jour impossible : {detail}")
}
