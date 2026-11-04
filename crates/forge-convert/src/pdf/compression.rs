//! Compression en pur Rust (ForgePDF passait par Ghostscript) :
//! purge des objets orphelins, flux compresses en Flate, flux d'objets et table
//! de references compressee, et pour les niveaux avec perte, images
//! reechantillonnees et reencodees en JPEG quand le gain est reel.

use super::images::decoder_xobject;
use crate::erreur::{ConvertError, Resultat};
use image::GenericImageView;
use lopdf::{Document, Object, ObjectId, SaveOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

/// Niveau de compression.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NiveauCompression {
    /// Structure seulement, aucune perte.
    SansPerte,
    /// Images 1000 px max, JPEG qualite 50.
    Ecran,
    /// Images 1700 px max, JPEG qualite 70 (equilibre).
    #[default]
    Ebook,
    /// Images 2800 px max, JPEG qualite 85.
    Impression,
}

impl NiveauCompression {
    fn images(self) -> Option<(u32, u8)> {
        match self {
            NiveauCompression::SansPerte => None,
            NiveauCompression::Ecran => Some((1000, 50)),
            NiveauCompression::Ebook => Some((1700, 70)),
            NiveauCompression::Impression => Some((2800, 85)),
        }
    }
}

/// Statistiques de la compression des images.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct BilanCompression {
    pub images_reencodees: u32,
    pub octets_gagnes_images: u64,
}

fn masques(doc: &Document) -> HashSet<ObjectId> {
    doc.objects
        .values()
        .filter_map(|o| match o {
            Object::Stream(s) => s.dict.get(b"SMask").and_then(Object::as_reference).ok(),
            _ => None,
        })
        .collect()
}

/// Reechantillonne et reencode les images selon le niveau.
fn compresser_images(doc: &mut Document, max: u32, qualite: u8) -> Resultat<BilanCompression> {
    let exclus = masques(doc);
    let mut bilan = BilanCompression::default();
    let ids: Vec<ObjectId> = doc.objects.keys().copied().filter(|id| !exclus.contains(id)).collect();
    for id in ids {
        let Some(Object::Stream(s)) = doc.objects.get(&id) else { continue };
        if s.dict.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Image".as_slice()) {
            continue;
        }
        let Some(img) = decoder_xobject(doc, s) else { continue };
        let avant = s.content.len();
        let (l, h) = img.dimensions();
        let img = if l.max(h) > max { img.resize(max, max, image::imageops::FilterType::Lanczos3) } else { img };
        let gris = !img.color().has_color();
        let mut jpg = Vec::new();
        let mut enc = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpg, qualite);
        let res = if gris { enc.encode_image(&img.to_luma8()) } else { enc.encode_image(&img.to_rgb8()) };
        res.map_err(|e| ConvertError::Echec(format!("encodage JPEG : {e}")))?;
        if jpg.len() + 64 >= avant {
            continue;
        }
        let (nl, nh) = img.dimensions();
        if let Some(Object::Stream(s)) = doc.objects.get_mut(&id) {
            s.dict.set("Filter", "DCTDecode");
            s.dict.remove(b"DecodeParms");
            s.dict.set("Width", nl);
            s.dict.set("Height", nh);
            s.dict.set("BitsPerComponent", 8);
            s.dict.set("ColorSpace", if gris { "DeviceGray" } else { "DeviceRGB" });
            s.set_content(jpg.clone());
            s.allows_compression = false;
            bilan.images_reencodees += 1;
            bilan.octets_gagnes_images += (avant - jpg.len()) as u64;
        }
    }
    Ok(bilan)
}

/// Compresse le document en place (a enregistrer ensuite avec `enregistrer_compact`).
pub fn compresser(doc: &mut Document, niveau: NiveauCompression) -> Resultat<BilanCompression> {
    doc.prune_objects();
    let bilan = match niveau.images() {
        Some((max, q)) => compresser_images(doc, max, q)?,
        None => BilanCompression::default(),
    };
    doc.compress();
    Ok(bilan)
}

/// Enregistre avec flux d'objets et table de references compressee (PDF 1.5+).
pub fn enregistrer_compact(doc: &mut Document) -> Resultat<Vec<u8>> {
    if doc.version.as_str() < "1.5" {
        doc.version = "1.5".into();
    }
    let options = SaveOptions::builder().use_object_streams(true).use_xref_streams(true).compression_level(9).build();
    let mut out = Vec::new();
    doc.save_with_options(&mut out, options)
        .map_err(|e| ConvertError::Echec(format!("enregistrement compressé : {e}")))?;
    Ok(out)
}
