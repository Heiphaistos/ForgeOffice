# Plan d'implémentation : parité Tableur / Excel 365

Dérivé de `docs/parite/EXCEL.md` (907 entrées : 421 Absent, 161 Partiel, 325 À vérifier). Un **lot** = un dossier ou un ensemble de fichiers qu'une seule personne/un seul agent modifie : deux lots de la même vague ne touchent jamais le même fichier, ce qui permet de les lancer en parallèle. Efforts : **S** < 1 jour, **M** 1 à 3 jours, **L** 3 à 8 jours (un agent, vérification visuelle comprise). Respecter `CONVENTIONS.md` : 800 lignes visées, 1 000 maximum, tout texte dans `strings/`, TypeScript strict sans `any`, tests `node --test`, vérification visuelle sur le banc avec captures dans `docs/captures/`.

## Règles de conduite

1. **Lot 0 d'abord**, seul : sans lui, tous les lots écrivent dans `strings.ts` (442 lignes), `App.tsx` (762 lignes, sous la limite de 800 à 38 lignes près) et `keys.ts`, donc se marchent dessus.
2. **P1 d'abord** : dans chaque lot, traiter les entrées P1 (colonne « P1 à combler ») avant les P2 puis P3. Les P3 hors périmètre assumé (Power Query, macros VBA, co-édition, modèles 3D, entrée manuscrite) ne sont pas planifiés.
3. **« À vérifier » n'est pas « fait »** : le lot P prouve ces lignes en parallèle ; un défaut trouvé est corrigé dans le lot propriétaire de la fonction.
4. **Existant conservé** : on ajoute des choix (anciennes dispositions et esthétiques gardées), on ne remplace pas ; thème d'origine par défaut.
5. Fermer proprement (aucun processus restant), français partout, ne rien publier.

## Vagues

| Vague | Lots lancés en parallèle | Condition |
|---|---|---|
| 0 | 0 (seul) | aucune |
| 1 | A, E, C, K, I, L, M + P (démarrage) | lot 0 fusionné |
| 2a | N, B, D, J, F | A et C fusionnés pour B |
| 2b | G, H | B et F fusionnés |
| 3 | O, Z, fin de P | tous les lots précédents |

## Lots

| Lot | Titre | Effort | Vague | Dépend de | Entrées | Absent | Partiel | À vérifier | P1 à combler | P1 à vérifier | P2 | P3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Socle d'extension (prérequis bloquant) | M | 0 | - | - | - | - | - | - | - | - | - |
| A | Format de cellule complet | L | 1 | 0 | 33 | 13 | 9 | 11 | 14 | 9 | 7 | 1 |
| E | Raccourcis clavier | M | 1 | 0 | 121 | 51 | 5 | 65 | 8 | 53 | 28 | 20 |
| C | Cellules, feuilles, recherche | M | 1 | 0 | 26 | 11 | 2 | 13 | 4 | 11 | 5 | 4 |
| K | Mise en forme conditionnelle complète | L | 1 | 0, A (onglet Format) | 20 | 9 | 11 | 0 | 13 | 0 | 6 | 1 |
| I | Mise en page et impression | L | 1 | 0 | 24 | 11 | 5 | 8 | 10 | 8 | 4 | 2 |
| L | Révision, commentaires, protection | M | 1 | 0 | 24 | 14 | 5 | 5 | 4 | 3 | 7 | 8 |
| M | Formules et noms | L | 1 | 0 | 48 | 13 | 15 | 20 | 6 | 18 | 16 | 6 |
| N | Options, Backstage, barre d'état, coque | L | 2a | 0 | 133 | 49 | 27 | 57 | 7 | 42 | 26 | 43 |
| B | Menus contextuels et mini-barre | L | 2a | 0, A, C | 89 | 52 | 14 | 23 | 33 | 23 | 21 | 12 |
| D | Interactions de la grille | L | 2a | 0 | 41 | 14 | 7 | 20 | 6 | 14 | 8 | 7 |
| J | Données | L | 2a | 0 | 67 | 36 | 14 | 17 | 10 | 14 | 25 | 15 |
| G | Graphiques | L | 2b | 0, B (menus), F (poignées/objets) | 54 | 39 | 10 | 5 | 24 | 3 | 15 | 10 |
| H | Tableaux croisés dynamiques | L | 2b | 0, B, G, F (segments) | 47 | 33 | 12 | 2 | 18 | 2 | 16 | 11 |
| F | Formes, images, objets | L | 2a | 0 | 51 | 50 | 1 | 0 | 11 | 0 | 18 | 22 |
| O | Compléments du ruban | M | 3 | tous les lots A à N (pour éviter les conflits de fusion) | 129 | 26 | 24 | 79 | 19 | 62 | 13 | 18 |
| P | Campagne de preuve « À vérifier » (transversal) | L | 1 à 3 | 0 | - | - | - | - | - | - | - | - |
| Z | Au-delà d'Office | L | 3+ | lots précédents | - | - | - | - | - | - | - | - |

