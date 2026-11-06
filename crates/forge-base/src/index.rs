//! Index nommes sur plusieurs champs (fenetre « Index » d'Access) : creation, suppression, listage.
//!
//! Un index nomme est un index SQLite `fo_ix:<table>:<nom>`. Les index de la propriete « Indexe »
//! (`fo_idx:`), des relations (`fo_rel:`) et la cle primaire gardent leur propre gestion.
//! Une reconstruction de table (modification de champ, cle primaire...) recree les index nommes ;
//! un index dont un champ disparait est supprime avec un avertissement (voir `structure.rs`).

use serde::{Deserialize, Serialize};

use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{guillemets, valider_nom};
use crate::schema::{ChampIndex, IndexInfo};
use crate::types::TypeChamp;

/// Prefixe SQL des index nommes.
pub const PREFIXE_INDEX_NOMME: &str = "fo_ix:";
/// Nombre maximal de champs d'un index (comme Access).
pub const CHAMPS_INDEX_MAX: usize = 10;

/// Definition d'un index nomme.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DefinitionIndex {
    /// Nom de l'index (unique dans la table).
    pub nom: String,
    /// Champs dans l'ordre, chacun croissant ou decroissant.
    pub champs: Vec<ChampIndex>,
    /// Sans doublons (combinaison de valeurs unique).
    #[serde(default)]
    pub unique: bool,
}

/// Nom d'affichage d'un index nomme (`fo_ix:Table:Nom` -> `Nom`), `None` pour les autres index.
pub(crate) fn nom_affiche(sql: &str, table: &str) -> Option<String> {
    let reste = sql.strip_prefix(PREFIXE_INDEX_NOMME)?;
    // La table a pu etre renommee depuis : on retombe alors sur le premier « : ».
    let nom = reste.strip_prefix(&format!("{table}:")).or_else(|| reste.split_once(':').map(|(_, n)| n))?;
    Some(nom.to_string())
}

/// Index nomme lu dans la base (pour le recreer apres reconstruction de table).
pub(crate) struct IndexLu {
    pub nom_sql: String,
    pub champs: Vec<ChampIndex>,
    pub unique: bool,
}

impl IndexLu {
    /// `CREATE INDEX` equivalent pour la table `table`.
    pub fn sql_creation(&self, table: &str) -> String {
        let cols: Vec<String> = self.champs.iter().map(|c| format!("{}{}", guillemets(&c.nom), if c.decroissant { " DESC" } else { "" })).collect();
        format!("CREATE {}INDEX {} ON {} ({})", if self.unique { "UNIQUE " } else { "" }, guillemets(&self.nom_sql), guillemets(table), cols.join(", "))
    }
}

/// Index nommes d'une table, tels que la base les decrit maintenant (noms de champ a jour).
pub(crate) fn lire_nommes(conn: &rusqlite::Connection, table: &str) -> Resultat<Vec<IndexLu>> {
    let mut stmt = conn.prepare(r#"SELECT name, "unique" FROM pragma_index_list(?1) WHERE name LIKE 'fo\_ix:%' ESCAPE '\'"#)?;
    let liste = stmt.query_map([table], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)? != 0)))?.collect::<rusqlite::Result<Vec<_>>>()?;
    let mut sortie = Vec::new();
    for (nom_sql, unique) in liste {
        let mut st = conn.prepare(r#"SELECT name, "desc" FROM pragma_index_xinfo(?1) WHERE key = 1 ORDER BY seqno"#)?;
        let champs = st
            .query_map([&nom_sql], |r| Ok(ChampIndex { nom: r.get::<_, Option<String>>(0)?.unwrap_or_default(), decroissant: r.get::<_, i64>(1)? != 0 }))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        sortie.push(IndexLu { nom_sql, champs, unique });
    }
    Ok(sortie)
}

