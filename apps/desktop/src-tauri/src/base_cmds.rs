// Commandes du module Base de donnees : exposent le moteur `forge-base` a la page.
// Une base ouverte par fenetre (cle = libelle de la fenetre). Les chemins n'entrent que par le
// registre d'autorisations (`grants.rs`) ou par un dialogue natif ; la page ne choisit jamais un chemin.

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, TryLockError};
use std::time::Duration;

use forge_base::{
    Base, Cle, DefinitionChamp, DefinitionRequete, DefinitionTable, Disposition, FonctionTotal, GenreObjet, InfosBase,
    OptionsExport, OptionsImport, OptionsLecture, Parametres, ProprietesTable, Relation, RequeteEnregistree,
    SourceExport,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow, Window, WindowEvent};
#[cfg(not(target_os = "android"))]
use tauri_plugin_dialog::FilePath;

#[cfg(not(target_os = "android"))]
use crate::commands::{add_filters, file_dialog};
use crate::commands::{display_name, ensure_extension, Filter};
use crate::grants::{is_url, lock};
use crate::panic_guard::proteger;
use crate::{texts, Shell};

const ERR_NO_BASE: &str = "Aucune base de données ouverte dans cette fenêtre.";
const ERR_URL: &str =
    "Cette base de données n'est pas un fichier local : copiez-la sur l'appareil puis ouvrez-la depuis ForgeOffice.";
const ERR_EXISTS: &str = "Ce fichier existe déjà : choisissez un autre nom pour la nouvelle base de données.";
const ERR_GENRE: &str = "Genre d'objet inconnu (formulaire, etat, macro ou module attendu).";
const ERR_TASK: &str = "Le traitement a été interrompu.";
#[cfg(not(target_os = "android"))]
const NEW_TITLE: &str = "Nouvelle base de données";
#[cfg(not(target_os = "android"))]
const COPY_TITLE: &str = "Enregistrer la base de données sous";
const NEW_NAME: &str = "Base de données.fodb";
const FILTER_NAME: &str = "Base de données ForgeOffice";

/// Base d'une fenetre, avec son propre verrou : une requete longue ne bloque que sa fenetre.
pub struct Slot {
    base: Mutex<Option<Base>>,
    /// Fermeture demandee (fenetre detruite ou base remplacee) pendant qu'une requete tenait le verrou.
    ferme: AtomicBool,
}

impl Slot {
    /// Delai SQL de forge-base applique a toute base ouverte (`DELAI_SQL_DEFAUT`, 30 s).
    fn new(base: Base) -> Arc<Self> {
        Self::avec_delai(base, Some(forge_base::DELAI_SQL_DEFAUT))
    }

    fn avec_delai(base: Base, delai: Option<Duration>) -> Arc<Self> {
        base.definir_delai_sql(delai);
        Arc::new(Self { base: Mutex::new(Some(base)), ferme: AtomicBool::new(false) })
    }

    /// Execute une operation sous le verrou de cette base seulement ; un panic devient une erreur francaise.
    fn executer(&self, op: Op) -> Result<Value, String> {
        proteger(|| {
            let garde = lock(&self.base);
            executer(garde.as_ref().ok_or(ERR_NO_BASE)?, op)
        })
    }

    /// Demande la fermeture sans jamais attendre une requete en cours : si le verrou est pris, la
    /// base est fermee par la requete elle-meme a sa fin (`terminer`), au plus tard au delai SQL.
    fn fermer(&self) -> Option<String> {
        self.ferme.store(true, Ordering::SeqCst);
        self.terminer()
    }

    /// Ferme la base si une fermeture est demandee et que le verrou est libre.
    fn terminer(&self) -> Option<String> {
        if !self.ferme.load(Ordering::SeqCst) {
            return None;
        }
        let mut garde = match self.base.try_lock() {
            Ok(g) => g,
            Err(TryLockError::Poisoned(p)) => p.into_inner(),
            Err(TryLockError::WouldBlock) => return None,
        };
        garde.take().and_then(|b| b.fermer().err()).map(|e| e.to_string())
    }
}