(« P1 à combler » = entrées P1 Absent ou Partiel ; « P2 » et « P3 » = Absent ou Partiel de cette priorité. L'attribution des entrées aux lots est calculée par `section` ; les identifiants P1 sont listés sous chaque lot.)

### Lot 0 : Socle d'extension (prérequis bloquant)

- **Fichiers/dossier propres** : `packages/excel/src/strings/` (découpe de `strings.ts`), `ui/registry.ts` (nouveau), `App.tsx` (extraction), `ui/Hosts.tsx`
- **Contenu** : Découper `strings.ts` (442 lignes) en `strings/<domaine>.ts` + `strings/index.ts` qui réexporte `S` et `RB` ; créer trois registres où les lots s'enregistrent sans toucher `App.tsx` (762 lignes, limite 800) : dialogues (`DialogState` ouvert), menus contextuels (zone -> fabrique d'items), raccourcis clavier (`keys.ts` éclaté en `keys-nav.ts`, `keys-format.ts`, `keys-edit.ts`). Sortir de `App.tsx` les blocs `env`, barre d'état et overlay. Aucune fonction ne change.
- **Effort** : M · **Vague** : 0 · **Dépend de** : -
- **Validation** : `tsc` sans erreur, 18 tests existants verts, rendu identique (capture avant/après)

### Lot A : Format de cellule complet

- **Fichiers/dossier propres** : `ui/dialogs/format-cells/` (un fichier par onglet : `nombre.tsx`, `alignement.tsx`, `police.tsx`, `bordure.tsx`, `remplissage.tsx`, `protection.tsx`) ; `logic/numfmt-ui.ts`
- **Contenu** : Réécrire la boîte avec les 6 onglets d'Excel, catégories Nombre/Monétaire/Date/Heure/Spécial/Personnalisée, libellés français des alignements, nom de police, style, soulignement, couleur, effets, bordures (13 styles, aperçu), remplissage (motif, dégradé, autres couleurs), protection ; n'appliquer que les champs modifiés (X-01 à X-03) ; brancher « Autres formats numériques... » et « Autres bordures... ».
- **Effort** : L · **Vague** : 1 · **Dépend de** : 0
- **Validation** : capture de chaque onglet comparée à Excel ; test node : patch minimal sur sélection hétérogène
- **Entrées P1 à combler** : R1.2-11, R1.2-14, R1.4-02, D4.1-01, D4.1-02, D4.1-03, D4.1-05, D4.1-06, D4.1-13, D4.1-14, D4.1-15, D4.1-16, D4.1-18, D4.1-19

### Lot E : Raccourcis clavier

- **Fichiers/dossier propres** : `ui/keys-nav.ts`, `ui/keys-format.ts`, `ui/keys-edit.ts` (issus du socle)
- **Contenu** : Corriger F12/Ctrl+F4/F4/Alt+0 (X-04) ; ajouter Ctrl+9/0/Maj+(/), Ctrl+Maj+~ ! # @ $ ^ &, _, Ctrl+Maj+> <, Ctrl+W, Maj+F9, F8, F3, Ctrl+', Ctrl+Maj+", Ctrl+Maj+Entrée (matricielle), Ctrl+Maj+F3, Ctrl+Maj+T, Ctrl+Maj+F2, Maj+F10, Alt+Bas, Alt+Maj+flèches, Ctrl+Maj+U, F6 ; remettre les info-touches FR (X-05).
- **Effort** : M · **Vague** : 1 · **Dépend de** : 0
- **Validation** : test node par raccourci (événements clavier simulés) + liste cochée contre la section 5
- **Entrées P1 à combler** : K5.2-21, K5.3-17, K5.3-18, K5.3-19, K5.3-20, K5.3-31, K5.4-04, K5.4-06

