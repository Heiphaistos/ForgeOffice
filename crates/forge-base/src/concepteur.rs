//! Createur de requetes graphique (grille QBE d'Access) -> SQL.
//!
//! Gere : jointures internes/gauches/droites, criteres sur plusieurs lignes (« Ou »),
//! regroupements et operations (ligne Total), tri, valeurs distinctes, N premiers,
//! requetes ajout, mise a jour, suppression, creation de table et analyse croisee.

use serde::{Deserialize, Serialize};

use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::expr::{Contexte, Traducteur};
use crate::ident::{guillemets, litteral};
use crate::valeurs::valeur_vers_json;
use crate::types::Rendu;

/// Genre de requete.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GenreRequete {
    /// Selection.
    #[default]
    Selection,
    /// Ajout (INSERT ... SELECT).
    Ajout,
    /// Mise a jour.
    MiseAJour,
    /// Suppression.
    Suppression,
    /// Creation de table (CREATE TABLE ... AS SELECT).
    CreationTable,
    /// Analyse croisee (tableau croise).
    AnalyseCroisee,
    /// Union (SQL seulement).
    Union,
    /// SQL direct (toute instruction).
    SqlDirect,
}

impl GenreRequete {
    /// Vrai pour les requetes qui modifient la base.
    pub fn est_action(self) -> bool {
        matches!(self, Self::Ajout | Self::MiseAJour | Self::Suppression | Self::CreationTable | Self::SqlDirect)
    }
}

/// Table de la requete.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SourceRequete {
    /// Table ou requete.
    pub nom: String,
    /// Alias.
    #[serde(default)]
    pub alias: Option<String>,
}

/// Type de jointure.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum GenreJointure {
    /// Enregistrements correspondants seulement.
    #[default]
    Interne,
    /// Tous les enregistrements de la table de gauche.
    Gauche,
    /// Tous les enregistrements de la table de droite.
    Droite,
}

/// Jointure entre deux tables de la requete.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Jointure {
    /// Table (ou alias) de gauche.
    pub gauche: String,
    /// Champ de gauche.
    pub champ_gauche: String,
    /// Table (ou alias) de droite.
    pub droite: String,
    /// Champ de droite.
    pub champ_droite: String,
    /// Type.
    #[serde(default)]
    pub genre: GenreJointure,
}

/// Sens de tri.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SensTri {
    /// Croissant.
    Croissant,
    /// Decroissant.
    Decroissant,
}

/// Ligne « Opération » (requete totaux).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Operation {
    /// Regroupement.
    Regroupement,
    /// Somme.
    Somme,
    /// Moyenne.
    Moyenne,
    /// Minimum.
    Min,
    /// Maximum.
    Max,
    /// Compte.
    Compte,
    /// Ecart type.
    EcartType,
    /// Variance.
    Var,
    /// Premier.
    Premier,
    /// Dernier.
    Dernier,
    /// Expression (contient deja un agregat).
    Expression,
    /// Ou (critere seulement, colonne non affichee).
    Ou,
}

/// Role d'une colonne dans une analyse croisee.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RoleAnalyse {
    /// En-tete de ligne.
    EnTeteLigne,
    /// En-tete de colonne.
    EnTeteColonne,
    /// Valeur.
    Valeur,
}

fn vrai() -> bool {
    true
}

/// Colonne de la grille.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ColonneRequete {
    /// Champ (`Prix`, `*`) ou expression (`Total: [Prix]*[Qté]`).
    pub champ: String,
    /// Table (ou alias) du champ.
    #[serde(default)]
    pub table: Option<String>,
    /// Alias de colonne.
    #[serde(default)]
    pub alias: Option<String>,
    /// Case « Afficher ».
    #[serde(default = "vrai")]
    pub afficher: bool,
    /// Tri.
    #[serde(default)]
    pub tri: Option<SensTri>,
    /// Criteres : ligne 0 = « Critères », suivantes = « Ou ».
    #[serde(default)]
    pub criteres: Vec<String>,
    /// Operation (requete totaux).
    #[serde(default)]
    pub operation: Option<Operation>,
    /// « Mise à jour » (requete mise a jour).
    #[serde(default)]
    pub mise_a_jour: Option<String>,
    /// « Ajouter à » (requete ajout).
    #[serde(default)]
    pub ajouter_a: Option<String>,
    /// Role dans l'analyse croisee.
    #[serde(default)]
    pub analyse: Option<RoleAnalyse>,
}

