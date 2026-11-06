//! Aides communes aux tests : PDF generes a la volee, cibles temporaires.
#![allow(dead_code)]

use forge_convert::pdf::{self, texte::document_texte};
use forge_convert::{run, ActionPdf, Cible, Operation, Output};
use std::path::{Path, PathBuf};

pub const A4: (f32, f32) = (595.276, 841.89);

/// PDF de N pages, chaque page = des lignes de texte Helvetica 12 en (50, 780 - 20 i).
pub fn pdf_pages(pages: &[&[&str]]) -> Vec<u8> {
    let p: Vec<Vec<(f32, f32, String)>> = pages
        .iter()
        .map(|lignes| lignes.iter().enumerate().map(|(i, l)| (50.0, 780.0 - 20.0 * i as f32, l.to_string())).collect())
        .collect();
    let mut doc = document_texte(&p, "Helvetica", 12.0, A4).unwrap();
    pdf::enregistrer(&mut doc).unwrap()
}

pub fn ecrire(dir: &Path, nom: &str, octets: &[u8]) -> PathBuf {
    let p = dir.join(nom);
    std::fs::write(&p, octets).unwrap();
    p
}

pub fn cible(dir: &Path, nom: &str) -> Cible {
    Cible::nouvelle(dir, nom)
}

pub fn texte(chemin: &Path) -> String {
    pdf::texte::extraire_fichier(chemin).unwrap_or_default()
}

pub fn nb_pages(chemin: &Path) -> usize {
    pdf::charger(&std::fs::read(chemin).unwrap(), None).unwrap().get_pages().len()
}

pub fn fichiers(o: Output) -> Vec<PathBuf> {
    match o {
        Output::Fichiers { fichiers, .. } => fichiers,
        autre => panic!("sortie inattendue : {autre:?}"),
    }
}

/// Applique des actions a un PDF et renvoie le chemin produit.
pub fn appliquer(dir: &Path, entree: &Path, actions: Vec<ActionPdf>, nom: &str) -> PathBuf {
    let o = run(Operation::Pdf { entree: entree.into(), mot_de_passe: None, actions, sortie: cible(dir, nom) }).unwrap();
    fichiers(o).remove(0)
}

/// Vrai si un flux (decompresse) ou le fichier brut contient `mot`.
pub fn contient_partout(chemin: &Path, mot: &str) -> bool {
    let brut = std::fs::read(chemin).unwrap();
    let m = mot.as_bytes();
    if brut.windows(m.len()).any(|w| w == m) {
        return true;
    }
    let doc = lopdf::Document::load_mem(&brut).unwrap();
    doc.objects.values().any(|o| match o {
        lopdf::Object::Stream(s) => {
            let c = s.decompressed_content().unwrap_or_else(|_| s.content.clone());
            c.windows(m.len()).any(|w| w == m)
        }
        _ => false,
    })
}

/// Zone normalisee couvrant `texte` pose en (x, y) Helvetica 12 sur une page A4.
pub fn zone_mot(page: u32, avant: &str, mot: &str, y: f32) -> pdf::Zone {
    let x0 = 50.0 + pdf::largeur_texte("Helvetica", avant, 12.0);
    let l = pdf::largeur_texte("Helvetica", mot, 12.0);
    pdf::Zone { page, x: (x0 + 1.0) / A4.0, y: (A4.1 - y - 10.0) / A4.1, largeur: (l - 2.0) / A4.0, hauteur: 14.0 / A4.1 }
}

/// PDF d'une page A4 dont le flux de contenu est `contenu` (police F1 = Helvetica) ;
/// `extra` ajoute des entrees au dictionnaire de la page (Rotate, CropBox...).
pub fn pdf_contenu(contenu: &str, extra: Vec<(&str, lopdf::Object)>) -> Vec<u8> {
    use lopdf::{dictionary, Document, Object, Stream};
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let police = pdf::police_standard(&mut doc, "Helvetica");
    let flux = doc.add_object(Stream::new(dictionary! {}, contenu.as_bytes().to_vec()));
    let mut page = dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), A4.0.into(), A4.1.into()],
        "Contents" => flux, "Resources" => dictionary! { "Font" => dictionary! { "F1" => police } },
    };
    for (k, v) in extra {
        page.set(k, v);
    }
    let page = doc.add_object(page);
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    pdf::enregistrer(&mut doc).unwrap()
}

/// Zone normalisee (origine en haut a gauche de la page A4 non pivotee) d'un rectangle PDF en points.
pub fn zone_pts(page: u32, x0: f32, y0: f32, x1: f32, y1: f32) -> pdf::Zone {
    pdf::Zone { page, x: x0 / A4.0, y: (A4.1 - y1) / A4.1, largeur: (x1 - x0) / A4.0, hauteur: (y1 - y0) / A4.1 }
}

/// Operateurs du contenu de la page 1 d'un PDF.
pub fn operateurs_page1(chemin: &Path) -> Vec<lopdf::content::Operation> {
    let doc = lopdf::Document::load_mem(&std::fs::read(chemin).unwrap()).unwrap();
    let page = *doc.get_pages().get(&1).unwrap();
    doc.get_and_decode_page_content(page).unwrap().operations
}
