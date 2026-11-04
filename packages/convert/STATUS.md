# packages/convert : état (2026-11-04)

Convertisseur par lots façon Office 2024, plus le pont vers le moteur natif `forge-convert` (`src/native.ts`), les opérations
pdf-lib (`src/pdf-ops.ts`) et le chargeur pdf.js (`src/pdfjs.ts`) réutilisés par le module PDF.

## Moteurs

| Conversion | Navigateur | Coquille de bureau |
|---|---|---|
| Texte (docx, docm, dotx, doc, rtf, odt, html, md, txt) -> docx, odt, rtf, html, md, txt | `@forgeoffice/docx` | idem (plus fidèle que le pivot natif) |
| Classeurs (xlsx, xls, ods, csv, tsv) -> xlsx, ods, csv, tsv | `@forgeoffice/xlsx` | idem |
| Présentations (pptx, odp, ppt...) -> pptx, ppsx, potx | `@forgeoffice/pptx` | idem |
| Images png/jpg/webp/bmp/gif/svg -> png, jpg, webp ; images -> PDF | canvas + pdf-lib | forge-convert (tous formats d'image) |
| PDF -> PNG/JPG (une image par page), PDF -> texte | pdf.js | pdf.js / forge-convert |
| Documents -> PDF, EPUB ; PDF -> Word/ODT/HTML/MD ; données ; sous-titres ; archives ; audio | grisé (« application de bureau ») | forge-convert |

`nativeSupports` est le miroir exact de `prise_en_charge` (crates/forge-convert/src/conv/mod.rs).

## Vérifications

- `node --test packages/convert/tests/*.test.ts` : 10 tests (table native, planification, formats par défaut, noms de sortie,
  file d'attente, trame binaire et marqueurs du pont natif, sélection de pages, fusion/extraction/ordre/suppression/insertion/rotation,
  numérotation, filigrane, métadonnées).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur dans `packages/convert`.
- Banc navigateur : dépôt de 5 fichiers (PDF, md, csv, png, wav), « Tout convertir » : txt 1,7 Ko, docx 8,5 Ko, xlsx 5 Ko, jpg 3,3 Ko ;
  wav : « Disponible dans l'application de bureau ». Captures `docs/captures/convertisseur-*.png` regardées.

## Correspondance ForgePDF -> Convertisseur

| ForgePDF | ForgeOffice |
|---|---|
| FileUploader (dépôt) | Dépôt de fichiers **et de dossiers** (récursif), Ajouter des fichiers, Ajouter un dossier, Ctrl+O ; 512 Mo et 500 fichiers au plus |
| FileList : format de sortie par fichier | Liste : nom (+ chemin dans le dossier), taille, « Convertir en », état, Ouvrir / Enregistrer / Retirer / Réessayer |
| FileList : options image (qualité, taille, rotation) | Ruban > Options : qualité, largeur, hauteur, rotation ; Office fidèle (LibreOffice) si présent |
| Tout convertir + progression | Tout convertir (F5), Arrêter, état par ligne, compteurs dans la barre d'état |
| ZIP des résultats | Tout enregistrer (.zip) ; sur bureau, Dossier de destination (enregistrement direct) |
| Vider | Vider la liste, Retirer les terminés |
| MergePDF / MergePromptModal | Outils PDF > Fusionner les PDF (ordre de la liste) ; Images en un PDF |
| BatchModal (compresser, pivoter, filigrane, numéroter, protéger, PDF/A, OCR) | Onglet Outils PDF, mêmes outils (TypeScript ou natif, grisés avec la raison de `capacites()`) |
| History | Volet Historique (50 dernières conversions, persistant) |
| (absent) | « Tout convertir en », ouverture du résultat dans le bon module (`services.openDocument`), page Formats pris en charge |

## Reste à faire

- Nom de sortie personnalisé par fichier (noms automatiques dédoublonnés seulement).
- Fusion : ordre réglable et nom de sortie (aujourd'hui l'ordre de la liste et « fusion.pdf »).
- Miniatures des fichiers dans la liste (la commande `convert_miniatures` existe côté coquille, pas encore affichée).
- Chaîne native (dossier de destination, conversions vers PDF...) à exercer dans l'application de bureau.
