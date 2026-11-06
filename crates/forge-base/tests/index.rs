//! Index nommes sur plusieurs champs : creation, unicite, listage, reconstruction de table.
#![allow(clippy::unwrap_used, clippy::expect_used)]

mod commun;

use commun::{base_demo, obj};
use forge_base::{ChampIndex, DefinitionChamp, DefinitionIndex, DefinitionTable, ErreurBase, TypeChamp};
use serde_json::json;

fn idx(nom: &str, champs: &[(&str, bool)], unique: bool) -> DefinitionIndex {
    DefinitionIndex { nom: nom.into(), champs: champs.iter().map(|(n, d)| ChampIndex { nom: (*n).into(), decroissant: *d }).collect(), unique }
}

#[test]
fn creation_listage_et_schema_expose() {
    let b = base_demo();
    let i = b.creer_index("Clients", &idx("Nom_Ville", &[("nom", false), ("Ville", true)], true)).unwrap();
    assert_eq!((i.nom.as_str(), i.origine, i.unique), ("Nom_Ville", "nomme", true));
    assert_eq!(i.champs.iter().map(|c| (c.nom.as_str(), c.decroissant)).collect::<Vec<_>>(), vec![("Nom", false), ("Ville", true)]);
    assert_eq!(b.lister_index_nommes("Clients").unwrap().len(), 1);
    // L'index « Ville » de la propriete Indexe et la cle primaire restent listes a part.
    let schema = b.schema_table("Clients").unwrap();
    assert!(schema.index.iter().any(|i| i.origine == "champ"));
    assert!(schema.index.iter().any(|i| i.nom == "Nom_Ville" && i.origine == "nomme"));
    assert!(b.documenter().unwrap().to_string().contains("Nom_Ville"));
}

#[test]
fn unicite_sur_la_combinaison_des_champs() {
    let b = base_demo();
    b.creer_index("Clients", &idx("Nom_Ville", &[("Nom", false), ("Ville", false)], true)).unwrap();
    // Meme nom dans une autre ville : accepte ; meme couple : refuse.
    b.inserer_ligne("Clients", &obj(json!({"Nom": "Dupont", "Ville": "Lyon"}))).unwrap();
    let e = b.inserer_ligne("Clients", &obj(json!({"Nom": "Dupont", "Ville": "Paris"}))).unwrap_err();
    assert!(matches!(e, ErreurBase::Contrainte(_)), "{e:?}");
}

#[test]
fn index_sans_doublons_refuse_si_doublons_presents() {
    let b = base_demo();
    let e = b.creer_index("Clients", &idx("Ville_U", &[("Ville", false)], true)).unwrap_err();
    assert!(e.to_string().contains("doublon"), "{e}");
    assert!(b.lister_index_nommes("Clients").unwrap().is_empty());
}

#[test]
fn refus_des_definitions_invalides() {
    let b = base_demo();
    let nom = b.creer_index("Clients", &idx("A", &[("Nom", false)], false));
    assert!(nom.is_ok());
    assert!(matches!(b.creer_index("Clients", &idx("a", &[("Ville", false)], false)).unwrap_err(), ErreurBase::ExisteDeja(_)));
    assert!(b.creer_index("Clients", &idx("B", &[], false)).is_err());
    assert!(b.creer_index("Clients", &idx("B", &[("Nom", false), ("nom", true)], false)).is_err());
    assert!(b.creer_index("Clients", &idx("B", &[("Inconnu", false)], false)).is_err());
    assert!(b.creer_index("Clients", &idx("B", &(0..11).map(|_| ("Nom", false)).collect::<Vec<_>>(), false)).is_err());
    b.creer_table(&DefinitionTable { nom: "Notes".into(), champs: vec![DefinitionChamp::nouveau("Texte", TypeChamp::TexteLong)], proprietes: Default::default() }).unwrap();
    let e = b.creer_index("Notes", &idx("N", &[("Texte", false)], false)).unwrap_err();
    assert!(e.to_string().contains("ne peut pas être indexé"), "{e}");
}

#[test]
fn suppression_seulement_des_index_nommes() {
    let b = base_demo();
    b.creer_index("Clients", &idx("Nom_Ville", &[("Nom", false), ("Ville", false)], false)).unwrap();
    b.supprimer_index("Clients", "nom_ville").unwrap();
    assert!(b.lister_index_nommes("Clients").unwrap().is_empty());
    // L'index de la propriete Indexe et la cle primaire ne se suppriment pas ici.
    let e = b.supprimer_index("Clients", "Clients").unwrap_err();
    assert!(e.to_string().contains("n'est pas un index nommé"), "{e}");
}

#[test]
fn reconstruction_de_table_conserve_renomme_ou_retire_l_index() {
    let b = base_demo();
    b.creer_index("Clients", &idx("Nom_Ville", &[("Nom", false), ("Ville", true)], false)).unwrap();
    // Renommer un champ de l'index : l'index le suit.
    b.renommer_champ("Clients", "Ville", "Cite").unwrap();
    let i = &b.lister_index_nommes("Clients").unwrap()[0];
    assert_eq!(i.champs.iter().map(|c| c.nom.as_str()).collect::<Vec<_>>(), vec!["Nom", "Cite"]);
    // Une modification qui reconstruit la table (cle primaire, type...) recree l'index.
    let mut actif = DefinitionChamp::nouveau("Actif", TypeChamp::OuiNon);
    actif.proprietes.description = Some("Client actif".into());
    b.modifier_champ("Clients", "Actif", &actif).unwrap();
    assert_eq!(b.lister_index_nommes("Clients").unwrap().len(), 1);
    // Renommer la table : l'index reste liste sous son nom.
    b.renommer_table("Clients", "Personnes").unwrap();
    assert_eq!(b.lister_index_nommes("Personnes").unwrap()[0].nom, "Nom_Ville");
    // Retirer un champ de l'index : l'index est supprime avec un avertissement.
    let r = b.supprimer_champ("Personnes", "Cite").unwrap();
    assert!(b.lister_index_nommes("Personnes").unwrap().is_empty());
    assert!(r.avertissements.iter().any(|a| a.contains("Nom_Ville")), "{:?}", r.avertissements);
}
