//! Requetes enregistrees (SQL + definition du createur graphique) et leur execution.
//!
//! Une requete Selection sans parametre est aussi publiee comme vue SQL du meme nom :
//! elle s'utilise alors dans d'autres requetes, comme dans Access.

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};

use crate::base::Base;
use crate::concepteur::{DefinitionRequete, GenreRequete};
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{guillemets, valider_nom};
use crate::meta;
use crate::sql::{executer, lier, Parametres, ResultatSql, LIMITE_LIGNES};

const GENRE: &str = "requete";

/// Requete enregistree.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct RequeteEnregistree {
    /// Nom.
    pub nom: String,
    /// Genre.
    #[serde(default)]
    pub genre: GenreRequete,
    /// SQL (genere depuis `definition` s'il est vide).
    #[serde(default)]
    pub sql: String,
    /// Definition JSON du createur graphique (forme `DefinitionRequete` pour la generation).
    #[serde(default)]
    pub definition: Option<Json>,
    /// Description.
    #[serde(default)]
    pub description: Option<String>,
    /// Parametres Access (`:p1` = premier) quand le SQL vient du createur.
    #[serde(default)]
    pub parametres: Vec<String>,
    /// Publiee comme vue SQL (calcule a l'enregistrement).
    #[serde(default)]
    pub vue: bool,
}

fn nettoyer_sql(sql: &str) -> String {
    sql.trim().trim_end_matches(';').trim().to_string()
}

fn prefixe_vue(nom: &str) -> String {
    format!("CREATE VIEW {} AS ", guillemets(nom))
}

/// Remplace un nom de table cite (`"Ancien"`, `[Ancien]`) dans un texte SQL.
fn renommer_dans_sql(sql: &str, ancien: &str, nouveau: &str) -> String {
    sql.replace(&guillemets(ancien), &guillemets(nouveau))
        .replace(&format!("[{ancien}]"), &format!("[{nouveau}]"))
}

/// Correction automatique de nom dans une definition JSON (tables, sources, cibles).
fn renommer_dans_json(v: &mut Json, ancien: &str, nouveau: &str, cle: Option<&str>) {
    const CLES: [&str; 8] = ["table", "source", "table_cible", "gauche", "droite", "source_liste", "nom_table", "table_parent"];
    match v {
        Json::String(s) if cle.is_some_and(|c| CLES.contains(&c)) && s.eq_ignore_ascii_case(ancien) => *s = nouveau.to_string(),
        Json::Object(o) => {
            for (k, x) in o.iter_mut() {
                let effective = if k == "nom" && cle == Some("tables") { Some("table") } else { Some(k.as_str()) };
                renommer_dans_json(x, ancien, nouveau, effective);
            }
        }
        Json::Array(a) => {
            for x in a.iter_mut() {
                renommer_dans_json(x, ancien, nouveau, cle);
            }
        }
        _ => {}
    }
}

impl Base {
    /// Liste des requetes enregistrees.
    pub fn lister_requetes(&self) -> Resultat<Vec<RequeteEnregistree>> {
        meta::objets(self.conn(), Some(GENRE))?
            .into_iter()
            .map(|o| Ok(serde_json::from_value(o.contenu)?))
            .collect()
    }

    /// Lit une requete enregistree (le SQL d'une requete publiee en vue suit les renommages).
    pub fn lire_requete(&self, nom: &str) -> Resultat<RequeteEnregistree> {
        let o = meta::objet(self.conn(), GENRE, nom.trim())?.ok_or_else(|| ErreurBase::Introuvable(nom.trim().to_string()))?;
        let mut r: RequeteEnregistree = serde_json::from_value(o.contenu)?;
        if r.vue {
            if let Some(sql) = self.sql_de_vue(&r.nom)? {
                r.sql = sql;
            }
        }
        Ok(r)
    }

