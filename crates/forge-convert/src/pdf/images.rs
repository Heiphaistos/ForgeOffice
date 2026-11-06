//! Images : images (et SVG) vers PDF, extraction des images d'un PDF, et
//! decodage/reencodage des images XObject (partage avec la compression et le caviardage).

use crate::erreur::{param, ConvertError, Resultat};
use crate::fichiers::{extension, lire_entree};
use image::{DynamicImage, GenericImageView, ImageDecoder, ImageReader};
use lopdf::{dictionary, Document, Object, Stream};
use std::io::Cursor;
use std::path::PathBuf;

/// Pixels maximum d'une image decodee (anti-bombe de decompression).
const MAX_PIXELS: u64 = 100_000_000;
/// Cote maximal d'une page PDF en points.
const MAX_PAGE: f32 = 14_400.0;

fn lecteur(octets: &[u8]) -> Resultat<ImageReader<Cursor<&[u8]>>> {
    let mut r = ImageReader::new(Cursor::new(octets))
        .with_guessed_format()
        .map_err(|e| ConvertError::Lecture(format!("image : {e}")))?;
    let mut limites = image::Limits::default();
    limites.max_alloc = Some(1024 * 1024 * 1024);
    r.limits(limites);
    Ok(r)
}

/// Decode une image en memoire, en refusant les dimensions excessives.
pub fn decoder(octets: &[u8]) -> Resultat<DynamicImage> {
    let img = lecteur(octets)?.decode().map_err(|e| ConvertError::Lecture(format!("image illisible : {e}")))?;
    let (l, h) = img.dimensions();
    if u64::from(l) * u64::from(h) > MAX_PIXELS {
        return Err(param(format!("image trop grande ({l} × {h} pixels)")));
    }
    Ok(img)
}

fn zlib(octets: &[u8]) -> Resultat<Vec<u8>> {
    use std::io::Write;
    let mut enc = flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
    enc.write_all(octets).map_err(|e| ConvertError::Echec(format!("compression : {e}")))?;
    enc.finish().map_err(|e| ConvertError::Echec(format!("compression : {e}")))
}

/// XObject image Flate (RVB ou gris) avec masque alpha eventuel (SMask).
pub fn xobject_flate(doc: &mut Document, img: &DynamicImage) -> Resultat<Object> {
    let (l, h) = img.dimensions();
    let gris = !img.color().has_color();
    let (pixels, espace) = if gris { (img.to_luma8().into_raw(), "DeviceGray") } else { (img.to_rgb8().into_raw(), "DeviceRGB") };
    let mut dict = dictionary! {
        "Type" => "XObject", "Subtype" => "Image", "Width" => l, "Height" => h,
        "ColorSpace" => espace, "BitsPerComponent" => 8, "Filter" => "FlateDecode",
    };
    if img.color().has_alpha() {
        let alpha: Vec<u8> = img.to_rgba8().pixels().map(|p| p.0[3]).collect();
        if alpha.iter().any(|&a| a != 255) {
            let masque = Stream::new(
                dictionary! {
                    "Type" => "XObject", "Subtype" => "Image", "Width" => l, "Height" => h,
                    "ColorSpace" => "DeviceGray", "BitsPerComponent" => 8, "Filter" => "FlateDecode",
                },
                zlib(&alpha)?,
            );
            dict.set("SMask", doc.add_object(masque));
        }
    }
    Ok(Object::Stream(Stream::new(dict, zlib(&pixels)?)))
}

/// XObject image pour un fichier : JPEG gris/RVB repris tel quel (aucune perte),
/// autres formats decodes puis compresses sans perte.
fn xobject_fichier(doc: &mut Document, chemin: &std::path::Path) -> Resultat<(Object, u32, u32)> {
    let ext = extension(chemin);
    if ext == "svg" {
        let p = chemin.to_str().ok_or_else(|| ConvertError::CheminRefuse("chemin non UTF-8".into()))?;
        let img = crate::conv::images::svg_to_dynamic_image(p)?;
        let (l, h) = img.dimensions();
        return Ok((xobject_flate(doc, &img)?, l, h));
    }
    let octets = lire_entree(chemin)?;
    if matches!(ext.as_str(), "jpg" | "jpeg") {
        let infos = lecteur(&octets)?.into_decoder().ok().map(|d| (d.dimensions(), d.color_type()));
        if let Some(((l, h), couleur)) = infos {
            let espace = match couleur {
                image::ColorType::L8 => Some("DeviceGray"),
                image::ColorType::Rgb8 => Some("DeviceRGB"),
                _ => None,
            };
            if let Some(espace) = espace.filter(|_| u64::from(l) * u64::from(h) <= MAX_PIXELS) {
                let dict = dictionary! {
                    "Type" => "XObject", "Subtype" => "Image", "Width" => l, "Height" => h,
                    "ColorSpace" => espace, "BitsPerComponent" => 8, "Filter" => "DCTDecode",
                };
                return Ok((Object::Stream(Stream::new(dict, octets)), l, h));
            }
        }
    }
    let img = decoder(&octets)?;
    let (l, h) = img.dimensions();
    Ok((xobject_flate(doc, &img)?, l, h))
}

