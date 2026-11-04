//! Types de donnees Access et proprietes de champ.
//!
//! Chaque type Access a un type declare SQLite qui conserve la bonne affinite
//! et reste lisible par d'autres outils (`VARCHAR(255)`, `BOOLEAN`, `DATETIME`...).

use serde::{Deserialize, Serialize};
use std::str::FromStr;

use crate::erreur::{ErreurBase, Resultat};

/// Type de donnees d'un champ (equivalent des types Access).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum TypeChamp {
    /// Texte court (255 caracteres maximum, taille reglable).
    TexteCourt,
    /// Texte long (memo).
    TexteLong,
    /// Nombre - Octet (0 a 255).
    Octet,
    /// Nombre - Entier (-32 768 a 32 767).
    Entier,
    /// Nombre - Entier long (32 bits signe).
    EntierLong,
    /// Nombre - Grand entier (64 bits).
    GrandEntier,
    /// Nombre - Reel simple.
    ReelSimple,
    /// Nombre - Reel double.
    ReelDouble,
    /// Nombre - Decimal (precision et echelle).
    Decimal,
    /// Monetaire (4 decimales).
    Monetaire,
    /// Date/Heure (stockee en ISO 8601).
    DateHeure,
    /// NumeroAuto (cle primaire auto-incrementee).
    NumeroAuto,
    /// Oui/Non.
    OuiNon,
    /// Lien hypertexte.
    LienHypertexte,
    /// Piece jointe (contenu binaire).
    PieceJointe,
    /// Objet OLE (binaire herite).
    ObjetOle,
    /// Champ calcule (colonne generee).
    Calcule,
}

/// Facon de rendre une valeur SQLite en JSON.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Rendu {
    /// Nombre JSON.
    Nombre,
    /// Texte JSON.
    Texte,
    /// Booleen JSON.
    Booleen,
    /// Date ISO 8601 (texte).
    Date,
    /// Objet `{ "type": "blob", "base64": ..., "taille": n }`.
    Blob,
    /// Valeur telle que SQLite la renvoie.
    Brut,
}

/// Indexation d'un champ (propriete « Indexe »).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Indexation {
    /// Non indexe.
    #[default]
    Non,
    /// Oui - avec doublons.
    AvecDoublons,
    /// Oui - sans doublons.
    SansDoublons,
}

/// Tous les types, dans l'ordre du menu deroulant d'Access.
pub const TOUS_LES_TYPES: [TypeChamp; 17] = [
    TypeChamp::TexteCourt,
    TypeChamp::TexteLong,
    TypeChamp::Octet,
    TypeChamp::Entier,
    TypeChamp::EntierLong,
    TypeChamp::GrandEntier,
    TypeChamp::ReelSimple,
    TypeChamp::ReelDouble,
    TypeChamp::Decimal,
    TypeChamp::Monetaire,
    TypeChamp::DateHeure,
    TypeChamp::NumeroAuto,
    TypeChamp::OuiNon,
    TypeChamp::LienHypertexte,
    TypeChamp::PieceJointe,
    TypeChamp::ObjetOle,
    TypeChamp::Calcule,
];