    /// SQL actuel d'une vue creee pour une requete (SQLite le reecrit lors des renommages).
    fn sql_de_vue(&self, nom: &str) -> Resultat<Option<String>> {
        let sql: Option<String> = self
            .conn()
            .query_row("SELECT sql FROM sqlite_master WHERE type = 'view' AND name = ?1", [nom], |l| l.get(0))
            .optional()?;
        Ok(sql.and_then(|s| s.strip_prefix(&prefixe_vue(nom)).map(str::to_string)))
    }

    /// Enregistre (cree ou remplace) une requete ; le SQL est verifie avant l'enregistrement.
    pub fn enregistrer_requete(&self, requete: &RequeteEnregistree) -> Resultat<RequeteEnregistree> {
        self.exiger_ecriture()?;
        let mut r = requete.clone();
        r.nom = valider_nom(&r.nom)?;
        let existante = meta::objet(self.conn(), GENRE, &r.nom)?
            .and_then(|o| serde_json::from_value::<RequeteEnregistree>(o.contenu).ok());
        if existante.is_none() && self.objet_sql(&r.nom)?.is_some() {
            return Err(ErreurBase::ExisteDeja(r.nom));
        }
        if r.sql.trim().is_empty() {
            let def: DefinitionRequete = serde_json::from_value(
                r.definition.clone().ok_or_else(|| ErreurBase::msg("La requête n'a ni SQL ni définition."))?,
            )?;
            r.genre = def.genre;
            if def.genre != GenreRequete::AnalyseCroisee {
                let g = self.generer_sql(&def)?;
                r.sql = g.sql;
                r.parametres = g.parametres;
            }
        }
        r.sql = nettoyer_sql(&r.sql);
        let nb_parametres = if r.sql.is_empty() {
            0
        } else {
            let _garde = self.mode_utilisateur();
            self.conn().prepare(&r.sql)?.parameter_count()
        };
        r.vue = matches!(r.genre, GenreRequete::Selection | GenreRequete::Union) && nb_parametres == 0 && !r.sql.is_empty();
        let ancienne_vue = existante.as_ref().is_some_and(|e| e.vue);
        let contenu = serde_json::to_value(&r)?;
        self.atomique(|| {
            if ancienne_vue {
                self.conn().execute_batch(&format!("DROP VIEW IF EXISTS {}", guillemets(&r.nom)))?;
            }
            if r.vue {
                let _garde = self.mode_utilisateur();
                self.conn().execute_batch(&format!("{}{}", prefixe_vue(&r.nom), r.sql))?;
            }
            meta::ecrire_objet(self.conn(), GENRE, &r.nom, &contenu, r.description.as_deref())
        })?;
        Ok(r)
    }

    /// Supprime une requete (et sa vue).
    pub fn supprimer_requete(&self, nom: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let r = self.lire_requete(nom)?;
        self.atomique(|| {
            if r.vue {
                self.conn().execute_batch(&format!("DROP VIEW IF EXISTS {}", guillemets(&r.nom)))?;
            }
            meta::supprimer_objet(self.conn(), GENRE, &r.nom)
        })
    }

    /// Renomme une requete.
    pub fn renommer_requete(&self, ancien: &str, nouveau: &str) -> Resultat<()> {
        let mut r = self.lire_requete(ancien)?;
        let nouveau = valider_nom(nouveau)?;
        if !r.nom.eq_ignore_ascii_case(&nouveau) && self.nom_pris(&nouveau)? {
            return Err(ErreurBase::ExisteDeja(nouveau));
        }
        self.supprimer_requete(&r.nom)?;
        r.nom = nouveau;
        self.enregistrer_requete(&r).map(|_| ())
    }

