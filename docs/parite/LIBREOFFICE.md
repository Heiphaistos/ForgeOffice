# Audit de parité : ForgeOffice face à LibreOffice (Writer, Calc, Impress, Draw, Math, Base)

Date : 2026-11-05. Périmètre : tout LibreOffice 24.x/25.x, en insistant sur ce que LibreOffice a EN PLUS de Microsoft Office ou fait autrement. L'audit Office est dans `WORD.md`, `EXCEL.md`, `POWERPOINT.md`, `PUBLISHER.md`, `ACCESS.md` (autres agents) ; une fonction « prévue dans l'audit Office » compte comme telle et n'est pas dupliquée ici (colonne MS).

## Méthode

- Code lu : `CONVENTIONS.md`, `docs/ROADMAP.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS-A-PRENDRE.md`, les STATUS de `word`, `docx`, `excel`, `xlsx`, `formulas`, `powerpoint`, `pptx`, `publisher`, `access`, `notes`, `pdf`, `convert` ; puis recoupement par recherche dans `packages/*/src` (chaînes de l'interface `strings.ts`, dialogues, commandes, registre des 505 fonctions, `equation.ts`, `canvas/`). LibreOffice n'est pas installé ; son contenu vient de la connaissance de ses menus, barres, barre latérale, dialogues et de la documentation officielle (résumée, aucun texte copié).
- Aucune exécution : aucun test relancé, aucune application lancée. Un statut ne reflète que le code et les STATUS lus.
- Aucun code ni fichier d'audit des autres agents modifié. Aucune commande git.

## Légende des statuts

| Statut | Sens |
|---|---|
| OK | Fonction complète, prouvée par un STATUS (tests, capture, ouverture dans l'application d'origine) |
| Présent à vérifier | Code ou chaîne d'interface vu, mais aucune preuve dans les STATUS ou STATUS contradictoire : à exercer avant de le déclarer fait |
| Partiel | Une partie seulement (options, formats, comportement) ; le manque est dit dans la colonne « Preuve ou manque » |
| Absent | Rien dans le code (recherche négative citée) |

Priorités : **P1** gêne majeure ou usage courant pour un utilisateur francophone ; **P2** utile ; **P3** rare ou confort. ID : W Writer, C Calc, I Impress, D Draw, M Math, B Base, X transversal.

## Récapitulatif

| Composant (module ForgeOffice) | Entrées | OK | Partiel | Présent à vérifier | Absent |
|---|---|---|---|---|---|
| Writer (Texte) | 245 | 60 (24,5 %) | 95 (38,8 %) | 6 (2,4 %) | 84 (34,3 %) |
| Calc (Tableur) | 154 | 61 (39,6 %) | 50 (32,5 %) | 3 (1,9 %) | 40 (26,0 %) |
| Impress (Présentation) | 97 | 39 (40,2 %) | 27 (27,8 %) | 4 (4,1 %) | 27 (27,8 %) |
| Draw (aucun module) | 46 | 0 | 26 (56,5 %) | 0 | 20 (43,5 %) |
| Math (aucun module) | 16 | 5 (31,3 %) | 5 (31,3 %) | 0 | 6 (37,5 %) |
| Base (Base de données) | 36 | 13 (36,1 %) | 11 (30,6 %) | 1 (2,8 %) | 11 (30,6 %) |
| Transversal (formats, outils, extensions) | 38 | 3 (7,9 %) | 14 (36,8 %) | 0 | 21 (55,3 %) |
| **Total** | **632** | **181 (28,6 %)** | **228 (36,1 %)** | **14 (2,2 %)** | **209 (33,1 %)** |

Lecture : les taux sont bas par construction, car l'audit liste surtout ce que LibreOffice ajoute ou fait différemment (les fonctions communes avec Office, déjà couvertes par les audits Office, sont résumées en une ligne). Les points durs : styles de page/cadre, correction automatique et grammaire, signature et chiffrement, outils d'analyse de Calc, Draw et Math absents.

## Fonctions UNIQUES à LibreOffice (absentes de Microsoft Office)

| Fonction unique | Où | Statut ForgeOffice | Prio |
|---|---|---|---|
| Styles de page (10 onglets) et enchaînement de styles | Writer (W-167, W-198) | Absent | P1 |
| Styles de cadre, cadres de texte flottants, cadres chaînés | Writer (W-109, W-110, W-197) | Absent (chaînage existe dans Publication) | P2 |
| Modification complète d'un style (15 onglets), style suivant, hérité | Writer, Calc, Impress (W-194, C-088) | Absent | P1 |
| Navigateur (F5) par type d'objet et réorganisation | Tous (W-076, C-032, I-022) | Partiel | P1 |
| Texte automatique, champs et variables utilisateur, champs conditionnels | Writer (W-060, W-093 à W-096) | Absent / Partiel | P1 |
| Sections nommées liées, masquées, protégées ; document maître | Writer (W-119, W-117) | Partiel / Absent | P2 |
| Index et tables multiples (objets, utilisateur, concordance) | Writer (W-104 à W-106) | Partiel | P2 |
| Bibliographie (25 champs) | Writer (W-107) | Partiel | P2 |
| Assistant de publipostage avec sources unifiées (Base, Calc, carnet) | Writer (W-250, X-028) | Partiel | P1 |
| Formules dans les tableaux Writer, reconnaissance des nombres | Writer (W-221, W-222) | Absent | P1 |
| Scénarios, table multi-opérations, consolidation, valeur cible, Solveur | Calc (C-121, C-122, C-128 à C-130) | Absent | P1/P2 |
| Statistiques (ANOVA, régression, tests, Fourier) | Calc (C-131) | Absent (fonctions présentes) | P2 |
| Listes de tri personnalisées, plages de base de données, liens externes | Calc (C-096, C-110, C-115) | Partiel / Absent | P2 |
| Fonctions propres : EASTERSUNDAY, MULTIPLE.OPERATIONS, STYLE, CURRENT, RAWSUBTOTAL, DDE, *_ADD, FOURIER | Calc (C-165) | Absent | P2 |
| Styles de page de Calc (en-têtes/pieds partagés) | Calc (C-089) | Absent | P2 |
| Calques, cotes, points de collage, duplication paramétrée, conversions de courbes, 3D | Draw (D-008 à D-016, D-033, D-035) | Absent | P1/P2 |
| Éditeur de formules StarMath avec panneau Éléments | Math (M-001 à M-016) | Partiel | P1 |
| Formats ODF (.odb, .odg, .odf, .fodt…), ODF chiffré/signé | Transversal (B-002, D-002, X-001, X-002) | Partiel / Absent | P1 |
| Macros Basic/Python/JS, extensions .oxt, API UNO | Transversal (X-016 à X-019) | Absent, décision § 8 | P3 |
| Galerie, barre latérale unifiée, console du présentateur, télécommande | Transversal (X-008, X-009, I-083, I-084) | Absent / Partiel | P2/P3 |
| Enveloppes, étiquettes, cartes de visite (assistants), Page de titre | Writer (W-002, W-003, W-168) | Absent | P2 |
| Autocorrection étendue (remplacements, guillemets, espaces fines avant ; : ! ?) | Writer (W-178, X-038) | Absent | P1 |

## Top 20 des fonctions LibreOffice manquantes les plus importantes

1. Styles de page nommés (W-167, W-198) et modification complète des styles avec style suivant (W-194, W-195, W-205).
2. Autocorrection et typographie française (W-178, W-179, X-038) : espaces insécables avant `; : ! ?`, guillemets « », remplacements.
3. Correcteur grammatical et dictionnaires installables (W-242, W-243, X-012, X-013).
4. Signature numérique (W-031, C-014, X-003) et enregistrement chiffré docx/xlsx/pptx/ODF (W-017, C-013, I-014, X-002).
5. Export PDF réglable et direct, PDF/A, texte sélectionnable pour Présentation (W-019, W-020, I-008).
6. Zones de texte flottantes, cadres et cadres chaînés dans Texte (W-108 à W-110).
7. Navigateur par type d'objet avec réorganisation (W-076, W-077, C-032).
8. Champs : « Autre champ », variables utilisateur, champs conditionnels, DOCPROPERTY (W-093 à W-096).
9. Formules dans les tableaux de Texte et reconnaissance des nombres (W-221, W-222).
10. Valeur cible, scénarios, table multi-opérations, consolidation, Solveur (C-121, C-122, C-128 à C-130).
11. Outils statistiques de Calc (C-131).
12. Filtre standard avec expressions régulières et filtre spécial (C-117, C-118).
13. Sources de données unifiées pour le publipostage (Base, ODS/XLSX, carnet) et liens de données externes (X-028, B-005, W-251, C-096, C-134).
14. Mise en page de Calc : en-têtes/pieds, styles de page (C-089, C-090).
15. Console du présentateur sur second écran (I-083) et mode kiosque/fenêtre (I-081).
16. Graphiques : insertion dans Texte, éditeur de séries, types manquants, lignes de tendance (W-115, C-052 à C-054, I-074).
17. Module Dessin (§ 9.1) : édition de noeuds, booléens, calques, cotes, SVG/ODG.
18. Éditeur de formules structuré avec palette, matrices, systèmes (§ 9.2, M-003, M-005).
19. Base : format .odb, sous-formulaires, Report Builder, boutons de commande (B-002, B-016, B-018, B-020).
20. Écriture ODF complète (.odp animations/graphiques, .ods commentaires/MFC, .odt styles de page) et .fodt/.ott/.ots/.otp (X-001, I-002, C-019, W-011, W-012).

Avis sur les deux modules à ajouter : **Dessin : oui** (effort L, moteur déjà aux 70 %), **Math : oui** comme paquet partagé avec dialogue d'édition (effort M, puis M pour l'aller-retour OMML complet). Voir § 9.

## 1. Writer (équivalent ForgeOffice : module Texte, `packages/word` + `packages/docx`)

Colonnes : `ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio`. Colonne MS : « oui » = existe dans Word (traité par WORD.md) ; « non (UNIQUE) » = fonction propre à LibreOffice.