### Lot C : Cellules, feuilles, recherche

- **Fichiers/dossier propres** : `ui/dialogs/cells/` (`insert-cells.tsx`, `delete-cells.tsx`, `go-to-special.tsx`, `find-options.tsx`, `move-copy-sheet.tsx`), `logic/goto-special.ts`
- **Contenu** : Boîtes Insérer/Supprimer des cellules (X-11), Atteindre spécial (13 types), Rechercher/Remplacer étendu (Dans classeur/feuille, sens, regarder dans, format, jokers), Déplacer ou copier une feuille, Largeur par défaut, sélection multiple d'onglets (groupe de travail), copie par Ctrl+glisser d'onglet.
- **Effort** : M · **Vague** : 1 · **Dépend de** : 0
- **Validation** : tests node (goto-special, find) + captures des boîtes
- **Entrées P1 à combler** : D4.2-05, D4.6-05, D4.6-06, D4.6-13

### Lot K : Mise en forme conditionnelle complète

- **Fichiers/dossier propres** : `ui/dialogs/cf/` (`rule-dialog.tsx`, `manager.tsx`, `icon-sets.ts`) ; `logic/condfmt.ts` (extensions)
- **Contenu** : Nouvelle règle à 6 types avec Format... (4 onglets), échelles/barres/jeux d'icônes paramétrables, 20 jeux d'icônes traduits avec aperçu, gestionnaire complet (portée, modifier, priorité, Arrêter si vrai), règles dates, 10 % moins élevés, boîtes de paramètre N (X-08, X-09, X-18).
- **Effort** : L · **Vague** : 1 · **Dépend de** : 0, A (onglet Format)
- **Validation** : test node CfEvaluator + capture du gestionnaire
- **Entrées P1 à combler** : R1.5-01, R1.5-02, R1.5-05, R1.5-06, R1.5-07, R1.5-08, R1.5-10, D4.4-01, D4.4-02, D4.4-03, D4.4-05, D4.4-06, D4.4-08

### Lot I : Mise en page et impression

- **Fichiers/dossier propres** : `ui/page-setup/` (`dialog.tsx`, `header-footer.tsx`, `titles.tsx`), `ui/print.tsx`, `logic/pagebreaks.ts`
- **Contenu** : Boîte Mise en page (Page, Marges, En-tête/Pied, Feuille), en-têtes/pieds avec codes &[Page] etc., lignes/colonnes à répéter, Largeur/Hauteur d'ajustement, marges personnalisées, 20 tailles de papier, ordre des pages, commentaires à l'impression, glisser les sauts de page, vue Mise en page réelle (pages séparées, règles).
- **Effort** : L · **Vague** : 1 · **Dépend de** : 0
- **Validation** : PDF de test comparé à Excel (COM masqué) ; captures
- **Entrées P1 à combler** : R1.15-01, R1.15-07, R1.15-08, R1.16-01, R1.16-02, D4.8-01, D4.8-02, D4.8-03, D4.8-04, D4.8-05

### Lot L : Révision, commentaires, protection

- **Fichiers/dossier propres** : `ui/review/` (`comment-bubble.tsx`, `notes.ts`, `protect-dialog.tsx`, `spelling.ts`)
- **Contenu** : Commentaires dans une bulle (fin de `window.prompt`, X-06), navigation précédent/suivant, afficher/masquer, notes complètes (modifier, supprimer, afficher toutes), protection de feuille avec 15 permissions, plages modifiables, orthographe avec dictionnaire local FR + Maj+F7 synonymes (P2), statistiques du classeur.
- **Effort** : M · **Vague** : 1 · **Dépend de** : 0
- **Validation** : test node du modèle ; captures bulles
- **Entrées P1 à combler** : R1.24-06, R1.24-14, D4.6-01, D4.6-17

