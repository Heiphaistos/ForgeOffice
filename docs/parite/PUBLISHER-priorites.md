# Plan d'implémentation : parité Publication / Publisher

Dérivé de `PUBLISHER.md` (357 entrées ; Publisher absent du PC : noms de commandes de mémoire, à confirmer). Écarts P1 : **57 absents + 2 partiels** ; **102 entrées P1 « À vérifier »**. Efforts : **S** < 1 jour, **M** 1 à 3 jours, **L** > 3 jours.

## 0. État au 2026-11-07

Livrés et prouvés : P1 (menus de page, de repère, de règle, de pages maîtres), P2 (boîte Format à onglets : couleurs et traits avec dégradé et motif, taille, disposition, zone de texte, image, texte de remplacement), P3 en partie (styles nommés persistants, basés sur, import ; boîtes Police et Paragraphe ; reste tabulations, césure, crénage OpenType), P4 en partie (PDF vectoriel du texte, Pack and Go ; reste incorporation des polices, PDF/X), P5 en partie (CMJN et tons directs dans le PDF imprimeur ; reste séparations, teintes), P6 (fichier texte, F5), P7 en partie (zone de travail hors page, envoi à la page voisine ; reste le glisser entre pages), P8 en partie (suite de page, rupture de lien ; reste contour d'habillage modifiable à la souris), P9 (bloc d'adresse, salutation, erreurs, catalogue, champ image par ZIP ; reste filtres et tri du carnet), P11 (Options, raccourcis, bibliothèque de blocs). Hors périmètre : P0 (preuves des lignes « À vérifier »), P10 (.pub).

## 1. Règle d'or : le moteur est commun avec Présentation

Publication affiche et édite ses pages avec `packages/powerpoint/src/canvas` (CanvasEditor, PageView, ops, text). Tout manque d'**objet** (menus contextuels, mini-barre, volet Format, modifier les points, fusion de formes, gestes de manipulation, règle avec retraits, tableau, tous les effets) se corrige **une seule fois** dans les lots de `POWERPOINT-priorites.md` : **L0, L1, L2, L3, L4, L5, L6, L7, L13** (marqués (C)). Les lots ci-dessous ne contiennent que ce qui est **propre à la publication** et vivent dans `packages/publisher`. Ne pas dupliquer un lot commun ici.

Dépendances à respecter : les lots P1 à P8 attendent L0 (registres de menus/mini-barre) et ne touchent ni `canvas/` ni `packages/powerpoint`.

## 2. Top 15 des écarts P1 propres à Publisher

| # | Écart | Réf `PUBLISHER.md` | Lot |
|---|---|---|---|
| 1 | Menus contextuels d'objet complets (zone de texte, image, forme, tableau, page, repères, pages maîtres) | §2 | commun L1 + P1 |
| 2 | Mini-barre flottante (texte, image, tableau) | §3 | commun L2 |
| 3 | Boîtes Format de la zone de texte / de l'image / de la forme (Couleurs et traits, Taille, Disposition, Image) | §4 | P2 |
| 4 | Typographie : boîte Police, Paragraphe, tabulations, césure, crénage, styles de texte nommés | §1.1, §4, §8 | P3 + commun L3 |
| 5 | PDF vectoriel (texte sélectionnable, polices incorporées) et Pack and Go | §6, §8 | P4 |
| 6 | Couleur d'imprimerie : CMJN, tons directs, teintes, séparations, aperçu composite | §8 | P5 |
| 7 | Insérer un fichier texte (Word/RTF), Atteindre la page (F5), éditeur de story | §1.2, §8 | P6 |
| 8 | Zone de travail hors page + déplacement d'objets entre pages d'une planche | §7, §9 | P7 |
| 9 | Habillage complet (toutes colonnes, plus de 2 objets, contour modifiable, ajusté non elliptique) | §8 | P8 |
| 10 | Tableau : styles, bordures, taille des cellules, menu (commun L7) | §1.1, §2.6 | commun L7 |
| 11 | Modifier les points, fusion de formes (commun L5) | §1.1 | commun L5 |
| 12 | Publipostage : champ image, bloc d'adresse, aperçu des erreurs, catalogue | §1.4, §8 | P9 |
| 13 | Lecture des fichiers Publisher .pub | §6 | P10 |
| 14 | Chaînage : flèche de rupture cliquable, « Suite page n » | §2.7 | P8 |
| 15 | Options Publication + raccourcis (F5, Ctrl+Maj+G/R, Ctrl+Maj+F/B, copier/coller la mise en forme, F7) | §4, §5 | commun L15 + P11 |

## 3. Lots propres à Publication

### P0 : preuve des « À vérifier » (L, lecture seule, en parallèle de tout)
Dossier : `packages/publisher/tests/e2e/`. Scénarios réels (Edge sans interface en CDP, comme STATUS) pour les 102 entrées P1 « À vérifier » : ruban Accueil/Insertion/Création de page, rognage interactif (`CropOverlay.tsx`, absent du STATUS), planche en vis-à-vis, colonnes, blocs de construction, fusion xlsx. Rapport `docs/parite/PREUVES-PUBLISHER.md`.

### P1 : menus de page, repères et pages maîtres (S à M)
Dossier : `packages/publisher/src/app/context/`. Menu de la page (Couper/Copier/Coller une page), de la page vide (Insérer une page, Zoom, Grille et repères, Format de la page), des repères (Supprimer, Verrouiller), de la règle (origine, unités), des pages maîtres (renommer, dupliquer, appliquer à toutes). S'appuie sur le registre de L0.

