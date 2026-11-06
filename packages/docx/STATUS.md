# @forgeoffice/docx — état (2026-11-05)

Modèle de document Texte (`src/model.ts`, contrat du futur éditeur ; types répartis dans `model-props.ts` (propriétés, thème, caractères, paragraphes), `model-styles.ts` (styles, numérotation), `model-section.ts` (sections, en-têtes), `model-table.ts` (tableaux), `model-blocks.ts` (blocs du corps), `model-inline.ts` (éléments en ligne), tous ré-exportés par `model.ts` qui garde le document, les notes, commentaires et médias) + lecture/écriture des formats, pur TypeScript, sans DOM.

## Formats

| Format | Lecture | Écriture | Fidélité |
|---|---|---|---|
| .docx / .docm / .dotx / .dotm | oui | oui | Haute : propriétés (core/app/custom), thème, réglages, styles (héritage, styles latents), numérotation, sections (marges, colonnes, en-têtes/pieds par type, numérotation des pages), paragraphes, caractères, tableaux (fusions, bordures, trames), images en ligne/flottantes, liens, signets, champs simples et complexes, notes, commentaires (fils, résolus), suivi des modifications, contrôles de contenu, table des matières, équations (OMML conservé), parties inconnues conservées (customXml, macros en docm). Fichiers ouverts par Word 365 sans réparation (vérifié le 2026-11-04). Filigrane et couleur de page : vrais éléments OOXML (forme VML « PowerPlusWaterMarkObject » dans les en-têtes, `w:background` + `displayBackgroundShape`), relus et reconvertis ; vérifié dans Word (COM : forme, texte, rotation 315, couleur, transparence, fond). Styles de Word en français (« Titre1 », « Lgende ») : table de correspondance `canonicalStyleName` / `headingLevelOfStyle` / `findStyleId`. Fichiers chiffrés par mot de passe (conteneur EncryptedPackage) : `readDocument(bytes, name, { password })`, `DocxPasswordError` (required / wrong). Réponses de commentaires : vérifiées dans Word (COM : `Comments.Count`, `Replies.Count`, `Ancestor`). |
| .rtf | oui | oui | Bonne : infos, polices/couleurs, styles, listes, tableaux, images, liens, champs (SYMBOL compris), notes, en-têtes/pieds, sections, signets, suivi des modifications (\revised / \deleted). Commentaires (annotation, réponses comprises) lus et écrits (vérifié dans Word : 3 commentaires, fil de discussion), dates creatim / atndate en heure locale (lues et écrites). |
| .odt | oui | oui | Correcte : styles, mise en forme, listes, tableaux, notes, liens, images, métadonnées. |
| .html | oui (import nettoyé) | oui (page autonome, images en data:) | Correcte : scripts, iframes, objets et gestionnaires d'événements éliminés. |
| .md | oui | oui | Titres, emphase, listes imbriquées, liens, code, tableaux, citations, règles. |
| .txt | oui | oui | UTF-8 (± BOM), UTF-16 LE/BE, Windows-1252 détectés ; numéros de liste à l'export. |
| .doc (Word 97-2003) | oui | non | Texte, styles (UPX : propriétés, style de base, suivant ; styles de titre redéfinis dans le fichier), styles de caractères, mise en forme des caractères et paragraphes, listes (PlfLst / PlfLfo : puces et numéros, niveaux, retraits), sections (marges, orientation, colonnes, première page différente), en-têtes et pieds (par section, première page, pages paires), commentaires (auteur, initiales, zone commentée), images en ligne (flux Data : PNG, JPEG, DIB, TIFF, EMF/WMF décompressés), symboles Symbol / Wingdings convertis en Unicode, tableaux (imbriqués aplatis), champs et liens sûrs, notes de bas de page et de fin, suivi des modifications, propriétés. Word 6/95 : texte brut. Chiffré : refusé avec message. Lu et réécrit en .docx ouvert correctement par Word 365 (2 sections, 2 commentaires, image, 4 paragraphes de liste, en-têtes, note vérifiés par COM). |

Point d'entrée unique : `detectFormat`, `readDocument`, `writeDocument` (`src/formats.ts`).

## Sécurité

Taille d'entrée bornée, bombe zip (taille par entrée, totale, nombre d'entrées), nombre de blocs et profondeur bornés, liens `javascript:` / `vbscript:` / `data:` refusés avec avertissement (y compris champs HYPERLINK), conteneur CFB borné (pas de boucle sur chaîne de secteurs), corruption aléatoire du .doc testée (300 tirages : seule `DocxError` peut sortir).

## Tests

`node --test packages/docx/tests/*.test.ts` : 54 tests, 0 échec (avant : 47). `tests/doc-builder.ts` fabrique des .doc synthétiques ; `tests/fixtures/word97-rich.doc` est un vrai .doc enregistré par Word 365 (auteurs neutralisés), `word-fr-styles.docx` un vrai docx de Word en français. Corruption aléatoire du .doc réel : 300 tirages.

## Reste à faire

- .doc : formes flottantes (PlcSpaMom / OfficeArt), objets OLE, zones de texte, dates et fils de réponses des commentaires (non lus : les réponses sont des commentaires à plat), numéros de listes hérités par un style de tableau.
- .doc : écriture (hors périmètre).
- Symboles Wingdings : table partielle (~50 caractères courants) ; les autres restent des symboles (police conservée). Symbol : table complète.