    /// Execute une requete enregistree. Les parametres nommes acceptent le nom Access
    /// (`{"Ville saisie": "Lyon"}`) ou le marqueur (`{"p1": "Lyon"}`).
    pub fn executer_requete(&self, nom: &str, params: &Parametres) -> Resultat<ResultatSql> {
        let r = self.lire_requete(nom)?;
        if r.genre == GenreRequete::AnalyseCroisee {
            let def: DefinitionRequete = serde_json::from_value(r.definition.clone().unwrap_or(Json::Null))?;
            let g = self.generer_sql(&def)?;
            return self.executer_sql(&g.sql, &Parametres::aucun());
        }
        let params = traduire_parametres(&r.parametres, params);
        if r.genre.est_action() {
            self.exiger_ecriture()?;
            return self.atomique(|| self.executer_sql(&r.sql, &params));
        }
        self.executer_sql(&r.sql, &params)
    }

    /// Execute une definition du createur sans l'enregistrer (bouton « Exécuter »).
    pub fn executer_definition(&self, def: &DefinitionRequete, params: &Parametres) -> Resultat<ResultatSql> {
        let g = self.generer_sql(def)?;
        let params = traduire_parametres(&g.parametres, params);
        let version = self.conn().query_row("PRAGMA schema_version", [], |r| r.get::<_, i64>(0))?;
        let resultat = self.atomique(|| {
            let _garde = self.mode_utilisateur();
            let mut stmt = self.conn().prepare(&g.sql)?;
            if self.est_lecture_seule() && !stmt.readonly() {
                return Err(ErreurBase::Interdit("la base est ouverte en lecture seule.".into()));
            }
            lier(&mut stmt, &params)?;
            executer(self, &mut stmt, LIMITE_LIGNES)
        });
        self.apres_sql_direct(version)?;
        resultat
    }

    /// Correction automatique apres renommage d'une table : requetes, formulaires, etats.
    pub(crate) fn objets_apres_renommage(&self, ancien: &str, nouveau: &str) -> Resultat<()> {
        for o in meta::objets(self.conn(), None)? {
            let mut contenu = o.contenu.clone();
            if o.genre == GENRE {
                let mut r: RequeteEnregistree = serde_json::from_value(contenu)?;
                if r.vue {
                    if let Some(s) = self.sql_de_vue(&r.nom)? {
                        r.sql = s;
                    }
                } else {
                    r.sql = renommer_dans_sql(&r.sql, ancien, nouveau);
                }
                if let Some(d) = r.definition.as_mut() {
                    renommer_dans_json(d, ancien, nouveau, None);
                }
                contenu = serde_json::to_value(&r)?;
            } else {
                renommer_dans_json(&mut contenu, ancien, nouveau, None);
            }
            if contenu != o.contenu {
                meta::ecrire_objet(self.conn(), &o.genre, &o.nom, &contenu, o.description.as_deref())?;
            }
        }
        Ok(())
    }
}

/// Associe les valeurs fournies par nom Access aux marqueurs `:p1`, `:p2`...
fn traduire_parametres(noms: &[String], params: &Parametres) -> Parametres {
    let Parametres::Nommes(carte) = params else {
        return params.clone();
    };
    if noms.is_empty() {
        return params.clone();
    }
    let mut sortie = Map::new();
    for (i, nom) in noms.iter().enumerate() {
        let marqueur = format!("p{}", i + 1);
        let valeur = carte
            .iter()
            .find(|(k, _)| k.eq_ignore_ascii_case(nom) || k.trim_start_matches([':', '@', '$']).eq_ignore_ascii_case(&marqueur))
            .map(|(_, v)| v.clone());
        if let Some(v) = valeur {
            sortie.insert(marqueur, v);
        }
    }
    Parametres::Nommes(sortie)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn correction_automatique_des_noms() {
        let mut d = json!({"tables": [{"nom": "Clients"}], "jointures": [{"gauche": "clients", "droite": "Cmd"}], "titre": "Clients"});
        renommer_dans_json(&mut d, "Clients", "Personnes", None);
        assert_eq!(d["tables"][0]["nom"], "Personnes");
        assert_eq!(d["jointures"][0]["gauche"], "Personnes");
        assert_eq!(d["titre"], "Clients");
        assert_eq!(renommer_dans_sql("SELECT * FROM \"Clients\"", "Clients", "P"), "SELECT * FROM \"P\"");
    }
}
