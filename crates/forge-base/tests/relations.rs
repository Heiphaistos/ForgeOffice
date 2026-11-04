//! Relations : integrite referentielle, cascades, « mettre a Null », adoption des cles etrangeres.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj, relation_demo};
use forge_base::{Base, ErreurBase, Parametres, Relation, Suppression};
use serde_json::json;

#[test]
fn integrite_refuse_les_orphelins_et_restreint_la_suppression() {
    let b = base_demo();
    let r = relation_demo(&b, false);
    assert_eq!(r.nom, "Clients_Commandes");
    let e = b.inserer_ligne("Commandes", &obj(json!({"Client": 99, "Montant": 1}))).unwrap_err();
    assert!(e.to_string().contains("Intégrité référentielle"), "{e}");
    let e = b.supprimer_ligne("Clients", &obj(json!({"N°": 1}))).unwrap_err();
    assert!(matches!(e, ErreurBase::Contrainte(_)), "{e}");
    // Un index a ete cree sur le champ lie de la table enfant.
    assert!(b.index_table("Commandes").unwrap().iter().any(|i| i.origine == "relation"));
    let s = b.schema_table("Commandes").unwrap();
    assert!(s.sql.unwrap().contains("REFERENCES \"Clients\""));
    assert_eq!(s.relations.len(), 1);
}

#[test]
fn cascades_mise_a_jour_et_suppression() {
    let b = base_demo();
    relation_demo(&b, true);
    b.modifier_ligne("Clients", &obj(json!({"N°": 1})), &obj(json!({"N°": 10}))).unwrap();
    let r = b.executer_sql("SELECT count(*) FROM Commandes WHERE Client = 10", &Parametres::aucun()).unwrap();
    assert_eq!(r.lignes[0][0], json!(2));
    b.supprimer_ligne("Clients", &obj(json!({"N°": 10}))).unwrap();
    assert_eq!(b.compter_lignes("Commandes").unwrap(), 2);
}

#[test]
fn mettre_a_null_a_la_suppression() {
    let b = base_demo();
    b.creer_relation(&Relation {
        nom: "Lien".into(),
        table_parent: "clients".into(),
        champs_parent: vec!["n°".into()],
        table_enfant: "COMMANDES".into(),
        champs_enfant: vec!["client".into()],
        integrite: true,
        cascade_maj: false,
        suppression: Suppression::MettreNull,
        jointure: Default::default(),
    })
    .unwrap();
    b.supprimer_ligne("Clients", &obj(json!({"N°": 1}))).unwrap();
    let r = b.executer_sql("SELECT count(*) FROM Commandes WHERE Client IS NULL", &Parametres::aucun()).unwrap();
    assert_eq!(r.lignes[0][0], json!(2));
    // Les noms sont normalises sur la casse reelle.
    let rel = &b.lister_relations().unwrap()[0];
    assert_eq!((rel.table_parent.as_str(), rel.champs_enfant[0].as_str()), ("Clients", "Client"));
}

#[test]
fn creation_refusee_si_donnees_orphelines_sans_rien_modifier() {
    let b = base_demo();
    b.inserer_ligne("Commandes", &obj(json!({"Client": 77, "Montant": 3}))).unwrap();
    let avant = b.schema_table("Commandes").unwrap().sql;
    let e = b
        .creer_relation(&Relation {
            nom: String::new(),
            table_parent: "Clients".into(),
            champs_parent: vec!["N°".into()],
            table_enfant: "Commandes".into(),
            champs_enfant: vec!["Client".into()],
            integrite: true,
            cascade_maj: false,
            suppression: Suppression::Restreindre,
            jointure: Default::default(),
        })
        .unwrap_err();
    assert!(e.to_string().contains("n'ont pas de correspondant"), "{e}");
    assert!(b.lister_relations().unwrap().is_empty());
    assert_eq!(b.schema_table("Commandes").unwrap().sql, avant);
    assert_eq!(b.compter_lignes("Commandes").unwrap(), 5);
}

