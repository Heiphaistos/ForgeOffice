# Audit de parité : Base de données ForgeOffice contre Microsoft Access

Date : 2026-11-05. Périmètre : `packages/access` (interface), `crates/forge-base` (moteur), `apps/desktop/src-tauri/src/base_cmds.rs` (pont). Référence : Microsoft Access 365 (16.0, build 20527), interface française.

## Méthode et vérité-terrain

- Access est installé sur ce PC : la référence a été **mesurée**, pas seulement rappelée. Trois relevés, tous par COM/UI Automation, fenêtre hors écran (-32000, `ShowWindow(SW_SHOWNOACTIVATE)`), sans souris ni clavier réels, base de test dans le dossier temporaire, `Quit` dans un `finally`, vérification qu'aucun `MSACCESS` ne reste (un `CloseCurrentDatabase` a bloqué une instance sur une invite d'enregistrement invisible : instance tuée par son PID, script corrigé).
  1. **Menus contextuels** : les 258 barres `CommandBars` d'Access, dont les menus contextuels non vides : annexe A.
  2. **Ruban** : arbre UI Automation de chaque onglet, permanent et contextuel, pour 7 situations (base seule, table en feuille de données, table en Création, requête en Création, formulaire en Création, état en Création, aperçu avant impression) : annexe B. Non relevés (UIA sans clic) : contenu des galeries et menus déroulants, onglet Relations, onglet Macros, Backstage ; ils viennent de ma connaissance d'Access.
  3. **Propriétés** : nombre et noms des propriétés lues sur des objets créés par `CreateForm`, `CreateControl`, `CreateReport` (section « Feuille de propriétés »).
- Côté ForgeOffice : lecture du code (`ribbon.tsx`, `App.tsx`, `NavPane.tsx`, `Datasheet.tsx`, `TableDesign.tsx`, `QueryDesign.tsx`, `FormView.tsx`, `DesignCanvas.tsx`, `ReportView.tsx`, `MacroView.tsx`, `Relations.tsx`, `strings.ts`, `types.ts`, `logic/*`, `expr.rs`, `objets.rs`, `etats.rs`, `index.rs`, `sous_formulaire.rs`, `requete_editable.rs`, `import_access.rs`, `base_cmds.rs`) et des deux STATUS (`packages/access/STATUS.md` du 2026-11-04, `crates/forge-base/STATUS.md` à jour). Aucun code modifié, aucune commande git.
- **Constat clé** : le moteur a gagné cinq fonctions (index multi-champs, sous-formulaires, états multi-niveaux, requêtes éditables, import `.mdb`/`.accdb`) mais **aucune n'est branchée** : `base_cmds.rs` n'expose ni index, ni sous-formulaire, ni requête éditable, ni import Access, et `packages/access` ne les appelle pas. Ces lignes portent la couche « Pont Tauri + Interface ».
- Menus contextuels : ForgeOffice n'en a que 4 (cellule de feuille de données à 9 entrées, objet du volet de navigation à 8 entrées, boîte de table de requête, colonne de grille) contre plus de cent chez Access : c'est l'écart que le propriétaire a constaté. Mini-barre flottante : aucune dans le module. Objets de formulaire/état : déplaçables et redimensionnables mais sans sélection multiple, copier-coller, alignement ni feuille de propriétés.

## Légende

| Champ | Valeurs |
|---|---|
| Statut | **OK** = code lu ET effet prouvé (test `cargo`/`node`, scénario rejoué contre le vrai moteur, ou capture regardée citée dans les STATUS) ; **Présent à vérifier** = code présent, effet non prouvé (interface jamais exercée en vrai) ; **Partiel** = existe mais incomplet face à Access ; **Absent** = rien dans le code. Règle appliquée : une fonction présente est « OK » seulement si elle repose sur le moteur testé (couche Moteur), sinon « Présent à vérifier » |
| Prio | P1 = attendu au quotidien, manque visible ; P2 = utile ; P3 = niche ou sans objet hors Microsoft |
| Couche | **Moteur** = `crates/forge-base` ; **Pont Tauri** = `apps/desktop/src-tauri/src/base_cmds.rs` ; **Interface** = `packages/access` |

## Récapitulatif

| Type | OK | Présent à vérifier | Partiel | Absent | Total |
|---|---|---|---|---|---|
| Ruban | 2 | 68 | 45 | 128 | 243 |
| Volet de navigation | 0 | 5 | 2 | 8 | 15 |
| Menu contextuel | 13 | 56 | 35 | 162 | 266 |
| Propriété | 29 | 0 | 15 | 35 | 79 |
| Dialogue | 0 | 9 | 16 | 23 | 48 |
| Assistant | 0 | 0 | 4 | 21 | 25 |
| Contrôle | 2 | 5 | 11 | 34 | 52 |
| Expression | 32 | 0 | 7 | 21 | 60 |
| Macro | 8 | 0 | 8 | 22 | 38 |
| Raccourci | 1 | 5 | 4 | 21 | 31 |
| Moteur | 28 | 2 | 14 | 27 | 71 |
| Invisible | 3 | 2 | 7 | 9 | 21 |
| Backstage | 0 | 7 | 3 | 10 | 20 |
| Au-delà | 0 | 0 | 1 | 19 | 20 |
| **Total** | **118** | **159** | **172** | **540** | **989** |

Taux global : OK 11.9 %, Présent à vérifier 16.1 %, Partiel 17.4 %, Absent 54.6 % sur 989 entrées (dont 20 idées « Au-delà »).

Entrées P1 : OK 84, Présent à vérifier 130, Partiel 79, Absent 124.

## 1. Ruban : onglets permanents (vérité-terrain UIA)

