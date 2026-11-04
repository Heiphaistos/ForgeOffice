//! Feuille de donnees : pagination, tri francais, filtres, recherche, ecriture par cle, totaux.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj, texte};
use forge_base::{
    Base, DefinitionChamp, DefinitionTable, ErreurBase, Filtre, FonctionTotal, OptionsLecture, Operateur, Parametres, Tri, TypeChamp,
};
use serde_json::{json, Value};

fn filtre(champ: &str, operateur: Operateur, valeur: Value) -> Filtre {
    Filtre { champ: champ.into(), operateur, valeur, valeur2: Value::Null, valeurs: vec![] }
}

fn noms(b: &Base, o: &OptionsLecture) -> Vec<String> {
    let p = b.lire_table("Clients", &OptionsLecture { champs: Some(vec!["Nom".into()]), ..o.clone() }).unwrap();
    p.lignes.into_iter().map(|l| l[0].as_str().unwrap().to_string()).collect()
}

#[test]
fn pagination_cles_et_colonnes() {
    let b = base_demo();
    let p = b.lire_table("Commandes", &OptionsLecture { taille_page: 3, ..Default::default() }).unwrap();
    assert_eq!((p.total, p.nb_pages, p.lignes.len()), (4, 2, 3));
    assert_eq!(p.cles[0], obj(json!({"Id": 1})));
    assert_eq!(p.colonnes[2].type_champ, Some(TypeChamp::Monetaire));
    assert_eq!(p.lignes[0][2], json!(10.5));
    assert_eq!(p.lignes[0][3], json!("2024-02-01"));
    let p2 = b.lire_table("Commandes", &OptionsLecture { taille_page: 3, page: 1, ..Default::default() }).unwrap();
    assert_eq!(p2.lignes.len(), 1);
    assert!(p.modifiable);
}

#[test]
fn tri_a_la_francaise_insensible_casse_et_accents() {
    let b = base_demo();
    let o = OptionsLecture { tri: vec![Tri { champ: "Nom".into(), descendant: false }], ..Default::default() };
    assert_eq!(noms(&b, &o), ["albert", "Dupont", "Émile"]);
    let o = OptionsLecture {
        tri: vec![Tri { champ: "Ville".into(), descendant: true }, Tri { champ: "nom".into(), descendant: true }],
        ..Default::default()
    };
    assert_eq!(noms(&b, &o), ["Dupont", "albert", "Émile"]);
}

#[test]
fn filtres_de_la_feuille_de_donnees() {
    let b = base_demo();
    let avec = |f: Vec<Filtre>, ou: bool| noms(&b, &OptionsLecture { filtres: f, combinaison_ou: ou, ..Default::default() });
    assert_eq!(avec(vec![filtre("Ville", Operateur::Egal, json!("paris"))], false), ["Dupont", "albert"]);
    assert_eq!(avec(vec![filtre("Nom", Operateur::Contient, json!("mil"))], false), ["Émile"]);
    assert_eq!(avec(vec![filtre("Nom", Operateur::CommencePar, json!("du"))], false), ["Dupont"]);
    assert_eq!(avec(vec![filtre("Nom", Operateur::Comme, json!("*t"))], false), ["Dupont", "albert"]);
    assert_eq!(avec(vec![filtre("Actif", Operateur::Egal, json!("Non"))], false), ["Émile"]);
    assert_eq!(
        avec(vec![filtre("Ville", Operateur::Egal, json!("Lyon")), filtre("Nom", Operateur::Egal, json!("albert"))], true),
        ["Émile", "albert"]
    );
    let mut dans = filtre("N°", Operateur::Dans, Value::Null);
    dans.valeurs = vec![json!(1), json!(3)];
    assert_eq!(avec(vec![dans], false), ["Dupont", "albert"]);
    let mut entre = filtre("N°", Operateur::Entre, json!(2));
    entre.valeur2 = json!(3);
    assert_eq!(avec(vec![entre], false), ["Émile", "albert"]);
    b.inserer_ligne("Clients", &obj(json!({"Nom": "Sans ville"}))).unwrap();
    assert_eq!(avec(vec![filtre("Ville", Operateur::EstVide, Value::Null)], false), ["Sans ville"]);
    assert_eq!(avec(vec![filtre("Ville", Operateur::Different, json!("Paris"))], false), ["Émile", "Sans ville"]);
    let e = b.lire_table("Clients", &OptionsLecture { filtres: vec![filtre("N°", Operateur::Egal, json!("abc"))], ..Default::default() });
    assert!(matches!(e, Err(ErreurBase::Validation { .. })));
}

