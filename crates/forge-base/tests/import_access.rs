//! Import en lecture d'un fichier Access. Les deux fichiers de `tests/fixtures` ont ete crees par
//! le vrai moteur Access (DAO/ACE par COM) : `access2000.mdb` (Jet 4) et `access2007.accdb` (ACE),
//! avec les tables Clients (NumeroAuto, texte, oui/non, monetaire, memo court et long, octet,
//! entier long, reel, date), Produits (sans cle) et Gros (400 lignes sur plusieurs pages).
#![allow(clippy::unwrap_used, clippy::expect_used)]

use forge_base::{Base, ErreurBase, OptionsImportAccess, OptionsLecture, TypeChamp};
use serde_json::json;

fn fixture(nom: &str) -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures").join(nom)
}

fn verifier_import(nom: &str) {
    let b = Base::en_memoire().unwrap();
    let apercu = b.lister_tables_access(fixture(nom)).unwrap();
    assert_eq!(apercu.iter().map(|t| (t.nom.as_str(), t.nb_lignes)).collect::<Vec<_>>(), vec![("Clients", 4), ("Gros", 400), ("Produits", 2)]);
    assert_eq!(b.lister_tables().unwrap().len(), 0, "l'apercu n'importe rien");

    let r = b.importer_access(fixture(nom), &OptionsImportAccess::default()).unwrap();
    assert_eq!(r.tables.iter().map(|t| (t.nom.as_str(), t.lignes)).collect::<Vec<_>>(), vec![("Clients", 4), ("Gros", 400), ("Produits", 2)]);
    assert!(r.avertissements.is_empty(), "{:?}", r.avertissements);

    // Types Access reconnus.
    let types: Vec<(String, TypeChamp)> = b.champs("Clients").unwrap().into_iter().map(|c| (c.nom, c.type_champ)).collect();
    let attendus = [
        ("Id", TypeChamp::NumeroAuto), ("Nom", TypeChamp::TexteCourt), ("Ville", TypeChamp::TexteCourt), ("Actif", TypeChamp::OuiNon),
        ("Solde", TypeChamp::Monetaire), ("Remarque", TypeChamp::TexteLong), ("Age", TypeChamp::Octet), ("Compte", TypeChamp::EntierLong),
        ("Taux", TypeChamp::ReelDouble), ("Cree", TypeChamp::DateHeure),
    ];
    assert_eq!(types, attendus.iter().map(|(n, t)| ((*n).to_string(), *t)).collect::<Vec<_>>());
    assert_eq!(b.champs("Clients").unwrap()[1].proprietes.taille, Some(50));

    // Valeurs : texte accentue, booleens, monetaire, nulls, dates, memo court et memo sur plusieurs pages.
    let page = b.lire_table("Clients", &OptionsLecture::default()).unwrap();
    let ligne = |i: usize| -> serde_json::Map<String, serde_json::Value> {
        page.colonnes.iter().zip(&page.lignes[i]).map(|(c, v)| (c.nom.clone(), v.clone())).collect()
    };
    let l1 = ligne(0);
    assert_eq!((l1["Id"].clone(), l1["Nom"].clone(), l1["Ville"].clone(), l1["Actif"].clone()), (json!(1), json!("Dupont"), json!("Paris"), json!(true)));
    assert_eq!((l1["Solde"].clone(), l1["Age"].clone(), l1["Compte"].clone(), l1["Taux"].clone()), (json!(12.5), json!(42), json!(100000), json!(1.25)));
    assert_eq!((l1["Cree"].clone(), l1["Remarque"].clone()), (json!("2024-03-15T14:30:00"), json!("Bonjour le monde")));
    let l2 = ligne(1);
    assert_eq!(l2["Nom"], json!("Émile Zoé"));
    assert_eq!((l2["Actif"].clone(), l2["Solde"].clone(), l2["Compte"].clone(), l2["Remarque"].clone()), (json!(false), json!(-3.75), json!(-5), json!(null)));
    assert_eq!(l2["Cree"], json!("1999-12-31T00:00:00"));
    let l3 = ligne(2);
    assert_eq!((l3["Nom"].clone(), l3["Ville"].clone(), l3["Age"].clone(), l3["Compte"].clone()), (json!("Œuvre"), json!(null), json!(255), json!(2147483647)));
    assert_eq!((l3["Remarque"].clone(), l3["Cree"].clone(), l3["Taux"].clone()), (json!("Texte avec accents éàü"), json!("2000-01-01T00:00:01"), json!(-2.5)));
    let l4 = ligne(3);
    assert_eq!(l4["Remarque"], json!("Ligne longue ".repeat(700)), "memo de 9 100 caracteres (plusieurs pages)");

    // Table sans cle et table de 400 lignes sur plusieurs pages de donnees.
    let p = b.lire_table("Produits", &OptionsLecture::default()).unwrap();
    assert_eq!(p.lignes, vec![vec![json!("A1"), json!(9.99), json!(12)], vec![json!("B2"), json!(100.0), json!(-4)]]);
    let g = b.lire_table("Gros", &OptionsLecture { taille_page: 1000, ..Default::default() }).unwrap();
    assert_eq!(g.total, 400);
    let mut numeros: Vec<i64> = g.lignes.iter().map(|l| l[0].as_i64().unwrap()).collect();
    numeros.sort_unstable();
    assert_eq!(numeros, (1..=400).collect::<Vec<_>>());
    assert!(g.lignes.iter().all(|l| l[1] == json!(format!("ligne numero {}", l[0]))));
}

