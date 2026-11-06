//! Rendu SIMPLIFIE des pages PDF en images, en pur Rust (repli quand ni MuPDF, ni Poppler,
//! ni Ghostscript ne sont disponibles : Android, iOS, PC sans ces outils).
//!
//! Pris en charge : chemins remplis et traces (tiny-skia : courbes, tirets, ecretage), couleurs
//! Device (gris, RVB, CMYK), images JPEG et Flate 8 bits (gris/RVB, masque doux SMask, masques
//! d'image 1 bit), formulaires XObject, texte avec polices TrueType/OpenType integrees (ttf-parser),
//! sinon police systeme proche (fontdb) a defaut de contour, rotation et CropBox.
//! Non pris en charge (annonce dans les avertissements) : degrades et motifs, transparence de
//! groupe, polices Type 1/Type 3 integrees, images CCITT/JBIG2/JPEG 2000/palette, mode de rendu
//! de texte en ecretage, annotations (apparences non dessinees).

mod dessin;
mod interprete;
mod texte;

use super::externe::FormatImage;
use super::geom::{inverse, mul};
use super::{boite_page, dimensions_affichees, herite, matrice_affichage, rotation_page};
use crate::erreur::{param, ConvertError, Resultat};
use lopdf::{Dictionary, Document};
use std::collections::BTreeSet;
use tiny_skia::{Color, Pixmap};

/// Pages rendues au maximum en une fois.
pub const MAX_PAGES: usize = 500;
/// Pixels maximum d'une page rendue (la resolution baisse au-dela).
const MAX_PIXELS: f32 = 40_000_000.0;

/// Message commun a tout rendu de repli.
pub const AVERTISSEMENT: &str =
    "Rendu simplifié : aucun outil de rendu (MuPDF, Poppler, Ghostscript) n'est disponible, les pages sont dessinées par le moteur intégré (dégradés, motifs et certaines polices ou images ne sont pas reproduits).";

/// Pages rendues (nom, octets de l'image) et mises en garde.
pub struct Rendu {
    pub pages: Vec<(String, Vec<u8>)>,
    pub avertissements: Vec<String>,
}

/// Rend chaque page (`page-1.png`...) en 36 a 600 ppp.
pub fn rendre_pages(doc: &Document, dpi: u32, format: FormatImage) -> Resultat<Rendu> {
    let pages = doc.get_pages();
    if pages.len() > MAX_PAGES {
        return Err(param(format!("trop de pages pour le rendu intégré ({}, maximum {MAX_PAGES})", pages.len())));
    }
    let dpi = dpi.clamp(36, 600) as f32;
    let mut systeme = texte::Systeme::default();
    let mut avert: BTreeSet<String> = BTreeSet::new();
    let mut sortie = Vec::new();
    for (&num, &id) in &pages {
        let b = boite_page(doc, id);
        let rot = rotation_page(doc, id);
        let (wd, hd) = dimensions_affichees(b, rot);
        // Echelle : 1 point = dpi/72 pixels, reduite si la page depasse MAX_PIXELS.
        let mut s = dpi / 72.0;
        if wd * hd * s * s > MAX_PIXELS {
            s = (MAX_PIXELS / (wd * hd)).sqrt();
            avert.insert("La résolution a été réduite pour au moins une page trop grande.".into());
        }
        let (w, h) = ((wd * s).ceil().max(1.0) as u32, (hd * s).ceil().max(1.0) as u32);
        let mut pix = Pixmap::new(w, h).ok_or_else(|| ConvertError::Echec(format!("page {num} : image de {w} × {h} pixels impossible")))?;
        pix.fill(Color::WHITE);
        let inv = inverse(matrice_affichage(b, rot)).ok_or_else(|| ConvertError::PdfInvalide(format!("page {num} : boîte de page dégénérée")))?;
        let base = mul(inv, [s, 0.0, 0.0, -s, 0.0, hd * s]);
        let res: Dictionary = herite(doc, id, b"Resources").and_then(|o| doc.dereference(&o).ok().and_then(|(_, o)| o.as_dict().ok().cloned())).unwrap_or_default();
        match doc.get_and_decode_page_content(id) {
            Ok(contenu) => {
                let mut it = interprete::Interprete::nouveau(doc, &mut pix, base, &mut systeme);
                it.executer(contenu.operations, &res, 0);
                avert.extend(it.avert);
            }
            Err(e) => {
                avert.insert(format!("Le contenu de la page {num} est illisible ({e}) : page laissée blanche."));
            }
        }
        sortie.push((format!("page-{num}.{}", if format == FormatImage::Png { "png" } else { "jpg" }), encoder(&pix, format)?));
    }
    let mut avertissements = vec![AVERTISSEMENT.to_string()];
    avertissements.extend(avert);
    Ok(Rendu { pages: sortie, avertissements })
}

fn encoder(pix: &Pixmap, format: FormatImage) -> Resultat<Vec<u8>> {
    let (w, h) = (pix.width(), pix.height());
    let mut octets = Vec::new();
    let rgba = image::RgbaImage::from_raw(w, h, pix.data().to_vec()).ok_or_else(|| ConvertError::Echec("image de page incohérente".into()))?;
    let res = match format {
        FormatImage::Png => rgba.write_to(&mut std::io::Cursor::new(&mut octets), image::ImageFormat::Png),
        FormatImage::Jpg => image::DynamicImage::ImageRgba8(rgba).to_rgb8().write_to(&mut std::io::Cursor::new(&mut octets), image::ImageFormat::Jpeg),
    };
    res.map_err(|e| ConvertError::Echec(format!("encodage de la page : {e}")))?;
    Ok(octets)
}
