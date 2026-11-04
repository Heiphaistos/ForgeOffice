//! Annotations : texte pose dans la page (permanent) et vraies annotations PDF
//! (note, surlignage, rectangle) que les lecteurs savent afficher et supprimer.

use super::{ajouter_contenu, ajouter_ressource, boite_page, ops_texte, police_standard, Couleur, Zone};
use crate::erreur::{param, Resultat};
use lopdf::content::Operation;
use lopdf::{dictionary, Document, Object, ObjectId};
use serde::{Deserialize, Serialize};

/// Une annotation a poser. Coordonnees normalisees [0,1], origine en haut a gauche.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Annotation {
    /// Texte ecrit dans la page (fait partie du contenu).
    Texte { page: u32, x: f32, y: f32, taille: f32, texte: String, #[serde(default = "noir")] couleur: Couleur },
    /// Note repliable (icone bulle).
    Note { page: u32, x: f32, y: f32, texte: String, #[serde(default)] auteur: Option<String> },
    /// Surlignage d'une zone.
    Surlignage { zone: Zone, #[serde(default = "jaune")] couleur: Couleur },
    /// Cadre rectangulaire.
    Rectangle { zone: Zone, #[serde(default = "rouge")] couleur: Couleur, #[serde(default = "un")] epaisseur: f32 },
}

fn noir() -> Couleur {
    Couleur::NOIR
}
fn jaune() -> Couleur {
    Couleur(1.0, 0.9, 0.0)
}
fn rouge() -> Couleur {
    Couleur(0.9, 0.1, 0.1)
}
fn un() -> f32 {
    1.0
}

/// Ajoute une annotation (objet) a la liste /Annots de la page.
pub(crate) fn ajouter_annot(doc: &mut Document, page: ObjectId, annot: ObjectId) -> Resultat<()> {
    let mut liste: Vec<Object> = match doc.get_dictionary(page)?.get(b"Annots") {
        Ok(Object::Array(a)) => a.clone(),
        Ok(Object::Reference(r)) => doc.get_object(*r).and_then(Object::as_array).cloned().unwrap_or_default(),
        _ => Vec::new(),
    };
    liste.push(Object::Reference(annot));
    doc.get_dictionary_mut(page)?.set("Annots", Object::Array(liste));
    Ok(())
}

fn couleur(c: Couleur) -> Object {
    Object::Array(vec![c.0.into(), c.1.into(), c.2.into()])
}

fn rect(r: [f32; 4]) -> Object {
    Object::Array(r.iter().map(|&v| v.into()).collect())
}

fn page_id(doc: &Document, n: u32) -> Resultat<ObjectId> {
    let pages = doc.get_pages();
    pages.get(&n).copied().ok_or_else(|| param(format!("page {n} hors limites (1 à {})", pages.len())))
}

fn texte_unicode(t: &str) -> Resultat<Object> {
    if t.chars().count() > 10_000 {
        return Err(param("texte d'annotation trop long (10 000 caractères maximum)"));
    }
    Ok(lopdf::text_string(t))
}

/// Pose toutes les annotations.
pub fn annoter(doc: &mut Document, annotations: &[Annotation]) -> Resultat<()> {
    if annotations.is_empty() {
        return Err(param("aucune annotation"));
    }
    let mut police: Option<ObjectId> = None;
    for a in annotations {
        match a {
            Annotation::Texte { page, x, y, taille, texte, couleur: c } => {
                if texte.trim().is_empty() || !(4.0..=200.0).contains(taille) {
                    return Err(param("texte vide ou taille hors de 4 à 200 points"));
                }
                let id = page_id(doc, *page)?;
                let pol = *police.get_or_insert_with(|| police_standard(doc, "Helvetica"));
                let nf = ajouter_ressource(doc, id, b"Font", "FcA", Object::Reference(pol))?;
                let b = boite_page(doc, id);
                let px = b[0] + x.clamp(0.0, 1.0) * (b[2] - b[0]);
                let py = b[3] - y.clamp(0.0, 1.0) * (b[3] - b[1]) - taille;
                let mut ops = vec![Operation::new("q", vec![]), c.remplissage()];
                for (i, ligne) in texte.lines().enumerate() {
                    ops.extend(ops_texte(&nf, *taille, px, py - i as f32 * taille * 1.2, ligne));
                }
                ops.push(Operation::new("Q", vec![]));
                ajouter_contenu(doc, id, ops)?;
            }
            Annotation::Note { page, x, y, texte, auteur } => {
                let id = page_id(doc, *page)?;
                let b = boite_page(doc, id);
                let px = b[0] + x.clamp(0.0, 1.0) * (b[2] - b[0]);
                let py = b[3] - y.clamp(0.0, 1.0) * (b[3] - b[1]);
                let mut d = dictionary! {
                    "Type" => "Annot", "Subtype" => "Text", "Rect" => rect([px, py - 20.0, px + 20.0, py]),
                    "Contents" => texte_unicode(texte)?, "Name" => "Comment", "F" => 4, "P" => id,
                    "C" => couleur(jaune()),
                };
                if let Some(a) = auteur {
                    d.set("T", texte_unicode(a)?);
                }
                let annot = doc.add_object(d);
                ajouter_annot(doc, id, annot)?;
            }
            Annotation::Surlignage { zone, couleur: c } => {
                let id = page_id(doc, zone.page)?;
                let r = zone.en_points(boite_page(doc, id));
                let quad: Vec<Object> = [r[0], r[3], r[2], r[3], r[0], r[1], r[2], r[1]].iter().map(|&v| v.into()).collect();
                let annot = doc.add_object(dictionary! {
                    "Type" => "Annot", "Subtype" => "Highlight", "Rect" => rect(r), "QuadPoints" => quad,
                    "C" => couleur(*c), "F" => 4, "P" => id, "CA" => 0.5,
                });
                ajouter_annot(doc, id, annot)?;
            }
            Annotation::Rectangle { zone, couleur: c, epaisseur } => {
                let id = page_id(doc, zone.page)?;
                let r = zone.en_points(boite_page(doc, id));
                let e = epaisseur.clamp(0.1, 50.0);
                let annot = doc.add_object(dictionary! {
                    "Type" => "Annot", "Subtype" => "Square", "Rect" => rect(r), "C" => couleur(*c),
                    "BS" => dictionary! { "W" => e }, "F" => 4, "P" => id,
                });
                ajouter_annot(doc, id, annot)?;
            }
        }
    }
    Ok(())
}

/// Texte brut d'une note (pour l'affichage dans la coquille).
pub fn contenu_annotations(doc: &Document, page: u32) -> Vec<String> {
    let Some(&id) = doc.get_pages().get(&page) else { return Vec::new() };
    doc.get_page_annotations(id)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|a| a.get(b"Contents").ok().and_then(|c| lopdf::decode_text_string(c).ok()))
        .collect()
}
