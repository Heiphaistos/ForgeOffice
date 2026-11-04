# packages/notes : état (2026-11-04)

Bloc-notes de ForgeOffice : réécriture complète de WinNote (D:\Projet\WinNote v0.6.0) sur CodeMirror 6. Exporte `{ info: MODULES.notes, App }`.
Inventaire fonction par fonction : `INVENTAIRE-WINNOTE.md` (101 fonctions : 90 livrées, 6 adaptées, 5 non livrées dont 3 sans objet).

## Fait et vérifié

- `node --test packages/notes/tests/*.test.ts` : 19 tests, 19 réussis (encodages et aller-retour d'octets pour 5 encodages × 3 fins de ligne,
  fins de ligne, binaire, ANSI avec perte, opérations sur les lignes, casse, date, liens [[ ]], rétroliens, lien sous le curseur, HTML d'aperçu,
  plan, statistiques, diff, raccourcis français/AZERTY, dossier, session (aller-retour, données hostiles, reprise multi-fenêtres), réglages, dispositions, CSS d'impression).
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

## Reste à faire

- « Toujours au premier plan » : option masquée tant que `WindowControls` n'a pas `setAlwaysOnTop` (contrat `@forgeoffice/core`).
- Pas de service pour « Afficher dans l'explorateur » ni pour la date de modification d'un fichier (détection de modification externe).
- Dossier ouvert : lu en mémoire via `<input webkitdirectory>` (pas de chemins) ; enregistrer un fichier du dossier passe par « Enregistrer sous ». Un contrat `openFolder` dans `@forgeoffice/core` permettrait d'écrire en place.
- Correcteur : la langue passe par l'attribut `lang` ; WebView2/Chrome utilisent les dictionnaires installés sur le système.
- En-tête/pied d'impression via `@page` (Chromium/WebView2) ; WebKitGTK (Linux) ne les affiche pas.
- Coquille (`apps/web/src/Shell.tsx`, hors périmètre) : à la navigation vers une autre application, l'ancien module est remonté un instant avec le fichier destiné à la nouvelle ; le Bloc-notes ignore désormais un fichier qui n'est pas pour lui.
- Non testé sur bureau Tauri ni sur imprimante réelle.
