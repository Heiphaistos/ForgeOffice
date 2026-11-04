//! Conversions de fichiers, entrees hostiles, capacites, API JSON.
#![allow(clippy::unwrap_used, clippy::expect_used)]
mod commun;

use commun::*;
use forge_convert::conv::OptionsConversion;
use forge_convert::fichiers::{analyser_pages, valider_nom};
use forge_convert::{capacites, run, Cible, ConvertError, Operation, Output};
use std::io::Write;
use std::path::{Path, PathBuf};

fn convertir(dir: &Path, entree: &Path, vers: &str) -> PathBuf {
    let nom = format!("sortie.{vers}");
    let o = run(Operation::Convertir { entree: entree.into(), vers: vers.into(), options: OptionsConversion::default(), sortie: cible(dir, &nom) });
    fichiers(o.unwrap_or_else(|e| panic!("{entree:?} -> {vers} : {e}"))).remove(0)
}

fn lire(p: &Path) -> String {
    std::fs::read_to_string(p).unwrap()
}

#[test]
fn txt_vers_pdf_garde_les_accents() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.txt", "Été à Noël\nseconde ligne".as_bytes());
    let p = convertir(d.path(), &e, "pdf");
    let t = texte(&p);
    assert!(t.contains("Été à Noël") && t.contains("seconde ligne"), "{t}");
}

#[test]
fn markdown_vers_html_et_texte() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.md", b"# Titre\n\nUn *paragraphe*.");
    assert!(lire(&convertir(d.path(), &e, "html")).contains("<h1>Titre</h1>"));
    let t = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(t.path(), &e, "txt")).contains("Un paragraphe."));
}

#[test]
fn csv_vers_json_et_injection_de_formule_neutralisee() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.csv", b"nom,age\nAlice,30\nBob,41\n");
    let v: serde_json::Value = serde_json::from_str(&lire(&convertir(d.path(), &e, "json"))).unwrap();
    assert_eq!(v[1]["nom"], "Bob");
    let j = tempfile::tempdir().unwrap();
    let e = ecrire(j.path(), "b.json", br#"[{"f":"=CMD()"}]"#);
    let csv = lire(&convertir(j.path(), &e, "csv"));
    assert!(!csv.contains("\n=CMD"), "{csv}");
}

#[test]
fn json_vers_yaml_toml_xml() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.json", br#"{"titre":"R&D","n":3}"#);
    assert!(lire(&convertir(d.path(), &e, "yaml")).contains("titre: R&D"));
    let t = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(t.path(), &e, "toml")).contains("n = 3"));
    let x = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(x.path(), &e, "xml")).contains("R&amp;D"));
}

#[test]
fn csv_vers_xlsx_puis_retour() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.csv", b"ville,pop\nLyon,522000\n");
    let x = convertir(d.path(), &e, "xlsx");
    let r = tempfile::tempdir().unwrap();
    let csv = lire(&convertir(r.path(), &x, "csv"));
    assert!(csv.contains("Lyon") && csv.contains("522000"), "{csv}");
}

#[test]
fn texte_vers_docx_puis_retour() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.txt", "Bonjour l'équipe".as_bytes());
    let x = convertir(d.path(), &e, "docx");
    let r = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(r.path(), &x, "txt")).contains("Bonjour l'équipe"));
}

#[test]
fn texte_vers_odt_rtf_epub() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.txt", b"Chapitre un");
    for f in ["odt", "rtf", "epub"] {
        let s = convertir(d.path(), &e, f);
        assert!(std::fs::metadata(&s).unwrap().len() > 20, "{f}");
    }
}

#[test]
fn pdf_vers_html_et_docx() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.pdf", &pdf_pages(&[&["Rapport <final>"]]));
    assert!(lire(&convertir(d.path(), &e, "html")).contains("Rapport &lt;final&gt;"));
    let s = convertir(d.path(), &e, "docx");
    let r = tempfile::tempdir().unwrap();
    let t = lire(&convertir(r.path(), &s, "txt"));
    assert!(t.contains("Rapport <final>"), "{t:?}");
}

#[test]
fn image_png_vers_jpg_redimensionnee() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    image::RgbImage::from_pixel(100, 50, image::Rgb([9, 9, 9])).save(&png).unwrap();
    let opts = OptionsConversion { largeur: Some(40), qualite: Some(80), ..Default::default() };
    let o = run(Operation::Convertir { entree: png, vers: "jpg".into(), options: opts, sortie: cible(d.path(), "b.jpg") }).unwrap();
    let img = image::open(&fichiers(o)[0]).unwrap();
    assert_eq!((img.width(), img.height()), (40, 20));
}

