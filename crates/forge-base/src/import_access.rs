//! Import d'un fichier Access `.mdb` / `.accdb` EN LECTURE : les tables sont lues par
//! `access_lecteur` (Rust pur, sans Access ni pilote) puis recreees dans la base ouverte
//! avec leurs types Access et leurs donnees. Index, relations, requetes, formulaires, etats et
//! macros du fichier source ne sont pas importes.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};
use std::path::Path;

use crate::access_lecteur::{lire_tables, lire_tables_choisies, ColonneAccess, TableAccess};
use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::valider_nom;
use crate::structure::DefinitionTable;
use crate::types::{DefinitionChamp, TypeChamp};

/// Taille maximale d'un fichier Access lu (512 Mio).
const FICHIER_MAX: u64 = 512 * 1024 * 1024;

/// Options d'import Access.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq)]
#[serde(default)]
pub struct OptionsImportAccess {
    /// Tables a importer (toutes si absent).
    pub tables: Option<Vec<String>>,
}

/// Table du fichier Access (apercu avant import).
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct TableAccessInfo {
    /// Nom dans le fichier Access.
    pub nom: String,
    /// Colonnes : nom, type Access propose et lisibilite.
    pub colonnes: Vec<ColonneAccessInfo>,
    /// Nombre de lignes lues.
    pub nb_lignes: usize,
}

/// Colonne d'une table Access.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ColonneAccessInfo {
    /// Nom.
    pub nom: String,
    /// Type propose (`None` si la colonne n'est pas lisible : binaire, OLE, decimal...).
    pub type_champ: Option<TypeChamp>,
}

/// Table importee.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct TableImportee {
    /// Nom dans le fichier Access.
    pub source: String,
    /// Nom dans la base (peut differer si le nom Access est invalide ici).
    pub nom: String,
    /// Lignes importees.
    pub lignes: usize,
}

/// Bilan d'un import Access.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct RapportImportAccess {
    /// Tables creees.
    pub tables: Vec<TableImportee>,
    /// Mises en garde (colonnes ignorees, noms corriges, lignes abimees...).
    pub avertissements: Vec<String>,
}

fn type_propose(c: &ColonneAccess) -> Option<TypeChamp> {
    Some(match c.type_code {
        1 => TypeChamp::OuiNon,
        2 => TypeChamp::Octet,
        3 => TypeChamp::Entier,
        4 if c.auto => TypeChamp::NumeroAuto,
        4 => TypeChamp::EntierLong,
        5 => TypeChamp::Monetaire,
        6 => TypeChamp::ReelSimple,
        7 => TypeChamp::ReelDouble,
        8 => TypeChamp::DateHeure,
        10 | 15 => TypeChamp::TexteCourt,
        12 => TypeChamp::TexteLong,
        19 => TypeChamp::GrandEntier,
        _ => return None,
    })
}

/// Nom valide dans cette base : caracteres interdits remplace par `_`, unique parmi `pris`.
fn nom_valide(brut: &str, pris: &[String]) -> String {
    let base: String = brut.chars().map(|c| if matches!(c, '.' | '!' | '`' | '[' | ']') || c.is_control() { '_' } else { c }).collect();
    let mut base = base.trim().chars().take(60).collect::<String>();
    if base.is_empty() || valider_nom(&base).is_err() {
        base = format!("T_{base}").trim_end_matches('_').to_string();
    }
    let (mut nom, mut n) = (base.clone(), 2);
    while pris.iter().any(|p| p.eq_ignore_ascii_case(&nom)) {
        nom = format!("{base} ({n})");
        n += 1;
    }
    nom
}

fn lire_fichier(chemin: &Path) -> Resultat<Vec<u8>> {
    let meta = std::fs::metadata(chemin).map_err(|e| ErreurBase::msg(format!("Fichier Access illisible : {e}")))?;
    if !meta.is_file() || meta.len() > FICHIER_MAX {
        return Err(ErreurBase::msg("Fichier Access invalide ou trop volumineux (512 Mo au plus)."));
    }
    std::fs::read(chemin).map_err(|e| ErreurBase::msg(format!("Fichier Access illisible : {e}")))
}

impl Base {
    /// Tables d'un fichier Access, sans rien importer (choix des tables a importer).
    pub fn lister_tables_access(&self, chemin: impl AsRef<Path>) -> Resultat<Vec<TableAccessInfo>> {
        let tables = lire_tables(&lire_fichier(chemin.as_ref())?)?;
        Ok(tables
            .into_iter()
            .map(|t| TableAccessInfo {
                nb_lignes: t.lignes.len(),
                colonnes: t.colonnes.iter().map(|c| ColonneAccessInfo { nom: c.nom.clone(), type_champ: type_propose(c) }).collect(),
                nom: t.nom,
            })
            .collect())
    }

