//! Sous-formulaires : controle JSON `sous_formulaire` relie a son formulaire maitre par des champs
//! maitre/detail, creation depuis une relation, lecture filtree des enregistrements lies et
//! valeurs a pre-remplir pour une nouvelle ligne.

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value as Json};

use crate::base::Base;
use crate::donnees::{trouver, Filtre, OptionsLecture, Operateur, PageLignes};
use crate::erreur::{ErreurBase, Resultat};
use crate::objets::Disposition;

/// Lien entre un champ du formulaire maitre et un champ du sous-formulaire.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LienChamps {
    /// Champ de la source du formulaire maitre.
    pub maitre: String,
    /// Champ de la source du sous-formulaire.
    pub detail: String,
}

/// Controle sous-formulaire d'un formulaire.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SousFormulaire {
    /// Nom du controle.
    pub nom: String,
    /// Table ou requete du sous-formulaire.
    pub source: String,
    /// Champs lies (un ou plusieurs couples maitre/detail).
    pub liens: Vec<LienChamps>,
    /// Affichage du sous-formulaire.
    #[serde(default = "feuille")]
    pub disposition: Disposition,
    /// Position et taille dans le formulaire maitre.
    #[serde(default)]
    pub x: i64,
    /// Position verticale.
    #[serde(default)]
    pub y: i64,
    /// Largeur.
    #[serde(default = "largeur_defaut")]
    pub largeur: i64,
    /// Hauteur.
    #[serde(default = "hauteur_defaut")]
    pub hauteur: i64,
    /// Autoriser l'ajout d'enregistrements lies.
    #[serde(default = "vrai")]
    pub autoriser_ajouts: bool,
    /// Autoriser la suppression d'enregistrements lies.
    #[serde(default = "vrai")]
    pub autoriser_suppressions: bool,
}

fn feuille() -> Disposition {
    Disposition::FeuilleDonnees
}
fn largeur_defaut() -> i64 {
    480
}
fn hauteur_defaut() -> i64 {
    200
}
fn vrai() -> bool {
    true
}

impl SousFormulaire {
    /// Controle JSON a placer dans la section « detail » d'un formulaire.
    pub fn en_controle(&self) -> Json {
        json!({
            "type": "sous_formulaire",
            "nom": self.nom,
            "source": self.source,
            "champs_maitre": self.liens.iter().map(|l| &l.maitre).collect::<Vec<_>>(),
            "champs_detail": self.liens.iter().map(|l| &l.detail).collect::<Vec<_>>(),
            "disposition": self.disposition,
            "x": self.x, "y": self.y, "largeur": self.largeur, "hauteur": self.hauteur,
            "autoriser_ajouts": self.autoriser_ajouts,
            "autoriser_suppressions": self.autoriser_suppressions,
        })
    }

    /// Relit un controle JSON de type `sous_formulaire`.
    pub fn depuis_controle(c: &Json) -> Resultat<Self> {
        let liste = |cle: &str| -> Resultat<Vec<String>> {
            c.get(cle)
                .and_then(Json::as_array)
                .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
                .ok_or_else(|| ErreurBase::msg(format!("Sous-formulaire : « {cle} » manquant.")))
        };
        let (maitre, detail) = (liste("champs_maitre")?, liste("champs_detail")?);
        if maitre.is_empty() || maitre.len() != detail.len() {
            return Err(ErreurBase::msg("Sous-formulaire : les champs maître et détail doivent être en même nombre (au moins un)."));
        }
        let texte = |cle: &str| c.get(cle).and_then(Json::as_str).filter(|s| !s.trim().is_empty()).map(str::to_string);
        let entier = |cle: &str, defaut: i64| c.get(cle).and_then(Json::as_i64).unwrap_or(defaut);
        let booleen = |cle: &str| c.get(cle).and_then(Json::as_bool).unwrap_or(true);
        let source = texte("source").ok_or_else(|| ErreurBase::msg("Sous-formulaire : « source » manquante."))?;
        Ok(SousFormulaire {
            nom: texte("nom").unwrap_or_else(|| source.clone()),
            source,
            liens: maitre.into_iter().zip(detail).map(|(maitre, detail)| LienChamps { maitre, detail }).collect(),
            disposition: serde_json::from_value(c.get("disposition").cloned().unwrap_or(Json::Null)).unwrap_or(Disposition::FeuilleDonnees),
            x: entier("x", 0),
            y: entier("y", 0),
            largeur: entier("largeur", largeur_defaut()),
            hauteur: entier("hauteur", hauteur_defaut()),
            autoriser_ajouts: booleen("autoriser_ajouts"),
            autoriser_suppressions: booleen("autoriser_suppressions"),
        })
    }
}