> Source : arbre UI Automation d'Access 16.0 (build 20527, interface française) lu hors écran. Les noms sont ceux affichés par Access. La colonne « Couche » dit où se situe le travail : Moteur = crates/forge-base, Pont = apps/desktop/src-tauri/src/base_cmds.rs (opérations exposées à l'interface), UI = packages/access.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-001 | Ruban | Onglet Fichier (Backstage) | Partiel | P2 | Interface | BackstagePages.tsx : Nouveau, Ouvrir, Informations, Enregistrer sous, Imprimer, Fermer (pas de Compte / Options / Commentaires) |
| AC-002 | Ruban | Onglet Accueil | Partiel | P1 | Interface | ribbon.tsx home : 5 groupes sur 7 |
| AC-003 | Ruban | Onglet Créer | Partiel | P1 | Interface | ribbon.tsx create : 6 groupes sur 7 (pas de galerie Modèles complète, pas de Navigation) |
| AC-004 | Ruban | Onglet Données externes | Partiel | P1 | Interface | ribbon.tsx external : Importer et lier / Exporter très réduits |
| AC-005 | Ruban | Onglet Outils de base de données | Partiel | P2 | Interface | ribbon.tsx tools : 3 groupes sur 6 |
| AC-006 | Ruban | Onglet Aide | Absent | P3 | Interface | absent ; Aide, Contacter le support, Commentaires, Afficher la formation |
| AC-007 | Ruban | Champ « Dites-nous ce que vous voulez faire » (Recherche Microsoft) | Absent | P2 | Interface | absent dans ribbon.tsx (Alt+Q existe dans d'autres modules via packages/ui) |
| AC-008 | Ruban | Barre d'outils Accès rapide : Enregistrer | Partiel | P2 | Interface | barre de titre commune (packages/ui) ; contenu non personnalisable |
| AC-009 | Ruban | Barre d'outils Accès rapide : Annuler / Rétablir | Absent | P1 | Interface | STATUS : « Annuler/Rétablir non gérés » ; aucune pile d'annulation dans access (une pile existe dans packages/core) |
| AC-010 | Ruban | Barre d'outils Accès rapide : personnalisation | Absent | P3 | Interface | absent |
| AC-011 | Ruban | Options d'affichage du ruban (réduire, onglets seuls, toujours afficher) | Partiel | P3 | Interface | Réduire le ruban fourni par packages/ui |
| AC-012 | Ruban | Onglets contextuels colorés (groupe « Outils de table », etc.) | Présent à vérifier | P2 | Interface | ribbon.tsx contextual() + CTX_COLOR |
| AC-013 | Ruban | Info-bulles améliorées (titre + description + raccourci) | Partiel | P3 | Interface | btn(...tip) : seulement sur quelques boutons, sans raccourci |
| AC-014 | Ruban | Touches d'accès du ruban (Alt puis lettres) | Absent | P2 | Interface | absent |

## 2. Onglet Accueil

> Groupes observés : Affichages ; Presse-papiers ; Trier et filtrer ; Enregistrements ; Rechercher ; Mise en forme du texte.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-015 | Ruban | Affichages > Affichage (bouton partagé : Mode Feuille de données, Création, SQL, Page, Formulaire, État, Aperçu) | Présent à vérifier | P1 | Interface | ribbon.tsx viewGroup + VIEWS_BY_KIND |
| AC-016 | Ruban | Presse-papiers > Coller (partagé : Coller, Collage spécial, Coller en tant qu'ajout) | Partiel | P1 | Interface | ribbon.tsx paste (cellule seulement ; pas de collage spécial ni d'ajout d'enregistrements) |
| AC-017 | Ruban | Presse-papiers > Couper | Présent à vérifier | P1 | Interface | ribbon.tsx cut |
| AC-018 | Ruban | Presse-papiers > Copier | Présent à vérifier | P1 | Interface | ribbon.tsx copy |
| AC-019 | Ruban | Presse-papiers > Reproduire la mise en forme | Absent | P2 | Interface | absent (nécessite des propriétés de mise en forme sur les contrôles) |
| AC-020 | Ruban | Presse-papiers > Presse-papiers Office (lanceur) | Absent | P3 | Interface | absent |
| AC-021 | Ruban | Trier et filtrer > Filtrer (menu du filtre de colonne : tri, Filtres de texte/nombres/dates, liste de valeurs cochables) | Partiel | P1 | Interface | ribbon.tsx filter -> columnFilterMenu ; liste de valeurs OK ; pas de « Filtres de texte/nombres/dates » (Égal, Commence par, Entre, Dates relatives) ; 2026-11-06 : menu de colonne complété par les sous-menus « Filtres de texte / numériques / de dates » (boîte de valeur, tests custom-filter.test.ts, capture) |
| AC-022 | Ruban | Trier et filtrer > Croissant | Présent à vérifier | P1 | Interface | ribbon.tsx asc |
| AC-023 | Ruban | Trier et filtrer > Décroissant | Présent à vérifier | P1 | Interface | ribbon.tsx desc |
| AC-024 | Ruban | Trier et filtrer > Supprimer un tri | Présent à vérifier | P1 | Interface | ribbon.tsx clearSort |
| AC-025 | Ruban | Trier et filtrer > Sélection (Égal à, Différent de, Contient, Ne contient pas, Inférieur/Supérieur ou égal, Entre) | Partiel | P1 | Interface | ribbon.tsx selection : 4 opérateurs sur 7 ; le moteur a déjà Inférieur/Supérieur (donnees.rs Operateur) |
| AC-026 | Ruban | Trier et filtrer > Options avancées > Filtrer par formulaire | Absent | P2 | Interface | absent |
| AC-027 | Ruban | Trier et filtrer > Options avancées > Filtre/tri avancé (grille QBE de filtre) | Absent | P2 | Interface | absent |
| AC-028 | Ruban | Trier et filtrer > Options avancées > Charger à partir d'une requête / Enregistrer en tant que requête | Absent | P3 | Interface | absent |
| AC-029 | Ruban | Trier et filtrer > Options avancées > Effacer tous les filtres | Présent à vérifier | P1 | Interface | ribbon.tsx adv -> clearFilters |
| AC-030 | Ruban | Trier et filtrer > Activer/désactiver le filtre | Présent à vérifier | P1 | Interface | ribbon.tsx toggleFilter |
| AC-031 | Ruban | Enregistrements > Actualiser tout (menu : Actualiser, Annuler) | Partiel | P2 | Interface | ribbon.tsx refresh (sans le menu) |
| AC-032 | Ruban | Enregistrements > Nouveau | Présent à vérifier | P1 | Interface | ribbon.tsx newRecord |
| AC-033 | Ruban | Enregistrements > Enregistrer | Présent à vérifier | P1 | Interface | ribbon.tsx saveRecord |
| AC-034 | Ruban | Enregistrements > Supprimer (menu : Supprimer l'enregistrement, Supprimer la colonne) | Partiel | P1 | Interface | ribbon.tsx deleteRecord (enregistrement seulement) |
| AC-035 | Ruban | Enregistrements > Totaux (ligne de totaux avec fonctions) | Présent à vérifier | P1 | Interface | Datasheet.tsx totalsOn + TOTAL_FNS ; moteur FonctionTotal (donnees.rs) |
| AC-036 | Ruban | Enregistrements > Orthographe (F7) | Partiel | P3 | Interface | attribut spellcheck du système, pas de dictionnaire ni de dialogue |
| AC-037 | Ruban | Enregistrements > Plus > Hauteur de ligne | Partiel | P2 | Interface | absent ; 2026-11-06 : Hauteur de ligne… et Hauteur standard dans le menu du sélecteur de ligne (mémorisée par table) ; pas encore dans le ruban Plus |
| AC-038 | Ruban | Enregistrements > Plus > Largeur de colonne | Partiel | P1 | Interface | absent (STATUS : pas de largeur de colonne réglable) ; 2026-11-06 : largeur par glissement du bord d'en-tête, double-clic = ajuster, Largeur du champ…, Largeur standard (menu d'en-tête, columns-layout.ts, capture) ; pas dans le ruban Plus |
| AC-039 | Ruban | Enregistrements > Plus > Masquer / Afficher les champs | Absent | P2 | Interface | absent |
| AC-040 | Ruban | Enregistrements > Plus > Figer les champs / Libérer tous les champs | Partiel | P2 | Interface | absent ; 2026-11-06 : Figer les champs jusqu'ici / Libérer tous les champs dans le menu d'en-tête (colonnes collantes testées en vrai) ; pas dans le ruban Plus |
| AC-041 | Ruban | Enregistrements > Plus > Sous-feuille de données | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-042 | Ruban | Rechercher > Rechercher (Ctrl+F : Rechercher dans, Critères, Respecter la casse, À partir du début) | Partiel | P1 | Interface | Datasheet.tsx champ de recherche simple, sans dialogue à options |
| AC-043 | Ruban | Rechercher > Remplacer (Ctrl+H) | Présent à vérifier | P1 | Interface | ribbon.tsx replace -> op remplacer_tout (donnees.rs) |
| AC-044 | Ruban | Rechercher > Atteindre (Premier, Précédent, Suivant, Dernier, Nouveau) | Présent à vérifier | P2 | Interface | ribbon.tsx goTo |
| AC-045 | Ruban | Rechercher > Sélectionner (Sélectionner, Tout sélectionner) | Absent | P3 | Interface | absent |
| AC-046 | Ruban | Mise en forme du texte > Police | Absent | P2 | Interface | absent (feuille de données et formulaires) |
| AC-047 | Ruban | Mise en forme du texte > Taille de police | Absent | P2 | Interface | absent |
| AC-048 | Ruban | Mise en forme du texte > Gras / Italique / Souligner | Absent | P2 | Interface | absent |
| AC-049 | Ruban | Mise en forme du texte > Couleur de police | Absent | P3 | Interface | absent |
| AC-050 | Ruban | Mise en forme du texte > Couleur de surlignage du texte | Absent | P3 | Interface | absent |
| AC-051 | Ruban | Mise en forme du texte > Couleur d'arrière-plan / Couleur de ligne alternée | Absent | P3 | Interface | absent |
| AC-052 | Ruban | Mise en forme du texte > Aligner à gauche / Centrer / Aligner à droite | Absent | P2 | Interface | absent (seul l'alignement par champ existe, TableDesign.tsx « Aligner le texte ») |
| AC-053 | Ruban | Mise en forme du texte > Puces / Numérotation / Retrait (texte enrichi) | Absent | P3 | Moteur + Interface | absent ; pas de type « Texte enrichi » (format_texte existe dans ProprietesChamp, types.rs) |
| AC-054 | Ruban | Mise en forme du texte > De gauche à droite / De droite à gauche | Absent | P3 | Interface | absent |
| AC-055 | Ruban | Mise en forme du texte > Quadrillage (horizontal, vertical, les deux, aucun) | Absent | P3 | Interface | absent |
| AC-056 | Ruban | Mise en forme du texte > Feuille de données… (dialogue : effet, couleurs, style de ligne) | Absent | P3 | Interface | absent |

## 3. Onglet Créer

> Groupes observés : Modèles ; Tables ; Requêtes ; Formulaires ; États ; Macros et code.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-057 | Ruban | Modèles > Composants d'application (galerie) | Partiel | P3 | Interface | ribbon.tsx appParts : 4 modèles Contacts, Inventaire, Tâches, Factures (logic/templates.ts) |
| AC-058 | Ruban | Tables > Table | Présent à vérifier | P1 | Interface | ribbon.tsx table |
| AC-059 | Ruban | Tables > Création de table | Présent à vérifier | P1 | Interface | ribbon.tsx tdesign -> TableDesign.tsx |
| AC-060 | Ruban | Tables > Listes SharePoint | Absent | P3 | Interface | sans objet (service Microsoft) ; remplacer par « liaison à un fichier distant » |
| AC-061 | Ruban | Requêtes > Assistant Requête (simple, analyse croisée, doublons, non-correspondance) | Absent | P1 | Interface | ribbon.tsx qwiz ouvre le même créateur que Création ; aucun assistant |
| AC-062 | Ruban | Requêtes > Création de requête | Présent à vérifier | P1 | Interface | ribbon.tsx qdesign -> QueryDesign.tsx |
| AC-063 | Ruban | Formulaires > Formulaire (lié à l'objet sélectionné) | Présent à vérifier | P1 | Interface | ribbon.tsx form (mode Page) |
| AC-064 | Ruban | Formulaires > Création de formulaire | Présent à vérifier | P1 | Interface | ribbon.tsx fdesign |
| AC-065 | Ruban | Formulaires > Formulaire vierge | Absent | P2 | Interface | absent |
| AC-066 | Ruban | Formulaires > Assistant Formulaire | Absent | P1 | Interface | absent |
| AC-067 | Ruban | Formulaires > Navigation (galerie : onglets horizontaux/verticaux) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-068 | Ruban | Formulaires > Plus de formulaires > Plusieurs éléments | Présent à vérifier | P2 | Interface | ribbon.tsx multi (disposition tabulaire) |
| AC-069 | Ruban | Formulaires > Plus de formulaires > Feuille de données | Présent à vérifier | P2 | Interface | ribbon.tsx ds |
| AC-070 | Ruban | Formulaires > Plus de formulaires > Formulaire double affichage | Présent à vérifier | P2 | Interface | ribbon.tsx split (double_affichage) |
| AC-071 | Ruban | Formulaires > Plus de formulaires > Boîte de dialogue modale | Absent | P3 | Interface | absent |
| AC-072 | Ruban | États > État | Présent à vérifier | P1 | Interface | ribbon.tsx report |
| AC-073 | Ruban | États > Création d'état | Présent à vérifier | P1 | Interface | ribbon.tsx rdesign |
| AC-074 | Ruban | États > État vide | Absent | P2 | Interface | absent |
| AC-075 | Ruban | États > Assistant État | Absent | P1 | Interface | absent |
| AC-076 | Ruban | États > Étiquettes (assistant d'étiquettes) | Absent | P2 | Moteur + Interface | absent |
| AC-077 | Ruban | Macros et code > Macro | Présent à vérifier | P1 | Interface | ribbon.tsx macro -> MacroView.tsx |
| AC-078 | Ruban | Macros et code > Module | Absent | P3 | Moteur + Pont Tauri + Interface | moteur : GenreObjet::Module stocke du texte (objets.rs) ; aucun éditeur ni exécution |
| AC-079 | Ruban | Macros et code > Module de classe | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-080 | Ruban | Macros et code > Visual Basic (éditeur) | Absent | P3 | Interface | absent |

## 4. Onglet Données externes

> Groupes observés : Importer et lier ; Exporter.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-081 | Ruban | Importer et lier > Nouvelle source de données (Fichier > Excel, Access, ODBC, texte, XML, Outlook, Dataverse, SharePoint, HTML, SQL Server, Azure, Dynamics, Redshift) | Partiel | P1 | Interface | ribbon.tsx newsrc : Excel et Fichier texte seulement |
| AC-082 | Ruban | Importer et lier > Excel (import ET liaison) | Partiel | P1 | Interface | exchange.ts importFile ; import seulement, pas de liaison |
| AC-083 | Ruban | Importer et lier > Fichier texte (assistant délimité/largeur fixe, spécifications) | Partiel | P1 | Interface | exchange.ts, Dialogs.tsx ImportDialog ; CSV seulement (délimiteur deviné, csv.rs), pas de largeur fixe ni de spécifications |
| AC-084 | Ruban | Importer et lier > Base de données Access (.accdb/.mdb) | Partiel | P1 | Moteur + Pont Tauri + Interface | moteur : import_access.rs + access_lecteur.rs (tables seulement, Rust pur) ; ni opération dans base_cmds.rs ni UI |
| AC-085 | Ruban | Importer et lier > XML | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-086 | Ruban | Importer et lier > Base de données ODBC / SQL Server / Azure | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-087 | Ruban | Importer et lier > HTML | Absent | P3 | Interface | absent |
| AC-088 | Ruban | Importer et lier > Dossier Outlook | Absent | P3 | Interface | sans objet |
| AC-089 | Ruban | Importer et lier > Importations enregistrées | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-090 | Ruban | Importer et lier > Gestionnaire de tables liées | Absent | P3 | Moteur + Pont Tauri + Interface | absent (aucune table liée) |
| AC-091 | Ruban | Exporter > Exportations enregistrées | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-092 | Ruban | Exporter > Excel | Présent à vérifier | P1 | Interface | ribbon.tsx exl -> exchange.ts exportAs('excel') |
| AC-093 | Ruban | Exporter > Fichier texte | Présent à vérifier | P1 | Interface | ribbon.tsx etxt (CSV, csv.rs OptionsExport) |
| AC-094 | Ruban | Exporter > PDF ou XPS | Absent | P1 | Interface | absent (impression d'état par le navigateur seulement) |
| AC-095 | Ruban | Exporter > Envoyer par courrier | Absent | P3 | Interface | absent |
| AC-096 | Ruban | Exporter > Access (copier un objet vers une autre base) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-097 | Ruban | Exporter > Publipostage Word | Absent | P3 | Interface | absent ; équivalent possible vers le module Texte |
| AC-098 | Ruban | Exporter > Dataverse / Liste SharePoint | Absent | P3 | Interface | sans objet |
| AC-099 | Ruban | Exporter > Plus > Fichier XML / ODBC / dBASE / RTF Word | Absent | P2 | Interface | absent |
| AC-100 | Ruban | Exporter > Plus > Document HTML | Présent à vérifier | P2 | Interface | ribbon.tsx ehtml |

## 5. Onglet Outils de base de données

> Groupes observés : Outils ; Macro ; Relations ; Analyser ; Déplacer les données ; Compléments.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-101 | Ruban | Outils > Compacter et réparer une base de données | OK | P1 | Moteur + Pont Tauri + Interface | ribbon.tsx compact ; base.rs compacter |
| AC-102 | Ruban | Outils > Vérifier l'intégrité (extension ForgeOffice) | OK | P2 | Moteur + Pont Tauri + Interface | ribbon.tsx integrity ; verifier_integrite |
| AC-103 | Ruban | Macro > Visual Basic | Absent | P3 | Interface | absent |
| AC-104 | Ruban | Macro > Exécuter une macro (boîte de choix) | Partiel | P2 | Interface | macros lançables depuis le volet de navigation seulement |
| AC-105 | Ruban | Relations > Relations | Présent à vérifier | P1 | Interface | ribbon.tsx relations -> Relations.tsx |
| AC-106 | Ruban | Relations > Dépendances d'objet (volet) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-107 | Ruban | Analyser > Documentation de base de données (Documenteur : sélection d'objets + options) | Partiel | P2 | Interface | ribbon.tsx doc -> ToolsViews.tsx ; pas de choix d'objets ni d'options |
| AC-108 | Ruban | Analyser > Analyse des performances | Partiel | P3 | Interface | ribbon.tsx perf -> logic/analyze.ts (conseils de conception seulement) |
| AC-109 | Ruban | Analyser > Analyser la table (assistant de normalisation) | Partiel | P3 | Interface | logic/analyze.ts (idem) |
| AC-110 | Ruban | Déplacer les données > Base de données Access (scinder données/interface) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-111 | Ruban | Déplacer les données > SharePoint | Absent | P3 | Interface | sans objet |
| AC-112 | Ruban | Compléments (menu) | Absent | P3 | Interface | absent |
| AC-113 | Ruban | Chiffrer avec un mot de passe (Fichier > Informations) | Absent | P1 | Moteur + Pont Tauri + Interface | absent ; base .fodb SQLite non chiffrée (SQLCipher en Au-delà) |
| AC-114 | Ruban | Décrypter la base de données | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-115 | Ruban | Créer un fichier ACCDE / ACCDR | Absent | P3 | Interface | sans objet |

## 6. Onglet Aide

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-116 | Ruban | Aide (F1) | Absent | P3 | Interface | absent dans ribbon.tsx |
| AC-117 | Ruban | Contacter le support | Absent | P3 | Interface | absent |
| AC-118 | Ruban | Commentaires | Absent | P3 | Interface | absent |
| AC-119 | Ruban | Afficher la formation | Absent | P3 | Interface | absent |

## 7. Onglets contextuels : Outils de table (Champs, Table, Création)

> Vérité-terrain UIA : onglet « Table & Champs » (affiché « Champs »), « Table », « Création de tableau » (Création de table).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-120 | Ruban | Champs > Affichages > Affichage | Présent à vérifier | P1 | Interface | ribbon.tsx fields -> viewGroup |
| AC-121 | Ruban | Champs > Ajouter et supprimer > Texte court | Présent à vérifier | P1 | Interface | ribbon.tsx ftext |
| AC-122 | Ruban | Champs > Ajouter et supprimer > Nombre | Présent à vérifier | P1 | Interface | ribbon.tsx fnum (Réel double seulement ; la taille s'ajuste en Création) |
| AC-123 | Ruban | Champs > Ajouter et supprimer > Monétaire | Présent à vérifier | P1 | Interface | ribbon.tsx fcur |
| AC-124 | Ruban | Champs > Ajouter et supprimer > Date et heure | Présent à vérifier | P1 | Interface | ribbon.tsx fdate |
| AC-125 | Ruban | Champs > Ajouter et supprimer > Oui/Non | Présent à vérifier | P1 | Interface | ribbon.tsx fyes |
| AC-126 | Ruban | Champs > Ajouter et supprimer > Plus de champs (galerie : Texte long, Grand nombre, Date étendue, Pièce jointe, Lien hypertexte, Liste de choix et relation, Texte enrichi, Champ calculé, Coller en tant que champs, modèles Adresse/Nom/Téléphone/Priorité/État…) | Partiel | P2 | Interface | les types existent dans le moteur (types.rs TOUS_LES_TYPES) mais pas dans cette galerie ; Mode Création les propose |
| AC-127 | Ruban | Champs > Ajouter et supprimer > Supprimer | Présent à vérifier | P1 | Interface | ribbon.tsx fdel |
| AC-128 | Ruban | Champs > Propriétés > Nom et légende | Partiel | P2 | Interface | ribbon.tsx nom affiché ; édition par Création de table |
| AC-129 | Ruban | Champs > Propriétés > Valeur par défaut | Partiel | P2 | Interface | seulement en Mode Création (TableDesign.tsx) |
| AC-130 | Ruban | Champs > Propriétés > Taille du champ | Partiel | P2 | Interface | seulement en Mode Création |
| AC-131 | Ruban | Champs > Propriétés > Modifier les recherches (liste de choix) | Partiel | P2 | Interface | TableDesign.tsx onglet Liste de choix ; pas d'assistant |
| AC-132 | Ruban | Champs > Propriétés > Modifier l'expression (champ calculé) | Partiel | P2 | Interface | TableDesign.tsx Expression ; pas de générateur |
| AC-133 | Ruban | Champs > Propriétés > Paramètres de mémo (Ajout seulement / Format texte enrichi) | Absent | P3 | Moteur + Interface | absent |
| AC-134 | Ruban | Champs > Mise en forme > Type de données (liste) | Absent | P1 | Interface | absent du ruban (existe en Création) |
| AC-135 | Ruban | Champs > Mise en forme > Format (liste) | Absent | P1 | Interface | absent du ruban (propriété Format en Création) |
| AC-136 | Ruban | Champs > Mise en forme > Format monétaire / pourcentage / virgule / décimales + / – | Absent | P2 | Interface | absent |
| AC-137 | Ruban | Champs > Validation de champ > Obligatoire | Présent à vérifier | P1 | Interface | ribbon.tsx req |
| AC-138 | Ruban | Champs > Validation de champ > Unique | Partiel | P2 | Interface | ribbon.tsx n'a que « Indexé » ; moteur : Indexation::SansDoublons |
| AC-139 | Ruban | Champs > Validation de champ > Indexé | Présent à vérifier | P1 | Interface | ribbon.tsx idx |
| AC-140 | Ruban | Champs > Validation de champ > Validation (Règle de validation de champ / de l'enregistrement) | Partiel | P2 | Interface | champ valide_si (TableDesign.tsx) ; pas de règle d'enregistrement |
| AC-141 | Ruban | Table > Propriétés > Propriétés de la table (description, règle de validation, tri par défaut, filtre) | Présent à vérifier | P2 | Interface | ribbon.tsx tprops -> TableDesign.tsx |
| AC-142 | Ruban | Table > Avant les événements > Avant modification / Avant suppression (macros de données) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-143 | Ruban | Table > Après les événements > Après insertion / MAJ / suppression (macros de données) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-144 | Ruban | Table > Macros nommées > Macro nommée | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-145 | Ruban | Table > Relations > Relations | Présent à vérifier | P2 | Interface | ribbon.tsx trel |
| AC-146 | Ruban | Table > Relations > Dépendances d'objet | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-147 | Ruban | Création de table > Affichages > Affichage | Présent à vérifier | P1 | Interface | ribbon.tsx design |
| AC-148 | Ruban | Création de table > Outils > Clé primaire | Présent à vérifier | P1 | Interface | ribbon.tsx pk |
| AC-149 | Ruban | Création de table > Outils > Générateur (expression, masque, validation) | Absent | P1 | Interface | absent |
| AC-150 | Ruban | Création de table > Outils > Tester les règles de validation | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-151 | Ruban | Création de table > Outils > Insérer des lignes | Présent à vérifier | P1 | Interface | ribbon.tsx ins |
| AC-152 | Ruban | Création de table > Outils > Supprimer les lignes | Présent à vérifier | P1 | Interface | ribbon.tsx delr |
| AC-153 | Ruban | Création de table > Outils > Modifier les recherches | Partiel | P2 | Interface | onglet Liste de choix de la feuille de propriétés |
| AC-154 | Ruban | Création de table > Afficher/Masquer > Feuille de propriétés | Présent à vérifier | P2 | Interface | ribbon.tsx sheet |
| AC-155 | Ruban | Création de table > Afficher/Masquer > Index (fenêtre des index multi-champs) | Absent | P1 | Pont Tauri + Interface | moteur prêt : index.rs creer_index/supprimer_index/lister_index_nommes ; aucune opération Tauri, aucune fenêtre |
| AC-156 | Ruban | Création de table > Champ, enregistrement et événements > Créer des macros de données / Renommer-supprimer une macro | Absent | P3 | Moteur + Pont Tauri + Interface | absent |

## 8. Onglets contextuels : requête

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-157 | Ruban | Conception de requêtes > Résultats > Affichage | Présent à vérifier | P1 | Interface | ribbon.tsx qdesign viewGroup |
| AC-158 | Ruban | Conception de requêtes > Résultats > Exécuter | Présent à vérifier | P1 | Interface | ribbon.tsx run |
| AC-159 | Ruban | Conception de requêtes > Type de requête > Sélection | Présent à vérifier | P1 | Interface | ribbon.tsx types |
| AC-160 | Ruban | Conception de requêtes > Type de requête > Création de table | Présent à vérifier | P1 | Interface | ribbon.tsx (creation_table) |
| AC-161 | Ruban | Conception de requêtes > Type de requête > Ajout | Présent à vérifier | P1 | Interface | ribbon.tsx (ajout) |
| AC-162 | Ruban | Conception de requêtes > Type de requête > Mise à jour | Présent à vérifier | P1 | Interface | ribbon.tsx (mise_a_jour) |
| AC-163 | Ruban | Conception de requêtes > Type de requête > Analyse croisée | Présent à vérifier | P1 | Interface | ribbon.tsx (analyse_croisee) ; RoleAnalyse dans concepteur.rs |
| AC-164 | Ruban | Conception de requêtes > Type de requête > Suppression | Présent à vérifier | P1 | Interface | ribbon.tsx (suppression) |
| AC-165 | Ruban | Conception de requêtes > Type de requête > Union | Absent | P2 | Interface | GenreRequete 'union' existe dans types.ts ligne 146 mais aucun bouton ; le mode SQL accepte UNION |
| AC-166 | Ruban | Conception de requêtes > Type de requête > SQL direct (Pass-Through) | Absent | P3 | Interface | GenreRequete 'sql' ; pas de bouton dédié (le mode SQL existe) |
| AC-167 | Ruban | Conception de requêtes > Type de requête > Définition des données (CREATE TABLE…) | Absent | P3 | Interface | mode SQL exécute du DDL ; pas de type dédié |
| AC-168 | Ruban | Conception de requêtes > Paramétrage > Ajouter des tables | Présent à vérifier | P1 | Interface | ribbon.tsx addt |
| AC-169 | Ruban | Conception de requêtes > Paramétrage > Insérer des lignes / Supprimer les lignes | Absent | P3 | Interface | absent (lignes de critères) |
| AC-170 | Ruban | Conception de requêtes > Paramétrage > Générateur (expressions) | Absent | P1 | Interface | absent |
| AC-171 | Ruban | Conception de requêtes > Paramétrage > Insérer des colonnes / Supprimer des colonnes | Partiel | P2 | Interface | QueryDesign.tsx menu de colonne = supprimer seulement |
| AC-172 | Ruban | Conception de requêtes > Paramétrage > Renvoyer (Tout, 5, 25, 100, 5 %, 25 %, Valeurs distinctes) | Partiel | P1 | Interface | ribbon.tsx top (Tout, 5, 25, 100 ; pas de pourcentage) |
| AC-173 | Ruban | Conception de requêtes > Afficher/Masquer > Totaux | Présent à vérifier | P1 | Interface | ribbon.tsx qtot |
| AC-174 | Ruban | Conception de requêtes > Afficher/Masquer > Paramètres (boîte Paramètres de requête) | Partiel | P2 | Interface | QueryDesign.tsx q.params |
| AC-175 | Ruban | Conception de requêtes > Afficher/Masquer > Feuille de propriétés de la requête (Valeurs distinctes, Enregistrements uniques, Source de données, Verrous) | Absent | P2 | Interface | absent (Valeurs distinctes déjà en cases) |
| AC-176 | Ruban | Conception de requêtes > Afficher/Masquer > Noms des tables | Absent | P3 | Interface | absent |

## 9. Onglets contextuels : formulaire

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-177 | Ruban | Conception de formulaires > Affichages > Affichage | Présent à vérifier | P1 | Interface | ribbon.tsx fdesign viewGroup |
| AC-178 | Ruban | Conception de formulaires > Thèmes > Thèmes / Couleurs / Polices | Absent | P2 | Moteur + Pont Tauri + Interface | absent (thèmes de formulaire) |
| AC-179 | Ruban | Conception de formulaires > Contrôles > galerie de contrôles (Zone de texte, Étiquette, Bouton, Onglet, Lien hypertexte, Navigateur web, Navigation, Groupe d'options, Saut de page, Zone de liste déroulante, Graphique, Ligne, Bouton bascule, Zone de liste, Rectangle, Case à cocher, Cadre d'objet indépendant, Pièce jointe, Bouton d'option, Sous-formulaire/Sous-état, Cadre d'objet dépendant, Image) | Partiel | P1 | Interface | ribbon.tsx : 2 contrôles seulement (Étiquette, Zone de texte) ; voir section Contrôles |
| AC-180 | Ruban | Conception de formulaires > Contrôles > Utiliser les Assistants Contrôle | Absent | P2 | Interface | absent |
| AC-181 | Ruban | Conception de formulaires > Contrôles > Insérer une image | Absent | P2 | Interface | absent |
| AC-182 | Ruban | Conception de formulaires > Contrôles > Insérer un graphique moderne | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-183 | Ruban | Conception de formulaires > En-tête/pied de page > Logo / Titre / Date et heure | Absent | P2 | Interface | absent (titre via la maquette seulement) |
| AC-184 | Ruban | Conception de formulaires > Outils > Ajouter des champs existants (liste de champs) | Présent à vérifier | P1 | Interface | ribbon.tsx fields -> FormView.tsx liste de champs |
| AC-185 | Ruban | Conception de formulaires > Outils > Feuille de propriétés (F4) | Absent | P1 | Interface | absent : aucun contrôle ni formulaire n'a de propriétés éditables |
| AC-186 | Ruban | Conception de formulaires > Outils > Ordre de tabulation | Absent | P2 | Interface | absent |
| AC-187 | Ruban | Conception de formulaires > Outils > Paramètres du graphique | Absent | P3 | Interface | absent |
| AC-188 | Ruban | Conception de formulaires > Outils > Sous-formulaire dans une nouvelle fenêtre | Absent | P3 | Interface | absent |
| AC-189 | Ruban | Conception de formulaires > Outils > Visualiser le code | Absent | P3 | Interface | absent |
| AC-190 | Ruban | Conception de formulaires > Outils > Convertir les macros de formulaire en Visual Basic | Absent | P3 | Interface | sans objet |
| AC-191 | Ruban | Organiser > Table > Quadrillage / Empilé / Tabulaire / Supprimer la disposition | Absent | P1 | Moteur + Interface | absent (aucun groupe de disposition) |
| AC-192 | Ruban | Organiser > Lignes et colonnes > Insérer au-dessus / en dessous / à gauche / à droite | Absent | P2 | Moteur + Interface | absent |
| AC-193 | Ruban | Organiser > Lignes et colonnes > Sélectionner une disposition / colonne / ligne | Absent | P2 | Interface | absent |
| AC-194 | Ruban | Organiser > Fusionner/fractionner > Fusionner / Fractionner verticalement / horizontalement | Absent | P3 | Interface | absent |
| AC-195 | Ruban | Organiser > Déplacer > Monter / Descendre | Absent | P3 | Interface | absent |
| AC-196 | Ruban | Organiser > Position > Marges du contrôle / Remplissage du contrôle / Ancrage | Absent | P2 | Moteur + Interface | absent |
| AC-197 | Ruban | Organiser > Redimensionnement et classement > Taille/Espace (Ajuster, Plus grand, Plus étroit, Espacement horizontal/vertical) | Absent | P1 | Interface | absent |
| AC-198 | Ruban | Organiser > Redimensionnement et classement > Aligner (Grille, Gauche, Droite, Haut, Bas) | Absent | P1 | Interface | absent (seul le magnétisme 4 px existe, DesignCanvas.tsx GRID) |
| AC-199 | Ruban | Organiser > Redimensionnement et classement > Premier plan / Arrière-plan | Absent | P2 | Interface | absent |
| AC-200 | Ruban | Format > Sélection > Objet (liste des contrôles) / Sélectionner tout | Absent | P1 | Interface | absent (pas de sélection multiple) |
| AC-201 | Ruban | Format > Police > Police, Taille, Gras, Italique, Souligner, Couleurs, Alignements | Absent | P1 | Moteur + Interface | absent (aucune mise en forme de contrôle ; Controle n'a pas de police) |
| AC-202 | Ruban | Format > Police > Reproduire la mise en forme | Absent | P2 | Interface | absent |
| AC-203 | Ruban | Format > Nombre > Format, monétaire, pourcentage, virgule, décimales | Absent | P2 | Moteur + Interface | format de champ du moteur (types.rs ProprietesChamp.format) mais aucune propriété de contrôle |
| AC-204 | Ruban | Format > Arrière-plan > Image d'arrière-plan / Couleur de ligne alternée | Absent | P2 | Moteur + Interface | absent |
| AC-205 | Ruban | Format > Contrôler la mise en forme > Styles rapides / Modifier la forme / Remplissage / Contour / Effets | Absent | P3 | Moteur + Interface | absent |
| AC-206 | Ruban | Format > Contrôler la mise en forme > Mise en forme conditionnelle | Absent | P2 | Moteur + Pont Tauri + Interface | absent |

## 10. Onglets contextuels : état

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-207 | Ruban | Conception du rapport (état) > Affichages > Affichage | Présent à vérifier | P1 | Interface | ribbon.tsx etat viewGroup |
| AC-208 | Ruban | Conception du rapport > Thèmes > Thèmes / Couleurs / Polices | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-209 | Ruban | Conception du rapport > Regroupement et totaux > Regrouper et trier (volet) | Partiel | P1 | Interface | ribbon.tsx groupby : un seul niveau côté UI ; le moteur gère plusieurs niveaux (etats.rs NIVEAUX_MAX) |
| AC-210 | Ruban | Conception du rapport > Regroupement et totaux > Totaux (Somme, Moyenne, Compte, Min, Max…) | Partiel | P1 | Interface | totaux de groupe et généraux (logic/report.ts) ; pas de menu par champ |
| AC-211 | Ruban | Conception du rapport > Regroupement et totaux > Masquer les détails | Absent | P2 | Interface | absent |
| AC-212 | Ruban | Conception du rapport > Contrôles > galerie de contrôles | Partiel | P1 | Interface | ribbon.tsx : aucun bouton Contrôles en état (addControl absent d'ReportView) |
| AC-213 | Ruban | Conception du rapport > En-tête/pied de page > Numéros de page | Absent | P1 | Moteur + Interface | absent (pied « Page n sur N » fixe) |
| AC-214 | Ruban | Conception du rapport > En-tête/pied de page > Logo / Titre / Date et heure | Absent | P2 | Interface | absent |
| AC-215 | Ruban | Conception du rapport > Outils > Ajouter des champs existants / Feuille de propriétés / Ordre de tabulation | Absent | P1 | Interface | liste de champs absente en état ; feuille de propriétés absente |
| AC-216 | Ruban | Conception du rapport > Outils > Sous-état dans une nouvelle fenêtre / Visualiser le code / Convertir les macros | Absent | P3 | Interface | absent |
| AC-217 | Ruban | Organiser, Format (état) | Absent | P2 | Interface | mêmes groupes qu'en formulaire (Position : sans Ancrage) ; tous absents |
| AC-218 | Ruban | Mise en page (état) > Taille de la page > Taille (A4, Lettre…) / Marges (Normales, Larges, Étroites) / Afficher les marges / Données seulement | Absent | P1 | Moteur + Interface | absent (seule l'orientation existe) |
| AC-219 | Ruban | Mise en page (état) > Mise en page > Portrait / Paysage | Présent à vérifier | P1 | Interface | ribbon.tsx por/land |
| AC-220 | Ruban | Mise en page (état) > Mise en page > Colonnes / Mise en page… | Absent | P2 | Moteur + Interface | absent |
| AC-221 | Ruban | Aperçu avant impression > Imprimer | Présent à vérifier | P1 | Interface | ribbon.tsx print (window.print) |
| AC-222 | Ruban | Aperçu avant impression > Taille de la page > Taille / Marges / Afficher les marges / Données seulement | Absent | P1 | Moteur + Interface | absent |
| AC-223 | Ruban | Aperçu avant impression > Mise en page > Portrait / Paysage | Présent à vérifier | P1 | Interface | ribbon.tsx |
| AC-224 | Ruban | Aperçu avant impression > Mise en page > Colonnes / Mise en page… | Absent | P2 | Moteur + Interface | absent |
| AC-225 | Ruban | Aperçu avant impression > Zoom > Zoom / Une page / Deux pages / Plus de pages | Absent | P2 | Interface | absent (pagination fixe) |
| AC-226 | Ruban | Aperçu avant impression > Données > Actualiser tout, Excel, Fichier texte, PDF ou XPS, Envoyer par courrier, Plus | Absent | P2 | Interface | absent (exports depuis l'état) |
| AC-227 | Ruban | Aperçu avant impression > Fermer l'aperçu | Présent à vérifier | P1 | Interface | ribbon.tsx cp |

## 11. Onglets contextuels : relations et macros

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-228 | Ruban | Conception de relations > Outils > Modifier les relations | Présent à vérifier | P1 | Interface | ribbon.tsx edit |
| AC-229 | Ruban | Conception de relations > Outils > Effacer la disposition | Présent à vérifier | P2 | Interface | ribbon.tsx clear |
| AC-230 | Ruban | Conception de relations > Outils > Rapport de relations | Absent | P3 | Interface | absent |
| AC-231 | Ruban | Conception de relations > Relations > Ajouter des tables | Présent à vérifier | P1 | Interface | ribbon.tsx addt |
| AC-232 | Ruban | Conception de relations > Relations > Masquer la table | Partiel | P2 | Interface | Relations.tsx par le menu de boîte seulement |
| AC-233 | Ruban | Conception de relations > Relations > Relations directes | Absent | P3 | Interface | absent |
| AC-234 | Ruban | Conception de relations > Relations > Toutes les relations | Présent à vérifier | P2 | Interface | ribbon.tsx all |
| AC-235 | Ruban | Conception de relations > Fermer | Présent à vérifier | P3 | Interface | ribbon.tsx close |
| AC-236 | Ruban | Conception de macros > Outils > Exécuter | Présent à vérifier | P1 | Interface | ribbon.tsx run |
| AC-237 | Ruban | Conception de macros > Outils > Pas-à-pas | Absent | P2 | Interface | S.cmd.singleStep défini mais aucun bouton ni mode |
| AC-238 | Ruban | Conception de macros > Outils > Convertir les macros en Visual Basic | Absent | P3 | Interface | sans objet |
| AC-239 | Ruban | Conception de macros > Réduire/Développer > Développer/Réduire les actions, tout | Absent | P3 | Interface | absent |
| AC-240 | Ruban | Conception de macros > Afficher/Masquer > Afficher toutes les actions | Absent | P3 | Interface | absent |
| AC-241 | Ruban | Conception de macros > Afficher/Masquer > Catalogue d'actions | Absent | P2 | Interface | absent (liste déroulante d'actions par ligne) |
| AC-242 | Ruban | Conception de macros > Ajouter une action / Si / Sinon / Sous-macro / Groupe | Partiel | P1 | Interface | ribbon.tsx add ; condition par action, pas de blocs Si/Sinon, Sous-macro, Groupe |
| AC-243 | Ruban | Mode Page (formulaire/état) > onglet « Organiser » / « Format » / « Mise en page » (Disposition) | Absent | P1 | Interface | le mode Page est un canevas libre sans moteur de disposition (STATUS) |

## 12. Volet de navigation (fonctions et menus)

> Source des menus : CommandBars d'Access (type popup) lues par COM, noms internes entre crochets. ForgeOffice : NavPane.tsx (une catégorie fixe, groupes par type d'objet, recherche, menu d'objet à 8 entrées).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-244 | Volet de navigation | Volet de navigation : afficher/masquer, bouton « Réduire » | Présent à vérifier | P1 | Interface | NavPane.tsx onToggle (F11 aussi, App.tsx) |
| AC-245 | Volet de navigation | Volet de navigation : largeur redimensionnable par glissement | Absent | P2 | Interface | absent (largeur fixe CSS) |
| AC-246 | Volet de navigation | Volet de navigation : barre de recherche | Présent à vérifier | P1 | Interface | NavPane.tsx recherche insensible aux accents |
| AC-247 | Volet de navigation | Volet de navigation : catégories (Type d'objet, Tables et vues associées, Date de création, Date de modification, Groupes personnalisés) | Absent | P2 | Interface | catégorie unique « Tous les objets Access » |
| AC-248 | Volet de navigation | Volet de navigation : filtre de groupe (Toutes les tables, Tables, Requêtes, Formulaires, États, Macros, Modules) | Absent | P2 | Interface | absent (groupes repliables seulement) |
| AC-249 | Volet de navigation | Volet de navigation : groupes personnalisés (créer, renommer, ajouter à un groupe) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-250 | Volet de navigation | Volet de navigation : Ordre de tri (Nom, Type, Date création, Date modification, tris automatiques) | Absent | P2 | Interface | tri par nom fixe (localeCompare fr) |
| AC-251 | Volet de navigation | Volet de navigation : Afficher par (Détails, Icône, Liste) | Absent | P3 | Interface | absent |
| AC-252 | Volet de navigation | Volet de navigation : Options de navigation (afficher objets masqués/système, ouverture simple clic) | Absent | P3 | Interface | absent |
| AC-253 | Volet de navigation | Volet de navigation : objets masqués (Masquer dans ce groupe) | Partiel | P3 | Moteur + Pont Tauri + Interface | absent ; 2026-11-06 : Masquer dans ce groupe / Ne plus masquer / Afficher les objets masqués (nav-view.ts, capture) ; mémorisé dans les réglages locaux, pas dans les métadonnées de la base |
| AC-254 | Volet de navigation | Volet de navigation : glisser-déposer d'objets entre groupes | Absent | P3 | Interface | absent |
| AC-255 | Volet de navigation | Volet de navigation : double-clic ouvre l'objet | Présent à vérifier | P1 | Interface | NavPane.tsx onDoubleClick |
| AC-256 | Volet de navigation | Volet de navigation : touches Entrée (ouvrir), F2 (renommer), Suppr | Présent à vérifier | P1 | Interface | NavPane.tsx onKeyDown |
| AC-257 | Volet de navigation | Volet de navigation : icônes par type d'objet | Présent à vérifier | P2 | Interface | NavPane.tsx KIND_ICON |
| AC-258 | Volet de navigation | Volet de navigation : objets Modules et Requêtes d'action distinguées | Partiel | P3 | Interface | pas de groupe Modules ; icônes de requête identiques |
| AC-259 | Menu contextuel | Menu du volet [Navigation Pane Pop-up] : Catégorie | Absent | P2 | Interface | aucun menu sur le fond du volet |
| AC-260 | Menu contextuel | Menu du volet : Ordre de tri | Absent | P2 | Interface | absent |
| AC-261 | Menu contextuel | Menu du volet : Afficher par | Absent | P3 | Interface | absent |
| AC-262 | Menu contextuel | Menu du volet : Afficher tous les groupes | Absent | P3 | Interface | absent |
| AC-263 | Menu contextuel | Menu du volet : Coller (objet copié) | Absent | P2 | Interface | absent |
| AC-264 | Menu contextuel | Menu du volet : Options de navigation… | Absent | P3 | Interface | absent |
| AC-265 | Menu contextuel | Menu du volet : Barre de recherche | Absent | P3 | Interface | la barre est toujours visible |
| AC-266 | Menu contextuel | Menu d'en-tête de groupe [Group Header Pop-up] : Développer / Réduire le groupe | Partiel | P3 | Interface | clic sur l'en-tête (NavPane.tsx), pas de menu |
| AC-267 | Menu contextuel | Menu d'en-tête de groupe : Développer tout / Réduire tout | Absent | P3 | Interface | absent |
| AC-268 | Menu contextuel | Menu d'en-tête de groupe : Afficher uniquement ce groupe | Absent | P3 | Interface | absent |
| AC-269 | Menu contextuel | Menu d'en-tête de groupe : Renommer / Supprimer le groupe | Absent | P2 | Moteur + Pont Tauri + Interface | absent (groupes personnalisés absents) |
| AC-270 | Menu contextuel | Menu d'en-tête de groupe : Masquer / Afficher | Absent | P3 | Interface | absent |
| AC-271 | Menu contextuel | Menu d'objet Table [Navigation Pane List Pop-up] : Ouvrir | Présent à vérifier | P1 | Interface | NavPane.tsx itemMenu 'open' |
| AC-272 | Menu contextuel | Menu d'objet Table : Mode Création | Présent à vérifier | P1 | Interface | itemMenu 'design' |
| AC-273 | Menu contextuel | Menu d'objet Table : Déclencheurs… (macros de données) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-274 | Menu contextuel | Menu d'objet Table : Importer | Absent | P2 | Interface | absent du menu (existe au ruban) |
| AC-275 | Menu contextuel | Menu d'objet Table : Exporter… (Excel, texte, PDF, XML, Access, ODBC, HTML) | Partiel | P1 | Interface | itemMenu 'export' : export direct sans sous-menu de formats |
| AC-276 | Menu contextuel | Menu d'objet Table : Renommer (F2) | Présent à vérifier | P1 | Interface | itemMenu 'rename' |
| AC-277 | Menu contextuel | Menu d'objet Table : Renommer le raccourci | Absent | P3 | Interface | absent |
| AC-278 | Menu contextuel | Menu d'objet Table : Masquer dans ce groupe / Afficher dans ce groupe | OK | P3 | Interface | absent ; 2026-11-06 : Masquer dans ce groupe et Ne plus masquer dans le menu d'objet du volet (test nav-view.test.ts, geste réel, capture) |
| AC-279 | Menu contextuel | Menu d'objet Table : Supprimer | Présent à vérifier | P1 | Interface | itemMenu 'delete' |
| AC-280 | Menu contextuel | Menu d'objet Table : Couper | Absent | P2 | Interface | absent |
| AC-281 | Menu contextuel | Menu d'objet Table : Copier (puis Coller structure/données/ajout) | Partiel | P1 | Interface | itemMenu 'copy' = duplication directe « Copie de… » (copier_table) sans choix structure seule / données / ajout |
| AC-282 | Menu contextuel | Menu d'objet Table : Ajouter à un groupe | Absent | P3 | Interface | absent |
| AC-283 | Menu contextuel | Menu d'objet Table : Autres options > Gestionnaire de tables liées | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-284 | Menu contextuel | Menu d'objet Table : Actualiser le lien / Convertir en table locale | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-285 | Menu contextuel | Menu d'objet Table : Propriétés de la table | Absent | P2 | Interface | absent du menu (existe au ruban) |
| AC-286 | Menu contextuel | Menu d'objet Table : Dépendances d'objet… | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-287 | Menu contextuel | Menu d'objet Table : Afficher les différences / Dernière version / Extraire / Archiver (SourceSafe) | Absent | P3 | Interface | sans objet |
| AC-288 | Menu contextuel | Menu d'objet Requête [Navigation Pane query or macro Pop-up] : Ouvrir | Présent à vérifier | P1 | Interface | itemMenu 'open' |
| AC-289 | Menu contextuel | Menu d'objet Requête : Exécuter | Partiel | P1 | Interface | Ouvrir exécute (requête d'action avec confirmation) ; pas d'entrée distincte |
| AC-290 | Menu contextuel | Menu d'objet Requête : Mode Création | Présent à vérifier | P1 | Interface | itemMenu 'design' |
| AC-291 | Menu contextuel | Menu d'objet Requête : Mode SQL | Absent | P2 | Interface | absent du menu (existe dans la vue) |
| AC-292 | Menu contextuel | Menu d'objet Requête : Exporter… / Renommer / Supprimer / Copier / Couper / Coller | Partiel | P1 | Interface | itemMenu : exporter, renommer, copier, supprimer présents ; Couper/Coller absents |
| AC-293 | Menu contextuel | Menu d'objet Requête : Propriétés de l'objet (description, masqué) | Absent | P3 | Interface | absent |
| AC-294 | Menu contextuel | Menu d'objet Formulaire [Navigation Pane View Pop-up] : Ouvrir | Présent à vérifier | P1 | Interface | itemMenu 'open' |
| AC-295 | Menu contextuel | Menu d'objet Formulaire : Mode Page | Présent à vérifier | P2 | Interface | itemMenu 'layout' |
| AC-296 | Menu contextuel | Menu d'objet Formulaire : Mode Création | Présent à vérifier | P1 | Interface | itemMenu 'design' |
| AC-297 | Menu contextuel | Menu d'objet Formulaire : Exporter… | Absent | P3 | Interface | désactivé pour les formulaires (disabled: kind != table/requete) |
| AC-298 | Menu contextuel | Menu d'objet Formulaire : Renommer / Supprimer / Copier | Présent à vérifier | P1 | Interface | itemMenu |
| AC-299 | Menu contextuel | Menu d'objet Formulaire : Dupliquer | Présent à vérifier | P2 | Interface | Copier fait la copie |
| AC-300 | Menu contextuel | Menu d'objet Formulaire : Imprimer / Aperçu avant impression | Absent | P2 | Interface | absent |
| AC-301 | Menu contextuel | Menu d'objet Formulaire : Afficher les propriétés | Absent | P3 | Interface | absent |
| AC-302 | Menu contextuel | Menu d'objet État [Navigation Pane object Pop-up] : Ouvrir (Mode État) | Présent à vérifier | P1 | Interface | itemMenu 'open' -> Aperçu |
| AC-303 | Menu contextuel | Menu d'objet État : Aperçu avant impression / Imprimer | Partiel | P2 | Interface | Ouvrir = aperçu ; Imprimer depuis le ruban |
| AC-304 | Menu contextuel | Menu d'objet État : Mode Page / Mode Création | Présent à vérifier | P1 | Interface | itemMenu |
| AC-305 | Menu contextuel | Menu d'objet État : Exporter / Renommer / Supprimer / Copier | Partiel | P1 | Interface | Exporter désactivé pour les états |
| AC-306 | Menu contextuel | Menu d'objet Macro : Exécuter / Mode Création / Renommer / Supprimer / Copier | Présent à vérifier | P1 | Interface | itemMenu (Exécuter = open) |
| AC-307 | Menu contextuel | Menu d'objet Macro : Exporter / Convertir en Visual Basic | Absent | P3 | Interface | absent |
| AC-308 | Menu contextuel | Menu d'objet Module : Ouvrir / Exécuter / Mode Création | Absent | P3 | Moteur + Pont Tauri + Interface | pas de groupe Modules dans le volet |

## 13. Fenêtre d'objet : onglets de documents et fenêtres

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-309 | Menu contextuel | Onglets de documents (ODocTabs) : afficher les objets ouverts en onglets | Présent à vérifier | P1 | Interface | App.tsx onglets d'objets |
| AC-310 | Menu contextuel | Onglets de documents : fermer un onglet (X, Ctrl+F4, clic du milieu) | Partiel | P1 | Interface | X et Ctrl+F4 (App.tsx) ; clic du milieu absent |
| AC-311 | Menu contextuel | Onglets de documents : point « modifié » / invite d'enregistrement à la fermeture | Présent à vérifier | P1 | Interface | App.tsx closeUnsaved |
| AC-312 | Menu contextuel | Onglets de documents : réordonner par glisser | Absent | P3 | Interface | absent |
| AC-313 | Menu contextuel | Onglets de documents : menu contextuel Enregistrer / Fermer / Fermer tout | Absent | P1 | Interface | absent (aucun menu sur les onglets) |
| AC-314 | Menu contextuel | Onglets de documents : menu contextuel Mode Formulaire / État / Page / Création / SQL / Feuille de données / Aperçu | Absent | P1 | Interface | absent (le bouton Affichage du ruban existe) |
| AC-315 | Menu contextuel | Onglets de documents : Fermer tout / Fermer les autres | Absent | P2 | Interface | absent |
| AC-316 | Menu contextuel | Fenêtres d'objet en chevauchement (au lieu d'onglets) | Absent | P3 | Interface | absent (onglets seulement) |
| AC-317 | Menu contextuel | Menu Système de la fenêtre [System] : Restauration, Déplacer, Taille, Réduction, Agrandissement, Fermer | Absent | P3 | Interface | sans objet (fenêtre native) |

## 14. Menus contextuels de la feuille de données

> Barres [Table Design Datasheet Cell / Column / Row], [Query Design Datasheet …], [Form Datasheet …].

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-318 | Menu contextuel | Cellule : Couper | Présent à vérifier | P1 | Interface | Datasheet.tsx cellMenu 'cut' |
| AC-319 | Menu contextuel | Cellule : Copier | Présent à vérifier | P1 | Interface | cellMenu 'copy' |
| AC-320 | Menu contextuel | Cellule : Coller | Présent à vérifier | P1 | Interface | cellMenu 'paste' (cellule seule, pas de collage multi-lignes) |
| AC-321 | Menu contextuel | Cellule : Tri croissant (Trier de A à Z) | Présent à vérifier | P1 | Interface | cellMenu 'az' |
| AC-322 | Menu contextuel | Cellule : Tri décroissant (Trier de Z à A) | Présent à vérifier | P1 | Interface | cellMenu 'za' |
| AC-323 | Menu contextuel | Cellule : Égal à « valeur » | Présent à vérifier | P1 | Interface | cellMenu 'eq' |
| AC-324 | Menu contextuel | Cellule : Différent de « valeur » | Présent à vérifier | P1 | Interface | cellMenu 'ne' |
| AC-325 | Menu contextuel | Cellule : Contient « valeur » | Présent à vérifier | P1 | Interface | cellMenu 'ct' |
| AC-326 | Menu contextuel | Cellule : Ne contient pas « valeur » | Partiel | P2 | Interface | absent du menu de cellule (présent au ruban) |
| AC-327 | Menu contextuel | Cellule : Filtres de texte / de nombres / de dates (sous-menus) | Partiel | P1 | Interface | absent ; 2026-11-06 : sous-menus Filtres de texte / numériques / de dates dans le menu d'en-tête et la flèche de colonne ; pas dans le menu de cellule |
| AC-328 | Menu contextuel | Cellule : Supprimer l'enregistrement | Présent à vérifier | P1 | Interface | cellMenu 'del' |
| AC-329 | Menu contextuel | Cellule : Nouvel enregistrement | Absent | P2 | Interface | absent du menu |
| AC-330 | Menu contextuel | Cellule : Insérer un objet… | Absent | P3 | Moteur + Interface | type Objet OLE sans éditeur |
| AC-331 | Menu contextuel | Cellule : Lien hypertexte (Modifier, Ouvrir, Copier, Supprimer, Ajouter) | Absent | P2 | Interface | les liens http/https/mailto sont validés ; aucun menu |
| AC-332 | Menu contextuel | Cellule : Gérer les pièces jointes… (champ Pièce jointe) | Absent | P1 | Moteur + Pont Tauri + Interface | type piece_jointe stocké (types.rs) ; aucun dialogue |
| AC-333 | Menu contextuel | Cellule : Afficher l'historique des colonnes… (mémo avec historique) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-334 | Menu contextuel | Cellule : Modifier les éléments de liste… | Absent | P2 | Interface | absent |
| AC-335 | Menu contextuel | Cellule : Reconvertir / Conversion hangûl-hanja (langues asiatiques) | Absent | P3 | Interface | sans objet |
| AC-336 | Menu contextuel | Cellule : Sélectionné / Non sélectionné (cases à cocher Oui/Non) | Absent | P3 | Interface | absent |
| AC-337 | Menu contextuel | En-tête de colonne : Tri croissant / décroissant | Absent | P1 | Interface | pas de menu (le bouton de filtre de l'en-tête existe) |
| AC-338 | Menu contextuel | En-tête de colonne : Copier / Coller | Absent | P2 | Interface | absent |
| AC-339 | Menu contextuel | En-tête de colonne : Largeur de champ… | Absent | P1 | Interface | absent |
| AC-340 | Menu contextuel | En-tête de colonne : Masquer les champs | Partiel | P2 | Interface | absent ; 2026-11-06 : Masquer le champ + Afficher les champs (sous-menu, Afficher tous) dans le menu d'en-tête ; pas de masquage de plusieurs champs sélectionnés |
| AC-341 | Menu contextuel | En-tête de colonne : Afficher les champs… | Absent | P2 | Interface | absent |
| AC-342 | Menu contextuel | En-tête de colonne : Figer les champs / Libérer tous les champs | OK | P2 | Interface | absent ; 2026-11-06 : Figer les champs jusqu'ici / Libérer tous les champs : colonnes collantes vérifiées au défilement horizontal (capture) |
| AC-343 | Menu contextuel | En-tête de colonne : Rechercher… | Absent | P2 | Interface | absent |
| AC-344 | Menu contextuel | En-tête de colonne : Insérer un champ | Absent | P2 | Interface | absent (ajout par la colonne « + » ou le ruban) |
| AC-345 | Menu contextuel | En-tête de colonne : Modifier les recherches | Absent | P2 | Interface | absent |
| AC-346 | Menu contextuel | En-tête de colonne : Modifier l'expression | Absent | P2 | Interface | absent |
| AC-347 | Menu contextuel | En-tête de colonne : Renommer le champ | Absent | P1 | Interface | absent (renommage en Mode Création) |
| AC-348 | Menu contextuel | En-tête de colonne : Supprimer le champ | Absent | P1 | Interface | supprimer par le ruban seulement |
| AC-349 | Menu contextuel | En-tête de colonne : double-clic sur la bordure = largeur automatique | Absent | P2 | Interface | absent |
| AC-350 | Menu contextuel | En-tête de colonne : glisser pour déplacer | Absent | P2 | Interface | absent |
| AC-351 | Menu contextuel | En-tête de colonne : glisser la bordure pour redimensionner | Absent | P1 | Interface | absent |
| AC-352 | Menu contextuel | Sélecteur de ligne : Nouvel enregistrement | Absent | P2 | Interface | absent |
| AC-353 | Menu contextuel | Sélecteur de ligne : Supprimer l'enregistrement | Absent | P1 | Interface | seulement dans le menu de cellule |
| AC-354 | Menu contextuel | Sélecteur de ligne : Couper / Copier / Coller | Absent | P2 | Interface | absent (pas de sélection de lignes entières) |
| AC-355 | Menu contextuel | Sélecteur de ligne : Hauteur de ligne… | OK | P2 | Interface | absent ; 2026-11-06 : Hauteur de ligne… (40 px vérifiés au rendu) et Hauteur standard dans le menu du sélecteur de ligne |
| AC-356 | Menu contextuel | Fond de la feuille de données : Police… / Feuille de données… | Absent | P3 | Interface | absent |
| AC-357 | Menu contextuel | Fond de la feuille de données : Afficher les champs | Absent | P2 | Interface | absent |
| AC-358 | Menu contextuel | Colonne « Cliquez pour ajouter » (menu de types : Texte court, Nombre, Grand nombre, Monétaire, Date et heure, Date/heure étendue, Oui/Non, Liste de choix et relation, Texte enrichi, Texte long, Pièce jointe, Lien hypertexte, Champ calculé, Coller en tant que champs) [Add New Field] | Partiel | P1 | Interface | colonne vide en fin de grille, 5 types via le ruban ; pas de menu complet |
| AC-359 | Menu contextuel | Sous-feuille de données (+ en tête de ligne) | Absent | P2 | Moteur + Pont Tauri + Interface | absent (relations disponibles dans le moteur) |
| AC-360 | Menu contextuel | Cellule : sélection de plage, de colonne, de ligne entière, Ctrl+A | OK | P1 | Interface | Datasheet.tsx sélection d'une seule cellule ; 2026-11-06 : Maj+clic, Maj+flèches, clic sur le sélecteur de ligne (ligne entière), clic sur l'intitulé (colonne entière), Ctrl+A, copie en texte tabulé (selection.ts, geste réel, capture) |
| AC-361 | Menu contextuel | Cellule : collage d'une plage Excel / texte tabulé (ajout de lignes) | Absent | P1 | Interface | absent |
| AC-362 | Menu contextuel | Cellule : calendrier (sélecteur de date) | Absent | P2 | Interface | la colonne date_heure n'a pas de sélecteur de date en feuille de données (FormView utilise 'selecteur_date') |
| AC-363 | Menu contextuel | Cellule : liste déroulante (zone de liste modifiable) pour champ avec liste de choix | Présent à vérifier | P1 | Interface | Datasheet.tsx liste_valeurs / limiter_a_liste |
| AC-364 | Menu contextuel | Cellule : case à cocher pour Oui/Non | Partiel | P2 | Interface | rendu texte Oui/Non à vérifier (displayValue) |
| AC-365 | Menu contextuel | Cellule : annuler la saisie (Échap, Ctrl+Z) | Partiel | P1 | Interface | Échap annule la cellule ; Ctrl+Z absent |
| AC-366 | Menu contextuel | Cellule : Maj+Entrée pour enregistrer l'enregistrement, Ctrl+; date du jour, Ctrl+Maj+: heure, Ctrl+' valeur du champ au-dessus | Absent | P3 | Interface | absent |
| AC-367 | Menu contextuel | Feuille de données : ligne de totaux | Présent à vérifier | P1 | Interface | Datasheet.tsx totalsOn (somme, moyenne, compte, min, max, écart type, variance) |
| AC-368 | Menu contextuel | Feuille de données : quadrillage, lignes alternées, couleurs | Absent | P3 | Interface | absent |
| AC-369 | Menu contextuel | Feuille de données : défilement continu | Partiel | P2 | Interface | pagination par 100 (STATUS) |
| AC-370 | Menu contextuel | Feuille de données : barre de navigation (premier, précédent, n sur N, suivant, dernier, nouveau, filtre, rechercher) | Partiel | P1 | Interface | Datasheet.tsx pied « Enr n sur N » + champ Rechercher ; boutons partiels |
| AC-371 | Menu contextuel | Feuille de données : sélecteurs de lignes avec icônes (crayon, astérisque, verrou) | Absent | P3 | Interface | absent |
| AC-372 | Menu contextuel | Feuille de données : volume (100 000+ lignes) fluide | Partiel | P2 | Moteur + Interface | pages de 100 (moteur : TAILLE_PAGE_MAX) |

## 15. Menus contextuels du Mode Création de table

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-373 | Menu contextuel | Volet des champs [Table Design Upper Pane] : Clé primaire | Présent à vérifier | P1 | Interface | ribbon.tsx pk ; pas de menu contextuel |
| AC-374 | Menu contextuel | Volet des champs : Couper / Copier / Coller (lignes de champs) | Absent | P1 | Interface | absent |
| AC-375 | Menu contextuel | Volet des champs : Insérer des lignes | Partiel | P1 | Interface | ruban seulement (ribbon.tsx ins) |
| AC-376 | Menu contextuel | Volet des champs : Supprimer les lignes | Partiel | P1 | Interface | ruban seulement (ribbon.tsx delr) |
| AC-377 | Menu contextuel | Volet des champs : Propriétés | Partiel | P2 | Interface | volet Propriétés du champ toujours visible |
| AC-378 | Menu contextuel | Volet des champs : sélecteur de ligne (glisser pour réordonner les champs) | Absent | P1 | Interface | absent |
| AC-379 | Menu contextuel | Volet des champs : Reconvertir / Conversion hangûl-hanja | Absent | P3 | Interface | sans objet |
| AC-380 | Menu contextuel | Volet des propriétés [Table Design Lower Pane] : Générateur… | Absent | P1 | Interface | absent |
| AC-381 | Menu contextuel | Volet des propriétés : Zoom… (Maj+F2) | Absent | P2 | Interface | absent |
| AC-382 | Menu contextuel | Volet des propriétés : Couper / Copier / Coller | Absent | P3 | Interface | menu natif de la zone de saisie (navigateur) |
| AC-383 | Menu contextuel | Barre de titre de table [Table DesignTitleBar] : Mode Feuille de données | Partiel | P2 | Interface | bouton Affichage du ruban ; pas de menu |
| AC-384 | Menu contextuel | Barre de titre de table : Relations… | Partiel | P2 | Interface | ruban |
| AC-385 | Menu contextuel | Barre de titre de table : Index | Absent | P1 | Pont Tauri + Interface | voir Index (moteur prêt) |
| AC-386 | Menu contextuel | Barre de titre de table : Tester les règles de validation | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-387 | Menu contextuel | Barre de titre de table : Propriétés | Présent à vérifier | P2 | Interface | feuille de propriétés de table |
| AC-388 | Menu contextuel | Barre de titre de table : Fermer | Présent à vérifier | P1 | Interface | App.tsx |

## 16. Menus contextuels des requêtes

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-389 | Menu contextuel | Fond du créateur [Query] : Mode SQL | Présent à vérifier | P1 | Interface | bouton Affichage |
| AC-390 | Menu contextuel | Fond du créateur : Mode Feuille de données | Présent à vérifier | P1 | Interface | bouton Affichage |
| AC-391 | Menu contextuel | Fond du créateur : Afficher la table… | Présent à vérifier | P1 | Interface | ribbon.tsx addt (pas dans un menu contextuel) |
| AC-392 | Menu contextuel | Fond du créateur : Paramètres… | Présent à vérifier | P2 | Interface | QueryDesign.tsx q.params |
| AC-393 | Menu contextuel | Fond du créateur : Type de requête (sous-menu) | Partiel | P1 | Interface | ruban seulement |
| AC-394 | Menu contextuel | Fond du créateur : Spécifique SQL (Union, Transfert, Définition) | Absent | P2 | Interface | absent |
| AC-395 | Menu contextuel | Fond du créateur : Relations… / Propriétés… / Fermer | Partiel | P2 | Interface | ruban ; propriétés de requête absentes |
| AC-396 | Menu contextuel | Boîte de table dans le créateur [Query DesignFieldList] : Ouvrir | Absent | P3 | Interface | absent |
| AC-397 | Menu contextuel | Boîte de table : Mode Création | Absent | P3 | Interface | absent |
| AC-398 | Menu contextuel | Boîte de table : Ajuster au contenu | Absent | P3 | Interface | absent |
| AC-399 | Menu contextuel | Boîte de table : Supprimer une table | Présent à vérifier | P1 | Interface | QueryDesign.tsx boxMenu 'rm' |
| AC-400 | Menu contextuel | Boîte de table : Propriétés… | Absent | P3 | Interface | absent |
| AC-401 | Menu contextuel | Boîte de table : double-clic sur un champ l'ajoute à la grille | Présent à vérifier | P1 | Interface | Diagram.tsx onFieldDoubleClick |
| AC-402 | Menu contextuel | Boîte de table : glisser un champ vers la grille | Présent à vérifier | P1 | Interface | Diagram.tsx onFieldDrop |
| AC-403 | Menu contextuel | Boîte de table : double-clic sur le titre = tous les champs | Présent à vérifier | P2 | Interface | Diagram.tsx onHeaderDoubleClick |
| AC-404 | Menu contextuel | Boîte de table : déplacer / redimensionner par glissement | Partiel | P2 | Interface | déplacer OK ; redimensionnement absent |
| AC-405 | Menu contextuel | Trait de jointure [Query Design Join] : Propriétés de la jointure… | Présent à vérifier | P1 | Interface | double-clic ouvre S.q.joinProps (QueryDesign.tsx) |
| AC-406 | Menu contextuel | Trait de jointure : Supprimer | Présent à vérifier | P1 | Interface | touche Suppr (QueryDesign.tsx ligne 221) |
| AC-407 | Menu contextuel | Trait de jointure : menu contextuel | Absent | P2 | Interface | absent |
| AC-408 | Menu contextuel | Grille QBE [Query DesignGrid] : Totaux | Présent à vérifier | P1 | Interface | ribbon.tsx qtot |
| AC-409 | Menu contextuel | Grille QBE : Noms des tables | Absent | P3 | Interface | absent |
| AC-410 | Menu contextuel | Grille QBE : Couper / Copier / Coller | Absent | P2 | Interface | absent |
| AC-411 | Menu contextuel | Grille QBE : Générateur… (Ctrl+F2 : expression, champ calculé) | Absent | P1 | Interface | absent |
| AC-412 | Menu contextuel | Grille QBE : Zoom… (Maj+F2) | Absent | P2 | Interface | absent |
| AC-413 | Menu contextuel | Grille QBE : Propriétés… (Format, Décimales, Légende, Sous-feuille) | Absent | P2 | Interface | absent |
| AC-414 | Menu contextuel | Grille QBE : menu de colonne, Supprimer la colonne | Présent à vérifier | P1 | Interface | QueryDesign.tsx menu de colonne 'deleteRows' |
| AC-415 | Menu contextuel | Grille QBE : sélecteur de colonne, glisser pour déplacer les colonnes | Absent | P2 | Interface | absent |
| AC-416 | Menu contextuel | Grille QBE : champ calculé « Alias: expression » | OK | P1 | Moteur + Interface | expr.rs Traducteur ; QueryDesign.tsx colonne Expression |
| AC-417 | Menu contextuel | Grille QBE : lignes Champ, Table, Opération, Tri, Afficher, Critères, Ou | Présent à vérifier | P1 | Interface | strings.ts q.* ; QueryDesign.tsx |
| AC-418 | Menu contextuel | Grille QBE : lignes « Ou » multiples (Ou: 1, 2, 3…) | Présent à vérifier | P1 | Interface | logic/qbe.ts criteria[] (une valeur par ligne Critères/Ou) |
| AC-419 | Menu contextuel | Grille QBE : critères avec Comme, Entre…Et, Dans(), Est Null, <>, >=, jokers * ? # | OK | P1 | Moteur | expr.rs traduit et/ou/pas/comme/entre/dans/est/null ; motif_like() gère * ? # ; classes [a-z] approximées par un caractère quelconque |
| AC-420 | Menu contextuel | Grille QBE : critère de paramètre [Entrer la date] | OK | P1 | Moteur + Interface | QueryDesign.tsx paramPrompt ; sql.rs Parametres |
| AC-421 | Menu contextuel | Grille QBE : Afficher (case) / Tri (croissant, décroissant) | Présent à vérifier | P1 | Interface | QueryDesign.tsx |
| AC-422 | Menu contextuel | Grille QBE : Opérations Regroupement, Somme, Moyenne, Min, Max, Compte, EcartType, Var, Premier, Dernier, Expression, Où | OK | P1 | Moteur + Interface | concepteur.rs Operation (12 valeurs) |
| AC-423 | Menu contextuel | Grille QBE : Analyse croisée (En-tête de ligne / de colonne / Valeur) | OK | P2 | Moteur + Interface | concepteur.rs RoleAnalyse |
| AC-424 | Menu contextuel | Grille QBE : requête Ajout (Ajouter à), Mise à jour (Mise à jour :), Création de table | OK | P1 | Moteur + Interface | QueryDesign.tsx q.appendTo / q.update |
| AC-425 | Menu contextuel | Mode SQL [Query SQLText] : édition, exécution | OK | P1 | Moteur + Interface | QueryDesign.tsx mode SQL ; sql.rs |
| AC-426 | Menu contextuel | Mode SQL : Couper / Copier / Coller | Partiel | P3 | Interface | menu natif |
| AC-427 | Menu contextuel | Mode SQL : coloration syntaxique / complétion | Absent | P2 | Interface | zone de texte simple |
| AC-428 | Menu contextuel | Mode SQL : dialecte Access (jokers *, ?, dates #…#, [champs], &, IIf, Nz, Format) | Partiel | P1 | Moteur | expr.rs traduit les fonctions Access en SQL SQLite pour la grille ; le mode SQL direct est SQLite |
| AC-429 | Menu contextuel | Requête éditable (modifier les lignes du résultat d'une requête sur une table) | Absent | P1 | Pont Tauri + Interface | moteur prêt : requete_editable.rs executer_requete_editable / modifier_ligne_requete ; non exposé dans base_cmds.rs, UI en lecture seule (Datasheet « queryReadOnly ») |
| AC-430 | Menu contextuel | Requête : propriétés (Valeurs distinctes, Enregistrements uniques, Verrous, Source, Plage maximale) | Absent | P2 | Moteur + Interface | DefinitionRequete porte distinct/top seulement |
| AC-431 | Menu contextuel | Requête : sous-requêtes, UNION, requêtes imbriquées | Partiel | P2 | Moteur + Interface | mode SQL seulement ; UNION non proposé par le créateur |
| AC-432 | Menu contextuel | Requête : fonctions de domaine DLookUp / DSum / DCount dans les critères | Absent | P1 | Moteur | absent d'expr.rs (voir Expressions) |
| AC-433 | Menu contextuel | Fenêtre Filtre/tri avancé [Filter General Context Menu] : Appliquer, Effacer la grille, Charger à partir d'une requête, Enregistrer en tant que requête, Fermer | Absent | P2 | Interface | absent |
| AC-434 | Menu contextuel | Filtre par formulaire [Filter FilterByForm] : onglets Rechercher/Ou, Appliquer un filtre serveur, Supprimer l'onglet | Absent | P2 | Interface | absent |

## 17. Menus contextuels des relations

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-435 | Menu contextuel | Fond de la fenêtre Relations [Actions] : Afficher la table… | Présent à vérifier | P1 | Interface | ribbon.tsx addt |
| AC-436 | Menu contextuel | Fond de la fenêtre Relations : Afficher toutes les relations | Présent à vérifier | P2 | Interface | ribbon.tsx all |
| AC-437 | Menu contextuel | Fond de la fenêtre Relations : Enregistrer la mise en page | Présent à vérifier | P2 | Interface | Relations.tsx POS_SETTING 'access.relations.positions' (mémorisée automatiquement) |
| AC-438 | Menu contextuel | Fond de la fenêtre Relations : Fermer | Présent à vérifier | P3 | Interface | ribbon.tsx close |
| AC-439 | Menu contextuel | Boîte de table dans Relations [Relationship TableFieldList] : Afficher les relations directes | Absent | P3 | Interface | absent |
| AC-440 | Menu contextuel | Boîte de table dans Relations : Ouvrir / Création de table | Absent | P3 | Interface | absent |
| AC-441 | Menu contextuel | Boîte de table dans Relations : Ajuster au contenu | Absent | P3 | Interface | absent |
| AC-442 | Menu contextuel | Boîte de table dans Relations : Masquer la table | Absent | P2 | Interface | pas de menu contextuel (Relations.tsx) |
| AC-443 | Menu contextuel | Trait de relation [Relationship Join] : Modifier une relation… | Présent à vérifier | P1 | Interface | double-clic (Relations.tsx) + ruban |
| AC-444 | Menu contextuel | Trait de relation : Supprimer | Présent à vérifier | P1 | Interface | touche Suppr (Relations.tsx ligne 137) ; pas de menu |
| AC-445 | Menu contextuel | Relation : glisser un champ vers un autre pour créer | Présent à vérifier | P1 | Interface | Relations.tsx onFieldDrop |
| AC-446 | Menu contextuel | Relation : Appliquer l'intégrité référentielle, cascades de mise à jour / suppression, mettre à Null | OK | P1 | Moteur + Interface | relations.rs, strings.ts rel.* |
| AC-447 | Menu contextuel | Relation : type de jointure 1/2/3 (interne, externe gauche, externe droite) | OK | P1 | Moteur + Interface | relations.rs TypeJointure |
| AC-448 | Menu contextuel | Relation : un-à-plusieurs, un-à-un, indéterminée (affichage 1 / ∞) | Présent à vérifier | P2 | Interface | Relations.tsx |
| AC-449 | Menu contextuel | Relation : Créer nouveau… dans le dialogue Modifier les relations | Partiel | P2 | Interface | dialogue Relations partiel |
| AC-450 | Menu contextuel | Relation : relation plusieurs-à-plusieurs via table de jonction (assistant) | Absent | P3 | Interface | absent |

## 18. Menus contextuels des formulaires et états en Mode Création / Page

> Barres [Form Design Control] 33 entrées, [Form Design Section] 12, [Form Design Form] 9, [Form DesignTitleBar] 12, [Report Design Control] 36, [Report Design Section] 14, [Report DesignReport] 10, [Report DesignTitleBar] 14, [Form/Report Properties] 7, [Form Design Control OLE] 10, [Tab Control] 19. ForgeOffice : AUCUN menu contextuel dans DesignCanvas.tsx / FormView.tsx / ReportView.tsx.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-451 | Menu contextuel | Contrôle : Insérer un bouton de navigation | Absent | P3 | Moteur + Interface | absent |
| AC-452 | Menu contextuel | Contrôle : Créer le code événement… | Absent | P3 | Moteur + Pont Tauri + Interface | sans objet sans VBA ; équivalent : « Créer une macro d'événement » |
| AC-453 | Menu contextuel | Contrôle : Générateur… | Absent | P2 | Interface | absent |
| AC-454 | Menu contextuel | Contrôle : Objet (modifier, ouvrir, convertir pour OLE) | Absent | P3 | Interface | sans objet |
| AC-455 | Menu contextuel | Contrôle : Remplacer par (changer le type de contrôle : zone de texte -> liste déroulante, etc.) | Absent | P1 | Moteur + Interface | absent |
| AC-456 | Menu contextuel | Contrôle : Ordre de tabulation… | Absent | P2 | Interface | absent |
| AC-457 | Menu contextuel | Contrôle : Couper | Absent | P1 | Interface | absent (seul Suppr existe, FormView.tsx ligne 178) |
| AC-458 | Menu contextuel | Contrôle : Copier | Absent | P1 | Interface | absent |
| AC-459 | Menu contextuel | Contrôle : Coller | Absent | P1 | Interface | absent |
| AC-460 | Menu contextuel | Contrôle : Coller le format | Absent | P2 | Interface | absent |
| AC-461 | Menu contextuel | Contrôle : Insérer (à gauche, à droite, au-dessus, en dessous) | Absent | P2 | Moteur + Interface | absent (pas de dispositions) |
| AC-462 | Menu contextuel | Contrôle : Fusionner/scinder | Absent | P3 | Interface | absent |
| AC-463 | Menu contextuel | Contrôle : Disposition (Quadrillage, Empilé, Tabulaire, Supprimer) | Absent | P1 | Moteur + Interface | absent |
| AC-464 | Menu contextuel | Contrôle : Sélectionner la ligne entière / la colonne entière | Absent | P3 | Interface | absent |
| AC-465 | Menu contextuel | Contrôle : Aligner (Grille, Gauche, Droite, Haut, Bas) | Absent | P1 | Interface | absent |
| AC-466 | Menu contextuel | Contrôle : Taille (À la grille, Ajusté, Plus grand, Plus étroit…) | Absent | P1 | Interface | absent |
| AC-467 | Menu contextuel | Contrôle : Position (Espacement horizontal/vertical, Premier plan, Arrière-plan) | Absent | P2 | Interface | absent |
| AC-468 | Menu contextuel | Contrôle : Quadrillage (supérieur, inférieur, gauche, droite) | Absent | P3 | Moteur + Interface | absent |
| AC-469 | Menu contextuel | Contrôle : Supprimer | Présent à vérifier | P1 | Interface | FormView.tsx Delete (clavier seulement) |
| AC-470 | Menu contextuel | Contrôle : Supprimer la ligne / la colonne (disposition) | Absent | P3 | Interface | absent |
| AC-471 | Menu contextuel | Contrôle : Ancrage (Étirer, Haut, Bas, Gauche…) | Absent | P2 | Moteur + Interface | absent |
| AC-472 | Menu contextuel | Contrôle : Couleur d'arrière-plan / de police / Effet spécial | Absent | P2 | Moteur + Interface | absent |
| AC-473 | Menu contextuel | Contrôle : Mise en forme conditionnelle… | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-474 | Menu contextuel | Contrôle : Lien hypertexte | Absent | P3 | Interface | absent |
| AC-475 | Menu contextuel | Contrôle : Sous-formulaire/Sous-état dans une nouvelle fenêtre | Absent | P3 | Interface | absent |
| AC-476 | Menu contextuel | Contrôle : Modifier les éléments de liste… | Absent | P2 | Interface | absent |
| AC-477 | Menu contextuel | Contrôle : Regrouper sur / Total / Tri (dans un état) | Absent | P1 | Interface | absent |
| AC-478 | Menu contextuel | Contrôle : Définir la légende | Absent | P3 | Interface | absent |
| AC-479 | Menu contextuel | Contrôle : Propriétés (F4) | Absent | P1 | Interface | absent |
| AC-480 | Menu contextuel | Contrôle OLE : Dupliquer | Absent | P3 | Interface | absent |
| AC-481 | Menu contextuel | Section : Créer le code événement / Générateur | Absent | P3 | Interface | absent |
| AC-482 | Menu contextuel | Section : Ordre de tabulation… | Absent | P2 | Interface | absent |
| AC-483 | Menu contextuel | Section : Coller | Absent | P1 | Interface | absent |
| AC-484 | Menu contextuel | Section : Couleur d'arrière-plan / Autre couleur | Absent | P2 | Interface | absent |
| AC-485 | Menu contextuel | Section : Règle | Absent | P2 | Interface | absent |
| AC-486 | Menu contextuel | Section : Grille | Absent | P2 | Interface | la grille de 4 px est fixe, pas affichée ni désactivable |
| AC-487 | Menu contextuel | Section : En-tête et pied de page / En-tête et pied de formulaire | Absent | P1 | Interface | sections fixes (strings.ts forms.sections) sans ajout ni retrait |
| AC-488 | Menu contextuel | Section : Boîte à outils (états) | Absent | P2 | Interface | absent |
| AC-489 | Menu contextuel | Section : Trier et grouper (états) | Partiel | P1 | Interface | liste Regrouper du ruban |
| AC-490 | Menu contextuel | Section : Propriétés de la section | Absent | P2 | Interface | absent |
| AC-491 | Menu contextuel | Formulaire (fond) : Mode Formulaire / Page / Création / Feuille de données | Partiel | P1 | Interface | bouton Affichage |
| AC-492 | Menu contextuel | Formulaire (fond) : Propriétés du formulaire | Absent | P1 | Interface | absent |
| AC-493 | Menu contextuel | État (fond) : Mode État / Page / Création / Aperçu / Aperçu des 10 premiers enregistrements | Partiel | P2 | Interface | Affichage ; pas d'aperçu des 10 premiers |
| AC-494 | Menu contextuel | État (fond) : Propriétés de l'état | Absent | P1 | Interface | absent |
| AC-495 | Menu contextuel | Barre de titre d'objet [Form DesignTitleBar] : En-tête et pied de page… | Absent | P2 | Interface | absent |
| AC-496 | Menu contextuel | Contrôle Onglet [Tab Control] : Insérer une page / Supprimer la page / Ordre des pages… | Absent | P2 | Moteur + Interface | absent (pas de contrôle Onglet) |
| AC-497 | Menu contextuel | Contrôle Onglet : Insérer / Fusionner / Disposition / Aligner / Taille / Quadrillage | Absent | P3 | Moteur + Interface | absent |

## 19. Menus contextuels en Mode Formulaire, aperçu et macros

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-498 | Menu contextuel | Formulaire en Mode Formulaire [Form View Popup] : changer de mode (Formulaire, État, Page, Création, Feuille de données) | Absent | P1 | Interface | absent |
| AC-499 | Menu contextuel | Formulaire en Mode Formulaire : Aperçu avant impression | Absent | P2 | Interface | absent |
| AC-500 | Menu contextuel | Formulaire en Mode Formulaire : Filtrer par formulaire / Appliquer un filtre | Absent | P2 | Interface | absent |
| AC-501 | Menu contextuel | Formulaire en Mode Formulaire : Couper / Copier / Coller | Absent | P2 | Interface | menu natif du navigateur sur les champs de saisie |
| AC-502 | Menu contextuel | Formulaire en Mode Formulaire [Form View Control] : Tri croissant / décroissant | Absent | P1 | Interface | absent |
| AC-503 | Menu contextuel | Formulaire en Mode Formulaire : filtre par sélection (Égal à, Différent de, Contient, Ne contient pas) | Absent | P1 | Interface | absent |
| AC-504 | Menu contextuel | Formulaire en Mode Formulaire : Créer un lien hypertexte / Insérer un objet / Gérer les pièces jointes / Historique de colonne | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-505 | Menu contextuel | Formulaire en Mode Formulaire [Form View Record] : sélecteur d'enregistrement Couper / Copier / Coller | Absent | P3 | Interface | absent |
| AC-506 | Menu contextuel | Formulaire en Mode Formulaire [Form View Subform] : menu de sous-formulaire (Sous-formulaire > Mode Feuille de données, etc.) | Absent | P1 | Pont Tauri + Interface | moteur prêt : sous_formulaire.rs ; non exposé ni affiché |
| AC-507 | Menu contextuel | Formulaire en Mode Feuille de données [Form Datasheet Cell/Column/Row] | Partiel | P2 | Interface | disposition « feuille de données » affiche la feuille ; mêmes menus absents que section 14 |
| AC-508 | Menu contextuel | Aperçu avant impression [Print Preview Popup] : Mode État / Page / Création | Absent | P2 | Interface | absent |
| AC-509 | Menu contextuel | Aperçu avant impression : Zoom, Une page, Plusieurs pages | Absent | P2 | Interface | absent |
| AC-510 | Menu contextuel | Aperçu avant impression : Mise en page… | Absent | P1 | Interface | absent |
| AC-511 | Menu contextuel | Aperçu avant impression : Imprimer… | Présent à vérifier | P1 | Interface | ribbon.tsx print |
| AC-512 | Menu contextuel | Aperçu avant impression : Enregistrer sous / Exporter (PDF…) / Envoyer vers | Absent | P1 | Interface | absent |
| AC-513 | Menu contextuel | Aperçu avant impression : Fermer | Présent à vérifier | P2 | Interface | ribbon.tsx cp |
| AC-514 | Menu contextuel | Macro [Macro UpperPane] : Zoom, Insérer des lignes, Supprimer les lignes, Couper, Copier, Coller | Partiel | P2 | Interface | MacroView.tsx : boutons Monter/Descendre/Supprimer sur chaque action ; pas de menu ni de copier-coller |
| AC-515 | Menu contextuel | Macro [Macro Condition] : Générateur, Zoom | Absent | P2 | Interface | condition en saisie libre |
| AC-516 | Menu contextuel | Macro [Macro Argument] : Générateur, Zoom | Absent | P2 | Interface | absent |
| AC-517 | Menu contextuel | Macro (concepteur moderne) [Logic Designer] : Développer/Réduire, Couper/Copier/Coller, Monter, Descendre, Supprimer | Partiel | P2 | Interface | Monter/Descendre/Supprimer seulement |
| AC-518 | Menu contextuel | Macro (concepteur moderne) : Créer un bloc de groupes / de sous-macros / Si, Ajouter Sinon si, Sinon | Absent | P1 | Moteur + Interface | absent (macros plates : liste d'actions avec condition) |
| AC-519 | Menu contextuel | Macro [Logic Catalog] : Ajouter une action, Ajouter une copie de la macro, Ajouter ExécuterMacro | Absent | P2 | Interface | absent |
| AC-520 | Menu contextuel | Module VBA [ModuleUncompiled / ModuleCompiled / Immediate / Watch / Locals] : menus de l'éditeur Visual Basic | Absent | P3 | Interface | sans objet (pas de VBA) |
| AC-521 | Menu contextuel | Explorateur d'objets [Object Browser] | Absent | P3 | Interface | sans objet |
| AC-522 | Menu contextuel | Menu d'un objet en vue Table dynamique / Graphique croisé dynamique [Table PivotTable Popup…] | Absent | P3 | Interface | retirés d'Access récent ; remplacer par un tableau croisé via requête Analyse croisée |
| AC-523 | Menu contextuel | Menus de bases ADP/SQL Server [View Design, Stored Procedure, Diagram, Trigger, Function] | Absent | P3 | Interface | sans objet |
| AC-524 | Menu contextuel | Menu Fenêtre Base de données (fond) [Database Background] : Affichage, Réorganiser les icônes, Importer, Lier, Coller, Relations, Visual Basic | Absent | P3 | Interface | sans objet (volet de navigation) |

## 20. Types de données et propriétés de champ (Mode Création de table)

> Vérité-terrain COM : un champ DAO expose 24 propriétés (Value, Attributes, CollatingOrder, Type, Name, OrdinalPosition, Size, SourceField, SourceTable, ValidateOnSet, DataUpdatable, ForeignName, DefaultValue, ValidationRule, ValidationText, Required, AllowZeroLength, AppendOnly, Expression, FieldSize, OriginalValue, VisibleValue, Precision, Scale) ; une TableDef 12 (Name, Updatable, DateCreated, LastUpdated, Connect, Attributes, SourceTableName, RecordCount, ValidationRule, ValidationText, ConflictTable, ReplicaFilter). Les propriétés d'interface (Format, Légende, Masque, Décimales, Liste de choix…) sont ajoutées par Access au premier usage.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-525 | Propriété | Type : Texte court (jusqu'à 255) | OK | P1 | Moteur + Interface | types.rs TexteCourt ; TableDesign.tsx |
| AC-526 | Propriété | Type : Texte long (mémo, jusqu'à ~1 Go) | OK | P1 | Moteur + Interface | types.rs TexteLong |
| AC-527 | Propriété | Type : Nombre > Octet | OK | P1 | Moteur + Interface | types.rs Octet |
| AC-528 | Propriété | Type : Nombre > Entier | OK | P1 | Moteur + Interface | types.rs Entier |
| AC-529 | Propriété | Type : Nombre > Entier long | OK | P1 | Moteur + Interface | types.rs EntierLong |
| AC-530 | Propriété | Type : Nombre > Réel simple | OK | P2 | Moteur + Interface | types.rs ReelSimple |
| AC-531 | Propriété | Type : Nombre > Réel double | OK | P1 | Moteur + Interface | types.rs ReelDouble |
| AC-532 | Propriété | Type : Nombre > Décimal (précision, échelle) | OK | P2 | Moteur + Interface | types.rs Decimal (precision, echelle) |
| AC-533 | Propriété | Type : Nombre > Réplication ID (GUID) | Absent | P3 | Moteur + Interface | absent (access_lecteur.rs lit les GUID à l'import mais le type n'existe pas) |
| AC-534 | Propriété | Type : Grand nombre | OK | P2 | Moteur + Interface | types.rs GrandEntier |
| AC-535 | Propriété | Type : Date/Heure | OK | P1 | Moteur + Interface | types.rs DateHeure (ISO 8601) |
| AC-536 | Propriété | Type : Date/Heure étendue (précision 100 ns) | Absent | P3 | Moteur + Interface | absent |
| AC-537 | Propriété | Type : Monétaire | OK | P1 | Moteur + Interface | types.rs Monetaire (4 décimales) |
| AC-538 | Propriété | Type : NuméroAuto (incrément, aléatoire, ID de réplication) | Partiel | P1 | Moteur + Interface | types.rs NumeroAuto (incrémental seulement) |
| AC-539 | Propriété | Type : Oui/Non | OK | P1 | Moteur + Interface | types.rs OuiNon |
| AC-540 | Propriété | Type : Objet OLE | Partiel | P3 | Moteur + Interface | type stocké sans éditeur |
| AC-541 | Propriété | Type : Lien hypertexte (texte#adresse#info) | OK | P2 | Moteur + Interface | types.rs LienHypertexte ; validation http/https/mailto |
| AC-542 | Propriété | Type : Pièce jointe (multi-fichiers, compression) | Partiel | P1 | Moteur + Pont Tauri + Interface | types.rs PieceJointe ; pas de dialogue de gestion des pièces jointes |
| AC-543 | Propriété | Type : Calculé (expression, type de résultat) | OK | P1 | Moteur + Interface | types.rs Calcule + Expression/type_resultat |
| AC-544 | Propriété | Type : Texte enrichi (HTML) | Absent | P3 | Moteur + Interface | propriété format_texte du moteur, pas d'éditeur |
| AC-545 | Propriété | Type : Assistant Liste de choix… | Partiel | P1 | Interface | strings.ts types.liste_choix ; onglet Liste de choix sans assistant |
| AC-546 | Propriété | Propriété : Taille du champ | OK | P1 | Moteur + Interface | ProprietesChamp.taille ; TableDesign.tsx |
| AC-547 | Propriété | Propriété : Format (Nombre standard, Monétaire, Euro, Fixe, Pourcentage, Scientifique ; Date complète/réduite/abrégée ; Oui/Non, Vrai/Faux, Actif/Inactif ; > < @ &) | Partiel | P1 | Moteur + Interface | expr.rs format_access ; saisie libre sans liste de formats prédéfinis |
| AC-548 | Propriété | Propriété : Décimales | OK | P2 | Moteur + Interface | ProprietesChamp.decimales |
| AC-549 | Propriété | Propriété : Masque de saisie (assistant Masque de saisie) | Partiel | P2 | Moteur + Interface | masque.rs complet (0 9 # L ? A a & C > < ! \ ") ; pas d'assistant |
| AC-550 | Propriété | Propriété : Légende | OK | P1 | Moteur + Interface | ProprietesChamp.legende |
| AC-551 | Propriété | Propriété : Valeur par défaut (expressions : Date(), Maintenant()) | OK | P1 | Moteur + Interface | ProprietesChamp.valeur_defaut |
| AC-552 | Propriété | Propriété : Valide si (règle de validation, expression) | OK | P1 | Moteur + Interface | ProprietesChamp.valide_si |
| AC-553 | Propriété | Propriété : Message si erreur | OK | P1 | Moteur + Interface | message_validation |
| AC-554 | Propriété | Propriété : Null interdit (Requis) | OK | P1 | Moteur + Interface | requis |
| AC-555 | Propriété | Propriété : Chaîne vide autorisée | OK | P2 | Moteur + Interface | chaine_vide_autorisee |
| AC-556 | Propriété | Propriété : Indexé (Non, Oui avec doublons, Oui sans doublons) | OK | P1 | Moteur + Interface | Indexation |
| AC-557 | Propriété | Propriété : Compression Unicode | Absent | P3 | Interface | sans objet (SQLite stocke en UTF-8) |
| AC-558 | Propriété | Propriété : Mode IME / Mode phrase IME | Absent | P3 | Interface | sans objet |
| AC-559 | Propriété | Propriété : Balises actives | Absent | P3 | Interface | sans objet (retirées) |
| AC-560 | Propriété | Propriété : Aligner le texte (Standard, Gauche, Centre, Droite) | OK | P3 | Moteur + Interface | alignement |
| AC-561 | Propriété | Propriété : Ajout seulement (historique des modifications d'un mémo) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-562 | Propriété | Propriété : Afficher le sélecteur de dates | Absent | P2 | Moteur + Interface | absent en feuille de données |
| AC-563 | Propriété | Propriété : Description | OK | P2 | Moteur + Interface | description |
| AC-564 | Propriété | Propriété : Rechercher > Afficher le contrôle (Zone de texte / Zone de liste / Zone de liste déroulante) | Partiel | P2 | Interface | TableDesign.tsx onglet Liste de choix (valeurs fixes seulement) |
| AC-565 | Propriété | Propriété : Rechercher > Origine source (Table/Requête, Liste de valeurs, Liste de champs) | Partiel | P1 | Moteur + Interface | moteur : source_liste ; UI : liste de valeurs seulement |
| AC-566 | Propriété | Propriété : Rechercher > Contenu (requête ou valeurs) | Partiel | P1 | Moteur + Interface | liste_valeurs |
| AC-567 | Propriété | Propriété : Rechercher > Contenu de la colonne / Nombre de colonnes / En-têtes / Largeurs de colonnes / Lignes affichées / Largeur de la liste | Absent | P2 | Moteur + Interface | absent |
| AC-568 | Propriété | Propriété : Rechercher > Limiter à liste | OK | P1 | Moteur + Interface | limiter_a_liste |
| AC-569 | Propriété | Propriété : Rechercher > Autoriser plusieurs valeurs (champ multivalué) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-570 | Propriété | Propriété : Rechercher > Autoriser modification de liste de valeurs / formulaire d'édition | Absent | P3 | Interface | absent |
| AC-571 | Propriété | Table : propriétés (Description, Règle de validation, Message de validation, Filtre, Trier par, Filtrer au chargement, Trier au chargement, Nom de la sous-feuille, Hauteur de la sous-feuille, Orientation, Mode par défaut) | Partiel | P2 | Moteur + Interface | ProprietesTable (meta.rs) : description, validation ; reste absent |
| AC-572 | Propriété | Table : clé primaire composite (plusieurs champs) | Partiel | P1 | Moteur + Interface | structure.rs ; ribbon.tsx pk (un champ à la fois à vérifier) |
| AC-573 | Propriété | Table : index multi-champs nommés | Absent | P1 | Pont Tauri + Interface | index.rs prêt ; non exposé |
| AC-574 | Propriété | Table : règle de validation de l'enregistrement | Partiel | P2 | Moteur + Interface | ProprietesTable.valide_si |
| AC-575 | Propriété | Table : champs calculés | OK | P1 | Moteur | colonnes générées SQLite (structure.rs) |
| AC-576 | Propriété | Table : modification de structure d'une table pleine (reconstruction transactionnelle) | OK | P1 | Moteur | structure.rs RapportStructure + avertissements |
| AC-577 | Propriété | Table : renommer / copier (structure, structure + données) / supprimer | OK | P1 | Moteur + Pont Tauri + Interface | Op renommer_table / copier_table / supprimer_table |
| AC-578 | Propriété | Table : sous-feuille de données | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-579 | Propriété | Table : propriétés de base de données (titre, auteur, mots-clés, statistiques) | Absent | P3 | Moteur + Pont Tauri + Interface | absent (infos de base en Backstage) |

## 21. Boîtes de dialogue

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-580 | Dialogue | Enregistrer sous (nom d'objet) | Présent à vérifier | P1 | Interface | Dialogs.tsx prompt (valide les noms Access, strings.ts err.name*) |
| AC-581 | Dialogue | Confirmation de suppression d'enregistrements (Oui/Non, irréversible) | Présent à vérifier | P1 | Interface | strings.ts ds.deleteConfirm/deleteWarn |
| AC-582 | Dialogue | Confirmation de requête action (« Vous êtes sur le point… ») | Présent à vérifier | P1 | Interface | strings.ts q.actionConfirm |
| AC-583 | Dialogue | Fermer sans enregistrer (Oui / Non / Annuler) | Partiel | P1 | Interface | strings.ts dlg.closeUnsaved (Fermer quand même / Annuler, sans bouton Enregistrer) |
| AC-584 | Dialogue | Afficher la table (onglets Tables / Requêtes / Les deux) | Présent à vérifier | P1 | Interface | QueryDesign.tsx q.addTables |
| AC-585 | Dialogue | Propriétés de la jointure (3 choix) | Présent à vérifier | P1 | Interface | QueryDesign.tsx q.joinProps |
| AC-586 | Dialogue | Modifier des relations (tables, champs, intégrité, cascades, type de jointure, Créer nouveau) | Présent à vérifier | P1 | Interface | Relations.tsx |
| AC-587 | Dialogue | Paramètres de requête | Présent à vérifier | P2 | Interface | QueryDesign.tsx q.params |
| AC-588 | Dialogue | Entrer une valeur de paramètre | Présent à vérifier | P1 | Interface | q.paramPrompt |
| AC-589 | Dialogue | Rechercher et remplacer (Rechercher / Remplacer, Rechercher dans, Critères : n'importe quelle partie / champ entier / début, Respecter la casse, Rechercher dans les champs mis en forme, Rechercher en haut/bas/tout) | Partiel | P1 | Interface | barre de recherche + Remplacer simple (op remplacer_tout avec casse) |
| AC-590 | Dialogue | Importation Excel (feuille ou plage nommée, première ligne = en-têtes, options de champ nom/type/indexé/ignorer, clé primaire, nom de table, Mode : nouvelle table / ajouter / remplacer) | Partiel | P1 | Interface | Dialogs.tsx ImportDialog (modes, en-têtes, clé NuméroAuto) ; pas d'options de champ ni de choix de feuille/plage |
| AC-591 | Dialogue | Importation texte (Délimité / Largeur fixe, séparateur, qualificateur, Avancé, spécification d'import) | Partiel | P1 | Interface | csv.rs deviner_separateur ; pas de largeur fixe, de qualificateur ni d'encodage au choix à l'écran |
| AC-592 | Dialogue | Importation Access (choix des tables, Définition et données / Définition seulement, relations, requêtes, formulaires, états) | Absent | P1 | Pont Tauri + Interface | import_access.rs : tables seulement, non exposé |
| AC-593 | Dialogue | Exportation Excel / texte / HTML (nom, format, avec mise en forme, ouvrir après) | Partiel | P1 | Interface | exchange.ts : écriture directe sans options |
| AC-594 | Dialogue | Exportation PDF / XPS (qualité, plages de pages, publier) | Absent | P1 | Interface | absent |
| AC-595 | Dialogue | Exportation XML / ODBC / dBASE / RTF | Absent | P3 | Interface | absent |
| AC-596 | Dialogue | Documenteur de base de données (onglets par type d'objet, Options : propriétés, relations, autorisations) | Partiel | P2 | Interface | ToolsViews.tsx : documentation de tous les objets, sans choix |
| AC-597 | Dialogue | Analyseur de performances (onglets par type, Tout, résultats Recommandation/Suggestion/Idée, Optimiser) | Partiel | P3 | Interface | logic/analyze.ts |
| AC-598 | Dialogue | Analyseur de table (assistant 3 étapes, scission en tables liées) | Partiel | P3 | Interface | conseils de conception sans assistant de scission |
| AC-599 | Dialogue | Gestionnaire de tables liées | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-600 | Dialogue | Compacter et réparer (progression, rapport) | Présent à vérifier | P2 | Interface | avant/après (strings tools.compacted) |
| AC-601 | Dialogue | Options Access (13 catégories) | Absent | P1 | Interface | aucune boîte d'options pour la base |
| AC-602 | Dialogue | Options Access > Général (interface, création de bases, dossier par défaut, format de fichier par défaut, taille de police) | Absent | P2 | Interface | absent |
| AC-603 | Dialogue | Options Access > Base de données active (titre, icône, formulaire d'affichage, compacter à la fermeture, utiliser les thèmes de contrôles, mode Page, modifications de table, format de légende, documents à onglets, options de navigation, vérification des troncatures) | Absent | P1 | Interface | absent |
| AC-604 | Dialogue | Options Access > Feuille de données (couleurs, quadrillage, police par défaut, effets) | Absent | P3 | Interface | absent |
| AC-605 | Dialogue | Options Access > Concepteurs d'objets (tables : type par défaut, taille texte/nombre, préfixes d'index auto ; requêtes ; formulaires/états : modèle, sélection ; vérification d'erreurs) | Absent | P3 | Interface | absent |
| AC-606 | Dialogue | Options Access > Vérification (correction automatique, orthographe, dictionnaires) | Absent | P2 | Interface | absent |
| AC-607 | Dialogue | Options Access > Langue | Absent | P3 | Interface | interface français fixe |
| AC-608 | Dialogue | Options Access > Paramètres client (Déplacer après Entrée, Comportement à l'entrée du champ, Touches fléchées, Afficher barre d'état/animations/info-bulles, Taille liste récents, Chiffres de l'année sur quatre chiffres, Confirmer modifications d'enregistrement/suppressions de document/requêtes action) | Absent | P2 | Interface | absent (confirmations toujours actives) |
| AC-609 | Dialogue | Options Access > Personnaliser le ruban / Barre d'outils Accès rapide | Absent | P3 | Interface | absent |
| AC-610 | Dialogue | Options Access > Compléments / Centre de gestion de la confidentialité | Absent | P3 | Interface | sans objet |
| AC-611 | Dialogue | Générateur d'expressions (éléments, catégories, valeurs, IntelliSense, aide) | Partiel | P1 | Interface | absent ; indispensable pour requêtes, champs calculés, validation, macros ; 2026-11-06 : Générateur d'expression (Ctrl+F2 ou clic droit « Générer… ») dans les cellules Champ et Critères de la grille de requête : catégories, éléments à double-clic, contrôle de syntaxe ; sans IntelliSense ni aide, pas encore dans propriétés, validation ni macros |
| AC-612 | Dialogue | Propriétés de la base de données (Général, Résumé, Statistiques, Contenu, Personnalisé) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-613 | Dialogue | Zoom (Maj+F2) | Absent | P2 | Interface | absent |
| AC-614 | Dialogue | Mise en page (Marges, Page : orientation/papier/source, Colonnes : nombre, taille, disposition) | Absent | P1 | Moteur + Interface | absent (orientation seulement) |
| AC-615 | Dialogue | Imprimer (imprimante, plage, copies, assemblage) | Partiel | P2 | Interface | window.print du navigateur / services.print |
| AC-616 | Dialogue | Ordre de tabulation (Section, Ordre personnalisé, Ordre automatique) | Absent | P2 | Moteur + Interface | absent |
| AC-617 | Dialogue | Trier et grouper (volet : Ajouter un groupe / un tri, options : en-tête, pied, Regrouper par intervalle, Garder ensemble, totaux) | Partiel | P1 | Interface | liste « Regrouper » d'un niveau ; le moteur gère plusieurs niveaux (etats.rs) |
| AC-618 | Dialogue | Mise en forme conditionnelle (Gestionnaire de règles : Valeur du champ, Expression, Barre de données) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-619 | Dialogue | Sélecteur de couleurs (Thème, Standard, Autres couleurs, Dernières couleurs, Transparent) | Absent | P2 | Interface | absent (pas de couleurs de contrôle) |
| AC-620 | Dialogue | Sélecteur de police | Absent | P3 | Interface | absent |
| AC-621 | Dialogue | Chiffrer / Déchiffrer avec mot de passe | Absent | P1 | Moteur + Pont Tauri + Interface | absent |
| AC-622 | Dialogue | Boîte de message de macro (ZoneMessage : message, icône, titre) | Partiel | P2 | Interface | App.tsx playMacro -> notification ; pas de boîte modale ni de choix d'icône |
| AC-623 | Dialogue | Boîte de saisie InputBox / menu de sélection | Absent | P3 | Interface | sans objet sans VBA |
| AC-624 | Dialogue | Boîte « Ajouter des champs existants » (liste de champs, tables associées) | Partiel | P1 | Interface | FormView.tsx liste de champs de la source seule |
| AC-625 | Dialogue | Boîte de choix « Ouvrir » (fichier .fodb/.sqlite/.db + .accdb/.mdb) | Partiel | P1 | Interface | BackstagePages.tsx ; .accdb/.mdb non ouvrables |
| AC-626 | Dialogue | Boîte d'enregistrement de la base sous (format Access 2002-2016, modèle, copie) | Partiel | P2 | Interface | Backstage Enregistrer sous / Sauvegarder (copie .fodb) |
| AC-627 | Dialogue | Récupération en cas de plantage | Partiel | P2 | Moteur | SQLite WAL (base.rs) ; pas d'écran dédié |

## 22. Assistants

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-628 | Assistant | Assistant Formulaire (choix de tables/champs, disposition Colonnes/Tabulaire/Feuille de données/Justifié, style, titre) | Absent | P1 | Interface | absent ; le moteur sait déjà générer (objets.rs formulaire_instantane + Disposition) |
| AC-629 | Assistant | Assistant État (champs, niveaux de regroupement, tri, totaux, disposition, orientation, style) | Absent | P1 | Interface | absent ; moteur : etats.rs etat_instantane_regroupe (multi-niveaux) non branché |
| AC-630 | Assistant | Assistant Requête simple (champs de plusieurs tables, Détail / Récapitulatif, options de synthèse) | Absent | P1 | Interface | absent |
| AC-631 | Assistant | Assistant Requête Analyse croisée | Absent | P2 | Interface | absent (le créateur sait construire une analyse croisée) |
| AC-632 | Assistant | Assistant Requête Doublons | Absent | P2 | Interface | absent |
| AC-633 | Assistant | Assistant Requête Non-correspondance | Absent | P2 | Interface | absent |
| AC-634 | Assistant | Assistant Liste de choix (champ de table : valeurs saisies ou table/requête) | Absent | P1 | Interface | absent (onglet Liste de choix manuel) |
| AC-635 | Assistant | Assistant Masque de saisie (téléphone, code postal, date, mot de passe…) | Absent | P2 | Interface | absent (masque.rs complet côté moteur) |
| AC-636 | Assistant | Assistant Contrôle : Bouton de commande (catégories d'actions : navigation, enregistrement, état, formulaire, application, divers) | Absent | P1 | Moteur + Interface | absent (aucun bouton de commande) |
| AC-637 | Assistant | Assistant Contrôle : Zone de liste déroulante / Zone de liste (rechercher un enregistrement, valeurs, colonnes) | Absent | P1 | Moteur + Interface | absent |
| AC-638 | Assistant | Assistant Contrôle : Groupe d'options | Absent | P3 | Moteur + Interface | absent |
| AC-639 | Assistant | Assistant Contrôle : Sous-formulaire/Sous-état (choisir la source, champs liés maître/détail) | Absent | P1 | Pont Tauri + Interface | moteur prêt : sous_formulaire.rs (liens déduits de la relation) ; ni pont ni interface |
| AC-640 | Assistant | Assistant Contrôle : Graphique | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-641 | Assistant | Assistant Contrôle : Image / Cadre d'objet | Absent | P3 | Interface | absent |
| AC-642 | Assistant | Assistant Étiquettes (format Avery, taille, police, champs) | Absent | P2 | Moteur + Interface | absent |
| AC-643 | Assistant | Assistant Analyseur de table (scinder une table en tables liées) | Partiel | P3 | Interface | conseils de conception seulement |
| AC-644 | Assistant | Assistant Importation Excel / texte / HTML / XML / Access | Partiel | P1 | Interface | dialogue d'import simplifié (pas un assistant à pages) |
| AC-645 | Assistant | Assistant Exportation | Partiel | P2 | Interface | export direct |
| AC-646 | Assistant | Assistant Formulaire de navigation | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-647 | Assistant | Assistant Scinder la base de données (données + interface) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-648 | Assistant | Assistant Conversion de macros en VBA | Absent | P3 | Interface | sans objet |
| AC-649 | Assistant | Assistant Table de liaison plusieurs-à-plusieurs | Absent | P3 | Interface | absent |
| AC-650 | Assistant | Assistant Composants d'application / Modèles | Partiel | P2 | Interface | 4 modèles (templates.ts), sans galerie ni composants d'objet |
| AC-651 | Assistant | Assistant Mise en forme conditionnelle | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-652 | Assistant | Assistant Fusion Word | Absent | P3 | Interface | absent |

## 23. Contrôles de formulaire et d'état (liste complète)

> Vérité-terrain COM : barre « Toolbox » (20 contrôles) + galerie 365. Types de contrôle valides testés avec CreateControl : étiquette 100, rectangle 101, ligne 102, image 103, bouton 104, bouton d'option 105, case à cocher 106, groupe d'options 107, cadre dépendant 108, zone de texte 109, zone de liste 110, zone de liste déroulante 111, sous-formulaire 112, cadre indépendant 114, saut de page 118, contrôle personnalisé 119, bouton bascule 122, onglet 123, page 124, pièce jointe 126, navigateur web 128, contrôle de navigation 129. Nombre de propriétés par contrôle : voir section 24. ForgeOffice stocke un contrôle avec 13 champs seulement (types.ts Controle : type, nom, champ, etiquette, texte, source, style, x, y, largeur, hauteur, lecture_seule, aligne_droite, valeurs).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-653 | Contrôle | Sélectionner (outil flèche, sélection multiple au lasso) | Partiel | P1 | Interface | clic = sélection d'un seul contrôle (DesignCanvas.tsx) ; pas de lasso ni de Maj+clic |
| AC-654 | Contrôle | Étiquette | Présent à vérifier | P1 | Interface | ribbon.tsx lbl ; DesignCanvas.tsx |
| AC-655 | Contrôle | Zone de texte (liée ou calculée) | Présent à vérifier | P1 | Interface | ribbon.tsx tb ; source = champ ou expression (logic/report.ts evalReportExpression) |
| AC-656 | Contrôle | Zone de texte multiligne | Partiel | P2 | Interface | zone_texte_multiligne rendue (FormView.tsx) ; non proposée dans la barre de création |
| AC-657 | Contrôle | Case à cocher | Partiel | P1 | Interface | produite par la liste de champs (oui_non) et rendue ; pas dans une barre d'outils |
| AC-658 | Contrôle | Bouton d'option | Absent | P2 | Moteur + Interface | absent |
| AC-659 | Contrôle | Bouton bascule | Absent | P3 | Moteur + Interface | absent |
| AC-660 | Contrôle | Groupe d'options | Absent | P2 | Moteur + Interface | absent |
| AC-661 | Contrôle | Zone de liste déroulante (liée à une table, valeurs, colonnes) | Partiel | P1 | Moteur + Interface | zone_liste_deroulante rendue d'après liste_valeurs ; pas de source table/requête ni de colonnes multiples |
| AC-662 | Contrôle | Zone de liste | Absent | P2 | Moteur + Interface | absent |
| AC-663 | Contrôle | Bouton de commande (actions, macro d'événement) | Absent | P1 | Moteur + Interface | absent ; aucun modèle d'événement |
| AC-664 | Contrôle | Image (liée à un fichier, intégrée) | Absent | P2 | Moteur + Interface | absent |
| AC-665 | Contrôle | Cadre d'objet indépendant | Absent | P3 | Interface | absent |
| AC-666 | Contrôle | Cadre d'objet dépendant | Absent | P3 | Interface | absent |
| AC-667 | Contrôle | Saut de page | Absent | P2 | Moteur + Interface | absent |
| AC-668 | Contrôle | Contrôle Onglet (pages) | Absent | P1 | Moteur + Interface | absent |
| AC-669 | Contrôle | Sous-formulaire / Sous-état | Absent | P1 | Pont Tauri + Interface | moteur : sous_formulaire.rs (STATUS forge-base du 2026-11-05) ; non branché |
| AC-670 | Contrôle | Ligne | Absent | P2 | Moteur + Interface | absent |
| AC-671 | Contrôle | Rectangle | Absent | P2 | Moteur + Interface | absent |
| AC-672 | Contrôle | Lien hypertexte (contrôle) | Partiel | P2 | Interface | type lien_hypertexte rendu ; pas de création |
| AC-673 | Contrôle | Sélecteur de date (zone de texte date) | Partiel | P2 | Interface | selecteur_date rendu en formulaire |
| AC-674 | Contrôle | Pièce jointe (contrôle, visionneuse) | Partiel | P1 | Moteur + Pont Tauri + Interface | type rendu, pas de gestion des fichiers joints |
| AC-675 | Contrôle | Navigateur web | Absent | P3 | Interface | absent |
| AC-676 | Contrôle | Contrôle de navigation (onglets de navigation) | Absent | P2 | Moteur + Interface | absent |
| AC-677 | Contrôle | Bouton de navigation | Absent | P2 | Moteur + Interface | absent |
| AC-678 | Contrôle | Graphique (classique / moderne) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-679 | Contrôle | Contrôle personnalisé ActiveX | Absent | P3 | Interface | sans objet |
| AC-680 | Contrôle | Autres contrôles… | Absent | P3 | Interface | sans objet |
| AC-681 | Contrôle | Utiliser les Assistants Contrôle (bascule) | Absent | P2 | Interface | absent |
| AC-682 | Contrôle | Barre de navigation d'enregistrements (premier, précédent, n sur N, suivant, dernier, nouveau, recherche) | Présent à vérifier | P1 | Interface | FormView.tsx navigation (strings forms.recordOf) |
| AC-683 | Contrôle | Sélecteurs d'enregistrement, séparateurs, barres de défilement | Absent | P3 | Moteur + Interface | absent |
| AC-684 | Contrôle | Déplacement d'un contrôle par glissement avec magnétisme (grille 4 px) | Présent à vérifier | P1 | Interface | DesignCanvas.tsx move/GRID (le propriétaire a signalé que d'autres objets du produit ne se déplaçaient pas : ici c'est présent mais seulement dans formulaires/états) |
| AC-685 | Contrôle | Redimensionnement d'un contrôle par poignée unique (coin bas-droit) | Partiel | P1 | Interface | une seule poignée ; Access en a 8 |
| AC-686 | Contrôle | Étiquette attachée à un contrôle, déplacement séparé | Partiel | P2 | Interface | l'étiquette suit le contrôle (labels=true) |
| AC-687 | Contrôle | Sélection multiple, déplacement de groupe | Absent | P1 | Interface | absent |
| AC-688 | Contrôle | Copier/coller/dupliquer des contrôles | Absent | P1 | Interface | absent |
| AC-689 | Contrôle | Alignement, répartition, taille uniforme | Absent | P1 | Interface | absent |
| AC-690 | Contrôle | Superposition (avancer/reculer) | Absent | P2 | Interface | absent |
| AC-691 | Contrôle | Flèches clavier pour déplacer (Ctrl+flèche) / redimensionner (Maj+flèche) | Absent | P2 | Interface | absent (Suppr seulement) |
| AC-692 | Contrôle | Règles et grille visibles, magnétisme activable | Absent | P2 | Interface | absent |
| AC-693 | Contrôle | Zoom de la surface de création | Absent | P3 | Interface | absent |
| AC-694 | Contrôle | Annuler / Rétablir dans le concepteur | Absent | P1 | Interface | absent |
| AC-695 | Contrôle | Sections de formulaire : En-tête, Détail, Pied | Présent à vérifier | P1 | Interface | DesignCanvas.tsx sections ; hauteur automatique, non réglable à la souris |
| AC-696 | Contrôle | Sections d'état : En-tête d'état, En-tête de page, En-tête de groupe, Détail, Pied de groupe, Pied de page, Pied d'état | Partiel | P1 | Interface | cinq sections fixes (ReportView.tsx SECTIONS) ; pas d'en-tête/pied de groupe en conception (le groupement existe à l'exécution) |
| AC-697 | Contrôle | Redimensionnement de la hauteur d'une section à la souris | Absent | P1 | Interface | absent |
| AC-698 | Contrôle | Mode Page : disposition de contrôles en grille (Quadrillage/Empilé/Tabulaire) avec données réelles | Absent | P1 | Moteur + Interface | STATUS : le mode Page affiche les noms de champs |
| AC-699 | Contrôle | Mode Formulaire : saisie et validation avec règles du moteur | OK | P1 | Moteur + Interface | FormView.tsx + logic/values.ts ; testé (logic.test.ts saisie/validation) |
| AC-700 | Contrôle | Dispositions de formulaire : simple, tabulaire (plusieurs éléments), feuille de données, double affichage | OK | P1 | Moteur + Interface | objets.rs Disposition ; testé par le scénario du moteur |
| AC-701 | Contrôle | Formulaire lié à une requête (lecture) | Partiel | P1 | Interface | useRecords : requête = lecture seule ; moteur prêt pour l'édition (requete_editable.rs) |
| AC-702 | Contrôle | Formulaire non lié (boîte de dialogue, accueil) | Absent | P2 | Moteur + Interface | absent |
| AC-703 | Contrôle | Formulaire modal / contextuel / sans bordure | Absent | P3 | Interface | absent |
| AC-704 | Contrôle | Formulaire de démarrage (Options de la base active) | Absent | P2 | Moteur + Interface | absent |

## 24. Feuille de propriétés (F4)

> Vérité-terrain COM (nombre de propriétés lues sur des objets créés par CreateForm/CreateControl) : Formulaire 252 (89 événements, 31 macros incorporées « …EmMacro »), État 178, Section de formulaire 36 / d'état 42, Zone de texte 151 (34 événements), Zone de liste déroulante 160, Zone de liste 127, Bouton 135 (24 événements), Bouton bascule 137, Pièce jointe 107, Contrôle Onglet 105, Cadre dépendant 110, Cadre indépendant 96, Navigateur web 97, Contrôle de navigation 89, Case à cocher 93, Bouton d'option 93, Étiquette 90, Image 78, Groupe d'options 70, Sous-formulaire 62, Rectangle 60, Ligne 46, Saut de page 9. Onglets de la feuille : Format, Données, Événement, Autre, Toutes. ForgeOffice : aucune feuille de propriétés d'objet de formulaire/état ; seule la feuille de propriétés de champ/table existe (TableDesign.tsx).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-705 | Propriété | Feuille de propriétés : volet ancré à droite, liste « Type de sélection », onglets Format/Données/Événement/Autre/Toutes | Absent | P1 | Interface | absent |
| AC-706 | Propriété | Propriétés du formulaire > Données : Source (RecordSource), Filtre, Trier par, Type de jeu, Verrouillage, Saisie de données, Autoriser ajouts/suppressions/modifications/filtres | Absent | P1 | Moteur + Interface | seule `source` est stockée (types.ts Maquette) |
| AC-707 | Propriété | Propriétés du formulaire > Format : Titre, Mode par défaut, Modes autorisés, Barres de défilement, Sélecteurs d'enregistrement, Boutons de navigation, Séparateurs, Centrage automatique, Style de bordure, Zone de contrôle, Boutons Fermer/Agrandir/Réduire, Largeur, Image, Mode de redimensionnement, Taille du fractionnement | Absent | P1 | Moteur + Interface | seuls `titre` et `disposition` existent |
| AC-708 | Propriété | Propriétés du formulaire > Autre : Fenêtre indépendante (PopUp), Modal, Cycle, Menu contextuel, Nom du ruban, Barre d'outils, Étiquette (Tag), Balises, Aide | Absent | P2 | Moteur + Interface | absent |
| AC-709 | Propriété | Propriétés du formulaire > Feuille de données : police, hauteur de ligne, couleurs, quadrillage, colonnes figées | Absent | P3 | Moteur + Interface | absent |
| AC-710 | Propriété | Propriétés de l'état : Source, Filtre, Trier par, Largeur, Image, Mode d'état, Mode Page, Orientation, Mise en page pour impression, Papier | Absent | P1 | Moteur + Interface | seule `orientation` existe |
| AC-711 | Propriété | Propriétés de section : Visible, Hauteur, Couleur d'arrière-plan, Couleur alternée, Peut s'agrandir/se réduire, Saut de page forcé, Garder ensemble, Afficher quand, Nouvelle ligne ou colonne | Absent | P1 | Moteur + Interface | seule la hauteur est implicite |
| AC-712 | Propriété | Propriétés de contrôle > Format : Visible, Légende, Largeur, Hauteur, Haut, Gauche | Partiel | P1 | Interface | x/y/largeur/hauteur modifiables à la souris, pas à la saisie |
| AC-713 | Propriété | Propriétés de contrôle > Format : Style/Couleur/Épaisseur de bordure, Effet spécial, Couleur d'arrière-plan, Transparence | Absent | P1 | Moteur + Interface | absent |
| AC-714 | Propriété | Propriétés de contrôle > Format : Police (nom, taille, gras, italique, souligné, couleur), Alignement du texte, Interligne | Absent | P1 | Moteur + Interface | seul `style: titre` et `aligne_droite` existent |
| AC-715 | Propriété | Propriétés de contrôle > Format : Format, Décimales, Texte enrichi, Défilement | Absent | P1 | Moteur + Interface | format de champ du moteur non répercuté sur le contrôle |
| AC-716 | Propriété | Propriétés de contrôle > Format : Marges et remplissage, Ancrage horizontal/vertical, Alignement | Absent | P2 | Moteur + Interface | absent |
| AC-717 | Propriété | Propriétés de contrôle > Format : Peut s'agrandir / se réduire, Afficher quand | Absent | P2 | Moteur + Interface | absent |
| AC-718 | Propriété | Propriétés de contrôle > Données : Source contrôle, Masque de saisie, Valeur par défaut, Règle de validation, Message, Activé, Verrouillé, Filtrer la liste de choix, Saisie automatique | Partiel | P1 | Interface | `champ`/`source` et `lecture_seule` seulement |
| AC-719 | Propriété | Propriétés de contrôle > Données (liste) : Origine source, Contenu, Colonne liée, Nb de colonnes, Largeurs, Lignes affichées, Limiter à liste | Absent | P1 | Moteur + Interface | seul `valeurs` (liste fixe) |
| AC-720 | Propriété | Propriétés de contrôle > Autre : Nom | Partiel | P2 | Interface | `nom` stocké, non éditable |
| AC-721 | Propriété | Propriétés de contrôle > Autre : Texte de l'info-bulle, Index de tabulation, Arrêt tabulation, Texte de la barre d'état, Menu contextuel, Étiquette (Tag) | Absent | P2 | Moteur + Interface | absent |
| AC-722 | Propriété | Propriétés de contrôle > Événement : Sur clic, Sur double-clic, Avant/Après MAJ, Sur changement, Sur entrée/sortie, Sur souris, Sur touche… | Absent | P1 | Moteur + Pont Tauri + Interface | AUCUN modèle d'événement : les macros ne peuvent être attachées ni à un contrôle ni à un formulaire |
| AC-723 | Propriété | Propriétés du formulaire > Événement : Sur ouverture, Sur chargement, Sur activation, Sur courant, Avant insertion, Après insertion, Avant MAJ, Après MAJ, Sur suppression, Sur fermeture, Sur minuterie, Sur erreur, Sur filtre (89 événements) | Absent | P1 | Moteur + Pont Tauri + Interface | absent |
| AC-724 | Propriété | Événements : macros incorporées (« Macro incorporée » dans les propriétés) | Absent | P1 | Moteur + Pont Tauri + Interface | absent |
| AC-725 | Propriété | Événements : Procédure événementielle (VBA) | Absent | P3 | Interface | sans objet ; remplacer par scripts (voir Au-delà) |
| AC-726 | Propriété | Mise en forme conditionnelle (propriété ConditionalFormat14) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-727 | Propriété | Thèmes de formulaire (ThemeName, polices et couleurs de thème) | Absent | P3 | Moteur + Interface | absent |
| AC-728 | Propriété | Info-bulles de contrôle, ordre de tabulation, touches d'accès (&) | Absent | P2 | Moteur + Interface | absent |

## 25. Expressions et fonctions (noms français d'Access)

> Le moteur traduit les expressions Access (noms français ET anglais) vers SQLite : crates/forge-base/src/expr.rs, fonction `appel`. Les fonctions « requête seulement » sont refusées dans les règles de validation et champs calculés (contexte Schéma).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-729 | Expression | Opérateurs arithmétiques + - * / | OK | P1 | Moteur | expr.rs OPS |
| AC-730 | Expression | Opérateur division entière \ et Mod | OK | P2 | Moteur | OPS '\\' et mot-clé mod |
| AC-731 | Expression | Opérateur puissance ^ | Partiel | P3 | Moteur | expr.rs ligne 390 (requête seulement) |
| AC-732 | Expression | Opérateur de concaténation & | Absent | P1 | Moteur | absent de la liste OPS d'expr.rs : « [Nom] & " " & [Prénom] » est l'expression la plus courante d'Access ; à implémenter en `\|\|` SQLite (à vérifier d'abord par test) |
| AC-733 | Expression | Opérateurs de comparaison = <> < > <= >= | OK | P1 | Moteur | OPS |
| AC-734 | Expression | Opérateurs logiques Et, Ou, Pas | OK | P1 | Moteur | mot_cle et/or/not |
| AC-735 | Expression | Opérateurs logiques Xor, Eqv, Imp | Absent | P3 | Moteur | absent |
| AC-736 | Expression | Opérateurs Comme (jokers * ? # [liste]), Entre … Et, Dans (…), Est Null / Est Pas Null | OK | P1 | Moteur | expr.rs motif_like, entre, dans, est |
| AC-737 | Expression | Littéraux : texte "…", date #jj/mm/aaaa#, nombre, Vrai/Faux/Oui/Non/Null | OK | P1 | Moteur | expr.rs jetons |
| AC-738 | Expression | Identifiants [Champ avec espaces] et [Table].[Champ] | OK | P1 | Moteur | expr.rs crochets |
| AC-739 | Expression | Références de contrôles [Forms]![Formulaire]![Contrôle], [Reports]!…, Me.Contrôle, TempVars! | Absent | P1 | Moteur + Interface | absent : critères de requête paramétrés par un formulaire impossibles |
| AC-740 | Expression | Constantes intégrées (vbCrLf, vbTab, vbYes…) | Absent | P3 | Moteur | absent |
| AC-741 | Expression | Texte : Gauche (Left), Droite (Right), ExtracChaîne (Mid) | OK | P1 | Moteur | expr.rs |
| AC-742 | Expression | Texte : NbCar (Len), Majuscule (UCase), Minuscule (LCase) | OK | P1 | Moteur | expr.rs |
| AC-743 | Expression | Texte : SupprEspace (Trim), SupprEspaceG (LTrim), SupprEspaceD (RTrim) | OK | P1 | Moteur | expr.rs |
| AC-744 | Expression | Texte : DansChaîne (InStr), Remplacer (Replace), Espace (Space) | OK | P1 | Moteur | expr.rs |
| AC-745 | Expression | Texte : Asc, Car (Chr), CChaîne (CStr), Chaîne/Str | OK | P2 | Moteur | expr.rs |
| AC-746 | Expression | Texte : DansChaîneRev (InStrRev), InverseChaîne (StrReverse), Chaîne (String), ComparerChaînes (StrComp), ConvChaîne (StrConv) | Absent | P2 | Moteur | absent |
| AC-747 | Expression | Texte : Fractionner (Split), Joindre (Join), Filtrer (Filter), Partition | Absent | P3 | Moteur | absent |
| AC-748 | Expression | Texte : Format (dates, nombres, Oui/Non, motifs > < @) | Partiel | P1 | Moteur | expr.rs format_access : formats nommés limités, motifs aaaa jj mm hh nn ss, 0 # . , ; pas de « Monétaire », « Standard », « Fixe », « Scientifique », mmmm (nom du mois), dddd |
| AC-749 | Expression | Texte : FormatMonétaire, FormatNombre, FormatPourcentage, FormatDateHeure | Absent | P2 | Moteur | absent |
| AC-750 | Expression | Texte : Hex, Oct, Val | Partiel | P3 | Moteur | hex et Val (CAST) seulement |
| AC-751 | Expression | Texte : NomMois (MonthName), NomJourSemaine (WeekdayName) | Absent | P2 | Moteur | absent |
| AC-752 | Expression | Texte : Rechercher des caractères larges (StrConv vbWide) | Absent | P3 | Moteur | sans objet |
| AC-753 | Expression | Maths : Abs, Signe (Sgn), Ent (Int), Tronque (Fix), Arrondi (Round) | OK | P1 | Moteur | expr.rs (Arrondi : arrondi SQLite, pas l'arrondi bancaire d'Access) |
| AC-754 | Expression | Maths : Racine (Sqr) | Partiel | P2 | Moteur | fo_racine (fonction SQLite ajoutée, base.rs) ; requête seulement |
| AC-755 | Expression | Maths : Exp, Log, Atn, Cos, Sin, Tan | Absent | P2 | Moteur | absent (fonctions mathématiques SQLite non activées) |
| AC-756 | Expression | Maths : Rnd, Randomize (Alea) | Absent | P2 | Moteur | absent |
| AC-757 | Expression | Maths : Fonctions financières (VPM/Pmt, VA/PV, VC/FV, Taux/Rate, NPM, VAN, TRI, AMORLIN/SLN, DDB, SYD) | Absent | P3 | Moteur | absent |
| AC-758 | Expression | Maths : Var, EcartType (agrégats) | OK | P2 | Moteur | expr.rs variance() |
| AC-759 | Expression | Date : Date(), Maintenant (Now) | OK | P1 | Moteur | expr.rs (requête seulement) |
| AC-760 | Expression | Date : Heure() (Time), TimeSerial, TimeValue | Absent | P2 | Moteur | absent (« time » SQLite passe tel quel) |
| AC-761 | Expression | Date : Année, Mois, Jour, Heure, Minute, Seconde | OK | P1 | Moteur | partie_date |
| AC-762 | Expression | Date : JourSem (Weekday) | OK | P2 | Moteur | expr.rs |
| AC-763 | Expression | Date : PartDate (DatePart), AjDate (DateAdd), DiffDate (DateDiff) | OK | P1 | Moteur | expr.rs |
| AC-764 | Expression | Date : SérialDate (DateSerial), DateValeur (DateValue) | OK | P2 | Moteur | expr.rs |
| AC-765 | Expression | Date : Minuteur (Timer) | Absent | P3 | Moteur | absent |
| AC-766 | Expression | Date : DateDernierJourDuMois, semaines ISO, dates françaises (jj/mm/aaaa) en saisie | Partiel | P2 | Moteur + Interface | valeurs.rs analyser_date accepte les formats français |
| AC-767 | Expression | Conversion : CNum, CDbl, CSng, CDec, CMonétaire (CCur), Val | OK | P1 | Moteur | expr.rs CAST REAL |
| AC-768 | Expression | Conversion : CEntLong (CLng), CEnt (CInt) | OK | P1 | Moteur | expr.rs |
| AC-769 | Expression | Conversion : CDate (CVDate), CBool, CChaîne | OK | P1 | Moteur | expr.rs |
| AC-770 | Expression | Conversion : CByte, CVar, CGrandEntier (CLngLng) | Absent | P3 | Moteur | absent |
| AC-771 | Expression | Test : VraiFaux (IIf) | OK | P1 | Moteur | expr.rs |
| AC-772 | Expression | Test : Nz | OK | P1 | Moteur | expr.rs |
| AC-773 | Expression | Test : EstNull, EstDate, EstNumérique | OK | P1 | Moteur | expr.rs |
| AC-774 | Expression | Test : EstVide (IsEmpty), EstErreur, EstTableau, EstObjet, TypeName, VarType | Absent | P3 | Moteur | absent |
| AC-775 | Expression | Choix : Choisir (Choose), Commutateur (Switch) | OK | P2 | Moteur | expr.rs |
| AC-776 | Expression | Agrégat : Somme, Moyenne, Compte, Min, Max, Premier, Dernier | OK | P1 | Moteur | expr.rs agregat (requête seulement) |
| AC-777 | Expression | Agrégat : ÉcartType, Var | OK | P2 | Moteur | expr.rs |
| AC-778 | Expression | Domaine : DLookup / RechDom | Absent | P1 | Moteur + Pont Tauri + Interface | absent d'expr.rs ; sql.rs signale « valeur unique… pratique pour DLookup / DSum » mais aucune fonction DLookup n'est traduite |
| AC-779 | Expression | Domaine : DSum / DSomme, DCount / DNbVal, DAvg / DMoy, DMin, DMax, DFirst, DLast, DStDev, DVar | Absent | P1 | Moteur | absent (sous-requête corrélée SQLite possible) |
| AC-780 | Expression | Programme : Eval, Exécuter, CurrentUser/UtilisateurCourant, Environ, CurrentProject, Application | Absent | P3 | Moteur | absent |
| AC-781 | Expression | Programme : Date par défaut =Date() dans une valeur par défaut | OK | P1 | Moteur | ProprietesChamp.valeur_defaut |
| AC-782 | Expression | Programme : DoCmd | Absent | P3 | Moteur + Interface | remplacé par les actions de macro |
| AC-783 | Expression | Programme : Fonctions personnalisées (module) appelées depuis requêtes et formulaires | Absent | P2 | Moteur + Interface | modules stockés en texte (objets.rs), jamais compilés ni appelés |
| AC-784 | Expression | Fonctions SQLite disponibles en passage direct (coalesce, ifnull, nullif, length, lower, upper, substr, strftime, julianday, typeof, printf, hex, unicode, char, min, max, group_concat, total) | OK | P3 | Moteur | expr.rs ligne 624 |
| AC-785 | Expression | Générateur d'expressions (catalogue de fonctions, constantes, opérateurs) | Partiel | P1 | Interface | absent ; 2026-11-06 : catalogue du générateur limité aux fonctions réellement prises en charge par forge-base (expression-catalog.ts, test) : champs, 5 familles de fonctions, opérateurs, constantes |
| AC-786 | Expression | Messages d'erreur d'expression en français avec position | Partiel | P2 | Moteur | erreur.rs « fonction inconnue », « nombre d'arguments incorrect » |
| AC-787 | Expression | Expression dans les critères de requête avec paramètres [Entrer…] | OK | P1 | Moteur + Interface | sql.rs Parametres ; QueryDesign.tsx |
| AC-788 | Expression | Champ calculé de table (colonne générée) | OK | P1 | Moteur | structure.rs |

## 26. Macros : actions et structure

> ForgeOffice : 15 actions (objets.rs ACTIONS_MACRO), liste plate avec condition par action, exécutées par le moteur (données) ou renvoyées à l'application (interface), App.tsx playMacro.

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-789 | Macro | Action OuvrirTable (OpenTable) | OK | P1 | Moteur + Interface | ouvrir_table |
| AC-790 | Macro | Action OuvrirRequête (OpenQuery) | OK | P1 | Moteur + Interface | ouvrir_requete |
| AC-791 | Macro | Action OuvrirFormulaire (OpenForm : critère Where, mode, mode données) | Partiel | P1 | Moteur + Interface | ouvrir_formulaire sans filtre ni mode |
| AC-792 | Macro | Action OuvrirÉtat (OpenReport : aperçu, filtre) | Partiel | P1 | Moteur + Interface | ouvrir_etat |
| AC-793 | Macro | Action ExécuterSQL (RunSQL) | OK | P1 | Moteur | executer_sql |
| AC-794 | Macro | Action ZoneMessage (MessageBox : type, titre) | Partiel | P1 | Moteur + Interface | zone_message |
| AC-795 | Macro | Action FermerFenêtre (CloseWindow : enregistrer) | Partiel | P1 | Moteur + Interface | fermer_fenetre |
| AC-796 | Macro | Action Imprimer (PrintObject) | Partiel | P2 | Moteur + Interface | imprimer |
| AC-797 | Macro | Action Actualiser (Requery / RefreshRecord) | OK | P2 | Moteur + Interface | actualiser |
| AC-798 | Macro | Action ArrêterMacro (StopMacro) | OK | P2 | Moteur | arreter_macro |
| AC-799 | Macro | Action AppliquerFiltre (ApplyFilter) | OK | P1 | Moteur + Interface | appliquer_filtre |
| AC-800 | Macro | Action AtteindreEnregistrement (GoToRecord) | OK | P1 | Moteur + Interface | atteindre_enregistrement |
| AC-801 | Macro | Action ExporterAvecMiseEnForme (ExportWithFormatting) | Partiel | P2 | Moteur + Interface | exporter |
| AC-802 | Macro | Action DéfinirVariableTemp (SetTempVar) | Partiel | P2 | Moteur | definir_variable (les variables ne sont pas lisibles dans les expressions : pas de TempVars!) |
| AC-803 | Macro | Action OuvrirRequête d'action (ExécuterRequête) | OK | P1 | Moteur | executer_requete |
| AC-804 | Macro | Bloc Si / Sinon si / Sinon | Absent | P1 | Moteur + Interface | absent ; seule une condition par action |
| AC-805 | Macro | Bloc Sous-macro (SubMacro) et Groupe (Group) | Absent | P2 | Moteur + Interface | absent |
| AC-806 | Macro | Action ExécuterMacro (RunMacro) / ExécuterCode (RunCode) | Absent | P1 | Moteur + Interface | absent |
| AC-807 | Macro | Action DéfinirValeur (SetValue / SetProperty) | Absent | P1 | Moteur + Interface | absent (impossible de modifier un champ ou un contrôle) |
| AC-808 | Macro | Action AtteindreContrôle (GoToControl) / AtteindrePage / RechercherEnregistrement / RechercherSuivant | Absent | P2 | Moteur + Interface | absent |
| AC-809 | Macro | Action DéfinirFiltre / DéfinirOrdreTri (SetFilter / SetOrderBy) | Absent | P2 | Moteur + Interface | absent |
| AC-810 | Macro | Action EnregistrerObjet / CopierObjet / SupprimerObjet / RenommerObjet / SélectionnerObjet | Absent | P3 | Moteur + Interface | absent |
| AC-811 | Macro | Action Importer/Exporter (ImportExportData, Spreadsheet, Text, XML) | Absent | P2 | Moteur + Interface | absent |
| AC-812 | Macro | Action EnvoyerObjet (SendObject, courriel) | Absent | P3 | Interface | absent |
| AC-813 | Macro | Action Bip, Sablier (CurseurSablier), AfficherMasquerBarreEtat | Absent | P3 | Interface | absent |
| AC-814 | Macro | Action Réduire/Agrandir/Restaurer/Redimensionner fenêtre | Absent | P3 | Interface | absent |
| AC-815 | Macro | Action DéfinirVariableLocale (SetLocalVar), EffacerVariablesTemp | Absent | P2 | Moteur | absent |
| AC-816 | Macro | Action SurErreur (OnError), ReprendreErreur (RaiseError, ClearMacroError) | Absent | P2 | Moteur | absent |
| AC-817 | Macro | Action Quitter / FermerBaseDeDonnées | Absent | P3 | Interface | absent |
| AC-818 | Macro | Action NaviguerVers / ExécuterCommande (RunMenuCommand) | Absent | P2 | Interface | absent |
| AC-819 | Macro | Action AnnulerÉvénement (CancelEvent) | Absent | P2 | Moteur + Interface | absent (pas d'événements) |
| AC-820 | Macro | Macros de données (CreerEnregistrement, ModifierEnregistrement, SupprimerEnregistrement, RechercherEnregistrement, PourChaqueEnregistrement, DéfinirChamp, EnvoyerCourriel) sur événements de table | Absent | P2 | Moteur + Pont Tauri + Interface | absent (déclencheurs SQLite possibles) |
| AC-821 | Macro | Macro AutoExec (macro de démarrage) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-822 | Macro | Macro AutoKeys (raccourcis clavier globaux) | Absent | P3 | Moteur + Interface | absent |
| AC-823 | Macro | Macro : pas-à-pas / débogage / journal d'exécution | Absent | P2 | Interface | S.cmd.singleStep défini sans usage |
| AC-824 | Macro | Macro : arguments typés avec sélecteur (liste d'objets, modes) | Partiel | P2 | Interface | MacroView.tsx : arguments texte libres |
| AC-825 | Macro | Macro : exécution depuis un bouton de formulaire | Absent | P1 | Moteur + Interface | pas de bouton |
| AC-826 | Macro | Macro : conversion en script (module) | Absent | P3 | Moteur + Interface | absent |

## 27. Raccourcis clavier

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-827 | Raccourci | F1 Aide | Absent | P3 | Interface | absent |
| AC-828 | Raccourci | F2 basculer édition/navigation dans une cellule | Présent à vérifier | P1 | Interface | Datasheet.tsx |
| AC-829 | Raccourci | F4 feuille de propriétés | Absent | P1 | Interface | absent |
| AC-830 | Raccourci | F5 aller à l'enregistrement n° | Absent | P2 | Interface | absent |
| AC-831 | Raccourci | F6 changer de volet | Absent | P3 | Interface | absent |
| AC-832 | Raccourci | F7 orthographe | Absent | P3 | Interface | absent |
| AC-833 | Raccourci | F9 recalculer / Maj+F9 réinterroger | Absent | P2 | Interface | absent (bouton Actualiser) |
| AC-834 | Raccourci | F10 activer le ruban | Absent | P3 | Interface | absent |
| AC-835 | Raccourci | F11 afficher/masquer le volet de navigation | Présent à vérifier | P1 | Interface | App.tsx |
| AC-836 | Raccourci | F12 Enregistrer sous | Absent | P2 | Interface | absent |
| AC-837 | Raccourci | Maj+F2 Zoom | Absent | P2 | Interface | absent |
| AC-838 | Raccourci | Ctrl+F2 Générateur | Absent | P2 | Interface | absent |
| AC-839 | Raccourci | Ctrl+N nouvelle base | Absent | P2 | Interface | absent dans App.tsx (existe via Backstage) |
| AC-840 | Raccourci | Ctrl+O ouvrir une base | Absent | P2 | Interface | absent |
| AC-841 | Raccourci | Ctrl+S enregistrer l'objet | Présent à vérifier | P1 | Interface | App.tsx |
| AC-842 | Raccourci | Ctrl+P imprimer | Absent | P2 | Interface | absent (bouton) |
| AC-843 | Raccourci | Ctrl+F rechercher / Ctrl+H remplacer | Absent | P1 | Interface | absent (boutons) |
| AC-844 | Raccourci | Ctrl+Z annuler | Absent | P1 | Interface | absent |
| AC-845 | Raccourci | Ctrl+C / Ctrl+X / Ctrl+V | Partiel | P1 | Interface | Ctrl+C dans la grille ; X/V via menu |
| AC-846 | Raccourci | Ctrl+A tout sélectionner | OK | P2 | Interface | absent ; 2026-11-06 : Ctrl+A sélectionne toutes les cellules de la feuille de données |
| AC-847 | Raccourci | Ctrl+; date du jour, Ctrl+: heure | Absent | P3 | Interface | absent |
| AC-848 | Raccourci | Ctrl+' valeur du champ au-dessus, Ctrl+Alt+Espace valeur par défaut | Absent | P3 | Interface | absent |
| AC-849 | Raccourci | Ctrl++ nouvel enregistrement, Ctrl+- supprimer l'enregistrement | Partiel | P2 | Interface | Ctrl+Suppr supprime |
| AC-850 | Raccourci | Maj+Entrée enregistrer l'enregistrement, Échap annuler la modification | Partiel | P1 | Interface | Échap OK (Datasheet.tsx) ; Maj+Entrée absent |
| AC-851 | Raccourci | Flèches, Tab, Maj+Tab, Entrée dans la grille | Présent à vérifier | P1 | Interface | Datasheet.tsx |
| AC-852 | Raccourci | PgPréc / PgSuiv, Ctrl+Début / Fin, Ctrl+flèches | Absent | P2 | Interface | absent |
| AC-853 | Raccourci | Ctrl+F4 fermer l'objet, Ctrl+F6 / Ctrl+Tab objet suivant | Partiel | P2 | Interface | Ctrl+F4 seulement |
| AC-854 | Raccourci | Alt+F11 éditeur VBA, Ctrl+G fenêtre Exécution | Absent | P3 | Interface | sans objet |
| AC-855 | Raccourci | Alt+Entrée (bascule de mode création), F5 dans un état | Absent | P3 | Interface | absent |
| AC-856 | Raccourci | Touches d'accès Alt (ruban) | Absent | P2 | Interface | absent |
| AC-857 | Raccourci | Suppr dans le volet de navigation et dans le concepteur | Présent à vérifier | P1 | Interface | NavPane.tsx, FormView.tsx, Relations.tsx |

## 28. États

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-858 | Moteur | État : regroupement sur un niveau (en-tête/pied, totaux de groupe) | OK | P1 | Moteur + Interface | ReportView.tsx + logic/report.ts ; testé (logic.test.ts états) |
| AC-859 | Moteur | État : regroupement sur plusieurs niveaux | Absent | P1 | Pont Tauri + Interface | moteur prêt : etats.rs Regroupement[] + executer_etat (arbre niveau/champ/valeur/nb/totaux) ; UI à un seul niveau (STATUS) |
| AC-860 | Moteur | État : totaux de groupe et total général (Somme, Moyenne, Compte, Min, Max) | Partiel | P1 | Moteur + Interface | somme/effectif dans logic/report.ts ; moteur : totaux par champ numérique |
| AC-861 | Moteur | État : regroupement par intervalle (jour, mois, année, 5, 10, première lettre) | Absent | P2 | Moteur + Interface | absent (etats.rs regroupe sur valeur sans casse) |
| AC-862 | Moteur | État : tri de détail multi-champs | Partiel | P2 | Moteur + Interface | `tri` de détail dans etats.rs ; UI : un tri |
| AC-863 | Moteur | État : champ calculé dans une zone de texte (=[Prix]*[Qté]) | Partiel | P1 | Interface | logic/report.ts evalReportExpression (sous-ensemble d'expressions, JavaScript côté client, pas le traducteur du moteur) |
| AC-864 | Moteur | État : =Somme([Champ]) / =Compte(*) / =Page / =Pages / =Maintenant() dans les en-têtes et pieds | Absent | P1 | Moteur + Interface | absent |
| AC-865 | Moteur | État : numérotation « Page n sur N » | Partiel | P1 | Interface | pied fixe ; pas de zone de texte =[Page] |
| AC-866 | Moteur | État : pagination, saut de page avant/après section, Garder ensemble | Partiel | P1 | Interface | paginate() sans propriétés de section |
| AC-867 | Moteur | État : colonnes multiples (étiquettes, listes en colonnes) | Absent | P2 | Moteur + Interface | absent |
| AC-868 | Moteur | État : sous-états | Absent | P1 | Pont Tauri + Interface | absent |
| AC-869 | Moteur | État : en-têtes de colonnes répétés par page | Partiel | P2 | Interface | à vérifier dans ReportView.tsx |
| AC-870 | Moteur | État : orientation portrait/paysage | Présent à vérifier | P1 | Interface | ribbon.tsx |
| AC-871 | Moteur | État : tailles de papier (A4, A3, Lettre…) et marges | Absent | P1 | Moteur + Interface | constante MARGIN = 48 (ReportView.tsx) |
| AC-872 | Moteur | État : aperçu avant impression avec zoom et pages multiples | Partiel | P1 | Interface | pages A4 empilées sans zoom |
| AC-873 | Moteur | État : aperçu des N premiers enregistrements en Mode Création | Absent | P3 | Interface | absent |
| AC-874 | Moteur | État : mise en forme conditionnelle, barres de données | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-875 | Moteur | État : images, logos, lignes, rectangles | Absent | P2 | Moteur + Interface | absent |
| AC-876 | Moteur | État : graphiques | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-877 | Moteur | État : exporter en PDF / Word / Excel / HTML | Absent | P1 | Interface | seulement tables et requêtes (S.ext.pickObject) |
| AC-878 | Moteur | État : limite de lignes (200 000) | OK | P3 | Moteur | LIMITE_LIGNES_ETAT |
| AC-879 | Moteur | État instantané à partir d'une table (ruban État) | OK | P1 | Moteur + Pont Tauri + Interface | Op etat_instantane ; testé par le scénario du moteur |
| AC-880 | Moteur | Mode Page d'un état avec données réelles | Absent | P1 | Interface | affiche les noms de champs (STATUS) |
| AC-881 | Moteur | Documentation de base de données (état) | Partiel | P2 | Moteur + Interface | ToolsViews.tsx + Op documenter |

## 29. Requêtes, SQL et jeux de résultats

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-882 | Moteur | Requête sélection simple sur une table | OK | P1 | Moteur + Interface | concepteur.rs ; testé (requetes.rs 10 tests) |
| AC-883 | Moteur | Jointure interne / externe gauche / droite entre tables et requêtes | OK | P1 | Moteur + Interface | GenreJointure ; QueryDesign.tsx |
| AC-884 | Moteur | Jointure sur plusieurs champs, jointures non égales (<, >) | Absent | P3 | Moteur + Interface | jointure à un champ |
| AC-885 | Moteur | Critères multiples sur plusieurs champs (ET) et lignes Ou | OK | P1 | Moteur + Interface | logic/qbe.ts |
| AC-886 | Moteur | Regroupements et totaux | OK | P1 | Moteur + Interface | concepteur.rs Operation |
| AC-887 | Moteur | Requête paramétrée | OK | P1 | Moteur + Interface | sql.rs Parametres |
| AC-888 | Moteur | Requête analyse croisée | OK | P2 | Moteur + Interface | RoleAnalyse |
| AC-889 | Moteur | Requête création de table, ajout, mise à jour, suppression | OK | P1 | Moteur + Interface | GenreRequete ; testé |
| AC-890 | Moteur | Requête Union | Absent | P2 | Interface | moteur : SQLite UNION en mode SQL ; pas de créateur |
| AC-891 | Moteur | Requête de définition de données (CREATE/ALTER/DROP) | Partiel | P3 | Moteur | mode SQL exécute ; ATTACH/PRAGMA refusés |
| AC-892 | Moteur | Requêtes enregistrées utilisables comme sources (requête sur requête) | OK | P1 | Moteur + Interface | vues publiées (requetes.rs) |
| AC-893 | Moteur | Requête éditable (modifier les lignes du résultat) | Absent | P1 | Pont Tauri + Interface | moteur prêt : requete_editable.rs (modifiable/raison/correspondance/clés) ; non exposé |
| AC-894 | Moteur | Renvoyer N premiers / pourcentage / valeurs distinctes | Partiel | P1 | Moteur + Interface | DefinitionRequete.top/distinct ; pas de pourcentage |
| AC-895 | Moteur | Plan d'exécution (EXPLAIN) | OK | P3 | Moteur | sql.rs (extension ForgeOffice) |
| AC-896 | Moteur | Délai d'exécution et annulation d'une requête longue | Partiel | P2 | Moteur | DELAI_SQL_DEFAUT 30 s ; pas de bouton Arrêter dans l'interface |
| AC-897 | Moteur | Fonctions personnalisées dans les requêtes | Absent | P3 | Moteur | absent |
| AC-898 | Moteur | Tri français insensible aux accents/casse | OK | P1 | Moteur | plier() (base.rs) |
| AC-899 | Moteur | Résultat de requête en lecture seule avec message | Présent à vérifier | P3 | Interface | strings ds.queryReadOnly |
| AC-900 | Moteur | Résultats tronqués avec avertissement (LIMITE_LIGNES) | OK | P3 | Moteur + Interface | sql.rs |

## 30. Moteur, fichiers et formats

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-901 | Moteur | Format de fichier .fodb (SQLite : WAL, clés étrangères, effacement sécurisé) | OK | P1 | Moteur | base.rs ; testé (base_fichier.rs 7 tests) |
| AC-902 | Moteur | Ouvrir .sqlite / .db | OK | P2 | Moteur + Interface | BackstagePages.tsx |
| AC-903 | Moteur | Ouvrir .accdb / .mdb (lecture directe ou import) | Absent | P1 | Pont Tauri + Interface | moteur prêt : access_lecteur.rs + import_access.rs, vérifié sur deux fichiers réels créés par Access ; absent de base_cmds.rs et de l'interface |
| AC-904 | Moteur | Importer les index / relations / requêtes / formulaires / états / macros d'un .accdb | Absent | P2 | Moteur | non pris en charge (forge-base STATUS) |
| AC-905 | Moteur | Lire un .accdb chiffré ou protégé par mot de passe, Access 97 | Absent | P3 | Moteur | refusé avec message |
| AC-906 | Moteur | Enregistrer sous .accdb (écriture au format Access) | Absent | P2 | Moteur | absent ; fermer le cycle d'échange avec Access |
| AC-907 | Moteur | Base en mémoire / lecture seule | OK | P3 | Moteur + Interface | Backstage « Mode » |
| AC-908 | Moteur | Compactage et réparation | OK | P1 | Moteur + Pont Tauri + Interface | base.rs ; RapportCompactage |
| AC-909 | Moteur | Sauvegarde (VACUUM INTO) et copie | OK | P1 | Moteur + Pont Tauri + Interface | base_copy |
| AC-910 | Moteur | Vérification d'intégrité référentielle (orphelins) | OK | P1 | Moteur + Pont Tauri + Interface | relations.rs |
| AC-911 | Moteur | Transactions explicites | OK | P2 | Moteur | base.rs atomique() ; pas d'API de transaction côté interface |
| AC-912 | Moteur | Accès simultané multi-utilisateurs, verrouillage d'enregistrement (optimiste / pessimiste), conflit d'écriture | Absent | P2 | Moteur + Interface | WAL gère la lecture concurrente ; aucune détection de conflit à l'enregistrement |
| AC-913 | Moteur | Index à champ unique (Indexé : doublons/sans doublons) | OK | P1 | Moteur + Interface | Indexation |
| AC-914 | Moteur | Index multi-champs nommés | Absent | P1 | Pont Tauri + Interface | moteur prêt : index.rs (1 à 10 champs, ordre, unique ; 6 tests) ; pas d'opération Tauri ni de fenêtre « Index » |
| AC-915 | Moteur | Clé primaire composite | Partiel | P1 | Moteur + Interface | structure.rs à confirmer côté UI |
| AC-916 | Moteur | Relations : intégrité, cascade MAJ/suppression, mettre à Null | OK | P1 | Moteur + Interface | relations.rs ; testé (9 tests) |
| AC-917 | Moteur | Sous-formulaires maître/détail | Absent | P1 | Pont Tauri + Interface | moteur prêt : sous_formulaire.rs ; non branché |
| AC-918 | Moteur | Champs multivalués (listes à choix multiples) | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-919 | Moteur | Pièces jointes (stockage binaire) | Partiel | P1 | Moteur + Pont Tauri + Interface | type blob JSON {type, taille, base64} ; pas de dialogue |
| AC-920 | Moteur | Chiffrement de la base avec mot de passe | Absent | P1 | Moteur | absent |
| AC-921 | Moteur | Importer CSV | OK | P1 | Moteur + Pont Tauri + Interface | importer_csv ; testé |
| AC-922 | Moteur | Importer des lignes de classeur | OK | P1 | Moteur + Pont Tauri + Interface | importer_lignes via @forgeoffice/xlsx |
| AC-923 | Moteur | Exporter CSV / JSON / Excel / HTML | OK | P1 | Moteur + Interface | exporter_csv ; exchange.ts |
| AC-924 | Moteur | Exporter PDF, XML, RTF, dBASE, ODBC | Absent | P2 | Moteur + Interface | absent |
| AC-925 | Moteur | Tables liées (externes : .accdb, ODBC, Excel, CSV) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-926 | Moteur | Taille maximale et limites (SQL 10 Mo, 1000 colonnes) | OK | P3 | Moteur | STATUS forge-base |
| AC-927 | Moteur | Sécurité : identifiants cités, valeurs liées, ATTACH/extensions refusés | OK | P1 | Moteur | STATUS forge-base |
| AC-928 | Moteur | Mobile : chemin de fichier obligatoire (content:// refusé) | Partiel | P2 | Pont Tauri | base_create/base_copy (STATUS access) |

## 31. Fonctions invisibles ou peu visibles d'Access

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-929 | Invisible | Annuler/Rétablir (Ctrl+Z) sur l'objet en cours et sur la modification d'enregistrement | Absent | P1 | Interface | STATUS : non géré |
| AC-930 | Invisible | Correction automatique des noms (propagation d'un renommage dans requêtes, formulaires, états) | Partiel | P1 | Moteur | renommage de table/champ suivi dans vues, requêtes et sous-formulaires (forge-base STATUS) ; formulaires/états : source seulement |
| AC-931 | Invisible | Suivi des dépendances d'objet (qui utilise cette table) | Absent | P2 | Moteur + Pont Tauri + Interface | absent |
| AC-932 | Invisible | Saisie semi-automatique dans les listes | Absent | P3 | Interface | absent |
| AC-933 | Invisible | Dictionnaire utilisateur / correcteur (Orthographe sur champs mémo) | Partiel | P3 | Interface | spellcheck système |
| AC-934 | Invisible | Recherche et remplacement dans tous les champs / formatés | Partiel | P2 | Interface | remplacer sur la colonne |
| AC-935 | Invisible | Tri/filtre mémorisés avec l'objet (OrderBy, Filter, FilterOnLoad) | Absent | P2 | Moteur + Interface | propriétés de table `tri`/`filtre` stockées (TableDesign.tsx S.cmd.tableProps) mais appliquées à l'ouverture à vérifier |
| AC-936 | Invisible | Mise en forme d'une feuille de données mémorisée (largeur des colonnes, colonnes masquées/figées, hauteur de ligne, police) | Partiel | P1 | Moteur + Interface | absent ; 2026-11-06 : largeur, champs masqués, ordre des colonnes, champs figés et hauteur de ligne mémorisés par objet dans les réglages locaux (useColumnLayout) ; police et couleurs absentes ; pas dans les métadonnées de la base |
| AC-937 | Invisible | Valeurs par défaut et règles de validation appliquées à la saisie | OK | P1 | Moteur + Interface | testé (logic.test.ts saisie/validation) |
| AC-938 | Invisible | Propagation de la valeur par défaut « Date() » à la création de ligne | OK | P2 | Moteur | valeur_defaut |
| AC-939 | Invisible | Rafraîchissement automatique / intervalle d'actualisation | Absent | P3 | Moteur + Interface | absent |
| AC-940 | Invisible | Barre d'état : modes, Verr. Num., zoom | Partiel | P3 | Interface | S.status |
| AC-941 | Invisible | Formulaire de démarrage et options d'application (titre, icône, masquer le volet) | Absent | P2 | Moteur + Interface | absent |
| AC-942 | Invisible | Menus et rubans personnalisés (XML de ruban) | Absent | P3 | Moteur + Interface | absent |
| AC-943 | Invisible | Gestionnaire de thèmes, thèmes d'application | Partiel | P3 | Interface | thème sombre de la suite ; pas de thèmes de formulaire |
| AC-944 | Invisible | Sauvegarde automatique avant opération destructrice | Absent | P2 | Moteur + Interface | absent (confirmation seulement) |
| AC-945 | Invisible | Journal d'audit des modifications de données | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-946 | Invisible | Informations de base de données (taille, tables, emplacement) | OK | P3 | Moteur + Interface | Backstage Informations |
| AC-947 | Invisible | Liste des fichiers récents | Présent à vérifier | P2 | Interface | Backstage Récent |
| AC-948 | Invisible | Ouverture d'une base reçue sans chemin (mobile) | Partiel | P3 | Interface | message d'erreur (STATUS) |
| AC-949 | Invisible | Mode démonstration sans moteur dans le navigateur | Présent à vérifier | P3 | Interface | NoNative.tsx + demo-db.ts (base « Comptoir » en lecture seule) |

## 32. Fichier (Backstage)

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-950 | Backstage | Nouveau > Base de données vide | Présent à vérifier | P1 | Interface | BackstagePages.tsx |
| AC-951 | Backstage | Nouveau > Modèles (Contacts, Inventaire, Tâches, Factures) | Présent à vérifier | P2 | Interface | templates.ts ; testé (4 modèles) |
| AC-952 | Backstage | Nouveau > Modèles en ligne (recherche) | Absent | P3 | Interface | sans objet hors ligne ; catalogue local extensible en Au-delà |
| AC-953 | Backstage | Nouveau > Application web personnalisée | Absent | P3 | Interface | sans objet (retirée) |
| AC-954 | Backstage | Ouvrir > Récent / Parcourir / emplacements | Présent à vérifier | P1 | Interface | BackstagePages.tsx |
| AC-955 | Backstage | Ouvrir > épingler un fichier récent | Absent | P3 | Interface | absent |
| AC-956 | Backstage | Informations > Compacter et réparer | Présent à vérifier | P1 | Interface | Backstage |
| AC-957 | Backstage | Informations > Chiffrer avec un mot de passe | Absent | P1 | Moteur + Pont Tauri + Interface | absent |
| AC-958 | Backstage | Informations > Propriétés de la base | Absent | P3 | Moteur + Pont Tauri + Interface | absent |
| AC-959 | Backstage | Enregistrer sous > Enregistrer la base sous (copie) | Présent à vérifier | P1 | Interface | base_copy |
| AC-960 | Backstage | Enregistrer sous > Format Access 2002-2003 / 2000 / modèle / .accdb | Absent | P2 | Moteur | absent |
| AC-961 | Backstage | Enregistrer sous > Enregistrer l'objet sous (copie d'un objet) | Partiel | P2 | Interface | Copier dans le volet |
| AC-962 | Backstage | Enregistrer sous > Enregistrer en PDF/XPS | Absent | P1 | Interface | absent |
| AC-963 | Backstage | Enregistrer sous > Sauvegarder la base de données | Présent à vérifier | P1 | Interface | Backstage |
| AC-964 | Backstage | Imprimer > Impression rapide / Imprimer / Aperçu | Partiel | P2 | Interface | Backstage Imprimer |
| AC-965 | Backstage | Fermer la base de données | Présent à vérifier | P1 | Interface | Backstage |
| AC-966 | Backstage | Compte (utilisateur, thème Office, arrière-plan) | Absent | P3 | Interface | géré par la suite, non par le module |
| AC-967 | Backstage | Commentaires | Absent | P3 | Interface | absent |
| AC-968 | Backstage | Options | Absent | P1 | Interface | absent (voir section 21) |
| AC-969 | Backstage | Mise à jour automatique | Partiel | P2 | Interface | coquille de la suite |

## AU-DELÀ D'OFFICE

> Vingt idées qui dépassent Access, avec le point d'appui existant dans le dépôt. Statut = état actuel (Absent sauf indication).

| ID | Type | Fonction (Access) | Statut | Prio | Couche | Preuve / remarque |
|---|---|---|---|---|---|---|
| AC-A01 | Au-delà | Journal de modifications et retour en arrière par enregistrement (qui, quand, avant/après) avec Annuler universel | Absent | P1 | Moteur + Pont Tauri + Interface | déclencheurs SQLite écrivant dans une table `__fo_journal` ; l'interface n'a aucun Annuler aujourd'hui |
| AC-A02 | Au-delà | Versions de la base : instantanés automatiques (VACUUM INTO déjà disponible), comparaison de deux versions, restauration d'une seule table | Absent | P2 | Moteur + Pont Tauri + Interface | base.rs sauvegarde ; ajouter un gestionnaire d'instantanés |
| AC-A03 | Au-delà | Chiffrement de la base (SQLCipher) avec mot de passe, déverrouillage biométrique sur mobile | Absent | P1 | Moteur + Pont Tauri + Interface | remplace « Chiffrer avec un mot de passe » d'Access |
| AC-A04 | Au-delà | Scripts sandboxés (JavaScript/WASM) pour événements de formulaire, boutons, fonctions utilisables dans les requêtes (create_scalar_function) : le « VBA moderne » | Absent | P1 | Moteur + Pont Tauri + Interface | base.rs enregistre déjà fo_racine ; brancher un moteur de script borné en temps et en mémoire |
| AC-A05 | Au-delà | Vues alternatives de toute table : Kanban, Calendrier, Galerie, Carte, Chronologie | Absent | P2 | Interface | lecture par lire_table ; composants UI à créer |
| AC-A06 | Au-delà | Requêtes en langage naturel (IA locale) qui produisent une grille QBE ou du SQL expliqué et modifiable | Absent | P2 | Interface | sortie = DefinitionRequete (concepteur.rs) ; garde-fous : lecture seule par défaut |
| AC-A07 | Au-delà | Collaboration : fichier partagé sur réseau avec détection de conflits, puis synchronisation entre appareils (CRDT/journal) | Absent | P2 | Moteur + Pont Tauri + Interface | s'appuie sur le journal ci-dessus |
| AC-A08 | Au-delà | Tableaux de bord : graphiques modernes, tableau croisé dynamique natif, indicateurs, filtres liés entre graphiques | Absent | P1 | Moteur + Pont Tauri + Interface | remplace le contrôle Graphique et les vues croisées retirées d'Access |
| AC-A09 | Au-delà | Connecteurs d'import vivants : Excel/CSV/JSON surveillés, API REST, SQLite/PostgreSQL/MySQL, Google Sheets, fichiers .accdb liés en lecture | Absent | P2 | Moteur + Pont Tauri + Interface | import_access.rs, importer_csv déjà là ; ajouter les tables liées |
| AC-A10 | Au-delà | API locale REST/GraphQL de la base (jeton, lecture/écriture, webhooks) pour automatiser depuis d'autres outils | Absent | P3 | Pont Tauri | serveur borné à 127.0.0.1, désactivé par défaut |
| AC-A11 | Au-delà | Automatisations « si… alors… » sur événement de table ou planifiées (courriel, export, macro) | Absent | P2 | Moteur + Pont Tauri + Interface | remplace les macros de données et AutoExec |
| AC-A12 | Au-delà | Formulaires publics : collecte de données par lien ou code QR, avec validation du moteur | Absent | P3 | Moteur + Pont Tauri + Interface | réutilise validation FieldRule ; nécessite un relais ou un serveur local |
| AC-A13 | Au-delà | Qualité des données : profilage des colonnes, doublons approchés, règles de validation en lot, rapport d'anomalies | Absent | P2 | Moteur + Interface | compléter logic/analyze.ts |
| AC-A14 | Au-delà | Diagramme entité-relation exportable (SVG, Mermaid) et documentation générée (Markdown/HTML) | Partiel | P3 | Interface | Relations.tsx et le documenteur existent ; ajouter les exports |
| AC-A15 | Au-delà | Comparaison de schémas entre deux bases et génération du script de migration | Absent | P2 | Moteur + Pont Tauri | schema.rs fournit SchemaTable ; diff + ALTER via structure.rs |
| AC-A16 | Au-delà | Requêtes enregistrées partageables avec formulaire de paramètres généré automatiquement et bibliothèque de snippets SQL | Absent | P3 | Interface | sql.rs Parametres déjà présent |
| AC-A17 | Au-delà | Recherche plein texte et floue sur toute la base (FTS5/trigrammes), pièces jointes comprises avec extraction de texte | Absent | P2 | Moteur + Pont Tauri + Interface | compile-time SQLite FTS5 ; alimenter via pdf.js et OCR de la suite |
| AC-A18 | Au-delà | Mode tableur sur une table : formules de colonne, remplissage, collage de plages, liaison vivante avec le module Tableur | Absent | P2 | Moteur + Interface | expr.rs sert de base de formules |
| AC-A19 | Au-delà | Publipostage direct : une table/requête vers des modèles Texte, Publication ou PDF (un document par ligne) | Absent | P2 | Interface | services.openDocument existe dans packages/core ; compléter côté Texte |
| AC-A20 | Au-delà | Assistant de modélisation : décrire un besoin, obtenir tables, relations, formulaires et états générés (modèles + IA locale) | Absent | P3 | Interface | logic/templates.ts fournit le format des 4 modèles |

## Annexe A. Menus contextuels natifs d'Access (CommandBars de type popup, relevé COM)

Nom interne anglais, nombre d'entrées, entrées françaises dans l'ordre. Référence pour construire les menus contextuels de ForgeOffice.

| Barre | Entrées | Contenu |
|---|---|---|
| Database TitleBar | 11 | Ouvrir...; Importer...; Lier les tables...; Enregistrer sous...; Exporter...; Envoyer vers; Coller; Démarrage...; Relations...; Visual Basic Editor; Propriétés de la base de données |
| Table DesignTitleBar | 9 | Mode Feuille de données; Relations...; Couper; Copier; Coller; Index; Tester les règles de validation; Propriétés; Fermer |
| Table Design Upper Pane | 9 | Clé primaire; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Insérer des lignes; Supprimer les lignes; Propriétés |
| Table Design Lower Pane | 8 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Propriétés |
| Table Design Properties | 7 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Index TitleBar | 2 | Aide; Sommaire et index |
| Index Upper Pane | 2 | Insérer des lignes; Supprimer les lignes |
| Index Lower Pane | 3 | Couper; Copier; Coller |
| Index Properties | 7 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Actions | 4 | Afficher la table...; Afficher toutes les relations; Enregistrer la mise en page; Fermer |
| Relationship TableFieldList | 5 | Afficher les Relations directes; Ouvrir; Création de table; Ajuster au contenu; Masquer la table |
| Relationship QueryFieldList | 4 | Afficher les Relations directes; Ouvrir; Création requête; Masquer la table |
| Relationship Join | 2 | Modifier une relation...; Supprimer |
| Table Design Datasheet | 10 | Création de table; Couper; Copier; Coller; Police...; Feuille de données...; Afficher les champs; Reconvertir; Conversion hangûl/hanja...; Fermer |
| Table Design Datasheet Column | 17 | Tri croissant; Tri décroissant; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Largeur de champ; Masquer les champs; Afficher les champs; Figer les champs; Libérer tous les champs; Rechercher...; Insérer un champ; Modifier les recherches; Modifier l’expression; Renommer le champ; Supprimer le champ |
| Table Design Datasheet Row | 6 | Nouvel enregistrement; Supprimer l'enregistrement; Couper; Copier; Coller; Hauteur de ligne... |
| Table Design Datasheet Cell | 21 | Couper; Copier; Coller; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Reconvertir; Conversion hangûl/hanja...; Insérer un objet...; Modifier les éléments de liste...; Objet; Lien hypertexte; Afficher l'historique des colonnes...; Gérer les pièces jointes... |
| Query | 9 | Mode SQL; Mode Feuille de données; Afficher la table...; Paramètres...; Type de requête; Spécifique SQL; Relations...; Propriétés...; Fermer |
| Query DesignFieldList | 5 | Ouvrir; Mode création; Ajuster au contenu; Supprimer une table; Propriétés... |
| Query Design Join | 2 | Propriétés de la jointure; Supprimer |
| Query DesignGrid | 10 | Totaux; Noms des tables; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Créer...; Zoom...; Propriétés... |
| Query SQLTitleBar | 3 | Création de requête; Mode Feuille de données; Propriétés... |
| Query SQLText | 5 | Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Query Design Properties | 7 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Query Design Datasheet | 11 | Création de requête; Mode SQL; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Police...; Feuille de données...; Afficher les champs; Fermer |
| Query Design Datasheet Column | 11 | Tri croissant; Tri décroissant; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Largeur de champ; Masquer les champs; Afficher les champs; Figer les champs; Libérer tous les champs |
| Query Design Datasheet Row | 8 | Nouvel enregistrement; Supprimer l'enregistrement; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Hauteur de ligne... |
| Query Design Datasheet Cell | 21 | Couper; Copier; Coller; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Reconvertir; Conversion hangûl/hanja...; Insérer un objet...; Modifier les éléments de liste...; Objet; Lien hypertexte; Afficher l'historique des colonnes...; Gérer les pièces jointes... |
| Filter General Context Menu | 5 | Appliquer le filtre/tri; Effacer la grille; Charger à partir d'une requête...; Enregistrer en tant que requête; Fermer |
| Filter Field | 6 | Filtrer par formulaire; Créer...; Zoom...; Couper; Copier; Coller |
| Filter FilterByForm | 7 | Appliquer le filtre/tri; Appliquer un filtre serveur; Supprimer la tabulation; Effacer la grille; Charger à partir d'une requête...; Enregistrer en tant que requête; Fermer |
| Form DesignTitleBar | 12 | Mode Formulaire; Mode Page; Mode Création; Mode Feuille de données; Créer code événement...; Ordre de tabulation...; En-tête et pied de page; En-tête/pied de formulaire; Propriétés du formulaire; Propriétés de l’état; Propriétés; Fermer |
| Form Design Form | 9 | Mode Formulaire; Mode Page; Mode Création; Mode Feuille de données; Créer code événement...; Ordre de tabulation...; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form Design Section | 12 | Créer code événement...; Ordre de tabulation...; Coller; Couleur d'arrière-plan/remplissage; Autre couleur d'arrière-plan/remplissage; Règle; Grille; En-tête et pied de page; En-tête/pied de formulaire; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form Design Control | 33 | Insérer un bouton de navigation; Créer code événement...; Créer...; Objet; Remplacer par; Ordre de tabulation...; Couper; Copier; Coller; Coller le format; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Aligner; Taille; Position; Quadrillage; Supprimer; Supprimer la ligne; Supprimer une colonne; Ancrage; Couleur d'arrière-plan/remplissage; Couleur de police/premier plan; Effet spécial; Mise en forme conditionnelle...; Lien hypertexte; Sous-formulaire dans une nouvelle fenêtre; Modifier les éléments de liste...; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form Design Control OLE | 10 | Créer code événement...; Créer...; Objet; Couper; Copier; Coller; Dupliquer; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Report DesignTitleBar | 14 | Mode État; Mode Page; Mode Création; Aperçu avant impression; Aperçu des 10 premiers enregistrements; Créer code événement...; Ordre de tabulation...; Trier et grouper; En-tête et pied de page; En-tête/pied de formulaire; Propriétés du formulaire; Propriétés de l’état; Propriétés; Fermer |
| Report DesignReport | 10 | Mode État; Mode Page; Mode Création; Aperçu avant impression; Aperçu des 10 premiers enregistrements; Créer code événement...; Trier et grouper; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Report Design Section | 14 | Créer code événement...; Trier et grouper; Ordre de tabulation...; Coller; Couleur d'arrière-plan/remplissage; Autre couleur d'arrière-plan/remplissage; Règle; Grille; Boîte à outils; En-tête et pied de page; En-tête/pied de formulaire; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Report Design Control | 36 | Créer code événement...; Créer...; Objet; Remplacer par; Ordre de tabulation...; Couper; Copier; Coller; Coller le format; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Regrouper sur; Total; Tri croissant; Tri décroissant; Aligner; Taille; Position; Quadrillage; Supprimer; Supprimer la ligne; Supprimer une colonne; Couleur d'arrière-plan/remplissage; Couleur de police/premier plan; Effet spécial; Mise en forme conditionnelle...; Lien hypertexte; Sous-état dans une nouvelle fenêtre; Modifier les éléments de liste...; Définir la légende; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form/Report Properties | 7 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Form View Popup | 15 | Mode Formulaire; Mode État; Mode Page; Mode Création; Mode Feuille de données; Aperçu avant impression; Filtre serveur par formulaire; Appliquer un filtre serveur; Couper; Copier; Coller; Propriétés du formulaire; Propriétés de l’état; Propriétés; Fermer |
| Form View Subform | 16 | Sous-formulaire; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Propriétés du formulaire; Propriétés de l’état; Propriétés; Afficher l'historique des colonnes...; Gérer les pièces jointes... |
| Form View Control | 48 | Créer code événement...; Insérer un bouton de navigation; Insérer une page; Supprimer la page; Ordre des pages...; Couper; Copier; Coller; Coller le format; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Regrouper sur; Total; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Créer un lien hypertexte; Supprimer; Supprimer la ligne; Supprimer une colonne; Remplacer par; Position; Quadrillage; Ancrage; Avant; Précédent; Gérer les pièces jointes...; Reconvertir; Conversion hangûl/hanja...; Insérer un objet...; Objet; Lien hypertexte; Afficher l'historique des colonnes...; Modifier les éléments de liste...; Définir la légende; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form View Subform Control | 47 | Sous-formulaire; Créer code événement...; Insérer un bouton de navigation; Insérer une page; Supprimer la page; Ordre des pages...; Couper; Copier; Coller; Coller le format; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Regrouper sur; Total; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Supprimer; Supprimer la ligne; Supprimer une colonne; Remplacer par; Position; Ancrage; Avant; Précédent; Gérer les pièces jointes...; Reconvertir; Conversion hangûl/hanja...; Insérer un objet...; Objet; Lien hypertexte; Afficher l'historique des colonnes...; Modifier les éléments de liste...; Définir la légende; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form View Record | 6 | Couper; Copier; Coller; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Form Datasheet | 13 | Mode Formulaire; Mode Page; Mode Création; Couper; Copier; Coller; Police...; Feuille de données...; Afficher les champs; Propriétés du formulaire; Propriétés de l’état; Propriétés; Fermer |
| Form Datasheet Column | 14 | Tri croissant; Tri décroissant; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Largeur de champ; Supprimer; Masquer les champs; Afficher les champs; Figer les champs; Libérer tous les champs; Ajouter des champs existants; Mise en forme conditionnelle... |
| Form Datasheet Subcolumn | 15 | Sous-formulaire; Tri croissant; Tri décroissant; Copier; Coller; Reconvertir; Conversion hangûl/hanja...; Largeur de champ; Supprimer; Masquer les champs; Afficher les champs; Figer les champs; Libérer tous les champs; Ajouter des champs existants; Mise en forme conditionnelle... |
| Form Datasheet Row | 6 | Nouvel enregistrement; Supprimer l'enregistrement; Couper; Copier; Coller; Hauteur de ligne... |
| Form Datasheet Cell | 24 | Couper; Copier; Coller; Tri croissant; Tri décroissant; Tri décroissant; ᤧź; Tri décroissant; Tri décroissant; Tri décroissant; Tri décroissant; Sélectionné; Non sélectionné; Reconvertir; Conversion hangûl/hanja...; Insérer un objet...; Modifier les éléments de liste...; Objet; Lien hypertexte; Propriétés du formulaire; Propriétés de l’état; Propriétés; Afficher l'historique des colonnes...; Gérer les pièces jointes... |
| Print Preview Popup | 13 | Mode État; Mode Page; Mode Création; Aperçu avant impression; Zoom :; Une page; Afficher plusieurs pages; Mise en page...; Imprimer...; Enregistrer sous...; Exporter...; Envoyer vers; Fermer |
| Macro TitleBar | 1 | Afficher toutes les actions |
| Macro UpperPane | 8 | Zoom...; Insérer des lignes; Supprimer les lignes; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Macro Condition | 9 | Créer...; Zoom...; Insérer des lignes; Supprimer les lignes; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| Macro Argument | 7 | Créer...; Zoom...; Couper; Copier; Coller; Reconvertir; Conversion hangûl/hanja... |
| ModuleUncompiled | 14 | Couper; Copier; Coller; Créer...; Liste des propriétés/méthodes; Liste des constantes; Informations rapides; Informations paramètres; Compléter le mot; Basculer; Explorateur d'objets; Ajouter un espion...; Définition de la procédure; Dernière position |
| ModuleCompiled | 10 | Couper; Copier; Coller; Basculer; Explorateur d'objets; Ajouter un espion...; Exécuter jusqu'au curseur; Set Next Statement; Afficher l'instruction suivante; Définition de la procédure |
| Module Immediate | 7 | Couper; Copier; Coller; Explorateur d'objets; Définition de la procédure; Atteindre/continuer; Fin |
| Module Watch | 9 | Couper; Copier; Coller; Ajouter un espion...; Modifier un espion...; Supprimer un espion; Réduire le niveau supérieur; Atteindre/continuer; Fin |
| Database Table/Query | 20 | Déclencheurs...; Imprimer...; Aperçu avant impression; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés; Dépendances d'objet...; Gestionnaire de tables liées |
| Database Form | 18 | Imprimer...; Aperçu avant impression; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés; Dépendances d'objet... |
| Database Report | 19 | Mode État; Aperçu avant impression; Imprimer...; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés; Dépendances d'objet... |
| Database Macro | 14 | Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire; Couper; Copier; Enregistrer sous...; Exporter...; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés |
| Database Module | 16 | Imprimer...; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés |
| Database Page Popup | 2 | Aperçu de la page web; Propriétés |
| Database Background | 8 | Affichage; Réorganiser les icônes; Aligner les icônes; Importer...; Lier les tables...; Coller; Relations...; Visual Basic Editor |
| OLE Shared | 1 | Fermer |
| Global | 1 | Fermer |
| Object Browser | 7 | Copier; Afficher la définition; Mot entier uniquement; Membres du groupe; Afficher les membres masqués; Références...; ? |
| Module LocalsPane | 6 | Couper; Copier; Coller; Réduire le niveau supérieur; Atteindre/continuer; Fin |
| Tab Control | 19 | Créer code événement...; Couper; Copier; Coller; Insérer une page; Supprimer la page; Ordre des pages...; Ordre de tabulation...; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Aligner; Taille; Quadrillage; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Tab Control on Report Design | 18 | Couper; Copier; Coller; Insérer une page; Supprimer la page; Ordre des pages...; Ordre de tabulation...; Insérer; Fusionner/scinder; Disposition; Sélectionner la ligne entière; Sélectionner la colonne entière; Aligner; Taille; Quadrillage; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| View Table Design Popup | 10 | Clé primaire; Insérer des lignes; Supprimer les lignes; Couper; Copier; Coller; Index / Clés; Relations; Contraintes; Propriétés |
| View Design Background Popup | 5 | Noms de colonne; Nom uniquement; Sélectionner toutes les colonnes; Supprimer; Propriétés |
| View Design Diagram Pane Popup | 5 | Grouper par; Masquer le volet; Ajouter une table...; Gestion des index...; Propriétés |
| View Design Field Popup | 4 | Ajouter aux données en sortie; Par ordre croissant; Par ordre décroissant; Supprimer le filtre |
| View Design Grid Pane Popup | 5 | Couper; Copier; Coller; Masquer le volet; Propriétés |
| View Design SQL Pane Popup | 7 | Vérifier la syntaxe SQL; Couper; Copier; Coller; Sélectionner tout; Masquer le volet; Propriétés |
| Diagram Design Popup | 18 | Propriétés des colonnes; Noms de colonne; Clés; Nom uniquement; Affichage personnalisé; Clé primaire; Index / Clés; Relations; Contraintes; Insérer des lignes; Supprimer les lignes; Supprimer la table de la base de données; Masquer la table; Ajouter des tables connexes; Dimensionner automatiquement les tables sélectionnées; Organisation de la sélection; Agrandir la sélection; Propriétés |
| Diagram Popup | 12 | Nouvelle table; Nouvelle étiquette; Ajouter une table...; Coller; Sélectionner tout; Afficher les étiquettes de relation; Afficher les sauts de page; Recalculer les sauts de page; Ajuster le diagramme à la fenêtre; Organisation des tables; Zoom; Propriétés |
| View Design Multiple Select Popup | 1 | Supprimer |
| View Design Join Line Popup | 4 | Supprimer; Sélectionner toutes les lignes de  <tableA>; Sélectionner toutes les lignes de  <tableB>; Propriétés |
| View Table View Mode Submenu | 7 | Propriétés des colonnes; Noms de colonne; Noms de colonne; Clés; Nom uniquement; Nom uniquement; Affichage personnalisé |
| View Show Panes Submenu | 3 | Schéma; Grille; SQL |
| Join Line Popup | 2 | Supprimer la relation de la base de données; Propriétés |
| Stored Procedure Design Datasheet | 8 | Conception de procédures stockées; Couper; Copier; Coller; Police...; Feuille de données...; Afficher les champs; Fermer |
| View Design Datasheet | 8 | Afficher la fenêtre de conception; Couper; Copier; Coller; Police...; Feuille de données...; Afficher les champs; Fermer |
| Diagram Design Label Popup | 6 | Couper; Copier; Coller; Supprimer; Sélectionner tout; Définir la police des étiquettes... |
| Stored Procedure Design Popup | 4 | Couper; Copier; Coller; Modifier le langage SQL |
| Trigger Design Popup | 4 | Couper; Copier; Coller; Modifier le langage SQL |
| Database Shortcut Popup | 1 | Fermer |
| Database Custom Group Popup | 1 | Fermer |
| Database View | 12 | Imprimer...; Aperçu avant impression; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés |
| Database Stored Procedure | 12 | Imprimer...; Aperçu avant impression; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés |
| Database Diagram | 12 | Imprimer...; Aperçu avant impression; Couper; Copier; Enregistrer sous...; Exporter...; Envoyer vers; Ajouter à un groupe; Créer un raccourci...; Supprimer; Renommer; Propriétés |
| Table PivotTable Popup | 6 | Création de table; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Table PivotChart Popup | 6 | Création de table; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Query PivotTable Popup | 7 | Création de requête; Mode SQL; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Query PivotChart Popup | 7 | Création de requête; Mode SQL; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Form PivotTable Popup | 7 | Mode Création; Mode Formulaire; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Form PivotChart Popup | 7 | Mode Création; Mode Formulaire; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Stored Procedure PivotTable Popup | 6 | Conception de procédures stockées; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Stored Procedure PivotChart Popup | 6 | Conception de procédures stockées; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| View PivotTable Popup | 6 | Afficher la fenêtre de conception; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| View PivotChart Popup | 6 | Afficher la fenêtre de conception; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Function Design | 4 | Couper; Copier; Coller; Modifier le langage SQL |
| PivotTable Popup | 17 | Copier; Trier; Annuler l'ordre personnalisé; Filtre automatique; Afficher les éléments supérieurs/inférieurs; Filtrer par sélection; Calcul automatique; Sous-total; Supprimer; Grouper les éléments; Annuler le regroupement des éléments; Développer; Réduire; Masquer les détails; Afficher les détails; Liste des champs; Propriétés |
| PivotChart Popup | 11 | Modifier le type de graphique; Trier; Filtre automatique; Afficher les éléments supérieurs/inférieurs; Calcul automatique; Développer; Réduire; Extraire dans; Extraire; Liste des champs; Propriétés |
| Function Datasheet Popup | 8 | Création d'une fonction; Couper; Copier; Coller; Police...; Feuille de données...; Afficher les champs; Fermer |
| Function Pivot Table Popup | 6 | Création d'une fonction; Mode Feuille de données; Mode Graphique croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Function Pivot Chart Popup | 6 | Création d'une fonction; Mode Feuille de données; Mode Tableau croisé dynamique; Exporter vers Excel; Liste des champs; Propriétés |
| Column Filter | 4 | Tri croissant; Tri décroissant; Tri décroissant; ᤧź |
| Navigation Pane Pop-up | 7 | Catégorie ; Ordre de tri; Afficher par; Afficher tous les groupes; Coller; Options de navigation...; Barre de recherche |
| Navigation Pane List Pop-up | 26 | Ouvrir; Mode création; Déclencheurs...; Importer; Exporter...; Renommer; Renommer le raccourci; Masquer dans ce groupe; Afficher dans ce groupe; Supprimer; Supprimer; Couper; Copier; Coller; Ajouter à un groupe...; Autres options; Gestionnaire de tables liées; Actualiser le lien; Ouvrir dans Dataverse; Convertir en table locale; Propriétés de la table; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire |
| Navigation Pane View Pop-up | 23 | Ouvrir; Mode Page; Mode création; Exporter...; Renommer; Renommer le raccourci; Masquer dans ce groupe; Afficher dans ce groupe; Supprimer; Dupliquer; Supprimer; Couper; Copier; Coller; Ajouter à un groupe...; Imprimer...; Aperçu avant impression; Afficher les propriétés; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire |
| Navigation Pane object Pop-up | 20 | Ouvrir; Exécuter; Mode création; Exporter...; Renommer; Renommer le raccourci; Masquer dans ce groupe; Afficher dans ce groupe; Supprimer; Supprimer; Couper; Copier; Coller; Ajouter à un groupe...; Propriétés de l'objet; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire |
| Navigation Pane data page Pop-up | 16 | Ouvrir; Renommer le raccourci; Masquer dans ce groupe; Afficher dans ce groupe; Supprimer; Supprimer; Couper; Copier; Coller; Ajouter à un groupe...; Propriétés de l'objet; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire |
| Navigation Pane Group Header Pop-up | 13 | Ordre de tri; Afficher par; Afficher tous les groupes; Renommer; Supprimer; Développer le groupe; Réduire le groupe; Développer tout; Réduire tout; Afficher uniquement ce groupe; Masquer; Afficher; Coller |
| Navigation Pane Category Pop-up | 5 | Tables et affichages associés; Type d'objet; Date de création; Date de modification; Groupes personnalisés ADP |
| Navigation Pane SortBy Pop-up | 7 | Tri croissant; Tri décroissant; Nom; Type; Date de création; Date de modification; Supprimer les tris automatiques |
| Navigation Pane ViewBy Pop-up | 3 | Détails; Icône; Liste |
|   | 11 | Enregistrer; Fermer; Fermer tout; Mode Formulaire; Mode État; Mode Page; Mode Création; Mode SQL; Mode SQL; Mode Feuille de données; Aperçu avant impression |
| Navigation Pane Groups in current Category | 1 | Nouveau groupe... |
| SharePoint List Options Popup | 9 | Ouvrir l'affichage par défaut...; Modifier les colonnes et les paramètres...; Me prévenir...; Modifier le flux de travail...; Modifier les autorisations pour cette liste...; Corbeille du site SharePoint...; Rétablir la liaison des listes...; Actualiser la liste; Supprimer la liste |
|   | 2 | Ajouter un champ au mode; Modifier la source d'enregistrement |
| Export Pop-up | 12 | Dataverse; Excel; Liste SharePoint; Fichier RTF Word; PDF ou XPS; Access; Fichier texte; Fichier XML; Base de données ODBC; Document HTML; Fichier dBASE; Publipostage Word |
| Import/Link Pop-up | 13 | Dataverse; Base de données Access; Excel; Liste SharePoint; Fichier texte; Fichier XML; Base de données ODBC; À partir de SQL Server; À partir d’une base de données Azure; Document HTML; Dossier Outlook; À partir de Dynamics 365 (Online); À partir d’Amazon Redshift |
|   | 2 | Ouvrir la table en mode Feuille de données; Modifier la source d'enregistrement |
| Subform Datasheet | 6 | Police...; Feuille de données...; Afficher les champs; Propriétés du formulaire; Propriétés de l’état; Propriétés |
| Logic Catalog context menu | 8 | Réduire le groupe; Développer le groupe; Réduire tout; Développer tout; Ajouter une action; Ajouter une copie de la macro; Ajouter ExécuterMacro; Aide |
| Logic Designer context menu | 15 | Développer tout; Réduire tout; Développer les actions; Réduire les actions; Couper; Copier; Coller; Monter; Descendre; Supprimer; Créer un bloc de groupes; Créer un bloc de sous-macros; Créer un bloc Si; Ajouter Sinon si; Ajouter Sinon |
| Navigation Pane query or macro Pop-up | 21 | Ouvrir; Exécuter; Mode création; Mode SQL; Exporter...; Renommer; Renommer le raccourci; Masquer dans ce groupe; Afficher dans ce groupe; Supprimer; Supprimer; Couper; Copier; Coller; Ajouter à un groupe...; Propriétés de l'objet; Afficher les différences...; Dernière version; Extraire; Archiver...; Annuler Extraire |
| Insert | 4 | Insérer à gauche; Insérer à droite; Insérer au-dessus; Insérer en dessous |
| Merge/Split | 3 | Fusionner; Fractionner verticalement; Fractionner horizontalement |
| Add New Field | 14 | Texte court; Nombre; Grand nombre; Monétaire; Date et heure; Date  heure étendue; Oui/Non; Liste de choix et relation; Texte enrichi; Texte long; Pièce jointe; Lien hypertexte; Champ calculé; Coller en tant que champs |
| Calculated Field | 5 | Texte; Nombre; Devise; Oui/Non; Date/heure |
| System | 6 | Restauration; Déplacer; Taille; Réduction; Agrandissement; Fermer |

## Annexe B. Ruban d'Access, relevé UI Automation (groupes et boutons par onglet)

`TAB` = onglet ; `G[groupe]: boutons`. Les doublons viennent de boutons partagés (corps + menu). Le contenu des galeries et menus déroulants n'est pas dans l'arbre sans clic.

### Base ouverte (sans objet)

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne; Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
```

### Table en feuille de données

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide | Table & Champs | Table
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police RVB (255, 0, 0); Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan RVB (128, 128, 128); Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne RVB (238, 238, 238); Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
TAB Table & Champs
  G[Table & Champs]: 
  G[Affichages]: Affichage; Affichage
  G[Ajouter et supprimer]: Texte court; Nombre; Monétaire; Date et heure; Oui/Non; Plus de champs; Supprimer 
  G[Propriétés]: Nom et légende; Valeur par défaut; Taille du champ <Edit>; Modifier les recherches; Modifier l’expression; Paramètres de mémo
  G[Mise en forme]: Type de données  <ComboBox>; Type de données  <Edit>; Ouvrir; Format  <ComboBox>; Format  <Edit>; Ouvrir; Appliquer le format monétaire; Appliquer le format pourcentage; Appliquer le format des nombres avec virgule; Augmenter le nombre de valeurs décimales; Diminuer le nombre de valeurs décimales
  G[Validation de champ]: Obligatoire <CheckBox>; Unique <CheckBox>; Indexé <CheckBox>; Validation; Réduire le ruban
TAB Table
  G[Table]: 
  G[Propriétés]: Propriétés de la table
  G[Avant les événements]: Avant modification; Avant suppression
  G[Après les événements]: Après insertion; Après MAJ; Après suppression
  G[Macros nommées]: Macro nommée
  G[Relations]: Relations; Dépendances d'objet; Réduire le ruban
```

### Table en Création

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide | Création de tableau 
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne; Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
TAB Création de tableau 
  G[Création de tableau ]: 
  G[Affichages]: Affichage; Affichage
  G[Outils]: Clé primaire; Générateur; Tester les règles de validation; Insérer des lignes; Supprimer les lignes; Modifier les recherches
  G[Afficher/Masquer]: Feuille de propriétés; Index
  G[Champ, enregistrement et événements de table]: Créer des macros de données; Renommer/supprimer une macro
  G[Relations]: Relations; Dépendances d'objet; Réduire le ruban
```

### Requête en Création

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide | Conception de requêtes
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne; Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
TAB Conception de requêtes
  G[Conception de requêtes]: 
  G[Résultats]: Affichage; Affichage; Exécuter; Exécuter
  G[Type de requête]: Sélection; Création de table; Ajout; Mise à jour; Analyse croisée; Suppression; Union; SQL direct; Définition des données
  G[Paramètres de requête]: Ajouter des tables; Insérer des lignes; Supprimer les lignes; Générateur; Insérer des colonnes; Supprimer des colonnes; Renvoyer  <ComboBox>; Renvoyer  <Edit>; Ouvrir
  G[Afficher/Masquer]: Totaux; Paramètres; Feuille de propriétés; Noms des tables; Réduire le ruban
```

### Formulaire en Création

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide | Conception de formulaires | Organiser | Format
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne; Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
TAB Conception de formulaires
  G[Conception de formulaires]: 
  G[Affichages]: Affichage; Affichage
  G[Thèmes]: Thèmes; Couleurs; Polices
  G[Contrôles]: 
  G[Contrôles]: Contrôles <Pane>; Contrôles; Insérer une image; Insérer un graphique moderne
  G[En-tête/pied de page]: Logo; Titre; Date et heure
  G[Outils]: Ajouter des champs existants; Feuille de propriétés; Ordre de tabulation...; Paramètres du graphique; Sous-formulaire dans une nouvelle fenêtre; Visualiser le code; Convertir les macros de formulaire en Visual Basic; Réduire le ruban
TAB Organiser
  G[Organiser]: 
  G[Table]: Quadrillage; Empilé; Tabulaire; Supprimer la disposition
  G[Lignes et colonnes]: Insérer au-dessus; Insérer en dessous; Insérer à gauche; Insérer à droite; Sélectionner une disposition; Sélectionner une colonne; Sélectionner une ligne
  G[Fusionner/fractionner]: Fusionner; Fractionner verticalement; Fractionner horizontalement
  G[Déplacer]: Monter; Descendre
  G[Position]: Marges du contrôle; Remplissage du contrôle; Ancrage
  G[Redimensionnement et classement]: Taille/Espace; Aligner; Premier plan; Arrière-plan; Réduire le ruban
TAB Format
  G[Format]: 
  G[Sélection]: Objet  <ComboBox>; Objet  <Edit>; Ouvrir; Sélectionner tout
  G[Police]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Reproduire la mise en forme; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite
  G[Nombre]: Format  <ComboBox>; Format  <Edit>; Ouvrir; Appliquer le format monétaire; Appliquer le format pourcentage; Appliquer le format des nombres avec virgule; Augmenter le nombre de valeurs décimales; Diminuer le nombre de valeurs décimales
  G[Arrière-plan]: Image d’arrière-plan; Autre couleur de ligne; Autre couleur de ligne
  G[Contrôler la mise en forme]: Styles rapides; Modifier la forme; Mise en forme conditionnelle...; Remplissage; Contour; Effets; Réduire le ruban
```

### État en Création

```
TABS: Accueil | Créer | Données externes | Outils de base de données | Aide | Conception du rapport | Organiser | Format | Mise en page
TAB Accueil
  G[Accueil]: 
  G[Affichages]: Affichage; Affichage
  G[Presse-papiers]: Coller; Coller; Couper; Copier; Reproduire la mise en forme; Presse-papiers Office...
  G[Trier et filtrer]: Filtrer; Croissant; Décroissant; Supprimer un tri; Sélection; Options avancées; Activer/désactiver le filtre
  G[Enregistrements]: Actualiser tout; Actualiser tout; Nouveau; Enregistrer; Supprimer; Supprimer; Totaux; Orthographe; Plus
  G[Rechercher]: Rechercher...; Remplacer...; Atteindre; Sélectionner
  G[Mise en forme du texte]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Puces; Numérotation; Augmenter le retrait; Diminuer le retrait; De gauche à droite; De gauche à droite; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur de surlignage du texte; Couleur de surlignage du texte; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite; Quadrillage; Autre couleur de ligne; Autre couleur de ligne; Feuille de données...; Réduire le ruban
TAB Créer
  G[Créer]: 
  G[Modèles]: Composants d’application
  G[Tables]: Table; Création de table; Listes SharePoint
  G[Requêtes]: Assistant Requête; Création de requête; Requête SQL
  G[Formulaires]: Formulaire; Création de formulaire; Formulaire vierge; Assistant Formulaire; Navigation; Plus de formulaires
  G[États]: État; Création d'état; État vide; Assistant État; Étiquettes
  G[Macros et code]: Macro; Module; Module de classe; Visual Basic; Réduire le ruban
TAB Données externes
  G[Données externes]: 
  G[Importer et lier]: Nouvelle source de données; Importations enregistrées; Gestionnaire de tables liées
  G[Exporter]: Exportations enregistrées; Dataverse; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Access; Publipostage Word; Plus; Réduire le ruban
TAB Outils de base de données
  G[Outils de base de données]: 
  G[Outils]: Compacter et réparer une base de données
  G[Macro]: Visual Basic; Exécuter une macro
  G[Relations]: Relations; Dépendances d'objet
  G[Analyser]: Documentation de base de données; Analyse des performances; Analyser la table
  G[Déplacer les données]: Base de données Access; SharePoint
  G[Compléments]: Compléments; Réduire le ruban
TAB Aide
  G[Aide]: 
  G[Aide]: Aide; Contacter le support...; Commentaires; Afficher la formation; Réduire le ruban
TAB Conception du rapport
  G[Conception du rapport]: 
  G[Affichages]: Affichage; Affichage
  G[Thèmes]: Thèmes; Couleurs; Polices
  G[Regroupement et totaux]: Regrouper et trier; Totaux; Masquer les détails
  G[Contrôles]: 
  G[Contrôles]: Contrôles <Pane>; Contrôles; Insérer une image; Insérer un graphique moderne
  G[En-tête/pied de page]: Numéros de page; Logo; Titre; Date et heure
  G[Outils]: Ajouter des champs existants; Feuille de propriétés; Ordre de tabulation...; Paramètres du graphique; Sous-état dans une nouvelle fenêtre; Visualiser le code; Convertir les macros d'état en Visual Basic; Réduire le ruban
TAB Organiser
  G[Organiser]: 
  G[Table]: Quadrillage; Empilé; Tabulaire; Supprimer la disposition
  G[Lignes et colonnes]: Insérer au-dessus; Insérer en dessous; Insérer à gauche; Insérer à droite; Sélectionner une disposition; Sélectionner une colonne; Sélectionner une ligne
  G[Fusionner/fractionner]: Fusionner; Fractionner verticalement; Fractionner horizontalement
  G[Déplacer]: Monter; Descendre
  G[Position]: Marges du contrôle; Remplissage du contrôle
  G[Redimensionnement et classement]: Taille/Espace; Aligner; Premier plan; Arrière-plan; Réduire le ruban
TAB Format
  G[Format]: 
  G[Sélection]: Objet  <ComboBox>; Objet  <Edit>; Ouvrir; Sélectionner tout
  G[Police]: Police  <ComboBox>; Police  <Edit>; Ouvrir; Taille de police  <ComboBox>; Taille de police  <Edit>; Ouvrir; Reproduire la mise en forme; Gras; Italique; Souligner; Couleur de police; Couleur de police; Couleur d’arrière-plan; Couleur d’arrière-plan; Aligner à gauche; Centrer; Aligner à droite
  G[Nombre]: Format  <ComboBox>; Format  <Edit>; Ouvrir; Appliquer le format monétaire; Appliquer le format pourcentage; Appliquer le format des nombres avec virgule; Augmenter le nombre de valeurs décimales; Diminuer le nombre de valeurs décimales
  G[Arrière-plan]: Image d’arrière-plan; Autre couleur de ligne; Autre couleur de ligne
  G[Contrôler la mise en forme]: Styles rapides; Modifier la forme; Mise en forme conditionnelle...; Remplissage; Contour; Effets; Réduire le ruban
TAB Mise en page
  G[Mise en page]: 
  G[Taille de la page]: Taille; Marges; Afficher les marges <CheckBox>; Données seulement <CheckBox>
  G[Mise en page]: Portrait; Paysage; Colonnes; Mise en page...; Réduire le ruban
```

### Aperçu avant impression

```
TABS: Aperçu avant impression
TAB Aperçu avant impression
  G[Aperçu avant impression]: 
  G[Imprimer]: Imprimer
  G[Taille de la page]: Taille; Marges; Afficher les marges <CheckBox>; Données seulement <CheckBox>
  G[Mise en page]: Portrait; Paysage; Colonnes; Mise en page...
  G[Zoom]: Zoom; Zoom; Une page; Deux pages; Plus de pages
  G[Données]: Actualiser tout; Excel; Fichier texte; PDF ou XPS; Envoyer par courrier; Plus
  G[Fermer l'aperçu]: Fermer l'aperçu avant impression; Réduire le ruban
```
