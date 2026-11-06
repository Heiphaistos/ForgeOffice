//! Etats : regroupement sur plusieurs niveaux (definition et execution).
//!
//! La definition JSON porte `regroupements` (tableau, du niveau le plus externe au plus interne) ;
//! l'ancienne cle `regroupement` (un seul champ) reste lue. `executer_etat` renvoie les donnees
//! triees et regroupees en arbre, avec effectifs et sommes par groupe.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value as Json};

use crate::base::Base;
use crate::concepteur::SensTri;
use crate::donnees::{trouver, OptionsLecture, Tri};
use crate::erreur::{ErreurBase, Resultat};
use crate::schema::GenreObjet;

/// Niveaux de regroupement maximaux (comme Access).
pub const NIVEAUX_MAX: usize = 10;
/// Lignes lues au maximum pour executer un etat.
pub const LIMITE_LIGNES_ETAT: usize = 200_000;

/// Un niveau de regroupement d'etat.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Regroupement {
    /// Champ de regroupement.
    pub champ: String,
    /// Ordre des groupes.
    #[serde(default = "croissant")]
    pub tri: SensTri,
    /// Section d'en-tete de groupe.
    #[serde(default = "vrai")]
    pub entete: bool,
    /// Section de pied de groupe (totaux).
    #[serde(default = "vrai")]
    pub pied: bool,
}

fn croissant() -> SensTri {
    SensTri::Croissant
}
fn vrai() -> bool {
    true
}

impl Regroupement {
    /// Niveau croissant avec en-tete et pied.
    pub fn nouveau(champ: &str) -> Self {
        Regroupement { champ: champ.to_string(), tri: SensTri::Croissant, entete: true, pied: true }
    }
}

/// Regroupements d'une definition d'etat : `regroupements` ou, a defaut, l'ancienne cle `regroupement`.
fn lire_regroupements(def: &Json) -> Resultat<Vec<Regroupement>> {
    if let Some(liste) = def.get("regroupements").and_then(Json::as_array) {
        return liste
            .iter()
            .map(|v| match v {
                Json::String(s) => Ok(Regroupement::nouveau(s)),
                autre => serde_json::from_value(autre.clone()).map_err(|e| ErreurBase::msg(format!("Regroupement invalide : {e}"))),
            })
            .collect();
    }
    Ok(def.get("regroupement").and_then(Json::as_str).map(Regroupement::nouveau).into_iter().collect())
}

struct Noeud {
    valeur: Json,
    nb: u64,
    sommes: Vec<f64>,
    enfants: Vec<Noeud>,
    lignes: Vec<Vec<Json>>,
}

impl Noeud {
    fn nouveau(valeur: Json, n: usize) -> Self {
        Noeud { valeur, nb: 0, sommes: vec![0.0; n], enfants: Vec::new(), lignes: Vec::new() }
    }

    fn cumuler(&mut self, ligne: &[Json], totaux: &[usize]) {
        self.nb += 1;
        for (s, &i) in self.sommes.iter_mut().zip(totaux) {
            *s += nombre(&ligne[i]);
        }
    }
}