### Lot M : Formules et noms

- **Fichiers/dossier propres** : `ui/formulas/` (`name-new.tsx`, `error-check.tsx`, `watch-pane.tsx`), `logic/engine.ts`
- **Contenu** : Brancher `EngineOptions.host` (X-15 : CELLULE, INFORMATIONS, LIREDONNEESTABCROISDYNAMIQUE) et `removeSheetInFormula` avec l'ordre des onglets ; Définir un nom/Depuis sélection, menu Récentes, Calculer la feuille, calcul automatique sauf tables, calcul itératif réglable, vérification des erreurs + triangles verts, Fenêtre Espion, repérage multi-feuilles, tableaux de données TABLE(), consolidation, extension automatique des tableaux.
- **Effort** : L · **Vague** : 1 · **Dépend de** : 0
- **Validation** : tests node moteur+hôte ; comparaison COM sur CELLULE
- **Entrées P1 à combler** : R1.18-02, R1.19-12, D4.5-10, X-13, X-21, X-37

### Lot N : Options, Backstage, barre d'état, coque

- **Fichiers/dossier propres** : `ui/options/` (`options-dialog.tsx` par catégories), `ui/BackstagePages.tsx`, `ui/status-bar.ts`, `packages/ui` (onglets Dessin/Aide)
- **Contenu** : Boîte Options Excel (Général, Formules, Données, Vérification, Enregistrement, Avancé : sens de la touche Entrée, décimale fixe, poignée, saisie semi-automatique), pages Backstage (Accueil modèles, Informations riches, Partager, Historique, Exporter PDF réel), barre d'état personnalisable (Min, Max, Nb numérique, filtre, indicateurs), enregistrement auto réglable, volets génériques (Presse-papiers Office, Volet Sélection), onglets Dessin et Aide (au minimum Aide).
- **Effort** : L · **Vague** : 2a · **Dépend de** : 0
- **Validation** : captures Backstage comparées ; test de persistance des réglages
- **Entrées P1 à combler** : D4.8-07, D4.8-13, F-01, F-14, F-19, X-01, X-04

### Lot B : Menus contextuels et mini-barre

- **Fichiers/dossier propres** : `ui/context/` (`cell.ts`, `headers.ts`, `table.ts`, `sheet-tab.ts`, `status-bar.ts`, `formula-bar.ts`, `link.ts`), `ui/MiniBar.tsx`
- **Contenu** : Menu cellule complet (Options de collage en icônes, Insérer.../Supprimer... avec boîtes, Filtrer/Trier à sous-menus, Choisir dans la liste, Analyse rapide si lot J), menus en-têtes, tableau, onglet de feuille (Déplacer ou copier, groupe de travail), barre de formule, barre d'état, touche Menu/Maj+F10 ; instancier `MiniToolbar` de `packages/ui` en réutilisant les contrôles de `homeTab` (2 rangées, section 3).
- **Effort** : L · **Vague** : 2a · **Dépend de** : 0, A, C
- **Validation** : capture clic droit réel (`clic_reel.py`/outils du projet) comparée à Excel
- **Entrées P1 à combler** : M2.1-03, M2.1-06, M2.1-07, M2.1-11, M2.1-12, M2.1-14, M2.1-15, M2.1-19, M2.1-20, M2.3-04, M2.7-01, M2.7-02, M2.7-06, M2.9-01, M2.9-02, M2.9-12, B-01, B-02, B-03, B-04, B-05, B-06, B-07, B-08, B-09, B-10, B-11, B-12, B-13, B-14, B-15, B-16, B-17

### Lot D : Interactions de la grille

