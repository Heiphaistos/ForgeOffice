# Architecture de ForgeOffice

Vue d'ensemble pour qui reprend le code. Les règles de code sont dans [`../CONVENTIONS.md`](../CONVENTIONS.md), l'état de chaque brique dans son `STATUS.md`.

## 1. Principe

ForgeOffice est **une** application web (React + TypeScript) qui charge **un module à la fois**, emballée dans une coquille Tauri 2 pour le bureau et le mobile. Le même code tourne dans un navigateur (banc de test). Toute la logique de document est en TypeScript pur, sans DOM, donc testable avec `node --test` ; seuls les moteurs qui gagnent à être natifs (SQLite, PDF, conversions) sont en Rust.

```
                ┌─────────────────────────── apps/web (Vite) ───────────────────────────┐
                │  Shell : lit ?app=…, charge le module à la demande, fournit `Services` │
                └───────────────┬───────────────────────────────────────────────────────┘
                                │ ModuleProps { services, file }
   ┌──────────┬──────────┬──────┴─────┬──────────┬────────┬─────┬────────┬──────────┬─────┐
   │ word     │ excel    │ powerpoint │ publisher│ access │ pdf │ notes  │ convert  │ hub │   packages/*
   └────┬─────┴────┬─────┴─────┬──────┴────┬─────┴───┬────┴──┬──┴────────┴────┬─────┴──┬──┘
        │          │           │           │         │       └───────┬────────┘        │
      docx       xlsx   formulas  pptx ◄───┘         │            native (Tauri)    ui, core
        └──────────┴───────────┴─────┬───────────────┤
                                     opc              │
                                                      ▼
                        apps/desktop/src-tauri ──► crates/forge-base (SQLite)
                                               └─► crates/forge-convert (PDF, conversions)
```

## 2. Paquets

| Paquet | Rôle | Dépend de |
|---|---|---|
| `packages/core` | Contrats (`Services`, `ModuleProps`, `AppModule`, `ModuleInfo`), table `MODULES` (noms, couleurs, extensions : source unique, relue par `build.rs` côté Rust), implémentation navigateur des services (`web-services.ts`), pile annuler/rétablir `History` | |
| `packages/opc` | Lecture bornée et écriture des paquets OOXML : zip (JSZip), parseur XML maison sans entités ni DOCTYPE, relations, chemins de parties normalisés | jszip |
| `packages/ui` | Système de design Office 2024 / Fluent 2 : jetons CSS (clair, sombre, contraste élevé), barre de titre, ruban déclaratif, Backstage, barre d'état, dialogues, info-bulles, 302 icônes Fluent générées | core |
| `packages/formulas` | Moteur de formules Excel : analyse, évaluation, recalcul incrémental par graphe de dépendances, 489 fonctions, syntaxe française, formats de nombre | |
| `packages/docx`, `xlsx`, `pptx` | Modèles de document (`model.ts`) + lecture/écriture : OOXML, ODF, RTF, anciens binaires `.doc`/`.xls`/`.ppt` (lecture), CSV/TSV, Markdown, HTML | opc |
| `packages/word` (Texte) | Éditeur ProseMirror sur le modèle docx, pagination calculée | docx, ui, core |
| `packages/excel` (Tableur) | Grille canvas virtualisée, liaison classeur ↔ moteur de formules | xlsx, formulas, ui |
| `packages/powerpoint` (Présentation) | Application + **éditeur de page réutilisable** (`@forgeoffice/powerpoint/canvas` : `PageView`, `CanvasEditor`, géométrie de 187 formes) | pptx, ui |
| `packages/publisher` (Publication) | Construit sur l'éditeur de page de Présentation : une page = une diapositive, une page maître = une disposition. Aucun second moteur de rendu | powerpoint/canvas, pptx |
| `packages/access` (Base de données) | Interface ; le moteur est `forge-base` via les commandes `base_*` | ui, xlsx |
| `packages/pdf` | Lecteur pdf.js, édition avec pdf-lib, opérations lourdes déléguées à `forge-convert` | convert (pont natif), ui |
| `packages/notes` (Bloc-notes) | CodeMirror 6, réécriture de WinNote | docx (encodages), ui |
| `packages/convert` | Convertisseur par lots + pont `native.ts` vers `forge-convert`, opérations pdf-lib et chargeur pdf.js partagés avec le module PDF | docx, xlsx, pptx |
| `packages/hub` | Accueil : Nouveau, Ouvrir, récents, épinglés, options | ui, core |
| `apps/web` | Shell Vite : registre des modules (un fichier JS par application), `createTauriServices()` (`src/platform/tauri.ts`), `ErrorBoundary` | tout |
| `apps/desktop/src-tauri` | Coquille Tauri 2 (lib `forgeoffice_lib`, bureau + mobile) | forge-base, forge-convert |
| `crates/forge-base` | Moteur SQLite du module Base de données (rusqlite, sans Tauri) | |
| `crates/forge-convert` | Opérations PDF et conversions (lopdf, image, resvg, calamine, docx-rs…), sans Tauri | |