/// Un PDF avec une page par image, page a la taille de l'image (96 ppp).
pub fn images_vers_pdf(chemins: &[PathBuf]) -> Resultat<Document> {
    if chemins.is_empty() {
        return Err(param("aucune image fournie"));
    }
    let mut doc = Document::with_version("1.7");
    let id_pages = doc.new_object_id();
    let mut enfants = Vec::new();
    for chemin in chemins {
        let (xobj, l, h) = xobject_fichier(&mut doc, chemin)?;
        let id_img = doc.add_object(xobj);
        let echelle = (0.75f32).min(MAX_PAGE / l.max(h).max(1) as f32);
        let (pl, ph) = (l as f32 * echelle, h as f32 * echelle);
        let contenu = format!("q {pl} 0 0 {ph} 0 0 cm /Im1 Do Q").into_bytes();
        let flux = doc.add_object(Stream::new(dictionary! {}, contenu));
        let page = doc.add_object(dictionary! {
            "Type" => "Page", "Parent" => id_pages,
            "MediaBox" => vec![0.into(), 0.into(), pl.into(), ph.into()],
            "Contents" => flux,
            "Resources" => dictionary! { "XObject" => dictionary! { "Im1" => id_img } },
        });
        enfants.push(Object::Reference(page));
    }
    let n = enfants.len() as i64;
    doc.objects.insert(id_pages, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => enfants, "Count" => n }));
    let catalogue = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => id_pages });
    doc.trailer.set("Root", catalogue);
    Ok(doc)
}

fn nom_filtre(s: &Stream) -> Vec<Vec<u8>> {
    s.filters().map(|f| f.into_iter().map(<[u8]>::to_vec).collect()).unwrap_or_default()
}

/// Decode une image XObject quand c'est possible en pur Rust :
/// JPEG (DCTDecode seul), ou Flate/brut 8 bits en gris ou RVB sans /Decode.
pub fn decoder_xobject(doc: &Document, s: &Stream) -> Option<DynamicImage> {
    let d = &s.dict;
    if d.get(b"ImageMask").and_then(Object::as_bool).unwrap_or(false) || d.has(b"Decode") {
        return None;
    }
    let filtres = nom_filtre(s);
    if filtres == [b"DCTDecode".to_vec()] {
        let img = decoder(&s.content).ok()?;
        return matches!(img.color(), image::ColorType::L8 | image::ColorType::Rgb8).then_some(img);
    }
    let l = d.get(b"Width").and_then(Object::as_i64).ok()? as u32;
    let h = d.get(b"Height").and_then(Object::as_i64).ok()? as u32;
    let bpc = d.get(b"BitsPerComponent").and_then(Object::as_i64).ok()?;
    if bpc != 8 || u64::from(l) * u64::from(h) > MAX_PIXELS {
        return None;
    }
    let espace = d.get(b"ColorSpace").ok().and_then(|o| doc.dereference(o).ok()).and_then(|(_, o)| o.as_name().ok());
    let brut = s.decompressed_content().ok()?;
    match espace {
        Some(b"DeviceGray") => image::GrayImage::from_raw(l, h, brut).map(DynamicImage::ImageLuma8),
        Some(b"DeviceRGB") => image::RgbImage::from_raw(l, h, brut).map(DynamicImage::ImageRgb8),
        _ => None,
    }
}

/// Repli du caviardage pour un JPEG que `decoder_xobject` refuse (/Decode, CMYK, YCCK...) :
/// decode via `image` en gris ou RVB 8 bits. Une inversion /Decode [1 0 ...] est appliquee ;
/// les masques d'image (ImageMask) restent non decodables.
pub fn decoder_jpeg_libre(s: &Stream) -> Option<DynamicImage> {
    if s.dict.get(b"ImageMask").and_then(Object::as_bool).unwrap_or(false) || nom_filtre(s) != [b"DCTDecode".to_vec()] {
        return None;
    }
    let img = decoder(&s.content).ok()?;
    let mut img = if img.color().has_color() { DynamicImage::ImageRgb8(img.to_rgb8()) } else { DynamicImage::ImageLuma8(img.to_luma8()) };
    let inverse = s.dict.get(b"Decode").and_then(Object::as_array).is_ok_and(|d| d.len() >= 2 && crate::pdf::nombre(&d[0]) == 1.0 && crate::pdf::nombre(&d[1]) == 0.0);
    if inverse {
        img.invert();
    }
    Some(img)
}

/// Image extraite : nom propose et octets du fichier.
pub struct ImageExtraite {
    pub nom: String,
    pub octets: Vec<u8>,
}

/// Extrait les images du document : JPEG tels quels, images decodables en PNG.
/// Les autres (JPEG 2000, CCITT, JBIG2, espaces de couleur exotiques) sont ignorees.
pub fn extraire_images(doc: &Document) -> Resultat<Vec<ImageExtraite>> {
    let mut res = Vec::new();
    for (id, obj) in &doc.objects {
        let Object::Stream(s) = obj else { continue };
        if s.dict.get(b"Subtype").and_then(Object::as_name).ok() != Some(b"Image".as_slice()) {
            continue;
        }
        let base = format!("image-{}", id.0);
        if nom_filtre(s) == [b"DCTDecode".to_vec()] {
            res.push(ImageExtraite { nom: format!("{base}.jpg"), octets: s.content.clone() });
        } else if let Some(img) = decoder_xobject(doc, s) {
            let mut png = Vec::new();
            img.write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
                .map_err(|e| ConvertError::Echec(format!("encodage PNG : {e}")))?;
            res.push(ImageExtraite { nom: format!("{base}.png"), octets: png });
        }
    }
    Ok(res)
}
