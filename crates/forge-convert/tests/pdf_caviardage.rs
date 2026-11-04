//! Caviardage reel, correctifs de texte, images, extraction, comparaison.
#![allow(clippy::unwrap_used, clippy::expect_used)]
mod commun;

use commun::*;
use forge_convert::pdf::{self, caviardage::Correctif, Couleur, Zone};
use forge_convert::{run, ActionPdf, ConvertError, Operation, Output};
use lopdf::{dictionary, Document, Object, Stream};

fn caviarder(dir: &std::path::Path, e: &std::path::Path, zones: Vec<Zone>) -> (std::path::PathBuf, pdf::caviardage::RapportCaviardage) {
    let o = run(Operation::Pdf { entree: e.into(), mot_de_passe: None, actions: vec![ActionPdf::Caviarder { zones }], sortie: cible(dir, "c.pdf") }).unwrap();
    let Output::Fichiers { mut fichiers, caviardage, .. } = o else { panic!() };
    (fichiers.remove(0), caviardage.unwrap())
}

#[test]
fn caviardage_supprime_le_texte_sous_la_zone() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Public SECRET fin", "Ligne suivante"]]));
    let (c, r) = caviarder(d.path(), &e, vec![zone_mot(1, "Public ", "SECRET", 780.0)]);
    assert_eq!(r.glyphes_supprimes, 6);
    let t = texte(&c);
    assert!(!t.contains("SECRET") && !t.contains("ECR"), "texte extrait : {t}");
    assert!(t.contains("Public") && t.contains("fin") && t.contains("Ligne suivante"), "texte extrait : {t}");
    // Ni le fichier brut ni aucun flux decompresse ne garde le mot.
    assert!(!contient_partout(&c, "SECRET"));
    assert!(contient_partout(&e, "SECRET"));
}

#[test]
fn caviardage_ne_touche_que_la_page_visee() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Public SECRET fin"], &["Public SECRET fin"]]));
    let (c, r) = caviarder(d.path(), &e, vec![zone_mot(2, "Public ", "SECRET", 780.0)]);
    assert_eq!(r.glyphes_supprimes, 6);
    let doc = pdf::charger(&std::fs::read(&c).unwrap(), None).unwrap();
    let pages = pdf::texte::extraire_pages(&doc);
    assert!(pages[0].texte.contains("SECRET"));
    assert!(!pages[1].texte.contains("SECRET"));
}

#[test]
fn caviardage_dans_un_tableau_tj_avec_crenage() {
    let d = tempfile::tempdir().unwrap();
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let police = pdf::police_standard(&mut doc, "Helvetica");
    let contenu = b"BT /F1 12 Tf 50 700 Td [(Code ) -20 (SE) 30 (CRET) (!)] TJ ET".to_vec();
    let flux = doc.add_object(Stream::new(dictionary! {}, contenu));
    let page = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), A4.0.into(), A4.1.into()],
        "Contents" => flux, "Resources" => dictionary! { "Font" => dictionary! { "F1" => police } },
    });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let e = ecrire(d.path(), "tj.pdf", &pdf::enregistrer(&mut doc).unwrap());
    // « Code » + 0,24 pt de crenage : SECRET commence vers x = 50 + largeur("Code ") + 0,24.
    let x0 = 50.0 + pdf::largeur_texte("Helvetica", "Code ", 12.0) + 0.24;
    let l = pdf::largeur_texte("Helvetica", "SECRET", 12.0) - 0.36;
    let z = Zone { page: 1, x: (x0 + 1.0) / A4.0, y: (A4.1 - 710.0) / A4.1, largeur: (l - 2.0) / A4.0, hauteur: 14.0 / A4.1 };
    let (c, r) = caviarder(d.path(), &e, vec![z]);
    assert_eq!(r.glyphes_supprimes, 6);
    let t = texte(&c);
    assert!(t.contains("Code") && t.contains('!') && !t.contains("SE") && !t.contains("CRET"), "{t}");
}

#[test]
fn caviardage_reecrit_les_formulaires_xobject() {
    let d = tempfile::tempdir().unwrap();
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let police = pdf::police_standard(&mut doc, "Helvetica");
    let forme = doc.add_object(Stream::new(
        dictionary! {
            "Type" => "XObject", "Subtype" => "Form", "BBox" => vec![0.into(), 0.into(), 300.into(), 100.into()],
            "Resources" => dictionary! { "Font" => dictionary! { "F1" => police } },
        },
        b"BT /F1 12 Tf 10 20 Td (MOTPASSE) Tj ET".to_vec(),
    ));
    let flux = doc.add_object(Stream::new(dictionary! {}, b"q 1 0 0 1 40 680 cm /Fm1 Do Q".to_vec()));
    let page = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), A4.0.into(), A4.1.into()],
        "Contents" => flux, "Resources" => dictionary! { "XObject" => dictionary! { "Fm1" => forme } },
    });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let e = ecrire(d.path(), "forme.pdf", &pdf::enregistrer(&mut doc).unwrap());
    // Texte a (50, 700) en coordonnees de page ; la zone couvre toute la ligne.
    let z = Zone { page: 1, x: 45.0 / A4.0, y: (A4.1 - 715.0) / A4.1, largeur: 200.0 / A4.0, hauteur: 20.0 / A4.1 };
    let (c, r) = caviarder(d.path(), &e, vec![z]);
    assert_eq!(r.formes_reecrites, 1);
    assert_eq!(r.glyphes_supprimes, 8);
    assert!(!contient_partout(&c, "MOTPASSE"));
}

