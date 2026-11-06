# Plan d'implémentation : parité Présentation / PowerPoint

Dérivé de `POWERPOINT.md` (902 entrées). Écarts P1 : **89 absents + 23 partiels** ; **151 entrées P1 « À vérifier »** (code présent, effet non prouvé). Efforts : **S** < 1 jour, **M** 1 à 3 jours, **L** > 3 jours (un agent).

## 1. Règles de découpage pour les agents parallèles

- **Un lot = un dossier neuf** (ou un petit nombre de fichiers listés). Les fichiers « carrefour » (`app/App.tsx` 560 lignes, `strings.ts` 722, `canvas/CanvasEditor.tsx` 791, `app/ribbon/*.tsx`) ne sont modifiés que par le **Lot 0** (points d'extension) et par les lots qui les citent explicitement ; tout le reste passe par des registres.
- Chaque lot écrit ses textes dans **son propre `strings-<lot>.ts`** (CONVENTIONS : aucun texte en dur dans les composants) et ses tests dans `packages/powerpoint/tests/<lot>.test.ts`.
- **Publication réutilise `packages/powerpoint/src/canvas`** : les lots marqués (C) modifient ce moteur et profitent aux deux produits ; ils doivent garder le contrat `CanvasEditor` (props, `onEdit` synchrone) et lancer aussi `node --test packages/publisher/tests/*.test.ts`.
- Un fichier garde < 800 lignes (1000 max) : couper par responsabilité.
- Exigence propriétaire : **pour chaque lot, un test de preuve** (unitaire pour la logique, parcours réel dans le banc `apps/web` pour le geste) et une capture regardée dans `docs/captures/`. Un statut passe à OK seulement avec cette preuve.

## 2. Top 15 des écarts P1 (par impact)

| # | Écart | Réf `POWERPOINT.md` | Lot |
|---|---|---|---|
| 1 | Menus contextuels complets par objet (texte, tableau/cellule, image, SmartArt, graphique, groupe, vidéo, notes, plan, trieuse, diaporama, masque) | §2 | L1 |
| 2 | Mini-barre flottante de texte, forme, image, tableau (absente sur bureau) | §3 | L2 |
| 3 | Modifier les points (nœuds, Bézier, ouvrir/fermer la trajectoire) | §2.5, §8 | L5 |
| 4 | Fusionner les formes (union, combiner, fragmenter, intersection, soustraire) | §1.12, §8 | L5 |
| 5 | Volet Format complet : dégradé, transparence, image/texture/motif, trait avancé, ombre/réflexion/lumière paramétrables, Options de texte | §4 | L4 |
| 6 | Boîte Police (+ exposant/indice, double barré, espacement, petites capitales) | §4 | L3 |
| 7 | Boîte Paragraphe, tabulations, marqueurs de retrait sur la règle, puces personnalisées | §4, §7 | L3 |
| 8 | Gestes de manipulation fins : sélectionner derrière (Alt+clic), verrouiller, rognage direct de l'image, infobulles de mesure, cibles de clic des petits objets | §9 | L6 |
| 9 | Tableau : menu clic droit, sélection ligne/colonne, bordures par cellule, dessiner un tableau, 74 styles | §1.14, §1.15, §2.8 | L7 |
| 10 | Paramètres du diaporama + diaporama personnalisé + menu clic droit en séance | §1.7, §2.15 | L8 |
| 11 | Options d'effet d'animation (boîte Effet/Minutage/Texte), reproduire l'animation, catalogue d'effets et de transitions | §1.5, §1.6, §4 | L9 |
| 12 | SmartArt réel (modèle, volet Texte, ajouter/promouvoir, dispositions, couleurs) | §1.16, §2.10 | L11 |
| 13 | Enregistrer en tant qu'image (forme, image, diapositive), Réutiliser les diapositives, Collage spécial | §2, §8 | L12 |
| 14 | Sélecteur de couleur personnalisée, pipette ; Options PowerPoint (réglages réels) | §4 | L13 |
| 15 | Preuve des 151 P1 « À vérifier » (le propriétaire a constaté que des options ne marchent pas) | tout | L0b |

## 3. Lots

### Lot 0 : points d'extension (S, **en premier, un seul agent**, 0,5 jour)
Dossier : `app/registry/` (+ retouche minimale de `App.tsx`, `strings.ts`).
- `context-registry.ts` : `registerContextMenu(kind, builder)` ; `App.tsx` remplace `shapeMenu` par `buildContextMenu(kind, ctx)`.
- `minibar-registry.ts` : prop `renderMiniBar` du `CanvasEditor`.
- `pane-registry.ts` : volets latéraux ajoutés sans toucher `panes.tsx`.
- `ribbon-tabs.ts` : onglets et groupes déclarés par lot (Enregistrement, Aide, Média, SmartArt).
- Renommer l'onglet « Création » en **Conception** (`strings.ts`) pour coller à Office.
Débloque L1, L2, L10, L11, L12, L13, L14.

### Lot 0b : banc de preuve des « À vérifier » (L, parallèle à tout, lecture seule du code)
Dossier : `packages/powerpoint/tests/e2e/` + script de banc (Edge sans interface en CDP, déjà utilisé dans STATUS).
- Un scénario par entrée P1 « À vérifier » de `POWERPOINT.md` (ruban Accueil, Insertion, Conception, Transitions, Animations, raccourcis §5, manipulations §9) : clic réel, résultat lu dans le DOM/le modèle, capture.
- Produit un rapport `docs/parite/PREUVES-POWERPOINT.md` : OK / Cassé. Chaque « Cassé » devient un bug P1.
- À lancer **avant** les lots qui retouchent le même code pour éviter les régressions silencieuses.

### Lot 1 : menus contextuels (L, dépend de L0)
Dossier : `app/context/` (un fichier par objet : `slide-thumb.ts`, `shape.ts`, `text.ts`, `picture.ts`, `table.ts`, `chart.ts`, `smartart.ts`, `group.ts`, `media.ts`, `notes.ts`, `outline.ts`, `sorter.ts`, `master.ts`, `show.ts`).
- Reprendre les listes exactes de `POWERPOINT.md` §2 (noms FR de PowerPoint). Les commandes réutilisent les actions existantes (`deck-ops.ts`, `ops.ts`) ; les entrées dont la commande n'existe pas encore sont ajoutées par les lots L3, L5, L12 puis activées.
- Texte en édition : menu ForgeOffice complet (Couper, Copier, Coller et options, Police, Paragraphe, Puces, Lien, Orthographe avec suggestions via le correcteur), en gardant le menu natif seulement en repli.
- Diaporama : clic droit = menu (et plus « reculer »).
- Tests : un test de construction des menus par type d'objet (entrées attendues, entrées désactivées).

### Lot 2 : mini-barre flottante (M, dépend de L0, **(C)**)
Dossier : `canvas/minibar/` (`MiniBar.tsx`, `minibar.css`, `placement.ts`) + `app/minibar/` (contenus par type d'objet).
- Texte : police, taille, agrandir/réduire, gras, italique, souligné, surbrillance, couleur, puces, numérotation, retrait, alignements, reproduire la mise en forme, styles.
- Forme : Style, Remplissage, Contour ; image : Style, Rogner, Bordure ; tableau : Style, Trame, Bordures, Insérer, Supprimer ; graphique : éléments, styles, filtres.
- Comportement Office : apparaît à la sélection de texte, s'estompe à l'éloignement du pointeur, suit le clic droit au-dessus du menu, ne cache pas la sélection.
- Réutilisable tel quel par Publication.

### Lot 3 : texte avancé (L, **(C)** pour la règle)
Dossier : `app/dialogs-text/` (`FontDialog.tsx`, `ParagraphDialog.tsx`, `TabsDialog.tsx`, `BulletsDialog.tsx`) + `canvas/ruler-indents/` (marqueurs de retrait et tabulations dans `Rulers.tsx`).
- Police : barré/double barré, exposant/indice, petites capitales, espacement personnalisé, décalage de ligne de base.
- Paragraphe : retraits avant texte/première ligne/suspendu, espacement avant/après, interligne multiple/exact, tabulations.
- Puces : symbole, image, couleur, taille, « commencer à ».
- Le modèle `@forgeoffice/pptx` porte déjà `marL`/`indent`/`spcBef` ou doit être étendu (voir `packages/pptx`).
- Raccourcis : Ctrl+T, Ctrl+Maj+F ; collision Ctrl+G (Gras/Grouper) à trancher.

### Lot 4 : volet Format complet (L, **(C)** pour le rendu)
Dossier : `app/format-pane/` (onglets Remplissage et trait, Effets, Taille et propriétés, Options de texte, Image) ; rendu dans `canvas/render/paint.tsx` et `canvas/render/ShapeView.tsx`.
- Dégradé (arrêts, angle, type), transparence, image/texture, motif ; trait : composé, tirets, extrémités, jointures, flèches avec tailles ; ombre, réflexion, lumière, bordures adoucies avec leurs paramètres ; Options de texte (remplissage/contour/effets du texte).
- Taille : échelle, verrouiller le rapport, point d'ancrage.
- **Biseau et rotation 3D : hors périmètre rendu (P3)**.
- Remplace le `FormatPane` actuel de `app/panes.tsx` (338 lignes).

### Lot 5 : édition de points et fusion de formes (L, **(C)**)
Dossier : `canvas/path-edit/` (nœuds, poignées Bézier, ouvrir/fermer, segment droit/courbe, point lisse/angle/symétrique, ajout/suppression) et `canvas/boolean-ops/` (union, combiner, fragmenter, intersection, soustraire sur chemins Bézier ; algorithme de découpage polygonal avec aplatissement des courbes).
- Conversion d'un préréglage en géométrie `custom` (EMU, `path.width/height` : voir l'avertissement du STATUS).
- Commande « Modifier les points » (menu et ruban), « Fusionner les formes » (onglet Format de forme).
- Tests : cas d'union/soustraction avec résultats attendus ; aller-retour pptx.

### Lot 6 : manipulation directe (M, **(C)**, avant L2/L5 car touche `CanvasEditor.tsx`)
Fichiers : `canvas/CanvasEditor.tsx` (découper en `canvas/interactions/*.ts` au passage, il dépasse 790 lignes), `canvas/Overlay.tsx`, `canvas/canvas.css`.
- Alt+clic = sélectionner l'objet derrière ; Ctrl+clic pour sélection non contiguë ; triple-clic = paragraphe.
- Poignées : zone de clic élargie (≥ 16 px) tout en gardant le dessin à 9 px ; priorité aux poignées sur le corps ; poignées de rognage pour les images ; infobulle de dimensions/angle pendant le geste ; curseurs de rotation.
- Verrouillage d'un objet (volet Sélection) ; objets fins (lignes, connecteurs) avec marge de clic.
- Tests réels avec la souris (banc) : petits objets, objets empilés, groupes imbriqués.

### Lot 7 : tableaux (M à L)
Dossier : `app/table/` (menus, bordures par cellule, dessiner, sélection ligne/colonne/tableau) ; styles dans `canvas/table-style.ts` (19 → 74) ; onglets dans `app/ribbon/contextual.tsx` (extraction vers `app/ribbon/table-tabs.tsx`).
- Bordures : style, épaisseur, couleur par côté ; Dessiner un tableau/Gomme ; marges de cellule ; sélection de ligne/colonne par clic sur la bordure ; redimensionnement des colonnes/lignes à la souris ; tableau depuis une plage collée (tabulations).
- Utilise L1 (menu) et L2 (mini-barre).

### Lot 8 : diaporama (L)
Dossier : `app/show/` (extraire de `SlideShow.tsx` 657 lignes : `settings-dialog.tsx`, `custom-shows.ts`, `context-menu.ts`, `pointer.ts`, `zoom.ts`).
- Boîte Paramètres du diaporama (orateur/individuel/kiosque, boucle, sans narration, sans animation, plage, avancement manuel/minutage, moniteur).
- Diaporama personnalisé (liste, création) ; menu clic droit ; Zoom dans la diapositive ; couleurs d'encre ; choix du moniteur (API Window Management).
- Enregistrement du diaporama (minutage déjà amorcé dans `RehearseBar.tsx`) : narration audio et encre : voir L14.

### Lot 9 : animations et transitions (M à L)
Dossier : `app/motion/` (catalogue d'effets, boîte Options d'effet, reproduire l'animation).
- Catalogue : 28 → ~54 effets d'animation, 26 → 48 transitions (lecture dans `app/playback.ts` et `app/ribbon/motion.tsx` 295 lignes).
- Boîte Options d'effet (Effet : son, après animation, texte par mot/lettre ; Minutage : démarrer, délai, durée, répétition, retour arrière ; déclencheur) ; menu de l'élément du volet Animation ; Reproduire l'animation.
- Tests : `app-logic.test.ts` étendu (étapes, déclencheurs) ; aperçu vérifié visuellement.

### Lot 10 : masques et mise en page (M)
Dossier : `app/master/` : masque du document, masque des pages de notes, insertion d'espaces réservés (contenu, texte, image, graphique, tableau, SmartArt, média), « Mise en page du masque » (cases titre/pieds), dupliquer/conserver une disposition.
- Onglets contextuels « Masque des diapositives », « Masque du document », « Masque des pages de notes » comme PowerPoint.

### Lot 11 : SmartArt réel (L)
Dossier : `app/smartart/` (modèle `dgm` + dispositions + volet Texte + onglets Conception/Mise en forme).
- Modèle de données arborescent ; ~12 dispositions (listes, processus, hiérarchie, cycle, relation, matrice, pyramide) calculées par code ; ajout/suppression/promotion/abaissement ; couleurs/styles ; conversion texte vers SmartArt (bouton Accueil) ; écriture OOXML `dgm` avec repli en formes groupées.
- Remplace `app/smartart.ts` (216 lignes), qui reste le repli de lecture.

### Lot 12 : insertion et échanges (M)
Dossier : `app/insert-more/` : Enregistrer en tant qu'image (PNG/SVG, forme/image/diapositive), Réutiliser les diapositives (depuis un fichier .pptx, conserver la mise en forme source), Collage spécial (menu complet), Zoom de diapositive/de section/récapitulatif, Action (boîte Paramètres des actions), Capture d'écran, Album photo.

### Lot 13 : couleurs et options (M)
Dossier : `app/color-picker/` (Autres couleurs : roue, HSL/RVB, pipette EyeDropper API) et `app/options/` (boîte Options PowerPoint : Général, Affichage, Vérification, Enregistrement, Langue, Accessibilité, Options avancées, Personnaliser le ruban, Barre Accès rapide).
- Branche : `packages/ui` a un TitleBar avec personnalisation de la barre d'accès rapide : réutiliser, ne pas dupliquer.

### Lot 14 : enregistrement, révision, médias (L)
Dossiers : `app/recording/` (onglet Enregistrement : narration audio, caméra incrustée, enregistrement d'écran, export vidéo local), `app/review/` (volet Orthographe, ignorer/ajouter, langue de vérification, dictionnaire), `app/media/` (onglets Format et Lecture de la vidéo/audio : rogner, fondus, signets, volume, démarrage, boucle).
- La reconnaissance vocale et la traduction sont P3 et hors lot.

### Lot 15 : raccourcis et touches d'accès (M)
Dossier : `app/shortcuts/` : registre unique (`registry.ts`) pour tous les raccourcis de `POWERPOINT.md` §5 (Ctrl+N, Ctrl+W, F12, F4, Ctrl+Alt+V, Ctrl+Espace, Ctrl+Maj+], Ctrl+1, Ctrl+Alt+M, Ctrl+Maj+flèches…) ; **touches d'accès** (Alt puis lettre : chaînes relevées par UIA dans la colonne « key » du ruban) ; palette de commandes (Ctrl+Maj+P). Remplace le gros `useEffect` clavier de `App.tsx` (lignes 240-282).

### Lot 16 : graphiques (L)
Dossier : `canvas/chart/` (+ `app/chart-ui/`) : onglet Format du graphique (sélection active, formats par élément), types manquants (cascade, entonnoir, boîte à moustaches, combiné, surface, boursier…), axes secondaires, barres d'erreur, courbes de tendance, boîte « Tous les graphiques », import de données collées/CSV.

## 4. Ordre conseillé

| Vague | Lots (parallélisables entre eux) | Pourquoi |
|---|---|---|
| 0 | **L0** puis **L0b** en parallèle de la suite | extension + preuve des « À vérifier » |
| 1 | L6 (gestes), L3 (texte), L4 (volet Format), L5 (points/fusion), L9 (animations), L10 (masques) | dossiers disjoints, sauf L6 qui touche `CanvasEditor.tsx` : L6 passe avant L2/L5 pour éviter les conflits |
| 2 | L1 (menus), L2 (mini-barre), L7 (tableaux), L8 (diaporama), L15 (raccourcis) | utilisent les commandes livrées en vague 1 |
| 3 | L11 (SmartArt), L12, L13, L14, L16 | gros morceaux indépendants |

Efforts cumulés : S ×1, M ×6, L ×9 ; en parallèle à 5 agents : 4 à 6 semaines-agent par vague. Chaque lot se clôt avec `npx tsc -p packages/powerpoint/tsconfig.json --noEmit`, `node --test packages/powerpoint/tests/*.test.ts` et `node --test packages/publisher/tests/*.test.ts` pour les lots (C).
