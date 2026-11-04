// Commandes du moteur forge-convert (outils PDF et conversions de fichiers) pour les modules PDF et Convertisseur.
// - Chemins : uniquement ceux du registre d'autorisations (fichiers choisis, dossier de sortie choisi par
//   `convert_pick_folder`). Les fichiers produits sont autorises a leur tour (relecture par `read_path`).
// - Octets : `convert_run_bytes` travaille dans un dossier temporaire prive (documents en memoire, mobile).
// - Le travail lourd tourne dans un fil bloquant dedie, jamais sur le fil de l'interface.

use std::path::{Path, PathBuf};

use forge_convert::fichiers::DossierTemp;
use forge_convert::{Capacites, Operation, Output};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::{Request, Response};
use tauri::{AppHandle, Manager, Runtime, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

use crate::commands::MAX_FILE_BYTES;
use crate::grants::is_url;
use crate::{frame, Shell};

const ERR_PATH: &str =
    "Accès refusé : ce fichier ou ce dossier n'a pas été choisi par l'utilisateur (ouvrez-le avec Ouvrir ou Parcourir).";
const ERR_PLACEHOLDER: &str = "Opération refusée : chemins inattendus dans une opération en mémoire.";
const ERR_TASK: &str = "Le traitement a été interrompu.";
const FOLDER_TITLE: &str = "Choisir le dossier de destination";
/// Nombre maximal de miniatures par appel.
const MAX_THUMBS: usize = 200;
/// Champs d'une `Operation` qui designent des fichiers d'entree ou le dossier de sortie.
const INPUT_KEYS: [&str; 4] = ["entree", "entrees", "a", "b"];
const OUTPUT_KEY: &str = "dossier";
const OUTPUT_PLACEHOLDER: &str = "@sortie";

/// Lance un travail bloquant hors du fil de l'interface.
async fn blocking<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(job).await.map_err(|_| ERR_TASK.to_string())?
}

/// Fichiers lus et dossier ecrit par une operation.
fn paths_of(op: &Operation) -> (Vec<&Path>, Option<&Path>) {
    match op {
        Operation::Pdf { entree, sortie, .. }
        | Operation::Decouper { entree, sortie, .. }
        | Operation::ExtraireImages { entree, sortie, .. }
        | Operation::PdfVersImages { entree, sortie, .. }
        | Operation::PdfA { entree, sortie }
        | Operation::Ocr { entree, sortie, .. }
        | Operation::Convertir { entree, sortie, .. } => (vec![entree.as_path()], Some(sortie.dossier.as_path())),
        Operation::Fusionner { entrees, sortie } | Operation::ImagesVersPdf { entrees, sortie } | Operation::Zipper { entrees, sortie } => {
            (entrees.iter().map(PathBuf::as_path).collect(), Some(sortie.dossier.as_path()))
        }
        Operation::Infos { entree, .. }
        | Operation::ListerChamps { entree, .. }
        | Operation::ListerAnnotations { entree, .. }
        | Operation::ExtraireTexte { entree, .. }
        | Operation::Miniature { entree } => (vec![entree.as_path()], None),
        Operation::Comparer { a, b } => (vec![a.as_path(), b.as_path()], None),
        Operation::Capacites => (Vec::new(), None),
    }
}

/// Chaque chemin doit etre un fichier local autorise (les URL de contenu mobiles passent par `convert_run_bytes`).
fn check_paths<R: Runtime>(app: &AppHandle<R>, op: &Operation) -> Result<(), String> {
    let shell = app.state::<Shell>();
    let (inputs, output) = paths_of(op);
    for path in inputs.into_iter().chain(output) {
        let text = path.to_string_lossy();
        if is_url(&text) || !shell.grants.allows(&text) {
            shell.log.warn(&format!("conversion refusee (chemin non autorise) : {text}"));
            return Err(ERR_PATH.into());
        }
    }
    Ok(())
}