- **Fichiers/dossier propres** : `ui/Grid.tsx` (extraire `ui/grid-drag.ts`), `ui/paint.ts`, `logic/move.ts`, `logic/autocomplete.ts`, `logic/fill-options.ts`
- **Contenu** : Glisser-déplacer / Ctrl+glisser la bordure d'une plage, double-clic sur la poignée (recopie vers le bas), glisser avec le bouton droit, bouton Options de recopie, Options de collage, liens hypertexte (rendu bleu souligné, Ctrl+clic, menu : X-07), saisie semi-automatique de texte, Alt+Bas, indicateurs d'erreur, bordure animée du mode Pointer, fractionnement de fenêtre, boutons +/- du plan.
- **Effort** : L · **Vague** : 2a · **Dépend de** : 0
- **Validation** : tests node (move, autocomplete) + gestes réels testés à la souris sur le banc
- **Entrées P1 à combler** : M2.4-03, M2.4-05, M2.4-06, M2.4-07, D4.6-10, S8.3-11

### Lot J : Données

- **Fichiers/dossier propres** : `ui/dialogs/data2/` (`custom-filter.tsx`, `advanced-filter.tsx`, `sort-options.tsx`, `validation.tsx`, `text-to-columns.tsx`, `consolidate.tsx`, `what-if.tsx`, `csv-import.tsx`), `logic/filters.ts`
- **Contenu** : Filtre personnalisé ET/OU, filtres chronologiques et par couleur, filtre avancé, tri par couleur/liste personnalisée/options, validation complète (X-17), assistant Convertir 3 étapes, assistant d'import CSV (délimiteur, encodage, types), Consolider, Valeur cible, Gestionnaire de scénarios, Table de données, Analyse rapide (Ctrl+Q), Feuille de prévision (moteur prêt : PREVISION.ETS).
- **Effort** : L · **Vague** : 2a · **Dépend de** : 0
- **Validation** : tests node ; comparaison des résultats avec Excel COM (valeur cible, consolidation)
- **Entrées P1 à combler** : R1.20-02, R1.21-07, R1.22-01, R1.22-04, R1.23-11, D4.3-09, D4.3-10, D4.3-13, D4.3-15, D4.3-21

### Lot G : Graphiques

- **Fichiers/dossier propres** : `ui/charts/` (`ChartInteractive.tsx`, `format-pane.tsx`, `add-element.tsx`, `select-data.tsx`, `chart-menus.ts`), `logic/charts-*.ts`, `ChartView.tsx`
- **Contenu** : Éléments sélectionnables (titre, légende, axes, séries, points), édition du titre en place, volet Format (axe, série, étiquettes, légende, zone), Ajouter un élément graphique, Disposition rapide, styles, Sélectionner des données (éditeur de séries), Modifier le type avec aperçu, courbes de tendance, axes secondaires, barres d'erreur, types manquants (cascade, entonnoir, radar, bulles, 100 % empilé, 3D, statistiques), 8 poignées, boutons flottants +/pinceau/filtre, menus contextuels graphique.
- **Effort** : L · **Vague** : 2b · **Dépend de** : 0, B (menus), F (poignées/objets)
- **Validation** : comparaison visuelle avec graphiques générés par Excel COM (même données)
- **Entrées P1 à combler** : R1.10-01, R1.10-02, R1.10-03, R1.10-04, R1.10-07, R1.29-01, R1.29-06, R1.29-07, R1.29-10, R1.29-11, M2.5-01, M2.5-02, M2.5-04, M2.5-05, M2.5-06, M2.5-10, M2.5-12, M2.5-13, D4.7-10, D4.7-11, D4.7-12, D4.7-14, D4.7-15, D4.7-16

### Lot H : Tableaux croisés dynamiques

- **Fichiers/dossier propres** : `ui/pivot/` (`pivot-menus.ts`, `field-settings.tsx`, `options.tsx`, `group.tsx`, `calculated-field.tsx`), `logic/pivot-persist.ts`, `logic/pivot.ts`
- **Contenu** : Relier `Workbook.pivotCaches`/`Sheet.pivotTables` de `@forgeoffice/xlsx` : lire et écrire les TCD, actualisation à l'ouverture, fin de l'état éphémère (X-14) ; glisser-déposer des champs, filtre de rapport à cases, Paramètres de champs, Options du TCD, Grouper (dates, nombres), Afficher les détails (double-clic), champs/éléments calculés, dispositions compacte/plan/tabulaire, styles, segments et chronologies liés, graphique croisé, menus contextuels.
- **Effort** : L · **Vague** : 2b · **Dépend de** : 0, B, G, F (segments)
- **Validation** : fichier écrit par le Tableur rouvert dans Excel 365 COM (outil `verifier-tcd-excel.ps1` de xlsx) ; tests node
- **Entrées P1 à combler** : R1.8-01, R1.28-01, R1.28-02, R1.28-03, R1.28-05, M2.6-01, M2.6-02, M2.6-04, M2.6-05, D4.7-01, D4.7-02, D4.7-05, D4.7-06, D4.7-08, V-02, V-03, V-06, X-38

