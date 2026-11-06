# packages/notes : état (2026-11-05)

Bloc-notes de ForgeOffice : réécriture complète de WinNote (D:\Projet\WinNote v0.6.0) sur CodeMirror 6. Exporte `{ info: MODULES.notes, App }`.
Inventaire fonction par fonction : `INVENTAIRE-WINNOTE.md` (101 fonctions : 90 livrées, 6 adaptées, 5 non livrées dont 3 sans objet).

## Fait et vérifié

- `node --test packages/notes/tests/*.test.ts` : 25 tests, 25 réussis (encodages et aller-retour d'octets pour 5 encodages × 3 fins de ligne,
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
