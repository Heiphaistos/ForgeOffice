//! Sous-formulaires, etats regroupes sur plusieurs niveaux, resultats de requete editables.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj, relation_demo};
use forge_base::{
    ColonneRequete, DefinitionRequete, Disposition, GenreObjet, GenreRequete, LienChamps, OptionsLecture, Parametres, Regroupement,
    RequeteEnregistree, SourceRequete,
};
use serde_json::{json, Value};

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

fn enregistrer(b: &forge_base::Base, nom: &str, def: DefinitionRequete) {
    b.enregistrer_requete(&RequeteEnregistree {
        nom: nom.into(),
        genre: GenreRequete::Selection,
        sql: String::new(),
        definition: Some(serde_json::to_value(def).unwrap()),
        description: None,
        parametres: vec![],
        vue: false,
    })
    .unwrap();
}

// ── Sous-formulaires ─────────────────────────────────────────────────────────

#[test]
fn sous_formulaire_deduit_les_liens_de_la_relation_et_lit_les_lignes_liees() {
    let b = base_demo();
    relation_demo(&b, false);
    let sous = b.sous_formulaire("Clients", "Commandes", &[], Disposition::FeuilleDonnees).unwrap();
    assert_eq!(sous.liens, vec![LienChamps { maitre: "N°".into(), detail: "Client".into() }]);
    // Ligne maitre = client 1 : ses deux commandes ; client 2 : une ; inconnu ou Null : aucune.
    let lire = |maitre: Value| b.lire_sous_formulaire(&sous, &obj(maitre), &OptionsLecture::default()).unwrap();
    assert_eq!(lire(json!({"N°": 1})).total, 2);
    assert_eq!(lire(json!({"n°": 2})).total, 1);
    assert_eq!(lire(json!({"N°": 99})).total, 0);
    assert_eq!(lire(json!({"N°": null})).total, 0);
    assert_eq!(lire(json!({})).total, 0);
    // Un filtre de l'appelant s'ajoute au lien.
    let o = OptionsLecture { expression: Some("[Montant] > 15".into()), ..Default::default() };
    assert_eq!(b.lire_sous_formulaire(&sous, &obj(json!({"N°": 1})), &o).unwrap().total, 1);
    // Valeurs a pre-remplir dans une nouvelle ligne.
    assert_eq!(b.valeurs_liees(&sous, &obj(json!({"N°": 3}))), obj(json!({"Client": 3})));
}

#[test]
fn sous_formulaire_champs_explicites_verifies_et_controle_json() {
    let b = base_demo();
    let liens = [LienChamps { maitre: "n°".into(), detail: "client".into() }];
    let sous = b.sous_formulaire("Clients", "Commandes", &liens, Disposition::Tabulaire).unwrap();
    assert_eq!(sous.liens[0], LienChamps { maitre: "N°".into(), detail: "Client".into() });
    assert!(b.sous_formulaire("Clients", "Commandes", &[], Disposition::Tabulaire).is_err(), "sans relation ni liens");
    assert!(b.sous_formulaire("Clients", "Commandes", &[LienChamps { maitre: "Nom".into(), detail: "Absent".into() }], Disposition::Simple).is_err());
    let f = b.formulaire_avec_sous_formulaire("Clients", "Commandes", &liens, Disposition::FeuilleDonnees).unwrap();
    let controles = f["sections"]["detail"]["controles"].as_array().unwrap();
    let c = controles.last().unwrap();
    assert_eq!((c["type"].as_str(), c["source"].as_str()), (Some("sous_formulaire"), Some("Commandes")));
    assert_eq!((c["champs_maitre"].clone(), c["champs_detail"].clone()), (json!(["N°"]), json!(["Client"])));
    assert!(c["y"].as_i64().unwrap() > controles[0]["y"].as_i64().unwrap(), "place sous les champs");
    // Enregistrement : un controle incoherent est refuse, un bon controle est relu.
    b.enregistrer_objet(GenreObjet::Formulaire, "Fiche client", &f, None).unwrap();
    let mauvais = json!({ "sections": { "detail": { "controles": [{ "type": "sous_formulaire", "source": "Commandes", "champs_maitre": ["a", "b"], "champs_detail": ["x"] }] } } });
    assert!(b.enregistrer_objet(GenreObjet::Formulaire, "Mauvais", &mauvais, None).is_err());
    let relu = forge_base::SousFormulaire::depuis_controle(c).unwrap();
    assert_eq!((relu.source, relu.liens), (sous.source, sous.liens));
}

