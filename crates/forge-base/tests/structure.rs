//! Mode Creation : types Access, proprietes de champ, modifications de structure.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj, texte};
use forge_base::{
    Base, DefinitionChamp, DefinitionTable, ErreurBase, Indexation, OptionsLecture, Parametres, ProprietesTable,
    RequeteEnregistree, TypeChamp, TOUS_LES_TYPES,
};
use serde_json::json;

fn table_tous_types(b: &Base) {
    let mut champs: Vec<DefinitionChamp> = TOUS_LES_TYPES
        .iter()
        .filter(|t| **t != TypeChamp::Calcule)
        .map(|t| DefinitionChamp::nouveau(&format!("C_{}", t.libelle().replace('/', "_")), *t))
        .collect();
    let mut calc = DefinitionChamp::nouveau("Double", TypeChamp::Calcule);
    calc.proprietes.expression = Some("[C_Entier long]*2".into());
    calc.proprietes.type_resultat = Some(TypeChamp::EntierLong);
    champs.push(calc);
    b.creer_table(&DefinitionTable { nom: "Tout".into(), champs, proprietes: Default::default() }).unwrap();
}

#[test]
fn tous_les_types_access_aller_retour() {
    let b = Base::en_memoire().unwrap();
    table_tous_types(&b);
    let champs = b.champs("Tout").unwrap();
    assert_eq!(champs.len(), TOUS_LES_TYPES.len());
    let attendus = TOUS_LES_TYPES.iter().filter(|t| **t != TypeChamp::Calcule).chain([&TypeChamp::Calcule]);
    for (c, t) in champs.iter().zip(attendus) {
        assert_eq!(c.type_champ, *t, "{}", c.nom);
        assert!(!c.deduit);
    }
    assert!(champs.last().unwrap().genere);
    let cle = b
        .inserer_ligne("Tout", &obj(json!({"C_Entier long": 21, "C_Oui_Non": "oui", "C_Date_Heure": "14/07/2024 08:30"})))
        .unwrap();
    let ligne = b.lire_ligne("Tout", &cle).unwrap().unwrap();
    assert_eq!(ligne["Double"], json!(42));
    assert_eq!(ligne["C_Oui_Non"], json!(true));
    assert_eq!(ligne["C_Date_Heure"], json!("2024-07-14T08:30:00"));
    let e = b.modifier_ligne("Tout", &cle, &obj(json!({"Double": 3}))).unwrap_err();
    assert!(e.to_string().contains("lecture seule"), "{e}");
}

#[test]
fn proprietes_de_champ_conservees() {
    let b = Base::en_memoire().unwrap();
    let mut c = texte("Code", 5);
    c.proprietes.legende = Some("Code postal".into());
    c.proprietes.masque_saisie = Some("00000".into());
    c.proprietes.format = Some(">".into());
    c.proprietes.description = Some("Code à 5 chiffres".into());
    c.proprietes.indexe = Indexation::SansDoublons;
    b.creer_table(&DefinitionTable { nom: "Villes".into(), champs: vec![c.clone()], proprietes: Default::default() }).unwrap();
    let lu = &b.champs("Villes").unwrap()[0];
    assert_eq!(lu.proprietes, c.proprietes);
    assert_eq!(lu.type_sqlite, "VARCHAR(5)");
    let index = b.index_table("Villes").unwrap();
    assert!(index.iter().any(|i| i.unique && i.origine == "champ" && i.champs[0].nom == "Code"));
}