### Lot F : Formes, images, objets

- **Fichiers/dossier propres** : `ui/objects/` (`shape-gallery.tsx`, `object-pane.tsx`, `arrange.ts`, `selection-pane.tsx`, `picture-tools.tsx`), `ui/Drawings.tsx`, `ribbon/objects.tsx`
- **Contenu** : Galerie de formes (~170) et zone de texte avec insertion à la souris, onglets Format de forme / Format de l'image (Styles, Remplissage, Contour, Effets, Rogner, Corrections), volet Format de l'objet, Texte de remplacement, Avancer/Reculer, Aligner, Grouper, Rotation (poignée), 8 poignées, menu contextuel des objets, Volet Sélection, segments et chronologies (partagés avec le lot H), sparklines éditables (onglet Sparkline).
- **Effort** : L · **Vague** : 2a · **Dépend de** : 0
- **Validation** : captures comparées aux onglets lus par UIA (section 1.30)
- **Entrées P1 à combler** : R1.9-01, R1.9-03, R1.12-01, R1.12-04, R1.12-05, R1.30-06, R1.30-07, M2.8-01, D4.7-24, V-10, V-11

### Lot O : Compléments du ruban

- **Fichiers/dossier propres** : `ribbon/home.tsx`, `ribbon/tabs.tsx`, `ribbon/contextual.tsx` (attribution unique à ce lot : les autres lots contribuent via `ribbon/<lot>.tsx`)
- **Contenu** : Combler les entrées de ruban sans lot propriétaire : Coller (7 modes manquants), Souligné double, Tableau avec boîte, Graphiques recommandés, thèmes/polices/effets, tailles de papier, menus Recopier/Effacer complets, Compléments, groupe Texte (en-tête/pied, WordArt), Équation, Données externes (P3), lanceurs, mode persistant du pinceau.
- **Effort** : M · **Vague** : 3 · **Dépend de** : tous les lots A à N (pour éviter les conflits de fusion)
- **Validation** : liste section 1 : zéro Absent P1
- **Entrées P1 à combler** : R1.2-03, R1.2-04, R1.5-13, R1.6-01, R1.6-02, R1.6-06, R1.6-07, R1.6-16, R1.6-17, R1.6-18, R1.6-19, R1.6-22, R1.7-18, R1.7-21, R1.7-22, R1.8-03, R1.12-03, R1.27-09, R1.27-15

### Lot P : Campagne de preuve « À vérifier » (transversal)

- **Fichiers/dossier propres** : `packages/excel/tests/e2e/` + `docs/parite/preuves/`
- **Contenu** : Pour chaque entrée « À vérifier » P1 (≈ 262) : scénario piloté sur le banc (`npm run dev -w apps/web`, chrome-devtools) avec capture avant/après ; classer en Prouvé ou Défaut (corriger ou verser dans X-nn). Commencer par les raccourcis (65), le ruban Accueil (79) et la barre d'état. À lancer dès la vague 1 pour détecter les options qui ne fonctionnent pas.
- **Effort** : L · **Vague** : 1 à 3 · **Dépend de** : 0
- **Validation** : rapport par ligne : captures + résultat ; mise à jour de EXCEL.md

### Lot Z : Au-delà d'Office

- **Fichiers/dossier propres** : un dossier par idée (`packages/excel/src/plus/<idee>/`)
- **Contenu** : Les 25 idées A-01 à A-25 de EXCEL.md, à ordonner après la parité P1. Candidates rapides : A-18 (palette de commandes), A-02 (explication de formule), A-03 (carte des dépendances), A-12 (formats humains), A-04 (formules incohérentes).
- **Effort** : L · **Vague** : 3+ · **Dépend de** : lots précédents
- **Validation** : à définir par idée