#[test]
fn import_d_un_mdb_jet4_cree_par_access() {
    verifier_import("access2000.mdb");
}

#[test]
fn import_d_un_accdb_ace_cree_par_access() {
    verifier_import("access2007.accdb");
}

#[test]
fn import_de_certaines_tables_et_collisions_de_noms() {
    let b = Base::en_memoire().unwrap();
    let r = b.importer_access(fixture("access2000.mdb"), &OptionsImportAccess { tables: Some(vec!["produits".into()]) }).unwrap();
    assert_eq!(r.tables.len(), 1);
    assert!(b.lister_tables().unwrap() == vec!["Produits".to_string()]);
    // Une table deja presente n'est pas ecrasee : la table importee prend un autre nom, signale.
    let r = b.importer_access(fixture("access2000.mdb"), &OptionsImportAccess { tables: Some(vec!["Produits".into()]) }).unwrap();
    assert_eq!(r.tables[0].nom, "Produits (2)");
    assert!(r.avertissements.iter().any(|a| a.contains("existe déjà")), "{:?}", r.avertissements);
    assert!(matches!(b.importer_access(fixture("access2000.mdb"), &OptionsImportAccess { tables: Some(vec!["Inconnue".into()]) }), Err(ErreurBase::Introuvable(_))));
}

#[test]
fn fichiers_hostiles_ou_abimes_sont_refuses_sans_panique() {
    let b = Base::en_memoire().unwrap();
    assert!(b.importer_access_octets(b"pas un fichier access", &OptionsImportAccess::default()).is_err());
    let original = std::fs::read(fixture("access2000.mdb")).unwrap();
    // Troncature, octets aleatoires dans les pages, boucles de pages : jamais de panique ni de memoire folle.
    for coupe in [4096, 8192, 20_000, 70_000, original.len() - 1] {
        let _ = b.importer_access_octets(&original[..coupe], &OptionsImportAccess::default());
    }
    let mut graine = 0x1234_5678_u32;
    for _ in 0..40 {
        let mut v = original.clone();
        for _ in 0..200 {
            graine = graine.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            let pos = (graine as usize) % v.len();
            graine = graine.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
            v[pos] = (graine >> 24) as u8;
        }
        let c = Base::en_memoire().unwrap();
        let _ = c.importer_access_octets(&v, &OptionsImportAccess::default());
    }
}
