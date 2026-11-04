//! Erreurs du moteur, toujours formulees en francais pour l'interface.
//!
//! Les erreurs SQLite sont traduites : contraintes (obligatoire, doublon,
//! integrite referentielle, regles de validation nommees `fo:<champ>:<message>`),
//! objets introuvables, syntaxe, verrouillage, refus de securite.

use serde::ser::SerializeStruct;
use serde::{Serialize, Serializer};

/// Prefixe des noms de contraintes CHECK generees par ForgeOffice.
pub const PREFIXE_CONTRAINTE: &str = "fo:";

/// Erreur du moteur Base de donnees.
#[derive(Debug, thiserror::Error)]
pub enum ErreurBase {
    /// Nom de table, champ, index ou objet refuse.
    #[error("Nom invalide : {0}")]
    NomInvalide(String),
    /// Objet absent de la base.
    #[error("« {0} » est introuvable.")]
    Introuvable(String),
    /// Objet deja present.
    #[error("« {0} » existe déjà.")]
    ExisteDeja(String),
    /// Valeur refusee par un type, une regle de validation ou un masque de saisie.
    #[error("Valeur refusée pour « {champ} » : {message}")]
    Validation {
        /// Champ concerne (`*` pour une regle de table).
        champ: String,
        /// Explication lisible.
        message: String,
    },
    /// Contrainte de la base (obligatoire, doublon, relation).
    #[error("{0}")]
    Contrainte(String),
    /// Operation refusee par la securite du moteur.
    #[error("Opération interdite : {0}")]
    Interdit(String),
    /// Expression Access impossible a traduire.
    #[error("Expression invalide : {0}")]
    Expression(String),
    /// Probleme de lecture ou d'ecriture CSV.
    #[error("CSV : {0}")]
    Csv(String),
    /// Requete SQL incorrecte.
    #[error("Erreur SQL : {0}")]
    Syntaxe(String),
    /// Autre erreur avec message deja redige.
    #[error("{0}")]
    Message(String),
    /// Erreur SQLite non reconnue (message d'origine conserve).
    #[error("Erreur SQLite : {0}")]
    Sqlite(String),
    /// Erreur de fichier.
    #[error("Fichier : {0}")]
    Fichier(#[from] std::io::Error),
    /// JSON mal forme.
    #[error("JSON invalide : {0}")]
    Json(#[from] serde_json::Error),
}

/// Resultat du moteur.
pub type Resultat<T> = Result<T, ErreurBase>;

impl ErreurBase {
    /// Code court et stable, utile a l'interface pour choisir une icone ou une action.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NomInvalide(_) => "nom_invalide",
            Self::Introuvable(_) => "introuvable",
            Self::ExisteDeja(_) => "existe_deja",
            Self::Validation { .. } => "validation",
            Self::Contrainte(_) => "contrainte",
            Self::Interdit(_) => "interdit",
            Self::Expression(_) => "expression",
            Self::Csv(_) => "csv",
            Self::Syntaxe(_) => "syntaxe",
            Self::Message(_) => "message",
            Self::Sqlite(_) => "sqlite",
            Self::Fichier(_) => "fichier",
            Self::Json(_) => "json",
        }
    }

    /// Raccourci pour une erreur de message libre.
    pub fn msg(texte: impl Into<String>) -> Self {
        Self::Message(texte.into())
    }
}

impl Serialize for ErreurBase {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("ErreurBase", 2)?;
        s.serialize_field("code", self.code())?;
        s.serialize_field("message", &self.to_string())?;
        s.end()
    }
}

impl From<rusqlite::Error> for ErreurBase {
    fn from(e: rusqlite::Error) -> Self {
        traduire(&e)
    }
}

fn apres<'a>(message: &'a str, prefixe: &str) -> Option<&'a str> {
    message.find(prefixe).map(|i| message[i + prefixe.len()..].trim())
}

/// Nom de champ sans le prefixe de table (`t.c` -> `c`).
fn champ_seul(cible: &str) -> &str {
    cible.rsplit_once('.').map_or(cible, |(_, c)| c)
}

/// Traduit une contrainte CHECK nommee `fo:<champ>:<message>` en erreur de validation.
pub fn traduire_contrainte(nom: &str) -> ErreurBase {
    if let Some(reste) = nom.strip_prefix(PREFIXE_CONTRAINTE) {
        if let Some((champ, message)) = reste.split_once(':') {
            return ErreurBase::Validation {
                champ: champ.to_string(),
                message: message.to_string(),
            };
        }
    }
    ErreurBase::Contrainte(format!("Règle de validation non respectée ({nom})."))
}