/// Definition complete du createur de requetes.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct DefinitionRequete {
    /// Genre.
    #[serde(default)]
    pub genre: GenreRequete,
    /// Tables.
    pub tables: Vec<SourceRequete>,
    /// Jointures.
    #[serde(default)]
    pub jointures: Vec<Jointure>,
    /// Colonnes.
    #[serde(default)]
    pub colonnes: Vec<ColonneRequete>,
    /// Valeurs distinctes.
    #[serde(default)]
    pub distinct: bool,
    /// N premiers enregistrements.
    #[serde(default)]
    pub haut: Option<u32>,
    /// Table cible (ajout, creation de table).
    #[serde(default)]
    pub table_cible: Option<String>,
}

/// SQL genere et noms des parametres (`:p1` = premier).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct RequeteGeneree {
    /// SQL.
    pub sql: String,
    /// Parametres rencontres (noms Access).
    pub parametres: Vec<String>,
}

/// Separe `Alias: expression` (deux-points hors crochets et guillemets, alias simple).
fn alias_access(champ: &str) -> (Option<String>, String) {
    let mut dans: Option<char> = None;
    for (i, c) in champ.char_indices() {
        match dans {
            Some(f) if c == f => dans = None,
            Some(_) => {}
            None if c == '[' => dans = Some(']'),
            None if c == '"' || c == '\'' => dans = Some(c),
            None if c == ':' => {
                let gauche = champ[..i].trim();
                if !gauche.is_empty() && gauche.chars().all(|x| x.is_alphanumeric() || x == '_' || x == ' ') {
                    return (Some(gauche.to_string()), champ[i + 1..].trim().to_string());
                }
                return (None, champ.to_string());
            }
            None => {}
        }
    }
    (None, champ.trim().to_string())
}

struct Generateur<'a> {
    def: &'a DefinitionRequete,
    tr: Traducteur,
    expressions: usize,
}

