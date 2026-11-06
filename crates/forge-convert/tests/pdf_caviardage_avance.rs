//! Caviardage avance : traits vectoriels, pages pivotees, CropBox, mots courts, images.
#![allow(clippy::unwrap_used, clippy::expect_used)]
mod commun;

use commun::*;
use forge_convert::pdf::{self, caviardage::RapportCaviardage, Zone};
use forge_convert::{run, ActionPdf, Operation, Output};
use lopdf::Object;
use std::path::{Path, PathBuf};

fn caviarder(dir: &Path, e: &Path, zones: Vec<Zone>) -> (PathBuf, RapportCaviardage) {
    let o = run(Operation::Pdf { entree: e.into(), mot_de_passe: None, actions: vec![ActionPdf::Caviarder { zones }], sortie: cible(dir, "c.pdf") }).unwrap();
    let Output::Fichiers { mut fichiers, caviardage, .. } = o else { panic!() };
    (fichiers.remove(0), caviardage.unwrap())
}

fn nombre(o: &Object) -> f32 {
    match o {
        Object::Integer(i) => *i as f32,
        Object::Real(r) => *r,
        _ => f32::NAN,
    }
}

const TRACES: &str = "q 1 0 0 RG 2 w 100 600 m 300 600 l S Q\n0 0 1 rg 77 513 91 37 re f\n0.5 G 120 300 m 520 300 l S\n100 100 m 500 100 l S\nBT /F1 12 Tf 50 700 Td (Titre) Tj ET";

#[test]
fn caviardage_supprime_les_traits_vectoriels_sous_les_zones() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "t.pdf", &pdf_contenu(TRACES, vec![]));
    assert!(contient_partout(&e, "100 600 m") && contient_partout(&e, "77 513"));
    let zones = vec![zone_pts(1, 90.0, 590.0, 310.0, 610.0), zone_pts(1, 70.0, 505.0, 180.0, 555.0), zone_pts(1, 250.0, 290.0, 300.0, 310.0)];
    let (c, r) = caviarder(d.path(), &e, zones);
    assert_eq!((r.traits_supprimes, r.traits_ecretes), (2, 1), "{r:?}");
    // Les operateurs d'origine ont disparu du fichier brut et de tous les flux decompresses.
    assert!(!contient_partout(&c, "100 600 m") && !contient_partout(&c, "77 513"));
    let ops = operateurs_page1(&c);
    // Le trait a moitie couvert est coupe : aucun point entre x = 250 et 300 sur y = 300.
    let sur_300: Vec<f32> = ops
        .iter()
        .filter(|o| matches!(o.operator.as_str(), "m" | "l") && (nombre(&o.operands[1]) - 300.0).abs() < 0.01)
        .map(|o| nombre(&o.operands[0]))
        .collect();
    assert!(sur_300.len() >= 4, "{sur_300:?}");
    assert!(sur_300.iter().all(|&x| !(251.5..298.5).contains(&x)), "{sur_300:?}");
    assert!(sur_300.iter().any(|&x| (x - 120.0).abs() < 0.01) && sur_300.iter().any(|&x| (x - 520.0).abs() < 0.01));
    // Le trait voisin et le texte restent.
    assert!(contient_partout(&c, "100 100 m"));
    assert!(texte(&c).contains("Titre"));
}

#[test]
fn caviardage_des_traits_est_sans_effet_hors_zone() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "t.pdf", &pdf_contenu(TRACES, vec![]));
    let (c, r) = caviarder(d.path(), &e, vec![zone_pts(1, 10.0, 10.0, 50.0, 50.0)]);
    assert_eq!((r.traits_supprimes, r.traits_ecretes), (0, 0));
    assert!(contient_partout(&c, "100 600 m") && contient_partout(&c, "77 513"));
}