#[test]
fn recherche_sans_accents_et_expression() {
    let b = base_demo();
    assert_eq!(noms(&b, &OptionsLecture { recherche: Some("EMI".into()), ..Default::default() }), ["Émile"]);
    assert_eq!(noms(&b, &OptionsLecture { recherche: Some("%".into()), ..Default::default() }), Vec::<String>::new());
    let o = OptionsLecture { expression: Some("[Ville] = \"Paris\" Et Gauche([Nom];1) = \"a\"".into()), ..Default::default() };
    assert_eq!(noms(&b, &o), ["albert"]);
    let o = OptionsLecture { expression: Some("[Inconnu] > 1".into()), ..Default::default() };
    assert!(b.lire_table("Clients", &o).is_err());
}

#[test]
fn ecriture_par_cle_et_rowid() {
    let b = Base::en_memoire().unwrap();
    b.creer_table(&DefinitionTable { nom: "Sans clé".into(), champs: vec![texte("A", 10)], proprietes: Default::default() }).unwrap();
    let cle = b.inserer_ligne("Sans clé", &obj(json!({"A": "x"}))).unwrap();
    assert_eq!(cle, obj(json!({"rowid": 1})));
    b.modifier_ligne("Sans clé", &cle, &obj(json!({"A": "y"}))).unwrap();
    assert_eq!(b.lire_ligne("Sans clé", &cle).unwrap().unwrap()["A"], json!("y"));
    b.supprimer_ligne("Sans clé", &cle).unwrap();
    assert!(b.lire_ligne("Sans clé", &cle).unwrap().is_none());
    assert!(b.supprimer_ligne("Sans clé", &cle).is_err());
    assert!(b.modifier_ligne("Sans clé", &cle, &obj(json!({"A": "z"}))).unwrap_err().to_string().contains("introuvable"));
    assert!(matches!(b.inserer_ligne("Sans clé", &obj(json!({"B": 1}))), Err(ErreurBase::Validation { .. })));
}

#[test]
fn masque_de_saisie_dates_booleens_et_pieces_jointes() {
    let b = Base::en_memoire().unwrap();
    let mut tel = texte("Tél", 14);
    tel.proprietes.masque_saisie = Some("00 00 00 00 00;0;_".into());
    b.creer_table(&DefinitionTable {
        nom: "Contacts".into(),
        champs: vec![
            DefinitionChamp::nouveau("N", TypeChamp::NumeroAuto),
            tel,
            DefinitionChamp::nouveau("Né le", TypeChamp::DateHeure),
            DefinitionChamp::nouveau("VIP", TypeChamp::OuiNon),
            DefinitionChamp::nouveau("Photo", TypeChamp::PieceJointe),
            DefinitionChamp::nouveau("Site", TypeChamp::LienHypertexte),
        ],
        proprietes: Default::default(),
    })
    .unwrap();
    let cle = b
        .inserer_ligne("Contacts", &obj(json!({"Tél": "0612345678", "Né le": "29/02/2000", "VIP": "Vrai", "Photo": {"base64": "iVBORw0K"}, "Site": "https://exemple.fr"})))
        .unwrap();
    let l = b.lire_ligne("Contacts", &cle).unwrap().unwrap();
    assert_eq!(l["Tél"], json!("06 12 34 56 78"));
    assert_eq!(l["Né le"], json!("2000-02-29"));
    assert_eq!(l["VIP"], json!(true));
    assert_eq!(l["Photo"], json!({"type": "blob", "base64": "iVBORw0K", "taille": 6}));
    let e = b.inserer_ligne("Contacts", &obj(json!({"Tél": "06-12"}))).unwrap_err();
    assert!(e.to_string().contains("masque"), "{e}");
    assert!(b.inserer_ligne("Contacts", &obj(json!({"Né le": "31/02/2024"}))).unwrap_err().to_string().contains("date"));
    assert!(b.inserer_ligne("Contacts", &obj(json!({"Site": "javascript:alert(1)"}))).is_err());
    let brut = b.executer_sql("INSERT INTO Contacts(Site) VALUES ('  JAVASCRIPT:x')", &Parametres::aucun());
    assert!(brut.is_err(), "la contrainte protege aussi le SQL direct");
    let sans_blob = b.lire_table("Contacts", &OptionsLecture { blobs: false, ..Default::default() }).unwrap();
    assert_eq!(sans_blob.lignes[0][4], json!({"type": "blob", "taille": 6}));
}

