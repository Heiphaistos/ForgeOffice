//! SQL parametre, securite, requetes enregistrees et createur graphique.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, relation_demo};
use forge_base::{
    ColonneRequete, DefinitionRequete, ErreurBase, GenreObjet, GenreRequete, Jointure, Operation, Parametres, RequeteEnregistree,
    SensTri, SourceRequete,
};
use serde_json::{json, Map, Value};

fn col(table: &str, champ: &str) -> ColonneRequete {
    ColonneRequete {
        champ: champ.into(),
        table: Some(table.into()),
        alias: None,
        afficher: true,
        tri: None,
        criteres: vec![],
        operation: None,
        mise_a_jour: None,
        ajouter_a: None,
        analyse: None,
    }
}

fn requete(nom: &str, genre: GenreRequete, sql: &str, definition: Option<Value>) -> RequeteEnregistree {
    RequeteEnregistree { nom: nom.into(), genre, sql: sql.into(), definition, description: None, parametres: vec![], vue: false }
}

#[test]
fn sql_parametre_et_resultats_types() {
    let b = base_demo();
    let r = b
        .executer_sql(
            "SELECT Nom, Actif, Montant, Date FROM Clients JOIN Commandes ON Client = \"N°\" WHERE Montant > ? ORDER BY Montant",
            &Parametres::Positionnels(vec![json!(15)]),
        )
        .unwrap();
    assert!(r.lecture_seule);
    assert_eq!(r.lignes, vec![vec![json!("Dupont"), json!(true), json!(20), json!("2024-03-05")], vec![
        json!("albert"),
        json!(true),
        json!(100),
        json!("2024-04-01")
    ]]);
    let mut nommes = Map::new();
    nommes.insert("ville".into(), json!("Lyon"));
    let r = b.executer_sql("SELECT count(*) FROM Clients WHERE Ville = :ville", &Parametres::Nommes(nommes)).unwrap();
    assert_eq!(r.lignes[0][0], json!(1));
    let r = b.executer_sql("UPDATE Clients SET Actif = 0 WHERE Ville = ?", &Parametres::Positionnels(vec![json!("Paris")])).unwrap();
    assert_eq!((r.lignes_modifiees, r.lecture_seule), (2, false));
    assert!(b.executer_sql("SELECT ?", &Parametres::aucun()).is_err());
    let blob = b.executer_sql("SELECT x'414243'", &Parametres::aucun()).unwrap();
    assert_eq!(blob.lignes[0][0], json!({"type": "blob", "taille": 3, "base64": "QUJD"}));
    assert_eq!(b.valeur_sql("SELECT sum(Montant) FROM Commandes", &Parametres::aucun()).unwrap(), json!(135.75));
}

#[test]
fn sql_utilisateur_refuse_attach_extensions_et_tables_internes() {
    let b = base_demo();
    for sql in [
        "ATTACH DATABASE 'autre.fodb' AS autre",
        "SELECT load_extension('evil')",
        "PRAGMA foreign_keys = OFF",
        "DELETE FROM __fo_champs",
    ] {
        let e = b.executer_sql(sql, &Parametres::aucun());
        assert!(e.is_err(), "{sql} aurait du etre refuse");
    }
    assert!(matches!(b.executer_sql("ATTACH ':memory:' AS x", &Parametres::aucun()), Err(ErreurBase::Interdit(_))));
    assert!(b.executer_sql("PRAGMA table_info(Clients)", &Parametres::aucun()).is_ok());
    // les cles etrangeres restent actives apres une tentative refusee
    relation_demo(&b, false);
    assert!(b.executer_sql("DELETE FROM Clients WHERE \"N°\" = 1", &Parametres::aucun()).is_err());
}

