//! Outils PDF de base : pages, tampons, metadonnees, securite, compression, formulaires.
#![allow(clippy::unwrap_used, clippy::expect_used)]
mod commun;

use commun::*;
use forge_convert::pdf::pages::{Decoupage, PageOrdre};
use forge_convert::pdf::securite::{Autorisations, Metadonnees};
use forge_convert::pdf::tampons::{Filigrane, TextePages};
use forge_convert::pdf::{self, Couleur};
use forge_convert::{run, ActionPdf, ConvertError, Operation, Output};

fn trois_pages(dir: &std::path::Path) -> std::path::PathBuf {
    ecrire(dir, "trois.pdf", &pdf_pages(&[&["Alpha un"], &["Beta deux"], &["Gamma trois"]]))
}

#[test]
fn infos_compte_les_pages() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    match run(Operation::Infos { entree: e, mot_de_passe: None }).unwrap() {
        Output::Infos(m) => assert_eq!(m.pages, 3),
        autre => panic!("{autre:?}"),
    }
}

#[test]
fn fusion_conserve_ordre_et_pages() {
    let d = tempfile::tempdir().unwrap();
    let a = trois_pages(d.path());
    let b = ecrire(d.path(), "b.pdf", &pdf_pages(&[&["Delta"], &["Epsilon"]]));
    let o = fichiers(run(Operation::Fusionner { entrees: vec![a, b], ordre: None, mots_de_passe: vec![], sortie: cible(d.path(), "f.pdf") }).unwrap());
    assert_eq!(nb_pages(&o[0]), 5);
    let t = texte(&o[0]);
    assert!(t.find("Alpha").unwrap() < t.find("Epsilon").unwrap());
}

#[test]
fn decoupage_chaque_page() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let o = fichiers(run(Operation::Decouper { entree: e, mot_de_passe: None, mode: Decoupage::ChaquePage, noms: vec![], sortie: cible(d.path(), "p.pdf") }).unwrap());
    assert_eq!(o.len(), 3);
    assert!(texte(&o[2]).contains("Gamma"));
    assert!(o[0].file_name().unwrap().to_str().unwrap().starts_with("p-1"));
}

#[test]
fn decoupage_par_plages() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let mode = Decoupage::Plages(vec!["1-2".into(), "3".into()]);
    let o = fichiers(run(Operation::Decouper { entree: e, mot_de_passe: None, mode, noms: vec![], sortie: cible(d.path(), "p.pdf") }).unwrap());
    assert_eq!(o.len(), 2);
    assert_eq!(nb_pages(&o[0]), 2);
}

#[test]
fn extraire_et_supprimer_des_pages() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let x = appliquer(d.path(), &e, vec![ActionPdf::ExtrairePages { pages: "2-3".into() }], "x.pdf");
    assert_eq!(nb_pages(&x), 2);
    assert!(!texte(&x).contains("Alpha"));
    let s = appliquer(d.path(), &e, vec![ActionPdf::SupprimerPages { pages: "1".into() }], "s.pdf");
    assert_eq!(nb_pages(&s), 2);
    assert!(texte(&s).starts_with("--- Page 1 ---\nBeta"));
}

#[test]
fn reorganiser_avec_doublon() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let ordre = vec![PageOrdre { page: 3, rotation: None }, PageOrdre { page: 1, rotation: Some(90) }, PageOrdre { page: 3, rotation: None }];
    let r = appliquer(d.path(), &e, vec![ActionPdf::Reorganiser { ordre }], "r.pdf");
    assert_eq!(nb_pages(&r), 3);
    let t = texte(&r);
    assert!(t.find("Gamma").unwrap() < t.find("Alpha").unwrap());
}

#[test]
fn rotation_valide_et_invalide() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let r = appliquer(d.path(), &e, vec![ActionPdf::Pivoter { degres: 90, pages: Some("2".into()) }], "r.pdf");
    let doc = pdf::charger(&std::fs::read(&r).unwrap(), None).unwrap();
    let pages = pdf::ids_pages(&doc);
    assert_eq!(pdf::rotation_page(&doc, pages[1]), 90);
    assert_eq!(pdf::rotation_page(&doc, pages[0]), 0);
    let err = run(Operation::Pdf { entree: e, mot_de_passe: None, actions: vec![ActionPdf::Pivoter { degres: 45, pages: None }], sortie: cible(d.path(), "z.pdf") });
    assert!(matches!(err, Err(ConvertError::Parametre(_))));
}