#[test]
fn svg_vers_png_et_pdf() {
    let d = tempfile::tempdir().unwrap();
    let svg = ecrire(d.path(), "a.svg", br#"<svg xmlns="http://www.w3.org/2000/svg" width="30" height="20"><rect width="30" height="20" fill="red"/></svg>"#);
    let p = convertir(d.path(), &svg, "png");
    assert_eq!(image::open(&p).unwrap().width(), 30);
    assert_eq!(nb_pages(&convertir(d.path(), &svg, "pdf")), 1);
}

#[test]
fn svg_geant_refuse() {
    let d = tempfile::tempdir().unwrap();
    let svg = ecrire(d.path(), "a.svg", br#"<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"></svg>"#);
    let r = run(Operation::Convertir { entree: svg, vers: "png".into(), options: Default::default(), sortie: cible(d.path(), "b.png") });
    assert!(r.is_err());
}

#[test]
fn zip_vers_tar_assainit_les_noms() {
    let d = tempfile::tempdir().unwrap();
    let chemin = d.path().join("a.zip");
    {
        let mut z = zip::ZipWriter::new(std::fs::File::create(&chemin).unwrap());
        let o = zip::write::SimpleFileOptions::default();
        z.start_file("../../evil.txt", o).unwrap();
        z.write_all(b"x").unwrap();
        z.start_file("ok/bon.txt", o).unwrap();
        z.write_all(b"y").unwrap();
        z.finish().unwrap();
    }
    let t = convertir(d.path(), &chemin, "tar");
    let mut a = tar::Archive::new(std::fs::File::open(&t).unwrap());
    let noms: Vec<String> = a.entries().unwrap().map(|e| e.unwrap().path().unwrap().to_string_lossy().into_owned()).collect();
    assert!(!noms.is_empty());
    assert!(noms.iter().all(|n| !n.contains("..")), "{noms:?}");
}

#[test]
fn wav_vers_flac() {
    let d = tempfile::tempdir().unwrap();
    let wav = d.path().join("a.wav");
    let spec = hound::WavSpec { channels: 1, sample_rate: 8000, bits_per_sample: 16, sample_format: hound::SampleFormat::Int };
    let mut w = hound::WavWriter::create(&wav, spec).unwrap();
    for i in 0..8000i32 {
        w.write_sample(((i as f32 * 0.05).sin() * 8000.0) as i16).unwrap();
    }
    w.finalize().unwrap();
    let f = convertir(d.path(), &wav, "flac");
    assert_eq!(&std::fs::read(&f).unwrap()[..4], b"fLaC");
}

#[test]
fn sous_titres_srt_vers_vtt() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.srt", b"1\n00:00:01,000 --> 00:00:02,500\nBonjour\n\n");
    let v = lire(&convertir(d.path(), &e, "vtt"));
    assert!(v.starts_with("WEBVTT") && v.contains("00:00:01.000"), "{v}");
}

#[test]
fn conversion_non_supportee() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "a.mp3", b"ID3");
    let r = run(Operation::Convertir { entree: e, vers: "docx".into(), options: Default::default(), sortie: cible(d.path(), "b.docx") });
    assert!(matches!(r, Err(ConvertError::NonSupporte { .. })));
}

#[test]
fn miniature_png_en_data_url() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("a.png");
    image::RgbImage::from_pixel(300, 300, image::Rgb([0, 0, 255])).save(&png).unwrap();
    let Output::Image { data_url } = run(Operation::Miniature { entree: png }).unwrap() else { panic!() };
    assert!(data_url.starts_with("data:image/png;base64,"));
}

#[test]
fn zipper_dedoublonne_les_noms() {
    let d = tempfile::tempdir().unwrap();
    let s1 = d.path().join("s1");
    let s2 = d.path().join("s2");
    std::fs::create_dir_all(&s1).unwrap();
    std::fs::create_dir_all(&s2).unwrap();
    let a = ecrire(&s1, "x.txt", b"1");
    let b = ecrire(&s2, "x.txt", b"2");
    let z = fichiers(run(Operation::Zipper { entrees: vec![a, b], sortie: cible(d.path(), "t.zip") }).unwrap()).remove(0);
    let ar = zip::ZipArchive::new(std::fs::File::open(z).unwrap()).unwrap();
    let noms: Vec<String> = ar.file_names().map(|n| n.unwrap().into_owned()).collect();
    assert_eq!(noms, vec!["x.txt".to_string(), "2-x.txt".to_string()]);
}

// ── Entrees hostiles ───────────────────────────────────────────────────────────