#[test]
fn requete_enregistree_publiee_en_vue_et_listee() {
    let b = base_demo();
    let r = b.enregistrer_requete(&requete("Parisiens", GenreRequete::Selection, "SELECT Nom FROM Clients WHERE Ville = 'Paris';", None)).unwrap();
    assert!(r.vue);
    assert_eq!(b.executer_sql("SELECT count(*) FROM Parisiens", &Parametres::aucun()).unwrap().lignes[0][0], json!(2));
    assert!(b.lister_objets().unwrap().iter().any(|o| o.nom == "Parisiens" && o.genre == GenreObjet::Requete));
    b.renommer_requete("Parisiens", "Gens de Paris").unwrap();
    assert_eq!(b.executer_requete("Gens de Paris", &Parametres::aucun()).unwrap().lignes.len(), 2);
    b.supprimer_requete("Gens de Paris").unwrap();
    assert!(b.lire_requete("Gens de Paris").is_err());
    assert!(b.executer_sql("SELECT * FROM Parisiens", &Parametres::aucun()).is_err());
}

#[test]
fn createur_selection_jointure_criteres_tri_et_parametre() {
    let b = base_demo();
    let mut montant = col("Commandes", "Montant");
    montant.criteres = vec![">= [Montant minimal]".into()];
    montant.tri = Some(SensTri::Decroissant);
    let def = DefinitionRequete {
        tables: vec![SourceRequete { nom: "Clients".into(), alias: None }, SourceRequete { nom: "Commandes".into(), alias: None }],
        jointures: vec![Jointure {
            gauche: "Clients".into(),
            champ_gauche: "N°".into(),
            droite: "Commandes".into(),
            champ_droite: "Client".into(),
            genre: Default::default(),
        }],
        colonnes: vec![col("Clients", "Nom"), montant],
        ..Default::default()
    };
    let g = b.generer_sql(&def).unwrap();
    assert_eq!(g.parametres, ["Montant minimal"]);
    let r = b.executer_definition(&def, &Parametres::Positionnels(vec![json!(10)])).unwrap();
    let noms: Vec<&Value> = r.lignes.iter().map(|l| &l[0]).collect();
    assert_eq!(noms, [&json!("albert"), &json!("Dupont"), &json!("Dupont")]);
}

#[test]
fn createur_totaux_regroupement_et_somme() {
    let b = base_demo();
    let mut client = col("Commandes", "Client");
    client.operation = Some(Operation::Regroupement);
    client.tri = Some(SensTri::Croissant);
    let mut somme = col("Commandes", "Montant");
    somme.operation = Some(Operation::Somme);
    somme.alias = Some("Total".into());
    let def = DefinitionRequete {
        tables: vec![SourceRequete { nom: "Commandes".into(), alias: None }],
        colonnes: vec![client, somme],
        ..Default::default()
    };
    let r = b.executer_definition(&def, &Parametres::aucun()).unwrap();
    assert_eq!(r.colonnes[1].nom, "Total");
    assert_eq!(r.lignes, vec![vec![json!(1), json!(30.5)], vec![json!(2), json!(5.25)], vec![json!(3), json!(100)]]);
}

#[test]
fn requetes_action_mise_a_jour_creation_et_suppression() {
    let b = base_demo();
    let mut ville = col("Clients", "Ville");
    ville.criteres = vec!["\"Paris\"".into()];
    let mut actif = col("Clients", "Actif");
    actif.mise_a_jour = Some("Faux".into());
    let maj = DefinitionRequete {
        genre: GenreRequete::MiseAJour,
        tables: vec![SourceRequete { nom: "Clients".into(), alias: None }],
        colonnes: vec![ville.clone(), actif],
        ..Default::default()
    };
    assert_eq!(b.executer_definition(&maj, &Parametres::aucun()).unwrap().lignes_modifiees, 2);
    assert_eq!(b.valeur_sql("SELECT count(*) FROM Clients WHERE Actif", &Parametres::aucun()).unwrap(), json!(0));

    let creation = DefinitionRequete {
        genre: GenreRequete::CreationTable,
        tables: vec![SourceRequete { nom: "Clients".into(), alias: None }],
        colonnes: vec![col("Clients", "Nom"), ville.clone()],
        table_cible: Some("Archive Paris".into()),
        ..Default::default()
    };
    b.executer_definition(&creation, &Parametres::aucun()).unwrap();
    assert_eq!(b.compter_lignes("Archive Paris").unwrap(), 2);

    let enregistree = requete("Purge", GenreRequete::Suppression, "", Some(serde_json::to_value(DefinitionRequete {
        genre: GenreRequete::Suppression,
        tables: vec![SourceRequete { nom: "Archive Paris".into(), alias: None }],
        colonnes: vec![{
            let mut c = col("Archive Paris", "Nom");
            c.criteres = vec!["Comme \"a*\"".into()];
            c
        }],
        ..Default::default()
    })
    .unwrap()));
    let r = b.enregistrer_requete(&enregistree).unwrap();
    assert!(!r.vue && r.sql.to_uppercase().starts_with("DELETE"), "{}", r.sql);
    assert_eq!(b.executer_requete("Purge", &Parametres::aucun()).unwrap().lignes_modifiees, 1);
    assert_eq!(b.compter_lignes("Archive Paris").unwrap(), 1);
}