#[test]
fn taille_requis_validation_et_doublons() {
    let b = Base::en_memoire().unwrap();
    let mut prix = DefinitionChamp::nouveau("Prix", TypeChamp::Monetaire);
    prix.proprietes.valide_si = Some(">=0 Et <1000".into());
    prix.proprietes.message_validation = Some("Le prix doit être entre 0 et 1000 €.".into());
    let mut code = texte("Code", 4).requis();
    code.proprietes.indexe = Indexation::SansDoublons;
    code.proprietes.chaine_vide_autorisee = Some(false);
    b.creer_table(&DefinitionTable { nom: "Articles".into(), champs: vec![code, prix], proprietes: Default::default() }).unwrap();
    b.inserer_ligne("Articles", &obj(json!({"Code": "A1", "Prix": "12,5"}))).unwrap();
    let e = b.inserer_ligne("Articles", &obj(json!({"Code": "TROPLONG"}))).unwrap_err();
    assert!(matches!(&e, ErreurBase::Validation { champ, message } if champ == "Code" && message.contains("4 caractères")), "{e}");
    let e = b.inserer_ligne("Articles", &obj(json!({"Code": "B2", "Prix": 5000}))).unwrap_err();
    assert_eq!(e.to_string(), "Valeur refusée pour « Prix » : Le prix doit être entre 0 et 1000 €.");
    let e = b.inserer_ligne("Articles", &obj(json!({"Prix": 1}))).unwrap_err();
    assert_eq!(e.to_string(), "Le champ « Code » est obligatoire.");
    let e = b.inserer_ligne("Articles", &obj(json!({"Code": "A1"}))).unwrap_err();
    assert!(e.to_string().starts_with("Doublon refusé"), "{e}");
    assert!(b.inserer_ligne("Articles", &obj(json!({"Code": ""}))).unwrap_err().to_string().contains("chaîne vide"));
    // La regle protege aussi le SQL direct.
    let e = b.executer_sql("INSERT INTO Articles(Code, Prix) VALUES ('Z', -1)", &Parametres::aucun()).unwrap_err();
    assert!(e.to_string().contains("entre 0 et 1000"), "{e}");
}

#[test]
fn valeurs_par_defaut_et_liste_de_choix() {
    let b = Base::en_memoire().unwrap();
    let mut pays = texte("Pays", 30);
    pays.proprietes.valeur_defaut = Some("France".into());
    let mut statut = texte("Statut", 10);
    statut.proprietes.liste_valeurs = vec!["Ouvert".into(), "Fermé".into()];
    statut.proprietes.limiter_a_liste = true;
    let mut cree = DefinitionChamp::nouveau("Créé", TypeChamp::DateHeure);
    cree.proprietes.valeur_defaut = Some("Date()".into());
    let mut qte = DefinitionChamp::nouveau("Qté", TypeChamp::Entier);
    qte.proprietes.valeur_defaut = Some("1".into());
    b.creer_table(&DefinitionTable { nom: "Dossiers".into(), champs: vec![pays, statut, cree, qte], proprietes: Default::default() })
        .unwrap();
    let cle = b.inserer_ligne("Dossiers", &obj(json!({"Statut": "Ouvert"}))).unwrap();
    let l = b.lire_ligne("Dossiers", &cle).unwrap().unwrap();
    assert_eq!(l["Pays"], json!("France"));
    assert_eq!(l["Qté"], json!(1));
    assert_eq!(l["Créé"].as_str().unwrap().len(), 10);
    assert!(b.inserer_ligne("Dossiers", &obj(json!({"Statut": "Perdu"}))).unwrap_err().to_string().contains("liste"));
    assert!(b.inserer_ligne("Dossiers", &obj(json!({"Qté": 40000}))).unwrap_err().to_string().contains("-32768"));
}

#[test]
fn ajouter_deplacer_supprimer_un_champ_garde_les_donnees() {
    let b = base_demo();
    b.ajouter_champ("Clients", &texte("Email", 120), None).unwrap();
    assert_eq!(b.champs("Clients").unwrap().last().unwrap().nom, "Email");
    b.ajouter_champ("Clients", &DefinitionChamp::nouveau("Remise", TypeChamp::ReelSimple), Some(1)).unwrap();
    assert_eq!(b.champs("Clients").unwrap()[1].nom, "Remise");
    b.deplacer_champ("Clients", "Email", 0).unwrap();
    assert_eq!(b.champs("Clients").unwrap()[0].nom, "Email");
    b.supprimer_champ("Clients", "Remise").unwrap();
    let p = b.lire_table("Clients", &OptionsLecture::default()).unwrap();
    assert_eq!(p.total, 3);
    let noms: Vec<&str> = p.colonnes.iter().map(|c| c.nom.as_str()).collect();
    assert_eq!(noms, ["Email", "N°", "Nom", "Ville", "Actif"]);
    assert_eq!(p.lignes[0][2], json!("Dupont"));
    assert!(b.supprimer_champ("Clients", "Inconnu").is_err());
}