#[test]
fn filigrane_numerotation_entete() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let f = Filigrane { texte: "CONFIDENTIEL".into(), taille: 50.0, opacite: 0.3, angle: 45.0, couleur: Couleur(0.5, 0.5, 0.5), pages: None };
    let mut num = TextePages::numerotation("Page ", 1);
    num.gabarit = "Page {page} sur {total}".into();
    let actions = vec![
        ActionPdf::Filigrane(f),
        ActionPdf::TextePages(num),
        ActionPdf::EntetePied { entete: Some("Rapport annuel".into()), pied: None, taille: 9.0 },
    ];
    let s = appliquer(d.path(), &e, actions, "t.pdf");
    let t = texte(&s);
    assert!(t.contains("CONFIDENTIEL"));
    assert!(t.contains("Page 3 sur 3"));
    assert!(t.contains("Rapport annuel"));
}

#[test]
fn numerotation_bates_zeros() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let mut num = TextePages::numerotation("DOS-", 7);
    num.chiffres = 4;
    let s = appliquer(d.path(), &e, vec![ActionPdf::TextePages(num)], "b.pdf");
    assert!(texte(&s).contains("DOS-0009"));
}

#[test]
fn metadonnees_ecrire_puis_lire() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let m = Metadonnees { titre: Some("Budget été".into()), auteur: Some("Momo".into()), ..Default::default() };
    let s = appliquer(d.path(), &e, vec![ActionPdf::Metadonnees(m)], "m.pdf");
    match run(Operation::Infos { entree: s, mot_de_passe: None }).unwrap() {
        Output::Infos(m) => {
            assert_eq!(m.titre.as_deref(), Some("Budget été"));
            assert_eq!(m.auteur.as_deref(), Some("Momo"));
        }
        autre => panic!("{autre:?}"),
    }
}

#[test]
fn chiffrement_puis_dechiffrement() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let act = ActionPdf::Chiffrer { utilisateur: "secret1".into(), proprietaire: "maitre".into(), autorisations: Autorisations::default() };
    let c = appliquer(d.path(), &e, vec![act], "c.pdf");
    let brut = std::fs::read(&c).unwrap();
    assert!(matches!(pdf::charger(&brut, None), Err(ConvertError::MotDePasse)));
    assert!(matches!(pdf::charger(&brut, Some("faux")), Err(ConvertError::MotDePasse)));
    assert_eq!(pdf::charger(&brut, Some("secret1")).unwrap().get_pages().len(), 3);
    // Ouvrir avec le mot de passe et enregistrer sans chiffrer = dechiffrer.
    let o = run(Operation::Pdf { entree: c, mot_de_passe: Some("secret1".into()), actions: vec![], sortie: cible(d.path(), "clair.pdf") }).unwrap();
    let clair = fichiers(o).remove(0);
    assert!(texte(&clair).contains("Beta"));
}

#[test]
fn chiffrement_doit_etre_en_dernier() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let actions = vec![
        ActionPdf::Chiffrer { utilisateur: "a".into(), proprietaire: String::new(), autorisations: Autorisations::default() },
        ActionPdf::Pivoter { degres: 90, pages: None },
    ];
    let r = run(Operation::Pdf { entree: e, mot_de_passe: None, actions, sortie: cible(d.path(), "c.pdf") });
    assert!(matches!(r, Err(ConvertError::Parametre(_))));
}

#[test]
fn compression_sans_perte_garde_le_texte() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let s = appliquer(d.path(), &e, vec![ActionPdf::Compresser { niveau: pdf::compression::NiveauCompression::SansPerte }], "c.pdf");
    assert_eq!(nb_pages(&s), 3);
    assert!(texte(&s).contains("Gamma trois"));
}

