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
- Mise a jour : `tauri-plugin-updater`, cle publique = `<dossier des secrets>\forgeoffice-updater-v2.key.pub` (verifiee identique ; l'ancienne paire v1 etait inutilisable),
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

## Livrables finaux signes et tests reels Windows (2026-11-04, 2e cycle, PC de dev Windows 11 ; rien publie)

Livrables (`src-tauri/target/livrables/`, construits sans `createUpdaterArtifacts`, signes apres coup) : tous signes Authenticode
(Heiphaistos, SHA-256, horodates) ; les `.exe` d'installation et les portables portent aussi leur `.sig` minisign (cle v2).

| Fichier | Octets | Authenticode | `.sig` |
|---|---|---|---|
| `ForgeOffice_0.1.0_x64-setup.exe` | 15 148 648 | oui | oui |
| `ForgeOffice_0.1.0_x64_fr-FR.msi` / `_en-US.msi` | 18 427 904 chacun | oui | non (MSI non servis a l'updater) |
| `ForgeOffice_0.1.0_x64_portable.exe` | 33 752 848 | oui | oui |
| `ForgeOffice_0.1.0_x86-setup.exe` | 14 757 272 | oui | oui |
| `ForgeOffice_0.1.0_x86_fr-FR.msi` / `_en-US.msi` | 17 756 160 chacun | oui | non |
| `ForgeOffice_0.1.0_x86_portable.exe` | 28 075 280 | oui | oui |

Avec `SHA256SUMS` (8 lignes, `sha256sum -c` OK) et `latest.json` (4 entrees Windows, URL factice) produit par
`scripts/make-latest-json.mjs --strict` en local (le mode strict echoue seulement sur les entrees Linux/macOS absentes, normal).
Statut `Get-AuthenticodeSignature` = `UnknownError` : certificat auto-signe dont la racine n'est pas installee sur ce PC (signature
presente et horodatee, pas `HashMismatch`/`NotSigned`).
Taille : l'exe portable x64 passe de 21,0 Mo (1er cycle, `panic = "abort"`) a 33,75 Mo : `panic = "unwind"` (+8,5 Mo mesures) et les
polices `.ttf` embarquees dans l'interface (7,3 Mo).

| Test | Resultat | Preuve |
|---|---|---|
| a. NSIS 64 final : `/S` par utilisateur, 8 fichiers (docx xlsx pptx pdf txt fodb fopub csv) + Accueil, fermeture, kill, desinstallation | OK | 9 fenetres lues par UI Automation (titres Texte/Tableur/Presentation/PDF/Bloc-notes/Base de donnees/Publication), captures regardees ; `WM_CLOSE` -> 0 processus ForgeOffice et 0 WebView2 apres 0,99 s ; `taskkill /F` sur le seul processus de test -> 0 restant, relance propre puis fermeture en 0,43 s ; desinstallation : dossier, ARP retires ; exe installe signe |
| b. Portable 64 + `portable.flag` | OK | journal, reglages et profil WebView2 dans `ForgeOffice-donnees/` a cote de l'exe, aucun dossier `org.heiphaistos.forgeoffice` dans AppData, fermeture en 0,51 s, 0 restant |
| c. MSI 64 `/qn` puis `/x` | OK | Program Files, fichier ouvert, fermeture 0,36 s, desinstallation ; en-US installe/desinstalle aussi |
| d. 32 bits : NSIS, MSI (fr-FR + en-US), portable | OK | `IsWow64Process` = vrai, journal `windows x86`, 9 fenetres NSIS, fermeture 0,8 s, MSI `/x` OK, portable avec donnees a cote, 0 restant |
| e. MAJ 0.1.0 -> 0.1.1 avec la VRAIE cle v2, serveur 127.0.0.1:8765, config de test `test-update2.conf.json` (endpoints + http uniquement ; cle publique = production) | OK, NSIS et portable | Accueil > Options > Rechercher > Installer et redemarrer : NSIS exe 0.1.1 + ARP 0.1.1 + « ForgeOffice version 0.1.1 » en 4 s ; portable remplace, `.old` supprime, `portable.flag` et donnees intacts. Negatif (signature d'un autre fichier) : refuse pour NSIS ET portable, version restee 0.1.0, exe non remplace |
| f. Refus journalise + message clair | OK | journal : `installation de la mise a jour refusee : Mise a jour impossible : The signature verification failed` ; Accueil : « L'installation de la mise a jour a echoue : le paquet a ete refuse ou n'a pas pu etre telecharge. » |
| g. Fichiers pieges | OK | `.xls` tronque (Convertisseur, ajout par la vraie boite « Ouvrir » + « Tout convertir ») : erreur par fichier « Le conteneur OLE du fichier est endommage », idem ouvert en ligne de commande (message affiche, lu par UIA) ; `.fodb` corrompu : « Ce fichier n'est pas une base de donnees SQLite valide » ; 3 PDF corrompus passes au moteur Rust : erreurs `PDF invalide ou endommage` ; dans tous les cas processus vivant et fenetres ouvertes. Aucun de ces fichiers ne provoque de panic (le garde `panic_guard` reste couvert par son test unitaire) |

Registre : `HKLM\Software\Classes`, `HKLM\...\Wow6432Node\Classes` et `HKCU\Software\Classes` exportes avant tout test puis apres tous (NSIS, 4 MSI, portables) : aucune difference
sur les associations ; seules differences = caches Windows `Local Settings\MuiCache` (HKCU) et 12 cles `.uproject` / `Unreal.ProjectFile` (HKLM)
ajoutees par Unreal Editor d'une autre session du PC, sans lien avec ForgeOffice.

Defauts / pieges rencontres (aucun defaut du produit) : voir `docs/PACKAGING.md` (signature en 2 temps, `signCommand` inutilisable, `/S` sous Git Bash, memoire).

## Reste a faire

- Cle de mise a jour v2 : prouvee en vrai (signature des paquets et verification par l'application, NSIS et portable). Reste a publier : release, `latest.json` reel (URL GitHub ou relais), et a installer la racine `Heiphaistos` sur les PC cibles (`installer-confiance.bat`) pour que la signature Authenticode devienne `Valid`.
- Android : APK release signes et AAB construits, exerces sur emulateur x86_64 (voir `docs/MOBILE.md`) ; reste : essais sur appareil reel (l'APK arm64-v8a est construit et signe, non lance), partage depuis l'interieur des modules, bouton Retour avec « Enregistrer ». iOS : construction sur macOS uniquement.
- Linux et macOS non compiles localement (CI).
- `docs/MOBILE.md` est une copie de `apps/desktop/docs/MOBILE.md` (garder les deux alignes).