fn produced(output: &Output) -> &[PathBuf] {
    match output {
        Output::Fichiers { fichiers, .. } => fichiers,
        _ => &[],
    }
}

/// Outils externes detectes et operations disponibles (pour griser l'interface).
#[tauri::command]
pub async fn convert_capacites() -> Result<Capacites, String> {
    blocking(|| Ok(forge_convert::capacites())).await
}

/// Execute une operation sur des chemins autorises ; les fichiers produits deviennent relisibles.
#[tauri::command]
pub async fn convert_run<R: Runtime>(app: AppHandle<R>, operation: Operation) -> Result<Output, String> {
    check_paths(&app, &operation)?;
    let output = blocking(move || forge_convert::run(operation).map_err(|e| e.to_string())).await?;
    let shell = app.state::<Shell>();
    for file in produced(&output) {
        shell.grants.grant(&file.to_string_lossy());
    }
    shell.log.info(&format!("conversion : {} fichier(s) produit(s)", produced(&output).len()));
    Ok(output)
}

/// Dialogue « Choisir un dossier » : le dossier choisi devient une destination autorisee.
#[tauri::command]
pub async fn convert_pick_folder<R: Runtime>(app: AppHandle<R>, window: WebviewWindow<R>) -> Option<String> {
    let dialog = app.dialog().file().set_title(FOLDER_TITLE);
    #[cfg(desktop)]
    let dialog = dialog.set_parent(&window);
    #[cfg(mobile)]
    let _ = window;
    let path = dialog.blocking_pick_folder()?.to_string();
    app.state::<Shell>().grants.grant(&path);
    Some(path)
}

/// Miniatures (data-URL PNG) d'images ou de SVG autorises ; None pour un fichier refuse ou illisible.
#[tauri::command]
pub async fn convert_miniatures<R: Runtime>(app: AppHandle<R>, chemins: Vec<String>) -> Result<Vec<Option<String>>, String> {
    let shell = app.state::<Shell>();
    let allowed: Vec<Option<PathBuf>> = chemins
        .into_iter()
        .take(MAX_THUMBS)
        .map(|c| (!is_url(&c) && shell.grants.allows(&c)).then(|| PathBuf::from(c)))
        .collect();
    blocking(move || {
        Ok(allowed
            .into_iter()
            .map(|p| match forge_convert::run(Operation::Miniature { entree: p? }) {
                Ok(Output::Image { data_url }) => Some(data_url),
                _ => None,
            })
            .collect())
    })
    .await
}

#[derive(Deserialize)]
struct SaveIntoHead {
    dossier: String,
    nom: String,
    #[serde(default)]
    ecraser: bool,
}

/// Enregistre un resultat dans un dossier autorise (choisi par `convert_pick_folder`) :
/// trame { dossier, nom, ecraser } + octets. Nom valide par forge-convert (pas de `..` ni de separateur),
/// ecriture atomique, pas d'ecrasement sans `ecraser`. Renvoie le chemin ecrit (desormais autorise).
#[tauri::command]
pub async fn convert_save_into<R: Runtime>(app: AppHandle<R>, request: Request<'_>) -> Result<String, String> {
    let tauri::ipc::InvokeBody::Raw(raw) = request.body() else {
        return Err("corps binaire attendu".into());
    };
    let (head, body): (SaveIntoHead, &[u8]) = frame::decode(raw)?;
    let shell = app.state::<Shell>();
    if is_url(&head.dossier) || !shell.grants.allows(&head.dossier) {
        shell.log.warn(&format!("enregistrement refuse (dossier non autorise) : {}", head.dossier));
        return Err(ERR_PATH.into());
    }
    let body = body.to_vec();
    let cible = forge_convert::Cible { dossier: PathBuf::from(head.dossier), nom: head.nom, ecraser: head.ecraser };
    let path = blocking(move || cible.ecrire(&body).map_err(|e| e.to_string())).await?;
    let text = path.to_string_lossy().into_owned();
    shell.grants.grant(&text);
    Ok(text)
}

