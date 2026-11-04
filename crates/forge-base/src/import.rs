//! Donnees externes : import CSV ou lignes de classeur (avec deduction des types), export CSV et JSON.

use std::collections::HashMap;
use std::path::Path;
use std::time::Duration;

use rusqlite::params_from_iter;
use rusqlite::types::Value as SqlValue;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value as Json};

use crate::base::Base;
use crate::csv::{analyser, cellule, decoder, deviner_separateur, OptionsExport, TAILLE_MAX};
use crate::erreur::{ErreurBase, Resultat};
use crate::ident::{assainir_nom, guillemets, noms_uniques, valider_nom};
use crate::masque::appliquer_masque;
use crate::sql::{OptionsSql, Parametres, ResultatSql};

use crate::structure::DefinitionTable;
use crate::types::{ChampSchema, DefinitionChamp, ProprietesChamp, Rendu, TypeChamp};
use crate::valeurs::{analyser_date, analyser_nombre, json_vers_sql};

/// Un export lit tout (sans limite de lignes) mais reste borne dans le temps (10 min).
const OPTIONS_EXPORT: OptionsSql = OptionsSql { limite: usize::MAX, delai: Some(Duration::from_secs(600)) };

/// Nombre maximal d'erreurs detaillees dans un rapport.
const ERREURS_MAX: usize = 1000;

/// Que faire de la table de destination.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ModeImport {
    /// Creer une nouvelle table (types deduits).
    #[default]
    CreerTable,
    /// Ajouter a une table existante.
    Ajouter,
    /// Vider la table existante puis importer.
    Remplacer,
}

/// Options d'import.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(default)]
pub struct OptionsImport {
    /// Separateur (devine si absent).
    pub separateur: Option<char>,
    /// Separateur decimal (devine si absent : `,` quand le separateur est `;`).
    pub decimale: Option<char>,
    /// Premiere ligne = noms de champs.
    pub entete: bool,
    /// Mode.
    pub mode: ModeImport,
    /// Types imposes par nom de colonne.
    pub types: HashMap<String, TypeChamp>,
    /// Champ cle primaire (creation).
    pub cle_primaire: Option<String>,
    /// Ajouter une cle NumeroAuto « N° » (creation, sans cle choisie).
    pub ajouter_numero_auto: bool,
    /// Lignes a ignorer avant l'en-tete.
    pub lignes_ignorees: usize,
    /// Annuler tout a la premiere erreur (sinon les lignes fautives sont listees).
    pub arreter_sur_erreur: bool,
}

impl Default for OptionsImport {
    fn default() -> Self {
        Self {
            separateur: None,
            decimale: None,
            entete: true,
            mode: ModeImport::CreerTable,
            types: HashMap::new(),
            cle_primaire: None,
            ajouter_numero_auto: false,
            lignes_ignorees: 0,
            arreter_sur_erreur: false,
        }
    }
}

/// Ligne refusee a l'import.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct ErreurLigne {
    /// Numero de ligne dans la source (1 = premiere ligne de donnees).
    pub ligne: usize,
    /// Raison.
    pub message: String,
}

/// Compte rendu d'import.
#[derive(Serialize, Clone, Debug, PartialEq)]
pub struct RapportImport {
    /// Table de destination.
    pub table: String,
    /// Lignes de donnees lues.
    pub lignes_lues: usize,
    /// Lignes importees.
    pub lignes_importees: usize,
    /// Lignes refusees (1 000 au plus detaillees).
    pub erreurs: Vec<ErreurLigne>,
    /// Nombre total de lignes refusees.
    pub nb_erreurs: usize,
    /// Champs crees (mode creation).
    pub champs_crees: Vec<DefinitionChamp>,
}

/// Source d'un export.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "genre", rename_all = "snake_case")]
pub enum SourceExport {
    /// Table ou vue.
    Table {
        /// Nom.
        nom: String,
    },
    /// Requete enregistree.
    Requete {
        /// Nom.
        nom: String,
    },
    /// SQL libre.
    Sql {
        /// Instruction SELECT.
        sql: String,
        /// Parametres.
        #[serde(default)]
        parametres: Parametres,
    },
}

