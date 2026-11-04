//! Execution de SQL saisi par l'utilisateur (mode SQL des requetes), parametres lies,
//! resultats JSON types. Le SQL tourne sous la garde « utilisateur » : ATTACH, PRAGMA
//! d'ecriture, chargement d'extension et ecriture des tables internes sont refuses.

use rusqlite::Statement;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};

use crate::base::Base;
use crate::donnees::ColonneResultat;
use crate::erreur::{ErreurBase, Resultat};
use crate::meta;
use crate::relations;
use crate::types::{rendu_depuis_declaration, Rendu, TypeChamp};
use crate::valeurs::{generique, sql_vers_json};

/// Nombre de lignes renvoyees par defaut.
pub const LIMITE_LIGNES: usize = 10_000;

/// Parametres d'une requete : liste (`?`, `?1`) ou noms (`:nom`, `@nom`, `$nom`).
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(untagged)]
pub enum Parametres {
    /// Parametres positionnels.
    Positionnels(Vec<Json>),
    /// Parametres nommes (cle avec ou sans prefixe).
    Nommes(Map<String, Json>),
}

impl Default for Parametres {
    fn default() -> Self {
        Self::Positionnels(Vec::new())
    }
}

impl Parametres {
    /// Aucun parametre.
    pub fn aucun() -> Self {
        Self::default()
    }
}

/// Resultat d'une instruction SQL.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ResultatSql {
    /// Colonnes (vide pour une instruction sans resultat).
    pub colonnes: Vec<ColonneResultat>,
    /// Lignes.
    pub lignes: Vec<Vec<Json>>,
    /// Enregistrements ajoutes, modifies ou supprimes.
    pub lignes_modifiees: u64,
    /// Dernier identifiant insere (si insertion).
    pub dernier_id: Option<i64>,
    /// Instruction en lecture seule.
    pub lecture_seule: bool,
    /// Resultat coupe a la limite.
    pub tronque: bool,
}

/// Lie les parametres a une instruction preparee.
pub(crate) fn lier(stmt: &mut Statement<'_>, params: &Parametres) -> Resultat<()> {
    let attendus = stmt.parameter_count();
    match params {
        Parametres::Positionnels(liste) => {
            if liste.len() != attendus {
                return Err(ErreurBase::Syntaxe(format!(
                    "nombre de paramètres incorrect ({} fourni(s), {attendus} attendu(s)).",
                    liste.len()
                )));
            }
            for (i, v) in liste.iter().enumerate() {
                stmt.raw_bind_parameter(i + 1, generique(v))?;
            }
        }
        Parametres::Nommes(carte) => {
            for i in 1..=attendus {
                let nom = stmt
                    .parameter_name(i)
                    .ok_or_else(|| ErreurBase::Syntaxe("paramètre anonyme « ? » : fournissez une liste de valeurs.".into()))?
                    .to_string();
                let court = nom.trim_start_matches([':', '@', '$']);
                let valeur = carte
                    .iter()
                    .find(|(k, _)| k.as_str() == nom || k.trim_start_matches([':', '@', '$']).eq_ignore_ascii_case(court))
                    .map(|(_, v)| v)
                    .ok_or_else(|| ErreurBase::Syntaxe(format!("paramètre manquant « {court} ».")))?;
                stmt.raw_bind_parameter(i, generique(valeur))?;
            }
        }
    }
    Ok(())
}

/// Colonnes typees d'une instruction (type declare de la colonne d'origine).
pub(crate) fn colonnes(stmt: &Statement<'_>) -> Vec<ColonneResultat> {
    stmt.columns()
        .into_iter()
        .map(|c| {
            let rendu = rendu_depuis_declaration(c.decl_type());
            let type_champ = c.decl_type().filter(|d| !d.trim().is_empty()).map(|d| TypeChamp::depuis_declaration(d, false).0);
            ColonneResultat { nom: c.name().to_string(), type_champ, rendu, legende: None }
        })
        .collect()
}

