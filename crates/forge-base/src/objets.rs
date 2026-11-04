//! Formulaires, etats, macros et modules : definitions JSON enregistrees dans la base,
//! generation instantanee (Formulaire / Etat en un clic) et execution des macros.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value as Json};

use crate::base::Base;
use crate::erreur::{ErreurBase, Resultat};
use crate::expr::{Contexte, Traducteur};
use crate::ident::valider_nom;
use crate::meta::{self, ObjetStocke};
use crate::schema::GenreObjet;
use crate::sql::Parametres;
use crate::types::{ChampSchema, TypeChamp};

/// Disposition d'un formulaire instantane.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum Disposition {
    /// Un enregistrement par page, champs les uns sous les autres.
    #[default]
    Simple,
    /// Plusieurs enregistrements, champs en colonnes.
    Tabulaire,
    /// Feuille de donnees.
    FeuilleDonnees,
    /// Formulaire simple au-dessus d'une feuille de donnees.
    DoubleAffichage,
}

/// Actions de macro executees par le moteur (les autres sont renvoyees a l'interface).
const ACTIONS_DONNEES: [&str; 3] = ["executer_sql", "executer_requete", "arreter_macro"];

/// Actions de macro reconnues.
pub const ACTIONS_MACRO: [&str; 15] = [
    "executer_sql", "executer_requete", "arreter_macro", "ouvrir_formulaire", "ouvrir_etat", "ouvrir_table",
    "ouvrir_requete", "zone_message", "appliquer_filtre", "atteindre_enregistrement", "fermer_fenetre",
    "imprimer", "actualiser", "exporter", "definir_variable",
];

fn cle_genre(genre: GenreObjet) -> Resultat<&'static str> {
    match genre {
        GenreObjet::Formulaire | GenreObjet::Etat | GenreObjet::Macro | GenreObjet::Module => Ok(genre.cle()),
        _ => Err(ErreurBase::msg("Utilisez les fonctions dédiées pour les tables, vues et requêtes.")),
    }
}

fn type_controle(c: &ChampSchema) -> &'static str {
    if !c.proprietes.liste_valeurs.is_empty() || c.proprietes.source_liste.is_some() {
        return "zone_liste_deroulante";
    }
    match c.type_champ {
        TypeChamp::OuiNon => "case_a_cocher",
        TypeChamp::PieceJointe | TypeChamp::ObjetOle => "piece_jointe",
        TypeChamp::LienHypertexte => "lien_hypertexte",
        TypeChamp::TexteLong => "zone_texte_multiligne",
        TypeChamp::DateHeure => "selecteur_date",
        _ => "zone_texte",
    }
}

fn controle(c: &ChampSchema, x: i64, y: i64, largeur: i64) -> Json {
    let hauteur = match c.type_champ {
        TypeChamp::TexteLong | TypeChamp::PieceJointe | TypeChamp::ObjetOle => 96,
        _ => 24,
    };
    json!({
        "type": type_controle(c),
        "nom": c.nom,
        "champ": c.nom,
        "etiquette": c.proprietes.legende.clone().unwrap_or_else(|| c.nom.clone()),
        "x": x, "y": y, "largeur": largeur, "hauteur": hauteur,
        "lecture_seule": c.genere || c.type_champ == TypeChamp::Calcule || c.type_champ == TypeChamp::NumeroAuto,
        "format": c.proprietes.format,
        "masque_saisie": c.proprietes.masque_saisie,
        "valeurs": c.proprietes.liste_valeurs,
        "source_liste": c.proprietes.source_liste,
        "aligne_droite": c.type_champ.est_numerique(),
        "texte_aide": c.proprietes.description,
    })
}

fn verifier_macro(contenu: &Json) -> Resultat<()> {
    let actions = contenu
        .get("actions")
        .and_then(Json::as_array)
        .ok_or_else(|| ErreurBase::msg("Une macro doit contenir une liste « actions »."))?;
    for (i, a) in actions.iter().enumerate() {
        let nom = a.get("action").and_then(Json::as_str).unwrap_or_default();
        if !ACTIONS_MACRO.contains(&nom) {
            return Err(ErreurBase::msg(format!("Action de macro inconnue à l'étape {} : « {nom} ».", i + 1)));
        }
    }
    Ok(())
}