fn nombre(v: &Json) -> f64 {
    match v {
        Json::Number(n) => n.as_f64().unwrap_or(0.0),
        Json::String(s) => s.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

/// Cle de comparaison d'un groupe (texte sans casse, comme Access).
fn cle(v: &Json) -> String {
    match v {
        Json::String(s) => s.to_lowercase(),
        autre => autre.to_string(),
    }
}

impl Base {
    /// Execute une definition d'etat : lignes triees puis regroupees sur tous les niveaux.
    ///
    /// Sortie : `colonnes`, `regroupements`, `nb_lignes`, `tronque`, `totaux`, puis `groupes`
    /// (arbre : `niveau`, `champ`, `valeur`, `entete`, `pied`, `nb`, `totaux`, et `groupes` ou
    /// `lignes` au dernier niveau) ou `lignes` s'il n'y a aucun regroupement.
    pub fn executer_etat_definition(&self, def: &Json) -> Resultat<Json> {
        let source = def.get("source").and_then(Json::as_str).ok_or_else(|| ErreurBase::msg("L'état n'a pas de « source »."))?;
        let (nom, _) = self.nom_source(source)?;
        let champs = self.champs(&nom)?;
        let niveaux = lire_regroupements(def)?;
        if niveaux.len() > NIVEAUX_MAX {
            return Err(ErreurBase::msg(format!("Un état se regroupe sur {NIVEAUX_MAX} niveaux au plus.")));
        }
        let mut tris: Vec<Tri> = Vec::new();
        for n in &niveaux {
            let c = trouver(&champs, &n.champ)?;
            if tris.iter().any(|t| t.champ == c.nom) {
                return Err(ErreurBase::msg(format!("Le champ « {} » est déjà un niveau de regroupement.", c.nom)));
            }
            tris.push(Tri { champ: c.nom.clone(), descendant: n.tri == SensTri::Decroissant });
        }
        if let Some(liste) = def.get("tri").and_then(Json::as_array) {
            for t in liste {
                tris.push(serde_json::from_value(t.clone()).map_err(|e| ErreurBase::msg(format!("Tri invalide : {e}")))?);
            }
        }
        let colonnes: Vec<&crate::types::ChampSchema> = champs.iter().filter(|c| !c.type_champ.est_binaire()).collect();
        let totaux: Vec<usize> = colonnes
            .iter()
            .enumerate()
            .filter(|(_, c)| c.type_champ.est_numerique() && c.type_champ != crate::types::TypeChamp::NumeroAuto && !c.cle_primaire)
            .map(|(i, _)| i)
            .collect();
        let index_groupe: Vec<usize> = niveaux
            .iter()
            .map(|n| colonnes.iter().position(|c| c.nom.eq_ignore_ascii_case(n.champ.trim())).ok_or_else(|| ErreurBase::Introuvable(n.champ.clone())))
            .collect::<Resultat<_>>()?;
        let mut options = OptionsLecture {
            taille_page: crate::donnees::TAILLE_PAGE_MAX,
            tri: tris,
            expression: def.get("expression").and_then(Json::as_str).filter(|e| !e.trim().is_empty()).map(str::to_string),
            champs: Some(colonnes.iter().map(|c| c.nom.clone()).collect()),
            blobs: false,
            ..OptionsLecture::default()
        };
        let mut racine = Noeud::nouveau(Json::Null, totaux.len());
        let mut lues = 0usize;
        let mut tronque;
        loop {
            let page = self.lire_table(&nom, &options)?;
            for ligne in page.lignes {
                if lues >= LIMITE_LIGNES_ETAT {
                    break;
                }
                lues += 1;
                racine.cumuler(&ligne, &totaux);
                let mut n = &mut racine;
                for &g in &index_groupe {
                    let nouveau = n.enfants.last().is_none_or(|e| cle(&e.valeur) != cle(&ligne[g]));
                    if nouveau {
                        n.enfants.push(Noeud::nouveau(ligne[g].clone(), totaux.len()));
                    }
                    let Some(dernier) = n.enfants.last_mut() else { break };
                    dernier.cumuler(&ligne, &totaux);
                    n = dernier;
                }
                n.lignes.push(ligne);
            }
            tronque = (lues as i64) < page.total;
            options.page += 1;
            if lues >= LIMITE_LIGNES_ETAT || options.page >= page.nb_pages {
                break;
            }
        }
        let noms_totaux: Vec<&str> = totaux.iter().map(|&i| colonnes[i].nom.as_str()).collect();
        let en_json = |n: &Noeud| -> Json {
            fn rec(n: &Noeud, niveau: usize, niveaux: &[Regroupement], noms: &[&str]) -> Json {
                let sommes: Map<String, Json> = noms.iter().zip(&n.sommes).map(|(k, v)| ((*k).to_string(), json!(v))).collect();
                let mut o = json!({
                    "niveau": niveau, "champ": niveaux[niveau].champ, "valeur": n.valeur,
                    "entete": niveaux[niveau].entete, "pied": niveaux[niveau].pied, "nb": n.nb, "totaux": sommes,
                });
                if niveau + 1 < niveaux.len() {
                    o["groupes"] = Json::Array(n.enfants.iter().map(|e| rec(e, niveau + 1, niveaux, noms)).collect());
                } else {
                    o["lignes"] = json!(n.lignes);
                }
                o
            }
            rec(n, 0, &niveaux, &noms_totaux)
        };
        let mut sortie = json!({
            "source": nom,
            "colonnes": colonnes.iter().map(|c| json!({ "nom": c.nom, "type": c.type_champ, "legende": c.proprietes.legende })).collect::<Vec<_>>(),
            "regroupements": niveaux,
            "nb_lignes": lues,
            "tronque": tronque,
            "totaux": noms_totaux.iter().zip(&racine.sommes).map(|(k, v)| ((*k).to_string(), json!(v))).collect::<Map<String, Json>>(),
        });
        if niveaux.is_empty() {
            sortie["lignes"] = json!(racine.lignes);
        } else {
            sortie["groupes"] = Json::Array(racine.enfants.iter().map(en_json).collect());
        }
        Ok(sortie)
    }

    /// Execute un etat enregistre (voir `executer_etat_definition`).
    pub fn executer_etat(&self, nom: &str) -> Resultat<Json> {
        let o = self.lire_objet(GenreObjet::Etat, nom)?;
        self.executer_etat_definition(&o.contenu)
    }
}