impl TypeChamp {
    /// Libelle francais affiche dans le mode Creation.
    pub fn libelle(self) -> &'static str {
        match self {
            Self::TexteCourt => "Texte court",
            Self::TexteLong => "Texte long",
            Self::Octet => "Octet",
            Self::Entier => "Nombre entier",
            Self::EntierLong => "Entier long",
            Self::GrandEntier => "Grand entier",
            Self::ReelSimple => "Réel simple",
            Self::ReelDouble => "Réel double",
            Self::Decimal => "Décimal",
            Self::Monetaire => "Monétaire",
            Self::DateHeure => "Date/Heure",
            Self::NumeroAuto => "NuméroAuto",
            Self::OuiNon => "Oui/Non",
            Self::LienHypertexte => "Lien hypertexte",
            Self::PieceJointe => "Pièce jointe",
            Self::ObjetOle => "Objet OLE",
            Self::Calcule => "Calculé",
        }
    }

    /// Plage autorisee pour les entiers bornes.
    pub fn plage_entiere(self) -> Option<(i64, i64)> {
        match self {
            Self::Octet => Some((0, 255)),
            Self::Entier => Some((-32_768, 32_767)),
            Self::EntierLong => Some((i64::from(i32::MIN), i64::from(i32::MAX))),
            _ => None,
        }
    }

    /// Vrai pour les types entiers (y compris NumeroAuto).
    pub fn est_entier(self) -> bool {
        matches!(
            self,
            Self::Octet | Self::Entier | Self::EntierLong | Self::GrandEntier | Self::NumeroAuto
        )
    }

    /// Vrai pour tous les types numeriques.
    pub fn est_numerique(self) -> bool {
        self.est_entier()
            || matches!(
                self,
                Self::ReelSimple | Self::ReelDouble | Self::Decimal | Self::Monetaire
            )
    }

    /// Vrai pour les types texte.
    pub fn est_texte(self) -> bool {
        matches!(self, Self::TexteCourt | Self::TexteLong | Self::LienHypertexte)
    }

    /// Vrai pour les types binaires.
    pub fn est_binaire(self) -> bool {
        matches!(self, Self::PieceJointe | Self::ObjetOle)
    }

    /// Famille de compatibilite pour les relations (les deux cotes doivent partager la famille).
    pub fn famille(self) -> &'static str {
        if self.est_entier() {
            "entier"
        } else if self.est_numerique() {
            "reel"
        } else if self.est_texte() {
            "texte"
        } else if self.est_binaire() {
            "binaire"
        } else {
            match self {
                Self::DateHeure => "date",
                Self::OuiNon => "booleen",
                _ => "autre",
            }
        }
    }

    /// Rendu JSON des valeurs de ce type.
    pub fn rendu(self) -> Rendu {
        match self {
            Self::OuiNon => Rendu::Booleen,
            Self::DateHeure => Rendu::Date,
            Self::PieceJointe | Self::ObjetOle => Rendu::Blob,
            t if t.est_numerique() => Rendu::Nombre,
            Self::Calcule => Rendu::Brut,
            _ => Rendu::Texte,
        }
    }

    /// Type declare SQLite (affinite correcte, lisible ailleurs).
    pub fn declaration(self, p: &ProprietesChamp) -> String {
        match self {
            Self::TexteCourt => format!("VARCHAR({})", p.taille_texte()),
            Self::TexteLong => "LONGTEXT".into(),
            Self::Octet => "TINYINT".into(),
            Self::Entier => "SMALLINT".into(),
            Self::EntierLong | Self::NumeroAuto => "INTEGER".into(),
            Self::GrandEntier => "BIGINT".into(),
            Self::ReelSimple => "FLOAT".into(),
            Self::ReelDouble => "DOUBLE".into(),
            Self::Decimal => format!(
                "DECIMAL({},{})",
                p.precision.unwrap_or(18),
                p.echelle.unwrap_or(0)
            ),
            Self::Monetaire => "CURRENCY".into(),
            Self::DateHeure => "DATETIME".into(),
            Self::OuiNon => "BOOLEAN".into(),
            Self::LienHypertexte => "HYPERTEXT".into(),
            Self::PieceJointe => "BLOB".into(),
            Self::ObjetOle => "OLEBLOB".into(),
            Self::Calcule => p
                .type_resultat
                .filter(|t| *t != Self::Calcule && *t != Self::NumeroAuto)
                .unwrap_or(Self::TexteLong)
                .declaration(p),
        }
    }

    /// Deduit le type Access d'un type declare SQLite (bases creees ailleurs).
    pub fn depuis_declaration(decl: &str, cle_primaire_entiere: bool) -> (Self, Option<u32>) {
        let d = decl.trim().to_ascii_uppercase();
        let taille = d
            .split_once('(')
            .and_then(|(_, r)| r.split([')', ',']).next())
            .and_then(|n| n.trim().parse::<u32>().ok());
        let t = if d == "INTEGER" && cle_primaire_entiere {
            Self::NumeroAuto
        } else if d.starts_with("TINYINT") {
            Self::Octet
        } else if d.starts_with("SMALLINT") {
            Self::Entier
        } else if d.starts_with("BIGINT") {
            Self::GrandEntier
        } else if d.contains("INT") {
            Self::EntierLong
        } else if d.contains("HYPERTEXT") {
            Self::LienHypertexte
        } else if (d.contains("CHAR") || d.contains("VARCHAR")) && taille.is_some_and(|t| t <= 255)
        {
            Self::TexteCourt
        } else if d.contains("CHAR") || d.contains("CLOB") || d.contains("TEXT") || d.is_empty() {
            Self::TexteLong
        } else if d.starts_with("OLE") {
            Self::ObjetOle
        } else if d.contains("BLOB") || d.contains("BINARY") {
            Self::PieceJointe
        } else if d.starts_with("FLOAT") {
            Self::ReelSimple
        } else if d.contains("REAL") || d.contains("DOUB") || d.contains("FLOA") {
            Self::ReelDouble
        } else if d.contains("BOOL") || d == "BIT" {
            Self::OuiNon
        } else if d.contains("DATE") || d.contains("TIME") {
            Self::DateHeure
        } else if d.contains("CURRENCY") || d.contains("MONEY") {
            Self::Monetaire
        } else if d.contains("DEC") || d.contains("NUMERIC") {
            Self::Decimal
        } else {
            Self::TexteLong
        };
        (t, if t == Self::TexteCourt { taille } else { None })
    }
}

