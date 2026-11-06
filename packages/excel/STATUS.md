# packages/excel : Tableur — état (2026-11-05)

Application « Tableur » (équivalent Excel 2024) de ForgeOffice. Exporte `{ info: MODULES.excel, App }`.
Bâtie sur `@forgeoffice/xlsx` (modèle + formats), `@forgeoffice/formulas` (moteur, 489 fonctions, noms français),
`@forgeoffice/ui` (barre de titre, ruban, Backstage, barre d'état, dialogues) et `History` de `@forgeoffice/core`.

## Architecture

| Couche | Fichiers |
|---|---|
| Logique sans DOM (testée) | `src/logic/` : `draft.ts` (copie à l'écriture, annuler/rétablir), `engine.ts` (liaison classeur ↔ FormulaEngine par différence d'identité), `geometry.ts` + `viewport.ts` (grille virtualisée 1 048 576 × 16 384, volets figés, zoom), `selection.ts`, `cells.ts` (saisie FR), `fill.ts` (recopie), `clipboard.ts`, `data.ts` (tri, filtre, doublons, convertir, sous-totaux), `pivot.ts`, `condfmt.ts`, `styles.ts`, `tables.ts`, `charts.ts`, `structure.ts` (insertion/suppression, feuilles), `validation.ts`, `formula-ui.ts` + `fn-help.ts`, `look.ts` |
| Interface | `src/App.tsx`, `src/ui/` (Grid canvas + `paint.ts`, FormulaInput/FormulaBar, SheetTabs, Drawings + ChartView SVG, Panes, dialogues, Backstage, impression, presse-papiers), hôtes `Hosts.tsx` / `StatusBarHost.tsx` / `GridOverlay.tsx`, `src/ribbon/` (onglets) |
| Registres (socle d'extension) | `ui/registry.ts` (dialogues, menus contextuels, raccourcis), `ui/register.ts` (point de chargement), `ui/keys-{nav,format,edit,entry}.ts`, `ui/menus-{grid,sheettab}`, `ui/dialogs/register.tsx`, `ui/services.tsx` |
| Textes | `src/strings/index.ts` réexporte `S` et `RB`, un fichier par domaine (`grid`, `status`, `messages`, `data`, `pivot`, `dialogs`, `print`, `chart`, `rb-*`) |

## Registres d'extension (comment un lot s'y enregistre)

Un lot ajoute son propre fichier puis UNE ligne d'import dans `ui/register.ts` ; `App.tsx` n'est pas touché.
- **Dialogue** : étendre `DialogMap` (fusion de déclaration `declare module '../registry.ts'`) puis `registerDialog({ id, title, render: (d, x, host) => <MaBoite x={x} /> })` ; ouvrir par `ctx.open({ kind: id, ...props })`, `openDialog(open, id, props)` ou `useExcelServices().openDialog(id, props)`. `x` = `DialogEnv` (store, cmd, sélection, close), `host` = zoom, création de TCD, insertion de formule, `setUi`.
- **Menu contextuel** : `registerMenu({ id, context: 'cell' | 'row' | 'col' | 'corner' | 'sheetTab' | 'chart' | 'object' | 'pivot' | 'formulaBar' | 'statusBar' | 'fillHandle', order, items: (env, target) => MenuItem[] })`. Les segments sont triés par `order` (100 presse-papiers, 200-400 corps, 900 format) et séparés par un trait automatique. Brancher la zone : `useExcelServices().openMenu(e, contexte, cible)` (grille : déjà fait ; `sheetTab` : `buildMenu` dans SheetTabs).
- **Raccourci** : `registerShortcuts([{ id, context: 'grid' | 'entry', combo: 'Ctrl+Shift+L', priority, when, run }])`. Un modificateur non écrit doit être relâché, `~Shift` = indifférent ; `run` renvoie `false` pour laisser la définition suivante essayer ; priorité haute d'abord, puis ordre d'enregistrement. Contexte `grid` = hors saisie, `entry` = saisie en cours.
- Tests : `tests/registry.test.ts` (priorités, ouverture par id, menus par contexte), `tests/host.test.ts`.

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

- `node --test packages/excel/tests/*.test.ts` : 38 tests, 38 réussis (dont registres et hôte du moteur) (sélection, géométrie, saisie FR + moteur, renommage,
  insertion de lignes, recopie, presse-papiers TSV/HTML, tri/filtre/doublons, tableaux croisés, MFC, graphiques, validation,
  styles, fenêtre, aller-retour xlsx, export complet).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur.
- Classeur produit par le module (`tests/export.test.ts`, `XL_EXPORT=<chemin>`) ouvert dans Excel 365 par COM (masqué,
  `Quit()` dans un `finally`, aucun processus restant) : formules (=SOMME(D3:D5) = 14 500), format 35,8 %, fusion, tableau
  « Tableau1 », graphique, mise en forme conditionnelle, validation « Oui;Non », volets figés.
- Rendu regardé dans le banc (port 5312, Edge sans interface en CDP) : `docs/captures/tableur-formules.png`,
  `tableur-graphique.png`, `tableur-mfc.png`, `tableur-tcd.png`, `tableur-impression.png`.

## Lot 0 (2026-11-05) : socle d'extension

- `strings.ts` (442 lignes) découpé en `strings/*.ts` (API `S` / `RB` inchangée, contenu identique vérifié clé par clé).
- `App.tsx` 762 -> 612 lignes : hôtes extraits (`DialogHost` par registre, `StatusBarHost`, `GridOverlay`), `keys.ts` éclaté en 4 fichiers de raccourcis déclaratifs.
- Corrigés : X-04 (F12 = Enregistrer sous, Ctrl+F4 = fermer le classeur ; F4 seul et F3 seul restent sans effet, Alt+0 = somme conservé : lot Raccourcis), X-06 (Nouveau commentaire = boîte `newComment`, plus de `window.prompt`), X-15 (`EngineOptions.host` : `CELLULE` format/protégé/alignement/largeur/nomfichier, `INFORMATIONS` répertoire/système, `LIREDONNEESTABCROISDYNAMIQUE` ; `removeSheetInFormula` reçoit l'ordre des onglets).
- Mini-barre de `@forgeoffice/ui` branchée : clic droit sur cellule/ligne/colonne (réglage `excel.minibar`, vrai par défaut ; pas encore d'option dans l'interface : lot Options).
- Limites : `LIREDONNEESTABCROISDYNAMIQUE` lit le dernier calcul du TCD (les TCD vivent encore dans l'état React, X-14) ; `INFORMATIONS("osversion")` renvoie `Windows (64-bit) NT 10.00`, `Macintosh (64-bit)`, `Android (64-bit)` ou `Linux (64-bit)` d'après l'agent utilisateur, sans numéro de version fin hors Windows.
- Restent des `window.prompt` / `window.confirm` dans `ui/useSheetOps.ts` (renommer, supprimer une feuille) : à passer par le registre de dialogues (lot Cellules/feuilles).

### Textes morts (X-12) : définis dans `strings/`, jamais utilisés (à brancher par le lot propriétaire ou à supprimer)

- `S` : `sheetDefault`, `selectAll`, `sheetMenu.move` (Déplacer ou copier : lot Cellules/feuilles), `sheetMenu.selectAll`, `min`, `max`, `numCount` (statistiques de la barre d'état : lot Options), `accessibility`, `copied`, `calcManual`, `apply`, `pivot.refresh`, `pivot.empty`, `newName`, `fnRecent`, `cfTop`, `cfBottom`, `cfFormula`, `comment`, `fcCategory`, `fcDecimals`, `fcShrink` (Réduire : lot Format de cellule), `chart.series/legend/dataLabels/axisTitles/gridlines/switch/changeType/styles/colors/delete/editTitle` (lot Graphiques).
- `RB` : `g.text`, `g.proofing`, `underlineDouble`, `strike`, `newTableStyle`, `printTitles` (Imprimer les titres : lot Mise en page), `recentFns`, `grandTotals`, `subtotals` (lot TCD). `RB.formats.more` (« Autres formats numériques... ») n'existe pas encore.

## Lot E (2026-11-05) : raccourcis clavier Excel FR (EXCEL.md §5)

- Fichiers : `ui/keys-{nav,format,edit,entry,select,repeat,zones,host,dialogs}`, `logic/{keys-logic,find-next}.ts`, `ribbon/keytips.ts`, `strings/keys.ts` ; touches AZERTY (symboles sans Maj, AltGr = Ctrl+Alt, touche physique `Digit9`) gérées ; `dispatchKeyId` renvoie le raccourci qui a traité la touche.
- Cochés §5 (test node par touche `tests/keys.test.ts` + vraies touches CDP `apps/web/tests/e2e/excel-keys.mjs` et `excel-keys-b.mjs`, résultat relu dans le classeur enregistré) : [x] 5.1-01 à 27 sauf 13 (Alt+Page : fait) / 28 ; [x] 5.2-01 à 32 sauf 24, 33 à 37 ; [x] 5.2-24 Ctrl+Maj+A, 38, 39 ; [x] 5.3-01 à 32 ; [x] 5.4-01 à 07, 09 à 14, 16 à 19 (F6 : grille, onglets, ruban).
- Corrigés : X-04 (Alt+0 retiré, F4 = répéter, Ctrl+Y = rétablir sinon répéter, F3 = Coller un nom), Ctrl+Maj+Début étendait mal, Ctrl+L attrapait Ctrl+Alt+L, Ctrl+Maj+Page changeait de feuille, Ctrl+T attrapait Ctrl+Maj+T. X-05 : Insertion S, Données É, Affichage N, Alt,S,V et Alt,N,N (`ribbon/keytips.ts`, posé par `applyKeytips` dans App).
- Nouveau : Ctrl+9/0 et Ctrl+Maj+( ), Ctrl+Maj+~ ! # @ $ % ^ & _ > <, Ctrl+Maj+Entrée (matricielle, `cell.array`), Alt+Bas (filtre, liste de validation, ou valeurs de la colonne), Maj+F10 / touche Menu, F8 / Maj+F8 (barre d'état), Ctrl+. / Maj+Retour / Ctrl+Retour, Maj+F4 (dernière recherche : `setLastFind` dans la boîte Rechercher), Ctrl+Maj+F3 et F3 (boîtes `keysNamesFromSelection` / `keysPasteName`), Ctrl+Maj+T, Alt+Maj+Droite/Gauche, F11 (feuille « Graph1 »), Alt+F1, Ctrl+Maj+U, Ctrl+A / Ctrl+Maj+A en saisie.
- Restent : 5.1-28 Ctrl+Alt+flèche, 5.2-33/34 F7 (message tant que le lot Révision n'enregistre pas la boîte `spelling`), 5.2-35 macros, 5.2-36 F1 (pas d'aide), 5.2-37 Ctrl+Q (pas d'Analyse rapide), 5.3-34, 5.4-08 Ctrl+F6, 5.4-15 ; info-touches de commandes (seulement V et N, UIA n'en donne pas d'autre : lanceur Alt,L,4 non supporté par le ruban commun) ; F8 ne gère pas encore la souris ; Ctrl++ / Ctrl+- ouvrent la boîte `insertCells` / `deleteCells` si le lot Cellules l'enregistre (sinon décalage bas/haut).
- Raccourcis non exacts : Maj+F9 / Ctrl+Alt+F9 (lot Formules les a branchés sur `recalc('sheet'|'all')`), Ctrl+Maj+Page ne groupe pas les feuilles.
- Tests : 38 avant le lot 0, 121 après (tous lots du moment) dont 19 dans `keys.test.ts` ; bancs 40/40 et 15/15 vérifications ; captures `docs/captures/tableur-raccourci-*.png`, `tableur-infotouches-*.png`.

## Lot I (2026-11-05) : mise en page et impression

- Boite Mise en page (`ui/page-setup/`, dialogue `pageSetup`, lanceur du groupe + Imprimer les titres + Autres tailles/Marges personnalisées) : Page (orientation, 20 papiers, échelle ou ajuster N x M, qualité, 1re page), Marges (cm, centrage), En-tête/Pied (listes, éditeur 3 zones, `&[Page]`... <-> `&P`, 1re page / paires-impaires / échelle / marges), Feuille (zones multiples, titres, quadrillage, N&B, brouillon, en-têtes, commentaires, erreurs, ordre) ; aperçu en direct.
- Moteur sans DOM `logic/pagebreaks.ts` + `logic/pagesetup.ts` : zones multiples, titres répétés, Largeur/Hauteur (0 = auto, jamais d'agrandissement, sauts manuels ignorés en mode Ajuster), ordre, numéro de 1re page, page des commentaires, traits de l'aperçu par zone.
- Impression réelle (feuille active, classeur entier, sélection) : `PrintRoot` impose `@page` nommé par feuille (papier + orientation) ; PDF navigateur = 2 pages A3 paysage vérifié. Aperçu Backstage fidèle (en-tête/pied, titres, quadrillage, en-têtes, N&B, erreurs, notes affichées). Aperçu des sauts : hors zone grisé, cadre, sauts auto (tirets) / manuels (pleins), « Page n ». Affichage Mise en page : pages réelles + règle, en-tête/pied cliquables, double-clic cellule = mode Normal.
- xlsx : ajout `PageSetup.dpi` (horizontalDpi/verticalDpi) ; `packages/xlsx/tests/page-setup.test.ts` (tous les champs, N x M, ordre XML). Fichier produit ouvert dans Excel 365 par COM (masqué, Quit) : orientation, papier, marges, en-têtes, titres, zone, 1re page, N&B, commentaires, erreurs, ordre lus identiques ; PDF Excel = 3 pages A3 = notre pagination.
- Tests : `node --test packages/excel/tests/pagesetup.test.ts` (16), banc `apps/web/tests/e2e/page-setup.mjs` + `page-setup-views.mjs` (38 contrôles, modèle relu), captures `docs/captures/tableur-*` (boite, aperçu, sauts, mise en page, mobile).
- Reste : glisser les sauts de page à la souris, Arrière-plan, copies (boîte du système), aperçu Backstage de la seule feuille active, graphiques et images non imprimés, édition directe des cellules dans la vue Mise en page (double-clic ouvre le mode Normal), `RB.scaleFit` mort (remplacé par Largeur/Hauteur).

## Lot A (2026-11-05) : Format de cellule complet

- Boite `ui/dialogs/format-cells/` (6 onglets Nombre, Alignement, Police, Bordure, Remplissage, Protection ; `FormatTabs` réutilisable par le lot MFC) : catégories d'Excel avec options (décimales, milliers, négatifs, symbole, types date/heure/fraction/spécial, code personnalisé), alignements en français, orientation (cadran, degrés, texte vertical), police/style/taille/soulignement/couleur/effets, bordures (13 styles, couleur, 8 bords, aperçu cliquable), remplissage (couleur, 18 motifs, dégradé 6 styles x 4 variantes), protection. Ruban : « Autres formats numériques… », « Autres bordures… », « Autres formats comptabilité… ».
- X-01/X-02/X-03 : seuls les champs modifiés sont appliqués (`logic/format-edits.ts`), les champs qui diffèrent d'une cellule à l'autre sont signalés ; OK sans changement ne crée aucun style. Logique sans DOM : `format-edits`, `border-spec` (bords voisins alignés), `numfmt-ui` (analyse inverse), `fill-spec`, `rowfit` (lignes agrandies après renvoi/rotation/police).
- Rendu de la grille (`ui/paint.ts`, `paint-fill.ts`, `logic/look.ts`) : motifs, dégradés, diagonales, exposant/indice, Ajuster, soulignements double/comptabilité, centré sur plusieurs colonnes, distribué/justifié, texte vertical, droite à gauche.
- Entrées P1 couvertes : R1.2-11, R1.2-14, R1.4-02, D4.1-01/02/03/05/06/13/14/15/16/18/19 ; P2/P3 : D4.1-04/07/08/09/10/11/12/17/20/21/22, R1.4-03.
- Tests : `format-cells.test.ts` (8) + `format-render.test.ts` (5), banc `apps/web/tests/e2e/format-cells.mjs` (29 contrôles, classeur enregistré relu) + `format-cells-mobile.mjs` (390 px), captures `docs/captures/tableur-format-cellule-*.png`.
- Reste : supprimer un format personnalisé, paramètres régionaux des dates, `Ctrl+Maj+F` (lot Raccourcis), hauteur de ligne dynamique (le lot l'applique à la validation de la boîte seulement ; une ligne à hauteur imposée n'est jamais touchée), `paint.ts` proche de 800 lignes (extraire `paintTexts` si d'autres lots y ajoutent).

## Lot M (2026-11-05) : formules et noms

- Moteur (`packages/formulas`) : `setCalcSettings` (auto, auto sauf tables = auto faute de TABLE(), **manuel réel** : seules les cellules saisies se calculent, les dépendants restent « en attente » jusqu'à F9), `calculateSheet` (Maj+F9), `pendingCalculation` (indicateur « Calculer »), itératif réglable à chaud, `precedentsOf` / `dependentsOf` (graphe réel, toutes feuilles). `functions/libreoffice.ts` : EASTERSUNDAY (DIMANCHE.PAQUES), DAYSINMONTH/DAYSINYEAR/ISLEAPYEAR/WEEKSINYEAR/MONTHS/WEEKS/YEARS, CONVERT_ADD/GCD_ADD/LCM_ADD/WEEKNUM_ADD/ISOWEEKNUM_ADD, SINGLE, FOURIER (DFT non normalisée, inverse / n). Noms français hors DIMANCHE.PAQUES non vérifiés (noms anglais acceptés). IMPORTRANGE refusé ; MULTIPLE.OPERATIONS et TABLE() non faits (lot J).
- Calcul : mode et itératif dans `Workbook.calc` (enregistrés, calcPr ; Backstage > Options passe par `setUi({calcManual})` qui écrit `wb.calc`) ; ruban Formules > Options de calcul (3 modes + Options de calcul itératif…), Calculer maintenant (F9), Calculer la feuille (Maj+F9), Ctrl+Alt+F9 = recalcul complet. Limite : un changement de noms ou de tableaux reconstruit le moteur, qui recalcule tout même en manuel.
- Noms (`ui/formulas/NamesDialogs.tsx`) : gestionnaire (colonnes Commentaire, filtres, noms de tableau, modification du « Fait référence à »), Nouveau nom / Modifier (étendue, commentaire, sélecteur de plage, règles de nom d'Excel, renommage réécrit les formules), Récemment utilisées (réglage `excel.recentFunctions`), Créer à partir de la sélection = boîte du lot E.
- Insérer une fonction (`FnWizard.tsx`) : recherche par nom puis description, catégories dont Récemment utilisées, arguments avec valeur de chacun, sélecteur de plage (barre flottante), résultat en direct, Somme automatique > Autres fonctions.
- Vérification : évaluation pas à pas (soulignée, SI paresseux, pas à pas détaillé / sortant), repérage multi-niveaux par cellule + flèches pointillées vers une autre feuille + suppression par niveau, Vérification des erreurs (triangle vert ; 7 règles dont colonne calculée incohérente, correctifs, ignorer, options persistantes), Fenêtre Espion (`WatchHost.tsx`, session).
- Saisie : liste de saisie semi-automatique étendue aux noms, tableaux, colonnes et #Données… ; tableaux structurés : extension automatique, colonnes calculées (`logic/formulas/table-auto.ts`).
- Tests : `node --test packages/excel/tests/*.test.ts` 38 (lot 0) -> 125 (tous lots du moment) dont 40 dans `formulas-*.test.ts` ; `packages/formulas` 927 -> 981 (`libreoffice`, `calc-mode`). Bancs réels (clics et touches CDP, résultat relu dans la barre d'état et le classeur) `apps/web/tests/e2e/excel-formulas.mjs` 67/67 et `excel-formulas-mobile.mjs` 6/6 (400 px). Captures `docs/captures/tableur-formules-*.png`.
- Reste : X-37 (TCD persistants = lot H), Aide sur cette fonction (D4.5-04), TABLE() / MULTIPLE.OPERATIONS, consolidation (lot J), Espion non enregistré dans le fichier, bouton d'erreur à côté de la cellule (menu contextuel d'erreur), triangle vert absent des cellules non peintes en vue Mise en page.

## Reste à faire

- Définitions des tableaux croisés non enregistrées dans le fichier (les cellules résultat le sont) : à relier à un futur
  modèle pivotCache de `@forgeoffice/xlsx`.
- Vue Mise en page : affiche les sauts de page, pas encore les pages séparées avec en-têtes/pieds éditables.
- Graphiques : pas d'éditeur de séries ni de titres d'axes ; radar et bulles rendus en nuage.
- Mode Pointer : pas de bordure animée sur la plage pointée ; formats de date conditionnels partiels (aujourd'hui, hier, demain, 7 derniers jours).
- Recopie : pas de menu « Options de recopie incrémentée » après le glisser ; Ctrl+glisser = copie.
- Grouper/plan : niveaux et masquage OK, pas de boutons +/− dessinés dans la marge.