### 1.1 Menu Fichier

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-001 | Nouveau (document, modèle, liste de modèles) | oui | OK | `features/templates.ts`, Backstage Nouveau (STATUS word) | P1 |
| W-002 | Nouveau > Étiquettes / Cartes de visite (assistant, feuilles Avery) | Word : Étiquettes | Absent | aucune trace dans `ribbon/` ; Publication a des étiquettes 70x37 en dur | P2 |
| W-003 | Nouveau > Enveloppe (assistant) | Word : Enveloppes | Absent | aucune trace | P2 |
| W-004 | Assistants Lettre, Fax, Agenda, Présentation | non (UNIQUE) | Partiel | modèle « Lettre » seulement (`strings.ts`, templates) | P3 |
| W-005 | Ouvrir / Ouvrir un fichier distant (WebDAV, FTP, SFTP, SMB) | oui | Partiel | Ouvrir OK ; fichier distant absent (hors ligne voulu) | P3 |
| W-006 | Documents récents | oui | OK | `addRecent` (STATUS word) | P1 |
| W-007 | Recharger | non (UNIQUE) | Absent | pas de commande dans Backstage | P3 |
| W-008 | Versions (versions multiples dans le fichier, comparaison) | non (UNIQUE) | Absent | ROADMAP § 3 : versions absentes ; récupération locale seulement | P2 |
| W-009 | Enregistrer / Enregistrer sous / Tout enregistrer | oui | OK | `act.save/saveAs` | P1 |
| W-010 | Enregistrer en .odt | oui | OK | `docx/src/odt/write-odt.ts` (fidélité « correcte ») | P1 |
| W-011 | .fodt (ODF à plat XML) | non (UNIQUE) | Absent | `formats.ts` | P3 |
| W-012 | Modèle .ott | Word : .dotx | Partiel | `ott` lu comme odt (`formats.ts` l.35) ; écriture .ott absente ; .dotx OK | P2 |
| W-013 | .docx/.docm/.dotx/.dotm/.rtf/.html/.md/.txt | oui | OK | `formatNames`, `writeDocument` | P1 |
| W-014 | .doc (Word 97-2003) écriture | oui | Absent | docx/STATUS : hors périmètre | P3 |
| W-015 | Écriture .xhtml, .epub, .sxw, .stw, .uot, .wps, .abw | non (UNIQUE) | Absent | formats écrits : voir W-013 ; EPUB/PDF seulement via le Convertisseur natif | P3 |
| W-016 | Lecture .sxw/.stw (OpenOffice 1), .wpd, .wps, .abw, .lwp, .hwp, .pages | non (UNIQUE) | Absent | `detectFormat` ne les connaît pas | P3 |
| W-017 | Enregistrer avec mot de passe (chiffrement ODF AES-256 / docx) | oui | Absent | lecture docx chiffré OK (`DocxPasswordError`) ; écriture chiffrée absente ; ODF chiffré non lu | P1 |
| W-018 | Enregistrer une copie | oui | Partiel | Enregistrer sous suffit, pas de commande dédiée | P3 |
| W-019 | Exporter en PDF (dialogue 7 onglets : général, vue initiale, interface, liens, sécurité, signatures, options) | oui | Partiel | `backstage.pdf` = impression vers PDF du navigateur ; moteur natif docx -> PDF dans le Convertisseur ; aucun réglage (qualité, signets, sécurité) | P1 |
| W-020 | PDF/A-1b/2b/3b, PDF/UA | oui (PDF/A) | Partiel | PDF/A par Ghostscript dans `packages/pdf` (jamais exercé, ROADMAP) ; pas d'export direct depuis Texte | P2 |
| W-021 | Export PDF en un clic (barre d'outils) | oui | Partiel | idem W-019 | P1 |
| W-022 | Exporter en EPUB (métadonnées, découpe par titre) | non (UNIQUE) | Partiel | Convertisseur natif (crate `epub`, licence en discussion DECISIONS) ; pas depuis Texte | P2 |
| W-023 | Exporter en XHTML/HTML | oui | OK | `exportHtml`, `html` Backstage | P2 |
| W-024 | Exporter en texte brut / Markdown | oui (txt) | OK | `exportMd`, `txt` | P2 |
| W-025 | Exporter en MediaWiki | non (UNIQUE) | Absent | - | P3 |
| W-026 | Exporter en image (PNG/JPG/SVG, page ou sélection) | non (UNIQUE) | Absent | aucun export image dans word | P3 |
| W-027 | Envoyer (courriel, PDF, ODT, DOCX) | oui | Absent | pas de client courrier | P3 |
| W-028 | Envoyer > Plan vers Impress / Presse-papiers / Présentation automatique | oui (vers PowerPoint) | Absent | pas de passerelle entre modules | P3 |
| W-029 | Envoyer > Créer un document maître | non (UNIQUE) | Absent | voir W-117 | P3 |
| W-030 | Propriétés (Général, Description, Personnalisées, CMIS, Sécurité, Police, Statistiques) | oui | Partiel | Backstage Informations : titre, objet, mots clés, société, catégorie, statistiques ; propriétés personnalisées lues/écrites par docx mais sans éditeur ; pas d'onglet Sécurité | P2 |
| W-031 | Signatures numériques (certificat X.509 / OpenPGP, signer, vérifier) | oui | Absent | ROADMAP § 3 : signature cryptographique absente | P1 |
| W-032 | Aperçu dans le navigateur Web | non (UNIQUE) | Absent | mode Web interne seulement | P3 |
| W-033 | Aperçu avant impression | oui | Partiel | Plusieurs pages en vignettes lecture seule (STATUS) | P2 |
| W-034 | Imprimer (dialogue : général, mise en page, options, commentaires, brochure) | oui | Présent à vérifier | `act.print()` via la fenêtre système ; pas de plage par sélection ni de commentaires en marge | P1 |
| W-035 | Imprimer en brochure (livret) | oui | Absent | livret existe dans Publication, pas dans Texte | P2 |
| W-036 | Fermer / Quitter | oui | OK | `act.close` | P1 |

### 1.2 Menu Édition

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-040 | Annuler / Rétablir (liste d'actions) | oui | OK | `History` du core | P1 |
| W-041 | Répéter la dernière action (Ctrl+Maj+Y) | oui (F4) | Absent | aucun `repeat` dans `editor/commands.ts` | P2 |
| W-042 | Couper, copier, coller | oui | OK | `act.cut/copy/paste` | P1 |
| W-043 | Collage spécial (HTML, RTF, texte, DDE, image, GDI) | oui | Partiel | dialogue à 2 choix (mise en forme, texte) | P2 |
| W-044 | Coller texte non formaté (Ctrl+Alt+Maj+V) | oui | OK | `paste('text')` | P1 |
| W-045 | Mode de sélection (standard, étendu, ajout, bloc), sélection multiple Ctrl | oui (bloc Alt) | Absent | ProseMirror : sélection unique | P3 |
| W-046 | Rechercher et remplacer (barre + dialogue) | oui | OK | `FindDialog`, `find.ts`, 29 tests | P1 |
| W-047 | Expressions régulières, mots entiers, casse, accents | oui | OK | options `regex`, `wholeWord`, `$1` | P1 |
| W-048 | Recherche par attributs et mise en forme | oui | Absent | texte seul | P2 |
| W-049 | Recherche par style de paragraphe, dans la sélection seule | oui | Absent | `find.ts` | P2 |
| W-050 | Recherche par similitude, « Tout rechercher » avec sélection multiple | non (UNIQUE) | Absent | - | P3 |
| W-051 | Atteindre un objet par type (note, signet, tableau, image, champ, commentaire) | oui | Partiel | Atteindre par page ; signets via dialogue | P2 |
| W-052 | Codes spéciaux de recherche (\n, \t, classes POSIX) | oui (^p) | Partiel | `^t ^s ^&` ; syntaxe regex JS | P3 |
| W-053 | Suivi des modifications : enregistrer, protéger par mot de passe, gérer (filtre auteur/date), accepter/refuser | oui | Partiel | suivi, accepter/refuser OK (`track.ts`) ; protection du suivi par mot de passe et liste filtrable absentes | P1 |
| W-054 | Comparer / Fusionner le document | oui | Partiel | `compare.ts` (comparer) ; fusion de révisions de plusieurs auteurs absente | P2 |
| W-055 | Commentaires : répondre, résoudre, supprimer (tous/auteur) | oui | OK | volet Commentaires, fils | P1 |
| W-056 | Liens vers fichiers externes (mise à jour, rupture) | oui (Liens) | Absent | aucune liaison | P3 |
| W-057 | Hyperlien : boîte à 4 onglets (Internet, Courriel, Document, Nouveau document) | oui | Partiel | `LinkDialog` : adresse, emplacement, info-bulle | P2 |
| W-058 | Carte d'image (zones cliquables) | non (UNIQUE) | Absent | - | P3 |
| W-059 | Propriétés de l'objet/image/cadre (dialogue à onglets Position, Habillage, Bordures, Zone, Hyperlien) | oui | Partiel | onglet Format de l'image (taille, habillage, alt) ; pas de position absolue ni de dialogue complet | P1 |
| W-060 | Texte automatique (AutoText, F3) | oui (Blocs de construction) | Absent | aucune UI (docx a les modèles de blocs en lecture) | P2 |
| W-061 | Insérer un paragraphe avant/après un objet ou tableau (Ctrl+Alt+Entrée) | non | Absent | - | P3 |
| W-062 | Changer la casse (5 modes + demi/pleine chasse, kana) | oui | Partiel | 5 modes OK (`changeCase`) ; modes asiatiques absents | P1 |
| W-063 | Notes : modifier, convertir bas de page <-> fin | oui | Partiel | insertion OK ; conversion absente | P2 |
| W-064 | Champs : modifier, mettre à jour (F9), verrouiller | oui | Partiel | `updateFields`, `editField` ; verrouillage absent | P2 |
| W-065 | Échanger la base de données (changer la source d'un champ) | non (UNIQUE) | Absent | pas de sources de données | P3 |
| W-066 | Sélectionner mot/phrase/paragraphe/bloc | oui | Partiel | mot, paragraphe, tout (menu contextuel) ; phrase absente | P3 |

### 1.3 Menu Affichage, barre latérale, Navigateur

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-070 | Disposition d'impression | oui | OK | `views.print` | P1 |
| W-071 | Disposition Web | oui | OK | `views.web` | P2 |
| W-072 | Mode Plan (non natif dans Writer : Navigateur) | oui | OK | mode Plan complet | P2 |
| W-073 | Barres d'outils : afficher, personnaliser, ancrer | oui (ruban) | Partiel | ruban figé, mini-barre, pas de personnalisation | P3 |
| W-074 | Barre d'état (mots, page, langue, zoom, Insertion/Refrappe, signature, modification) | oui | Partiel | page, mots, langue, suivi OK ; Insertion/Refrappe absent | P2 |
| W-075 | Barre latérale : onglets Propriétés, Styles, Galerie, Navigateur, Gestionnaire d'images | Word : volets | Partiel | volets Commentaires, Notes, Styles, Statistiques, Navigation ; pas de panneau Propriétés contextuel ni Galerie | P1 |
| W-076 | Navigateur (F5) : listes par type d'objet (titres, tableaux, cadres, images, OLE, sections, hyperliens, renvois, index, signets, commentaires, notes) avec aller-à | Word : Volet Navigation (titres/pages/résultats) | Partiel | `navTitle` : Titres, Pages, Résultats ; pas de liste par type | P1 |
| W-077 | Navigateur : monter/descendre un chapitre, promouvoir/abaisser avec sous-niveaux, glisser-déposer | oui (volet Navigation) | Partiel | promouvoir/abaisser du mode Plan ; pas monter/descendre | P2 |
| W-078 | Navigateur : champ « numéro de page », mode liste Contenu / Aperçu, ancrage au clavier | non (UNIQUE) | Partiel | numéro de page via Atteindre | P3 |
| W-079 | Galerie (puces, flèches, arrière-plans, formes, thème utilisateur) | non (UNIQUE) | Absent | pas de galerie partagée | P3 |
| W-080 | Marques de mise en forme (Ctrl+F10) | oui | OK | `showMarks` | P1 |
| W-081 | Paragraphes/texte masqués, noms de champs, ombrage des champs, limites du texte/tableaux/sections | oui | Partiel | texte masqué (marque `hidden`) ; ombrage et bascule nom/résultat de champ à vérifier | P2 |
| W-082 | Règles (horizontale et verticale) | oui | Partiel | règle horizontale (`Ruler.tsx`) ; verticale absente | P2 |
| W-083 | Plein écran / mode lecture | oui | OK | Focus et Lecture | P3 |
| W-084 | Zoom (largeur, page entière, optimal, multi-pages, variable) | oui | OK | zoom, une/plusieurs pages, largeur | P1 |
| W-085 | Grille, aides à l'alignement, magnétisme des objets | oui | Partiel | grille booléenne `grid` ; pas de magnétisme | P3 |
| W-086 | Source de données (F4) dans la fenêtre | non (UNIQUE) | Absent | voir Base | P3 |
| W-087 | Texte brut / fenêtre de formule inline, bascule Mode Formulaire | non | Absent | - | P3 |

### 1.4 Menu Insertion

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-090 | Saut de page / de colonne / de ligne / de section | oui | OK | `insertPageBreak`, `columnBreak`, 4 sections | P1 |
| W-091 | Saut de page avec changement de style de page et numéro de page | non (UNIQUE) | Absent | pas de styles de page | P1 |
| W-092 | Champs rapides : date, heure, numéro de page, nombre de pages, sujet, titre, auteur | oui | OK | `FieldDialog` (DATE, TIME, PAGE, NUMPAGES, AUTHOR, TITLE, FILENAME) | P1 |
| W-093 | Autre champ… (6 onglets : Document, Renvois, Fonctions, Info doc, Variables, Base de données) | Word : Champ | Partiel | 7 types de champ seulement | P1 |
| W-094 | Champs de fonction : champ conditionnel, texte masqué, paragraphe masqué, texte d'espace réservé, saisie, exécuter macro, combiner caractères | oui (IF, ASK, FILLIN) | Absent | codes non gérés par `act.insertField` | P2 |
| W-095 | Variables utilisateur (déclarer, définir, afficher), séquences, numéro de chapitre | oui (SET/REF/SEQ) | Partiel | SEQ pour légendes (`dialogs/page.tsx` l.143) ; variables utilisateur absentes | P2 |
| W-096 | Champs d'info document (créé, modifié, imprimé, éditeur, personnalisés, statistiques) | oui (DOCPROPERTY) | Partiel | AUTHOR, TITLE seulement | P2 |
| W-097 | Champs de base de données (nom, enregistrement suivant, numéro, champ de fusion) | oui (MERGEFIELD, NEXT) | Partiel | MERGEFIELD OK ; NEXT/SKIPIF absents | P2 |
| W-098 | Note de bas de page / de fin + dialogue de numérotation (format, début, caractère personnalisé) | oui | Partiel | insertion rapide OK ; dialogue de format absent | P1 |
| W-099 | Signet | oui | OK | `BookmarkDialog` | P1 |
| W-100 | Renvoi (type, contenu : texte, page, numéro, au-dessus/dessous) | oui | Partiel | `CrossRefDialog` : titres, signets, légendes ; options de contenu à vérifier | P1 |
| W-101 | Commentaire | oui | OK | volet | P1 |
| W-102 | Hyperlien (Ctrl+K) | oui | OK | `LinkDialog` | P1 |
| W-103 | Table des matières, index et bibliographie : dialogue à 5 onglets (Type, Entrées, Styles, Colonnes, Arrière-plan) | oui | Partiel | TDM automatique (`toc.ts`, 2 modèles) ; pas de dialogue Entrées/Styles/Colonnes/Arrière-plan | P1 |
| W-104 | Index alphabétique : entrée, 2e clé, clé phonétique, plage de pages, majuscules, entrée principale | oui (XE, INDEX) | Partiel | `IndexDialog` : entrée simple XE | P2 |
| W-105 | Index personnalisés : tables d'illustrations/tableaux/objets, index utilisateur, index de documents | oui (table des illustrations) | Partiel | table des illustrations par légende OK ; index d'objets et utilisateur absents | P2 |
| W-106 | Fichier de concordance (liste de mots à indexer automatiquement) | oui (AutoMark) | Absent | - | P3 |
| W-107 | Bibliographie (25 champs, types livre/article/thèse/web, base `Biblio`, styles `[1]`/auteur-année) | oui | Partiel | `CitationDialog` (auteur, titre, année, éditeur), `manageSources` ; un seul type, pas de styles APA/MLA | P2 |
| W-108 | Zone de texte | oui | Partiel | forme rectangle en ligne (`shape('rect')`), ni flottante ni chaînée | P1 |
| W-109 | Cadre (conteneur flottant avec style de cadre, ancrage page/paragraphe/caractère, colonnes) | non (UNIQUE) | Absent | pas de `framePr` dans docx ; images flottantes approximées (STATUS) | P2 |
| W-110 | Cadres chaînés (texte qui continue d'un cadre à l'autre) | oui (zones liées) | Absent | existe dans Publication (zones chaînées) ; pas dans Texte | P2 |
| W-111 | Image (fichier, Presse-papiers, scanner) | oui | OK | `insertImage` | P1 |
| W-112 | Image : lier au fichier, recadrage interactif, filtres (inverser, adoucir, contraste, solarisation, vieillissement, poster, pop art, fusain, mosaïque) | oui (recadrage, effets artistiques) | Partiel | taille/habillage/rotation/retourner OK ; rognage interactif absent (ROADMAP) ; filtres absents | P2 |
| W-113 | Multimédia (audio/vidéo incorporé) | oui | Absent | - | P3 |
| W-114 | Objet OLE (formule, graphique, objet externe), cadre flottant | oui | Partiel | objets OLE conservés ; insertion de nouveaux objets absente | P2 |
| W-115 | Graphique (assistant 4 étapes) | oui | Absent | aucun graphique dans Texte | P1 |
| W-116 | Formule (objet Math) | oui (Équation) | Partiel | `EquationDialog` forme linéaire + OMML conservé ; pas d'éditeur structuré (voir Math) | P1 |
| W-117 | Document maître (sous-documents, navigateur maître) | oui (documents maîtres) | Absent | - | P3 |
| W-118 | Texte à partir d'un fichier, section liée à un fichier | oui (Insérer un fichier) | Absent | - | P2 |
| W-119 | Section nommée (liée, masquée, protégée par mot de passe, conditions, colonnes, retraits, notes) | non (UNIQUE) | Partiel | sections de mise en page OK (`sections.ts`) ; liées/masquées/protégées absentes | P2 |
| W-120 | Ligne horizontale | oui | Absent | - | P3 |
| W-121 | Ligne de signature | oui | Absent | voir W-031 | P2 |
| W-122 | Caractère spécial (grille Unicode, hexadécimal, favoris, récents) | oui | OK | `SymbolDialog` | P1 |
| W-123 | Marques de formatage : espace insécable, tiret insécable, trait d'union conditionnel, séparateur facultatif, largeur nulle (ZWJ/ZWNJ/LRM/RLM) | oui | Partiel | symbole possible ; pas de raccourcis Ctrl+Maj+Espace ; utile pour typographie française | P1 |
| W-124 | Formes de dessin (bases, symboles, flèches, organigrammes, légendes, étoiles) | oui | Partiel | 4 formes (`shapeRect/Round/Ellipse/Line`) | P2 |
| W-125 | Fontwork (texte le long d'une courbe) | oui (WordArt) | Absent | WordArt dans Présentation ; pas dans Texte | P3 |
| W-126 | Contrôles de formulaire (zone de texte, case, liste, bouton, option, défilement) + mode Conception | oui (contrôles de contenu) | Partiel | contrôles de contenu (`sdt`) conservés ; insertion/édition absentes | P2 |
| W-127 | Date et heure | oui | OK | `DateDialog` | P1 |
| W-128 | En-tête / pied de page (par style de page, première page, pages paires) | oui | OK | `editHeaderFooter`, `diffFirst` | P1 |
| W-129 | Légende (Figure/Tableau/Dessin/Texte, étiquettes personnalisées, numérotation par chapitre) | oui | Partiel | `CaptionDialog` : Figure, Tableau, Équation ; étiquettes libres et chapitre à vérifier | P2 |
| W-130 | Page de garde | oui | Présent à vérifier | `insertCover` | P3 |
| W-131 | Insertion d'un objet depuis la Galerie, texte depuis fichier, signature, QR code | non (QR : UNIQUE) | Absent | - | P3 |

### 1.5 Menu Format et boîtes de dialogue Caractère / Paragraphe

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-140 | Gras, italique, souligné (13 styles), barré (simple/double/caractère), exposant, indice | oui | OK | `cmd.*`, `FontDialog` | P1 |
| W-141 | Surlignage, couleur de police, couleur de soulignement séparée, trait supérieur (overline) | oui (sauf surlignage/trait sup.) | Partiel | surbrillance, couleur de police OK ; overline et couleur de soulignement absents | P2 |
| W-142 | Effets de police : relief (gravé/en relief), contour, ombre, clignotement, masqué, petites capitales, majuscules, titrage | oui (sauf clignotement, relief) | Partiel | ombre, contour, masqué, petites capitales, majuscules OK (`cmd.*`) ; relief et clignotement absents | P3 |
| W-143 | Marque d'emphase (point/cercle/accent), position de la marque | non (UNIQUE, asiatique) | Absent | - | P3 |
| W-144 | Position : exposant/indice automatique avec hauteur relative et taille %, rotation 0/90/270, échelle de largeur %, espacement des caractères, crénage par paires | oui (espacement, échelle) | Partiel | espacement `characterSpacing` OK ; échelle ? ; rotation de caractères et exposant en % absents | P2 |
| W-145 | Mise en page asiatique (deux lignes, ruby/guide phonétique, alignement vertical) | oui (Word : Ruby) | Absent | grep ruby/eastAsian vide | P3 |
| W-146 | Arrière-plan de caractère, bordures de caractère | non (UNIQUE ; Word : trame/bordure) | Partiel | trame et bordures de paragraphe ; de caractère absentes | P3 |
| W-147 | Langue du texte (par caractère/paragraphe, ne pas vérifier) | oui | OK | `lang.ts`, ctx.languageParagraph | P1 |
| W-148 | Taille de police ±, effacer le formatage direct (Ctrl+M) | oui | OK | `grow`, `shrink`, `clearFormat` | P1 |
| W-149 | Cloner la mise en forme (pinceau) | oui | OK | `painter` | P1 |
| W-150 | Casse (voir W-062), demi-chasse/pleine chasse, kana | oui | Partiel | W-062 | P3 |
| W-151 | Alignement (gauche, centré, droite, justifié, dernière ligne), alignement du dernier saut | oui | Partiel | 4 alignements ; dernière ligne justifiée absente (STATUS) | P2 |
| W-152 | Interligne (simple, 1,15, 1,5, double, proportionnel, au moins, exact, fixe) | oui | OK | `ParagraphDialog` : multiple, exact, au moins | P1 |
| W-153 | Retraits (avant texte, après texte, première ligne, automatique) | oui | OK | dialogue + règle | P1 |
| W-154 | Espacement avant/après, ne pas ajouter d'espace entre paragraphes du même style | oui | OK | `contextual` | P1 |
| W-155 | Enchaînements : coupure de mots automatique, orphelines, veuves, ne pas scinder, conserver avec le suivant, saut de page/colonne avant/après avec style | oui | Partiel | veuves/orphelines, solidaires OK ; saut « avant avec style de page » absent ; coupure de mots : option de page | P1 |
| W-156 | Plan et liste (niveau hiérarchique, style de liste, numérotation de lignes dans le paragraphe, restart) | oui | OK | `outlineLevel`, `restartNumbering` | P1 |
| W-157 | Taquets de tabulation (dialogue : position, type gauche/droite/centre/décimal, caractère décimal, caractère de remplissage) | oui | Partiel | `tabstops.ts` ; rendu corps non assuré (STATUS : taquets personnalisés non rendus dans le corps) ; pas de dialogue de saisie | P1 |
| W-158 | Lettrine (nombre de lignes, caractères, distance, style de caractère) | oui | Absent | présent dans docx model-props mais pas dans word ; Publication a la lettrine | P2 |
| W-159 | Bordures de paragraphe (jeux, style, largeur, espacement, ombre, fusion avec le paragraphe voisin) | oui | Partiel | `borders` (trame, bordures) ; ombre/fusion absentes | P2 |
| W-160 | Zone de paragraphe : couleur, dégradé, bitmap, motif, hachures, transparence | Word : trame | Partiel | trame uniforme | P3 |
| W-161 | Condition de paragraphe (style conditionnel selon le contexte) | non (UNIQUE) | Absent | - | P3 |
| W-162 | Alignement sur la grille de lignes / registre de lignes (register-true) | non (UNIQUE) | Absent | - | P3 |
| W-163 | Écriture : sens du texte (gauche-droite, droite-gauche, vertical, hérité) | oui | Partiel | `bidi` dans css.ts/actions ; vertical dans cellules/images | P2 |
| W-164 | Puces et numérotation (dialogue 5 onglets : Puces, Type de numérotation, Plan, Image, Position, Personnaliser) | oui | Partiel | bibliothèques, multiniveaux (`lists.ts`) ; puces images et plan lié aux titres absents | P1 |
| W-165 | Numérotation des chapitres (Outils > Numérotation des chapitres, liée aux styles Titre n) | oui (liste multiniveau liée) | Partiel | liste multi-niveaux OK ; liaison automatique aux titres à vérifier | P1 |
| W-166 | Retrait de liste, déplacer l'entrée de liste vers le haut/bas (Ctrl+Alt+↑/↓) | non | Absent | - | P3 |
| W-167 | Style de page… (dialogue 10 onglets : Gestionnaire, Page, Arrière-plan, En-tête, Pied de page, Bordures, Colonnes, Notes, Grille de texte, Transparence) | non (UNIQUE ; Word : sections) | Absent | modèle docx = sections, pas de styles de page nommés ; `Section` a marges/colonnes/entêtes | P1 |
| W-168 | Page de titre… (assistant : convertit des pages en page de titre, numérotation séparée) | non (UNIQUE) | Absent | - | P2 |
| W-169 | Colonnes (nombre, largeurs inégales, espacement, ligne séparatrice, hauteur, appliquer à section) | oui | OK | `columnsPresets`, dialogue, `columnsLine` | P1 |
| W-170 | Sections (Format > Sections : modifier, retraits, protection) | non (UNIQUE) | Partiel | voir W-119 | P2 |
| W-171 | Ancre (à la page / paragraphe / caractère / comme caractère / au cadre) | oui | Partiel | image alignée ou flottante ; ancrage explicite absent | P2 |
| W-172 | Habillage (aucun, avant, après, parallèle, continu, optimal, contour, à travers, premier paragraphe, arrière-plan, distances) | oui | Partiel | 6 modes (`wrap*`) ; contour approximatif | P2 |
| W-173 | Aligner objets (gauche, centré, droite, haut, milieu, bas) ; organiser (avancer, reculer, devant/derrière le texte) ; grouper | oui | Partiel | alignement d'image simple ; groupes d'objets absents (pas d'objets de dessin dans Texte) | P2 |
| W-174 | Retourner (horizontal/vertical) ; pivoter | oui | Présent à vérifier | `flipH/flipV`, `rotateRight` | P2 |
| W-175 | Image/Cadre/Objet : Format > Propriétés (Position et taille F4, Ligne, Zone, Légende, Texte alt) | oui | Partiel | taille et alt ; position absolue absente | P1 |
| W-176 | Tableau : propriétés (voir 1.7) | oui | Partiel | voir 1.7 | P1 |
| W-177 | Texte : changer la direction de lecture de paragraphe (Ctrl+Maj+D/A) | oui | Partiel | `bidi` | P3 |
| W-178 | Autocorrection : options (remplacements, exceptions, guillemets typographiques, tirets, majuscules, URL, ordinaux 1er, fractions ½, listes automatiques, bordures automatiques) | oui (Correction automatique) | Absent | grep « autocorrect » vide ; important en français (espaces insécables avant ; : ! ?) | P1 |
| W-179 | Autocorrection : pendant la frappe (activer/désactiver) | oui | Absent | - | P1 |
| W-180 | Auto-saisie (complétion de mots), liste de mots | non (UNIQUE) | Absent | - | P3 |
| W-181 | Thésaurus (Ctrl+F7, dictionnaire de synonymes) | oui | Partiel | menu contextuel « Synonymes : aucun hors connexion » (`ctx.noSynonym`) | P2 |
| W-182 | Mise en forme du texte par défaut (Format > Texte par défaut) | non | Absent | - | P3 |

### 1.6 Menu Styles et styles de LibreOffice

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-190 | Panneau Styles (F11) : paragraphe, caractère, cadre, page, liste, tableau ; hiérarchique / par catégorie / utilisés / personnalisés | Word : volet Styles | Partiel | volet Styles (paragraphe et caractère) + galerie | P1 |
| W-191 | Appliquer un style (liste déroulante, Ctrl+1..9, mode Remplissage au seau) | oui | OK | `applyStyle`, `previewStyle` (aperçu au survol) | P1 |
| W-192 | Mode Remplissage (seau, appliquer un style au clic) | non (UNIQUE) | Absent | - | P3 |
| W-193 | Nouveau style à partir de la sélection | oui | OK | `StyleDialog` / `createStyle` | P1 |
| W-194 | Mettre à jour le style sélectionné / modifier le style (dialogue complet avec 15 onglets : Gestionnaire, Retraits, Bordures, Police…) | oui (Modifier le style) | Absent | seul « Créer un style » (`dialogs/page.tsx` l.233) ; aucun dialogue de modification | P1 |
| W-195 | Style suivant, basé sur, catégorie, raccourci clavier d'un style | oui | Absent | non éditables dans l'UI | P1 |
| W-196 | Styles de caractère | oui | Partiel | appliqués ; création limitée | P2 |
| W-197 | Styles de cadre (cadre, étiquette, objets graphiques, filigrane…) | non (UNIQUE) | Absent | pas de cadres | P2 |
| W-198 | Styles de page (voir W-167) : Standard, Première page, Page gauche/droite, Index, Enveloppe, HTML, Notes de fin | non (UNIQUE) | Absent | - | P1 |
| W-199 | Styles de liste (Numérotation 1..5, Puces, Liste n) | oui | Partiel | styles de liste intégrés par docx (numérotation) ; pas d'éditeur de styles de liste | P2 |
| W-200 | Styles de tableau (Default Table Style, autoformats nommés) | oui | OK | galeries + options de style de tableau | P1 |
| W-201 | Charger les styles depuis un modèle / un fichier (Styles > Charger) | non (UNIQUE ; Word : Organisateur) | Absent | - | P2 |
| W-202 | Modèle par défaut (Modèles > Définir comme défaut / Organiser les modèles) | oui | Absent | pas de gestionnaire | P2 |
| W-203 | Enregistrer comme modèle | oui | Partiel | .dotx/.dotm OK, ott absent | P2 |
| W-204 | Styles de titre 1-10, Corps de texte, Zone de citation, Liste, Légende, Index, En-tête, Notes… (styles de LibreOffice « Titre n », « Corps de texte », « Titre du document ») | oui (équivalents) | Partiel | correspondance des noms Word français (`style-names.ts`) ; noms LibreOffice propres (« Corps de texte », « Texte préformaté », « Zone de citation ») à mapper à l'import odt | P2 |
| W-205 | Alternatives de style : Mettre à jour d'après la sélection (Ctrl+Maj+F11) | oui | Absent | - | P1 |

### 1.7 Menu Tableau

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-210 | Insérer un tableau (dialogue : lignes, colonnes, en-tête, répéter, bordures, styles) | oui | OK | `TableDialog`, grille | P1 |
| W-211 | Dessiner un tableau (crayon, gomme) | oui | Absent | `drawTable` = « Convertir le texte en tableau » | P3 |
| W-212 | Supprimer tableau / lignes / colonnes | oui | OK | `deleteTable/Row/Col` | P1 |
| W-213 | Insérer lignes/colonnes avant/après, plusieurs à la fois | oui | OK | `insertAbove/...` | P1 |
| W-214 | Sélectionner (tableau, ligne, colonne, cellule) | oui | Partiel | tableau OK ; ligne/colonne par clic en marge à vérifier | P2 |
| W-215 | Fusionner / fractionner les cellules (dialogue : nombre, horizontal/vertical) | oui | OK | `mergeCells`, `splitCell` | P1 |
| W-216 | Fractionner le tableau (4 modes) / Fusionner les tableaux | oui | Absent | - | P2 |
| W-217 | Ajuster : largeur de colonne optimale, hauteur de ligne optimale, répartir en largeur égale, répartir hauteur | oui (Ajustement automatique) | Partiel | tableaux en largeur fixe ; répartition à vérifier | P2 |
| W-218 | Propriétés du tableau (dialogue 6 onglets : Tableau, Enchaînements, Colonnes, Bordures, Arrière-plan) | oui | Partiel | largeur, alignement, bordures, trame via ruban ; pas de dialogue ; « autoriser le tableau à se scinder » à vérifier | P1 |
| W-219 | Répéter les lignes d'en-tête | oui | OK | `headerRow` | P1 |
| W-220 | Autoriser la ligne à se scinder entre pages | oui | Présent à vérifier | `paginate.ts` (rangées de tableau) | P2 |
| W-221 | Reconnaissance des nombres (conversion texte -> nombre dans les cellules) + format de nombre | non (UNIQUE) | Absent | - | P2 |
| W-222 | Formule dans le tableau (=SOMME(<A1:A3>), fonctions, barre de formule du tableau) | oui (champ =) | Absent | aucune trace (grep « formule.*tableau » vide) | P1 |
| W-223 | Trier (jusqu'à 3 clés, numérique/alphanumérique, lignes/colonnes) | oui | OK | `sortTable`, `SortDialog` (test) | P2 |
| W-224 | Convertir texte <-> tableau (séparateur) | oui | OK | `drawTable`, `toText` | P2 |
| W-225 | Protéger/déprotéger les cellules | non (UNIQUE) | Absent | - | P3 |
| W-226 | Styles automatiques de tableau (AutoFormat : 15+ prédéfinis, créer le sien) | oui (Styles de tableau) | Partiel | galerie de styles de tableau Office ; création de style de tableau absente | P2 |
| W-227 | Bordures/Ombrage/Alignement vertical des cellules, retrait intérieur | oui | OK | `borders`, `alignTop/...` | P1 |
| W-228 | Légende du tableau, titre/description du tableau (accessibilité) | oui | Partiel | légende OK ; description alt de tableau absente | P3 |
| W-229 | Barre de tableau : sélection de cellule à l'aide du clavier (Alt + flèches) pour redimensionner | non (UNIQUE) | Absent | - | P3 |
| W-230 | Tableau imbriqué | oui | Présent à vérifier | docx lit les tableaux imbriqués (.doc : aplatis) | P2 |

### 1.8 Menu Outils, Fenêtre, Aide

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-240 | Orthographe (F7, dialogue avec suggestions, ajouter à un dictionnaire) | oui | Partiel | correcteur du système (attribut `spellcheck`), pas de dictionnaire propre ni de dialogue avec ajout | P1 |
| W-241 | Vérification automatique pendant la frappe | oui | Présent à vérifier | `spell` | P1 |
| W-242 | Grammaire (LanguageTool, règles Grammalecte pour le français) | oui | Absent | STATUS : pas de grammaire propre ; « grammaire » dans strings seulement | P1 |
| W-243 | Dictionnaires et langues (Outils > Langue, Options > Langues > Dictionnaires, dictionnaires utilisateur, dictionnaires d'extensions) | oui | Absent | dictionnaires du système seulement | P1 |
| W-244 | Coupure de mots (automatique, manuelle, zone, longueur minimale) | oui | Partiel | option de page `hyphenation`, pas de réglages | P2 |
| W-245 | Statistiques (mots, caractères, phrases, paragraphes, sélection) | oui | OK | `stats.ts` + Statistiques avancées | P1 |
| W-246 | Numérotation des lignes (par page, intervalle, séparateur, compter lignes vides) | oui | Partiel | continu / par page / aucun ; intervalle et séparateur à vérifier | P2 |
| W-247 | Notes de bas de page et de fin… (réglages : emplacement, numérotation, style de page, texte « suite », caractères avant/après) | oui | Absent | voir W-098 | P2 |
| W-248 | Mise à jour (champs, index, liens, tout) | oui | OK | `updateFields`, `updateToc` | P1 |
| W-249 | Base de données bibliographique | oui | Partiel | W-107 | P2 |
| W-250 | Publipostage : assistant (6-8 étapes : document de départ, type, adresse, salutation, mise en page, édition, personnaliser, enregistrer/envoyer) | oui (Assistant) | Partiel | `merge.ts` : CSV, champs, aperçu, fusion ; assistant, salutation et mise en page d'adresse absents | P1 |
| W-251 | Sources de données d'adresses (carnet d'adresses, ODS, CSV, MySQL, LDAP, Thunderbird) | oui (Excel, Outlook) | Partiel | CSV seul ; ODS/XLSX non (Publication lit XLSX via `merge-xlsx.ts`) | P1 |
| W-252 | Envoi du publipostage par courriel ; fichiers individuels ; impression | oui | Absent | fusion vers un seul document | P2 |
| W-253 | Trier (texte, jusqu'à 3 clés, locale) | oui | OK | `SortDialog` | P2 |
| W-254 | Calculer (barre de formule Writer, F2, = fonction, opérateurs mathématiques) | oui (champ =) | Absent | voir W-222 | P2 |
| W-255 | Macros : enregistrer, exécuter, organiser, édition Basic, Python, JavaScript, BeanShell ; sécurité des macros | oui (VBA) | Absent | décision : voir § 8.1 (Basic/Python non repris) | P3 |
| W-256 | Gestionnaire d'extensions (.oxt) | non (UNIQUE ; Word : compléments) | Absent | voir § 8.2 | P3 |
| W-257 | Personnaliser (menus, barres d'outils, clavier, événements) | oui | Absent | seules préférences de curseur/mini-barre | P3 |
| W-258 | Options (Chargement/enregistrement, Langues, Writer, Imprimante, Internet…) | oui | Partiel | Backstage > Options (auteur, curseur, récupération, thème) | P2 |
| W-259 | Protéger le document : marquer comme final, restreindre la modification, mot de passe | oui | Partiel | « Marquer comme final » (lecture seule) ; pas de mot de passe ni de zones modifiables | P1 |
| W-260 | Mode Conception de formulaire / Assistant de formulaire | non (UNIQUE) | Absent | - | P3 |
| W-261 | Rechercher dans le dictionnaire de synonymes / Traduire (Outils > Traduire avec DeepL) | oui (Traduire) | Absent | « Traduire (bientôt) » (`ctx.translateSoon`) | P3 |
| W-262 | Lecteur d'écran / accessibilité : vérificateur d'accessibilité (Outils > Vérification de l'accessibilité) | oui | Absent | rien dans word ; existe dans Présentation | P2 |
| W-263 | Fenêtre : nouvelle fenêtre, liste des fenêtres, fermer | oui | Partiel | `newWindow` | P3 |
| W-264 | Aide : aide en ligne F1, À propos, vérifier les mises à jour, obtenir de l'aide, envoyer un avis, informations de session | oui | Partiel | A propos / compte dans Backstage ; pas d'aide intégrée | P2 |
| W-265 | Rechercher dans l'aide / barre de recherche « Dites-moi » | oui | OK | champ Rechercher (Alt+Q) | P3 |

### 1.9 Barres d'outils, menus contextuels, formats

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| W-270 | Barre Standard (nouveau, ouvrir, PDF, impression, annuler, rechercher, orthographe, tableau, image, graphique, zone de texte, hyperlien, note, signet, saut, champ, caractère spécial, commentaire, suivi) | oui | Partiel | barre d'accès rapide (7) + ruban | P2 |
| W-271 | Barre Mise en forme (style, police, taille, B/I/U, couleurs, alignement, listes, retraits, interligne) | oui | OK | onglet Accueil, mini-barre | P1 |
| W-272 | Barre Tableau (insertion, fusion, bordures, trame, tri, somme, formule, propriétés) | oui | Partiel | onglets contextuels Création/Disposition ; pas de somme/formule | P2 |
| W-273 | Barre Image / Cadre / Dessin / Formulaire / Contrôles de formulaire / Navigation de formulaire / Suivi des modifications / Insertion / Mathématiques | oui | Partiel | Format de l'image, onglet Dessin (encre) ; pas de barre Dessin vectoriel, Formulaire | P2 |
| W-274 | Menu contextuel texte (couper, copier, coller, coller spécial, police, paragraphe, puces, style, liste, champ, hyperlien) | oui | OK | `ui/editorMenu.ts` | P1 |
| W-275 | Menu contextuel image/cadre/tableau/note/en-tête/section | oui | Partiel | image, tableau, note, en-tête, champ OK ; section et cadre absents | P2 |
| W-276 | Menu contextuel du Navigateur (renommer, supprimer, niveau) | non | Absent | - | P3 |
| W-277 | Barre de recherche (Rechercher dans la barre d'outils, Ctrl+F : suivant, précédent, tout, casse, mot entier) | oui | OK | volet de recherche | P1 |
| W-278 | Formats importés : .doc/.docx/.rtf/.html/.odt/.txt/.md | oui | OK | `docx/STATUS` | P1 |
| W-279 | Formats importés : .wpd, .wps, .sxw, .stw, .abw, .lwp, .pages, .hwp, .mcw | non (UNIQUE) | Absent | - | P3 |
| W-280 | Import .docx avec fidélité de mise en page (tableaux, sections, notes, suivi) | oui | OK | « Haute » ; Word 365 sans réparation | P1 |
| W-281 | Lecture/écriture des macros .docm sans les exécuter | oui | OK | docm conservé | P2 |
| W-282 | Mise en page « compatibilité » (options de rendu pour MS Word) | non (UNIQUE) | Absent | - | P3 |
| W-283 | Récupération automatique (enregistrement auto toutes les n minutes) | oui | OK | 30 s IndexedDB | P1 |
| W-284 | Verrouillage de fichier (.~lock) pour éviter la double ouverture | non (UNIQUE) | Absent | - | P3 |
| W-285 | Mode multi-fenêtres pour le même document | oui | Partiel | `newWindow` | P3 |

## 2. Calc (équivalent ForgeOffice : module Tableur, `packages/excel` + `xlsx` + `formulas`)

Même convention de colonnes. Moteur : 505 fonctions (STATUS formulas), grille 1 048 576 x 16 384, formats ODS lus/écrits.

### 2.1 Menu Fichier et formats

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-001 | Nouveau classeur, modèles, récents, enregistrer, enregistrer sous | oui | OK | Backstage (STATUS excel) | P1 |
| C-002 | Enregistrer en .ods | oui (Excel lit ODS) | OK | `xlsx/src/ods`, fidélité « correcte » | P1 |
| C-003 | Modèle .ots, ODF à plat .fods | non (UNIQUE) | Absent | `xlsx/src/formats.ts` : ni .ots ni .fods | P3 |
| C-004 | .xlsx/.xlsm/.xltx/.csv/.tsv | oui | OK | Backstage Enregistrer sous | P1 |
| C-005 | Lecture .xls (BIFF8) | oui | OK | `xlsx/src/xls` | P1 |
| C-006 | Écriture .xls | oui | Absent | non prévue (STATUS) | P3 |
| C-007 | Lecture .dif, .slk (SYLK), .wk1/.wks (Lotus 1-2-3), .wq1 (Quattro), .dbf, .123, .uos, .sxc/.stc, .xml Excel 2003 | non (UNIQUE sauf XML 2003) | Absent | `detectFormat` | P3 |
| C-008 | Import HTML (tables d'une page, `<table>`) | oui (Données web) | Partiel | collage HTML OK (`clipboard-ui.ts`) ; ouverture d'un fichier .html non déclarée | P3 |
| C-009 | Export HTML (feuilles multiples), export XHTML | oui | Absent | - | P3 |
| C-010 | Import/export CSV : dialogue complet (jeu de caractères, séparateurs multiples, délimiteur de texte, détection des nombres spéciaux, types de colonnes, ligne de départ, aperçu) | oui | Partiel | détection automatique (séparateur, encodage, dates) ; pas de dialogue d'import avec types par colonne ; export CSV avec option d'échappement | P1 |
| C-011 | Exporter en PDF (plages, feuilles, sélection, ajuster) | oui | Partiel | impression vers PDF ; Convertisseur natif | P1 |
| C-012 | Exporter en PDF/A, EPUB, XHTML | oui (PDF/A) | Partiel | voir W-020/W-022 | P2 |
| C-013 | Enregistrer avec mot de passe (xlsx/ods chiffrés) | oui | Absent | lecture xlsx chiffré OK (`opc/encrypted.ts`) ; écriture absente | P1 |
| C-014 | Signature numérique du classeur | oui | Absent | ROADMAP | P1 |
| C-015 | Propriétés (général, description, personnalisées, sécurité, statistiques) | oui | Partiel | Backstage Informations | P2 |
| C-016 | Aperçu avant impression (pages, mise à l'échelle) | oui | OK | `print.tsx` aperçu paginé | P1 |
| C-017 | Imprimer plages, titres, ordre de pages, zone d'impression | oui | OK | `printArea`, `printTitles` | P1 |
| C-018 | Enregistrer feuille par feuille en fichiers (Feuille > Enregistrer sous) | non (UNIQUE) | Absent | - | P3 |
| C-019 | Format de fichier ODF 1.3/1.4 étendu (extension, signature, formules OpenFormula) | non (UNIQUE) | Partiel | formules OpenFormula <-> Excel dans ods (STATUS xlsx) ; commentaires, validations, MFC en écriture ods absents | P2 |

### 2.2 Menu Édition et Affichage

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-020 | Annuler / rétablir / répéter | oui | Partiel | annuler/rétablir OK ; répéter (Ctrl+Maj+Y) absent | P2 |
| C-021 | Collage spécial (dialogue : sélection, opérations, sauter les cellules vides, transposer, lier, décaler les cellules, format) | oui | OK | `PasteSpecialDialog` : valeurs, formats, transposé, opérations, blancs ; « lier » à vérifier | P1 |
| C-022 | Coller seulement texte / nombres / dates / formules / commentaires / formats (menu) | oui | Partiel | valeurs, formules, formats ; sélecteurs par type de contenu absents | P2 |
| C-023 | Rechercher et remplacer (formules/valeurs/notes, regex, cellule entière, similitude, tout rechercher avec liste de résultats) | oui | Partiel | `FindDialog` (regex ?) ; liste « Rechercher tout » et similitude à vérifier | P1 |
| C-024 | Rechercher dans les formules ou dans les valeurs | oui | OK | options Dans (formules/valeurs) | P2 |
| C-025 | Supprimer le contenu / les cellules (dialogue : texte, nombres, dates, formules, notes, formats, objets) | oui | Partiel | Effacer : tout, formats, contenu, commentaires, liens ; pas de sélecteur combiné | P2 |
| C-026 | Supprimer les cellules (décaler haut/gauche, lignes/colonnes entières) | oui | OK | menu Supprimer | P1 |
| C-027 | Insérer cellules/lignes/colonnes (dialogue) | oui | OK | menu Insérer | P1 |
| C-028 | Remplir : bas, droite, haut, gauche, feuilles, série (dialogue : linéaire, croissant, date, auto, pas, valeur finale), nombres aléatoires | oui (sauf aléatoires) | Partiel | `SeriesDialog`, recopie ; remplir les feuilles et générateur de nombres aléatoires (distributions) absents | P2 |
| C-029 | Remplir : sélection manuelle de listes (listes de tri personnalisées par glisser) | non (UNIQUE) | Partiel | jours/mois français ; listes personnalisées éditables absentes | P2 |
| C-030 | Supprimer saut de page, Edition > Sélectionner tout, Cellules sélectionnées | oui | OK | - | P2 |
| C-031 | Mode de sélection (étendu, ajout) ; Sélectionner (Ctrl+clic discontinu) | oui | OK | `selection.ts` | P1 |
| C-032 | Atteindre (Zone Nom), Navigateur (F5) : feuilles, plages nommées, plages de base, zones de graphiques, images, objets OLE, commentaires, scénarios | Word : Navigation / Excel : Atteindre | Partiel | Zone Nom + « Atteindre » ; pas de Navigateur multi-types | P1 |
| C-033 | Suivi des modifications (enregistrer, accepter/refuser, fusionner les classeurs, comparer) | oui (révisions héritées) | Absent | commentaires seulement | P2 |
| C-034 | Protection : cellules, feuille, classeur, structure (mot de passe) | oui | OK | `ProtectDialog` (empreinte Excel 16 bits) | P1 |
| C-035 | Commentaires (insérer, afficher, masquer, notes) | oui | OK | commentaires fils, notes | P1 |
| C-036 | Normal / Aperçu des sauts de page | oui | OK | modes d'affichage | P1 |
| C-037 | Barre de formule, Zone Nom, Barre d'état personnalisable (somme, moyenne, nombre, sélection) | oui | OK | `StatusBar` | P1 |
| C-038 | En-têtes de ligne/colonne, quadrillage, valeur/formule, surligner les valeurs (couleur selon type : texte noir, nombres bleu, formules vert) | oui (Afficher les formules) | Partiel | formules oui ; surlignage coloré par type absent (UNIQUE) | P3 |
| C-039 | Figer lignes/colonnes, diviser la fenêtre | oui | Partiel | figer OK ; diviser la fenêtre à vérifier | P2 |
| C-040 | Zoom, plein écran, nouvelle fenêtre, fenêtres | oui | OK | - | P2 |
| C-041 | Barre latérale (Propriétés : caractère, alignement, nombre, apparence, cellule ; Styles ; Galerie ; Navigateur ; Fonctions) | non (UNIQUE) | Absent | pas de barre latérale de propriétés ; seul volet Champs du TCD, Commentaires | P2 |
| C-042 | Panneau Fonctions (liste des fonctions avec aide, double-clic pour insérer) | oui (bibliothèque) | Partiel | assistant Insérer une fonction + bibliothèque | P2 |
| C-043 | Sources de données (F4) | non (UNIQUE) | Absent | voir Base | P3 |

### 2.3 Menu Insertion

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-050 | Insérer une feuille (avant/après, nombre, nom) ; feuille à partir d'un fichier ; lien vers feuille externe | oui (sauf fichier) | Partiel | insérer OK ; « Feuille à partir d'un fichier » et liens absents | P2 |
| C-051 | Image, média (vidéo/son), objet OLE | oui | Partiel | images OK (Drawings.tsx) ; média absent | P2 |
| C-052 | Graphique (assistant 4 étapes : type, plage, séries, éléments) | oui | Partiel | 10 types SVG ; pas d'éditeur de séries ni titres d'axes (STATUS) | P1 |
| C-053 | Types de graphique LO : colonne, barre, secteur, aire, ligne, XY, bulle, filet (radar), cours/stock, colonne et ligne, réseau, 3D, cône/cylindre/pyramide | oui (sauf cônes) | Partiel | radar, bulles rendus en nuage (STATUS) ; 3D, bourse, surface absents | P2 |
| C-054 | Graphique : lignes de tendance (6 types), barres d'erreur, courbe de moyenne, axe secondaire, échelle logarithmique | oui | Partiel | trendline/errBars lus dans xlsx model ; édition dans l'UI absente | P2 |
| C-055 | Graphique : éléments (titres, légende, étiquettes, grilles, axes) | oui | Partiel | titre, légende, étiquettes, quadrillage | P1 |
| C-056 | Tableau croisé dynamique (DataPilot) : créer, modifier, actualiser, supprimer | oui | OK | `pivot.ts`, volet de champs (STATUS excel, TCD relus par Excel) | P1 |
| C-057 | DataPilot : source = base de données externe, plage nommée, source interne | oui (modèle de données) | Partiel | plage ou tableau ; source externe absente | P3 |
| C-058 | Graphique croisé dynamique (Pivot chart) | oui | Absent | - | P2 |
| C-059 | Forme, zone de texte, ligne, légende, symbole (barre Dessin) | oui | Partiel | formes de base (`Drawings.tsx`) ; connecteurs/groupes absents | P2 |
| C-060 | Fontwork | oui (WordArt) | Absent | - | P3 |
| C-061 | Contrôles de formulaire (bouton, case, bouton radio, liste, zone de liste déroulante, toupie, barre de défilement, étiquette, champ de date/heure/numérique/monétaire/formaté/masque) + mode Conception | oui (contrôles de formulaire) | Absent | grep formControl vide | P2 |
| C-062 | Cellules liées aux contrôles (source de cellule) | oui | Absent | dépend de C-061 | P2 |
| C-063 | Caractère spécial, symbole | oui | OK | `SymbolDialog` | P2 |
| C-064 | Hyperlien (cellule/texte), lien interne, mailto | oui | OK | `LinkDialog` (javascript: refusé) | P1 |
| C-065 | Commentaire / note | oui | OK | - | P1 |
| C-066 | Noms : définir, gérer, créer à partir de la sélection, coller (F3) | oui | OK | `NamesDialog` | P1 |
| C-067 | Noms : coller la liste (liste de noms dans la feuille) | oui | Absent | - | P3 |
| C-068 | Saut de page horizontal/vertical, supprimer | oui | OK | `insertBreak` | P2 |
| C-069 | Fonction (assistant 2 onglets : Fonctions, Structure) | oui | OK | `FnWizardDialog` | P1 |
| C-070 | Liste de fonctions (insertion avec l'aide) ; fonctions récentes | oui | OK | `recentFns` | P2 |
| C-071 | Cellules insérées avec décalage ; insérer des colonnes/lignes en nombre | oui | OK | - | P1 |
| C-072 | QR code, formule Math (objet), objets de dessin 3D | non (UNIQUE) | Absent | - | P3 |
| C-073 | Sparklines (lignes, colonnes, gain/perte) | oui | OK | `SparklineDialog` | P2 |
| C-074 | Segments (slicers), chronologie | oui | Absent | slicers lus dans xlsx (read-sheet.ts) mais non éditables | P2 |

### 2.4 Menu Format, Styles, Feuille

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-080 | Cellules… (dialogue 7 onglets : Nombres, Police, Effets de caractère, Alignement, Asian typography, Bordure, Arrière-plan, Protection de cellule) | oui (6 onglets) | OK | `FormatCellsDialog` | P1 |
| C-081 | Code de format de nombre personnalisé (éditeur, aperçu, conditions [>100], couleurs [ROUGE], langues, formats d'heure/devises) | oui | Partiel | affichage et saisie (`numfmt.ts`) OK ; éditeur de format personnalisé et gestion des formats de devise à vérifier (`strings.formats.more`) | P1 |
| C-082 | Alignement : renvoi, réduire pour ajuster, orientation (angle libre), fusionner, retrait, direction du texte, justifié distribué | oui | OK | home ribbon | P1 |
| C-083 | Fusionner et dissocier cellules | oui | OK | 4 modes | P1 |
| C-084 | Format du texte : police, taille, gras…, couleur | oui | OK | - | P1 |
| C-085 | Réduire/Augmenter la taille, majuscules/minuscules (Format > Texte > Casse) | non (UNIQUE ; Excel : fonctions) | Absent | pas de commande de casse sur cellules | P3 |
| C-086 | Mise en forme conditionnelle : condition, échelle de couleurs 2/3, barre de données, jeux d'icônes, date, gestion | oui | OK | `condfmt.ts`, 14 jeux d'icônes, gestionnaire | P1 |
| C-087 | MFC : « Style de cellule appliqué » (une MFC = un style de cellule) | non (UNIQUE) | Partiel | MFC avec format direct (dxf) ; liaison à un style nommé absente | P3 |
| C-088 | Styles de cellule (panneau F11, créer, modifier avec le même dialogue, hériter, 30+ styles intégrés : Bon, Mauvais, Neutre, Titre n, Accent n, Note, Erreur…) | oui (galerie) | Partiel | galerie Excel (`csNames`) ; héritage, panneau et modification de style absents | P1 |
| C-089 | Styles de page (en-tête/pied, marges, ordre des pages, échelle, zone d'impression, répétition de lignes) | non (UNIQUE) | Absent | mise en page par feuille à la place d'un style partagé | P2 |
| C-090 | Mise en page (dialogue : Page, Bordures, Arrière-plan, En-tête, Pied de page, Feuille ; ordre haut-bas, échelle % / largeur x hauteur / nombre de pages, répéter lignes/colonnes, grille, formules) | oui | Partiel | orientation, papier, marges, échelle, ajuster, quadrillage, titres ; en-têtes/pieds personnalisés absents (grep headerFooter vide dans ui) | P1 |
| C-091 | Zones d'impression (définir, ajouter, effacer) ; répéter | oui | Partiel | définir, effacer ; « ajouter » absent | P2 |
| C-092 | Hauteur de ligne / largeur de colonne (valeur, optimale, par défaut, masquer/afficher) | oui | OK | `SizeDialog` | P1 |
| C-093 | Ligne/colonne : insérer, supprimer, masquer | oui | OK | - | P1 |
| C-094 | Feuille > Renommer, déplacer/copier (dialogue : document cible, position, nom), supprimer, afficher/masquer, couleur d'onglet | oui | OK | menu des onglets | P1 |
| C-095 | Feuille > Insérer une feuille à partir d'un fichier | non (UNIQUE) | Absent | - | P3 |
| C-096 | Feuille > Lien vers une plage externe (HTML, CSV, XLS, ODS ; mises à jour périodiques) | oui (Données externes) | Absent | grep externalLink vide dans excel | P2 |
| C-097 | Feuille > Gérer les plages nommées | oui | OK | - | P1 |
| C-098 | Feuille > Insérer saut de page, sauts manuels | oui | OK | - | P2 |
| C-099 | Feuille > Cellule, Ligne, Colonne : sélection / masquage (Format > Colonnes > Masquer) | oui | OK | - | P1 |
| C-100 | Feuille > Direction de la feuille (gauche-droite/droite-gauche) | non (UNIQUE ; Excel : feuille de droite à gauche) | Absent | - | P3 |
| C-101 | Feuille > Insérer des feuilles multiples en une fois | non | Partiel | une à la fois | P3 |
| C-102 | Format > Automatique (AutoFormat de plage : 9+ styles) | oui (Mettre sous forme de tableau) | Partiel | styles de tableau Excel (60) à la place | P3 |
| C-103 | Format > Taille optimale ligne/colonne, Largeur par défaut | oui | OK | `autoRow`, `autoCol` | P2 |
| C-104 | Format > Cadre/objet : Position et taille, rotation, ligne, zone, texte | oui | Partiel | déplacer/redimensionner ; dialogue Position et taille absent | P2 |

### 2.5 Menu Données

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-110 | Définir la plage (plages de base de données nommées, options : en-têtes, insérer/supprimer cellules, conserver formats, sans doublons) | Excel : Tableau / Zone nommée | Partiel | tableaux (`tables.ts`) couvrent l'usage ; plage de base de données nommée absente | P2 |
| C-111 | Sélectionner une plage de base de données | non (UNIQUE) | Absent | - | P3 |
| C-112 | Actualiser la plage (données externes ou internes) | oui | Partiel | TCD actualisable ; import externe absent | P2 |
| C-113 | Trier (dialogue : 3 clés, options, ordre de tri naturel, listes personnalisées, locale, direction, copier les résultats ailleurs) | oui | OK | `SortDialog` (multi-niveaux), `customList` (data.ts) | P1 |
| C-114 | Tri croissant/décroissant (barre) | oui | OK | - | P1 |
| C-115 | Listes de tri personnalisées (Outils > Options > Listes de tri : jours, mois, personnelles) | oui | Partiel | clé `customList` supportée par le tri ; éditeur de listes absent | P2 |
| C-116 | Filtre automatique (valeurs, couleurs, standard, 10 premiers, vide) | oui | OK | `FilterHost`, filtres numériques/textuels | P1 |
| C-117 | Filtre standard (dialogue : 4 conditions, opérateurs =, <, >, contient, commence par, expression régulière, sans doublons, copie des résultats ailleurs, sensible à la casse) | oui (Filtre avancé) | Partiel | filtres personnalisés dans le filtre automatique ; regex et copie vers ailleurs absents | P1 |
| C-118 | Filtre spécial / avancé (plage de critères) | oui | Absent | - | P2 |
| C-119 | Réinitialiser/Effacer le filtre | oui | OK | `clearFilter` | P1 |
| C-120 | Sous-totaux (3 groupes, fonction, résumé sous les données, saut de page, tri) | oui | OK | `SubtotalDialog` | P1 |
| C-121 | Table multi-opérations (MULTIPLE.OPERATIONS, ligne+colonne) | oui (Table de données) | Absent | fonction et dialogue absents | P2 |
| C-122 | Consolider (somme, moyenne, etc. de plusieurs plages ; lien aux données source) | oui | Absent | - | P2 |
| C-123 | Texte en colonnes (délimité, largeur fixe, aperçu, types) | oui | OK | `TextToColsDialog` | P1 |
| C-124 | Validité (critères : tout, nombre entier, décimal, date, heure, plage de cellules, liste, longueur de texte, personnalisé ; aide à la saisie ; alerte d'erreur Stop/Avertissement/Information/Macro) | oui | Partiel | `ValidationDialog` : liste, nombres, dates, longueur, personnalisé, message, refus ; alertes Avertissement/Information/Macro à vérifier | P1 |
| C-125 | Entourer les données non valides | oui | Absent | - | P3 |
| C-126 | Plan et groupe (grouper, dissocier, détails, masquer, automatique) | oui | Partiel | niveaux et masquage OK ; boutons +/− dans la marge absents (STATUS) | P2 |
| C-127 | Plan automatique, effacer le plan | oui | Partiel | `data.ts` | P3 |
| C-128 | Scénarios (créer, bordure, afficher, modifier ; gestionnaire) | oui (Gestionnaire de scénarios) | Absent | grep scénario vide dans excel (seul lu par xlsx) | P2 |
| C-129 | Valeur cible (Outils > Atteindre une valeur cible) | oui | Absent | - | P1 |
| C-130 | Solveur (linéaire, non linéaire : DEPS, SCO, Swarm) | oui (complément) | Absent | - | P2 |
| C-131 | Statistiques (Données > Statistiques : échantillon, statistiques descriptives, corrélation, covariance, loi exponentielle, ANOVA 1 et 2 facteurs, régression, test t/z/F/chi², analyse de Fourier, moyenne mobile, lissage exponentiel, rang et centile) | oui (Utilitaire d'analyse) | Absent | aucune UI d'outils statistiques ; fonctions sous-jacentes présentes (`regression.ts`, `distributions.ts`) | P2 |
| C-132 | Générateur de nombres aléatoires (distributions : uniforme, normale, binomiale, poisson, Bernoulli…) | oui (Utilitaire) | Absent | - | P3 |
| C-133 | XML Source / données de source XML | oui (Mappage XML) | Absent | - | P3 |
| C-134 | Données externes : Plage de lien, HTML, WebService, Base de données (MySQL, JDBC) | oui (Power Query) | Absent | importCsv seulement | P2 |
| C-135 | Supprimer les doublons | oui | OK | `RemoveDupDialog` | P1 |
| C-136 | Assistant Remplissage instantané | oui | OK | `flashFill` | P3 |
| C-137 | Convertir en plage / convertir en tableau | oui | OK | `tables.ts` | P2 |
| C-138 | Actualiser tout | oui | Partiel | TCD seul | P2 |
| C-139 | Prévision (feuille de prévision) | oui | Absent | PREVISION.ETS fonction OK, UI absente | P3 |

### 2.6 Menu Outils (Calc) et fonctions

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| C-150 | Orthographe, orthographe automatique, thésaurus | oui | Partiel | correcteur du système | P1 |
| C-151 | Audit : antécédents/dépendants, supprimer flèches, repérer l'erreur, entourer valeurs non valides, mode remplissage | oui | Partiel | antécédents/dépendants, évaluation pas à pas ; « repérer l'erreur » absent | P2 |
| C-152 | Afficher les formules (Ctrl+`) | oui | OK | `showFormulas` | P1 |
| C-153 | Recalcul : automatique, manuel, F9, Ctrl+Maj+F9 (recalcul dur), itérations | oui | OK | options de calcul, calcul itératif (formulas) | P1 |
| C-154 | Protéger feuille/classeur/cellules | oui | OK | - | P1 |
| C-155 | Auto-saisie (complétion du texte dans la colonne) | oui | Présent à vérifier | pas confirmée dans la grille (logic/formula-ui = complétion de fonctions) | P2 |
| C-156 | Contenu des cellules : recalculer, convertir en nombres/texte, formules <-> valeurs (Outils > Contenu des cellules) | non (UNIQUE) | Absent | - | P3 |
| C-157 | Options Calc (général, vue, calcul : séparateurs, précision affichée, itérations, tolérance, mode de recherche, mise en forme) | oui | Partiel | calcul auto/manuel seulement | P2 |
| C-158 | Macros (Basic/Python/…), boutons liés, événements de cellule | oui (VBA) | Absent | décision § 8.1 | P3 |
| C-159 | Partager le classeur (édition simultanée) | oui | Absent | collaboration absente (ROADMAP) | P3 |
| C-160 | Mode compatibilité : fonctions Excel 2003 / syntaxe ODFF / références R1C1 / A1 (option de syntaxe) | oui (R1C1) | Présent à vérifier | syntaxe canonique Excel + française ; référence R1C1 : à vérifier | P2 |
| C-161 | Sélection de la syntaxe des formules : Calc A1, Excel A1, Excel R1C1 | oui | Partiel | Excel A1 (FR/EN) | P3 |
| C-162 | Séparateurs de fonctions et matrices personnalisables (`;` `,` `.`) | oui | Partiel | noms français et `;`, pas d'option | P3 |
| C-163 | Éditeur de formules en ligne (Ctrl+F2), complétion des fonctions, aide par info-bulle | oui | OK | `fn-help.ts`, `FormulaInput` | P1 |
| C-164 | Formules matricielles (Ctrl+Maj+Entrée, bloc matriciel entre accolades) | oui | OK | matricielles dynamiques (débordement), anciennes CSE lues | P1 |
| C-165 | Fonctions LibreOffice absentes d'Excel : EASTERSUNDAY (Pâques), MULTIPLE.OPERATIONS, STYLE, CURRENT, RAWSUBTOTAL, DDE, ISFORMULA/FORMULA, *_ADD (CONVERT_ADD, GCD_ADD, LCM_ADD, WEEKNUM_ADD, WEEKS/MONTHS/YEARS), FOURIER, COM.MICROSOFT.* | non (UNIQUE) | Absent | absentes du registre `formulas/src/functions` (hors ISFORMULA, présent) ; Pâques utile en agenda français | P2 |
| C-166 | Fonctions Excel exposées dans LO : 500+ (financières, stat., texte, matricielles) | oui | OK | 505 fonctions, 927 tests | P1 |
| C-167 | Fonction REGEX(texte; expression; remplacement; occurrence) de LO | non (Excel : REGEXTEST/EXTRACT/REPLACE) | Partiel | REGEXTEST/REGEXEXTRACT/REGEXREPLACE présents (`text.ts`) ; signature LO différente | P3 |
| C-168 | Fonctions de base de données (BDSOMME… D-fonctions) et de feuille (INFO, CELL) | oui | Présent à vérifier | `database.ts`, `cell-format.ts` | P2 |
| C-169 | Fonctions web : WEBSERVICE, FILTERXML, ENCODEURL | oui | Partiel | ENCODEURL OK ; WEBSERVICE/FILTERXML refus volontaire (#NOM?) | P3 |
| C-170 | Fonction GETPIVOTDATA | oui | Partiel | moteur OK (`pivot.ts`) mais l hôte (`host.pivotValue`) n est pas transmis par le Tableur (STATUS formulas) | P2 |
| C-171 | Tableaux de références 3D (Feuille1.A1:Feuille3.A1) | oui | OK | `shiftFormula` (STATUS) | P2 |
| C-172 | Plages nommées et expressions nommées, noms de feuille, noms de tableau | oui | OK | - | P1 |
| C-173 | Séries de dates (jours ouvrés, mois, années), fenêtre de 2 chiffres pour l'année | oui | OK | recopie de séries | P2 |
| C-174 | Colonnes de largeur optimale à l'ouverture, réduction à l'écran | oui | OK | - | P3 |
| C-175 | Contenu : images dans les cellules (IMAGE), sparklines | oui | Partiel | sparklines OK ; IMAGE refusée | P3 |
| C-176 | Menus contextuels : cellule (couper, copier, coller spécial, insérer, supprimer, effacer, format, commentaire, nommer, style), onglet de feuille, en-tête de ligne/colonne, graphique, objet | oui | OK | `Hosts.tsx`, menu des onglets | P1 |
| C-177 | Barres d'outils Calc (Standard, Mise en forme, Formule, Tri, Filtre, Dessin, Graphique…) | oui | Partiel | ruban à la place | P2 |
| C-178 | Navigateur : plages nommées avec glisser vers la cellule ; en-tête de feuille pour aller | non | Absent | - | P3 |
| C-179 | Compatibilité : « Convertir les nombres au format texte » à la saisie, détection du format de date locale | oui | OK | `parseInput` fr-FR/en-US | P2 |
| C-180 | Tolérance de précision (précision comme affichée), calcul avec dates du 30/12/1899 ou 1900/1904 | oui | OK | 1900/1904 (STATUS formulas) | P2 |

## 3. Impress (équivalent ForgeOffice : module Présentation, `packages/powerpoint` + `pptx`)

Éditeur : `packages/powerpoint/src/canvas` (187 formes, connecteurs accrochés, groupes, 50 tests), formats .pptx complet, .odp « basique++ » en lecture, « basique » en écriture.

### 3.1 Fichier, Édition, Affichage

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| I-001 | Nouveau, modèles, assistant de présentation (modèle de départ, style de diapo, transition) | oui | OK | Backstage Nouveau (vierge ou par thème) | P1 |
| I-002 | Enregistrer en .odp | oui | Partiel | `pptx/src/odp-write.ts` : texte, formes, chemins, images, tableaux (texte), notes ; ni graphiques, animations, transitions, masques personnalisés (STATUS pptx) | P1 |
| I-003 | Ouvrir .odp | oui | Partiel | lecture « basique++ » ; animations `presentation:anim-*` non lues | P1 |
| I-004 | Modèle .otp, ODF à plat .fodp, présentation .odg | non (UNIQUE) | Absent | `MODULES.powerpoint.extensions` | P3 |
| I-005 | .pptx/.pptm/.potx/.ppsx/.ppt (lecture) | oui | OK | STATUS pptx (16 fichiers rouverts par PowerPoint) | P1 |
| I-006 | Écriture .ppt | oui | Absent | converti en .pptx | P3 |
| I-007 | Import .key (Keynote), .sxi, .sti | non (UNIQUE) | Absent | - | P3 |
| I-008 | Export PDF (diapositives, notes, plan, documents, diapositives masquées, commentaires, signets, formulaires) | oui | Partiel | PDF rastérisé (JPEG par page, 2x) ; texte non sélectionnable (STATUS) | P1 |
| I-009 | Export PDF/A | oui | Absent | - | P2 |
| I-010 | Export HTML (assistant web : navigation, pages, frames), export web multi-pages | non (Office a retiré) | Absent | - | P3 |
| I-011 | Export en images (PNG, JPG, GIF, BMP, TIFF, SVG, EMF, WMF, WebP) pour la diapositive ou toutes | oui (PNG/JPG/SVG…) | Partiel | PNG, JPEG, diapositive courante (Backstage Exporter) | P2 |
| I-012 | Export vidéo (MP4) | oui | Absent | - | P3 |
| I-013 | Export Flash/SWF | non (retiré) | Absent | sans objet | P3 |
| I-014 | Enregistrer avec mot de passe (chiffrement) | oui | Absent | lecture pptx chiffré OK ; écriture absente | P1 |
| I-015 | Signature numérique | oui | Absent | ROADMAP | P2 |
| I-016 | Propriétés du document | oui | OK | Backstage Informations | P2 |
| I-017 | Imprimer (diapositives, documents 1/2/3/4/6/9 par page, notes, plan, ordre, cadre, date, nom de page, couleur/gris/noir et blanc) | oui | Partiel | diapositives, pages de commentaires, 3 ou 6 par page, plages ; 1/2/4/9 par page, plan, N&B absents | P1 |
| I-018 | Aperçu avant impression | oui | OK | « aperçu avant impression » (STATUS) | P2 |
| I-019 | Mode Normal (diapo + volet + notes), Plan, Notes, Trieuse, Documents (handout) | oui | Partiel | Normal, Plan, Trieuse, Page de commentaires (notes) OK ; mode Documents (handout) absent | P1 |
| I-020 | Masque des diapositives, masque des notes, masque du document | oui | Partiel | masque et dispositions OK ; masque des notes/documents absents | P1 |
| I-021 | Barre latérale Impress : Propriétés, Dispositions, Diapositives (miniatures), Masques, Animation, Transition, Styles, Galerie, Navigateur, Gestionnaire d'images | oui (volets) | Partiel | miniatures, volet Animation, dispositions, sections ; pas de volet Propriétés contextuel ni Galerie | P1 |
| I-022 | Navigateur (diapositives, objets nommés, aller à) | non (UNIQUE ; Office : volet miniatures) | Partiel | volet des miniatures + volet Sélection | P2 |
| I-023 | Règles, grille, repères d'alignement, magnétisme (lignes d'accrochage, bords de page, cadre d'objet, points d'objet) | oui | OK | règles, grille, repères déplaçables, repères intelligents | P1 |
| I-024 | Calques (calques de la mise en page, des contrôles, des lignes de cote) | non (UNIQUE ; Draw) | Absent | pas de calques | P2 |
| I-025 | Zoom, vue entière, 100 %, zoom variable | oui | OK | - | P1 |
| I-026 | Nuances de gris / noir et blanc (aperçu des couleurs) | oui | OK | « nuances de gris » (Affichage) | P3 |
| I-027 | Rechercher et remplacer (texte, polices, expressions régulières, similitude) | oui | Partiel | texte (`dialogs.tsx`) ; regex et polices non | P2 |
| I-028 | Annuler/rétablir | oui | OK | - | P1 |
| I-029 | Collage spécial, sélection d'objets par Tab, sélectionner tout | oui | OK | clipboard riche, Tab | P1 |
| I-030 | Dupliquer (Maj+F3 : copies, placement, rotation, couleurs, agrandissement) | non (UNIQUE) | Absent | seule Ctrl+D (duplication simple) | P2 |
| I-031 | Champs (date, heure, auteur, numéro, nom de fichier, nom de page) | oui | OK | en-tête/pied, champs | P1 |
| I-032 | Liens vers fichiers externes | oui | Absent | - | P3 |
| I-033 | Carte d'image (zones cliquables sur une image) | non (UNIQUE) | Absent | interaction sur formes complètes | P3 |
| I-034 | Hyperlien (page, diapo, document, URL) | oui | OK | Lien web ou diapositive | P1 |

### 3.2 Insertion, Format, Diapositive

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| I-040 | Nouvelle diapositive, dupliquer, masquer, diapositive depuis un plan | oui | OK | galerie de dispositions, masquer | P1 |
| I-041 | Dispositions (vide, titre, titre+contenu, 2 contenus, titre seul, centré, 4 contenus, 6, titre et 2 contenus + objet…) | oui | OK | 11 dispositions | P1 |
| I-042 | Insertion de diapositives depuis un fichier / développer-résumer la diapositive | oui (Réutiliser) | Absent | - | P2 |
| I-043 | Diaporama personnalisé (sous-ensemble ordonné) | oui | Absent | grep customShow vide | P2 |
| I-044 | Images, galerie, formes, texte, tableau, graphique, objets OLE, formule | oui | Partiel | images, formes, tableau, graphique ; OLE et équation (zone de texte) : voir I-047 | P1 |
| I-045 | Média (vidéo/audio) | oui | OK | vidéo et audio incorporés | P1 |
| I-046 | Fontwork (galerie de texte artistique) | oui (WordArt) | Partiel | 6 styles WordArt, pas de texte sur trajectoire | P2 |
| I-047 | Formule (Math) comme objet OLE | oui (Équation) | Partiel | `equation.ts` : saisie type LaTeX -> SVG (456 lignes) ; pas d'éditeur structuré (voir Math) | P1 |
| I-048 | Numéro de diapositive, date, en-têtes/pieds (dialogue) | oui | OK | `dialogs.tsx` | P1 |
| I-049 | Caractère spécial | oui | OK | symboles | P2 |
| I-050 | Album photo (assistant) | oui | Absent | grep « album » vide | P3 |
| I-051 | Contrôles de formulaire | non (UNIQUE) | Absent | - | P3 |
| I-052 | Ligne/flèche, rectangle, ellipse, polygone, courbe de Bézier, forme libre, connecteur | oui | OK | 187 formes, connecteurs, forme libre via encre | P1 |
| I-053 | Zone de texte (horizontale/verticale), texte dans une forme, ajuster | oui | OK | `canvas/text.ts` | P1 |
| I-054 | Format de caractère (dialogue complet), de paragraphe, puces et numérotation (images, symboles), tabulations | oui | Partiel | police, taille, effets, interligne, niveaux, puces ; dialogue de tabulations non confirmé | P1 |
| I-055 | Casse du texte, marque de langue | oui | OK | `changeCase` | P2 |
| I-056 | Style de diapositive : arrière-plan (unie, dégradé, bitmap, motif, hachures, transparence) | oui | Partiel | uni, dégradé, image ; motif/hachures absents (STATUS) | P2 |
| I-057 | Propriétés de la diapositive (format, orientation, arrière-plan, objets du masque) | oui | OK | taille, 13 formats | P1 |
| I-058 | Disposition de la diapositive (appliquer, rétablir) | oui | OK | - | P1 |
| I-059 | Styles de présentation (titre, plan 1-9, notes, fond, objets d'arrière-plan) et styles graphiques (ligne, remplissage, ombre, texte, cote, légende) éditables | non (UNIQUE) | Partiel | masque modifiable, thèmes ; styles graphiques nommés non réutilisables | P2 |
| I-060 | Organiser (premier plan, arrière-plan, avancer, reculer, devant/derrière l'objet) | oui | OK | `reorder` | P1 |
| I-061 | Aligner, distribuer, espacement égal | oui | OK | ops, `distributeShapes` | P1 |
| I-062 | Grouper, entrer dans un groupe, sortir, dissocier | oui | OK | `groupShapes`, clic enfant | P1 |
| I-063 | Combiner / fusionner / soustraire / intersecter des formes | oui (Fusionner les formes) | Absent | grep vide | P2 |
| I-064 | Connecteurs (types droit/standard/ligne/courbe, début/fin avec têtes) | oui | OK | `connectors.ts` | P1 |
| I-065 | Position et taille (F4 : position, taille, rotation, inclinaison, ancre) | oui | Partiel | taille et position via ruban/volet ; rotation OK ; inclinaison (cisaillement) absente | P1 |
| I-066 | Convertir en courbe / polygone / contour / 3D / bitmap / métafichier | non (UNIQUE) | Absent | - | P2 |
| I-067 | Rotation 3D, objets 3D (cube, sphère, tore, cylindre, cône, pyramide, coquille) | oui (rotation 3D) | Absent | « pas de 3D » (STATUS) | P3 |
| I-068 | Ombre, transparence, dégradés de transparence, flou, lueur, bords adoucis | oui | Partiel | ombre, réflexion, lueur, bords adoucis (Effets) ; dégradé de transparence à vérifier | P2 |
| I-069 | Ligne : style, largeur, tirets personnalisés, flèches (styles de têtes), coins, extrémités | oui | OK | contour : couleur, épaisseur, tirets, flèches | P1 |
| I-070 | Zone : couleur, dégradé (6 types), bitmap, motif, hachures | oui | Partiel | uni, dégradé, image ; motif et hachures absents (STATUS) | P2 |
| I-071 | Image : rogner, filtres (inverser, lisser, netteté, supprimer bruit, solarisation, vieillissement, poster, pop art, fusain, mosaïque, relief), mode (couleur, nuances, N&B, filigrane) | oui (corrections, effets artistiques) | Partiel | corrections, couleur, transparence, rognage dialogue (bg-remove.ts) ; filtres artistiques absents | P2 |
| I-072 | Image : suppression d'arrière-plan | oui | Présent à vérifier | `app/bg-remove.ts` existe mais le STATUS le liste encore comme absent | P2 |
| I-073 | Tableau (insertion, fusion, bordures, styles, propriétés) | oui | OK | barre Création/Disposition, 19 styles | P1 |
| I-074 | Graphique (type, séries, éléments, axes) | oui | Partiel | 10 types ; éditeur de séries limité | P1 |
| I-075 | Texte : sens vertical, colonnes, ajustement automatique (réduire/agrandir), marges internes, ancre | oui | OK | - | P1 |
| I-076 | Position texte/ligne de cote ; formes de cotation | non (UNIQUE ; Draw) | Absent | voir D-xxx | P2 |
| I-077 | Texte sur contour d'une forme (adapter à la forme) | non (UNIQUE) | Absent | - | P3 |

### 3.3 Diaporama, transitions, animations, notes

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| I-080 | Démarrer depuis le début / la diapo en cours (F5, Maj+F5) | oui | OK | `SlideShow.tsx` | P1 |
| I-081 | Paramètres du diaporama (type : plein écran/fenêtre, boucle, durée de pause, autre écran, pointeur visible, stylet, avancement manuel, en continu) | oui | Partiel | plein écran, mode présentateur ; mode fenêtre/kiosque/boucle à vérifier ; pas de choix d'écran | P1 |
| I-082 | Console du présentateur (diapo suivante, notes, minuterie, horloge) | oui | OK | `PresenterWindow.tsx` (même fenêtre) | P1 |
| I-083 | Console du présentateur sur un 2e écran (écrans multiples) | oui | Absent | pas de fenêtre « public » (STATUS) | P1 |
| I-084 | Télécommande (Bluetooth, Impress Remote Android/iOS) | non (UNIQUE) | Absent | grep « remote » vide | P3 |
| I-085 | Transitions (45+ ; durée, son, après n secondes, avant/après) | oui | OK | galerie de 26 + Morphose, aperçu | P1 |
| I-086 | Appliquer une transition à toutes les diapositives | oui | OK | - | P2 |
| I-087 | Animations d'objet : entrée, emphase, sortie, trajectoires (80+ effets) | oui | Partiel | 28 effets (STATUS) | P1 |
| I-088 | Animation personnalisée (volet : début, vitesse, répétition, retour, déclencheur) | oui | OK | volet Animation, déclencheurs | P1 |
| I-089 | Animation du texte (par paragraphe, mot, lettre) | oui | Absent | non cité | P2 |
| I-090 | Minutage des répétitions (Rehearse timings) | oui | Présent à vérifier | `RehearseBar.tsx` présent ; enregistrement/vérification du minutage « absent » selon STATUS ancien : à vérifier | P2 |
| I-091 | Interaction (action au clic/survol : aller à, lancer programme, jouer son, macro, fermer) | oui (Action) | Partiel | liens et actions (`App.tsx`) ; macro et programme absents | P2 |
| I-092 | Diapositive masquée | oui | OK | - | P1 |
| I-093 | Notes du présentateur (masque, impression) | oui | OK | volet de notes, pages de notes | P1 |
| I-094 | Stylet, surligneur, pointeur laser pendant le diaporama | oui | OK | Ctrl+P, Ctrl+I, Ctrl+L | P2 |
| I-095 | Diaporama en boucle automatique (kiosque) | oui | Présent à vérifier | avance automatique OK ; mode kiosque à vérifier | P2 |
| I-096 | Présentation en direct sur le Web (partage) | oui (Live) | Absent | - | P3 |
| I-097 | Sections de diapositives | oui | OK | - | P2 |
| I-098 | Concepteur | oui | OK | `designer.ts` | P3 |
| I-099 | Orthographe, thésaurus, langue | oui | Partiel | correcteur système | P1 |
| I-100 | Vérificateur d'accessibilité | oui | Présent à vérifier | Révision | P2 |
| I-101 | Macros (Basic/Python) et événements d'objets | oui (VBA) | Absent | décision § 8.1 | P3 |
| I-102 | Barres d'outils Impress (Dessin, Ligne et remplissage, Diapo, Mise en forme du texte, Image, Média, 3D) | oui | Partiel | ruban | P2 |
| I-103 | Menus contextuels (diapo, objet, texte, miniature, tableau, image) | oui | OK | miniatures et formes | P1 |
| I-104 | Formats : .odp, .otp, .pptx, .ppt, .pps, .key, .sxi, .fodp | oui | Partiel | voir I-002..I-007 | P1 |

## 4. Draw (dessin vectoriel et PAO légère) : aucun module ForgeOffice

Il n'existe pas de module de dessin. Le canevas `packages/powerpoint/src/canvas` fournit déjà le moteur (voir § 9). Statut « Partiel (canvas) » = le moteur le fait mais aucune application de dessin ne l'expose (page libre, calques, cotes...). Draw ouvre aussi des PDF (le module PDF couvre l'édition de texte, pas le vectoriel).

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| D-001 | Document de dessin multi-pages (taille de page par page, format jusqu'à 600 cm) | Visio (pages) | Partiel | `PageView`/`CanvasEditor` fonctionnent par page libre (Publication) ; pas d'application | P1 |
| D-002 | .odg / .otg / .fodg (ODF Dessin) lecture/écriture | Visio .vsdx | Absent | `odp-geometry.ts` lit les formes ODF Impress ; pas de documents .odg | P1 |
| D-003 | Import .svg / .svgz (formes et chemins éditables) | Visio, Word | Absent | SVG en image seulement | P1 |
| D-004 | Export .svg, .emf, .wmf, .eps, .png, .jpg, .gif, .bmp, .tiff, .webp, .pdf, .html | Visio (SVG, PDF, PNG) | Partiel | PNG/JPEG/PDF depuis Présentation ; SVG/EMF/EPS d'une page absents | P1 |
| D-005 | Import .vsd/.vsdx (Visio), .cdr (CorelDRAW), .ai, .eps, .pub, .wmf, .emf, .dxf | oui (.vsdx) | Partiel | EMF/WMF -> SVG lus (`metafile`) ; reste absent | P2 |
| D-006 | Import PDF modifiable (texte et vecteur éditable, une page par page) | non (UNIQUE) | Partiel | module PDF édite le texte (`Modifier le texte`) mais pas les tracés | P2 |
| D-007 | Lignes, flèches, rectangles, ellipses, arcs, secteurs, segments, polygones, courbes de Bézier, courbes à main levée, formes de base | oui | Partiel | 187 formes ECMA-376, `LINE_PRESETS` ; Bézier éditable point par point : non | P1 |
| D-008 | Édition des points (mode Points : déplacer, ajouter, supprimer, convertir lisse/symétrique/angle, fermer, scinder) | oui (Modifier les points) | Absent | poignées d'ajustement jaunes seulement ; `custom` non éditable | P1 |
| D-009 | Courbes de Bézier, polygone, forme libre en dessin (outils du clic-glisser) | oui (Forme libre) | Absent | encre seule (`createInk`) | P1 |
| D-010 | Combiner, fusionner, soustraire, intersecter des formes | oui | Absent | grep vide | P1 |
| D-011 | Fractionner, Rompre (décomposer en objets) | non (UNIQUE) | Absent | - | P2 |
| D-012 | Convertir en courbe / polygone / contour / bitmap / métafichier / 3D / rotation 3D | non (UNIQUE) | Absent | - | P2 |
| D-013 | Connecteurs (standard, droit, ligne, courbe) avec points de collage prédéfinis | oui | Partiel | `connectors.ts` : sites de connexion ; recalage des connecteurs reliés | P1 |
| D-014 | Points de collage personnalisés (placement, direction d'échappement, relatif/absolu) | non (UNIQUE) | Absent | seuls les sites de la géométrie | P2 |
| D-015 | Lignes de cote (cotation linéaire, unité, précision, texte automatique) | non (UNIQUE ; Visio : cotes) | Absent | - | P1 |
| D-016 | Calques (Disposition, Contrôles, Lignes de cotation) : création, verrouillage, visibilité, imprimabilité | oui (Visio : calques) | Absent | - | P1 |
| D-017 | Grille, magnétisme sur grille/repères/points/bordures/cadres, repères d'alignement | oui | Partiel | `options { grid, snapToGrid, smartGuides, guides }` | P1 |
| D-018 | Règles, unité (mm/cm/in/pt), échelle de dessin (1:50) | oui | Partiel | règles en cm ; pas d'échelle de dessin | P2 |
| D-019 | Position et taille, rotation, inclinaison, ancre | oui | Partiel | rotation/taille OK ; inclinaison absente | P1 |
| D-020 | Aligner, distribuer (largeur/hauteur égales, espacement), mettre à la même taille | oui | Partiel | `alignShapes`, `distributeShapes`, `matchSize` | P1 |
| D-021 | Disposer (avant/arrière, devant/derrière l'objet), grouper, entrer dans un groupe | oui | Partiel | `reorder`, `groupShapes` | P1 |
| D-022 | Renommer un objet, volet de sélection, descriptions alt | oui | Partiel | volet Sélection de Présentation | P2 |
| D-023 | Ligne (styles, largeur, tirets personnalisables, flèches 30+ extrémités, coins, extrémités) | oui | Partiel | couleur, épaisseur, tirets, flèches | P1 |
| D-024 | Zone (couleur, dégradé 6 types, bitmap, motif, hachures, transparence, transparence en dégradé) | oui | Partiel | uni, dégradé, image ; motif/hachures absents | P1 |
| D-025 | Ombre (couleur, flou, distance), flou, bords adoucis, lueur | oui | Partiel | `effectsCss` | P2 |
| D-026 | Texte dans les formes : ancre, ajuster, colonnes, mise en forme complète | oui | Partiel | `canvas/text.ts` | P1 |
| D-027 | Fontwork (texte sur courbe, 40 formes, extrusion) | oui (WordArt) | Absent | WordArt linéaire seul | P2 |
| D-028 | Texte sur un chemin / alignement des caractères le long d'une ligne | oui (Visio) | Absent | - | P3 |
| D-029 | Insérer un tableau, graphique, image, média, objet OLE, formule, contrôle de formulaire | oui | Partiel | tableaux, graphiques, images, médias dans le canvas ; formule en SVG | P2 |
| D-030 | Bibliothèque de formes : base, symboles, flèches blocs, organigramme, légendes, étoiles, bannières, cubes (UML, circuits, réseau via galerie/extension) | oui (Visio : gabarits) | Partiel | 187 formes préétablies ; pas de gabarits métier (organigramme riche, UML, réseau, électrique) | P1 |
| D-031 | Galerie (thèmes : arrière-plans, flèches, diagrammes, ordinateurs, réseaux, personnes, symboles) | non (UNIQUE) | Absent | icônes Fluent SVG (recherche) en Présentation | P2 |
| D-032 | Images : rogner, filtres, mode, transparence, mosaïque, ajuster au cadre | oui | Partiel | voir I-071 | P2 |
| D-033 | Duplicata (copies paramétrées : nombre, placement, rotation, agrandissement, couleurs début/fin) | non (UNIQUE) | Absent | - | P2 |
| D-034 | Cloner, effets (distorsion, coin, torsion, courbe) | non (UNIQUE) | Absent | - | P3 |
| D-035 | Objets 3D (cube, sphère, cylindre, cône, pyramide, tore, coque), éclairage, extrusion, profondeur | non (UNIQUE ; Visio 3D rare) | Absent | « pas de 3D » (STATUS) | P3 |
| D-036 | Styles graphiques (créer, modifier, hériter ; 50 intégrés : défaut, cote, texte, titre) | non (UNIQUE) | Absent | seulement styles rapides | P1 |
| D-037 | Pages maîtres de dessin (arrière-plan commun, champs) | oui (Visio : arrière-plans) | Partiel | Publication a des pages maîtres | P2 |
| D-038 | Couleurs : palettes (standard, web, HTML, CMJN, RVB), pipette, remplacement de couleur | oui | Partiel | palettes Office/thèmes ; pas de CMJN ni de pipette | P2 |
| D-039 | Mode CMJN / profils ICC / séparation (impression pro) | non (UNIQUE ; Publisher) | Absent | PDF imprimeur de Publication (TrimBox) sans CMJN | P3 |
| D-040 | Mise en page imprimée (brochure, mosaïque d'une grande page sur plusieurs feuilles, ajustement) | oui | Partiel | planches/imposition dans Publication | P2 |
| D-041 | Hyperliens dans le dessin, interactions, carte d'image | oui | Partiel | liens de formes en Présentation | P3 |
| D-042 | Barre de dessin, mode texte, loupe, panoramique | oui | Partiel | CanvasEditor : zoom, défilement | P2 |
| D-043 | Dessin d'organigrammes/diagrammes depuis du texte (SmartArt, diagrammes de flux automatiques) | oui (SmartArt/Visio) | Absent | SmartArt conservé, création absente (STATUS) | P2 |
| D-044 | Presse-papiers vectoriel (copier formes vers Writer/Calc/Impress) | oui | Partiel | copie riche interne Présentation uniquement | P2 |
| D-045 | Export de la sélection ou de la zone en image | oui | Partiel | PNG de diapo | P2 |
| D-046 | Récupération et enregistrement du document de dessin | oui | Absent | pas de module | P1 |

## 5. Math (éditeur de formules) : aucun module ForgeOffice

Math est un objet de formule (langage de commandes `a over b`, `sqrt`, `sum from…`) qui produit du MathML/StarMath, inséré dans Writer, Calc, Impress, Draw ou ouvert seul (.odf). ForgeOffice a une saisie linéaire avec rendu SVG pour Présentation et l'OMML conservé dans Texte.

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| M-001 | Fenêtre de commandes (éditeur texte du langage StarMath) | Word : mode linéaire | Partiel | saisie de type LaTeX réduit (`equation.ts` : fractions, exposants, racines, sommes, intégrales, grecques) | P1 |
| M-002 | Aperçu de l'équation en direct (zone de rendu) | oui | OK | rendu SVG avec mesure du texte (`EquationSvg`) | P1 |
| M-003 | Panneau « Éléments » (symboles : opérateurs unaires/binaires, relations, opérations d'ensembles, fonctions, opérateurs, attributs, crochets, formats, autres) | oui (Éléments de l'équation) | Absent | dialogue de Texte propose 5 équations prédéfinies ; pas de palette | P1 |
| M-004 | Fractions, exposants/indices, racines (n-ième), sommes/produits/intégrales à bornes, limites | oui | OK | `Node` frac/sqrt/script/bigop (`equation.ts`) | P1 |
| M-005 | Matrices, piles (`stack`), vecteurs colonne, déterminants, systèmes (`cases`) | oui | Absent | `equation.ts` : aucun noeud matrice/cases (types char, row, frac, sqrt, script, bigop, accent) | P1 |
| M-006 | Crochets mis à l'échelle (`left( … right)`), accolades, barres | oui | OK | `DELIMS` | P1 |
| M-007 | Attributs : accents (chapeau, tilde, barre, point, vecteur), couleur, gras, italique, taille, police | oui | Partiel | styles math/roman/bold/op ; accents à vérifier | P2 |
| M-008 | Opérateurs d'ensembles, logique, relations, flèches, symboles grecs et spéciaux | oui | OK | GREEK + SYMBOLS | P1 |
| M-009 | Alignement multi-lignes (`newline`, `alignl`, `#`) ; équations numérotées | oui | Absent | - | P2 |
| M-010 | Insertion d'une équation en ligne ou en mode affichage dans un texte | oui | Partiel | `display` dans le modèle Texte (OMML) | P1 |
| M-011 | Export/Import MathML, OMML <-> StarMath, LaTeX | oui (OMML, LaTeX) | Partiel | OMML conservé (Texte) ; linéarisation `equationText` ; LaTeX réduit | P1 |
| M-012 | Formules numérotées avec renvoi (légende « Équation ») | oui | OK | `equationLabel` (légendes) | P3 |
| M-013 | Document Math autonome (.odf), formule en OLE dans Calc/Draw | non (UNIQUE) | Absent | - | P3 |
| M-014 | Taille, polices de formule, marges, alignement (Format > Taille de police, Espacements, Alignement) | oui | Partiel | taille de police de l'équation | P2 |
| M-015 | Catalogue de symboles (Outils > Catalogue : ajouter des symboles) | non (UNIQUE) | Absent | - | P3 |
| M-016 | Reconnaissance d'équations dans l'ink / reconnaissance LaTeX au collage | oui (Ink to math) | Absent | - | P3 |

## 6. Base (équivalent ForgeOffice : module Base de données, `packages/access` + `crates/forge-base`)

Moteur SQLite (rusqlite), format `.fodb` (pas `.odb`). Les connexions externes (JDBC, ODBC, MySQL, PostgreSQL, Firebird, HSQLDB, dBASE, feuille de calcul) n'existent pas.

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| B-001 | Assistant de base de données (créer, ouvrir, se connecter) | oui | OK | Backstage : base vide, 4 modèles, ouvrir | P1 |
| B-002 | Format .odb (HSQLDB/Firebird embarqué, formulaires/états/requêtes dans l'archive ODF) | non (UNIQUE) | Absent | `fodb`/`sqlite`/`db` seulement ; `accdb`/`mdb` déclarés mais lecture non vérifiée | P1 |
| B-003 | Connexion MySQL, MariaDB, PostgreSQL, Oracle, JDBC, ODBC | oui (ODBC, liaison) | Absent | SQLite local uniquement | P2 |
| B-004 | Connexion à un classeur (.ods/.xlsx), un fichier dBASE (.dbf), texte CSV, carnet d'adresses | oui (Excel, CSV) | Partiel | import CSV/classeur (`exchange.ts`) ; source liée en lecture absente | P2 |
| B-005 | Bases enregistrées (Outils > Options > Bases de données : « Enregistrer comme source de données ») pour publipostage et listes | non (UNIQUE) | Absent | pas de registre de sources partagé avec Texte/Tableur | P1 |
| B-006 | Table : mode Création (champs, type, clé, propriétés Général/Liste de choix) | oui | OK | `TableDesign.tsx`, 13 types | P1 |
| B-007 | Assistant Table (modèles de tables Affaires/Perso) | oui (modèles) | Partiel | 4 modèles complets de base | P2 |
| B-008 | Feuille de données : tri, filtre, recherche, édition, ajout, suppression, totaux | oui | OK | `Datasheet.tsx` | P1 |
| B-009 | Index (dialogue Index de la table : unique, multi-colonnes) | oui | Partiel | Requis/Indexé sur champ ; index composés à vérifier | P2 |
| B-010 | Relations (diagramme, intégrité, cascades) | oui | OK | `Relations.tsx` | P1 |
| B-011 | Requêtes : mode Création (grille QBE), SQL, SQL natif direct, requête paramétrée, vues | oui | OK | `QueryDesign.tsx`, mode SQL, paramètres, 6 types | P1 |
| B-012 | Requête de vue enregistrée comme VIEW de la base | non (UNIQUE) | Présent à vérifier | requêtes enregistrées ; création de VIEW SQLite non confirmée | P3 |
| B-013 | Résultats de requête éditables | oui | Absent | lecture seule (STATUS) | P2 |
| B-014 | Formulaire : assistant (champs, sous-formulaire, disposition, style, nom) | oui | Partiel | 4 dispositions ; assistant pas à pas absent | P1 |
| B-015 | Formulaire : mode Création avec contrôles (zone de texte, case, liste, zone de liste déroulante, bouton, groupe d'options, champ date/heure/numérique/monétaire/masqué/formaté, étiquette, image, navigation) | oui | Partiel | contrôles de base déplaçables (`DesignCanvas.tsx`) ; pas de boutons de commande ni de listes liées | P1 |
| B-016 | Sous-formulaires (liaison maître-détail, onglets) | oui | Absent | « pas de sous-formulaires » (STATUS) | P1 |
| B-017 | Formulaire : filtres, tri, recherche, navigation d'enregistrements, validation | oui | Partiel | navigation, saisie ; filtres de formulaire à vérifier | P2 |
| B-018 | Boutons de commande avec actions (ouvrir un formulaire, macro) | oui | Absent | - | P2 |
| B-019 | Évènements de formulaire/contrôle (macro Basic) | oui (VBA) | Absent | décision § 8.1 | P3 |
| B-020 | États : assistant (regroupement, tri, totaux), Report Builder (sections, groupes, champs calculés) | oui | Partiel | aperçu paginé, un niveau de regroupement, totaux (`ReportView.tsx`) ; Report Builder, plusieurs niveaux absents | P1 |
| B-021 | États statiques/dynamiques en document Writer (rapport lié à une requête) | non (UNIQUE) | Absent | - | P3 |
| B-022 | Exporter états en PDF/HTML/CSV | oui | Partiel | CSV, HTML, impression | P2 |
| B-023 | Macros : action macro Base (nom, arguments, condition) | oui (macros Access) | OK | `MacroView.tsx`, transaction tout-ou-rien | P2 |
| B-024 | Code macro Basic/Python/JavaScript | oui (VBA) | Absent | décision § 8.1 | P3 |
| B-025 | Import de données (Ctrl+C depuis Calc, glisser un tableau Calc vers Base) | oui | Partiel | import classeur/CSV | P2 |
| B-026 | Utilisateurs et droits d'accès (Outils > Administration des utilisateurs) | oui (sécurité Access héritée) | Absent | base locale mono-utilisateur | P3 |
| B-027 | Outils > SQL…, Filtre, Orthographe, Compacter (VACUUM), Réparer | oui | OK | Backstage : compacter, intégrité | P2 |
| B-028 | Sauvegarde de la base / enregistrer sous | oui | OK | « sauvegarder », « enregistrer sous » | P1 |
| B-029 | Source de données pour publipostage Writer/Calc/Impress (glisser colonnes) | oui | Absent | voir B-005 | P1 |
| B-030 | Documentation de la base (rapport sur les tables, requêtes) | oui (Documenter) | OK | `ToolsViews.tsx` | P3 |
| B-031 | Analyseur de table (décomposer en tables liées) | oui | OK | analyse (`ToolsViews`) | P3 |
| B-032 | Navigateur de bases (volet gauche tables/requêtes/formulaires/états) | oui | OK | volet d'objets | P1 |
| B-033 | Mode Page / aperçu d'un formulaire sans données | oui | Partiel | mode Page affiche les noms de champs (STATUS) | P2 |
| B-034 | Menus contextuels des objets (ouvrir, modifier, renommer, copier, supprimer, aperçu, créer comme vue) | oui | OK | volet | P2 |
| B-035 | Relations de listes de choix (valeurs liées à une table) | oui | OK | Liste de choix dans propriétés | P1 |
| B-036 | Barres de tri/filtre de feuille de données (tri multi-critères, filtre par formulaire) | oui | Partiel | filtre par sélection / liste de valeurs ; filtre par formulaire absent | P2 |

## 7. Fonctions transversales (toute la suite LibreOffice)

| ID | Fonction LibreOffice | MS | Statut | Preuve ou manque | Prio |
|---|---|---|---|---|---|
| X-001 | Format natif ODF 1.3/1.4 (lecture/écriture par composant) | Office lit ODF | Partiel | .odt écrit, .ods écrit, .odp écrit « basique », .odg/.odf/.odb absents | P1 |
| X-002 | Documents ODF chiffrés (mot de passe, AES-256-GCM / Blowfish) et signés (XAdES) | oui (chiffrement OOXML) | Absent | seul `opc/encrypted.ts` (OOXML, lecture) | P1 |
| X-003 | Signature numérique de documents (X.509, ODF et OOXML) | oui | Absent | ROADMAP § 3 | P1 |
| X-004 | PDF/A et PDF/UA à l'export depuis chaque module | oui (PDF/A) | Partiel | Ghostscript côté `packages/pdf` ; pas d'export direct | P2 |
| X-005 | Export EPUB (Writer), XHTML | non (UNIQUE) | Partiel | Convertisseur natif | P2 |
| X-006 | Conversion en ligne de commande / par lots (`soffice --convert-to`) | non | OK | `packages/convert` par lots | P2 |
| X-007 | Modèles : gestionnaire (dossiers, définir par défaut, importer/exporter), modèles en ligne | oui | Partiel | écrans Nouveau par application ; pas de gestionnaire | P2 |
| X-008 | Galerie (thèmes d'images/objets, thèmes personnels) | non (UNIQUE) | Absent | - | P3 |
| X-009 | Barre latérale unifiée (Propriétés, Styles, Galerie, Navigateur, Gestionnaire d'images) | non (UNIQUE) | Partiel | volets propres à chaque module | P2 |
| X-010 | Navigateur de document (F5) dans chaque module | non (UNIQUE) | Partiel | Navigation (Texte), miniatures (Présentation) | P2 |
| X-011 | Styles : famille de styles par application, héritage, hérités du modèle | oui (Word) | Partiel | styles Word/Excel ; pas de modification de style (W-194) | P1 |
| X-012 | Correcteur orthographique Hunspell + dictionnaires par langue (installation d'extensions) | oui (correcteur) | Absent | correcteur du système uniquement | P1 |
| X-013 | Correcteur grammatical (LanguageTool, règles Grammalecte) | oui (Éditeur) | Absent | - | P1 |
| X-014 | Césure Hyphen (motifs TeX), thésaurus (MyThes) | oui (césure) | Absent | - | P2 |
| X-015 | Correction automatique (tables de remplacement, guillemets, tirets, espaces insécables, majuscules) | oui | Absent | voir W-178 | P1 |
| X-016 | Macros Basic (LibreOffice Basic), Python (UNO), JavaScript, BeanShell, Java | oui (VBA) | Absent | décision § 8.1 | P3 |
| X-017 | Enregistreur de macros | oui | Absent | décision § 8.1 | P3 |
| X-018 | Extensions .oxt (dictionnaires, modèles, galeries, barres d'outils, compléments UNO) | oui (compléments) | Absent | décision § 8.2 | P3 |
| X-019 | API UNO / pont avec d'autres langages | non (UNIQUE) | Absent | sans objet | P3 |
| X-020 | Protection : mot de passe d'ouverture, de modification, lecture seule recommandée, marquer comme final | oui | Partiel | marquer comme final (Texte) ; feuille/classeur protégés (Tableur) | P1 |
| X-021 | Vérificateur d'accessibilité (Outils) | oui | Partiel | Présentation seulement | P2 |
| X-022 | Récupération automatique et reprise après plantage | oui | OK | copie IndexedDB 30 s dans Texte, Tableur, Présentation, Publication | P1 |
| X-023 | Sauvegarde automatique de copies (dossier de sauvegarde, toujours créer une copie de sauvegarde) | oui | Partiel | récupération uniquement | P3 |
| X-024 | Verrou de fichier (anti-ouverture double) | non | Absent | - | P3 |
| X-025 | Interface : thèmes (clair/sombre/contraste), icônes (Colibre, Sifr…), barres personnalisables, variantes d'interface (Standard, Onglets, Compact) | oui | Partiel | thèmes clair/sombre/contraste, ruban unique | P2 |
| X-026 | Langues d'interface et d'aide (pack de langues) | oui | Absent | interface française d'abord (exigence), autres langues après | P3 |
| X-027 | Aide intégrée (hors ligne) et en ligne | oui | Absent | - | P2 |
| X-028 | Sources de données unifiées (carnets d'adresses, bases Base, feuilles Calc) pour publipostage | oui | Absent | CSV seul | P1 |
| X-029 | Publipostage Writer vers courriel, PDF individuels, impression directe | oui | Absent | - | P2 |
| X-030 | Gestion des polices : remplacement de police (Outils > Options > Polices), polices intégrées au document | oui | Absent | polices embarquées Carlito/Liberation/Selawik (DECISIONS) mais pas de table de remplacement | P2 |
| X-031 | Collaboration : édition partagée, commentaires, suivi, comparaison | oui | Partiel | commentaires et suivi (Texte) ; pas de co-édition | P3 |
| X-032 | Compatibilité : options de rendu MS Office (indentation des tabulations, espacement de tableaux, etc.) | non | Absent | - | P3 |
| X-033 | Intégration CMIS (SharePoint, Nextcloud, Google Drive) | non (UNIQUE) | Absent | « hors ligne » volontaire | P3 |
| X-034 | Ligne de commande (`--headless`, `--print-to`, `--convert-to`), fichiers `.desktop`, association de types MIME | non | Partiel | associations `npm run associations`, convertisseur | P3 |
| X-035 | Écran de démarrage (Start Center : récents, modèles, types de documents) | oui (Backstage) | OK | module `hub` | P1 |
| X-036 | Enregistrer en tant qu'image / copier comme image (SVG, PNG) | non | Partiel | selon module | P3 |
| X-037 | Mode Lecture seule (-view), kiosque | non | Absent | - | P3 |
| X-038 | Mots composés et typographie française (espaces fines insécables, guillemets « » automatiques) | oui | Absent | important pour l'utilisateur francophone | P1 |

## 8. Décisions documentées

### 8.1 Macros Basic et Python : décision

LibreOffice exécute LibreOffice Basic, Python (UNO), JavaScript et BeanShell. ForgeOffice conserve les macros VBA des fichiers OOXML sans jamais les exécuter (ARCHITECTURE § sécurité) ; le langage de script reste « à décider » (DECISIONS-A-PRENDRE). Recommandation pour la parité LibreOffice :

- **Ne pas exécuter** les macros Basic/Python des fichiers .odt/.ods/.odp/.odb (vecteur d'attaque majeur ; CSP stricte de la coquille ; pas d'`eval`). Les conserver telles quelles dans l'archive ODF à l'enregistrement (comme pour VBA).
- **Alternative sûre, à trancher par le propriétaire** : un seul langage de script maison (sous-ensemble JavaScript exécuté dans un Worker sans accès DOM ni réseau, API objet du modèle de document) pour les automatisations de Texte, Tableur, Présentation, Base. Cela couvre « Outils > Macros » sans UNO, sans Python embarqué.
- Pas de pont UNO ni d'interpréteur Basic (coût L, sécurité, aucun gain face à un JS borné).

### 8.2 Extensions (.oxt) et galerie

- Ne pas charger de code d'extension. Reprendre seulement les **extensions de données** : dictionnaires Hunspell (.dic/.aff), modèles, galeries d'images, listes de remplacement d'autocorrection. Un format de « paquet de ressources ForgeOffice » signé suffit (effort M).

## 9. MODULES À AJOUTER À LA SUITE

### 9.1 Module Dessin (équivalent Draw / Visio)

Avis : **oui, à ajouter**, après les P1 de parité Office. Raisons : le propriétaire exige la parité LibreOffice (Draw est l'un des 6 composants) ; ROADMAP § 3 liste déjà Visio comme absent ; le moteur est déjà à 70 % écrit (`packages/powerpoint/src/canvas` : 187 formes, rotation, groupes, connecteurs accrochés avec recalage, repères intelligents, grille, règles, encre, tableaux, graphiques, tests math/ops).

**Périmètre proposé (module « Dessin », couleur à choisir, extensions `.fodraw`, `.odg`, `.svg`, `.vsdx` en lecture) :**
1. Document multi-pages à taille libre par page (comme Publisher : une page = une diapositive du modèle `@forgeoffice/pptx`, paquet OPC + `draw.json`).
2. Édition des chemins : outil Plume (Bézier), mode Points (ajout/suppression/conversion lisse-angle), formes libres, polygones, arcs/secteurs/segments.
3. Opérations booléennes (union, soustraction, intersection, exclusion) et Fractionner/Rompre, Convertir en courbe/contour.
4. Calques (Disposition, Contrôles, Cotes + personnalisés) : visibilité, verrouillage, imprimable.
5. Cotes (lignes de cotation linéaires, angulaires, rayon) recalculées quand la forme bouge.
6. Gabarits de formes (organigramme étendu, UML, réseau, électrique, plan d'étage) en données JSON de compositions de formes et de sites de connexion personnalisés.
7. Import/export : SVG (import en chemins éditables, export propre), ODG (réutilise `odp-geometry.ts` / `odp-write.ts`), PNG/JPEG/PDF vectoriel (texte sélectionnable à faire une fois pour Présentation et Publication), EMF/WMF en lecture (déjà convertis en SVG par `opc`), VSDX en lecture (zip + XML via `@forgeoffice/opc`, étape ultérieure).
8. Styles graphiques nommés, duplication paramétrée (Maj+F3), cloner, alignement sur grille d'objets.
9. Hors périmètre initial : objets 3D, CMJN/ICC, import CorelDRAW/Illustrator, texte sur chemin (phase 2).

**Architecture :** nouveau paquet `packages/draw` (App + ruban + panneaux) ; aucun second moteur de rendu : `CanvasEditor`, `PageView`, `ops.ts`, `connectors.ts`, `geometry/` sont importés depuis `@forgeoffice/powerpoint/canvas` (même contrat que Publication). Ajouts dans `canvas/` : outil `pen` et éditeur de noeuds (`CanvasTool`), module `path-ops.ts` (aplatir les Bézier puis booléens sans DOM, testé) , champ `layer` porté par `draw.json` (id de forme -> calque) et filtré via `PageView.hidden` + `locked`, forme composée « cote » générée par `dimension.ts`. Modèle commun : `Shape` du paquet `pptx` (géométrie `custom` en EMU, voir note du STATUS powerpoint). Effort : **L** au total (lots indépendants M : noeuds+Bézier ; booléens ; calques+cotes ; import/export SVG/ODG ; gabarits S/M).

### 9.2 Module Formules (équivalent Math)

Avis : **oui, mais comme moteur partagé et éditeur de dialogue, pas comme application de plein droit au début.** Microsoft n'a pas d'application séparée (Équation est un objet de Word/PowerPoint/Excel). La valeur est dans l'éditeur structuré intégré à Texte, Tableur, Présentation et Dessin.

**Périmètre :**
1. Extraire `packages/powerpoint/src/app/equation.ts` (456 lignes : analyse linéaire, mise en page, SVG, mesure de texte injectable) dans un nouveau paquet sans DOM `packages/math`, importé par Présentation (migration sans régression) et Texte.
2. Compléter la grammaire : matrices, piles, systèmes (`cases`), crochets mis à l'échelle, accents supplémentaires, alignement multi-lignes, texte en roman, couleurs, tailles.
3. Convertisseurs : LaTeX réduit <-> arbre <-> OMML (Texte garde son OMML d'origine tant que l'utilisateur ne modifie pas), MathML (export), StarMath (import `.odf` Math et objets de formule d'un .odt).
4. UI : boîte « Équation » avec zone de commandes, palette d'éléments par catégories (fractions, scripts, radicaux, intégrales, grands opérateurs, crochets, fonctions, accents, opérateurs, matrices), aperçu en direct, catalogue de symboles.
5. Intégration : Texte (remplace `EquationDialog` ; l'OMML éditable), Présentation (existant), Tableur (objet image dans une feuille), Dessin (forme SVG).

**Architecture :** `packages/math` (parse/layout/svg/omml, tests node) + composant `EquationEditor` dans `@forgeoffice/ui` ou dans `math/src/ui` réutilisé par les dialogues. Effort : moteur + palette : **M** ; OMML aller-retour complet et StarMath : **M** de plus ; application autonome `.odf` (hub) : **S** une fois le reste fait. Total **M/L**.

### 9.3 Ordre recommandé

1. Math (moteur partagé) : le plus petit, comble un manque Office (éditeur d'équations, ROADMAP § 5).
2. Dessin : après les lots P1 « styles de page/cadres » et « import/export ODF » car il réutilise leurs fondations (ODG, calques).