impl FromStr for TypeChamp {
    type Err = ErreurBase;

    /// Accepte l'identifiant (`texte_court`), le libelle francais ou le nom anglais d'Access.
    fn from_str(s: &str) -> Resultat<Self> {
        let cle: String = s
            .trim()
            .to_lowercase()
            .chars()
            .filter(|c| c.is_alphanumeric())
            .map(|c| match c {
                'é' | 'è' | 'ê' | 'ë' => 'e',
                c => c,
            })
            .collect();
        let t = match cle.as_str() {
            "textecourt" | "shorttext" | "texte" | "text" => TypeChamp::TexteCourt,
            "textelong" | "longtext" | "memo" => TypeChamp::TexteLong,
            "octet" | "byte" => TypeChamp::Octet,
            "entier" | "nombreentier" | "integer" => TypeChamp::Entier,
            "entierlong" | "longinteger" | "long" => TypeChamp::EntierLong,
            "grandentier" | "largenumber" | "bigint" => TypeChamp::GrandEntier,
            "reelsimple" | "single" => TypeChamp::ReelSimple,
            "reeldouble" | "double" | "reel" | "nombre" | "number" => TypeChamp::ReelDouble,
            "decimal" => TypeChamp::Decimal,
            "monetaire" | "currency" => TypeChamp::Monetaire,
            "dateheure" | "datetime" | "date" | "datetimeextended" => TypeChamp::DateHeure,
            "numeroauto" | "autonumber" => TypeChamp::NumeroAuto,
            "ouinon" | "yesno" | "booleen" | "boolean" => TypeChamp::OuiNon,
            "lienhypertexte" | "hyperlink" | "lien" => TypeChamp::LienHypertexte,
            "piecejointe" | "attachment" | "blob" => TypeChamp::PieceJointe,
            "objetole" | "oleobject" => TypeChamp::ObjetOle,
            "calcule" | "calculated" => TypeChamp::Calcule,
            _ => return Err(ErreurBase::msg(format!("Type de données inconnu : « {s} »."))),
        };
        Ok(t)
    }
}

/// Proprietes d'un champ (onglet « General » du mode Creation d'Access).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct ProprietesChamp {
    /// Taille du champ (texte court : 1 a 255, defaut 255).
    pub taille: Option<u32>,
    /// Format d'affichage (`Date, abrégé`, `Euro`, `0,00`...).
    pub format: Option<String>,
    /// Nombre de decimales affichees.
    pub decimales: Option<u8>,
    /// Precision (decimal).
    pub precision: Option<u8>,
    /// Echelle (decimal).
    pub echelle: Option<u8>,
    /// Masque de saisie Access (`00 00 00 00 00;0;_`).
    pub masque_saisie: Option<String>,
    /// Legende (libelle affiche a la place du nom).
    pub legende: Option<String>,
    /// Valeur par defaut (expression Access : `0`, `"Paris"`, `Date()`, `Maintenant()`).
    pub valeur_defaut: Option<String>,
    /// Regle « Valide si » (expression Access : `>0`, `Entre 1 Et 10`, `Comme "A*"`).
    pub valide_si: Option<String>,
    /// Message si erreur de validation.
    pub message_validation: Option<String>,
    /// Null interdit.
    pub requis: bool,
    /// Chaine vide autorisee (defaut : oui).
    pub chaine_vide_autorisee: Option<bool>,
    /// Indexation du champ.
    pub indexe: Indexation,
    /// Description (barre d'etat).
    pub description: Option<String>,
    /// Expression d'un champ calcule.
    pub expression: Option<String>,
    /// Type du resultat d'un champ calcule.
    pub type_resultat: Option<TypeChamp>,
    /// Liste de valeurs (assistant Liste de choix).
    pub liste_valeurs: Vec<String>,
    /// Refuser les valeurs absentes de la liste.
    pub limiter_a_liste: bool,
    /// Source d'une liste de choix (table ou requete) pour l'interface.
    pub source_liste: Option<String>,
    /// Alignement du texte (`gauche`, `centre`, `droite`).
    pub alignement: Option<String>,
    /// Mode d'edition des textes longs (`texte` ou `texte_enrichi`).
    pub format_texte: Option<String>,
}

