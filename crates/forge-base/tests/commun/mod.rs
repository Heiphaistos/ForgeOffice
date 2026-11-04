//! Outils partages par les tests d'integration.
#![allow(dead_code)]

use forge_base::{Base, DefinitionChamp, DefinitionTable, Indexation, Relation, TypeChamp};
use serde_json::{json, Map, Value};

/// Objet JSON a partir d'une macro `json!`.
pub fn obj(v: Value) -> Map<String, Value> {
    match v {
        Value::Object(m) => m,
        _ => panic!("objet JSON attendu"),
    }
}

/// Champ texte court de taille donnee.
pub fn texte(nom: &str, taille: u32) -> DefinitionChamp {
    let mut c = DefinitionChamp::nouveau(nom, TypeChamp::TexteCourt);
    c.proprietes.taille = Some(taille);
    c
}

/// Base de demonstration : Clients (NumeroAuto) et Commandes liees avec integrite.
pub fn base_demo() -> Base {
    let b = Base::en_memoire().expect("base");
    let mut ville = texte("Ville", 50);
    ville.proprietes.indexe = Indexation::AvecDoublons;
    b.creer_table(&DefinitionTable {
        nom: "Clients".into(),
        champs: vec![
            DefinitionChamp::nouveau("N°", TypeChamp::NumeroAuto),
            texte("Nom", 50).requis(),
            ville,
            DefinitionChamp::nouveau("Actif", TypeChamp::OuiNon),
        ],
        proprietes: Default::default(),
    })
    .expect("Clients");
    b.creer_table(&DefinitionTable {
        nom: "Commandes".into(),
        champs: vec![
            DefinitionChamp::nouveau("Id", TypeChamp::NumeroAuto),
            DefinitionChamp::nouveau("Client", TypeChamp::EntierLong),
            DefinitionChamp::nouveau("Montant", TypeChamp::Monetaire),
            DefinitionChamp::nouveau("Date", TypeChamp::DateHeure),
        ],
        proprietes: Default::default(),
    })
    .expect("Commandes");
    for (nom, ville, actif) in [("Dupont", "Paris", true), ("Émile", "Lyon", false), ("albert", "Paris", true)] {
        b.inserer_ligne("Clients", &obj(json!({"Nom": nom, "Ville": ville, "Actif": actif}))).expect("client");
    }
    for (client, montant, date) in [(1, "10,50", "01/02/2024"), (1, "20", "2024-03-05"), (2, "5,25", "15/03/2024"), (3, "100", "2024-04-01")] {
        b.inserer_ligne("Commandes", &obj(json!({"Client": client, "Montant": montant, "Date": date}))).expect("commande");
    }
    b
}

/// Relation Clients -> Commandes avec les options donnees.
pub fn relation_demo(b: &Base, cascade: bool) -> Relation {
    b.creer_relation(&Relation {
        nom: String::new(),
        table_parent: "Clients".into(),
        champs_parent: vec!["N°".into()],
        table_enfant: "Commandes".into(),
        champs_enfant: vec!["Client".into()],
        integrite: true,
        cascade_maj: cascade,
        suppression: if cascade { forge_base::Suppression::Cascade } else { forge_base::Suppression::Restreindre },
        jointure: Default::default(),
    })
    .expect("relation")
}
