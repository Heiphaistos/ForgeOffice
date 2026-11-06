//! Resultat de requete editable : une requete Selection du createur sur UNE table (sans jointure,
//! sans totaux) peut etre modifiee ligne par ligne. Le moteur renvoie `modifiable`, la
//! correspondance colonne du resultat -> table/champ et la cle de chaque ligne (les colonnes de
//! cle absentes de la requete sont ajoutees a l'execution puis retirees du resultat), pour que
//! l'interface ecrive par cle (`modifier_ligne_requete`).

use serde::Serialize;
use serde_json::{Map, Value as Json};

use crate::base::Base;
use crate::concepteur::{alias_access, ColonneRequete, DefinitionRequete, GenreRequete};
use crate::donnees::{trouver, Cle};
use crate::erreur::{ErreurBase, Resultat};
use crate::sql::{Parametres, ResultatSql};
use crate::types::{ChampSchema, TypeChamp};

/// Colonne du resultat qui vient d'un champ de la table.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct CorrespondanceColonne {
    /// Position dans `colonnes` du resultat.
    pub position: usize,
    /// Nom de la colonne du resultat.
    pub colonne: String,
    /// Table d'origine.
    pub table: String,
    /// Champ d'origine.
    pub champ: String,
    /// Ecriture possible (faux pour NuméroAuto et champs calcules).
    pub modifiable: bool,
}

/// Resultat d'une requete enregistree avec les informations d'edition.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ResultatRequeteEditable {
    /// Colonnes et lignes (les colonnes de cle ajoutees sont retirees).
    #[serde(flatten)]
    pub resultat: ResultatSql,
    /// Les lignes peuvent etre modifiees par cle.
    pub modifiable: bool,
    /// Pourquoi le resultat est en lecture seule.
    pub raison: Option<String>,
    /// Table ecrite quand `modifiable`.
    pub table: Option<String>,
    /// Colonnes issues de champs de la table (les expressions n'y figurent pas).
    pub correspondance: Vec<CorrespondanceColonne>,
    /// Cle de chaque ligne (champs de la cle primaire, sinon `rowid`).
    pub cles: Vec<Cle>,
}

struct Analyse {
    def: DefinitionRequete,
    table: String,
    correspondance: Vec<CorrespondanceColonne>,
    /// (champ de cle, position dans le resultat brut)
    cles: Vec<(String, usize)>,
    visibles: usize,
}

fn lecture_seule(raison: impl Into<String>) -> Resultat<Result<Analyse, String>> {
    Ok(Err(raison.into()))
}

/// Champ designe par une colonne simple (`Prix`, `[Prix]`), sinon `None` (expression).
fn champ_simple<'a>(champs: &'a [ChampSchema], brut: &str) -> Option<&'a ChampSchema> {
    let nom = brut.strip_prefix('[').and_then(|b| b.strip_suffix(']')).filter(|b| !b.contains(['[', ']'])).unwrap_or(brut);
    champs.iter().find(|c| c.nom.eq_ignore_ascii_case(nom.trim()))
}

