# Plan d'implémentation ONLYOFFICE : lots parallélisables (2026-11-05)

Source : `docs/parite/ONLYOFFICE.md` (identifiants DE-, SSE-, PE-, PDF-, COM-, PLG-, FMT-, VSD- cités entre parenthèses).
Un lot = un dossier ou un petit ensemble de fichiers à lui, sans toucher aux fichiers des autres lots. Effort : S < 1 jour, M 1 à 3 jours, L > 3 jours d'un agent.
Colonne « Recouvre Office » : le lot traite sans doute la même lacune qu'un audit Office (WORD.md, EXCEL.md, POWERPOINT.md, PUBLISHER.md, ACCESS.md) ; un seul agent doit le coder, l'autre audit pointe vers lui.
Règles du dépôt (`CONVENTIONS.md`) : TypeScript strict, 1000 lignes max par fichier, textes dans `strings.ts`, tests `node --test`, jamais de `git`, vérification visuelle dans le banc.

## 1. Fichiers partagés = points de collision (à connaître avant de lancer des lots en parallèle)

| Fichier / zone | Lots qui le touchent | Parade |
|---|---|---|
| `packages/word/src/editor/schema.ts`, `convert.ts` | L01, L02, L12, L15, L25 | L01 d'abord (nœuds de contrôle), les autres rebasent ; ou un nœud par fichier `schema-<lot>.ts` importé par `schema.ts` |
| `packages/word/src/strings.ts` (269 lignes de chaînes) | tous les lots Texte | chaque lot ajoute `strings-<lot>.ts` et une seule ligne d'import dans `strings.ts` |
| `packages/*/src/ribbon/*.ts` (onglets) | L01, L02, L04, L05, L13, L25, L26 | un lot par onglet, ou l'orchestrateur fusionne les entrées de ruban à la fin |
| `packages/excel/src/strings.ts`, `ribbon/` | L06 à L10, L11 | idem : `strings-<lot>.ts` |
| `packages/xlsx/src/model*.ts` | L06, L10, L11 | modèle par fichier `model-<lot>.ts` |
| `packages/ui/src/` | L04, L05, L17, L28 | un sous-dossier par lot (`logic/autocorrect/`, `plugins/`, `shortcuts/`) |

## 2. Lots

### Vague 1 : P1, dossiers disjoints, lancement immédiat en parallèle

| Lot | Contenu | Dossier / fichiers | Lignes d'audit | Effort | Dépend de | Recouvre Office |
|---|---|---|---|---|---|---|
| L01 | Contrôles de contenu : insertion (texte riche / brut, image, liste, liste déroulante, date, case), propriétés, verrouillage, espace réservé, menu contextuel ; le modèle `ContentControlProps` de `packages/docx` existe déjà | `packages/word/src/features/controls/`, `dialogs/controls.tsx`, nœud dans `editor/schema-controls.ts` | DE-041, DE-042, DE-043, DE-228 | M | aucun | WORD.md (onglet Développeur) |
| L03 | Créateur de formulaires PDF complet : champs image / e-mail / téléphone / code postal / carte / date, propriétés (obligatoire, conseil, format, verrou, bordure, remplissage), Champ suivant / précédent, Effacer, Soumettre | `packages/pdf/src/forms-create.ts`, `forms-props.tsx`, tests `pdf/tests/forms-create.test.ts` | PDF-020 à PDF-024 | M | aucun | non |
| L04 | Autocorrection : remplacements, guillemets typographiques FR, tirets, majuscule de début de phrase, listes et liens automatiques, AutoMaths ; dialogue de réglages ; fonction pure sans DOM + greffon par module | `packages/ui/src/logic/autocorrect/` (pur), branchement minimal dans `word/src/editor/setup.ts` et la saisie Tableur | COM-031 | M | aucun | WORD.md / EXCEL.md |
| L06 | Segments (tableaux et TCD) : modèle + lecture / écriture OOXML `slicerCache`, objet graphique, volet de paramètres, filtrage | `packages/xlsx/src/xlsx/slicers.ts`, `model-slicer.ts`, `packages/excel/src/logic/slicers.ts`, `ui/Slicer*.tsx` | SSE-026, SSE-096, SSE-114 | M | aucun | EXCEL.md |
| L07 | Valeur cible (dialogue + recherche numérique : sécante / dichotomie, 100 itérations, rapport) | `packages/excel/src/logic/goalseek.ts`, `ui/GoalSeekDialog.tsx` | SSE-065 | S | aucun | EXCEL.md |
| L13 | Protection de document par modes (lecture seule, commentaires, révisions, formulaires) + mot de passe ; écriture de fichiers OOXML chiffrés (docx, xlsx, pptx) ; dialogue Chiffrer | `packages/opc/src/encrypt.ts`, `packages/word/src/features/protect/`, `dialogs/protect.tsx` | COM-041, DE-127, DE-160, DE-161, PE-036 | M | aucun | WORD.md / EXCEL.md / POWERPOINT.md |
| L14 | PDF : annotations existantes modifiables / supprimables, légende de texte, lignes connectées, tampon image, biffure « Rechercher et biffer » et « Biffer les pages » | `packages/pdf/src/annots.ts`, `redact.ts`, `stamps.ts` | PDF-010 à PDF-013, PDF-030 | M | aucun | non |

