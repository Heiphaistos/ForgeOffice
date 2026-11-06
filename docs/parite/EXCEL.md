# Parité Tableur ForgeOffice / Microsoft Excel 365 (interface française)

Audit établi le 2026-11-05 (reprise du 2026-11-05 après coupure). **Aucun code modifié.** Dépôt : `D:\Projet\ForgeOffice`, paquet `packages/excel` (11 288 lignes, 55 fichiers source), moteur `packages/formulas` (505 fonctions, 927 tests), modèle `packages/xlsx` (tableaux croisés persistants, 59 tests).

## Méthode et sources

- **Vérité-terrain Excel** : Excel 365 `16.0.20527.20112` (fr-FR) piloté par COM, fenêtre positionnée à -32000/-32000 et affichée sans activation (`ShowWindow SW_SHOWNOACTIVATE`), lu par UI Automation (`System.Windows.Automation`) : onglets, groupes, commandes, accélérateurs, info-touches Alt, contenu de nombreux menus (galerie des formes, MFC, Obtenir des données, styles de tableau...), onglets contextuels (Création de tableau, Création de graphique + Mise en forme, Analyse du TCD + Création, Format de l'image, Format de forme, Segment, Chronologie, Sparkline) et liste du Backstage. Instance propre, `Quit()` dans `finally`, aucun processus laissé ; aucun focus volé, aucune souris ni frappe injectée.
- **Limites UIA** : certains menus (Recopier, Trier et filtrer, galeries de graphiques, effets d'image) ne se sont pas dépliés sans activation de la fenêtre ; leur contenu vient de la **connaissance** d'Excel (noté K). L'onglet « Automatiser », « Dictée », « Analyser les données » et « Sensibilité » sont absents de cette installation (licence). Les **menus contextuels** et la **mini-barre** exigent un vrai clic droit : source connaissance uniquement.
- **Statut ForgeOffice** : établi en **lisant le code** (fichiers cités). Aucune exécution de l'interface n'a eu lieu dans cet audit, donc aucune ligne n'est « prouvée » au sens strict.

## Statuts (reprise demandée par le coordinateur)

| Statut | Sens |
|---|---|
| **Absent** | aucune implémentation (ou chaîne de texte morte non branchée) |
| **Partiel** | existe mais incomplet par rapport à Excel (options, variantes, boîte manquante) |
| **À vérifier** | **présent mais à vérifier** : le code existe et semble complet, l'effet n'est pas prouvé (le propriétaire a constaté que certaines options ne fonctionnent pas) ; « (logique couverte par node --test) » signale que la couche sans DOM est couverte par des tests, pas l'interface |

Priorités : **P1** = socle utilisé couramment ou attendu de tout utilisateur d'Excel ; **P2** = fréquent chez les utilisateurs avancés ; **P3** = niche, rare ou hors périmètre assumé (Power Query, macros, co-édition).

## Légende des preuves (chemins relatifs à `packages/excel/src` sauf mention)

`RH` ribbon/home.tsx · `RT` ribbon/tabs.tsx · `RC` ribbon/contextual.tsx · `RE` ribbon/env.ts · `STR`/`S.`/`RB.` strings.ts · `APP` App.tsx · `CMD` ui/commands.ts · `ACT` ui/actions.ts · `KEY` ui/keys.ts · `CLP` ui/clipboard-ui.ts (dont `gridContextMenu`) · `GRD` ui/Grid.tsx · `PNT` ui/paint.ts · `DRW` ui/Drawings.tsx · `CHV` ui/ChartView.tsx · `SHT` ui/SheetTabs.tsx · `HST` ui/Hosts.tsx · `DLB` ui/dialogs/basic.tsx · `DLD` ui/dialogs/data.tsx · `DLF` ui/dialogs/formula.tsx · `PAN` ui/Panes.tsx · `BST` ui/BackstagePages.tsx · `FBR` ui/FormulaBar.tsx · `FIN` ui/FormulaInput.tsx · `FLT` ui/FilterHost.tsx · `PRT` ui/print.tsx · `UFO` ui/useFileOps.ts · `L-xxx` logic/xxx.ts · `UI` packages/ui/src (Ribbon, TitleBar, MiniToolbar, Backstage, ColorPicker, Panels...) · `FRM` packages/formulas · `XLSX` packages/xlsx.

## Bilan chiffré

**907 entrées** : Absent 421 (46.4 %), Partiel 161 (17.8 %), À vérifier 325 (35.8 %). Aucune entrée n'est marquée « prouvée ».

### Par section

| | Entrées | Absent | Partiel | À vérifier | % Absent | % Partiel | % À vérifier |
|---|---|---|---|---|---|---|---|
| 1. Ruban | 387 | 165 | 78 | 144 | 42.6 % | 20.2 % | 37.2 % |
| 2. Menus contextuels (clic droit) et gestes à la souris | 104 | 60 | 16 | 28 | 57.7 % | 15.4 % | 26.9 % |
| 3. Mini-barre flottante de mise en forme | 20 | 20 | 0 | 0 | 100.0 % | 0.0 % | 0.0 % |
| 4. Boîtes de dialogue | 157 | 87 | 32 | 38 | 55.4 % | 20.4 % | 24.2 % |
| 5. Raccourcis clavier (Excel FR) | 121 | 51 | 5 | 65 | 42.1 % | 4.1 % | 53.7 % |
| 6. Volets (panneaux latéraux) | 19 | 13 | 3 | 3 | 68.4 % | 15.8 % | 15.8 % |
| 7. Backstage (onglet Fichier) | 20 | 2 | 12 | 6 | 10.0 % | 60.0 % | 30.0 % |
| 8. Barre d'état, modes d'affichage, zoom, fenêtres, grille | 41 | 12 | 6 | 23 | 29.3 % | 14.6 % | 56.1 % |
| 9. Fonctions « invisibles » (comportements implicites) | 38 | 11 | 9 | 18 | 28.9 % | 23.7 % | 47.4 % |

### Par type d'élément

| | Entrées | Absent | Partiel | À vérifier | % Absent | % Partiel | % À vérifier |
|---|---|---|---|---|---|---|---|
| Cmd | 255 | 112 | 33 | 110 | 43.9 % | 12.9 % | 43.1 % |
| Dialogue | 145 | 80 | 34 | 31 | 55.2 % | 23.4 % | 21.4 % |
| Raccourci | 121 | 51 | 5 | 65 | 42.1 % | 4.1 % | 53.7 % |
| Menu | 89 | 48 | 26 | 15 | 53.9 % | 29.2 % | 16.9 % |
| Option | 55 | 15 | 14 | 26 | 27.3 % | 25.5 % | 47.3 % |
| Affichage | 38 | 18 | 4 | 16 | 47.4 % | 10.5 % | 42.1 % |
| Geste | 33 | 21 | 2 | 10 | 63.6 % | 6.1 % | 30.3 % |
| Case | 33 | 10 | 1 | 22 | 30.3 % | 3.0 % | 66.7 % |
| Galerie | 31 | 18 | 12 | 1 | 58.1 % | 38.7 % | 3.2 % |
| Volet | 30 | 25 | 3 | 2 | 83.3 % | 10.0 % | 6.7 % |
| Liste | 28 | 13 | 7 | 8 | 46.4 % | 25.0 % | 28.6 % |
| Saisie | 18 | 5 | 3 | 10 | 27.8 % | 16.7 % | 55.6 % |
| Page | 17 | 2 | 12 | 3 | 11.8 % | 70.6 % | 17.6 % |
| Onglet | 10 | 3 | 3 | 4 | 30.0 % | 30.0 % | 40.0 % |
| Lanceur | 4 | 0 | 2 | 2 | 0.0 % | 50.0 % | 50.0 % |

### Par priorité

| Priorité | Entrées | Absent | Partiel | À vérifier |
|---|---|---|---|---|
| P1 | 449 | 100 | 87 | 262 |
| P2 | 272 | 156 | 59 | 57 |
| P3 | 186 | 165 | 15 | 6 |

Lecture : le ruban de base (Accueil) est largement présent ; les écarts massifs sont les menus contextuels (hors grille), la mini-barre, les boîtes de dialogue riches (Format de cellule, Mise en page, Options), les objets (formes, segments, image, éléments de graphique), le glisser-déplacer de cellules, et l'interaction avec le fichier (TCD, liens, en-têtes/pieds).

Table des matières : 1 Ruban · 2 Menus contextuels et gestes · 3 Mini-barre · 4 Boîtes de dialogue · 5 Raccourcis · 6 Volets · 7 Backstage · 8 Barre d'état, affichages, grille · 9 Fonctions invisibles · 10 Défauts suspects · 11 Au-delà d'Office.


## 1. Ruban

> Source : arbre UI Automation d'Excel 365 (16.0.20527, fr-FR) lu par COM hors écran : onglets, groupes, commandes, raccourcis Alt (info-touches) et contenus de menus. Les contenus de menu que UIA n'a pas pu déplier sont notés « (K) » = connaissance. Le ruban de ForgeOffice est décrit dans `ribbon/*.tsx` ; la coque (recherche, réduction du ruban, info-touches, barre d'accès rapide) vient de `packages/ui`.


### 1.0 Coque : barre de titre, accès rapide, onglets

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.0-01 | Onglet Fichier (Backstage) | Cmd | Alt, F | À vérifier | APP onFile -> BST (voir section 7) | P1 |
| R1.0-02 | Barre d'accès rapide : Enregistrer | Cmd | Ctrl+S | À vérifier | APP quickAccess | P1 |
| R1.0-03 | Barre d'accès rapide : Annuler (liste déroulante d'historique) | Cmd | Ctrl+Z | Partiel | APP quickAccess : annule 1 pas, pas de liste des actions | P2 |
| R1.0-04 | Barre d'accès rapide : Rétablir | Cmd | Ctrl+Y | À vérifier | APP quickAccess | P1 |
| R1.0-05 | Barre d'accès rapide : Impression rapide (masquée par défaut) | Cmd |  | À vérifier | APP quickAccess print | P3 |
| R1.0-06 | Personnaliser la barre d'outils Accès rapide... | Menu |  | Partiel | UI TitleBar (cases Enregistrement automatique) ; pas d'ajout de commandes arbitraires | P3 |
| R1.0-07 | Enregistrement automatique (interrupteur) | Option |  | Partiel | APP autoSave : bouton présent, désactivé sans chemin ; pas de synchro cloud | P3 |
| R1.0-08 | Tapez pour rechercher (Dites-nous ce que vous voulez faire) | Saisie | Alt, Q | À vérifier | UI TitleBar CommandSearch alimenté par collectCommands(tabs) | P1 |
| R1.0-09 | Nom du compte (MeControlWidget) | Cmd | Alt, Z P | Absent | ForgeOffice local sans compte (BST account) | P3 |
| R1.0-10 | Partager | Cmd | Alt, Z S | Absent | pas de partage/co-édition | P3 |
| R1.0-11 | Commentaires (bouton en fin de ruban) | Cmd |  | À vérifier | APP Ribbon end -> volet Commentaires | P2 |
| R1.0-12 | Options d'affichage du ruban (Toujours afficher / Onglets seulement) | Menu | Ctrl+F1 | À vérifier | UI Ribbon.tsx collapse/alwaysShow | P2 |
| R1.0-13 | Info-touches (Alt puis lettres) | Option | Alt | Partiel | UI KeytipLayer ; keytip défini sur 7 onglets (RH/RT), pas sur chaque commande | P2 |
| R1.0-14 | Ruban simplifié / classique | Option |  | À vérifier | UI Ribbon.tsx layout classic/simplified (extension) | P3 |
| R1.0-15 | Onglet Accueil | Onglet | Alt, L | À vérifier | RH homeTab (keytip L) | P1 |
| R1.0-16 | Onglet Insertion | Onglet | Alt, S | Partiel | RT insertTab ; keytip défini 'N' au lieu de 'S' (Excel FR : Alt+S) | P2 |
| R1.0-17 | Onglet Dessin | Onglet | Alt, J I | Absent | aucun onglet Dessin | P3 |
| R1.0-18 | Onglet Mise en page | Onglet | Alt, P | À vérifier | RT layoutTab | P1 |
| R1.0-19 | Onglet Formules | Onglet | Alt, U | À vérifier | RT formulasTab | P1 |
| R1.0-20 | Onglet Données | Onglet | Alt, É | Partiel | RT dataTab ; keytip 'D' au lieu de 'É' | P2 |
| R1.0-21 | Onglet Révision | Onglet | Alt, R | À vérifier | RT reviewTab | P1 |
| R1.0-22 | Onglet Affichage | Onglet | Alt, N | Partiel | RT viewTab ; keytip 'A' au lieu de 'N' | P2 |
| R1.0-23 | Onglet Automatiser (Scripts Office, Power Automate) | Onglet |  | Absent | aucun script ; absent aussi de cette installation Excel (licence) | P3 |
| R1.0-24 | Onglet Aide | Onglet | Alt, Ù | Absent | aucun onglet Aide | P3 |


### 1.1 Accueil > Presse-papiers

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.1-01 | Coller (bouton fractionné) | Cmd | Ctrl+V | À vérifier | RH paste + CLP useClipboard (TSV/HTML/interne) | P1 |
| R1.1-02 | Coller > Coller (Options de collage) | Cmd |  | À vérifier | RH pasteItems 'all' | P1 |
| R1.1-03 | Coller > Formules | Cmd |  | À vérifier | RH pasteItems 'formulas' | P1 |
| R1.1-04 | Coller > Formules et mise en forme des nombres | Cmd |  | Absent | - | P3 |
| R1.1-05 | Coller > Conserver la mise en forme source | Cmd |  | Absent | L-clipboard : seul le style cellule est copié, pas de mode « source » | P2 |
| R1.1-06 | Coller > Sans bordures | Cmd |  | Partiel | DLB PasteSpecialDialog 'Tout sauf la bordure' ; absent du menu | P3 |
| R1.1-07 | Coller > Conserver la largeur des colonnes sources | Cmd |  | Absent | - | P2 |
| R1.1-08 | Coller > Transposer | Cmd |  | À vérifier | RH pasteItems 'transpose' | P2 |
| R1.1-09 | Coller > Valeurs | Cmd |  | À vérifier | RH pasteItems 'values' | P1 |
| R1.1-10 | Coller > Valeurs et mise en forme des nombres | Cmd |  | Partiel | DLB 'valuesAndFormats' (dialogue seulement) | P2 |
| R1.1-11 | Coller > Valeurs et mise en forme source | Cmd |  | Absent | - | P3 |
| R1.1-12 | Coller > Mise en forme | Cmd |  | À vérifier | RH pasteItems 'formats' | P2 |
| R1.1-13 | Coller > Coller avec liaison | Cmd |  | Absent | - | P3 |
| R1.1-14 | Coller > Image / Image liée | Cmd |  | Absent | pas de presse-papiers image | P3 |
| R1.1-15 | Coller > Collage spécial... | Cmd | Ctrl+Alt+V | À vérifier | RH + DLB PasteSpecialDialog | P1 |
| R1.1-16 | Couper | Cmd | Ctrl+X | À vérifier | RH cut | P1 |
| R1.1-17 | Copier (bouton fractionné) | Cmd | Ctrl+C | À vérifier | RH copy | P1 |
| R1.1-18 | Copier > Copier en tant qu'image... | Cmd |  | Absent | - | P3 |
| R1.1-19 | Reproduire la mise en forme (clic simple) | Cmd |  | À vérifier | RH painter + APP painter | P1 |
| R1.1-20 | Reproduire la mise en forme (double-clic = mode persistant) | Geste |  | Absent | APP painter : un seul usage puis setPainter(null) | P2 |
| R1.1-21 | Presse-papiers Office... (volet historique) | Volet | Alt, L, F R | Absent | aucun volet presse-papiers (24 éléments) | P3 |
| R1.1-22 | Lanceur de groupe Presse-papiers | Lanceur |  | Partiel | RH launcher ouvre Collage spécial au lieu du volet | P3 |


### 1.2 Accueil > Police

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.2-01 | Police (liste déroulante) | Liste |  | À vérifier | RH 'font' + UI FontPicker | P1 |
| R1.2-02 | Taille de police (liste modifiable) | Liste |  | À vérifier | RH combo FONT_SIZE_OPTIONS | P1 |
| R1.2-03 | Augmenter la taille de police | Cmd | Ctrl+Maj+> | Partiel | RH grow ; raccourci absent de KEY | P1 |
| R1.2-04 | Réduire la taille de police | Cmd | Ctrl+Maj+< | Partiel | RH shrink ; raccourci absent | P1 |
| R1.2-05 | Gras | Cmd | Ctrl+G | À vérifier | RH bold + KEY | P1 |
| R1.2-06 | Italique | Cmd | Ctrl+I | À vérifier | RH italic + KEY | P1 |
| R1.2-07 | Souligner (bouton fractionné : Souligné / Souligné double) | Cmd | Ctrl+U | Partiel | RH underline = bascule simple ; cmd.underline('double') existe (CMD) sans entrée de menu | P2 |
| R1.2-08 | Bordures (bouton fractionné) : 14 préréglages | Menu |  | À vérifier | RH BORDER_ITEMS (bas, haut, gauche, droite, aucune, toutes, extérieures, épaisse, double bas, épaisse bas, haut+bas, ...) | P1 |
| R1.2-09 | Bordures > Dessiner une bordure / Dessiner une grille de bordures / Effacer la bordure | Cmd |  | Absent | pas d'outil de dessin de bordure | P2 |
| R1.2-10 | Bordures > Couleur de ligne / Style de trait | Menu |  | Absent | CMD borders(preset, hex) accepte une couleur mais aucune UI | P2 |
| R1.2-11 | Bordures > Autres bordures... (onglet Bordure de Format de cellule) | Cmd |  | Absent | DLF FormatCellsDialog sans onglet Bordure | P1 |
| R1.2-12 | Couleur de remplissage (palette + Aucun remplissage + Autres couleurs) | Menu |  | À vérifier | RH 'color' fill + UI ColorPicker | P1 |
| R1.2-13 | Couleur de police (palette + Automatique + Autres couleurs) | Menu |  | À vérifier | RH 'color' fontcolor + UI ColorPicker | P1 |
| R1.2-14 | Lanceur Format de cellule - Police | Lanceur | Ctrl+Maj+F | Partiel | RH launcher -> onglet Police très réduit (taille, gras, italique seuls) | P1 |


### 1.3 Accueil > Alignement

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.3-01 | Aligner en haut | Cmd |  | À vérifier | RH 'top' | P1 |
| R1.3-02 | Aligner au centre | Cmd |  | À vérifier | RH 'middle' | P1 |
| R1.3-03 | Aligner en bas | Cmd |  | À vérifier | RH 'bottom' | P1 |
| R1.3-04 | Orientation (6 entrées : Rotation sens inverse, sens horaire, Texte vertical, Rotation vers le haut, vers le bas, Format de cellule - Alignement) | Menu |  | Partiel | RH orient : 4 entrées (45°, 135°, vertical, horizontal) ; manquent rotations haut/bas et lien vers Format de cellule | P2 |
| R1.3-05 | Aligner à gauche | Cmd |  | À vérifier | RH 'left' | P1 |
| R1.3-06 | Centrer | Cmd |  | À vérifier | RH 'center' | P1 |
| R1.3-07 | Aligner à droite | Cmd |  | À vérifier | RH 'right' | P1 |
| R1.3-08 | Diminuer le retrait | Cmd |  | À vérifier | RH indDec | P1 |
| R1.3-09 | Augmenter le retrait | Cmd |  | À vérifier | RH indInc | P1 |
| R1.3-10 | Renvoyer à la ligne automatiquement | Cmd |  | À vérifier | RH wrap | P1 |
| R1.3-11 | Fusionner et centrer (bouton fractionné) | Cmd |  | À vérifier | RH merge | P1 |
| R1.3-12 | Fusionner et centrer > Fusionner horizontalement | Cmd |  | À vérifier | RH 'across' | P1 |
| R1.3-13 | Fusionner et centrer > Fusionner les cellules | Cmd |  | À vérifier | RH 'merge' | P1 |
| R1.3-14 | Fusionner et centrer > Annuler la fusion des cellules | Cmd |  | À vérifier | RH 'unmerge' | P1 |
| R1.3-15 | Lanceur Format de cellule - Alignement | Lanceur | Alt, L, 4 | À vérifier | RH launcher tab 'align' | P1 |


### 1.4 Accueil > Nombre

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.4-01 | Format de nombre (liste : Standard, Nombre, Monétaire, Comptabilité, Date courte, Date longue, Heure, Pourcentage, Fraction, Scientifique, Texte) | Liste |  | À vérifier | RH NUMBER_FORMATS (11 entrées) | P1 |
| R1.4-02 | Format de nombre > Autres formats numériques... | Cmd |  | Absent | RB.formats.more défini mais non branché | P1 |
| R1.4-03 | Format Nombre Comptabilité (€ Euro, $ US, £ UK, CHF) | Menu |  | Partiel | RH currency : 4 devises ; manque « Autres formats comptabilité... » | P2 |
| R1.4-04 | Style de pourcentage | Cmd | Ctrl+Maj+% | À vérifier | RH percent + KEY | P1 |
| R1.4-05 | Séparateur de milliers | Cmd |  | À vérifier | RH comma (style Milliers) | P1 |
| R1.4-06 | Ajouter une décimale | Cmd |  | À vérifier | RH decInc | P1 |
| R1.4-07 | Réduire les décimales | Cmd |  | À vérifier | RH decDec | P1 |
| R1.4-08 | Lanceur Format de cellule - Nombre | Lanceur | Ctrl+1 | À vérifier | RH launcher tab 'number' | P1 |


### 1.5 Accueil > Styles

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.5-01 | Mise en forme conditionnelle (menu) | Menu |  | Partiel | RH cfItems | P1 |
| R1.5-02 | MFC > Règles de mise en surbrillance : Supérieur à..., Inférieur à..., Entre..., Égal à..., Texte qui contient..., Une date se produisant..., Valeurs en double... | Menu |  | Partiel | RH 'hl' : 7 entrées ; « Une date » fixe sur aujourd'hui sans dialogue | P1 |
| R1.5-03 | MFC > Règles de mise en surbrillance > Autres règles... | Cmd |  | Absent | - | P2 |
| R1.5-04 | MFC > Règles des valeurs de plage haute/basse (10 plus élevées / 10 % / 10 moins élevées / 10 % moins élevés / > moyenne / < moyenne) | Menu |  | Partiel | RH 'top' : 5 entrées sur 6, N=10 fixe (pas de dialogue), « 10 % les moins élevés » manquant | P2 |
| R1.5-05 | MFC > Barres de données : 6 dégradés + 6 unis + Autres règles... | Galerie |  | Partiel | RH 'bars' 12 présélections ; sans « Autres règles... » | P1 |
| R1.5-06 | MFC > Nuances de couleurs : 12 présélections + Autres règles... | Galerie |  | Partiel | RH SCALES 12 ; sans « Autres règles... » | P1 |
| R1.5-07 | MFC > Jeux d'icônes (20 jeux en 4 groupes + Autres règles...) | Galerie |  | Partiel | RH ICON_SETS : 14 jeux sur 20 ; libellés = identifiants bruts non traduits | P1 |
| R1.5-08 | MFC > Nouvelle règle... | Dialogue |  | Partiel | DLD CfRuleDialog : 3 types (valeur, texte, formule), 5 présélections de format | P1 |
| R1.5-09 | MFC > Effacer les règles : cellules sélectionnées / feuille entière / ce tableau / ce tableau croisé | Menu |  | Partiel | RH 'clr' : sélection + feuille seulement | P2 |
| R1.5-10 | MFC > Gérer les règles... | Dialogue |  | Partiel | DLD CfManageDialog : liste + suppression ; pas de modification, ordre, priorité, « Arrêter si vrai » | P1 |
| R1.5-11 | Mettre sous forme de tableau (galerie 60 styles Clair/Moyen/Foncé) | Galerie | Ctrl+L | À vérifier | RH tableItems TABLE_STYLE_NAMES (60) + CMD formatAsTable | P1 |
| R1.5-12 | Mettre sous forme de tableau > Nouveau style de tableau... / style de TCD... | Dialogue |  | Absent | - | P3 |
| R1.5-13 | Styles de cellules (galerie) | Galerie |  | Partiel | RH cellStyleItems (Bon, Mauvais, Neutre, Titres, thématiques, formats) ; dialogue de style absent | P1 |
| R1.5-14 | Styles de cellules > Nouveau style de cellule... / Fusionner des styles... | Dialogue |  | Absent | L-styles CELL_STYLE_PRESETS figés | P3 |


### 1.6 Accueil > Cellules

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.6-01 | Insérer (bouton fractionné) | Cmd | Ctrl+Maj++ | Partiel | RH insert : agit sans la boîte « Insérer » (décaler vers la droite/le bas) | P1 |
| R1.6-02 | Insérer > Insérer des cellules... (dialogue décalage) | Dialogue |  | Absent | pas de dialogue ; cellsDown/cellsRight directs | P1 |
| R1.6-03 | Insérer > Insérer des lignes dans la feuille | Cmd |  | À vérifier | RH rows | P1 |
| R1.6-04 | Insérer > Insérer des colonnes dans la feuille | Cmd |  | À vérifier | RH cols | P1 |
| R1.6-05 | Insérer > Insérer une feuille | Cmd | Maj+F11 | À vérifier | RH sheet + KEY F11 | P1 |
| R1.6-06 | Supprimer (bouton fractionné) | Cmd | Ctrl+- | Partiel | RH delete : sans dialogue « Supprimer » | P1 |
| R1.6-07 | Supprimer > Supprimer des cellules... | Dialogue |  | Absent | pas de dialogue (cellsUp/cellsLeft directs) | P1 |
| R1.6-08 | Supprimer > Supprimer des lignes / colonnes de la feuille | Cmd |  | À vérifier | RH rows/cols | P1 |
| R1.6-09 | Supprimer > Supprimer une feuille | Cmd |  | À vérifier | RH sheet | P1 |
| R1.6-10 | Supprimer > Supprimer les lignes / colonnes du tableau | Cmd |  | Absent | - | P2 |
| R1.6-11 | Format > Hauteur de ligne... | Dialogue |  | À vérifier | RH rh + DLB SizeDialog | P1 |
| R1.6-12 | Format > Ajuster la hauteur de ligne | Cmd |  | À vérifier | RH ar + ACT autofit | P1 |
| R1.6-13 | Format > Largeur de colonne... | Dialogue |  | À vérifier | RH cw + SizeDialog | P1 |
| R1.6-14 | Format > Ajuster la largeur des colonnes | Cmd |  | À vérifier | RH ac | P1 |
| R1.6-15 | Format > Largeur par défaut... | Dialogue |  | Absent | - | P3 |
| R1.6-16 | Format > Masquer & afficher > Masquer les lignes | Cmd | Ctrl+9 | Partiel | RH hr ; raccourci absent | P1 |
| R1.6-17 | Format > Masquer & afficher > Masquer les colonnes | Cmd | Ctrl+0 | Partiel | RH hc ; raccourci absent (Alt+0 = somme) | P1 |
| R1.6-18 | Format > Masquer & afficher > Afficher les lignes | Cmd | Ctrl+Maj+( | Partiel | RH sr ; raccourci absent | P1 |
| R1.6-19 | Format > Masquer & afficher > Afficher les colonnes | Cmd | Ctrl+Maj+) | Partiel | RH sc ; raccourci absent | P1 |
| R1.6-20 | Format > Masquer & afficher > Masquer la feuille / Afficher la feuille... | Cmd |  | À vérifier | RH hs/ss + DLB UnhideSheetDialog | P1 |
| R1.6-21 | Format > Renommer la feuille | Cmd |  | À vérifier | RH ren | P1 |
| R1.6-22 | Format > Déplacer ou copier une feuille... | Dialogue |  | Absent | S.sheetMenu.move défini, aucun dialogue | P1 |
| R1.6-23 | Format > Couleur d'onglet | Menu |  | Partiel | SHT items 'color' (menu d'onglet) ; absent du menu Format | P2 |
| R1.6-24 | Format > Protéger la feuille... | Dialogue |  | À vérifier | RH prot + DLB ProtectDialog | P1 |
| R1.6-25 | Format > Verrouiller la cellule | Cmd |  | Partiel | DLF onglet Protection du dialogue ; pas de commande directe | P2 |
| R1.6-26 | Format > Format de cellule... | Dialogue | Ctrl+1 | À vérifier | RH fc + KEY | P1 |


### 1.7 Accueil > Édition

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.7-01 | Somme automatique (bouton fractionné) | Cmd | Alt+= | À vérifier | RH autosum + APP onGridKey | P1 |
| R1.7-02 | Somme automatique > Somme / Moyenne / Nb (Chiffres) / Max / Min | Menu |  | À vérifier | RH autosum items | P1 |
| R1.7-03 | Somme automatique > Autres fonctions... | Cmd |  | À vérifier | RH 'more' -> insertFunction | P1 |
| R1.7-04 | Recopier > En bas | Cmd | Ctrl+B | À vérifier | RH fillm 'd' + KEY | P1 |
| R1.7-05 | Recopier > À droite | Cmd | Ctrl+D | À vérifier | RH 'r' + KEY | P1 |
| R1.7-06 | Recopier > En haut | Cmd |  | À vérifier | RH 'u' | P2 |
| R1.7-07 | Recopier > À gauche | Cmd |  | À vérifier | RH 'l' | P2 |
| R1.7-08 | Recopier > Sur les feuilles de calcul... | Cmd |  | Absent | - | P3 |
| R1.7-09 | Recopier > Série... | Dialogue |  | Partiel | DLB SeriesDialog : lignes/colonnes, linéaire/géométrique, pas, valeur finale ; manquent Chronologique (jours/mois/années), Recopie auto, Tendance | P2 |
| R1.7-10 | Recopier > Justifier | Cmd |  | Absent | - | P3 |
| R1.7-11 | Recopier > Remplissage instantané | Cmd | Ctrl+E | À vérifier | RH flash + ACT flashFill + L-fill flashFillGuess (logique couverte par node --test) | P1 |
| R1.7-12 | Effacer > Effacer tout | Cmd |  | À vérifier | RH clear all | P1 |
| R1.7-13 | Effacer > Effacer les formats | Cmd |  | À vérifier | RH 'fmt' | P1 |
| R1.7-14 | Effacer > Effacer le contenu | Cmd | Suppr | À vérifier | RH 'cnt' + KEY Delete | P1 |
| R1.7-15 | Effacer > Effacer les commentaires et les notes | Cmd |  | À vérifier | RH 'cmt' | P2 |
| R1.7-16 | Effacer > Effacer les liens hypertexte / Supprimer les liens hypertexte | Cmd |  | Partiel | RH 'lnk' (un seul des deux) | P3 |
| R1.7-17 | Trier et filtrer > Trier de A à Z / de Z à A | Cmd |  | À vérifier | RH asc/desc + L-data sortRange (logique couverte par node --test) | P1 |
| R1.7-18 | Trier et filtrer > Tri personnalisé... | Dialogue |  | Partiel | DLD SortDialog : niveaux multiples, croissant/décroissant, en-têtes ; manquent tri par couleur/icône, liste personnalisée, options (casse, sens) | P1 |
| R1.7-19 | Trier et filtrer > Filtrer | Cmd | Ctrl+Maj+L | À vérifier | RH filter + CMD toggleFilter | P1 |
| R1.7-20 | Trier et filtrer > Effacer / Réappliquer | Cmd | Ctrl+Alt+L | À vérifier | RH clear/re | P1 |
| R1.7-21 | Rechercher et sélectionner > Rechercher... | Dialogue | Ctrl+F | Partiel | DLB FindDialog (voir section 4) | P1 |
| R1.7-22 | Rechercher et sélectionner > Remplacer... | Dialogue | Ctrl+H | Partiel | DLB FindDialog replace | P1 |
| R1.7-23 | Rechercher et sélectionner > Atteindre... | Dialogue | Ctrl+T / F5 | À vérifier | DLB GoToDialog + KEY | P1 |
| R1.7-24 | Rechercher et sélectionner > Sélectionner les cellules... (Atteindre spécial) | Dialogue |  | Absent | pas d'Atteindre spécial | P2 |
| R1.7-25 | Rechercher et sélectionner > Formules / Commentaires / Mise en forme conditionnelle / Constantes / Validation de données | Cmd |  | Absent | - | P2 |
| R1.7-26 | Rechercher et sélectionner > Sélectionner les objets / Volet Sélection... | Cmd |  | Absent | aucun volet de sélection d'objets | P2 |
| R1.7-27 | Compléments > Compléments (OfficeExtensionsShowAddinFlyout) | Cmd |  | Absent | pas de compléments | P3 |
| R1.7-28 | Analyser les données (Idées) / Dictée / Sensibilité | Cmd |  | Absent | absents aussi de cette installation d'Excel | P3 |


### 1.8 Insertion > Tableaux

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.8-01 | Tableau croisé dynamique (bouton fractionné : À partir d'un tableau ou d'une plage / source de données externe / modèle de données) | Cmd | Alt, S, V 1 | Partiel | RT pivot + DLD PivotCreateDialog (plage, feuille neuve ou existante) ; pas de source externe ni modèle de données | P1 |
| R1.8-02 | Tableaux croisés dynamiques recommandés | Cmd | Alt, S, T | Absent | - | P3 |
| R1.8-03 | Tableau (Ctrl+L) | Cmd | Ctrl+L | Partiel | RT table : crée directement avec TableStyleMedium2, sans boîte « Créer un tableau » (plage, en-têtes) | P1 |


### 1.9 Insertion > Illustrations

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.9-01 | Images > Placer dans la cellule / Placer sur les cellules | Menu |  | Partiel | RT image -> ACT insertImage (sur les cellules seulement, 20 Mo max) ; pas d'image dans la cellule (IMAGE) | P1 |
| R1.9-02 | Images > Appareil photo / Images en ligne / Images de stock | Cmd |  | Absent | - | P3 |
| R1.9-03 | Formes (galerie : 8 groupes, ~170 formes) | Galerie |  | Absent | le rendu d'une forme existe (DRW .xl-shape, XLSX DrawingObject kind 'shape') mais aucune insertion | P1 |
| R1.9-04 | Icônes | Cmd |  | Absent | - | P3 |
| R1.9-05 | Modèles 3D | Cmd |  | Absent | - | P3 |
| R1.9-06 | SmartArt... | Cmd |  | Absent | - | P3 |
| R1.9-07 | Capture (capture d'écran) | Menu |  | Absent | - | P3 |


### 1.10 Insertion > Graphiques

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.10-01 | Graphiques recommandés | Cmd |  | Partiel | RT recommended insère 'col' sans analyse ni aperçu | P1 |
| R1.10-02 | Insérer un histogramme ou un graphique à barres (2D/3D, cylindre, cône, pyramide) | Galerie |  | Partiel | RT col : groupé, empilé, barres groupées ; manque 100 % empilé, barres empilées, 3D, formes | P1 |
| R1.10-03 | Insérer un graphique en courbes ou en aires | Galerie |  | Partiel | RT line : courbes, courbes+marqueurs, aires ; manque empilées, 100 %, 3D | P1 |
| R1.10-04 | Insérer un graphique en secteurs ou en anneau | Galerie |  | Partiel | RT pie : secteurs, anneau ; manque secteurs 3D, secteur de secteur, barre de secteurs | P1 |
| R1.10-05 | Insérer un graphique hiérarchique (compartimenté, rayons de soleil) | Galerie |  | Absent | - | P3 |
| R1.10-06 | Insérer un graphique statistique (histogramme, Pareto, boîte à moustaches) | Galerie |  | Absent | - | P2 |
| R1.10-07 | Insérer un nuage de points (X, Y) ou un graphique en bulles | Galerie |  | Partiel | RT scatter (nuage simple) ; sans lissé/lignes ni bulles | P1 |
| R1.10-08 | Insérer un graphique en cascade, entonnoir, boursier, surface ou radar | Galerie |  | Absent | radar/bulles importés sont rendus en nuage (STATUS) | P2 |
| R1.10-09 | Insérer un graphique combiné | Galerie |  | Partiel | RT combo (colonnes + courbe) ; pas de combinaison personnalisée ni axe secondaire | P2 |
| R1.10-10 | Cartes (cartes remplies) | Galerie |  | Absent | - | P3 |
| R1.10-11 | Graphique croisé dynamique (bouton fractionné) | Cmd |  | Absent | - | P2 |
| R1.10-12 | Boîte de dialogue « Insérer un graphique » (Graphiques recommandés / Tous les graphiques) | Dialogue | Alt, S, K 1 | Absent | aucun dialogue | P2 |


### 1.11 Insertion > Graphiques sparkline

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.11-01 | Courbe | Cmd |  | À vérifier | RT spline + DLB SparklineDialog (plage de données + emplacement) | P2 |
| R1.11-02 | Histogramme | Cmd |  | À vérifier | RT spcol | P2 |
| R1.11-03 | Conclusions et pertes | Cmd |  | À vérifier | RT spwin (type stacked) | P2 |


### 1.12 Insertion > Filtres, Liens, Texte, Symboles

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.12-01 | Segment... | Cmd |  | Absent | aucun segment (slicer) | P1 |
| R1.12-02 | Chronologie | Cmd |  | Absent | aucune chronologie | P2 |
| R1.12-03 | Lien (Ctrl+K) | Cmd | Ctrl+K | Partiel | RT link + DLB LinkDialog : adresse, texte, emplacement du document ; manquent adresse e-mail, nouveau document, info-bulle | P1 |
| R1.12-04 | Texte > Zone de texte | Cmd |  | Absent | - | P1 |
| R1.12-05 | Texte > En-tête et pied de page | Cmd |  | Absent | XLSX pageSetup n'est pas éditable en UI | P1 |
| R1.12-06 | Texte > WordArt | Cmd |  | Absent | - | P3 |
| R1.12-07 | Texte > Ligne de signature / Objet | Cmd |  | Absent | - | P3 |
| R1.12-08 | Équation (bouton fractionné) | Cmd |  | Absent | - | P3 |
| R1.12-09 | Symbole... | Dialogue |  | À vérifier | RT symbol + DLB SymbolDialog | P2 |
| R1.12-10 | Extra ForgeOffice : bouton Commentaire dans Insertion (Excel 365 le place en Révision) | Cmd |  | À vérifier | RT comment | P3 |
| R1.12-11 | Extra ForgeOffice : bouton Filtrer dans Insertion | Cmd |  | À vérifier | RT filter (Excel : Données) | P3 |


### 1.13 Dessin

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.13-01 | Annuler / Répéter (Ctrl+Z / Ctrl+Y) | Cmd |  | Absent | aucun onglet Dessin | P3 |
| R1.13-02 | Outils de dessin : Sélectionner, Sélection lasso, Gomme | Cmd |  | Absent | - | P3 |
| R1.13-03 | Outils de dessin : Stylo, Crayon, Surligneur, Stylo plume, Stylo pinceau (+ Ajouter) | Cmd |  | Absent | - | P3 |
| R1.13-04 | Entrée manuscrite en forme / Maths | Cmd |  | Absent | - | P3 |
| R1.13-05 | Revoir (relecture du tracé) | Cmd |  | Absent | - | P3 |
| R1.13-06 | Aide pour l'entrée manuscrite | Cmd |  | Absent | - | P3 |


### 1.14 Mise en page > Thèmes

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.14-01 | Thèmes (galerie Office, Facette, Intégral...) | Galerie |  | Absent | seul le jeu de couleurs est modifiable | P2 |
| R1.14-02 | Couleurs (galerie de jeux de couleurs) | Galerie |  | Partiel | RT THEMES + ACT themeColors : 6 jeux (Office, Office 2013-2022, Vert, Bleu, Rouge orangé, Niveaux de gris) ; Excel en propose ~24 + « Personnaliser les couleurs... » | P2 |
| R1.14-03 | Polices (Office, Calibri, Arial...) | Galerie |  | Absent | polices de thème non modifiables | P2 |
| R1.14-04 | Effets | Galerie |  | Absent | - | P3 |


### 1.15 Mise en page > Mise en page

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.15-01 | Marges (Normales, Larges, Étroites, Dernier réglage, Marges personnalisées...) | Menu |  | Partiel | RT margins : 3 présélections ; pas de marges personnalisées | P1 |
| R1.15-02 | Orientation (Portrait / Paysage) | Menu |  | À vérifier | RT orient + CMD pageSetup | P1 |
| R1.15-03 | Taille (Lettre US, Tabloïd, Legal, A3, A4, ... + Autres tailles de papier...) | Menu |  | Partiel | RT size : A4 et Lettre seulement | P2 |
| R1.15-04 | ZoneImpr (Définir / Annuler) | Menu |  | À vérifier | RT area + ACT printArea | P1 |
| R1.15-05 | Sauts de page (Insérer / Supprimer / Rétablir tous) | Menu |  | À vérifier | RT breaks + ACT pageBreak | P1 |
| R1.15-06 | Arrière-plan... | Cmd |  | Absent | - | P3 |
| R1.15-07 | Imprimer les titres | Cmd |  | Absent | RB.printTitles défini, non branché ; lignes/colonnes à répéter inutilisables | P1 |
| R1.15-08 | Lanceur Mise en page (boîte à 4 onglets) | Dialogue | Alt, P, F | Absent | aucun dialogue Mise en page (marges, en-tête/pied, feuille) | P1 |


### 1.16 Mise en page > Mise à l'échelle et Options de la feuille

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.16-01 | Largeur (Automatique, 1 page...) | Liste |  | Absent | RT scale : seule la case « Ajuster à 1 page » existe | P1 |
| R1.16-02 | Hauteur (Automatique, 1 page...) | Liste |  | Absent | - | P1 |
| R1.16-03 | Échelle (%) | Saisie |  | À vérifier | RT 'scale' nombre 10-400 | P1 |
| R1.16-04 | Quadrillage : Afficher | Case |  | À vérifier | RT gv | P1 |
| R1.16-05 | Quadrillage : Imprimer | Case |  | À vérifier | RT gp | P1 |
| R1.16-06 | En-têtes : Afficher | Case |  | À vérifier | RT hv | P1 |
| R1.16-07 | En-têtes : Imprimer | Case |  | À vérifier | RT hp | P1 |


### 1.17 Mise en page > Organiser (objets)

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.17-01 | Avancer / Reculer (+ Mettre au premier plan / à l'arrière-plan) | Cmd |  | Absent | DRW : ordre z non modifiable | P2 |
| R1.17-02 | Volet Sélection... | Volet |  | Absent | - | P2 |
| R1.17-03 | Aligner (gauche, centre, droite, haut, milieu, bas, répartir) | Menu |  | Absent | - | P3 |
| R1.17-04 | Grouper / Dissocier / Regrouper | Menu |  | Absent | - | P3 |
| R1.17-05 | Rotation (pivoter à droite/gauche 90°, retourner) | Menu |  | Absent | - | P3 |


### 1.18 Formules > Bibliothèque de fonctions

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.18-01 | Insérer une fonction... | Dialogue | Maj+F3 | À vérifier | RT insfn + DLF FnWizardDialog (recherche, catégories, résultat en direct) | P1 |
| R1.18-02 | Somme automatique (Somme, Moyenne, Nb, Max, Min, Autres fonctions) | Menu | Alt+= | Partiel | RT autosum : sans « Autres fonctions... » dans cet onglet | P1 |
| R1.18-03 | Récentes | Menu |  | Absent | S.fnRecent existe dans le dialogue, pas de menu de ruban | P2 |
| R1.18-04 | Financier | Menu |  | À vérifier | RT cat 'fin' alimenté par functionCatalog (489 fonctions) | P1 |
| R1.18-05 | Logique | Menu |  | À vérifier | RT cat 'log' | P1 |
| R1.18-06 | Texte | Menu |  | À vérifier | RT cat 'txt' | P1 |
| R1.18-07 | DateHeure | Menu |  | À vérifier | RT cat 'date' | P1 |
| R1.18-08 | Recherche et référence | Menu |  | À vérifier | RT cat 'look' | P1 |
| R1.18-09 | Maths et trigonométrie | Menu |  | À vérifier | RT cat 'math' | P1 |
| R1.18-10 | Plus de fonctions (Statistiques, Ingénierie, Cube, Informations, Compatibilité, Web) | Menu |  | Partiel | RT more : stats, ingénierie, info, base de données, compat ; manquent Cube et Web | P2 |


### 1.19 Formules > Noms définis, Vérification, Calcul

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.19-01 | Gestionnaire de noms | Dialogue | Ctrl+F3 | À vérifier | RT mgr + DLF NamesDialog (ajout, modif, suppression, étendue) | P1 |
| R1.19-02 | Définir un nom... | Dialogue |  | Partiel | RT def ouvre le gestionnaire entier | P2 |
| R1.19-03 | Dans une formule (liste des noms) | Menu |  | À vérifier | RT use | P2 |
| R1.19-04 | Depuis sélection... | Dialogue | Ctrl+Maj+F3 | Absent | - | P2 |
| R1.19-05 | Repérer les antécédents | Cmd |  | Partiel | APP trace : même feuille seulement, pas de flèches multi-niveaux ni vers autres feuilles | P2 |
| R1.19-06 | Repérer les dépendants | Cmd |  | Partiel | APP trace : même feuille seulement | P2 |
| R1.19-07 | Supprimer les flèches (Antécédents / Dépendants) | Cmd |  | Partiel | RT rm : tout supprimer uniquement | P3 |
| R1.19-08 | Afficher les formules | Cmd | Ctrl+" | À vérifier | RT show + KEY toggleFormulas | P1 |
| R1.19-09 | Vérification des erreurs... | Dialogue |  | Absent | pas de triangle vert ni de règles d'erreur | P2 |
| R1.19-10 | Évaluer la formule | Dialogue |  | À vérifier | RT eval + DLF EvaluateDialog | P2 |
| R1.19-11 | Fenêtre Espion | Volet |  | Absent | - | P3 |
| R1.19-12 | Options de calcul (Automatique / Automatique sauf tables de données / Manuel) | Menu |  | Partiel | RT opts : Automatique et Manuel | P1 |
| R1.19-13 | Calculer maintenant | Cmd | F9 | À vérifier | RT now + KEY F9 | P1 |
| R1.19-14 | Calculer la feuille | Cmd | Maj+F9 | Absent | - | P2 |


### 1.20 Données > Récupérer et transformer des données

> Power Query, connexions externes et modèle de données sont hors périmètre assumé (consigne) : listés pour exhaustivité, P3.

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.20-01 | Obtenir des données (menu : fichier, base de données, Azure, plateforme Power, services en ligne, autres sources, combiner des requêtes, éditeur Power Query, paramètres des sources, options de requête) | Menu | Alt, É, P N | Absent | pas de Power Query | P3 |
| R1.20-02 | À partir d'un fichier texte/CSV | Cmd |  | Partiel | RT csv + RE importCsv : ouvre un fichier et le place dans une nouvelle feuille ; pas d'assistant (délimiteur, encodage, aperçu, types de colonnes) | P1 |
| R1.20-03 | À partir du web | Cmd |  | Absent | - | P3 |
| R1.20-04 | À partir de Tableau ou d'une Plage | Cmd |  | Absent | - | P3 |
| R1.20-05 | Sources récentes | Cmd |  | Absent | - | P3 |
| R1.20-06 | Connexions existantes | Cmd |  | Absent | - | P3 |


### 1.21 Données > Requêtes et connexions, Trier et filtrer

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.21-01 | Actualiser tout (Actualiser / Actualiser tout / État de l'actualisation / Annuler / Propriétés de connexion) | Cmd | Ctrl+Alt+F5 | Partiel | RT refresh : recalcule + actualise les TCD | P2 |
| R1.21-02 | Requêtes et connexions (volet) | Volet |  | Absent | - | P3 |
| R1.21-03 | Propriétés (de la plage de données) | Cmd |  | Absent | - | P3 |
| R1.21-04 | Liaisons de classeur | Cmd |  | Absent | pas de liaisons externes | P2 |
| R1.21-05 | Trier de A à Z | Cmd |  | À vérifier | RT asc | P1 |
| R1.21-06 | Trier de Z à A | Cmd |  | À vérifier | RT desc | P1 |
| R1.21-07 | Trier... | Dialogue |  | Partiel | RT sort -> DLD SortDialog (voir D-Trier) | P1 |
| R1.21-08 | Filtrer | Cmd | Ctrl+Maj+L | À vérifier | RT filter | P1 |
| R1.21-09 | Effacer (le filtre) | Cmd |  | À vérifier | RT clear | P1 |
| R1.21-10 | Réappliquer | Cmd | Ctrl+Alt+L | À vérifier | RT re | P1 |
| R1.21-11 | Avancé... (filtre avancé : plage de critères, copier ailleurs, enregistrements uniques) | Dialogue |  | Absent | - | P2 |


### 1.22 Données > Outils de données

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.22-01 | Convertir... (Assistant Conversion : délimité / largeur fixe, 3 étapes) | Dialogue |  | Partiel | RT ttc + DLD TextToColsDialog : séparateur unique, pas de largeur fixe, pas de formats de colonne | P1 |
| R1.22-02 | Remplissage instantané | Cmd | Ctrl+E | À vérifier | RT flash + L-fill flashFillGuess (modèle simple) (logique couverte par node --test) | P1 |
| R1.22-03 | Supprimer les doublons | Dialogue |  | À vérifier | RT dup + DLD RemoveDupDialog | P1 |
| R1.22-04 | Validation des données... (bouton fractionné) | Dialogue |  | Partiel | RT val + DLD ValidationDialog (voir D-Validation) | P1 |
| R1.22-05 | Validation des données > Entourer les données non valides / Effacer les cercles de validation | Cmd |  | Absent | - | P3 |
| R1.22-06 | Consolider... | Dialogue |  | Absent | - | P2 |
| R1.22-07 | Données Model > Gérer le modèle de données / 3D Maps / Relations | Menu |  | Absent | hors périmètre | P3 |


### 1.23 Données > Prévision et Plan

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.23-01 | Analyse scénarios > Gestionnaire de scénarios... | Dialogue |  | Absent | - | P2 |
| R1.23-02 | Analyse scénarios > Valeur cible... | Dialogue |  | Absent | - | P2 |
| R1.23-03 | Analyse scénarios > Table de données... | Dialogue |  | Absent | moteur : fonction matricielle TABLE absente | P2 |
| R1.23-04 | Feuille de prévision | Dialogue |  | Absent | FORECAST.ETS* absentes du moteur (FRM STATUS) | P3 |
| R1.23-05 | Grouper... (lignes ou colonnes / Plan automatique) | Cmd | Alt+Maj+Droite | Partiel | RT group + ACT outline (lignes ou colonnes, un niveau à la fois) ; pas de dialogue ni plan automatique | P2 |
| R1.23-06 | Dissocier... (Dissocier / Effacer le plan) | Cmd | Alt+Maj+Gauche | Partiel | RT ungroup ; pas d'effacement du plan | P2 |
| R1.23-07 | Sous-total | Dialogue |  | À vérifier | RT sub + DLD SubtotalDialog (fonctions somme, nombre, moyenne, max, min, produit) | P2 |
| R1.23-08 | Afficher le détail | Cmd |  | À vérifier | RT show + ACT showDetail | P2 |
| R1.23-09 | Masquer le détail | Cmd |  | À vérifier | RT hide | P2 |
| R1.23-10 | Paramètres de groupe et de plan (lanceur) | Dialogue |  | Absent | - | P3 |
| R1.23-11 | Boutons +/- et numéros de niveau dans les marges de la grille | Affichage |  | Absent | STATUS : non dessinés dans la marge | P1 |


### 1.24 Révision

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.24-01 | Orthographe... | Cmd | F7 | Absent | aucun correcteur (le mot « spell » n'apparaît que dans FormulaInput pour désactiver le contrôle navigateur) | P2 |
| R1.24-02 | Dictionnaire des synonymes... | Cmd | Maj+F7 | Absent | - | P3 |
| R1.24-03 | Statistiques du classeur | Dialogue |  | Absent | BST info affiche cellules/formules, pas de dialogue | P3 |
| R1.24-04 | Vérifier l'accessibilité | Cmd |  | Absent | S.accessibility = libellé de barre d'état seulement | P3 |
| R1.24-05 | Traduire | Cmd |  | Absent | - | P3 |
| R1.24-06 | Nouveau commentaire | Cmd | Ctrl+Maj+F2 | Partiel | RT new + APP insertComment : saisie via window.prompt, pas de bulle/fil inline | P1 |
| R1.24-07 | Supprimer (commentaire) | Cmd |  | À vérifier | RT del -> cmd.clear('comments') | P2 |
| R1.24-08 | Commentaire précédent / suivant | Cmd |  | Absent | - | P2 |
| R1.24-09 | Afficher/masquer le commentaire | Cmd |  | Absent | - | P2 |
| R1.24-10 | Afficher tous les commentaires | Cmd |  | Partiel | RT pane (volet Commentaires) ; pas d'affichage inline | P2 |
| R1.24-11 | Notes > Nouvelle note | Cmd | Maj+F2 | À vérifier | RT note + DLB NoteDialog | P1 |
| R1.24-12 | Notes > Modifier la note / Supprimer / Précédente / Suivante | Cmd |  | Absent | seul « Nouvelle note » existe | P2 |
| R1.24-13 | Notes > Afficher/Masquer la note, Afficher toutes les notes, Convertir en commentaires | Cmd |  | Absent | - | P2 |
| R1.24-14 | Protéger la feuille... | Dialogue |  | Partiel | RT ps + DLB ProtectDialog : mot de passe seulement, sans liste d'actions autorisées | P1 |
| R1.24-15 | Protéger le classeur... | Dialogue |  | À vérifier | RT pb + ProtectDialog (structure) | P2 |
| R1.24-16 | Autoriser la modification des plages | Dialogue |  | Absent | - | P3 |
| R1.24-17 | Annuler le partage du classeur | Cmd |  | Absent | fonction héritée | P3 |
| R1.24-18 | Entrée manuscrite > Masquer les entrées manuscrites | Cmd |  | Absent | - | P3 |


### 1.25 Affichage

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.25-01 | Normal | Cmd | Alt, N, N | À vérifier | RT normal | P1 |
| R1.25-02 | Avec sauts de page | Cmd |  | À vérifier | RT break + PNT pageBreaks | P2 |
| R1.25-03 | Mise en page | Cmd |  | Partiel | RT layout : pas de pages séparées ni en-têtes/pieds éditables (STATUS) | P2 |
| R1.25-04 | Affichages personnalisés... | Dialogue |  | Absent | - | P3 |
| R1.25-05 | Règle (vue Mise en page) | Case |  | Absent | - | P3 |
| R1.25-06 | Quadrillage | Case |  | À vérifier | RT grid | P1 |
| R1.25-07 | Barre de formule | Case |  | À vérifier | RT fbar | P1 |
| R1.25-08 | En-têtes | Case |  | À vérifier | RT heads | P1 |
| R1.25-09 | Zoom... | Dialogue |  | À vérifier | RT zoom + DLB ZoomDialog | P2 |
| R1.25-10 | 100 % | Cmd |  | À vérifier | RT z100 | P2 |
| R1.25-11 | Zoom sur la sélection | Cmd |  | À vérifier | RT zsel + APP zoomToSelection | P2 |
| R1.25-12 | Nouvelle fenêtre | Cmd |  | À vérifier | RT new + services.openModule | P2 |
| R1.25-13 | Réorganiser tout (mosaïque, horizontal, vertical, cascade) | Cmd |  | Absent | - | P3 |
| R1.25-14 | Figer les volets > Figer les volets / Libérer les volets | Cmd |  | À vérifier | RT freeze panes/unfreeze | P1 |
| R1.25-15 | Figer les volets > Figer la ligne supérieure | Cmd |  | À vérifier | RT row | P1 |
| R1.25-16 | Figer les volets > Figer la première colonne | Cmd |  | À vérifier | RT col | P1 |
| R1.25-17 | Fractionner (barres de fractionnement) | Cmd |  | Absent | - | P2 |
| R1.25-18 | Masquer (la fenêtre) / Afficher... | Cmd |  | Absent | - | P3 |
| R1.25-19 | Côte à côte / Défilement synchrone / Rétablir la position de la fenêtre | Cmd |  | Absent | - | P3 |
| R1.25-20 | Changer de fenêtre | Menu |  | Absent | - | P3 |
| R1.25-21 | Macros > Afficher les macros / Enregistrer une macro / Références relatives | Cmd | Alt+F8 | Absent | hors périmètre (xlsm lu et conservé seulement) | P3 |


### 1.26 Aide

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.26-01 | Aide | Cmd | F1 | Absent | - | P3 |
| R1.26-02 | Contacter le support... / Commentaires / Afficher la formation | Cmd |  | Absent | - | P3 |
| R1.26-03 | Obtenir l'application mobile Excel | Cmd |  | Absent | - | P3 |


### 1.27 Onglet contextuel Création de tableau

> Apparaît dès qu'une cellule appartient à un tableau (nom UIA : « Création de tableau »). ForgeOffice : RC tableTab.

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.27-01 | Nom de la table | Saisie |  | À vérifier | RC name (validation du nom) | P1 |
| R1.27-02 | Redimensionner le tableau | Dialogue |  | Absent | - | P2 |
| R1.27-03 | Synthétiser avec un tableau croisé dynamique | Cmd |  | À vérifier | RC pivot | P1 |
| R1.27-04 | Supprimer les doublons | Cmd |  | À vérifier | RC dup | P2 |
| R1.27-05 | Convertir en plage | Cmd |  | À vérifier | RC range + ACT tableToRange | P1 |
| R1.27-06 | Insérer un segment... | Cmd |  | Absent | - | P2 |
| R1.27-07 | Exporter (vers SharePoint / Visio) / Actualiser / Propriétés / Ouvrir dans le navigateur / Supprimer la liaison | Cmd |  | Absent | données externes hors périmètre | P3 |
| R1.27-08 | Ligne d'en-tête | Case |  | À vérifier | RC header | P1 |
| R1.27-09 | Ligne Total (Ctrl+Maj+T) + liste de fonctions par colonne | Case | Ctrl+Maj+T | Partiel | RC total (somme dans la dernière colonne ; TOTAL_CODES existe, pas de liste déroulante par cellule) | P1 |
| R1.27-10 | Lignes à bandes | Case |  | À vérifier | RC banded | P2 |
| R1.27-11 | Première colonne | Case |  | À vérifier | RC first | P2 |
| R1.27-12 | Dernière colonne | Case |  | À vérifier | RC last | P2 |
| R1.27-13 | Colonnes à bandes | Case |  | À vérifier | RC bcols | P2 |
| R1.27-14 | Bouton de filtre | Case |  | À vérifier | RC filter | P2 |
| R1.27-15 | Styles de tableau (galerie 60) + Effacer | Galerie |  | Partiel | RC style ; pas de commande « Effacer » ni « Nouveau style » | P1 |


### 1.28 Onglets contextuels Tableau croisé dynamique : Analyse et Création

> Noms UIA : « Analyse du tableau croisé dynamique » et « Création ». ForgeOffice : RC pivotTab (Actualiser + Liste des champs seulement).

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.28-01 | Options du tableau croisé dynamique (nom, disposition, totaux, filtres, affichage, impression, données) | Dialogue |  | Absent | voir D-Options TCD | P1 |
| R1.28-02 | Nom du champ dynamique / Paramètres de champs | Dialogue |  | Partiel | PAN PivotPane : fonction + « afficher les valeurs » dans le volet ; pas de dialogue Paramètres des champs | P1 |
| R1.28-03 | Afficher les détails | Cmd |  | Absent | pas de double-clic détail | P1 |
| R1.28-04 | Développer le champ / Réduire le champ | Cmd |  | Absent | - | P2 |
| R1.28-05 | Grouper la sélection / Grouper le champ (dates par mois/trimestre/année, nombres par intervalle) / Dissocier | Cmd |  | Absent | - | P1 |
| R1.28-06 | Insérer un segment... / Insérer une chronologie... / Connexions de filtre... | Cmd |  | Absent | - | P2 |
| R1.28-07 | Actualiser (Actualiser / Actualiser tout) | Cmd | Alt+F5 | À vérifier | RC refresh | P1 |
| R1.28-08 | Changer la source de données... | Dialogue |  | Absent | - | P2 |
| R1.28-09 | Actions > Effacer / Sélectionner / Déplacer le tableau croisé dynamique | Menu |  | Absent | - | P2 |
| R1.28-10 | Calculs > Champs, éléments et jeux (champ calculé, élément calculé) | Menu |  | Absent | - | P2 |
| R1.28-11 | Calculs > Outils OLAP / Relations | Menu |  | Absent | - | P3 |
| R1.28-12 | Graphique croisé dynamique | Cmd |  | Absent | - | P2 |
| R1.28-13 | Suggestions de tableaux croisés dynamiques | Cmd |  | Absent | - | P3 |
| R1.28-14 | Afficher > Liste des champs | Cmd |  | À vérifier | RC list | P1 |
| R1.28-15 | Afficher > Boutons +/- / En-têtes de champs | Cmd |  | Absent | - | P2 |
| R1.28-16 | Création > Sous-totaux (Ne pas afficher / en bas / en haut) | Menu |  | Partiel | PAN case « Sous-totaux » oui/non | P2 |
| R1.28-17 | Création > Totaux généraux (désactivés, lignes et colonnes, lignes seules, colonnes seules) | Menu |  | Partiel | PAN case « Totaux des lignes » (lignes+colonnes ensemble) | P2 |
| R1.28-18 | Création > Disposition du rapport (compacte, plan, tabulaire, répéter/ne pas répéter les étiquettes) | Menu |  | Absent | - | P2 |
| R1.28-19 | Création > Lignes vides | Menu |  | Absent | - | P3 |
| R1.28-20 | Création > En-têtes de lignes / En-têtes de colonnes / Lignes à bandes / Colonnes à bandes | Case |  | Absent | - | P3 |
| R1.28-21 | Création > Styles de tableau croisé dynamique (galerie) | Galerie |  | Absent | - | P3 |


### 1.29 Onglets contextuels Graphique : Création de graphique et Mise en forme

> Noms UIA : « Création de graphique » et « Mise en forme ». ForgeOffice : RC chartTab.

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.29-01 | Ajouter un élément graphique (Axes, Titres des axes, Titre du graphique, Étiquettes de données, Table de données, Barres d'erreur, Quadrillage, Légende, Lignes, Courbe de tendance, Barres haut/bas) (K pour les sous-entrées) | Menu |  | Partiel | RC : titre (aucun/afficher), légende (4 positions), étiquettes (bascule), quadrillage (bascule) ; sans axes, titres d'axes, table, barres d'erreur, tendance | P1 |
| R1.29-02 | Disposition rapide (11 dispositions) | Galerie |  | Absent | - | P2 |
| R1.29-03 | Modifier les couleurs (Coloré / Monochrome) | Galerie |  | Partiel | RC colors CHART_PALETTES | P2 |
| R1.29-04 | Styles rapides (galerie de styles de graphique) | Galerie |  | Absent | - | P2 |
| R1.29-05 | Intervertir ligne/colonne | Cmd |  | À vérifier | RC switch | P1 |
| R1.29-06 | Sélectionner des données... (plages, séries, étiquettes d'axe) | Dialogue |  | Absent | STATUS : pas d'éditeur de séries | P1 |
| R1.29-07 | Modifier le type de graphique... | Dialogue |  | Partiel | RC kind : menu de 10 types sans aperçu ni modèles | P1 |
| R1.29-08 | Déplacer le graphique... (feuille de graphique) | Dialogue |  | Absent | - | P3 |
| R1.29-09 | Supprimer le graphique (extra) | Cmd |  | À vérifier | RC delete | P2 |
| R1.29-10 | Mise en forme : Éléments de graphique (liste de sélection) | Liste |  | Absent | - | P1 |
| R1.29-11 | Mise en forme : Mise en forme de la sélection / Rétablir le style d'origine | Cmd |  | Absent | - | P1 |
| R1.29-12 | Mise en forme : Insérer des formes, Styles de formes (Remplissage, Contour, Effets), Styles WordArt | Galerie |  | Absent | - | P3 |
| R1.29-13 | Mise en forme : Texte de remplacement | Volet |  | Absent | XLSX DrawingObject.description existe, sans UI | P2 |
| R1.29-14 | Mise en forme : Organiser (Avancer, Reculer, Aligner, Grouper, Rotation) | Menu |  | Absent | - | P3 |
| R1.29-15 | Mise en forme : Taille (Hauteur, Largeur, Taille et propriétés...) | Saisie |  | Absent | redimensionnement à la souris seulement | P2 |


### 1.30 Onglets contextuels Image, Forme, Segment, Chronologie, Sparkline

> Noms UIA : « Format de l'image », « Format de forme » (aussi zone de texte), « Segment », « Chronologie », « Sparkline ». ForgeOffice : aucun de ces onglets (RC n'exporte que Tableau, Graphique, TCD).

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| R1.30-01 | Format de l'image > Placer dans la cellule / Supprimer l'arrière-plan / Corrections / Couleur / Effets artistiques / Transparence / Compresser / Changer d'image / Rétablir l'image | Cmd |  | Absent | - | P3 |
| R1.30-02 | Format de l'image > Styles d'image / Bordure de l'image / Effets d'image / Disposition d'image | Galerie |  | Absent | - | P3 |
| R1.30-03 | Format de l'image > Texte de remplacement | Volet |  | Absent | - | P2 |
| R1.30-04 | Format de l'image > Organiser (Avancer, Reculer, Aligner, Grouper, Rotation) | Menu |  | Absent | - | P2 |
| R1.30-05 | Format de l'image > Rogner / Hauteur / Largeur / Taille et propriétés... | Cmd |  | Absent | - | P2 |
| R1.30-06 | Format de forme > Insérer des formes / Modifier la forme / Zone de texte | Galerie |  | Absent | - | P1 |
| R1.30-07 | Format de forme > Styles de formes (Remplissage, Contour, Effets) / Mise en forme de l'objet... | Galerie |  | Absent | - | P1 |
| R1.30-08 | Format de forme > Styles WordArt (Remplissage du texte, Contour du texte, Effets de texte) | Galerie |  | Absent | - | P3 |
| R1.30-09 | Format de forme > Organiser / Taille / Texte de remplacement | Cmd |  | Absent | - | P2 |
| R1.30-10 | Segment > Légende du segment / Paramètres des segments... / Connexions de rapport... | Saisie |  | Absent | - | P2 |
| R1.30-11 | Segment > Styles de segments / Boutons (Colonnes, Hauteur, Largeur) / Organiser / Taille | Galerie |  | Absent | - | P2 |
| R1.30-12 | Chronologie > Légende / Connexions / Styles / Organiser / Taille | Saisie |  | Absent | - | P3 |
| R1.30-13 | Chronologie > Afficher : En-tête, Étiquette de la sélection, Barre de défilement, Niveau de temps | Case |  | Absent | - | P3 |
| R1.30-14 | Sparkline > Modifier les données (et l'emplacement du groupe) | Dialogue |  | Absent | DLB SparklineDialog crée seulement ; pas de modification | P2 |
| R1.30-15 | Sparkline > Type : Courbe / Histogramme / Conclusions et pertes | Cmd |  | Absent | - | P2 |
| R1.30-16 | Sparkline > Afficher : Point haut, Point bas, Points négatifs, Premier point, Dernier point, Marques | Case |  | Absent | - | P2 |
| R1.30-17 | Sparkline > Style / Couleur du graphique sparkline / Couleur de marque | Galerie |  | Absent | - | P2 |
| R1.30-18 | Sparkline > Axe (options de l'axe horizontal/vertical) / Grouper / Dissocier / Supprimer | Menu |  | Absent | - | P3 |


## 2. Menus contextuels (clic droit) et gestes à la souris

> Source : connaissance d'Excel 365 FR (un vrai clic droit est impossible sans souris réelle). ForgeOffice n'a que trois menus contextuels : grille (`CLP gridContextMenu`, zones cellule/ligne/colonne), onglet de feuille (`SHT items`) et liste de validation (`APP`). Tout le reste du clic droit n'existe pas : `Drawings.tsx`, `ChartView.tsx`, `Panes.tsx`, `FormulaBar.tsx` n'ont aucun `onContextMenu`.


### 2.1 Cellule(s) et plage

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.1-01 | Couper | Cmd | Ctrl+X | À vérifier | CLP 'cut' | P1 |
| M2.1-02 | Copier | Cmd | Ctrl+C | À vérifier | CLP 'copy' | P1 |
| M2.1-03 | Options de collage (rangée d'icônes : Coller, Valeurs, Formules, Transposer, Mise en forme, Coller avec liaison, Image) | Menu |  | Absent | CLP : un seul « Coller » ; les modes ne sont accessibles que par le ruban | P1 |
| M2.1-04 | Collage spécial... | Dialogue | Ctrl+Alt+V | À vérifier | CLP 'pastesp' | P1 |
| M2.1-05 | Recherche intelligente (Rechercher sur le web) | Cmd |  | Absent | - | P3 |
| M2.1-06 | Insérer... (boîte Insérer : décaler vers la droite / le bas / ligne / colonne) | Menu |  | Partiel | CLP 'ins' : sous-menu à 4 actions directes, sans dialogue | P1 |
| M2.1-07 | Supprimer... (boîte Supprimer) | Menu |  | Partiel | CLP 'del' : sous-menu à 4 actions directes | P1 |
| M2.1-08 | Effacer le contenu | Cmd | Suppr | À vérifier | CLP 'clr' | P1 |
| M2.1-09 | Traduire | Cmd |  | Absent | - | P3 |
| M2.1-10 | Analyse rapide (mise en forme, graphiques, totaux, tableaux, sparklines) | Cmd | Ctrl+Q | Absent | - | P2 |
| M2.1-11 | Filtrer > Effacer le filtre de «col» / Réappliquer / Filtrer par valeur, couleur de la cellule sélectionnée | Menu |  | Partiel | CLP 'filter' : active/désactive le filtre automatique seulement | P1 |
| M2.1-12 | Trier > Trier de A à Z / de Z à A / Placer la couleur de cellule en premier / Tri personnalisé... | Menu |  | Partiel | CLP 'sort' : A-Z, Z-A, personnalisé ; pas de tri par couleur | P1 |
| M2.1-13 | Obtenir les données à partir d'un tableau/d'une image | Cmd |  | Absent | - | P3 |
| M2.1-14 | Nouveau commentaire | Cmd | Ctrl+Maj+F2 | Partiel | CLP 'cmt' -> window.prompt (voir défauts) | P1 |
| M2.1-15 | Nouvelle note / Modifier la note / Supprimer la note / Afficher-Masquer les notes | Cmd | Maj+F2 | Partiel | CLP 'note' : création seule | P1 |
| M2.1-16 | Format de cellule... | Dialogue | Ctrl+1 | À vérifier | CLP 'fmt' | P1 |
| M2.1-17 | Choisir dans la liste déroulante... | Cmd | Alt+Bas | Absent | saisie semi-auto par liste de la colonne non implémentée | P2 |
| M2.1-18 | Définir un nom... | Dialogue |  | Partiel | CLP 'name' ouvre le gestionnaire (pas la boîte « Nouveau nom » pré-remplie) | P2 |
| M2.1-19 | Lien > Insérer un lien / Ouvrir / Modifier / Copier / Supprimer le lien hypertexte | Menu | Ctrl+K | Partiel | CLP 'link' : insertion seule | P1 |
| M2.1-20 | Mini-barre flottante au-dessus du menu | Affichage |  | Absent | voir section 3 | P1 |


### 2.2 En-tête de ligne, de colonne, coin « Sélectionner tout »

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.2-01 | Couper / Copier / Coller / Collage spécial | Cmd |  | À vérifier | CLP communs | P1 |
| M2.2-02 | Insérer (ligne ou colonne au-dessus/à gauche) | Cmd |  | À vérifier | CLP 'ir'/'ic' | P1 |
| M2.2-03 | Supprimer | Cmd |  | À vérifier | CLP 'dr'/'dc' | P1 |
| M2.2-04 | Effacer le contenu | Cmd |  | Absent | CLP : absent des zones ligne/colonne | P2 |
| M2.2-05 | Format de cellule... | Dialogue |  | À vérifier | CLP 'fmt' | P1 |
| M2.2-06 | Hauteur de ligne... / Largeur de colonne... | Dialogue |  | À vérifier | CLP 'rh'/'cw' | P1 |
| M2.2-07 | Masquer | Cmd |  | À vérifier | CLP 'hr'/'hc' | P1 |
| M2.2-08 | Afficher | Cmd |  | Partiel | CLP 'sr'/'sc' : agit sur la sélection ; Excel affiche les lignes masquées voisines de la sélection | P2 |
| M2.2-09 | Menu du coin « Sélectionner tout » | Menu |  | Partiel | GRD 'corner' retombe sur le menu cellule | P3 |
| M2.2-10 | Double-clic sur la limite d'en-tête : ajustement automatique | Geste |  | À vérifier | GRD resize 'auto' (detail 2) | P1 |
| M2.2-11 | Glisser la limite d'en-tête : largeur/hauteur | Geste |  | À vérifier | GRD resize | P1 |
| M2.2-12 | Glisser les en-têtes sélectionnés pour déplacer ligne/colonne (Maj+glisser) | Geste |  | Absent | - | P2 |


### 2.3 Onglet de feuille

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.3-01 | Insérer... (boîte : Feuille de calcul / Feuille de macros / ...) | Dialogue |  | Partiel | SHT 'ins' : ajoute une feuille sans dialogue | P2 |
| M2.3-02 | Supprimer | Cmd |  | À vérifier | SHT 'del' (confirmation dans useSheetOps) | P1 |
| M2.3-03 | Renommer | Cmd |  | À vérifier | SHT 'ren' + double-clic | P1 |
| M2.3-04 | Déplacer ou copier... (dialogue : classeur cible, avant la feuille, créer une copie) | Dialogue |  | Absent | SHT propose Déplacer à gauche/droite + Dupliquer, non Excel | P1 |
| M2.3-05 | Afficher le code (VBA) | Cmd |  | Absent | hors périmètre | P3 |
| M2.3-06 | Protéger la feuille... | Dialogue |  | À vérifier | SHT 'protect' | P1 |
| M2.3-07 | Couleur d'onglet (palette + Aucune couleur + Autres couleurs) | Menu |  | Partiel | SHT 'color' : couleurs standard seulement | P2 |
| M2.3-08 | Masquer | Cmd |  | À vérifier | SHT 'hide' | P1 |
| M2.3-09 | Afficher... | Dialogue |  | À vérifier | SHT 'unhide' + UnhideSheetDialog | P1 |
| M2.3-10 | Sélectionner toutes les feuilles (mode Groupe de travail) | Cmd |  | Absent | S.sheetMenu.selectAll défini, non branché | P2 |
| M2.3-11 | Maj+clic / Ctrl+clic sur onglets : sélection multiple | Geste |  | Absent | SHT : un seul onglet actif | P2 |
| M2.3-12 | Ctrl+glisser un onglet : copier la feuille | Geste |  | Absent | - | P2 |
| M2.3-13 | Glisser un onglet : réordonner | Geste |  | À vérifier | SHT onDragStart/onDrop | P1 |
| M2.3-14 | Boutons de défilement des onglets / bouton « + » | Cmd |  | À vérifier | SHT nav + add | P1 |
| M2.3-15 | Clic droit sur les flèches de défilement : liste des feuilles | Menu |  | Absent | - | P3 |
| M2.3-16 | Poignée de fractionnement onglets / barre de défilement horizontale | Geste |  | Absent | - | P3 |


### 2.4 Poignée de recopie et glisser-déplacer

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.4-01 | Glisser la poignée (bouton gauche) : recopie incrémentée | Geste |  | À vérifier | GRD fill + L-fill autoFill (séries, dates, jours/mois FR) (logique couverte par node --test) | P1 |
| M2.4-02 | Ctrl+glisser la poignée : copier sans incrémenter | Geste |  | À vérifier | GRD fill copyOnly | P2 |
| M2.4-03 | Double-clic sur la poignée : recopier vers le bas jusqu'à la fin des données voisines | Geste |  | Absent | GRD : aucun traitement de detail 2 sur la poignée | P1 |
| M2.4-04 | Glisser avec le bouton droit : menu (Copier les cellules, Incrémenter la série, Recopier uniquement la mise en forme, Recopier sans mise en forme, Recopier les jours / jours ouvrés / mois / années, Tendance linéaire, Tendance géométrique, Remplissage instantané, Série...) | Menu |  | Absent | - | P2 |
| M2.4-05 | Bouton « Options de recopie incrémentée » après la recopie | Menu |  | Absent | STATUS « Reste à faire » | P1 |
| M2.4-06 | Déplacer une plage en glissant sa bordure | Geste |  | Absent | GRD : drags 'select', 'fill', 'resize', 'rows', 'cols', 'point' seulement | P1 |
| M2.4-07 | Copier en glissant la bordure avec Ctrl | Geste |  | Absent | - | P1 |
| M2.4-08 | Maj+glisser la bordure : insérer en déplaçant | Geste |  | Absent | - | P3 |
| M2.4-09 | Bouton « Options de collage » (Ctrl) après un collage | Menu |  | Absent | - | P2 |
| M2.4-10 | Marquage « fourmis » de la plage copiée | Affichage |  | À vérifier | PNT copyRange | P2 |


### 2.5 Graphique et ses éléments

> Rien n'est sélectionnable à l'intérieur d'un graphique : `ChartView.tsx` est un rendu SVG sans éléments interactifs ; `Drawings.tsx` ne gère que l'objet entier (déplacer, 3 poignées).

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.5-01 | Clic droit sur la zone de graphique : Couper, Copier, Options de collage, Réinitialiser pour faire correspondre au style, Modifier le type de graphique..., Enregistrer en tant que modèle..., Sélectionner des données..., Déplacer le graphique..., Rotation 3D, Regrouper, Mettre au premier plan, Mettre à l'arrière-plan, Affecter une macro..., Modifier le texte de remplacement..., Enregistrer en tant qu'image..., Mise en forme de la zone de graphique... | Menu |  | Absent | - | P1 |
| M2.5-02 | Clic droit sur une série : Ajouter des étiquettes de données, Ajouter une courbe de tendance..., Modifier le type de graphique de série..., Sélectionner des données..., Mise en forme de la série de données... | Menu |  | Absent | - | P1 |
| M2.5-03 | Clic droit sur un point de données / une étiquette : Mise en forme des étiquettes de données..., Mise en forme du point de données... | Menu |  | Absent | - | P2 |
| M2.5-04 | Clic droit sur un axe : Mise en forme de l'axe..., Supprimer | Menu |  | Absent | - | P1 |
| M2.5-05 | Clic droit sur un titre (graphique, axe) : Modifier le texte, Supprimer, Mise en forme du titre... | Menu |  | Absent | - | P1 |
| M2.5-06 | Clic droit sur la légende : Supprimer, Mise en forme de la légende... | Menu |  | Absent | - | P1 |
| M2.5-07 | Clic droit sur la zone de traçage : Réinitialiser pour faire correspondre au style, Mise en forme de la zone de traçage... | Menu |  | Absent | - | P2 |
| M2.5-08 | Clic droit sur le quadrillage : Mise en forme du quadrillage..., Supprimer | Menu |  | Absent | - | P2 |
| M2.5-09 | Clic droit sur une courbe de tendance : Mise en forme..., Supprimer | Menu |  | Absent | - | P3 |
| M2.5-10 | Boutons flottants du graphique : Éléments de graphique (+), Styles du graphique (pinceau), Filtres du graphique (entonnoir) | Affichage |  | Absent | - | P1 |
| M2.5-11 | Mini-barre du graphique : liste Éléments, Remplissage, Contour | Affichage |  | Absent | - | P2 |
| M2.5-12 | Modifier le titre du graphique en place (clic dans le titre) | Geste |  | Absent | S.chart.editTitle défini ; ACT chartTitle ne fait qu'afficher/masquer | P1 |
| M2.5-13 | Poignées de redimensionnement (8 poignées) | Geste |  | Partiel | DRW 3 poignées (est, sud, sud-est) | P1 |
| M2.5-14 | Déplacer le graphique à la souris | Geste |  | À vérifier | DRW start('move') + ACT moveDrawing | P1 |
| M2.5-15 | Supprimer le graphique (touche Suppr) | Cmd |  | À vérifier | KEY deleteDrawing -> ACT chartDelete | P1 |


### 2.6 Tableau croisé dynamique

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.6-01 | Clic droit sur une cellule du TCD : Actualiser, Mise en forme des cellules..., Format de nombre..., Trier, Filtrer, Sous-total de «champ», Développer/Réduire, Grouper..., Dissocier, Déplacer, Supprimer «champ», Paramètres de champs..., Options du tableau croisé dynamique..., Afficher la liste de champs | Menu |  | Absent | retombe sur le menu de cellule | P1 |
| M2.6-02 | Clic droit sur une valeur : Résumer les valeurs par, Afficher les valeurs, Afficher les détails, Paramètres des champs de valeurs... | Menu |  | Absent | ces réglages existent seulement dans PAN PivotPane | P1 |
| M2.6-03 | Clic droit sur un bouton de champ / étiquette : Développer/Réduire le champ, Trier, Filtrer | Menu |  | Absent | - | P2 |
| M2.6-04 | Double-clic sur une valeur : afficher les détails dans une nouvelle feuille | Geste |  | Absent | - | P1 |
| M2.6-05 | Glisser des champs entre les zones du volet | Geste |  | Partiel | PAN : liste déroulante « Déplacer vers » au lieu du glisser-déposer | P1 |


### 2.7 Cellule d'un tableau (ListObject)

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.7-01 | Insérer > Colonnes de tableau à gauche / à droite, Lignes de tableau au-dessus / en dessous | Menu |  | Absent | le menu de cellule n'a pas de variante tableau | P1 |
| M2.7-02 | Supprimer > Colonnes du tableau / Lignes du tableau | Menu |  | Absent | - | P1 |
| M2.7-03 | Sélectionner > Données de la colonne, Colonne entière, Ligne du tableau, Tout le tableau | Menu |  | Absent | - | P2 |
| M2.7-04 | Tableau > Convertir en plage / Insérer un segment / Propriétés du tableau | Menu |  | Absent | - | P2 |
| M2.7-05 | Flèche de redimensionnement du coin du tableau | Geste |  | Absent | - | P2 |
| M2.7-06 | Extension automatique du tableau en tapant sous la dernière ligne / à droite | Geste |  | Absent | - | P1 |


### 2.8 Image, forme, zone de texte, segment, chronologie

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.8-01 | Clic droit : Couper, Copier, Coller, Modifier le texte, Modifier les points, Regrouper, Mettre au premier plan / arrière-plan, Lien, Enregistrer en tant qu'image..., Modifier le texte de remplacement, Dimensions et propriétés..., Mise en forme de la forme/image... | Menu |  | Absent | aucun menu sur les objets | P1 |
| M2.8-02 | Poignées de rotation et de modification (jaunes) | Geste |  | Absent | - | P2 |
| M2.8-03 | Insertion d'image par glisser-déposer de fichier | Geste |  | Absent | - | P2 |
| M2.8-04 | Coller une image du presse-papiers | Geste |  | Absent | - | P2 |
| M2.8-05 | Segment : clic droit (Couper, Supprimer «x», Taille et propriétés..., Paramètres du segment..., Connexions de rapport...) | Menu |  | Absent | - | P2 |


### 2.9 Zone de nom, barre de formule, barre d'état, volets figés

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| M2.9-01 | Zone Nom : liste déroulante des noms et sélections nommées | Liste |  | Partiel | FBR input + datalist (noms) ; saisie d'une plage atteint, pas de création de nom par Entrée | P1 |
| M2.9-02 | Zone Nom : créer un nom en saisissant un texte + Entrée | Geste |  | Absent | FBR onGo -> goTo | P1 |
| M2.9-03 | Zone Nom : redimensionner la zone en glissant | Geste |  | Absent | - | P3 |
| M2.9-04 | Barre de formule : bouton Annuler (croix) / Entrer (coche) / Insérer une fonction (fx) | Cmd |  | À vérifier | FBR | P1 |
| M2.9-05 | Barre de formule : développer/réduire (Ctrl+Maj+U) | Cmd | Ctrl+Maj+U | Partiel | FBR bouton ; raccourci absent | P2 |
| M2.9-06 | Barre de formule : redimensionner par glisser la poignée | Geste |  | Absent | - | P3 |
| M2.9-07 | Barre de formule : menu contextuel (Couper, Copier, Coller, Sélectionner tout, Police...) | Menu |  | Absent | menu du navigateur | P3 |
| M2.9-08 | Barre d'état : menu de personnalisation (Mode cellule, Moyenne, Nombre, Nombre numérique, Minimum, Maximum, Somme, Zoom, Curseur de zoom, Mode d'affichage, Verr. Maj, Verr. Num, Enregistrement de macro, Signatures...) | Menu |  | Absent | APP StatusBar : éléments fixes, aucun menu | P2 |
| M2.9-09 | Barre d'état : clic sur Somme/Moyenne copie la valeur | Geste |  | Absent | - | P3 |
| M2.9-10 | Volets figés : trait de séparation glissable (fractionner) | Geste |  | Absent | freeze via menu seulement | P2 |
| M2.9-11 | Commentaire / note : clic droit (Modifier, Supprimer, Copier, Coller, Mise en forme du commentaire, Afficher/Masquer) | Menu |  | Absent | - | P2 |
| M2.9-12 | Lien hypertexte : clic = suivre ; Ctrl+clic ; clic droit (Ouvrir, Modifier, Copier, Supprimer, Sélectionner) | Menu |  | Absent | aucun traitement des liens dans la grille (voir défauts) | P1 |
| M2.9-13 | Liste de validation : flèche dans la cellule | Geste |  | À vérifier | APP overlay .xl-dvbtn + context.open | P1 |
| M2.9-14 | Bouton de filtre dans l'en-tête (liste de valeurs, recherche, filtres numériques/textuels) | Geste |  | À vérifier | APP filterButtons + FLT FilterMenu | P1 |
| M2.9-15 | Menu de filtre : Trier par couleur / Filtrer par couleur / icône / Filtres chronologiques | Menu |  | Absent | FLT : valeurs, nombre, texte, top 10, moyenne seulement | P2 |


## 3. Mini-barre flottante de mise en forme

> Source : connaissance d'Excel 365 FR (apparaît avec le menu contextuel d'une cellule ou d'une plage, ou à la sélection de texte dans la barre de formule / la cellule en édition). L'ordre exact et les libellés sont à valider visuellement sur l'Excel installé (non obtenable par UIA sans vrai clic droit). ForgeOffice possède le composant `packages/ui/src/components/MiniToolbar.tsx` (rangées de contrôles du ruban, placement automatique, `useSelectionMiniToolbar`) utilisé par Word (`packages/word/src/App.tsx`) ; le Tableur ne l'instancie pas (aucune occurrence dans `packages/excel`).

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| B-01 | Mini-barre de cellule : conteneur flottant à deux rangées, affiché au clic droit | Affichage |  | Absent | MiniToolbar prêt à l'emploi mais non branché dans APP / CLP | P1 |
| B-02 | Rangée 1 : Police (liste) | Liste |  | Absent | réutiliser le contrôle 'fontname' de RH | P1 |
| B-03 | Rangée 1 : Taille de police (liste) | Liste |  | Absent | - | P1 |
| B-04 | Rangée 1 : Augmenter la taille de police | Cmd |  | Absent | - | P1 |
| B-05 | Rangée 1 : Réduire la taille de police | Cmd |  | Absent | - | P1 |
| B-06 | Rangée 1 : Format Nombre Comptabilité (€) | Cmd |  | Absent | - | P1 |
| B-07 | Rangée 1 : Style de pourcentage | Cmd |  | Absent | - | P1 |
| B-08 | Rangée 1 : Séparateur de milliers | Cmd |  | Absent | - | P1 |
| B-09 | Rangée 2 : Gras | Cmd |  | Absent | - | P1 |
| B-10 | Rangée 2 : Italique | Cmd |  | Absent | - | P1 |
| B-11 | Rangée 2 : Centrer (alignement) | Cmd |  | Absent | - | P1 |
| B-12 | Rangée 2 : Couleur de remplissage | Cmd |  | Absent | - | P1 |
| B-13 | Rangée 2 : Couleur de police | Cmd |  | Absent | - | P1 |
| B-14 | Rangée 2 : Bordures | Cmd |  | Absent | - | P1 |
| B-15 | Rangée 2 : Ajouter une décimale | Cmd |  | Absent | - | P1 |
| B-16 | Rangée 2 : Réduire les décimales | Cmd |  | Absent | - | P1 |
| B-17 | Rangée 2 : Reproduire la mise en forme | Cmd |  | Absent | - | P1 |
| B-18 | Mini-barre de graphique (clic droit sur un élément) : Éléments de graphique, Remplissage, Contour | Affichage |  | Absent | - | P2 |
| B-19 | Mini-barre de la cellule en édition (sélection de texte) : police, taille, gras, italique, couleur | Affichage |  | Absent | - | P2 |
| B-20 | Mini-barre de la zone de texte / forme : police, taille, gras, italique, soulignement, alignement, couleur | Affichage |  | Absent | - | P3 |


## 4. Boîtes de dialogue

> Statut établi en lisant `ui/dialogs/*.tsx`. Les champs d'Excel sont décrits d'après sa boîte (K), sauf mention UIA.


### 4.1 Format de cellule (Ctrl+1) - DLF FormatCellsDialog

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.1-01 | Boîte Format de cellule : 4 onglets (Nombre, Alignement, Police, Protection) sur 6 | Dialogue | Ctrl+1 | Partiel | DLF : S.fcTabs définit 6 onglets, seuls 4 sont affichés | P1 |
| D4.1-02 | Onglet Nombre : catégories Standard, Nombre, Monétaire, Comptabilité, Date, Heure, Pourcentage, Fraction, Scientifique, Texte, Spécial, Personnalisée | Liste |  | Partiel | DLF : 11 formats prédéfinis plats (pas de catégories ni Spécial) | P1 |
| D4.1-03 | Onglet Nombre : nombre de décimales, séparateur de milliers, nombres négatifs, symbole, type de date, paramètres régionaux | Saisie |  | Absent | DLF : code de format brut à saisir | P1 |
| D4.1-04 | Onglet Nombre : Type (code personnalisé) + exemple en direct | Saisie |  | À vérifier | DLF code + formatValue en direct | P1 |
| D4.1-05 | Onglet Alignement : Horizontal (Standard, Gauche (retrait), Centré, Droite (retrait), Recopié, Justifié, Centré sur plusieurs colonnes, Distribué) | Liste |  | Partiel | DLF : 8 valeurs mais options affichées en anglais brut (general, left, centerContinuous...) | P1 |
| D4.1-06 | Onglet Alignement : Vertical (Haut, Centré, Bas, Justifié, Distribué) | Liste |  | Partiel | DLF idem, libellés bruts | P1 |
| D4.1-07 | Onglet Alignement : Retrait | Saisie |  | À vérifier | DLF indent 0-15 | P2 |
| D4.1-08 | Onglet Alignement : Orientation (cadran + degrés -90 à 90, texte vertical) | Saisie |  | Partiel | DLF rotation 0-180 sans cadran | P2 |
| D4.1-09 | Onglet Alignement : Renvoyer à la ligne automatiquement | Case |  | À vérifier | DLF wrap | P1 |
| D4.1-10 | Onglet Alignement : Ajuster (réduire la police pour tenir dans la cellule) | Case |  | Absent | S.fcShrink défini, jamais affiché | P2 |
| D4.1-11 | Onglet Alignement : Fusionner les cellules | Case |  | À vérifier | DLF merge | P1 |
| D4.1-12 | Onglet Alignement : Sens du texte (Contexte, Gauche à droite, Droite à gauche) | Liste |  | Absent | - | P3 |
| D4.1-13 | Onglet Police : Police (liste), Style (Normal, Italique, Gras, Gras italique), Taille | Liste |  | Partiel | DLF : taille, gras, italique uniquement ; nom de police absent | P1 |
| D4.1-14 | Onglet Police : Soulignement (Aucun, Simple, Double, Simple comptabilité, Double comptabilité) | Liste |  | Absent | - | P1 |
| D4.1-15 | Onglet Police : Couleur | Cmd |  | Absent | - | P1 |
| D4.1-16 | Onglet Police : Effets (Barré, Exposant, Indice) | Case |  | Absent | - | P1 |
| D4.1-17 | Onglet Police : Aperçu + Normal (réinitialiser) | Affichage |  | Absent | - | P2 |
| D4.1-18 | Onglet Bordure : Style de trait (13), Couleur, Prédéfinis (Aucune, Contour, Intérieur), boutons de bordure, aperçu | Dialogue |  | Absent | onglet non réalisé (StatusStyles/applyBorders par préréglage seulement) | P1 |
| D4.1-19 | Onglet Remplissage : Couleur d'arrière-plan, Effets de remplissage (dégradé), Autres couleurs, Couleur du motif, Style de motif, Exemple | Dialogue |  | Absent | onglet non réalisé | P1 |
| D4.1-20 | Onglet Protection : Verrouillée | Case |  | À vérifier | DLF locked | P1 |
| D4.1-21 | Onglet Protection : Masquée | Case |  | À vérifier | DLF hidden (sans effet sans feuille protégée, comme Excel) | P2 |
| D4.1-22 | Bouton OK applique à toute la sélection : seuls les champs modifiés devraient s'appliquer | Option |  | À vérifier | DLF apply() écrit toujours numberFormat, alignement, gras, italique, taille, protection : risque d'écraser un état mixte | P1 |


### 4.2 Rechercher, Remplacer, Atteindre

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.2-01 | Rechercher/Remplacer : onglets Rechercher / Remplacer | Dialogue | Ctrl+F / Ctrl+H | À vérifier | DLB FindDialog | P1 |
| D4.2-02 | Champs Rechercher / Remplacer par | Saisie |  | À vérifier | DLB what/by | P1 |
| D4.2-03 | Respecter la casse | Case |  | À vérifier | DLB matchCase | P1 |
| D4.2-04 | Totalité du contenu de la cellule | Case |  | À vérifier | DLB whole | P1 |
| D4.2-05 | Dans : Feuille / Classeur | Liste |  | Absent | DLB : feuille active seulement | P1 |
| D4.2-06 | Sens : Lignes / Colonnes | Liste |  | Absent | - | P3 |
| D4.2-07 | Regarder dans : Formules / Valeurs / Commentaires / Notes | Liste |  | Partiel | DLB case « Rechercher dans les formules » (2 modes) | P2 |
| D4.2-08 | Format... (rechercher/remplacer par format) | Cmd |  | Absent | - | P3 |
| D4.2-09 | Caractères génériques ? * ~ | Option |  | À vérifier | DLB scan : traitement des jokers non prouvé | P2 |
| D4.2-10 | Bouton Rechercher tout (liste de résultats cliquables) | Cmd |  | À vérifier | DLB setHits : liste présente | P1 |
| D4.2-11 | Bouton Suivant / Remplacer / Remplacer tout | Cmd |  | À vérifier | DLB next/doReplace | P1 |
| D4.2-12 | Atteindre : Référence | Saisie | Ctrl+T | À vérifier | DLB GoToDialog | P1 |
| D4.2-13 | Atteindre : Liste des noms et références | Liste |  | Absent | - | P2 |
| D4.2-14 | Atteindre : bouton Cellules... (Atteindre spécial : commentaires, constantes, formules, vides, zone active, objets, différences, antécédents, dépendants, dernière cellule, cellules visibles, MFC, validation) | Dialogue |  | Absent | - | P2 |


### 4.3 Trier, Filtrer, Validation, Données

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.3-01 | Trier : Ajouter un niveau / Supprimer un niveau | Cmd |  | À vérifier | DLD addLevel/delLevel (supprime le dernier seulement) | P1 |
| D4.3-02 | Trier : Copier un niveau / Monter / Descendre | Cmd |  | Absent | - | P2 |
| D4.3-03 | Trier : Mes données ont des en-têtes | Case |  | À vérifier | DLD footerStart | P1 |
| D4.3-04 | Trier : Trier par colonne + Ordre (Croissant/Décroissant) | Liste |  | À vérifier | DLD select | P1 |
| D4.3-05 | Trier : Trier sur (Valeurs / Couleur de cellule / de police / Icône de MFC) | Liste |  | Absent | - | P2 |
| D4.3-06 | Trier : Liste personnalisée... (Lun, Mar... / Janvier...) | Liste |  | Absent | L-fill FILL_LISTS existe pour la recopie, pas pour le tri | P2 |
| D4.3-07 | Trier : Options (Respecter la casse, Trier de haut en bas / de gauche à droite) | Dialogue |  | Absent | sortRange accepte byColumn mais aucune option UI | P2 |
| D4.3-08 | Filtre automatique : liste des valeurs + (Sélectionner tout) + recherche | Liste |  | À vérifier | FLT / UI FilterMenu | P1 |
| D4.3-09 | Filtre : Filtres numériques (Égal, Différent, Supérieur, Inférieur, Entre, 10 premiers, Au-dessus/En dessous de la moyenne, Filtre personnalisé...) | Menu |  | Partiel | FLT : Supérieur, Inférieur, Égal/Contient, 10 premiers, moyenne ; condition saisie dans un champ | P1 |
| D4.3-10 | Filtre : Filtres textuels (Commence par, Se termine par, Contient, Ne contient pas) | Menu |  | Partiel | FLT : Contient / Égal | P1 |
| D4.3-11 | Filtre : Filtres chronologiques (Aujourd'hui, Demain, Cette semaine, Ce mois-ci, Trimestre, Année...) | Menu |  | Absent | ColumnFilter kind 'dynamic' limité à aboveAverage/belowAverage | P2 |
| D4.3-12 | Filtre : Filtrer par couleur / icône | Menu |  | Absent | - | P2 |
| D4.3-13 | Filtre personnalisé : deux conditions avec ET / OU | Dialogue |  | Absent | DLD : le modèle `custom` gère ET/OU (L-data matchCustom), aucune boîte | P1 |
| D4.3-14 | Filtre avancé : plage de critères, copier vers un autre emplacement, sans doublon | Dialogue |  | Absent | - | P2 |
| D4.3-15 | Validation > Options : Autoriser (Tout, Nombre entier, Décimal, Liste, Date, Heure, Longueur du texte, Personnalisé) | Liste |  | Partiel | DLD : « Heure » absent | P1 |
| D4.3-16 | Validation > Options : Ignorer si vide | Case |  | Absent | - | P2 |
| D4.3-17 | Validation > Options : Liste déroulante dans la cellule | Case |  | Absent | modèle inCellDropdown utilisé mais sans case | P2 |
| D4.3-18 | Validation > Options : Données (entre, hors, égal, différent, >, <, >=, <=), Minimum, Maximum | Liste |  | À vérifier | DLD ops | P1 |
| D4.3-19 | Validation > Options : Appliquer ces modifications à toutes les cellules de mêmes paramètres | Case |  | Absent | - | P3 |
| D4.3-20 | Validation > Message de saisie (case, titre, message) | Saisie |  | Partiel | DLD : message seul, sans titre ni case | P2 |
| D4.3-21 | Validation > Alerte d'erreur (Style Arrêt / Avertissement / Information, titre, message) | Saisie |  | Partiel | DLD : message seul ; le modèle gère errorStyle | P1 |
| D4.3-22 | Validation > Source de liste par plage / nom (=$A$1:$A$5) ou valeurs séparées par ; | Saisie |  | À vérifier | L-validation listItems (logique couverte par node --test) | P1 |
| D4.3-23 | Supprimer les doublons : colonnes à comparer + en-têtes | Dialogue |  | À vérifier | DLD RemoveDupDialog + L-data removeDuplicates (logique couverte par node --test) | P1 |
| D4.3-24 | Convertir : étape 1 (Délimité/Largeur fixe), 2 (séparateurs multiples, guillemets), 3 (format des colonnes, destination) | Dialogue |  | Partiel | DLD : un séparateur parmi 4, destination imposée | P2 |
| D4.3-25 | Sous-total : À chaque changement de, Utiliser la fonction (11), Ajouter un sous-total à, Remplacer les sous-totaux, Saut de page, Synthèse en dessous | Dialogue |  | Partiel | DLD : 6 fonctions, colonne(s) à totaliser ; options supplémentaires absentes | P2 |
| D4.3-26 | Consolider : Fonction, Référence, Liste de références, Étiquettes (ligne du haut / colonne de gauche), Lier aux données source | Dialogue |  | Absent | - | P2 |
| D4.3-27 | Valeur cible : Cellule à définir, Valeur à atteindre, Cellule à modifier | Dialogue |  | Absent | - | P2 |
| D4.3-28 | Gestionnaire de scénarios : Ajouter, Supprimer, Modifier, Fusionner, Synthèse | Dialogue |  | Absent | - | P3 |
| D4.3-29 | Table de données : Cellule d'entrée en ligne / en colonne | Dialogue |  | Absent | - | P2 |
| D4.3-30 | Solveur (complément) : cellule objectif, min/max/valeur, variables, contraintes, méthode (GRG, Simplex, Évolutionnaire) | Dialogue |  | Absent | - | P2 |
| D4.3-31 | Analysis ToolPak (complément) : analyse de Fourier, régression, histogramme... | Dialogue |  | Absent | - | P3 |
| D4.3-32 | Feuille de prévision : options (début, intervalle de confiance, saisonnalité) | Dialogue |  | Absent | moteur : PREVISION.ETS livré (505 fonctions), aucune interface | P3 |


### 4.4 Mise en forme conditionnelle, styles, tableaux

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.4-01 | Nouvelle règle de mise en forme : 6 types (d'après les valeurs, cellules qui contiennent, plus/moins élevées, au-dessus/dessous de la moyenne, uniques/doublons, formule) | Dialogue |  | Partiel | DLD CfRuleDialog : valeur, texte, formule ; types 3-5 par le ruban uniquement | P1 |
| D4.4-02 | Règle : Style de mise en forme (Nuance à 2 / 3 couleurs, Barre de données, Jeu d'icônes) avec min/milieu/max (Type, Valeur, Couleur) | Dialogue |  | Absent | ruban : présélections figées seulement | P1 |
| D4.4-03 | Règle : bouton Format... (onglets Nombre, Police, Bordure, Remplissage) | Dialogue |  | Absent | DLD : 5 présélections (S.cfPresets) | P1 |
| D4.4-04 | Gestionnaire : Afficher les règles pour (Sélection / Feuille / Tableau / TCD) | Liste |  | Absent | - | P2 |
| D4.4-05 | Gestionnaire : Nouvelle règle / Modifier la règle / Supprimer la règle | Cmd |  | Partiel | DLD CfManageDialog : suppression seule | P1 |
| D4.4-06 | Gestionnaire : Monter / Descendre (priorité), Arrêter si vrai, Appliqué à | Cmd |  | Absent | - | P1 |
| D4.4-07 | Style de cellule : Nouveau style (nom, cases Nombre/Alignement/Police/Bordure/Remplissage/Protection) | Dialogue |  | Absent | - | P3 |
| D4.4-08 | Créer un tableau (Où sont les données ?, Mon tableau comporte des en-têtes) | Dialogue |  | Absent | Ctrl+L crée sans confirmation | P1 |
| D4.4-09 | Redimensionner le tableau | Dialogue |  | Absent | - | P2 |


### 4.5 Formules, noms

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.5-01 | Insérer une fonction : Rechercher une fonction | Saisie |  | À vérifier | DLF fnSearch | P1 |
| D4.5-02 | Insérer une fonction : Catégorie (Récemment utilisées, Toutes, 11 catégories) | Liste |  | À vérifier | DLF categories + fnRecent | P1 |
| D4.5-03 | Insérer une fonction : liste des fonctions + description | Liste |  | À vérifier | DLF fnSelect + fn-help.ts | P1 |
| D4.5-04 | Insérer une fonction : « Aide sur cette fonction » | Cmd |  | Absent | - | P3 |
| D4.5-05 | Arguments de la fonction : un champ par argument, valeur de chaque argument, description, résultat en direct | Dialogue |  | À vérifier | DLF fnArgs + fnResult | P1 |
| D4.5-06 | Arguments de la fonction : sélecteur de plage (bouton de réduction de boîte) | Cmd |  | Absent | - | P2 |
| D4.5-07 | Gestionnaire de noms : Nouveau / Modifier / Supprimer | Dialogue | Ctrl+F3 | À vérifier | DLF NamesDialog | P1 |
| D4.5-08 | Gestionnaire de noms : colonnes Nom, Valeur, Fait référence à, Étendue, Commentaire | Affichage |  | Partiel | DLF : commentaire absent | P2 |
| D4.5-09 | Gestionnaire de noms : Filtrer (noms de feuille, globaux, avec/sans erreurs, de tableau) | Menu |  | Absent | - | P3 |
| D4.5-10 | Nouveau nom : Nom, Étendue (classeur / feuille), Commentaire, Fait référence à | Dialogue |  | Partiel | DLF : sans commentaire | P1 |
| D4.5-11 | Vérification des erreurs (suivante, aide, ignorer, modifier dans la barre, Options) | Dialogue |  | Absent | - | P2 |
| D4.5-12 | Évaluation de formule : Évaluer / Pas à pas détaillé / Pas à pas sortant | Dialogue |  | Partiel | DLF EvaluateDialog : Évaluer et Recommencer ; pas à pas détaillé/sortant absents | P2 |
| D4.5-13 | Fenêtre Espion | Volet |  | Absent | - | P3 |


### 4.6 Collage, insertion, tailles, liens

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.6-01 | Collage spécial : Tout, Formules, Valeurs, Formats, Commentaires et notes, Validation, Tout sauf la bordure, Largeurs de colonnes, Formules et formats de nombres, Valeurs et formats de nombres, Tous les formats de fusion conditionnelle | Dialogue |  | Partiel | DLB : 6 entrées (tout, formules, valeurs, formats, sans bordure, valeurs+nombres) | P1 |
| D4.6-02 | Collage spécial : Opération (Aucune, Addition, Soustraction, Multiplication, Division) | Option |  | À vérifier | DLB pasteOp | P1 |
| D4.6-03 | Collage spécial : Blancs non compris / Transposé | Case |  | À vérifier | DLB skip/transpose | P1 |
| D4.6-04 | Collage spécial : Coller avec liaison | Cmd |  | Absent | - | P3 |
| D4.6-05 | Insérer des cellules (Décaler vers la droite / le bas, Ligne entière, Colonne entière) | Dialogue |  | Absent | - | P1 |
| D4.6-06 | Supprimer des cellules (Décaler vers la gauche / le haut, Ligne entière, Colonne entière) | Dialogue |  | Absent | - | P1 |
| D4.6-07 | Largeur de colonne / Hauteur de ligne | Dialogue |  | À vérifier | DLB SizeDialog | P1 |
| D4.6-08 | Largeur par défaut | Dialogue |  | Absent | - | P3 |
| D4.6-09 | Série (Série en lignes/colonnes; Type Linéaire, Géométrique, Chronologique, Recopie incrémentée; Unité de temps; Incrément; Limite; Tendance) | Dialogue |  | Partiel | DLB SeriesDialog : lignes/colonnes, linéaire/géométrique, pas, limite | P2 |
| D4.6-10 | Lien hypertexte : Fichier ou page web existant(e), Emplacement dans ce document, Créer un document, Adresse de messagerie ; Texte à afficher ; Info-bulle | Dialogue |  | Partiel | DLB LinkDialog : adresse, texte, emplacement ; mailto accepté, pas d'info-bulle | P1 |
| D4.6-11 | Symbole : Police, Sous-ensemble, Caractères spéciaux, Caractères récents | Dialogue |  | Partiel | DLB SymbolDialog : grille de symboles | P3 |
| D4.6-12 | Zoom (200 %, 100 %, 75 %, 50 %, 25 %, Ajusté à la sélection, Personnalisé) | Dialogue |  | À vérifier | DLB ZoomDialog | P2 |
| D4.6-13 | Déplacer ou copier (classeur de destination, avant la feuille, Créer une copie) | Dialogue |  | Absent | - | P1 |
| D4.6-14 | Afficher une feuille masquée | Dialogue |  | À vérifier | DLB UnhideSheetDialog | P1 |
| D4.6-15 | Texte de remplacement (volet) | Volet |  | Absent | - | P2 |
| D4.6-16 | Protéger la feuille : mot de passe | Saisie |  | À vérifier | DLB ProtectDialog + legacyHash 16 bits | P1 |
| D4.6-17 | Protéger la feuille : liste « Autoriser tous les utilisateurs à » (sélectionner les cellules verrouillées/déverrouillées, mettre en forme, insérer/supprimer lignes/colonnes, trier, filtrer, TCD, objets, scénarios) | Case |  | Absent | modèle xlsx a les options, aucune UI | P1 |
| D4.6-18 | Protéger la structure et les fenêtres du classeur | Dialogue |  | Partiel | ProtectDialog 'book' : structure seulement | P2 |
| D4.6-19 | Autoriser la modification des plages | Dialogue |  | Absent | - | P3 |
| D4.6-20 | Note : modifier le texte | Dialogue |  | À vérifier | DLB NoteDialog | P1 |


### 4.7 Tableaux croisés, graphiques, objets

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.7-01 | Créer un tableau croisé dynamique : Sélectionner un tableau/plage, source externe, modèle de données, nouvelle feuille / existante | Dialogue |  | Partiel | DLD PivotCreateDialog : plage + nouvelle feuille ou existante | P1 |
| D4.7-02 | Options du tableau croisé dynamique : onglet Disposition et mise en forme (fusionner étiquettes, retrait, afficher champs, erreurs, cellules vides, ajuster largeurs, conserver la mise en forme) | Dialogue |  | Absent | - | P1 |
| D4.7-03 | Options du TCD : Totaux et filtres (totaux lignes/colonnes, filtrer plusieurs éléments, tris personnalisés) | Dialogue |  | Absent | - | P2 |
| D4.7-04 | Options du TCD : Affichage (boutons développer, info-bulles, légendes de champ, ordre des champs) | Dialogue |  | Absent | - | P3 |
| D4.7-05 | Options du TCD : Données (enregistrer les données source, actualiser à l'ouverture) | Dialogue |  | Absent | xlsx persiste désormais pivotCaches/pivotTables mais le Tableur ne les utilise pas | P1 |
| D4.7-06 | Paramètres des champs de valeurs : Résumer par (11), Afficher les valeurs (14 calculs), Format de nombre | Dialogue |  | Partiel | PAN : 9 fonctions, 4 « afficher les valeurs » en listes déroulantes | P1 |
| D4.7-07 | Paramètres de champ : Nom, Sous-totaux et filtres, Disposition et impression | Dialogue |  | Absent | - | P2 |
| D4.7-08 | Grouper (dates : secondes à années ; nombres : début/fin/par) | Dialogue |  | Absent | - | P1 |
| D4.7-09 | Champ calculé / Élément calculé | Dialogue |  | Absent | moteur sans évaluation (xlsx STATUS) | P2 |
| D4.7-10 | Insérer un graphique : Graphiques recommandés / Tous les graphiques (Modèles, Combiné) | Dialogue |  | Absent | - | P1 |
| D4.7-11 | Sélectionner la source de données : plage, séries (Ajouter / Modifier / Supprimer), étiquettes de l'axe horizontal, Changer de ligne/colonne, cellules masquées | Dialogue |  | Absent | STATUS : pas d'éditeur de séries | P1 |
| D4.7-12 | Modifier le type de graphique : types, sous-types, combinés par série, axe secondaire | Dialogue |  | Absent | RC menu de 10 types | P1 |
| D4.7-13 | Déplacer le graphique (feuille de graphique / objet dans) | Dialogue |  | Absent | - | P3 |
| D4.7-14 | Mise en forme de l'axe (volet) : Limites, Unités, Échelle logarithmique, Valeurs en ordre inverse, Graduations, Étiquettes, Nombre | Volet |  | Absent | - | P1 |
| D4.7-15 | Mise en forme de la série de données (volet) : Remplissage, Bordure, Effets, Options de série (chevauchement, largeur d'intervalle, axe secondaire) | Volet |  | Absent | - | P1 |
| D4.7-16 | Étiquettes de données (volet) : Valeur, Nom de la série, Nom de la catégorie, Pourcentage, Séparateur, Position | Volet |  | Absent | RC bascule globale « valeur » seulement | P1 |
| D4.7-17 | Courbe de tendance (linéaire, exponentielle, log, polynomiale, puissance, moyenne mobile ; équation, R²) | Volet |  | Absent | - | P2 |
| D4.7-18 | Barres d'erreur | Volet |  | Absent | - | P3 |
| D4.7-19 | Table de données du graphique | Cmd |  | Absent | - | P3 |
| D4.7-20 | Segment : Insérer des segments (cases de champs) / Paramètres du segment | Dialogue |  | Absent | - | P2 |
| D4.7-21 | Chronologie : Insérer des chronologies | Dialogue |  | Absent | - | P3 |
| D4.7-22 | Sparkline : Créer des graphiques sparkline (plage de données, plage d'emplacements) | Dialogue |  | À vérifier | DLB SparklineDialog | P2 |
| D4.7-23 | Sparkline : Axe horizontal/vertical (minimum, maximum, ordre, afficher l'axe) | Dialogue |  | Absent | - | P3 |
| D4.7-24 | Mise en forme de l'objet (volet Format de la forme / de l'image) : Remplissage, Ligne, Effets, Taille, Propriétés, Zone de texte, Texte de remplacement | Volet |  | Absent | - | P1 |
| D4.7-25 | Taille et propriétés (largeur, hauteur, rotation, verrouiller le rapport, se déplace/redimensionne avec les cellules) | Dialogue |  | Absent | - | P2 |


### 4.8 Mise en page, impression, Options

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| D4.8-01 | Mise en page > Page : Orientation, Mise à l'échelle (Réduire/agrandir, Ajuster), Format du papier, Qualité d'impression, Numéro de première page | Dialogue |  | Absent | (équivalents partiels dans BST PrintPage : orientation, papier, ajustement) | P1 |
| D4.8-02 | Mise en page > Marges : haut, bas, gauche, droite, en-tête, pied, centrer horizontalement / verticalement | Dialogue |  | Absent | CMD pageSetup accepte les marges, 3 présélections au ruban | P1 |
| D4.8-03 | Mise en page > En-tête/Pied de page : listes prédéfinies, En-tête personnalisé (gauche/centre/droite, &[Page], &[Date], &[Fichier]...), Première page différente, Pages paires/impaires différentes, Mettre à l'échelle avec le document, Aligner avec les marges | Dialogue |  | Absent | PRT n'imprime aucun en-tête/pied | P1 |
| D4.8-04 | Mise en page > Feuille : Zone d'impression, Lignes/Colonnes à répéter, Quadrillage, Noir et blanc, Qualité brouillon, En-têtes de ligne et de colonne, Commentaires, Erreurs, Ordre des pages | Dialogue |  | Partiel | RT zone d'impression + quadrillage/en-têtes ; titres, ordre, commentaires absents | P1 |
| D4.8-05 | Imprimer (Backstage) : Copies, Imprimante, Imprimer les feuilles actives / classeur / sélection, Recto verso, Assemblées, Orientation, Taille, Marges, Mise à l'échelle, Aperçu paginé | Dialogue | Ctrl+P | Partiel | BST PrintPage : imprimante système, orientation, papier, ajustement, quadrillage, en-têtes, aperçu ; copies/étendue limitées | P1 |
| D4.8-06 | Options Excel > Général (nom d'utilisateur, police par défaut, taille, mode d'affichage, thème Office) | Dialogue |  | Absent | BST options : 3 lignes de texte | P2 |
| D4.8-07 | Options Excel > Formules : Mode de calcul (Auto, Auto sauf tables, Manuel), Recalculer avant d'enregistrer, Calcul itératif (itérations max, écart max), Style de référence L1C1, Vérification des erreurs, Règles de vérification | Dialogue |  | Partiel | BST : Automatique / Manuel ; itératif disponible dans le moteur (FRM) sans interface | P1 |
| D4.8-08 | Options Excel > Données : annulation, taille des tableaux, Power Query | Dialogue |  | Absent | - | P3 |
| D4.8-09 | Options Excel > Vérification : Options de correction automatique, orthographe | Dialogue |  | Absent | - | P2 |
| D4.8-10 | Options Excel > Enregistrement : format par défaut, enregistrement automatique toutes les n minutes, dossier par défaut, hors connexion | Dialogue |  | Partiel | BST : case informative « toutes les 30 s » non modifiable | P2 |
| D4.8-11 | Options Excel > Langue | Dialogue |  | Absent | français seulement (consigne) | P3 |
| D4.8-12 | Options Excel > Options d'ergonomie | Dialogue |  | Absent | - | P3 |
| D4.8-13 | Options Excel > Avancé : Après appui sur Entrée déplacer la sélection (sens), décimale fixe, poignée de recopie, glisser-déplacer, saisie semi-automatique, remplissage instantané, alerte écrasement | Dialogue |  | Absent | comportements codés en dur (APP) | P1 |
| D4.8-14 | Options Excel > Avancé : Afficher (formule, quadrillage + couleur, zéros, symboles de plan, barres de défilement, onglets) par classeur/feuille | Dialogue |  | Partiel | ruban Affichage : quadrillage, en-têtes, barre de formule ; pas de « zéros », barres de défilement, onglets | P2 |
| D4.8-15 | Options Excel > Avancé : système de dates 1904, calculer avec la précision affichée, mettre à jour les liens | Dialogue |  | Absent | le modèle (wb.date1904) existe, aucune interface | P3 |
| D4.8-16 | Options Excel > Personnaliser le ruban / Barre d'accès rapide | Dialogue |  | Absent | - | P3 |
| D4.8-17 | Options Excel > Compléments / Centre de gestion de la confidentialité | Dialogue |  | Absent | - | P3 |
| D4.8-18 | Options de correction automatique (remplacer pendant la frappe, majuscules, URL en liens, etc.) | Dialogue |  | Absent | voir section 9 | P2 |
| D4.8-19 | Propriétés du classeur (auteur, titre, mots clés, catégories) | Dialogue |  | Partiel | BST info : titre/auteur en lecture seule | P3 |
| D4.8-20 | Avertissement d'enregistrement/fermeture (ConfirmDiscard) et récupération de document | Dialogue |  | À vérifier | UI ConfirmDiscard + RecoveryDialog | P1 |
| D4.8-21 | Ouvrir un fichier : mode protégé, dernières versions, fichiers .xlsx/.xlsm/.xls/.ods/.csv | Dialogue |  | À vérifier | UFO loadFile ; pas de vue protégée | P2 |
| D4.8-22 | Enregistrer sous : type de fichier (xlsx, xlsm, xltx, ods, csv, tsv) | Dialogue |  | À vérifier | BST SaveAsPage | P1 |


## 5. Raccourcis clavier (Excel FR)

> Source des touches : liste Excel FR (connaissance) recoupée avec les accélérateurs UIA (Ctrl+T = Atteindre, Ctrl+B = Recopier vers le bas, Ctrl+D = vers la droite, Ctrl+G = Gras, Ctrl+L = Tableau, Ctrl+Maj+L = Filtrer, Ctrl+E = Remplissage instantané, Ctrl+9/0 = Masquer lignes/colonnes, Alt+= = Somme, Ctrl+F3 = Gestionnaire de noms). Statut établi dans `ui/keys.ts` (KEY), `App.tsx` (onGridKey, onEditKey), `ui/clipboard-ui.ts`.


### 5.1 Déplacement et sélection

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| K5.1-01 | Flèches : déplacer la cellule active | Raccourci | Flèches | À vérifier | KEY moveActive (saute les lignes/colonnes masquées) | P1 |
| K5.1-02 | Ctrl+Flèche : aller au bord de la région de données | Raccourci | Ctrl+Flèche | À vérifier | KEY jumpEdge + L-selection (logique couverte par node --test) | P1 |
| K5.1-03 | Maj+Flèche : étendre la sélection | Raccourci | Maj+Flèche | À vérifier | KEY extendBy | P1 |
| K5.1-04 | Ctrl+Maj+Flèche : étendre jusqu'au bord de la région | Raccourci | Ctrl+Maj+Flèche | À vérifier | KEY jumpEdge + extendTo | P1 |
| K5.1-05 | Tab / Maj+Tab : cellule suivante/précédente (dans la sélection) | Raccourci | Tab | À vérifier | KEY cycleActive | P1 |
| K5.1-06 | Entrée / Maj+Entrée : cellule dessous/dessus (retour à la colonne de départ après Tab) | Raccourci | Entrée | À vérifier | KEY + APP tabOrigin | P1 |
| K5.1-07 | Début : début de ligne | Raccourci | Début | À vérifier | KEY Home | P1 |
| K5.1-08 | Ctrl+Début : A1 | Raccourci | Ctrl+Début | À vérifier | KEY | P1 |
| K5.1-09 | Ctrl+Fin : dernière cellule utilisée | Raccourci | Ctrl+Fin | À vérifier | KEY End | P1 |
| K5.1-10 | Ctrl+Maj+Fin / Ctrl+Maj+Début : étendre jusqu'à la dernière cellule / A1 | Raccourci |  | À vérifier | KEY | P2 |
| K5.1-11 | Maj+Début : étendre jusqu'au début de ligne | Raccourci |  | À vérifier | KEY | P2 |
| K5.1-12 | Page suiv. / Page préc. | Raccourci | PgSuiv | À vérifier | KEY pageRows | P1 |
| K5.1-13 | Alt+Page suiv. / Alt+Page préc. : un écran à droite/gauche | Raccourci |  | Absent | - | P3 |
| K5.1-14 | Ctrl+Page suiv. / Ctrl+Page préc. : feuille suivante/précédente | Raccourci | Ctrl+PgSuiv | À vérifier | KEY switchSheet | P1 |
| K5.1-15 | Maj+Page suiv. : étendre d'un écran | Raccourci |  | À vérifier | KEY | P2 |
| K5.1-16 | Ctrl+Espace : sélectionner la colonne | Raccourci | Ctrl+Espace | À vérifier | KEY selectCols | P1 |
| K5.1-17 | Maj+Espace : sélectionner la ligne | Raccourci | Maj+Espace | À vérifier | KEY selectRows | P1 |
| K5.1-18 | Ctrl+A : région actuelle puis feuille entière | Raccourci | Ctrl+A | À vérifier | KEY currentRegion/selectAll | P1 |
| K5.1-19 | Ctrl+Maj+* : sélectionner la région actuelle | Raccourci | Ctrl+* | À vérifier | KEY | P2 |
| K5.1-20 | Ctrl+Maj+Espace : sélectionner la feuille ou la région | Raccourci |  | Absent | - | P3 |
| K5.1-21 | Ctrl+Retour arrière : afficher la cellule active | Raccourci |  | Absent | - | P3 |
| K5.1-22 | Maj+Retour arrière : réduire la sélection à la cellule active | Raccourci |  | Absent | - | P3 |
| K5.1-23 | Ctrl+Point : changer de coin actif de la sélection | Raccourci |  | Absent | - | P3 |
| K5.1-24 | F8 : mode Extension de la sélection / Maj+F8 : ajouter à la sélection | Raccourci | F8 | Absent | - | P2 |
| K5.1-25 | F5 / Ctrl+T : Atteindre | Raccourci | F5 | À vérifier | KEY | P1 |
| K5.1-26 | Maj+F5 / Ctrl+F : Rechercher | Raccourci | Ctrl+F | À vérifier | KEY | P1 |
| K5.1-27 | Maj+F4 : Rechercher suivant | Raccourci | Maj+F4 | Absent | - | P2 |
| K5.1-28 | Ctrl+Alt+Flèche : sélection multiple discontinue au clavier | Raccourci |  | Absent | - | P3 |
| K5.1-29 | F6 : parcourir volets, ruban, zone de saisie | Raccourci | F6 | Absent | - | P2 |


### 5.2 Saisie et édition

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| K5.2-01 | F2 : modifier la cellule | Raccourci | F2 | À vérifier | KEY startEdit(null) | P1 |
| K5.2-02 | Entrée / Tab : valider la saisie et se déplacer | Raccourci |  | À vérifier | APP onEditKey | P1 |
| K5.2-03 | Échap : annuler la saisie | Raccourci | Échap | À vérifier | APP cancelEdit | P1 |
| K5.2-04 | Alt+Entrée : saut de ligne dans la cellule | Raccourci | Alt+Entrée | À vérifier | APP onEditKey | P1 |
| K5.2-05 | Ctrl+Entrée : remplir la sélection avec la saisie | Raccourci | Ctrl+Entrée | À vérifier | APP commitEdit(fillAll) + L-cells fillRanges (logique couverte par node --test) | P1 |
| K5.2-06 | Ctrl+Maj+Entrée : formule matricielle (CSE) | Raccourci | Ctrl+Maj+Entrée | Absent | APP : aucun traitement ; le moteur gère les débordements | P2 |
| K5.2-07 | Maj+Entrée : valider vers le haut | Raccourci |  | À vérifier | APP | P2 |
| K5.2-08 | Suppr : effacer le contenu | Raccourci | Suppr | À vérifier | KEY clear('contents') | P1 |
| K5.2-09 | Retour arrière : vider et éditer | Raccourci | Retour | À vérifier | KEY startEdit('') | P1 |
| K5.2-10 | F4 (en édition) : basculer références absolues | Raccourci | F4 | À vérifier | APP cycleAbsolute | P1 |
| K5.2-11 | F4 (hors édition) / Ctrl+Y : répéter la dernière action | Raccourci | F4 | Absent | KEY F4 sans Ctrl ne fait rien | P2 |
| K5.2-12 | Ctrl+Z : annuler | Raccourci | Ctrl+Z | À vérifier | KEY + DocStore History | P1 |
| K5.2-13 | Ctrl+Y : rétablir | Raccourci | Ctrl+Y | À vérifier | KEY | P1 |
| K5.2-14 | Ctrl+Maj+Z : rétablir (alternatif) | Raccourci |  | Absent | - | P3 |
| K5.2-15 | Ctrl+; : date du jour | Raccourci | Ctrl+; | À vérifier | KEY stamp | P1 |
| K5.2-16 | Ctrl+Maj+: : heure courante | Raccourci | Ctrl+: | À vérifier | KEY stamp | P1 |
| K5.2-17 | Ctrl+' : copier la formule de la cellule au-dessus | Raccourci |  | Absent | - | P2 |
| K5.2-18 | Ctrl+Maj+" : copier la valeur de la cellule au-dessus | Raccourci |  | Absent | - | P2 |
| K5.2-19 | Ctrl+Maj+Entrée / Ctrl+Maj+Flèche haut en édition : développer la barre de formule (Ctrl+Maj+U) | Raccourci | Ctrl+Maj+U | Absent | - | P3 |
| K5.2-20 | Alt+Bas : liste déroulante de saisie semi-automatique | Raccourci | Alt+Bas | Absent | - | P2 |
| K5.2-21 | Alt+Bas sur un en-tête filtré : ouvrir le menu de filtre | Raccourci |  | Absent | - | P1 |
| K5.2-22 | Maj+F3 : Insérer une fonction | Raccourci | Maj+F3 | À vérifier | KEY | P1 |
| K5.2-23 | Ctrl+A en édition de formule : Arguments de fonction | Raccourci | Ctrl+A | Absent | - | P2 |
| K5.2-24 | Ctrl+Maj+A en édition : insérer les noms d'arguments | Raccourci |  | Absent | - | P3 |
| K5.2-25 | F3 : coller un nom dans la formule | Raccourci | F3 | Absent | KEY F3 ne traite que Maj/Ctrl | P2 |
| K5.2-26 | Ctrl+F3 : Gestionnaire de noms | Raccourci | Ctrl+F3 | À vérifier | KEY | P1 |
| K5.2-27 | Ctrl+Maj+F3 : Créer des noms à partir de la sélection | Raccourci | Ctrl+Maj+F3 | Absent | - | P2 |
| K5.2-28 | Alt+= : somme automatique | Raccourci | Alt+= | À vérifier | APP onGridKey (accepte aussi Alt+0, non Excel) | P1 |
| K5.2-29 | Ctrl+` (Ctrl+") : afficher les formules | Raccourci | Ctrl+" | À vérifier | KEY | P1 |
| K5.2-30 | F9 : calculer | Raccourci | F9 | À vérifier | KEY recalc | P1 |
| K5.2-31 | Maj+F9 : calculer la feuille | Raccourci | Maj+F9 | Absent | - | P2 |
| K5.2-32 | Ctrl+Alt+F9 : tout recalculer / Ctrl+Alt+Maj+F9 : reconstruire les dépendances | Raccourci |  | Absent | - | P3 |
| K5.2-33 | F7 : orthographe | Raccourci | F7 | Absent | - | P2 |
| K5.2-34 | Maj+F7 : dictionnaire des synonymes | Raccourci |  | Absent | - | P3 |
| K5.2-35 | Alt+F8 / Alt+F11 : macros / éditeur VBA | Raccourci |  | Absent | hors périmètre | P3 |
| K5.2-36 | F1 : aide | Raccourci | F1 | Absent | - | P3 |
| K5.2-37 | Ctrl+Q : Analyse rapide | Raccourci | Ctrl+Q | Absent | - | P2 |
| K5.2-38 | F11 : créer un graphique sur une feuille de graphique | Raccourci | F11 | Absent | KEY F11 ne traite que Maj+F11 | P2 |
| K5.2-39 | Alt+F1 : créer un graphique intégré | Raccourci | Alt+F1 | Absent | - | P2 |


### 5.3 Mise en forme et insertion

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| K5.3-01 | Ctrl+G : Gras | Raccourci | Ctrl+G | À vérifier | KEY | P1 |
| K5.3-02 | Ctrl+I : Italique | Raccourci | Ctrl+I | À vérifier | KEY | P1 |
| K5.3-03 | Ctrl+U : Souligné | Raccourci | Ctrl+U | À vérifier | KEY | P1 |
| K5.3-04 | Ctrl+5 : Barré | Raccourci | Ctrl+5 | À vérifier | KEY | P2 |
| K5.3-05 | Ctrl+Maj+F / Ctrl+Maj+P : Format de cellule, onglet Police | Raccourci |  | Absent | - | P3 |
| K5.3-06 | Ctrl+Maj+> / Ctrl+Maj+< : augmenter/réduire la police | Raccourci |  | Absent | - | P2 |
| K5.3-07 | Ctrl+1 : Format de cellule | Raccourci | Ctrl+1 | À vérifier | KEY | P1 |
| K5.3-08 | Ctrl+Maj+~ : format Standard | Raccourci |  | Absent | - | P2 |
| K5.3-09 | Ctrl+Maj+$ : format Monétaire | Raccourci | Ctrl+$ | À vérifier | KEY (code '#,##0.00 [$€-40C]') | P2 |
| K5.3-10 | Ctrl+Maj+% : format Pourcentage | Raccourci | Ctrl+% | À vérifier | KEY | P1 |
| K5.3-11 | Ctrl+Maj+^ : format Scientifique | Raccourci |  | Absent | - | P3 |
| K5.3-12 | Ctrl+Maj+# : format Date | Raccourci |  | Absent | - | P2 |
| K5.3-13 | Ctrl+Maj+@ : format Heure | Raccourci |  | Absent | - | P2 |
| K5.3-14 | Ctrl+Maj+! : format Nombre à 2 décimales | Raccourci |  | Absent | - | P2 |
| K5.3-15 | Ctrl+Maj+& : contour | Raccourci |  | Absent | - | P2 |
| K5.3-16 | Ctrl+Maj+_ : supprimer les bordures | Raccourci |  | Absent | - | P2 |
| K5.3-17 | Ctrl+Maj++ : insérer des cellules | Raccourci | Ctrl++ | Partiel | KEY '+' insère des lignes (sans dialogue) | P1 |
| K5.3-18 | Ctrl+- : supprimer des cellules | Raccourci | Ctrl+- | Partiel | KEY '-' supprime des lignes (sans dialogue) | P1 |
| K5.3-19 | Ctrl+9 / Ctrl+0 : masquer les lignes / colonnes | Raccourci |  | Absent | - | P1 |
| K5.3-20 | Ctrl+Maj+( / Ctrl+Maj+) : afficher les lignes / colonnes | Raccourci |  | Absent | - | P1 |
| K5.3-21 | Ctrl+B : recopier vers le bas | Raccourci | Ctrl+B | À vérifier | KEY | P1 |
| K5.3-22 | Ctrl+D : recopier vers la droite | Raccourci | Ctrl+D | À vérifier | KEY | P1 |
| K5.3-23 | Ctrl+E : remplissage instantané | Raccourci | Ctrl+E | À vérifier | KEY flashFill | P1 |
| K5.3-24 | Ctrl+K : lien hypertexte | Raccourci | Ctrl+K | À vérifier | KEY | P1 |
| K5.3-25 | Ctrl+L / Ctrl+T (Excel EN) : tableau | Raccourci | Ctrl+L | À vérifier | KEY formatAsTable (sans boîte) | P1 |
| K5.3-26 | Ctrl+Maj+L : filtre automatique | Raccourci | Ctrl+Maj+L | À vérifier | KEY | P1 |
| K5.3-27 | Ctrl+Alt+L : réappliquer le filtre | Raccourci |  | Absent | - | P2 |
| K5.3-28 | Ctrl+Maj+T : ligne Total du tableau | Raccourci |  | Absent | - | P2 |
| K5.3-29 | Maj+F2 : note | Raccourci | Maj+F2 | À vérifier | KEY | P1 |
| K5.3-30 | Ctrl+Maj+F2 : nouveau commentaire | Raccourci |  | Absent | - | P2 |
| K5.3-31 | Maj+F10 : menu contextuel de la cellule (touche Menu) | Raccourci | Maj+F10 | Absent | le menu contextuel n'est lié qu'à la souris | P1 |
| K5.3-32 | Ctrl+Alt+V : Collage spécial | Raccourci | Ctrl+Alt+V | À vérifier | KEY | P1 |
| K5.3-33 | Ctrl+C / Ctrl+X / Ctrl+V | Raccourci |  | À vérifier | CLP document copy/cut/paste | P1 |
| K5.3-34 | Ctrl+Alt+C / Ctrl+Alt+Flèche : copier avec mise en forme | Raccourci |  | Absent | - | P3 |


### 5.4 Fichier, fenêtre, ruban, mode d'affichage

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| K5.4-01 | Ctrl+N : nouveau classeur | Raccourci | Ctrl+N | À vérifier | KEY newFile | P1 |
| K5.4-02 | Ctrl+O : ouvrir | Raccourci | Ctrl+O | À vérifier | KEY | P1 |
| K5.4-03 | Ctrl+S : enregistrer | Raccourci | Ctrl+S | À vérifier | KEY | P1 |
| K5.4-04 | F12 : Enregistrer sous | Raccourci | F12 | Partiel | KEY F12 ouvre Format de cellule (comportement erroné) | P1 |
| K5.4-05 | Ctrl+P / Ctrl+Maj+F12 : imprimer | Raccourci | Ctrl+P | À vérifier | KEY print | P1 |
| K5.4-06 | Ctrl+W / Ctrl+F4 : fermer le classeur | Raccourci | Ctrl+W | Partiel | KEY Ctrl+F4 = enregistrer (erreur) ; Ctrl+W absent | P1 |
| K5.4-07 | Alt+F4 : quitter | Raccourci |  | À vérifier | coque Tauri | P2 |
| K5.4-08 | Ctrl+F6 / Ctrl+Tab : changer de classeur | Raccourci |  | Absent | - | P3 |
| K5.4-09 | Ctrl+F1 : réduire/afficher le ruban | Raccourci | Ctrl+F1 | À vérifier | UI Ribbon.tsx | P2 |
| K5.4-10 | Alt (puis lettres) : info-touches | Raccourci | Alt | Partiel | UI KeytipLayer, touches différentes sur 3 onglets | P2 |
| K5.4-11 | Alt+Q : Dites-nous ce que vous voulez faire | Raccourci | Alt+Q | À vérifier | UI TitleBar data-keytip-top Q | P2 |
| K5.4-12 | Ctrl+Molette : zoom | Raccourci |  | À vérifier | GRD onZoom + usePinchZoom | P2 |
| K5.4-13 | Ctrl+Échap / Échap : fermer menus et dialogues | Raccourci | Échap | À vérifier | UI Dialog | P1 |
| K5.4-14 | Alt+Maj+Flèche droite / gauche : grouper / dissocier | Raccourci |  | Absent | - | P2 |
| K5.4-15 | Alt+Maj+Flèche haut : afficher/masquer le plan | Raccourci |  | Absent | - | P3 |
| K5.4-16 | Maj+F11 : nouvelle feuille | Raccourci | Maj+F11 | À vérifier | KEY | P1 |
| K5.4-17 | Alt+Maj+F1 : insérer une feuille | Raccourci |  | Absent | - | P3 |
| K5.4-18 | Ctrl+Maj+U : développer la barre de formule | Raccourci |  | Absent | - | P3 |
| K5.4-19 | Ctrl+Maj+Flèche bas : sélection jusqu'en bas dans un tableau | Raccourci |  | À vérifier | KEY | P2 |


## 6. Volets (panneaux latéraux)

> ForgeOffice dispose d'un composant `TaskPane` redimensionnable (UI `Panels.tsx`) et de deux volets : Champs de TCD et Commentaires (`ui/Panes.tsx`).

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| V-01 | Champs de tableau croisé dynamique : liste des champs avec cases | Volet |  | À vérifier | PAN PivotPane 'chooseFields' | P1 |
| V-02 | Champs de TCD : 4 zones Filtres / Colonnes / Lignes / Valeurs avec glisser-déposer | Volet |  | Partiel | PAN : liste déroulante « Déplacer vers », pas de glisser-déposer | P1 |
| V-03 | Champs de TCD : menu d'un champ de valeur (Paramètres des champs de valeurs...) | Volet |  | Partiel | PAN : sélecteurs fonction + « afficher les valeurs » en ligne | P1 |
| V-04 | Champs de TCD : « Différer la mise à jour de la disposition » + Mettre à jour | Option |  | Absent | - | P3 |
| V-05 | Champs de TCD : barre de recherche de champs | Saisie |  | Absent | - | P3 |
| V-06 | Champs de TCD : filtre de rapport (éléments masqués saisis en texte séparé par ;) | Volet |  | Partiel | PAN input .xl-mini--wide : non conforme à la liste à cocher d'Excel | P1 |
| V-07 | Commentaires : fil, réponses, résolu, supprimer | Volet |  | À vérifier | PAN CommentsPane | P1 |
| V-08 | Commentaires : filtrer (tous / résolus / par auteur), Modifier le commentaire, @mentions | Volet |  | Absent | - | P2 |
| V-09 | Notes : volet de lecture | Volet |  | Absent | - | P3 |
| V-10 | Format de la forme / de l'image / du graphique (volet à droite : Remplissage et ligne, Effets, Taille et propriétés) | Volet |  | Absent | - | P1 |
| V-11 | Format de la zone de graphique / de traçage / de la série / de l'axe / de la légende / du titre (options de texte et de forme) | Volet |  | Absent | - | P1 |
| V-12 | Presse-papiers Office | Volet |  | Absent | - | P3 |
| V-13 | Volet Sélection (liste des objets, masquer/afficher, réordonner) | Volet |  | Absent | - | P2 |
| V-14 | Texte de remplacement | Volet |  | Absent | - | P2 |
| V-15 | Requêtes et connexions / Fenêtre Espion | Volet |  | Absent | - | P3 |
| V-16 | Vérificateur d'accessibilité | Volet |  | Absent | - | P3 |
| V-17 | Idées (Analyser les données) / Recherche intelligente | Volet |  | Absent | - | P3 |
| V-18 | Types de données (Actions, Géographie) : volet de fiche | Volet |  | Absent | - | P3 |
| V-19 | Redimensionner un volet (largeur) et le fermer | Geste |  | À vérifier | UI TaskPane onWidthChange | P2 |


## 7. Backstage (onglet Fichier)

> Source UIA (liste réelle du Backstage Excel 365 FR) : Précédent, Accueil, Nouveau, Ouvrir, Partager, Informations, Enregistrer, Enregistrer sous, Historique, Imprimer, Exporter, Fermer, Compte, Options (Commentaires et Publier non présents dans cette version). ForgeOffice : `ui/BackstagePages.tsx` + `BACKSTAGE_PAGES` de `packages/ui`.

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| F-01 | Accueil : Nouveau (modèles Nouveau classeur, didacticiels, Autres modèles) | Page | Alt, F, L | Partiel | BST home : une seule tuile « Classeur vide » | P1 |
| F-02 | Accueil : Récents / Favoris / Partagés avec moi | Page |  | Partiel | BST FileList récents ; pas de Favoris | P2 |
| F-03 | Nouveau : galerie de modèles, recherche de modèles en ligne | Page | Alt, F, N | Partiel | BST : un seul modèle | P2 |
| F-04 | Ouvrir : Récent, Ce PC, Ajouter un emplacement, Parcourir | Page | Alt, F, W | À vérifier | BST open | P1 |
| F-05 | Partager (inviter, envoyer une copie) | Page | Alt, F, P | Absent | S.backstage/BACKSTAGE_PAGES.share défini, page non fournie | P3 |
| F-06 | Informations : Protéger le classeur (lecture seule, chiffrer par mot de passe, protéger la feuille, protéger la structure, signature, marquer comme final) | Page | Alt, F, X | Partiel | BST info : protection de structure seulement | P2 |
| F-07 | Informations : Inspecter le classeur (document, accessibilité, compatibilité) | Page |  | Partiel | BST info : compteur cellules/formules sans inspection | P3 |
| F-08 | Informations : Gérer le classeur (versions, récupérer les classeurs non enregistrés) | Page |  | Partiel | RecoveryDialog (récupération après plantage) | P2 |
| F-09 | Informations : Propriétés (Taille, Titre, Étiquettes, Catégories, Dates, Auteur, Dernière modification par) | Page |  | Partiel | BST : feuilles, cellules, titre, auteur en lecture seule | P3 |
| F-10 | Enregistrer | Cmd | Alt, F, T | À vérifier | BST save | P1 |
| F-11 | Enregistrer sous : emplacements + nom + type de fichier (xlsx, xlsm, xltx, ods, csv, tsv) | Page | Alt, F, U | À vérifier | BST SaveAsPage | P1 |
| F-12 | Enregistrer sous : formats .xls, .xlsb, .pdf, .xps, .html, .xml, texte Unicode, CSV Macintosh/MS-DOS | Page |  | Partiel | xlsx STATUS : .xls en lecture seule, pas de .xlsb | P2 |
| F-13 | Historique (versions) | Page | Alt, F, K | Absent | - | P3 |
| F-14 | Imprimer : aperçu + paramètres | Page | Alt, F, P | Partiel | BST PrintPage (voir section 4.8) | P1 |
| F-15 | Exporter : Créer un document PDF/XPS | Page | Alt, F, I | Partiel | BST ExportPage : impression vers « Microsoft Print to PDF » système | P2 |
| F-16 | Exporter : Changer le type de fichier | Page |  | À vérifier | BST ExportPage (csv, tsv, ods) | P2 |
| F-17 | Fermer | Cmd | Alt, F, K | À vérifier | BST close + ConfirmDiscard | P1 |
| F-18 | Compte | Page | Alt, F, R | Partiel | BST account : texte « local sans compte » | P3 |
| F-19 | Options | Page | Alt, F, V | Partiel | BST options : calcul auto/manuel + 2 lignes | P1 |
| F-20 | Retour (flèche Précédent) | Cmd |  | À vérifier | UI Backstage onClose | P1 |


## 8. Barre d'état, modes d'affichage, zoom, fenêtres, grille


### 8.1 Barre d'état

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| S8.1-01 | Mode de cellule : Prêt / Entrer / Modifier / Pointer | Affichage |  | À vérifier | APP mode | P1 |
| S8.1-02 | Prêt avec Calculer (calcul manuel) | Affichage |  | À vérifier | APP 'calc' | P1 |
| S8.1-03 | Références circulaires : adresse | Affichage |  | À vérifier | APP 'circ' (engine.circularReferences) | P1 |
| S8.1-04 | Moyenne / Nombre / Somme de la sélection | Affichage |  | À vérifier | APP stats (n'apparaît que si plusieurs cellules) | P1 |
| S8.1-05 | Nombre numérique / Minimum / Maximum | Affichage |  | Absent | S.numCount/min/max définis, non affichés | P2 |
| S8.1-06 | Filtre : « n enregistrements trouvés sur m » | Affichage |  | Absent | - | P2 |
| S8.1-07 | Indicateurs Verr. Maj / Verr. Num / Mode Fin / Mode Extension | Affichage |  | Absent | - | P3 |
| S8.1-08 | Accessibilité : vérification terminée | Affichage |  | Absent | S.accessibility défini, non affiché | P3 |
| S8.1-09 | Enregistrement de macro / Sélection étendue / Autorisations | Affichage |  | Absent | - | P3 |
| S8.1-10 | Boutons de mode : Normal, Mise en page, Aperçu des sauts de page | Cmd |  | À vérifier | APP views | P1 |
| S8.1-11 | Curseur de zoom + boutons − / + et pourcentage cliquable | Cmd |  | À vérifier | APP zoom ; presets « Zoom sur la sélection » | P1 |
| S8.1-12 | Message « Copié : sélectionnez la destination et appuyez sur Entrée » | Affichage |  | Partiel | S.copied défini ; non affiché dans la barre d'état | P3 |


### 8.2 Modes d'affichage et fenêtres

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| S8.2-01 | Normal | Option |  | À vérifier | CMD view('normal') | P1 |
| S8.2-02 | Aperçu des sauts de page : traits bleus déplaçables, Page 1 en filigrane | Option |  | Partiel | PNT pageBreaks (traits) ; glisser les sauts et filigrane absents | P2 |
| S8.2-03 | Mise en page : pages séparées, règles, en-têtes/pieds éditables en place | Option |  | Partiel | STATUS : mêmes cellules avec sauts de page | P2 |
| S8.2-04 | Figer les volets (traits fixes, 3 variantes) | Option |  | À vérifier | CMD freeze + L-viewport | P1 |
| S8.2-05 | Fractionner la fenêtre en 4 volets | Option |  | Absent | - | P2 |
| S8.2-06 | Nouvelle fenêtre sur le même classeur (synchronisée) | Option |  | Partiel | RT new : ouvre le module sur le même chemin (copie indépendante, pas de synchro) | P3 |
| S8.2-07 | Vues personnalisées | Option |  | Absent | - | P3 |
| S8.2-08 | Afficher/masquer règles, quadrillage, en-têtes, barre de formule | Case |  | À vérifier | CMD view / setUi | P1 |
| S8.2-09 | Couleur du quadrillage, afficher les zéros, barres de défilement, onglets de feuille (options par classeur) | Option |  | Absent | - | P3 |
| S8.2-10 | Zoom 10 % à 400 % : Ctrl+molette, pincement tactile, boîte, curseur | Option |  | À vérifier | usePinchZoom + GRD | P1 |
| S8.2-11 | Zoom par feuille (mémorisé dans le fichier) | Option |  | À vérifier | sheet.view.zoom lu/écrit | P2 |
| S8.2-12 | Défilement : molette, barres personnalisées, Maj+molette horizontal | Geste |  | À vérifier | GRD onWheel | P1 |
| S8.2-13 | Grille virtualisée 1 048 576 lignes x 16 384 colonnes | Affichage |  | À vérifier | L-viewport + L-geometry | P1 |


### 8.3 Rendu de la grille

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| S8.3-01 | Nombres alignés à droite, texte à gauche, booléens/erreurs centrés | Affichage |  | À vérifier | PNT | P1 |
| S8.3-02 | Texte débordant sur les cellules vides voisines | Affichage |  | À vérifier | PNT | P1 |
| S8.3-03 | #### quand la colonne est trop étroite | Affichage |  | À vérifier | L-look | P1 |
| S8.3-04 | Cellules fusionnées, renvoi à la ligne, rotation, retrait | Affichage |  | À vérifier | PNT + L-look | P1 |
| S8.3-05 | Bordures (14 présélections, styles OOXML) | Affichage |  | À vérifier | PNT | P1 |
| S8.3-06 | Mise en forme conditionnelle : remplissage, barres de données, nuances, icônes | Affichage |  | À vérifier | PNT + L-condfmt CfEvaluator (logique couverte par node --test) | P1 |
| S8.3-07 | Indicateur rouge de note, info-bulle au survol | Affichage |  | À vérifier | PNT + APP notetip | P2 |
| S8.3-08 | Indicateur de commentaire (violet) et bulle | Affichage |  | Partiel | PAN seulement | P2 |
| S8.3-09 | Références colorées dans la formule et sur la grille (mode Pointer) | Affichage |  | À vérifier | APP editRefs + FIN | P1 |
| S8.3-10 | Bordure animée de la plage pointée | Affichage |  | Absent | STATUS « Reste à faire » | P3 |
| S8.3-11 | Liens hypertexte : texte bleu souligné, curseur main, Ctrl+clic pour suivre | Affichage |  | Absent | aucun rendu ni suivi des hyperliens | P1 |
| S8.3-12 | Flèches de repérage (antécédents/dépendants) | Affichage |  | Partiel | APP arrows : même feuille | P2 |
| S8.3-13 | Filigrane de zone d'impression et sauts de page en vue Normal (pointillés) | Affichage |  | Absent | - | P3 |
| S8.3-14 | Indicateurs d'erreur (triangle vert) et balise d'erreur | Affichage |  | Absent | - | P2 |
| S8.3-15 | Thème sombre / contraste élevé | Affichage |  | À vérifier | UI tokens.css (extension) ; rendu canvas à vérifier | P3 |
| S8.3-16 | Interface tactile (mode sélection/défilement, poignées) | Affichage |  | À vérifier | GRD touch + useGridTouch (extension) | P3 |


## 9. Fonctions « invisibles » (comportements implicites)

> Statut : lecture du code ; « À vérifier » = le code existe mais l'effet n'a pas été prouvé dans l'application.

| ID | Élément (nom FR exact) | Type | Raccourci | Statut | Preuve / remarque | Prio |
|---|---|---|---|---|---|---|
| X-01 | Saisie semi-automatique de texte (suggestion à partir de la colonne) | Option |  | Absent | APP/FIN : seule l'aide aux fonctions | P1 |
| X-02 | Saisie semi-automatique des noms de fonctions + info-bulle d'arguments | Option |  | À vérifier | FIN assist + L-formula-ui + fn-help | P1 |
| X-03 | Complétion des parenthèses et mise en évidence des paires | Option |  | À vérifier | L-formula-ui | P2 |
| X-04 | Remplissage instantané (Ctrl+E, suggestion grisée en cours de frappe) | Option |  | Partiel | L-fill flashFillGuess (un exemple, déclenché à la demande) ; pas de suggestion automatique | P1 |
| X-05 | Séries : nombres, dates, jours et mois français, « Trim 1 », texte numéroté, listes personnalisées | Option |  | À vérifier | L-fill extendSeries + FILL_LISTS (logique couverte par node --test) | P1 |
| X-06 | Tendance linéaire / géométrique par recopie avec 2+ cellules | Option |  | À vérifier | L-fill (logique couverte par node --test) | P2 |
| X-07 | Correction automatique (remplacer pendant la frappe, (c) -> ©, majuscule en début de phrase, liens URL) | Option |  | Absent | - | P2 |
| X-08 | Reconnaissance des saisies : dates FR, heures, pourcentages, fractions, nombres 1E3, texte entre ' | Option |  | À vérifier | L-cells parseEntry + FRM parseInput (logique couverte par node --test) | P1 |
| X-09 | Conversion automatique des formats (date saisie -> format date) | Option |  | À vérifier | L-cells commitEntry (logique couverte par node --test) | P1 |
| X-10 | Élargissement automatique de colonne après un format de nombre | Option |  | À vérifier | CMD widen | P2 |
| X-11 | Formats de nombre : Standard, séparateurs FR, codes personnalisés, couleurs [Rouge], conditions, %, dates, fractions, scientifique | Option |  | À vérifier | FRM formatValue (logique couverte par node --test) | P1 |
| X-12 | Styles de cellules et thèmes (couleurs de thème, teintes, jeux 6) | Option |  | Partiel | L-styles + RT themes : couleurs seulement | P2 |
| X-13 | Calcul automatique / manuel / itératif | Option |  | Partiel | APP calcManual ; itératif dans le moteur, sans réglage | P1 |
| X-14 | Références circulaires détectées et signalées | Option |  | À vérifier | FRM + APP (logique couverte par node --test) | P1 |
| X-15 | Débordement de tableaux dynamiques (#EPARS!, opérateur #) | Option |  | À vérifier | FRM ; rendu de la plage débordée dans la grille non prouvé (logique couverte par node --test) | P1 |
| X-16 | Fonctions volatiles et recalcul incrémental | Option |  | À vérifier | FRM (927 tests) (logique couverte par node --test) | P1 |
| X-17 | Noms de fonctions localisés FR (505 fonctions), séparateur `;` | Option |  | À vérifier | FRM STATUS (logique couverte par node --test) | P1 |
| X-18 | CELLULE / INFORMATIONS : styles, nom de fichier, largeur transmis par l'hôte (`EngineOptions.host`) | Option |  | Partiel | FRM prêt ; logic/engine.ts ne transmet pas `host` (aucune occurrence) | P2 |
| X-19 | LIREDONNEESTABCROISDYNAMIQUE (GETPIVOTDATA) : valeurs du TCD fournies par l'hôte | Option |  | Partiel | FRM prêt ; hôte non branché | P2 |
| X-20 | Références 3D : raccourcissement à la suppression d'une feuille de bord (`removeSheetInFormula` avec ordre des onglets) | Option |  | Partiel | logic/structure.ts l'appelle sans l'ordre des onglets | P3 |
| X-21 | Tableaux structurés (Tableau1[[#Cette ligne];[Col]]) : saisie, expansion automatique, colonnes calculées | Option |  | Partiel | L-tables + FRM ; expansion automatique en tapant sous le tableau et colonnes calculées non prouvées | P1 |
| X-22 | Tableaux de données (hypothèses) TABLE() | Option |  | Absent | - | P2 |
| X-23 | Consolidation de données | Option |  | Absent | - | P2 |
| X-24 | Analyse rapide (Ctrl+Q) | Option |  | Absent | - | P2 |
| X-25 | Idées / Analyser les données | Option |  | Absent | - | P3 |
| X-26 | Types de données (Actions, Géographie) et fonctions LIREDONNEES | Option |  | Absent | - | P3 |
| X-27 | Power Query / Power Pivot | Option |  | Absent | hors périmètre | P3 |
| X-28 | Macros VBA / scripts Office | Option |  | Absent | hors périmètre ; xlsm conservé à la lecture/écriture | P3 |
| X-29 | Co-édition, historique des versions, @mentions | Option |  | Absent | hors périmètre | P3 |
| X-30 | Copier-coller vers/depuis Excel (TSV + HTML riche) | Option |  | À vérifier | L-clipboard toTsv/toHtml/parseHtmlTable (logique couverte par node --test) | P1 |
| X-31 | Récupération après plantage (copie toutes les 30 s) | Option |  | À vérifier | APP + RecoveryDialog | P1 |
| X-32 | Annuler/rétablir (historique multi-niveaux, regroupement des actions) | Option |  | À vérifier | DocStore + core History | P1 |
| X-33 | Protection : cellules verrouillées empêchent la saisie, mot de passe 16 bits | Option |  | À vérifier | APP guard() | P1 |
| X-34 | Extension automatique des formats et formules aux nouvelles lignes d'une liste | Option |  | Absent | - | P2 |
| X-35 | Insertion de lignes/colonnes réécrit les formules, noms, MFC, validations, liens | Option |  | À vérifier | L-structure shiftStructure + FRM adjust (logique couverte par node --test) | P1 |
| X-36 | Ouverture/enregistrement xlsx, xlsm, xltx, xls (lecture), ods, csv, tsv | Option |  | À vérifier | xlsx STATUS | P1 |
| X-37 | Tableaux croisés dynamiques : écriture/lecture OOXML (cache, définition, dispositions) | Option |  | Partiel | packages/xlsx le fait (7 tests, preuve Excel 365) ; le Tableur garde ses TCD en mémoire (`pivots`, vidés par onReplaced) et n'en lit/écrit aucun | P1 |
| X-38 | Mise à jour des TCD à l'actualisation (Alt+F5) et à l'ouverture (refreshOnLoad) | Option |  | Partiel | ACT refreshPivots manuel | P1 |


## 10. Défauts suspects : options présentes dont l'effet est douteux ou faux
> Établis à la lecture du code (aucune exécution de l'interface : le banc navigateur n'a pas été lancé dans cet audit en lecture seule). Chaque ligne est une hypothèse à confirmer en regardant l'écran ; elles expliquent probablement une partie des « options qui ne fonctionnent pas » signalées par le propriétaire.

| # | Où | Constat dans le code | Effet probable | Prio |
|---|---|---|---|---|
| X-01 | `ui/dialogs/formula.tsx` FormatCellsDialog, onglet Alignement | les listes Horizontal/Vertical affichent les identifiants bruts (`general`, `left`, `centerContinuous`, `distributed`...) | libellés anglais illisibles, contraire à « tout en français » | P1 |
| X-02 | idem, bouton OK | `apply()` écrit toujours format de nombre, alignement, gras, italique, taille et protection à partir de l'état initial de la cellule active | sur une sélection hétérogène, écrase gras/italique/taille de toutes les cellules par ceux de la première | P1 |
| X-03 | idem | `S.fcTabs` déclare 6 onglets (Bordure, Remplissage) mais la boîte n'en affiche que 4 ; `S.fcShrink` jamais utilisé ; pas de nom de police, soulignement, couleur | « Format de cellule » donne l'impression d'options qui n'existent pas | P1 |
| X-04 | `ui/keys.ts` | F12 ouvre Format de cellule (Excel : Enregistrer sous) ; Ctrl+F4 enregistre (Excel : fermer la fenêtre) ; F4 hors édition ne répète rien ; Alt+0 = somme (n'existe pas dans Excel) | raccourcis qui font autre chose que dans Excel | P1 |
| X-05 | `ribbon/tabs.tsx` `keytip` | Insertion = 'N' (Excel FR : S), Données = 'D' (É), Affichage = 'A' (N) ; aucune commande n'a de sous-info-touche | Alt+S, Alt+É, Alt+N ne mènent pas aux bons onglets pour un utilisateur d'Excel | P2 |
| X-06 | `App.tsx` `insertComment` | saisie du commentaire par `window.prompt` | `prompt()` est absent ou inactif dans plusieurs webviews (WKWebView macOS/iOS, Android) : « Nouveau commentaire » peut ne rien faire hors Windows ; aucune bulle de saisie | P1 |
| X-07 | `ui/Grid.tsx`, `ui/paint.ts`, `logic/look.ts` | aucune référence à `hyperlinks` : le lien créé par Ctrl+K n'est ni souligné/bleu, ni cliquable (Ctrl+clic), ni listé dans un menu | le lien « existe » dans le fichier mais l'utilisateur ne le voit pas fonctionner | P1 |
| X-08 | `ribbon/home.tsx` ICON_SETS | les jeux d'icônes sont listés avec leur identifiant brut (`3TrafficLights1`, `5Quarters`...), 14 sur 20, sans aperçu des icônes | menu peu lisible | P2 |
| X-09 | `ribbon/home.tsx` règles du ruban | « Une date se produisant » fixe sur aujourd'hui ; « 10 valeurs les plus élevées » fixe à 10 sans boîte ; aucune boîte pour choisir le format (5 présélections) | les entrées de menu semblent identiques à Excel mais n'ouvrent pas la boîte de paramétrage | P1 |
| X-10 | `ribbon/tabs.tsx` Insertion | « Tableau » crée immédiatement le tableau sur la région courante (TableStyleMedium2) ; « Graphiques recommandés » insère un histogramme sans analyse ; « Filtrer » et « Commentaire » sont au mauvais onglet | comportements différents d'Excel | P2 |
| X-11 | `ribbon/home.tsx` Insérer/Supprimer cellules | actions directes (décaler vers le bas/la droite) sans la boîte de choix ; le bouton principal agit sans confirmer la direction | l'utilisateur ne choisit pas le décalage | P1 |
| X-12 | `ribbon/tabs.tsx` Mise en page | `RB.printTitles`, `RB.scaleFit`/largeur-hauteur : « Imprimer les titres » absent, « Largeur/Hauteur » remplacés par une case ; `S.sheetMenu.move`, `S.sheetMenu.selectAll`, `RB.formats.more`, `S.numCount`, `S.min`, `S.max` définis mais non branchés | textes morts révélant des fonctions promises non livrées | P2 |
| X-13 | `ui/Panes.tsx` PivotPane | éléments masqués du filtre saisis en texte « a;b;c » ; champs déplacés par liste déroulante | contrôle fragile, éloigné d'Excel ; non prouvé pour valeurs contenant `;` | P1 |
| X-14 | `App.tsx` / `ui/actions.ts` TCD | les TCD vivent dans l'état React (`pivots`) et sont vidés à chaque ouverture (`onReplaced`) ; seules les cellules résultat sont écrites | à la réouverture, un TCD n'est plus actualisable ni éditable alors que `@forgeoffice/xlsx` sait désormais écrire/relire `pivotCaches`/`pivotTables` (prouvé sous Excel 365) | P1 |
| X-15 | `logic/engine.ts` | `EngineOptions.host` (styles, nom de fichier, TCD) jamais transmis ; `removeSheetInFormula` appelé sans l'ordre des onglets | CELLULE("format"), INFORMATIONS, LIREDONNEESTABCROISDYNAMIQUE renvoient les valeurs par défaut ; références 3D mal raccourcies | P2 |
| X-16 | `ui/Drawings.tsx` / `keys.ts` | Suppr sur un objet appelle `chartDelete` pour image et forme ; poignées est/sud/sud-est seulement ; formes affichables mais non insérables ; images non faisables à la volée sans commande de formes | suppression d'image/forme non prouvée ; redimensionnement partiel | P2 |
| X-17 | `ui/dialogs/data.tsx` ValidationDialog | pas de « Ignorer si vide », de liste déroulante cochable, de titre de message, ni de style d'alerte, alors que le modèle et `commitEdit` gèrent `errorStyle` | l'utilisateur ne peut pas obtenir un avertissement non bloquant | P1 |
| X-18 | `ui/dialogs/data.tsx` CfManageDialog | seulement supprimer ; affichage de `r.type` brut (ex. `cellIs`) dans la colonne Règle | gestionnaire pauvre, libellés techniques | P1 |
| X-19 | `ui/clipboard-ui.ts` | « Copier » bloqué sur sélection multiple (comme Excel) mais message générique ; aucune bulle « Options de collage » ; le collage ne conserve pas la mise en forme source depuis une appli externe sauf TSV/HTML | résultats inattendus pour l'utilisateur | P2 |
| X-20 | `Drawings` + `Panes` | aucun `onContextMenu` sur objets, TCD, volets, barre de formule, barre d'état | le clic droit n'y fait rien (ou ouvre le menu du navigateur) | P1 |


## 11. AU-DELÀ D'OFFICE : 25 idées
> Ce qu'Excel ne fait pas (ou mal) et que ForgeOffice peut offrir parce qu'il est local, ouvert et écrit de A à Z. Toutes respectent « zéro service payant » et « tout en local ».

| # | Idée | Pourquoi / appui existant dans le dépôt |
|---|---|---|
| A-01 | Historique par cellule et voyage dans le temps (diff visuel entre deux états) | `DocStore` + `History` conservent déjà les états immuables (copie à l'écriture, `logic/draft.ts`) |
| A-02 | Explication d'une formule en français : décomposition arborescente avec valeur de chaque sous-expression | l'évaluation pas à pas (`DLF EvaluateDialog`) et `fn-help.ts` existent |
| A-03 | Carte interactive des dépendances de tout le classeur, feuilles orphelines, cycles | le graphe de dépendances du moteur (`deps.ts`) est déjà indexé |
| A-04 | Détection des formules incohérentes (R1C1 normalisé) avec correction en un clic | `translateFormula` du moteur |
| A-05 | Profileur de formules : temps de calcul par cellule/plage, goulots d'étranglement | recalcul incrémental mesuré dans les tests de performance |
| A-06 | Comparaison et fusion de deux classeurs (cellules, formules, formats, feuilles) | modèle `@forgeoffice/xlsx` immuable et comparable |
| A-07 | Tableaux liés à des CSV / JSON / SQLite locaux, actualisation sans Power Query | `crates/forge-base` (SQLite) et lecture CSV de `packages/xlsx` |
| A-08 | Fonction SQL() et volet « Requête SQL sur une plage » | SQLite embarqué dans le module Base de données |
| A-09 | Cellules Markdown / notes riches intercalées entre les lignes (cahier de calcul) | modèle de texte enrichi déjà dans xlsx |
| A-10 | Nettoyage guidé des données : types, doublons approchés, valeurs aberrantes, formats mixtes, en un clic | `removeDuplicates`, `textToColumns` à étendre |
| A-11 | Graphiques avancés sans complément : jauge, bullet, Gantt, carte thermique, Sankey ; export SVG vectoriel | `ChartView` est déjà du SVG |
| A-12 | Formats de nombre « humains » : relatif (il y a 3 jours), K/M/Md, Ko/Mo/Go | `formatValue` du moteur, nouveaux codes |
| A-13 | Vues alternatives d'un tableau : Kanban, Calendrier, Galerie, Fiche (sans quitter la feuille) | `logic/tables.ts` + `Panes` |
| A-14 | Formulaire de saisie généré depuis un tableau (validation incluse) | `logic/validation.ts` |
| A-15 | Chiffrement AES-GCM du classeur avec trousseau local (au lieu du hachage 16 bits d'Excel) | Web Crypto + Tauri |
| A-16 | Automatisations visuelles et scripts JS/TS dans un Worker isolé (à l'ouverture, à la modification d'une plage), journal d'exécution | remplace VBA, sans exécution de code du fichier |
| A-17 | Bibliothèques de LAMBDA nommées partageables (import/export de packs documentés) | LAMBDA nommées gérées par le moteur |
| A-18 | Palette de commandes universelle (Ctrl+Maj+P) : commandes, fonctions, noms, feuilles, cellules | `CommandSearch` de `packages/ui` à élargir |
| A-19 | Co-édition pair-à-pair sur le réseau local (CRDT), sans cloud, avec curseurs | modèle immuable adapté au CRDT |
| A-20 | Feuille « Tableau de bord » : widgets KPI, graphiques, segments sur une grille de mise en page | `Drawings` + futurs segments |
| A-21 | Import de tableaux depuis PDF / image (OCR local) vers des cellules | module PDF de la suite |
| A-22 | Infobulle au survol d'une référence : valeur, formule, précédents ; « où est utilisé ce nom ? » | `FormulaInput` colore déjà les références |
| A-23 | Schéma de données typé (types, contraintes, relations) qui génère validations et formats | `validation.ts` + noms |
| A-24 | Export « rapport » en un clic : PDF/HTML paginé avec sommaire, ou site statique interactif (filtres, tri) | `print.tsx` pagine déjà |
| A-25 | Ouverture instantanée des gros classeurs (cache binaire, sauvegarde incrémentale) et mode économie d'énergie | grille virtualisée 1 048 576 x 16 384 |
