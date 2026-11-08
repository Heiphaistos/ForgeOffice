# Parité Publisher 2024/365 (interface française) : Publication de ForgeOffice

Audit du 2026-11-05, sans modification de code. Code audité : `packages/publisher` (version 0.1.0) et le moteur d'édition partagé `packages/powerpoint/src/canvas`.

**Mise à jour du 2026-11-07** : les lignes livrées depuis l'audit sont passées à OK ou Partiel avec leur preuve (test unitaire et parcours réel dans le navigateur) : styles nommés, boîtes Police / Paragraphe / Taille et position / Format à onglets, menus de page, d'objet, de tableau, de règle et de repère, Insérer un fichier texte, F5 / F7 / raccourcis de groupe et d'ordre, Options, Pack and Go, PDF vectoriel, publipostage (bloc d'adresse, catalogue, champ image), bibliothèque de blocs, tons directs, indications de suite. Les lignes « À vérifier » ne sont pas encore prouvées (lot P0).

## 0. Méthode, sources, légende

**Microsoft Publisher n'est pas installé sur ce PC** (`Publisher.Application` absent du registre ; seul PowerPoint 365 l'est). Il n'y a donc **aucune vérité-terrain UI Automation** pour Publisher : tous les noms de commandes, de groupes et de menus viennent de la **connaissance** de Publisher 2019/2021/365 en français et sont à confirmer sur une machine équipée. Les statuts de ForgeOffice viennent de la lecture du code (chemins relatifs à `packages/publisher/src`) et de `STATUS.md` + `tests/`. Rien n'a été exécuté. Note de nommage : dans Publisher français, l'onglet des repères/marges s'appelle « Création de page » (groupe « Mise en page » à l'intérieur) ; selon les versions il peut être écrit « Mise en page ».

**Statuts** (le propriétaire a constaté que certaines options présentes ne fonctionnent pas : la preuve compte)

| Statut | Sens |
|---|---|
| **OK** | présent et **prouvé** (test automatisé du même effet, ou parcours réel noté « prouvé » dans STATUS.md) |
| **À vérifier** | code présent, **effet non prouvé** : à tester en vrai |
| **Partiel** | présent mais incomplet (le manque est dans la note) |
| **Absent** | rien dans le code |

**Priorités** : P1 = usage quotidien ou geste de manipulation bloquant ; P2 = fréquent dans une suite complète ; P3 = rare, service en ligne ou cosmétique.

Nombre d'entrées : **357**.

## Bilan chiffré

| Type d'entrée | Total | OK | À vérifier | Partiel | Absent |
|---|---|---|---|---|---|
| Ruban (connaissance) | 150 | 13 (9 %) | 86 (57 %) | 5 (3 %) | 46 (31 %) |
| Menus contextuels | 69 | 16 (23 %) | 22 (32 %) | 1 (1 %) | 30 (43 %) |
| Mini-barre | 6 | 0 (0 %) | 0 (0 %) | 1 (17 %) | 5 (83 %) |
| Dialogues et volets | 34 | 6 (18 %) | 12 (35 %) | 5 (15 %) | 11 (32 %) |
| Raccourcis clavier | 26 | 3 (12 %) | 14 (54 %) | 0 (0 %) | 9 (35 %) |
| Backstage | 15 | 3 (20 %) | 4 (27 %) | 2 (13 %) | 6 (40 %) |
| Affichage / règles / repères | 13 | 1 (8 %) | 8 (62 %) | 2 (15 %) | 2 (15 %) |
| Fonctions invisibles | 31 | 11 (35 %) | 2 (6 %) | 2 (6 %) | 16 (52 %) |
| Manipulation directe | 13 | 2 (15 %) | 6 (46 %) | 1 (8 %) | 4 (31 %) |
| **Total** | 357 | 55 (15 %) | 154 (43 %) | 19 (5 %) | 129 (36 %) |

Particularités : la publication réutilise le moteur de formes de la Présentation ; chaque limite du moteur (édition de points, fusion de formes, volet Format, mini-barre, menus contextuels) est donc **commune** et se corrige une seule fois dans `packages/powerpoint/src/canvas`.

## 1. Ruban

Onglets de Publisher 365 FR : **Fichier**, Accueil, Insertion, Création de page, Publipostage, Révision, Affichage (+ Aide) ; contextuels : Outils de zone de texte (Format), Outils d'image (Format), Outils de tableau (Création, Disposition), Outils WordArt, Outils de dessin (Format).

### 1.1 Accueil

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R01-001 | Accueil / Presse-papiers / Coller | Bouton ; Ctrl+V | À vérifier | app/ribbon/home.tsx | P1 | options de collage (Conserver la mise en forme, Texte seul) absentes |
| R01-002 | Accueil / Presse-papiers / Couper | Bouton ; Ctrl+X | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-003 | Accueil / Presse-papiers / Copier | Bouton ; Ctrl+C | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-004 | Accueil / Presse-papiers / Reproduire la mise en forme | Bouton ; Ctrl+Maj+C / V | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-005 | Accueil / Presse-papiers / Collage spécial | Menu ; Ctrl+Alt+V | Absent |  | P2 |  |
| R01-006 | Accueil / Police / Police | Liste | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-007 | Accueil / Police / Taille de police | Liste | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-008 | Accueil / Police / Agrandir / Réduire la police | Boutons ; Ctrl+Maj+> < | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-009 | Accueil / Police / Effacer la mise en forme | Bouton | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-010 | Accueil / Police / Gras, Italique, Souligné | Boutons ; Ctrl+G, I, U | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-011 | Accueil / Police / Barré, Exposant, Indice | Boutons | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-012 | Accueil / Police / Modifier la casse | Menu | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-013 | Accueil / Police / Surbrillance | Menu | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-014 | Accueil / Police / Couleur de police | Menu | À vérifier | app/ribbon/home.tsx | P1 | couleurs de modèle de couleurs ; pas de teintes/ton direct |
| R01-015 | Accueil / Police / Ombre, Contour, Relief du texte | Boutons | Absent |  | P3 |  |
| R01-016 | Accueil / Police / Espacement des caractères et crénage (Étendu, Condensé, Crénage auto) | Menu | Absent |  | P2 |  |
| R01-017 | Accueil / Police / Boîte Police | Lanceur ; Ctrl+T | OK | app/dialogs-text.tsx | P1 | Ctrl+T et lanceur du groupe Police ; prouvé par parcours réel (taille appliquée) |
| R01-018 | Accueil / Paragraphe / Puces | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-019 | Accueil / Paragraphe / Numérotation | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-020 | Accueil / Paragraphe / Diminuer / Augmenter le retrait | Boutons | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-021 | Accueil / Paragraphe / Interligne | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-022 | Accueil / Paragraphe / Aligner à gauche, Centrer, Aligner à droite, Justifier | Boutons ; Ctrl+L,E,R,J | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-023 | Accueil / Paragraphe / Direction du texte (gauche à droite / droite à gauche) | Boutons | Absent |  | P3 |  |
| R01-024 | Accueil / Paragraphe / Boîte Paragraphe, Tabulations, Retraits, Espacement, Césure | Lanceur | Partiel | app/dialogs-text.tsx | P1 | boîte Paragraphe (alignement, retraits, espacements, interligne) prouvée ; tabulations et césure absentes |
| R01-025 | Accueil / Styles / Galerie de styles | Galerie | À vérifier | app/ribbon/home.tsx | P2 | 7 styles préréglés, pas de styles de texte nommés et persistants |
| R01-026 | Accueil / Styles / Créer un style, Modifier, Supprimer, Importer (volet Styles) | Volet | OK | styles.ts, app/dialogs-styles.tsx | P1 | créer, appliquer, mettre à jour, renommer, supprimer, « basé sur », importer d'un autre fichier ; persistants dans publication.json ; prouvé (tests + réouverture) |
| R01-027 | Accueil / Objets / Dessiner une zone de texte | Bouton | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-028 | Accueil / Objets / Insérer une image | Bouton | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-029 | Accueil / Objets / Formes | Galerie | À vérifier | app/ribbon/home.tsx | P1 | 68 formes |
| R01-030 | Accueil / Objets / Tableau | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-031 | Accueil / Objets / Légendes, Lignes et flèches (outils de dessin à main levée) | Galerie | Absent |  | P2 |  |
| R01-032 | Accueil / Organiser / Mettre au premier plan, Reculer | Boutons | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-033 | Accueil / Organiser / Grouper, Dissocier | Boutons | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-034 | Accueil / Organiser / Aligner | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-035 | Accueil / Organiser / Faire pivoter | Menu | À vérifier | app/ribbon/home.tsx | P1 |  |
| R01-036 | Accueil / Organiser / Distribuer, Verrouiller, Déverrouiller | Menu | Absent |  | P2 |  |
| R01-037 | Accueil / Organiser / Habillage du texte | Menu | À vérifier | app/ribbon/contextual.tsx, wrap.ts | P1 | aucun, carré, ajusté (ellipses), haut et bas ; pas de contour modifiable |
| R01-038 | Accueil / Modification / Rechercher | Bouton ; Ctrl+F | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-039 | Accueil / Modification / Remplacer | Bouton ; Ctrl+H | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-040 | Accueil / Modification / Sélectionner tout | Bouton ; Ctrl+A | À vérifier | app/ribbon/home.tsx | P2 |  |
| R01-041 | Accueil / Modification / Sélectionner (objets, zone de texte suivante) | Menu | Absent |  | P2 |  |
| R01-042 | Accueil / Modification / Atteindre la page (F5) | Bouton | OK | app/dialogs.tsx | P1 | F5 et menus ; prouvé par parcours réel |

### 1.2 Insertion

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R02-001 | Insertion / Pages / Insérer une page | Bouton ; Ctrl+Maj+N | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-002 | Insertion / Pages / Dupliquer la page | Bouton | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-003 | Insertion / Pages / Insérer plusieurs pages | Bouton | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-004 | Insertion / Tableaux / Tableau | Menu | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-005 | Insertion / Tableaux / Insérer un tableau Excel | Menu | Absent |  | P3 |  |
| R02-006 | Insertion / Illustrations / Images | Bouton | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-007 | Insertion / Illustrations / Images en ligne, Photo stock | Bouton | Absent |  | P3 |  |
| R02-008 | Insertion / Illustrations / Formes | Galerie | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-009 | Insertion / Illustrations / Icônes | Bouton | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-010 | Insertion / Illustrations / Capture d'écran, Modèles 3D, SmartArt, Graphique | Boutons | Absent |  | P3 |  |
| R02-011 | Insertion / Blocs de construction / Parties de page (titres, encadrés, citations) | Galerie | À vérifier | app/ribbon/insert.tsx, blocks.ts | P2 | 3 titres, 3 encadrés, 2 coupons, calendrier, 2 accents (contre ~200 parties dans Publisher) |
| R02-012 | Insertion / Blocs de construction / Calendriers | Galerie | À vérifier | app/ribbon/insert.tsx | P2 | calendrier du mois ; pas d'assistant de calendrier complet |
| R02-013 | Insertion / Blocs de construction / Bordures et accents (bordures en motif) | Galerie | Absent |  | P2 |  |
| R02-014 | Insertion / Blocs de construction / Annonces, Bibliothèque de contenu | Galerie | Absent |  | P3 |  |
| R02-015 | Insertion / Blocs de construction / Ajouter la sélection à la galerie | Bouton | Absent |  | P2 |  |
| R02-016 | Insertion / Liens / Lien hypertexte | Bouton ; Ctrl+K | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-017 | Insertion / Liens / Signet | Bouton | Absent |  | P3 |  |
| R02-018 | Insertion / En-tête et pied de page / En-tête, Pied de page | Boutons | À vérifier | app/ribbon/insert.tsx | P2 | posés sur la page maître |
| R02-019 | Insertion / En-tête et pied de page / Numéro de page | Menu | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-020 | Insertion / Texte / Dessiner une zone de texte | Bouton | À vérifier | app/ribbon/insert.tsx | P1 |  |
| R02-021 | Insertion / Texte / Insérer un fichier texte (Word, RTF) | Bouton | OK | textfile.ts, app/textimport.ts | P1 | .txt, .md, .docx, .rtf, .odt (texte brut) ; prouvé |
| R02-022 | Insertion / Texte / WordArt | Galerie | À vérifier | app/ribbon/insert.tsx | P2 | 6 styles |
| R02-023 | Insertion / Texte / Date et heure | Bouton | À vérifier | app/ribbon/insert.tsx | P2 |  |
| R02-024 | Insertion / Texte / Symbole | Bouton | Absent |  | P2 |  |
| R02-025 | Insertion / Texte / Objet (OLE) | Bouton | Absent |  | P3 |  |
| R02-026 | Insertion / Texte / Parties rapides, Informations professionnelles | Menu | Absent |  | P2 | jeu d'informations de l'entreprise réutilisable |

### 1.3 Création de page

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R03-001 | Création de page / Modèle / Changer de modèle | Bouton | Partiel | app/ribbon/design.tsx | P2 | catalogue de 13 compositions créées par code |
| R03-002 | Création de page / Mise en page / Marges | Menu | À vérifier | app/ribbon/design.tsx | P1 |  |
| R03-003 | Création de page / Mise en page / Orientation | Menu | À vérifier | app/ribbon/design.tsx | P1 |  |
| R03-004 | Création de page / Mise en page / Taille | Menu | À vérifier | app/ribbon/design.tsx | P1 | 7 formats + personnalisée |
| R03-005 | Création de page / Mise en page / Boîte Mise en page (type de publication, étiquettes, pli, dimensions de la feuille, imprimante) | Lanceur | Absent |  | P1 |  |
| R03-006 | Création de page / Disposition / Repères (1, 2, 3 colonnes, grille, ajout, effacement) | Menu | À vérifier | app/ribbon/design.tsx, guides.ts | P1 |  |
| R03-007 | Création de page / Disposition / Pages en vis-à-vis | Case | OK | app/ribbon/design.tsx | P1 | prouvé (planche de 2 pages) |
| R03-008 | Création de page / Disposition / Fond perdu | Menu | À vérifier | app/ribbon/design.tsx | P1 |  |
| R03-009 | Création de page / Disposition / Lignes de base : boîte Repères de disposition (onglet Lignes de base) accessible depuis le ruban | Menu | Absent |  | P2 |  |
| R03-010 | Création de page / Schémas / Modèle de couleurs | Galerie | À vérifier | app/ribbon/design.tsx, schemes.ts | P1 | 16 modèles ; Baies prouvé |
| R03-011 | Création de page / Schémas / Créer un modèle de couleurs personnalisé | Bouton | Absent |  | P2 |  |
| R03-012 | Création de page / Schémas / Modèle de polices | Galerie | À vérifier | app/ribbon/design.tsx, schemes.ts | P2 | 10 modèles |
| R03-013 | Création de page / Schémas / Effets de police | Galerie | Absent |  | P3 |  |
| R03-014 | Création de page / Arrière-plan / Arrière-plan | Galerie | À vérifier | app/ribbon/design.tsx | P1 | teintes, dégradé, foncé, personnalisé ; pas d'image/texture/motif |
| R03-015 | Création de page / Pages maîtres / Page maître | Menu | À vérifier | app/ribbon/design.tsx | P1 |  |
| R03-016 | Création de page / Pages maîtres / Fermer la page maître | Bouton | À vérifier | app/ribbon/views.tsx | P1 |  |
| R03-017 | Création de page / Pages maîtres / Gestionnaire de pages maîtres (renommer, dupliquer) | Volet | Absent |  | P2 |  |

### 1.4 Publipostage

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R04-001 | Publipostage / Démarrer / Sélectionner des destinataires (CSV, xlsx) | Menu | OK | app/ribbon/views.tsx, merge.ts | P1 | prouvé CSV ; xlsx testé (merge-xlsx.test.ts) ; pas Outlook/Access/liste existante |
| R04-002 | Publipostage / Démarrer / Modifier la liste des destinataires (filtrer, trier, supprimer les doublons) | Bouton | Absent |  | P2 |  |
| R04-003 | Publipostage / Démarrer / Démarrer le publipostage (type : Étiquettes, Catalogue, Courriel, Lettre) | Menu | Partiel |  | P2 | une seule voie de fusion |
| R04-004 | Publipostage / Écrire et insérer des champs / Insérer un champ de fusion | Menu | À vérifier | app/ribbon/views.tsx | P1 |  |
| R04-005 | Publipostage / Écrire et insérer des champs / Bloc d'adresse, Ligne de salutation | Boutons | Absent |  | P2 |  |
| R04-006 | Publipostage / Écrire et insérer des champs / Champ image (fusion d'images) | Bouton | OK | mergeimages.ts, app/imagebank.ts | P1 | image liée à un champ, images lues dans un ZIP ; prouvé (pommes rouges, poires vertes, kiwi = image d'origine) |
| R04-007 | Publipostage / Aperçu des résultats / Aperçu, Précédent, Suivant | Boutons | OK | app/ribbon/views.tsx | P1 | prouvé |
| R04-008 | Publipostage / Aperçu des résultats / Atteindre un enregistrement, Rechercher un destinataire | Zone | Absent |  | P3 |  |
| R04-009 | Publipostage / Terminer / Fusionner vers une nouvelle publication | Bouton | À vérifier | app/ribbon/views.tsx | P1 |  |
| R04-010 | Publipostage / Terminer / Fusionner vers PDF | Bouton | À vérifier | app/ribbon/views.tsx | P2 |  |
| R04-011 | Publipostage / Terminer / Envoyer à l'imprimante, Envoyer par courriel | Boutons | Absent |  | P2 |  |
| R04-012 | Publipostage / Terminer / Fusion de catalogue (une page par enregistrement/plusieurs par page) | Menu | Absent |  | P2 |  |

### 1.5 Révision

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R05-001 | Révision / Vérification / Orthographe | Bouton ; F7 | Partiel | app/ribbon/views.tsx | P1 | informatif seulement (correcteur du système dans la saisie) |
| R05-002 | Révision / Vérification / Recherche, Dictionnaire des synonymes | Boutons | Absent |  | P3 |  |
| R05-003 | Révision / Langue / Traduire, Langue de vérification | Boutons | Absent |  | P2 |  |
| R05-004 | Révision / Vérificateur de conception | Volet | À vérifier | check.ts, app/CheckPane.tsx | P1 | plus que Publisher |
| R05-005 | Révision / Vérificateur d'accessibilité | Bouton | Absent |  | P2 | texte de remplacement existe, pas de vérificateur |

### 1.6 Affichage

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R06-001 | Affichage / Affichage / Normal | Bouton | À vérifier | app/ribbon/views.tsx | P1 |  |
| R06-002 | Affichage / Affichage / Page maître | Bouton | À vérifier | app/ribbon/views.tsx | P1 |  |
| R06-003 | Affichage / Affichage / Une page / Deux pages | Boutons | À vérifier | app/ribbon/views.tsx | P1 |  |
| R06-004 | Affichage / Afficher / Règles, Repères, Limites, Volet de navigation de page, Lignes de base | Cases | À vérifier | app/ribbon/views.tsx | P1 |  |
| R06-005 | Affichage / Afficher / Volet de la zone de travail (zone hors page), Marques d'édition | Cases | Absent |  | P2 |  |
| R06-006 | Affichage / Zoom / Zoom 100 %, Page entière, Largeur de page | Boutons | À vérifier | app/ribbon/views.tsx | P1 |  |
| R06-007 | Affichage / Zoom / Boîte Zoom (valeur libre), Zoom sur la sélection | Bouton | Absent |  | P2 |  |
| R06-008 | Affichage / Fenêtre / Nouvelle fenêtre, Réorganiser, Changer de fenêtre | Boutons | Absent |  | P3 |  |
| R06-009 | Affichage / Macros | Bouton | Absent |  | P3 |  |

### 1.7 Aide

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R07-001 | Aide | Onglet | Absent |  | P3 |  |

### 1.8 Format (zone de texte)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R08-001 | Format (zone de texte) / Insérer des formes / Modifier la forme | Menu | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R08-002 | Format (zone de texte) / Styles de formes / Remplissage, Contour, Effets | Menus | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-003 | Format (zone de texte) / Liens / Créer un lien | Bouton | OK | app/ribbon/contextual.tsx, chain.ts | P1 | prouvé (indicateur « A… » + clic sur zone vide) |
| R08-004 | Format (zone de texte) / Liens / Précédent, Suivant | Boutons | OK | app/ribbon/contextual.tsx | P1 | prouvé (◀ ▶) |
| R08-005 | Format (zone de texte) / Liens / Rompre le lien | Bouton | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-006 | Format (zone de texte) / Texte / Alignement vertical | Menu | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R08-007 | Format (zone de texte) / Texte / Ajuster le texte (Réduire, Agrandir, Aucun) | Menu | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-008 | Format (zone de texte) / Texte / Colonnes | Menu | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-009 | Format (zone de texte) / Texte / Marges | Menu | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R08-010 | Format (zone de texte) / Texte / Direction du texte | Menu | Absent |  | P2 |  |
| R08-011 | Format (zone de texte) / Texte / Césure | Case | Absent |  | P2 |  |
| R08-012 | Format (zone de texte) / Typographie / Lettrine | Menu | OK | app/ribbon/contextual.tsx, wrap.ts | P2 | prouvé (3 lignes) |
| R08-013 | Format (zone de texte) / Typographie / Ligatures, Alternatives stylistiques, Styles de chiffres, Capitales | Menus | Absent |  | P2 |  |
| R08-014 | Format (zone de texte) / Organiser / Habillage du texte | Menu | OK | app/ribbon/contextual.tsx | P1 | prouvé (carré) |
| R08-015 | Format (zone de texte) / Organiser / Avancer, Reculer, Aligner, Grouper, Faire pivoter | Boutons | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-016 | Format (zone de texte) / Taille / Hauteur, Largeur | Compteurs | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R08-017 | Format (zone de texte) / Taille / Position exacte (mesure), Verrouiller le rapport | Boîte | OK | app/dialogs-format.tsx, app/dialogs-text.tsx | P1 | position exacte, taille, rotation, rapport verrouillé ; prouvé |
| R08-018 | Format (zone de texte) / Accessibilité / Texte de remplacement | Bouton | Absent |  | P2 | disponible par le menu contextuel |

### 1.9 Format (image)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R09-001 | Format (image) / Ajuster / Changer l'image | Bouton | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R09-002 | Format (image) / Ajuster / Luminosité, Contraste | Menus | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R09-003 | Format (image) / Ajuster / Nuances de gris, Transparence | Boutons | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R09-004 | Format (image) / Ajuster / Recolorer (teinte), Corrections de netteté, Compresser les images | Menus | Absent |  | P2 |  |
| R09-005 | Format (image) / Ajuster / Rétablir l'image | Bouton | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R09-006 | Format (image) / Rogner / Rogner | Bouton | À vérifier | crop.ts, app/CropOverlay.tsx | P1 | rognage interactif présent dans le code (non mentionné dans STATUS) : à vérifier |
| R09-007 | Format (image) / Rogner / Ajuster / Remplir (cadre) | Boutons | Partiel | picfit.ts | P1 | Remplir et Ajuster prouvés ; rognage numérique absent |
| R09-008 | Format (image) / Styles d'image / Contour | Menu | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R09-009 | Format (image) / Styles d'image / Effets | Menu | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R09-010 | Format (image) / Styles d'image / Galerie de styles d'image | Galerie | Absent |  | P2 |  |
| R09-011 | Format (image) / Habillage du texte | Menu | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R09-012 | Format (image) / Taille / Hauteur, Largeur | Compteurs | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R09-013 | Format (image) / Accessibilité / Texte de remplacement | Bouton | Absent |  | P2 |  |

### 1.10 Format (forme)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R10-001 | Format (forme) / Insérer des formes, Styles de formes (remplissage, contour, effets), Habillage, Taille | Groupe | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R10-002 | Format (forme) / Modifier la forme > Modifier les points | Menu | Absent |  | P1 |  |

### 1.11 Outils de tableau

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R11-001 | Outils de tableau / Création : Styles de tableau, Dessiner un tableau, Bordures, Trame, Effets | Onglet | Absent |  | P1 | STATUS : pas de galerie de styles de tableau |
| R11-002 | Outils de tableau / Disposition : Insérer des lignes/colonnes, Supprimer, Fusionner, Fractionner | Onglet | À vérifier | app/ribbon/contextual.tsx | P1 |  |
| R11-003 | Outils de tableau / Options : Ligne d'en-tête, Lignes à bandes, Première colonne, Trame | Cases | À vérifier | app/ribbon/contextual.tsx | P2 |  |
| R11-004 | Outils de tableau / Disposition : hauteur/largeur des cellules, Uniformiser, Alignement, Marges des cellules | Onglet | Absent |  | P1 |  |

### 1.12 Outils WordArt

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| R12-001 | Outils WordArt / Format : Styles WordArt, Remplissage et contour du texte, Effets de texte (transformation) | Onglet | Absent |  | P2 |  |

## 2. Menus contextuels (clic droit)

Code : un seul `shapeMenu` (`app/App.tsx` lignes 315-341) pour tout objet, `pageMenu` dans `app/PagesPane.tsx`. Le menu d'une zone de texte propose Lier / Format de la zone de texte ; ni Habillage, ni Regroupement, ni Ordre, ni mini-barre.

### 2.1 Page (volet de navigation « Navigation entre les pages »)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M01-001 | Insérer une page (avant / après) |  | À vérifier | app/PagesPane.tsx | P1 |  |
| M01-002 | Insérer plusieurs pages |  | À vérifier | app/PagesPane.tsx | P2 |  |
| M01-003 | Dupliquer la page |  | À vérifier | app/PagesPane.tsx | P2 |  |
| M01-004 | Supprimer la page |  | À vérifier | app/PagesPane.tsx | P1 |  |
| M01-005 | Appliquer une page maître ▸ |  | À vérifier | app/PagesPane.tsx | P1 |  |
| M01-006 | Ignorer la page maître |  | À vérifier | app/PagesPane.tsx | P2 |  |
| M01-007 | Couper / Copier / Coller une page |  | OK | app/ops.ts, app/PagesPane.tsx | P1 | couper, copier, coller une page ; prouvé |
| M01-008 | Renommer / Déplacer la page |  | Absent |  | P3 | glisser-déposer existe |
| M01-009 | Propriétés de la page (mise en page, arrière-plan) |  | Absent |  | P2 |  |

### 2.2 Page vide (zone de travail)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M02-001 | Coller | Ctrl+V | À vérifier | app/App.tsx (shapeMenu) | P1 |  |
| M02-002 | Repères de disposition… |  | À vérifier | app/App.tsx | P2 |  |
| M02-003 | Arrière-plan / Plus d'arrière-plans |  | À vérifier | app/App.tsx | P2 |  |
| M02-004 | Modifier la page maître |  | À vérifier | app/App.tsx | P2 |  |
| M02-005 | Insérer une page |  | Absent |  | P2 |  |
| M02-006 | Zoom ▸ (menu de pourcentages) |  | Absent |  | P2 |  |
| M02-007 | Grille et repères ▸ (Afficher les repères, Verrouiller) |  | Absent |  | P2 |  |
| M02-008 | Coller des objets au même endroit |  | Absent |  | P3 |  |
| M02-009 | Format de la page |  | Absent |  | P2 |  |

### 2.3 Zone de texte

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M03-001 | Couper / Copier / Coller |  | À vérifier | app/App.tsx | P1 |  |
| M03-002 | Modifier le texte ▸ (Changer le texte, Modifier la story, Étendre la story) |  | Absent |  | P2 |  |
| M03-003 | Créer un lien de zone de texte |  | OK | app/App.tsx | P1 | prouvé (liaison par indicateur) |
| M03-004 | Rompre le lien (Précédent / Suivant) |  | Absent |  | P1 | présents dans l'onglet Format |
| M03-005 | Format de la zone de texte (boîte) |  | À vérifier | app/dialogs.tsx | P1 | marges, colonnes, alignement vertical, ajustement ; pas d'onglets Couleurs et traits / Disposition / Taille complets |
| M03-006 | Changer la zone de texte (forme) |  | Absent |  | P3 |  |
| M03-007 | Ajuster le texte ▸ (Réduire, Agrandir) |  | Absent |  | P2 |  |
| M03-008 | Habillage ▸ |  | OK | app/App.tsx | P1 | sous-menu Habiller le texte du menu de l'objet |
| M03-009 | Enregistrer dans la bibliothèque de contenu |  | Absent |  | P3 |  |
| M03-010 | Regroupement / Ordre ▸ |  | OK | app/App.tsx | P1 | Ordre (premier plan, arrière-plan), Grouper, Dissocier, Faire pivoter ; prouvé |
| M03-011 | Définir comme zone de texte par défaut |  | Absent |  | P2 |  |
| M03-012 | Texte de remplacement |  | À vérifier | app/App.tsx | P2 |  |
| M03-013 | Lien hypertexte | Ctrl+K | À vérifier | app/App.tsx | P1 |  |
| M03-014 | Orthographe (suggestions) |  | Partiel | app/Stage.tsx | P1 | suggestions du navigateur par Maj+clic droit ; pas de correcteur propre |
| M03-015 | Mini-barre de texte |  | Absent |  | P1 | voir §3 |

### 2.4 Image

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M04-001 | Couper / Copier / Coller |  | À vérifier | app/App.tsx | P1 |  |
| M04-002 | Changer l'image |  | À vérifier | app/App.tsx | P1 |  |
| M04-003 | Rogner |  | À vérifier | app/App.tsx, app/CropOverlay.tsx | P1 |  |
| M04-004 | Enregistrer l'image sous… / Copier l'image |  | Absent |  | P2 |  |
| M04-005 | Changer l'image ▸ (Depuis un fichier / en ligne / réinitialiser la taille) |  | Absent |  | P2 |  |
| M04-006 | Habillage du texte ▸ |  | OK | app/App.tsx | P1 | Habiller le texte dans le menu de l'image |
| M04-007 | Regroupement / Ordre / Faire pivoter ▸ |  | OK | app/App.tsx | P1 | Ordre, Grouper, Faire pivoter dans le menu de l'image ; prouvé |
| M04-008 | Format de l'image (boîte avec onglets Couleurs et traits, Taille, Disposition, Image) |  | OK | app/dialogs-format.tsx | P1 | Format de l'image à onglets : Couleurs et traits, Taille, Disposition, Image (luminosité, contraste, transparence, nuances de gris), Texte de remplacement ; prouvé |
| M04-009 | Définir comme arrière-plan |  | Absent |  | P3 |  |
| M04-010 | Texte de remplacement |  | À vérifier | app/App.tsx | P2 |  |
| M04-011 | Lien hypertexte |  | À vérifier | app/App.tsx | P2 |  |
| M04-012 | Gestionnaire d'images (liens vers les fichiers) |  | Absent |  | P2 |  |

### 2.5 Forme / ligne

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M05-001 | Couper / Copier / Coller |  | À vérifier | app/App.tsx | P1 |  |
| M05-002 | Ajouter du texte |  | Absent |  | P2 |  |
| M05-003 | Modifier les points |  | Absent |  | P1 |  |
| M05-004 | Regroupement / Ordre / Rotation ▸ |  | OK | app/App.tsx | P1 | Ordre, Grouper, Rotation dans le menu de la forme ; prouvé |
| M05-005 | Format de la forme (boîte) |  | OK | app/dialogs-format.tsx | P1 | Format de la forme à onglets (remplissage uni, dégradé, motif ; trait) ; prouvé |
| M05-006 | Définir comme forme par défaut |  | Absent |  | P2 |  |
| M05-007 | Lien hypertexte / Texte de remplacement |  | À vérifier | app/App.tsx | P2 |  |

### 2.6 Tableau et cellule

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M06-001 | Couper / Copier / Coller |  | OK | app/App.tsx | P1 | menu de l'objet appliqué au tableau |
| M06-002 | Insérer ▸ (colonnes à gauche/droite, lignes au-dessus/en dessous) |  | OK | app/ribbon/contextual.tsx | P1 | Insérer au-dessus, en dessous, à gauche, à droite ; prouvé |
| M06-003 | Supprimer ▸ (cellules, lignes, colonnes, tableau) |  | OK | app/ribbon/contextual.tsx | P1 | Supprimer ligne, colonne, tableau ; prouvé |
| M06-004 | Fusionner / Fractionner les cellules |  | OK | app/ribbon/contextual.tsx | P1 | Fusionner, Fractionner les cellules dans le menu du tableau |
| M06-005 | Format du tableau (bordures, trame) |  | Absent |  | P1 |  |
| M06-006 | Répartir les lignes/colonnes uniformément |  | Absent |  | P2 |  |
| M06-007 | Mise en forme automatique du tableau |  | Absent |  | P2 |  |

### 2.7 Repères, règle et liens entre zones

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M07-001 | Repère : déplacer ; le sortir de la page le supprime |  | OK | guides.ts, app/Stage.tsx | P1 | prouvé (repère créé en tirant depuis la règle) |
| M07-002 | Repère : Supprimer le repère, Verrouiller les repères (menu) |  | Absent |  | P2 |  |
| M07-003 | Règle : Définir l'origine (Ctrl+glisser), unités (cm, mm, pouces, pica, points) |  | Absent |  | P2 | règle en centimètres uniquement |
| M07-004 | Règle : double-clic = Repères de disposition |  | Absent |  | P3 |  |
| M07-005 | Lien entre zones : indicateur « A… » (débordement) + bouton Précédent/Suivant |  | OK | chain.ts, app/Stage.tsx | P1 | prouvé |
| M07-006 | Lien entre zones : flèche cliquable de rupture de lien, texte de continuité (« Suite page … », « Suite de la page … ») |  | OK | pagecss.ts, app/Stage.tsx | P1 | « Suite page n » / « Suite de la page n » (option Création de page) et bouton Rompre le lien ; prouvé |

### 2.8 Pages maîtres

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| M08-001 | Insérer / Dupliquer / Supprimer une page maître |  | À vérifier | app/App.tsx, app/PagesPane.tsx | P1 |  |
| M08-002 | Renommer la page maître |  | Absent |  | P2 |  |
| M08-003 | Appliquer à la page / Appliquer à toutes les pages |  | Absent |  | P2 |  |
| M08-004 | Mode maître : numéro de page, pied de page, objets de fond |  | Absent | app/ribbon/design.tsx | P1 | numéro de page posé : prouvé |

## 3. Mini-barre flottante

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| MB001 | Mini-barre de texte (police, taille, gras, italique, souligné, couleur, alignement, puces) |  | Absent |  | P1 | présente dans Publisher 2013+ |
| MB002 | Mini-barre d'image (rogner, luminosité, contraste) |  | Absent |  | P2 |  |
| MB003 | Mini-barre de tableau |  | Absent |  | P2 |  |
| MB004 | Mini-barre de forme (remplissage, contour) |  | Absent |  | P2 |  |
| MB005 | Barre d'objets flottante (tactile) |  | Partiel | packages/powerpoint/src/canvas/ObjectBar.tsx (réutilisée) | P2 | bureau : rien |
| MB006 | Poignée de coin de zone de texte : indicateur de débordement/lien (rendu par « A… ») |  | Absent | app/Stage.tsx | P2 | présent sous forme d'indicateur, à vérifier visuellement |

## 4. Boîtes de dialogue et volets

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| D001 | Format de la zone de texte : Zone de texte (marges, colonnes, alignement, ajustement) |  | À vérifier | app/dialogs.tsx | P1 |  |
| D002 | Format de la zone de texte : Couleurs et traits (remplissage, trait, motifs, transparence) |  | OK | app/dialogs-format.tsx | P1 | remplissage uni, dégradé, motif, transparence, trait ; prouvé |
| D003 | Format de la zone de texte : Taille (hauteur, largeur, rotation, échelle, verrouiller le rapport) |  | OK | app/dialogs-format.tsx | P1 | taille, rotation, rapport verrouillé ; prouvé |
| D004 | Format de la zone de texte : Disposition (position exacte, habillage, aligner) |  | OK | app/dialogs-format.tsx | P1 | position exacte, centrer sur la page, habillage ; prouvé |
| D005 | Format de la zone de texte : Texte de remplacement |  | À vérifier | app/dialogs.tsx | P2 |  |
| D006 | Format de l'image : Image (rognage numérique, luminosité, contraste, recolorer) |  | Partiel | app/dialogs-format.tsx | P1 | luminosité, contraste, transparence, nuances de gris prouvés ; recolorer et rognage numérique absents |
| D007 | Format de l'image : Couleurs et traits, Taille, Disposition |  | OK | app/dialogs-format.tsx | P1 | Couleurs et traits, Taille, Disposition de l'image ; prouvé |
| D008 | Boîte Habillage du texte (Aucun, Carré, Serré, Haut et bas ; Modifier le contour) |  | Partiel | app/dialogs-format.tsx | P1 | modes Aucun, Carré, Ajusté, Haut et bas dans l'onglet Disposition ; marges et contour modifiable à la souris absents |
| D009 | Boîte Repères de disposition (Marges, Grille, Lignes de base) |  | À vérifier | app/dialogs.tsx | P1 |  |
| D010 | Boîte Insérer des pages |  | À vérifier | app/dialogs.tsx | P2 |  |
| D011 | Boîte Arrière-plan (teintes, dégradé) |  | À vérifier | app/dialogs.tsx | P2 |  |
| D012 | Boîte Lien hypertexte |  | À vérifier | app/dialogs.tsx | P2 |  |
| D013 | Boîte Rechercher / Remplacer |  | À vérifier | app/dialogs.tsx | P2 |  |
| D014 | Boîte Rognage de l'image |  | À vérifier | app/CropOverlay.tsx | P1 |  |
| D015 | Boîte Destinataires du publipostage (champs, filtre, enregistrements) |  | À vérifier | app/dialogs.tsx | P1 |  |
| D016 | Boîte Mise en page / Taille personnalisée |  | À vérifier | app/dialogs.tsx | P1 |  |
| D017 | Boîte Mise en page avancée (type de publication, feuille, étiquettes, plis, imposition libre) |  | Absent |  | P1 |  |
| D018 | Volet Vérificateur de conception |  | À vérifier | app/CheckPane.tsx | P1 |  |
| D019 | Volet Navigation entre les pages |  | À vérifier | app/PagesPane.tsx | P1 |  |
| D020 | Volet Styles (styles de texte nommés) |  | OK | app/dialogs-styles.tsx | P1 | voir R01-026 |
| D021 | Volet Gestionnaire d'images / Liens graphiques (mettre à jour, intégrer) |  | Absent |  | P2 |  |
| D022 | Boîte Polices : remplacer les polices, incorporer |  | Absent |  | P2 |  |
| D023 | Boîte Couleurs : modèle de couleurs personnalisé, palette CMJN / ton direct |  | Partiel | spots.ts, app/dialogs.tsx | P1 | tons directs (nom, couleur d'écran, valeur CMJN) ; palette CMJN libre absente |
| D024 | Boîte Police (effets, espacement, crénage), Paragraphe (retraits, tabulations, césure, interligne), Tabulations |  | Partiel | app/dialogs-text.tsx | P1 | Police et Paragraphe prouvées ; Tabulations et césure absentes |
| D025 | Boîte Options de typographie (lettrines personnalisées, ligatures, alternatives) |  | Absent |  | P2 |  |
| D026 | Boîte Texte en colonnes avancée (largeur inégale) |  | Absent |  | P3 |  |
| D027 | Boîte Style de bordure / Bordures et accents |  | Absent |  | P2 |  |
| D028 | Volet Sélection (liste des objets de la page) |  | Absent |  | P2 |  |
| D029 | Volet Pages maîtres |  | Absent |  | P2 |  |
| D030 | Assistant Pack and Go (empaqueter pour l'imprimeur : polices et images incorporées) |  | OK | packgo.ts, app/packgo.ts | P1 | ZIP : PDF imprimeur, .fopub, images, LISEZ-MOI (polices, tons directs) ; les fichiers de polices ne sont pas incorporés ; prouvé |
| D031 | Boîte Impression commerciale (séparations, repères, couleurs, aperçu de composites) |  | Absent |  | P2 |  |
| D032 | Boîte Options Publisher (Général, Avancé, Édition, Vérification, Enregistrement, Langue) |  | Partiel | app/options.tsx | P1 | Fichier > Options : correcteur, langue, copie de récupération, règles, limites, magnétisme ; unités et touches d'accès absentes |
| D033 | Boîte Propriétés du document |  | Absent |  | P3 |  |
| D034 | Volet Recherche de la bibliothèque de contenu |  | Absent |  | P3 |  |

## 5. Raccourcis clavier

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| K001 | Nouvelle publication | Ctrl+N | À vérifier |  | P2 |  |
| K002 | Ouvrir | Ctrl+O | À vérifier | app/App.tsx | P1 |  |
| K003 | Enregistrer | Ctrl+S | OK | app/App.tsx | P1 | prouvé |
| K004 | Enregistrer sous | Maj+Ctrl+S (Office : F12) | À vérifier | app/App.tsx | P2 |  |
| K005 | Imprimer | Ctrl+P | À vérifier | app/App.tsx | P1 |  |
| K006 | Annuler / Rétablir | Ctrl+Z / Ctrl+Y | À vérifier | app/App.tsx | P1 |  |
| K007 | Rechercher / Remplacer | Ctrl+F / Ctrl+H | À vérifier | app/App.tsx | P2 |  |
| K008 | Insérer une page | Ctrl+Maj+N | À vérifier | app/App.tsx | P1 |  |
| K009 | Gras / Italique / Souligné | Ctrl+G, Ctrl+I, Ctrl+U | À vérifier | app/App.tsx | P1 | seulement quand un texte est en édition |
| K010 | Aligner (centré, gauche, droite, justifié) | Ctrl+E, L, R, J | À vérifier | app/App.tsx | P1 |  |
| K011 | Agrandir / Réduire la police | Ctrl+Maj+> / < | À vérifier | app/App.tsx | P2 |  |
| K012 | Aller à la page | F5 ou Ctrl+G (K) | OK | app/App.tsx | P1 | F5 ; Ctrl+G reste Gras comme dans Word en français |
| K013 | Zoom 100 % / page entière | F9 / Maj+F9 (K) | Absent |  | P2 |  |
| K014 | Afficher / masquer les repères | Ctrl+Alt+Maj+? (K) | Absent |  | P3 |  |
| K015 | Grouper / Dissocier | Ctrl+Maj+G / Ctrl+Maj+R (K) | OK | app/App.tsx | P1 | Ctrl+Maj+G / Ctrl+Maj+R ; prouvé |
| K016 | Sélectionner tout | Ctrl+A | À vérifier | packages/powerpoint/src/canvas/keys.ts | P1 |  |
| K017 | Dupliquer | Ctrl+D | À vérifier | packages/powerpoint/src/canvas/keys.ts | P2 |  |
| K018 | Supprimer | Suppr | À vérifier | packages/powerpoint/src/canvas/keys.ts | P1 |  |
| K019 | Déplacer l'objet (flèches, Ctrl = pas fin) | flèches | À vérifier | packages/powerpoint/src/canvas/keys.ts | P1 |  |
| K020 | Mettre au premier plan / à l'arrière-plan | Ctrl+Maj+F / Ctrl+Maj+B (K) | Absent |  | P2 |  |
| K021 | Texte : passer à la zone suivante | Ctrl+Entrée / F2 (K) | Absent |  | P2 |  |
| K022 | Orthographe | F7 | Absent |  | P2 |  |
| K023 | Touches d'accès (Alt puis lettre) | Alt | Absent |  | P2 |  |
| K024 | Basculer entre les pages maîtres et normale | Ctrl+M (K) | Absent |  | P3 |  |
| K025 | Copier / coller la mise en forme | Ctrl+Maj+C / V | Absent |  | P2 | le bouton Reproduire existe ; raccourci non géré dans App.tsx |
| K026 | Fermer la publication | Ctrl+W | Absent |  | P2 |  |

## 6. Backstage (Fichier)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| B001 | Nouveau (catalogue : prospectus, cartes, affiches, invitations, brochures, calendriers…) |  | OK | app/backstage.tsx, templates/ | P1 | prouvé ; 13 compositions |
| B002 | Nouveau : modèles en ligne, recherche, favoris |  | Absent |  | P3 |  |
| B003 | Ouvrir (.fopub, .pptx importé) | Ctrl+O | À vérifier | app/backstage.tsx | P1 | les fichiers .pub (Publisher) ne sont pas lus |
| B004 | Ouvrir : fichiers .pub Publisher |  | Absent |  | P1 | ForgeOffice ne lit pas le format binaire ; passer par PDF/PowerPoint serait un contournement |
| B005 | Informations (propriétés, titre) |  | À vérifier | app/backstage.tsx | P2 |  |
| B006 | Informations : Gestionnaire d'images, Compresser les images, Exécuter le vérificateur de conception, Accessibilité |  | Absent |  | P2 | le vérificateur existe en volet |
| B007 | Enregistrer / Enregistrer sous (.fopub, .pptx) | Ctrl+S | OK | app/backstage.tsx | P1 | prouvé |
| B008 | Enregistrer sous : .pub, modèle, PDF/XPS, Pack and Go |  | Partiel | app/packgo.ts | P1 | Pack and Go et PDF prouvés ; .pub absent |
| B009 | Imprimer (pages, imposition, traits de coupe, aperçu) | Ctrl+P | À vérifier | app/backstage.tsx | P1 | aperçu et export PDF prouvés, impression système non prouvée |
| B010 | Imprimer : recto verso, brochure/plis, séparation des couleurs, agrandissement, une page par feuille |  | Absent |  | P2 |  |
| B011 | Exporter : PDF imprimeur (300 ppp, fonds perdus, TrimBox/BleedBox) |  | À vérifier | app/export.ts | P1 | plus que Publisher ; prouvé |
| B012 | Exporter : PNG, .pptx |  | OK | app/export.ts | P2 | prouvé |
| B013 | Exporter : PDF vectoriel (texte sélectionnable), PDF/X-1a, polices incorporées |  | Partiel | app/vectorpdf.ts | P1 | PDF vectoriel à texte sélectionnable prouvé (polices standard, sans habillage ni fond perdu) ; PDF/X-1a absent |
| B014 | Exporter : Pack and Go, e-mail, HTML |  | Absent |  | P2 |  |
| B015 | Partager, Compte, Options |  | Absent |  | P2 | nom d'auteur seulement |

## 7. Modes d'affichage, règles, repères, planches, pages maîtres

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| V001 | Mode Page (normal), une page, deux pages |  | À vérifier | app/ribbon/views.tsx | P1 |  |
| V002 | Page maître |  | À vérifier | app/ribbon/views.tsx | P1 |  |
| V003 | Règles (cm, zéro au bord de page) |  | À vérifier | packages/powerpoint/src/canvas/Rulers.tsx | P1 |  |
| V004 | Repères de marge (roses), colonnes (bleus), repères de règle (verts) |  | OK | guides.ts | P1 | prouvé (repères de colonnes, repère de règle) |
| V005 | Lignes de base |  | À vérifier | guides.ts | P2 |  |
| V006 | Limites des objets (pointillés) |  | À vérifier | app/ribbon/views.tsx | P2 |  |
| V007 | Zoom : 100 %, page entière, largeur de page |  | À vérifier | app/ribbon/views.tsx | P1 |  |
| V008 | Zoom libre, Ctrl+molette ; zone de travail hors page (planche, objets en réserve) |  | Partiel | workspace.ts, app/workspaceops.ts | P1 | objets hors page visibles à l'écran, Mettre dans la zone de travail, Replacer ; zone de travail non dessinée |
| V009 | Magnétisme sur repères et objets |  | À vérifier | guides.ts | P1 |  |
| V010 | Volet de navigation des pages avec planches en vis-à-vis |  | À vérifier | app/PagesPane.tsx | P1 |  |
| V011 | Affichage Épreuve (épreuve d'impression, aperçu composite/séparations) |  | Absent |  | P2 |  |
| V012 | Afficher/masquer les caractères non imprimables |  | Absent |  | P2 |  |
| V013 | Zone de travail (objets sur le bureau, hors page) |  | Partiel | workspace.ts | P1 | voir V008 |

## 8. Fonctions invisibles (chaînage, habillage, typographie, couleur, fusion, impression)

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| F001 | Zones de texte chaînées (débordement, recomposition, rupture) |  | OK | chain.ts, flow.ts | P1 | prouvé (7 tests flow + banc) |
| F002 | Habillage autour des images (carré, haut-bas) |  | OK | wrap.ts | P1 | prouvé ; « ajusté » limité aux ellipses |
| F003 | Habillage : 1 colonne, 2 objets par zone au maximum |  | OK | wrap.ts | P1 | nombre quelconque d'objets, colonnes, contour réel (tests wrap.test.ts) |
| F004 | Lettrines |  | OK | wrap.ts | P2 | prouvé |
| F005 | Typographie OpenType (ligatures, alternatives stylistiques, chiffres elzéviriens, petites capitales) |  | Absent |  | P2 |  |
| F006 | Césure automatique |  | Absent |  | P2 |  |
| F007 | Crénage et approche (tracking) |  | Absent |  | P2 |  |
| F008 | Styles de texte nommés (paragraphe, caractère) |  | OK | styles.ts | P1 | voir R01-026 |
| F009 | Couleurs : modèles personnalisés, CMJN, tons directs, teintes, séparations |  | Partiel | spots.ts | P1 | tons directs avec valeur CMJN prouvée dans le PDF CMJN ; séparations et teintes absentes |
| F010 | Surimpression, repères de couleur, marques d'impression complètes |  | Absent |  | P3 | traits de coupe et fond perdu existent |
| F011 | PDF/X, profils ICC |  | Absent |  | P2 |  |
| F012 | Fonds perdus et traits de coupe |  | OK | app/export.ts | P1 | prouvé |
| F013 | Imposition (cartes, étiquettes, livret) |  | OK | imposition.ts | P1 | prouvé |
| F014 | Publipostage CSV/xlsx avec champs de fusion |  | OK | merge.ts | P1 | prouvé (CSV) ; xlsx testé |
| F015 | Fusion avec images (champ image) |  | OK | mergeimages.ts | P1 | voir R04-006 |
| F016 | Fusion de catalogue |  | Absent |  | P2 |  |
| F017 | Fusion de courriel |  | Absent |  | P3 |  |
| F018 | Vérificateur de conception continu |  | À vérifier | check.ts | P1 | plus que Publisher |
| F019 | Bibliothèque de contenu / blocs personnalisés |  | Absent |  | P2 |  |
| F020 | Pack and Go (polices et images incorporées) |  | OK | packgo.ts | P1 | voir D030 |
| F021 | Lien vers les images (liées / incorporées) et mise à jour |  | Absent |  | P2 |  |
| F022 | Recomposition automatique avec police absente (repli) |  | Partiel | fonts-recomposition.test.ts | P2 | un test existe ; mesure par canvas + 3 % de marge (STATUS) |
| F023 | Assistants de création (Étiquettes, Calendriers complets, Cartes pliées en plusieurs tailles) |  | Absent |  | P2 | catalogue de 13 compositions |
| F024 | Pages à thèmes alternées gauche/droite avec en-têtes miroir |  | Absent |  | P2 | marges miroir : présent |
| F025 | Calendrier mensuel (12 pages, tableau) |  | À vérifier | calendar.ts | P2 |  |
| F026 | Double-clic sur le texte pour éditer la story dans un éditeur dédié |  | Absent |  | P3 |  |
| F027 | Importer un fichier Word/RTF dans une zone de texte |  | OK | textfile.ts | P1 | voir R02-021 |
| F028 | Insérer du texte automatiquement dans des zones vides (Autoflow, confirmation) |  | Absent |  | P2 |  |
| F029 | Lecture de .pub, import Word/PDF |  | Absent |  | P2 |  |
| F030 | Orthographe pendant la saisie avec dictionnaire de la publication |  | Absent |  | P2 | le navigateur souligne ; pas de volet |
| F031 | Accessibilité (ordre de lecture, texte de remplacement obligatoire) |  | Absent |  | P3 |  |

## 9. Manipulation directe des objets

| Réf | Élément | Raccourci / type | Statut | Code (preuve) | Prio | Note |
|---|---|---|---|---|---|---|
| G001 | Sélection, déplacement, rotation, redimensionnement avec poignées (moteur du canvas) |  | À vérifier | packages/powerpoint/src/canvas/CanvasEditor.tsx | P1 | moteur partagé avec Présentation |
| G002 | Création d'une zone de texte au cadre |  | À vérifier | app/Stage.tsx | P1 |  |
| G003 | Insertion d'image dans un cadre d'image (recadrage aux proportions) |  | OK | app/ops.ts | P1 | prouvé |
| G004 | Rognage interactif de l'image |  | À vérifier | app/CropOverlay.tsx | P1 | à vérifier |
| G005 | Déplacer une page par glisser dans le volet |  | À vérifier | app/PagesPane.tsx | P2 | STATUS : glisser pour déplacer |
| G006 | Repère créé en tirant depuis la règle |  | OK | app/Stage.tsx | P1 | prouvé |
| G007 | Sélection de plusieurs objets au rectangle (lasso) |  | À vérifier | packages/powerpoint/src/canvas/CanvasEditor.tsx | P1 | moteur partagé |
| G008 | Verrouiller un objet |  | Absent |  | P2 |  |
| G009 | Déplacer un objet d'une page à l'autre (glisser vers la page voisine) |  | Partiel | workspace.ts, app/workspaceops.ts | P1 | menu Envoyer à la page précédente / suivante prouvé ; glisser entre pages absent |
| G010 | Pas fin : Alt+glisser ; Ctrl+flèche |  | Absent |  | P2 |  |
| G011 | Magnétisme aux repères, marges, objets |  | À vérifier | guides.ts | P1 |  |
| G012 | Poignée d'habillage du texte (modifier le contour) |  | Absent |  | P2 |  |
| G013 | Positions mesurées en direct (infobulle mesure) |  | Absent |  | P2 | barre d'état : position/taille présentes |

## 10. AU-DELÀ D'OFFICE (20 idées)

1. **PDF vectoriel natif avec polices incorporées** : Réutiliser le moteur PDF vectoriel de la Présentation : texte sélectionnable, polices sous-ensemblées, PDF/X-4.
2. **Gestion de la couleur de bout en bout** : Couleurs en CMJN et tons directs, aperçu de séparation des plaques, épreuve écran conforme à un profil ICC.
3. **Pré-vol imprimeur** : Vérificateur de conception étendu : fonds perdus manquants, texte hors zone de sécurité, couverture d'encre totale, images CMJN, résolution effective.
4. **Pack and Go ouvert** : Dossier ou ZIP d'envoi avec PDF, polices, images liées et fichier source .fopub, sans service en ligne.
5. **Importation de .pub** : Lecture progressive des fichiers Publisher (texte, images, pages maîtres) pour reprendre les publications existantes.
6. **Import Word/Texte avec styles** : Poser un document Texte de la suite dans des zones chaînées, en conservant les styles de paragraphe.
7. **Styles de texte liés à la suite** : Styles partagés avec Texte (Word) : un changement de style se propage aux publications ouvertes.
8. **Éditeur de story inline** : Vue « galée » du texte d'un article chaîné, avec compteur de lignes de dépassement.
9. **Césure et justification de qualité** : Algorithme de composition paragraphe entier (Knuth-Plass), césure française, veuves et orphelines.
10. **Typographie OpenType complète** : Panneau de fonctionnalités : ligatures, petites capitales, chiffres, alternatives stylistiques, variations de fonte.
11. **Grille de mise en page modulaire** : Modules et gouttières avec zones de texte qui s'accrochent aux cellules, variantes par page maître.
12. **Fusion de données élargie** : Sources Tableur/Base de données de la suite (liaison vivante), champs image, conditions, répétitions de blocs.
13. **Assistants de gabarits à variables** : Un gabarit (carte, étiquette) se remplit par formulaire et produit les planches imposées.
14. **Bibliothèque de blocs de contenu personnelle** : Enregistrer un objet ou un groupe, le retrouver par étiquette, le glisser dans toute publication.
15. **Imposition avancée** : Cahiers piqûre à cheval/dos carré/livre à plat, marges de reliure, échelle automatique par feuille, repères de pliage.
16. **Comparaison de versions de publications** : Voir ce qui a changé page par page (texte, position, images), restaurer un état.
17. **Export multi-format** : EPUB à maquette fixe, images par page, SVG, HTML d'aperçu pour relecture client.
18. **Commentaires de relecture sur la page** : Annotations ancrées sur des zones, résolues avant l'impression ; export des remarques.
19. **Contrôle d'accessibilité du PDF** : Balises, ordre de lecture, langue, texte de remplacement obligatoire avant export.
20. **Palette de commandes et raccourcis personnalisables** : Ctrl+Maj+P commun à toute la suite, recherche de commandes en français.

## Annexe : limites de l'audit
- Publisher absent : noms de commandes et menus de mémoire (à confirmer), aucun relevé UIA.
- Aucune exécution de ForgeOffice : « À vérifier » = non prouvé, pas « cassé ».
- Les raccourcis marqués (K) sont de mémoire et à confirmer.