#[test]
fn caviardage_noircit_les_pixels_d_une_image() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("blanc.png");
    image::RgbImage::from_pixel(200, 100, image::Rgb([250, 250, 250])).save(&png).unwrap();
    let o = run(Operation::ImagesVersPdf { entrees: vec![png], sortie: cible(d.path(), "img.pdf") }).unwrap();
    let e = fichiers(o).remove(0);
    let z = Zone { page: 1, x: 0.0, y: 0.0, largeur: 0.5, hauteur: 1.0 };
    let (c, r) = caviarder(d.path(), &e, vec![z]);
    assert_eq!(r.images_masquees, 1);
    let doc = pdf::charger(&std::fs::read(&c).unwrap(), None).unwrap();
    let imgs = pdf::images::extraire_images(&doc).unwrap();
    assert_eq!(imgs.len(), 1, "l'image d'origine doit avoir été purgée");
    let img = image::load_from_memory(&imgs[0].octets).unwrap().to_rgb8();
    assert_eq!(img.get_pixel(10, 50).0, [0, 0, 0]);
    assert_eq!(img.get_pixel(190, 50).0, [250, 250, 250]);
}

#[test]
fn caviardage_supprime_les_annotations_touchees() {
    use forge_convert::pdf::annotations::Annotation;
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Texte"]]));
    let a = appliquer(d.path(), &e, vec![ActionPdf::Annoter { annotations: vec![Annotation::Note { page: 1, x: 0.5, y: 0.5, texte: "note privée".into(), auteur: None }] }], "a.pdf");
    let (c, r) = caviarder(d.path(), &a, vec![Zone { page: 1, x: 0.45, y: 0.45, largeur: 0.1, hauteur: 0.1 }]);
    assert_eq!(r.annotations_supprimees, 1);
    let Output::Annotations { contenus } = run(Operation::ListerAnnotations { entree: c, page: 1 }).unwrap() else { panic!() };
    assert!(contenus.is_empty());
}

#[test]
fn caviardage_page_inexistante_refuse() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Texte"]]));
    let r = run(Operation::Pdf {
        entree: e,
        mot_de_passe: None,
        actions: vec![ActionPdf::Caviarder { zones: vec![Zone { page: 4, x: 0.0, y: 0.0, largeur: 1.0, hauteur: 1.0 }] }],
        sortie: cible(d.path(), "c.pdf"),
    });
    assert!(matches!(r, Err(ConvertError::Parametre(_))));
}

#[test]
fn correctif_remplace_reellement_le_texte() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Montant 1000 euros"]]));
    let zone = zone_mot(1, "Montant ", "1000", 780.0);
    let c = Correctif { zone, texte: "2500".into(), taille: 12.0, fond: Couleur::BLANC, couleur: Couleur::NOIR };
    let s = appliquer(d.path(), &e, vec![ActionPdf::CorrigerTexte { correctifs: vec![c] }], "s.pdf");
    let t = texte(&s);
    assert!(t.contains("2500") && !t.contains("1000") && t.contains("euros"), "{t}");
    assert!(!contient_partout(&s, "1000"));
}

#[test]
fn images_vers_pdf_png_et_jpeg_sans_recompression() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    image::RgbaImage::from_pixel(40, 30, image::Rgba([10, 20, 30, 128])).save(&png).unwrap();
    let jpg = d.path().join("b.jpg");
    image::RgbImage::from_pixel(64, 48, image::Rgb([200, 100, 50])).save(&jpg).unwrap();
    let o = run(Operation::ImagesVersPdf { entrees: vec![png, jpg.clone()], sortie: cible(d.path(), "i.pdf") }).unwrap();
    let p = fichiers(o).remove(0);
    assert_eq!(nb_pages(&p), 2);
    let doc = pdf::charger(&std::fs::read(&p).unwrap(), None).unwrap();
    let jpeg = std::fs::read(&jpg).unwrap();
    let repris = doc.objects.values().any(|o| matches!(o, Object::Stream(s) if s.content == jpeg));
    assert!(repris, "le JPEG doit être intégré tel quel");
    let masque = doc.objects.values().any(|o| matches!(o, Object::Stream(s) if s.dict.has(b"SMask")));
    assert!(masque, "la transparence PNG doit produire un SMask");
}