/// Verifie les controles `sous_formulaire` d'un formulaire (appele a l'enregistrement).
pub(crate) fn verifier(contenu: &Json) -> Resultat<()> {
    let Some(sections) = contenu.get("sections").and_then(Json::as_object) else { return Ok(()) };
    for section in sections.values() {
        for c in section.get("controles").and_then(Json::as_array).into_iter().flatten() {
            if c.get("type").and_then(Json::as_str) == Some("sous_formulaire") {
                SousFormulaire::depuis_controle(c)?;
            }
        }
    }
    Ok(())
}

impl Base {
    /// Definit un sous-formulaire `detail` lie au formulaire maitre `maitre`. Sans `liens`, ils sont
    /// deduits de la relation maitre (parent) -> detail (enfant). Les champs sont verifies.
    pub fn sous_formulaire(&self, maitre: &str, detail: &str, liens: &[LienChamps], disposition: Disposition) -> Resultat<SousFormulaire> {
        let (maitre, _) = self.nom_source(maitre)?;
        let (detail, _) = self.nom_source(detail)?;
        let liens: Vec<LienChamps> = if liens.is_empty() {
            let r = self
                .relations_de(&maitre)?
                .into_iter()
                .find(|r| r.table_parent.eq_ignore_ascii_case(&maitre) && r.table_enfant.eq_ignore_ascii_case(&detail))
                .ok_or_else(|| ErreurBase::msg(format!("Aucune relation de « {maitre} » vers « {detail} » : indiquez les champs liés.")))?;
            r.champs_parent.into_iter().zip(r.champs_enfant).map(|(maitre, detail)| LienChamps { maitre, detail }).collect()
        } else {
            liens.to_vec()
        };
        let (cm, cd) = (self.champs(&maitre)?, self.champs(&detail)?);
        let mut verifies = Vec::with_capacity(liens.len());
        for l in &liens {
            verifies.push(LienChamps { maitre: trouver(&cm, &l.maitre)?.nom.clone(), detail: trouver(&cd, &l.detail)?.nom.clone() });
        }
        Ok(SousFormulaire {
            nom: detail.clone(),
            source: detail,
            liens: verifies,
            disposition,
            x: 8,
            y: 0,
            largeur: largeur_defaut(),
            hauteur: hauteur_defaut(),
            autoriser_ajouts: true,
            autoriser_suppressions: true,
        })
    }

    /// Formulaire instantane de `maitre` avec, sous ses champs, un sous-formulaire `detail`.
    pub fn formulaire_avec_sous_formulaire(&self, maitre: &str, detail: &str, liens: &[LienChamps], disposition: Disposition) -> Resultat<Json> {
        let mut sous = self.sous_formulaire(maitre, detail, liens, disposition)?;
        let mut form = self.formulaire_instantane(maitre, Disposition::Simple)?;
        let bas = form["sections"]["detail"]["controles"]
            .as_array()
            .map(|a| a.iter().filter_map(|c| Some(c.get("y")?.as_i64()? + c.get("hauteur")?.as_i64()?)).max().unwrap_or(0))
            .unwrap_or(0);
        sous.y = bas + 16;
        if let Some(controles) = form["sections"]["detail"]["controles"].as_array_mut() {
            controles.push(sous.en_controle());
        }
        Ok(form)
    }

    /// Enregistrements du sous-formulaire lies a la ligne maitre courante. Une valeur maitre
    /// absente ou nulle ne lie aucun enregistrement. `options.filtres` s'ajoutent au lien.
    pub fn lire_sous_formulaire(&self, sous: &SousFormulaire, valeurs_maitre: &Map<String, Json>, options: &OptionsLecture) -> Resultat<PageLignes> {
        let mut o = options.clone();
        for l in &sous.liens {
            let v = valeurs_maitre.iter().find(|(k, _)| k.eq_ignore_ascii_case(&l.maitre)).map(|(_, v)| v.clone()).unwrap_or(Json::Null);
            if v.is_null() {
                o.expression = Some(match o.expression.take() {
                    Some(e) if !e.trim().is_empty() => format!("({e}) And 1=0"),
                    _ => "1=0".into(),
                });
            } else {
                o.filtres.push(Filtre { champ: l.detail.clone(), operateur: Operateur::Egal, valeur: v, valeur2: Json::Null, valeurs: Vec::new() });
            }
        }
        // Les filtres du lien sont combines par ET quelle que soit la combinaison choisie pour les autres.
        o.combinaison_ou = false;
        self.lire_table(&sous.source, &o)
    }

    /// Valeurs des champs de liaison a pre-remplir dans une nouvelle ligne du sous-formulaire.
    pub fn valeurs_liees(&self, sous: &SousFormulaire, valeurs_maitre: &Map<String, Json>) -> Map<String, Json> {
        sous.liens
            .iter()
            .filter_map(|l| valeurs_maitre.iter().find(|(k, _)| k.eq_ignore_ascii_case(&l.maitre)).map(|(_, v)| (l.detail.clone(), v.clone())))
            .collect()
    }
}
