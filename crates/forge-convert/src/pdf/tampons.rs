//! Tampons ajoutes au flux de contenu (sans qpdf) : filigrane, numerotation /
//! Bates, en-tete et pied de page.

use super::{
    ajouter_contenu, ajouter_ressource, boite_page, etat_opacite, largeur_texte, ops_texte, police_standard,
    Couleur,
};
use crate::erreur::{param, Resultat};
use crate::fichiers::analyser_pages;
use lopdf::content::Operation;
use lopdf::{Document, Object};
use serde::{Deserialize, Serialize};

/// Position d'un texte sur la page.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Position {
    HautGauche,
    HautCentre,
    HautDroite,
    BasGauche,
    BasCentre,
    #[default]
    BasDroite,
}

/// Options de filigrane.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Filigrane {
    pub texte: String,
    #[serde(default = "defaut_taille_filigrane")]
    pub taille: f32,
    #[serde(default = "defaut_opacite")]
    pub opacite: f32,
    /// Angle en degres (45 = diagonale montante).
    #[serde(default = "defaut_angle")]
    pub angle: f32,
    #[serde(default = "defaut_gris")]
    pub couleur: Couleur,
    /// Selection de pages (« 1-3 ») ; toutes si absent.
    #[serde(default)]
    pub pages: Option<String>,
}

fn defaut_taille_filigrane() -> f32 {
    60.0
}
fn defaut_opacite() -> f32 {
    0.25
}
fn defaut_angle() -> f32 {
    45.0
}
fn defaut_gris() -> Couleur {
    Couleur(0.5, 0.5, 0.5)
}

fn pages_choisies(doc: &Document, selection: Option<&str>) -> Resultat<Vec<(u32, lopdf::ObjectId)>> {
    let pages = doc.get_pages();
    Ok(match selection {
        Some(s) if !s.trim().is_empty() => analyser_pages(s, pages.len() as u32)?
            .into_iter()
            .filter_map(|n| pages.get(&n).map(|&id| (n, id)))
            .collect(),
        _ => pages.into_iter().collect(),
    })
}

fn verifier_texte(t: &str, max: usize) -> Resultat<()> {
    if t.trim().is_empty() {
        return Err(param("texte vide"));
    }
    if t.chars().count() > max {
        return Err(param(format!("texte trop long ({max} caractères maximum)")));
    }
    Ok(())
}

/// Ajoute un filigrane centre, incline et semi-transparent.
pub fn filigraner(doc: &mut Document, f: &Filigrane) -> Resultat<()> {
    verifier_texte(&f.texte, 200)?;
    if !(4.0..=400.0).contains(&f.taille) {
        return Err(param("taille du filigrane entre 4 et 400 points"));
    }
    let police = police_standard(doc, "Helvetica-Bold");
    let gs = etat_opacite(doc, f.opacite);
    let (s, c) = f.angle.to_radians().sin_cos();
    let largeur = largeur_texte("Helvetica-Bold", &f.texte, f.taille);
    for (_, page) in pages_choisies(doc, f.pages.as_deref())? {
        let nf = ajouter_ressource(doc, page, b"Font", "FcF", Object::Reference(police))?;
        let ng = ajouter_ressource(doc, page, b"ExtGState", "FcG", Object::Reference(gs))?;
        let b = boite_page(doc, page);
        let (cx, cy) = ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0);
        let mut ops = vec![
            Operation::new("q", vec![]),
            Operation::new("gs", vec![Object::Name(ng)]),
            f.couleur.remplissage(),
            Operation::new("cm", vec![c.into(), s.into(), (-s).into(), c.into(), cx.into(), cy.into()]),
        ];
        ops.extend(ops_texte(&nf, f.taille, -largeur / 2.0, -f.taille / 3.0, &f.texte));
        ops.push(Operation::new("Q", vec![]));
        ajouter_contenu(doc, page, ops)?;
    }
    Ok(())
}

