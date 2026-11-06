# Inventaire des operations ForgePDF (source du portage)

Sources lues : `D:\Projet\ForgePDF\engine\src\*.rs` (pdf_engine, pdf_tools_engine, form_engine,
patch_engine, conversion_engine, office_engine, doc_engine, text_engine, data_engine,
archive_engine, audio_engine, dispatch), `desktop\src-tauri\src\commands.rs`, `server\src\main.rs`
(routes `/api/*`), `Cargo.toml` (workspace.dependencies), `README.md`.

Legende dependance : **Rust** = pure Rust (crate) · **Binaire** = programme externe lance par ForgePDF.
Colonne « forge-convert » : ce que devient l'operation dans ce crate.

## 1. Outils PDF

| Operation ForgePDF | Fonction source | Entree | Sortie | Dependance ForgePDF | forge-convert |
|---|---|---|---|---|---|
| Nombre de pages | `get_pdf_page_count` | PDF | entier | Rust (lopdf) | Rust |
| Fusion (pages reelles) | `merge_pdfs_pages` | N PDF | PDF | Rust (lopdf, renumerotation) | Rust, + attributs herites recopies, objets orphelins purges |
| Fusion « page unique » (texte) | `merge_pdfs_single_page` | N PDF | PDF 1 page haute | Rust (printpdf) | non reprise (rendu texte degrade ; la fusion reelle la remplace) |
| Fusion texte | `merge_pdfs` (commande desktop) | N PDF | PDF texte | Rust | non reprise (idem) |
| Decoupage = garder des pages | `split_pdf` | PDF + pages | PDF | Rust (lopdf) | Rust : decoupage en plusieurs fichiers (chaque page, plages, toutes les N), extraction, suppression |
| Reorganisation + rotation par page | `organize_pdf` | PDF + [(page, rotation)] | PDF | Rust (lopdf) | Rust (+ doublons de page autorises) |
| Rotation globale | `rotate_pdf` | PDF + degres | PDF | Rust (lopdf) | Rust (+ selection de pages, /Rotate herite pris en compte) |
| Filigrane | `make_watermark_stamp` + `overlay_pdf` | PDF + texte | PDF | printpdf + **qpdf** (overlay) | Rust (flux de contenu ajoute, diagonale, opacite) |
| Numerotation / Bates | `make_numbering_stamp` + `overlay_pdf` | PDF + prefixe + debut | PDF | printpdf + **qpdf** | Rust (6 positions, zeros de tete) |
| En-tete / pied de page | — (absent) | PDF + textes | PDF | — | Rust (nouveau, `{page}` / `{total}`) |
| Metadonnees | — (absent) | PDF | infos / PDF | — | Rust (nouveau : lire/ecrire Title, Author, Subject, Keywords, Creator, Producer) |
| Chiffrement AES-256 | `encrypt_pdf` | PDF + mots de passe | PDF | **qpdf** | Rust (lopdf V5 AES-256 + autorisations) ; plus de mot de passe en argv |
| Dechiffrement | `decrypt_pdf` | PDF + mot de passe | PDF | **qpdf** | Rust (lopdf) |
| Compression | `compress_pdf` | PDF + niveau | PDF | **Ghostscript** (gs) | Rust : flux Flate + flux d'objets + purge, et pour ecran/ebook/impression reechantillonnage JPEG des images |
| PDF/A-2b | `to_pdfa` | PDF | PDF/A | **Ghostscript** | Binaire (gs detecte, gswin64c sous Windows) + erreur francaise si absent |
| OCR | `ocr_pdf` | PDF + langue + forcer | PDF cherchable | **ocrmypdf** (+ Tesseract) | Binaire (detecte) + erreur francaise si absent |
| Formulaire : ajouter des champs | `add_form_fields` | PDF + champs | PDF | Rust (lopdf) | Rust (repris) |
| Formulaire : lister / remplir / aplatir | — (absent) | PDF | liste / PDF | — | Rust (nouveau, apparences generees) |
| Annotations texte | `make_annotation_stamp` + `overlay_pdf` | PDF + [(page,x,y,taille,texte)] | PDF | printpdf + **qpdf** | Rust : texte pose + vraies annotations (note, surlignage, rectangle) |
| Correctifs de texte (« editer ») | `make_patch_stamp` + `overlay_pdf` | PDF + zones + texte | PDF | printpdf + **qpdf** | Rust : l'ancien texte est REELLEMENT retire sous la zone, puis fond + nouveau texte |
| Caviardage (biffure) | `redact_pdf_bytes` | PDF + zones + dpi | PDF image | **mutool** (rendu) + image | Rust : suppression des glyphes, images ET tracés vectoriels (recadrés) sous la zone dans le flux, pages pivotées/CropBox, pages restent vectorielles |
| Images vers PDF | `images_to_pdf` | images | PDF | Rust (printpdf, RGB brut) | Rust (lopdf : JPEG sans recompression, autres en Flate, transparence en SMask) |
| SVG vers PDF | dispatch `("svg","pdf")` | SVG | PDF | Rust (resvg) | Rust |
| PDF vers images | `pdf_to_images_zip` | PDF + dpi | ZIP de PNG | **mutool** | mutool, sinon pdftoppm, sinon Ghostscript, sinon rendu simplifié pur Rust (`pdf::rendu_simple`, tiny-skia + ttf-parser) avec avertissement |
| Extraction de texte | `extract_text_from_pdf` | PDF | texte | **pdftotext** puis lopdf | Rust d'abord (lopdf, ToUnicode), pdftotext seulement si rien d'extrait |
| Extraction d'images | — (absent) | PDF | fichiers image | — | Rust (nouveau : JPEG tels quels, Flate en PNG) |
| PDF vers HTML / MD / DOCX / EPUB | dispatch | PDF | doc | Rust (pivot texte) | Rust (repris) |
| Comparaison de deux PDF | `compare_pdfs_html` | 2 PDF | rapport HTML | Rust (similar) | Rust (+ compteurs structures) |
| Fusion PDF | — | N PDF | PDF | — | Rust, ordre explicite (`ordre`), mots de passe par entrée ; noms de sortie personnalisés (`noms`) pour découpage, images, rendu, zip |
| Traitement par lots | route `/api/batch` | N PDF + op | ZIP | selon op | chaque `Operation` s'appelle en boucle cote coquille (pas de ZIP impose) |
| Miniature | `generate_thumbnail` | image/SVG | data-URL PNG | Rust | Rust (repris) |
| ZIP de fichiers | `zip_files` (commande desktop) | N fichiers | ZIP | Rust (zip) | Rust (repris, noms dedoublonnes) |