impl Base {
    /// Cree un index nomme sur un ou plusieurs champs de la table.
    pub fn creer_index(&self, table: &str, def: &DefinitionIndex) -> Resultat<IndexInfo> {
        self.exiger_ecriture()?;
        let table = self.nom_table(table)?;
        let nom = valider_nom(&def.nom)?;
        if def.champs.is_empty() || def.champs.len() > CHAMPS_INDEX_MAX {
            return Err(ErreurBase::msg(format!("Un index porte sur 1 à {CHAMPS_INDEX_MAX} champs.")));
        }
        if self.index_nomme(&table, &nom)?.is_some() {
            return Err(ErreurBase::ExisteDeja(nom));
        }
        let schema = self.champs(&table)?;
        let mut colonnes = Vec::with_capacity(def.champs.len());
        let mut vus: Vec<String> = Vec::new();
        for c in &def.champs {
            let champ = crate::donnees::trouver(&schema, &c.nom)?;
            if matches!(champ.type_champ, TypeChamp::TexteLong | TypeChamp::PieceJointe | TypeChamp::ObjetOle) {
                return Err(ErreurBase::Validation {
                    champ: champ.nom.clone(),
                    message: format!("un champ de type « {} » ne peut pas être indexé.", champ.type_champ.libelle()),
                });
            }
            if vus.iter().any(|v| v.eq_ignore_ascii_case(&champ.nom)) {
                return Err(ErreurBase::msg(format!("Le champ « {} » est déjà dans l'index.", champ.nom)));
            }
            vus.push(champ.nom.clone());
            colonnes.push(format!("{}{}", guillemets(&champ.nom), if c.decroissant { " DESC" } else { "" }));
        }
        let sql_nom = format!("{PREFIXE_INDEX_NOMME}{table}:{nom}");
        let sql = format!(
            "CREATE {}INDEX {} ON {} ({})",
            if def.unique { "UNIQUE " } else { "" },
            guillemets(&sql_nom),
            guillemets(&table),
            colonnes.join(", ")
        );
        self.atomique(|| {
            self.conn().execute_batch(&sql).map_err(|e| match e {
                rusqlite::Error::SqliteFailure(f, _) if def.unique && f.code == rusqlite::ErrorCode::ConstraintViolation => {
                    ErreurBase::Contrainte("Impossible de créer un index sans doublons : des valeurs en double existent déjà dans ces champs.".into())
                }
                autre => autre.into(),
            })
        })?;
        self.index_nomme(&table, &nom)?.ok_or(ErreurBase::Introuvable(nom))
    }

    /// Supprime un index nomme (les autres index se gerent par la propriete « Indexe » ou la cle primaire).
    pub fn supprimer_index(&self, table: &str, nom: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let table = self.nom_table(table)?;
        let Some(sql_nom) = self.nom_sql_index(&table, nom.trim())? else {
            return Err(ErreurBase::msg(format!(
                "« {} » n'est pas un index nommé de « {table} » (changez la propriété « Indexé » du champ ou la clé primaire).",
                nom.trim()
            )));
        };
        self.atomique(|| Ok(self.conn().execute_batch(&format!("DROP INDEX {}", guillemets(&sql_nom)))?))
    }

    /// Index nommes d'une table (les index de champ, de relation et la cle primaire sont dans `index_table`).
    pub fn lister_index_nommes(&self, table: &str) -> Resultat<Vec<IndexInfo>> {
        Ok(self.index_table(table)?.into_iter().filter(|i| i.origine == "nomme").collect())
    }

    fn nom_sql_index(&self, table: &str, nom: &str) -> Resultat<Option<String>> {
        let mut stmt = self.conn().prepare("SELECT name FROM pragma_index_list(?1)")?;
        let noms = stmt.query_map([table], |r| r.get::<_, String>(0))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(noms.into_iter().find(|n| nom_affiche(n, table).is_some_and(|a| a.eq_ignore_ascii_case(nom))))
    }

    fn index_nomme(&self, table: &str, nom: &str) -> Resultat<Option<IndexInfo>> {
        Ok(self.lister_index_nommes(table)?.into_iter().find(|i| i.nom.eq_ignore_ascii_case(nom)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nom_affiche_gere_le_renommage_de_table() {
        assert_eq!(nom_affiche("fo_ix:Clients:Ville_Nom", "Clients").as_deref(), Some("Ville_Nom"));
        assert_eq!(nom_affiche("fo_ix:Ancien:Ville_Nom", "Nouveau").as_deref(), Some("Ville_Nom"));
        assert_eq!(nom_affiche("fo_idx:Clients:Ville", "Clients"), None);
    }
}
