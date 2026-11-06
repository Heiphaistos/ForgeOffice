# packages/powerpoint : état (2026-11-05, version 0.3.0)

Application **Présentation** (équivalent PowerPoint 2024) et **éditeur de page réutilisable** (`src/canvas/`), destiné aussi au module Publication.
Exporte `{ info: MODULES.powerpoint, App }` depuis `src/index.ts`, ainsi que `canvas` (espace de noms). Le chemin `@forgeoffice/powerpoint/canvas` donne l'éditeur seul, sans l'application.

## Fait et prouvé

- `npx tsc -p packages/powerpoint/tsconfig.json --noEmit` : 0 erreur.
- `node --test packages/powerpoint/tests/*.test.ts` : 50 tests verts.
  - canvas-math : rotation, test de clic, redimensionnement avec rotation (coin opposé fixe), retournement, rotation par la poignée, magnétisme, espacement égal, alignement, distribution, zoom ajusté.
  - canvas-ops : ordre, groupement et dissociation, repères de groupe (échelle, rotation, miroir), alignement, distribution, duplication.
  - canvas-text : insertion, suppression, coupure de paragraphe, mise en forme, casse, mots, copier-coller riche.
  - geometry (187 formes ECMA-376) et chart (tous les types de graphiques).
  - app-logic : étapes d'animation, déclencheurs, trajectoires, transitions, tableau (lignes, colonnes, fusion, fractionnement), sections, en-tête et pied, thèmes, Concepteur.
- Tests dans le navigateur (banc `apps/web`, port 5313), avec Edge sans interface et de vrais clics et frappes clavier envoyés par CDP. Parcours vérifiés :
  - saisie du titre et des puces (Entrée, Échap) ;
  - nouvelle diapositive choisie dans la galerie ;
  - thème Horizon ;
  - graphique inséré à la place d'un espace réservé ;
  - notes ;
  - transition Pousser ;
  - formes tracées et texte saisi dedans ;
  - icône Fluent ;
  - trait au stylet rouge ;
  - sélection au lasso et animation Fondu ;
  - tableau 3 × 4 et saisie dans les cellules avec Tab ;
  - annuler et rétablir ;
  - Concepteur ;
  - masque des diapositives ;
  - aperçu avant impression ;
  - export PDF ;
  - Trieuse ;
  - diaporama (Maj+F5, flèche droite) ;
  - mode Présentateur (Alt+F5) ;
  - Ctrl+S.
- Ouverture dans PowerPoint, via COM (`Quit()` dans un `finally`, aucun processus restant ensuite) :
  - le .pptx enregistré depuis le banc avec Ctrl+S s'ouvre sans réparation ;
  - on y retrouve :
    - les dispositions (Diapositive de titre, Deux contenus, Titre seul, Titre et contenu) ;
    - la transition, les 5 animations, le graphique et le tableau ;
    - l'icône, reconnue comme graphique SVG (type 28) ;
    - l'encre, reconnue comme forme libre ;
  - le rendu exporté par PowerPoint est identique à celui de l'éditeur.
- Captures, regardées et comparées à PowerPoint 2024, dans `docs/captures/` :
  - `presentation-edition.png` ;
  - `presentation-dispositions.png` (galerie des 11 dispositions) ;
  - `presentation-diaporama.png` ;
  - `presentation-presentateur.png` ;
  - `presentation-trieuse.png` ;
  - `presentation-concepteur.png` ;
  - `presentation-backstage.png`.

## Fonctions livrées

### Interface générale

- **Volet des miniatures** :
  - glisser-déposer pour réordonner ;
  - sélection multiple avec Ctrl et Maj ;
  - sections : ajouter, renommer, supprimer (avec ou sans les diapositives), monter, descendre, réduire ;
  - menu contextuel ;
  - icônes de transition, d'animation et de commentaire ;
  - diapositives masquées.
- **Zone d'édition** et **volet de notes** redimensionnable.
- **Modes d'affichage** : Plan, Trieuse, Page de commentaires, Lecture, Masque des diapositives (masque et dispositions modifiables, insertion et suppression de dispositions).

### Ruban

**Accueil**
- Presse-papiers :
  - formes et diapositives, copie riche interne ;
  - collage d'images et de texte venus du système ;
  - reproduction de la mise en forme.