/// Traduit une erreur SQLite en message francais.
pub fn traduire(e: &rusqlite::Error) -> ErreurBase {
    let brut = match e {
        rusqlite::Error::SqlInputError { msg, .. } => msg.clone(),
        autre => autre.to_string(),
    };
    if let rusqlite::Error::MultipleStatement = e {
        return ErreurBase::Syntaxe("une seule instruction SQL à la fois.".into());
    }
    if let Some(cible) = apres(&brut, "NOT NULL constraint failed:") {
        return ErreurBase::Contrainte(format!(
            "Le champ « {} » est obligatoire.",
            champ_seul(cible)
        ));
    }
    if let Some(cible) = apres(&brut, "UNIQUE constraint failed:") {
        let champs: Vec<&str> = cible.split(',').map(|c| champ_seul(c.trim())).collect();
        return ErreurBase::Contrainte(format!(
            "Doublon refusé : la valeur de « {} » existe déjà (clé primaire ou index sans doublons).",
            champs.join(", ")
        ));
    }
    if brut.contains("FOREIGN KEY constraint failed") {
        return ErreurBase::Contrainte(
            "Intégrité référentielle : l'enregistrement est lié à une autre table (relation)."
                .into(),
        );
    }
    if let Some(nom) = apres(&brut, "CHECK constraint failed:") {
        return traduire_contrainte(nom);
    }
    if let Some(nom) = apres(&brut, "no such table:") {
        return ErreurBase::Introuvable(nom.trim_start_matches("main.").to_string());
    }
    if let Some(nom) = apres(&brut, "no such column:") {
        return ErreurBase::Syntaxe(format!("champ inconnu « {nom} »."));
    }
    if let Some(nom) = apres(&brut, "no such function:") {
        return ErreurBase::Syntaxe(format!("fonction inconnue « {nom} »."));
    }
    if brut.contains("already exists") {
        let nom = brut
            .split_whitespace()
            .nth(1)
            .unwrap_or("")
            .trim_matches('"')
            .to_string();
        return ErreurBase::ExisteDeja(nom);
    }
    if let Some(pres) = apres(&brut, "near") {
        let pres = pres.trim_end_matches(": syntax error").trim_matches('"');
        return ErreurBase::Syntaxe(format!("erreur de syntaxe près de « {pres} »."));
    }
    if brut.contains("incomplete input") {
        return ErreurBase::Syntaxe("instruction incomplète.".into());
    }
    if brut.contains("not authorized") || brut.contains("prohibited") {
        return ErreurBase::Interdit(
            "instruction refusée par la sécurité de ForgeOffice (ATTACH, PRAGMA, extension ou table interne)."
                .into(),
        );
    }
    if brut.contains("database is locked") || brut.contains("database table is locked") {
        return ErreurBase::Message(
            "La base est verrouillée par un autre programme ou une autre fenêtre.".into(),
        );
    }
    if brut.contains("file is not a database") || brut.contains("file is encrypted") {
        return ErreurBase::Message("Ce fichier n'est pas une base de données SQLite valide.".into());
    }
    if brut.contains("readonly database") {
        return ErreurBase::Interdit("la base est ouverte en lecture seule.".into());
    }
    if brut.contains("cannot VACUUM from within a transaction")
        || brut.contains("cannot change") && brut.contains("within a transaction")
    {
        return ErreurBase::Message("Terminez d'abord la transaction en cours.".into());
    }
    if let rusqlite::Error::InvalidParameterCount(attendu, recu) = e {
        return ErreurBase::Syntaxe(format!(
            "nombre de paramètres incorrect ({recu} fourni(s), {attendu} attendu(s))."
        ));
    }
    ErreurBase::Sqlite(brut)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contrainte_nommee_devient_validation() {
        match traduire_contrainte("fo:Prix:doit être positif") {
            ErreurBase::Validation { champ, message } => {
                assert_eq!(champ, "Prix");
                assert_eq!(message, "doit être positif");
            }
            autre => panic!("inattendu : {autre:?}"),
        }
    }

    #[test]
    fn serialisation_code_message() {
        let e = ErreurBase::Introuvable("Clients".into());
        let json = serde_json::to_value(&e).unwrap_or_default();
        assert_eq!(json["code"], "introuvable");
        assert_eq!(json["message"], "« Clients » est introuvable.");
    }
}