#[test]
fn noms_de_sortie_hostiles_refuses() {
    for nom in ["../evil.pdf", "..\\evil.pdf", "a/b.pdf", "C:\\x.pdf", "CON.pdf", "nul", "", "..", "x.pdf.", "a\u{0}b.pdf", "a:b.pdf"] {
        assert!(matches!(valider_nom(nom), Err(ConvertError::CheminRefuse(_))), "« {nom} » aurait dû être refusé");
    }
    assert!(valider_nom("Rapport final (v2).pdf").is_ok());
}

#[test]
fn sortie_hostile_refusee_par_run_sans_rien_ecrire() {
    let d = tempfile::tempdir().unwrap();
    let sous = d.path().join("sous");
    std::fs::create_dir(&sous).unwrap();
    let e = ecrire(&sous, "e.pdf", &pdf_pages(&[&["x"]]));
    let r = run(Operation::Pdf { entree: e, mot_de_passe: None, actions: vec![], sortie: Cible::nouvelle(&sous, "../fuite.pdf") });
    assert!(matches!(r, Err(ConvertError::CheminRefuse(_))));
    assert!(!d.path().join("fuite.pdf").exists());
}

#[test]
fn fichier_existant_non_ecrase_sauf_demande() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["x"]]));
    ecrire(d.path(), "s.pdf", b"ancien");
    let op = |ecraser| Operation::Pdf { entree: e.clone(), mot_de_passe: None, actions: vec![], sortie: Cible { dossier: d.path().into(), nom: "s.pdf".into(), ecraser } };
    assert!(matches!(run(op(false)), Err(ConvertError::CheminRefuse(_))));
    assert_eq!(std::fs::read(d.path().join("s.pdf")).unwrap(), b"ancien");
    run(op(true)).unwrap();
    assert_eq!(nb_pages(&d.path().join("s.pdf")), 1);
    // Aucun fichier temporaire « .part » ne reste.
    assert!(std::fs::read_dir(d.path()).unwrap().all(|f| !f.unwrap().file_name().to_string_lossy().ends_with(".part")));
}

#[test]
fn entree_dossier_ou_absente_refusee() {
    let d = tempfile::tempdir().unwrap();
    let r = run(Operation::Infos { entree: d.path().into(), mot_de_passe: None });
    assert!(matches!(r, Err(ConvertError::Lecture(_))));
    let r = run(Operation::Infos { entree: d.path().join("absent.pdf"), mot_de_passe: None });
    assert!(matches!(r, Err(ConvertError::Lecture(_))));
}

#[test]
fn pdf_invalide_ou_tronque_refuse() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "faux.pdf", b"<html>pas un pdf</html>");
    assert!(matches!(run(Operation::Infos { entree: e, mot_de_passe: None }), Err(ConvertError::PdfInvalide(_))));
    let mut octets = pdf_pages(&[&["x"]]);
    octets.truncate(octets.len() / 3);
    let e = ecrire(d.path(), "tronque.pdf", &octets);
    assert!(run(Operation::Infos { entree: e, mot_de_passe: None }).is_err());
}

#[test]
fn selection_de_pages_hostile_refusee() {
    for s in ["0", "5-2", "abc", "1-99", "", "-", "3,"] {
        let r = analyser_pages(s, 3);
        if s == "-" || s == "3," {
            assert!(r.is_ok(), "{s}");
        } else {
            assert!(r.is_err(), "« {s} » aurait dû être refusé");
        }
    }
    assert_eq!(analyser_pages("1, 3-", 4).unwrap(), vec![1, 3, 4]);
}

#[test]
fn langue_ocr_hostile_refusee_avant_tout_lancement() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["x"]]));
    for langue in ["--sidecar=/etc/passwd", "fra;rm", "FRA", "+eng", ""] {
        let r = run(Operation::Ocr { entree: e.clone(), langue: langue.into(), forcer: false, sortie: cible(d.path(), "o.pdf") });
        assert!(matches!(r, Err(ConvertError::Parametre(_))), "{langue} : {r:?}");
    }
}

#[test]
fn outil_externe_absent_donne_une_erreur_francaise() {
    let caps = capacites();
    let pdfa = caps.operations.iter().find(|c| c.operation == "pdf_a").unwrap();
    if pdfa.disponible {
        return; // Ghostscript installe sur cette machine : rien a verifier ici.
    }
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["x"]]));
    let err = run(Operation::PdfA { entree: e, sortie: cible(d.path(), "a.pdf") }).unwrap_err();
    assert!(matches!(err, ConvertError::OutilAbsent { .. }));
    assert!(err.to_string().contains("Ghostscript"));
}