const BOUCLE: &str = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT count(*) FROM c";

#[test]
fn sql_sans_fin_est_interrompu_par_le_delai() {
    let b = base_demo();
    b.definir_delai_sql(Some(std::time::Duration::from_millis(300)));
    let debut = std::time::Instant::now();
    let e = b.executer_sql(BOUCLE, &Parametres::aucun()).unwrap_err();
    assert!(debut.elapsed() < std::time::Duration::from_secs(5), "trop long : {:?}", debut.elapsed());
    assert!(matches!(e, ErreurBase::Delai(_)), "{e:?}");
    assert!(e.to_string().contains("a dépassé le délai de"), "{e}");
    // La connexion reste saine et le delai ne persiste pas.
    assert_eq!(b.valeur_sql("SELECT 41 + 1", &Parametres::aucun()).unwrap(), json!(42));
}

#[test]
fn delai_par_defaut_30_s_et_reglable_par_execution() {
    let b = base_demo();
    assert_eq!(b.delai_sql(), Some(forge_base::DELAI_SQL_DEFAUT));
    assert_eq!(forge_base::DELAI_SQL_DEFAUT.as_secs(), 30);
    let o = forge_base::OptionsSql { limite: 10, delai: Some(std::time::Duration::from_millis(200)) };
    let e = b.executer_sql_options(BOUCLE, &Parametres::aucun(), &o).unwrap_err();
    assert_eq!(e.to_string(), "La requête a dépassé le délai de 1 s et a été interrompue.");
    let o = forge_base::OptionsSql { limite: 10, delai: None };
    assert!(b.executer_sql_options("SELECT 1", &Parametres::aucun(), &o).is_ok());
}

#[test]
fn delai_depasse_annule_la_transaction_sans_corrompre_la_base() {
    let b = base_demo();
    b.executer_sql("CREATE TABLE Essai (n INTEGER)", &Parametres::aucun()).unwrap();
    b.commencer_transaction().unwrap();
    b.executer_sql("INSERT INTO Essai VALUES (1)", &Parametres::aucun()).unwrap();
    b.definir_delai_sql(Some(std::time::Duration::from_millis(200)));
    let e = b
        .executer_sql("INSERT INTO Essai WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM c) SELECT x FROM c", &Parametres::aucun())
        .unwrap_err();
    assert!(matches!(e, ErreurBase::Delai(_)), "{e:?}");
    // Ecriture interrompue dans une transaction explicite : SQLite l'annule entierement.
    assert!(!b.en_transaction());
    b.definir_delai_sql(Some(std::time::Duration::from_secs(30)));
    assert_eq!(b.valeur_sql("SELECT count(*) FROM Essai", &Parametres::aucun()).unwrap(), json!(0));
    assert!(b.verifier_integrite().unwrap().ok);
}

#[test]
fn limites_sql_refusent_une_expression_trop_profonde() {
    let b = base_demo();
    let profonde = format!("SELECT {}1{}", "(1+".repeat(300), ")".repeat(300));
    assert!(b.executer_sql(&profonde, &Parametres::aucun()).is_err());
    assert!(b.executer_sql("SELECT ((1+2)*3)", &Parametres::aucun()).is_ok());
}