#[derive(Deserialize)]
struct InputHead {
    nom: String,
    taille: u64,
}

#[derive(Deserialize)]
struct BytesHead {
    operation: Value,
    entrees: Vec<InputHead>,
}

#[derive(Serialize)]
struct FileHead {
    nom: String,
    taille: u64,
}

#[derive(Serialize)]
struct BytesResult {
    resultat: Output,
    fichiers: Vec<FileHead>,
}

/// Extension sure d'un nom de fichier (la detection de format en depend), sinon « bin ».
fn safe_extension(name: &str) -> String {
    match Path::new(name).extension().and_then(|e| e.to_str()) {
        Some(e) if !e.is_empty() && e.len() <= 10 && e.chars().all(|c| c.is_ascii_alphanumeric()) => e.to_ascii_lowercase(),
        _ => "bin".into(),
    }
}

/// Remplace les marqueurs « @0 », « @1 »... par les fichiers d'entree et « @sortie » par le dossier de sortie.
/// Toute autre valeur dans un champ de chemin est refusee : la page ne designe jamais un chemin reel ici.
fn substitute(value: &mut Value, inputs: &[PathBuf], out: &Path) -> Result<(), String> {
    let input = |v: &Value| -> Result<Value, String> {
        let index = v.as_str().and_then(|s| s.strip_prefix('@')).and_then(|n| n.parse::<usize>().ok());
        index.and_then(|i| inputs.get(i)).map(|p| Value::String(p.to_string_lossy().into_owned())).ok_or_else(|| ERR_PLACEHOLDER.to_string())
    };
    match value {
        Value::Object(map) => {
            for (key, v) in map.iter_mut() {
                if INPUT_KEYS.contains(&key.as_str()) {
                    let replaced = match &*v {
                        Value::Array(list) => Value::Array(list.iter().map(input).collect::<Result<_, _>>()?),
                        single => input(single)?,
                    };
                    *v = replaced;
                } else if key == OUTPUT_KEY {
                    if v.as_str() != Some(OUTPUT_PLACEHOLDER) {
                        return Err(ERR_PLACEHOLDER.into());
                    }
                    *v = Value::String(out.to_string_lossy().into_owned());
                } else {
                    substitute(v, inputs, out)?;
                }
            }
            Ok(())
        }
        Value::Array(list) => list.iter_mut().try_for_each(|v| substitute(v, inputs, out)),
        _ => Ok(()),
    }
}

/// Coeur de `convert_run_bytes`, sans Tauri (teste).
fn run_in_memory(head: BytesHead, body: &[u8]) -> Result<Vec<u8>, String> {
    let total: u64 = head.entrees.iter().map(|e| e.taille).sum();
    if total != body.len() as u64 {
        return Err("trame de conversion incoherente".into());
    }
    if total > MAX_FILE_BYTES {
        return Err("Fichiers trop volumineux (1 Go au maximum).".into());
    }
    let tmp = DossierTemp::nouveau().map_err(|e| e.to_string())?;
    let out = tmp.fichier("sortie");
    std::fs::create_dir(&out).map_err(|e| e.to_string())?;
    let mut inputs = Vec::with_capacity(head.entrees.len());
    let mut offset = 0usize;
    for (i, e) in head.entrees.iter().enumerate() {
        let end = offset + e.taille as usize;
        let path = tmp.fichier(&format!("entree-{i}.{}", safe_extension(&e.nom)));
        std::fs::write(&path, &body[offset..end]).map_err(|x| x.to_string())?;
        inputs.push(path);
        offset = end;
    }
    let mut value = head.operation;
    substitute(&mut value, &inputs, &out)?;
    let op: Operation = serde_json::from_value(value).map_err(|e| format!("opération invalide : {e}"))?;
    let mut resultat = forge_convert::run(op).map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    let mut bytes = Vec::new();
    if let Output::Fichiers { fichiers, .. } = &mut resultat {
        for f in fichiers.iter_mut() {
            let data = std::fs::read(&*f).map_err(|e| e.to_string())?;
            let nom = f.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
            files.push(FileHead { nom: nom.clone(), taille: data.len() as u64 });
            bytes.extend_from_slice(&data);
            // La page ne voit que des noms : jamais le chemin du dossier temporaire.
            *f = PathBuf::from(nom);
        }
    }
    Ok(frame::encode(&BytesResult { resultat, fichiers: files }, &bytes))
}

