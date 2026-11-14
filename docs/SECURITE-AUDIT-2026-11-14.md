# Audit de sécurité ForgeOffice — 2026-11-14

Base : commit `d511530` (0.5.7), branche `night-sec`. Périmètre : coquille Tauri (Rust), modules TS/React, import de documents,
mises à jour, CI. Aucun secret, IP ni domaine réel n'est ajouté au dépôt.

## Méthode et outils

| Contrôle | Résultat |
|---|---|
| `npm audit` | 0 vulnérabilité |
| `cargo audit` (`apps/desktop/src-tauri`) | 0 vulnérabilité ; 10 avertissements de crates non maintenues ou « unsound » **transitives de Tauri/Linux (gtk, zbus, ttf-parser, glib 0.18)**, non corrigeables côté projet |
| `gitleaks` sur l'historique (370 commits) | 2 alertes, **faux positifs** : mots de passe de test de `packages/docx/tests/protection.test.ts` (l. 7-8) |
| Capacités Tauri | `capabilities/default.json` : fenêtres `fo-*` seulement, uniquement les commandes propres + boutons de barre de titre ; aucun plugin `fs`, `shell`, `http` exposé à la page |
| CSP (`tauri.conf.json`) | `default-src 'self'`, `script-src 'self'`, `connect-src ipc:`, `object-src 'none'`, `form-action 'none'`, `base-uri 'self'` ; seul `style-src 'unsafe-inline'` (styles React), accepté |
| Sinks DOM | aucune injection de HTML brut, évaluation dynamique de code, écriture de document ni `postMessage` dans `src` ; Markdown et HTML passent par DOMPurify (`notes`, `word`) |
| CI | actions épinglées par SHA, `permissions: {}` par défaut, secrets passés par `env`, release gardée par `RELEASE_ENABLED`, aucun `pull_request_target` |

