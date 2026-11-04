//! Fichier .fodb : creation, ouverture, PRAGMA, sauvegarde, compactage, transactions.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj, texte};
use forge_base::{Base, DefinitionTable, ErreurBase, OptionsLecture, Parametres};
use serde_json::json;

fn pragma(b: &Base, nom: &str) -> serde_json::Value {
    b.executer_sql(&format!("PRAGMA {nom}"), &Parametres::aucun()).map(|r| r.lignes[0][0].clone()).unwrap_or_default()
}

#[test]
fn creer_ouvrir_fermer_un_fichier() {
    let dir = tempfile::tempdir().unwrap();
    let chemin = dir.path().join("essai.fodb");
    let b = Base::creer(&chemin).unwrap();
    b.creer_table(&DefinitionTable { nom: "Notes".into(), champs: vec![texte("Titre", 80)], proprietes: Default::default() }).unwrap();
    b.inserer_ligne("Notes", &obj(json!({"Titre": "Première"}))).unwrap();
    let infos = b.infos().unwrap();
    assert_eq!(infos.journal, "wal");
    assert_eq!(infos.version_schema.as_deref(), Some("1"));
    assert_eq!(infos.nb_tables, 1);
    b.fermer().unwrap();

    let b = Base::ouvrir(&chemin).unwrap();
    assert_eq!(b.lister_tables().unwrap(), vec!["Notes"]);
    assert_eq!(b.lire_table("Notes", &OptionsLecture::default()).unwrap().lignes[0][0], json!("Première"));
    // Les PRAGMA de securite sont actifs a chaque ouverture.
    let conn = rusqlite::Connection::open(&chemin).unwrap();
    let journal: String = conn.query_row("PRAGMA journal_mode", [], |r| r.get(0)).unwrap();
    assert_eq!(journal, "wal");
    drop(conn);
    assert_eq!(b.valeur_sql("SELECT count(*) FROM sqlite_master WHERE name GLOB '__fo_*'", &Parametres::aucun()).unwrap(), json!(5));
    b.fermer().unwrap();
}

#[test]
fn pragmas_de_securite_actifs() {
    let dir = tempfile::tempdir().unwrap();
    let b = Base::creer(dir.path().join("p.fodb")).unwrap();
    assert_eq!(pragma(&b, "journal_mode"), json!("wal"));
    let fk: i64 = rusqlite_valeur(&b, "SELECT foreign_keys FROM pragma_foreign_keys");
    let sd: i64 = rusqlite_valeur(&b, "SELECT secure_delete FROM pragma_secure_delete");
    assert_eq!((fk, sd), (1, 1));
}

fn rusqlite_valeur(b: &Base, sql: &str) -> i64 {
    b.valeur_sql(sql, &Parametres::aucun()).unwrap().as_i64().unwrap()
}

#[test]
fn creer_refuse_un_fichier_existant_et_ouvrir_refuse_un_faux_fichier() {
    let dir = tempfile::tempdir().unwrap();
    let chemin = dir.path().join("x.fodb");
    std::fs::write(&chemin, "ceci n'est pas une base de données, juste du texte").unwrap();
    assert!(matches!(Base::creer(&chemin), Err(ErreurBase::ExisteDeja(_))));
    let e = Base::ouvrir(&chemin).err().unwrap();
    assert!(e.to_string().contains("n'est pas une base de données"), "{e}");
    assert!(matches!(Base::ouvrir(dir.path().join("absent.fodb")), Err(ErreurBase::Introuvable(_))));
}

