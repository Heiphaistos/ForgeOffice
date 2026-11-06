//! Rendu simplifie en pur Rust (repli de `PdfVersImages`) : formes, traits, texte, images, rotation.
#![allow(clippy::unwrap_used, clippy::expect_used)]
mod commun;

use commun::*;
use forge_convert::pdf::{self, externe::FormatImage, rendu};
use forge_convert::{run, Operation, Output};
use lopdf::{dictionary, Object, Stream};

fn rendre(octets: &[u8]) -> (image::RgbaImage, Vec<String>) {
    let r = pdf::rendu_simple(octets, 72, FormatImage::Png).unwrap();
    assert_eq!(r.pages.len(), 1);
    (image::load_from_memory(&r.pages[0].1).unwrap().to_rgba8(), r.avertissements)
}

fn proche(p: &image::Rgba<u8>, c: [u8; 3]) -> bool {
    p.0[..3].iter().zip(c).all(|(&a, b)| a.abs_diff(b) < 8)
}

fn sombres(img: &image::RgbaImage, x0: u32, y0: u32, x1: u32, y1: u32) -> usize {
    (y0..y1).flat_map(|y| (x0..x1).map(move |x| (x, y))).filter(|&(x, y)| img.get_pixel(x, y).0[0] < 128).count()
}

const CONTENU: &str = "1 0 0 rg 100 600 100 100 re f\n0 0 1 RG 4 w 300 100 m 400 100 l S\n0 g BT /F1 24 Tf 50 750 Td (Bonjour) Tj ET";

#[test]
fn rendu_dessine_formes_traits_et_texte() {
    let (img, avert) = rendre(&pdf_contenu(CONTENU, vec![]));
    assert_eq!((img.width(), img.height()), (596, 842));
    // Rectangle rouge : (150, 650) en PDF -> (150, 192) a l'ecran (origine en haut a gauche).
    assert!(proche(img.get_pixel(150, 192), [255, 0, 0]), "{:?}", img.get_pixel(150, 192));
    assert!(proche(img.get_pixel(150, 600), [255, 255, 255]));
    // Trait bleu de 4 pt a y = 100 -> y = 742.
    assert!(proche(img.get_pixel(350, 742), [0, 0, 255]), "{:?}", img.get_pixel(350, 742));
    // Texte noir ou repere gris : des pixels non blancs a (50..140, 68..92).
    let non_blancs = (60..95).flat_map(|y| (50..140).map(move |x| (x, y))).filter(|&(x, y)| img.get_pixel(x, y).0[0] < 200).count();
    assert!(non_blancs > 100, "texte absent ({non_blancs} pixels)");
    assert!(avert[0].contains("Rendu simplifié"));
}

#[test]
fn rendu_suit_la_rotation_de_la_page() {
    let (img, _) = rendre(&pdf_contenu(CONTENU, vec![("Rotate", 90.into())]));
    assert_eq!((img.width(), img.height()), (842, 596));
    // Page tournee de 90 degres : le point PDF (150, 650) est affiche en (u, v) = (Y, X) = (650, 150).
    assert!(proche(img.get_pixel(650, 150), [255, 0, 0]), "{:?}", img.get_pixel(650, 150));
}

#[test]
fn rendu_respecte_la_cropbox() {
    let crop: Vec<Object> = vec![50.into(), 550.into(), 350.into(), 750.into()];
    let (img, _) = rendre(&pdf_contenu(CONTENU, vec![("CropBox", Object::Array(crop))]));
    assert_eq!((img.width(), img.height()), (300, 200));
    // Le rectangle (100..200, 600..700) devient x 50..150, y (750-700)..(750-600) = 50..150.
    assert!(proche(img.get_pixel(100, 100), [255, 0, 0]));
}

#[test]
fn rendu_dessine_une_image_dans_le_bon_sens() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    let mut im = image::RgbImage::from_pixel(80, 80, image::Rgb([0, 0, 255]));
    for y in 0..40 {
        for x in 0..80 {
            im.put_pixel(x, y, image::Rgb([255, 0, 0]));
        }
    }
    im.save(&png).unwrap();
    let e = fichiers(run(Operation::ImagesVersPdf { entrees: vec![png], sortie: cible(d.path(), "i.pdf") }).unwrap()).remove(0);
    let (img, _) = rendre(&std::fs::read(e).unwrap());
    assert_eq!((img.width(), img.height()), (60, 60));
    assert!(proche(img.get_pixel(30, 5), [255, 0, 0]), "haut : {:?}", img.get_pixel(30, 5));
    assert!(proche(img.get_pixel(30, 55), [0, 0, 255]), "bas : {:?}", img.get_pixel(30, 55));
}