## 2. Conversions (dispatch `convert_bytes`)

| Famille | Entrees | Sorties | Dependance |
|---|---|---|---|
| Images raster | png jpg webp bmp gif tiff tga pnm/ppm hdr ico qoi exr dds ff | png jpg webp bmp gif tiff tga ico avif qoi exr ppm ff, pdf | Rust (image) ; qualite, redimension, rotation |
| SVG | svg | png jpg webp bmp avif qoi, pdf | Rust (resvg) |
| Texte / Markdown / HTML | txt md html | pdf html txt md docx epub rtf odt | Rust (pulldown-cmark, htmd ; DOCX et EPUB écrits à la main avec `zip` 9 : docx-rs et epub-builder retirés) |
| Word / PowerPoint / OpenDocument | docx doc* pptx ppt* odt odp | txt html md pdf docx epub rtf odt | Rust (zip + quick-xml), pivot texte (*.doc/.ppt binaires non lus : seul le XML est pris en charge) |
| Tableurs | xlsx xls ods csv | csv json txt pdf yaml html md toml xml xlsx | Rust (calamine 0.38, rust_xlsxwriter, csv) |
| Donnees structurees | json yaml toml xml csv | json yaml toml xml csv txt pdf xlsx md html | Rust (serde_json, serde_yaml, toml, quick-xml) |
| RTF | rtf | txt pdf docx html | Rust (analyseur maison) |
| EPUB | epub | txt html md pdf | Rust (zip + quick-xml, lecteur maison : le crate `epub` est GPL) |
| Sous-titres | srt vtt | vtt srt txt | Rust |
| Archives | zip tar tgz gz 7z | zip tar tgz | Rust (zip, tar, flate2, sevenz-rust2) ; anti zip-slip + plafond 512 Mo |
| Audio | mp3 ogg m4a aac wav flac | wav flac | Rust (symphonia, hound, flacenc) |
| Office vers PDF fidele | docx pptx xlsx odt odp ods | pdf | **LibreOffice** (soffice) en option `haute_fidelite` (nouveau ; sinon pivot texte Rust) |

## 3. Binaires externes utilises par ForgePDF

| Binaire | Usage ForgePDF | Statut forge-convert |
|---|---|---|
| qpdf | chiffrement, dechiffrement, superposition (filigrane, numeros, annotations, correctifs) | **supprime** (tout en Rust) |
| Ghostscript (gs) | compression, PDF/A | compression en Rust ; PDF/A reste sur gs (option) ; repli rendu PDF vers images |
| mutool (MuPDF) | rendu PDF vers PNG, caviardage par rasterisation | rendu seulement (caviardage en Rust) |
| pdftotext (Poppler) | extraction de texte | repli seulement ; pdftoppm comme repli de rendu |
| ocrmypdf (+ Tesseract) | OCR | inchange (detecte) |
| LibreOffice (soffice) | non utilise | nouveau, optionnel (conversion Office fidele) |