#[test]
fn caviardage_garde_l_ecretage_d_un_chemin_supprime() {
    let d = tempfile::tempdir().unwrap();
    // Le rectangle 60 600 100 20 sert d'ecretage (W n) : il doit survivre pour ne pas elargir la zone visible.
    let e = ecrire(d.path(), "w.pdf", &pdf_contenu("q 60 600 100 20 re W n 0 g 0 0 700 700 re f Q BT /F1 12 Tf 50 300 Td (ok) Tj ET", vec![]));
    let (c, r) = caviarder(d.path(), &e, vec![zone_pts(1, 10.0, 590.0, 200.0, 640.0)]);
    assert!(r.traits_supprimes >= 1 || r.traits_ecretes >= 1, "{r:?}");
    let ops = operateurs_page1(&c);
    let ecretage = ops.iter().position(|o| o.operator == "W").expect("l'écrêtage W doit rester");
    assert_eq!(ops[ecretage + 1].operator, "n");
}

#[test]
fn caviardage_tient_compte_de_la_rotation_de_la_page() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "r.pdf", &pdf_contenu("BT /F1 12 Tf 50 780 Td (Public SECRET fin) Tj ET", vec![("Rotate", 90.into())]));
    // Page affichee a 90 degres : u = Y, v = X. SECRET occupe v dans [x0, x0 + l], u dans [777, 791].
    let x0 = 50.0 + pdf::largeur_texte("Helvetica", "Public ", 12.0);
    let l = pdf::largeur_texte("Helvetica", "SECRET", 12.0);
    let (wd, hd) = (A4.1, A4.0);
    let z = Zone { page: 1, x: 777.0 / wd, y: (x0 + 1.0) / hd, largeur: 14.0 / wd, hauteur: (l - 2.0) / hd };
    let (c, r) = caviarder(d.path(), &e, vec![z]);
    assert_eq!(r.glyphes_supprimes, 6, "{r:?}");
    let t = texte(&c);
    assert!(!t.contains("SECRET") && t.contains("Public") && t.contains("fin"), "{t}");
    assert!(!contient_partout(&c, "SECRET"));
    // Le recouvrement noir est bien pose sur le texte, pas dans le coin oppose.
    let ops = operateurs_page1(&c);
    let re = ops.iter().rev().find(|o| o.operator == "re").unwrap();
    let (rx, ry) = (nombre(&re.operands[0]), nombre(&re.operands[1]));
    assert!((rx - x0).abs() < 3.0 && (ry - 777.0).abs() < 3.0, "re = {:?}", re.operands);
}

#[test]
fn caviardage_toutes_les_rotations_visent_le_meme_texte() {
    for rot in [0i64, 90, 180, 270] {
        let d = tempfile::tempdir().unwrap();
        let e = ecrire(d.path(), "r.pdf", &pdf_contenu("BT /F1 12 Tf 100 400 Td (SECRET) Tj ET", vec![("Rotate", rot.into())]));
        let (w, h) = (A4.0, A4.1);
        // Rectangle du texte en espace utilisateur : [99,396]..[150,410] ; on le projette sur la page affichee.
        let (x0, y0, x1, y1) = (99.0f32, 396.0f32, 150.0f32, 410.0f32);
        let (wd, hd, u0, u1, v0, v1) = match rot {
            0 => (w, h, x0, x1, h - y1, h - y0),
            90 => (h, w, y0, y1, x0, x1),
            180 => (w, h, w - x1, w - x0, y0, y1),
            _ => (h, w, h - y1, h - y0, w - x1, w - x0),
        };
        let z = Zone { page: 1, x: u0 / wd, y: v0 / hd, largeur: (u1 - u0) / wd, hauteur: (v1 - v0) / hd };
        let (c, r) = caviarder(d.path(), &e, vec![z]);
        assert_eq!(r.glyphes_supprimes, 6, "rotation {rot} : {r:?}");
        assert!(!contient_partout(&c, "SECRET"), "rotation {rot}");
    }
}