#[test]
fn rendu_ecretage_et_formulaires_recursifs_ne_bouclent_pas() {
    let mut doc = lopdf::Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let forme = doc.new_object_id();
    doc.objects.insert(
        forme,
        Object::Stream(Stream::new(
            dictionary! { "Type" => "XObject", "Subtype" => "Form", "BBox" => vec![0.into(), 0.into(), 600.into(), 800.into()],
                "Resources" => dictionary! { "XObject" => dictionary! { "Fm1" => forme } } },
            b"0 1 0 rg 10 10 50 50 re f /Fm1 Do".to_vec(),
        )),
    );
    let flux = doc.add_object(Stream::new(dictionary! {}, b"q 0 0 100 100 re W n 1 0 0 rg 0 0 300 300 re f Q /Fm1 Do".to_vec()));
    let page = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), 200.into(), 200.into()],
        "Contents" => flux, "Resources" => dictionary! { "XObject" => dictionary! { "Fm1" => forme } },
    });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let (img, _) = rendre(&pdf::enregistrer(&mut doc).unwrap());
    // Rouge coupe a 100 x 100 (origine bas gauche) : (50, 150) rouge, (150, 50) blanc ; vert de la forme en (30, 170).
    assert!(proche(img.get_pixel(80, 120), [255, 0, 0]), "{:?}", img.get_pixel(80, 120));
    assert!(proche(img.get_pixel(150, 50), [255, 255, 255]), "{:?}", img.get_pixel(150, 50));
    assert!(proche(img.get_pixel(30, 170), [0, 255, 0]), "{:?}", img.get_pixel(30, 170));
}

#[test]
fn rendu_avec_police_integree_dessine_les_vrais_contours() {
    let Some(chemin) = ["C:/Windows/Fonts/arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/Library/Fonts/Arial.ttf"].into_iter().find(|p| std::path::Path::new(p).is_file()) else {
        eprintln!("aucune police TrueType systeme : test ignore");
        return;
    };
    let ttf = std::fs::read(chemin).unwrap();
    let mut doc = lopdf::Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let fichier = doc.add_object(Stream::new(dictionary! { "Length1" => ttf.len() as i64 }, ttf));
    let desc = doc.add_object(dictionary! { "Type" => "FontDescriptor", "FontName" => "Integree", "Flags" => 32, "FontFile2" => fichier });
    let largeurs: Vec<Object> = (32..=126).map(|_| Object::Integer(722)).collect();
    let police = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "TrueType", "BaseFont" => "Integree", "Encoding" => "WinAnsiEncoding",
        "FirstChar" => 32, "LastChar" => 126, "Widths" => largeurs, "FontDescriptor" => desc,
    });
    let flux = doc.add_object(Stream::new(dictionary! {}, b"0 g BT /F1 60 Tf 50 700 Td (HIH) Tj ET".to_vec()));
    let page = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), A4.0.into(), A4.1.into()],
        "Contents" => flux, "Resources" => dictionary! { "Font" => dictionary! { "F1" => police } },
    });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let (img, avert) = rendre(&pdf::enregistrer(&mut doc).unwrap());
    // 3 lettres de 60 pt a x = 50..180, y = 842-700-45..842-700 = 97..142.
    let n = sombres(&img, 50, 90, 200, 145);
    assert!(n > 400, "les glyphes doivent être dessinés ({n} pixels sombres)");
    assert!(!avert.iter().any(|a| a.contains("repères gris")), "{avert:?}");
}

#[test]
fn pdf_vers_images_utilise_le_repli_integre_et_le_dit() {
    if pdf::externe::rendu_externe_disponible() {
        return; // un outil externe est installe : le repli n'est pas exerce ici
    }
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "p.pdf", &pdf_pages(&[&["Un"], &["Deux"]]));
    let o = run(Operation::PdfVersImages { entree: e, dpi: 72, format: FormatImage::Jpg, noms: vec!["premiere".into()], sortie: cible(d.path(), "r.pdf") }).unwrap();
    let Output::Fichiers { fichiers, avertissements, .. } = o else { panic!() };
    assert_eq!(fichiers.len(), 2);
    assert!(fichiers[0].ends_with("premiere.jpg"), "{:?}", fichiers[0]);
    assert!(avertissements.iter().any(|a| a == rendu::AVERTISSEMENT), "{avertissements:?}");
    assert!(image::open(&fichiers[1]).is_ok());
}
