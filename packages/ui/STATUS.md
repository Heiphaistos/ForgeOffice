# packages/ui : état (2026-11-04)

Système de design Office 2024 / Fluent 2 de ForgeOffice, plus l'accueil (`packages/hub`) et le banc `apps/web`.

## Fait et vérifié

- `npx tsc -p tsconfig.json --noEmit` : 0 erreur (tout le dépôt au 2026-11-04).
- `node --test packages/ui/tests/*.test.ts packages/hub/tests/*.test.ts apps/web/tests/*.test.ts` : 21 tests, 21 réussis.
- Rendu regardé dans Chrome (banc `?app=hub` et `?app=demo`, port 5301), captures dans `docs/captures/` :
  `ui-accueil.png`, `ui-accueil-sombre.png`, `ui-accueil-ouvrir.png`, `ui-accueil-options.png`, `ui-accueil-depot.png`,
  `ui-accueil-mobile.png`, `ui-ruban.png`, `ui-sombre.png`, `ui-contraste.png`, `ui-backstage.png`, `ui-dialogue.png`,
  `ui-ruban-etroit.png`, `ui-ruban-mobile.png`.
- Parcours exercés dans le navigateur : épingler un récent, onglets Récent/Épinglé, page Ouvrir (regroupement par date),
  modèle « Budget mensuel » -> Tableur, recherche Alt+Q « classeur » + Entrée -> Tableur, dépôt `notes.md` -> Bloc-notes,
  dépôt `virus.exe` refusé (notification), Options -> thème Noir appliqué et enregistré.

## Contenu

| Élément | Fichier |
|---|---|
| Jetons (clair, sombre, contraste élevé, forced-colors, accent par `data-app` pour les 9 AppId) | `src/tokens.css`, `src/theme.ts` |
| 302 icônes Fluent (20/24, regular/filled) générées depuis `icons.json` | `scripts/extract-icons.mjs`, `src/icons/` |
| Barre de titre : carré d'application, Enregistrement automatique, barre d'accès rapide personnalisable, nom du document + état (centré à côté de la recherche), recherche de commandes Alt+Q, boutons de fenêtre, `data-tauri-drag-region` ; sans document, affiche le nom de l'application | `components/TitleBar.tsx` |
| Ruban déclaratif : onglets contextuels, réduction (Ctrl+F1, double-clic), réduction adaptative, Info-touches, ruban simplifié < 720 px, tous les contrôles | `components/ribbon/` |
| Backstage, barre d'état (vues, zoom 10-500 %), dialogue déplaçable, menu contextuel, info-bulle riche, notifications, volet latéral, onglets de document, sélecteurs de couleur et de police, liste de fichiers, contrôles de base | `components/` |
| Logique sans DOM testée : couleurs, zoom, polices, Info-touches, ajustement, recherche de commandes, dates | `src/logic/` |

`packages/hub` : accueil Office 2024 (rail Accueil/Nouveau/Ouvrir + 8 applications + Options, « Bonjour/Bonsoir », vignettes vierges
de 6 applications + 5 modèles réels (HTML, CSV, Markdown ouverts par `services.openDocument`), Récent/Épinglé avec recherche,
menu contextuel, glisser-déposer (512 Mo max, formats contrôlés), Ctrl+O / Ctrl+N, Options (thème, effacer les récents,
mise à jour si `services.updater`, à propos), disposition mobile avec rail en bas).

## Reste à faire

- Les modèles Présentation, Publication et Base de données attendent un format texte ouvrable ou un contrat `template` dans `@forgeoffice/core`.
- Rouvrir un récent dans le navigateur est impossible (pas de chemin) : l'accueil le signale ; sur bureau, `services.readFile`.
- Contraste élevé : l'aperçu sélectionné de la galerie de styles reste peu lisible (texte jaune sur cyan).
- Les captures de `claude-in-chrome` ont été instables (délais de capture) : les PNG finaux viennent d'un Chromium sans interface piloté en CDP sur le même banc.

## Polices embarquées (2026-11-04)

- `fonts/` : Carlito 1.104, Liberation 2.1.5 (Sans/Serif/Mono), Selawik 1.01 (Light/Semilight/Regular/Semibold/Bold, sans italique) + `OFL-*.txt` : 7,3 Mo, SIL OFL 1.1. Récupération : `node scripts/fetch-fonts.mjs` (idempotent, SHA-256 vérifié ; Liberation et Carlito repris de `ForgeOffice-etude/scripts/prepare-fonts.sh`, Selawik : empreintes du premier téléchargement, qui fait foi). Les `.ttf` sont commités.
- `src/fonts.css` (importé par `index.ts`) : alias Calibri/Aptos/Aptos Display -> Carlito, Arial -> Liberation Sans, Times New Roman -> Liberation Serif, Courier New -> Liberation Mono, Segoe UI/Segoe UI Variable Text/Display -> Selawik ; `local()` en premier (les vraies polices Microsoft restent prioritaires : vérifié sur Windows, largeurs de Segoe UI Variable différentes de Selawik).
- `whenFontsReady(families?, timeoutMs?)` exporté : attend `document.fonts.ready` et charge les familles demandées (normal + gras), 3 s max, ne rejette jamais.
- `tokens.css` : Selawik avant `system-ui` ; `FontPicker` / `listSystemFonts` ajoutent `EMBEDDED_FONTS` et `ALIASED_FONTS`.
- Pas d'italique Selawik/Segoe UI : le navigateur incline (aussi sur Windows, où l'italique réel de Segoe UI n'est donc pas utilisé).