#[test]
fn caviardage_tient_compte_de_la_cropbox() {
    let d = tempfile::tempdir().unwrap();
    let crop: Vec<Object> = vec![50.into(), 50.into(), 500.into(), 800.into()];
    let e = ecrire(d.path(), "k.pdf", &pdf_contenu("BT /F1 12 Tf 100 700 Td (Code SECRET) Tj ET", vec![("CropBox", Object::Array(crop))]));
    let x0 = 100.0 + pdf::largeur_texte("Helvetica", "Code ", 12.0);
    let l = pdf::largeur_texte("Helvetica", "SECRET", 12.0);
    // Normalise par rapport a la CropBox (450 x 750), origine en haut a gauche de la CropBox.
    let z = Zone { page: 1, x: (x0 + 1.0 - 50.0) / 450.0, y: (800.0 - 710.0) / 750.0, largeur: (l - 2.0) / 450.0, hauteur: 14.0 / 750.0 };
    let (c, r) = caviarder(d.path(), &e, vec![z]);
    assert_eq!(r.glyphes_supprimes, 6, "{r:?}");
    assert!(texte(&c).contains("Code") && !texte(&c).contains("SECRET"));
}

/// Ajoute un signet (titre) au PDF et renvoie l'identifiant ; `racine` = objets du plan.
fn avec_annexes(octets: &[u8], signets: &[&str], champ: Option<&str>) -> Vec<u8> {
    use lopdf::{dictionary, Document, StringFormat::Literal};
    let mut doc = Document::load_mem(octets).unwrap();
    let page = *doc.get_pages().get(&1).unwrap();
    let ids: Vec<_> = signets.iter().map(|t| doc.add_object(dictionary! { "Title" => Object::String(t.as_bytes().to_vec(), Literal) })).collect();
    let plan = doc.add_object(dictionary! { "Type" => "Outlines", "First" => ids[0], "Last" => ids[ids.len() - 1], "Count" => ids.len() as i64 });
    let cat = doc.trailer.get(b"Root").unwrap().as_reference().unwrap();
    doc.get_dictionary_mut(cat).unwrap().set("Outlines", plan);
    if let Some(v) = champ {
        let c = doc.add_object(dictionary! {
            "Type" => "Annot", "Subtype" => "Widget", "FT" => "Tx", "T" => Object::String(b"ref".to_vec(), Literal),
            "V" => Object::String(v.as_bytes().to_vec(), Literal), "Rect" => vec![500.into(), 20.into(), 560.into(), 40.into()],
        });
        doc.get_dictionary_mut(page).unwrap().set("Annots", vec![c.into()]);
    }
    pdf::enregistrer(&mut doc).unwrap()
}

#[test]
fn mot_court_vide_la_valeur_egale_sans_toucher_aux_signets_sans_rapport() {
    let d = tempfile::tempdir().unwrap();
    let base = pdf_contenu("BT /F1 12 Tf 50 700 Td (Ref 42 fin) Tj ET", vec![]);
    let e = ecrire(d.path(), "court.pdf", &avec_annexes(&base, &["Section 42", "Introduction"], Some("42")));
    let x0 = 50.0 + pdf::largeur_texte("Helvetica", "Ref ", 12.0);
    let l = pdf::largeur_texte("Helvetica", "42", 12.0);
    let (c, r) = caviarder(d.path(), &e, vec![zone_pts(1, x0 + 1.0, 696.0, x0 + l - 1.0, 712.0)]);
    assert_eq!(r.glyphes_supprimes, 2, "{r:?}");
    assert!(!texte(&c).contains("42") && texte(&c).contains("Ref") && texte(&c).contains("fin"));
    // La valeur du champ (« 42 » entier) est videe ; le signet « Section 42 » et « Introduction » restent.
    let doc = lopdf::Document::load_mem(&std::fs::read(&c).unwrap()).unwrap();
    let champ_garde = doc.objects.values().any(|o| matches!(o, Object::Dictionary(d) if d.get(b"V").is_ok()));
    assert!(!champ_garde, "la valeur du champ 42 doit être retirée");
    assert!(contient_partout(&c, "Section 42") && contient_partout(&c, "Introduction"));
    assert!(r.avertissements.iter().any(|a| a.contains("mot court")), "{:?}", r.avertissements);
}