#[test]
fn renommer_un_champ_met_a_jour_vues_et_requetes() {
    let b = base_demo();
    b.enregistrer_requete(&RequeteEnregistree {
        nom: "Parisiens".into(),
        genre: Default::default(),
        sql: "SELECT Nom, Ville FROM Clients WHERE Ville = 'Paris'".into(),
        definition: None,
        description: None,
        parametres: vec![],
        vue: false,
    })
    .unwrap();
    let r = b.renommer_champ("Clients", "Ville", "Commune").unwrap();
    assert!(r.avertissements.is_empty(), "{r:?}");
    assert_eq!(b.executer_requete("Parisiens", &Parametres::aucun()).unwrap().lignes.len(), 2);
    let noms: Vec<String> = b.champs("Clients").unwrap().into_iter().map(|c| c.nom).collect();
    assert!(noms.contains(&"Commune".to_string()));
    assert!(b.index_table("Clients").unwrap().iter().any(|i| i.champs[0].nom == "Commune"));
}

#[test]
fn changer_de_type_valide_les_donnees_existantes() {
    let b = base_demo();
    let nom = texte("Nom", 3).requis();
    let e = b.modifier_champ("Clients", "Nom", &nom).unwrap_err();
    assert!(e.to_string().contains("enregistrements existants"), "{e}");
    // Rien n'a change apres l'echec (transaction annulee).
    assert_eq!(b.champs("Clients").unwrap()[1].proprietes.taille, Some(50));
    assert_eq!(b.compter_lignes("Clients").unwrap(), 3);
    b.modifier_champ("Clients", "Nom", &texte("Nom", 100)).unwrap();
    assert_eq!(b.champs("Clients").unwrap()[1].type_sqlite, "VARCHAR(100)");
}

#[test]
fn numero_auto_continue_apres_reconstruction() {
    let b = base_demo();
    b.supprimer_lignes("Clients", &[obj(json!({"N°": 3}))]).unwrap();
    b.ajouter_champ("Clients", &texte("Tel", 20), Some(0)).unwrap();
    let cle = b.inserer_ligne("Clients", &obj(json!({"Nom": "Nouveau"}))).unwrap();
    assert_eq!(cle["N°"], json!(4), "le compteur ne doit pas reutiliser 3");
}

#[test]
fn regle_de_table_et_proprietes() {
    let b = Base::en_memoire().unwrap();
    b.creer_table(&DefinitionTable {
        nom: "Séjours".into(),
        champs: vec![DefinitionChamp::nouveau("Début", TypeChamp::DateHeure), DefinitionChamp::nouveau("Fin", TypeChamp::DateHeure)],
        proprietes: Default::default(),
    })
    .unwrap();
    let regle = ProprietesTable {
        valide_si: Some("[Fin] >= [Début]".into()),
        message_validation: Some("La fin précède le début.".into()),
        ..Default::default()
    };
    b.modifier_proprietes_table("Séjours", &regle).unwrap();
    let e = b.inserer_ligne("Séjours", &obj(json!({"Début": "10/05/2024", "Fin": "01/05/2024"}))).unwrap_err();
    assert_eq!(e.to_string(), "Valeur refusée pour « * » : La fin précède le début.");
    b.inserer_ligne("Séjours", &obj(json!({"Début": "01/05/2024", "Fin": "10/05/2024"}))).unwrap();
    let desc = ProprietesTable { description: Some("Réservations".into()), ..regle };
    b.modifier_proprietes_table("Séjours", &desc).unwrap();
    assert_eq!(b.schema_table("Séjours").unwrap().proprietes.description.as_deref(), Some("Réservations"));
}

