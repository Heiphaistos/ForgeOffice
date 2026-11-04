# @forgeoffice/xlsx — état (2026-11-04)

Modèle de classeur du Tableur (`src/model.ts` + `model-drawing.ts` + `model-styles.ts` (couleurs, polices, styles, thème) + `model-features.ts` (mises en forme conditionnelles, validation, filtres, tableaux) + `model-page.ts` (liens, notes, mise en page, protection de feuille), tous ré-exportés par `model.ts` qui garde adresses, valeurs, classeur, cellules et feuille ; contrat du futur module) et lecture/écriture des formats, pur TypeScript, sans DOM, sans dépendance à `@forgeoffice/formulas` (formules = chaînes canoniques anglaises sans « = »).

## Formats

| Format | Lecture | Écriture | Fidélité |
|---|---|---|---|
| .xlsx / .xlsm / .xltx / .xltm | oui | oui | Haute : propriétés (core/app/custom), thème, styles normalisés (polices, remplissages motif/dégradé, bordures, formats, alignement, protection, styles nommés, dxf, styles de tableau), noms définis, zones/titres d'impression, feuilles masquées/très masquées, couleur d'onglet, cellules (nombre, texte, booléen, erreur, texte enrichi), formules simples/partagées/matricielles/dynamiques (préfixes `_xlfn.` gérés), lignes/colonnes (largeur, hauteur, masquage, plan), fusions, volets, zoom, quadrillage, mises en forme conditionnelles (cellIs, expression, échelles, barres étendues x14, icônes, top10, doublons...), validations, filtre automatique et tris, tableaux, liens, notes + commentaires de fil, images/formes/graphiques (histogramme, barres, courbes, secteurs, anneau, aires, nuages, radar, bulles, combiné), sparklines, mise en page, protection (feuille, classeur, plages), projet VBA conservé (jamais exécuté), feuilles graphiques. Fichiers ouverts par Excel 365 sans réparation (vérifié le 2026-11-04 par COM, Excel masqué). |
| .xls (Excel 97-2003, BIFF8) | oui | non (enregistrer en .xlsx) | Bonne : conteneur OLE/CFB (FAT, DIFAT, mini-flux), feuilles et visibilité, chaînes partagées (y compris à cheval sur CONTINUE, texte enrichi), RK/MULRK/NUMBER/LABEL/BOOLERR/BLANK/MULBLANK, formules converties en texte (opérateurs, ~260 fonctions, références 2D/3D, noms, noms externes `_xlfn.`, constantes matricielles, formules partagées SHRFMLA et matricielles ARRAY), résultats en cache (STRING), polices, palette, formats de nombre, XF (alignement, bordures, motifs, protection), fusions, largeurs/hauteurs/masquage/plan, volets figés, zoom, affichage, marges, en-têtes/pieds, orientation, ajustement, noms définis et zones d'impression, système 1904. Chiffré, BIFF5/95 et antérieurs : refusés avec message français. Vérifié sur un vrai .xls produit par Excel 365 (`tests/fixtures/excel2024.xls`). |
| .ods | oui | oui | Correcte : feuilles (masquées, couleur d'onglet), valeurs (nombre, %, date, heure, booléen, erreur, texte multi-ligne avec espaces), formules OpenFormula <-> Excel, fusions (cellules couvertes), largeurs/hauteurs, masquage, styles de cellule (police, taille, gras, italique, souligné, barré, couleur, fond, alignement, retour à la ligne, retrait, rotation, bordures), styles de nombre (décimales, milliers, %, scientifique, dates/heures, texte), plages et expressions nommées, métadonnées. `mimetype` en tête non compressé. Ouvert par Excel 365 (vérifié). |
| .csv / .tsv / .txt | oui | oui | Encodages UTF-8 (± BOM), UTF-16 LE/BE, Windows-1252 détectés ; séparateur `;` `,` tabulation `|` détecté ; décimale française ; milliers (espace, espace fine, point) ; %, €, dates JJ/MM/AAAA ou MM/JJ/AAAA, ISO avec heure ; VRAI/FAUX ; codes d'erreur ; zéros initiaux conservés en texte ; formules ignorées par défaut (anti-injection) ; écriture française par défaut (`;`, virgule, BOM, CRLF), option d'échappement des formules. |

Point d'entrée unique : `detectFormat`, `readWorkbook`, `writeWorkbook` (`src/formats.ts`), signature (zip/OLE/mimetype ODF) puis extension.

## Sécurité

Bombe zip (limites `@forgeoffice/opc`, réglables via `readXlsx(bytes, { limits })`), DOCTYPE/entités refusés, nombres de feuilles/cellules bornés, répétitions ODS gigantesques bornées, chaînes de secteurs CFB bornées (boucles détectées), enregistrements BIFF tronqués ignorés, corruption aléatoire testée (240 tirages en test + 2000 hors test : seule `SpreadsheetError` peut sortir).

## Performance

200 000 cellules écrites puis relues en .xlsx en ~2 s (test `perf.test.ts`, seuil 3 s) ; CSV 200 000 cellules lues + écrites en ~2 s (seuil 5 s).

## Tests

`node --test packages/xlsx/tests/*.test.ts` : 35 tests, 0 échec, ~410 assertions (xlsx aller-retour, xlsx écrit à la main, xls réel + synthétique, ods tiers + aller-retour, csv, détection, fichiers corrompus, performance).
`tests/biff-builder.ts` fabrique des .xls (CFB + enregistrements BIFF8) pour les tests. `npx tsc -p tsconfig.json --noEmit` : aucune erreur dans `packages/xlsx`.

## Reste à faire

- .xls : commentaires (NOTE/OBJ/TXO), liens (HLINK), images et graphiques, mises en forme conditionnelles (CF/CF12), validations (DV), filtres, couleur d'onglet (SheetExt), protection ; écriture .xls non prévue.
- .ods : mises en forme conditionnelles, validations, graphiques, images, commentaires, volets figés (settings.xml), texte enrichi (spans) non lus/écrits.
- Rendu des formats de nombre et recalcul : du ressort de `@forgeoffice/formulas` (le modèle garde les valeurs en cache).
