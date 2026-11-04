// Point d'entree bureau : toute la logique vit dans la bibliotheque (partagee avec Android et iOS).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    forgeoffice_lib::run();
}