#[test]
fn lecture_seule_refuse_les_ecritures() {
    let dir = tempfile::tempdir().unwrap();
    let chemin = dir.path().join("l.fodb");
    let b = Base::creer(&chemin).unwrap();
    b.creer_table(&DefinitionTable { nom: "T".into(), champs: vec![texte("A", 10)], proprietes: Default::default() }).unwrap();
    b.fermer().unwrap();
    let b = Base::ouvrir_lecture_seule(&chemin).unwrap();
    assert!(b.est_lecture_seule());
    assert!(matches!(b.inserer_ligne("T", &obj(json!({"A": "x"}))), Err(ErreurBase::Interdit(_))));
    assert!(b.executer_sql("INSERT INTO T VALUES ('x')", &Parametres::aucun()).is_err());
    assert_eq!(b.lire_table("T", &OptionsLecture::default()).unwrap().total, 0);
}

#[test]
fn sauvegarde_vacuum_into_et_compactage() {
    let dir = tempfile::tempdir().unwrap();
    let chemin = dir.path().join("s.fodb");
    let b = Base::creer(&chemin).unwrap();
    b.creer_table(&DefinitionTable { nom: "T".into(), champs: vec![texte("A", 200)], proprietes: Default::default() }).unwrap();
    for i in 0..300 {
        b.inserer_ligne("T", &obj(json!({"A": format!("ligne {i} {}", "x".repeat(150))}))).unwrap();
    }
    b.executer_sql("DELETE FROM T WHERE rowid > 10", &Parametres::aucun()).unwrap();
    let copie = dir.path().join("copie.fodb");
    b.sauvegarder(&copie, false).unwrap();
    assert!(matches!(b.sauvegarder(&copie, false), Err(ErreurBase::ExisteDeja(_))));
    b.sauvegarder(&copie, true).unwrap();
    assert!(b.sauvegarder(&chemin, true).is_err(), "la base ouverte ne doit pas etre ecrasee");
    let rapport = b.compacter().unwrap();
    assert!(rapport.taille_apres < rapport.taille_avant, "{rapport:?}");
    assert!(b.verifier_integrite().unwrap().ok);
    b.fermer().unwrap();
    let s = Base::ouvrir(&copie).unwrap();
    assert_eq!(s.compter_lignes("T").unwrap(), 10);
}

#[test]
fn transactions_explicites() {
    let b = base_demo();
    b.commencer_transaction().unwrap();
    assert!(b.en_transaction());
    assert!(b.commencer_transaction().is_err());
    b.inserer_ligne("Clients", &obj(json!({"Nom": "Temporaire"}))).unwrap();
    assert_eq!(b.compter_lignes("Clients").unwrap(), 4);
    b.annuler_transaction().unwrap();
    assert_eq!(b.compter_lignes("Clients").unwrap(), 3);
    b.commencer_transaction().unwrap();
    b.inserer_ligne("Clients", &obj(json!({"Nom": "Gardé"}))).unwrap();
    // Une erreur dans une operation n'annule pas la transaction entiere (point de sauvegarde).
    assert!(b.inserer_lignes("Clients", &[obj(json!({"Nom": "ok"})), obj(json!({"Nom": null}))]).is_err());
    b.valider_transaction().unwrap();
    assert_eq!(b.compter_lignes("Clients").unwrap(), 4);
    assert!(b.valider_transaction().is_err());
}

#[test]
fn verification_d_integrite_signale_les_orphelins() {
    let dir = tempfile::tempdir().unwrap();
    let chemin = dir.path().join("o.fodb");
    {
        let conn = rusqlite::Connection::open(&chemin).unwrap();
        conn.execute_batch(
            "PRAGMA foreign_keys=OFF; CREATE TABLE p(id INTEGER PRIMARY KEY); CREATE TABLE e(x INTEGER REFERENCES p(id)); INSERT INTO e VALUES (42);",
        )
        .unwrap();
    }
    let b = Base::ouvrir(&chemin).unwrap();
    let r = b.verifier_integrite().unwrap();
    assert!(!r.ok);
    assert_eq!(r.orphelins, vec![("e".to_string(), 1, "p".to_string())]);
    // La cle etrangere existante a ete adoptee comme relation.
    let rel = b.lister_relations().unwrap();
    assert_eq!((rel[0].table_parent.as_str(), rel[0].champs_enfant[0].as_str()), ("p", "x"));
}