### À brancher dans les modules (non modifiés ici : hors de `packages/ui`)

Aucun ne mesure après chargement des polices ; une police `@font-face` ne se charge qu'à son premier usage, donc la première mesure se fait avec la police de repli.
- Texte : `packages/word/src/App.tsx:114` (`paginateNow`, `measureFlow` ligne 124) et `packages/word/src/layout/measure.ts` : relancer la pagination après `await whenFontsReady([familles du document])`.
- Tableur : `packages/excel/src/App.tsx:57` (`measure`, canvas) -> `packages/excel/src/ui/actions.ts:98` (ajustement des colonnes) et `packages/excel/src/ui/paint.ts:243` (grille) : charger les familles avant, redessiner après.
- Publication : `packages/publisher/src/app/measure.ts:20` (`createMeasure`) met les largeurs en cache par police : une mesure faite avant chargement reste fausse ; vider le cache après `whenFontsReady`.
- Présentation et Publication attendent déjà `document.fonts.ready` à l'export seulement (`powerpoint/src/app/raster.ts:57`, `publisher/src/app/export.ts:132`).

## Couche tactile (2026-11-04, branche feat/mobile-ui)

- `src/logic/touch.ts` (sans DOM, 10 tests dans `tests/touch.test.ts`) : mode d'appareil, ruban selon le mode, appui long, balayage, poignées de 44 px, bascule sélection/défilement, clavier virtuel, repli d'une barre d'outils, pincement.
- `src/touch.ts` : `installTouchSupport()` (appelé par la coquille `apps/web/src/Shell.tsx`), `useDeviceMode()`, `useTouchEditing(scope)`, `insertTextAtCaret()`.
- `src/touch.css` : cibles de 44 px, zones sûres, `100dvh` / `--fo-vvh`, pas de sélection ni de zoom parasites ; `src/components/KeyboardBar.tsx` : barre au-dessus du clavier.
- Détail par module et limites : `docs/MOBILE-UI.md`.

## Mobile complet (2026-11-05, branche feat/mobile2)

- Ruban mobile : `components/ribbon/MobileBand.tsx` (bande de l'onglet actif : tous les groupes, toutes les commandes, calage par groupe, ombres, curseur de position, étiquettes, cibles de 44 px ; tablette : bande à la ligne), `logic/mobileRibbon.ts` (aplatissement, groupes, `ribbonSchema`, calage, ombres, sections de la feuille de commandes ; 7 tests dans `tests/mobileRibbon.test.ts`), `mobile.css`.
- Feuilles du bas (téléphone) : tout `Menu` / `Popover` / menu contextuel par CSS (`mobile.css`) + voile (`.fo-sheet-scrim`) + bouton Retour des sous-menus ; `Menu` prend le focus APRÈS placement et ferme sur Échap en capture (touche Retour d'Android) ; champ de liste modifiable (`ComboBox`) : un toucher ouvre la liste sur téléphone.
- `Dialog` : plein écran sur téléphone, en-tête Retour / titre / OK.
- `CommandSheet` : bouton loupe « Toutes les commandes » (recherche + toutes les commandes du ruban) dans la rangée d'onglets sur téléphone et tablette.
- `KeyboardBar` : `items` (menu en feuille du bas), `swatch`, bouton « Fermer le clavier », `itemsFromTab(tab, ids)` (barre construite depuis le ruban : mêmes fonctions que les boutons), `colorMenuItems`, `alwaysVisible` limité aux appareils tactiles ; `SelectionMiniToolbar` / `useSelectionMiniToolbar` (près de la sélection, `miniToolbarPosition` testé) ; `groupsToMenu(tab, groupIds?)` (menu contextuel complet depuis un onglet).
- Schéma exposé : `window.__FO_RIBBON__.schema()` avec `?e2e=1` (banc de test).
- Banc : `apps/web/tests/e2e/mobile-coverage.mjs` (689 commandes de 8 modules atteignables au doigt à 390x844 et 820x1180 ; toucher réel de chaque commande) et `mobile-acts.mjs` (Texte : centrer, justifier, gras, italique, souligné, taille, couleur, puces, annuler, menu contextuel : 16 vérifications). Détail : `docs/MOBILE-UI.md`.