#[test]
fn parent_sans_index_unique_et_types_incompatibles_refuses() {
    let b = base_demo();
    let mut r = Relation {
        nom: String::new(),
        table_parent: "Clients".into(),
        champs_parent: vec!["Ville".into()],
        table_enfant: "Commandes".into(),
        champs_enfant: vec!["Client".into()],
        integrite: true,
        cascade_maj: false,
        suppression: Suppression::Restreindre,
        jointure: Default::default(),
    };
    assert!(b.creer_relation(&r).unwrap_err().to_string().contains("Types incompatibles"));
    r.champs_enfant = vec!["Date".into()];
    r.champs_parent = vec!["Actif".into()];
    assert!(b.creer_relation(&r).is_err());
    // Sans integrite : simple lien pour le createur de requetes.
    r.champs_parent = vec!["N°".into()];
    r.champs_enfant = vec!["Client".into()];
    r.integrite = false;
    let cree = b.creer_relation(&r).unwrap();
    assert!(b.inserer_ligne("Commandes", &obj(json!({"Client": 1234}))).is_ok());
    b.supprimer_relation(&cree.nom).unwrap();
    assert!(b.lister_relations().unwrap().is_empty());
}

#[test]
fn supprimer_et_modifier_une_relation() {
    let b = base_demo();
    let r = relation_demo(&b, false);
    assert!(b.supprimer_table("Clients", false).unwrap_err().to_string().contains("participe aux relations"));
    assert!(b.supprimer_champ("Commandes", "Client").is_err());
    let mut nouvelle = r.clone();
    nouvelle.suppression = Suppression::Cascade;
    b.modifier_relation(&r.nom, &nouvelle).unwrap();
    assert_eq!(b.lister_relations().unwrap()[0].suppression, Suppression::Cascade);
    b.supprimer_relation(&r.nom).unwrap();
    b.inserer_ligne("Commandes", &obj(json!({"Client": 555}))).unwrap();
    assert!(!b.schema_table("Commandes").unwrap().sql.unwrap().contains("REFERENCES"));
}

#[test]
fn supprimer_une_table_avec_ses_relations() {
    let b = base_demo();
    relation_demo(&b, false);
    b.supprimer_table("Clients", true).unwrap();
    assert!(b.lister_relations().unwrap().is_empty());
    b.inserer_ligne("Commandes", &obj(json!({"Client": 9}))).unwrap();
}

#[test]
fn renommer_la_table_parent_suit_la_relation() {
    let b = base_demo();
    relation_demo(&b, false);
    b.renommer_table("Clients", "Personnes").unwrap();
    let r = &b.lister_relations().unwrap()[0];
    assert_eq!(r.table_parent, "Personnes");
    assert!(b.inserer_ligne("Commandes", &obj(json!({"Client": 99}))).is_err());
    b.renommer_champ("Personnes", "N°", "Numéro").unwrap();
    assert_eq!(b.lister_relations().unwrap()[0].champs_parent, vec!["Numéro"]);
    assert!(b.inserer_ligne("Commandes", &obj(json!({"Client": 99}))).is_err());
    b.inserer_ligne("Commandes", &obj(json!({"Client": 2}))).unwrap();
}

#[test]
fn cles_etrangeres_sql_adoptees() {
    let b = Base::en_memoire().unwrap();
    b.executer_script(
        "CREATE TABLE auteurs(id INTEGER PRIMARY KEY, nom TEXT);
         CREATE TABLE livres(id INTEGER PRIMARY KEY, auteur INTEGER REFERENCES auteurs ON DELETE CASCADE);",
    )
    .unwrap();
    let r = b.lister_relations().unwrap();
    assert_eq!(r.len(), 1);
    assert_eq!(r[0].champs_parent, vec!["id"]);
    assert_eq!(r[0].suppression, Suppression::Cascade);
    // La reconstruction garde la cle etrangere adoptee.
    b.ajouter_champ("livres", &commun::texte("titre", 100), Some(1)).unwrap();
    assert!(b.executer_sql("INSERT INTO livres(auteur) VALUES (3)", &Parametres::aucun()).is_err());
}