impl Base {
    /// Enregistre (cree ou remplace) un formulaire, un etat, une macro ou un module.
    pub fn enregistrer_objet(&self, genre: GenreObjet, nom: &str, contenu: &Json, description: Option<&str>) -> Resultat<()> {
        self.exiger_ecriture()?;
        let cle = cle_genre(genre)?;
        let nom = valider_nom(nom)?;
        if !contenu.is_object() {
            return Err(ErreurBase::msg("La définition doit être un objet JSON."));
        }
        if genre == GenreObjet::Macro {
            verifier_macro(contenu)?;
        }
        self.atomique(|| meta::ecrire_objet(self.conn(), cle, &nom, contenu, description))
    }

    /// Lit un objet.
    pub fn lire_objet(&self, genre: GenreObjet, nom: &str) -> Resultat<ObjetStocke> {
        meta::objet(self.conn(), cle_genre(genre)?, nom.trim())?.ok_or_else(|| ErreurBase::Introuvable(nom.trim().to_string()))
    }

    /// Liste les objets d'un genre.
    pub fn lister_objets_genre(&self, genre: GenreObjet) -> Resultat<Vec<ObjetStocke>> {
        meta::objets(self.conn(), Some(cle_genre(genre)?))
    }

    /// Renomme un objet.
    pub fn renommer_objet(&self, genre: GenreObjet, ancien: &str, nouveau: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        let nouveau = valider_nom(nouveau)?;
        self.atomique(|| meta::renommer_objet(self.conn(), cle_genre(genre)?, ancien.trim(), &nouveau))
    }

    /// Supprime un objet.
    pub fn supprimer_objet(&self, genre: GenreObjet, nom: &str) -> Resultat<()> {
        self.exiger_ecriture()?;
        self.atomique(|| meta::supprimer_objet(self.conn(), cle_genre(genre)?, nom.trim()))
    }

    /// Duplique un objet sous un nouveau nom.
    pub fn dupliquer_objet(&self, genre: GenreObjet, nom: &str, copie: &str) -> Resultat<()> {
        let o = self.lire_objet(genre, nom)?;
        if meta::objet(self.conn(), cle_genre(genre)?, copie.trim())?.is_some() {
            return Err(ErreurBase::ExisteDeja(copie.trim().to_string()));
        }
        self.enregistrer_objet(genre, copie, &o.contenu, o.description.as_deref())
    }