### Vague 2 : P1 plus gros, après la vague 1 ou avec coordination

| Lot | Contenu | Dossier / fichiers | Lignes d'audit | Effort | Dépend de | Recouvre Office |
|---|---|---|---|---|---|---|
| L02 | Formulaires remplissables dans Texte (11 types de champs, paramètres, formats, aperçu / remplissage, rôles locaux, protection « remplissage seul », export PDF avec AcroForm, formats DOCXF / OFORM) | `packages/word/src/features/forms/`, `docx/src/docx/forms.ts` | DE-110 à DE-128 | L | L01, L03, L13 | WORD.md |
| L05 | Hôte de plugins locaux : manifeste, API de document, panneau latéral, exécution isolée (iframe `sandbox` + Worker), onglet Plugins, plugins d'arrière-plan | `packages/core/src/plugins/`, `packages/ui/src/plugins/` | COM-039, DE-171 | L | aucun (grosse conception : écrire d'abord le contrat) | non |
| L11 | Graphiques complets : éditeur de séries, titres d'axes, lignes de tendance, barres d'erreur, boursier, radar, 3D ; insertion dans Texte | `packages/excel/src/ui/chart/`, `packages/xlsx` (modèle déjà : `ChartModel`, `Trendline`), `word/src/features/chart/` | SSE-022 à SSE-025, DE-035, DE-210, COM-051 | L | aucun | EXCEL.md / WORD.md / POWERPOINT.md : un seul agent |
| L12 | Éditeur d'équations structuré : analyseur / mise en page / OMML en paquet pur, barre de structures, conversion LaTeX / Unicode ; consommé par Texte, Présentation, PDF | nouveau `packages/math/` (réutiliser `powerpoint/src/app/equation.ts`) | COM-057, DE-039, DE-226, PE-035 | L | aucun | WORD.md |
| L15 | Positionnement absolu des images et formes dans Texte, alignement multi-objets, groupes, rognage | `packages/word/src/editor/objects/`, `layout/` | DE-069, DE-071, DE-073, DE-074 | L | L01 (schéma) | WORD.md : lot central, à ne pas dupliquer |

### Vague 3 : P2