### P2 : boîtes Format (M à L)
Dossier : `packages/publisher/src/app/format-dialogs/` (`TextBoxFormat.tsx`, `PictureFormat.tsx`, `ShapeFormat.tsx`, onglets Couleurs et traits, Taille, Disposition, Image, Zone de texte, Texte de remplacement). Réutilise les composants du volet Format de L4 (remplissage, trait, effets) ; ajoute Disposition (position exacte par rapport au bord/centre de la page, habillage) et Taille (échelle, verrouiller le rapport).

### P3 : typographie propre à la composition (L)
Dossier : `packages/publisher/src/typo/` : styles de texte nommés et persistants (paragraphe + caractère, volet Styles), césure automatique française, crénage/approche, ligatures et fonctionnalités OpenType (via `font-feature-settings`), petites capitales, chiffres. Le moteur de coupe de lignes (`flow.ts`, `measure.ts`) doit mesurer avec les mêmes fonctionnalités que le rendu : tester sur les 13 compositions pour ne pas casser le chaînage. Dépend de L3 (boîtes Police/Paragraphe).

### P4 : export imprimeur et PDF vectoriel (L)
Dossier : `packages/publisher/src/export/`. Réutiliser `packages/powerpoint/src/pdf` (writer, polices, texte vectoriel) pour remplacer le PDF rastérisé (`app/export.ts`, `sheetsToPdf`) : texte sélectionnable, polices sous-ensemblées, TrimBox/BleedBox conservées, imposition (`imposition.ts`) inchangée. Pack and Go : dossier ou ZIP (PDF + .fopub + polices + images). Tests : `pdf-vector.test.ts` côté PowerPoint comme modèle.

### P5 : couleur d'imprimerie (L)
Dossier : `packages/publisher/src/color/`. Modèle de couleur étendu (RVB + CMJN + ton direct + teinte) dans `publication.json` (`model.ts`), sélecteur dans le ruban, conversion RVB-CMJN simple documentée, aperçu des séparations, PDF CMJN. Les fichiers .pptx exportés restent en RVB. À arbitrer avec le propriétaire (impression pro réelle ou usage bureautique ?) : voir `DECISIONS-A-PRENDRE.md`.

### P6 : texte entrant et navigation (M)
Dossier : `packages/publisher/src/text-import/` : « Insérer un fichier texte » (.txt, .rtf, .docx lu par `packages/docx`) qui pose le texte dans la zone sélectionnée avec confirmation de débordement vers les zones liées (autoflow), commande Atteindre la page (F5), vue « galée » de l'article (éditeur de story).

### P7 : zone de travail et planches (M)
Dossier : `packages/publisher/src/workspace/` : zone hors page (objets en réserve), glisser un objet d'une page à l'autre d'une planche en vis-à-vis, affichage épreuve, caractères non imprimables. Touche `app/Stage.tsx` (351 lignes) : le scinder en `Stage.tsx` + `workspace/Pasteboard.tsx`.

### P8 : habillage et chaînage (M à L)
Fichiers : `wrap.ts` (188 lignes), `chain.ts`, `flow.ts` (311 lignes). Habillage sur toutes les colonnes, plus de 2 objets, contour « ajusté » réel (contour de l'image, pas seulement l'ellipse), contour modifiable à la souris ; chaînage avec flèche de rupture cliquable et texte « Suite page n » / « Suite de la page n » automatique. Tests : `wrap.test.ts`, `flow.test.ts` à étendre.

### P9 : publipostage étendu (M)
Dossier : `packages/publisher/src/merge/` (reprendre `merge.ts` 94 lignes) : champ image (fusion d'images), bloc d'adresse et ligne de salutation, filtres et tri du carnet, détection des erreurs, fusion de catalogue (plusieurs enregistrements par page), source = Tableur de la suite (feuille liée).

### P10 : fichiers Publisher (L, risque élevé)
Dossier : `packages/publisher/src/pub-import/`. Lecture du format binaire .pub (texte, images, pages, pages maîtres). Fonction d'import progressive, signalant ce qui n'est pas restitué. À ne lancer qu'après décision du propriétaire sur la priorité du besoin.

### P11 : options, raccourcis, bibliothèque (M)
Dossier : `packages/publisher/src/app/options/` et `app/shortcuts/` : boîte Options Publication (unités, correcteur, enregistrement automatique), touches d'accès, raccourcis spécifiques (F5, F7, F9, Ctrl+Maj+N existant), bibliothèque de blocs personnelle (enregistrer un objet, le retrouver) dans `src/blocks/` (`blocks.ts` 125 lignes).

## 4. Ordre conseillé

| Vague | Contenu | Remarque |
|---|---|---|
| 0 | L0 de Présentation, P0 | préalable commun et preuve |
| 1 | P8, P3, P6, P4 (dossiers disjoints) | cœur « mise en page » |
| 2 | P1, P2, P9, P11 ; en parallèle les lots communs L1/L2/L4/L5/L6/L7 de Présentation | |
| 3 | P5, P7 ; P10 si décidé | décision propriétaire pour P5 et P10 |

Contrôles de fin de lot : `npx tsc -p packages/publisher/tsconfig.json --noEmit`, `node --test packages/publisher/tests/*.test.ts`, et `node --test packages/powerpoint/tests/*.test.ts` si le moteur commun a été touché.