#[test]
fn renommage_de_table_suit_dans_le_sous_formulaire() {
    let b = base_demo();
    let f = b.formulaire_avec_sous_formulaire("Clients", "Commandes", &[LienChamps { maitre: "N°".into(), detail: "Client".into() }], Disposition::FeuilleDonnees).unwrap();
    b.enregistrer_objet(GenreObjet::Formulaire, "Fiche", &f, None).unwrap();
    b.renommer_table("Commandes", "Achats").unwrap();
    let lu = b.lire_objet(GenreObjet::Formulaire, "Fiche").unwrap().contenu;
    assert_eq!(lu["sections"]["detail"]["controles"].as_array().unwrap().last().unwrap()["source"], json!("Achats"));
}

// ── Etats a plusieurs niveaux ─────────────────────────────────────────────────

#[test]
fn etat_instantane_regroupe_sur_plusieurs_niveaux_et_reste_compatible() {
    let b = base_demo();
    // Compatibilite : un seul niveau, meme definition qu'avant.
    let un = b.etat_instantane("Commandes", Some("Client")).unwrap();
    let un_nouveau = b.etat_instantane_regroupe("Commandes", &[Regroupement::nouveau("Client")]).unwrap();
    assert_eq!(un, un_nouveau);
    assert_eq!(un["regroupements"][0], json!({ "champ": "Client", "tri": "croissant", "entete": true, "pied": true }));
    let deux = b.etat_instantane_regroupe("Clients", &[Regroupement::nouveau("Ville"), Regroupement { champ: "Actif".into(), tri: forge_base::SensTri::Decroissant, entete: true, pied: false }]).unwrap();
    assert_eq!(deux["regroupements"].as_array().unwrap().len(), 2);
    assert_eq!(deux["regroupements"][1]["tri"], json!("decroissant"));
    // Les champs de regroupement ne sont plus des colonnes de detail.
    let detail: Vec<&str> = deux["sections"]["detail"]["controles"].as_array().unwrap().iter().filter_map(|c| c["champ"].as_str()).collect();
    assert!(!detail.contains(&"Ville") && !detail.contains(&"Actif") && detail.contains(&"Nom"), "{detail:?}");
    assert!(b.etat_instantane_regroupe("Clients", &[Regroupement::nouveau("Ville"), Regroupement::nouveau("ville")]).is_err());
    assert!(b.etat_instantane_regroupe("Clients", &[Regroupement::nouveau("Inconnu")]).is_err());
}

#[test]
fn execution_d_etat_regroupe_effectifs_et_sommes_par_niveau() {
    let b = base_demo();
    b.inserer_ligne("Commandes", &obj(json!({"Client": 1, "Montant": "4", "Date": "2024-05-01"}))).unwrap();
    // Client puis Montant decroissant : 3 clients, sommes 34,5 (1) / 5,25 (2) / 100 (3).
    let def = json!({ "source": "Commandes", "regroupements": [ { "champ": "Client" } ] });
    let r = b.executer_etat_definition(&def).unwrap();
    let g = r["groupes"].as_array().unwrap();
    assert_eq!(g.len(), 3);
    assert_eq!((g[0]["valeur"].clone(), g[0]["nb"].clone()), (json!(1), json!(3)));
    assert!((g[0]["totaux"]["Montant"].as_f64().unwrap() - 34.5).abs() < 1e-9);
    assert_eq!(g[0]["lignes"].as_array().unwrap().len(), 3);
    assert!((r["totaux"]["Montant"].as_f64().unwrap() - 139.75).abs() < 1e-9);
    assert_eq!((r["nb_lignes"].clone(), r["tronque"].clone()), (json!(5), json!(false)));

    // Deux niveaux : Ville puis Actif (decroissant).
    let def = json!({ "source": "Clients", "regroupements": [ { "champ": "Ville" }, { "champ": "Actif", "tri": "decroissant" } ] });
    let r = b.executer_etat_definition(&def).unwrap();
    let villes = r["groupes"].as_array().unwrap();
    assert_eq!(villes.iter().map(|v| v["valeur"].clone()).collect::<Vec<_>>(), vec![json!("Lyon"), json!("Paris")]);
    let paris = &villes[1];
    assert_eq!(paris["nb"], json!(2));
    let actifs = paris["groupes"].as_array().unwrap();
    assert_eq!(actifs.len(), 1);
    assert_eq!((actifs[0]["niveau"].clone(), actifs[0]["valeur"].clone(), actifs[0]["nb"].clone()), (json!(1), json!(true), json!(2)));
    assert_eq!(actifs[0]["lignes"].as_array().unwrap().len(), 2);
    assert_eq!(villes[0]["groupes"][0]["valeur"], json!(false));
}

