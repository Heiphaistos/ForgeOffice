# forge-convert : état (2026-11-04)

Moteur de conversion et d'outils PDF de ForgeOffice, repris de ForgePDF (`engine/` + `commands.rs`), en crate Rust autonome sans Tauri. Détail opération par opération : `INVENTAIRE.md`.

## Vérifications

- `cargo build` : OK.
- `cargo clippy --all-targets` : 0 avertissement (`unwrap_used`/`expect_used` interdits hors tests).
- `cargo test` : **57 tests, 0 échec** (1 unitaire + 27 `conversions` + 12 `pdf_caviardage` + 17 `pdf_outils`). Tous les PDF sont générés dans les tests.

## API

- `run(Operation) -> Result<Output, ConvertError>` (serde, `#[serde(tag = "op")]`). Les erreurs sont en français et sérialisables.
- `Operation::Pdf { entree, mot_de_passe, actions: Vec<ActionPdf>, sortie }` enchaîne les actions (100 au maximum, chiffrement obligatoirement en dernier).
- Autres opérations : `Infos`, `Fusionner`, `Decouper`, `ListerChamps`, `ListerAnnotations`, `ExtraireTexte`, `ExtraireImages`, `Comparer`, `ImagesVersPdf`, `PdfVersImages`, `PdfA`, `Ocr`, `Convertir`, `Miniature`, `Zipper`, `Capacites`.
- `capacites()` : outils externes détectés et opérations disponibles, avec un message français pour griser l'interface.
- Fonctions par domaine : `pdf::{pages, tampons, securite, compression, formulaires, annotations, caviardage, texte, images, externe}` et `conv::{convertir, prise_en_charge, ...}`.

## Fait et prouvé par les tests

| Domaine | Opérations | Moteur |
|---|---|---|
| Pages | fusion, découpage (chaque page / N pages / plages), extraction, suppression, réorganisation avec doublons, rotation | pur Rust |
| Tampons | filigrane, numérotation et Bates (zéros de tête), en-tête et pied de page | pur Rust (qpdf supprimé) |
| Sécurité | métadonnées (lecture et écriture), chiffrement AES-256 avec autorisations, déchiffrement | pur Rust (qpdf supprimé) |
| Compression | sans perte (purge, Flate, flux d'objets) ; écran, ebook et impression (images rééchantillonnées en JPEG seulement si c'est plus petit) | pur Rust (Ghostscript supprimé) |
| Formulaires | ajout, liste, remplissage, aplatissement | pur Rust |
| Annotations | texte, note, surlignage, rectangle | pur Rust |
| Caviardage réel | voir le détail ci-dessous | pur Rust (mutool supprimé, la page reste vectorielle) |
| Correctifs de texte | l'ancien texte est retiré puis le nouveau est écrit | pur Rust |
| Images | images ou SVG vers PDF (JPEG intégré sans recompression, transparence en SMask), extraction des images | pur Rust |
| Texte | extraction par page, comparaison HTML | pur Rust (pdftotext seulement en repli) |
| Conversions | table de ForgePDF complète : images, SVG, txt, md, html, docx, pptx, odt, odp, rtf, epub, xlsx, xls, ods, csv, json, yaml, toml, xml, srt, vtt, archives, audio | pur Rust (printpdf retiré, lopdf à la place) |

### Caviardage

Sous chaque zone :
- les glyphes sont retirés de `Tj`, `TJ`, `'` et `"`, et remplacés par un décalage, donc le reste de la ligne ne bouge pas ;
- les pixels des images sont noircis, y compris dans le masque SMask ;
- les formulaires XObject sont réécrits récursivement ;
- les annotations touchées sont supprimées, ainsi que les champs correspondants ;
- les anciens flux sont purgés du fichier.

Les tests le vérifient par extraction de texte **et** par une recherche dans le fichier brut et dans tous les flux décompressés.

### Entrées hostiles

- Noms de sortie confinés au dossier choisi : `..`, séparateurs, `C:`, `CON`, caractères de contrôle refusés.
- Pas d'écrasement sans `ecraser`. Écriture atomique (`.part` puis renommage), sans fichier `.part` restant.
- Lecture plafonnée à 512 Mio, sortie plafonnée à 1 Gio.
- Anti-bombes : 100 Mpx pour les images, 64 Mpx pour les SVG, 512 Mo pour les archives.
- Zip-slip assaini.
- Langue OCR validée avant tout lancement.
- Binaires lancés sans shell, avec des arguments en liste et des fichiers sous des noms fixes dans un dossier temporaire privé (supprimé par RAII), avec un délai maximal de 600 s.

## Bugs corrigés pendant le portage (hérités de ForgePDF)

- Lecture XML (docx, pptx, odt, xml) : `trim_text(true)` mangeait les espaces collés à une entité (`Rapport &lt;final&gt;` devenait `Rapport<final>`).
- Caviardage : les anciens XObject restaient référencés dans les ressources, donc l'image ou le texte d'origine restait dans le fichier. Ils sont maintenant retirés des ressources avant la purge.

## Dépendances externes (optionnelles, détectées)

| Outil | Sert à | Sans lui |
|---|---|---|
| Ghostscript (`gs`, `gswin64c`) | PDF/A-2b ; 3e repli du rendu en images | `OutilAbsent` avec message français |
| ocrmypdf + Tesseract | OCR | idem |
| MuPDF (`mutool`), sinon Poppler (`pdftoppm`) | rendu PDF vers PNG ou JPG | idem |
| Poppler (`pdftotext`) | repli d'extraction si lopdf ne trouve aucun texte | message « lancez l'OCR » |
| LibreOffice (`soffice`) | Office vers PDF fidèle (`haute_fidelite`) | conversion simplifiée en pur Rust |

Sur ce PC, seul `pdftotext` est installé. Les chemins Ghostscript, MuPDF, OCR et LibreOffice ne sont donc **pas exercés en vrai**, seulement le cas « outil absent » et la validation des arguments.

## Reste à faire

- Rendu PDF vers images en pur Rust (Android/iOS) : intégrer un moteur de rendu, par exemple un crate pur Rust à évaluer. Il passe pour l'instant par un binaire.
- Caviardage :
  - les tracés vectoriels sont recouverts, pas retirés ;
  - les CMap à longueur de code variable sont lues sur 2 octets ;
  - les signets et métadonnées contenant le texte ne sont pas nettoyés ;
  - une image dans un format non décodable (JPX, CCITT, JBIG2) touchée par une zone est retirée entièrement.
- `Zone::en_points` ignore `/Rotate` : à corriger si l'interface affiche les pages pivotées.
- PDF/A, OCR, rendu et LibreOffice : à tester sur une machine où ces outils sont installés.
- Brancher `run` dans la coquille Tauri (`apps/desktop/src-tauri`) et dans `packages/pdf`. Ce n'est pas dans le périmètre de ce lot.
