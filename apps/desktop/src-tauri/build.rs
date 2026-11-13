// 1. Genere la table des applications depuis `packages/core/src/modules.ts` (source unique).
// 2. Declare les commandes de l'application : chacune doit etre autorisee explicitement dans
//    capabilities/ (permission `allow-<commande>`), aucune n'est ouverte par defaut.

use std::fmt::Write as _;

const COMMANDS: &[&str] = &[
    "app_info",
    "settings_load",
    "settings_set",
    "open_dialog",
    "read_path",
    "save_file",
    "open_module",
    "take_launch",
    "recents_list",
    "recents_add",
    "recents_clear",
    "window_set_title",
    "window_set_modified",
    "window_close",
    "print_window",
    "log_write",
    "update_check",
    "update_install",
    "base_open",
    "base_create",
    "base_copy",
    "base_close",
    "base_op",
    "convert_capacites",
    "convert_run",
    "convert_run_bytes",
    "convert_pick_folder",
    "convert_miniatures",
    "convert_save_into",
    "inbox_take",
    "share_file",
    "set_immersive",
    "set_system_bars",
    "exit_app",
    "folder_pick",
    "folder_list",
    "folder_read",
    "folder_write",
    "folder_mkdir",
    "folder_rename",
    "folder_copy",
    "folder_exists",
    "folder_trash",
    "file_info",
    "reveal_in_folder",
];

const MODULES_TS: &str = "../../../packages/core/src/modules.ts";

/// `(id, [extensions])` pour chaque fiche `{ id: '...', ..., extensions: [...] }` du TypeScript.
fn parse_modules(source: &str) -> Vec<(String, Vec<String>)> {
    let mut table = Vec::new();
    let mut rest = source;
    while let Some(at) = rest.find("id: '") {
        rest = &rest[at + 5..];
        let Some(id_end) = rest.find('\'') else { break };
        let id = rest[..id_end].to_string();
        let Some(ext_at) = rest.find("extensions: [") else { break };
        let body = &rest[ext_at + "extensions: [".len()..];
        let Some(close) = body.find(']') else { break };
        let exts = body[..close]
            .split(',')
            .map(|e| e.trim().trim_matches('\'').to_string())
            .filter(|e| !e.is_empty())
            .collect();
        table.push((id, exts));
        rest = &body[close..];
    }
    table
}

fn generate_app_table() {
    println!("cargo:rerun-if-changed={MODULES_TS}");
    let source = std::fs::read_to_string(MODULES_TS).unwrap_or_else(|e| panic!("lecture de {MODULES_TS} : {e}"));
    let table = parse_modules(&source);
    if table.iter().all(|(id, _)| id != "hub") {
        panic!("{MODULES_TS} : table des applications introuvable");
    }
    let mut code = String::from("pub const APPS: &[(&str, &[&str])] = &[\n");
    for (id, exts) in &table {
        let list: Vec<String> = exts.iter().map(|e| format!("{e:?}")).collect();
        let _ = writeln!(code, "    ({id:?}, &[{}]),", list.join(", "));
    }
    code.push_str("];\n");
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR fourni par cargo")).join("apps.rs");
    std::fs::write(&out, code).unwrap_or_else(|e| panic!("ecriture de {} : {e}", out.display()));
}

fn main() {
    generate_app_table();
    let attributes = tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS));
    if let Err(e) = tauri_build::try_build(attributes) {
        panic!("tauri-build : {e:#}");
    }
}
