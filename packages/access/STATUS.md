# packages/access : état (2026-11-04)

Application « Base de données » (équivalent Access 2024), exporte `{ info: MODULES.access, App }`.
Moteur : `crates/forge-base` via les commandes Tauri de `apps/desktop/src-tauri/src/base_cmds.rs`.

## Vérifié

- `npx tsc -p packages/access/tsconfig.json --noEmit` : 0 erreur (et 0 erreur `packages/access` dans le `tsc` racine).
- `node --test packages/access/tests/*.test.ts` : 16 tests, 16 réussis (saisie et validation, 13 types, grille QBE vers
  définition, tri/filtres/totaux en mémoire, états, export CSV/HTML, requêtes en mémoire, modèles, analyseur, base de démo).
- `cargo test` dans `apps/desktop/src-tauri` : 49 réussis, dont 6 pour `base_cmds` ; `cargo clippy --all-targets` : 0 avertissement.
  Le test `scenario_de_l_interface_rejoue_sur_le_moteur` rejoue contre le vrai moteur 63 opérations produites par les
  fonctions de l'interface (`tests/scenario.ts` -> `tests/fixtures/ops-scenario.json`, cohérence vérifiée par un test node) :
  les 4 modèles, la feuille de données, la grille QBE (jointure, critères, totaux), formulaires, états, macros, import CSV/classeur,
  copie/renommage/suppression. Il a trouvé un vrai défaut (champ « N° » non qualifié dans la grille), corrigé (`fieldRef`).
  Régénérer après une modification de l'interface : `node packages/access/tests/scenario.ts --write`.
- Rendu regardé (banc `?app=access`, port 5314, Edge sans interface en CDP), captures `docs/captures/base-*.png` :
  sans application, feuille de données, totaux + filtre par sélection, création de table, créateur de requête,
  résultat de requête (enregistrée et exécutée depuis le créateur), relations + dialogue, formulaire, formulaire en mode Page,
  aperçu d'état groupé, macro, documentation, Backstage, thème sombre.

## Contenu

| Élément | Fichier |
|---|---|
| Application : barre de titre, ruban, Backstage, volet, onglets d'objets, barre d'état, cycle de vie de la base | `src/App.tsx` |
| Ruban : Accueil, Créer, Données externes, Outils de base de données + contextuels (Champs, Table, Création, Création de requête/relation/formulaire/état, Aperçu) | `src/ribbon.tsx` |
| Backstage : base vide, 4 modèles, ouvrir (.fodb/.sqlite/.db), récents, informations, compacter, intégrité, enregistrer sous, sauvegarder, imprimer, fermer | `src/BackstagePages.tsx` |
| Feuille de données : pages de 100, tri, filtre par sélection / liste de valeurs, recherche, totaux, édition, ajout en dernière ligne, suppression, remplacer, ajout/suppression de champ, Requis/Indexé | `src/components/Datasheet.tsx` |
| Mode Création de table : 13 types (Nombre + taille), clé, propriétés Général/Liste de choix, feuille de propriétés de table | `src/components/TableDesign.tsx` |
| Créateur de requêtes : tables déplaçables, jointures glissées (3 types), grille QBE, totaux, 6 types de requête, N premiers, paramètres, mode SQL | `src/components/QueryDesign.tsx`, `Diagram.tsx` |
| Formulaires (simple, tabulaire, feuille, double affichage ; navigation, saisie, ajout) et mode Page/Création (contrôles déplaçables et redimensionnables, liste de champs) | `src/components/FormView.tsx`, `DesignCanvas.tsx` |
| États : aperçu paginé, regroupement, totaux de groupe et général, portrait/paysage, impression | `src/components/ReportView.tsx` |
| Macros : actions, arguments, condition, catalogue, exécution (actions d'interface jouées par l'application) | `src/components/MacroView.tsx` |
| Relations : diagramme, création par glisser-déposer, intégrité, cascades, mettre à Null, jointure | `src/components/Relations.tsx` |
| Documentation et analyse | `src/components/ToolsViews.tsx` |
| Import CSV/classeur (`@forgeoffice/xlsx`), export Excel/texte/HTML, modèles | `src/exchange.ts` |
| Sans coquille : écran « nécessite l'application installée » + base « Comptoir » en lecture seule | `src/components/NoNative.tsx`, `src/demo-db.ts` |
| Logique sans DOM testée | `src/logic/` |

## Reste à faire

- Bureau non lancé (consigne) : création/ouverture/enregistrement réels, dialogues natifs et impression ne sont prouvés que
  par les tests Rust (moteur + commandes), pas par l'interface graphique Tauri.
- Mobile : `base_create` / `base_copy` refusent les URL `content://` (SQLite a besoin d'un chemin) ; ouvrir une base reçue
  sans chemin affiche un message.
- Ouvrir une base passe par `services.openFile`, qui lit tout le fichier pour obtenir le chemin (jusqu'à 1 Go) : un dialogue
  « choisir un chemin » sans lecture serait plus sobre.
- Résultats de requête en lecture seule (Access permet d'éditer certaines requêtes) ; pas de largeur de colonne réglable ;
  pagination par 100 au lieu du défilement continu.
- Mode Page des formulaires/états : affiche les noms de champs (comme le mode Création), pas les données.
- Formulaires : pas de sous-formulaires ni de boutons de commande ; états : un seul niveau de regroupement.
- Orthographe : vérification du système (attribut `spellcheck`), pas de dictionnaire propre.
- Annuler/Rétablir non gérés (les enregistrements sont écrits immédiatement, comme Access).