/// Bases ouvertes, par fenetre : le verrou de la table ne sert qu'a retrouver ou ranger un `Arc<Slot>`.
#[derive(Default)]
pub struct Bases {
    map: Mutex<HashMap<String, Arc<Slot>>>,
}

impl Bases {
    fn slot(&self, label: &str) -> Result<Arc<Slot>, String> {
        lock(&self.map).get(label).cloned().ok_or_else(|| ERR_NO_BASE.to_string())
    }

    fn installer(&self, label: &str, slot: Arc<Slot>) -> Option<Arc<Slot>> {
        lock(&self.map).insert(label.to_string(), slot)
    }

    fn retirer(&self, label: &str) -> Option<Arc<Slot>> {
        lock(&self.map).remove(label)
    }
}

#[derive(Serialize)]
pub struct BaseOuverte {
    nom: String,
    chemin: String,
    infos: InfosBase,
}

fn texte<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

fn ouverte(base: &Base, chemin: &str) -> Result<BaseOuverte, String> {
    Ok(BaseOuverte { nom: display_name(chemin), chemin: chemin.to_string(), infos: base.infos().map_err(texte)? })
}

/// Installe `base` dans la fenetre, en fermant proprement la precedente.
fn installer<R: Runtime>(app: &AppHandle<R>, label: &str, base: Base) {
    let ancienne = app.state::<Bases>().installer(label, Slot::new(base));
    fermer(app, ancienne);
}

fn fermer<R: Runtime>(app: &AppHandle<R>, slot: Option<Arc<Slot>>) {
    if let Some(e) = slot.and_then(|s| s.fermer()) {
        app.state::<Shell>().log.warn(&format!("fermeture de la base : {e}"));
    }
}

/// Android : une nouvelle base naît dans la bibliotheque privee (nom libre), sans dialogue ; elle s'exporte ensuite par « Enregistrer sous ».
#[cfg(target_os = "android")]
fn nouveau_chemin<R: Runtime>(app: &AppHandle<R>, _window: &WebviewWindow<R>) -> Result<Option<String>, String> {
    let chemin = crate::library::free_path(&crate::android::library_dir(app)?, NEW_NAME).map_err(texte)?;
    let chemin = chemin.to_string_lossy().to_string();
    app.state::<Shell>().grants.grant(&chemin);
    Ok(Some(chemin))
}

#[cfg(not(target_os = "android"))]
fn nouveau_chemin<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) -> Result<Option<String>, String> {
    choisir_fichier(app, window, NEW_TITLE, NEW_NAME)
}

/// Dialogue « Enregistrer » limite aux fichiers .fodb (None si annule). Le chemin choisi est autorise.
#[cfg(not(target_os = "android"))]
fn choisir_fichier<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, titre: &str, nom: &str) -> Result<Option<String>, String> {
    let filtres = vec![filtre_fodb()];
    let suggere: String = nom.chars().filter(|c| !"/\\:*?\"<>|".contains(*c)).take(200).collect();
    let Some(choix) = add_filters(file_dialog(window, titre), &filtres, false).set_file_name(suggere).blocking_save_file() else {
        return Ok(None);
    };
    let chemin = match choix {
        FilePath::Path(p) => ensure_extension(p, &filtres).to_string_lossy().to_string(),
        FilePath::Url(_) => return Err(ERR_URL.into()),
    };
    app.state::<Shell>().grants.grant(&chemin);
    Ok(Some(chemin))
}

#[tauri::command]
pub async fn base_open<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>, path: String) -> Result<BaseOuverte, String> {
    let shell = app.state::<Shell>();
    if is_url(&path) {
        return Err(ERR_URL.into());
    }
    if !shell.grants.allows(&path) {
        shell.log.warn(&format!("base refusee (non autorisee) : {path}"));
        return Err(texts::ERR_NOT_ALLOWED.into());
    }
    let base = Base::ouvrir(&path).or_else(|e| {
        shell.log.warn(&format!("ouverture en ecriture impossible ({e}), essai en lecture seule : {path}"));
        Base::ouvrir_lecture_seule(&path)
    });
    let base = base.map_err(texte)?;
    let reponse = ouverte(&base, &path)?;
    installer(&app, window.label(), base);
    shell.log.info(&format!("base ouverte : {path}"));
    Ok(reponse)
}