#[test]
fn totaux_valeurs_distinctes_et_remplacement() {
    let b = base_demo();
    let somme = b.total("Commandes", "Montant", FonctionTotal::Somme, &OptionsLecture::default()).unwrap();
    assert_eq!(somme, json!(135.75));
    let o = OptionsLecture { filtres: vec![filtre("Client", Operateur::Egal, json!(1))], ..Default::default() };
    assert_eq!(b.total("Commandes", "Montant", FonctionTotal::Moyenne, &o).unwrap(), json!(15.25));
    assert_eq!(b.total("Commandes", "Date", FonctionTotal::Max, &OptionsLecture::default()).unwrap(), json!("2024-04-01"));
    let et = b.total("Commandes", "Montant", FonctionTotal::EcartType, &OptionsLecture::default()).unwrap();
    assert!((et.as_f64().unwrap() - 44.4627).abs() < 0.001, "{et}");
    assert_eq!(b.valeurs_distinctes("Clients", "Ville", 10).unwrap(), vec![json!("Lyon"), json!("Paris")]);
    assert_eq!(b.remplacer_tout("Clients", "Ville", "PARIS", "Marseille", false).unwrap(), 2);
    assert_eq!(b.remplacer_tout("Clients", "Ville", "lyon", "x", true).unwrap(), 0);
    assert_eq!(b.valeurs_distinctes("Clients", "Ville", 10).unwrap(), vec![json!("Lyon"), json!("Marseille")]);
    assert!(b.remplacer_tout("Clients", "Actif", "1", "0", false).is_err());
}

#[test]
fn insertion_multiple_tout_ou_rien_et_vue_en_lecture_seule() {
    let b = base_demo();
    let e = b.inserer_lignes("Clients", &[obj(json!({"Nom": "A"})), obj(json!({"Nom": "B", "Ville": "x".repeat(60)}))]).unwrap_err();
    assert!(e.to_string().starts_with("Ligne 2"), "{e}");
    assert_eq!(b.compter_lignes("Clients").unwrap(), 3);
    assert_eq!(b.inserer_lignes("Clients", &[obj(json!({"Nom": "A"})), obj(json!({"Nom": "B"}))]).unwrap(), 2);
    b.executer_script("CREATE VIEW v_paris AS SELECT Nom FROM Clients WHERE Ville = 'Paris'").unwrap();
    let p = b.lire_table("v_paris", &OptionsLecture::default()).unwrap();
    assert!(!p.modifiable && p.cles.is_empty() && p.total == 2);
    assert!(b.inserer_ligne("v_paris", &obj(json!({"Nom": "x"}))).is_err());
    assert_eq!(b.lister_vues().unwrap(), vec!["v_paris"]);
}
