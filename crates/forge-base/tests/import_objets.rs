//! Import/export CSV et classeur, formulaires, etats et macros.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::base_demo;
use forge_base::{
    Base, Disposition, GenreObjet, ModeImport, OptionsExport, OptionsImport, Parametres, SourceExport, TypeChamp,
};
use serde_json::json;

#[test]
fn import_csv_francais_deduit_les_types() {
    let b = Base::en_memoire().unwrap();
    let csv = "Nom;Prix;Date;Actif\nStylo;1,50;01/02/2024;Oui\nCahier;12;15/03/2024;Non\n";
    let r = b.importer_csv("Articles", csv, &OptionsImport { ajouter_numero_auto: true, ..Default::default() }).unwrap();
    assert_eq!((r.lignes_lues, r.lignes_importees, r.nb_erreurs), (2, 2, 0));
    let types: Vec<(String, TypeChamp)> = b.champs("Articles").unwrap().into_iter().map(|c| (c.nom, c.type_champ)).collect();
    assert_eq!(types[0], ("N°".to_string(), TypeChamp::NumeroAuto));
    assert_eq!(types[2].1, TypeChamp::ReelDouble);
    assert_eq!(types[3].1, TypeChamp::DateHeure);
    assert_eq!(types[4].1, TypeChamp::OuiNon);
    let r = b.executer_sql("SELECT Prix, Date, Actif FROM Articles ORDER BY Nom DESC", &Parametres::aucun()).unwrap();
    assert_eq!(r.lignes[0], vec![json!(1.5), json!("2024-02-01"), json!(true)]);
}

#[test]
fn import_tabulation_ajout_et_lignes_refusees() {
    let b = base_demo();
    let csv = "Nom\tVille\nZoé\tNice\n\tSans nom\n";
    let o = OptionsImport { mode: ModeImport::Ajouter, ..Default::default() };
    let r = b.importer_csv("Clients", csv, &o).unwrap();
    assert_eq!((r.lignes_importees, r.nb_erreurs), (1, 1));
    assert_eq!(r.erreurs[0].ligne, 2);
    assert_eq!(b.compter_lignes("Clients").unwrap(), 4);
    let tout_ou_rien = OptionsImport { arreter_sur_erreur: true, ..o };
    assert!(b.importer_csv("Clients", csv, &tout_ou_rien).is_err());
    assert_eq!(b.compter_lignes("Clients").unwrap(), 4);
}

#[test]
fn import_lignes_de_classeur() {
    let b = Base::en_memoire().unwrap();
    let entetes = vec!["Produit".to_string(), "Quantité".to_string()];
    let lignes = vec![vec![json!("Pomme"), json!(3)], vec![json!("Poire"), json!(7)]];
    let r = b.importer_lignes("Stock", &entetes, &lignes, &OptionsImport::default()).unwrap();
    assert_eq!(r.lignes_importees, 2);
    assert_eq!(b.valeur_sql("SELECT sum(\"Quantité\") FROM Stock", &Parametres::aucun()).unwrap(), json!(10));
}

#[test]
fn export_csv_francais_et_reimport() {
    let b = base_demo();
    let o = OptionsExport { bom: false, crlf: false, ..Default::default() };
    let sql = SourceExport::Sql { sql: "SELECT Montant, Date FROM Commandes WHERE Id = 1".into(), parametres: Parametres::aucun() };
    assert_eq!(b.exporter_csv(&sql, &o).unwrap(), "Montant;Date\n10,5;01/02/2024\n");
    let csv = b.exporter_csv(&SourceExport::Table { nom: "Clients".into() }, &o).unwrap();
    assert!(csv.contains("Oui") && csv.contains("Émile"), "{csv}");
    let b2 = Base::en_memoire().unwrap();
    assert_eq!(b2.importer_csv("Copie", &csv, &OptionsImport::default()).unwrap().lignes_importees, 3);
    let piege = SourceExport::Sql { sql: "SELECT '=1+1' AS F".into(), parametres: Parametres::aucun() };
    assert_eq!(b.exporter_csv(&piege, &o).unwrap(), "F\n'=1+1\n");
}

#[test]
fn formulaires_etats_instantanes_et_objets() {
    let b = base_demo();
    let f = b.formulaire_instantane("Clients", Disposition::Simple).unwrap();
    let controles = f["sections"]["detail"]["controles"].as_array().unwrap();
    assert_eq!(controles.len(), 4);
    assert!(controles.iter().any(|c| c["type"] == "case_a_cocher"));
    b.enregistrer_objet(GenreObjet::Formulaire, "Fiche client", &f, Some("Saisie")).unwrap();
    let e = b.etat_instantane("Commandes", Some("Client")).unwrap();
    assert_eq!(e["regroupements"][0]["champ"], "Client");
    b.enregistrer_objet(GenreObjet::Etat, "Ventes", &e, None).unwrap();
    b.dupliquer_objet(GenreObjet::Formulaire, "Fiche client", "Fiche 2").unwrap();
    b.renommer_objet(GenreObjet::Formulaire, "Fiche 2", "Fiche bis").unwrap();
    assert_eq!(b.lister_objets_genre(GenreObjet::Formulaire).unwrap().len(), 2);
    assert_eq!(b.lire_objet(GenreObjet::Formulaire, "Fiche client").unwrap().description.as_deref(), Some("Saisie"));
    b.supprimer_objet(GenreObjet::Formulaire, "Fiche bis").unwrap();
    let genres: Vec<GenreObjet> = b.lister_objets().unwrap().into_iter().map(|o| o.genre).collect();
    assert!(genres.contains(&GenreObjet::Formulaire) && genres.contains(&GenreObjet::Etat) && genres.contains(&GenreObjet::Table));
    assert!(b.enregistrer_objet(GenreObjet::Table, "X", &json!({}), None).is_err());
}

#[test]
fn macro_donnees_tout_ou_rien_et_actions_interface() {
    let b = base_demo();
    let m = json!({"actions": [
        {"action": "executer_sql", "arguments": {"sql": "UPDATE Clients SET Actif = 0"}},
        {"action": "zone_message", "arguments": {"message": "Fini"}},
    ]});
    b.enregistrer_objet(GenreObjet::Macro, "Désactiver", &m, None).unwrap();
    let ui = b.executer_macro("Désactiver").unwrap();
    assert_eq!(ui, vec![json!({"action": "zone_message", "arguments": {"message": "Fini"}})]);
    assert_eq!(b.valeur_sql("SELECT count(*) FROM Clients WHERE Actif", &Parametres::aucun()).unwrap(), json!(0));
    let casse = json!({"actions": [
        {"action": "executer_sql", "arguments": {"sql": "UPDATE Clients SET Actif = 1"}},
        {"action": "executer_sql", "arguments": {"sql": "INSERT INTO Clients (Nom) VALUES (NULL)"}},
    ]});
    b.enregistrer_objet(GenreObjet::Macro, "Cassée", &casse, None).unwrap();
    assert!(b.executer_macro("Cassée").unwrap_err().to_string().contains("étape 2"));
    assert_eq!(b.valeur_sql("SELECT count(*) FROM Clients WHERE Actif", &Parametres::aucun()).unwrap(), json!(0));
}