impl Base {
    fn analyser_requete_editable(&self, nom: &str) -> Resultat<Result<Analyse, String>> {
        let r = self.lire_requete(nom)?;
        if r.genre != GenreRequete::Selection {
            return lecture_seule("seule une requête Sélection peut être modifiée.");
        }
        let Some(def_json) = r.definition.clone() else {
            return lecture_seule("requête écrite en SQL : seule une requête du créateur sur une table est modifiable.");
        };
        let mut def: DefinitionRequete = serde_json::from_value(def_json)?;
        if def.tables.len() != 1 || !def.jointures.is_empty() {
            return lecture_seule("la requête porte sur plusieurs tables (jointure).");
        }
        if def.colonnes.iter().any(|c| c.operation.is_some() || c.analyse.is_some()) {
            return lecture_seule("une requête de totaux ou d'analyse croisée n'est pas modifiable.");
        }
        let (table, est_vue) = self.nom_source(&def.tables[0].nom)?;
        if est_vue {
            return lecture_seule("la source est une requête ou une vue, pas une table.");
        }
        let champs = self.champs(&table)?;
        let reference = def.tables[0].alias.clone().unwrap_or_else(|| def.tables[0].nom.clone());
        // Correspondance des colonnes affichees (une colonne `*` donne tous les champs).
        let mut correspondance = Vec::new();
        let mut position = 0usize;
        let ecriture = |c: &ChampSchema| !c.genere && c.type_champ != TypeChamp::Calcule && c.type_champ != TypeChamp::NumeroAuto;
        for c in def.colonnes.iter().filter(|c| c.afficher) {
            let (alias_expr, brut) = alias_access(&c.champ);
            if brut == "*" {
                for champ in &champs {
                    correspondance.push(CorrespondanceColonne { position, colonne: champ.nom.clone(), table: table.clone(), champ: champ.nom.clone(), modifiable: ecriture(champ) });
                    position += 1;
                }
                continue;
            }
            if let Some(champ) = champ_simple(&champs, &brut) {
                let colonne = c.alias.clone().filter(|a| !a.trim().is_empty()).or(alias_expr).unwrap_or_else(|| champ.nom.clone());
                correspondance.push(CorrespondanceColonne { position, colonne, table: table.clone(), champ: champ.nom.clone(), modifiable: ecriture(champ) });
            }
            position += 1;
        }
        // Colonnes de cle : presentes dans la requete, sinon ajoutees a la fin.
        let visibles = position;
        let mut cles = Vec::new();
        for (k, cle) in self.colonnes_cle(&table, &champs)?.into_iter().enumerate() {
            match correspondance.iter().find(|m| m.champ.eq_ignore_ascii_case(&cle)) {
                Some(m) => cles.push((cle, m.position)),
                None => {
                    if def.distinct {
                        return lecture_seule("« Valeurs distinctes » sans les champs de clé : les lignes ne sont pas identifiables.");
                    }
                    def.colonnes.push(ColonneRequete {
                        champ: if cle == "rowid" { cle.clone() } else { format!("[{cle}]") },
                        table: Some(reference.clone()),
                        alias: Some(format!("__fo_cle_{k}")),
                        afficher: true,
                        tri: None,
                        criteres: Vec::new(),
                        operation: None,
                        mise_a_jour: None,
                        ajouter_a: None,
                        analyse: None,
                    });
                    cles.push((cle, visibles + k));
                }
            }
        }
        if cles.is_empty() {
            return lecture_seule("la table n'a pas de clé : les lignes ne sont pas identifiables.");
        }
        Ok(Ok(Analyse { def, table, correspondance, cles, visibles }))
    }

    /// Execute une requete enregistree en indiquant si son resultat est editable (voir le module).
    pub fn executer_requete_editable(&self, nom: &str, params: &Parametres) -> Resultat<ResultatRequeteEditable> {
        let analyse = match self.analyser_requete_editable(nom)? {
            Ok(a) => a,
            Err(raison) => {
                let resultat = self.executer_requete(nom, params)?;
                return Ok(ResultatRequeteEditable { resultat, modifiable: false, raison: Some(raison), table: None, correspondance: Vec::new(), cles: Vec::new() });
            }
        };
        let mut resultat = self.executer_definition(&analyse.def, params)?;
        let cles: Vec<Cle> = resultat
            .lignes
            .iter()
            .map(|l| analyse.cles.iter().map(|(champ, pos)| (champ.clone(), l.get(*pos).cloned().unwrap_or(Json::Null))).collect())
            .collect();
        resultat.colonnes.truncate(analyse.visibles);
        for l in &mut resultat.lignes {
            l.truncate(analyse.visibles);
        }
        let modifiable = !self.est_lecture_seule();
        Ok(ResultatRequeteEditable {
            resultat,
            modifiable,
            raison: (!modifiable).then(|| "la base est ouverte en lecture seule.".to_string()),
            table: Some(analyse.table),
            correspondance: analyse.correspondance,
            cles,
        })
    }

    /// Modifie une ligne d'une requete editable : `valeurs` est indexe par NOM DE COLONNE du
    /// resultat, `cle` est la cle renvoyee avec la ligne.
    pub fn modifier_ligne_requete(&self, nom: &str, cle: &Cle, valeurs: &Map<String, Json>) -> Resultat<()> {
        let analyse = self.analyser_requete_editable(nom)?.map_err(|r| ErreurBase::msg(format!("Cette requête est en lecture seule : {r}")))?;
        let mut ecrites = Map::new();
        for (colonne, v) in valeurs {
            let m = analyse
                .correspondance
                .iter()
                .find(|m| m.colonne.eq_ignore_ascii_case(colonne))
                .ok_or_else(|| ErreurBase::Validation { champ: colonne.clone(), message: "colonne calculée ou inconnue : lecture seule.".into() })?;
            if !m.modifiable {
                return Err(ErreurBase::Validation { champ: colonne.clone(), message: "champ calculé ou NuméroAuto : lecture seule.".into() });
            }
            let champs = self.champs(&analyse.table)?;
            ecrites.insert(trouver(&champs, &m.champ)?.nom.clone(), v.clone());
        }
        self.modifier_ligne(&analyse.table, cle, &ecrites)
    }
}
