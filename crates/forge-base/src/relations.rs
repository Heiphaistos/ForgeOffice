//! Relations entre tables (fenetre « Relations » d'Access) : integrite referentielle,
//! mise a jour et suppression en cascade, « mettre a Null », type de jointure par defaut.
//!
//! Une relation avec integrite devient une cle etrangere SQLite de la table enfant
//! (reconstruction de la table) et un index sur les champs lies.

use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{est_interne, valider_nom};
use crate::meta;

/// Action a la suppression d'un enregistrement parent.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Suppression {
    /// Refuser si des enregistrements lies existent.
    #[default]
    Restreindre,
    /// Supprimer les enregistrements lies.
    Cascade,
    /// Mettre les champs lies a Null.
    MettreNull,
}

/// Type de jointure propose au createur de requetes.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum TypeJointure {
    /// Seulement les enregistrements correspondants.
    #[default]
    Interne,
    /// Tous les enregistrements de la table parent.
    TousParent,
    /// Tous les enregistrements de la table enfant.
    TousEnfant,
}

fn vrai() -> bool {
    true
}

/// Relation entre deux tables.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Relation {
    /// Nom (genere `Parent_Enfant` si vide).
    #[serde(default)]
    pub nom: String,
    /// Table parent (cote « un »).
    pub table_parent: String,
    /// Champs de la table parent (cle primaire ou index sans doublons).
    pub champs_parent: Vec<String>,
    /// Table enfant (cote « plusieurs »).
    pub table_enfant: String,
    /// Champs de la table enfant.
    pub champs_enfant: Vec<String>,
    /// Appliquer l'integrite referentielle.
    #[serde(default = "vrai")]
    pub integrite: bool,
    /// Mettre a jour en cascade les champs lies.
    #[serde(default)]
    pub cascade_maj: bool,
    /// Comportement a la suppression du parent.
    #[serde(default)]
    pub suppression: Suppression,
    /// Jointure par defaut.
    #[serde(default)]
    pub jointure: TypeJointure,
}