#[test]
fn police_type0_avec_tounicode_retire_et_reconnait_le_texte() {
    use lopdf::{dictionary, Document, Stream, StringFormat::Literal};
    let d = tempfile::tempdir().unwrap();
    let mut doc = Document::with_version("1.7");
    let pages_id = doc.new_object_id();
    let cmap = b"/CIDInit begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange 1 beginbfrange <0001> <0004> <0053> endbfrange endcmap";
    let tu = doc.add_object(Stream::new(dictionary! {}, cmap.to_vec()));
    let desc = doc.add_object(dictionary! { "Type" => "Font", "Subtype" => "CIDFontType2", "BaseFont" => "Inconnue", "DW" => 1000 });
    let police = doc.add_object(dictionary! {
        "Type" => "Font", "Subtype" => "Type0", "BaseFont" => "Inconnue", "Encoding" => "Identity-H",
        "DescendantFonts" => vec![desc.into()], "ToUnicode" => tu,
    });
    // Quatre glyphes 12 pt de large (DW 1000) : codes 1 a 4 = S T U V d'apres le ToUnicode.
    let flux = doc.add_object(Stream::new(dictionary! {}, b"BT /F1 12 Tf 50 700 Td <0001000200030004> Tj ET".to_vec()));
    let page = doc.add_object(dictionary! {
        "Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), A4.0.into(), A4.1.into()],
        "Contents" => flux, "Resources" => dictionary! { "Font" => dictionary! { "F1" => police } },
    });
    doc.objects.insert(pages_id, Object::Dictionary(dictionary! { "Type" => "Pages", "Kids" => vec![page.into()], "Count" => 1 }));
    let cat = doc.add_object(dictionary! { "Type" => "Catalog", "Pages" => pages_id });
    doc.trailer.set("Root", cat);
    let signet = doc.add_object(dictionary! { "Title" => Object::String(b"Chapitre STUV".to_vec(), Literal) });
    let ok = doc.add_object(dictionary! { "Title" => Object::String(b"Annexe".to_vec(), Literal) });
    let plan = doc.add_object(dictionary! { "Type" => "Outlines", "First" => signet, "Last" => ok, "Count" => 2 });
    doc.get_dictionary_mut(cat).unwrap().set("Outlines", plan);
    let e = ecrire(d.path(), "t0.pdf", &pdf::enregistrer(&mut doc).unwrap());
    // Les glyphes 2 et 3 (x de 62 a 86) sont sous la zone.
    let (c, r) = caviarder(d.path(), &e, vec![zone_pts(1, 63.0, 696.0, 85.0, 712.0)]);
    assert_eq!(r.glyphes_supprimes, 2, "{r:?}");
    // Texte « TU » retire (mot court, signet different) : le signet « Chapitre STUV » n'est pas vide, « Annexe » reste.
    assert!(contient_partout(&c, "Annexe"));
    // Zone sur les 4 glyphes : le mot STUV est retire et le signet qui le reprend est vide.
    let d2 = tempfile::tempdir().unwrap();
    let (c2, r2) = caviarder(d2.path(), &e, vec![zone_pts(1, 51.0, 696.0, 97.0, 712.0)]);
    assert_eq!(r2.glyphes_supprimes, 4, "{r2:?}");
    assert!(!contient_partout(&c2, "Chapitre STUV"), "le signet reprenant le texte décodé par ToUnicode doit être vidé");
    assert!(contient_partout(&c2, "Annexe"));
}

