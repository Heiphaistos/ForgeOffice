//! Metriques d'une police PDF (largeurs des codes) partagees par le caviardage et le rendu.

use super::decodage::Decodeur;
use super::nombre;
use lopdf::{Dictionary, Document, Object};
use std::collections::HashMap;

/// Metriques d'une police (largeurs en unites de texte pour une taille 1).
pub(super) struct Police {
    pub double: bool,
    pub dec: Decodeur,
    pub largeurs: HashMap<u32, f32>,
    pub defaut: f32,
    pub echelle: f32,
    pub base: Option<String>,
}

impl Police {
    pub fn largeur(&self, code: u32) -> f32 {
        let w = match (self.largeurs.get(&code), &self.base) {
            (Some(w), _) => *w,
            (None, Some(b)) if !self.double => super::largeur_glyphe(b, code as u8) as f32,
            _ => self.defaut,
        };
        w * self.echelle
    }
}

pub(super) fn deref<'a>(doc: &'a Document, o: &'a Object) -> &'a Object {
    doc.dereference(o).map(|(_, o)| o).unwrap_or(o)
}

pub(super) fn charger_police(doc: &Document, res: &Dictionary, nom: &[u8]) -> Police {
    let mut p = Police { double: false, dec: Decodeur::default(), largeurs: HashMap::new(), defaut: 500.0, echelle: 0.001, base: Some("Helvetica".into()) };
    let Some(f) = res
        .get(b"Font")
        .ok()
        .and_then(|o| deref(doc, o).as_dict().ok())
        .and_then(|d| d.get(nom).ok())
        .and_then(|o| deref(doc, o).as_dict().ok())
    else {
        return p;
    };
    let nom_de = |d: &Dictionary, k: &[u8]| d.get(k).ok().and_then(|o| deref(doc, o).as_name().ok()).map(<[u8]>::to_vec);
    let sous_type = nom_de(f, b"Subtype").unwrap_or_default();
    p.dec = Decodeur::depuis_police(doc, f);
    if sous_type == b"Type0" {
        p.double = true;
        p.base = None;
        p.defaut = 1000.0;
        let desc = f
            .get(b"DescendantFonts")
            .ok()
            .and_then(|o| deref(doc, o).as_array().ok())
            .and_then(|a| a.first())
            .and_then(|o| deref(doc, o).as_dict().ok());
        if let Some(desc) = desc {
            p.defaut = desc.get(b"DW").map(nombre).unwrap_or(1000.0);
            if let Some(w) = desc.get(b"W").ok().and_then(|o| deref(doc, o).as_array().ok()) {
                let mut i = 0;
                while i + 1 < w.len() {
                    let premier = nombre(deref(doc, &w[i])) as u32;
                    match deref(doc, &w[i + 1]) {
                        Object::Array(liste) => {
                            for (k, v) in liste.iter().take(65_536).enumerate() {
                                p.largeurs.insert(premier + k as u32, nombre(deref(doc, v)));
                            }
                            i += 2;
                        }
                        dernier if i + 2 < w.len() => {
                            let dernier = (nombre(dernier) as u32).min(premier.saturating_add(65_536));
                            let v = nombre(deref(doc, &w[i + 2]));
                            for c in premier..=dernier {
                                p.largeurs.insert(c, v);
                            }
                            i += 3;
                        }
                        _ => break,
                    }
                }
            }
        }
        return p;
    }
    if sous_type == b"Type3" {
        p.echelle = f.get(b"FontMatrix").ok().and_then(|o| deref(doc, o).as_array().ok()).and_then(|a| a.first()).map(nombre).unwrap_or(0.001);
    }
    if let Some(w) = f.get(b"Widths").ok().and_then(|o| deref(doc, o).as_array().ok()) {
        let premier = f.get(b"FirstChar").map(nombre).unwrap_or(0.0) as u32;
        for (k, v) in w.iter().enumerate() {
            p.largeurs.insert(premier + k as u32, nombre(deref(doc, v)));
        }
        p.base = None;
    } else {
        p.base = nom_de(f, b"BaseFont").map(|b| String::from_utf8_lossy(&b).into_owned());
    }
    p
}