/// Toutes les relations enregistrees.
pub(crate) fn toutes(conn: &rusqlite::Connection) -> Resultat<Vec<Relation>> {
    if !meta::installe(conn)? {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare("SELECT definition FROM __fo_relations ORDER BY nom COLLATE NOCASE")?;
    let brut = stmt
        .query_map([], |r| r.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(brut.iter().filter_map(|b| serde_json::from_str(b).ok()).collect())
}

/// Relations avec integrite dont `table` est l'enfant (cles etrangeres a generer).
pub(crate) fn relations_enfant(conn: &rusqlite::Connection, table: &str) -> Resultat<Vec<Relation>> {
    Ok(toutes(conn)?
        .into_iter()
        .filter(|r| r.table_enfant.eq_ignore_ascii_case(table))
        .collect())
}

pub(crate) fn ecrire(conn: &rusqlite::Connection, r: &Relation) -> Resultat<()> {
    conn.execute(
        "INSERT INTO __fo_relations(nom, table_parent, table_enfant, definition) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(nom) DO UPDATE SET table_parent = excluded.table_parent,
           table_enfant = excluded.table_enfant, definition = excluded.definition",
        params![r.nom, r.table_parent, r.table_enfant, serde_json::to_string(r)?],
    )?;
    Ok(())
}

/// Reporte un renommage de champ dans les relations.
pub(crate) fn renommer_champ(conn: &rusqlite::Connection, table: &str, ancien: &str, nouveau: &str) -> Resultat<()> {
    for mut r in toutes(conn)? {
        let mut change = false;
        for (t, champs) in [(&r.table_parent.clone(), &mut r.champs_parent), (&r.table_enfant.clone(), &mut r.champs_enfant)] {
            if t.eq_ignore_ascii_case(table) {
                for c in champs.iter_mut().filter(|c| c.eq_ignore_ascii_case(ancien)) {
                    *c = nouveau.to_string();
                    change = true;
                }
            }
        }
        if change {
            ecrire(conn, &r)?;
        }
    }
    Ok(())
}

/// Reporte un renommage de table dans les definitions JSON des relations.
pub(crate) fn renommer_table(conn: &rusqlite::Connection, ancien: &str, nouveau: &str) -> Resultat<()> {
    for mut r in toutes(conn)? {
        let mut change = false;
        if r.table_parent.eq_ignore_ascii_case(ancien) {
            r.table_parent = nouveau.to_string();
            change = true;
        }
        if r.table_enfant.eq_ignore_ascii_case(ancien) {
            r.table_enfant = nouveau.to_string();
            change = true;
        }
        if change {
            ecrire(conn, &r)?;
        }
    }
    Ok(())
}

/// Importe dans les metadonnees les cles etrangeres d'une base creee ailleurs.
pub(crate) fn adopter_cles_etrangeres(base: &Base) -> Resultat<()> {
    let conn = base.conn();
    let connues = toutes(conn)?;
    let mut nouvelles: Vec<Relation> = Vec::new();
    for table in base.lister_tables()? {
        let mut stmt = conn.prepare(
            "SELECT id, \"table\", \"from\", \"to\", on_update, on_delete FROM pragma_foreign_key_list(?1) ORDER BY id, seq",
        )?;
        let lignes = stmt
            .query_map([&table], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, String>(4)?,
                    r.get::<_, String>(5)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let mut courante: Option<(i64, Relation)> = None;
        for (id, parent, de, vers, maj, suppr) in lignes {
            if courante.as_ref().is_none_or(|(i, _)| *i != id) {
                if let Some((_, r)) = courante.take() {
                    nouvelles.push(r);
                }
                courante = Some((id, Relation {
                    nom: String::new(),
                    table_parent: parent,
                    champs_parent: Vec::new(),
                    table_enfant: table.clone(),
                    champs_enfant: Vec::new(),
                    integrite: true,
                    cascade_maj: maj.eq_ignore_ascii_case("CASCADE"),
                    suppression: match suppr.to_ascii_uppercase().as_str() {
                        "CASCADE" => Suppression::Cascade,
                        "SET NULL" => Suppression::MettreNull,
                        _ => Suppression::Restreindre,
                    },
                    jointure: TypeJointure::Interne,
                }));
            }
            if let Some((_, r)) = courante.as_mut() {
                r.champs_enfant.push(de);
                r.champs_parent.push(vers.unwrap_or_default());
            }
        }
        if let Some((_, r)) = courante {
            nouvelles.push(r);
        }
    }
    for mut r in nouvelles {
        let deja = connues.iter().any(|c| {
            c.table_enfant.eq_ignore_ascii_case(&r.table_enfant)
                && c.table_parent.eq_ignore_ascii_case(&r.table_parent)
                && c.champs_enfant.len() == r.champs_enfant.len()
                && c.champs_enfant.iter().zip(&r.champs_enfant).all(|(a, b)| a.eq_ignore_ascii_case(b))
        });
        if deja || est_interne(&r.table_parent) {
            continue;
        }
        if r.champs_parent.iter().any(String::is_empty) {
            // REFERENCES Parent sans colonne : la cle primaire du parent.
            let pk: Vec<String> = base.champs(&r.table_parent)?.into_iter().filter(|c| c.cle_primaire).map(|c| c.nom).collect();
            if pk.len() != r.champs_enfant.len() {
                continue;
            }
            r.champs_parent = pk;
        }
        r.nom = nom_libre(conn, &format!("{}_{}", r.table_parent, r.table_enfant))?;
        ecrire(conn, &r)?;
    }
    Ok(())
}

fn nom_libre(conn: &rusqlite::Connection, base: &str) -> Resultat<String> {
    let existants: Vec<String> = toutes(conn)?.into_iter().map(|r| r.nom.to_lowercase()).collect();
    let mut nom: String = base.chars().take(60).collect();
    let mut n = 2;
    while existants.contains(&nom.to_lowercase()) {
        nom = format!("{}_{n}", base.chars().take(58).collect::<String>());
        n += 1;
    }
    Ok(nom)
}

impl Base {
    /// Toutes les relations.
    pub fn lister_relations(&self) -> Resultat<Vec<Relation>> {
        toutes(self.conn())
    }

    /// Relations ou `table` est parent ou enfant.
    pub fn relations_de(&self, table: &str) -> Resultat<Vec<Relation>> {
        Ok(toutes(self.conn())?
            .into_iter()
            .filter(|r| r.table_parent.eq_ignore_ascii_case(table) || r.table_enfant.eq_ignore_ascii_case(table))
            .collect())
    }

    fn verifier_relation(&self, r: &mut Relation) -> Resultat<()> {
        r.table_parent = self.nom_table(&r.table_parent)?;
        r.table_enfant = self.nom_table(&r.table_enfant)?;
        if r.champs_parent.is_empty() || r.champs_parent.len() != r.champs_enfant.len() {
            return Err(ErreurBase::msg("La relation doit lier le même nombre de champs (au moins un) des deux côtés."));
        }
        let parent = self.champs(&r.table_parent)?;
        let enfant = self.champs(&r.table_enfant)?;
        for (cp, ce) in r.champs_parent.iter_mut().zip(r.champs_enfant.iter_mut()) {
            let p = parent.iter().find(|c| c.nom.eq_ignore_ascii_case(cp))
                .ok_or_else(|| ErreurBase::Introuvable(format!("{}.{cp}", r.table_parent)))?;
            let e = enfant.iter().find(|c| c.nom.eq_ignore_ascii_case(ce))
                .ok_or_else(|| ErreurBase::Introuvable(format!("{}.{ce}", r.table_enfant)))?;
            if p.type_champ.famille() != e.type_champ.famille() {
                return Err(ErreurBase::msg(format!(
                    "Types incompatibles : « {} » ({}) et « {} » ({}).",
                    p.nom, p.type_champ.libelle(), e.nom, e.type_champ.libelle()
                )));
            }
            if r.suppression == Suppression::MettreNull && e.proprietes.requis {
                return Err(ErreurBase::msg(format!("« Mettre à Null » impossible : le champ « {} » est obligatoire.", e.nom)));
            }
            *cp = p.nom.clone();
            *ce = e.nom.clone();
        }
        if r.integrite {
            let mut voulus: Vec<String> = r.champs_parent.iter().map(|c| c.to_lowercase()).collect();
            voulus.sort();
            let unique = self.index_table(&r.table_parent)?.into_iter().filter(|i| i.unique && !i.partiel).any(|i| {
                let mut cols: Vec<String> = i.champs.iter().map(|c| c.nom.to_lowercase()).collect();
                cols.sort();
                cols == voulus
            });
            if !unique {
                return Err(ErreurBase::msg(format!(
                    "Intégrité référentielle impossible : les champs liés de « {} » doivent être sa clé primaire ou avoir un index sans doublons.",
                    r.table_parent
                )));
            }
        }
        Ok(())
    }

    /// Cree une relation. Avec integrite, la table enfant est reconstruite avec une cle etrangere ;
    /// echoue (sans rien modifier) si des enregistrements enfants sont orphelins.
    pub fn creer_relation(&self, relation: &Relation) -> Resultat<Relation> {
        self.exiger_ecriture()?;
        let mut r = relation.clone();
        self.verifier_relation(&mut r)?;
        r.nom = if r.nom.trim().is_empty() {
            nom_libre(self.conn(), &format!("{}_{}", r.table_parent, r.table_enfant))?
        } else {
            valider_nom(&r.nom)?
        };
        if toutes(self.conn())?.iter().any(|x| x.nom.eq_ignore_ascii_case(&r.nom)) {
            return Err(ErreurBase::ExisteDeja(r.nom));
        }
        let enfant = r.table_enfant.clone();
        let copie = r.clone();
        if r.integrite {
            self.reconstruire_table(&enfant, None, None, &|b: &Base| ecrire(b.conn(), &copie))?;
        } else {
            self.atomique(|| ecrire(self.conn(), &copie))?;
        }
        Ok(r)
    }

    /// Supprime une relation (la cle etrangere disparait de la table enfant).
    pub fn supprimer_relation(&self, nom: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let r = toutes(self.conn())?
            .into_iter()
            .find(|r| r.nom.eq_ignore_ascii_case(nom))
            .ok_or_else(|| ErreurBase::Introuvable(nom.to_string()))?;
        let retirer = |b: &Base| -> Resultat<()> {
            b.conn().execute("DELETE FROM __fo_relations WHERE nom = ?1", [&r.nom])?;
            Ok(())
        };
        if r.integrite {
            self.reconstruire_table(&r.table_enfant, None, None, &retirer)?;
        } else {
            self.atomique(|| retirer(self))?;
        }
        Ok(())
    }

    /// Remplace une relation par une nouvelle definition.
    pub fn modifier_relation(&self, nom: &str, relation: &Relation) -> Resultat<Relation> {
        let ancienne = toutes(self.conn())?
            .into_iter()
            .find(|r| r.nom.eq_ignore_ascii_case(nom))
            .ok_or_else(|| ErreurBase::Introuvable(nom.to_string()))?;
        self.supprimer_relation(nom)?;
        match self.creer_relation(relation) {
            Ok(r) => Ok(r),
            Err(e) => {
                self.creer_relation(&ancienne)?;
                Err(e)
            }
        }
    }
}