#[test]
fn extraction_des_images() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    image::RgbImage::from_pixel(20, 10, image::Rgb([1, 2, 3])).save(&png).unwrap();
    let p = fichiers(run(Operation::ImagesVersPdf { entrees: vec![png], sortie: cible(d.path(), "i.pdf") }).unwrap()).remove(0);
    let sortie = tempfile::tempdir().unwrap();
    let o = fichiers(run(Operation::ExtraireImages { entree: p, mot_de_passe: None, sortie: cible(sortie.path(), "doc.pdf") }).unwrap());
    assert_eq!(o.len(), 1);
    let img = image::open(&o[0]).unwrap();
    assert_eq!((img.width(), img.height()), (20, 10));
}

#[test]
fn extraction_de_texte_par_page() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["Premier été"], &["Second"]]));
    let Output::Texte { texte, pages } = run(Operation::ExtraireTexte { entree: e, mot_de_passe: None }).unwrap() else { panic!() };
    assert_eq!(pages.len(), 2);
    assert!(pages[0].texte.contains("Premier été"));
    assert!(texte.contains("--- Page 2 ---"));
}

#[test]
fn comparaison_de_deux_pdf() {
    let d = tempfile::tempdir().unwrap();
    let a = ecrire(d.path(), "a.pdf", &pdf_pages(&[&["un", "deux", "trois"]]));
    let b = ecrire(d.path(), "b.pdf", &pdf_pages(&[&["un", "deux bis", "trois"]]));
    let Output::Comparaison(c) = run(Operation::Comparer { a: a.clone(), b }).unwrap() else { panic!() };
    assert!(!c.identiques && c.ajouts >= 1 && c.suppressions >= 1);
    assert!(c.html.contains("deux bis"));
    let Output::Comparaison(c) = run(Operation::Comparer { a: a.clone(), b: a }).unwrap() else { panic!() };
    assert!(c.identiques);
}

#[test]
fn caviardage_purge_miniature_xmp_info_signets_champs_et_structure() {
    use lopdf::StringFormat::Literal;
    let d = tempfile::tempdir().unwrap();
    let mut doc = pdf::charger(&pdf_pages(&[&["Public SECRET fin"]]), None).unwrap();
    let page = *doc.get_pages().get(&1).unwrap();
    let miniature = doc.add_object(Stream::new(dictionary! {}, b"miniature SECRET".to_vec()));
    let xmp = doc.add_object(Stream::new(dictionary! { "Type" => "Metadata", "Subtype" => "XML" }, b"<x>SECRET</x>".to_vec()));
    let info = doc.add_object(dictionary! { "Title" => Object::String(b"dossier SECRET".to_vec(), Literal), "Author" => Object::String(b"Ada".to_vec(), Literal) });
    let signet = doc.add_object(dictionary! { "Title" => Object::String(b"Chapitre SECRET".to_vec(), Literal) });
    let signet_ok = doc.add_object(dictionary! { "Title" => Object::String(b"Introduction".to_vec(), Literal) });
    let champ = doc.add_object(dictionary! {
        "Type" => "Annot", "Subtype" => "Widget", "FT" => "Tx", "T" => Object::String(b"nom".to_vec(), Literal),
        "V" => Object::String(b"SECRET".to_vec(), Literal), "Rect" => vec![0.into(), 0.into(), 10.into(), 10.into()],
    });
    let struc = doc.add_object(dictionary! { "Type" => "StructElem", "S" => "P", "ActualText" => Object::String(b"SECRET".to_vec(), Literal) });
    let plan = doc.add_object(dictionary! { "Type" => "Outlines", "First" => signet, "Last" => signet_ok, "Count" => 2 });
    {
        let p = doc.get_dictionary_mut(page).unwrap();
        p.set("Thumb", miniature);
        p.set("Metadata", xmp);
        p.set("Annots", vec![champ.into()]);
    }
    let cat_id = doc.trailer.get(b"Root").unwrap().as_reference().unwrap();
    {
        let c = doc.get_dictionary_mut(cat_id).unwrap();
        c.set("Metadata", xmp);
        c.set("Outlines", plan);
        c.set("StructTreeRoot", struc);
    }
    doc.trailer.set("Info", info);
    let e = ecrire(d.path(), "annexes.pdf", &pdf::enregistrer(&mut doc).unwrap());
    assert!(contient_partout(&e, "SECRET"));

    let (c, r) = caviarder(d.path(), &e, vec![zone_mot(1, "Public ", "SECRET", 780.0)]);
    assert!(!contient_partout(&c, "SECRET"), "le texte caviardé survit dans le fichier");
    assert!(contient_partout(&c, "Introduction"), "un signet sans rapport doit rester");
    assert!(contient_partout(&c, "Public"));
    assert!(r.avertissements.len() == 2, "{:?}", r.avertissements);
    assert!(r.avertissements.iter().any(|a| a.contains("métadonnées")));
}
