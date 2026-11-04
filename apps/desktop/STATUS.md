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
- Robustesse (audit de securite, 2026-11-04) :
  - `convert_run_bytes` : tailles de la trame verifiees sans debordement (`checked_add`/`try_from`, somme = octets recus), erreur francaise, jamais de panic ;
  - `base_op` : un verrou par base (`Arc<Slot>`), table de bases verrouillee le temps de cloner l'`Arc` ; requetes SQL hors du fil de l'interface ; delai SQL de forge-base (`DELAI_SQL_DEFAUT`, 30 s) branche a l'ouverture, message d'erreur de forge-base renvoye tel quel ; la fermeture d'une fenetre n'attend jamais une requete en cours (fermeture differee, au plus tard au delai SQL) ;
  - profil release en `panic = "unwind"` (au lieu de `abort`) + `panic_guard::proteger` (`catch_unwind`) autour de `blocking` (conversions) et de `base_op` : un fichier piege qui fait paniquer une bibliotheque renvoie « Erreur interne pendant l'opération... » (detail consigne par le crochet de panic) et les autres fenetres restent ouvertes ;
  - licence : `license-file` (PolyForm Noncommercial 1.0.0) dans `Cargo.toml`, `license` dans `package.json`.
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
- Android (2026-11-04, branche `feat/android`) : APK signes arm64-v8a + x86_64 et .aab, verifies sur emulateur (Pixel 6, android-36) :
  les 9 modules, bibliotheque privee + SAF (ouvrir, enregistrer, enregistrer sous, partager), « Ouvrir avec »/« Partager vers »,
  Retour, rotation, tablette, impression PDF (`PrintManager`), diaporama immersif, base `.fodb` native, Convertisseur (fichier piege : « echec »,
  pas de plantage). Plugin Kotlin `ForgePlugin.kt` + `android.rs`/`library.rs`/`mobile_cmds.rs`. Voir `docs/MOBILE.md`.

## Verification (2026-11-04, apres le lot robustesse)

| Commande | Resultat |
|---|---|
| `cargo check --target i686-pc-windows-msvc` (+ `--features portable`) | OK, 0 avertissement |
| `cargo check --target aarch64-linux-android` (+ `--features portable`) | OK, 0 avertissement (necessite le NDK dans le PATH et `CC_aarch64_linux_android`/`AR_aarch64_linux_android`) ; deux erreurs/avertissements mobiles corriges (`blocking_pick_folder` n'existe pas sur mobile, import `Manager` inutile) |
| `cargo clippy --all-targets` (+ `--features portable`) | 0 avertissement |
| `cargo test` | 53 passes, 0 echec (dont 4 nouveaux : trame debordante, requete infinie multi-fenetres, delai par defaut, panic intercepte) |
| `cargo test` forge-convert / forge-base | 74 / 78 passes |
| `node --test apps/desktop/tests/*.test.ts` | 5 passes |

## Taille de l'executable (x64, release, sans `--features portable`, dossier cible separe)

`panic = "abort"` : 19 568 128 octets (18,7 Mio) -> `panic = "unwind"` : 28 081 664 octets (26,8 Mio), soit +8 513 536 octets (+43,5 %).
Prix de la survie aux fichiers pieges (tables de deroulement + chemins de nettoyage dans toutes les dependances) ; LTO, codegen-units et strip inchanges.

## Construire (lot de publication)

```bash
cd apps/desktop
npm run build:win64      # NSIS puis MSI 64 bits (le MSI utilise src-tauri/windows/msi.conf.json)
npm run build:win32      # idem 32 bits
npm run portable:win64   # target/x86_64-pc-windows-msvc/release/forgeoffice.exe (apres build:win64 : meme dossier target)
npm run portable:win32
npm run build:linux      # AppImage + deb + rpm (sur Linux)
npm run build:mac        # dmg universel (sur macOS)
```

Portable : signer l'exe (`TAURI_SIGNING_PRIVATE_KEY_PATH=<cle> npx tauri signer sign <exe>`), le publier (ex.
`ForgeOffice_<v>_x64_portable.exe`) et ajouter a `latest.json` les entrees `windows-x86_64-portable` et
`windows-i686-portable` (`url` + `signature`). Details et pieges : `docs/PACKAGING.md`.

