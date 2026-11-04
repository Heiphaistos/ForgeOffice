//! # forge-base
//!
//! Moteur du module Base de donnees de ForgeOffice (equivalent d'Access), en Rust pur.
//!
//! - Fichier `.fodb` = SQLite (WAL, cles etrangeres, effacement securise), metadonnees `__fo_*`.
//! - Types Access et proprietes de champ (taille, format, masque de saisie, valeur par defaut,
//!   regle de validation et message, requis, indexe, legende, liste de choix, champ calcule).
//! - Structure : creer, modifier, renommer, supprimer tables et champs (reconstruction transactionnelle).
//! - Relations avec integrite referentielle, cascades, « mettre a Null ».
//! - Donnees : lecture paginee, tri, filtres, recherche sans accents, ecriture par cle, totaux.
//! - SQL parametre, requetes enregistrees, createur graphique (jointures, totaux, analyse croisee).
//! - Formulaires, etats, macros, modules ; import/export CSV et classeur ; sauvegarde, compactage.
//! - Securite : identifiants toujours cites, valeurs toujours liees, ATTACH et extensions refuses.

#![warn(missing_docs)]

mod base;
mod concepteur;
mod csv;
mod ddl;
mod donnees;
mod erreur;
mod expr;
mod ident;
mod import;
mod masque;
mod meta;
mod objets;
mod relations;
mod requetes;
mod schema;
mod sql;
mod structure;
mod types;
mod valeurs;

pub use base::{plier, Base, InfosBase, RapportCompactage, RapportIntegrite, DELAI_SQL_DEFAUT, EXTENSION};
pub use concepteur::{
    ColonneRequete, DefinitionRequete, GenreJointure, GenreRequete, Jointure, Operation, RequeteGeneree, RoleAnalyse,
    SensTri, SourceRequete,
};
pub use csv::{analyser as analyser_csv, decoder as decoder_texte, deviner_separateur, OptionsExport};
pub use donnees::{Cle, ColonneResultat, Filtre, FonctionTotal, OptionsLecture, Operateur, PageLignes, Tri, TAILLE_PAGE_MAX};
pub use erreur::{ErreurBase, Resultat};
pub use expr::{Contexte, Traducteur};
pub use ident::{guillemets, valider_nom};
pub use import::{deduire_type, ErreurLigne, ModeImport, OptionsImport, RapportImport, SourceExport};
pub use masque::appliquer_masque;
pub use meta::{ObjetStocke, ProprietesTable, VERSION_SCHEMA};
pub use objets::{Disposition, ACTIONS_MACRO};
pub use relations::{Relation, Suppression, TypeJointure};
pub use requetes::RequeteEnregistree;
pub use schema::{ChampIndex, GenreObjet, IndexInfo, ObjetBase, SchemaTable};
pub use sql::{OptionsSql, Parametres, ResultatSql, LIMITE_LIGNES};
pub use structure::{DefinitionTable, RapportStructure};
pub use types::{ChampSchema, DefinitionChamp, Indexation, ProprietesChamp, Rendu, TypeChamp, TOUS_LES_TYPES};
pub use valeurs::{analyser_booleen, analyser_date, analyser_nombre, date_depuis_serie};