    /// Formulaire instantane (onglet Creer > Formulaire) pour une table ou une requete.
    pub fn formulaire_instantane(&self, source: &str, disposition: Disposition) -> Resultat<Json> {
        let (nom, est_vue) = self.nom_source(source)?;
        let champs = self.champs(&nom)?;
        let tabulaire = disposition == Disposition::Tabulaire;
        let controles: Vec<Json> = champs
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let i = i as i64;
                if tabulaire { controle(c, 8 + i * 136, 8, 128) } else { controle(c, 160, 8 + i * 36, 320) }
            })
            .collect();
        Ok(json!({
            "version": 1,
            "source": nom,
            "disposition": disposition,
            "titre": nom,
            "sections": {
                "entete": { "hauteur": 56, "controles": [{ "type": "etiquette", "texte": nom, "style": "titre", "x": 8, "y": 8, "largeur": 400, "hauteur": 36 }] },
                "detail": { "controles": controles },
                "pied": { "hauteur": 0, "controles": [] }
            },
            "proprietes": {
                "autoriser_ajouts": !est_vue,
                "autoriser_modifications": !est_vue,
                "autoriser_suppressions": !est_vue,
                "boutons_navigation": true,
                "selecteur_enregistrement": true,
                "affichage_par_defaut": disposition
            }
        }))
    }

    /// Etat instantane (onglet Creer > Etat), avec regroupement facultatif et totaux numeriques.
    pub fn etat_instantane(&self, source: &str, regroupement: Option<&str>) -> Resultat<Json> {
        let (nom, _) = self.nom_source(source)?;
        let champs = self.champs(&nom)?;
        let groupe = match regroupement {
            Some(g) => Some(crate::donnees::trouver(&champs, g)?.nom.clone()),
            None => None,
        };
        let colonnes: Vec<&ChampSchema> = champs
            .iter()
            .filter(|c| !c.type_champ.est_binaire() && Some(&c.nom) != groupe.as_ref())
            .collect();
        let largeur = (720 / colonnes.len().max(1) as i64).max(60);
        let entetes: Vec<Json> = colonnes
            .iter()
            .enumerate()
            .map(|(i, c)| json!({ "type": "etiquette", "texte": c.proprietes.legende.clone().unwrap_or_else(|| c.nom.clone()), "x": 8 + i as i64 * largeur, "y": 4, "largeur": largeur - 4, "hauteur": 20, "style": "entete_colonne" }))
            .collect();
        let detail: Vec<Json> = colonnes.iter().enumerate().map(|(i, c)| controle(c, 8 + i as i64 * largeur, 2, largeur - 4)).collect();
        let totaux: Vec<Json> = colonnes
            .iter()
            .enumerate()
            .filter(|(_, c)| c.type_champ.est_numerique() && c.type_champ != TypeChamp::NumeroAuto && !c.cle_primaire)
            .map(|(i, c)| json!({ "type": "zone_texte", "source": format!("=Somme([{}])", c.nom), "x": 8 + i as i64 * largeur, "y": 4, "largeur": largeur - 4, "hauteur": 20, "aligne_droite": true }))
            .collect();
        let regroupements: Vec<Json> = groupe.iter().map(|g| json!({ "champ": g, "tri": "croissant", "entete": true, "pied": !totaux.is_empty() })).collect();
        Ok(json!({
            "version": 1,
            "source": nom,
            "titre": nom,
            "orientation": if colonnes.len() > 6 { "paysage" } else { "portrait" },
            "regroupements": regroupements,
            "sections": {
                "entete_etat": { "controles": [{ "type": "etiquette", "texte": nom, "style": "titre", "x": 8, "y": 8, "largeur": 500, "hauteur": 36 }, { "type": "zone_texte", "source": "=Date()", "x": 560, "y": 8, "largeur": 160, "hauteur": 20 }] },
                "entete_page": { "controles": entetes },
                "detail": { "controles": detail },
                "pied_page": { "controles": [{ "type": "zone_texte", "source": "=\"Page \" & [Page] & \" sur \" & [Pages]", "x": 560, "y": 4, "largeur": 160, "hauteur": 20 }] },
                "pied_etat": { "controles": totaux }
            }
        }))
    }

    /// Execute une macro : les actions de donnees sont faites ici (tout ou rien), les actions
    /// d'interface sont renvoyees dans l'ordre pour que l'application les joue.
    pub fn executer_macro(&self, nom: &str) -> Resultat<Vec<Json>> {
        let m = self.lire_objet(GenreObjet::Macro, nom)?;
        verifier_macro(&m.contenu)?;
        let actions = m.contenu.get("actions").and_then(Json::as_array).cloned().unwrap_or_default();
        self.atomique(|| {
            let mut interface = Vec::new();
            for (i, a) in actions.iter().enumerate() {
                if let Some(condition) = a.get("condition").and_then(Json::as_str).filter(|c| !c.trim().is_empty()) {
                    let mut tr = Traducteur::nouveau(Contexte::Requete, Some(&[]));
                    let sql = tr.expression(condition)?;
                    let vrai: Option<i64> = self.conn().query_row(&format!("SELECT ({sql}) <> 0"), [], |r| r.get(0))?;
                    if vrai != Some(1) {
                        continue;
                    }
                }
                let nom_action = a.get("action").and_then(Json::as_str).unwrap_or_default();
                let args = a.get("arguments").cloned().unwrap_or(Json::Null);
                let etape = |e: ErreurBase| ErreurBase::msg(format!("Macro « {nom} », étape {} : {e}", i + 1));
                match nom_action {
                    "arreter_macro" => break,
                    "executer_sql" => {
                        let sql = args.get("sql").and_then(Json::as_str).unwrap_or_default();
                        let params: Parametres = serde_json::from_value(args.get("parametres").cloned().unwrap_or(json!([])))?;
                        self.executer_sql(sql, &params).map_err(etape)?;
                    }
                    "executer_requete" => {
                        let requete = args.get("nom").and_then(Json::as_str).unwrap_or_default();
                        let r = self.lire_requete(requete).map_err(etape)?;
                        if r.genre.est_action() {
                            self.executer_requete(requete, &Parametres::aucun()).map_err(etape)?;
                        } else {
                            interface.push(json!({ "action": "ouvrir_requete", "arguments": args }));
                        }
                    }
                    autre if !ACTIONS_DONNEES.contains(&autre) => interface.push(a.clone()),
                    _ => {}
                }
            }
            Ok(interface)
        })
    }
}
