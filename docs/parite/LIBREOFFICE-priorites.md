# Plan d'implémentation : parité ForgeOffice / LibreOffice

Date : 2026-11-05. Source : `LIBREOFFICE.md` (632 entrées : 181 OK, 228 Partiel, 14 Présent à vérifier, 209 Absent). Ce plan ne couvre que ce que LibreOffice a en plus ou fait autrement. Les lots recoupant l'audit Office sont marqués « RECOUVRE » : ne les faire qu'une fois, dans le lot de l'audit Office, puis cocher les ID LibreOffice correspondants.

Audits Office lus au moment de l'écriture : `EXCEL.md` / `EXCEL-priorites.md` (lots A à Z), `ACCESS.md` / `ACCESS-priorites.md` (lots 0 à 14), `POWERPOINT.md`, `PDF.md`, `NOTES.md`. `WORD.md`, `PUBLISHER.md` et `POWERPOINT-priorites.md` n'existaient pas encore : les recoupements Texte/Publication sont notés « probable, à confirmer ».

## Règles de conduite

1. Un lot = un dossier ou des fichiers disjoints, pas de modification de `strings.ts` partagé sans passer par le socle de chaque module (lot 0 d'EXCEL et d'ACCESS pour le Tableur et la Base ; pour Texte, ajouter un fichier `strings-<lot>.ts` par lot).
2. P1 avant P2 avant P3. Les lignes « Présent à vérifier » se prouvent dans la campagne de preuve de l'audit Office correspondant.
3. Existant conservé : on ajoute des choix, on ne remplace pas ; thème d'origine par défaut. Interface 100 % française. Rien publié, jamais de git.
4. Fichiers de 800 lignes visés, 1000 maximum.
5. Macros et extensions : pas d'exécution de code tiers (décision § 8 de `LIBREOFFICE.md`).

## Lots

Effort : S (moins d'une journée d'agent), M (1 à 3 jours), L (plus). « Recouvre » = lot de l'audit Office qui contient déjà la fonction.