| Lot | Contenu | Dossier / fichiers | Lignes d'audit | Effort | Dépend de | Recouvre Office |
|---|---|---|---|---|---|---|
| L08 | Solveur : Simplex LP, GRG non linéaire, évolutionnaire, contraintes, rapport | `packages/excel/src/logic/solver/` | SSE-066 | L | L07 | EXCEL.md |
| L09 | Fenêtre Espions | `packages/excel/src/logic/watch.ts`, `ui/WatchWindow.tsx` | SSE-045 | S | aucun | EXCEL.md |
| L10 | Vues de feuille nommées, plages protégées (interface), titres à imprimer, en-tête / pied de feuille | `packages/excel/src/logic/views.ts`, `protect-ranges.ts`, `print-titles.ts`, `header-footer.tsx` | SSE-027, SSE-028, SSE-075, SSE-076 | M | aucun | EXCEL.md |
| L16 | Macros JavaScript : éditeur, bac à sable, enregistreur, démarrage automatique, fonctions personnalisées, réglage de sécurité | `packages/core/src/macros/` | COM-034 à COM-038, SSE-053 | L | L05 (bac à sable) | WORD.md (VBA, partiel) |
| L17 | Raccourcis clavier personnalisables | `packages/ui/src/shortcuts/` | COM-004 | M | aucun | WORD.md |
| L18 | Combiner les formes | `packages/powerpoint/src/canvas/boolean-ops.ts` | COM-055, PE-009, DE-072 | M | aucun | POWERPOINT.md, PUBLISHER.md |
| L19 | Module Diagramme : visionneuse .vsdx puis éditeur (formes, connecteurs, pages) sur l'éditeur de page | nouveau `packages/diagram/`, `docx`-like `packages/vsdx/` | VSD-001 à VSD-007 | L | aucun | non |
| L20a | Formats texte : FB2, MHT, FODT, EPUB natif, écriture DOC | `packages/docx/src/{fb2,mht,fodt,epub,doc-write}/` | FMT-003, FMT-004, FMT-006, FMT-008 | M à L | aucun | WORD.md |
| L20b | Formats classeur : XLSB lecture, OTS, FODS, écriture XLS | `packages/xlsx/src/{xlsb,ots,fods,xls-write}/` | FMT-021 à FMT-023 | M à L | aucun | EXCEL.md |
| L20c | Formats présentation : OTP, FODP, écriture PPT, images par diapositive | `packages/pptx/src/{otp,fodp,ppt-write}/` | FMT-031 à FMT-034 | M | aucun | POWERPOINT.md |
| L21 | Signature numérique OOXML (ligne de signature, signature invisible, vérification) | `packages/opc/src/sign/` (réutiliser `pdf/src/sign/cms.ts` : à extraire en paquet commun) | COM-040, DE-162 | M | aucun | WORD.md |
| L22 | Versions locales datées + restauration + comparaison | `packages/core/src/versions.ts`, volet Historique | COM-022, DE-147, COL-005 | M | aucun | non |
| L23 | Plugins locaux de base : thésaurus hors ligne, OCR d'image (Tesseract.js), QR, coloration de code, typographie FR, nettoyage de texte, sélecteur de date, emoji | `packages/plugins-builtin/<nom>/` (un dossier par plugin, chacun S) | section 7 (PLG-001, 006, 008, 010, 011, 017) | M | L05 | WORD.md (synonymes) |
| L24 | Traduction locale (bergamot) et grammaire hors ligne (Grammalecte) | `packages/plugins-builtin/{translate,grammar}/` | PLG-002, PLG-012 | L | L05 | WORD.md |
| L25 | Paragraphe : lettrine (UI), paramètres des notes, taquets rendus, valeur de départ de numérotation, définition de liste multiniveau | `packages/word/src/features/paragraph-ext/` | DE-007, DE-008, DE-045, DE-092, DE-242 | M | L01 (schéma) | WORD.md |
| L26 | Tableau de Texte : formule de cellule, dessiner / effacer, répartir lignes et colonnes, rotation de cellule | `packages/word/src/features/table-ext/` | COM-059, DE-224 | M | aucun | WORD.md |
| L27 | Publipostage : source XLSX, envoi par e-mail, édition de la liste | `packages/word/src/features/merge-ext/` | DE-149, DE-151, COM-053 | M | aucun | WORD.md |
| L28 | Réglages d'interface : document sombre, style d'onglet, unité de mesure, zoom par défaut, intervalle de récupération | `packages/ui/src/settings/` | COM-006 à COM-014 | S | aucun | transversal |
| L31 | SmartArt complet (cycle, relation, matrice, pyramide, images) | `packages/powerpoint/src/app/smartart-*.ts`, `pptx/src/smartart.ts` | COM-058 | L | aucun | POWERPOINT.md |

### Vague 4 : P3 (à prendre en dernier)