#[test]
fn renommer_copier_vider_supprimer_une_table() {
    let b = base_demo();
    b.copier_table("Clients", "Clients 2", true).unwrap();
    assert_eq!(b.compter_lignes("Clients 2").unwrap(), 3);
    b.copier_table("Clients", "Modèle", false).unwrap();
    assert_eq!(b.compter_lignes("Modèle").unwrap(), 0);
    b.renommer_table("Clients 2", "Archives").unwrap();
    assert!(b.lister_tables().unwrap().contains(&"Archives".to_string()));
    assert_eq!(b.champs("Archives").unwrap()[1].proprietes.taille, Some(50));
    assert_eq!(b.vider_table("Archives").unwrap(), 3);
    b.supprimer_table("Archives", false).unwrap();
    assert!(matches!(b.compter_lignes("Archives"), Err(ErreurBase::Introuvable(_))));
    assert!(matches!(b.renommer_table("Modèle", "Clients"), Err(ErreurBase::ExisteDeja(_))));
    let doublon = DefinitionTable { nom: "Clients".into(), champs: vec![texte("x", 1)], proprietes: Default::default() };
    assert!(b.creer_table(&doublon).is_err());
}

#[test]
fn table_creee_ailleurs_types_deduits() {
    let b = Base::en_memoire().unwrap();
    b.executer_script("CREATE TABLE ext(id INTEGER PRIMARY KEY, nom TEXT NOT NULL, prix REAL, ok BOOLEAN, code VARCHAR(8), quand DATE)")
        .unwrap();
    let c = b.champs("ext").unwrap();
    let types: Vec<TypeChamp> = c.iter().map(|c| c.type_champ).collect();
    assert_eq!(
        types,
        [TypeChamp::NumeroAuto, TypeChamp::TexteLong, TypeChamp::ReelDouble, TypeChamp::OuiNon, TypeChamp::TexteCourt, TypeChamp::DateHeure]
    );
    assert!(c.iter().all(|c| c.deduit));
    assert!(c[1].proprietes.requis);
    // Une modification de structure adopte la table (metadonnees ecrites).
    b.ajouter_champ("ext", &texte("note", 10), Some(1)).unwrap();
    assert!(b.champs("ext").unwrap().iter().all(|c| !c.deduit));
}

#[test]
fn noms_etranges_et_cles_composees() {
    let b = Base::en_memoire().unwrap();
    let t = "Tab\"le; DROP TABLE x --";
    b.creer_table(&DefinitionTable {
        nom: t.into(),
        champs: vec![texte("Cl\"é", 10).cle(), texte("N° ligne", 10).cle(), texte("Valeur", 10)],
        proprietes: Default::default(),
    })
    .unwrap();
    b.inserer_ligne(t, &obj(json!({"Cl\"é": "a", "N° ligne": "1", "Valeur": "v"}))).unwrap();
    assert!(b.inserer_ligne(t, &obj(json!({"Cl\"é": "a", "N° ligne": "1"}))).is_err());
    b.modifier_ligne(t, &obj(json!({"Cl\"é": "a", "N° ligne": "1"})), &obj(json!({"Valeur": "w"}))).unwrap();
    let s = b.schema_table(t).unwrap();
    assert_eq!(s.cle_primaire, vec!["Cl\"é", "N° ligne"]);
    assert_eq!(b.lire_table(t, &OptionsLecture::default()).unwrap().lignes[0][2], json!("w"));
    b.definir_cle_primaire(t, &["Valeur"]).unwrap();
    assert_eq!(b.schema_table(t).unwrap().cle_primaire, vec!["Valeur"]);
}

#[test]
fn definitions_invalides_refusees() {
    let b = Base::en_memoire().unwrap();
    let table = |champs: Vec<DefinitionChamp>| DefinitionTable { nom: "A".into(), champs, proprietes: Default::default() };
    let mut auto = DefinitionChamp::nouveau("N", TypeChamp::NumeroAuto);
    auto.cle_primaire = false;
    assert!(b.creer_table(&table(vec![auto])).is_err());
    assert!(b.creer_table(&table(vec![])).is_err());
    assert!(b.creer_table(&table(vec![texte("x", 1), texte("X", 1)])).is_err());
    let interne = DefinitionTable { nom: "__fo_pirate".into(), champs: vec![texte("x", 1)], proprietes: Default::default() };
    assert!(b.creer_table(&interne).is_err());
    let mut calc = DefinitionChamp::nouveau("C", TypeChamp::Calcule);
    calc.proprietes.expression = Some("Maintenant()".into());
    assert!(b.creer_table(&table(vec![calc])).is_err());
    assert!(b.lister_tables().unwrap().is_empty());
}