    /// Importe les tables d'un fichier Access dans cette base.
    pub fn importer_access(&self, chemin: impl AsRef<Path>, options: &OptionsImportAccess) -> Resultat<RapportImportAccess> {
        self.importer_access_octets(&lire_fichier(chemin.as_ref())?, options)
    }

    /// Comme `importer_access`, depuis le contenu du fichier.
    pub fn importer_access_octets(&self, octets: &[u8], options: &OptionsImportAccess) -> Resultat<RapportImportAccess> {
        self.exiger_ecriture()?;
        let tables = match &options.tables {
            Some(noms) => lire_tables_choisies(octets, noms)?.into_iter().filter(|t| noms.iter().any(|n| n.eq_ignore_ascii_case(&t.nom))).collect(),
            None => lire_tables(octets)?,
        };
        if let Some(noms) = &options.tables {
            if let Some(absente) = noms.iter().find(|n| !tables.iter().any(|t: &TableAccess| t.nom.eq_ignore_ascii_case(n))) {
                return Err(ErreurBase::Introuvable(format!("table Access « {absente} »")));
            }
        }
        let mut rapport = RapportImportAccess { tables: Vec::new(), avertissements: Vec::new() };
        let mut crees: Vec<String> = Vec::new();
        for t in tables {
            match self.importer_table_access(&t, &mut rapport) {
                Ok(nom) => crees.push(nom),
                Err(e) => {
                    // Tout ou rien : les tables deja creees par cet import sont retirees.
                    for nom in crees.iter().rev() {
                        let _ = self.supprimer_table(nom, true);
                    }
                    return Err(ErreurBase::msg(format!("Import de la table « {} » impossible : {e}", t.nom)));
                }
            }
        }
        Ok(rapport)
    }

    fn importer_table_access(&self, t: &TableAccess, rapport: &mut RapportImportAccess) -> Resultat<String> {
        let existants = self.lister_tables()?;
        let pris: Vec<String> = existants.into_iter().chain(self.lister_vues()?).chain(rapport.tables.iter().map(|x| x.nom.clone())).collect();
        let nom = nom_valide(&t.nom, &pris);
        if nom != t.nom {
            rapport.avertissements.push(format!("La table « {} » est importée sous le nom « {nom} »{}.", t.nom, if pris.iter().any(|p| p.eq_ignore_ascii_case(&t.nom)) { " (ce nom existe déjà)" } else { "" }));
        }
        // Champs importables, noms rendus valides et uniques.
        let (mut champs, mut index_colonnes, mut noms): (Vec<DefinitionChamp>, Vec<usize>, Vec<String>) = (Vec::new(), Vec::new(), Vec::new());
        for (i, c) in t.colonnes.iter().enumerate() {
            let Some(type_champ) = type_propose(c) else {
                rapport.avertissements.push(format!("Colonne « {}.{} » ignorée : type Access non pris en charge (binaire, objet OLE, décimal ou pièce jointe).", t.nom, c.nom));
                continue;
            };
            let nom_champ = nom_valide(&c.nom, &noms);
            if nom_champ != c.nom {
                rapport.avertissements.push(format!("Colonne « {}.{} » renommée « {nom_champ} »{}.", t.nom, c.nom, ""));
            }
            let mut def = DefinitionChamp::nouveau(&nom_champ, type_champ);
            def.cle_primaire = type_champ == TypeChamp::NumeroAuto && !champs.iter().any(|d| d.cle_primaire);
            if type_champ == TypeChamp::NumeroAuto && !def.cle_primaire {
                def.type_champ = TypeChamp::EntierLong;
            }
            if type_champ == TypeChamp::TexteCourt {
                def.proprietes.taille = Some(if c.type_code == 15 { 38 } else { u32::from((c.taille / 2).clamp(1, 255)) });
            }
            noms.push(nom_champ);
            champs.push(def);
            index_colonnes.push(i);
        }
        if champs.is_empty() {
            return Err(ErreurBase::msg("aucune colonne importable."));
        }
        if t.ignorees > 0 {
            rapport.avertissements.push(format!("{} ligne(s) de « {} » abîmée(s) ou illisible(s) ont été ignorées.", t.ignorees, t.nom));
        }
        self.creer_table(&DefinitionTable { nom: nom.clone(), champs: champs.clone(), proprietes: Default::default() })?;
        let lignes: Vec<Map<String, Json>> = t
            .lignes
            .iter()
            .map(|l| {
                champs
                    .iter()
                    .zip(&index_colonnes)
                    .map(|(c, &i)| (c.nom.clone(), l.get(i).cloned().unwrap_or(Json::Null)))
                    .collect()
            })
            .collect();
        for lot in lignes.chunks(5_000) {
            if let Err(e) = self.inserer_lignes(&nom, lot) {
                let _ = self.supprimer_table(&nom, true);
                return Err(e);
            }
        }
        rapport.tables.push(TableImportee { source: t.nom.clone(), nom: nom.clone(), lignes: lignes.len() });
        Ok(nom)
    }
}
