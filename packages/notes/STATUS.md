# packages/notes : état (2026-11-13)

Bloc-notes de ForgeOffice : réécriture complète de WinNote (D:\Projet\WinNote v0.6.0) sur CodeMirror 6. Exporte `{ info: MODULES.notes, App }`.
Inventaire fonction par fonction : `INVENTAIRE-WINNOTE.md` (101 fonctions : 90 livrées, 6 adaptées, 5 non livrées dont 3 sans objet).

## Fait et vérifié

- `node --test packages/notes/tests/*.test.ts` : 89 tests au total depuis le portage 0.7.0 (voir plus bas) ; lot initial : 25 tests (encodages et aller-retour d'octets pour 5 encodages × 3 fins de ligne,
  fins de ligne, binaire, ANSI avec perte, opérations sur les lignes, casse, date, liens [[ ]], rétroliens, lien sous le curseur, HTML d'aperçu,
  plan, statistiques, diff, raccourcis français/AZERTY, dossier, session (aller-retour, données hostiles, reprise multi-fenêtres), réglages, dispositions, CSS d'impression ;
  `tests/files.test.ts` : enregistrer puis rouvrir pour 5 encodages × fins de ligne, ré-enregistrement au même chemin, modification externe (rechargement, conflit, fichier supprimé, navigateur), ligatures, commandes « Afficher dans l'explorateur » grisée et « Effacer les récents »).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur dans `packages/notes`.
- Banc `apps/web` port 5315, Edge sans interface piloté en CDP, captures regardées : `docs/captures/bloc-notes-office.png` (thème Office + plan),
  `bloc-notes-sombre.png` (Tokyo Night + liens entrants), `bloc-notes-code.png` (Dracula, JavaScript), `bloc-notes-apercu.png` (aperçu Markdown),
  `bloc-notes-palette.png` (Ctrl+Maj+P), `bloc-notes-menus.png` (menus classiques, Apple Notes clair), `bloc-notes-recherche.png` (barre Rechercher/Remplacer),
  `bloc-notes-comparaison.png` (diff de deux onglets).
- Parcours exercés dans le navigateur : saisie, Ctrl+D (dupliquer), « Supprimer les doublons », « Trier A → Z », session écrite puis rechargement de la page
  (4 onglets et texte non enregistré restaurés), signets (Ctrl+F2, F2), Ctrl+clic sur [[Idées]] (bascule sur l'onglet), Statistiques, palette → Comparer,
  conversion .docx (ouvre Texte), Backstage Fichier.

## Architecture

| Fichier | Rôle |
|---|---|
| `src/logic/*.ts` | Logique sans DOM testée : encodage/fins de ligne (réutilise `@forgeoffice/docx`), lignes, liens, plan, session, réglages, thèmes, diff, raccourcis, dossier, impression |
| `src/workspace.ts` | Documents hors React : onglets, états CodeMirror, vue scindée synchronisée, ouvrir/enregistrer/recharger, session |
| `src/editor/` | Extensions CodeMirror (compartiments), signets et liens cliquables, langages (language-data + modes WinNote manquants), actions |
| `src/commands.ts` | Registre unique des commandes (ruban, menus, palette, raccourcis) |
| `src/ribbon.ts`, `src/ui/*` | Ruban, menus classiques, onglets, palette, volet latéral, aperçu, barre d'état, dialogues, Backstage |
| `src/NotesApp.tsx` | Assemblage, raccourcis clavier, thème de fenêtre, session |

## Résidus 1 (2026-11-05)

- Effacer la liste des récents (#5) : menu Fichier > Fichiers récents, bouton Backstage > Ouvrir, palette (`services.clearRecent`).
- Ligatures de la police (#53, adapté de « rendu DirectWrite ») : préférence `ligatures` (Police…, Affichage, palette), variable CSS `--nt-liga`.
- Modification externe (#93, adapté) : `Workspace.checkExternal` relit le fichier au retour de focus (bureau seulement) et compare l'empreinte (`logic/disk.ts`) ;
  onglet propre = rechargé + avis, onglet modifié = avis seul (un par changement), fichier supprimé = rien. Limite : une relecture complète par retour de focus (1 s d'écart minimum) ;
  un fichier modifié pendant que l'application est fermée n'est pas vu pour un onglet restauré avec son texte (première empreinte prise au premier contrôle).
- « Afficher dans l'explorateur » (#12) : commande `reveal` présente (menu Fichier, ruban Outils > Fichier, menu de l'onglet), grisée, info-bulle « Bientôt disponible ».
- Tactile : bouton « Commandes » (palette) à droite de la barre d'onglets en pointeur grossier ou largeur ≤ 720 px ; palette à lignes de 44 px, champ 44 px en 16 px, liste défilante, hauteur bornée à la fenêtre visuelle.
- Impression : relue (feuille `@page` + `.nt-print-root` seul affiché sous `@media print`, nettoyage `afterprint`), rien à corriger ; non essayée sur imprimante.
- Enregistrer puis rouvrir : prouvé par test sur `Workspace` avec un faux `Services` (5 encodages, 3 fins de ligne). Dans le navigateur, `saveFile` télécharge (pas de chemin) : chaque « Enregistrer » redemande un nom.

## API à ajouter au contrat `@forgeoffice/core` (non faite : hors périmètre du lot)

```ts
// Services : métadonnées d'un fichier sans le relire en entier (détection de modification externe, #93).
fileInfo(path: string): Promise<{ modifiedAt: number; size: number } | null>; // ms depuis l'époque ; null si absent
// Services : montre le fichier dans l'explorateur du système (#12). Bureau seulement ; no-op ou absent dans le navigateur.
revealInFolder?(path: string): Promise<void>;
// WindowControls : « Toujours au premier plan » (#66).
setAlwaysOnTop?(on: boolean): Promise<void>;
```

Côté coquille Tauri : `fileInfo` = `std::fs::metadata` (mtime en ms) ; `revealInFolder` = `explorer /select,<chemin>` (Windows), `open -R` (macOS), `xdg-open <dossier parent>` (Linux), chemin validé (fichier existant, pas d'argument libre).
Quand `fileInfo` existe : `checkExternal` compare d'abord `modifiedAt`/`size` (relecture seulement si différent) ; quand `revealInFolder` existe : passer `reveal` de grisé à actif (`disabled: !h.canReveal`, `run: () => services.revealInFolder(tab.path)`).

## Portage de WinNote 0.7.0 (2026-11-13, branche `notes-winnote07`, non publié)

Source : `D:\Projet\WinNote` (commits 615be52..7c5f7ae, `analyse-rea/ECARTS.md` « État 0.7.0 »). Tout passe par le registre `src/commands.ts` (ruban, menus classiques, palette) ; textes en français.
`node --test packages/notes/tests/*.test.ts` : **89 tests, 89 réussis** ; `npx tsc -p tsconfig.json --noEmit` : 0 erreur. Parcours réels dans le banc (Chromium sans interface piloté en CDP, port 5315 ; dossier de test dans l'OPFS du navigateur) : 26 contrôles OK, captures regardées (rubans Édition/Affichage/Outils, menu Format, palettes, panneau Rechercher, dialogue des raccourcis, explorateur et son menu, guides/fins de ligne/marge de modifications).

| Fonction | Commande(s) / où | Test |
|---|---|---|
| Rechercher : mode étendu (`\n \r \t \0 \\ \xNN`), dans la sélection | panneau Rechercher (liste de modes, case « Dans la sélection ») ; `src/logic/find.ts`, `buildQuery` | `find.test.ts` |
| Rechercher : historique ↑/↓ (30 entrées, gardé dans `notes.findHistory`) | champ « Rechercher » du panneau | `find.test.ts` |
| Rechercher : « Tous les onglets » (remplace dans tous les onglets modifiables, avis « N remplacements dans M onglets ») | bouton du panneau ; `Workspace.replaceInAllTabs`, `editor/replace.ts` | `find.test.ts` |
| Rechargement auto d'un fichier modifié ailleurs (contrôle toutes les 1,5 s sur le bureau, onglet actif + onglets suivis ; contrôle aussi à l'activation d'un onglet) | `autoReload` (réglage, coché par défaut), `Workspace.pollExternal` | `reload.test.ts` |
| Mode « suivre » (tail) : relit, va à la fin, sans avis ; coupé si l'onglet est modifié | `follow` (Outils > Surveillance, menu Fichier) | `reload.test.ts` |
| Explorateur : nouveau fichier, nouveau dossier, renommer, dupliquer, déplacer, supprimer, actualiser ; Ctrl+S écrit à sa place | commandes `newFile` `newDir` `renameEntry` `duplicateEntry` `moveEntry` `deleteEntry` `refreshFolder`, boutons et clic droit de l'explorateur, F2 / Suppr ; `src/folderops.ts`, `src/folderfs.ts` | `folderops.test.ts` (faux dossier mémoire) + banc OPFS |
| 19 encodages (Unicode, Windows-1250..1258, Latin-9, KOI8-R, Shift-JIS, GBK, Big5, EUC-KR) | `src/logic/charsets.ts` ; menu Format > Encodage, palette, barre d'état | `encodings.test.ts` |
| « Recharger avec l'encodage » (relit le disque, ou réinterprète le texte si l'onglet est modifié) | `reloadEncoding`, menu Format | `encodings.test.ts` |
| Avertissement avant enregistrement avec perte (Enregistrer en UTF-8 / quand même / annuler) | `Workspace.confirmLossy`, `LossyDialog` | `encodings.test.ts` |
| Autocomplétion des mots : code seulement (pas en texte brut), dès 3 lettres, Ctrl+Espace à la demande | `autoComplete` (réglage), `wantsCompletion` | `settings.test.ts` + banc |
| Indentation par langage : automatique / 2 / 4 / 8 espaces / tabulations ; Tab = espaces jusqu'au taquet | `indent:auto` `indent:2`… (menu Format, ruban Texte > Tabulations) ; `src/logic/indent.ts` | `settings.test.ts` + banc |
| Raccourcis personnalisables (texte `Ctrl+Maj+K = nom de la commande`, format de `raccourcis.txt` de WinNote) | `keymap` (Format, Outils > Naviguer) ; `src/logic/keymap.ts`, clé `notes.keymap` | `settings.test.ts` + banc |
| Macros : enregistrer (F9), rejouer (F10), N fois (0 = jusqu'à la fin), jusqu'à la fin ; gardée entre deux sessions | `macroRecord` `macroPlay` `macroPlayTimes` `macroToEnd` ; `src/editor/macros.ts` | `editing.test.ts` + banc |
| Insertion en colonne `{n}` / `{n:départ,pas}` | `columnInsert` (Alt+C) | `editing.test.ts` + banc |
| Opérations de lignes : tri par longueur, tri numérique, inverser, mélanger, suppr. lignes vides, suppr. espaces de tête, suppr. doublons consécutifs | déjà livrées avant ce lot (`lines.test.ts`) | `lines.test.ts` |
| Guides d'indentation, fins de ligne visibles (CRLF/LF/CR), historique des modifications en marge (orange = non enregistré, vert = enregistré) | `guides` `eolMarks` `changeHistory` (Affichage) ; `src/editor/visual.ts` | `editing.test.ts` + banc |
| Surlignage des occurrences du texte sélectionné | `smart` (réglage, coché par défaut) ; `highlightSelectionMatches` était déjà actif, il est maintenant réglable | `editing.test.ts` |
| Note du jour (`AAAA-MM-JJ.md`, modèle `modele-quotidien.md` du dossier ouvert, `{{date}}`) | `dailyNote` ; `src/logic/daily.ts` | `editing.test.ts` |
| Fermer les onglets à droite (commande ajoutée au registre ; gauche / non modifiés / autres existaient) | `closeRight` | `editing.test.ts` |
| Commentaire de bloc (selon le langage ; la ligne si rien n'est sélectionné) | `blockComment` (Alt+Maj+A) | banc |
| Copier le nom / le dossier du fichier | `copyName` `copyDir` | `editing.test.ts` |

| Palette #tags (liste triée des étiquettes des onglets texte et du dossier, hors blocs de code ; saut à la ligne) | `tags` ; `src/logic/tags.ts` | `tags.test.ts` |
| Onglet épinglé : Ctrl+W / Suppr / menu de l'onglet ne le ferment pas (déjà : groupe à gauche, fermetures groupées l'épargnent) | `close` grisée | `tabs.test.ts` |

### Limites et écarts avec WinNote 0.7.0

- Explorateur : l'écriture exige l'API « File System Access » (Chrome, Edge, WebView2). Sans elle (ou si le dossier est ouvert par l'ancien sélecteur), les 7 commandes sont grisées avec l'info-bulle « Disponible quand le dossier est ouvert avec l'accès en écriture… » et le dossier reste consultable en lecture seule. « Supprimer » range dans le dossier `.trash` du dossier ouvert (corbeille du dossier, masquée de l'explorateur), pas dans la corbeille du système : la coquille n'offre pas d'API corbeille. Non testé sur la coquille Tauri.
- Rechargement auto : pas de date de fichier dans `Services` (voir `fileInfo` plus haut) : chaque contrôle relit tout le fichier ; ignoré au-delà de 8 millions de caractères (le retour dans la fenêtre contrôle encore). Le mode « suivre » n'est pas gardé dans la session et demande un fichier enregistré (bureau).
- Macros : enregistrent les frappes, suppressions et déplacements du curseur au clavier (relatifs au curseur) ; ignorées : clics de souris, commandes qui touchent plusieurs lignes à la fois (déplacer la ligne, tri…), plusieurs curseurs. « Jusqu'à la fin » s'arrête quand le curseur ne descend plus.
- Encodages : la détection automatique reste UTF-8/UTF-16/ANSI (comme avant) ; les autres se choisissent à la main (« Recharger avec l'encodage »), et le choix est gardé aux rechargements suivants.
- Indentation : l'automatique suit une table de langages (2 espaces pour JavaScript/JSON/YAML/HTML/CSS/Markdown…, 4 pour Python/Rust/C…, tabulations pour Go/Makefile et le texte brut) ; elle remplace la largeur de tabulation du réglage Police… pour les langages connus.
- Historique des modifications : repère les lignes touchées depuis l'ouverture ; ne revient pas au gris quand on annule (WinNote/Scintilla le fait).
- Guides d'indentation : lignes vides sans guide ; largeur calculée en caractères (exacte en police à chasse fixe).
- Raccourcis : un raccourci personnalisé retire le même raccourci aux autres commandes ; Ctrl ou Alt (ou F1-F24) requis.
- Non porté (hors liste de la mission) : #tags, propriétés YAML, favoris, liste des fonctions, enregistrer une copie, recherche incrémentale, Markdown « en direct » de WinNote 0.6.1 (le Bloc-notes garde son aperçu et la coloration CodeMirror).

## Curseur (retour du propriétaire, 2026-11-05)

Point d'insertion : épaisseur 1/2/3 px (2 par défaut), couleur automatique (contraste avec le thème), accent, noir ou blanc, clignotement réglable,
dans Police… ; `caretColor`/`parseCaret` partagés avec Texte (`packages/ui/src/logic/caret.ts`). Vérifié dans le banc : barre de 2 px au
bout du texte (capture regardée).

## Reste à faire

- « Toujours au premier plan » : option masquée tant que `WindowControls` n'a pas `setAlwaysOnTop` (contrat `@forgeoffice/core`).
- Dossier ouvert : lu en mémoire via `<input webkitdirectory>` (pas de chemins) ; enregistrer un fichier du dossier passe par « Enregistrer sous ». Un contrat `openFolder` dans `@forgeoffice/core` permettrait d'écrire en place.
- Correcteur : la langue passe par l'attribut `lang` ; WebView2/Chrome utilisent les dictionnaires installés sur le système.
- En-tête/pied d'impression via `@page` (Chromium/WebView2) ; WebKitGTK (Linux) ne les affiche pas.
- Coquille (`apps/web/src/Shell.tsx`, hors périmètre) : à la navigation vers une autre application, l'ancien module est remonté un instant avec le fichier destiné à la nouvelle ; le Bloc-notes ignore désormais un fichier qui n'est pas pour lui.
- Non testé sur bureau Tauri ni sur imprimante réelle.