/// Operation sur des documents en memoire : trame { operation, entrees: [{nom, taille}] } + octets concatenes.
/// Reponse : trame { resultat, fichiers: [{nom, taille}] } + octets concatenes des fichiers produits.
#[tauri::command]
pub async fn convert_run_bytes(request: Request<'_>) -> Result<Response, String> {
    let tauri::ipc::InvokeBody::Raw(raw) = request.body() else {
        return Err("corps binaire attendu".into());
    };
    let (head, body): (BytesHead, &[u8]) = frame::decode(raw)?;
    let body = body.to_vec();
    blocking(move || run_in_memory(head, &body)).await.map(Response::new)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn marqueurs_remplaces_et_chemins_reels_refuses() {
        let inputs = vec![PathBuf::from("/t/entree-0.pdf"), PathBuf::from("/t/entree-1.pdf")];
        let out = PathBuf::from("/t/sortie");
        let mut ok = json!({ "op": "fusionner", "entrees": ["@0", "@1"], "sortie": { "dossier": "@sortie", "nom": "a.pdf" } });
        substitute(&mut ok, &inputs, &out).unwrap();
        assert_eq!(ok["entrees"][1], json!("/t/entree-1.pdf"));
        assert_eq!(ok["sortie"]["dossier"], json!("/t/sortie"));
        let mut evil = json!({ "op": "infos", "entree": "C:/Windows/win.ini" });
        assert!(substitute(&mut evil, &inputs, &out).is_err());
        let mut evil_out = json!({ "op": "pdf_a", "entree": "@0", "sortie": { "dossier": "C:/", "nom": "x.pdf" } });
        assert!(substitute(&mut evil_out, &inputs, &out).is_err());
        let mut missing = json!({ "op": "infos", "entree": "@7" });
        assert!(substitute(&mut missing, &inputs, &out).is_err());
    }

    #[test]
    fn extension_sure() {
        assert_eq!(safe_extension("Rapport.PDF"), "pdf");
        assert_eq!(safe_extension("../../x.p/df"), "bin");
        assert_eq!(safe_extension("sans"), "bin");
    }

    #[test]
    fn conversion_en_memoire_texte_vers_markdown() {
        let text = "Bonjour\nForgeOffice".as_bytes();
        let head = BytesHead {
            operation: json!({ "op": "convertir", "entree": "@0", "vers": "md", "sortie": { "dossier": "@sortie", "nom": "note.md" } }),
            entrees: vec![InputHead { nom: "note.txt".into(), taille: text.len() as u64 }],
        };
        let response = run_in_memory(head, text).unwrap();
        let (result, bytes): (Value, &[u8]) = frame::decode(&response).unwrap();
        assert_eq!(result["fichiers"][0]["nom"], json!("note.md"));
        assert_eq!(result["resultat"]["fichiers"][0], json!("note.md"));
        assert!(String::from_utf8_lossy(bytes).contains("ForgeOffice"));
    }

    #[test]
    fn trame_incoherente_refusee() {
        let head = BytesHead { operation: json!({ "op": "capacites" }), entrees: vec![InputHead { nom: "a.pdf".into(), taille: 10 }] };
        assert!(run_in_memory(head, b"123").is_err());
    }
}
