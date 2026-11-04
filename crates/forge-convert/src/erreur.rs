//! Erreurs du moteur, toutes en francais et serialisables (la coquille Tauri les
//! renvoie telles quelles a l'interface).

use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "type", content = "detail", rename_all = "snake_case")]
pub enum ConvertError {
    #[error("Lecture impossible : {0}")]
    Lecture(String),
    #[error("Écriture impossible : {0}")]
    Ecriture(String),
    #[error("Fichier trop volumineux ({taille} octets, limite {limite} octets)")]
    TropVolumineux { taille: u64, limite: u64 },
    #[error("Chemin refusé : {0}")]
    CheminRefuse(String),
    #[error("Paramètre invalide : {0}")]
    Parametre(String),
    #[error("PDF invalide ou endommagé : {0}")]
    PdfInvalide(String),
    #[error("Ce PDF est protégé : mot de passe manquant ou incorrect")]
    MotDePasse,
    #[error("Outil {outil} absent : installez-le ou {alternative}")]
    OutilAbsent { outil: String, alternative: String },
    #[error("L'outil {outil} a échoué : {detail}")]
    OutilEchec { outil: String, detail: String },
    #[error("Conversion .{de} vers .{vers} non prise en charge")]
    NonSupporte { de: String, vers: String },
    #[error("{0}")]
    Echec(String),
}

pub type Resultat<T> = Result<T, ConvertError>;

impl From<anyhow::Error> for ConvertError {
    fn from(e: anyhow::Error) -> Self {
        ConvertError::Echec(format!("{e:#}"))
    }
}

impl From<lopdf::Error> for ConvertError {
    fn from(e: lopdf::Error) -> Self {
        use lopdf::Error as E;
        match e {
            E::Decryption(_) | E::InvalidPassword => ConvertError::MotDePasse,
            autre => ConvertError::PdfInvalide(autre.to_string()),
        }
    }
}

/// Raccourci : erreur de parametre.
pub(crate) fn param(msg: impl Into<String>) -> ConvertError {
    ConvertError::Parametre(msg.into())
}