fn entier_texte(s: &str) -> bool {
    let chiffres = s.strip_prefix(['-', '+']).unwrap_or(s);
    !chiffres.is_empty()
        && chiffres.len() <= 18
        && chiffres.bytes().all(|b| b.is_ascii_digit())
        && (chiffres == "0" || !chiffres.starts_with('0'))
}

fn nombre_texte(s: &str, decimale: Option<char>) -> bool {
    let t = s.trim();
    let premier_ok = t.chars().next().is_some_and(|c| c.is_ascii_digit() || matches!(c, '-' | '+' | ',' | '.'));
    let entier_zero = t.len() > 1 && t.starts_with('0') && t.chars().nth(1).is_some_and(|c| c.is_ascii_digit());
    premier_ok && !entier_zero && !t.contains('/') && t.matches('-').count() <= 1 && analyser_nombre(t, decimale).is_some()
}

/// Deduit le type d'une colonne a partir de ses valeurs.
pub fn deduire_type<'a>(valeurs: impl Iterator<Item = &'a Json>, decimale: Option<char>) -> (TypeChamp, Option<u32>) {
    let (mut entiers, mut nombres, mut dates, mut booleens, mut monnaie, mut vide) = (true, true, true, true, false, true);
    let mut longueur = 0usize;
    let mut grand = false;
    for v in valeurs {
        match v {
            Json::Null => continue,
            Json::String(s) if s.trim().is_empty() => continue,
            Json::Bool(_) => {
                (entiers, nombres, dates) = (false, false, false);
            }
            Json::Number(n) => {
                booleens = false;
                dates = false;
                match n.as_i64() {
                    Some(i) => grand |= i32::try_from(i).is_err(),
                    None => entiers = false,
                }
            }
            Json::String(s) => {
                let t = s.trim();
                longueur = longueur.max(t.chars().count());
                booleens &= matches!(t.to_lowercase().as_str(), "oui" | "non" | "vrai" | "faux" | "true" | "false" | "yes" | "no");
                if entier_texte(t) {
                    grand |= t.parse::<i32>().is_err();
                } else {
                    entiers = false;
                }
                let est_nombre = nombre_texte(t, decimale);
                monnaie |= est_nombre && t.contains('€');
                nombres &= est_nombre;
                dates &= !entier_texte(t) && (t.contains('/') || t.contains('-') || t.contains(':')) && analyser_date(t).is_some();
            }
            _ => {
                (entiers, nombres, dates, booleens) = (false, false, false, false);
                longueur = longueur.max(v.to_string().chars().count());
            }
        }
        vide = false;
    }
    if vide {
        return (TypeChamp::TexteCourt, Some(255));
    }
    let t = if booleens {
        TypeChamp::OuiNon
    } else if entiers {
        if grand { TypeChamp::GrandEntier } else { TypeChamp::EntierLong }
    } else if nombres {
        if monnaie { TypeChamp::Monetaire } else { TypeChamp::ReelDouble }
    } else if dates {
        TypeChamp::DateHeure
    } else if longueur > 255 {
        TypeChamp::TexteLong
    } else {
        TypeChamp::TexteCourt
    };
    (t, (t == TypeChamp::TexteCourt).then_some(255))
}

fn json_vers_texte(v: &Json, rendu: Rendu, o: &OptionsExport) -> (String, bool) {
    match v {
        Json::Null => (String::new(), false),
        Json::Bool(b) => (if o.oui_non { if *b { "Oui" } else { "Non" } } else if *b { "1" } else { "0" }.to_string(), false),
        Json::Number(n) => (n.to_string().replace('.', &o.decimale.to_string()), false),
        Json::String(s) if rendu == Rendu::Date && o.dates_francaises => {
            let d = s.replace('T', " ");
            let texte = match (d.get(0..4), d.get(5..7), d.get(8..10)) {
                (Some(a), Some(m), Some(j)) if d.len() >= 10 && d.as_bytes()[4] == b'-' => {
                    let heure = d.get(11..).filter(|h| !h.is_empty() && *h != "00:00:00").map(|h| format!(" {h}")).unwrap_or_default();
                    format!("{j}/{m}/{a}{heure}")
                }
                _ => s.clone(),
            };
            (texte, false)
        }
        Json::String(s) => (s.clone(), true),
        Json::Object(o) => (o.get("base64").and_then(Json::as_str).unwrap_or_default().to_string(), false),
        Json::Array(_) => (v.to_string(), true),
    }
}