| Lot | Titre | Dossier / fichiers (disjoints) | Effort | Prio | Entrées LibreOffice | Recouvre |
|---|---|---|---|---|---|---|
| LO-1 | Styles : modification complète, style suivant/basé sur, mise à jour d'après la sélection, panneau multi-familles, charger des styles | `packages/word/src/features/styles-edit.ts`, `dialogs/style-edit.tsx` (nouveaux) ; Tableur : styles de cellule dans `excel/src/logic/styles.ts` | M | P1 | W-190, W-194, W-195, W-196, W-199, W-201, W-205, C-088 | Texte (Modifier le style) : probable, à confirmer ; EXCEL lot A (styles de cellule) |
| LO-2 | Styles de page nommés + Page de titre + saut avec style | `packages/docx/src/model-section.ts` (type `PageStyle`), `word/src/features/pagestyles.ts`, `dialogs/pagestyle.tsx` | L | P1 | W-091, W-167, W-168, W-198 | Non (UNIQUE LibreOffice) ; sections Word = base |
| LO-3 | Correction automatique et typographie française (espaces insécables, guillemets « », remplacements, listes et bordures automatiques) | `packages/proofing/src/autocorrect.ts` (nouveau, sans DOM, testé) + branchement dans `word/src/editor/plugins.ts`, `powerpoint`, `notes` | M | P1 | W-123, W-178, W-179, W-180, X-015, X-038 | Texte (Correction automatique) : probable |
| LO-4 | Orthographe avec dictionnaires installables, grammaire de base, césure, thésaurus hors ligne | `packages/proofing/src/spell.ts`, `grammar.ts`, `hyphen.ts` ; dépendance Hunspell JS (licence à valider) | L | P1 | W-181, W-240 à W-244, X-012 à X-014 | Texte « Grammaire et orthographe », Tableur Révision : probable |
| LO-5 | Zones de texte flottantes, cadres, cadres chaînés dans Texte | `packages/word/src/frames/` (nouveau), `docx/src/docx/read-body.ts` (`framePr`, `txbx`) ; réutilise `publisher/src/flow` pour le chaînage | L | P1 | W-059, W-108, W-109, W-110, W-171 à W-173, W-175, W-197 | Texte « Zone de texte / Habillage » : recouvre en partie W-108 |
| LO-6 | Champs, variables utilisateur, champs conditionnels, DOCPROPERTY, dialogue « Autre champ » | `packages/word/src/features/fields/`, `dialogs/field-full.tsx` | M | P1 | W-064, W-092 à W-097 | Texte « Champ » : probable |
| LO-7 | Tableaux Texte : formules (=SOMME), reconnaissance des nombres, scinder/fusionner tableau, propriétés (dialogue), protéger cellules, dessiner | `packages/word/src/features/table-calc.ts`, `dialogs/table-props.tsx` ; moteur `@forgeoffice/formulas` | M | P1 | W-211, W-216 à W-222, W-225, W-254 | Texte « Formule » de tableau : probable |
| LO-8 | Navigateur multi-types partagé (Texte, Tableur, Présentation) | `packages/ui/src/navigator/` + adaptateurs `word/src/ui/NavigatorPane.tsx`, `excel/src/ui/NavigatorPane.tsx` | M | P1 | W-076 à W-078, C-032, I-022, X-010 | EXCEL lot C (Atteindre) en partie ; Texte volet Navigation |
| LO-9 | Table des matières, index, bibliographie : dialogue complet à onglets, index d'objets et utilisateur, styles de bibliographie, notes (format, conversion) | `packages/word/src/features/toc.ts` (étendre), `dialogs/toc-full.tsx`, `features/biblio.ts` | M | P1 | W-063, W-098, W-102 à W-107, W-247 | Texte Références : probable |
| LO-10 | Sources de données unifiées + publipostage complet (assistant, ODS/XLSX/Base, courriel, PDF individuels) | `packages/core` (contrat `DataSource`), `word/src/features/merge-wizard/`, `publisher/src/merge-*.ts`, Base : registre de sources | L | P1 | W-250 à W-252, X-028, X-029, B-005, B-029, W-002, W-003 | Texte / Publication Publipostage ; ACCESS lot 11 (données externes) en partie |
| LO-11 | Exports réglables : PDF direct par module (qualité, signets, sécurité, plages), PDF/A, EPUB, image, PDF vectoriel avec texte sélectionnable pour Présentation et Publication | `packages/convert/src/export-*`, `powerpoint/src/app/pdf-export.ts`, `word/src/app/export.ts`, natif `forge-convert` | L | P1 | W-019 à W-022, W-026, I-008, I-009, I-011, C-011, C-012, X-004, X-005 | RECOUVRE POWERPOINT.md (export PDF vectoriel, ROADMAP § 4) ; EXCEL lot I (impression/export) ; CONVERTISSEUR.md |
| LO-12 | Sécurité des fichiers : chiffrement à l'enregistrement (OOXML agile + ODF), signature numérique (certificat) | `packages/opc/src/encrypt.ts` (écriture), `packages/opc/src/sign.ts`, UI Backstage de chaque module | L | P1 | W-017, W-031, W-121, C-013, C-014, I-014, I-015, X-002, X-003, X-020 | RECOUVRE tous les audits Office (chiffrer par mot de passe, signature numérique) ; PDF.md pour la signature PDF |
| LO-13a | ODF Texte : .fodt, .ott, styles de page en .odt, lecture formats hérités (.sxw, .wpd, .abw) | `packages/docx/src/odt/` | M | P1 puis P3 | W-011, W-012, W-015, W-016, W-279, X-001 | Non (UNIQUE) |
| LO-13b | ODF Tableur : .ots, .fods, écriture des commentaires, validations, mises en forme conditionnelles, volets, images | `packages/xlsx/src/ods/` | M | P1 | C-003, C-007, C-019, X-001 | EXCEL lot J en partie (formats) |
| LO-13c | ODF Présentation : écriture des graphiques, animations, transitions, masques ; lecture des animations ; .otp, .fodp | `packages/pptx/src/odp*.ts` | L | P1 | I-002, I-003, I-004, I-104 | RECOUVRE POWERPOINT.md (.odp) |
| LO-14 | Calc What-If : Valeur cible, Gestionnaire de scénarios, Table multi-opérations (+ MULTIPLE.OPERATIONS), Consolider, Solveur | `packages/excel/src/logic/whatif.ts`, `ui/dialogs/whatif.tsx`, `formulas/src/functions/multiple-ops.ts` | L (valeur cible S, consolider M, scénarios M, solveur L) | P1 puis P2 | C-121, C-122, C-128, C-129, C-130 | RECOUVRE EXCEL lot J (D4.3-26 à 28, R1.22-06, R1.23-01 à 03) : faire une fois |
| LO-15 | Calc statistiques (descriptives, corrélation, régression, ANOVA, tests t/z/F/chi², Fourier, moyenne mobile) + générateur de nombres aléatoires | `packages/excel/src/logic/stats-tools.ts`, `ui/dialogs/stats.tsx` | M | P2 | C-131, C-132 | Non (Utilitaire d'analyse d'Excel : voir EXCEL lot J, à confirmer) |
| LO-16 | Calc : filtre standard (regex, copie ailleurs), filtre spécial, listes de tri personnalisées, plages de base de données, entourer valeurs non valides | `packages/excel/src/logic/data.ts` (étendre), `ui/dialogs/data.tsx` | M | P1 | C-110, C-111, C-115, C-117, C-118, C-125 | RECOUVRE EXCEL lot J (filtre avancé, listes) en grande partie |
| LO-17 | Calc : fonctions propres à LibreOffice (EASTERSUNDAY, STYLE, CURRENT, RAWSUBTOTAL, DDE refusé, *_ADD, FOURIER) | `packages/formulas/src/functions/libreoffice.ts` (nouveau) + `names-fr.ts` | S | P2 | C-165, C-167 | EXCEL lot M en partie |
| LO-18 | Calc : liens vers données externes (HTML, CSV, XLS/ODS, XML), feuille depuis fichier, actualisation périodique | `packages/excel/src/logic/links.ts`, `ui/dialogs/external.tsx` | M | P2 | C-050, C-095, C-096, C-133, C-134, C-138 | RECOUVRE EXCEL lot J (Obtenir des données) en partie |
| LO-19 | Calc : mise en page (en-têtes/pieds, zones d'impression multiples, styles de page partagés) et import CSV à dialogue complet | `packages/excel/src/ui/print*.tsx`, `ui/dialogs/csv-import.tsx` | M | P1 | C-010, C-089, C-090, C-091 | RECOUVRE EXCEL lot I (mise en page et impression) : faire une fois |
| LO-20 | Graphiques : insertion dans Texte, éditeur de séries, titres d'axes, radar/bulles/bourse, lignes de tendance, barres d'erreur | `packages/word/src/features/chart-insert.ts` ; `excel/src/ui/ChartView.tsx` ; moteur `powerpoint/src/canvas/chart` | L | P1 | W-115, C-052 à C-055, I-074 | RECOUVRE EXCEL lot G, POWERPOINT.md (graphiques) |
| LO-21 | Barre latérale Propriétés/Styles/Galerie/Gestionnaire d'images partagée | `packages/ui/src/sidebar/`, adaptateurs par module | L | P2 | W-075, W-079, C-041, I-021, X-008, X-009 | Non (UNIQUE) ; recoupe le volet Format d'Office (POWERPOINT.md) |
| LO-22 | Présentation : console du présentateur sur second écran, mode documents (handout), masque des notes, diaporama personnalisé, kiosque, dupliquer paramétré, fusion de formes, motifs/hachures, animation du texte, album photo | `packages/powerpoint/src/app/` (fichiers nouveaux) | L | P1/P2 | I-017, I-019, I-020, I-030, I-043, I-050, I-056, I-063, I-070, I-081, I-083, I-089 | RECOUVRE POWERPOINT.md (second écran, fusion de formes, diaporama personnalisé) |
| LO-23 | Texte : éléments mineurs de LibreOffice (Répéter, Texte automatique/blocs, ligne horizontale, relief/overline/clignotement, lettrine, ruban de mode Insertion/Refrappe, règle verticale, Page de garde étendue, étiquettes et enveloppes) | `packages/word/src/features/misc-lo/` | M | P2 | W-041, W-060, W-082, W-083, W-120, W-141, W-142, W-158, W-002, W-003 | Texte : lettrine, étiquettes, enveloppes probables |
| LO-24 | Base : format .odb (lecture/écriture), sous-formulaires, boutons de commande, Report Builder multi-niveaux, résultats éditables | `crates/forge-base` + `packages/access/src/odb/` ; UI via les lots ACCESS 3, 5, 8, 10 | L | P1 | B-002, B-013 à B-016, B-018, B-020 | RECOUVRE ACCESS lots 3, 5, 8, 10 ; seul `.odb` est propre à LibreOffice |
| LO-25 | Base : connexions externes (MySQL, PostgreSQL, ODBC), vues, utilisateurs | `crates/forge-base/src/remote/` | L | P3 | B-003, B-012, B-026 | ACCESS lot 11 en partie |
| LO-26 | Module Math (paquet partagé `packages/math`) | voir § 9.2 de `LIBREOFFICE.md` | M puis M | P1 | M-001 à M-016, W-116, I-047 | RECOUVRE le manque « éditeur d'équations » d'Office (ROADMAP § 5, POWERPOINT.md) |
| LO-27a | Module Dessin : noeuds et Bézier (`pen`, mode Points) | `packages/powerpoint/src/canvas/nodes/` (nouveau), `path-ops.ts` | M | P1 | D-008, D-009 | Non (Visio) |
| LO-27b | Module Dessin : opérations booléennes, fractionner, convertir en courbe | `packages/powerpoint/src/canvas/path-bool.ts` | M | P1 | D-010 à D-012 | RECOUVRE « Fusionner les formes » d'Office (POWERPOINT.md) |
| LO-27c | Module Dessin : calques et cotes | `packages/draw/src/layers.ts`, `dimension.ts` | M | P1 | D-015, D-016, D-022 | Non |
| LO-27d | Module Dessin : import/export SVG et ODG, EMF en lecture | `packages/draw/src/io/` ; réutilise `pptx/odp-geometry.ts` | M | P1 | D-002 à D-006 | Non |
| LO-27e | Module Dessin : gabarits de formes (organigramme, UML, réseau, électrique), galerie | `packages/draw/src/stencils/` (données JSON) | S/M | P2 | D-030, D-031, D-043 | Non |
| LO-27f | Module Dessin : application (App, ruban, panneaux, backstage, enregistrement `.fodraw`) | `packages/draw/` | L | P1 | D-001, D-013 à D-046 | Non (dépend de 27a à 27d) |
| LO-28 | Décision macros / extensions de ressources (dictionnaires, modèles, galeries) ; éventuel script JS borné | `docs/DECISIONS-A-PRENDRE.md` (à compléter par l'orchestrateur) | S (décision) / L (moteur) | P3 | X-016 à X-019, W-255, C-158, B-024, I-101 | RECOUVRE DECISIONS « langage de macros » |

## Vagues proposées (parallélisables)

| Vague | Lots | Condition |
|---|---|---|
| 0 | Socles des audits Office (lot 0 EXCEL, lot 0 ACCESS) | prérequis des lots 14, 16, 17, 18, 19 |
| 1 | LO-1, LO-2, LO-3, LO-6, LO-7, LO-17, LO-26 (moteur), LO-13a, LO-13b | dossiers disjoints |
| 2 | LO-4, LO-5, LO-8, LO-9, LO-14, LO-16, LO-19, LO-27a, LO-27b | LO-1 pour LO-9 ; socle Tableur pour 14, 16, 19 |
| 3 | LO-10, LO-11, LO-12, LO-13c, LO-15, LO-18, LO-20, LO-22, LO-24, LO-27c, LO-27d | contrat `DataSource` (LO-10) fusionné avant LO-24 |
| 4 | LO-21, LO-23, LO-25, LO-27e, LO-27f, LO-28 | tous les lots précédents concernés |

## Ordre de livraison conseillé (rapport utilité / effort)

1. LO-3 correction automatique et typographie française (M, impact immédiat pour un utilisateur francophone).
2. LO-1 modification de style (M).
3. LO-17 fonctions LibreOffice du moteur (S).
4. LO-14 valeur cible seule (S), puis scénarios et consolider (M) : une fois, avec EXCEL lot J.
5. LO-26 module Math (moteur partagé, M).
6. LO-6 champs et variables (M), LO-7 formules de tableau (M).
7. LO-2 styles de page (L) : fondation pour LO-13a et LO-27.
8. LO-11 exports (L), LO-12 chiffrement puis signature (L) : à faire avec les audits Office.
9. LO-4 orthographe / grammaire (L, dépendance à valider).
10. LO-27 module Dessin (a, b, c, d puis f).

## Risques

- Hunspell/LanguageTool : licences des dictionnaires (MPL/LGPL/GPL) et poids ; Grammalecte est GPL (incompatible sans décision du propriétaire) : écrire des règles maison pour le français.
- Dépendance `epub` GPL déjà signalée dans `DECISIONS-A-PRENDRE.md` : conditionne LO-11.
- La coquille Tauri n'a jamais été lancée par les audits : les lots LO-11, LO-12, LO-18, LO-24 dépendent de `forge-convert` et du bureau natif, à exercer dans l'application réelle.
- LO-5 (cadres) et LO-2 (styles de page) changent le modèle `@forgeoffice/docx` : les faire en dehors de tout autre lot touchant `model-section.ts` ou la pagination (`word/src/layout`).
