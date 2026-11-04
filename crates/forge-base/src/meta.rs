//! Tables internes `__fo_*` : metadonnees des champs, des tables, des relations et des objets
//! (requetes, formulaires, etats, macros). Le schema SQLite reste la verite pour la structure ;
//! les metadonnees portent ce que SQLite ne sait pas exprimer (types Access, legendes, masques...).

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value as Json;

use crate::erreur::{ErreurBase, Resultat};
use crate::types::{DefinitionChamp, ProprietesChamp, TypeChamp};

/// Version du schema des metadonnees.
pub const VERSION_SCHEMA: i64 = 1;

const SCHEMA: &str = "
CREATE TABLE IF NOT EXISTS __fo_meta(cle TEXT PRIMARY KEY, valeur TEXT);
CREATE TABLE IF NOT EXISTS __fo_tables(
  nom TEXT PRIMARY KEY COLLATE NOCASE,
  proprietes TEXT NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS __fo_champs(
  table_nom TEXT NOT NULL COLLATE NOCASE,
  nom TEXT NOT NULL COLLATE NOCASE,
  type TEXT NOT NULL,
  ordre INTEGER NOT NULL DEFAULT 0,
  proprietes TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY(table_nom, nom));
CREATE TABLE IF NOT EXISTS __fo_relations(
  nom TEXT PRIMARY KEY COLLATE NOCASE,
  table_parent TEXT NOT NULL COLLATE NOCASE,
  table_enfant TEXT NOT NULL COLLATE NOCASE,
  definition TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS __fo_objets(
  genre TEXT NOT NULL,
  nom TEXT NOT NULL COLLATE NOCASE,
  contenu TEXT NOT NULL,
  description TEXT,
  cree_le TEXT NOT NULL,
  modifie_le TEXT NOT NULL,
  PRIMARY KEY(genre, nom));
";

/// Proprietes d'une table (feuille de proprietes du mode Creation).
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct ProprietesTable {
    /// Description.
    pub description: Option<String>,
    /// Regle de validation de table (`[Fin] >= [Début]`).
    pub valide_si: Option<String>,
    /// Message en cas de violation.
    pub message_validation: Option<String>,
    /// Tri par defaut de la feuille de donnees (`Nom`, `Prix DESC`).
    pub tri: Option<String>,
    /// Filtre par defaut (expression Access).
    pub filtre: Option<String>,
}

/// Objet enregistre (requete, formulaire, etat, macro).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ObjetStocke {
    /// Genre (`requete`, `formulaire`, `etat`, `macro`, `module`).
    pub genre: String,
    /// Nom.
    pub nom: String,
    /// Contenu JSON.
    pub contenu: Json,
    /// Description.
    pub description: Option<String>,
    /// Date de creation.
    pub cree_le: String,
    /// Date de derniere modification.
    pub modifie_le: String,
}

/// Cree les tables internes si besoin et enregistre la version.
pub fn installer(conn: &Connection) -> Resultat<()> {
    conn.execute_batch(SCHEMA)?;
    conn.execute(
        "INSERT OR IGNORE INTO __fo_meta(cle, valeur) VALUES ('application', 'ForgeOffice'), ('cree_le', datetime('now','localtime'))",
        [],
    )?;
    conn.execute(
        "INSERT INTO __fo_meta(cle, valeur) VALUES ('version_schema', ?1)
         ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
        [VERSION_SCHEMA.to_string()],
    )?;
    Ok(())
}

/// Vrai si les tables internes existent (base ouverte en lecture seule par exemple).
pub fn installe(conn: &Connection) -> Resultat<bool> {
    Ok(conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '__fo_champs'",
            [],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

/// Lit une valeur de `__fo_meta`.
pub fn valeur_meta(conn: &Connection, cle: &str) -> Resultat<Option<String>> {
    if !installe(conn)? {
        return Ok(None);
    }
    Ok(conn
        .query_row("SELECT valeur FROM __fo_meta WHERE cle = ?1", [cle], |r| r.get(0))
        .optional()?
        .flatten())
}

/// Metadonnees des champs d'une table, indexees par nom en minuscules.
pub fn champs(conn: &Connection, table: &str) -> Resultat<HashMap<String, (TypeChamp, ProprietesChamp)>> {
    let mut sortie = HashMap::new();
    if !installe(conn)? {
        return Ok(sortie);
    }
    let mut stmt =
        conn.prepare("SELECT nom, type, proprietes FROM __fo_champs WHERE table_nom = ?1")?;
    let mut lignes = stmt.query([table])?;
    while let Some(l) = lignes.next()? {
        let nom: String = l.get(0)?;
        let type_texte: String = l.get(1)?;
        let props: String = l.get(2)?;
        let Ok(t) = serde_json::from_value::<TypeChamp>(Json::String(type_texte)) else {
            continue;
        };
        let p: ProprietesChamp = serde_json::from_str(&props).unwrap_or_default();
        sortie.insert(nom.to_lowercase(), (t, p));
    }
    Ok(sortie)
}

/// Remplace les metadonnees des champs d'une table.
pub fn ecrire_champs(conn: &Connection, table: &str, champs: &[DefinitionChamp]) -> Resultat<()> {
    conn.execute("DELETE FROM __fo_champs WHERE table_nom = ?1", [table])?;
    let mut stmt = conn.prepare(
        "INSERT INTO __fo_champs(table_nom, nom, type, ordre, proprietes) VALUES (?1, ?2, ?3, ?4, ?5)",
    )?;
    for (ordre, c) in champs.iter().enumerate() {
        let type_texte = serde_json::to_value(c.type_champ)?
            .as_str()
            .unwrap_or("texte_long")
            .to_string();
        stmt.execute(params![
            table,
            c.nom.trim(),
            type_texte,
            ordre as i64,
            serde_json::to_string(&c.proprietes)?
        ])?;
    }
    Ok(())
}

/// Proprietes d'une table.
pub fn table(conn: &Connection, nom: &str) -> Resultat<ProprietesTable> {
    if !installe(conn)? {
        return Ok(ProprietesTable::default());
    }
    let brut: Option<String> = conn
        .query_row("SELECT proprietes FROM __fo_tables WHERE nom = ?1", [nom], |r| r.get(0))
        .optional()?;
    Ok(brut
        .and_then(|b| serde_json::from_str(&b).ok())
        .unwrap_or_default())
}

/// Ecrit les proprietes d'une table.
pub fn ecrire_table(conn: &Connection, nom: &str, p: &ProprietesTable) -> Resultat<()> {
    conn.execute(
        "INSERT INTO __fo_tables(nom, proprietes) VALUES (?1, ?2)
         ON CONFLICT(nom) DO UPDATE SET proprietes = excluded.proprietes",
        params![nom, serde_json::to_string(p)?],
    )?;
    Ok(())
}

/// Reporte un renommage de table dans toutes les metadonnees.
pub fn renommer_table(conn: &Connection, ancien: &str, nouveau: &str) -> Resultat<()> {
    conn.execute("UPDATE __fo_tables SET nom = ?2 WHERE nom = ?1", [ancien, nouveau])?;
    conn.execute("UPDATE __fo_champs SET table_nom = ?2 WHERE table_nom = ?1", [ancien, nouveau])?;
    conn.execute("UPDATE __fo_relations SET table_parent = ?2 WHERE table_parent = ?1", [ancien, nouveau])?;
    conn.execute("UPDATE __fo_relations SET table_enfant = ?2 WHERE table_enfant = ?1", [ancien, nouveau])?;
    Ok(())
}

/// Supprime les metadonnees d'une table.
pub fn supprimer_table(conn: &Connection, nom: &str) -> Resultat<()> {
    conn.execute("DELETE FROM __fo_tables WHERE nom = ?1", [nom])?;
    conn.execute("DELETE FROM __fo_champs WHERE table_nom = ?1", [nom])?;
    Ok(())
}

/// Retire les metadonnees de tables qui n'existent plus (suppression par SQL direct).
pub fn nettoyer_orphelins(conn: &Connection) -> Resultat<()> {
    if !installe(conn)? {
        return Ok(());
    }
    conn.execute_batch(
        "DELETE FROM __fo_tables WHERE nom NOT IN (SELECT name FROM sqlite_master WHERE type = 'table');
         DELETE FROM __fo_champs WHERE table_nom NOT IN (SELECT name FROM sqlite_master WHERE type = 'table');
         DELETE FROM __fo_relations WHERE table_parent NOT IN (SELECT name FROM sqlite_master WHERE type = 'table')
            OR table_enfant NOT IN (SELECT name FROM sqlite_master WHERE type = 'table');",
    )?;
    Ok(())
}

fn objet_depuis_ligne(l: &rusqlite::Row<'_>) -> rusqlite::Result<ObjetStocke> {
    let contenu: String = l.get(2)?;
    Ok(ObjetStocke {
        genre: l.get(0)?,
        nom: l.get(1)?,
        contenu: serde_json::from_str(&contenu).unwrap_or(Json::Null),
        description: l.get(3)?,
        cree_le: l.get(4)?,
        modifie_le: l.get(5)?,
    })
}

const COLONNES_OBJET: &str = "genre, nom, contenu, description, cree_le, modifie_le";

/// Lit un objet.
pub fn objet(conn: &Connection, genre: &str, nom: &str) -> Resultat<Option<ObjetStocke>> {
    if !installe(conn)? {
        return Ok(None);
    }
    Ok(conn
        .query_row(
            &format!("SELECT {COLONNES_OBJET} FROM __fo_objets WHERE genre = ?1 AND nom = ?2"),
            [genre, nom],
            objet_depuis_ligne,
        )
        .optional()?)
}

/// Liste les objets d'un genre (tous si `None`), tries par nom.
pub fn objets(conn: &Connection, genre: Option<&str>) -> Resultat<Vec<ObjetStocke>> {
    if !installe(conn)? {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLONNES_OBJET} FROM __fo_objets WHERE ?1 IS NULL OR genre = ?1 ORDER BY genre, nom COLLATE NOCASE"
    ))?;
    let liste = stmt
        .query_map([genre], objet_depuis_ligne)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(liste)
}

/// Cree ou remplace un objet (la date de creation est conservee).
pub fn ecrire_objet(
    conn: &Connection,
    genre: &str,
    nom: &str,
    contenu: &Json,
    description: Option<&str>,
) -> Resultat<()> {
    let texte = serde_json::to_string(contenu)?;
    if texte.len() > 16 * 1024 * 1024 {
        return Err(ErreurBase::msg("Définition trop volumineuse (16 Mo maximum)."));
    }
    conn.execute(
        "INSERT INTO __fo_objets(genre, nom, contenu, description, cree_le, modifie_le)
         VALUES (?1, ?2, ?3, ?4, datetime('now','localtime'), datetime('now','localtime'))
         ON CONFLICT(genre, nom) DO UPDATE SET contenu = excluded.contenu,
           description = excluded.description, modifie_le = excluded.modifie_le",
        params![genre, nom, texte, description],
    )?;
    Ok(())
}

/// Renomme un objet. Erreur si l'objet n'existe pas ou si le nouveau nom est pris.
pub fn renommer_objet(conn: &Connection, genre: &str, ancien: &str, nouveau: &str) -> Resultat<()> {
    if !ancien.eq_ignore_ascii_case(nouveau) && objet(conn, genre, nouveau)?.is_some() {
        return Err(ErreurBase::ExisteDeja(nouveau.to_string()));
    }
    let n = conn.execute(
        "UPDATE __fo_objets SET nom = ?3, modifie_le = datetime('now','localtime') WHERE genre = ?1 AND nom = ?2",
        [genre, ancien, nouveau],
    )?;
    if n == 0 {
        return Err(ErreurBase::Introuvable(ancien.to_string()));
    }
    Ok(())
}

/// Supprime un objet. Erreur s'il n'existe pas.
pub fn supprimer_objet(conn: &Connection, genre: &str, nom: &str) -> Resultat<()> {
    let n = conn.execute("DELETE FROM __fo_objets WHERE genre = ?1 AND nom = ?2", [genre, nom])?;
    if n == 0 {
        return Err(ErreurBase::Introuvable(nom.to_string()));
    }
    Ok(())
}