impl Base {
    /// Importe un texte CSV.
    pub fn importer_csv(&self, table: &str, texte: &str, options: &OptionsImport) -> Resultat<RapportImport> {
        let sep = options.separateur.unwrap_or_else(|| deviner_separateur(texte));
        let mut lignes = analyser(texte, sep).into_iter().skip(options.lignes_ignorees);
        let entetes: Vec<String> = if options.entete {
            lignes.next().ok_or_else(|| ErreurBase::Csv("le fichier est vide.".into()))?
        } else {
            Vec::new()
        };
        let mut o = options.clone();
        if o.decimale.is_none() && sep != ',' {
            o.decimale = Some(',');
        }
        let donnees: Vec<Vec<Json>> = lignes
            .filter(|l| l.iter().any(|c| !c.trim().is_empty()))
            .map(|l| l.into_iter().map(Json::String).collect())
            .collect();
        self.importer_lignes(table, &entetes, &donnees, &o)
    }

    /// Importe un fichier CSV (encodage detecte, 512 Mio au plus).
    pub fn importer_fichier_csv(&self, table: &str, chemin: impl AsRef<Path>, options: &OptionsImport) -> Resultat<RapportImport> {
        let chemin = chemin.as_ref();
        let taille = std::fs::metadata(chemin)?.len();
        if taille > TAILLE_MAX as u64 {
            return Err(ErreurBase::Csv("fichier trop volumineux (512 Mio maximum).".into()));
        }
        let octets = std::fs::read(chemin)?;
        self.importer_csv(table, &decoder(&octets), options)
    }

    /// Importe des lignes (feuille de classeur, presse-papiers). Valeurs JSON : nombres,
    /// textes, booleens, dates ISO ou francaises ; en-tetes vides = `Champ1`, `Champ2`...
    pub fn importer_lignes(&self, table: &str, entetes: &[String], lignes: &[Vec<Json>], options: &OptionsImport) -> Resultat<RapportImport> {
        self.exiger_ecriture()?;
        let largeur = lignes.iter().map(Vec::len).max().unwrap_or(0).max(entetes.len());
        if largeur == 0 {
            return Err(ErreurBase::Csv("aucune colonne à importer.".into()));
        }
        let mut champs_crees = Vec::new();
        let (nom, champs, colonnes): (String, Vec<ChampSchema>, Vec<Option<usize>>) = match options.mode {
            ModeImport::CreerTable => {
                let nom = valider_nom(table)?;
                if self.nom_pris(&nom)? {
                    return Err(ErreurBase::ExisteDeja(nom));
                }
                let noms = noms_uniques((0..largeur).map(|i| assainir_nom(entetes.get(i).map_or("", String::as_str), i)).collect());
                let mut defs: Vec<DefinitionChamp> = Vec::new();
                let ajoute = options.ajouter_numero_auto && options.cle_primaire.is_none() && !noms.iter().any(|n| n.eq_ignore_ascii_case("N°"));
                if ajoute {
                    defs.push(DefinitionChamp::nouveau("N°", TypeChamp::NumeroAuto));
                }
                for (i, n) in noms.iter().enumerate() {
                    let (t, taille) = match options.types.iter().find(|(k, _)| k.eq_ignore_ascii_case(n)) {
                        Some((_, t)) => (*t, None),
                        None => deduire_type(lignes.iter().filter_map(|l| l.get(i)), options.decimale),
                    };
                    let mut d = DefinitionChamp::nouveau(n, t);
                    d.cle_primaire = options.cle_primaire.as_deref().is_some_and(|c| c.eq_ignore_ascii_case(n));
                    d.proprietes = ProprietesChamp { taille, ..Default::default() };
                    defs.push(d);
                }
                self.creer_table(&DefinitionTable { nom: nom.clone(), champs: defs.clone(), proprietes: Default::default() })?;
                champs_crees = defs;
                let champs = self.champs(&nom)?;
                let decalage = usize::from(ajoute);
                (nom, champs, (0..largeur).map(|i| Some(i + decalage)).collect())
            }
            ModeImport::Ajouter | ModeImport::Remplacer => {
                let nom = self.nom_table(table)?;
                let champs = self.champs(&nom)?;
                let colonnes = if entetes.is_empty() {
                    let ecrivables: Vec<usize> = champs
                        .iter()
                        .enumerate()
                        .filter(|(_, c)| !c.genere && (c.type_champ != TypeChamp::NumeroAuto || champs.len() == largeur))
                        .map(|(i, _)| i)
                        .collect();
                    (0..largeur).map(|i| ecrivables.get(i).copied()).collect()
                } else {
                    let mut cols = Vec::new();
                    let mut inconnues = Vec::new();
                    for e in entetes {
                        match champs.iter().position(|c| c.nom.eq_ignore_ascii_case(e.trim())) {
                            Some(p) => cols.push(Some(p)),
                            None if e.trim().is_empty() => cols.push(None),
                            None => {
                                inconnues.push(e.trim().to_string());
                                cols.push(None);
                            }
                        }
                    }
                    if !inconnues.is_empty() {
                        return Err(ErreurBase::Csv(format!("colonnes absentes de « {nom} » : {}.", inconnues.join(", "))));
                    }
                    cols
                };
                (nom, champs, colonnes)
            }
        };
        let rapport = self.atomique(|| {
            if options.mode == ModeImport::Remplacer {
                self.conn().execute(&format!("DELETE FROM {}", guillemets(&nom)), [])?;
            }
            self.inserer_import(&nom, &champs, &colonnes, lignes, options)
        });
        match rapport {
            Ok(mut r) => {
                r.champs_crees = champs_crees;
                Ok(r)
            }
            Err(e) => {
                if options.mode == ModeImport::CreerTable && !self.en_transaction() {
                    self.supprimer_table(&nom, true)?;
                }
                Err(e)
            }
        }
    }