#[test]
fn capacites_listent_le_pur_rust_et_les_outils() {
    let Output::Capacites(c) = run(Operation::Capacites).unwrap() else { panic!() };
    for op in ["caviarder", "chiffrer", "compresser", "fusionner", "convertir"] {
        assert!(c.operations.iter().any(|x| x.operation == op && x.disponible && x.outil.is_none()), "{op}");
    }
    for op in ["pdf_a", "ocr", "pdf_vers_images", "office_haute_fidelite"] {
        let x = c.operations.iter().find(|x| x.operation == op).unwrap();
        assert!(x.outil.is_some());
        assert_eq!(x.disponible, x.raison.is_none());
    }
    assert_eq!(c.outils.len(), 6);
}

#[test]
fn operation_depuis_json() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "e.pdf", &pdf_pages(&[&["a"], &["b"]]));
    let json = serde_json::json!({
        "op": "pdf",
        "entree": e,
        "actions": [
            { "action": "pivoter", "degres": 90 },
            { "action": "texte_pages", "gabarit": "{page}/{total}" },
            { "action": "compresser", "niveau": "sans_perte" }
        ],
        "sortie": { "dossier": d.path(), "nom": "j.pdf" }
    });
    let op: Operation = serde_json::from_value(json).unwrap();
    let o = run(op).unwrap();
    let v = serde_json::to_value(&o).unwrap();
    assert_eq!(v["type"], "fichiers");
    let err = serde_json::to_value(ConvertError::MotDePasse).unwrap();
    assert_eq!(err["type"], "mot_de_passe");
    assert!(texte(&d.path().join("j.pdf")).contains("2/2"));
}

#[test]
fn xls_malforme_donne_une_erreur_pas_un_panic() {
    // Signature CFB/OLE2 suivie de bruit : calamine < 0.38 paniquait (RUSTSEC-2026-0436).
    let d = tempfile::tempdir().unwrap();
    let mut octets = vec![0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    octets.extend((0..4096u32).map(|i| (i.wrapping_mul(2654435761) >> 13) as u8));
    let e = ecrire(d.path(), "casse.xls", &octets);
    let r = run(Operation::Convertir { entree: e, vers: "csv".into(), options: OptionsConversion::default(), sortie: cible(d.path(), "s.csv") });
    assert!(r.is_err(), "un xls malformé doit être refusé proprement");
}

#[test]
fn svg_ne_lit_pas_les_fichiers_locaux() {
    let d = tempfile::tempdir().unwrap();
    let png = d.path().join("rouge.png");
    image::RgbaImage::from_pixel(10, 10, image::Rgba([255, 0, 0, 255])).save(&png).unwrap();
    let href = png.to_str().unwrap().replace(std::path::MAIN_SEPARATOR, "/");
    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"10\" height=\"10\"><image width=\"10\" height=\"10\" xlink:href=\"{href}\"/></svg>"
    );
    let e = ecrire(d.path(), "a.svg", svg.as_bytes());
    let img = forge_convert::conv::images::svg_to_dynamic_image(e.to_str().unwrap()).unwrap().to_rgba8();
    assert!(img.pixels().all(|p| p.0[3] == 0), "le PNG local ne doit pas être embarqué");
}

#[test]
fn epub_relu_vers_txt_html_md() {
    let d = tempfile::tempdir().unwrap();
    let e = ecrire(d.path(), "livre.txt", "Premier & dernier".as_bytes());
    let epub = convertir(d.path(), &e, "epub");
    let t = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(t.path(), &epub, "txt")).contains("Premier & dernier"));
    let h = tempfile::tempdir().unwrap();
    let html = lire(&convertir(h.path(), &epub, "html"));
    assert!(html.contains("Premier &amp; dernier") && html.contains("<title>"), "{html}");
    let m = tempfile::tempdir().unwrap();
    assert!(lire(&convertir(m.path(), &epub, "md")).contains("Premier"));
}

#[test]
fn haute_fidelite_est_signalee_et_l_outil_absent_reste_une_erreur_claire() {
    let o = OptionsConversion { haute_fidelite: true, ..Default::default() };
    assert!(forge_convert::conv::utilise_libreoffice(Path::new("a.DOCX"), "pdf", &o));
    assert!(!forge_convert::conv::utilise_libreoffice(Path::new("a.txt"), "pdf", &o));
    assert!(!forge_convert::conv::utilise_libreoffice(Path::new("a.docx"), "pdf", &OptionsConversion::default()));
    assert!(forge_convert::pdf::externe::AVERTISSEMENT_LIBREOFFICE.contains("liens externes"));
    if !capacites().operations.iter().any(|x| x.operation == "office_haute_fidelite" && x.disponible) {
        let d = tempfile::tempdir().unwrap();
        let e = ecrire(d.path(), "a.docx", b"PK");
        let r = run(Operation::Convertir { entree: e, vers: "pdf".into(), options: o, sortie: cible(d.path(), "s.pdf") });
        assert!(matches!(r, Err(ConvertError::OutilAbsent { .. })), "{r:?}");
    }
}
