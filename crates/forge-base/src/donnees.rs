//! Feuille de donnees : lecture paginee (tri, filtres, recherche) et ecriture par cle.

use rusqlite::params_from_iter;
use rusqlite::types::Value as SqlValue;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};

use crate::base::{plier, Base};
use crate::erreur::{ErreurBase, Resultat};
use crate::expr::{echapper_like, motif_like, Contexte, Traducteur};
use crate::ident::guillemets;
use crate::masque::appliquer_masque;
use crate::meta;
use crate::types::{ChampSchema, Rendu, TypeChamp};
use crate::valeurs::{json_vers_sql, sql_vers_json};

/// Cle d'un enregistrement : champs de la cle primaire, ou `{ "rowid": n }`.
pub type Cle = Map<String, Json>;

/// Taille de page maximale.
pub const TAILLE_PAGE_MAX: u64 = 10_000;

/// Operateur de filtre (menus de filtre de la feuille de donnees).
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Operateur {
    /// Est egal a (texte insensible a la casse).
    Egal,
    /// N'est pas egal a.
    Different,
    /// Inferieur a.
    Inferieur,
    /// Inferieur ou egal a.
    InferieurOuEgal,
    /// Superieur a.
    Superieur,
    /// Superieur ou egal a.
    SuperieurOuEgal,
    /// Contient.
    Contient,
    /// Ne contient pas.
    NeContientPas,
    /// Commence par.
    CommencePar,
    /// Se termine par.
    FinitPar,
    /// Est vide (Null ou chaine vide).
    EstVide,
    /// N'est pas vide.
    NestPasVide,
    /// Entre `valeur` et `valeur2`.
    Entre,
    /// Dans la liste `valeurs`.
    Dans,
    /// Comme (motif Access `*`, `?`, `#`).
    Comme,
}

/// Filtre sur un champ.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Filtre {
    /// Champ filtre.
    pub champ: String,
    /// Operateur.
    pub operateur: Operateur,
    /// Valeur.
    #[serde(default)]
    pub valeur: Json,
    /// Seconde valeur (Entre).
    #[serde(default)]
    pub valeur2: Json,
    /// Liste de valeurs (Dans).
    #[serde(default)]
    pub valeurs: Vec<Json>,
}

/// Tri sur un champ.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Tri {
    /// Champ trie.
    pub champ: String,
    /// Ordre decroissant.
    #[serde(default)]
    pub descendant: bool,
}

/// Options de lecture d'une feuille de donnees.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct OptionsLecture {
    /// Page (0 = premiere).
    pub page: u64,
    /// Lignes par page (1 a 10 000, defaut 100).
    pub taille_page: u64,
    /// Tris successifs (vide = tri par defaut de la table, puis cle).
    pub tri: Vec<Tri>,
    /// Filtres.
    pub filtres: Vec<Filtre>,
    /// Combiner les filtres par OU (sinon ET).
    pub combinaison_ou: bool,
    /// Recherche plein texte, insensible a la casse et aux accents.
    pub recherche: Option<String>,
    /// Filtre en expression Access (`[Prix] > 10 Et [Ville] = "Lyon"`).
    pub expression: Option<String>,
    /// Champs a renvoyer (tous si absent).
    pub champs: Option<Vec<String>>,
    /// Renvoyer le contenu des pieces jointes (sinon seulement leur taille).
    pub blobs: bool,
}

impl Default for OptionsLecture {
    fn default() -> Self {
        Self {
            page: 0,
            taille_page: 100,
            tri: Vec::new(),
            filtres: Vec::new(),
            combinaison_ou: false,
            recherche: None,
            expression: None,
            champs: None,
            blobs: true,
        }
    }
}

/// Colonne d'un resultat.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ColonneResultat {
    /// Nom.
    pub nom: String,
    /// Type Access (si connu).
    #[serde(rename = "type")]
    pub type_champ: Option<TypeChamp>,
    /// Rendu JSON des valeurs.
    pub rendu: Rendu,
    /// Legende (titre de colonne) si definie.
    pub legende: Option<String>,
}