impl Generateur<'_> {
    fn reference_table(&self, nom: &str) -> Resultat<String> {
        self.def
            .tables
            .iter()
            .find(|t| t.alias.as_deref().unwrap_or(&t.nom).eq_ignore_ascii_case(nom) || t.nom.eq_ignore_ascii_case(nom))
            .map(|t| guillemets(t.alias.as_deref().unwrap_or(&t.nom)))
            .ok_or_else(|| ErreurBase::Introuvable(nom.to_string()))
    }

    /// Expression SQL d'une colonne et son alias de sortie.
    fn colonne(&mut self, c: &ColonneRequete) -> Resultat<(String, Option<String>)> {
        let (alias_expr, brut) = alias_access(&c.champ);
        let alias = c.alias.clone().filter(|a| !a.trim().is_empty()).or(alias_expr);
        let simple = !brut.is_empty() && brut.chars().all(|x| x.is_alphanumeric() || x == '_' || x == ' ');
        let sql = match (&c.table, brut.as_str()) {
            (Some(t), "*") => format!("{}.*", self.reference_table(t)?),
            (None, "*") => "*".into(),
            (Some(t), nom) if simple => format!("{}.{}", self.reference_table(t)?, guillemets(nom)),
            _ => {
                let s = self.tr.expression(&brut)?;
                if alias.is_none() && !simple && !brut.starts_with('[') {
                    self.expressions += 1;
                    return Ok((s, Some(format!("Expr{}", self.expressions))));
                }
                s
            }
        };
        Ok((sql, alias))
    }

    fn agreger(op: Option<Operation>, expr: &str) -> String {
        match op {
            Some(Operation::Somme) => format!("sum({expr})"),
            Some(Operation::Moyenne) => format!("avg({expr})"),
            Some(Operation::Min | Operation::Premier) => format!("min({expr})"),
            Some(Operation::Max | Operation::Dernier) => format!("max({expr})"),
            Some(Operation::Compte) => format!("count({expr})"),
            Some(Operation::Var) => format!("((sum(({expr})*({expr})) - sum({expr})*sum({expr})/count({expr})) / (count({expr}) - 1))"),
            Some(Operation::EcartType) => format!("fo_racine((sum(({expr})*({expr})) - sum({expr})*sum({expr})/count({expr})) / (count({expr}) - 1))"),
            _ => expr.to_string(),
        }
    }

    fn from(&self) -> Resultat<String> {
        let tables = &self.def.tables;
        let Some(premiere) = tables.first() else {
            return Err(ErreurBase::msg("La requête n'a aucune table."));
        };
        let nom_ref = |t: &SourceRequete| t.alias.clone().unwrap_or_else(|| t.nom.clone());
        let source = |t: &SourceRequete| match &t.alias {
            Some(a) => format!("{} AS {}", guillemets(&t.nom), guillemets(a)),
            None => guillemets(&t.nom),
        };
        let mut sql = source(premiere);
        let mut inclus = vec![nom_ref(premiere).to_lowercase()];
        let mut restantes: Vec<&SourceRequete> = tables.iter().skip(1).collect();
        while !restantes.is_empty() {
            let choix = restantes.iter().position(|t| {
                let n = nom_ref(t).to_lowercase();
                self.def.jointures.iter().any(|j| {
                    (j.gauche.to_lowercase() == n && inclus.contains(&j.droite.to_lowercase()))
                        || (j.droite.to_lowercase() == n && inclus.contains(&j.gauche.to_lowercase()))
                })
            });
            let Some(i) = choix else {
                let t = restantes.remove(0);
                sql.push_str(&format!(" CROSS JOIN {}", source(t)));
                inclus.push(nom_ref(t).to_lowercase());
                continue;
            };
            let t = restantes.remove(i);
            let n = nom_ref(t).to_lowercase();
            let mut conditions = Vec::new();
            let mut genre = "INNER";
            for j in &self.def.jointures {
                let (g, d) = (j.gauche.to_lowercase(), j.droite.to_lowercase());
                let oriente = if d == n && inclus.contains(&g) {
                    Some(j.genre)
                } else if g == n && inclus.contains(&d) {
                    Some(match j.genre {
                        GenreJointure::Gauche => GenreJointure::Droite,
                        GenreJointure::Droite => GenreJointure::Gauche,
                        GenreJointure::Interne => GenreJointure::Interne,
                    })
                } else {
                    None
                };
                if let Some(o) = oriente {
                    if conditions.is_empty() {
                        genre = match o {
                            GenreJointure::Interne => "INNER",
                            GenreJointure::Gauche => "LEFT",
                            GenreJointure::Droite => "RIGHT",
                        };
                    }
                    conditions.push(format!(
                        "{}.{} = {}.{}",
                        self.reference_table(&j.gauche)?,
                        guillemets(&j.champ_gauche),
                        self.reference_table(&j.droite)?,
                        guillemets(&j.champ_droite)
                    ));
                }
            }
            sql.push_str(&format!(" {genre} JOIN {} ON {}", source(t), conditions.join(" AND ")));
            inclus.push(n);
        }
        Ok(sql)
    }

    /// Clauses WHERE et HAVING a partir des lignes de criteres.
    fn criteres(&mut self, exprs: &[(String, bool)]) -> Resultat<(Option<String>, Option<String>)> {
        let lignes = self.def.colonnes.iter().map(|c| c.criteres.len()).max().unwrap_or(0);
        let (mut ou_where, mut ou_having) = (Vec::new(), Vec::new());
        for r in 0..lignes {
            let (mut et_where, mut et_having) = (Vec::new(), Vec::new());
            for (c, (expr, agregat)) in self.def.colonnes.iter().zip(exprs) {
                let Some(critere) = c.criteres.get(r).map(|s| s.trim()).filter(|s| !s.is_empty()) else { continue };
                let condition = self.tr.critere(critere, expr)?;
                if *agregat {
                    et_having.push(condition);
                } else {
                    et_where.push(condition);
                }
            }
            if !et_where.is_empty() {
                ou_where.push(format!("({})", et_where.join(" AND ")));
            }
            if !et_having.is_empty() {
                ou_having.push(format!("({})", et_having.join(" AND ")));
            }
        }
        let joindre = |v: Vec<String>| (!v.is_empty()).then(|| v.join(" OR "));
        Ok((joindre(ou_where), joindre(ou_having)))
    }
}

impl Base {
    fn noms_champs_requete(&self, def: &DefinitionRequete) -> Resultat<Vec<String>> {
        let mut noms = Vec::new();
        for t in &def.tables {
            for c in self.champs(&t.nom)? {
                noms.push(c.nom);
            }
        }
        Ok(noms)
    }

