//! forge-convert : moteur de conversion et d'outils PDF de ForgeOffice.
//!
//! Repris de ForgePDF (moteur `engine` + commandes Tauri) et ameliore :
//! crate autonome sans Tauri, pur Rust d'abord (fonctionne aussi sur Android/iOS),
//! binaires externes seulement en option (PDF/A, OCR, rendu en images, Office fidele),
//! detectes et signales par `capacites()`.
//!
//! Point d'entree unique : [`run`] avec une [`Operation`] serialisable (serde),
//! ou les fonctions par domaine des modules [`pdf`] et [`conv`].

pub mod conv;
pub mod erreur;
pub mod fichiers;
pub mod operation;
pub mod outils;
pub mod pdf;

pub use erreur::{ConvertError, Resultat};
pub use fichiers::Cible;
pub use operation::{capacites, run, ActionPdf, Capacites, Operation, Output};

/// Version du moteur.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Decode et desechappe le contenu d'un texte quick-xml (entites comprises).
pub(crate) fn xml_text(t: &quick_xml::events::BytesText<'_>) -> String {
    match t.xml10_content() {
        Ok(raw) => quick_xml::escape::unescape(&raw).map(|s| s.into_owned()).unwrap_or_else(|_| raw.into_owned()),
        Err(_) => String::new(),
    }
}

/// Resout une reference d'entite quick-xml (`Event::GeneralRef`) : depuis quick-xml 0.38
/// le texte est coupe a chaque `&...;`, sans ce traitement il serait tronque.
pub(crate) fn xml_entity(e: &quick_xml::events::BytesRef<'_>) -> String {
    if let Ok(Some(c)) = e.resolve_char_ref() {
        return c.to_string();
    }
    let brut = format!("&{};", e.decode().unwrap_or_default());
    quick_xml::escape::unescape(&brut).map(|s| s.into_owned()).unwrap_or(brut)
}