/// Page de la feuille de donnees.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct PageLignes {
    /// Colonnes.
    pub colonnes: Vec<ColonneResultat>,
    /// Lignes (valeurs dans l'ordre des colonnes).
    pub lignes: Vec<Vec<Json>>,
    /// Cle de chaque ligne (vide pour une vue).
    pub cles: Vec<Cle>,
    /// Nombre total d'enregistrements filtres.
    pub total: i64,
    /// Page renvoyee.
    pub page: u64,
    /// Taille de page.
    pub taille_page: u64,
    /// Nombre de pages.
    pub nb_pages: u64,
    /// Les lignes peuvent etre modifiees (table et non vue).
    pub modifiable: bool,
}

/// Calcul de la ligne Total de la feuille de donnees.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FonctionTotal {
    /// Somme.
    Somme,
    /// Moyenne.
    Moyenne,
    /// Nombre de valeurs non nulles.
    Compte,
    /// Minimum.
    Min,
    /// Maximum.
    Max,
    /// Ecart type (echantillon).
    EcartType,
    /// Variance (echantillon).
    Variance,
}

pub(crate) fn trouver<'a>(champs: &'a [ChampSchema], nom: &str) -> Resultat<&'a ChampSchema> {
    champs
        .iter()
        .find(|c| c.nom.eq_ignore_ascii_case(nom.trim()))
        .ok_or_else(|| ErreurBase::Validation { champ: nom.to_string(), message: "champ inconnu.".into() })
}

fn convertir(c: &ChampSchema, v: &Json) -> Resultat<SqlValue> {
    json_vers_sql(v, Some(c.type_champ), Some(&c.proprietes), None)
        .map_err(|message| ErreurBase::Validation { champ: c.nom.clone(), message })
}

fn texte(v: &Json) -> String {
    match v {
        Json::String(s) => s.clone(),
        Json::Null => String::new(),
        autre => autre.to_string(),
    }
}

/// Construit la clause WHERE (sans le mot WHERE) et ses parametres.
fn clause_where(champs: &[ChampSchema], o: &OptionsLecture) -> Resultat<(String, Vec<SqlValue>)> {
    let mut parties: Vec<String> = Vec::new();
    let mut params: Vec<SqlValue> = Vec::new();
    let mut filtres: Vec<String> = Vec::new();
    for f in &o.filtres {
        let c = trouver(champs, &f.champ)?;
        let q = guillemets(&c.nom);
        let nocase = if c.type_champ.est_texte() { " COLLATE NOCASE" } else { "" };
        let like = |motif: String, p: &mut Vec<SqlValue>| {
            p.push(SqlValue::Text(motif));
            format!("CAST({q} AS TEXT) LIKE ? ESCAPE '\\'")
        };
        let sql = match f.operateur {
            Operateur::EstVide => format!("({q} IS NULL OR {q} = '')"),
            Operateur::NestPasVide => format!("({q} IS NOT NULL AND {q} <> '')"),
            Operateur::Contient => like(format!("%{}%", echapper_like(&texte(&f.valeur))), &mut params),
            Operateur::NeContientPas => format!("({q} IS NULL OR NOT {})", like(format!("%{}%", echapper_like(&texte(&f.valeur))), &mut params)),
            Operateur::CommencePar => like(format!("{}%", echapper_like(&texte(&f.valeur))), &mut params),
            Operateur::FinitPar => like(format!("%{}", echapper_like(&texte(&f.valeur))), &mut params),
            Operateur::Comme => like(motif_like(&texte(&f.valeur)), &mut params),
            Operateur::Entre => {
                params.push(convertir(c, &f.valeur)?);
                params.push(convertir(c, &f.valeur2)?);
                format!("{q} BETWEEN ? AND ?")
            }
            Operateur::Dans => {
                if f.valeurs.is_empty() {
                    "0".into()
                } else {
                    for v in &f.valeurs {
                        params.push(convertir(c, v)?);
                    }
                    format!("{q}{nocase} IN ({})", vec!["?"; f.valeurs.len()].join(", "))
                }
            }
            op => {
                let symbole = match op {
                    Operateur::Egal => "=",
                    Operateur::Different => "<>",
                    Operateur::Inferieur => "<",
                    Operateur::InferieurOuEgal => "<=",
                    Operateur::Superieur => ">",
                    _ => ">=",
                };
                let v = convertir(c, &f.valeur)?;
                if v == SqlValue::Null {
                    match op {
                        Operateur::Egal => format!("{q} IS NULL"),
                        Operateur::Different => format!("{q} IS NOT NULL"),
                        _ => "0".into(),
                    }
                } else {
                    params.push(v);
                    if op == Operateur::Different {
                        format!("({q} IS NULL OR {q}{nocase} <> ?)")
                    } else {
                        format!("{q}{nocase} {symbole} ?")
                    }
                }
            }
        };
        filtres.push(sql);
    }
    if !filtres.is_empty() {
        let lien = if o.combinaison_ou { " OR " } else { " AND " };
        parties.push(format!("({})", filtres.join(lien)));
    }
    if let Some(r) = o.recherche.as_deref().map(str::trim).filter(|r| !r.is_empty()) {
        let motif = format!("%{}%", echapper_like(&plier(r)));
        let mut cols: Vec<String> = Vec::new();
        for c in champs.iter().filter(|c| !c.type_champ.est_binaire()) {
            cols.push(format!("fo_plier(CAST({} AS TEXT)) LIKE ? ESCAPE '\'", guillemets(&c.nom)));
            params.push(SqlValue::Text(motif.clone()));
        }
        if !cols.is_empty() {
            parties.push(format!("({})", cols.join(" OR ")));
        }
    }
    if let Some(e) = o.expression.as_deref().map(str::trim).filter(|e| !e.is_empty()) {
        let noms: Vec<String> = champs.iter().map(|c| c.nom.clone()).collect();
        let mut tr = Traducteur::nouveau(Contexte::Requete, Some(&noms));
        let sql = tr.expression(e)?;
        if let Some(p) = tr.parametres().first() {
            return Err(ErreurBase::Expression(format!("champ inconnu « {p} ».")));
        }
        parties.push(format!("({sql})"));
    }
    Ok((parties.join(" AND "), params))
}