#[test]
fn execution_d_etat_ancienne_cle_regroupement_et_sans_regroupement() {
    let b = base_demo();
    let r = b.executer_etat_definition(&json!({ "source": "Clients", "regroupement": "Ville" })).unwrap();
    assert_eq!(r["groupes"].as_array().unwrap().len(), 2);
    let r = b.executer_etat_definition(&json!({ "source": "Clients" })).unwrap();
    assert_eq!(r["lignes"].as_array().unwrap().len(), 3);
    assert!(r.get("groupes").is_none());
    // Etat enregistre : execution par son nom, avec le filtre de la definition.
    let mut def = b.etat_instantane("Clients", Some("Ville")).unwrap();
    def["expression"] = json!("[Actif] = Vrai");
    b.enregistrer_objet(GenreObjet::Etat, "Actifs", &def, None).unwrap();
    let r = b.executer_etat("Actifs").unwrap();
    assert_eq!(r["nb_lignes"], json!(2));
    assert!(b.executer_etat_definition(&json!({ "source": "Clients", "regroupements": [ {"champ":"Ville"}, {"champ":"Ville"} ] })).is_err());
}

// ── Requetes editables ───────────────────────────────────────────────────────

#[test]
fn requete_sur_une_table_est_editable_avec_cle_ajoutee_et_correspondance() {
    let b = base_demo();
    let mut ville = col("Clients", "Ville");
    ville.criteres = vec!["\"Paris\"".into()];
    let mut nom = col("Clients", "Nom");
    nom.alias = Some("Client".into());
    let mut calc = col("Clients", "Calcul: [Nom] & \"!\"");
    calc.table = None;
    enregistrer(&b, "Parisiens", DefinitionRequete { tables: vec![SourceRequete { nom: "Clients".into(), alias: None }], colonnes: vec![nom, ville, calc], ..Default::default() });
    let r = b.executer_requete_editable("Parisiens", &Parametres::aucun()).unwrap();
    assert!(r.modifiable, "{:?}", r.raison);
    assert_eq!(r.table.as_deref(), Some("Clients"));
    // La cle (N°) n'est pas dans la requete : ajoutee puis retiree du resultat.
    assert_eq!(r.resultat.colonnes.iter().map(|c| c.nom.as_str()).collect::<Vec<_>>(), vec!["Client", "Ville", "Calcul"]);
    assert!(r.resultat.lignes.iter().all(|l| l.len() == 3));
    assert_eq!(r.resultat.lignes.len(), 2);
    assert_eq!(r.cles.len(), 2);
    assert_eq!(r.cles[0].keys().collect::<Vec<_>>(), vec!["N°"]);
    let mapping: Vec<(usize, &str, &str, bool)> = r.correspondance.iter().map(|m| (m.position, m.colonne.as_str(), m.champ.as_str(), m.modifiable)).collect();
    assert_eq!(mapping, vec![(0, "Client", "Nom", true), (1, "Ville", "Ville", true)]);
    // Ecriture par cle via les noms de colonnes du resultat.
    b.modifier_ligne_requete("Parisiens", &r.cles[0], &obj(json!({"Client": "Dupond"}))).unwrap();
    assert_eq!(b.valeur_sql("SELECT Nom FROM Clients WHERE \"N°\" = 1", &Parametres::aucun()).unwrap(), json!("Dupond"));
    let e = b.modifier_ligne_requete("Parisiens", &r.cles[0], &obj(json!({"Calcul": "x"}))).unwrap_err();
    assert!(e.to_string().contains("lecture seule"), "{e}");
}