#[tauri::command]
pub async fn base_create<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) -> Result<Option<BaseOuverte>, String> {
    let Some(chemin) = nouveau_chemin(&app, &window)? else {
        return Ok(None);
    };
    if Path::new(&chemin).exists() {
        return Err(ERR_EXISTS.into());
    }
    let base = Base::creer(&chemin).map_err(texte)?;
    let reponse = ouverte(&base, &chemin)?;
    installer(&app, window.label(), base);
    app.state::<Shell>().log.info(&format!("base creee : {chemin}"));
    Ok(Some(reponse))
}

/// Copie complete de la base ouverte (« Sauvegarder la base de données ») ; `reopen` = « Enregistrer sous ».
/// Copie la base de la fenetre vers un fichier choisi par l'utilisateur ; renvoie le chemin de la copie.
#[cfg(not(target_os = "android"))]
async fn copier_vers_destination<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, suggere: &str) -> Result<Option<String>, String> {
    let Some(chemin) = choisir_fichier(app, window, COPY_TITLE, suggere)? else {
        return Ok(None);
    };
    {
        let slot = app.state::<Bases>().slot(window.label())?;
        let garde = lock(&slot.base);
        garde.as_ref().ok_or(ERR_NO_BASE)?.sauvegarder(&chemin, true).map_err(texte)?;
    }
    Ok(Some(chemin))
}

/// Android : copie provisoire, exportee par le systeme (Drive, Documents...) puis rangee dans la bibliotheque.
#[cfg(target_os = "android")]
async fn copier_vers_destination<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>, suggere: &str) -> Result<Option<String>, String> {
    let provisoire = crate::android::new_staged(app)?;
    {
        let slot = app.state::<Bases>().slot(window.label())?;
        let garde = lock(&slot.base);
        garde.as_ref().ok_or(ERR_NO_BASE)?.sauvegarder(&provisoire, true).map_err(texte)?;
    }
    let nom = ensure_extension(std::path::PathBuf::from(suggere), &[filtre_fodb()]);
    let Some(chemin) = crate::android::export_staged(app, &provisoire, &nom.to_string_lossy()).await? else {
        return Ok(None);
    };
    Ok(Some(chemin.to_string_lossy().to_string()))
}

fn filtre_fodb() -> Filter {
    Filter { name: FILTER_NAME.into(), extensions: vec![forge_base::EXTENSION.into()] }
}

#[tauri::command]
pub async fn base_copy<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>, reopen: bool, suggested_name: String) -> Result<Option<BaseOuverte>, String> {
    app.state::<Bases>().slot(window.label())?;
    let Some(chemin) = copier_vers_destination(&app, &window, &suggested_name).await? else {
        return Ok(None);
    };
    app.state::<Shell>().log.info(&format!("copie de la base : {chemin}"));
    let base = Base::ouvrir(&chemin).map_err(texte)?;
    let reponse = ouverte(&base, &chemin)?;
    if reopen {
        installer(&app, window.label(), base);
    } else {
        fermer(&app, Some(Slot::new(base)));
    }
    Ok(Some(reponse))
}

#[tauri::command]
pub async fn base_close<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) {
    let slot = app.state::<Bases>().retirer(window.label());
    fermer(&app, slot);
}

#[tauri::command]
pub async fn base_op<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>, requete: Op) -> Result<Value, String> {
    let slot = app.state::<Bases>().slot(window.label())?;
    // Hors du fil de l'interface et hors du verrou de la table : seule la base de cette fenetre est occupee.
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let resultat = slot.executer(requete);
        if let Some(e) = slot.terminer() {
            handle.state::<Shell>().log.warn(&format!("fermeture differee de la base : {e}"));
        }
        resultat
    })
    .await
    .map_err(|_| ERR_TASK.to_string())?
}