    /// Genere le SQL d'une definition du createur de requetes.
    pub fn generer_sql(&self, def: &DefinitionRequete) -> Resultat<RequeteGeneree> {
        let noms = self.noms_champs_requete(def)?;
        let mut g = Generateur { def, tr: Traducteur::nouveau(Contexte::Requete, Some(&noms)), expressions: 0 };
        if def.genre == GenreRequete::AnalyseCroisee {
            return self.analyse_croisee(&mut g);
        }
        let totaux = def.colonnes.iter().any(|c| c.operation.is_some_and(|o| o != Operation::Ou));
        let mut exprs: Vec<(String, bool)> = Vec::new();
        let (mut select, mut groupes, mut tris) = (Vec::new(), Vec::new(), Vec::new());
        for c in &def.colonnes {
            let (expr, alias) = g.colonne(c)?;
            let agregat = totaux && !matches!(c.operation, None | Some(Operation::Regroupement | Operation::Ou));
            let finale = if totaux { Generateur::agreger(c.operation, &expr) } else { expr.clone() };
            if totaux && matches!(c.operation, None | Some(Operation::Regroupement)) {
                groupes.push(expr.clone());
            }
            if c.afficher && c.operation != Some(Operation::Ou) {
                select.push(match &alias {
                    Some(a) => format!("{finale} AS {}", guillemets(a)),
                    None => finale.clone(),
                });
            }
            if let Some(sens) = c.tri {
                tris.push(format!("{finale} {}", if sens == SensTri::Decroissant { "DESC" } else { "ASC" }));
            }
            exprs.push((if agregat { finale } else { expr }, agregat));
        }
        let (ou, avoir) = g.criteres(&exprs)?;
        let from = g.from()?;
        let where_sql = ou.map(|w| format!(" WHERE {w}")).unwrap_or_default();
        let principale = def.tables.first().map(|t| t.nom.clone()).unwrap_or_default();
        let sql = match def.genre {
            GenreRequete::MiseAJour => {
                let affect: Vec<String> = def
                    .colonnes
                    .iter()
                    .filter_map(|c| c.mise_a_jour.as_deref().filter(|m| !m.trim().is_empty()).map(|m| (c, m)))
                    .map(|(c, m)| Ok(format!("{} = {}", guillemets(alias_access(&c.champ).1.trim()), g.tr.expression(m)?)))
                    .collect::<Resultat<_>>()?;
                if affect.is_empty() {
                    return Err(ErreurBase::msg("La requête Mise à jour n'a aucune ligne « Mise à jour »."));
                }
                format!("UPDATE {} SET {}{}", guillemets(&principale), affect.join(", "), condition_action(def, &principale, &from, &where_sql))
            }
            GenreRequete::Suppression => format!("DELETE FROM {}{}", guillemets(&principale), condition_action(def, &principale, &from, &where_sql)),
            _ => {
                if select.is_empty() {
                    return Err(ErreurBase::msg("Aucune colonne à afficher."));
                }
                let mut s = format!("SELECT {}{} FROM {from}{where_sql}", if def.distinct { "DISTINCT " } else { "" }, select.join(", "));
                if !groupes.is_empty() && totaux {
                    s.push_str(&format!(" GROUP BY {}", groupes.join(", ")));
                }
                if let Some(h) = avoir {
                    s.push_str(&format!(" HAVING {h}"));
                }
                if !tris.is_empty() {
                    s.push_str(&format!(" ORDER BY {}", tris.join(", ")));
                }
                if let Some(n) = def.haut {
                    s.push_str(&format!(" LIMIT {n}"));
                }
                match def.genre {
                    GenreRequete::CreationTable => format!("CREATE TABLE {} AS {s}", guillemets(cible(def)?)),
                    GenreRequete::Ajout => {
                        let cibles: Vec<String> = def
                            .colonnes
                            .iter()
                            .filter(|c| c.afficher && c.operation != Some(Operation::Ou))
                            .map(|c| c.ajouter_a.clone().unwrap_or_else(|| alias_access(&c.champ).1))
                            .map(|c| guillemets(c.trim()))
                            .collect();
                        format!("INSERT INTO {} ({}) {s}", guillemets(cible(def)?), cibles.join(", "))
                    }
                    _ => s,
                }
            }
        };
        Ok(RequeteGeneree { sql, parametres: g.tr.parametres().to_vec() })
    }