## Ordre recommandé des 20 premières livraisons visibles (rapport utilité / effort)

1. Lot 0 (socle).
2. Lot E : correction des raccourcis faux (F12, Ctrl+F4) et ajout de Ctrl+9/0 : petit, visible tout de suite.
3. Lot D (partie liens hypertexte, X-07) : un lien qui ne se voit pas est un défaut immédiat.
4. Lot A : Format de cellule (X-01 à X-03) : la boîte la plus utilisée après Collage spécial.
5. Lot C : Insérer/Supprimer des cellules et Déplacer ou copier une feuille.
6. Lot L : fin de `window.prompt` pour les commentaires (X-06).
7. Lot K : gestionnaire de MFC et règles à 6 types.
8. Lot H (persistance des TCD) : le modèle `xlsx` est déjà prêt et prouvé sous Excel.
9. Lot B : clic droit complet + mini-barre (composant `MiniToolbar` déjà écrit).
10. Lot I : Mise en page et en-têtes/pieds.
11. Lot J : filtre personnalisé, validation complète, import CSV.
12. Lot G : éléments de graphique et volet Format.
13. Lot D (glisser-déplacer de cellules, poignée, saisie semi-automatique).
14. Lot F : formes et images.
15. Lot M : hôte du moteur, vérification d'erreurs, Espion.
16. Lot N : Options Excel et barre d'état.
17. Lot O : reste du ruban.
18. Lot P : rapport de preuve complet.
19. Lot Z : palette de commandes (A-18).
20. Lot Z : explication de formule (A-02).

## Risques et points d'attention

- **Conflits de fusion** : `ribbon/*.tsx`, `commands.ts` (427 lignes), `actions.ts` (405 lignes) sont partagés ; chaque lot ajoute `ribbon/<lot>.tsx` et `ui/<lot>-actions.ts` et n'édite les fichiers partagés que par une ligne d'enregistrement.
- **Taille de fichier** : `paint.ts` (673 lignes), `Grid.tsx` (459), `App.tsx` (762) : extraire avant d'ajouter.
- **Vérification visuelle** : le client Metin2 n'est pas concerné, mais le banc de test ne doit jamais bloquer le PC du propriétaire (consigne mémoire) ; fenêtre hors écran ou navigateur sans interface.
- **Moteur** : 505 fonctions, `WEBSERVICE/FILTERXML/STOCKHISTORY/RTD/IMAGE` refusées volontairement ; `PREVISION.ETS` écarte ~1 % d'Excel sur séries bruitées.
- **Preuves Excel** : réutiliser le pilotage COM masqué (instance propre, `Quit()` dans `finally`, ne jamais tuer un autre EXCEL) pour comparer chiffres et fichiers produits.

## État au 2026-11-06 (version 0.2.3 non publiée)

Statut `Fait` dans EXCEL.md = livré. Les entrées marquées « test réel + capture » ont été exercées dans un navigateur piloté (événements souris/clavier réels) avec capture regardée ; « Vérifié (navigateur piloté) » = ouvert et observé le 2026-11-07 ; « Livré (lot précédent), non revérifié » = livré par un commit antérieur, à confirmer au banc.

