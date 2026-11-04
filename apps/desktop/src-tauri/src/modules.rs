// Applications de la suite et extensions qu'elles ouvrent. La table `APPS` est generee par build.rs
// depuis `packages/core/src/modules.ts` (source unique) : elle ne peut pas diverger du TypeScript.
// Les associations de fichiers de tauri.conf.json sont regenerees par `scripts/associations.mjs` ;
// un test verifie qu'elles sont a jour.

include!(concat!(env!("OUT_DIR"), "/apps.rs"));

/// Jamais associes a ForgeOffice : un double-clic doit continuer a executer ces scripts
/// (ou a lire une video `.ts`). Meme liste que `NEVER` dans scripts/associations.mjs.
#[cfg(test)]
const NEVER_ASSOCIATE: &[&str] = &["bat", "cmd", "ps1", "sh", "bash", "js", "mjs", "vbs", "py", "ts"];

pub fn is_app_id(id: &str) -> bool {
    APPS.iter().any(|(app, _)| *app == id)
}

/// Application qui ouvre un nom de fichier, d'apres son extension.
pub fn app_for_file(name: &str) -> Option<&'static str> {
    let (_, ext) = name.rsplit_once('.')?;
    let ext = ext.to_lowercase();
    APPS.iter().find(|(_, exts)| exts.contains(&ext.as_str())).map(|(app, _)| *app)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;

    #[test]
    fn extension_vers_application() {
        assert_eq!(app_for_file("Rapport.DOCX"), Some("word"));
        assert_eq!(app_for_file("/a/b.c/budget.xlsx"), Some("excel"));
        assert_eq!(app_for_file("cours.ppsx"), Some("powerpoint"));
        assert_eq!(app_for_file("facture.pdf"), Some("pdf"));
        assert_eq!(app_for_file("sans-extension"), None);
        assert_eq!(app_for_file("image.png"), None);
        assert!(is_app_id("hub") && is_app_id("access") && !is_app_id("Word"));
    }

    #[test]
    fn table_generee_depuis_le_typescript() {
        let source = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/../../../packages/core/src/modules.ts"))
            .expect("modules.ts lisible");
        for (app, exts) in APPS {
            assert!(source.contains(&format!("id: '{app}'")), "{app} absent du TypeScript");
            for ext in *exts {
                assert!(source.contains(&format!("'{ext}'")), "{ext} absent du TypeScript");
            }
        }
        assert!(APPS.len() >= 7);
    }

    #[test]
    fn associations_de_fichiers_a_jour() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).expect("tauri.conf.json valide");
        let associated: BTreeSet<String> = conf["bundle"]["fileAssociations"]
            .as_array()
            .expect("fileAssociations")
            .iter()
            .flat_map(|a| a["ext"].as_array().cloned().unwrap_or_default())
            .filter_map(|e| e.as_str().map(str::to_string))
            .collect();
        let expected: BTreeSet<String> = APPS
            .iter()
            .flat_map(|(_, e)| e.iter())
            .filter(|e| !NEVER_ASSOCIATE.contains(e))
            .map(|e| e.to_string())
            .collect();
        assert_eq!(associated, expected, "lancer `node apps/desktop/scripts/associations.mjs`");
    }
}
