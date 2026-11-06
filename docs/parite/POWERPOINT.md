# Parité PowerPoint 365 (interface française) : Présentation de ForgeOffice

Audit du 2026-11-05, sans modification de code. Code audité : `packages/powerpoint` (version 0.2.0 + ajouts postérieurs au STATUS : PDF vectoriel, fenêtre présentateur, répétition du minutage, SmartArt, équations, suppression d'arrière-plan).

## 0. Méthode, sources, légende

**Sources**
- **U** = vérité-terrain lue par UI Automation sur Microsoft PowerPoint 365 installé sur ce PC (build 16.0.20527, ruban en français, fenêtre hors écran, document vide sur un dossier temporaire, `Quit()` dans un `finally`, aucun processus restant). Les noms de commandes, groupes, identifiants (`TabHome`, `Paste`…) et touches d'accès (Alt, L, V…) viennent de là.
- **CB** = menus contextuels hérités lus par COM (`CommandBars`, 165 barres) : libellés français exacts des clics droits (Miniatures, Forme, Image, Tableau, Cellules, Notes, Plan, Diaporama, Courbe, Connecteur…). Le menu moderne (avec mini-barre) n'est pas lisible sans vrai clic droit : ses entrées en plus viennent de la **connaissance** (K).
- **K** = connaissance de PowerPoint 365 pour tout ce qui exige un clic réel (mini-barre, menus modernes, onglets Graphique/Vidéo/Zoom/3D non capturés faute de média ou d'Excel sans gêner le propriétaire).
- Statuts de ForgeOffice établis **en lisant le code** (fichiers cités, chemins relatifs à `packages/powerpoint/src`) et `STATUS.md`/`tests/`. Aucune exécution de l'application n'a été faite dans cet audit.

**Statuts** (le propriétaire a constaté que certaines options « présentes » ne fonctionnent pas : la preuve compte)

| Statut | Sens |
|---|---|
| **OK** | présent **et prouvé** : test automatisé du même effet ou parcours réel noté « prouvé » dans STATUS.md |
| **À vérifier** | code présent (bouton, fonction, entrée de menu), **effet non prouvé** : à tester en vrai avant de le déclarer fait |
| **Partiel** | présent mais incomplet par rapport à PowerPoint (le manque est dit dans la note) |
| **Absent** | rien dans le code |

**Priorités** : **P1** = usage quotidien d'un utilisateur de PowerPoint ou geste de manipulation d'objet qui bloque le travail ; **P2** = fréquent ou attendu d'une suite complète ; **P3** = rare, dépend d'un service en ligne/matériel, ou cosmétique.

Nombre d'entrées : **902**.

## Bilan chiffré

| Type d'entrée | Total | OK | À vérifier | Partiel | Absent |
|---|---|---|---|---|---|
| Ruban (UIA + connaissance) | 495 | 36 (7 %) | 218 (44 %) | 33 (6 %) | 208 (42 %) |
| Menus contextuels | 170 | 0 (0 %) | 47 (27 %) | 10 (5 %) | 113 (66 %) |
| Mini-barre | 15 | 0 (0 %) | 0 (0 %) | 1 (6 %) | 14 (93 %) |
| Dialogues et volets | 57 | 2 (3 %) | 18 (31 %) | 5 (8 %) | 32 (56 %) |
| Raccourcis clavier | 59 | 5 (8 %) | 35 (59 %) | 0 (0 %) | 19 (32 %) |
| Backstage | 22 | 1 (4 %) | 8 (36 %) | 4 (18 %) | 9 (40 %) |
| Modes d'affichage / règle / repères | 24 | 5 (20 %) | 11 (45 %) | 1 (4 %) | 7 (29 %) |
| Fonctions invisibles | 39 | 0 (0 %) | 5 (12 %) | 5 (12 %) | 29 (74 %) |
| Manipulation directe des objets | 21 | 0 (0 %) | 13 (61 %) | 0 (0 %) | 8 (38 %) |
| **Total** | 902 | 49 (5 %) | 355 (39 %) | 59 (6 %) | 439 (48 %) |


**Les 15 écarts P1 les plus lourds** (Absent ou Partiel) : voir `POWERPOINT-priorites.md`, §2.

## 1. Ruban

Onglets réels dans PowerPoint 365 FR (U) : **Fichier** (Backstage, §6), Accueil, Insertion, Dessin, Conception, Transitions, Animations, Diaporama, Enregistrement, Révision, Affichage, Aide. Contextuels vus : Format de forme, Format de l'image, Création de tableau, Disposition du tableau, Conception de SmartArt, Mise en forme (SmartArt), Audio : Format, Audio : Lecture, Masque des diapositives, Masque des pages de notes, Masque du document. **Écarts de structure** : ForgeOffice nomme l'onglet « Création » (PowerPoint : **Conception**) et n'a ni onglet **Enregistrement** ni onglet **Aide** ; PowerPoint 365 de ce PC n'affiche pas « Concepteur » ni « Copilot » (services hors ligne).

### 1.1 Onglet « Accueil »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R01-001 | Presse-papiers / Coller | Bouton fractionné ; (Alt, L, V) | Partiel | app/ribbon/home.tsx, app/clipboard.ts | P1 | 3 options seulement (source / image / texte) ; pas de Collage spécial, ni « Utiliser le thème de destination » ; Ctrl+V géré |
| R01-002 | Presse-papiers / Couper | Bouton ; (Alt, L, X) | À vérifier | app/ribbon/home.tsx, app/clipboard.ts | P1 | Formes, diapositives, texte ; effet réel à contrôler (copie riche interne + texte système) |
| R01-003 | Presse-papiers / Copier | Bouton fractionné ; (Alt, L, C) | À vérifier | app/ribbon/home.tsx, app/clipboard.ts | P1 | Formes, diapositives, texte ; effet réel à contrôler (copie riche interne + texte système) |
| R01-004 | Presse-papiers / Reproduire la mise en forme | Bouton ; (Alt, L, W R) | À vérifier | app/ribbon/home.tsx (Ctrl+Maj+C/V) | P1 | Pas de double-clic pour appliquer plusieurs fois |
| R01-005 | Presse-papiers / Presse-papiers Office... | Bouton ; (Alt, L, F R) | Absent |  | P3 | Pas de panneau historique du presse-papiers |
| R01-006 | Diapositives / Nouvelle diapositive | Bouton fractionné ; (Alt, L, E O) | OK | app/ribbon/insert.tsx, app/SlidePanel.tsx | P1 | Galerie des 11 dispositions, prouvée dans le banc (STATUS) |
| R01-007 | Diapositives / Disposition | Menu/galerie ; (Alt, L, B) | OK | app/ribbon/home.tsx, app/deck-ops.ts | P1 | Prouvé (galerie de 11 dispositions) |
| R01-008 | Diapositives / Rétablir | Bouton ; (Alt, L, N V) | À vérifier | app/ribbon/home.tsx, app/deck-ops.ts | P2 |  |
| R01-009 | Diapositives / Section | Menu/galerie ; (Alt, L, S) | À vérifier | app/SlidePanel.tsx | P2 | Sections : ajouter, renommer, supprimer, déplacer, réduire (menu du ruban à vérifier) |
| R01-010 | Police / Police  | Liste déroulante ; (Alt, L, W P) | À vérifier | app/ribbon/home.tsx | P1 | Liste de polices du système à contrôler (polices absentes : repli) |
| R01-011 | Police / Police  | Champ ; (Alt, L, W P) | À vérifier | app/ribbon/home.tsx | P1 | Liste de polices du système à contrôler (polices absentes : repli) |
| R01-012 | Police / Taille de police  | Liste déroulante ; (Alt, L, G T) | À vérifier | app/ribbon/home.tsx | P1 | Liste de polices du système à contrôler (polices absentes : repli) |
| R01-013 | Police / Taille de police  | Champ ; (Alt, L, G T) | À vérifier | app/ribbon/home.tsx | P1 | Liste de polices du système à contrôler (polices absentes : repli) |
| R01-014 | Police / Augmenter la taille de police | Bouton ; (Alt, L, K A) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+Maj+< >) | P1 |  |
| R01-015 | Police / Réduire la taille de police | Bouton ; (Alt, L, K É) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+Maj+< >) | P1 |  |
| R01-016 | Police / Effacer la mise en forme | Bouton ; (Alt, L, M F) | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-017 | Police / Gras | Bouton ; (Alt, L, 1) | À vérifier | app/ribbon/home.tsx, canvas/text.ts (applyRunProps testé) | P1 | Logique testée (canvas-text), liaison du bouton à vérifier |
| R01-018 | Police / Italique | Bouton ; (Alt, L, 2) | À vérifier | app/ribbon/home.tsx, canvas/text.ts (applyRunProps testé) | P1 | Logique testée (canvas-text), liaison du bouton à vérifier |
| R01-019 | Police / Souligner | Bouton ; (Alt, L, 3) | À vérifier | app/ribbon/home.tsx, canvas/text.ts (applyRunProps testé) | P1 | Logique testée, liaison du bouton à vérifier ; un seul style de trait (pas de menu des styles de soulignement) |
| R01-020 | Police / Ombre | Bouton ; (Alt, L, 5) | À vérifier | app/ribbon/home.tsx | P2 | Ombre du texte |
| R01-021 | Police / Barré | Bouton ; (Alt, L, 4 1) | À vérifier | app/ribbon/home.tsx, canvas/text.ts (applyRunProps testé) | P1 | Logique testée (canvas-text), liaison du bouton à vérifier |
| R01-022 | Police / Espacement des caractères | Menu/galerie ; (Alt, L, 6) | À vérifier | app/ribbon/home.tsx | P2 | 5 valeurs prédéfinies ; pas de valeur personnalisée ni de crénage |
| R01-023 | Police / Modifier la casse | Menu/galerie ; (Alt, L, 7) | À vérifier | app/ribbon/home.tsx, canvas/text.ts (changeCase testé) | P2 |  |
| R01-024 | Police / Couleur de surbrillance de texte | Bouton fractionné ; (Alt, L, T C) | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-025 | Police / Couleur de police | Bouton fractionné ; (Alt, L, G O) | À vérifier | app/ribbon/home.tsx, app/ribbon/shape-menus.tsx | P1 | Palette thème/standard ; pas de « Autres couleurs » ni de pipette |
| R01-026 | Police / Police... | Bouton ; (Alt, L, L) | Partiel | app/ribbon/home.tsx (ouvre le volet Format) | P1 | Pas de boîte Police (double barré, petites majuscules, relief, espacement…) |
| R01-027 | Paragraphe / Puces | Bouton fractionné ; (Alt, L, Q P) | OK | app/ribbon/home.tsx, canvas/render/numbering.ts | P1 | Saisie de puces prouvée ; puces personnalisées (image, symbole, couleur, taille) absentes |
| R01-028 | Paragraphe / Numérotation | Bouton fractionné ; (Alt, L, Q U) | À vérifier | app/ribbon/home.tsx, canvas/render/numbering.ts | P1 | 6 schémas ; pas de « Commencer à » |
| R01-029 | Paragraphe / Diminuer le retrait | Bouton ; (Alt, L, D I) | À vérifier | app/ribbon/home.tsx | P1 | Change le niveau de liste, pas le retrait en points |
| R01-030 | Paragraphe / Augmenter le retrait | Bouton ; (Alt, L, U A) | À vérifier | app/ribbon/home.tsx | P1 | Change le niveau de liste, pas le retrait en points |
| R01-031 | Paragraphe / Interligne | Menu/galerie ; (Alt, L, N I) | À vérifier | app/ribbon/home.tsx | P1 | Pas d’espacement avant/après |
| R01-032 | Paragraphe / Aligner à gauche | Bouton ; (Alt, L, G L) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+E/L/R/J) | P1 |  |
| R01-033 | Paragraphe / Centrer | Bouton ; (Alt, L, G C) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+E/L/R/J) | P1 |  |
| R01-034 | Paragraphe / Aligner à droite | Bouton ; (Alt, L, W L) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+E/L/R/J) | P1 |  |
| R01-035 | Paragraphe / Justifier | Bouton ; (Alt, L, U S) | À vérifier | app/ribbon/home.tsx, app/App.tsx (Ctrl+E/L/R/J) | P1 |  |
| R01-036 | Paragraphe / Colonnes | Menu/galerie ; (Alt, L, O C) | À vérifier | app/ribbon/home.tsx, canvas/render/TextBlock.tsx | P2 |  |
| R01-037 | Paragraphe / Orientation du texte | Menu/galerie ; (Alt, L, T 1) | À vérifier | app/ribbon/home.tsx | P2 | 4 orientations |
| R01-038 | Paragraphe / Aligner le texte | Menu/galerie ; (Alt, L, A 1) | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-039 | Paragraphe / Convertir en graphique SmartArt | Menu/galerie ; (Alt, L, O O) | Absent |  | P2 | Pas de conversion liste vers SmartArt |
| R01-040 | Paragraphe / Paragraphe... | Bouton ; (Alt, L, P) | Absent |  | P1 | Boîte Paragraphe absente : retrait de première ligne/suspendu, espacement avant/après, tabulations |
| R01-041 | Dessin > Formes / (galerie) [galerie de 190 éléments] | Menu/galerie | OK | canvas/geometry/*, app/ribbon/galleries.tsx | P1 | Galerie de 187 formes |
| R01-042 | Dessin > Formes / Formes | Bouton ; (Alt, L, E R) | OK | canvas/geometry/*, app/ribbon/insert.tsx | P1 | 187 formes (test geometry), tracé prouvé |
| R01-043 | Dessin / Organiser | Menu/galerie ; (Alt, L, 8) | À vérifier | app/ribbon/home.tsx, app/ribbon/galleries.tsx | P1 | Ordre, grouper, aligner, distribuer, rotation, volet Sélection |
| R01-044 | Dessin / Styles rapides | Menu/galerie ; (Alt, L, H T) | À vérifier | app/ribbon/shape-menus.tsx, app/ribbon/contextual.tsx | P2 | 7 couleurs x 5 intensités ; la galerie PowerPoint en compte 77 |
| R01-045 | Dessin / Remplissage | Bouton fractionné ; (Alt, L, È E) | À vérifier | app/ribbon/shape-menus.tsx | P1 | Pas de dégradé/image/texture/motif depuis le bouton (dégradé préréglé via le volet) |
| R01-046 | Dessin / Contour | Bouton fractionné ; (Alt, L, É O) | À vérifier | app/ribbon/shape-menus.tsx | P1 | Couleur, épaisseur, tirets, flèches |
| R01-047 | Dessin / Effets | Menu/galerie ; (Alt, L, Ù F) | Partiel | app/ribbon/shape-menus.tsx | P2 | Ombre, réflexion, lumière, bordures adoucies ; pas de biseau ni de rotation 3D |
| R01-048 | Dessin / Mise en forme de l’objet... | Bouton ; (Alt, L, H M) | Partiel | app/panes.tsx (FormatPane) | P1 | Volet Format réduit : voir §4 |
| R01-049 | Édition / Rechercher... | Bouton ; (Alt, L, J) | À vérifier | app/dialogs.tsx (Ctrl+F) | P2 |  |
| R01-050 | Édition / Remplacer... | Bouton fractionné ; (Alt, L, R) | À vérifier | app/dialogs.tsx (Ctrl+H) | P2 | Remplacer tout ; pas de remplacement de police |
| R01-051 | Édition / Sélectionner | Menu/galerie ; (Alt, L, 4 2) | Partiel | app/ribbon/home.tsx | P2 | Tout sélectionner + volet Sélection ; pas « Sélectionner les objets » |
| R01-052 | Compléments / Compléments | Bouton ; (Alt, L, A S) | Absent |  | P3 | Pas de compléments Office |

### 1.2 Onglet « Insertion »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R02-001 | Diapositives / Nouvelle diapositive | Bouton fractionné ; (Alt, S, S I) | OK | app/ribbon/insert.tsx | P1 |  |
| R02-002 | Tableaux / Tableau | Bouton fractionné ; (Alt, S, Ç T) | OK | app/ribbon/insert.tsx, app/table-ops.ts | P1 | Grille 10x8 + boîte ; tableau 3x4 prouvé. Pas de tableau Excel ni « Dessiner un tableau » |
| R02-003 | Images / Images | Menu/galerie ; (Alt, S, I 1) | À vérifier | app/ribbon/insert.tsx, app/insert.ts | P1 | Cet appareil + glisser-déposer ; pas d’images de stock ni en ligne |
| R02-004 | Images / Capture | Menu/galerie ; (Alt, S, R C) | Absent |  | P3 |  |
| R02-005 | Images / Album photo... | Bouton fractionné ; (Alt, S, L) | Absent |  | P3 |  |
| R02-006 | Images / Nouvel album photo... | Bouton | Absent |  | P3 |  |
| R02-007 | Caméra / Cameo | Bouton fractionné ; (Alt, S, C 1) | Absent |  | P3 | Caméra incrustée |
| R02-008 | Illustrations / Formes | Menu/galerie ; (Alt, S, E R) | OK | app/ribbon/insert.tsx | P1 |  |
| R02-009 | Illustrations / Icônes | Bouton ; (Alt, S, N S) | OK | app/insert-objects.ts | P2 | Icônes Fluent (SVG) avec recherche : prouvé |
| R02-010 | Illustrations / Modèles 3D | Bouton fractionné ; (Alt, S, S 3) | Absent |  | P3 | Pas de rendu 3D |
| R02-011 | Illustrations / SmartArt... | Bouton ; (Alt, S, R M) | Partiel | app/smartart.ts | P1 | Trois types (liste, processus, hiérarchie) en formes groupées ; pas de bibliothèque de dispositions, pas de volet Texte, pas d’onglets contextuels SmartArt |
| R02-012 | Illustrations / Graphique... | Bouton ; (Alt, S, C 2) | OK | canvas/chart/*, app/ribbon/insert.tsx | P1 | 10 types ; PowerPoint en propose ~17 (cascade, entonnoir, boîte à moustaches, carte…) |
| R02-013 | Liens / Zoom | Menu/galerie ; (Alt, S, Y) | Absent |  | P2 | Zoom récapitulatif / de section / de diapositive |
| R02-014 | Liens / Lien | Bouton ; (Alt, S, I 2) | OK | app/dialogs-insert.tsx (Ctrl+K) | P1 | Web ou diapositive ; pas fichier existant ni e-mail |
| R02-015 | Liens / Action | Bouton ; (Alt, S, O) | Partiel | app/playback.ts (liens du diaporama) | P2 | Aucune boîte « Paramètres des actions » (survol, lancer un programme, son) |
| R02-016 | Commentaires / Commentaire | Bouton ; (Alt, S, C 3) | À vérifier | app/ribbon/insert.tsx, app/panes.tsx | P2 |  |
| R02-017 | Texte / Zone de texte | Bouton ; (Alt, S, Ç O) | OK | app/ribbon/insert.tsx | P1 | Prouvé |
| R02-018 | Texte / En-tête/Pied... | Bouton ; (Alt, S, K) | À vérifier | app/dialogs-insert.tsx | P2 |  |
| R02-019 | Texte / WordArt | Menu/galerie ; (Alt, S, 1) | Partiel | app/ribbon/insert.tsx | P2 | 6 styles ; pas de transformations de texte (arc, vague…) |
| R02-020 | Texte / Date et heure... | Bouton ; (Alt, S, È D) | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-021 | Texte / Numéro de diapositive | Bouton ; (Alt, S, M) | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-022 | Texte / Objet... | Bouton ; (Alt, S, W) | Absent |  | P3 | Objet OLE |
| R02-023 | Symboles / Équation | Bouton fractionné ; (Alt, S, Q Q) | Partiel | app/equation.ts | P2 | Saisie type LaTeX rendue en image vectorielle ; pas d’édition OMML native, ni galerie, ni entrée manuscrite |
| R02-024 | Symboles / Symbole... | Bouton ; (Alt, S, B) | À vérifier | app/ribbon/insert.tsx | P3 | Liste limitée |
| R02-025 | Média / Vidéo | Menu/galerie ; (Alt, S, V) | À vérifier | app/ribbon/insert.tsx, app/insert.ts | P2 | Médias incorporés ; pas de vidéo en ligne ni d’enregistrement audio |
| R02-026 | Média / Audio | Menu/galerie ; (Alt, S, U) | À vérifier | app/ribbon/insert.tsx, app/insert.ts | P2 | Médias incorporés ; pas de vidéo en ligne ni d’enregistrement audio |
| R02-027 | Média / Enregistrement de l’écran... | Bouton ; (Alt, S, E 1) | Absent |  | P3 |  |

### 1.3 Onglet « Dessin »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R03-001 | Annuler / Impossible d'annuler | Bouton ; Ctrl+Z (Alt, J I, A Z) | Absent |  | P3 | Doublons de l’annulation et de l’aide |
| R03-002 | Annuler / Impossible de répéter | Bouton ; Ctrl+Y (Alt, J I, A Q) | Absent |  | P3 | Doublons de l’annulation et de l’aide |
| R03-003 | Outils de dessin / Outils de dessin | Galerie ; (ALT+O) | À vérifier | app/ribbon/design.tsx | P2 |  |
| R03-004 | Outils de dessin / Sélectionner : Sélectionnez des objets, notamment des entrées manuscrites, des formes et des zones de texte. C’est particulièrement utile lorsque vous utilisez des objets situés derrière le texte. | Bouton fractionné ; (Alt, J I, G) | À vérifier | app/ribbon/design.tsx | P2 |  |
| R03-005 | Outils de dessin / Sélection lasso : Sélectionner une entrée manuscrite en dessinant une forme. Tous les traits d’encre de la forme sont sélectionnés. | Bouton fractionné ; (Alt, J I, G) | OK | app/ribbon/design.tsx | P2 | Prouvé |
| R03-006 | Outils de dessin / Gomme : Utiliser la gomme pour effacer l’entrée manuscrite tracée sur la page. | Bouton fractionné ; (Alt, J I, G) | À vérifier | app/ribbon/design.tsx | P2 | Gomme par trait entier |
| R03-007 | Outils de dessin / Stylo : Noir, 0.35 mm | Bouton fractionné ; (Alt, J I, G) | OK | app/ribbon/design.tsx, canvas/CanvasEditor.tsx | P2 | Trait rouge prouvé ; encre enregistrée comme forme libre |
| R03-008 | Outils de dessin / Stylo : Rouge, 0.35 mm | Bouton fractionné ; (Alt, J I, G) | OK | app/ribbon/design.tsx, canvas/CanvasEditor.tsx | P2 | Trait rouge prouvé ; encre enregistrée comme forme libre |
| R03-009 | Outils de dessin / Surligneur : Jaune, 6 mm | Bouton fractionné ; (Alt, J I, G) | OK | app/ribbon/design.tsx, canvas/CanvasEditor.tsx | P2 | Trait rouge prouvé ; encre enregistrée comme forme libre |
| R03-010 | Outils de dessin / Stylo plume : Bleu foncé, 1 mm | Bouton fractionné ; (Alt, J I, G) | Absent |  | P3 | Seulement noir/rouge/bleu + surligneur |
| R03-011 | Outils de dessin / Stylo pinceau : Vert, 1 mm | Bouton fractionné ; (Alt, J I, G) | Absent |  | P3 | Seulement noir/rouge/bleu + surligneur |
| R03-012 | Outils de dessin / Ajouter | Menu/galerie ; (Alt, J I, A 1) | Absent |  | P3 | Pas de stylos personnalisés ni de textures |
| R03-013 | Gabarits / Règle | Bouton ; (Alt, J I, R) | Absent |  | P3 | Gabarit règle de dessin |
| R03-014 | Convertir / Entrée manuscrite en forme | Bouton ; (Alt, J I, H) | Absent |  | P2 | Reconnaissance de formes |
| R03-015 | Convertir / Maths | Bouton ; (Alt, J I, M) | Absent |  | P3 |  |
| R03-016 | Revoir / Revoir | Bouton ; (Alt, J I, K) | Absent |  | P3 | Relecture de l’encre |
| R03-017 | Aide / Aide pour l’entrée manuscrite | Bouton ; (Alt, J I, A 2) | Absent |  | P3 | Doublons de l’annulation et de l’aide |

### 1.4 Onglet « Conception »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R04-001 | Thèmes > Thèmes / (galerie) [galerie de 20 éléments] | Menu/galerie | Partiel | app/ribbon/design.tsx, app/themes.ts | P2 | 8 thèmes (Horizon prouvé) contre ~20 ; pas de thèmes en ligne ni parcourir/enregistrer un thème |
| R04-002 | Thèmes > Thèmes / Thèmes | Bouton ; (Alt, É, H) | Partiel | app/ribbon/design.tsx, app/themes.ts | P2 | 8 thèmes (Horizon prouvé) contre ~20 ; pas de thèmes en ligne ni parcourir/enregistrer un thème |
| R04-003 | Personnaliser / Variantes | Menu/galerie ; (Alt, É, V) | À vérifier | app/ribbon/design.tsx | P2 | 4 variantes par thème |
| R04-004 | Personnaliser / Couleurs | Menu/galerie ; (Alt, É, U) | À vérifier | app/ribbon/design.tsx | P2 | 17 palettes ; pas de personnalisation de palette |
| R04-005 | Personnaliser / Polices | Menu/galerie ; (Alt, É, L) | À vérifier | app/ribbon/design.tsx | P2 | 12 jeux ; pas de jeu personnalisé |
| R04-006 | Personnaliser / Effets | Menu/galerie ; (Alt, É, É) | Absent |  | P3 | Effets de thème |
| R04-007 | Personnaliser / Styles d'arrière-plan | Menu/galerie ; (Alt, É, S T) | À vérifier | app/ribbon/design.tsx | P2 |  |
| R04-008 | Diapositives / Disposition | Menu/galerie ; (Alt, É, B) | À vérifier | app/ribbon/design.tsx | P2 |  |
| R04-009 | Diapositives / Taille des diapositives | Menu/galerie ; (Alt, É, T) | À vérifier | app/dialogs.tsx | P2 | 13 formats ou personnalisée, ajuster/agrandir |

### 1.5 Onglet « Transitions »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R05-001 | Aperçu / Aperçu | Bouton ; (Alt, K, A) | À vérifier | app/ribbon/motion.tsx | P2 | Aperçu animé au survol et joué |
| R05-002 | Transition vers cette diapositive > Effets de transition / (galerie) [galerie de 48 éléments] | Menu/galerie | Partiel | app/ribbon/motion.tsx | P2 | 26 transitions (Push prouvé) contre 48 dans PowerPoint |
| R05-003 | Transition vers cette diapositive > Effets de transition / Effets de transition | Bouton ; (Alt, K, D) | Partiel | app/ribbon/motion.tsx | P2 | 26 transitions (Push prouvé) contre 48 dans PowerPoint |
| R05-004 | Transition vers cette diapositive / Options de l’effet | Menu/galerie ; (Alt, K, O) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R05-005 | Minutage / Son  | Liste déroulante ; (Alt, K, S) | À vérifier | app/ribbon/motion.tsx | P2 | Aucun / arrêter / fichier ; pas de sons prédéfinis |
| R05-006 | Minutage / Durée  | Compteur ; (Alt, K, E) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R05-007 | Minutage / Appliquer partout | Bouton ; (Alt, K, L) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R05-008 | Minutage / Manuellement | Case à cocher ; (Alt, K, M) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R05-009 | Minutage / Après  | Case à cocher ; (Alt, K, P) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R05-010 | Minutage / Après | Compteur ; (Alt, K, R) | À vérifier | app/ribbon/motion.tsx | P2 |  |

### 1.6 Onglet « Animations »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R06-001 | Aperçu / Aperçu | Bouton fractionné ; (Alt, À, P) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R06-002 | Animation > Styles d’animation / (galerie) [galerie de 54 éléments] | Menu/galerie | Partiel | app/ribbon/motion.tsx | P1 | 28 effets (Fondu prouvé) contre ~54 ; pas de « Autres effets » par catégorie |
| R06-003 | Animation > Styles d’animation / Styles d’animation | Bouton ; (Alt, À, S) | Partiel | app/ribbon/motion.tsx | P1 | 28 effets (Fondu prouvé) contre ~54 ; pas de « Autres effets » par catégorie |
| R06-004 | Animation / Options de l’effet | Menu/galerie ; (Alt, À, O) | À vérifier | app/ribbon/motion.tsx | P2 | Directions ; pas de boîte Options (son, atténuation, texte par mot/lettre, répétition) |
| R06-005 | Animation avancée / Ajouter une animation | Menu/galerie ; (Alt, À, T) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R06-006 | Animation avancée / Volet Animation | Bouton ; (Alt, À, N) | OK | app/panes.tsx (AnimationPane) | P1 |  |
| R06-007 | Animation avancée / Déclencheur | Menu/galerie ; (Alt, À, C) | OK | app/ribbon/motion.tsx, app/deck-ops.ts | P2 | Test app-logic |
| R06-008 | Animation avancée / Reproduire l’animation | Bouton ; (Alt, À, R) | Absent |  | P2 | Pinceau d’animation |
| R06-009 | Minutage / Démarrage  | Liste déroulante ; (Alt, À, M) | À vérifier | app/ribbon/motion.tsx | P2 | Pas de répétition ni de retour arrière |
| R06-010 | Minutage / Durée de l’animation | Compteur ; (Alt, À, U) | À vérifier | app/ribbon/motion.tsx | P2 | Pas de répétition ni de retour arrière |
| R06-011 | Minutage / Délai avant l’animation | Compteur ; (Alt, À, L) | À vérifier | app/ribbon/motion.tsx | P2 | Pas de répétition ni de retour arrière |
| R06-012 | Minutage / Déplacer antérieurement | Bouton ; (Alt, À, É) | À vérifier | app/ribbon/motion.tsx | P2 |  |
| R06-013 | Minutage / Déplacer ultérieurement | Bouton ; (Alt, À, D) | À vérifier | app/ribbon/motion.tsx | P2 |  |

### 1.7 Onglet « Diaporama »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R07-001 | Démarrage du diaporama / À partir du début | Bouton ; (Alt, W, É) | OK | app/SlideShow.tsx | P1 | F5 / Maj+F5 prouvés |
| R07-002 | Démarrage du diaporama / À partir de la diapositive actuelle | Bouton ; (Alt, W, À) | OK | app/SlideShow.tsx | P1 | F5 / Maj+F5 prouvés |
| R07-003 | Démarrage du diaporama / Diaporama personnalisé | Menu/galerie ; (Alt, W, D) | Absent |  | P2 | Pas de diaporamas personnalisés |
| R07-004 | Configuration / Configurer le diaporama... | Bouton ; (Alt, W, C) | Absent |  | P1 | Boîte Paramètres du diaporama absente : mode kiosque, boucle, sans narration/animation, plage, moniteur |
| R07-005 | Configuration / Masquer la diapositive | Bouton ; (Alt, W, S) | À vérifier | app/SlidePanel.tsx, app/ribbon/views.tsx | P2 |  |
| R07-006 | Configuration / Vérifier le minutage | Bouton ; (Alt, W, V) | À vérifier | app/RehearseBar.tsx | P2 | Ajouté après le STATUS |
| R07-007 | Configuration / Enregistrer | Bouton fractionné ; (Alt, W, N) | Absent |  | P2 | Enregistrement du diaporama (narration, minutage, encre) |
| R07-008 | Configuration / À partir de la diapositive actuelle... | Bouton | Absent |  | P2 | Enregistrement du diaporama (narration, minutage, encre) |
| R07-009 | Configuration / Lire les narrations | Case à cocher ; (Alt, W, L) | Absent |  | P3 |  |
| R07-010 | Configuration / Utiliser le minutage | Case à cocher ; (Alt, W, T) | À vérifier | app/ribbon/views.tsx | P2 |  |
| R07-011 | Configuration / Afficher les contrôles multimédias | Case à cocher ; (Alt, W, A) | Absent |  | P3 |  |
| R07-012 | Moniteurs / Moniteur  | Liste déroulante ; (Alt, W, M) | Absent |  | P2 | Choix du moniteur ; seconde fenêtre présentateur via window.open |
| R07-013 | Moniteurs / Utiliser le mode Présentateur | Case à cocher ; (Alt, W, U) | OK | app/PresenterWindow.tsx, app/SlideShow.tsx | P1 | Alt+F5 prouvé ; fenêtre séparée ajoutée |

### 1.8 Onglet « Enregistrement »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R08-001 | Aperçu / Aperçu | Bouton ; (Alt, P, P) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-002 | Caméra / Cameo | Bouton fractionné ; (Alt, P, C 1) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-003 | Enregistrer / À partir du début... | Bouton ; (Alt, P, B) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-004 | Enregistrer / À partir de la diapositive actuelle... | Bouton ; (Alt, P, C S) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-005 | Enregistrer / Enregistrement d’écran | Bouton ; (Alt, P, E) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-006 | Enregistrer / Audio | Bouton ; (Alt, P, O) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-007 | Modifier / Effacer l’enregistrement | Menu/galerie ; (Alt, P, C R) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-008 | Modifier / Rétablir Cameo | Menu/galerie ; (Alt, P, R S) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-009 | Exporter / Enregistrer en tant que diaporama | Bouton ; (Alt, P, D) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-010 | Exporter / Exporter en tant que Vidéo | Menu/galerie ; (Alt, P, V) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |
| R08-011 | Aide / En savoir plus | Bouton ; (Alt, P, L) | Absent |  | P2 | Onglet Enregistrement entier absent (narration, caméra, enregistrement d’écran, export vidéo) |

### 1.9 Onglet « Révision »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R09-001 | Vérification / Orthographe... | Bouton ; (Alt, R, È) | Partiel | app/ribbon/views.tsx (informatif) | P2 | Soulignement natif du navigateur ; pas de volet de correction, ni d’ignorer/ajouter au dictionnaire |
| R09-002 | Vérification / Dictionnaire des synonymes... | Bouton ; (Alt, R, D I) | Absent |  | P3 |  |
| R09-003 | Accessibilité / Vérifier l’accessibilité | Bouton fractionné ; (Alt, R, A 1) | Partiel | app/panes.tsx (AccessibilityPane) | P2 | 3 contrôles (alt, titres) contre une vingtaine |
| R09-004 | Langue / Traduire | Bouton ; (Alt, R, L) | Absent |  | P3 | Langue fixée « Français » |
| R09-005 | Langue / Langue | Menu/galerie ; (Alt, R, J) | Absent |  | P3 | Langue fixée « Français » |
| R09-006 | Commentaires / Nouveau commentaire | Bouton ; (Alt, R, N) | À vérifier | app/panes.tsx (CommentsPane) | P2 | Réponses, résolution |
| R09-007 | Commentaires / Supprimer | Bouton fractionné ; (Alt, R, M 1) | À vérifier | app/panes.tsx (CommentsPane) | P2 | Réponses, résolution |
| R09-008 | Commentaires / Précédent | Bouton ; (Alt, R, P) | À vérifier | app/panes.tsx (CommentsPane) | P2 | Réponses, résolution |
| R09-009 | Commentaires / Suivant | Bouton ; (Alt, R, S) | À vérifier | app/panes.tsx (CommentsPane) | P2 | Réponses, résolution |
| R09-010 | Commentaires / Afficher les commentaires | Bouton fractionné ; (Alt, R, A 2) | À vérifier | app/panes.tsx (CommentsPane) | P2 | Réponses, résolution |
| R09-011 | Entrée manuscrite / Masquer les entrées manuscrites | Bouton fractionné ; (Alt, R, M 2) | Absent |  | P3 |  |

### 1.10 Onglet « Affichage »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R10-001 | Modes de présentation / Normal | Bouton ; (Alt, N, N) | OK | app/ribbon/views.tsx, app/AppViews.tsx | P1 | Trieuse prouvée |
| R10-002 | Modes de présentation / Mode Plan | Bouton ; (Alt, N, D) | À vérifier | app/AppViews.tsx | P2 |  |
| R10-003 | Modes de présentation / Trieuse de diapositives | Bouton ; (Alt, N, I) | OK | app/ribbon/views.tsx, app/AppViews.tsx | P1 | Trieuse prouvée |
| R10-004 | Modes de présentation / Page de notes | Bouton ; (Alt, N, P) | À vérifier | app/AppViews.tsx | P2 |  |
| R10-005 | Modes de présentation / Mode Lecture | Bouton ; (Alt, N, E) | À vérifier | app/AppViews.tsx | P2 |  |
| R10-006 | Modes Masque / Masque des diapositives | Bouton ; (Alt, N, M) | OK | app/App.tsx, app/ribbon/views.tsx | P1 | Prouvé |
| R10-007 | Modes Masque / Masque du document | Bouton ; (Alt, N, A) | Absent |  | P2 | Pas de masque du document ni des notes |
| R10-008 | Modes Masque / Masque des pages de notes | Bouton ; (Alt, N, S) | Absent |  | P2 | Pas de masque du document ni des notes |
| R10-009 | Afficher / Règle | Case à cocher ; (Alt, N, R) | À vérifier | canvas/Rulers.tsx, canvas/Overlay.tsx | P1 | Repères déplaçables ; pas de valeur numérique ni de boîte |
| R10-010 | Afficher / Quadrillage | Case à cocher ; (Alt, N, H) | À vérifier | canvas/Rulers.tsx, canvas/Overlay.tsx | P1 | Repères déplaçables ; pas de valeur numérique ni de boîte |
| R10-011 | Afficher / Repères | Case à cocher ; (Alt, N, È) | À vérifier | canvas/Rulers.tsx, canvas/Overlay.tsx | P1 | Repères déplaçables ; pas de valeur numérique ni de boîte |
| R10-012 | Afficher / Notes | Bouton ; (Alt, N, T) | OK | app/NotesPage.tsx | P2 | Prouvé |
| R10-013 | Afficher / Paramètres de la grille... | Bouton ; (Alt, N, L) | Absent |  | P2 | Pas de boîte (espacement, repères de dessin) |
| R10-014 | Zoom / Zoom... | Bouton ; (Alt, N, 6) | Partiel | app/ribbon/views.tsx | P2 | Menu de pourcentages ; pas de boîte Zoom |
| R10-015 | Zoom / Ajuster à la fenêtre | Bouton ; (Alt, N, U) | À vérifier | app/ribbon/views.tsx | P2 |  |
| R10-016 | Couleur/nuances de gris  / Couleur | Bouton ; (Alt, N, À) | À vérifier | app/ribbon/views.tsx | P3 |  |
| R10-017 | Couleur/nuances de gris  / Nuances de gris | Bouton ; (Alt, N, G) | À vérifier | app/ribbon/views.tsx | P3 |  |
| R10-018 | Couleur/nuances de gris  / Noir et blanc | Bouton ; (Alt, N, Ç) | Absent |  | P3 |  |
| R10-019 | Fenêtre / Nouvelle fenêtre | Bouton ; (Alt, N, O) | Absent |  | P3 | Application mono-fenêtre |
| R10-020 | Fenêtre / Réorganiser tout | Bouton ; (Alt, N, K) | Absent |  | P3 | Application mono-fenêtre |
| R10-021 | Fenêtre / Cascade | Bouton ; (Alt, N, B) | Absent |  | P3 | Application mono-fenêtre |
| R10-022 | Fenêtre / Déplacer le fractionnement | Bouton ; (Alt, N, É) | Absent |  | P3 | Application mono-fenêtre |
| R10-023 | Fenêtre / Changer de fenêtre | Menu/galerie ; (Alt, N, C) | Absent |  | P3 | Application mono-fenêtre |
| R10-024 | Macros / Macros | Bouton ; (Alt, N, 0) | Absent |  | P3 | Macros VBA non exécutées (pptm conservé) |

### 1.11 Onglet « Aide »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R11-001 | Aide / Aide | Bouton ; (Alt, Ù, A 1) | Absent |  | P3 | Pas de rubrique Aide dans le ruban |
| R11-002 | Aide / Contacter le support... | Bouton ; (Alt, Ù, C) | Absent |  | P3 | Pas de rubrique Aide dans le ruban |
| R11-003 | Aide / Commentaires | Bouton ; (Alt, Ù, K) | Absent |  | P3 | Pas de rubrique Aide dans le ruban |
| R11-004 | Aide / Afficher la formation | Bouton ; (Alt, Ù, A 2) | Absent |  | P3 | Pas de rubrique Aide dans le ruban |
| R11-005 | Mobile / Obtenir l’application mobile PowerPoint | Bouton ; (Alt, Ù, O) | Absent |  | P3 | Pas de rubrique Aide dans le ruban |

### 1.12 Onglet « Format de forme »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R12-001 | Insérer des formes > Formes / (galerie) [galerie de 172 éléments] | Menu/galerie | À vérifier | app/ribbon/contextual.tsx | P1 | Galerie des formes dans l’onglet |
| R12-002 | Insérer des formes > Formes / Formes | Bouton ; (Alt, J D, E R) | OK | app/ribbon/contextual.tsx | P1 |  |
| R12-003 | Insérer des formes / Modifier la forme | Menu/galerie ; (Alt, J D, O) | À vérifier | app/ribbon/contextual.tsx (changeShape) | P1 | Changer le préréglage ; la commande « Modifier les points » est absente |
| R12-004 | Insérer des formes / Zone de texte | Bouton ; (Alt, J D, Ç O) | OK | app/ribbon/contextual.tsx | P1 |  |
| R12-005 | Insérer des formes / Fusionner les formes | Menu/galerie ; (Alt, J D, F 1) | Absent |  | P1 | Union, combinaison, intersection, soustraction, fragmentation |
| R12-006 | Styles de formes > Styles rapides / (galerie) [galerie de 77 éléments] | Menu/galerie | À vérifier | app/ribbon/contextual.tsx | P1 | Galerie des formes dans l’onglet |
| R12-007 | Styles de formes > Styles rapides / Styles rapides | Bouton ; (Alt, J D, H T) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R12-008 | Styles de formes / Remplissage | Bouton fractionné ; (Alt, J D, È E) | À vérifier | app/ribbon/contextual.tsx, app/ribbon/shape-menus.tsx | P1 |  |
| R12-009 | Styles de formes / Contour | Bouton fractionné ; (Alt, J D, É O) | À vérifier | app/ribbon/contextual.tsx, app/ribbon/shape-menus.tsx | P1 |  |
| R12-010 | Styles de formes / Effets | Menu/galerie ; (Alt, J D, Ù F) | Partiel | app/ribbon/contextual.tsx, app/ribbon/shape-menus.tsx | P2 | Ombre/réflexion/lumière/bordures adoucies ; pas de biseau ni de rotation 3D |
| R12-011 | Styles de formes / Mise en forme de l’objet... | Bouton ; (Alt, J D, H M) | Partiel | app/panes.tsx | P1 | Volet réduit (voir §4) |
| R12-012 | Styles WordArt > Styles rapides / (galerie) [galerie de 20 éléments] | Menu/galerie | À vérifier | app/ribbon/contextual.tsx | P1 | Galerie des formes dans l’onglet |
| R12-013 | Styles WordArt > Styles rapides / Styles rapides | Bouton ; (Alt, J D, S T) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R12-014 | Styles WordArt / Remplissage du texte | Bouton fractionné ; (Alt, J D, S R) | À vérifier | app/ribbon/contextual.tsx | P2 | Texte en dégradé inclus ; pas de transformation |
| R12-015 | Styles WordArt / Contour du texte | Bouton fractionné ; (Alt, J D, X C) | À vérifier | app/ribbon/contextual.tsx | P2 | Texte en dégradé inclus ; pas de transformation |
| R12-016 | Styles WordArt / Effets de texte | Menu/galerie ; (Alt, J D, F 2) | À vérifier | app/ribbon/contextual.tsx | P2 | Texte en dégradé inclus ; pas de transformation |
| R12-017 | Styles WordArt / Mise en forme des effets de texte... | Bouton ; (Alt, J D, E F) | Absent |  | P2 | Volet Options de texte absent |
| R12-018 | Accessibilité / Texte de remplacement | Bouton ; (Alt, J D, A T) | OK | app/panes.tsx (AltText) | P2 | Volet Accessibilité |
| R12-019 | Organiser / Avancer | Bouton fractionné ; (Alt, J D, È V) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-020 | Organiser / Reculer | Bouton fractionné ; (Alt, J D, 7) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-021 | Organiser / Volet Sélection... | Bouton ; (Alt, J D, 5) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-022 | Organiser / Aligner | Menu/galerie ; (Alt, J D, K L) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-023 | Organiser / Grouper | Menu/galerie ; (Alt, J D, Ù G) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-024 | Organiser / Rotation | Menu/galerie ; (Alt, J D, È R) | À vérifier | app/ribbon/contextual.tsx, canvas/ops.ts | P1 | Logique testée (canvas-ops) ; boutons à vérifier |
| R12-025 | Taille / Hauteur de la forme | Compteur ; (Alt, J D, K A) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R12-026 | Taille / Largeur de la forme | Compteur ; (Alt, J D, G) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R12-027 | Taille / Taille et position... | Bouton ; (Alt, J D, 1) | Partiel | app/panes.tsx | P1 | Volet Format, section Taille et position (pas d’échelle, ni d’options de verrouillage du rapport) |

### 1.13 Onglet « Format de l’image »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R13-001 | Ajuster / Supprimer l’arrière-plan | Bouton ; (Alt, ( J P ), S) | Partiel | app/bg-remove.ts | P2 | Rend une couleur de fond transparente (tolérance) ; pas la segmentation de PowerPoint ni les zones à conserver/supprimer |
| R13-002 | Ajuster / Corrections | Menu/galerie ; (Alt, ( J P ), I) | Partiel | app/ribbon/contextual.tsx | P2 | Luminosité/contraste ; pas de netteté |
| R13-003 | Ajuster / Couleur | Menu/galerie ; (Alt, ( J P ), U) | À vérifier | app/ribbon/contextual.tsx | P2 | Nuances de gris, sépia ; pas de saturation/température |
| R13-004 | Ajuster / Effets artistiques | Menu/galerie ; (Alt, ( J P ), A 1) | Absent |  | P3 |  |
| R13-005 | Ajuster / Transparence | Menu/galerie ; (Alt, ( J P ), T) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R13-006 | Ajuster / Compresser les images... | Bouton ; (Alt, ( J P ), C) | Absent |  | P2 |  |
| R13-007 | Ajuster / Changer d’image | Menu/galerie ; (Alt, ( J P ), E) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R13-008 | Ajuster / Rétablir l'image | Bouton fractionné ; (Alt, ( J P ), R) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R13-009 | Styles d'image > Styles rapides / (galerie) [galerie de 28 éléments] | Menu/galerie | À vérifier | app/ribbon/contextual.tsx | P2 | 7 styles contre 28 |
| R13-010 | Styles d'image > Styles rapides / Styles rapides | Bouton ; (Alt, ( J P ), 9) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R13-011 | Styles d'image / Bordure de l’image | Bouton fractionné ; (Alt, ( J P ), É O) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R13-012 | Styles d'image / Effets d’image | Menu/galerie ; (Alt, ( J P ), F) | Partiel | app/ribbon/contextual.tsx | P2 | Ombre, réflexion ; pas de biseau 3D |
| R13-013 | Styles d'image / Disposition d’image | Menu/galerie ; (Alt, ( J P ), D) | Absent |  | P3 | Conversion image vers SmartArt |
| R13-014 | Styles d'image / Image... | Bouton ; (Alt, ( J P ), O 1) | Partiel | app/panes.tsx | P1 | Volet Format de l’image réduit |
| R13-015 | Accessibilité / Texte de remplacement | Bouton ; (Alt, ( J P ), A T) | OK | app/panes.tsx | P2 |  |
| R13-016 | Organiser / Avancer | Bouton fractionné ; (Alt, ( J P ), È V) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-017 | Organiser / Reculer | Bouton fractionné ; (Alt, ( J P ), 7) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-018 | Organiser / Volet Sélection... | Bouton ; (Alt, ( J P ), 5) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-019 | Organiser / Aligner | Menu/galerie ; (Alt, ( J P ), K L) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-020 | Organiser / Grouper | Menu/galerie ; (Alt, ( J P ), Ù G) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-021 | Organiser / Rotation | Menu/galerie ; (Alt, ( J P ), È R) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-022 | Taille / Rogner | Bouton fractionné ; (Alt, ( J P ), O 2) | Partiel | app/dialogs-image.tsx | P1 | Boîte à valeurs + à la forme + proportions ; pas de poignées de rognage interactives sur la diapositive |
| R13-023 | Taille / Hauteur de la forme | Compteur ; (Alt, ( J P ), K A) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-024 | Taille / Largeur de la forme | Compteur ; (Alt, ( J P ), G) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R13-025 | Taille / Taille et position... | Bouton ; (Alt, ( J P ), 1) | À vérifier | app/ribbon/contextual.tsx | P1 |  |

### 1.14 Onglet « Création de tableau »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R14-001 | Options de style de tableau / Ligne d'en-tête | Case à cocher ; (Alt, J T, I) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-002 | Options de style de tableau / Ligne des totaux | Case à cocher ; (Alt, J T, L) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-003 | Options de style de tableau / Lignes à bandes | Case à cocher ; (Alt, J T, G) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-004 | Options de style de tableau / Première colonne | Case à cocher ; (Alt, J T, M) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-005 | Options de style de tableau / Dernière colonne | Case à cocher ; (Alt, J T, N) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-006 | Options de style de tableau / Colonnes à bandes | Case à cocher ; (Alt, J T, C) | À vérifier | app/ribbon/contextual.tsx | P2 | Options de style |
| R14-007 | Styles de tableau > Styles de tableau / (galerie) [galerie de 74 éléments] | Menu/galerie | Partiel | app/ribbon/contextual.tsx, canvas/table-style.ts | P2 | 19 styles contre 74 ; un style inconnu est rendu en Style moyen 2 |
| R14-008 | Styles de tableau > Styles de tableau / Styles de tableau | Bouton ; (Alt, J T, D) | Partiel | app/ribbon/contextual.tsx, canvas/table-style.ts | P2 | 19 styles contre 74 ; un style inconnu est rendu en Style moyen 2 |
| R14-009 | Styles de tableau / Trame de fond | Bouton fractionné ; (Alt, J T, H T) | À vérifier | app/ribbon/contextual.tsx | P1 | 5 bordures prédéfinies ; pas de styles/épaisseurs de bordure |
| R14-010 | Styles de tableau / Bordures | Bouton fractionné ; (Alt, J T, B) | À vérifier | app/ribbon/contextual.tsx | P1 | 5 bordures prédéfinies ; pas de styles/épaisseurs de bordure |
| R14-011 | Styles de tableau / Aucune bordure | Bouton | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R14-012 | Styles de tableau / Effets | Menu/galerie ; (Alt, J T, Ç) | Absent |  | P3 |  |
| R14-013 | Styles WordArt / Styles rapides | Menu/galerie ; (Alt, J T, S T) | Partiel | app/ribbon/contextual.tsx | P3 | Selon la forme ; pas dans l’onglet Tableau |
| R14-014 | Styles WordArt / Remplissage du texte | Bouton fractionné ; (Alt, J T, S R) | Partiel | app/ribbon/contextual.tsx | P3 | Selon la forme ; pas dans l’onglet Tableau |
| R14-015 | Styles WordArt / Contour du texte | Bouton fractionné ; (Alt, J T, X C) | Partiel | app/ribbon/contextual.tsx | P3 | Selon la forme ; pas dans l’onglet Tableau |
| R14-016 | Styles WordArt / Effets de texte | Menu/galerie ; (Alt, J T, F) | Partiel | app/ribbon/contextual.tsx | P3 | Selon la forme ; pas dans l’onglet Tableau |
| R14-017 | Styles WordArt / Mise en forme des effets de texte... | Bouton ; (Alt, J T, E F) | Absent |  | P3 |  |
| R14-018 | Traçage des bordures / Style du stylo | Liste déroulante ; (Alt, J T, T) | Absent |  | P2 | Traçage de bordures et de tableau absent |
| R14-019 | Traçage des bordures / Épaisseur du stylo | Liste déroulante ; (Alt, J T, U) | Absent |  | P2 | Traçage de bordures et de tableau absent |
| R14-020 | Traçage des bordures / Couleur du stylet | Bouton fractionné ; (Alt, J T, O) | Absent |  | P2 | Traçage de bordures et de tableau absent |
| R14-021 | Traçage des bordures / Dessiner un tableau | Bouton ; (Alt, J T, È) | Absent |  | P2 | Traçage de bordures et de tableau absent |
| R14-022 | Traçage des bordures / Gomme | Bouton ; (Alt, J T, K) | Absent |  | P2 | Traçage de bordures et de tableau absent |

### 1.15 Onglet « Disposition du tableau »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R15-001 | Tableau / Sélectionner | Menu/galerie ; (Alt, J L, F) | Absent |  | P2 | Sélectionner ligne/colonne/tableau |
| R15-002 | Tableau / Afficher le quadrillage | Bouton ; (Alt, J L, Q) | Absent |  | P3 |  |
| R15-003 | Lignes et colonnes / Supprimer | Menu/galerie ; (Alt, J L, D U) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé (app-logic) |
| R15-004 | Lignes et colonnes / Insérer une ligne au-dessus | Bouton ; (Alt, J L, V) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé (app-logic) |
| R15-005 | Lignes et colonnes / Insérer une ligne en dessous | Bouton ; (Alt, J L, E 1) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé (app-logic) |
| R15-006 | Lignes et colonnes / Insérer une colonne à gauche | Bouton ; (Alt, J L, L 1) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé (app-logic) |
| R15-007 | Lignes et colonnes / Insérer une colonne à droite | Bouton ; (Alt, J L, I) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé (app-logic) |
| R15-008 | Fusionner / Fusionner  | Bouton ; (Alt, J L, C E) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé |
| R15-009 | Fusionner / Fractionner... | Bouton ; (Alt, J L, Ç R) | OK | app/ribbon/contextual.tsx, app/table-ops.ts | P1 | Testé ; pas de boîte colonnes/lignes |
| R15-010 | Taille de la cellule / Tableau Hauteur Ligne | Compteur ; (Alt, J L, U) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-011 | Taille de la cellule / Tableau Largeur de colonne | Compteur ; (Alt, J L, L 2) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-012 | Taille de la cellule / Uniformiser les lignes | Bouton ; (Alt, J L, X D) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-013 | Taille de la cellule / Uniformiser les colonnes | Bouton ; (Alt, J L, D D) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-014 | Alignement / Aligner à gauche | Bouton ; (Alt, J L, G L) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-015 | Alignement / Centrer | Bouton ; (Alt, J L, G C) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-016 | Alignement / Aligner à droite | Bouton ; (Alt, J L, W L) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-017 | Alignement / Aligner en haut | Bouton ; (Alt, J L, É) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-018 | Alignement / Centrer verticalement | Bouton ; (Alt, J L, E 2) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-019 | Alignement / Aligner en bas | Bouton ; (Alt, J L, S) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-020 | Alignement / Orientation du texte | Menu/galerie ; (Alt, J L, T) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-021 | Alignement / Marges de cellule | Menu/galerie ; (Alt, J L, M) | Absent |  | P2 |  |
| R15-022 | Taille du tableau / Hauteur  | Compteur ; (Alt, J L, H A) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-023 | Taille du tableau / Largeur  | Compteur ; (Alt, J L, È A) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-024 | Taille du tableau / Conserver les proportions | Case à cocher ; (Alt, J L, O) | Absent |  | P2 |  |
| R15-025 | Organiser / Avancer | Bouton fractionné ; (Alt, J L, È V) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R15-026 | Organiser / Reculer | Bouton fractionné ; (Alt, J L, 7) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R15-027 | Organiser / Volet Sélection... | Bouton ; (Alt, J L, 5) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R15-028 | Organiser / Aligner | Menu/galerie ; (Alt, J L, K L) | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R15-029 | Organiser / Grouper | Menu/galerie ; (Alt, J L, Ù G) | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R15-030 | Organiser / Rotation | Menu/galerie ; (Alt, J L, È R) | À vérifier | app/ribbon/contextual.tsx | P1 |  |

### 1.16 Onglet « Conception de SmartArt »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R16-001 | Créer un graphique / Ajouter une forme | Bouton fractionné ; (Alt, J S, T) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-002 | Créer un graphique / Ajouter une puce | Bouton ; (Alt, J S, U) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-003 | Créer un graphique / Volet Texte | Bouton ; (Alt, J S, X) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-004 | Créer un graphique / Promouvoir | Bouton ; (Alt, J S, P) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-005 | Créer un graphique / Abaisser | Bouton ; (Alt, J S, A 1) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-006 | Créer un graphique / De droite à gauche | Bouton ; (Alt, J S, E) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-007 | Créer un graphique / Déplacer avant  | Bouton ; (Alt, J S, M 1) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-008 | Créer un graphique / Déplacer après | Bouton ; (Alt, J S, A 2) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-009 | Créer un graphique / Disposition | Menu/galerie ; (Alt, J S, N) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-010 | Dispositions > Modifier la disposition / (galerie) [galerie de 38 éléments] | Menu/galerie | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-011 | Dispositions > Modifier la disposition / Modifier la disposition | Bouton ; (Alt, J S, M 2) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-012 | Styles SmartArt / Modifier les couleurs | Menu/galerie ; (Alt, J S, I) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-013 | Styles SmartArt > Styles rapides / (galerie) [galerie de 14 éléments] | Menu/galerie | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-014 | Styles SmartArt > Styles rapides / Styles rapides | Bouton ; (Alt, J S, S) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-015 | Rétablir / Rétablir le graphique | Bouton ; (Alt, J S, R) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |
| R16-016 | Rétablir / Convertir | Menu/galerie ; (Alt, J S, C) | Absent | app/smartart.ts (formes groupées, sans modèle SmartArt) | P1 | Pas d’onglet SmartArt : pas d’ajout de forme/puce, volet Texte, promotion, dispositions, couleurs, styles ; seul « Modifier le SmartArt » (boîte) |

### 1.17 Onglet « Mise en forme (SmartArt) »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R17-001 | Formes / Modifier en 2D | Bouton ; (Alt, J M, M) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-002 | Formes / Modifier la forme | Menu/galerie ; (Alt, J M, U) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-003 | Formes / Plus grand | Bouton ; (Alt, J M, L) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-004 | Formes / Plus petit | Bouton ; (Alt, J M, P) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-005 | Styles de formes > Styles rapides / (galerie) [galerie de 42 éléments] | Menu/galerie | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-006 | Styles de formes > Styles rapides / Styles rapides | Bouton ; (Alt, J M, H T) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-007 | Styles de formes / Remplissage | Bouton fractionné ; (Alt, J M, È E) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-008 | Styles de formes / Contour | Bouton fractionné ; (Alt, J M, É O) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-009 | Styles de formes / Effets | Menu/galerie ; (Alt, J M, Ù F) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-010 | Styles de formes / Mise en forme de l’objet... | Bouton ; (Alt, J M, H M) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-011 | Styles WordArt > Styles rapides / (galerie) [galerie de 20 éléments] | Menu/galerie | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-012 | Styles WordArt > Styles rapides / Styles rapides | Bouton ; (Alt, J M, S T) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-013 | Styles WordArt / Remplissage du texte | Bouton fractionné ; (Alt, J M, S R) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-014 | Styles WordArt / Contour du texte | Bouton fractionné ; (Alt, J M, X C) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-015 | Styles WordArt / Effets de texte | Menu/galerie ; (Alt, J M, F) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-016 | Styles WordArt / Mise en forme des effets de texte... | Bouton ; (Alt, J M, E F) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-017 | Accessibilité / Texte de remplacement | Bouton ; (Alt, J M, A T) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-018 | Organiser / Avancer | Bouton fractionné ; (Alt, J M, È V) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-019 | Organiser / Reculer | Bouton fractionné ; (Alt, J M, 7) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-020 | Organiser / Volet Sélection... | Bouton ; (Alt, J M, 5) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-021 | Organiser / Aligner | Menu/galerie ; (Alt, J M, K L) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-022 | Organiser / Grouper | Menu/galerie ; (Alt, J M, Ù G) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-023 | Organiser / Rotation | Menu/galerie ; (Alt, J M, È R) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-024 | Taille / Hauteur de la forme | Compteur ; (Alt, J M, K A) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-025 | Taille / Largeur de la forme | Compteur ; (Alt, J M, G) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |
| R17-026 | Taille / Taille et position... | Bouton ; (Alt, J M, 1) | Absent | app/smartart.ts | P2 | Pas d’onglet Mise en forme (les formes groupées se règlent comme un groupe) |

### 1.18 Onglet « Audio : Format »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R18-001 | Ajuster / Supprimer l’arrière-plan | Bouton ; (Alt, J P, S) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-002 | Ajuster / Corrections | Menu/galerie ; (Alt, J P, I) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-003 | Ajuster / Couleur | Menu/galerie ; (Alt, J P, U) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-004 | Ajuster / Effets artistiques | Menu/galerie ; (Alt, J P, A) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-005 | Ajuster / Compresser les images... | Bouton ; (Alt, J P, C) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-006 | Ajuster / Changer d’image | Menu/galerie ; (Alt, J P, E) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-007 | Ajuster / Rétablir l'image | Bouton fractionné ; (Alt, J P, R) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-008 | Styles d'image > Styles rapides / (galerie) [galerie de 28 éléments] | Menu/galerie | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-009 | Styles d'image > Styles rapides / Styles rapides | Bouton ; (Alt, J P, 9) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-010 | Styles d'image / Bordure de l’image | Bouton fractionné ; (Alt, J P, É O) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-011 | Styles d'image / Effets d’image | Menu/galerie ; (Alt, J P, F) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-012 | Styles d'image / Disposition d’image | Menu/galerie ; (Alt, J P, D) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-013 | Styles d'image / Image... | Bouton ; (Alt, J P, O 1) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-014 | Organiser / Avancer | Bouton fractionné ; (Alt, J P, È V) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-015 | Organiser / Reculer | Bouton fractionné ; (Alt, J P, 7) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-016 | Organiser / Volet Sélection... | Bouton ; (Alt, J P, 5) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-017 | Organiser / Aligner | Menu/galerie ; (Alt, J P, K L) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-018 | Organiser / Grouper | Menu/galerie ; (Alt, J P, Ù G) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-019 | Organiser / Rotation | Menu/galerie ; (Alt, J P, È R) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-020 | Taille / Rogner | Bouton fractionné ; (Alt, J P, O 2) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-021 | Taille / Hauteur de la forme | Compteur ; (Alt, J P, K A) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-022 | Taille / Largeur de la forme | Compteur ; (Alt, J P, G) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |
| R18-023 | Taille / Taille et position... | Bouton ; (Alt, J P, 1) | Absent |  | P3 | Pas d’onglet Format pour l’audio/vidéo |

### 1.19 Onglet « Audio : Lecture »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R19-001 | Aperçu / Lecture | Bouton ; (Alt, J I 2, E) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-002 | Signets / Ajouter un signet | Bouton ; (Alt, J I 2, O) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-003 | Signets / Supprimer le signet | Bouton ; (Alt, J I 2, S) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-004 | Édition / Découper l’audio | Bouton ; (Alt, J I 2, É) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-005 | Édition / Fondu en entrée | Compteur ; (Alt, J I 2, P) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-006 | Édition / Fondu en sortie | Compteur ; (Alt, J I 2, D 1) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-007 | Options audio / Volume | Menu/galerie ; (Alt, J I 2, V) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-008 | Options audio / Démarrage  | Liste déroulante ; (Alt, J I 2, U) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-009 | Options audio / Lire sur toutes les diapositives | Case à cocher ; (Alt, J I 2, R) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-010 | Options audio / Répéter jusqu’à l’arrêt | Case à cocher ; (Alt, J I 2, B) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-011 | Options audio / Masquer pendant la présentation | Case à cocher ; (Alt, J I 2, Q) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-012 | Options audio / Revenir en arrière après la lecture | Case à cocher ; (Alt, J I 2, M) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-013 | Styles audio / Aucun style | Bouton ; (Alt, J I 2, A) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-014 | Styles audio / Lire en arrière-plan | Bouton ; (Alt, J I 2, L 1) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-015 | Options de légende / Insérer des légendes | Bouton fractionné ; (Alt, J I 2, L 2) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |
| R19-016 | Enregistrer / Enregistrer l’élément multimédia en tant que... | Bouton ; (Alt, J I 2, D 2) | Absent |  | P2 | Aucun onglet Lecture : découpage, fondus, signets, volume, mode de démarrage, boucle, masquer |

### 1.20 Onglet « Masque des diapositives »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R20-001 | Modifier la forme de base / Insérer le masque des diapositives | Bouton ; Ctrl+M (Alt, X, N) | À vérifier | app/ribbon/views.tsx, app/App.tsx | P1 | Insertion/suppression de dispositions : STATUS |
| R20-002 | Modifier la forme de base / Insérer une disposition | Bouton ; (Alt, X, I) | À vérifier | app/ribbon/views.tsx, app/App.tsx | P1 | Insertion/suppression de dispositions : STATUS |
| R20-003 | Modifier la forme de base / Supprimer | Bouton ; (Alt, X, S S) | À vérifier | app/ribbon/views.tsx, app/App.tsx | P1 | Insertion/suppression de dispositions : STATUS |
| R20-004 | Modifier la forme de base / Renommer | Bouton ; (Alt, X, O) | À vérifier | app/ribbon/views.tsx, app/App.tsx | P1 | Insertion/suppression de dispositions : STATUS |
| R20-005 | Modifier la forme de base / Conserver | Bouton ; (Alt, X, C) | Absent |  | P3 |  |
| R20-006 | Mise en page du masque / Mise en page du masque... | Bouton ; (Alt, X, A) | Absent |  | P2 | Cases titre/pieds |
| R20-007 | Mise en page du masque / Insérer un espace réservé | Bouton fractionné ; (Alt, X, V) | Absent |  | P1 | Pas d’ajout d’espaces réservés au masque/disposition |
| R20-008 | Mise en page du masque / Contenu | Bouton | Absent |  | P1 | Pas d’ajout d’espaces réservés au masque/disposition |
| R20-009 | Mise en page du masque / Titre | Case à cocher ; (Alt, X, R) | Absent |  | P2 |  |
| R20-010 | Mise en page du masque / Pieds de page | Case à cocher ; (Alt, X, P) | Absent |  | P2 |  |
| R20-011 | Modifier le thème / Thèmes | Menu/galerie ; (Alt, X, H) | À vérifier | app/ribbon/views.tsx | P2 | Depuis l’onglet Conception |
| R20-012 | Arrière-plan / Couleurs | Menu/galerie ; (Alt, X, U) | À vérifier | app/ribbon/views.tsx | P2 | Depuis l’onglet Conception |
| R20-013 | Arrière-plan / Polices | Menu/galerie ; (Alt, X, L) | À vérifier | app/ribbon/views.tsx | P2 | Depuis l’onglet Conception |
| R20-014 | Arrière-plan / Effets | Menu/galerie ; (Alt, X, É) | À vérifier | app/ribbon/views.tsx | P2 | Depuis l’onglet Conception |
| R20-015 | Arrière-plan / Styles d'arrière-plan | Menu/galerie ; (Alt, X, S T) | À vérifier | app/ribbon/views.tsx | P2 | Depuis l’onglet Conception |
| R20-016 | Arrière-plan / Masquer les graphiques d'arrière-plan | Case à cocher ; (Alt, X, M) | À vérifier | app/ribbon/views.tsx | P2 |  |
| R20-017 | Arrière-plan / Mise en forme de l'arrière-plan... | Bouton ; (Alt, X, F) | À vérifier | app/dialogs.tsx | P2 |  |
| R20-018 | Taille / Taille des diapositives | Menu/galerie ; (Alt, X, T) | À vérifier | app/dialogs.tsx | P2 |  |
| R20-019 | Fermeture / Fermer le mode Masque | Bouton ; (Alt, X, 2) | À vérifier | app/ribbon/views.tsx | P1 |  |

### 1.21 Onglet « Masque : Accueil »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R21-001 | Presse-papiers / Coller | Bouton fractionné ; (Alt, L, V) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-002 | Presse-papiers / Couper | Bouton ; (Alt, L, X) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-003 | Presse-papiers / Copier | Bouton fractionné ; (Alt, L, C) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-004 | Presse-papiers / Reproduire la mise en forme | Bouton ; (Alt, L, W R) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-005 | Presse-papiers / Presse-papiers Office... | Bouton ; (Alt, L, F R) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-006 | Diapositives / Nouvelle diapositive | Bouton fractionné ; (Alt, L, E O) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-007 | Diapositives / Rétablir | Bouton ; (Alt, L, N V) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-008 | Diapositives / Supprimer | Bouton ; (Alt, L, S S) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-009 | Police / Police  | Liste déroulante ; (Alt, L, W P) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-010 | Police / Police  | Champ ; (Alt, L, W P) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-011 | Police / Taille de police  | Liste déroulante ; (Alt, L, G T) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-012 | Police / Taille de police  | Champ ; (Alt, L, G T) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-013 | Police / Augmenter la taille de police | Bouton ; (Alt, L, K A) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-014 | Police / Réduire la taille de police | Bouton ; (Alt, L, K É) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-015 | Police / Effacer la mise en forme | Bouton ; (Alt, L, M F) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-016 | Police / Gras | Bouton ; (Alt, L, 1) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-017 | Police / Italique | Bouton ; (Alt, L, 2) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-018 | Police / Souligner | Bouton ; (Alt, L, 3) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-019 | Police / Ombre | Bouton ; (Alt, L, 5) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-020 | Police / Barré | Bouton ; (Alt, L, 4 1) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-021 | Police / Espacement des caractères | Menu/galerie ; (Alt, L, 6) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-022 | Police / Modifier la casse | Menu/galerie ; (Alt, L, 7) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-023 | Police / Couleur de surbrillance de texte | Bouton fractionné ; (Alt, L, T C) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-024 | Police / Couleur de police | Bouton fractionné ; (Alt, L, G O) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-025 | Police / Police... | Bouton ; (Alt, L, L) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-026 | Paragraphe / Puces | Bouton fractionné ; (Alt, L, Q P) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-027 | Paragraphe / Numérotation | Bouton fractionné ; (Alt, L, Q U) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-028 | Paragraphe / Diminuer le retrait | Bouton ; (Alt, L, D I) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-029 | Paragraphe / Augmenter le retrait | Bouton ; (Alt, L, U A) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-030 | Paragraphe / Interligne | Menu/galerie ; (Alt, L, N I) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-031 | Paragraphe / Aligner à gauche | Bouton ; (Alt, L, G L) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-032 | Paragraphe / Centrer | Bouton ; (Alt, L, G C) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-033 | Paragraphe / Aligner à droite | Bouton ; (Alt, L, W L) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-034 | Paragraphe / Justifier | Bouton ; (Alt, L, U S) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-035 | Paragraphe / Colonnes | Menu/galerie ; (Alt, L, O C) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-036 | Paragraphe / Orientation du texte | Menu/galerie ; (Alt, L, T 1) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-037 | Paragraphe / Aligner le texte | Menu/galerie ; (Alt, L, A) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-038 | Paragraphe / Convertir en graphique SmartArt | Menu/galerie ; (Alt, L, O O) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-039 | Paragraphe / Paragraphe... | Bouton ; (Alt, L, P) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-040 | Dessin > Formes / (galerie) [galerie de 172 éléments] | Menu/galerie | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-041 | Dessin > Formes / Formes | Bouton ; (Alt, L, E R) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-042 | Dessin / Organiser | Menu/galerie ; (Alt, L, 8) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-043 | Dessin / Styles rapides | Menu/galerie ; (Alt, L, H T) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-044 | Dessin / Remplissage | Bouton fractionné ; (Alt, L, È E) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-045 | Dessin / Contour | Bouton fractionné ; (Alt, L, É O) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-046 | Dessin / Effets | Menu/galerie ; (Alt, L, Ù F) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-047 | Dessin / Mise en forme de l’objet... | Bouton ; (Alt, L, H M) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-048 | Édition / Rechercher... | Bouton ; (Alt, L, J) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-049 | Édition / Remplacer... | Bouton fractionné ; (Alt, L, R) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |
| R21-050 | Édition / Sélectionner | Menu/galerie ; (Alt, L, 4 2) | À vérifier | app/ribbon/home.tsx | P2 | Mêmes commandes que l’onglet Accueil, déclinées dans le masque |

### 1.22 Onglet « Masque des pages de notes »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R22-001 | Mise en page / Orientation de la page des notes | Menu/galerie ; (Alt, X, O) | Absent |  | P2 | Masque des pages de notes absent |
| R22-002 | Mise en page / Taille des diapositives | Menu/galerie ; (Alt, X, T) | Absent |  | P2 | Masque des pages de notes absent |
| R22-003 | Espaces réservés / En-tête | Case à cocher ; (Alt, X, A) | Absent |  | P2 | Masque des pages de notes absent |
| R22-004 | Espaces réservés / Image des diapositives | Case à cocher ; (Alt, X, I) | Absent |  | P2 | Masque des pages de notes absent |
| R22-005 | Espaces réservés / Pied de page | Case à cocher ; (Alt, X, P) | Absent |  | P2 | Masque des pages de notes absent |
| R22-006 | Espaces réservés / Date | Case à cocher ; (Alt, X, D) | Absent |  | P2 | Masque des pages de notes absent |
| R22-007 | Espaces réservés / Corps | Case à cocher ; (Alt, X, C) | Absent |  | P2 | Masque des pages de notes absent |
| R22-008 | Espaces réservés / Numéro de page | Case à cocher ; (Alt, X, N) | Absent |  | P2 | Masque des pages de notes absent |
| R22-009 | Modifier le thème / Thèmes | Menu/galerie ; (Alt, X, H) | Absent |  | P2 | Masque des pages de notes absent |
| R22-010 | Arrière-plan / Couleurs | Menu/galerie ; (Alt, X, U) | Absent |  | P2 | Masque des pages de notes absent |
| R22-011 | Arrière-plan / Polices | Menu/galerie ; (Alt, X, L) | Absent |  | P2 | Masque des pages de notes absent |
| R22-012 | Arrière-plan / Effets | Menu/galerie ; (Alt, X, É) | Absent |  | P2 | Masque des pages de notes absent |
| R22-013 | Arrière-plan / Styles d'arrière-plan | Menu/galerie ; (Alt, X, S T) | Absent |  | P2 | Masque des pages de notes absent |
| R22-014 | Arrière-plan / Masquer les graphiques d'arrière-plan | Case à cocher ; (Alt, X, M) | Absent |  | P2 | Masque des pages de notes absent |
| R22-015 | Arrière-plan / Mise en forme de l'arrière-plan... | Bouton ; (Alt, X, F) | Absent |  | P2 | Masque des pages de notes absent |
| R22-016 | Fermeture / Fermer le mode Masque | Bouton ; (Alt, X, 2) | Absent |  | P2 | Masque des pages de notes absent |

### 1.23 Onglet « Masque du document »

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R23-001 | Mise en page / Orientation de page | Menu/galerie ; (Alt, X, O) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-002 | Mise en page / Taille des diapositives | Menu/galerie ; (Alt, X, T) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-003 | Mise en page / Diapositives par page | Menu/galerie ; (Alt, X, I) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-004 | Espaces réservés / En-tête | Case à cocher ; (Alt, X, A) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-005 | Espaces réservés / Pied de page | Case à cocher ; (Alt, X, P) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-006 | Espaces réservés / Date | Case à cocher ; (Alt, X, D) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-007 | Espaces réservés / Numéro de page | Case à cocher ; (Alt, X, N) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-008 | Modifier le thème / Thèmes | Menu/galerie ; (Alt, X, H) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-009 | Arrière-plan / Couleurs | Menu/galerie ; (Alt, X, U) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-010 | Arrière-plan / Polices | Menu/galerie ; (Alt, X, L) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-011 | Arrière-plan / Effets | Menu/galerie ; (Alt, X, É) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-012 | Arrière-plan / Styles d'arrière-plan | Menu/galerie ; (Alt, X, S T) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-013 | Arrière-plan / Masquer les graphiques d'arrière-plan | Case à cocher ; (Alt, X, M) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-014 | Arrière-plan / Mise en forme de l'arrière-plan... | Bouton ; (Alt, X, F) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |
| R23-015 | Fermeture / Fermer le mode Masque | Bouton ; (Alt, X, 2) | Absent |  | P2 | Masque du document absent (seule l’impression 3/6 par page existe) |

### 1.24 Onglets contextuels non capturés (connaissance)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| RX001 | Création de graphique > Dispositions > Ajouter un élément de graphique |  | À vérifier | app/ribbon/contextual.tsx | P1 | titre, étiquettes, quadrillage, légende ; pas d'axes, barres d'erreur, courbe de tendance, lignes de projection |
| RX002 | Création de graphique > Dispositions > Disposition rapide |  | Absent |  | P2 |  |
| RX003 | Création de graphique > Styles > Modifier les couleurs |  | À vérifier | app/ribbon/contextual.tsx | P2 | multicolore/monochrome |
| RX004 | Création de graphique > Styles de graphique (galerie) |  | Partiel | app/ribbon/contextual.tsx | P2 | quelques styles |
| RX005 | Création de graphique > Données > Changer de ligne/colonne |  | Absent |  | P2 |  |
| RX006 | Création de graphique > Données > Sélectionner des données |  | Absent |  | P2 |  |
| RX007 | Création de graphique > Données > Modifier les données |  | À vérifier | app/dialogs.tsx | P1 |  |
| RX008 | Création de graphique > Type > Modifier le type de graphique |  | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| RX009 | Format (graphique) > Sélection active (liste des éléments, mise en forme de la sélection, rétablir) |  | Absent |  | P1 |  |
| RX010 | Format (graphique) > Styles de formes / WordArt / Organiser / Taille |  | Absent |  | P2 |  |
| RX011 | Format de la vidéo > Ajuster (Corrections, Couleur, Cadre d'affiche), Styles de vidéo, Forme de vidéo, Bordure, Effets, Organiser, Taille, Rogner |  | Absent |  | P2 |  |
| RX012 | Lecture (vidéo) > Aperçu, Signets, Édition (découper, fondus), Options vidéo (volume, démarrage, plein écran, masquer, boucle, rembobiner), Styles vidéo, Légendes |  | Absent |  | P2 |  |
| RX013 | Format du zoom > Options de zoom (modifier l'image, retourner à la diapositive de zoom), Styles, Bordure, Effets, Organiser, Taille |  | Absent |  | P3 |  |
| RX014 | Format du modèle 3D > Modèles 3D (Vues du modèle 3D, Panoramique et zoom), Organiser, Taille |  | Absent |  | P3 |  |
| RX015 | Format de l'icône (graphique SVG) > Rétablir, Remplissage graphique, Contour, Effets, Changer le graphique, Convertir en forme |  | Absent |  | P2 | une icône est une image SVG : l'onglet Format de l'image s'applique |
| RX016 | Entrée manuscrite > Outils de stylet contextuels (Convertir en forme, Sélection lasso) |  | Absent |  | P3 |  |
| RX017 | Fichier > Accueil / Nouveau / Ouvrir ... (voir §6) |  | Absent | app/backstage.tsx | P1 |  |
| RX018 | Onglet Aide |  | Absent |  | P3 |  |

## 2. Menus contextuels (clic droit)

Constat code : un seul `shapeMenu` (`app/App.tsx` lignes 330-371) sert pour la forme, le texte, l'image, le tableau, le graphique ; la miniature a son menu (`app/SlidePanel.tsx`) ; les sections aussi. Il n'y a **aucun menu propre** au tableau, au texte, à l'image, au SmartArt, aux notes, au plan, à la trieuse, au diaporama. Le clic droit sur un texte en cours d'édition renvoie le même menu de forme (`CanvasEditor.tsx` lignes 697-707).

### 2.1 Diapositive dans le volet des miniatures (CB « Thumbnails » + menu moderne)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M01-001 | Couper | Ctrl+X | À vérifier | app/SlidePanel.tsx | P1 | le menu ForgeOffice n'a que Copier/Coller ; Ctrl+X gère les diapositives (App.tsx) |
| M01-002 | Copier | Ctrl+C | À vérifier | app/SlidePanel.tsx | P1 |  |
| M01-003 | Coller (options : Conserver la mise en forme source / Utiliser le thème de destination / Image) | Ctrl+V | À vérifier | app/SlidePanel.tsx | P1 | une seule entrée Coller |
| M01-004 | Sélectionner tout | Ctrl+A | Absent |  | P2 |  |
| M01-005 | Nouvelle diapositive | Ctrl+M | À vérifier | app/SlidePanel.tsx | P1 |  |
| M01-006 | Insérer une disposition (en mode Masque) |  | Absent |  | P2 | présent dans le ruban du masque, pas dans le menu |
| M01-007 | Dupliquer la diapositive | Ctrl+D | À vérifier | app/SlidePanel.tsx | P1 |  |
| M01-008 | Supprimer la diapositive | Suppr | À vérifier | app/SlidePanel.tsx | P1 |  |
| M01-009 | Masquer la diapositive / Afficher la diapositive |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| M01-010 | Lien vers cette diapositive (lien de partage) |  | Absent |  | P3 | nécessite un service en ligne |
| M01-011 | Ajouter une section |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| M01-012 | Disposition ▸ (galerie) |  | À vérifier | app/SlidePanel.tsx | P1 |  |
| M01-013 | Conserver le masque / Renommer le masque (mode Masque) |  | Absent |  | P3 |  |
| M01-014 | Publier les diapositives (bibliothèque) / Rechercher les mises à jour |  | Absent |  | P3 | obsolète dans Office |
| M01-015 | Mise en page des diapositives… (Taille des diapositives) |  | Absent |  | P2 | existe dans Conception, pas dans le menu |
| M01-016 | Réinitialiser la diapositive |  | Absent |  | P2 | existe dans le ruban (Rétablir) |
| M01-017 | Arrière-plan… (Format de l'arrière-plan) |  | Absent |  | P2 | existe dans Conception |
| M01-018 | Diaporama (à partir de cette diapositive) |  | Absent |  | P2 |  |
| M01-019 | Insérer un commentaire |  | Absent |  | P2 | existe dans Révision/Insertion |
| M01-020 | Transition ▸ / Exporter la diapositive en image |  | Absent |  | P3 | modernes (K) |

### 2.2 Entre deux diapositives (CB « Slide Gap »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M02-001 | Couper |  | Absent |  | P2 | pas de menu sur l'intervalle entre miniatures |
| M02-002 | Copier |  | Absent |  | P2 |  |
| M02-003 | Coller |  | Absent |  | P2 |  |
| M02-004 | Nouvelle diapositive |  | Absent |  | P2 |  |
| M02-005 | Ajouter une section |  | Absent |  | P2 |  |
| M02-006 | Insérer une disposition |  | Absent |  | P3 |  |

### 2.3 Étiquette de section (CB « Section Label »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M03-001 | Renommer la section |  | À vérifier | app/SlidePanel.tsx (sectionMenu) | P2 |  |
| M03-002 | Supprimer la section |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| M03-003 | Supprimer la section et les diapositives |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| M03-004 | Supprimer toutes les sections |  | Absent |  | P3 | présent dans le ruban uniquement |
| M03-005 | Déplacer la section vers le haut / vers le bas |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| M03-006 | Réduire tout / Développer tout |  | Absent |  | P3 |  |

### 2.4 Espace de travail vide (CB « Frames »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M04-001 | Coller | Ctrl+V | À vérifier | app/App.tsx (shapeMenu) | P1 |  |
| M04-002 | Nouvelle diapositive |  | À vérifier |  | P2 | absent du menu, présent ailleurs : voir ruban |
| M04-003 | Dupliquer la diapositive |  | Absent |  | P2 |  |
| M04-004 | Supprimer la diapositive |  | Absent |  | P2 |  |
| M04-005 | Masquer la diapositive |  | Absent |  | P3 |  |
| M04-006 | Lien vers cette diapositive |  | Absent |  | P3 |  |
| M04-007 | Mise en page des diapositives… |  | Absent |  | P2 |  |
| M04-008 | Réinitialiser la diapositive |  | Absent |  | P2 |  |
| M04-009 | Grille et repères… (ForgeOffice : bascules Quadrillage / Repères / Règle) |  | Partiel | app/App.tsx | P2 | 3 cases à cocher, pas de boîte (espacement, afficher les repères de dessin, aligner) |
| M04-010 | Règle |  | À vérifier | app/App.tsx | P2 |  |
| M04-011 | Enregistrer l'arrière-plan… |  | Absent |  | P3 |  |
| M04-012 | Arrière-plan… / Format de l'arrière-plan |  | À vérifier | app/App.tsx | P2 |  |
| M04-013 | Paramètres des nuances de gris ▸ |  | Absent |  | P3 |  |
| M04-014 | Diaporama |  | Absent |  | P2 |  |
| M04-015 | Insérer un commentaire / Nouveau commentaire |  | À vérifier | app/App.tsx | P2 |  |
| M04-016 | Disposition ▸ |  | À vérifier | app/App.tsx | P2 |  |

### 2.5 Forme, y compris espace réservé et ligne (CB « Shapes », « Connector »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M05-001 | Couper | Ctrl+X | À vérifier | app/App.tsx (shapeMenu) | P1 |  |
| M05-002 | Copier | Ctrl+C | À vérifier | app/App.tsx | P1 |  |
| M05-003 | Copier l'entrée manuscrite comme texte |  | Absent |  | P3 |  |
| M05-004 | Options de collage / Coller | Ctrl+V | À vérifier | app/App.tsx | P1 | options (source/thème/image/texte) seulement dans le ruban |
| M05-005 | Enregistrer en tant qu'image… |  | Absent |  | P1 | export d'une forme en PNG/SVG/EMF |
| M05-006 | Ajouter du texte / Modifier le texte (Entrée ou F2 le font ; pas dans le menu) | F2 | Partiel | canvas/keys.ts | P1 |  |
| M05-007 | Modifier les points (formes libres, courbes) |  | Absent |  | P1 | aucun éditeur de nœuds ; géométrie « custom » non éditable |
| M05-008 | Ouvrir la trajectoire / Fermer la trajectoire |  | Absent |  | P2 |  |
| M05-009 | Police… | Ctrl+T | Absent |  | P1 | boîte Police absente |
| M05-010 | Puces et numéros… |  | Absent |  | P2 |  |
| M05-011 | Regroupement ▸ Grouper | Ctrl+G | À vérifier | app/App.tsx | P1 | ForgeOffice utilise Ctrl+G (Office FR : Ctrl+Alt+G à confirmer) |
| M05-012 | Regroupement ▸ Dissocier | Ctrl+Maj+G | À vérifier | app/App.tsx | P1 |  |
| M05-013 | Regroupement ▸ Regrouper |  | Absent |  | P2 |  |
| M05-014 | Ordre ▸ Premier plan |  | À vérifier | app/App.tsx | P1 |  |
| M05-015 | Ordre ▸ Arrière-plan |  | À vérifier | app/App.tsx | P1 |  |
| M05-016 | Ordre ▸ Avancer / Reculer |  | Absent |  | P1 | présents dans le ruban, pas dans le menu |
| M05-017 | Définir comme forme par défaut (attributs par défaut) |  | Absent |  | P2 |  |
| M05-018 | Paramètres des nuances de gris ▸ |  | Absent |  | P3 |  |
| M05-019 | Personnaliser l'animation… (Ajouter une animation) |  | Absent |  | P2 |  |
| M05-020 | Paramètres des actions… |  | Absent |  | P2 |  |
| M05-021 | Mise en forme de l'objet… (Format de la forme) : ouvre un volet réduit |  | Partiel | app/App.tsx, app/panes.tsx | P1 | voir §4 |
| M05-022 | Lien hypertexte… (Ctrl+K) | Ctrl+K | À vérifier | app/App.tsx | P1 |  |
| M05-023 | Modifier / Ouvrir / Copier / Supprimer le lien hypertexte |  | Absent |  | P1 | seul « Supprimer le lien » existe dans la boîte Lien |
| M05-024 | Rechercher (recherche intelligente) / Définir |  | Absent |  | P3 | service en ligne |
| M05-025 | Synonymes ▸ / Traduire |  | Absent |  | P3 |  |
| M05-026 | Nouveau commentaire |  | À vérifier | app/App.tsx | P2 |  |
| M05-027 | Modifier le texte de remplacement |  | À vérifier | app/App.tsx | P2 | ouvre le volet Accessibilité |
| M05-028 | Taille et position… (volet) |  | Absent |  | P1 | accessible seulement par le volet Format |
| M05-029 | Style / Remplissage / Contour (mini-barre de forme) |  | Absent |  | P1 | voir §3 |
| M05-030 | Réorganiser les connecteurs (Redéfinir les connecteurs) / Connecteur droit-angle-arc |  | Absent |  | P2 | le canvas recale les connecteurs mais aucune commande |

### 2.6 Zone de texte et texte sélectionné (CB « Shapes », « Notes Pane » + moderne)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M06-001 | Mini-barre de mise en forme du texte |  | Absent |  | P1 | voir §3 |
| M06-002 | Couper / Copier / Coller (menu natif de la WebView en édition) |  | Partiel | canvas/CanvasEditor.tsx | P1 | pas de menu ForgeOffice en édition de texte ; l'aspect est celui du système et non d'Office |
| M06-003 | Options de collage (Conserver le format source, Fusionner, Conserver le texte seul) |  | Absent |  | P1 |  |
| M06-004 | Police… |  | Absent |  | P1 |  |
| M06-005 | Paragraphe… |  | Absent |  | P1 |  |
| M06-006 | Puces ▸ / Numérotation ▸ |  | Absent |  | P2 |  |
| M06-007 | Orientation du texte ▸ / Aligner le texte ▸ |  | Absent |  | P2 |  |
| M06-008 | Convertir en graphique SmartArt ▸ |  | Absent |  | P2 |  |
| M06-009 | Lien hypertexte / Modifier le lien |  | Absent |  | P1 | Ctrl+K fonctionne, mais pas via le clic droit sur le texte |
| M06-010 | Orthographe : suggestions, Ignorer tout, Ajouter au dictionnaire |  | Partiel | canvas/CanvasEditor.tsx (onContext) | P1 | en édition de texte avec le correcteur actif, le menu natif de la WebView s'affiche (suggestions) mais aucun menu ForgeOffice : le reste des entrées (Police, Paragraphe, Lien…) est absent |
| M06-011 | Synonymes ▸ / Traduire / Rechercher / Définir |  | Absent |  | P3 |  |
| M06-012 | Nouveau commentaire |  | Absent |  | P2 |  |
| M06-013 | Format de la forme / Format de l'effet de texte |  | Absent |  | P1 |  |

### 2.7 Image (CB « Pictures Context Menu »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M07-001 | Couper / Copier / Coller |  | À vérifier | app/App.tsx | P1 |  |
| M07-002 | Enregistrer en tant qu'image… |  | Absent |  | P1 |  |
| M07-003 | Remplir/Verrouiller l'étiquette |  | Absent |  | P3 | rares |
| M07-004 | Ajouter du texte |  | Absent |  | P3 |  |
| M07-005 | Grouper ▸ ; Ordre ▸ (premier plan / arrière-plan seulement) |  | À vérifier | app/App.tsx | P1 |  |
| M07-006 | Rogner |  | À vérifier | app/App.tsx | P1 | ouvre la boîte à valeurs ; pas de rognage direct sur la diapositive |
| M07-007 | Changer l'image ▸ / Modifier l'image |  | Absent |  | P1 | existe dans l'onglet Format de l'image |
| M07-008 | Style / Bordure (mini-barre d'image) |  | Absent |  | P1 |  |
| M07-009 | Personnaliser l'animation / Paramètres des actions |  | Absent |  | P2 |  |
| M07-010 | Mise en forme de l'objet… (volet Format de l'image) |  | À vérifier | app/panes.tsx | P1 |  |
| M07-011 | Lien hypertexte… ; texte de remplacement |  | À vérifier | app/App.tsx | P2 |  |
| M07-012 | Afficher les outils Image |  | Absent |  | P3 | onglet automatique |

### 2.8 Tableau et cellule (CB « Tables », « Table Cells »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M08-001 | Couper / Copier / Coller |  | Partiel | app/App.tsx | P1 | menu de forme générique, aucun menu propre au tableau |
| M08-002 | Police… ; Puces et numéros… |  | Absent |  | P1 |  |
| M08-003 | Insérer ▸ (colonnes à gauche/droite, lignes au-dessus/en dessous) |  | Absent |  | P1 | présents dans l'onglet Disposition, pas dans le menu |
| M08-004 | Supprimer les cellules… / Supprimer la ligne / la colonne |  | Absent |  | P1 |  |
| M08-005 | Fusionner les cellules |  | Absent |  | P1 |  |
| M08-006 | Fractionner les cellules… |  | Absent |  | P1 |  |
| M08-007 | Bordures et trame… |  | Absent |  | P1 |  |
| M08-008 | Sélectionner le tableau / la ligne / la colonne |  | Absent |  | P1 |  |
| M08-009 | Alignement vertical de la cellule / Direction du texte |  | Absent |  | P2 |  |
| M08-010 | Uniformiser la hauteur des lignes / la largeur des colonnes |  | Absent |  | P2 |  |
| M08-011 | Style de tableau (mini-barre : Style, Trame, Bordures) |  | Absent |  | P1 |  |
| M08-012 | Lien hypertexte ; Synonymes ; Rechercher |  | Absent |  | P3 |  |
| M08-013 | Enregistrer en tant qu'image… |  | Absent |  | P2 |  |

### 2.9 Graphique

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M09-001 | Modifier les données… (boîte feuille de données) |  | À vérifier | app/App.tsx, app/dialogs.tsx | P1 |  |
| M09-002 | Sélectionner les données… |  | Absent |  | P2 |  |
| M09-003 | Modifier le type de graphique… |  | Absent |  | P1 | existe dans l'onglet Création de graphique |
| M09-004 | Ajouter un élément de graphique ▸ / Disposition rapide |  | Absent |  | P2 |  |
| M09-005 | Mise en forme de la série / de l'axe / de la légende… (volet par élément) |  | Absent |  | P1 | aucune mise en forme par élément |
| M09-006 | Réinitialiser pour faire correspondre au style |  | Absent |  | P3 |  |
| M09-007 | Mini-barre de graphique (+ Éléments, Styles, Filtres) |  | Absent |  | P2 |  |

### 2.10 SmartArt (CB « Diagram »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M10-001 | Modifier le SmartArt (boîte de saisie) |  | Partiel | app/smartart.ts | P1 | SmartArt = formes groupées ; menu de groupe |
| M10-002 | Ajouter une forme / Supprimer la forme |  | Absent |  | P1 |  |
| M10-003 | Afficher le volet Texte |  | Absent |  | P1 |  |
| M10-004 | Promouvoir / Abaisser / Déplacer |  | Absent |  | P2 |  |
| M10-005 | Utiliser la mise en forme automatique |  | Absent |  | P3 |  |
| M10-006 | Mettre en forme de l'objet… |  | Absent |  | P2 |  |

### 2.11 Vidéo / audio

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M11-001 | Lecture / Pause |  | Absent |  | P2 |  |
| M11-002 | Rogner la vidéo/l'audio |  | Absent |  | P2 |  |
| M11-003 | Démarrage : au clic / automatique ; boucle ; volume |  | Absent |  | P2 |  |
| M11-004 | Style (mini-barre) |  | Absent |  | P3 |  |
| M11-005 | Mise en forme de l'objet… (volet) |  | À vérifier | app/panes.tsx | P2 |  |

### 2.12 Groupe

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M12-001 | Regroupement ▸ Dissocier |  | À vérifier | app/App.tsx | P1 |  |
| M12-002 | Regroupement ▸ Regrouper |  | Absent |  | P2 |  |
| M12-003 | Ordre ▸ Premier plan / Arrière-plan |  | À vérifier | app/App.tsx | P1 |  |
| M12-004 | Entrer dans le groupe (clic sur un enfant) |  | Absent |  | P1 | le canvas sélectionne l'enfant au second clic ou au double-clic (STATUS) : à vérifier |

### 2.13 Notes (CB « Notes Pane »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M13-001 | Couper / Copier / Coller |  | Partiel | app/AppViews.tsx (textarea) | P1 | champ <textarea> : menu natif de la WebView |
| M13-002 | Reconvertir / Police… / Rechercher… / Définir |  | Absent |  | P3 |  |
| M13-003 | Synonymes ▸ |  | Absent |  | P3 |  |
| M13-004 | Mini-barre de mise en forme dans les notes |  | Absent |  | P2 | le volet de notes est du texte brut |

### 2.14 Masque et dispositions (mode Masque)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M14-001 | Insérer une disposition |  | À vérifier | app/ribbon/views.tsx | P1 |  |
| M14-002 | Renommer la disposition |  | À vérifier | app/ribbon/views.tsx | P2 |  |
| M14-003 | Supprimer la disposition |  | À vérifier | app/ribbon/views.tsx | P2 |  |
| M14-004 | Conserver le masque |  | Absent |  | P3 |  |
| M14-005 | Dupliquer la disposition |  | Absent |  | P2 |  |
| M14-006 | Insérer un espace réservé ▸ (Contenu, Texte, Image, Graphique, Tableau, SmartArt, Média, En ligne) |  | Absent |  | P1 |  |
| M14-007 | Mise en page du masque… (cases Titre, Pieds de page) |  | Absent |  | P2 |  |

### 2.15 Diaporama : clic droit en cours de présentation (CB « Slide Show »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M15-001 | Clic droit = reculer (Office : ouvre un menu) |  | Partiel | app/SlideShow.tsx | P1 | comportement différent d'Office |
| M15-002 | Suivante / Précédente / Dernier affiché |  | Absent |  | P2 | touches OK, pas de menu |
| M15-003 | Afficher toutes les diapositives (G) | G | À vérifier | app/SlideShow.tsx | P2 |  |
| M15-004 | Agrandir la diapositive / Zoom arrière |  | Absent |  | P2 |  |
| M15-005 | Diaporama personnalisé ▸ |  | Absent |  | P2 |  |
| M15-006 | Mode Présentateur |  | À vérifier | app/SlideShow.tsx | P1 |  |
| M15-007 | Écran ▸ Écran noir / Écran blanc | B / W | À vérifier | app/SlideShow.tsx | P2 |  |
| M15-008 | Écran ▸ Masquer les entrées manuscrites / Afficher la barre des tâches |  | Absent |  | P3 |  |
| M15-009 | Options du pointeur ▸ Pointeur laser / Stylet / Surligneur / Gomme / Effacer l'encre | Ctrl+L/P/I, E | À vérifier | app/SlideShow.tsx | P1 |  |
| M15-010 | Couleur de l'entrée manuscrite ; Options des flèches de direction |  | Absent |  | P2 |  |
| M15-011 | Caméra ; Aide ; Pause ; Suspendre l'enregistrement |  | Absent |  | P3 |  |
| M15-012 | Arrêter le diaporama | Échap | À vérifier | app/SlideShow.tsx | P1 |  |

### 2.16 Autres menus contextuels (CB : Spelling, Hyperlinked Object, Comment Popup, Curve, Curve Node, Curve Segment, Rotate Mode, OLE Object, WordArt Context Menu, Canvas Popup, Slider Sorter, Outliner)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M16-001 | Orthographe : Ignorer tout, Ignorer, Ajouter au dictionnaire, suggestions |  | Partiel | canvas/CanvasEditor.tsx | P1 | menu natif de la WebView (apparence et entrées dépendantes du système) |
| M16-002 | Objet avec lien : Ouvrir le lien hypertexte, Copier le lien, Ajouter aux Favoris |  | Absent |  | P2 |  |
| M16-003 | Commentaire : Modifier / Copier le texte / Supprimer / Insérer |  | À vérifier | app/panes.tsx | P2 | dans le volet Commentaires |
| M16-004 | Courbe : Modifier les points, Ouvrir/Fermer la trajectoire, Ajouter/Supprimer un point, segment droit/courbe, point automatique/lisse/continu/d'angle, Quitter Modifier le point |  | Absent |  | P1 | aucune édition de points |
| M16-005 | Mode rotation : Désactiver le mode rotation |  | Absent |  | P3 |  |
| M16-006 | Objet OLE : Modifier l'objet, Convertir en équation Office, Mettre à jour les liaisons |  | Absent |  | P3 |  |
| M16-007 | WordArt : Modifier le texte… |  | Absent |  | P2 |  |
| M16-008 | Trieuse : Couper, Copier, Coller, Nouvelle diapositive, Supprimer, Ajouter une section, Masquer, Arrière-plan, Rechercher les mises à jour |  | Absent |  | P1 | la trieuse partage le menu des miniatures à vérifier |
| M16-009 | Mode Plan : Réduire, Développer, Promouvoir, Abaisser, Monter, Descendre, Résumer la diapositive, Afficher la mise en forme |  | Absent |  | P2 |  |

## 3. Mini-barre flottante

PowerPoint 365 affiche une mini-barre au-dessus d'une sélection de texte et, au clic droit, au-dessus du menu pour les formes, images, tableaux. ForgeOffice n'en a aucune sur bureau ; la `ObjectBar` (dupliquer, premier plan, supprimer, plus) est réservée au tactile.

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| MB001 | Mini-barre de texte : Police + Taille |  | Absent |  | P1 | apparaît au-dessus de la sélection de texte, s'estompe puis suit le curseur |
| MB002 | Mini-barre de texte : Agrandir / Réduire la police |  | Absent |  | P1 |  |
| MB003 | Mini-barre de texte : Gras, Italique, Souligner |  | Absent |  | P1 |  |
| MB004 | Mini-barre de texte : Couleur de surbrillance, Couleur de police |  | Absent |  | P1 |  |
| MB005 | Mini-barre de texte : Puces, Numérotation, Diminuer / Augmenter le retrait |  | Absent |  | P1 |  |
| MB006 | Mini-barre de texte : Aligner à gauche / Centrer / Aligner à droite |  | Absent |  | P1 |  |
| MB007 | Mini-barre de texte : Reproduire la mise en forme |  | Absent |  | P2 |  |
| MB008 | Mini-barre de texte : Styles (styles rapides) |  | Absent |  | P2 |  |
| MB009 | Mini-barre de texte : Nouveau commentaire |  | Absent |  | P3 |  |
| MB010 | Mini-barre de forme : Style (galerie) + Remplissage + Contour |  | Absent |  | P1 | apparaît avec le clic droit sur une forme |
| MB011 | Mini-barre d'image : Style, Rogner, Bordure |  | Absent |  | P1 |  |
| MB012 | Mini-barre de tableau : Style, Trame, Bordures, Insérer, Supprimer |  | Absent |  | P1 |  |
| MB013 | Mini-barre de graphique : Éléments, Styles, Filtres (boutons à droite) |  | Absent |  | P2 |  |
| MB014 | Barre d'objets flottante (dupliquer, premier plan, supprimer, plus) : tactile seulement |  | Partiel | canvas/ObjectBar.tsx | P1 | rendue uniquement si device.form != desktop (CanvasEditor.tsx ligne 762) ; rien sur bureau |
| MB015 | Poignées d'action contextuelles (disposition, rotation, bouton « Concepteur ») |  | Absent |  | P2 |  |

## 4. Boîtes de dialogue et volets

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| D001 | Volet Format de la forme : onglet Options de forme > Remplissage et trait : Remplissage (aucun / uni / dégradé préréglé) |  | Partiel | app/panes.tsx (FormatPane) | P1 | manquent : dégradé (arrêts, angle, type), image/texture, motif, arrière-plan, transparence |
| D002 | Volet Format > Remplissage : Dégradé (arrêts de dégradé, position, transparence, luminosité, type, direction, angle) |  | Absent |  | P1 |  |
| D003 | Volet Format > Remplissage : Image ou texture (insérer, mosaïque, décalage, échelle, alignement, miroir) |  | Absent |  | P2 |  |
| D004 | Volet Format > Remplissage : Motif |  | Absent |  | P2 |  |
| D005 | Volet Format > Remplissage : transparence (curseur) |  | Absent |  | P1 |  |
| D006 | Volet Format > Trait : couleur + épaisseur |  | Partiel | app/panes.tsx | P1 | manquent : trait dégradé, transparence, type composé, tirets, extrémités, jointures, flèches (existent dans le ruban) |
| D007 | Volet Format > Trait : type composé, type de tirets, type de terminaison, type de jointure, flèches début/fin |  | Absent |  | P1 | existent seulement via le menu Contour du ruban |
| D008 | Volet Format > Effets > Ombre (prédéfini, couleur, transparence, taille, flou, angle, distance) |  | Absent |  | P1 | ombre préréglée via le ruban seulement |
| D009 | Volet Format > Effets > Réflexion / Lumière / Contours adoucis (paramètres) |  | Absent |  | P2 | préréglages via le ruban |
| D010 | Volet Format > Effets > Format 3D (biseau, profondeur, contour, matière, éclairage) et Rotation 3D |  | Absent |  | P3 | le rendu ne gère pas la 3D |
| D011 | Volet Format > Taille et propriétés > Taille et position (hauteur, largeur, rotation, X, Y) |  | Partiel | app/panes.tsx | P1 | manquent : échelle, verrouiller le rapport, position depuis le coin / le centre |
| D012 | Volet Format > Taille : Verrouiller le rapport hauteur/largeur ; Échelle ; Taille d'origine |  | Absent |  | P1 |  |
| D013 | Volet Format > Zone de texte : renvoi à la ligne, marges, ajustement automatique |  | Partiel | app/panes.tsx | P1 | manque : alignement vertical, direction, ne pas faire pivoter le texte, colonnes (marge) |
| D014 | Volet Format > Texte de remplacement (titre/description, décoratif) |  | À vérifier | app/panes.tsx | P2 |  |
| D015 | Volet Format > Options de texte : remplissage et contour du texte, effets de texte, zone de texte |  | Absent |  | P1 | aucun volet Options de texte |
| D016 | Volet Format de l'image : Corrections (netteté, luminosité, contraste), Couleur (saturation, température, recoloration), Rogner (position, rapport) |  | Absent |  | P2 | volet limité à la forme |
| D017 | Volet Format de l'arrière-plan (uni, dégradé, image, appliquer partout, rétablir) |  | À vérifier | app/dialogs.tsx | P1 | présent comme boîte ; manquent motif, texture, transparence, masquer les graphiques d'arrière-plan depuis le volet |
| D018 | Volet Animation (liste, ordre, lecture, suppression) |  | OK | app/panes.tsx (AnimationPane) | P1 |  |
| D019 | Volet Animation : menu de l'élément (Démarrer au clic/avec/après, Options d'effet, Minutage, Masquer le minutage avancé, Supprimer) |  | Absent |  | P1 |  |
| D020 | Boîte Options d'effet (onglets Effet, Minutage, Animation du texte) : son, après animation, texte par mot/lettre, répétition, retour arrière, déclencheur |  | Absent |  | P1 |  |
| D021 | Volet Sélection (liste, renommer, afficher/masquer, ordre) |  | À vérifier | app/panes.tsx (SelectionPane) | P1 |  |
| D022 | Concepteur |  | OK | app/designer.ts, app/panes.tsx | P2 | prouvé dans le banc |
| D023 | Boîte Dimensions des diapositives (13 formats, personnalisé, orientation, ajuster/agrandir) |  | À vérifier | app/dialogs.tsx | P1 |  |
| D024 | Boîte Mise en forme de l'arrière-plan |  | À vérifier | app/dialogs.tsx | P1 |  |
| D025 | Boîte Paramètres du diaporama (type : orateur / individuel / kiosque ; boucle ; sans narration ; sans animation ; stylet/laser ; plage ; avancer ; moniteur ; résolution) |  | Absent |  | P1 |  |
| D026 | Boîte Diaporama personnalisé |  | Absent |  | P2 |  |
| D027 | Boîte Options PowerPoint : Général, Affichage, Vérification, Enregistrement, Langue, Accessibilité, Options avancées, Personnaliser le ruban, Barre d'outils Accès rapide, Compléments, Centre de gestion de la confidentialité |  | Absent | app/backstage.tsx | P1 | ForgeOffice : un seul réglage (nom d'auteur) + quelques réglages dans le TitleBar (QAT personnalisable) |
| D028 | Boîte Police (Police, Style, Taille, Effets : barré, double barré, exposant, indice, ombre, relief, majuscules/petites majuscules, espacement, décalage ; Avancé) |  | Absent |  | P1 |  |
| D029 | Boîte Paragraphe (alignement, retrait avant texte/première ligne/suspendu, espacement avant/après, interligne multiple/exactement, Tabulations) |  | Absent |  | P1 |  |
| D030 | Boîte Tabulations |  | Absent |  | P2 |  |
| D031 | Boîte Puces et numérotation (puce image, symbole, couleur, taille, commencer à) |  | Absent |  | P2 |  |
| D032 | Boîte Insérer un tableau |  | À vérifier | app/dialogs-insert.tsx | P2 |  |
| D033 | Boîte Insérer un graphique (galerie par catégorie) |  | À vérifier | app/ribbon/insert.tsx | P1 | menu de 10 types, pas de boîte « Tous les graphiques » avec aperçus |
| D034 | Boîte Modifier les données du graphique (feuille) |  | À vérifier | app/dialogs.tsx | P1 | pas d'import Excel, pas de formules |
| D035 | Boîte Lien hypertexte |  | À vérifier | app/dialogs-insert.tsx | P1 |  |
| D036 | Boîte Paramètres des actions (clic / survol) |  | Absent |  | P2 |  |
| D037 | Boîte Rogner (valeurs) |  | À vérifier | app/dialogs-image.tsx | P1 |  |
| D038 | Boîte Supprimer l'arrière-plan (couleur + tolérance) |  | À vérifier | app/bg-remove.ts, app/dialogs-image.tsx | P2 | différent de la segmentation PowerPoint |
| D039 | Boîte Équation (LaTeX) |  | À vérifier | app/equation.ts | P2 |  |
| D040 | Boîte SmartArt (type + éléments) |  | À vérifier | app/smartart.ts | P1 | pas de choix par bibliothèque |
| D041 | Boîte En-tête et pied de page |  | À vérifier | app/dialogs-insert.tsx | P2 | pas d'onglet Pages de commentaires et documents |
| D042 | Boîte Rechercher / Remplacer |  | À vérifier | app/dialogs.tsx | P2 |  |
| D043 | Boîte Symbole |  | À vérifier | app/ribbon/insert.tsx | P3 | liste réduite, pas de sous-ensembles Unicode |
| D044 | Volet Orthographe (suggestions, ignorer, ajouter) |  | Absent |  | P1 |  |
| D045 | Volet Dictionnaire des synonymes |  | Absent |  | P3 |  |
| D046 | Volet Commentaires |  | À vérifier | app/panes.tsx | P2 |  |
| D047 | Volet Accessibilité (Vérificateur) |  | Partiel | app/panes.tsx | P2 | trois contrôles seulement |
| D048 | Boîte Format du quadrillage (Paramètres de la grille) |  | Absent |  | P2 |  |
| D049 | Boîte Zoom (pourcentage, ajuster, 200 %…) |  | Absent |  | P2 |  |
| D050 | Boîte Enregistrer sous (volet Cloud) : OneDrive |  | Absent |  | P3 | local uniquement |
| D051 | Boîte Propriétés du document |  | À vérifier | app/backstage.tsx | P2 | titre, objet, auteur, mots clés |
| D052 | Boîte Vérifier la compatibilité / Inspecteur de document (suppression des métadonnées) |  | Absent |  | P2 | inspection en lecture seule |
| D053 | Boîte Macros / Visual Basic / Compléments |  | Absent |  | P3 |  |
| D054 | Boîte Couleurs personnalisées (sélecteur HSL/RVB, pipette) |  | Absent |  | P1 | toutes les palettes sont limitées au thème + standard |
| D055 | Boîte Mise en forme des puces d'un SmartArt / convertir texte en SmartArt |  | Absent |  | P3 |  |
| D056 | Boîte Insérer une vidéo en ligne / Images en ligne / Images de stock |  | Absent |  | P3 |  |
| D057 | Boîte Choix de la langue de vérification |  | Absent |  | P3 |  |

## 5. Raccourcis clavier

Source des touches d'accès : U (colonne « key » du ruban, ex. Alt, L = Accueil). Raccourcis standard : K, FR. Les raccourcis français sont parfois différents de l'anglais (Gras = Ctrl+G) ; ForgeOffice accepte Ctrl+B et Ctrl+G pour Gras mais Ctrl+G sert aussi à Grouper (`app/App.tsx`, `canvas/keys.ts`) : collision à trancher.

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| K001 | Nouvelle présentation | Ctrl+N | À vérifier |  | P2 | non géré dans App.tsx (Backstage Nouveau) |
| K002 | Ouvrir | Ctrl+O | À vérifier | app/App.tsx | P1 |  |
| K003 | Enregistrer | Ctrl+S | OK | app/App.tsx | P1 | prouvé |
| K004 | Enregistrer sous | F12 (ForgeOffice : Maj+Ctrl+S) | À vérifier | app/App.tsx | P2 | F12 absent |
| K005 | Fermer la présentation | Ctrl+W / Ctrl+F4 | Absent |  | P2 |  |
| K006 | Imprimer | Ctrl+P | À vérifier | app/App.tsx | P2 |  |
| K007 | Annuler | Ctrl+Z | OK | app/App.tsx | P1 | prouvé |
| K008 | Rétablir / Répéter | Ctrl+Y / F4 | À vérifier | app/App.tsx | P1 | F4 (répéter) absent |
| K009 | Nouvelle diapositive | Ctrl+M | À vérifier | app/App.tsx | P1 |  |
| K010 | Dupliquer | Ctrl+D | À vérifier | canvas/keys.ts | P1 |  |
| K011 | Rechercher | Ctrl+F | À vérifier | app/App.tsx | P2 |  |
| K012 | Remplacer | Ctrl+H | À vérifier | app/App.tsx | P2 |  |
| K013 | Lien hypertexte | Ctrl+K | À vérifier | app/App.tsx | P1 |  |
| K014 | Gras | Ctrl+G (FR) / Ctrl+B | À vérifier | app/App.tsx | P1 | Ctrl+G sert aussi à Grouper : conflit d'usage dans ForgeOffice, à trancher |
| K015 | Italique | Ctrl+I | À vérifier | app/App.tsx | P1 |  |
| K016 | Souligné | Ctrl+U | À vérifier | app/App.tsx | P1 |  |
| K017 | Centrer / Gauche / Droite / Justifier | Ctrl+E / Ctrl+L / Ctrl+R / Ctrl+J | À vérifier | app/App.tsx | P1 | raccourcis FR à confirmer pour gauche/droite |
| K018 | Agrandir / Réduire la police | Ctrl+Maj+> / Ctrl+Maj+< (Ctrl+] / Ctrl+[) | À vérifier | app/App.tsx | P1 |  |
| K019 | Copier / Coller la mise en forme | Ctrl+Maj+C / Ctrl+Maj+V | À vérifier | app/App.tsx | P1 |  |
| K020 | Exposant / Indice | Ctrl+Maj+= / Ctrl+= | Absent |  | P2 |  |
| K021 | Boîte Police | Ctrl+T | Absent |  | P2 |  |
| K022 | Effacer la mise en forme | Ctrl+Espace | Absent |  | P2 |  |
| K023 | Collage spécial | Ctrl+Alt+V | Absent |  | P2 |  |
| K024 | Couper / Copier / Coller | Ctrl+X / C / V | À vérifier | app/App.tsx | P1 |  |
| K025 | Tout sélectionner | Ctrl+A | À vérifier | canvas/keys.ts | P1 |  |
| K026 | Grouper | Ctrl+G (FR : à confirmer) ; Dissocier Ctrl+Maj+G | À vérifier | canvas/keys.ts | P1 |  |
| K027 | Déplacer l'objet d'un pas (flèches) ; pas fin : Ctrl+flèches | flèches | À vérifier | canvas/keys.ts | P1 |  |
| K028 | Rotation par pas (Alt+flèches) | Alt+flèches | À vérifier | canvas/keys.ts | P2 |  |
| K029 | Passer à l'objet suivant | Tab | À vérifier | canvas/keys.ts | P2 |  |
| K030 | Modifier le texte de la forme | F2 / Entrée | À vérifier | canvas/keys.ts | P1 |  |
| K031 | Supprimer | Suppr | À vérifier | canvas/keys.ts | P1 |  |
| K032 | Annuler la sélection / l'outil | Échap | À vérifier | canvas/keys.ts, app/App.tsx | P1 |  |
| K033 | Mettre au premier plan / à l'arrière-plan | Ctrl+Maj+] / Ctrl+Maj+[ (K) | Absent |  | P2 |  |
| K034 | Ouvrir le volet Format | Ctrl+1 | Absent |  | P2 |  |
| K035 | Zoom : Ctrl+molette | Ctrl+molette | À vérifier | canvas/CanvasEditor.tsx | P2 | implémenté dans le canvas |
| K036 | Diapositive précédente/suivante dans le volet | Page préc./suiv. | Absent |  | P2 |  |
| K037 | Réorganiser les diapositives au clavier | Ctrl+Maj+Haut/Bas | Absent |  | P2 |  |
| K038 | Nouveau commentaire | Ctrl+Alt+M | Absent |  | P2 |  |
| K039 | Aller à la diapositive… |  | Absent |  | P3 |  |
| K040 | Diaporama depuis le début | F5 | OK | app/App.tsx | P1 | prouvé |
| K041 | Depuis la diapositive actuelle | Maj+F5 | OK | app/App.tsx | P1 | prouvé |
| K042 | Mode Présentateur | Alt+F5 | OK | app/App.tsx | P1 | prouvé |
| K043 | Diapositive suivante | Entrée, Espace, N, Page suiv., flèches, clic | À vérifier | app/SlideShow.tsx | P1 |  |
| K044 | Diapositive précédente | P, Retour arrière, Page préc., flèches | À vérifier | app/SlideShow.tsx | P1 |  |
| K045 | Première/dernière | Début / Fin | À vérifier | app/SlideShow.tsx | P2 |  |
| K046 | Aller à la diapositive n | n + Entrée | À vérifier | app/SlideShow.tsx | P2 |  |
| K047 | Écran noir / blanc | B ou . / W ou , | À vérifier | app/SlideShow.tsx | P2 |  |
| K048 | Voir toutes les diapositives | G | À vérifier | app/SlideShow.tsx | P2 |  |
| K049 | Stylet / Surligneur / Laser | Ctrl+P / Ctrl+I / Ctrl+L | À vérifier | app/SlideShow.tsx | P2 |  |
| K050 | Effacer l'encre | E | À vérifier | app/SlideShow.tsx | P2 |  |
| K051 | Quitter le diaporama | Échap | À vérifier | app/SlideShow.tsx | P1 |  |
| K052 | Afficher/masquer le pointeur (A / =), Ctrl+H, Ctrl+U |  | Absent |  | P3 |  |
| K053 | Zoom pendant le diaporama (+ / -) |  | Absent |  | P3 |  |
| K054 | Ouvrir la barre de navigation du diaporama (Ctrl+S dans le diaporama = liste) |  | Absent |  | P3 |  |
| K055 | Touches d'accès (Alt puis lettre) : navigation par KeyTips | Alt, L, S, J... | Absent |  | P2 | raccourcis Alt+lettre des onglets UIA (ex. Alt, L = Accueil) |
| K056 | F1 Aide ; F7 Orthographe ; Maj+F7 Synonymes | F1 / F7 | Absent |  | P2 |  |
| K057 | Ctrl+F6, F6 : changer de volet | F6 | Absent |  | P2 |  |
| K058 | Ctrl+Maj+F : police ; Ctrl+Maj+P : taille |  | Absent |  | P3 |  |
| K059 | Maj+Alt+flèches : déplacer dans le plan |  | Absent |  | P3 |  |

## 6. Backstage (onglet Fichier)

Navigation réelle (U) : Précédent, Accueil, Nouveau, Ouvrir, Partager, Informations, Enregistrer, Enregistrer sous, Historique, Imprimer, Exporter, Fermer, Compte, Options (touches : Alt, F, puis L, N, W, P, X, T, U, K, P, I, K, R, V).

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| B001 | Accueil (Nouveau, modèles récents, Ouvrir récent) |  | À vérifier | app/backstage.tsx | P1 | écran d'accueil du Backstage ; modèles Office remplacés par 8 thèmes |
| B002 | Nouveau (vierge ou thème, recherche de modèles en ligne, suggestions) |  | À vérifier | app/backstage.tsx | P2 | vierge ou par thème, pas de recherche en ligne |
| B003 | Ouvrir (Récent, Ce PC, OneDrive, Parcourir, Récupérer les présentations non enregistrées) | Ctrl+O | À vérifier | app/fileops.ts | P1 | ouverture locale + récupération IndexedDB (bandeau) |
| B004 | Partager (inviter, lien, joindre une copie PPTX/PDF) |  | Absent |  | P3 | local uniquement par décision |
| B005 | Informations (propriétés, inspection, versions) |  | À vérifier | app/backstage.tsx | P2 |  |
| B006 | Informations > Protéger la présentation (mot de passe, marquer comme final) |  | Absent |  | P2 |  |
| B007 | Informations > Vérifier l'absence de problèmes (Inspecter, Vérifier l'accessibilité, la compatibilité) |  | Partiel | app/backstage.tsx | P2 | inspection : compteurs seulement |
| B008 | Informations > Gérer la présentation (historique des versions, récupérer) |  | Absent |  | P2 | récupération auto toutes les 30 s existe |
| B009 | Enregistrer | Ctrl+S | OK | app/fileops.ts | P1 | prouvé |
| B010 | Enregistrer sous (pptx, pptm, potx, potm, ppsx, ppsm) | F12 | À vérifier | app/backstage.tsx | P1 |  |
| B011 | Historique (versions) |  | Absent |  | P3 |  |
| B012 | Imprimer (diapositives, commentaires, documents 3/6, plages, masquées, aperçu) | Ctrl+P | À vérifier | app/backstage.tsx | P1 | aperçu prouvé, déclenchement réel de l'impression à contrôler |
| B013 | Imprimer : classement, copies, couleur/nuances de gris, en-tête et pied de page, propriétés de l'imprimante, documents 1/2/4/9 par page, contours, haute qualité |  | Absent |  | P2 |  |
| B014 | Exporter > Créer un document PDF |  | À vérifier | app/pdf-export.ts, src/pdf/* | P1 | PDF vectoriel (texte sélectionnable) ajouté après le STATUS ; test pdf-vector |
| B015 | Exporter > Créer une vidéo (qualité, secondes par diapositive, narration) |  | Absent |  | P3 |  |
| B016 | Exporter > Créer un fichier GIF animé |  | Absent |  | P3 |  |
| B017 | Exporter > Package de présentation pour CD-ROM |  | Absent |  | P3 |  |
| B018 | Exporter > Créer des documents (pages de commentaires dans Word) |  | Partiel | app/backstage.tsx | P3 | PDF des pages de commentaires seulement |
| B019 | Exporter > Modifier le type de fichier (PNG, JPEG, .ppsx) |  | À vérifier | app/backstage.tsx | P2 |  |
| B020 | Fermer | Ctrl+W | Absent |  | P2 |  |
| B021 | Compte (profil, thème Office, connexions) |  | Partiel | app/backstage.tsx | P3 | texte « aucune connexion » |
| B022 | Options |  | Partiel | app/backstage.tsx | P1 | nom d'auteur seulement |

## 7. Modes d'affichage, règle, repères, trieuse, présentateur

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| V001 | Normal (miniatures + diapositive + notes) |  | OK | app/App.tsx | P1 | prouvé |
| V002 | Mode Plan (édition du plan) |  | À vérifier | app/AppViews.tsx | P2 |  |
| V003 | Trieuse de diapositives |  | OK | app/AppViews.tsx | P1 | prouvée |
| V004 | Page de notes |  | À vérifier | app/AppViews.tsx, app/NotesPage.tsx | P2 |  |
| V005 | Mode Lecture |  | À vérifier | app/AppViews.tsx | P2 |  |
| V006 | Masque des diapositives |  | OK | app/App.tsx | P1 |  |
| V007 | Masque du document |  | Absent |  | P2 |  |
| V008 | Masque des pages de notes |  | Absent |  | P2 |  |
| V009 | Règle (graduée, unité ?) |  | À vérifier | canvas/Rulers.tsx | P1 | règle de page ; Office : règle avec marqueurs de retrait et tabulations dans la zone de texte |
| V010 | Règle : marqueurs de retrait (première ligne, suspendu, gauche) et taquets de tabulation |  | Absent |  | P1 |  |
| V011 | Repères (horizontaux/verticaux déplaçables) |  | À vérifier | canvas/Overlay.tsx | P1 |  |
| V012 | Repères : ajouter/supprimer par menu (Alt+Maj+F9 etc.), repères de dessin dynamiques |  | Absent |  | P2 |  |
| V013 | Repères intelligents (alignement/espacement) |  | OK | canvas/math.ts (tests) | P1 | prouvé par tests |
| V014 | Quadrillage + aligner sur la grille |  | À vérifier | app/App.tsx | P1 |  |
| V015 | Taille de grille réglable |  | Absent |  | P2 |  |
| V016 | Zoom (menu, ajuster) |  | À vérifier | app/ribbon/views.tsx | P1 |  |
| V017 | Volet des notes redimensionnable |  | À vérifier | app/App.tsx | P2 |  |
| V018 | Volets latéraux (Sélection, Animation, Commentaires, Accessibilité, Concepteur, Format) |  | À vérifier | app/panes.tsx | P1 |  |
| V019 | Mode Présentateur (minuteur, notes, suivante) | Alt+F5 | OK | app/PresenterWindow.tsx | P1 |  |
| V020 | Seconde fenêtre « public » + présentateur synchronisés |  | Partiel | app/show-sync.ts | P2 | ajouté, test show-sync ; pas de choix du moniteur |
| V021 | Navigateur de diapositives pendant la présentation (Zoom de diapositive) |  | Absent |  | P3 |  |
| V022 | Aperçu avant impression |  | À vérifier | app/backstage.tsx | P2 |  |
| V023 | Nuances de gris / Couleur ; A noir et blanc |  | À vérifier | app/ribbon/views.tsx | P3 |  |
| V024 | Volet de navigation par miniatures redimensionnable / masquable |  | Absent |  | P3 | (ui.thumbnails existe : à vérifier) |

## 8. Fonctions « invisibles » (Concepteur, Morphose, Zoom, enregistrement, SmartArt, équations, points de modification…)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| F001 | Concepteur (propositions de mise en page) |  | Partiel | app/designer.ts | P2 | local, 3 à 6 propositions, pas d'IA ni d'images de stock ; prouvé |
| F002 | Morphose (transition entre formes de même nom) |  | À vérifier | app/SlideShow.tsx, app/playback.ts | P1 | STATUS : formes de même nom interpolées ; pas de morphose de mots/lettres ni d'image |
| F003 | Zoom récapitulatif / de section / de diapositive |  | Absent |  | P2 |  |
| F004 | Enregistrement du diaporama (narration, encre, minutage) |  | Partiel | app/RehearseBar.tsx | P2 | répétition du minutage seulement ; ni audio, ni encre, ni caméra |
| F005 | Narration audio |  | Absent |  | P3 |  |
| F006 | Sous-titres en direct / sous-titres traduits |  | Absent |  | P3 | reconnaissance vocale |
| F007 | Cameo (caméra incrustée) |  | Absent |  | P3 |  |
| F008 | Modèles 3D / animation 3D |  | Absent |  | P3 |  |
| F009 | SmartArt (conversion de texte, 200 dispositions, couleurs, styles) |  | Partiel | app/smartart.ts | P1 | création de 3 types en formes groupées |
| F010 | Équations (OMML, galerie, saisie manuscrite) |  | Partiel | app/equation.ts | P2 | LaTeX vers image ; non modifiable en place comme OMML |
| F011 | Formes à points de modification (Modifier les points) |  | Absent |  | P1 |  |
| F012 | Fusionner les formes (Union, Combiner, Fragmenter, Intersection, Soustraire) |  | Absent |  | P1 |  |
| F013 | Formes : réutiliser comme forme par défaut |  | Absent |  | P2 |  |
| F014 | Reproduire l'animation |  | Absent |  | P2 |  |
| F015 | Pinceau de mise en forme persistant (double-clic) |  | Absent |  | P2 |  |
| F016 | Sections : zoom de section |  | Absent |  | P3 |  |
| F017 | Sections (volet) et réorganisation |  | À vérifier | app/SlidePanel.tsx | P2 |  |
| F018 | Réutiliser les diapositives (depuis un autre fichier, conserver la mise en forme) |  | Absent |  | P1 |  |
| F019 | Grouper dans des calques (volet Sélection : verrouiller un objet) |  | Absent |  | P2 | ui verrouillage existe (locked) pour l'éditeur, pas par objet |
| F020 | Verrouiller un objet (verrou de position/taille) |  | Absent |  | P2 |  |
| F021 | Diaporama personnalisé / diaporama en boucle / mode kiosque |  | Absent |  | P2 |  |
| F022 | Diaporama sur plusieurs moniteurs |  | Absent |  | P2 |  |
| F023 | Diaporama en direct (Broadcast) / PowerPoint Live |  | Absent |  | P3 |  |
| F024 | Collaboration (coédition, @mentions, présence) |  | Absent |  | P3 |  |
| F025 | Copilot / Designer IA / Résumer |  | Absent |  | P3 |  |
| F026 | Sauvegarde automatique OneDrive |  | Absent |  | P3 | récupération IndexedDB 30 s à la place |
| F027 | Récupération après plantage |  | À vérifier | app/fileops.ts | P1 | bandeau Restaurer / Ignorer |
| F028 | Signatures numériques, protection par mot de passe, marquer comme final |  | Absent |  | P2 |  |
| F029 | Macros VBA (exécution) |  | Absent |  | P3 | fichier pptm conservé sans exécution |
| F030 | Compléments Office (Add-ins) |  | Absent |  | P3 |  |
| F031 | Insérer un objet OLE / lié |  | Absent |  | P3 |  |
| F032 | Importer un plan / diapositives depuis Word ou fichier texte |  | Absent |  | P2 |  |
| F033 | Traduire / dicter |  | Absent |  | P3 |  |
| F034 | Lecteur immersif |  | Absent |  | P3 |  |
| F035 | Mode Sombre de l'interface (thèmes Office) |  | Absent |  | P3 | thème sombre à vérifier côté packages/ui |
| F036 | Autocorrection (remplacements, majuscules, listes automatiques) |  | Partiel |  | P2 | puces automatiques ? non trouvé dans canvas/text.ts (à vérifier) |
| F037 | Mise en forme automatique du texte (liste auto-numérotée, guillemets typographiques) |  | Absent |  | P2 |  |
| F038 | Ajustement automatique du texte (réduire le texte) |  | À vérifier | app/panes.tsx, canvas/render/TextBlock.tsx | P1 |  |
| F039 | Conversion .ppt / .odp à l'ouverture |  | À vérifier | app/fileops.ts | P2 | selon STATUS |

## 9. Manipulation directe des objets (retour du propriétaire : « objets difficiles à manipuler »)

Le moteur `canvas/` fait déjà beaucoup (STATUS : sélection, lasso, déplacement contraint, poignées avec rotation, repères intelligents). Les gestes ci-dessous sont à **tester à la souris réelle** : la logique est testée en unitaire, pas le ressenti.

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| G001 | Sélection au clic + Maj pour étendre |  | À vérifier | canvas/CanvasEditor.tsx | P1 | STATUS |
| G002 | Sélection au lasso (cadre) |  | À vérifier | canvas/CanvasEditor.tsx | P1 |  |
| G003 | Déplacement à la souris, contrainte d'axe (Maj), duplication (Ctrl+glisser), désactiver le magnétisme (Alt) |  | À vérifier | canvas/CanvasEditor.tsx | P1 |  |
| G004 | Poignées de redimensionnement (8) avec rotation, Maj = proportions, Ctrl = depuis le centre |  | À vérifier | canvas/math.ts (testé) | P1 | logique testée ; taille des poignées sur écran 4K/tactile à vérifier |
| G005 | Poignée de rotation (Maj : pas de 15°) |  | À vérifier | canvas/math.ts | P1 |  |
| G006 | Poignées jaunes d'ajustement des formes prédéfinies |  | À vérifier | canvas/geometry | P1 |  |
| G007 | Sélection d'un objet dans un groupe (second clic / double-clic) |  | À vérifier | canvas/CanvasEditor.tsx | P1 |  |
| G008 | Texte : saisie en place, sélection à la souris, double-clic mot |  | À vérifier | canvas/useTextEditing.ts | P1 |  |
| G009 | Triple-clic = paragraphe ; Ctrl+clic = phrase |  | Absent |  | P2 |  |
| G010 | Sélection de texte par Maj+flèches / Ctrl+Maj+flèches |  | À vérifier | canvas/useTextEditing.ts | P1 | non prouvé dans le STATUS |
| G011 | Plusieurs sélections non contiguës (Ctrl+clic sur objets) |  | Absent |  | P2 | Maj seulement |
| G012 | Sélectionner derrière (Alt+clic pour passer aux objets empilés) |  | Absent |  | P1 |  |
| G013 | Verrouillage d'un objet (désactiver le déplacement) |  | Absent |  | P2 |  |
| G014 | Poignées de rognage sur l'image sélectionnée |  | Absent |  | P1 |  |
| G015 | Déplacement des points d'une forme libre |  | Absent |  | P1 |  |
| G016 | Connecteurs accrochés aux sites de connexion |  | À vérifier | canvas/connectors.ts | P1 |  |
| G017 | Glisser une miniature vers une autre présentation |  | Absent |  | P3 |  |
| G018 | Glisser-déposer d'images depuis le système |  | À vérifier | app/App.tsx | P1 |  |
| G019 | Annuler/rétablir avec fusion de la frappe |  | À vérifier | packages/core | P1 |  |
| G020 | Curseurs de souris par poignée (↔ ↕ ⤢), infobulles de dimension pendant le redimensionnement |  | À vérifier |  | P1 | à vérifier visuellement dans le banc |
| G021 | Taille minimale de la zone cliquable des petits objets/lignes (cible de 8 px) |  | Absent |  | P1 | ponctuel : objets fins difficiles à saisir |

## 10. AU-DELÀ D'OFFICE (20 idées)

1. **Mini-barre contextuelle universelle** : Une seule barre flottante par type d'objet (texte, forme, image, tableau, graphique) cohérente avec les 6 autres applications ForgeOffice.
2. **Éditeur de nœuds vectoriel** : Modifier les points avec poignées de Bézier, fusion de formes booléennes, tracé au stylo (outil Plume) et vectorisation d'une image.
3. **Concepteur hors ligne amélioré** : Propositions de mise en page par règles + extraction des couleurs de l'image, application en un clic à toutes les diapositives.
4. **Pilotage de présentation à distance par téléphone** : Le mobile ForgeOffice sert de télécommande et de vue présentateur (réseau local, sans cloud).
5. **Historique de versions local** : Instantanés nommés de la présentation, comparaison visuelle de deux versions, retour en arrière par diapositive.
6. **Comparaison et fusion de présentations** : Fusion à trois voies diapositive par diapositive, sans service en ligne.
7. **Bibliothèque de diapositives réutilisables** : Banque locale de diapositives/objets étiquetés, glisser-déposer entre présentations, mise à jour des copies liées.
8. **Variables et données liées** : Champs réutilisables (client, date, chiffre) alimentés par un fichier du Tableur ; graphiques liés à une feuille Excel de la suite.
9. **Graphiques liés au Tableur** : Un graphique de la présentation reste lié à une plage du Tableur et se met à jour à l'ouverture.
10. **Export HTML interactif autonome** : Diaporama exporté en un seul fichier HTML (transitions, animations, notes masquées) lisible sans logiciel.
11. **Export vidéo local** : Rendu MP4/WebM de la présentation (minutages et narrations) sans envoi à un serveur.
12. **Vérificateur de lisibilité et de contraste** : Contrastes WCAG, tailles de police minimales, densité de texte par diapositive, avec correctifs en un clic.
13. **Vérificateur de cohérence de marque** : Alerte quand une couleur/police sort du thème, et « normaliser » en un clic.
14. **Recherche dans la bibliothèque d'icônes et illustrations Fluent** : Recherche sémantique hors ligne, recoloration au thème.
15. **Raccourcis personnalisables et palette de commandes** : Ctrl+Maj+P : tape le nom d'une commande (en français), exécute-la ; raccourcis redéfinissables.
16. **Notes du présentateur structurées** : Notes avec minutage par diapositive, aide-mémoire par point, mode répétition avec dérive du chrono.
17. **Sous-titres locaux** : Sous-titres générés hors ligne (reconnaissance vocale embarquée) pendant la présentation, avec export SRT.
18. **Animations paramétrables par script** : Courbes d'accélération personnalisées, animations de graphiques par série, boucles et chronologies liées à des événements.
19. **Thèmes importables et générateur de thème** : Créer un thème à partir d'une image ou d'un logo (palette + polices) et l'enregistrer comme modèle.
20. **Mode « Document de travail »** : Convertir la présentation en document (Texte) ou en plan structuré et inversement, avec liens conservés.

## Annexe : limites de l'audit

- Menus déroulants et galeries (Coller, Effets, Puces…) : leurs sous-éléments n'ont pas pu être lus (le panneau déroulant ne se déplie pas sans clic réel sur une fenêtre hors écran) ; le contenu vient de CB/K.
- Onglets contextuels Graphique, Vidéo, Zoom, 3D : non capturés (Excel/vidéo/modèle 3D non lancés pour ne pas gêner le propriétaire).
- Backstage : pages Nouveau, Ouvrir, Informations, Enregistrer sous, Imprimer, Exporter lues ; Partager non lisible sans ouvrir une boîte modale ; Options (boîte modale) via K.
- Les statuts « OK » reposent sur STATUS.md et `tests/` ; aucune exécution de l'application ForgeOffice ici : « À vérifier » veut dire « non prouvé », pas « cassé ».