## Tests reels Windows (2026-11-04, PC de dev, Windows 11 ; rien publie)

Livrables (`src-tauri/target/livrables/`) : `ForgeOffice_0.1.0_x64-setup.exe` 10,0 Mo, `_x64_fr-FR.msi` et `_en-US.msi` 12,6 Mo,
`_x64_portable.exe` 21,0 Mo, `_x86-setup.exe` 9,9 Mo, `_x86_fr-FR.msi` / `_en-US.msi` 12,4 Mo, `_x86_portable.exe` 19,4 Mo.
Construits sans signature (`createUpdaterArtifacts:false`) : la cle de production n'a pas pu servir (voir « Reste a faire »).

| Test | Resultat | Preuve |
|---|---|---|
| a. NSIS 64 : installation `/S`, 6 fichiers + Accueil + Convertisseur, fermeture, kill brutal | OK | 7 fenetres Tauri (titres lus par UI Automation), 6 captures regardees (Texte, Tableur, Presentation, PDF, Base de donnees, Bloc-notes + Publication et Convertisseur), `WM_CLOSE` -> processus termine en 0,7 s, 0 processus ForgeOffice/WebView2 restant ; `taskkill /F` -> 0 restant, relance propre ; desinstallation `/S` : dossier, entree ARP et cles de registre retires |
| b. Portable 64 + `portable.flag` | OK | donnees, journal et profil WebView dans `ForgeOffice-donnees/` a cote de l'exe, rien ecrit dans AppData, fermeture propre |
| c. MSI 64 `/qn` puis `/x` | OK (le PC est administrateur) | Program Files, entree ARP, lancement avec fichier, fermeture propre, registre identique a l'etat d'avant apres desinstallation (voir PACKAGING.md pour le defaut corrige) |
| d. 32 bits : NSIS, MSI, portable | OK | processus WOW64 confirme (`IsWow64Process`), journal `windows x86`, capture, fermeture propre, 0 restant, MSI desinstalle, registre identique |
| e. MAJ 0.1.0 -> 0.1.1 NSIS (serveur 127.0.0.1:8765, cle de TEST jetable, config `.logs/build/test-update.conf.json`) | OK | « Rechercher une mise a jour » trouve 0.1.1, « Installer et redemarrer » : exe en 0.1.1, entree ARP 0.1.1, nouveau processus ; **signature fausse refusee** (version restee 0.1.0) |
| e. MAJ portable 0.1.0 -> 0.1.1 | OK | exe remplace sur place, relance en 0.1.1, `.old` supprime, `portable.flag` et donnees intacts |

Defauts trouves et corriges : associations de fichiers detruites par les modeles NSIS et MSI (voir PACKAGING.md),
titre de fenetre du module Base de donnees (restait « ForgeOffice »), refus d'une mise a jour sans trace au journal et
message « recherche echouee » pour une installation refusee (corriges dans les sources apres les builds ci-dessus :
a reconstruire).

## Reste a faire

- Cle de mise a jour : l'ancienne paire ne s'ouvrait pas (« Wrong password ») ; `tauri.conf.json` porte desormais la cle publique de la paire v2 (`D:/MDP/forgeoffice-updater-v2.key.pub`). Signature avec la cle privee v2 a essayer avant publication (non testee ici : les fichiers `.key` ne sont jamais lus).
- Reconstruire les livrables avant publication (les corrections ci-dessus et le lot robustesse sont dans les sources ; `panic = "unwind"` modifie la taille de l'exe, voir « Taille de l'executable »).
- Android : essais sur appareil reel (seul l'emulateur x86_64 a ete exerce ; l'APK arm64-v8a est construit et signe, non lance),
  partage depuis l'interieur des modules, enregistrement « Enregistrer / Ne pas enregistrer » du bouton Retour. iOS : construction sur macOS uniquement.
- Linux et macOS non compiles localement (CI).
- `docs/MOBILE.md` est une copie de `apps/desktop/docs/MOBILE.md` (garder les deux alignes).