Dépendances npm : toutes déclarées à la racine (les `package.json` de paquets sont vides de dépendances) ; les paquets s'importent par leur nom (`@forgeoffice/core` pointe sur `src/index.ts`, pas de build intermédiaire).

## 3. Le contrat `Services`

Un module n'accède **jamais** au disque, à Tauri ni à `window` pour les fichiers : il reçoit `ModuleProps { services, file }` (voir `packages/core/src/types.ts`).

| Famille | Membres |
|---|---|
| Fichiers | `openFile(filters)`, `readFile(path)`, `saveFile(bytes, nom, filtres, path)`, `openModule(app, path?)`, `openDocument(file)` |
| Fenêtre | `setTitle`, `setModified`, `close`, `print`, `windowControls` (`null` sur mobile et navigateur) |
| Récents et réglages | `recentFiles`, `addRecent`, `clearRecent`, `settings.get/set` (partagés entre fenêtres) |
| Plateforme | `platform` (`web`, `desktop`, `mobile`), `version`, `notify` |
| Mise à jour | `updater` : `check()` puis `install(onProgress)` ; `null` dans le navigateur et sur mobile |
| Moteurs natifs | `native.invoke(commande, args)` ; `null` dans le navigateur, le module propose alors un mode dégradé (Base de données : base de démonstration en lecture seule ; Convertisseur et PDF : outils natifs grisés avec la raison) |

Deux implémentations : `web-services.ts` (navigateur : `<input type=file>`, téléchargement, `localStorage`) et `createTauriServices()` (bureau et mobile : commandes Tauri). Un module est donc testable sans Tauri, et la coquille est remplaçable.

## 4. Flux d'un fichier

**Ouverture** (bureau) :

1. L'utilisateur choisit un fichier : dialogue natif (`open_dialog`), double-clic ou « Ouvrir avec » (ligne de commande, `take_launch`), liste des récents, ou glisser-déposer sur l'accueil (512 Mo maximum, extensions contrôlées).
2. La coquille **inscrit le chemin dans le registre d'autorisations** (`grants.rs`). C'est la seule façon d'y entrer : la page ne peut pas ajouter un chemin de son propre chef.
3. `read_path` refuse tout chemin hors registre, lit au plus 1 Go et répond par une **trame binaire** `[u32 longueur d'en-tête][JSON][octets]` (pas de base64). `apps/web/src/platform/tauri.ts` en est le miroir.
4. `moduleForFile(nom)` désigne l'application d'après l'extension ; `services.openDocument` ouvre la fenêtre de ce module (une fenêtre par document, `fo-*`) avec le fichier.
5. Le module décode les octets avec `readDocument` / `readWorkbook` / `readPptx` (détection par signature puis extension), qui produisent un **modèle** (`model.ts`) : le fichier d'origine n'est jamais édité en place. Les parties inconnues sont conservées (SmartArt, `customXml`, projets VBA : jamais exécutés).
6. L'application édite le modèle ; `History` gère annuler/rétablir, une copie de récupération est écrite toutes les 30 s.