#[test]
fn compression_reechantillonne_les_images() {
    let d = tempfile::tempdir().unwrap();
    let img = image::RgbImage::from_fn(2400, 1800, |x, y| image::Rgb([(x % 256) as u8, (y % 256) as u8, ((x * y) % 256) as u8]));
    let png = d.path().join("grand.png");
    img.save(&png).unwrap();
    let o = run(Operation::ImagesVersPdf { entrees: vec![png], sortie: cible(d.path(), "img.pdf") }).unwrap();
    let e = fichiers(o).remove(0);
    let avant = std::fs::metadata(&e).unwrap().len();
    let o = run(Operation::Pdf {
        entree: e,
        mot_de_passe: None,
        actions: vec![ActionPdf::Compresser { niveau: pdf::compression::NiveauCompression::Ecran }],
        sortie: cible(d.path(), "petit.pdf"),
    })
    .unwrap();
    let Output::Fichiers { fichiers, compression, .. } = o else { panic!() };
    assert_eq!(compression.unwrap().images_reencodees, 1);
    let apres = std::fs::metadata(&fichiers[0]).unwrap().len();
    assert!(apres * 3 < avant, "avant {avant}, après {apres}");
    assert_eq!(nb_pages(&fichiers[0]), 1);
}

#[test]
fn formulaire_ajouter_lister_remplir_aplatir() {
    use forge_convert::pdf::formulaires::{NouveauChamp, TypeChamp};
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let zone = pdf::Zone { page: 1, x: 0.1, y: 0.3, largeur: 0.4, hauteur: 0.04 };
    let champs = vec![
        NouveauChamp { type_: TypeChamp::Texte, nom: "nom".into(), zone, valeur: String::new(), coche: false, options: vec![], taille_police: 12.0 },
        NouveauChamp { type_: TypeChamp::Case, nom: "accord".into(), zone: pdf::Zone { y: 0.4, ..zone }, valeur: String::new(), coche: false, options: vec![], taille_police: 12.0 },
    ];
    let f = appliquer(d.path(), &e, vec![ActionPdf::AjouterChamps { champs }], "f.pdf");
    let Output::Champs { champs } = run(Operation::ListerChamps { entree: f.clone(), mot_de_passe: None }).unwrap() else { panic!() };
    assert_eq!(champs.len(), 2);
    assert!(champs.iter().any(|c| c.nom == "nom" && c.type_ == "texte"));
    let valeurs = [("nom".to_string(), "Dupont".to_string())].into_iter().collect();
    let r = appliquer(d.path(), &f, vec![ActionPdf::RemplirChamps { valeurs, aplatir: false }], "r.pdf");
    let Output::Champs { champs } = run(Operation::ListerChamps { entree: r.clone(), mot_de_passe: None }).unwrap() else { panic!() };
    assert_eq!(champs.iter().find(|c| c.nom == "nom").unwrap().valeur.as_deref(), Some("Dupont"));
    let a = appliquer(d.path(), &r, vec![ActionPdf::Aplatir], "a.pdf");
    let Output::Champs { champs } = run(Operation::ListerChamps { entree: a.clone(), mot_de_passe: None }).unwrap() else { panic!() };
    assert!(champs.is_empty(), "champs restants après aplatissement : {champs:?}");
    assert!(contient_partout(&a, "Dupont"));
}

#[test]
fn annotations_posees_et_listees() {
    use forge_convert::pdf::annotations::Annotation;
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let annotations = vec![
        Annotation::Note { page: 2, x: 0.5, y: 0.5, texte: "À revoir".into(), auteur: Some("Momo".into()) },
        Annotation::Texte { page: 1, x: 0.1, y: 0.8, taille: 14.0, texte: "Vu".into(), couleur: Couleur::NOIR },
        Annotation::Surlignage { zone: pdf::Zone { page: 1, x: 0.05, y: 0.05, largeur: 0.3, hauteur: 0.03 }, couleur: Couleur(1.0, 1.0, 0.0) },
    ];
    let s = appliquer(d.path(), &e, vec![ActionPdf::Annoter { annotations }], "a.pdf");
    let Output::Annotations { contenus } = run(Operation::ListerAnnotations { entree: s.clone(), page: 2 }).unwrap() else { panic!() };
    assert_eq!(contenus, vec!["À revoir".to_string()]);
    assert!(texte(&s).contains("Vu"));
}