fn ordre(champs: &[ChampSchema], tris: &[Tri]) -> Resultat<Vec<String>> {
    tris.iter()
        .map(|t| {
            let c = trouver(champs, &t.champ)?;
            let collation = if c.type_champ.est_texte() { " COLLATE FR" } else { "" };
            Ok(format!("{}{collation} {}", guillemets(&c.nom), if t.descendant { "DESC" } else { "ASC" }))
        })
        .collect()
}

/// Lit le tri par defaut d'une table (`Nom, Prix DESC`).
fn tri_defaut(texte: &str) -> Vec<Tri> {
    texte
        .split(',')
        .filter_map(|p| {
            let p = p.trim();
            let (nom, desc) = match p.rsplit_once(' ') {
                Some((n, s)) if s.eq_ignore_ascii_case("desc") => (n, true),
                Some((n, s)) if s.eq_ignore_ascii_case("asc") => (n, false),
                _ => (p, false),
            };
            let nom = nom.trim().trim_start_matches('[').trim_end_matches(']');
            (!nom.is_empty()).then(|| Tri { champ: nom.to_string(), descendant: desc })
        })
        .collect()
}

impl Base {
    pub(crate) fn a_rowid(&self, table: &str) -> Resultat<bool> {
        let sql: Option<String> = self
            .conn()
            .query_row("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1", [table], |r| r.get(0))?;
        Ok(!sql.unwrap_or_default().to_ascii_uppercase().contains("WITHOUT ROWID"))
    }

    /// Colonnes de cle : champs de la cle primaire, sinon `rowid`.
    fn colonnes_cle(&self, table: &str, champs: &[ChampSchema]) -> Resultat<Vec<String>> {
        let pk: Vec<String> = champs.iter().filter(|c| c.cle_primaire).map(|c| c.nom.clone()).collect();
        if !pk.is_empty() || !self.a_rowid(table)? {
            return Ok(pk);
        }
        Ok(vec!["rowid".into()])
    }