#[test]
fn requete_avec_etoile_garde_sa_cle_et_interdit_les_champs_auto() {
    let b = base_demo();
    enregistrer(&b, "Tous", DefinitionRequete { tables: vec![SourceRequete { nom: "Clients".into(), alias: None }], colonnes: vec![col("Clients", "*")], ..Default::default() });
    let r = b.executer_requete_editable("Tous", &Parametres::aucun()).unwrap();
    assert!(r.modifiable);
    assert_eq!(r.resultat.colonnes.len(), 4);
    let auto = r.correspondance.iter().find(|m| m.champ == "N°").unwrap();
    assert!(!auto.modifiable);
    assert_eq!(r.cles[2]["N°"], json!(3));
    assert!(b.modifier_ligne_requete("Tous", &r.cles[0], &obj(json!({"N°": 9}))).is_err());
}

#[test]
fn requetes_non_editables_disent_pourquoi() {
    let b = base_demo();
    // Jointure.
    let mut j = DefinitionRequete {
        tables: vec![SourceRequete { nom: "Clients".into(), alias: None }, SourceRequete { nom: "Commandes".into(), alias: None }],
        colonnes: vec![col("Clients", "Nom"), col("Commandes", "Montant")],
        jointures: vec![forge_base::Jointure { gauche: "Clients".into(), champ_gauche: "N°".into(), droite: "Commandes".into(), champ_droite: "Client".into(), genre: Default::default() }],
        ..Default::default()
    };
    enregistrer(&b, "Jointe", j.clone());
    let r = b.executer_requete_editable("Jointe", &Parametres::aucun()).unwrap();
    assert!(!r.modifiable && r.raison.as_deref().unwrap().contains("jointure") && r.cles.is_empty());
    assert_eq!(r.resultat.lignes.len(), 4, "le resultat reste lisible");
    // Totaux.
    j.jointures.clear();
    j.tables.truncate(1);
    j.colonnes = vec![{ let mut c = col("Clients", "Ville"); c.operation = Some(forge_base::Operation::Regroupement); c }];
    enregistrer(&b, "Groupee", j.clone());
    assert!(!b.executer_requete_editable("Groupee", &Parametres::aucun()).unwrap().modifiable);
    // Valeurs distinctes sans la cle, SQL direct, requete sur une requete.
    j.colonnes = vec![col("Clients", "Ville")];
    j.distinct = true;
    enregistrer(&b, "Distincte", j);
    assert!(b.executer_requete_editable("Distincte", &Parametres::aucun()).unwrap().raison.unwrap().contains("distinctes"));
    b.enregistrer_requete(&RequeteEnregistree { nom: "Sql".into(), genre: GenreRequete::Selection, sql: "SELECT Nom FROM Clients".into(), definition: None, description: None, parametres: vec![], vue: false }).unwrap();
    assert!(b.executer_requete_editable("Sql", &Parametres::aucun()).unwrap().raison.unwrap().contains("SQL"));
    enregistrer(&b, "Sur requete", DefinitionRequete { tables: vec![SourceRequete { nom: "Sql".into(), alias: None }], colonnes: vec![col("Sql", "Nom")], ..Default::default() });
    assert!(b.executer_requete_editable("Sur requete", &Parametres::aucun()).unwrap().raison.unwrap().contains("requête ou une vue"));
    assert!(b.modifier_ligne_requete("Sql", &obj(json!({})), &obj(json!({"Nom": "x"}))).is_err());
}