#[test]
fn enchainement_d_actions() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let actions = vec![
        ActionPdf::SupprimerPages { pages: "2".into() },
        ActionPdf::Pivoter { degres: 180, pages: None },
        ActionPdf::Compresser { niveau: Default::default() },
    ];
    let s = appliquer(d.path(), &e, actions, "e.pdf");
    assert_eq!(nb_pages(&s), 2);
    assert!(!texte(&s).contains("Beta"));
}

#[test]
fn fusion_ordre_explicite_et_selection() {
    let d = tempfile::tempdir().unwrap();
    let a = ecrire(d.path(), "a.pdf", &pdf_pages(&[&["Alpha"]]));
    let b = ecrire(d.path(), "b.pdf", &pdf_pages(&[&["Bravo"]]));
    let c = ecrire(d.path(), "c.pdf", &pdf_pages(&[&["Charlie"]]));
    let op = |ordre: Option<Vec<usize>>, nom: &str| Operation::Fusionner { entrees: vec![a.clone(), b.clone(), c.clone()], ordre, mots_de_passe: vec![], sortie: cible(d.path(), nom) };
    let o = fichiers(run(op(Some(vec![2, 0]), "f1.pdf")).unwrap());
    let t = texte(&o[0]);
    assert_eq!(nb_pages(&o[0]), 2);
    assert!(t.find("Charlie").unwrap() < t.find("Alpha").unwrap() && !t.contains("Bravo"), "{t}");
    for mauvais in [vec![0, 0], vec![3], vec![]] {
        assert!(matches!(run(op(Some(mauvais), "f2.pdf")), Err(ConvertError::Parametre(_))));
    }
}

#[test]
fn fusion_json_sans_les_nouveaux_champs_reste_valide() {
    let json = r#"{"op":"fusionner","entrees":["a.pdf","b.pdf"],"sortie":{"dossier":"d","nom":"f.pdf"}}"#;
    let Operation::Fusionner { ordre, mots_de_passe, .. } = serde_json::from_str(json).unwrap() else { panic!() };
    assert!(ordre.is_none() && mots_de_passe.is_empty());
    let json = r#"{"op":"fusionner","entrees":["a.pdf"],"ordre":[0],"sortie":{"dossier":"d","nom":"f.pdf"}}"#;
    assert!(serde_json::from_str::<Operation>(json).is_ok());
}

#[test]
fn noms_personnalises_pour_decoupage_et_zip() {
    let d = tempfile::tempdir().unwrap();
    let e = trois_pages(d.path());
    let o = fichiers(run(Operation::Decouper { entree: e, mot_de_passe: None, mode: Decoupage::ChaquePage, noms: vec!["Couverture".into(), "Corps.pdf".into()], sortie: cible(d.path(), "p.pdf") }).unwrap());
    let noms: Vec<String> = o.iter().map(|p| p.file_name().unwrap().to_str().unwrap().to_string()).collect();
    assert_eq!(noms, vec!["Couverture.pdf", "Corps.pdf", "p-3.pdf"]);
    // Noms refuses : separateur, doublon.
    for mauvais in [vec!["../x".to_string()], vec!["a".to_string(), "A".to_string()]] {
        let e = trois_pages(d.path());
        assert!(run(Operation::Decouper { entree: e, mot_de_passe: None, mode: Decoupage::ChaquePage, noms: mauvais, sortie: cible(d.path(), "q.pdf") }).is_err());
    }
    let z = fichiers(run(Operation::Zipper { entrees: o.clone(), noms: vec!["un.pdf".into(), "".into(), "trois.pdf".into()], sortie: cible(d.path(), "z.zip") }).unwrap()).remove(0);
    let mut archive = zip::ZipArchive::new(std::fs::File::open(z).unwrap()).unwrap();
    let dans: Vec<String> = (0..archive.len()).map(|i| archive.by_index(i).unwrap().name().unwrap().to_string()).collect();
    assert_eq!(dans, vec!["un.pdf", "Corps.pdf", "trois.pdf"]);
}