/// Fenetre detruite : sa base est fermee (point de controle WAL).
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if matches!(event, WindowEvent::Destroyed) {
        let slot = window.state::<Bases>().retirer(window.label());
        fermer(window.app_handle(), slot);
    }
}

/// Operation demandee par la page sur la base de sa fenetre.
#[derive(Deserialize, Debug)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Op {
    Infos,
    Objets,
    Schema { table: String },
    LireTable { table: String, #[serde(default)] options: OptionsLecture },
    LireLigne { table: String, cle: Cle },
    Inserer { table: String, valeurs: Map<String, Value> },
    Modifier { table: String, cle: Cle, valeurs: Map<String, Value> },
    Supprimer { table: String, cles: Vec<Cle> },
    Total { table: String, champ: String, fonction: FonctionTotal, #[serde(default)] options: OptionsLecture },
    Distinctes { table: String, champ: String, limite: usize },
    RemplacerTout { table: String, champ: String, chercher: String, remplacer: String, respecter_casse: bool },
    CreerTable { definition: DefinitionTable },
    ModifierTable { table: String, champs: Vec<DefinitionChamp>, #[serde(default)] proprietes: Option<ProprietesTable> },
    RenommerTable { ancien: String, nouveau: String },
    SupprimerTable { table: String, avec_relations: bool },
    CopierTable { source: String, destination: String, avec_donnees: bool },
    Relations,
    CreerRelation { relation: Relation },
    ModifierRelation { nom: String, relation: Relation },
    SupprimerRelation { nom: String },
    VerifierIntegrite,
    Requetes,
    LireRequete { nom: String },
    EnregistrerRequete { requete: RequeteEnregistree },
    SupprimerRequete { nom: String },
    RenommerRequete { ancien: String, nouveau: String },
    ExecuterRequete { nom: String, #[serde(default)] parametres: Parametres },
    ExecuterDefinition { definition: DefinitionRequete, #[serde(default)] parametres: Parametres },
    GenererSql { definition: DefinitionRequete },
    ExecuterSql { sql: String, #[serde(default)] parametres: Parametres },
    ListerObjetsGenre { genre: String },
    LireObjet { genre: String, nom: String },
    EnregistrerObjet { genre: String, nom: String, contenu: Value, #[serde(default)] description: Option<String> },
    SupprimerObjet { genre: String, nom: String },
    RenommerObjet { genre: String, ancien: String, nouveau: String },
    FormulaireInstantane { source: String, #[serde(default)] disposition: Disposition },
    EtatInstantane { source: String, #[serde(default)] regroupement: Option<String> },
    ExecuterMacro { nom: String },
    ImporterCsv { table: String, texte: String, #[serde(default)] options: OptionsImport },
    ImporterLignes { table: String, entetes: Vec<String>, lignes: Vec<Vec<Value>>, #[serde(default)] options: OptionsImport },
    ExporterCsv { source: SourceExport, #[serde(default)] options: OptionsExport },
    Compacter,
    Documenter,
}

fn genre(nom: &str) -> Result<GenreObjet, String> {
    match nom {
        "formulaire" => Ok(GenreObjet::Formulaire),
        "etat" => Ok(GenreObjet::Etat),
        "macro" => Ok(GenreObjet::Macro),
        "module" => Ok(GenreObjet::Module),
        _ => Err(ERR_GENRE.into()),
    }
}

fn json<T: Serialize>(r: forge_base::Resultat<T>) -> Result<Value, String> {
    serde_json::to_value(r.map_err(texte)?).map_err(texte)
}

/// Execute une operation (sans Tauri : testable).
pub fn executer(b: &Base, op: Op) -> Result<Value, String> {
    match op {
        Op::Infos => json(b.infos()),
        Op::Objets => json(b.lister_objets()),
        Op::Schema { table } => json(b.schema_table(&table)),
        Op::LireTable { table, options } => json(b.lire_table(&table, &options)),
        Op::LireLigne { table, cle } => json(b.lire_ligne(&table, &cle)),
        Op::Inserer { table, valeurs } => json(b.inserer_ligne(&table, &valeurs)),
        Op::Modifier { table, cle, valeurs } => json(b.modifier_ligne(&table, &cle, &valeurs)),
        Op::Supprimer { table, cles } => json(b.supprimer_lignes(&table, &cles)),
        Op::Total { table, champ, fonction, options } => json(b.total(&table, &champ, fonction, &options)),
        Op::Distinctes { table, champ, limite } => json(b.valeurs_distinctes(&table, &champ, limite)),
        Op::RemplacerTout { table, champ, chercher, remplacer, respecter_casse } => {
            json(b.remplacer_tout(&table, &champ, &chercher, &remplacer, respecter_casse))
        }
        Op::CreerTable { definition } => json(b.creer_table(&definition)),
        Op::ModifierTable { table, champs, proprietes } => json(b.modifier_table(&table, &champs, proprietes.as_ref())),
        Op::RenommerTable { ancien, nouveau } => json(b.renommer_table(&ancien, &nouveau)),
        Op::SupprimerTable { table, avec_relations } => json(b.supprimer_table(&table, avec_relations)),
        Op::CopierTable { source, destination, avec_donnees } => json(b.copier_table(&source, &destination, avec_donnees)),
        Op::Relations => json(b.lister_relations()),
        Op::CreerRelation { relation } => json(b.creer_relation(&relation)),
        Op::ModifierRelation { nom, relation } => json(b.modifier_relation(&nom, &relation)),
        Op::SupprimerRelation { nom } => json(b.supprimer_relation(&nom)),
        Op::VerifierIntegrite => json(b.verifier_integrite()),
        Op::Requetes => json(b.lister_requetes()),
        Op::LireRequete { nom } => json(b.lire_requete(&nom)),
        Op::EnregistrerRequete { requete } => json(b.enregistrer_requete(&requete)),
        Op::SupprimerRequete { nom } => json(b.supprimer_requete(&nom)),
        Op::RenommerRequete { ancien, nouveau } => json(b.renommer_requete(&ancien, &nouveau)),
        Op::ExecuterRequete { nom, parametres } => json(b.executer_requete(&nom, &parametres)),
        Op::ExecuterDefinition { definition, parametres } => json(b.executer_definition(&definition, &parametres)),
        Op::GenererSql { definition } => json(b.generer_sql(&definition)),
        Op::ExecuterSql { sql, parametres } => json(b.executer_sql(&sql, &parametres)),
        Op::ListerObjetsGenre { genre: g } => json(b.lister_objets_genre(genre(&g)?)),
        Op::LireObjet { genre: g, nom } => json(b.lire_objet(genre(&g)?, &nom)),
        Op::EnregistrerObjet { genre: g, nom, contenu, description } => {
            json(b.enregistrer_objet(genre(&g)?, &nom, &contenu, description.as_deref()))
        }
        Op::SupprimerObjet { genre: g, nom } => json(b.supprimer_objet(genre(&g)?, &nom)),
        Op::RenommerObjet { genre: g, ancien, nouveau } => json(b.renommer_objet(genre(&g)?, &ancien, &nouveau)),
        Op::FormulaireInstantane { source, disposition } => json(b.formulaire_instantane(&source, disposition)),
        Op::EtatInstantane { source, regroupement } => json(b.etat_instantane(&source, regroupement.as_deref())),
        Op::ExecuterMacro { nom } => json(b.executer_macro(&nom)),
        Op::ImporterCsv { table, texte, options } => json(b.importer_csv(&table, &texte, &options)),
        Op::ImporterLignes { table, entetes, lignes, options } => json(b.importer_lignes(&table, &entetes, &lignes, &options)),
        Op::ExporterCsv { source, options } => json(b.exporter_csv(&source, &options)),
        Op::Compacter => json(b.compacter()),
        Op::Documenter => json(b.documenter()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn op(v: Value) -> Op {
        serde_json::from_value(v).unwrap()
    }

    fn base_clients() -> Base {
        let b = Base::en_memoire().unwrap();
        executer(&b, op(json!({"op": "creer_table", "definition": {"nom": "Clients", "champs": [
            {"nom": "N°", "type": "numero_auto", "cle_primaire": true},
            {"nom": "Nom", "type": "texte_court", "taille": 50, "requis": true},
            {"nom": "Ville", "type": "texte_court"}
        ]}})))
        .unwrap();
        for (nom, ville) in [("Durand", "Lyon"), ("Martin", "Paris"), ("Bernard", "Nantes")] {
            executer(&b, op(json!({"op": "inserer", "table": "Clients", "valeurs": {"Nom": nom, "Ville": ville}}))).unwrap();
        }
        b
    }

    #[test]
    fn options_de_lecture_envoyees_par_la_page() {
        let o = op(json!({"op": "lire_table", "table": "T", "options": {"page": 0, "taille_page": 50, "tri": [{"champ": "Nom", "descendant": true}]}}));
        let Op::LireTable { table, options } = o else { panic!("mauvaise variante") };
        assert_eq!(table, "T");
        assert_eq!(options.taille_page, 50);
        assert!(options.tri[0].descendant);
        assert!(matches!(op(json!({"op": "lire_table", "table": "T"})), Op::LireTable { .. }));
        assert!(serde_json::from_value::<Op>(json!({"op": "attach", "sql": "x"})).is_err());
    }

    #[test]
    fn creer_inserer_lire_trier() {
        let b = base_clients();
        let page = executer(&b, op(json!({"op": "lire_table", "table": "Clients", "options": {"tri": [{"champ": "Nom"}]}}))).unwrap();
        assert_eq!(page["total"], 3);
        assert_eq!(page["lignes"][0][1], "Bernard");
        let err = executer(&b, op(json!({"op": "inserer", "table": "Clients", "valeurs": {"Ville": "Brest"}}))).unwrap_err();
        assert!(!err.is_empty());
        let n = executer(&b, op(json!({"op": "supprimer", "table": "Clients", "cles": [{"N°": 1}]}))).unwrap();
        assert_eq!(n, 1);
    }

    #[test]
    fn requete_graphique_vers_sql() {
        let b = base_clients();
        let def = json!({"tables": [{"nom": "Clients"}], "colonnes": [
            {"champ": "Nom", "table": "Clients", "tri": "croissant"},
            {"champ": "Ville", "table": "Clients", "criteres": ["\"Paris\""]}
        ]});
        let g = executer(&b, op(json!({"op": "generer_sql", "definition": def}))).unwrap();
        assert!(g["sql"].as_str().unwrap().contains("ORDER BY"));
        let r = executer(&b, op(json!({"op": "executer_definition", "definition": def}))).unwrap();
        assert_eq!(r["lignes"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn formulaire_enregistre_et_relu() {
        let b = base_clients();
        let f = executer(&b, op(json!({"op": "formulaire_instantane", "source": "Clients"}))).unwrap();
        executer(&b, op(json!({"op": "enregistrer_objet", "genre": "formulaire", "nom": "Fiche client", "contenu": f}))).unwrap();
        let lu = executer(&b, op(json!({"op": "lire_objet", "genre": "formulaire", "nom": "Fiche client"}))).unwrap();
        assert_eq!(lu["contenu"]["source"], "Clients");
        let objets = executer(&b, op(json!({"op": "objets"}))).unwrap();
        assert!(objets.as_array().unwrap().iter().any(|o| o["genre"] == "formulaire"));
        assert_eq!(executer(&b, op(json!({"op": "lire_objet", "genre": "table", "nom": "Clients"}))).unwrap_err(), ERR_GENRE);
    }

    /// Operations produites par l'interface (packages/access/tests/scenario.ts) rejouees contre le vrai moteur.
    #[test]
    fn scenario_de_l_interface_rejoue_sur_le_moteur() {
        let fixture = include_str!("../../../../packages/access/tests/fixtures/ops-scenario.json");
        let ops: Vec<Value> = serde_json::from_str(fixture).unwrap();
        assert!(ops.len() > 40);
        let b = Base::en_memoire().unwrap();
        let mut resultats = Vec::new();
        for (i, v) in ops.into_iter().enumerate() {
            let nom = v["op"].as_str().unwrap_or_default().to_string();
            let o: Op = serde_json::from_value(v).unwrap_or_else(|e| panic!("etape {i} ({nom}) : JSON refuse : {e}"));
            resultats.push((nom.clone(), executer(&b, o).unwrap_or_else(|e| panic!("etape {i} ({nom}) : {e}"))));
        }
        let par_nom = |n: &str| resultats.iter().rev().find(|(k, _)| k == n).map(|(_, v)| v.clone()).unwrap();
        assert_eq!(par_nom("executer_macro").as_array().unwrap().len(), 2);
        assert!(par_nom("generer_sql")["sql"].as_str().unwrap().contains("GROUP BY"));
        assert_eq!(par_nom("importer_csv")["lignes_importees"], 2);
        assert_eq!(par_nom("verifier_integrite")["ok"], true);
        let lignes = executer(&b, op(json!({"op": "lire_table", "table": "Produits", "options": {"filtres": [{"champ": "N°", "operateur": "egal", "valeur": 1}]}}))).unwrap();
        assert_eq!(lignes["lignes"][0][5], 150);
    }

    #[test]
    fn sans_base_ouverte_message_clair() {
        assert_eq!(Bases::default().slot("fo-x").err().unwrap(), ERR_NO_BASE);
    }

    const BOUCLE_INFINIE: &str = "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c";

    /// Deux « fenetres » : une requete sans fin sur l'une ne bloque ni la lecture sur l'autre ni la
    /// fermeture de la premiere, et se termine par l'erreur de delai (puis la base est fermee).
    #[test]
    fn requete_infinie_ne_bloque_pas_les_autres_fenetres() {
        use std::time::Instant;
        let bases = Arc::new(Bases::default());
        bases.installer("fo-a", Slot::avec_delai(base_clients(), Some(Duration::from_secs(1))));
        bases.installer("fo-b", Slot::new(base_clients()));
        let a = bases.slot("fo-a").unwrap();
        let fil = std::thread::spawn(move || a.executer(op(json!({"op": "executer_sql", "sql": BOUCLE_INFINIE}))));
        std::thread::sleep(Duration::from_millis(250));

        let debut = Instant::now();
        let lecture = bases.slot("fo-b").unwrap().executer(op(json!({"op": "lire_table", "table": "Clients"}))).unwrap();
        assert_eq!(lecture["total"], 3);
        let slot_a = bases.retirer("fo-a").unwrap();
        assert_eq!(slot_a.fermer(), None); // verrou pris : fermeture differee, aucune attente
        assert!(debut.elapsed() < Duration::from_millis(700), "la fenetre B ou la fermeture de A a attendu : {:?}", debut.elapsed());
        assert_eq!(bases.slot("fo-a").err().unwrap(), ERR_NO_BASE);

        let err = fil.join().unwrap().unwrap_err();
        assert!(err.contains("délai"), "message inattendu : {err}");
        assert_eq!(slot_a.terminer(), None);
        assert!(lock(&slot_a.base).is_none(), "la base de A aurait du etre fermee a la fin de la requete");
        assert_eq!(slot_a.executer(op(json!({"op": "infos"}))).unwrap_err(), ERR_NO_BASE);
    }

    #[test]
    fn delai_par_defaut_a_l_ouverture() {
        let slot = Slot::new(Base::en_memoire().unwrap());
        assert_eq!(lock(&slot.base).as_ref().unwrap().delai_sql(), Some(forge_base::DELAI_SQL_DEFAUT));
    }
}