#[test]
fn image_jpeg_avec_decode_est_noircie_au_lieu_d_etre_supprimee() {
    let d = tempfile::tempdir().unwrap();
    let jpg = d.path().join("blanc.jpg");
    image::RgbImage::from_pixel(200, 100, image::Rgb([250, 250, 250])).save(&jpg).unwrap();
    let o = run(Operation::ImagesVersPdf { entrees: vec![jpg], sortie: cible(d.path(), "img.pdf") }).unwrap();
    let e = fichiers(o).remove(0);
    // Ajoute /Decode [1 0 1 0 1 0] a l'image : le decodeur Flate/JPEG simple la refusait (donc supprimee).
    let mut doc = lopdf::Document::load_mem(&std::fs::read(&e).unwrap()).unwrap();
    for obj in doc.objects.values_mut() {
        if let Object::Stream(s) = obj {
            if s.dict.get(b"Subtype").and_then(Object::as_name).is_ok_and(|n| n == b"Image") {
                s.dict.set("Decode", vec![1.into(), 0.into(), 1.into(), 0.into(), 1.into(), 0.into()]);
            }
        }
    }
    let e2 = ecrire(d.path(), "decode.pdf", &pdf::enregistrer(&mut doc).unwrap());
    let sortie = tempfile::tempdir().unwrap();
    let (c, r) = caviarder(sortie.path(), &e2, vec![Zone { page: 1, x: 0.0, y: 0.0, largeur: 0.5, hauteur: 1.0 }]);
    assert_eq!((r.images_masquees, r.images_supprimees), (1, 0), "{r:?}");
    let doc = pdf::charger(&std::fs::read(&c).unwrap(), None).unwrap();
    let imgs = pdf::images::extraire_images(&doc).unwrap();
    assert_eq!(imgs.len(), 1);
    let img = image::load_from_memory(&imgs[0].octets).unwrap().to_rgb8();
    assert_eq!(img.get_pixel(10, 50).0, [0, 0, 0]);
    assert!(img.get_pixel(190, 50).0[0] < 12, "la moitié non couverte garde l'image (inversée par /Decode)");
}

#[test]
fn image_non_decodable_supprimee_et_annoncee_dans_les_avertissements() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    image::RgbImage::from_pixel(20, 10, image::Rgb([9, 9, 9])).save(&png).unwrap();
    let e = fichiers(run(Operation::ImagesVersPdf { entrees: vec![png], sortie: cible(d.path(), "i.pdf") }).unwrap()).remove(0);
    let mut doc = lopdf::Document::load_mem(&std::fs::read(&e).unwrap()).unwrap();
    for obj in doc.objects.values_mut() {
        if let Object::Stream(s) = obj {
            if s.dict.get(b"Subtype").and_then(Object::as_name).is_ok_and(|n| n == b"Image") {
                s.dict.set("BitsPerComponent", 4); // format que le moteur ne sait pas relire
            }
        }
    }
    let e2 = ecrire(d.path(), "x.pdf", &pdf::enregistrer(&mut doc).unwrap());
    let sortie = tempfile::tempdir().unwrap();
    let (_, r) = caviarder(sortie.path(), &e2, vec![Zone { page: 1, x: 0.0, y: 0.0, largeur: 0.5, hauteur: 1.0 }]);
    assert_eq!((r.images_masquees, r.images_supprimees), (0, 1));
    assert!(r.avertissements.iter().any(|a| a.contains("format non décodable")), "{:?}", r.avertissements);
}

#[test]
fn correctif_de_texte_sur_page_pivotee_ecrit_un_texte_droit() {
    use forge_convert::pdf::{caviardage::Correctif, Couleur};
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "c.pdf", &pdf_contenu("BT /F1 12 Tf 100 400 Td (ANCIEN) Tj ET", vec![("Rotate", 90.into())]));
    // Zone affichee sur « ANCIEN » (page a 90 degres : u = Y, v = X).
    let (wd, hd) = (A4.1, A4.0);
    let zone = Zone { page: 1, x: 396.0 / wd, y: 99.0 / hd, largeur: 14.0 / wd, hauteur: 50.0 / hd };
    let c = Correctif { zone, texte: "NOUVEAU".into(), taille: 12.0, fond: Couleur::BLANC, couleur: Couleur::NOIR };
    let s = appliquer(d.path(), &e, vec![ActionPdf::CorrigerTexte { correctifs: vec![c] }], "s.pdf");
    assert!(texte(&s).contains("NOUVEAU") && !texte(&s).contains("ANCIEN"), "{}", texte(&s));
    // Le texte ajoute est precede d'une rotation de 90 degres (cm 0 1 -1 0 ...).
    let ops = operateurs_page1(&s);
    assert!(ops.iter().any(|o| o.operator == "cm" && nombre(&o.operands[0]) == 0.0 && nombre(&o.operands[1]) == 1.0 && nombre(&o.operands[2]) == -1.0), "pas de matrice de rotation");
}