**Enregistrement** : le module sérialise le modèle en octets (`writeDocument`…), appelle `services.saveFile`. La coquille écrit **de façon atomique** (fichier temporaire + `.bak` pendant l'écriture, puis renommage), autorise le chemin pour la suite, met à jour les récents et l'état « modifié ». Fermer une fenêtre modifiée demande confirmation ; la sortie est bornée à 5 s.

**Moteurs natifs** : `base_open/create/copy/close/op` (SQLite, une base par fenêtre, fermée avec elle) ; `convert_run`, `convert_run_bytes` (documents en mémoire, dans un dossier temporaire privé supprimé à la fin), `convert_capacites`, `convert_pick_folder`, `convert_miniatures`, `convert_save_into`. Le travail lourd tourne dans un fil bloquant dédié, jamais sur le fil de l'interface.

## 5. Sécurité des fichiers hostiles

Principe : **toute donnée venant d'un fichier est hostile**.

| Menace | Parade |
|---|---|
| Bombe zip | Limites de `@forgeoffice/opc` : 20 000 entrées, 512 Mo par entrée, 2 Go au total (réglables) ; côté Rust : 512 Mo en lecture, 1 Gio en sortie, 512 Mo pour les archives |
| Zip-slip, chemins piégés | `normalizePartPath` refuse toute sortie du paquet ; noms de sortie Rust confinés au dossier choisi (`..`, séparateurs, `C:`, `CON`, caractères de contrôle refusés) ; jamais d'écrasement sans `ecraser` |
| XML (XXE, bombes d'entités) | Parseur XML maison : DOCTYPE et entités refusés, profondeur et nombre de blocs/feuilles/cellules bornés |
| Formats binaires (CFB : `.doc`, `.xls`, `.ppt`) | Chaînes de secteurs bornées et boucles détectées ; enregistrements tronqués ignorés ; fichiers chiffrés refusés avec un message ; **corruption aléatoire testée** (300 tirages `.doc`, 240 + 2 000 `.xls` : seule l'erreur du module peut sortir) |
| Images et SVG | Anti-bombes : 100 Mpx (images), 64 Mpx (SVG) |
| Liens | `javascript:`, `vbscript:`, `data:` refusés à la lecture (y compris champs HYPERLINK) et à l'insertion ; seuls http, https, mailto |
| HTML importé | Nettoyé (scripts, iframes, objets, gestionnaires d'événements éliminés), DOMPurify pour tout `innerHTML` |
| Formules CSV (injection) | Ignorées par défaut à la lecture ; option d'échappement à l'écriture |
| Macros | Conservées dans `.docm`/`.xlsm`/`.pptm`, **jamais exécutées** ; le module Base de données a ses propres macros (actions de données dans une transaction tout-ou-rien) |
| SQL utilisateur | Valeurs liées, identifiants cités ; `ATTACH`/`DETACH`, `load_extension`, PRAGMA d'écriture et tables internes `__fo_*` refusés ; SQLite en mode défensif, WAL, `foreign_keys`, `secure_delete` |
| Outils externes (Ghostscript, OCR…) | Lancés sans shell, arguments en liste, fichiers sous noms fixes dans un dossier temporaire privé (RAII), délai de 600 s, langue OCR validée avant lancement |
| Page web compromise | CSP stricte (`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `form-action 'none'`, `connect-src ipc:` uniquement) ; chaque commande Tauri autorisée une à une dans `capabilities/default.json`, pour les seules fenêtres `fo-*` ; registre d'autorisations de chemins (§4) |

Limites de l'état actuel : le chiffrement `.docx`/`.xlsx`/`.pptx` (mot de passe Office) n'est pas déchiffré, il est refusé avec un message.

## 6. Mise à jour automatique

- **Installés (NSIS, MSI, AppImage, dmg)** : `tauri-plugin-updater` lit `latest.json` (endpoint configuré dans `tauri.conf.json`), télécharge, **vérifie la signature minisign** avec la clé publique embarquée, installe en mode passif et relance. Première vérification 20 s après le démarrage, puis toutes les 6 h, sauf `updates.auto = false` dans les réglages. Entrées du manifeste : `windows-x86_64`, `windows-i686`, `linux-x86_64`, `darwin-aarch64`, `darwin-x86_64`.
- **Portable** (exécutable compilé avec `--features portable`) : lit l'entrée `windows-<arch>-portable`, télécharge, vérifie la signature, renomme l'exe courant en `.exe.old`, écrit le nouveau (atomique, retour arrière si échec), libère le verrou d'instance unique, relance et quitte ; le `.old` est supprimé au démarrage suivant.
- **Mobile** : la boutique d'applications gère les mises à jour ; `update_check` renvoie une erreur explicite et `services.updater` vaut `null`.
- **Production du manifeste** : `.github/workflows/release.yml` signe les artefacts (clé `TAURI_SIGNING_PRIVATE_KEY`), `scripts/make-latest-json.mjs` assemble `latest.json` et la release est créée **en brouillon**.

## 7. Plateformes

Une seule crate (`apps/desktop/src-tauri`, lib `forgeoffice_lib`, point d'entrée `tauri::mobile_entry_point`) sert au bureau et au mobile ; ce qui n'a de sens que sur bureau est sous `cfg(desktop)` (instance unique, mise à jour, barre de titre dessinée par la page, impression native). Détails mobiles : [`MOBILE.md`](MOBILE.md). Livraison Windows : [`PACKAGING.md`](PACKAGING.md).

## 8. Où changer quoi

| Je veux… | Je touche… |
|---|---|
| Ajouter une extension à un module | `packages/core/src/modules.ts`, puis `npm run associations` (dans `apps/desktop`) ; `build.rs` et un test Rust vérifient la cohérence |
| Ajouter une commande native | `apps/desktop/src-tauri/src/*_cmds.rs`, son enregistrement dans `lib.rs`, son droit dans `capabilities/default.json` (+ `build.rs`), son appel dans `apps/web/src/platform/tauri.ts` |
| Ajouter un texte d'interface | `src/strings.ts` du paquet (aucun texte en dur dans les composants) |
| Changer la version | `package.json` (racine, `apps/desktop`), `tauri.conf.json`, `Cargo.toml` de la coquille, puis `CHANGELOG.md` : le workflow de release refuse un tag différent |