    fn analyse_croisee(&self, g: &mut Generateur<'_>) -> Resultat<RequeteGeneree> {
        let def = g.def;
        let mut lignes = Vec::new();
        let (mut colonne, mut valeur) = (None, None);
        let mut exprs: Vec<(String, bool)> = Vec::new();
        for c in &def.colonnes {
            let (expr, alias) = g.colonne(c)?;
            exprs.push((expr.clone(), false));
            match c.analyse {
                Some(RoleAnalyse::EnTeteLigne) => lignes.push((expr, alias.unwrap_or_else(|| alias_access(&c.champ).1))),
                Some(RoleAnalyse::EnTeteColonne) => colonne = Some(expr),
                Some(RoleAnalyse::Valeur) => valeur = Some((expr, c.operation.unwrap_or(Operation::Somme), alias_access(&c.champ).1)),
                None => {}
            }
        }
        let (Some(col), Some((val, op, nom_val))) = (colonne, valeur) else {
            return Err(ErreurBase::msg("Une analyse croisée demande un en-tête de colonne et une valeur."));
        };
        if lignes.is_empty() {
            return Err(ErreurBase::msg("Une analyse croisée demande au moins un en-tête de ligne."));
        }
        let from = g.from()?;
        let (ou, _) = g.criteres(&exprs)?;
        let where_sql = ou.map(|w| format!(" WHERE {w}")).unwrap_or_default();
        if !g.tr.parametres().is_empty() {
            return Err(ErreurBase::msg("Les paramètres ne sont pas pris en charge dans une analyse croisée."));
        }
        let mut stmt = self.conn().prepare(&format!("SELECT DISTINCT {col} FROM {from}{where_sql} ORDER BY 1 LIMIT 256"))?;
        let mut rangs = stmt.query([])?;
        let mut valeurs = Vec::new();
        while let Some(r) = rangs.next()? {
            valeurs.push(r.get::<_, rusqlite::types::Value>(0)?);
        }
        if valeurs.len() > 255 {
            return Err(ErreurBase::msg("Plus de 255 en-têtes de colonne : affinez les critères."));
        }
        let mut select: Vec<String> = lignes.iter().map(|(e, a)| format!("{e} AS {}", guillemets(a))).collect();
        select.push(format!("{} AS {}", Generateur::agreger(Some(op), &val), guillemets(&format!("Total de {nom_val}"))));
        for v in &valeurs {
            let (lit, titre) = match v {
                rusqlite::types::Value::Null => ("NULL".to_string(), "<Nul>".to_string()),
                rusqlite::types::Value::Text(t) => (litteral(t), t.clone()),
                autre => {
                    let j = valeur_vers_json(autre, Rendu::Brut);
                    (j.to_string(), j.to_string())
                }
            };
            let test = if lit == "NULL" { format!("{col} IS NULL") } else { format!("{col} = {lit}") };
            select.push(format!("{} AS {}", Generateur::agreger(Some(op), &format!("CASE WHEN {test} THEN {val} END")), guillemets(&titre)));
        }
        let groupes: Vec<&str> = lignes.iter().map(|(e, _)| e.as_str()).collect();
        Ok(RequeteGeneree {
            sql: format!("SELECT {} FROM {from}{where_sql} GROUP BY {} ORDER BY {}", select.join(", "), groupes.join(", "), groupes.join(", ")),
            parametres: Vec::new(),
        })
    }
}

fn cible(def: &DefinitionRequete) -> Resultat<&str> {
    def.table_cible
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| ErreurBase::msg("Indiquez la table cible de la requête."))
}

/// Condition d'une requete action : simple sur une table, sinon par `rowid IN (...)` sur la jointure.
fn condition_action(def: &DefinitionRequete, principale: &str, from: &str, where_sql: &str) -> String {
    if def.tables.len() <= 1 {
        return where_sql.to_string();
    }
    let reference = def.tables.first().and_then(|t| t.alias.clone()).unwrap_or_else(|| principale.to_string());
    format!(" WHERE rowid IN (SELECT {}.rowid FROM {from}{where_sql})", guillemets(&reference))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn alias_de_colonne_access() {
        assert_eq!(alias_access("Total: [Prix]*2"), (Some("Total".into()), "[Prix]*2".into()));
        assert_eq!(alias_access("[a:b]"), (None, "[a:b]".into()));
        assert_eq!(alias_access("Prix"), (None, "Prix".into()));
    }
}
