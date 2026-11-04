# @forgeoffice/formulas : état

Moteur de formules Excel en TypeScript pur, sans DOM.

## Fait et prouvé

- **489 fonctions** dans `src/functions/` : maths, statistiques et lois, texte (REGEX compris), dates (systèmes 1900 avec le 29/02/1900, et 1904), logique, LET/LAMBDA/MAP/REDUCE/SCAN/BYROW/BYCOL/MAKEARRAY, recherche (XLOOKUP, XMATCH, INDEX, OFFSET, INDIRECT...), tableaux dynamiques (FILTER, SORT, UNIQUE, SEQUENCE, TAKE, DROP, VSTACK, HSTACK, TOCOL, WRAPROWS, GROUPBY...), finances (VPM, VA, VC, NPM, TAUX, VAN, TRI, TRI.PAIEMENTS, TRIM, DB, DDB, VDB, coupons, PRIX.TITRE, RENDEMENT.TITRE, DUREE, bons du Trésor, escompte, PRICEMAT/YIELDMAT), information, ingénierie (bases, opérations bit à bit, ERF, Bessel J/I/K/Y, CONVERT, complexes), base de données (BDSOMME...). Fonctions volatiles marquées.
- Syntaxe canonique et française : `toLocalized` / `fromLocalized` (noms de fonctions, `;`, virgule décimale, VRAI/FAUX, erreurs #VALEUR! #NOM? #EPARS!...), préfixes `_xlfn.` des fichiers (`toFileFormula` / `fromFileFormula`).
- `FormulaEngine` (`src/engine/` : `workbook.ts` = la classe ; `types.ts` types publics et état interne ; `util.ts` utilitaires ; `context.ts` contexte d'évaluation + parcours de zones ; `structure.ts` décalage lignes/colonnes ; `adjust.ts`, `deps.ts`) : recalcul incrémental par graphe de dépendances (précédents relevés pendant l'évaluation, donc INDIRECT/DECALER suivis), débordement et #EPARS!, opérateur `A1#`, références circulaires (0 + liste) et calcul itératif, feuilles (ajout, renommage, suppression avec #REF!), noms (globaux, de feuille, LAMBDA nommées), tableaux structurés, insertion/suppression de lignes et colonnes avec #REF!, `translateFormula` (recopie), écouteurs, `batch`, références 3D, colonnes entières, chaînes de dépendances profondes sans dépassement de pile.
- Formats de nombre (`formatValue`) et saisie (`parseInput`) en fr-FR et en-US.

Tests : `node --test packages/formulas/tests/*.test.ts` : **844 tests, 844 réussis** (plus de 900 assertions comparées aux valeurs d'Excel). `npx tsc -p tsconfig.json --noEmit` : aucune erreur dans `packages/formulas`.
Performance mesurée : 100 000 formules saisies et calculées en environ 1,1 à 1,7 s, puis recalculées en 0,3 à 0,5 s (test chronométré : recalcul < 2 s).

## Reste à faire

- Fonctions non implémentées : FORECAST.ETS*, ACCRINT, AMORDEGRC, AMORLINC, ODDF*/ODDL*, GETPIVOTDATA, PIVOTBY, FILTERXML, WEBSERVICE, BAHTTEXT, TRIMRANGE, IMAGE, EUROCONVERT, STOCKHISTORY, RTD.
- Références 3D : non ajustées par l'insertion de lignes ni raccourcies quand une feuille de bord est supprimée (elles donnent #REF!).
- Insertion/suppression : `[@Col]` hors du tableau n'est pas réécrit ; le recalcul après une modification de structure est complet.
- Index des zones parcouru linéairement par colonne : lent si des dizaines de milliers de plages se chevauchent sur une même colonne (ex. cumuls `SUM($A$1:A1)` sur 100 000 lignes).
- CELLULE : pas de "format", "parentheses", "color" ; INFORMATIONS renvoie des valeurs fixes.