- Diapositives : nouvelle diapositive avec galerie des dispositions, disposition, rétablir, section.
- Police : police, taille, agrandir et réduire, effacer, gras, italique, souligné, barré, ombre, espacement, casse, exposant, indice, surbrillance, couleur.
- Paragraphe : puces et numérotation, niveaux, interligne, alignements, colonnes, orientation du texte, alignement vertical.
- Dessin :
  - galerie de formes, Organiser (ordre, grouper, aligner, distribuer, faire pivoter, retourner, volet Sélection) ;
  - styles rapides (7 couleurs × 5 intensités) ;
  - remplissage, contour (couleur, épaisseur, tirets, flèches), effets (ombre, réflexion, lumière, bordures adoucies).
- Rechercher et remplacer.

**Insertion**
- Nouvelle diapositive, tableau (grille 10 × 8 ou boîte de dialogue), images.
- Formes : 187 formes prédéfinies.
- Icônes Fluent : SVG avec repli PNG, recherche.
- Graphique : 10 types.
- Lien (web ou diapositive), commentaire.
- Zone de texte, verticale ou non.
- En-tête et pied de page (date automatique ou fixe, numéro, pied, pas sur la diapositive de titre).
- WordArt (6 styles), date, numéro, symboles.
- Vidéo et audio incorporés.

**Dessin** : stylets noir, rouge et bleu, surligneur, gomme, couleur, épaisseur. L'encre est enregistrée comme forme libre.

**Création**
- 8 thèmes avec décor du masque, 4 variantes chacun.
- 17 palettes Office et 12 jeux de polices.
- Taille des diapositives : 13 formats ou taille libre, avec choix entre ajuster et agrandir.
- Mise en forme de l'arrière-plan : uni, dégradé ou image ; diapositive, partout ou masque.
- Concepteur : 3 à 6 propositions de mise en page, appliquées en un clic.

**Transitions**
- Galerie de 26 transitions, avec aperçu animé au survol et joué sur la diapositive.
- Options d'effet (directions).
- Son : aucun, arrêter le précédent, fichier.
- Durée, appliquer partout, passage manuel ou automatique.

**Animations**
- 28 effets : entrée, emphase, sortie, trajectoires.
- Options d'effet, ajouter une animation, volet Animation (ordre, suppression, lecture).
- Déclencheur sur clic d'une forme.
- Démarrer au clic, avec la précédente ou après la précédente ; durée, délai ; déplacer avant ou après.

**Diaporama** : depuis le début ou depuis la diapositive actuelle, mode Présentateur, masquer la diapositive, réglage « Utiliser le mode Présentateur ».

**Révision** : orthographe (correcteur natif pendant la saisie), vérificateur d'accessibilité (textes de remplacement manquants, titres manquants ou en double), commentaires (nouveau, réponses, résoudre, supprimer, précédent, suivant).

**Affichage** : modes, règle, quadrillage, repères (déplaçables, supprimés en les sortant de la page), aligner sur la grille, repères intelligents, notes, zoom, ajuster à la fenêtre, nuances de gris.

**Onglets contextuels**
- Format de la forme : formes, modifier la forme, styles, WordArt (remplissage, contour, effets du texte), texte de remplacement, Organiser, taille.
- Format de l'image : corrections, couleur, transparence, modifier, rétablir, styles d'images, bordure, effets, rogner (boîte de dialogue, à la forme, proportions), taille.
- Création de tableau : options, 19 styles, trame, bordures.
- Disposition (tableau) : insérer ou supprimer des lignes et colonnes, fusionner et fractionner, hauteur et largeur, uniformiser, alignements.
- Création de graphique : éléments (titre, étiquettes, quadrillage, légende), couleurs, modifier les données (feuille), modifier le type.

### Fichier (Backstage)

- Nouveau : vierge ou par thème. Ouvrir.
- Informations : propriétés, inspection.
- Enregistrer, et Enregistrer sous en pptx, pptm, potx, potm, ppsx ou ppsm.
- Imprimer :
  - diapositives, pages de commentaires, documents à 3 ou 6 diapositives par page ;
  - plages « 1-3, 5 », diapositives masquées.
