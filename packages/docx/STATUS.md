# @forgeoffice/docx — état (2026-11-04)

Modèle de document Texte (`src/model.ts`, contrat du futur éditeur ; types répartis dans `model-props.ts` (propriétés, thème, caractères, paragraphes), `model-styles.ts` (styles, numérotation), `model-section.ts` (sections, en-têtes), `model-table.ts` (tableaux), `model-blocks.ts` (blocs du corps), `model-inline.ts` (éléments en ligne), tous ré-exportés par `model.ts` qui garde le document, les notes, commentaires et médias) + lecture/écriture des formats, pur TypeScript, sans DOM.

## Formats

| Format | Lecture | Écriture | Fidélité |
|---|---|---|---|
| .docx / .docm / .dotx / .dotm | oui | oui | Haute : propriétés (core/app/custom), thème, réglages, styles (héritage, styles latents), numérotation, sections (marges, colonnes, en-têtes/pieds par type, numérotation des pages), paragraphes, caractères, tableaux (fusions, bordures, trames), images en ligne/flottantes, liens, signets, champs simples et complexes, notes, commentaires (fils, résolus), suivi des modifications, contrôles de contenu, table des matières, équations (OMML conservé), parties inconnues conservées (customXml, macros en docm). Fichiers ouverts par Word 365 sans réparation (vérifié le 2026-11-04). |
| .rtf | oui | oui | Bonne : infos, polices/couleurs, styles, listes, tableaux, images, liens, champs (SYMBOL compris), notes, en-têtes/pieds, sections, signets, suivi des modifications (\revised / \deleted). Commentaires RTF non lus. |
| .odt | oui | oui | Correcte : styles, mise en forme, listes, tableaux, notes, liens, images, métadonnées. |
| .html | oui (import nettoyé) | oui (page autonome, images en data:) | Correcte : scripts, iframes, objets et gestionnaires d'événements éliminés. |
| .md | oui | oui | Titres, emphase, listes imbriquées, liens, code, tableaux, citations, règles. |
| .txt | oui | oui | UTF-8 (± BOM), UTF-16 LE/BE, Windows-1252 détectés ; numéros de liste à l'export. |
| .doc (Word 97-2003) | oui | non | Texte, styles de titre et styles nommés, gras/italique/souligné/barré/police/taille/couleur/surlignage/exposant/langue, alignement/retraits/espacements/interligne/enchaînements, tableaux (imbriqués aplatis), champs et liens sûrs, notes de bas de page et de fin, suivi des modifications, propriétés (SummaryInformation). Word 6/95 : texte brut. Chiffré : refusé avec message. Lu correctement sur un vrai .doc produit par Word 365. |

Point d'entrée unique : `detectFormat`, `readDocument`, `writeDocument` (`src/formats.ts`).

## Sécurité

Taille d'entrée bornée, bombe zip (taille par entrée, totale, nombre d'entrées), nombre de blocs et profondeur bornés, liens `javascript:` / `vbscript:` / `data:` refusés avec avertissement (y compris champs HYPERLINK), conteneur CFB borné (pas de boucle sur chaîne de secteurs), corruption aléatoire du .doc testée (300 tirages : seule `DocxError` peut sortir).

## Tests

`node --test packages/docx/tests/*.test.ts` : 46 tests, 0 échec, ~500 assertions (docx, formats, doc, texte/résolution).
`tests/doc-builder.ts` fabrique des .doc (CFB + FIB + pièces + FKP) pour les tests.

## Reste à faire

- .doc : images, en-têtes/pieds, commentaires, numéros de listes (LST/LFO), sections (SED), styles hérités (UPX), mini-flux CFB non couvert par les tests (lecteur prêt).
- .doc : écriture (non demandée).
- RTF : commentaires (\annotation), dates \creatim lues comme UTC.
- Vérifier dans Word que les réponses de commentaires écrites par ForgeOffice apparaissent (ancrées avec leur parent depuis le 2026-11-04, non revérifié dans Word).