    /// Lit une page de la feuille de donnees d'une table ou d'une vue.
    pub fn lire_table(&self, table: &str, options: &OptionsLecture) -> Resultat<PageLignes> {
        let (nom, est_vue) = self.nom_source(table)?;
        let tous = self.champs(&nom)?;
        let affiches: Vec<&ChampSchema> = match &options.champs {
            Some(liste) => liste.iter().map(|n| trouver(&tous, n)).collect::<Resultat<_>>()?,
            None => tous.iter().collect(),
        };
        let cles = if est_vue { Vec::new() } else { self.colonnes_cle(&nom, &tous)? };
        let (filtre, params) = clause_where(&tous, options)?;
        let ou = if filtre.is_empty() { String::new() } else { format!(" WHERE {filtre}") };
        let q = guillemets(&nom);
        let total: i64 = self.conn().query_row(&format!("SELECT count(*) FROM {q}{ou}"), params_from_iter(params.iter()), |r| r.get(0))?;
        let mut tris = options.tri.clone();
        if tris.is_empty() {
            if let Some(t) = meta::table(self.conn(), &nom)?.tri {
                tris = tri_defaut(&t).into_iter().filter(|t| trouver(&tous, &t.champ).is_ok()).collect();
            }
        }
        let mut ordres = ordre(&tous, &tris)?;
        ordres.extend(cles.iter().map(|c| if c == "rowid" { "rowid".to_string() } else { guillemets(c) }));
        let ordre_sql = if ordres.is_empty() { String::new() } else { format!(" ORDER BY {}", ordres.join(", ")) };
        let taille = if options.taille_page == 0 { 100 } else { options.taille_page.min(TAILLE_PAGE_MAX) };
        let mut selection: Vec<String> = affiches.iter().map(|c| guillemets(&c.nom)).collect();
        selection.extend(cles.iter().map(|c| if c == "rowid" { "rowid".to_string() } else { guillemets(c) }));
        let sql = format!(
            "SELECT {} FROM {q}{ou}{ordre_sql} LIMIT {taille} OFFSET {}",
            selection.join(", "),
            options.page.saturating_mul(taille).min(i64::MAX as u64)
        );
        let mut stmt = self.conn().prepare(&sql)?;
        let mut lignes_sql = stmt.query(params_from_iter(params.iter()))?;
        let (mut lignes, mut cles_lignes) = (Vec::new(), Vec::new());
        let rendus: Vec<Rendu> = affiches.iter().map(|c| c.type_champ.rendu()).collect();
        while let Some(l) = lignes_sql.next()? {
            let mut ligne = Vec::with_capacity(affiches.len());
            for (i, rendu) in rendus.iter().enumerate() {
                ligne.push(sql_vers_json(l.get_ref(i)?, *rendu, options.blobs));
            }
            let mut cle = Cle::new();
            for (k, c) in cles.iter().enumerate() {
                let rendu = tous.iter().find(|x| &x.nom == c).map_or(Rendu::Brut, |x| x.type_champ.rendu());
                cle.insert(c.clone(), sql_vers_json(l.get_ref(affiches.len() + k)?, rendu, true));
            }
            lignes.push(ligne);
            if !cles.is_empty() {
                cles_lignes.push(cle);
            }
        }
        Ok(PageLignes {
            colonnes: affiches
                .iter()
                .map(|c| ColonneResultat {
                    nom: c.nom.clone(),
                    type_champ: Some(c.type_champ),
                    rendu: c.type_champ.rendu(),
                    legende: c.proprietes.legende.clone(),
                })
                .collect(),
            lignes,
            cles: cles_lignes,
            total,
            page: options.page,
            taille_page: taille,
            nb_pages: (total.max(0) as u64).div_ceil(taille),
            modifiable: !est_vue && !self.est_lecture_seule(),
        })
    }

    fn condition_cle(&self, table: &str, champs: &[ChampSchema], cle: &Cle) -> Resultat<(String, Vec<SqlValue>)> {
        let colonnes = self.colonnes_cle(table, champs)?;
        if colonnes.is_empty() {
            return Err(ErreurBase::msg("Cette table n'a pas de clé : enregistrement non modifiable."));
        }
        let mut conditions = Vec::new();
        let mut params = Vec::new();
        for col in &colonnes {
            let (nom_json, v) = cle
                .iter()
                .find(|(k, _)| k.eq_ignore_ascii_case(col))
                .ok_or_else(|| ErreurBase::msg(format!("Clé incomplète : « {col} » manquant.")))?;
            if col == "rowid" {
                conditions.push("rowid = ?".to_string());
                params.push(SqlValue::Integer(v.as_i64().ok_or_else(|| ErreurBase::msg(format!("Clé « {nom_json} » invalide.")))?));
            } else {
                let c = trouver(champs, col)?;
                conditions.push(format!("{} = ?", guillemets(&c.nom)));
                params.push(convertir(c, v)?);
            }
        }
        Ok((conditions.join(" AND "), params))
    }