Points déjà solides, vérifiés (pas de changement) : registre d'autorisations `grants.rs` (la page ne choisit jamais un chemin),
`folder_cmds.rs` (`clean_rel` + `safe_join` + liens symboliques), `convert_cmds.rs` (marqueurs `@n`/`@sortie`, noms validés par
forge-convert, écriture atomique sans suivre un lien), `forge-base` (`DEFENSIVE`, `TRUSTED_SCHEMA=false`, autorisation SQL, `load_extension` refusé),
trames `frame.rs` bornées, updater (signature minisign vérifiée avant installation, endpoint HTTPS, portable : `download()` vérifie avant `replace_exe`),
OPC (limites par entrée / totales par flux, `normalizePartPath`, DOCTYPE refusé, plafond de spin du chiffrement), liens
`sanitizeUrl` à l'écriture et à la lecture, export CSV avec `escapeFormulas`, iframes d'onglets (même origine, aucun `postMessage` ;
`window.parent.__FO_HOST__` expose seulement `tabServices`, `takeFile`, `hostBytes` à des cadres de la suite), `pdfjs-dist` 6.x (plus d'évaluation de polices).

## Failles trouvées et corrigées

### MOYENNE-1 — Bombe de décompression dans le ZIP d'images du publipostage
- `packages/publisher/src/mergeimages.ts` (`readImageZip`, ancienne l. 24-31).
- Problème : `JSZip.loadAsync` puis `entry.async('uint8array')` décompressait chaque entrée **en entier** avant de tester `MAX_IMAGE_BYTES` : un petit ZIP choisi par l'utilisateur épuisait la mémoire.
- Correctif : lecture par flux plafonnée via `readEntry` d'`@forgeoffice/opc` (désormais exporté), plafond par entrée `MAX_IMAGE_BYTES`, budget total `MAX_ZIP_BYTES` (512 Mio) ; une entrée trop grosse est ignorée (comportement inchangé), un budget total dépassé lève une erreur.
- Test : `publisher/tests/mergeimages.test.ts` (ZIP piégé 31 Mio de zéros, < 1 Mio compressé : ignoré, les autres images restent). Ce test vérifie le résultat ; le plafonnement par flux est celui, déjà testé, d'OPC.

### MOYENNE-2 — Lien de diaporama non filtré à l'ouverture (`file:`, `smb:`, `ms-*:`)
- `packages/powerpoint/src/app/App.tsx` (mode lecture, `onOpenUrl` qui appelait `window.open(url…)` sans filtre) et `link-menu.ts` (« Ouvrir le lien »).
- Problème : l'import PPTX ne bloque que `javascript:`/`data:`/`vbscript:` ; un lien `file:///…`, `smb://…` ou `ms-msdt:` cliqué en mode lecture était ouvert tel quel hors de l'application.
- Correctif : `packages/powerpoint/src/app/safe-open.ts` (`isOpenableUrl`, `openExternal` : `http(s):` et `mailto:` seulement, caractères de contrôle ignorés), utilisé aux trois endroits ; `noreferrer` ajouté.
- Test : `packages/powerpoint/tests/safe-open.test.ts`.

### MOYENNE-3 — Suppression d'un fichier `.bak` de l'utilisateur à l'enregistrement (intégrité)
- `apps/desktop/src-tauri/src/atomic.rs` (`write_atomic`, ancienne l. 37-39).
- Problème : la sauvegarde temporaire s'appelait `<nom>.bak` et un éventuel `<nom>.bak` existant était supprimé avant chaque enregistrement : perte silencieuse d'une copie de l'utilisateur (ou d'un fichier d'une autre appli) à côté du document.
- Correctif : sauvegarde temporaire cachée au nom unique `.<nom>.<jeton>.bak` ; aucun fichier voisin n'est touché.
- Test : `le_fichier_bak_de_l_utilisateur_n_est_jamais_supprime` (remplace l'ancien test qui consacrait la suppression).

### FAIBLE-1 — Noms réservés Windows dans l'explorateur de dossier
- `apps/desktop/src-tauri/src/folder_cmds.rs` (`clean_rel`).
- Problème : `NUL.txt`, `CON`, `COM1`, noms finissant par un point ou une espace étaient acceptés comme segments relatifs ; sous Windows ils désignent un périphérique ou un autre fichier que celui demandé (jamais hors de la racine, mais comportement imprévu).
- Correctif : `windows_unsafe` appliqué **sous Windows seulement** (les autres systèmes gardent ces noms valides).
- Test : `noms_windows_dangereux_reconnus`.

## Reste (non corrigé, avec raison)

| Niveau | Où | Constat | Pourquoi pas corrigé |
|---|---|---|---|
| FAIBLE | `gen/android/.../ForgePlugin.kt` (`importUri`, intent `VIEW` `file:`) | Une autre appli peut envoyer `file:///data/data/<paquet>/…` : l'appli copie ce fichier privé dans sa bibliothèque et l'ouvre (lecture visible seulement de l'utilisateur, pas d'exfiltration directe). Correctif prévu : refuser un `file:` dont le chemin canonique est sous `applicationInfo.dataDir`. | CORRIGÉ (PathGuard.kt, compilé et testé en JVM ; non essayé sur appareil). |
| FAIBLE | `Updater.kt` (`offer.name` du flux signé) | Nom d'APK du flux (signé minisign, donc de confiance) utilisé dans un chemin et une URL sans contrôle de séparateur. Défense en profondeur : exiger `name == File(name).name`. | CORRIGÉ (`isSafeFileName` dans `check()` et `download()`, testé). |
| FAIBLE | `packages/pptx/src/dml-read.ts` (`safeUrl`) | Liste noire de schémas à l'import (les liens `file:` etc. restent dans le modèle). Toutes les ouvertures sont désormais filtrées par liste blanche ; passer l'import en liste blanche changerait le contenu conservé à l'enregistrement. | Changement de comportement. |
| FAIBLE | Fenêtres Tauri | Pas de garde `on_navigation` (navigation de la fenêtre vers une URL externe). Une page distante ne reçoit aucune capacité IPC (capacités liées aux fenêtres locales `fo-*`), et aucun lien interne ne navigue. | Non testable sans interface ; risque de régression (serveur de dev, impression). |
| FAIBLE | `cargo audit` | 10 avertissements « unmaintained/unsound » transitifs (stack gtk/zbus de Tauri). | Dépend de Tauri en amont. |
| INFO | `convert_run` (forge-convert) | Outils externes (OCR, PDF/A) résolus dans le `PATH` ; décompression d'archives en mémoire plafonnée à 512 Mio. | Comportement documenté et borné. |

## Vérifications (preuves)

- `npx tsc -b` : propre ; `npm test` : 2100 tests, 0 échec ; `cargo test --lib` (`CARGO_PROFILE_RELEASE_LTO=off`) : 65 réussis, 0 avertissement.
- E2E navigateur non relancés : les trois corrections TS ne touchent que le chemin de lecture du ZIP d'images, l'ouverture de liens et un module pur ; aucune interface modifiée.