    fn inserer_import(&self, nom: &str, champs: &[ChampSchema], colonnes: &[Option<usize>], lignes: &[Vec<Json>], options: &OptionsImport) -> Resultat<RapportImport> {
        let cibles: Vec<(usize, usize)> = colonnes.iter().enumerate().filter_map(|(i, c)| c.map(|c| (i, c))).collect();
        let noms: Vec<String> = cibles.iter().map(|(_, c)| guillemets(&champs[*c].nom)).collect();
        let sql = format!("INSERT INTO {} ({}) VALUES ({})", guillemets(nom), noms.join(", "), vec!["?"; cibles.len()].join(", "));
        let mut stmt = self.conn().prepare(&sql)?;
        let mut rapport = RapportImport { table: nom.to_string(), lignes_lues: lignes.len(), lignes_importees: 0, erreurs: Vec::new(), nb_erreurs: 0, champs_crees: Vec::new() };
        for (n, ligne) in lignes.iter().enumerate() {
            let valeurs: Result<Vec<SqlValue>, String> = cibles
                .iter()
                .map(|(i, c)| {
                    let champ = &champs[*c];
                    // cellule vide = Null (comme Access) : « Requis » s'applique.
                    let v = ligne.get(*i).filter(|v| !matches!(v, Json::String(s) if s.is_empty())).unwrap_or(&Json::Null);
                    let mut s = json_vers_sql(v, Some(champ.type_champ), Some(&champ.proprietes), options.decimale)
                        .map_err(|m| format!("« {} » : {m}", champ.nom))?;
                    if let (Some(m), SqlValue::Text(t)) = (champ.proprietes.masque_saisie.as_deref().filter(|m| !m.trim().is_empty()), &s) {
                        s = SqlValue::Text(appliquer_masque(m, t).map_err(|e| format!("« {} » : {e}", champ.nom))?);
                    }
                    Ok(s)
                })
                .collect();
            let resultat = valeurs.and_then(|v| stmt.execute(params_from_iter(v.iter())).map_err(|e| ErreurBase::from(e).to_string()));
            match resultat {
                Ok(_) => rapport.lignes_importees += 1,
                Err(message) => {
                    if options.arreter_sur_erreur {
                        return Err(ErreurBase::Csv(format!("ligne {} : {message}", n + 1)));
                    }
                    rapport.nb_erreurs += 1;
                    if rapport.erreurs.len() < ERREURS_MAX {
                        rapport.erreurs.push(ErreurLigne { ligne: n + 1, message });
                    }
                }
            }
        }
        Ok(rapport)
    }