    fn preparer_valeurs(champs: &[ChampSchema], valeurs: &Map<String, Json>, insertion: bool) -> Resultat<Vec<(String, SqlValue)>> {
        let mut sortie = Vec::with_capacity(valeurs.len());
        for (nom, v) in valeurs {
            let c = trouver(champs, nom)?;
            if c.genere || c.type_champ == TypeChamp::Calcule {
                return Err(ErreurBase::Validation { champ: c.nom.clone(), message: "champ calculé : lecture seule.".into() });
            }
            if insertion && c.type_champ == TypeChamp::NumeroAuto && v.is_null() {
                continue;
            }
            let mut valeur = convertir(c, v)?;
            if let (Some(masque), SqlValue::Text(t)) = (c.proprietes.masque_saisie.as_deref(), &valeur) {
                if !masque.trim().is_empty() {
                    let t = appliquer_masque(masque, t).map_err(|message| ErreurBase::Validation { champ: c.nom.clone(), message })?;
                    valeur = SqlValue::Text(t);
                }
            }
            sortie.push((c.nom.clone(), valeur));
        }
        Ok(sortie)
    }

    /// Lit un enregistrement par sa cle (champ -> valeur), `None` s'il n'existe pas.
    pub fn lire_ligne(&self, table: &str, cle: &Cle) -> Resultat<Option<Map<String, Json>>> {
        let (nom, _) = self.nom_source(table)?;
        let champs = self.champs(&nom)?;
        let (condition, params) = self.condition_cle(&nom, &champs, cle)?;
        let cols: Vec<String> = champs.iter().map(|c| guillemets(&c.nom)).collect();
        let mut stmt = self.conn().prepare(&format!("SELECT {} FROM {} WHERE {condition}", cols.join(", "), guillemets(&nom)))?;
        let mut lignes = stmt.query(params_from_iter(params.iter()))?;
        let Some(l) = lignes.next()? else { return Ok(None) };
        let mut sortie = Map::new();
        for (i, c) in champs.iter().enumerate() {
            sortie.insert(c.nom.clone(), sql_vers_json(l.get_ref(i)?, c.type_champ.rendu(), true));
        }
        Ok(Some(sortie))
    }