/// Texte repete sur les pages avec `{page}` et `{total}`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TextePages {
    /// Gabarit, par exemple « Page {page} sur {total} » ou « DOSSIER-{page} ».
    pub gabarit: String,
    #[serde(default)]
    pub position: Position,
    #[serde(default = "defaut_taille")]
    pub taille: f32,
    /// Numero de la premiere page numerotee.
    #[serde(default = "defaut_debut")]
    pub debut: u32,
    /// Nombre minimal de chiffres (zeros de tete, numerotation Bates).
    #[serde(default)]
    pub chiffres: u8,
    #[serde(default = "defaut_marge")]
    pub marge: f32,
    #[serde(default)]
    pub pages: Option<String>,
}

fn defaut_taille() -> f32 {
    10.0
}
fn defaut_debut() -> u32 {
    1
}
fn defaut_marge() -> f32 {
    28.0
}

impl TextePages {
    /// Numerotation simple « prefixe + numero » en bas a droite.
    pub fn numerotation(prefixe: &str, debut: u32) -> Self {
        TextePages {
            gabarit: format!("{prefixe}{{page}}"),
            position: Position::BasDroite,
            taille: 10.0,
            debut,
            chiffres: 0,
            marge: 28.0,
            pages: None,
        }
    }
}

/// Pose le texte (numero, en-tete ou pied) sur chaque page choisie.
pub fn poser_texte_pages(doc: &mut Document, t: &TextePages) -> Resultat<()> {
    verifier_texte(&t.gabarit, 300)?;
    if !(4.0..=72.0).contains(&t.taille) {
        return Err(param("taille du texte entre 4 et 72 points"));
    }
    let police = police_standard(doc, "Helvetica");
    let total = doc.get_pages().len();
    let choisies = pages_choisies(doc, t.pages.as_deref())?;
    for (i, (_, page)) in choisies.into_iter().enumerate() {
        let n = t.debut.saturating_add(i as u32);
        let texte = t
            .gabarit
            .replace("{page}", &format!("{n:0width$}", width = t.chiffres as usize))
            .replace("{total}", &total.to_string());
        let nf = ajouter_ressource(doc, page, b"Font", "FcN", Object::Reference(police))?;
        let b = boite_page(doc, page);
        let l = largeur_texte("Helvetica", &texte, t.taille);
        let x = match t.position {
            Position::HautGauche | Position::BasGauche => b[0] + t.marge,
            Position::HautCentre | Position::BasCentre => (b[0] + b[2] - l) / 2.0,
            Position::HautDroite | Position::BasDroite => b[2] - t.marge - l,
        };
        let y = match t.position {
            Position::HautGauche | Position::HautCentre | Position::HautDroite => b[3] - t.marge - t.taille,
            _ => b[1] + t.marge,
        };
        let mut ops = vec![Operation::new("q", vec![]), Couleur(0.1, 0.1, 0.1).remplissage()];
        ops.extend(ops_texte(&nf, t.taille, x, y, &texte));
        ops.push(Operation::new("Q", vec![]));
        ajouter_contenu(doc, page, ops)?;
    }
    Ok(())
}

/// En-tete et/ou pied de page centres.
pub fn entete_pied(doc: &mut Document, entete: Option<&str>, pied: Option<&str>, taille: f32) -> Resultat<()> {
    if entete.is_none_or(|s| s.trim().is_empty()) && pied.is_none_or(|s| s.trim().is_empty()) {
        return Err(param("en-tête et pied de page vides"));
    }
    for (texte, position) in [(entete, Position::HautCentre), (pied, Position::BasCentre)] {
        if let Some(g) = texte.filter(|s| !s.trim().is_empty()) {
            let t = TextePages {
                gabarit: g.to_string(),
                position,
                taille,
                debut: 1,
                chiffres: 0,
                marge: 24.0,
                pages: None,
            };
            poser_texte_pages(doc, &t)?;
        }
    }
    Ok(())
}