- **Lot I (mise en page, impression)** : fait (boîte à 4 onglets, titres à répéter, Largeur/Hauteur, marges personnalisées, aperçu) ; l'ancien constat « Absent » du document de parité était périmé.
- **Lot J (données)** : assistant Convertir (délimité / largeur fixe), import texte/CSV avec assistant, filtres nommés (Égal, Différent, Supérieur…, Entre, 10 premiers, Commence/Se termine par, Contient…), tri par couleur de cellule, tri à plusieurs niveaux (déjà présent). Reste : filtre avancé, Consolider, Valeur cible, Table de données, Analyse rapide, tri par liste personnalisée dans une boîte dédiée.
- **Lot M (formules et noms)** : gestionnaire de noms, Fenêtre Espion, vérification des erreurs, options de calcul, Somme automatique > Autres fonctions étaient déjà présents (document périmé) ; ajouté : options de recopie incrémentée (M2.4-05), gestes de bordure (M2.4-06/07).
- **Lot G (graphiques)** : ajouté : Ajouter un élément graphique (titres d'axes, courbe de tendance linéaire, position des étiquettes), Modifier le titre, histogrammes/barres empilés 100 %, nuage avec lignes. Reste : Sélectionner des données, axes secondaires éditables, menus contextuels, boutons flottants, titre modifiable en place.
- **Lot H (tableaux croisés)** : ajouté : Afficher les détails par double-clic. Reste : Grouper, Options du tableau, Paramètres de champs en boîte, segments.
- **Lot F (formes)** : ajouté : galerie Formes (rectangle, arrondi, ovale, triangle, losange, flèche, étoile, ligne), Zone de texte, saisie du texte par double-clic. Reste : onglet Format de forme (styles, contour, effets), poignées à 8 points, rotation.
- **Reste à faire** : lots D (boutons +/- du plan dans la marge R1.23-11, scinder la fenêtre), L (commentaires en bulle inline), B (menus contextuels de graphique et de tableau croisé, mini-barre), N (options, barre d'état personnalisable, backstage), segments (R1.12-01).

Mise à jour 2026-11-07 : ajoutés plan +/- dans la marge et boutons de niveau, navigation Précédent/Suivant des commentaires et notes, notes toujours visibles, calculs configurables de la barre d'état, menu contextuel des objets (ordre, titre, suppression), onglet Format de forme, titres de graphique modifiables par double-clic, Sélectionner des données, options Avancé (sens de la touche Entrée), liste de fonctions de la ligne Total, courbes et aires empilées, « Insérer… » / « Supprimer… » au menu de la cellule. Reste : lot D (scinder la fenêtre, plan des colonnes), lot L (bulle de commentaire modifiable en place), lot B (menu contextuel du tableau croisé, mini-barre des objets), lot N (autres pages d'options, backstage riche), segments et chronologies, 8 poignées de redimensionnement.

Mise à jour suivante (2026-11-07, tour 4) : ajoutés 8 poignées de redimensionnement, Valeur cible, Consolider, Filtre avancé, modification d'un commentaire en place, décimales fixes, plan des colonnes, Analyse rapide (bouton et Ctrl+Q), propriétés du document modifiables, graphique Radar. Reste : scinder la fenêtre, rotation libre à la souris, mini-barre des objets, menu contextuel du tableau croisé, autres pages d'options (Général, Formules, Enregistrement), saisie semi-automatique, segments et chronologies, Table de données et Gestionnaire de scénarios, surface/bulles, effets de forme, Grouper dans les tableaux croisés, versions du classeur.

## État final du tour (2026-11-07)

Vérifications : `packages/excel` 186 tests, `packages/xlsx` 66, `packages/formulas` 981, tous verts ; typecheck racine : une seule erreur, hors Tableur (`packages/convert/src/engines.ts(167,4)` TS2366, travail d'un autre agent).

Ajouts de ce dernier tour : menu contextuel du tableau croisé, rotation libre des formes, courbes lissées, radar plein, Options Général (nom d'utilisateur) et Enregistrement (intervalle de récupération), Plan automatique. Versions du classeur : l'application garde déjà une copie de récupération (la plus récente, `saveRecovery` + boîte de reprise) ; l'historique de plusieurs versions n'existe pas.

Liste exhaustive de ce qui reste (Tableur) : scinder la fenêtre (4 volets) ; mini-barre flottante des objets ; menu contextuel des éléments de graphique (axe, légende, série) et du tableau croisé (grouper, développer/réduire, paramètres de champ) ; Grouper dans les tableaux croisés (dates, nombres) ; segments et chronologies (R1.12-01) ; saisie semi-automatique ; page d'options Formules détaillée (itératif, L1C1) ; Table de données et Gestionnaire de scénarios (modèle xlsx des scénarios à ajouter) ; graphiques surface, bulles et nuages lissés ; effets et styles de forme (ombre, dégradé, styles prédéfinis) ; bulle de commentaire modifiable directement sur la cellule ; historique de versions ; plan automatique des colonnes ; entrées P3 non traitées.