- Exporter : PDF des diapositives ou des pages de commentaires, PNG, JPEG, diapositive courante, .ppsx.
- Options : nom d'auteur.

### Diaporama

- Plein écran.
- Clavier :
  - avancer : flèches, Espace, Entrée, Page suivante, N ;
  - reculer : P, Retour arrière ;
  - Début, Fin ; numéro + Entrée ;
  - B ou « . » pour l'écran noir, W ou « , » pour l'écran blanc ;
  - G pour voir toutes les diapositives ;
  - Échap pour quitter.
- Clic gauche pour avancer, clic droit pour reculer.
- Transitions, dont la Morphose (formes de même nom interpolées).
- Animations étape par étape, déclencheurs, liens et actions.
- Avance automatique, sons de transition, médias lisibles.
- Outils : stylet (Ctrl+P), surligneur (Ctrl+I), pointeur laser (Ctrl+L), effacer l'encre (E).
- Mode Présentateur : minuteur (pause, remise à zéro), heure, diapositive suivante, notes agrandissables.
- Mode Lecture dans la fenêtre.

### Raccourcis et fichiers

- Raccourcis :
  - Ctrl+S, Maj+Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+O, Ctrl+P, Ctrl+M, Ctrl+D ;
  - Ctrl+G pour grouper (et pour le gras en édition de texte), Ctrl+B, Ctrl+I, Ctrl+U ;
  - Ctrl+E, Ctrl+L, Ctrl+R, Ctrl+J ;
  - Ctrl+[ et Ctrl+], Ctrl+K, Ctrl+F, Ctrl+H, Ctrl+Maj+C et Ctrl+Maj+V ;
  - F5, Maj+F5, Alt+F5.
- Ouverture par `props.file` (pptx, pptm, potx, ppsx, odp, ppt) et enregistrement par `services.saveFile`.
- `services.setModified`, `services.addRecent`.
- Historique avec `History` de @forgeoffice/core, frappe fusionnée, 300 états. Seule la diapositive modifiée est clonée.
- Récupération après plantage : copie .pptx dans IndexedDB toutes les 30 s pendant les modifications ; un bandeau « Restaurer / Ignorer » apparaît au démarrage.

## API canvas (pour le module Publication)

Importer depuis `@forgeoffice/powerpoint/canvas` (ou `canvas` de `@forgeoffice/powerpoint`). Une **page** est une taille (points) et une liste de formes du modèle `@forgeoffice/pptx` (`Shape`). Unités : points, degrés dans le sens horaire. Aucune notion de diapositive n'est nécessaire.

### Rendu

- `PageView` : page en lecture seule, mémorisée.
  - Props : `{ width, height, background: Fill, ctx: PageContext, shapes, underlay?: PageLayer[], uid, scale?, hidden?: Set<id>, interactive?, className?, style? }`.
  - 1 px CSS = 1 pt ; `scale` agrandit le tout.
  - Rend les formes prédéfinies et libres, les images (recadrage, effets), les tableaux (styles Office), les graphiques, les médias, les groupes, le SmartArt et les objets en repli, le texte (puces, numérotation, champs, colonnes, texte vertical, ajustement automatique), les effets et les flèches.
  - Chaque forme porte `data-shape-id`.
- `PageContext` : `{ theme, colorMap, resolve(shape), media(id), prompt?(shape), fields }`.
  - `deckPageContext(deck, owner, { slideNumber?, prompts? })` construit ce contexte pour une diapositive, une disposition ou un masque.
  - `deckPageBackground(deck, owner)` donne l'arrière-plan effectif.
  - Hors présentation, on fournit son propre `resolve` (identité) et `media`.
- `ShapeView`, `TextBlock`, `fillPaint`, `strokeOf`, `effectsCss`, `backgroundCss`, `runStyle` : rendus unitaires.

### `CanvasEditor`

Éditeur interactif, contrôlé par l'hôte.