impl ProprietesChamp {
    /// Taille effective d'un texte court.
    pub fn taille_texte(&self) -> u32 {
        self.taille.unwrap_or(255).clamp(1, 255)
    }
}

/// Definition d'un champ telle que l'envoie le mode Creation.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DefinitionChamp {
    /// Nom du champ.
    pub nom: String,
    /// Type de donnees.
    #[serde(rename = "type")]
    pub type_champ: TypeChamp,
    /// Fait partie de la cle primaire.
    #[serde(default)]
    pub cle_primaire: bool,
    /// Proprietes.
    #[serde(default, flatten)]
    pub proprietes: ProprietesChamp,
    /// Nom d'origine lors d'une modification de structure (renommage).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ancien_nom: Option<String>,
}

impl DefinitionChamp {
    /// Champ simple sans propriete particuliere.
    pub fn nouveau(nom: &str, type_champ: TypeChamp) -> Self {
        Self {
            nom: nom.to_string(),
            type_champ,
            cle_primaire: type_champ == TypeChamp::NumeroAuto,
            proprietes: ProprietesChamp::default(),
            ancien_nom: None,
        }
    }

    /// Variante chainable : champ obligatoire.
    pub fn requis(mut self) -> Self {
        self.proprietes.requis = true;
        self
    }

    /// Variante chainable : cle primaire.
    pub fn cle(mut self) -> Self {
        self.cle_primaire = true;
        self
    }
}

/// Champ tel que decrit par le schema (structure reelle + metadonnees).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ChampSchema {
    /// Nom.
    pub nom: String,
    /// Type Access.
    #[serde(rename = "type")]
    pub type_champ: TypeChamp,
    /// Libelle du type.
    pub libelle_type: &'static str,
    /// Position (0 = premier).
    pub position: usize,
    /// Cle primaire.
    pub cle_primaire: bool,
    /// Proprietes.
    pub proprietes: ProprietesChamp,
    /// Type declare SQLite.
    pub type_sqlite: String,
    /// Colonne generee (champ calcule).
    pub genere: bool,
    /// Type deduit faute de metadonnees (base creee par un autre outil).
    pub deduit: bool,
}

impl ChampSchema {
    /// Reconstruit une definition de champ (pour une modification de structure).
    pub fn definition(&self) -> DefinitionChamp {
        DefinitionChamp {
            nom: self.nom.clone(),
            type_champ: self.type_champ,
            cle_primaire: self.cle_primaire,
            proprietes: self.proprietes.clone(),
            ancien_nom: Some(self.nom.clone()),
        }
    }
}

/// Rendu JSON deduit d'un type declare quelconque (resultats de requetes SQL).
pub fn rendu_depuis_declaration(decl: Option<&str>) -> Rendu {
    match decl {
        None => Rendu::Brut,
        Some(d) if d.trim().is_empty() => Rendu::Brut,
        Some(d) => TypeChamp::depuis_declaration(d, false).0.rendu(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn libelles_et_analyse() {
        for t in TOUS_LES_TYPES {
            assert_eq!(t.libelle().parse::<TypeChamp>().ok(), Some(t), "{t:?}");
        }
        assert_eq!("Short Text".parse::<TypeChamp>().ok(), Some(TypeChamp::TexteCourt));
        assert!("bidule".parse::<TypeChamp>().is_err());
    }

    #[test]
    fn declarations_aller_retour() {
        let p = ProprietesChamp { taille: Some(50), ..Default::default() };
        for t in TOUS_LES_TYPES {
            if t == TypeChamp::Calcule {
                continue;
            }
            let decl = t.declaration(&p);
            let (deduit, _) = TypeChamp::depuis_declaration(&decl, t == TypeChamp::NumeroAuto);
            assert_eq!(deduit, t, "{decl}");
        }
        assert_eq!(
            TypeChamp::depuis_declaration("VARCHAR(50)", false),
            (TypeChamp::TexteCourt, Some(50))
        );
    }
}
