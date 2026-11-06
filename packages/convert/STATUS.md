# packages/convert : état (2026-11-04)

Convertisseur par lots façon Office 2024, plus le pont vers le moteur natif `forge-convert` (`src/native.ts`), les opérations
`@cantoo/pdf-lib` (`src/pdf-ops.ts`, dont `encrypt` / `decrypt` / `unlock` AES-256 sans moteur natif) et le chargeur pdf.js (`src/pdfjs.ts`) réutilisés par le module PDF.

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

- `node --test packages/convert/tests/*.test.ts` : 18 tests (dont 6 du 2026-11-05) (table native, planification, formats par défaut, noms de sortie,
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

## Fait le 2026-11-05 (limites levées)

- Nom de sortie par fichier : colonne « Nom de sortie » (radical + extension du format cible figée), validation `src/naming.ts`
  (caractères interdits, noms réservés Windows, point en tête/fin, 120 caractères, extension tapée retirée), dédoublonnage conservé
  (« Contrat (2).odt »). Vide = nom automatique. Changer le nom remet la ligne en attente. Masquée sous 720 px.
- Fusion : l'ordre de la liste est l'ordre de la fusion. Réordonner par glisser (poignée à gauche du nom, trait d'insertion) ou par les
  flèches Monter/Descendre de la colonne d'actions (44 px en tactile, où le glisser HTML5 n'existe pas). Outils PDF > Fusionner ouvre
  maintenant une boîte avec le nom du PDF (défaut « fusion », même validation) et l'ordre des PDF. Logique : `src/listing.ts`.
- Miniatures 40 px : `src/thumbs.ts` + `Thumb.tsx`, chargées à l'apparition de la ligne (IntersectionObserver), une à la fois.
  Fichier du disque (bureau) : `convert_miniatures` (images/SVG), repli canvas si refus ; navigateur : images via `Image` + canvas, PDF via pdf.js
  (page 1) ; autres types : icône du format ; plus de 50 Mo : icône. Data-URL (rien à révoquer), cache lié aux octets du fichier.
- Champs optionnels du crate (nom de sortie, ordre) : rien n'est envoyé au natif. Le nom de sortie passe déjà par `outputTarget(nom)` de
  `convert_run_bytes` (champ existant) et la fusion est faite en TypeScript, donc aucun nouveau champ n'est nécessaire. Si le crate expose
  un jour un champ, le tester dans `capacites().operations` avant de l'envoyer.
- Tests : `node --test packages/convert/tests/*.test.ts` : 18 réussis (12 avant ; +6 : noms, dédoublonnage, ordre, miniatures, fusion
  nommée et ordonnée). Les parties DOM (glisser réel, miniatures) sont à voir dans le navigateur.

## Reste à faire

- Glisser-déposer de ligne non testé avec une vraie souris (événements HTML5 `dragstart/dragover/drop`) ; au doigt : flèches.
- Chaîne native (dossier de destination, conversions vers PDF...) à exercer dans l'application de bureau, dont `convert_miniatures` sur de vrais fichiers.