    fn resultat_export(&self, source: &SourceExport) -> Resultat<ResultatSql> {
        match source {
            SourceExport::Table { nom } => {
                let (nom, _) = self.nom_source(nom)?;
                let champs = self.champs(&nom)?;
                let cols: Vec<String> = champs.iter().map(|c| guillemets(&c.nom)).collect();
                let mut r = self.executer_sql_options(&format!("SELECT {} FROM {}", cols.join(", "), guillemets(&nom)), &Parametres::aucun(), &OPTIONS_EXPORT)?;
                for (col, c) in r.colonnes.iter_mut().zip(&champs) {
                    col.type_champ = Some(c.type_champ);
                    col.rendu = c.type_champ.rendu();
                }
                Ok(r)
            }
            SourceExport::Requete { nom } => {
                let req = self.lire_requete(nom)?;
                if req.genre.est_action() {
                    return Err(ErreurBase::msg("Une requête action ne peut pas être exportée."));
                }
                let sql = if req.sql.is_empty() {
                    self.generer_sql(&serde_json::from_value(req.definition.unwrap_or(Json::Null))?)?.sql
                } else {
                    req.sql
                };
                self.executer_sql_options(&sql, &Parametres::aucun(), &OPTIONS_EXPORT)
            }
            SourceExport::Sql { sql, parametres } => self.executer_sql_options(sql, parametres, &OPTIONS_EXPORT),
        }
    }

    /// Exporte en texte CSV.
    pub fn exporter_csv(&self, source: &SourceExport, options: &OptionsExport) -> Resultat<String> {
        let r = self.resultat_export(source)?;
        let fin = if options.crlf { "\r\n" } else { "\n" };
        let sep = options.separateur.to_string();
        let mut sortie = String::new();
        if options.bom {
            sortie.push('\u{feff}');
        }
        if options.entete {
            let titres: Vec<String> = r.colonnes.iter().map(|c| cellule(&c.nom, options, false)).collect();
            sortie.push_str(&titres.join(&sep));
            sortie.push_str(fin);
        }
        for ligne in &r.lignes {
            let cellules: Vec<String> = ligne
                .iter()
                .zip(&r.colonnes)
                .map(|(v, c)| {
                    let (t, est_texte) = json_vers_texte(v, c.rendu, options);
                    cellule(&t, options, est_texte)
                })
                .collect();
            sortie.push_str(&cellules.join(&sep));
            sortie.push_str(fin);
        }
        Ok(sortie)
    }

    /// Exporte dans un fichier CSV (UTF-8).
    pub fn exporter_fichier_csv(&self, source: &SourceExport, chemin: impl AsRef<Path>, options: &OptionsExport) -> Resultat<()> {
        let texte = self.exporter_csv(source, options)?;
        std::fs::write(chemin, texte.as_bytes())?;
        Ok(())
    }

    /// Exporte en JSON : tableau d'objets `{ champ: valeur }`.
    pub fn exporter_json(&self, source: &SourceExport) -> Resultat<Json> {
        let r = self.resultat_export(source)?;
        Ok(Json::Array(
            r.lignes
                .into_iter()
                .map(|l| Json::Object(r.colonnes.iter().map(|c| c.nom.clone()).zip(l).collect::<Map<String, Json>>()))
                .collect(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn deduction_des_types() {
        let v = |l: &[Json]| deduire_type(l.iter(), Some(','));
        assert_eq!(v(&[json!("1"), json!("25"), json!("")]).0, TypeChamp::EntierLong);
        assert_eq!(v(&[json!("1,5"), json!("2")]).0, TypeChamp::ReelDouble);
        assert_eq!(v(&[json!("12,50 €")]).0, TypeChamp::Monetaire);
        assert_eq!(v(&[json!("31/12/2024"), json!("01/01/2025")]).0, TypeChamp::DateHeure);
        assert_eq!(v(&[json!("Oui"), json!("Non")]).0, TypeChamp::OuiNon);
        assert_eq!(v(&[json!("01234"), json!("75000")]).0, TypeChamp::TexteCourt);
        assert_eq!(v(&[json!("x".repeat(300))]).0, TypeChamp::TexteLong);
        assert_eq!(v(&[json!(3_000_000_000_i64)]).0, TypeChamp::GrandEntier);
        assert_eq!(v(&[json!(true), json!(false)]).0, TypeChamp::OuiNon);
    }
}
