# packages/excel : Tableur — état (2026-11-04)

Application « Tableur » (équivalent Excel 2024) de ForgeOffice. Exporte `{ info: MODULES.excel, App }`.
Bâtie sur `@forgeoffice/xlsx` (modèle + formats), `@forgeoffice/formulas` (moteur, 489 fonctions, noms français),
`@forgeoffice/ui` (barre de titre, ruban, Backstage, barre d'état, dialogues) et `History` de `@forgeoffice/core`.

## Architecture

| Couche | Fichiers |
|---|---|
| Logique sans DOM (testée) | `src/logic/` : `draft.ts` (copie à l'écriture, annuler/rétablir), `engine.ts` (liaison classeur ↔ FormulaEngine par différence d'identité), `geometry.ts` + `viewport.ts` (grille virtualisée 1 048 576 × 16 384, volets figés, zoom), `selection.ts`, `cells.ts` (saisie FR), `fill.ts` (recopie), `clipboard.ts`, `data.ts` (tri, filtre, doublons, convertir, sous-totaux), `pivot.ts`, `condfmt.ts`, `styles.ts`, `tables.ts`, `charts.ts`, `structure.ts` (insertion/suppression, feuilles), `validation.ts`, `formula-ui.ts` + `fn-help.ts`, `look.ts` |
| Interface | `src/App.tsx`, `src/ui/` (Grid canvas + `paint.ts`, FormulaInput/FormulaBar, SheetTabs, Drawings + ChartView SVG, Panes, dialogues, Backstage, impression, presse-papiers, clavier), `src/ribbon/` (onglets) |
| Textes | `src/strings.ts` (`S` et `RB`) |

## Fait et prouvé

- Grille canvas virtualisée (défilement fluide molette/barres, 1 048 576 lignes × 16 384 colonnes), en-têtes, quadrillage,
  sélection simple / plages / discontinue (Ctrl), lignes et colonnes entières, Ctrl+flèches, Entrée/Tab dans la sélection,
  retour à la colonne de départ après Tab+Entrée, poignée de recopie (séries 1,2,3, dates, jours et mois français, « Trim 1 »,
  texte numéroté, formules translatées), redimensionnement et ajustement automatique (double-clic), masquage, volets figés, zoom (Ctrl+molette).
- Saisie et affichage des formules en français (SOMME, MOYENNE, RECHERCHEV, séparateur `;`), correction des parenthèses,
  références colorées dans la cellule, la barre de formule et sur la grille, mode Pointer (clic/flèches insèrent des
  références, autre feuille comprise), F4 ($A$1 → A$1 → $A1 → A1), saisie semi-automatique des fonctions (Tab) avec
  description, info-bulle des arguments avec l'argument courant en gras.
- Feuilles : onglets (ajout, renommage en place, couleur, déplacer par glisser, dupliquer, masquer/afficher, supprimer),
  formules réécrites au renommage/suppression, références 3D.
- Ruban complet : Accueil, Insertion, Mise en page, Formules, Données, Révision, Affichage + onglets contextuels
  Création de tableau, Création de graphique, Analyse du tableau croisé dynamique. Backstage : Accueil, Nouveau, Ouvrir,
  Informations, Enregistrer, Enregistrer sous (xlsx, xlsm, xltx, ods, csv, tsv), Imprimer (aperçu paginé, orientation,
  papier, ajustement, quadrillage), Exporter, Fermer, Compte, Options (calcul auto/manuel).
- Mise en forme : police, taille, gras/italique/souligné/barré, 14 bordures, couleurs, alignements, orientation, retrait,
  renvoi à la ligne, fusion (4 modes), formats de nombre (liste, comptabilité €/$/£/CHF, %, décimales ±), styles de cellules
  (galerie Excel), mettre sous forme de tableau (60 styles Clair/Moyen/Foncé), mise en forme conditionnelle
  (valeur, texte, date, doublons, 10 premiers, moyenne, formule, barres de données, nuances, 14 jeux d'icônes, gestionnaire).
- Données : tri rapide et personnalisé multi-niveaux, filtre automatique (valeurs, recherche, filtres numériques/textuels,
  10 premiers, moyenne), supprimer les doublons, convertir, remplissage instantané, validation (liste déroulante dans la
  cellule, nombres, dates, longueur, personnalisée, message de saisie, refus), grouper/plan, sous-totaux, import CSV.
- Insertion : tableaux croisés dynamiques (lignes imbriquées, colonnes, plusieurs valeurs, somme/nombre/moyenne/max/min/
  produit/écart type/variance, % du total / de la ligne / de la colonne, filtres de rapport, sous-totaux, tri décroissant,
  totaux généraux, volet de champs, actualisation) ; graphiques SVG (histogramme groupé/empilé, barres, courbes, marqueurs,
  secteurs, anneau, aires, nuages, combiné) modifiables (type, intervertir, légende, étiquettes, quadrillage, couleurs,
  déplacer/redimensionner, supprimer) ; images ; liens (http/https/mailto, `javascript:` refusé) ; sparklines ; symboles.
- Formules : bibliothèque par catégories (toutes les fonctions du moteur), assistant Insérer une fonction avec résultat
  en direct, gestionnaire de noms, antécédents/dépendants (flèches), évaluation pas à pas, afficher les formules, calcul
  manuel + F9. Révision : commentaires (fil, réponses, résolu, volet), notes (indicateur rouge, info-bulle), protection
  feuille/classeur (empreinte Excel 16 bits). Affichage : Normal / Mise en page / Aperçu des sauts de page, quadrillage,
  en-têtes, barre de formule, zoom, zoom sur la sélection, nouvelle fenêtre, figer les volets.
- Barre d'état : mode (Prêt/Entrer/Modifier/Pointer), moyenne, nombre, somme de la sélection, références circulaires, vues, zoom.
- Fichiers : ouverture via `props.file` (xlsx, xlsm, xltx, xls, ods, csv, tsv), `services.saveFile`, Ctrl+S, `setModified`,
  `addRecent`, annuler/rétablir (Ctrl+Z/Y, `History`), presse-papiers compatible Excel (TSV + HTML en sortie, TSV/CSV/HTML en
  entrée, collage interne avec formules translatées, collage spécial : valeurs, formats, transposé, opérations, blancs),
  récupération après plantage (copie toutes les 30 s, proposée au démarrage, effacée à la fermeture normale ou à l'enregistrement).

### Preuves

- `node --test packages/excel/tests/*.test.ts` : 18 tests, 18 réussis (sélection, géométrie, saisie FR + moteur, renommage,
  insertion de lignes, recopie, presse-papiers TSV/HTML, tri/filtre/doublons, tableaux croisés, MFC, graphiques, validation,
  styles, fenêtre, aller-retour xlsx, export complet).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur.
- Classeur produit par le module (`tests/export.test.ts`, `XL_EXPORT=<chemin>`) ouvert dans Excel 365 par COM (masqué,
  `Quit()` dans un `finally`, aucun processus restant) : formules (=SOMME(D3:D5) = 14 500), format 35,8 %, fusion, tableau
  « Tableau1 », graphique, mise en forme conditionnelle, validation « Oui;Non », volets figés.
- Rendu regardé dans le banc (port 5312, Edge sans interface en CDP) : `docs/captures/tableur-formules.png`,
  `tableur-graphique.png`, `tableur-mfc.png`, `tableur-tcd.png`, `tableur-impression.png`.

## Reste à faire

- Définitions des tableaux croisés non enregistrées dans le fichier (les cellules résultat le sont) : à relier à un futur
  modèle pivotCache de `@forgeoffice/xlsx`.
- Vue Mise en page : affiche les sauts de page, pas encore les pages séparées avec en-têtes/pieds éditables.
- Graphiques : pas d'éditeur de séries ni de titres d'axes ; radar et bulles rendus en nuage.
- Mode Pointer : pas de bordure animée sur la plage pointée ; formats de date conditionnels partiels (aujourd'hui, hier, demain, 7 derniers jours).
- Recopie : pas de menu « Options de recopie incrémentée » après le glisser ; Ctrl+glisser = copie.
- Grouper/plan : niveaux et masquage OK, pas de boutons +/− dessinés dans la marge.