```ts
<CanvasEditor
  width height background ctx shapes underlay? uid
  zoom onZoomChange?                     // %, 100 = 96 ppp ; Ctrl+molette
  selection onSelectionChange            // CanvasSelection { ids, text?: { shapeId, cell?, range }, cells? }
  onEdit                                 // (recipe: (draftShapes: Shape[]) => void, group?: string) => void, EXECUTION SYNCHRONE
  tool? onCreate?                        // CanvasTool : select | shape{preset} | textbox | ink | eraser | place
  options?                               // { grid, snapToGrid, smartGuides, guidesX, guidesY, onGuidesChange, rulers }
  onContextMenu? onShapeDoubleClick? locked? className?
/>
```

L'hôte applique la recette à une copie des formes de la page puis enregistre l'historique. `group` fusionne les modifications successives (frappe, déplacement…). L'éditeur recale tout seul les connecteurs reliés après chaque modification.

L'éditeur prend en charge :
- la sélection : clic, Maj, lasso, groupe puis enfant au second clic ou au double-clic, Tab pour passer à la forme suivante ;
- le déplacement : Maj contraint à un axe, Ctrl+glisser duplique, Alt désactive le magnétisme ;
- les poignées de taille, qui tiennent compte de la rotation : Maj garde les proportions (images par défaut), Ctrl redimensionne depuis le centre, et dépasser le côté opposé retourne la forme ;
- la rotation (Maj : pas de 15°) et les poignées jaunes d'ajustement des formes prédéfinies ;
- les extrémités de ligne, accrochées aux sites de connexion des formes ;
- les repères intelligents (bords et centres des formes et de la page, espacement égal), la grille, les repères de dessin et les règles ;
- le tracé des formes, des zones de texte (clic ou cadre) et de l'encre, ainsi que la gomme ;
- l'édition du texte en place :
  - saisie et suppression par `beforeinput`, touches mortes et IME ;
  - Entrée, Maj+Entrée, Tab et Maj+Tab pour le niveau, ou la cellule suivante dans un tableau (ajout de ligne en fin de tableau) ;
  - copier-coller riche, double-clic sur un mot, frappe directe sur une forme sélectionnée ;
  - ajustement automatique de la forme au texte ;
- le clavier : flèches (Ctrl pour un pas fin), Alt+flèches pour la rotation, Suppr, Échap, Entrée ou F2, Ctrl+A, Ctrl+D, Ctrl+G, Ctrl+Maj+G.

`editorItems(shapes, ctx)` renvoie les formes effectives à plat avec leur boîte dans la page.

### Logique sans DOM (testée)

- `math.ts` : `Box`, `rotatePoint`, `boundsOf`, `hitBox`, `toLocal`, `fromLocal`, `resizeBox`, `rotationFromPoint`, `snapMove`, `snapPoint`, `alignOffsets`, `distributeOffsets`, `fitZoom`, `snapLineEnd`.
- `ops.ts` :
  - repérage : `locate`, `pageBox`, `setPageBox`, `childToParent`, `parentToChild`, `flattenWithBoxes` ;
  - modification : `moveShapes`, `deleteShapes`, `duplicateShapes`, `insertCopies`, `matchSize` ;
  - ordre et groupes : `reorder` (front, back, forward, backward), `groupShapes`, `ungroup` ;
  - transformation : `flipShapes`, `rotateShapes`, `alignShapes`, `distributeShapes`.
- `text.ts` : positions `{ p, o }`, `insertText`, `deleteRange`, `splitParagraph`, `applyRunProps` (une clé à `null` la retire), `applyParagraphProps`, `commonRunProps`, `changeCase`, `shiftLevel`, `wordAt`, `sliceBody`, `insertParagraphs`, `findInBody`.
- `connectors.ts` : `connectionPoints`, `nearestSite`, `lineBox`, `lineEnds`, `rerouteConnectors`.
- `geometry/` : `buildGeometry(geometry, w, h)` renvoie `{ paths, textRect, connectionSites, handles }` ; `adjustFromPoint`, `LINE_PRESETS`, `isPresetKnown`.
  - **Attention** : dans une géométrie `custom`, les valeurs sont en EMU. Il faut fixer `path.width` et `path.height` (voir `createInk` dans `app/deck-ops.ts`).
- `chart/` : `renderChart(chart, w, h, ctx)` renvoie un arbre `SvgNode`, converti par `svgNodeToReact` et sérialisé par `svgToString`. `niceScale` est aussi exporté.
- `table-style.ts` : `TABLE_STYLES` et `cellLook(table, r, c)` (style moyen 2, clair 1, à thème 1, sans style).