| Lot | Contenu | Dossier / fichiers | Lignes d'audit | Effort | Recouvre Office |
|---|---|---|---|---|---|
| L29 | Text Art dans Texte et Tableur (réutiliser PowerPoint) | `packages/word/src/features/textart/` | COM-054, DE-038 | S | WORD.md |
| L30 | Direction RTL (paragraphe, feuille, interface) | `packages/word/src/features/rtl/`, `packages/ui` | DE-012, SSE-018, COM-010 | M | WORD.md |
| L32 | Fonction `SINGLE` (@) dans le moteur de formules | `packages/formulas/src/functions/` | SSE-055 | S | EXCEL.md |
| L33 | Panneau droit unifié de paramètres | `packages/ui/src/components/SettingsPane/` | SSE-110, DE-206 à DE-211 | M | non |
| L34 | Combiner (fusionner) deux versions | `packages/word/src/features/compare.ts` (extension) | DE-145 | S | WORD.md |
| L35 | Lecture XPS / OFD / DjVu / HWP (conversion vers PDF puis affichage) | `packages/convert/src/` | FMT-010, FMT-011 | L | non |

## 3. Ordre conseillé et justification

1. **Vague 1 (7 lots, dossiers disjoints, lançables ensemble)** : ce sont les lacunes bloquantes pour un utilisateur qui vient d'ONLYOFFICE (formulaires PDF, contrôles de contenu, protection de document, autocorrection, segments, valeur cible, annotations PDF). Aucun ne dépend d'un autre.
2. **Vague 2** : L01 + L03 + L13 débloquent L02 (formulaires de Texte). L05 (hôte de plugins) est la plus grande décision d'architecture : écrire d'abord son contrat (API de document, modèle de sécurité) avant de lancer L16, L23, L24. L11, L12 et L15 sont les trois gros chantiers « qualité Office », communs avec les audits Word / Excel / PowerPoint : les confier chacun à UN seul agent.
3. **Vague 3** : parallélisable en bloc ; respecter les dépendances de la colonne « Dépend de ».
4. **Sécurité** (règle `CONVENTIONS.md`, « toute donnée venant d'un fichier est hostile ») : L05, L16, L23, L24 exécutent du code ou des modèles externes : bac à sable obligatoire, aucun réseau par défaut ; les plugins qui exigent un service en ligne ou une clé API (IA, traduction en ligne, YouTube, Zotero, Mendeley, Zoom, Jitsi, Salesforce, WordPress) sont REFUSÉS (règle « zéro service payant »).

## 4. Lots à ne pas dupliquer avec les audits Office

| Lot ONLYOFFICE | À coordonner avec | Précision |
|---|---|---|
| L01, L02, L13, L15, L25, L26, L27 | WORD.md | Contrôles, formulaires hérités, restriction d'édition, objets flottants, notes, tables et publipostage sont aussi des lignes Word |
| L06, L07, L08, L09, L10, L20b | EXCEL.md | Segments, valeur cible, solveur, espions, vues, plages protégées, formats classeur |
| L11 | EXCEL.md, WORD.md, POWERPOINT.md | Un seul moteur de graphiques (celui de `packages/pptx` : `chart-read/write`, `packages/xlsx` : `ChartModel`) |
| L12 | WORD.md, POWERPOINT.md | Équations : un paquet commun `packages/math` |
| L18, L31 | POWERPOINT.md, PUBLISHER.md | Opérations de formes et SmartArt sont dans l'éditeur de page partagé |
| L03, L14 | (PDF : seul ce document) | Les audits Office listés ne couvrent pas le module PDF ; Acrobat est la référence |
| L16, L17, L21, L28 | WORD.md, EXCEL.md, POWERPOINT.md | Macros, raccourcis, signature, réglages : transversaux |

## 5. Quick wins (chacun S, utile tout de suite)

1. L07 Valeur cible (moteur existant, ~150 lignes de logique + un dialogue).
2. L09 Fenêtre Espions.
3. L28 Réglages d'interface (document sombre, unité de mesure, intervalle de récupération).
4. L29 Text Art dans Texte (réutilisation).
5. L32 `SINGLE`.
6. L34 « Combiner » deux versions.
7. FB2, MHT, FODT / FODS / FODP / OTS / OTP (formats XML simples, un fichier chacun) dans L20a / L20b / L20c.
