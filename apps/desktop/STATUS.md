# Coquille Tauri 2 : etat (2026-11-04)

## Fait

- Crate `forgeoffice` (lib `forgeoffice_lib`, staticlib/cdylib/rlib), modules < 400 lignes chacun.
- 18 commandes, chacune autorisee explicitement dans `capabilities/default.json` (fenetres `fo-*`) :
  `app_info`, `settings_load`, `settings_set`, `open_dialog`, `read_path`, `save_file`, `open_module`,
  `take_launch`, `recents_list`, `recents_add`, `recents_clear`, `window_set_title`, `window_set_modified`,
  `window_close`, `print_window`, `log_write`, `update_check`, `update_install`.
- `apps/web/src/platform/tauri.ts` : `createTauriServices()` couvre tout le contrat `Services`
  (fichiers en trame binaire, recents, reglages partages entre fenetres, `updater`, `windowControls`, journal).
- Fichiers : registre d'autorisations, ecriture atomique (+ `.bak` pendant l'ecriture), 1 Go max, URL `content://` mobile.
- Instance unique (bureau), une fenetre par document, garde a la fermeture si modifie, sortie bornee a 5 s.
- Journal `[ISO8601] [NIVEAU] message`, rotation 1 Mo, 5 archives ; panics consignes.
- Mise a jour : `tauri-plugin-updater`, cle publique = `D:\MDP\forgeoffice-updater.key.pub` (verifiee identique),
  endpoint GitHub `latest.json`, installeur Windows passif, verification 20 s apres demarrage puis toutes les 6 h
  sauf `updates.auto = false`.
- Mode portable (`portable.rs`) :
  - donnees a cote de l'exe (`ForgeOffice-donnees/` : reglages, recents, `journal/`, profil `webview/`) si
    `portable.flag` est present ; repli sur les dossiers systeme (avec avertissement au journal) si non inscriptible ;
  - exe compile avec `--features portable` : lit l'entree `<os>-<arch>-portable` de `latest.json`, telecharge,
    signature minisign verifiee par le greffon, renomme l'exe courant en `.exe.old`, ecrit le nouveau
    (atomique, retour arriere si echec), libere le verrou d'instance unique, relance, quitte ; `.old` supprime au
    demarrage suivant.
- WebView2 absent : boite de dialogue native explicite (Windows) avant toute fenetre ; installeurs avec
  bootstrapper WebView2 embarque (`webviewInstallMode: embedBootstrapper`).
- Bundle : NSIS par utilisateur + MSI (fr-FR, en-US), deb/rpm/AppImage, dmg ; 59 associations generees depuis
  `packages/core/src/modules.ts` (`npm run associations`, test Rust de coherence). Scripts et executables
  (`bat cmd ps1 sh bash js mjs vbs py ts`) volontairement jamais associes : un double-clic doit continuer a les executer.
- Mobile : compile pour Android (`aarch64-linux-android` verifie) ; impression native, instance unique et mise a
  jour sous `cfg(desktop)`. Voir `docs/MOBILE.md`.

## Verification (2026-11-04)

| Commande | Resultat |
|---|---|
| `cargo check --target x86_64-pc-windows-msvc` (+ `--features portable`) | OK, 0 avertissement |
| `cargo check --target i686-pc-windows-msvc` (+ `--features portable`) | OK, 0 avertissement |
| `cargo check --target aarch64-linux-android` (+ `--features portable`) | OK, 0 avertissement |
| `cargo clippy --all-targets --features portable` (x64) | 0 avertissement |
| `cargo test` | 39 passes, 0 echec |
| `node --test apps/desktop/tests/*.test.ts` | 5 passes |
| `npx tsc -p apps/desktop/tsconfig.json --noEmit` | 0 erreur |

## Construire (lot de publication)

```bash
cd apps/desktop
npm run build:win64      # NSIS + MSI 64 bits (signes si TAURI_SIGNING_PRIVATE_KEY est defini)
npm run build:win32      # NSIS + MSI 32 bits
npm run portable:win64   # APRES build:win64 (meme dossier target) : target/x86_64-pc-windows-msvc/release/forgeoffice.exe
npm run portable:win32
npm run build:linux      # AppImage + deb + rpm (sur Linux)
npm run build:mac        # dmg universel (sur macOS)
```

Portable : signer l'exe (`npx tauri signer sign <exe>`), le publier (ex. `ForgeOffice_<v>_x64_portable.exe`) et
ajouter a `latest.json` les entrees `windows-x86_64-portable` et `windows-i686-portable` (`url` + `signature`).

## Reste a faire

- `tauri build` complet jamais lance (a faire quand l'interface sera prete), donc pas encore observe :
  installeurs, exe portable, fermeture sans processus restant, chaine de mise a jour N -> N+1 (installeur ET portable).
- Associations Windows : le modele NSIS de Tauri libelle le verbe « Open with ForgeOffice » en anglais et se
  propose comme defaut pour les extensions sans choix utilisateur ; un `installerHooks` NSIS serait necessaire
  pour un libelle francais / « Ouvrir avec » seul.
- Android : `npm run android:init` pas encore lance (`gen/android` absent) ; intent-filters « Ouvrir avec » a ajouter
  ensuite. iOS : construction sur macOS uniquement.
- Linux et macOS non compiles localement (CI).
- `docs/MOBILE.md` est dans `apps/desktop/docs/` (perimetre du lot) ; a deplacer dans `docs/` si voulu.