    /// Insere un enregistrement ; renvoie sa cle.
    pub fn inserer_ligne(&self, table: &str, valeurs: &Map<String, Json>) -> Resultat<Cle> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let champs = self.champs(&nom)?;
        let paires = Self::preparer_valeurs(&champs, valeurs, true)?;
        let q = guillemets(&nom);
        let sql = if paires.is_empty() {
            format!("INSERT INTO {q} DEFAULT VALUES")
        } else {
            let cols: Vec<String> = paires.iter().map(|(c, _)| guillemets(c)).collect();
            format!("INSERT INTO {q} ({}) VALUES ({})", cols.join(", "), vec!["?"; paires.len()].join(", "))
        };
        self.conn().execute(&sql, params_from_iter(paires.iter().map(|(_, v)| v)))?;
        let colonnes = self.colonnes_cle(&nom, &champs)?;
        let mut cle = Cle::new();
        if colonnes == ["rowid"] {
            cle.insert("rowid".into(), Json::from(self.conn().last_insert_rowid()));
        } else if self.a_rowid(&nom)? {
            let cols: Vec<String> = colonnes.iter().map(|c| guillemets(c)).collect();
            let rowid = self.conn().last_insert_rowid();
            let mut stmt = self.conn().prepare(&format!("SELECT {} FROM {q} WHERE rowid = ?1", cols.join(", ")))?;
            let mut l = stmt.query([rowid])?;
            if let Some(l) = l.next()? {
                for (i, c) in colonnes.iter().enumerate() {
                    let rendu = trouver(&champs, c)?.type_champ.rendu();
                    cle.insert(c.clone(), sql_vers_json(l.get_ref(i)?, rendu, true));
                }
            }
        } else {
            for c in &colonnes {
                if let Some((_, v)) = valeurs.iter().find(|(k, _)| k.eq_ignore_ascii_case(c)) {
                    cle.insert(c.clone(), v.clone());
                }
            }
        }
        Ok(cle)
    }

    /// Insere plusieurs enregistrements (tout ou rien) ; renvoie leur nombre.
    pub fn inserer_lignes(&self, table: &str, lignes: &[Map<String, Json>]) -> Resultat<usize> {
        self.atomique(|| {
            for (i, l) in lignes.iter().enumerate() {
                self.inserer_ligne(table, l).map_err(|e| ErreurBase::msg(format!("Ligne {} : {e}", i + 1)))?;
            }
            Ok(lignes.len())
        })
    }

    /// Modifie un enregistrement designe par sa cle.
    pub fn modifier_ligne(&self, table: &str, cle: &Cle, valeurs: &Map<String, Json>) -> Resultat<()> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let champs = self.champs(&nom)?;
        let paires = Self::preparer_valeurs(&champs, valeurs, false)?;
        if paires.is_empty() {
            return Ok(());
        }
        let (condition, params_cle) = self.condition_cle(&nom, &champs, cle)?;
        let affectations: Vec<String> = paires.iter().map(|(c, _)| format!("{} = ?", guillemets(c))).collect();
        let params: Vec<&SqlValue> = paires.iter().map(|(_, v)| v).chain(params_cle.iter()).collect();
        let n = self.conn().execute(
            &format!("UPDATE {} SET {} WHERE {condition}", guillemets(&nom), affectations.join(", ")),
            params_from_iter(params),
        )?;
        if n == 0 {
            return Err(ErreurBase::msg("Enregistrement introuvable : il a peut-être été supprimé."));
        }
        Ok(())
    }

    /// Supprime un enregistrement designe par sa cle.
    pub fn supprimer_ligne(&self, table: &str, cle: &Cle) -> Resultat<()> {
        if self.supprimer_lignes(table, std::slice::from_ref(cle))? == 0 {
            return Err(ErreurBase::msg("Enregistrement introuvable : il a peut-être été supprimé."));
        }
        Ok(())
    }

    /// Supprime plusieurs enregistrements (tout ou rien) ; renvoie le nombre supprime.
    pub fn supprimer_lignes(&self, table: &str, cles: &[Cle]) -> Resultat<usize> {
        self.exiger_ecriture()?;
        let nom = self.nom_table(table)?;
        let champs = self.champs(&nom)?;
        self.atomique(|| {
            let mut total = 0;
            for cle in cles {
                let (condition, params) = self.condition_cle(&nom, &champs, cle)?;
                total += self.conn().execute(&format!("DELETE FROM {} WHERE {condition}", guillemets(&nom)), params_from_iter(params.iter()))?;
            }
            Ok(total)
        })
    }

    /// Valeurs distinctes d'un champ (liste du menu de filtre), triees.
    pub fn valeurs_distinctes(&self, table: &str, champ: &str, limite: usize) -> Resultat<Vec<Json>> {
        let (nom, _) = self.nom_source(table)?;
        let champs = self.champs(&nom)?;
        let c = trouver(&champs, champ)?;
        let collation = if c.type_champ.est_texte() { " COLLATE FR" } else { "" };
        let q = guillemets(&c.nom);
        let mut stmt = self.conn().prepare(&format!(
            "SELECT DISTINCT {q} FROM {} ORDER BY {q}{collation} LIMIT ?1",
            guillemets(&nom)
        ))?;
        let limite = limite.clamp(1, 100_000) as i64;
        let mut lignes = stmt.query([limite])?;
        let mut sortie = Vec::new();
        while let Some(l) = lignes.next()? {
            sortie.push(sql_vers_json(l.get_ref(0)?, c.type_champ.rendu(), false));
        }
        Ok(sortie)
    }

    /// Ligne Total : calcule une fonction sur un champ, avec les filtres d'une lecture.
    pub fn total(&self, table: &str, champ: &str, fonction: FonctionTotal, options: &OptionsLecture) -> Resultat<Json> {
        let (nom, _) = self.nom_source(table)?;
        let champs = self.champs(&nom)?;
        let c = trouver(&champs, champ)?;
        let q = guillemets(&c.nom);
        let expr = match fonction {
            FonctionTotal::Somme => format!("total({q})"),
            FonctionTotal::Moyenne => format!("avg({q})"),
            FonctionTotal::Compte => format!("count({q})"),
            FonctionTotal::Min => format!("min({q})"),
            FonctionTotal::Max => format!("max({q})"),
            FonctionTotal::Variance => format!("((sum({q}*{q}) - sum({q})*sum({q})/count({q})) / (count({q}) - 1))"),
            FonctionTotal::EcartType => format!("fo_racine((sum({q}*{q}) - sum({q})*sum({q})/count({q})) / (count({q}) - 1))"),
        };
        let (filtre, params) = clause_where(&champs, options)?;
        let ou = if filtre.is_empty() { String::new() } else { format!(" WHERE {filtre}") };
        let rendu = match fonction {
            FonctionTotal::Min | FonctionTotal::Max => c.type_champ.rendu(),
            _ => Rendu::Nombre,
        };
        let mut stmt = self.conn().prepare(&format!("SELECT {expr} FROM {}{ou}", guillemets(&nom)))?;
        let mut l = stmt.query(params_from_iter(params.iter()))?;
        match l.next()? {
            Some(l) => Ok(sql_vers_json(l.get_ref(0)?, rendu, false)),
            None => Ok(Json::Null),
        }
    }

    /// Rechercher / Remplacer tout dans un champ texte ; renvoie le nombre d'enregistrements modifies.
    pub fn remplacer_tout(&self, table: &str, champ: &str, chercher: &str, remplacer: &str, respecter_casse: bool) -> Resultat<usize> {
        self.exiger_ecriture()?;
        if chercher.is_empty() {
            return Err(ErreurBase::msg("Le texte à rechercher est vide."));
        }
        let nom = self.nom_table(table)?;
        let champs = self.champs(&nom)?;
        let c = trouver(&champs, champ)?;
        if !c.type_champ.est_texte() {
            return Err(ErreurBase::Validation { champ: c.nom.clone(), message: "le remplacement ne s'applique qu'aux champs texte.".into() });
        }
        let q = guillemets(&c.nom);
        let t = guillemets(&nom);
        let mut stmt = self.conn().prepare(&format!("SELECT rowid, {q} FROM {t} WHERE {q} IS NOT NULL"))?;
        let lignes = stmt
            .query_map([], |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        let a_changer: Vec<(i64, String)> = lignes
            .into_iter()
            .filter_map(|(id, v)| remplacer_texte(&v, chercher, remplacer, respecter_casse).map(|n| (id, n)))
            .collect();
        self.atomique(|| {
            for (id, v) in &a_changer {
                self.conn().execute(&format!("UPDATE {t} SET {q} = ?1 WHERE rowid = ?2"), rusqlite::params![v, id])?;
            }
            Ok(a_changer.len())
        })
    }
}