/// Execute une instruction preparee et collecte les lignes.
pub(crate) fn executer(base: &Base, stmt: &mut Statement<'_>, limite: usize) -> Resultat<ResultatSql> {
    let cols = colonnes(stmt);
    let lecture_seule = stmt.readonly();
    let avant = base.conn().total_changes();
    let mut lignes = Vec::new();
    let mut tronque = false;
    if cols.is_empty() {
        stmt.raw_execute()?;
    } else {
        let rendus: Vec<Rendu> = cols.iter().map(|c| c.rendu).collect();
        let mut rangs = stmt.raw_query();
        while let Some(l) = rangs.next()? {
            if lignes.len() >= limite {
                tronque = true;
                break;
            }
            let mut ligne = Vec::with_capacity(rendus.len());
            for (i, r) in rendus.iter().enumerate() {
                ligne.push(sql_vers_json(l.get_ref(i)?, *r, true));
            }
            lignes.push(ligne);
        }
    }
    let modifiees = base.conn().total_changes().saturating_sub(avant);
    Ok(ResultatSql {
        colonnes: cols,
        lignes,
        lignes_modifiees: modifiees,
        dernier_id: (!lecture_seule && modifiees > 0).then(|| base.conn().last_insert_rowid()),
        lecture_seule,
        tronque,
    })
}

impl Base {
    fn version_schema(&self) -> Resultat<i64> {
        Ok(self.conn().query_row("PRAGMA schema_version", [], |r| r.get(0))?)
    }

    /// Apres du SQL direct qui a change la structure : metadonnees a jour.
    pub(crate) fn apres_sql_direct(&self, version_avant: i64) -> Resultat<()> {
        if self.est_lecture_seule() || self.version_schema()? == version_avant {
            return Ok(());
        }
        meta::nettoyer_orphelins(self.conn())?;
        relations::adopter_cles_etrangeres(self)
    }

    /// Execute une instruction SQL (une seule) avec parametres ; renvoie au plus 10 000 lignes.
    pub fn executer_sql(&self, sql: &str, params: &Parametres) -> Resultat<ResultatSql> {
        self.executer_sql_limite(sql, params, LIMITE_LIGNES)
    }

    /// Comme `executer_sql`, avec une limite de lignes choisie.
    pub fn executer_sql_limite(&self, sql: &str, params: &Parametres, limite: usize) -> Resultat<ResultatSql> {
        let version = self.version_schema()?;
        let resultat = {
            let _garde = self.mode_utilisateur();
            let mut stmt = self.conn().prepare(sql)?;
            if self.est_lecture_seule() && !stmt.readonly() {
                return Err(ErreurBase::Interdit("la base est ouverte en lecture seule.".into()));
            }
            lier(&mut stmt, params)?;
            executer(self, &mut stmt, limite.max(1))
        };
        self.apres_sql_direct(version)?;
        resultat
    }

    /// Execute un script de plusieurs instructions separees par `;` (sans resultat).
    pub fn executer_script(&self, script: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let version = self.version_schema()?;
        let resultat = {
            let _garde = self.mode_utilisateur();
            self.conn().execute_batch(script).map_err(ErreurBase::from)
        };
        self.apres_sql_direct(version)?;
        resultat
    }

    /// Plan d'execution d'une requete (analyse des performances).
    pub fn expliquer(&self, sql: &str, params: &Parametres) -> Resultat<Vec<String>> {
        let _garde = self.mode_utilisateur();
        let mut stmt = self.conn().prepare(&format!("EXPLAIN QUERY PLAN {sql}"))?;
        lier(&mut stmt, params)?;
        let mut rangs = stmt.raw_query();
        let mut sortie = Vec::new();
        while let Some(l) = rangs.next()? {
            let detail: String = l.get(3)?;
            sortie.push(detail);
        }
        Ok(sortie)
    }

    /// Valeur unique (premiere colonne de la premiere ligne), pratique pour DLookup / DSum.
    pub fn valeur_sql(&self, sql: &str, params: &Parametres) -> Resultat<Json> {
        let r = self.executer_sql_limite(sql, params, 1)?;
        Ok(r.lignes.into_iter().next().and_then(|l| l.into_iter().next()).unwrap_or(Json::Null))
    }
}