## Résidus corrigés (2026-11-05, version 0.3.0)

Tous prouvés par des tests `node:test` (`tests/pdf-vector.test.ts`, `show-sync.test.ts`, `objects.test.ts`) et par le banc navigateur (`apps/web/tests/e2e/residus2-ppt.mjs`, 27 contrôles, captures `docs/captures/residus2-*.png`).

- **Export PDF vectoriel** (`src/pdf/`) : pages à la taille de la diapositive, texte réel extractible par pdf.js (testé), formes, chemins, dégradés, images (PNG/JPEG en XObject), tableaux, graphiques (SVG réécrit en opérateurs), liens, rotation et retournement. Polices : `@cantoo/fontkit` n'est PAS installé, donc pas d'incorporation de Carlito/Liberation/Selawik : polices standard du PDF (Helvetica, Times, Courier, Symbol pour le grec) avec mise à l'échelle horizontale pour garder les coupures de ligne de l'écran. Les caractères hors polices standard deviennent « ? » et l'export le signale. Repli en image PNG transparente pour les effets (lueur, reflet, flou, bords adoucis), le texte vertical ou déformé, les formats d'image non PDF (GIF, SVG, EMF/WMF). L'ombre portée est approchée (copie décalée, sans flou). Les pages de commentaires restent des images.
- **Écran du présentateur** : bouton « Écran du présentateur » (onglet Diaporama). Ouvre `window.open(?app=powerpoint&presenter=1)` dans le navigateur, `services.openModule('powerpoint')` sur bureau (la fenêtre vide devient présentateur à l'invitation du diaporama). Synchronisation par BroadcastChannel (`src/app/show-sync.ts`) : présentation, diapositive, étape d'animation, minuteur, pause, notes, suivante, écran noir ; commandes suivant/précédent/fin/pause/remise à zéro depuis le présentateur.
- **Répétition du minutage** : « Répéter le minutage », temps par diapositive et total, « Répéter » la diapositive, enregistrement en avance automatique (`transition.advanceAfter`, relu dans le .pptx), option « Utiliser les minutages », « Effacer les minutages ».
- **Suppression de l'arrière-plan** (Format de l'image) : couleur de fond échantillonnée sur les bords ou choisie dans l'image, tolérance, zone reliée aux bords seulement, aperçu sur damier, PNG avec alpha, annulable.
- **EMF/WMF** : `canvas/context.ts` utilise `displayMedia` de @forgeoffice/pptx (rendu SVG de repli) ; le PDF passe par le repli image.
- **Équations** (Insertion > Équation) : saisie type LaTeX réduit (fractions, exposants, indices, racines, sommes, intégrales, grec, délimiteurs étirés), SVG + repli PNG, saisie conservée dans le texte de remplacement, modifiable.
- **SmartArt simple** (Insertion > SmartArt) : liste, processus, hiérarchie ; groupe nommé « SmartArt », texte modifiable (forme par forme ou par la saisie).
- GUID de styles de tableau corrigés (clair 1 sans accent, moyen 2 accentuation 2).

## Reste à faire

- **Polices incorporées dans le PDF** : nécessite fontkit (non installé, aucun téléchargement permis).
- **Diaporama** : pas de vérification du minutage au-delà de l'enregistrement.
- **SmartArt** : création de listes, processus et hiérarchies simples seulement (pas de cycle, pyramide, matrice ; les SmartArt Office restent lus en repli).
- **Équations** : sous-ensemble de LaTeX (pas de matrices ni d'environnements) ; pas encore le format OMML de PowerPoint.
- **Rendu** : pas de 3D (rotation 3D, biseau).
- **Fonctions absentes** : galerie de motifs de remplissage dans le volet Format, styles de tableau au-delà des 19 proposés.
- **Polices** : « Aptos Display » est absente du système de test, et le repli de @forgeoffice/pptx affiche alors Segoe UI Semibold, plus gras que dans PowerPoint.
- **Galeries des onglets Formes et Styles rapides** : elles sont en ligne. Quand la fenêtre est étroite, le ruban les replie en grand bouton, comme Office.