/// Remplace toutes les occurrences (insensible a la casse si demande) ; `None` si rien ne change.
fn remplacer_texte(texte: &str, chercher: &str, remplacer: &str, respecter_casse: bool) -> Option<String> {
    if respecter_casse {
        return texte.contains(chercher).then(|| texte.replace(chercher, remplacer));
    }
    let cible: Vec<char> = chercher.chars().flat_map(char::to_lowercase).collect();
    let n = chercher.chars().count();
    let car: Vec<char> = texte.chars().collect();
    let mut sortie = String::with_capacity(texte.len());
    let (mut i, mut trouve) = (0, false);
    while i < car.len() {
        if i + n <= car.len() && car[i..i + n].iter().flat_map(|c| c.to_lowercase()).eq(cible.iter().copied()) {
            sortie.push_str(remplacer);
            i += n;
            trouve = true;
        } else {
            sortie.push(car[i]);
            i += 1;
        }
    }
    trouve.then_some(sortie)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remplacement_insensible_a_la_casse() {
        assert_eq!(remplacer_texte("Rue de PARIS, paris", "paris", "Lyon", false).as_deref(), Some("Rue de Lyon, Lyon"));
        assert_eq!(remplacer_texte("Été", "été", "hiver", false).as_deref(), Some("hiver"));
        assert_eq!(remplacer_texte("abc", "x", "y", false), None);
        assert_eq!(remplacer_texte("Paris paris", "paris", "Lyon", true).as_deref(), Some("Paris Lyon"));
    }

    #[test]
    fn tri_par_defaut() {
        let t = tri_defaut("Nom, [Prix] DESC");
        assert_eq!(t, vec![Tri { champ: "Nom".into(), descendant: false }, Tri { champ: "Prix".into(), descendant: true }]);
    }
}
