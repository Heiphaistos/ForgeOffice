# Audit de parité : module Convertisseur de ForgeOffice

Date : 2026-11-05. Périmètre : `packages/convert` (interface, file d'attente, formats, ponts), moteur Rust `crates/forge-convert`, pont natif `packages/convert/src/native.ts` et commandes `convert_*` de `apps/desktop/src-tauri/src/convert_cmds.rs`. Références : PDF24 Creator, Convertio / CloudConvert, Pandoc, LibreOffice headless, FFmpeg, ImageMagick / libvips, plus conversions de données, sous-titres, archives, polices, ebooks, CAO/3D, codes et empreintes.

## Méthode

- Lecture du code, pas des seuls STATUS : `formats.ts`, `engines.ts`, `native.ts`, `queue.ts`, `pdf-ops.ts`, `pdf-batch.ts`, `ribbon.ts`, `Convert.tsx`, `JobTable.tsx`, `ToolDialog.tsx`, `files.ts`, `naming.ts`, `listing.ts`, `thumbs.ts`, `pdfjs.ts` ; côté Rust `conv/mod.rs` (`prise_en_charge`, `aiguiller`), `documents.rs`, `donnees.rs`, `images.rs`, `audio.rs`, `archives.rs`, `epub.rs`, `ecriture_zip.rs`, `office.rs`, `texte.rs`, `operation.rs`, `outils.rs`, `fichiers.rs`, `pdf/*` (pages, tampons, securite, compression, formulaires, annotations, caviardage, texte, images, externe, rendu) et `convert_cmds.rs`. Les paquets `@forgeoffice/docx`, `xlsx`, `pptx`, `powerpoint` et `pdf` ont été consultés pour savoir ce qu'ils savent déjà faire sans que le Convertisseur l'expose. Les dépendances réelles (`Cargo.toml`, sources des crates `image` 0.25.10 et `symphonia` 0.5.5 du cache cargo) ont servi à vérifier ce qui est compilé (AVIF en encodage seul, WebP sans perte seul, pas de décodeur Opus, AIFF/CAF/ALAC non activés).
- Aucune exécution : pas d'application lancée, pas de test relancé (les 107 tests Rust et 18 tests TypeScript cités viennent des STATUS). Aucun code, aucune commande git, rien d'autre que ce fichier n'a été écrit.
- Un statut n'est valable que si le code a été vu. Écarts constatés entre documents et code : `docs/ROADMAP.md` dit encore que le rendu PDF → images et le caviardage des tracés ne sont pas faits, alors que `pdf/rendu/` et `pdf/traits.rs` les implémentent ; la mise en garde du STATUS du crate sur `..` dans `convert_cmds.rs` est déjà appliquée.
- « Moteur » : navigateur = TypeScript (paquets de la suite, canvas, pdf.js, pdf-lib), fonctionne partout y compris dans la coquille de bureau ; bureau natif = `forge-convert` en Rust pur ; outil externe = binaire détecté par `capacites()` (aujourd'hui Ghostscript, MuPDF, Poppler, ocrmypdf, LibreOffice).

## Légende

| Champ | Valeurs |
|---|---|
| Statut | **OK** = effet prouvé (test cité dans la preuve) ; **Présent à vérifier** = code lu et présent, effet non prouvé (aucune exécution lors de l'audit) ; **Partiel** = moteur ou paquet existant mais qualité réduite (pivot texte), option non exposée, outil externe jamais exercé, ou accessible seulement dans un autre module (PDF) ; **Absent** = rien d'utilisable |
| Prio | P1 = gêne majeure ou usage très courant ; P2 = utile ; P3 = confort ou rare ; OK = rien à faire |
| Source | [PDF24] [Pandoc] [LibreOffice] [FFmpeg] [ImageMagick] [Convertio] (CloudConvert est rangé avec Convertio) |
| Preuve | fichier + fonction ; « navigateur », « bureau natif » ou « bureau + outil externe X » ; pour un Absent : ce qui manque et comment l'implémenter (crate Rust pur ou outil externe détecté par `capacites()`) |

## Récapitulatif par type (calculé par awk sur les lignes `| CV-`)

| Type | OK | Présent à vérifier | Partiel | Absent | Total |
|---|---|---|---|---|---|
| Conversion document | 4 | 17 | 20 | 28 | 69 |
| Conversion tableur | 8 | 7 | 8 | 10 | 33 |
| Conversion présentation | 3 | 3 | 4 | 11 | 21 |
| Conversion image | 0 | 14 | 10 | 20 | 44 |
| Conversion audio/vidéo | 0 | 5 | 0 | 23 | 28 |
| Conversion données | 0 | 5 | 5 | 8 | 18 |
| Conversion archive/autre | 0 | 4 | 2 | 25 | 31 |
| Outil PDF | 0 | 4 | 31 | 18 | 53 |
| Option | 5 | 9 | 18 | 46 | 78 |
| Interface | 1 | 12 | 13 | 10 | 36 |
| Intégration | 1 | 2 | 5 | 10 | 18 |
| Au-delà | 0 | 0 | 3 | 17 | 20 |
| **Total** | **22** | **82** | **119** | **226** | **449** |

Taux global : OK 4.9 %, Présent à vérifier 18.3 %, Partiel 26.5 %, Absent 50.3 % sur 449 entrées (dont 20 idées « Au-delà »).

## Matrice : navigateur, bureau natif, outil externe

| Famille | Navigateur (TypeScript, partout) | Bureau natif (Rust pur, `forge-convert`) | Outil externe (détecté par `capacites()`) |
|---|---|---|---|
| Documents Word, ODT, RTF, HTML, MD, TXT | Conversions croisées fidèles via `@forgeoffice/docx` (docx, odt, rtf, html, md, txt ; doc en lecture) | Vers PDF et EPUB, PDF vers docx/odt/rtf/html/md : pivot texte seul (Courier, WinAnsi) | LibreOffice : Office vers PDF fidèle (option « haute fidélité », jamais exercé) |
| Tableurs | xlsx, xls, ods, csv, tsv entre eux via `@forgeoffice/xlsx` | Vers json, xml, yaml, toml, html, md, txt, pdf (texte, types perdus) | LibreOffice vers PDF |
| Présentations | pptx, ppsx, potx depuis pptx, odp, ppt via `@forgeoffice/pptx` | Vers pdf, txt, md, html, docx : texte des diapositives seul | LibreOffice vers PDF |
| Images | png, jpg, webp, bmp, gif, svg vers png, jpg, webp et vers PDF (canvas, pdf-lib) | 17 formats en entrée, 14 en sortie, SVG (resvg), miniatures ; WebP sans perte seul, AVIF en écriture seule | aucun (heic, psd, raw, jxl, avif en lecture absents) |
| Outils PDF | fusion, rotation, filigrane, numérotation, chiffrement (pdf-lib) ; PDF vers png/jpg/txt (pdf.js) | compression, déchiffrement, caviardage, formulaires, annotations, comparaison, extraction d'images, rendu simplifié, métadonnées | Ghostscript (PDF/A, rendu), ocrmypdf + Tesseract (OCR), MuPDF / Poppler (rendu), pdftotext (repli) |
| Données et sous-titres | rien (grisé) | json, yaml, toml, xml, csv ; srt, vtt | aucun |
| Archives | ZIP des résultats (JSZip) | zip, tar, tgz, 7z (lecture) | aucun (rar, xz, zst, 7z écriture absents) |
| Audio | rien (grisé) | mp3, ogg, m4a, aac, wav, flac vers wav, flac (PCM 16 bits, en mémoire) | aucun (FFmpeg non détecté) |
| Vidéo, polices, CAO/3D, ebooks mobi/azw3/fb2, LaTeX/RST/Org, HEIC | rien | rien | FFmpeg, Calibre, Pandoc, ImageMagick non détectés |

## 1. Documents texte (Word, OpenDocument, RTF, HTML, Markdown, TXT, LaTeX et balisages Pandoc)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-001 | Conversion document | [LibreOffice] docx → odt | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite (readDocument/writeDocument de @forgeoffice/docx), TEXT_IN/TEXT_OUT de formats.ts ; modèle de document complet (styles, tableaux, images) |
| CV-002 | Conversion document | [LibreOffice] docx → rtf | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite, writeRtf de packages/docx/src/rtf |
| CV-003 | Conversion document | [LibreOffice] docx → html | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite, writeHtml de packages/docx/src/html (fidèle ; le pivot natif conv/office.rs docx_to_html n'est PAS utilisé car planEngine préfère la suite) |
| CV-004 | Conversion document | [Pandoc] docx → md | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite, writeMarkdown de packages/docx/src/md |
| CV-005 | Conversion document | [Pandoc] docx → txt | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite, writeText de packages/docx/src/txt.ts |
| CV-006 | Conversion document | [LibreOffice] docx → pdf (mise en page conservée) | Partiel | P1 | bureau natif : conv/mod.rs aiguiller → docx_to_text puis texte.rs create_pdf_from_text (A4, Courier 10 pt, WinAnsi, texte seul, aucune mise en forme/image/tableau) ; bureau + outil externe LibreOffice si « haute fidélité » (pdf/externe.rs office_vers_pdf, jamais exercé selon ROADMAP §1) ; navigateur : grisé |
| CV-007 | Conversion document | [LibreOffice] docx → pdf sans LibreOffice (rendu vectoriel propre de la suite) | Absent | P1 | manque un moteur de mise en page TS → PDF pour @forgeoffice/docx : réutiliser packages/powerpoint/src/pdf (writer.ts, text-layout.ts, buildVectorPdf) étendu aux paragraphes/tableaux/images, exécutable navigateur + bureau ; à défaut Edge/Chromium headless --print-to-pdf détecté par capacites() |
| CV-008 | Conversion document | [Pandoc] docx → epub | Partiel | P2 | bureau natif : aiguiller (docx_to_html texte brut → html_to_epub) : un seul chapitre, ni images ni styles, auteur figé « UniversalConverter » (documents.rs build_epub) ; navigateur : grisé |
| CV-009 | Conversion document | [Convertio] docx → doc (Word 97-2003) | Absent | P3 | TEXT_OUT sans doc (packages/docx : .doc en lecture seule) ; outil externe LibreOffice (--convert-to doc) détecté par capacites() ; aucun crate Rust d'écriture BIFF/CFB Word |
| CV-010 | Conversion document | [LibreOffice] docx → docm / dotx / dotm | OK | P3 | le paquet écrit ces formats (WritableFormat de packages/docx/src/formats.ts) mais TEXT_OUT de formats.ts et LABELS ne les proposent pas : ajouter à TEXT_OUT/ALL_TARGETS ; 2026-11-06 : docm, dotx, dotm proposés en sortie (formats.ts TEXT_OUT) ; suite-formats.test.ts vérifie les types de contenu ; vérifié dans le navigateur |
| CV-011 | Conversion document | [LibreOffice] doc (binaire Word 97-2003) → docx / odt / html / md / rtf / txt | Présent à vérifier | OK | navigateur + bureau : readDoc de packages/docx/src/doc via viaSuite |
| CV-012 | Conversion document | [LibreOffice] doc → pdf / epub | Partiel | P2 | bureau + outil externe LibreOffice seulement (OFFICE_FIDELE de conv/mod.rs) ; le pivot natif doc_to_text lit un zip et échoue sur un .doc binaire (INVENTAIRE.md) : router d'abord doc → docx par la suite TS puis natif |
| CV-013 | Conversion document | [LibreOffice] odt → docx / rtf / html / md / txt | Présent à vérifier | OK | navigateur + bureau : viaSuite, readOdt de packages/docx/src/odt |
| CV-014 | Conversion document | [LibreOffice] odt → pdf | Partiel | P1 | idem docx → pdf : bureau natif Courier texte seul (odf_to_text de documents.rs) ou bureau + outil externe LibreOffice ; navigateur : grisé |
| CV-015 | Conversion document | [LibreOffice] ott / dot / xhtml / text en entrée | OK | P3 | packages/docx/src/formats.ts EXTENSIONS les connaît (ott, dot, xhtml, text) mais TEXT_IN de formats.ts non : ajouter ; 2026-11-06 : ott, dot, xhtml, text acceptés en entrée (TEXT_IN) ; test suite-formats.test.ts |
| CV-016 | Conversion document | [LibreOffice] rtf → docx / odt / html / md / txt | Présent à vérifier | OK | navigateur + bureau : viaSuite, readRtf de packages/docx/src/rtf |
| CV-017 | Conversion document | [LibreOffice] rtf → pdf / epub | Partiel | P2 | bureau natif : rtf_extract de donnees.rs (texte seul) puis Courier/epub un chapitre ; LibreOffice en option pour pdf |
| CV-018 | Conversion document | [Pandoc] html → docx | Présent à vérifier | OK | navigateur + bureau : viaSuite, readHtml de packages/docx/src/html (styles, tableaux, images) |
| CV-019 | Conversion document | [Pandoc] html → odt / rtf | Présent à vérifier | OK | navigateur + bureau : viaSuite |
| CV-020 | Conversion document | [Pandoc] html → md | Présent à vérifier | OK | navigateur + bureau : viaSuite (writeMarkdown) ; natif html_to_md (htmd) non utilisé car la suite passe d'abord |
| CV-021 | Conversion document | [Pandoc] html → txt | Présent à vérifier | OK | navigateur + bureau : viaSuite |
| CV-022 | Conversion document | [Pandoc] html → pdf (CSS, images, mise en page web) | Partiel | P1 | bureau natif : texte.rs html_to_pdf = extract_text_from_html + Courier : CSS/images/tableaux perdus ; manque un rendu HTML : Edge/Chromium headless --print-to-pdf détecté par capacites() (msedge.exe présent sur tout Windows 10/11) ; navigateur : grisé |
| CV-023 | Conversion document | [Pandoc] html → epub | Partiel | P2 | bureau natif : documents.rs html_to_epub (htmd → pulldown-cmark → XHTML), un chapitre, images/CSS perdus ; navigateur : grisé |
| CV-024 | Conversion document | [Pandoc] md (commonmark / gfm) → docx | Présent à vérifier | OK | navigateur + bureau : viaSuite, readMarkdown de packages/docx/src/md (structure conservée) ; le md_to_docx natif (ligne à ligne) n'est pas utilisé |
| CV-025 | Conversion document | [Pandoc] md → odt / rtf / html / txt | Présent à vérifier | OK | navigateur + bureau : viaSuite |
| CV-026 | Conversion document | [Pandoc] md → pdf | Partiel | P1 | bureau natif : texte.rs md_to_pdf = extract_text_from_md (syntaxe retirée) + Courier : titres, gras, listes, tableaux, code perdus ; voir html → pdf pour le rendu propre |
| CV-027 | Conversion document | [Pandoc] md → epub | Partiel | P2 | bureau natif : documents.rs md_to_epub (pulldown-cmark Options::all → XHTML), un chapitre, titre = nom du fichier, ni TOC ni couverture ni CSS |
| CV-028 | Conversion document | [Pandoc] txt → docx / odt / rtf / html / md | Présent à vérifier | OK | navigateur + bureau : viaSuite, readText avec détection d'encodage (packages/docx/src/txt.ts) |
| CV-029 | Conversion document | [Pandoc] txt → pdf | Partiel | P1 | bureau natif : texte.rs txt_to_pdf → pdf/texte.rs texte_vers_pdf : A4, Courier 10 pt, police standard WinAnsi (CJK, cyrillique, emoji non rendus) ; ni police ni marges réglables ; navigateur : grisé |
| CV-030 | Conversion document | [Pandoc] txt → epub | Partiel | P3 | bureau natif : documents.rs txt_to_epub (un chapitre) ; navigateur : grisé |
| CV-031 | Conversion document | [Pandoc] LaTeX (tex) → docx / html / pdf / epub | Absent | P2 | aucun lecteur LaTeX ; outil externe pandoc détecté par capacites() (Outil::Pandoc à ajouter dans outils.rs) ; pas de crate Rust mûr |
| CV-032 | Conversion document | [Pandoc] reStructuredText (rst) → html / docx / md | Absent | P3 | pandoc externe ; Rust pur : lecteur rst minimal (titres, listes, blocs de code) via pulldown-cmark-like maison |
| CV-033 | Conversion document | [Pandoc] Org-mode → html / docx / md | Absent | P3 | pandoc externe ; crate orgize en lecture seule |
| CV-034 | Conversion document | [Pandoc] AsciiDoc → html / docx / pdf | Absent | P3 | pandoc n'écrit que de l'AsciiDoc : asciidoctor externe ; pas de crate Rust complet |
| CV-035 | Conversion document | [Pandoc] MediaWiki / DokuWiki / Textile / Jira / TWiki → html / md | Absent | P3 | pandoc externe ; balisages courts, lecteurs Rust faisables au cas par cas |
| CV-036 | Conversion document | [Pandoc] Jupyter notebook (ipynb) → md / html / pdf | OK | P2 | Rust pur : ipynb = JSON (serde_json déjà lié) : cellules markdown/code/sorties → pulldown-cmark → HTML/EPUB ; nbconvert externe en option ; 2026-11-06 : notebook.ts : cellules Markdown, code en blocs, sorties texte et images PNG/JPEG, erreurs sans ANSI, puis moteur Texte vers docx, odt, rtf, html, md, txt ; notebook.test.ts + navigateur |
| CV-037 | Conversion document | [Pandoc] DocBook / JATS / TEI (XML) → html / docx | Absent | P3 | quick-xml déjà lié : table de correspondance balises → blocs du modèle docx ; sinon pandoc |
| CV-038 | Conversion document | [Pandoc] OPML → md / html / txt | Absent | P3 | quick-xml (outlines imbriqués → listes) ; effort S |
| CV-039 | Conversion document | [Pandoc] man (roff) → html / txt / md | Absent | P3 | mandoc/groff externe ou pandoc ; pas de crate roff complet |
| CV-040 | Conversion document | [Pandoc] md / html / docx → LaTeX (tex) | Absent | P3 | pandoc externe ; écriture LaTeX simple faisable en Rust depuis le modèle docx |
| CV-041 | Conversion document | [Pandoc] md ↔ rst / org / asciidoc / mediawiki (sorties) | Absent | P3 | pandoc externe uniquement |
| CV-042 | Conversion document | [Pandoc] docx / html / md → pptx (diapos depuis les titres) | Absent | P3 | TS : construire un Deck de packages/pptx depuis les niveaux de titre |
| CV-043 | Conversion document | [LibreOffice] docx / odt → png / jpg (pages en images) | Absent | P2 | aucune chaîne : docx → pdf (LibreOffice) puis pdf → png (pdf/externe.rs rendre_pages) ; ajouter un pipeline multi-étapes (voir CV-A01) |
| CV-044 | Conversion document | [PDF24] pdf → docx (texte par page) | Partiel | P1 | bureau natif : aiguiller (d="pdf", f="docx") → texte_pdf puis text_to_doc : paragraphes sans mise en page, sans images ni tableaux ; navigateur : grisé |
| CV-045 | Conversion document | [PDF24] pdf → docx avec mise en page (colonnes, tableaux, images, polices) | Absent | P1 | pdf/texte.rs ignore les positions : exploiter geom.rs/décodage police pour regrouper lignes/colonnes puis écrire un modèle docx (TS packages/docx) ; alternative LibreOffice Draw import PDF (--infilter writer_pdf_import) |
| CV-046 | Conversion document | [PDF24] pdf → odt / rtf / epub | Partiel | P2 | bureau natif : pivot texte (conv/mod.rs aiguiller) ; mêmes limites que pdf → docx |
| CV-047 | Conversion document | [PDF24] pdf → html | Partiel | P2 | bureau natif : conv/mod.rs pdf_vers_html (<p> par ligne, <h2> par page), ni mise en page ni images |
| CV-048 | Conversion document | [PDF24] pdf → md | Partiel | P2 | bureau natif : le texte brut est écrit tel quel (aiguiller ("pdf","md")) sans syntaxe Markdown (titres, listes) |
| CV-049 | Conversion document | [PDF24] pdf → txt | Présent à vérifier | OK | navigateur pdf.js (engines.ts pdfText) et bureau natif pdf/texte.rs extraire (lopdf + ToUnicode, repli pdftotext) ; le natif est préféré si présent |
| CV-050 | Conversion document | [PDF24] pdf → txt en conservant la mise en page (colonnes) | Absent | P3 | pdftotext -layout (Outil::Pdftotext déjà détecté) ou tri des glyphes par position dans pdf/texte.rs |
| CV-051 | Conversion document | [PDF24] pdf scanné → docx / txt (OCR) | Absent | P2 | ocr existe seulement vers un PDF cherchable (externe.rs ocr, ocrmypdf) : enchaîner ocr puis extraction (pipeline) ; Tesseract direct si ocrmypdf absent |
| CV-052 | Conversion document | [PDF24] page web (URL) → pdf | Absent | P2 | aucune récupération d'URL ; Edge/Chromium headless --print-to-pdf (détecté par capacites()) ou WebView2 PrintToPdf côté Tauri |
| CV-053 | Conversion document | [Convertio] eml / msg (e-mail) → pdf / txt / html | Absent | P3 | crate mail-parser (pur Rust) pour eml ; msg via msg_parser ; puis html → pdf |
| CV-054 | Conversion document | [Convertio] xps / oxps / cbz / ps / eps / djvu → pdf | Absent | P3 | mutool convert (xps, cbz, epub) ou Ghostscript (ps/eps) déjà détectés par outils.rs ; djvu : djvulibre externe |
| CV-055 | Conversion document | [LibreOffice] wps / wpd / pages / abw / lwp (formats tiers) → docx | Absent | P3 | filtres d'import LibreOffice via soffice --convert-to docx ; aucun crate Rust |
| CV-056 | Conversion document | [Pandoc] standalone (--standalone) : document HTML/LaTeX complet avec en-tête | Partiel | P3 | HTML complet déjà produit par la suite (writeHtml) et les pivots natifs ; pas de choix fragment/complet |
| CV-057 | Conversion document | [LibreOffice] document Word / OpenDocument protégé par mot de passe en entrée | OK | P2 | packages/docx readDocument accepte password (DocxPasswordError, decryptOoxml) mais engines.ts viaSuite ne le transmet pas : demander le mot de passe dans l'interface sur cette erreur ; 2026-11-06 : mot de passe demandé dans la colonne État (champ + Déverrouiller), conversion relancée ; testé avec les vrais fichiers chiffrés Word, Excel, PowerPoint de packages/opc/tests/fixtures + navigateur |

## 2. Livres numériques (EPUB, MOBI, AZW3, FB2, bandes dessinées)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-058 | Conversion document | [Convertio] epub → txt | Présent à vérifier | OK | bureau natif : documents.rs epub_to_text via epub.rs lire_epub (spine, ordre de lecture, lectures bornées) ; navigateur : grisé |
| CV-059 | Conversion document | [Convertio] epub → html | Partiel | P2 | bureau natif : documents.rs epub_to_html (chapitres concaténés séparés par <hr>) ; images, CSS et liens internes perdus |
| CV-060 | Conversion document | [Convertio] epub → md | Partiel | P2 | bureau natif : epub_to_html puis htmd (conv/mod.rs aiguiller) ; images perdues |
| CV-061 | Conversion document | [Convertio] epub → pdf | Partiel | P1 | bureau natif : pivot texte (epub_text_string) + Courier ; ni images, ni couverture, ni polices |
| CV-062 | Conversion document | [Convertio] epub → docx / odt / rtf | Partiel | P2 | bureau natif : pivot texte ; pas de structure de chapitres |
| CV-063 | Conversion document | [Convertio] epub → mobi / azw3 / kfx | Absent | P2 | calibre ebook-convert externe (Outil::Calibre à ajouter) ; aucun écrivain KF8 en Rust |
| CV-064 | Conversion document | [Convertio] mobi / azw3 / azw → epub / txt / pdf | Absent | P2 | crate mobi (lecture pure Rust) vers HTML puis écrivain epub de ecriture_zip.rs ; sinon calibre ; DRM non pris en charge |
| CV-065 | Conversion document | [Pandoc] FB2 (FictionBook) ↔ epub / docx / txt | Absent | P3 | FB2 = XML + images base64 : lecteur/écrivain quick-xml (effort S/M) ; pandoc lit et écrit FB2 |
| CV-066 | Conversion document | [Pandoc] epub : plusieurs chapitres avec table des matières (sortie) | Absent | P2 | ecriture_zip.rs epub() n'écrit qu'un chapitre sans nav multi-niveaux : découper aux titres h1/h2, générer nav.xhtml et toc.ncx |
| CV-067 | Conversion document | [Pandoc] epub : métadonnées (titre, auteur, langue, éditeur, date), couverture, feuille de style | Absent | P2 | paramètres absents de OptionsConversion : l'auteur est figé à « UniversalConverter » (documents.rs build_epub) ; ajouter champs + éditeur de métadonnées |
| CV-068 | Conversion document | [Convertio] epub → epub (réparer, changer métadonnées/couverture sans reconvertir) | Absent | P3 | lecture epub.rs déjà bornée : réécriture de l'OPF dans l'archive d'origine |
| CV-069 | Conversion document | [Convertio] cbz / cbr (bande dessinée) ↔ pdf / epub | Absent | P3 | cbz = zip d'images : images_vers_pdf existant ; cbr = rar (crate unrar C) ; extraction images pdf/images.rs |

## 3. Tableurs et classeurs (XLSX, XLS, ODS, CSV, TSV)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-070 | Conversion tableur | [LibreOffice] xlsx → ods | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite (readWorkbook/writeWorkbook de @forgeoffice/xlsx, writeOds) |
| CV-071 | Conversion tableur | [LibreOffice] ods → xlsx | Présent à vérifier | OK | navigateur + bureau : viaSuite, readOds/writeXlsx |
| CV-072 | Conversion tableur | [LibreOffice] xls (binaire) → xlsx / ods | Présent à vérifier | OK | navigateur + bureau : viaSuite, readXls de packages/xlsx/src/xls |
| CV-073 | Conversion tableur | [LibreOffice] xlsx → csv | Présent à vérifier | OK | navigateur + bureau : viaSuite, writeCsv (feuille active, « ; », virgule décimale, BOM UTF-8, formules neutralisées escapeFormulas) ; réglages non exposés (voir Options) |
| CV-074 | Conversion tableur | [LibreOffice] xlsx / ods → tsv | Présent à vérifier | OK | navigateur + bureau : viaSuite, writeWorkbook 'tsv' |
| CV-075 | Conversion tableur | [LibreOffice] csv (encodage, séparateur, décimale, dates détectés) → xlsx | Présent à vérifier | OK | navigateur + bureau : viaSuite, readCsv/detectSeparator/decodeText de packages/xlsx/src/csv.ts |
| CV-076 | Conversion tableur | [LibreOffice] csv / tsv → ods | Présent à vérifier | OK | navigateur + bureau : viaSuite |
| CV-077 | Conversion tableur | [LibreOffice] xlsx → xls (Excel 97-2003) | Absent | P3 | readXls seul (lecture) ; aucun écrivain BIFF8 en Rust : LibreOffice externe (--convert-to xls) |
| CV-078 | Conversion tableur | [LibreOffice] xlsx → xlsm / xltx / xltm | OK | P3 | writeWorkbook gère ces formats (packages/xlsx/src/formats.ts) mais SHEET_OUT de formats.ts non ; 2026-11-06 : xlsm, xltx, xltm proposés en sortie (SHEET_OUT) ; test suite-formats.test.ts |
| CV-079 | Conversion tableur | [LibreOffice] xlsx / xls / ods → pdf (colonnes, styles, pagination) | Partiel | P1 | bureau natif : excel_to_txt (tabulations, toutes feuilles) + Courier, sans quadrillage ni largeurs ; bureau + outil externe LibreOffice si « haute fidélité » (OFFICE_FIDELE) ; navigateur : grisé |
| CV-080 | Conversion tableur | [LibreOffice] xlsx → pdf rendu propre sans LibreOffice | Absent | P1 | pagination de feuille en TS (colonnes, bordures, formats de nombre du moteur xlsx) vers PDF vectoriel en réutilisant packages/powerpoint/src/pdf/writer.ts |
| CV-081 | Conversion tableur | [LibreOffice] xlsx → html | OK | P2 | bureau natif : office.rs excel_to_csv puis donnees.rs csv_to_html_table : 1re feuille, sans styles/fusions/formats ; navigateur : SHEET_OUT sans html alors que le paquet pourrait l'écrire ; 2026-11-06 : xlsx/ods/csv vers html par sheet-data.ts (toutes les feuilles visibles, nombres alignés, contenu échappé) ; sheet-data.test.ts ; navigateur et bureau |
| CV-082 | Conversion tableur | [Pandoc] xlsx / csv → md (tableau) | OK | P3 | bureau natif : csv_to_markdown (1re feuille) ; échappement / et sauts de ligne seulement ; 2026-11-06 : classeur vers Markdown typé par sheet-data.ts : une table par feuille, | et sauts de ligne échappés ; test sheet-data.test.ts |
| CV-083 | Conversion tableur | [Convertio] xlsx → json | OK | P2 | bureau natif : office.rs excel_to_json : toutes les feuilles, 1re ligne = clés, valeurs en chaînes (nombres, dates, booléens perdus) ; plafond 500 000 cellules ; 2026-11-06 : classeur vers JSON typé (nombres, booléens, dates ISO) : un tableau pour une feuille, un objet par feuille sinon ; navigateur et bureau (le natif n'est plus préféré) |
| CV-084 | Conversion tableur | [Convertio] xlsx → xml / yaml / toml | Partiel | P3 | bureau natif : excel_to_json puis convert_data ; mêmes pertes de types |
| CV-085 | Conversion tableur | [Convertio] xlsx → txt | Partiel | P3 | bureau natif : excel_to_txt (tabulations, toutes feuilles) |
| CV-086 | Conversion tableur | [Convertio] csv → json | OK | P1 | bureau natif : office.rs csv_to_json : toutes valeurs en chaînes, séparateur virgule fixe, UTF-8 seul (read_to_string) ; 2026-11-06 : csv vers json typé par la suite TypeScript (séparateur, encodage et décimale détectés par @forgeoffice/xlsx) ; navigateur et bureau |
| CV-087 | Conversion tableur | [Convertio] csv ; ou tabulation → json / xml / yaml | OK | P1 | le natif ne détecte pas le séparateur (csv::ReaderBuilder par défaut) alors que packages/xlsx/src/csv.ts detectSeparator le fait : router csv → json via readCsv TS ou porter la détection en Rust ; 2026-11-06 : séparateur détecté par readCsv (point-virgule, tabulation, |) : la conversion csv vers json passe par la suite |
| CV-088 | Conversion tableur | [Convertio] csv Windows-1252 / UTF-16 en entrée (côté natif) | Partiel | P1 | le natif lit en UTF-8 strict (std::fs::read_to_string) : erreur sur un CSV Excel français ; decodeText (TS) sait détecter BOM/UTF-16/1252 : porter dans conv/donnees.rs (encoding_rs) |
| CV-089 | Conversion tableur | [Convertio] csv → html / md / txt / pdf | Partiel | P3 | bureau natif : csv_to_html_table, csv_to_markdown, csv_to_txt, txt_to_pdf (Courier) |
| CV-090 | Conversion tableur | [Convertio] csv → xml / yaml / toml | Partiel | P3 | bureau natif : donnees.rs convert_data (csv_to_value : toutes valeurs en chaînes) |
| CV-091 | Conversion tableur | [Convertio] json (tableau d'objets) → xlsx / csv | Partiel | P2 | bureau natif : mod.rs json_vers_csv (en-têtes du premier objet seulement) puis csv_to_xlsx ; sous-objets sérialisés en texte, cellules non typées |
| CV-092 | Conversion tableur | [Convertio] yaml / toml / xml → xlsx / csv | Partiel | P3 | bureau natif : convert_data → CSV → csv_to_xlsx ; structure imbriquée aplatie en texte |
| CV-093 | Conversion tableur | [Convertio] xlsx / csv → sqlite | Absent | P3 | crate rusqlite (feature bundled) : une table par feuille, types inférés ; sqlite3 externe en repli |
| CV-094 | Conversion tableur | [Convertio] sqlite → csv / json / xlsx | Absent | P3 | rusqlite (lecture seule), plafonds de lignes |
| CV-095 | Conversion tableur | [LibreOffice] classeur multi-feuilles → un CSV par feuille (ZIP) | OK | P2 | writeCsv accepte sheetIndex (packages/xlsx) : boucle sur les feuilles + zip ; le natif excel_to_csv ne prend que la 1re feuille ; 2026-11-06 : option « Une feuille par fichier » (CSV/TSV) : un fichier par feuille visible, rangés en ZIP à l'enregistrement ; test sheet-data.test.ts + navigateur |
| CV-096 | Conversion tableur | [LibreOffice] plage / graphique d'un classeur → png / pdf | Absent | P3 | rendu de plage en TS (canvas) ou LibreOffice externe |
| CV-097 | Conversion tableur | [Convertio] ndjson / jsonl / parquet ↔ csv / json | Absent | P3 | ndjson : serde_json::StreamDeserializer ; parquet : crate parquet (lourd, optionnel) |
| CV-098 | Conversion tableur | [LibreOffice] Numbers / Gnumeric / dBase (dbf) / Lotus → xlsx | Absent | P3 | LibreOffice externe ; dbf : crate dbase pur Rust |
| CV-099 | Conversion tableur | [LibreOffice] classeur protégé par mot de passe → xlsx / csv | OK | P2 | @forgeoffice/opc sait déchiffrer OOXML (decryptOoxml) mais convertFile ne transmet pas de mot de passe : demander le mot de passe (boîte de dialogue) et le passer à readWorkbook ; 2026-11-06 : classeur chiffré xlsx : même invite de mot de passe que pour les documents ; test avec excel-agile.xlsx |
| CV-100 | Conversion tableur | [Convertio] pdf → xlsx / csv (extraction de tableaux) | Absent | P2 | pdf/texte.rs extrait le texte sans positions : regrouper les glyphes en lignes/colonnes (geom.rs, décodage police) puis écrire via rust_xlsxwriter ; Tabula/Camelot externes en repli |
| CV-101 | Conversion tableur | [Convertio] xlsx / csv → docx (tableau mis en forme) | Absent | P3 | TS : construire un bloc tableau du modèle packages/docx depuis la feuille (bordures, largeurs, formats de nombre) |
| CV-102 | Conversion tableur | [Convertio] tableaux d'un docx / html → xlsx / csv | Absent | P3 | lire les tableaux du modèle packages/docx (readDocument) puis writeWorkbook ; une feuille par tableau |

## 4. Présentations (PPTX, PPT, ODP, PPSX)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-103 | Conversion présentation | [LibreOffice] pptx → ppsx / potx | Présent à vérifier | OK | navigateur + bureau : engines.ts viaSuite (openPresentation/writePptx format) de @forgeoffice/pptx |
| CV-104 | Conversion présentation | [LibreOffice] pptx → pptm / potm / ppsm | OK | P3 | DeckFormat de packages/pptx/src/model.ts les écrit, DECK_OUT de formats.ts non ; 2026-11-06 : pptm, potm, ppsm proposés en sortie (DECK_OUT) ; test suite-formats.test.ts |
| CV-105 | Conversion présentation | [LibreOffice] odp → pptx | Présent à vérifier | OK | navigateur + bureau : openPresentation lit l'ODP (packages/pptx/src/odp.ts) puis writePptx |
| CV-106 | Conversion présentation | [LibreOffice] ppt (binaire) → pptx | Présent à vérifier | OK | navigateur + bureau : packages/pptx/src/ppt.ts via viaSuite |
| CV-107 | Conversion présentation | [LibreOffice] pps / pot (anciens) → pptx | OK | P3 | PRESENTATION_EXTENSIONS de packages/pptx les connaît, DECK_IN de formats.ts non : ajouter ; 2026-11-06 : pps et pot acceptés en entrée (DECK_IN) ; test suite-formats.test.ts |
| CV-108 | Conversion présentation | [LibreOffice] pptx → odp | OK | P2 | writeOdp est exporté par packages/pptx/src/index.ts (odp-write.ts) mais ni DECK_OUT ni engines.ts ne l'appellent : brancher (effort S) ; 2026-11-06 : pptx/ppt/odp vers odp par writeOdp (viaSuite) ; test suite-formats.test.ts + navigateur |
| CV-109 | Conversion présentation | [LibreOffice] pptx → ppt (PowerPoint 97-2003) | Absent | P3 | aucun écrivain PPT ; LibreOffice externe |
| CV-110 | Conversion présentation | [LibreOffice] pptx → pdf (mise en page conservée) | Partiel | P1 | bureau natif : office.rs pptx_to_text (texte des diapos) + Courier ; bureau + outil externe LibreOffice si « haute fidélité » ; navigateur : grisé |
| CV-111 | Conversion présentation | [LibreOffice] pptx → pdf vectoriel avec le moteur de la suite | Absent | P1 | packages/powerpoint/src/pdf/index.ts buildVectorPdf existe (module PowerPoint) mais n'est pas appelé par le Convertisseur : l'exposer via @forgeoffice/pptx et le brancher dans engines.ts (navigateur + bureau) |
| CV-112 | Conversion présentation | [LibreOffice] odp → pdf | Partiel | P1 | bureau natif : odf_to_text (texte seul) + Courier ou LibreOffice ; navigateur : grisé |
| CV-113 | Conversion présentation | [LibreOffice] pptx / odp → png / jpg (une image par diapositive) | Absent | P1 | rendu des diapos : buildVectorPdf puis rendu (pdf.js navigateur / rendu_simple natif) ; LibreOffice --convert-to png ne rend que la 1re diapo |
| CV-114 | Conversion présentation | [LibreOffice] pptx → svg (par diapositive) | Absent | P3 | écrire svg-vector.ts (packages/powerpoint/src/pdf) hors PDF |
| CV-115 | Conversion présentation | [LibreOffice] pptx → txt / md / html (plan, texte des diapos) | Partiel | P2 | bureau natif : pptx_to_text (diapos séparées) puis pivot texte ; notes de l'orateur absentes |
| CV-116 | Conversion présentation | [Pandoc] pptx → docx (plan / notes) | Partiel | P3 | bureau natif : pivot texte docx ; ni notes ni images |
| CV-117 | Conversion présentation | [LibreOffice] pptx → gif animé / mp4 (diaporama) | Absent | P3 | rendu diapos + FFmpeg externe (durée par diapo) |
| CV-118 | Conversion présentation | [LibreOffice] pptx → pdf pages de notes / documents / plusieurs diapos par page | Absent | P3 | options de mise en page d'export (handout) à créer dans buildVectorPdf |
| CV-119 | Conversion présentation | [PDF24] pdf → pptx (une page = une diapositive en image) | Absent | P2 | rendu_simple ou rendu externe → png → Deck de packages/pptx (image plein cadre) ; effort M |
| CV-120 | Conversion présentation | [PDF24] pdf → pptx éditable (texte + formes) | Absent | P3 | nécessite la reconstruction de mise en page décrite pour pdf → docx |
| CV-121 | Conversion présentation | [Convertio] images → pptx (une image par diapositive) | Absent | P2 | packages/pptx : deck vierge + médias ; effort S |
| CV-122 | Conversion présentation | [Pandoc] Markdown / plan → pptx | Absent | P3 | TS : titres → diapos (réutilise le même générateur que docx → pptx) |
| CV-123 | Conversion présentation | [LibreOffice] pptx : compresser les images / réduire la taille | Absent | P3 | ré-échantillonnage des médias du paquet OPC (image crate côté natif ; canvas côté navigateur) |

## 5. Images (matrice de formats ImageMagick / libvips / Convertio)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-124 | Conversion image | [ImageMagick] png → jpg | Présent à vérifier | OK | navigateur canvas (engines.ts viaCanvas, fond blanc posé) et bureau natif (conv/images.rs convert_image_file, save_as_jpeg) ; le natif est préféré s'il existe |
| CV-125 | Conversion image | [ImageMagick] jpg → png | Présent à vérifier | OK | navigateur canvas + bureau natif convert_image_file |
| CV-126 | Conversion image | [ImageMagick] png / jpg → webp | Partiel | P2 | navigateur : canvas (qualité respectée) ; bureau natif PRÉFÉRÉ par planEngine : image crate WebP en lossless seul, le curseur Qualité est ignoré (conv/images.rs save_image) : fichiers lourds ; ajouter un encodeur lossy (crate webp, libwebp) ou laisser le canvas gagner pour webp |
| CV-127 | Conversion image | [ImageMagick] webp → png / jpg | Présent à vérifier | OK | navigateur canvas + bureau natif (décodage VP8/VP8L image-webp) |
| CV-128 | Conversion image | [ImageMagick] png / jpg / webp → gif (statique) | Partiel | P3 | bureau natif : GifEncoder de image (quantification, une image) ; navigateur : grisé (CANVAS_OUT sans gif) |
| CV-129 | Conversion image | [ImageMagick] bmp → png / jpg / webp | Présent à vérifier | OK | navigateur canvas (CANVAS_IN contient bmp) + bureau natif |
| CV-130 | Conversion image | [ImageMagick] png / jpg → bmp | Présent à vérifier | OK | bureau natif : OutputFormat::Bmp ; navigateur : grisé |
| CV-131 | Conversion image | [ImageMagick] tiff / tif → png / jpg / webp / pdf | Présent à vérifier | OK | bureau natif : IMAGES_ENTREE de conv/mod.rs (première page) ; navigateur : grisé |
| CV-132 | Conversion image | [ImageMagick] png / jpg → tiff (compression LZW/Deflate/CCITT, 16 bits) | Partiel | P3 | bureau natif : OutputFormat::Tiff une page, compression non réglable ; navigateur : grisé |
| CV-133 | Conversion image | [ImageMagick] tiff multi-pages → pdf / png par page | Absent | P2 | image::open ne lit que la 1re page : crate tiff (déjà liée) avec décodage par page, puis images_vers_pdf ; sortie multi-fichiers déjà gérée (zip) |
| CV-134 | Conversion image | [ImageMagick] png / jpg → ico (icône Windows) | Partiel | P2 | bureau natif : thumbnail 256×256 maximum, une seule taille (images.rs convert_image_file) ; manque 16/24/32/48/64/128/256 dans un ICO (crate ico) ; navigateur : grisé |
| CV-135 | Conversion image | [ImageMagick] ico → png / jpg | Présent à vérifier | OK | bureau natif : IMAGES_ENTREE contient ico (image crate, plus grande taille) ; extraction de chaque taille : absente |
| CV-136 | Conversion image | [Convertio] png / jpg → avif | Partiel | P2 | bureau natif : ravif via la feature avif de image (qualité/vitesse figées, RGBA 8 bits) ; navigateur : grisé |
| CV-137 | Conversion image | [Convertio] avif → png / jpg | Absent | P2 | la feature avif de Cargo.toml est l'encodeur seul : activer avif-native (dav1d C) ou décodeur pur Rust ; navigateur : ajouter avif à CANVAS_IN de formats.ts (WebView2/Chromium le décode) = correctif S |
| CV-138 | Conversion image | [Convertio] heic / heif (iPhone) → jpg / png | Absent | P1 | aucun décodeur : outil externe détecté par capacites() (ImageMagick magick avec libheif, heif-convert), WIC sous Windows (extension HEIF), ou crate libheif-rs (C) ; le plus demandé des formats manquants |
| CV-139 | Conversion image | [ImageMagick] jxl (JPEG XL) ↔ png / jpg | Absent | P3 | décodage : crate jxl-oxide (pur Rust) ; encodage : jpegxl-rs (C) ou cjxl externe |
| CV-140 | Conversion image | [ImageMagick] psd (Photoshop) → png / jpg / pdf | Absent | P2 | crate psd (pur Rust, image aplatie) ; calques séparés : option avancée ; xcf (GIMP) via GIMP/ImageMagick externe |
| CV-141 | Conversion image | [ImageMagick] raw (cr2, nef, arw, dng, orf, raf, rw2) → jpg / tiff | Absent | P2 | crate rawler/rawloader (pur Rust, développement basique) ; dcraw/libraw ou ImageMagick externe pour la qualité |
| CV-142 | Conversion image | [ImageMagick] tga / qoi / ppm-pnm / farbfeld ↔ png / jpg | Présent à vérifier | OK | bureau natif : IMAGES_ENTREE/IMAGES_SORTIE de conv/mod.rs (image crate) ; navigateur : grisé |
| CV-143 | Conversion image | [ImageMagick] exr / hdr → png / jpg (tone mapping) | Partiel | P3 | bureau natif : lecture OK mais réduction 8 bits sans tone mapping (to_rgb8 écrête) ; ajouter exposition/gamma |
| CV-144 | Conversion image | [ImageMagick] dds (textures) → png ; png → dds | Partiel | P3 | lecture dds OK (IMAGES_ENTREE) ; écriture dds absente de IMAGES_SORTIE : crate image_dds / texpresso |
| CV-145 | Conversion image | [ImageMagick] jfif / jpe / pbm / pgm / pam / apng en entrée | Partiel | P3 | alias absents de IMAGES_ENTREE (conv/mod.rs) et de formats.ts : ajouter les extensions (S) |
| CV-146 | Conversion image | [ImageMagick] svg → png / jpg / webp | Présent à vérifier | OK | navigateur canvas (decodeImage SVG) et bureau natif resvg (images.rs svg_to_dynamic_image : plafond 64 Mpx, aucune ressource disque lue) |
| CV-147 | Conversion image | [ImageMagick] svg → bmp / avif / qoi | Présent à vérifier | OK | bureau natif : conv/mod.rs prise_en_charge (d="svg") ; navigateur : grisé |
| CV-148 | Conversion image | [ImageMagick] svg : texte (polices système), échelle vectorielle et DPI | Partiel | P2 | usvg::Options::default() sans chargement de polices (fontdb vide, probable absence de rendu des <text>) ; largeur/hauteur appliquées APRÈS rasterisation (flou) au lieu d'un rendu à l'échelle : charger fontdb système, rendre avec transform scale |
| CV-149 | Conversion image | [ImageMagick] svg → pdf | Partiel | P3 | bureau natif : images_vers_pdf rastérise le SVG (pdf/images.rs xobject_fichier) au lieu d'un PDF vectoriel ; navigateur : canvas rastérisé |
| CV-150 | Conversion image | [ImageMagick] png / jpg → svg (vectorisation) | Absent | P3 | crate vtracer (pur Rust) ; potrace externe ; voir CV-A19 |
| CV-151 | Conversion image | [ImageMagick] svg → svg (optimiser / minifier) | Absent | P3 | usvg::Tree::to_string(&WriteOptions) pour réécrire un SVG nettoyé |
| CV-152 | Conversion image | [Convertio] eps / ai / emf / wmf / cdr / xps → svg / png / pdf | Absent | P3 | eps : Ghostscript (détecté) ; ai récent = PDF ; emf/wmf : Inkscape/LibreOffice externe ; aucun crate pur Rust |
| CV-153 | Conversion image | [ImageMagick] pdf → svg (une page = un SVG) | Absent | P3 | mutool draw -F svg ou pdftocairo -svg (Poppler) détectés ; Rust : sortie vectorielle depuis pdf/rendu/interprete.rs |
| CV-154 | Conversion image | [ImageMagick] gif animé → gif (conserver / redimensionner / optimiser les images) | Absent | P2 | image::open ne garde que la 1re image (conv/images.rs) : GifDecoder::into_frames + GifEncoder, délais et boucle conservés |
| CV-155 | Conversion image | [ImageMagick] gif animé → png (images) / webp animé / apng / mp4 | Absent | P2 | into_frames pour les PNG (zip) ; webp animé : crate webp-animation (C) ; mp4/webm : FFmpeg externe |
| CV-156 | Conversion image | [ImageMagick] webp animé / apng → gif | Absent | P3 | décodeurs d'animation de image (WebPDecoder, PngDecoder::apng) + GifEncoder |
| CV-157 | Conversion image | [PDF24] images (jpg, png, tiff, webp, bmp, gif, svg) → pdf, une page par image | Présent à vérifier | OK | navigateur engines.ts imagesToOnePdf (pdf-lib, page = taille de l'image à 72 ppp) et bureau natif pdf/images.rs images_vers_pdf (JPEG repris sans recompression, alpha en SMask, 96 ppp) ; deux échelles différentes à unifier |
| CV-158 | Conversion image | [PDF24] plusieurs images → un seul PDF | Présent à vérifier | OK | Convert.tsx imagesToPdf (bouton Outils PDF > Images en un PDF), ordre = ordre de la liste, engines.ts imagesToOnePdf |
| CV-159 | Conversion image | [PDF24] pdf → png / jpg (une image par page) | Présent à vérifier | OK | navigateur pdf.js (engines.ts pdfPages, 150 ppp fixes, qualité jpg respectée) ; l'opération native PdfVersImages (36-600 ppp, rendu externe ou rendu_simple) n'est pas appelée par l'interface |
| CV-160 | Conversion image | [PDF24] pdf → tiff / webp / bmp / gif / ico (une image par page) | Absent | P3 | rendre_pages ne produit que png/jpg (pdf/externe.rs FormatImage) ; réencoder via images.rs OutputFormat ; tiff multi-pages : crate tiff |
| CV-161 | Conversion image | [PDF24] pdf → images, toutes les pages dans un seul TIFF ou une planche contact | Absent | P3 | assembler les pages rendues (image crate) ; multipage TIFF via crate tiff |
| CV-162 | Conversion image | [Convertio] image → docx / odt (image insérée dans une page) | Absent | P3 | packages/docx : document avec un bloc image (TS) ; effort S |
| CV-163 | Conversion image | [Convertio] image (scan, photo de texte) → txt (OCR) | Absent | P2 | Tesseract externe détecté par capacites() (Outil::Tesseract) ; Rust pur : crate ocrs (rten, modèles à embarquer) ; voir CV-A04 |
| CV-164 | Conversion image | [PDF24] image / scan → PDF cherchable (OCR) | Absent | P2 | images_vers_pdf puis ocr (ocrmypdf accepte déjà un PDF) : chaîner en une action ; ocrmypdf lit aussi les images via img2pdf |
| CV-165 | Conversion image | [ImageMagick] jpg → jpg, png → png (recompresser / redimensionner sans changer de format) | Absent | P1 | planEngine (formats.ts) renvoie null si from = to : impossible de réduire le poids d'une photo ou de la redimensionner en gardant son format ; autoriser les mêmes formats pour la famille image (et pdf → pdf via outils) |
| CV-166 | Conversion image | [ImageMagick] miniatures (thumbnails) d'un lot | Présent à vérifier | OK | Thumb.tsx/thumbs.ts : natif convert_miniatures (images.rs generate_thumbnail, 120 px) ou canvas/pdf.js pour la liste (40 px) |
| CV-167 | Conversion image | [ImageMagick] planche contact (montage de vignettes) en une image ou un PDF | Absent | P3 | image crate : imageops::overlay sur une grille, légendes via ab_glyph ; PDF via images_vers_pdf |

## 6. Audio et vidéo (FFmpeg)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-168 | Conversion audio/vidéo | [FFmpeg] mp3 → wav | Présent à vérifier | OK | bureau natif : audio.rs convert_audio (symphonia décode, hound écrit PCM 16 bits) ; navigateur : grisé ; plafond ~19 min stéréo 44,1 kHz (MAX_SAMPLES) |
| CV-169 | Conversion audio/vidéo | [FFmpeg] mp3 → flac | Présent à vérifier | OK | bureau natif : audio.rs write_flac (flacenc, niveau fixe) |
| CV-170 | Conversion audio/vidéo | [FFmpeg] ogg (vorbis) → wav / flac | Présent à vérifier | OK | bureau natif : symphonia vorbis (audio.rs decode_audio) |
| CV-171 | Conversion audio/vidéo | [FFmpeg] m4a / aac (AAC-LC) → wav / flac | Présent à vérifier | OK | bureau natif : symphonia isomp4 + aac ; HE-AAC non garanti |
| CV-172 | Conversion audio/vidéo | [FFmpeg] wav ↔ flac | Présent à vérifier | OK | bureau natif : audio.rs write_wav / write_flac |
| CV-173 | Conversion audio/vidéo | [FFmpeg] wav / flac / ogg / m4a → mp3 (CBR/VBR, 128-320 kbit/s) | Absent | P1 | aucun encodeur MP3 : crate mp3lame-encoder (LAME embarqué, C) ou FFmpeg externe détecté par capacites() (Outil::Ffmpeg) ; prise_en_charge n'a que wav/flac en sortie |
| CV-174 | Conversion audio/vidéo | [FFmpeg] audio → aac / m4a | Absent | P2 | FFmpeg (aac natif, libfdk_aac) ; Rust : pas d'encodeur AAC mûr (fdk-aac C) + mux crate mp4 |
| CV-175 | Conversion audio/vidéo | [FFmpeg] audio → ogg vorbis | Absent | P2 | crate vorbis_rs (libvorbis) ou FFmpeg externe |
| CV-176 | Conversion audio/vidéo | [FFmpeg] audio → opus (ogg/webm) | Absent | P2 | crate opus (libopus C) + ogg, ou FFmpeg externe |
| CV-177 | Conversion audio/vidéo | [FFmpeg] opus en entrée (décodage) | Absent | P2 | symphonia 0.5.5 n'a pas de décodeur Opus (Cargo.toml : mp3, aac, isomp4, vorbis, flac) : crate opus ou FFmpeg |
| CV-178 | Conversion audio/vidéo | [FFmpeg] wma / amr / ac3 / dts / mp2 / mka en entrée | Absent | P3 | FFmpeg seul ; symphonia ne couvre pas ces codecs |
| CV-179 | Conversion audio/vidéo | [FFmpeg] aiff / aif / caf ↔ wav | Absent | P3 | features aiff, caf (et alac) de symphonia non activées dans Cargo.toml : les activer et ajouter les extensions à prise_en_charge ; écriture AIFF : hound n'écrit pas AIFF, écrivain maison simple |
| CV-180 | Conversion audio/vidéo | [FFmpeg] alac / ape / wavpack / tta / dsd → flac | Absent | P3 | alac : feature symphonia ; ape/wv/dsd : FFmpeg |
| CV-181 | Conversion audio/vidéo | [FFmpeg] wav 24 bits / 32 bits flottant en sortie | Absent | P3 | audio.rs force i16 (SampleBuffer<i16>) : transporter f32 et laisser hound/flacenc écrire 24 bits |
| CV-182 | Conversion audio/vidéo | [Convertio] midi (mid) → wav / mp3 | Absent | P3 | crate rustysynth (SoundFont) pour la synthèse ; encodage mp3 voir ci-dessus |
| CV-183 | Conversion audio/vidéo | [FFmpeg] mp4 / mov / mkv / webm (piste audio) → mp3 / wav / flac / m4a | Absent | P2 | symphonia isomp4/mkv sait démultiplexer : ajouter mp4/m4v/mov/mkv/webm aux entrées audio de prise_en_charge (S) ; mp3/m4a en sortie : FFmpeg |
| CV-184 | Conversion audio/vidéo | [FFmpeg] vidéo → mp4 (H.264 + AAC, compatibilité maximale) | Absent | P1 | aucun traitement vidéo : FFmpeg externe détecté par capacites() (Outil::Ffmpeg, ffprobe) ; opération convert_video avec progression (-progress pipe:1) et annulation ; aucune alternative Rust viable |
| CV-185 | Conversion audio/vidéo | [FFmpeg] vidéo → webm (VP9 / AV1 + Opus) | Absent | P2 | FFmpeg (libvpx-vp9, libsvtav1/libaom) ; crate rav1e pour AV1 seul (très lent) |
| CV-186 | Conversion audio/vidéo | [FFmpeg] vidéo → H.265 / HEVC (mp4, mkv) | Absent | P2 | FFmpeg (libx265, NVENC/QSV si matériel) |
| CV-187 | Conversion audio/vidéo | [FFmpeg] mkv ↔ mp4 ↔ mov (remux sans réencodage, -c copy) | Absent | P2 | FFmpeg -c copy : instantané et sans perte ; crate mp4/matroska en Rust pour les cas simples |
| CV-188 | Conversion audio/vidéo | [FFmpeg] avi / wmv / flv / 3gp / mpg / ts / m2ts / vob / ogv → mp4 | Absent | P2 | FFmpeg externe |
| CV-189 | Conversion audio/vidéo | [FFmpeg] vidéo → gif animé (palette, dithering, fps, largeur) | Absent | P2 | FFmpeg palettegen + paletteuse ; ou décodage image par image et GifEncoder (image) pour les petits clips |
| CV-190 | Conversion audio/vidéo | [FFmpeg] gif animé → mp4 / webm | Absent | P2 | FFmpeg ; voir la ligne gif animé des images |
| CV-191 | Conversion audio/vidéo | [FFmpeg] vidéo → images (une image toutes les N secondes, ou images clés) | Absent | P2 | FFmpeg -vf fps=1/N ; sortie zip déjà gérée côté UI |
| CV-192 | Conversion audio/vidéo | [FFmpeg] vidéo → miniature (affiche, image à t secondes) | Absent | P2 | FFmpeg -ss -frames:v 1 ; Thumb.tsx pourrait l'utiliser pour l'aperçu de liste |
| CV-193 | Conversion audio/vidéo | [FFmpeg] vidéo : réduire la taille (cible en Mo, qualité CRF, 720p / 480p) | Absent | P2 | FFmpeg libx264 -crf / -b:v calculé depuis la durée (ffprobe), profils préréglés « WhatsApp 16 Mo », « e-mail 25 Mo » |
| CV-194 | Conversion audio/vidéo | [FFmpeg] vidéo → audio podcast (extraction + normalisation EBU R128) | Absent | P3 | FFmpeg loudnorm deux passes |
| CV-195 | Conversion audio/vidéo | [FFmpeg] audio : mono ↔ stéréo, rééchantillonnage 44,1 / 48 kHz, profondeur | Absent | P2 | rubato (rééchantillonnage pur Rust) + mixage canaux dans audio.rs ; ou FFmpeg |

## 7. Données, sous-titres, polices, CAO/3D, codes, hash
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-196 | Conversion données | [Convertio] json → yaml | Présent à vérifier | OK | bureau natif : donnees.rs convert_data (serde_json → serde_yaml) ; navigateur : grisé |
| CV-197 | Conversion données | [Convertio] yaml → json | Présent à vérifier | OK | bureau natif : donnees.rs read_value/write_value |
| CV-198 | Conversion données | [Convertio] json ↔ toml | Partiel | P3 | bureau natif : write_value enveloppe un tableau racine dans { items } et refuse null (TOML) ; aller-retour non idempotent |
| CV-199 | Conversion données | [Convertio] json ↔ xml | Partiel | P3 | bureau natif : xml_to_value/value_to_xml, convention @attribut/#text, racine « root » ; types perdus (tout en chaînes) ; pas d'espaces de noms |
| CV-200 | Conversion données | [Convertio] yaml ↔ toml, yaml ↔ xml, toml ↔ xml | Partiel | P3 | bureau natif : convert_data via serde_json::Value (mêmes limites) |
| CV-201 | Conversion données | [Convertio] json → txt (mise en forme) / pdf | Présent à vérifier | OK | bureau natif : conv/mod.rs aiguiller (to_string_pretty) ; pdf en Courier |
| CV-202 | Conversion données | [Convertio] données (json, yaml, toml, xml) → html / md (tableau) | Partiel | P3 | bureau natif : convert_data → CSV → csv_to_html_table/csv_to_markdown (tableau d'objets exigé) |
| CV-203 | Conversion données | [Convertio] ini / .env / properties / conf ↔ json | Absent | P3 | crates configparser / dotenvy ; serde |
| CV-204 | Conversion données | [Convertio] table HTML (<table>) → csv / xlsx / json | Absent | P3 | crate scraper (pur Rust) ; tableau Markdown → csv via pulldown-cmark (Options::ENABLE_TABLES) |
| CV-205 | Conversion données | [Convertio] ics (calendrier) ↔ csv / json | Absent | P3 | crate icalendar ; format simple |
| CV-206 | Conversion données | [Convertio] vcf (contacts) ↔ csv / json | Absent | P3 | crate vcard_parser ou analyse maison |
| CV-207 | Conversion archive/autre | [Convertio] fichier ↔ base64 / data URI | Absent | P3 | crate base64 déjà liée (Cargo.toml) : opération encoder/décoder, sortie .txt ou fichier |
| CV-208 | Conversion archive/autre | [Convertio] empreintes (MD5, SHA-1, SHA-256, SHA-512) d'un fichier ou d'un lot | Absent | P2 | crates RustCrypto sha2/sha1/md-5 (non liées aujourd'hui) ; sortie fichier .sha256 compatible sha256sum + copie ; voir CV-A20 |
| CV-209 | Conversion archive/autre | [Convertio] texte → code QR (png / svg / pdf), contenu URL / Wi-Fi / vCard | Absent | P3 | crate qrcode (pur Rust) + image crate déjà liée |
| CV-210 | Conversion archive/autre | [Convertio] codes-barres (Code 128, EAN-13, DataMatrix, PDF417) en image | Absent | P3 | crate rxing (encodage + décodage) ou barcoders |
| CV-211 | Conversion archive/autre | [Convertio] image → lecture de code QR / code-barres | Absent | P3 | crates rxing ou rqrr |
| CV-212 | Conversion données | [Convertio] sous-titres srt ↔ vtt | Présent à vérifier | OK | bureau natif : donnees.rs srt_to_vtt / vtt_to_srt (compteurs, virgule/point, formats courts MM:SS) ; réglages de cue VTT (position, align) supprimés ; navigateur : grisé |
| CV-213 | Conversion données | [Convertio] sous-titres srt / vtt → txt (dialogue seul) | Présent à vérifier | OK | bureau natif : donnees.rs subtitles_to_text |
| CV-214 | Conversion données | [Convertio] sous-titres en Windows-1252 / UTF-16 / ISO-8859-x | Partiel | P2 | bureau natif : std::fs::read_to_string (UTF-8 strict) → erreur sur les .srt français courants ; ajouter détection d'encodage (encoding_rs/chardetng) |
| CV-215 | Conversion données | [Convertio] sous-titres ass / ssa ↔ srt / vtt | Absent | P2 | analyseur Dialogue/Style simple en Rust (styles perdus à la sortie) ; ffmpeg -i en repli |
| CV-216 | Conversion données | [Convertio] sous-titres sbv (YouTube), sub (MicroDVD), smi, lrc (paroles) ↔ srt | Absent | P3 | formats texte courts : lecteurs/écrivains maison, tout dans donnees.rs ou un nouveau sous_titres.rs |
| CV-217 | Conversion données | [Convertio] sous-titres ttml / dfxp / xml (broadcast) ↔ srt / vtt | Absent | P3 | quick-xml déjà lié |
| CV-218 | Conversion données | [FFmpeg] sous-titres : décaler, étirer (fps 23,976 ↔ 25), fusionner, renuméroter | Absent | P2 | opérations sur la liste de cues : à créer dans un module sous_titres.rs (partagé avec les formats ci-dessus) |
| CV-219 | Conversion archive/autre | [Convertio] polices ttf ↔ otf | Absent | P3 | otf CFF → ttf (courbes quadratiques) : fonttools/otf2ttf externe ; Rust : crate allsorts (lecture/subsetting) incomplet pour la conversion de contours |
| CV-220 | Conversion archive/autre | [Convertio] polices ttf / otf → woff / woff2 | Absent | P2 | woff : zlib via flate2 déjà lié ; woff2 : Brotli (crate brotli, pur Rust) + transformation glyf, encodeur à vérifier (crates woff2 / allsorts) sinon fonttools externe |
| CV-221 | Conversion archive/autre | [Convertio] polices woff / woff2 → ttf / otf | Absent | P2 | crate brotli (pur Rust) + inversion de la transformation glyf/loca (allsorts décode WOFF2) |
| CV-222 | Conversion archive/autre | [Convertio] polices → eot / svg / ttc (extraction de collection) | Absent | P3 | ttf-parser (déjà lié) lit les collections ; eot : écrivain maison |
| CV-223 | Conversion archive/autre | [Convertio] 3D stl ↔ obj | Absent | P3 | crates stl_io et tobj (purs Rust) |
| CV-224 | Conversion archive/autre | [Convertio] 3D obj / stl / ply → glb / gltf | Absent | P3 | crate gltf-json + écriture binaire glb ; textures mtl : copie |
| CV-225 | Conversion archive/autre | [Convertio] 3D glb ↔ gltf (binaire / séparé) | Absent | P3 | spécification simple : découpage du bloc binaire |
| CV-226 | Conversion archive/autre | [Convertio] 3D ply ↔ stl / obj | Absent | P3 | crate ply-rs |
| CV-227 | Conversion archive/autre | [Convertio] CAO fbx / dae / 3ds / step / iges / dwg / dxf → obj / stl / pdf / svg | Absent | P3 | dxf : crate dxf (pur Rust) vers svg/pdf ; fbx/step/dwg : outils externes (assimp, FreeCAD, ODA) |

## 8. Archives et compression
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-228 | Conversion archive/autre | [Convertio] zip → tar / tgz | Présent à vérifier | OK | bureau natif : archives.rs convert_archive (read_zip → write_tar/write_tgz) ; navigateur : grisé |
| CV-229 | Conversion archive/autre | [Convertio] tar / tgz (tar.gz) → zip / tar | Présent à vérifier | OK | bureau natif : archives.rs read_tar_from, write_zip |
| CV-230 | Conversion archive/autre | [Convertio] 7z → zip / tar / tgz | Présent à vérifier | OK | bureau natif : archives.rs read_7z (sevenz-rust2, mot de passe vide uniquement) |
| CV-231 | Conversion archive/autre | [Convertio] gz seul (fichier non tar) → décompresser / compresser | Partiel | P3 | « gz » est traité comme tar.gz (read_archive) : un .gz d'un seul fichier échoue (« TAR invalide ») ; flate2 permet gunzip/gzip direct |
| CV-232 | Conversion archive/autre | [Convertio] zip / tar → 7z (écriture) | Absent | P2 | sevenz-rust2 sait compresser (feature compress) : ajouter write_7z à archives.rs et "7z" à la sortie de prise_en_charge |
| CV-233 | Conversion archive/autre | [Convertio] rar / cbr → zip / 7z (lecture seule) | Absent | P2 | crate unrar (bibliothèque C, licence à vérifier) ou 7z/unrar externes détectés par capacites() |
| CV-234 | Conversion archive/autre | [Convertio] xz / tar.xz ↔ zip / tar.gz | Absent | P2 | crate lzma-rs (pur Rust) ou xz2 (C) |
| CV-235 | Conversion archive/autre | [Convertio] bz2 / tar.bz2 ↔ zip | Absent | P3 | crate bzip2-rs (décodage pur Rust) ou bzip2 (C, écriture) |
| CV-236 | Conversion archive/autre | [Convertio] zst / tar.zst ↔ zip | Absent | P3 | crate ruzstd (décodage pur Rust) ou zstd (C) |
| CV-237 | Conversion archive/autre | [Convertio] créer un ZIP depuis la liste de résultats | Présent à vérifier | OK | Convert.tsx zip() (JSZip, noms dédoublonnés) et opération native Zipper (operation.rs zipper, noms personnalisés) ; « Tout enregistrer (.zip) » |
| CV-238 | Conversion archive/autre | [Convertio] extraire une archive dans un dossier (unzip / untar / 7z x) | Absent | P2 | convert_archive ne convertit qu'archive → archive : ajouter Operation::Extraire { entree, dossier } réutilisant read_* et sanitize_entry_name (archives.rs) avec plafonds existants |
| CV-239 | Conversion archive/autre | [Convertio] archive protégée par mot de passe (zip AES, 7z) en lecture et écriture | Absent | P2 | zip crate (feature aes-crypto) pour zip ; sevenz-rust2 gère AES256 ; mot de passe passé par l'interface (non journalisé) |
| CV-240 | Conversion archive/autre | [Convertio] niveau et méthode de compression (store, deflate, bzip2, zstd, LZMA) | Absent | P3 | write_zip fixe Deflated ; ajouter OptionsConversion.niveau |
| CV-241 | Conversion archive/autre | [Convertio] conservation des droits, dates, liens symboliques, dossiers vides | Partiel | P3 | write_tar fixe mode 0o644 et mtime 0 ; les dossiers vides sont ignorés (read_zip saute is_dir) ; décision de sécurité à documenter pour les liens |
| CV-242 | Conversion archive/autre | [Convertio] volumes multiples (zip .z01, 7z .001) en lecture/écriture | Absent | P3 | zip multi-volume non géré par le crate zip ; 7z .001 par concaténation avant lecture |
| CV-243 | Conversion archive/autre | [Convertio] iso / cab / dmg / jar / apk → zip (formats conteneurs) | Absent | P3 | jar/apk/cbz/epub sont des zip : simple alias d'extension ; iso : crate iso9660 ; cab : crate cab ; dmg : outil externe |
| CV-244 | Conversion archive/autre | [Convertio] lister le contenu et tester l'intégrité d'une archive sans l'extraire | Absent | P3 | read_* existants donnent les entrées : opération Lister/Tester ; voir CV-A18 |

## 9. Outils PDF (PDF24 Creator et équivalents)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-245 | Outil PDF | [PDF24] Fusionner des PDF (ordre et nom réglables) | Présent à vérifier | OK | Convert.tsx runTool('merge') → pdf-batch.ts runPdfTool → pdf-ops.ts merge (pdf-lib) navigateur + bureau ; ordre = ordre de la liste (glisser/flèches), nom validé par naming.ts ; moteur Rust Fusionner (pdf/pages.rs fusionner) non appelé par l'interface |
| CV-246 | Outil PDF | [PDF24] Fusionner des PDF protégés (mot de passe par fichier) | Partiel | P2 | moteur Rust Fusionner { mots_de_passe } (operation.rs) prêt ; pdf-ops.ts merge fait load() sans mot de passe → erreur sur un PDF chiffré : demander les mots de passe dans l'interface et utiliser unlock() |
| CV-247 | Outil PDF | [PDF24] Fusionner documents de types différents (Word + images + PDF) en un PDF | Partiel | P2 | deux étapes manuelles (convertir en PDF puis Fusionner) : ajouter une action « Convertir et fusionner » (pipeline) |
| CV-248 | Outil PDF | [PDF24] Fusionner avec signets par fichier / table des matières | Absent | P3 | lopdf : ajouter /Outlines à la fusion (pdf/pages.rs fusionner) |
| CV-249 | Outil PDF | [PDF24] Diviser : une page par fichier, toutes les N pages, par plages | Partiel | P1 | moteur Rust Decouper (pdf/pages.rs decouper, modes ChaquePage/ToutesLesN/Plages, noms personnalisés) + pdf-ops.ts split/chunks et dialogue du module PDF (dialogActions.ts) ; pas d'outil Diviser dans le ruban du Convertisseur (ribbon.ts) : ajouter |
| CV-250 | Outil PDF | [PDF24] Diviser par signets, par taille de fichier, aux pages blanches, par texte détecté | Absent | P3 | lire /Outlines (lopdf) ; taille cible par fusion progressive ; page blanche : rendu_simple + seuil |
| CV-251 | Outil PDF | [PDF24] Extraire des pages (plage « 1-3, 5, 8- ») | Partiel | P2 | moteur ExtrairePages (pdf/pages.rs extraire) et pdf-ops.ts extract/parsePageRange ; module PDF seulement, pas dans le Convertisseur |
| CV-252 | Outil PDF | [PDF24] Supprimer des pages | Partiel | P2 | moteur SupprimerPages ; pdf-ops.ts removePages ; module PDF seulement |
| CV-253 | Outil PDF | [PDF24] Réorganiser / trier / dupliquer des pages | Partiel | P2 | moteur Reorganiser (doublons autorisés) ; pdf-ops.ts reorder ; module PDF (vignettes) seulement |
| CV-254 | Outil PDF | [PDF24] Pivoter les pages | Partiel | P2 | Convert.tsx pdfTool('rotate') : +90° sur toutes les pages de tous les PDF (pdf-batch.ts) ; moteur Pivoter { degres, pages } non exploité (angle, sélection de pages) |
| CV-255 | Outil PDF | [PDF24] Compresser (qualité écran / ebook / impression / sans perte) | Présent à vérifier | OK | ToolDialog.tsx niveau → pdf-batch.ts 'compresser' → pdf/compression.rs compresser (flux Flate, objets, images JPEG 1000/1700/2800 px q50/70/85) ; bureau natif pur Rust ; navigateur : grisé |
| CV-256 | Outil PDF | [PDF24] Compresser à une taille cible ou avec DPI/qualité réglables, afficher le gain | Partiel | P2 | le bilan BilanCompression (octets_gagnes_images) est renvoyé par le moteur mais l'interface lit seulement les fichiers (native.ts runBytes) ; paramètres libres (dpi, qualité) absents de NiveauCompression |
| CV-257 | Outil PDF | [PDF24] Protéger par mot de passe (ouverture + propriétaire, AES-256) | Partiel | P2 | ToolDialog.tsx → pdf-batch.ts 'chiffrer' via le natif seulement ; le chiffrement TypeScript pdf-ops.ts encrypt (AES-256, testé) n'est pas utilisé : routeur navigateur manquant (S) |
| CV-258 | Outil PDF | [PDF24] Protéger : autorisations (imprimer, copier, modifier, annoter, remplir) | Partiel | P2 | moteur Autorisations (pdf/securite.rs) et pdf-ops.ts Protection prêts ; le dialogue du Convertisseur ne propose que les deux mots de passe |
| CV-259 | Outil PDF | [PDF24] Déverrouiller (retirer le mot de passe connu) | Partiel | P2 | pdf-ops.ts decrypt/unlock et moteur Pdf { mot_de_passe, actions: [] } ; aucun bouton dans le Convertisseur (module PDF l'utilise à l'ouverture, useDoc.ts) |
| CV-260 | Outil PDF | [PDF24] Signer visuellement (dessin, image, texte) | Partiel | P2 | module PDF (packages/pdf dialogs-sign.tsx, appearance.ts) ; absent du ruban du Convertisseur |
| CV-261 | Outil PDF | [PDF24] Signature numérique avec certificat (.pfx / .p12) | Partiel | P2 | module PDF : packages/pdf/src/sign/pdfsign.ts + cms.ts + pkcs12.ts (pur TypeScript) ; non exposé dans le lot du Convertisseur |
| CV-262 | Outil PDF | [PDF24] Vérifier les signatures d'un PDF | Partiel | P3 | module PDF : sign/verify.ts ; aucun accès depuis le Convertisseur |
| CV-263 | Outil PDF | [PDF24] Rogner (CropBox : marges, zone, détection auto des marges blanches) | Absent | P2 | ni moteur ni TS : lopdf set /CropBox (pdf/pages.rs, nouvelle action Rogner { marges }) ; détection des marges par rendu_simple |
| CV-264 | Outil PDF | [PDF24] Extraire les images d'un PDF | Partiel | P2 | moteur ExtraireImages (pdf/images.rs extraire_images : JPEG tels quels, Flate → PNG, noms personnalisables) ; aucun bouton dans le Convertisseur |
| CV-265 | Outil PDF | [PDF24] Numérotation des pages (préfixe, début, zéros de tête) | Partiel | P2 | pdf-batch.ts 'numbering' → pdf-ops.ts stampPages (navigateur + bureau) ; position bas-droite et taille 10 pt figées ; moteur TextePages (6 positions, couleur, marge, pages) sous-exploité |
| CV-266 | Outil PDF | [PDF24] Bates / en-tête et pied de page ({page}, {total}) | Partiel | P2 | moteur EntetePied et TextePages (pdf/tampons.rs), pdf-ops.ts stampPages ; module PDF seulement |
| CV-267 | Outil PDF | [PDF24] Filigrane texte (taille, opacité, angle, couleur, pages) | Partiel | P2 | pdf-batch.ts 'watermark' : texte seul, taille 60, opacité 0,25, angle 45°, gris figés ; moteur Filigrane (pdf/tampons.rs) et pdf-ops.ts WatermarkOptions complets |
| CV-268 | Outil PDF | [PDF24] Filigrane / tampon image (logo), fond de page | Absent | P2 | ajouter un XObject image sur les pages (lopdf, pdf/tampons.rs) avec opacité (ExtGState) ; TS : drawImage de pdf-lib |
| CV-269 | Outil PDF | [PDF24] Tampons prédéfinis (Confidentiel, Copie, Approuvé) | Absent | P3 | catalogue de tampons texte encadré dans tampons.rs |
| CV-270 | Outil PDF | [PDF24] Comparer deux PDF (texte) | Partiel | P2 | moteur Comparer (pdf/texte.rs comparer, similar, rapport HTML) et module PDF (compareStats) ; aucun outil de comparaison dans le Convertisseur |
| CV-271 | Outil PDF | [PDF24] Comparer deux PDF visuellement (différences de pixels) | Absent | P3 | rendu des deux PDF (rendu_simple) puis différence d'images (image crate) ; voir CV-A02 |
| CV-272 | Outil PDF | [PDF24] Caviarder (suppression réelle du texte, images et tracés) | Partiel | P2 | moteur très complet (pdf/caviardage.rs, 24 tests) + module PDF (redact.ts) ; absent du lot du Convertisseur |
| CV-273 | Outil PDF | [PDF24] Modifier le texte d'un PDF | Partiel | P3 | moteur corriger_texte (caviardage.rs Correctif) + module PDF ; hors périmètre Convertisseur |
| CV-274 | Outil PDF | [PDF24] PDF/A-2b (archivage) | Partiel | P2 | pdf-batch.ts 'pdfa' → pdf/externe.rs pdf_a : bureau + outil externe Ghostscript (-dPDFA=2), jamais exercé (ROADMAP §1) ; aucune vérification de conformité ; navigateur : grisé |
| CV-275 | Outil PDF | [PDF24] PDF/A-1b, PDF/A-3b, PDF/X, PDF/UA et validation (veraPDF) | Absent | P3 | paramètre de niveau pour Ghostscript (-dPDFA=1/3) ; validation : veraPDF externe détecté |
| CV-276 | Outil PDF | [PDF24] OCR : rendre un scan cherchable | Partiel | P2 | pdf-batch.ts 'ocr' → pdf/externe.rs ocr : bureau + outil externe ocrmypdf (+ Tesseract + Ghostscript), jamais exercé ; langue fra / eng / fra+eng seulement dans l'interface (le moteur valide toute combinaison) |
| CV-277 | Outil PDF | [PDF24] OCR d'images (jpg, png, tiff) en lot | Absent | P2 | ocrmypdf exige un PDF ou img2pdf : images_vers_pdf puis ocr (pipeline) ou Tesseract direct ; OCR de lots : file d'attente existante |
| CV-278 | Outil PDF | [PDF24] Images → PDF | Présent à vérifier | OK | Convert.tsx imagesToPdf + engines.ts imagesToOnePdf (voir section Images) |
| CV-279 | Outil PDF | [PDF24] PDF → images | Présent à vérifier | OK | engines.ts pdfPages (pdf.js) ; moteur PdfVersImages (pdf/externe.rs rendre_pages : mutool, pdftoppm, Ghostscript, sinon rendu_simple pur Rust avec avertissement) |
| CV-280 | Outil PDF | [PDF24] Métadonnées : lire / modifier (titre, auteur, sujet, mots-clés) | Partiel | P3 | moteur Infos + action Metadonnees (pdf/securite.rs) et pdf-ops.ts readMetadata/writeMetadata ; module PDF (Propriétés) ; pas d'outil de lot dans le Convertisseur |
| CV-281 | Outil PDF | [PDF24] Supprimer les métadonnées et données cachées (XMP, JavaScript, pièces jointes, historique) | Absent | P2 | pdf/purge.rs sait purger /Metadata, /PieceInfo, /Info pour le caviardage : exposer « Assainir » comme action autonome ; voir CV-A07 |
| CV-282 | Outil PDF | [PDF24] Aplatir formulaires et annotations | Partiel | P3 | moteur Aplatir (pdf/formulaires.rs) ; module PDF |
| CV-283 | Outil PDF | [PDF24] Remplir / créer des formulaires PDF | Partiel | P3 | moteur AjouterChamps/RemplirChamps/ListerChamps ; module PDF forms.ts |
| CV-284 | Outil PDF | [PDF24] Annoter (note, surlignage, rectangle) | Partiel | P3 | moteur annotations.rs ; module PDF annots.ts |
| CV-285 | Outil PDF | [PDF24] Optimiser pour le web (linéariser) / réduire sans toucher aux images | Absent | P3 | lopdf n'écrit pas de PDF linéarisé : qpdf --linearize externe (qpdf a été retiré du moteur) ; enregistrer_compact (flux d'objets) couvre la taille seule |
| CV-286 | Outil PDF | [PDF24] Réparer un PDF endommagé / tronqué | Absent | P2 | le moteur refuse un PDF invalide (test pdf_invalide_ou_tronque_refuse) : reconstruction de la table xref par balayage (lopdf load avec reconstruction) ou mutool clean / qpdf externes |
| CV-287 | Outil PDF | [PDF24] Niveaux de gris / noir et blanc, réduction des couleurs | Absent | P3 | Ghostscript -sColorConversionStrategy=Gray (détecté) ou conversion d'images dans compression.rs |
| CV-288 | Outil PDF | [PDF24] Changer le format de page, mise à l'échelle, plusieurs pages par feuille (N-up), livret | Absent | P3 | lopdf : matrices cm + MediaBox sur des pages XObject (formulaires) ; imposition livret |
| CV-289 | Outil PDF | [PDF24] Superposer deux PDF (papier à en-tête, fond) | Absent | P3 | pages du second PDF comme XObject de formulaire sous le contenu de la page (lopdf) |
| CV-290 | Outil PDF | [PDF24] Insérer des pages blanches ou un autre PDF à une position | Partiel | P3 | pdf-ops.ts insertBlank/insertDocument (module PDF) ; absent du Convertisseur |
| CV-291 | Outil PDF | [PDF24] Pièces jointes PDF (ajouter, extraire, supprimer) | Absent | P3 | lopdf : /Names /EmbeddedFiles ; pas d'équivalent dans le module PDF |
| CV-292 | Outil PDF | [PDF24] Signets, liens, table des matières (édition) | Partiel | P3 | module PDF outlines.ts/links.ts ; absent du Convertisseur |
| CV-293 | Outil PDF | [PDF24] Chaîner plusieurs traitements en une passe (ex. compresser + protéger + numéroter) | Partiel | P2 | le moteur enchaîne jusqu'à 100 actions (operation.rs Operation::Pdf, chiffrement en dernier) ; l'interface n'applique qu'un outil à la fois |
| CV-294 | Outil PDF | [PDF24] Appliquer un outil à une sélection de fichiers (pas tous les PDF de la liste) | Absent | P2 | Convert.tsx runTool prend tous les jobs ext === 'pdf' ; ajouter une sélection de lignes |
| CV-295 | Outil PDF | [PDF24] Ouvrir un PDF protégé en entrée de n'importe quel outil (demande du mot de passe) | Absent | P2 | la Operation::Pdf accepte mot_de_passe mais convertFile/runPdfTool ne le transmettent jamais ; une boîte « mot de passe » par fichier |
| CV-296 | Outil PDF | [PDF24] Aperçu des pages et choix visuel des pages à traiter | Partiel | P3 | Convertisseur : miniature 40 px de la page 1 (thumbs.ts fromPdf) ; sélecteur de pages visuel dans le module PDF uniquement |
| CV-297 | Outil PDF | [PDF24] Numériser (scanner WIA / TWAIN) vers PDF | Absent | P3 | WIA via le crate windows côté Tauri (Windows) ; SANE sous Linux ; voir CV-A15 |

## 10. Options par famille de conversion
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-298 | Option | [ImageMagick] Qualité JPEG 1-100 | Présent à vérifier | OK | ribbon.ts champ Qualité → ConvertOptions.quality ; canvas toBlob(quality) et natif images.rs save_as_jpeg |
| CV-299 | Option | [ImageMagick] Qualité WebP / AVIF (compression avec perte), vitesse AVIF | Partiel | P2 | canvas gère webp ; natif ignore la qualité (WebP lossless seul, AVIF figé) ; paramètres encodeur à ajouter à OptionsConversion |
| CV-300 | Option | [ImageMagick] Largeur et hauteur en pixels, ratio conservé si une dimension | Présent à vérifier | OK | ribbon.ts largeur/hauteur → viaCanvas et apply_transforms (images.rs) |
| CV-301 | Option | [ImageMagick] Redimensionnement : ajuster / remplir / étirer, pourcentage, côté le plus long, ne pas agrandir | Absent | P1 | les deux dimensions donnent resize_exact (déformation, images.rs apply_transforms) ; ajouter mode (fit/fill/stretch), échelle %, max côté, interdiction d'agrandir |
| CV-302 | Option | [ImageMagick] Algorithme de rééchantillonnage (Lanczos, bicubique, plus proche voisin) | Absent | P3 | FilterType::Lanczos3 figé (images.rs) ; navigateur : imageSmoothingQuality |
| CV-303 | Option | [ImageMagick] Rotation 90 / 180 / 270 | Présent à vérifier | OK | ribbon.ts + viaCanvas / apply_transforms |
| CV-304 | Option | [ImageMagick] Rotation d'angle libre, retournement horizontal / vertical | Absent | P3 | imageops::rotate / flip_h / flip_v ; rotation libre : imageproc |
| CV-305 | Option | [ImageMagick] Orientation EXIF appliquée automatiquement (photos de téléphone) | Partiel | P1 | navigateur : le canvas applique l'orientation EXIF ; natif : image::open ignore EXIF (orient non appliquée → photos couchées) : decoder.orientation() + DynamicImage::apply_orientation avant apply_transforms |
| CV-306 | Option | [ImageMagick] Rogner (zone, marges, rognage automatique des bords unis) | Absent | P2 | imageops::crop_imm ; auto-trim par seuil ; canvas drawImage source rect |
| CV-307 | Option | [ImageMagick] Fond de remplissage et gestion de la transparence (JPG, GIF, BMP) | Partiel | P2 | navigateur : fond blanc fixe pour jpg ; natif : alpha simplement retiré (to_rgb8 dans save_as_jpeg, fond souvent noir) : même comportement et couleur de fond choisie |
| CV-308 | Option | [ImageMagick] Niveaux de gris, noir et blanc, palette (GIF/PNG-8), dithering | Absent | P3 | DynamicImage::grayscale ; quantification color_quant (image la lie déjà pour GIF) |
| CV-309 | Option | [ImageMagick] Luminosité, contraste, netteté, flou, teinte, saturation | Absent | P3 | imageops::brighten/contrast/blur/unsharpen/huerotate |
| CV-310 | Option | [ImageMagick] Profil ICC : conserver, convertir en sRGB, supprimer | Absent | P2 | le crate image ne lit pas l'ICC en sortie ; crate lcms2 (C) ou moxcms (pur Rust) pour la conversion |
| CV-311 | Option | [ImageMagick] EXIF / GPS / IPTC : supprimer ou conserver | Partiel | P2 | toute conversion native réencode et perd silencieusement les métadonnées (images.rs) : pas de choix « conserver » (crate kamadak-exif / img-parts) ni de rapport de ce qui a été retiré |
| CV-312 | Option | [ImageMagick] DPI / densité d'impression | Absent | P3 | métadonnée pHYs (png) / JFIF (jpg) ; images_vers_pdf fixe 96 ppp côté natif et 72 ppp côté TypeScript |
| CV-313 | Option | [ImageMagick] JPEG progressif, sous-échantillonnage chroma, Huffman optimisé (mozjpeg) | Absent | P3 | JpegEncoder de image baseline : crate jpeg-encoder (pur Rust, progressif) ou mozjpeg |
| CV-314 | Option | [ImageMagick] PNG : niveau de compression, optimisation sans perte (oxipng) | Absent | P2 | crate oxipng (pur Rust) en post-traitement ; gain 20-40 % sans perte |
| CV-315 | Option | [ImageMagick] Filigrane texte ou image sur les images | Absent | P3 | imageops::overlay ; texte via ab_glyph/ttf-parser (déjà liés) |
| CV-316 | Option | [ImageMagick] Nom de sortie avec suffixe / motif (-1024px, {date}, {n}) | Absent | P2 | voir Interface : renommage par motif |
| CV-317 | Option | [PDF24] Résolution (ppp) du rendu PDF → images | Partiel | P2 | moteur dpi 36-600 (rendre_pages) ; interface : 150 ppp figés (engines.ts pdfPages 150 / 72), aucun champ |
| CV-318 | Option | [PDF24] Pages à convertir (plage) pour PDF → images / texte / Word | Absent | P2 | pdfPages et PdfVersImages traitent toutes les pages ; reprendre parsePageRange (pdf-ops.ts) |
| CV-319 | Option | [LibreOffice] Plage de pages à exporter en PDF | Absent | P3 | filtre LibreOffice PageRange {"PageRange":{"type":"string","value":"1-3"}} dans office_vers_pdf |
| CV-320 | Option | [LibreOffice] Export PDF : PDF/A, qualité JPEG, compression d'images, signets, formulaires, chiffrement | Absent | P2 | office_vers_pdf lance « --convert-to pdf » nu : passer le filtre JSON --convert-to 'pdf:writer_pdf_Export:{"SelectPdfVersion":...,"Quality":...,"ExportBookmarks":...}' selon la famille de document |
| CV-321 | Option | [LibreOffice] Fidélité haute (Office → PDF par LibreOffice) | Présent à vérifier | OK | ribbon.ts case « Haute fidélité » (grisée sans outil, capacites 'office_haute_fidelite') → OptionsConversion.haute_fidelite → externe.rs office_vers_pdf (profil temporaire, délai 600 s) ; jamais exercé |
| CV-322 | Option | [LibreOffice] Autres filtres LibreOffice (docx → odt/html/epub/txt, xlsx → ods/html, pptx → png) en repli de la suite | Absent | P3 | OFFICE_FIDELE ne mène qu'au PDF : généraliser office_vers_pdf en office_convertir(vers) |
| CV-323 | Option | [Pandoc] Table des matières (--toc, profondeur) | Absent | P2 | docx/epub/html/pdf : générer un sommaire depuis les titres (TS packages/docx, ecriture_zip.rs epub nav) ; pandoc --toc si externe |
| CV-324 | Option | [Pandoc] Numérotation des sections (--number-sections) | Absent | P3 | numérotation des titres au rendu (TS) ou pandoc |
| CV-325 | Option | [Pandoc] Modèle de document (reference.docx, template HTML/LaTeX, CSS) | Absent | P2 | appliquer un .dotx/.docx modèle via packages/docx (styles) ; CSS pour html/epub ; pandoc --reference-doc |
| CV-326 | Option | [Pandoc] Métadonnées (titre, auteur, date, langue) et bloc YAML | Absent | P2 | lire/écrire core.xml docx, OPF epub (auteur figé « UniversalConverter ») ; bloc YAML front matter markdown |
| CV-327 | Option | [Pandoc] Bibliographie et citations (citeproc, CSL, .bib) | Absent | P3 | pandoc --citeproc externe ; crate hayagriva (Rust, CSL) en alternative |
| CV-328 | Option | [Pandoc] Filtres (Lua, JSON) et extensions de lecteur (smart, footnotes, tables) | Absent | P3 | pandoc externe seulement ; non pertinent sans Pandoc |
| CV-329 | Option | [Pandoc] Mathématiques (LaTeX → MathML, OMML, MathJax, KaTeX) | Absent | P3 | crate latex2mathml (pur Rust) pour html/epub ; OMML pour docx |
| CV-330 | Option | [Pandoc] Extraire les médias d'un document (--extract-media) | Absent | P3 | les images d'un docx sont dans le paquet OPC : écrire un zip « médias » (jszip côté TS, zip côté Rust) |
| CV-331 | Option | [Pandoc] Résumé (abstract), notes de bas de page, liens : conservation entre formats | Partiel | P3 | modèle de document de packages/docx garde notes/liens entre docx/odt/html/md ; pivots natifs (pdf, epub) les perdent |
| CV-332 | Option | [Pandoc] Suivi des modifications et commentaires : accepter / refuser / exporter | Absent | P3 | option accepter / refuser les révisions avant conversion à créer dans packages/docx (prise en charge des insertions/suppressions suivies à confirmer dans read-body.ts) |
| CV-333 | Option | [LibreOffice] Encodage de sortie du texte (UTF-8, UTF-16, Windows-1252, ISO-8859-15), fin de ligne | Absent | P2 | packages/docx/src/txt.ts gère TextEncoding en lecture ; jamais exposé en écriture ; natif écrit toujours UTF-8 |
| CV-334 | Option | [LibreOffice] Taille de papier, orientation, marges, police et taille pour txt/md/html/csv → PDF | Absent | P2 | texte_vers_pdf fige A4/Courier 10 pt/marge (pdf/texte.rs) : ajouter paramètres + police TrueType Unicode embarquée (fontdb/ttf-parser déjà liés) |
| CV-335 | Option | [LibreOffice] Polices intégrées (embedding) et polices Unicode dans les PDF créés | Absent | P1 | polices standard WinAnsi seulement (pdf/mod.rs police_standard) : intégrer un sous-ensemble TrueType (ttf-parser + fontdb déjà liés) pour accents rares, cyrillique, CJK |
| CV-336 | Option | [LibreOffice] Feuille et plage à exporter (xlsx → csv / json / pdf), toutes les feuilles | Absent | P2 | writeWorkbook accepte sheetIndex (packages/xlsx) ; natif excel_to_csv prend la 1re feuille ; ajouter un sélecteur |
| CV-337 | Option | [LibreOffice] Séparateur CSV, séparateur décimal, guillemets, BOM, encodage à l'écriture | Partiel | P1 | CsvWriteOptions (packages/xlsx/src/csv.ts) complet mais seuls « ; », « , », BOM UTF-8 par défaut sont utilisés (engines.ts viaSuite) ; natif : virgule fixe ; exposer un panneau CSV |
| CV-338 | Option | [LibreOffice] Formats de date et de nombre à l'export CSV/JSON (ISO 8601, locale) | Absent | P2 | CsvWriteOptions.format existe (callback) sans interface ; natif écrit des chaînes |
| CV-339 | Option | [LibreOffice] Formules ou valeurs calculées à l'export (writeFormulas) | Partiel | P3 | CsvWriteOptions.writeFormulas disponible, non exposé |
| CV-340 | Option | [LibreOffice] Première ligne = en-têtes (JSON / XML / YAML depuis un tableau) | Absent | P3 | convention figée « 1re ligne = clés » (office.rs) ; case à cocher + noms de colonnes générés |
| CV-341 | Option | [LibreOffice] Délimiteur d'entrée forcé (csv ; / tabulation) et décimale d'entrée | Partiel | P2 | CsvReadOptions.separator/decimal/encoding/dateOrder existent côté TS, ignorés par convertFile ; natif : virgule seule |
| CV-342 | Option | [Convertio] JSON : indentation, minifié, tri des clés, JSON Lines | Absent | P3 | write_value to_string_pretty figé ; ajouter indent/compact |
| CV-343 | Option | [Convertio] XML : nom de la racine et des éléments, attributs, espaces de noms | Absent | P3 | racine « root » figée (donnees.rs value_to_xml) ; paramètres de noms |
| CV-344 | Option | [FFmpeg] Débit audio (kbit/s, CBR/VBR), fréquence d'échantillonnage, canaux | Absent | P1 | aucune option audio (convertir_audio n'a que le format) ; OptionsConversion.audio { debit, hz, canaux } puis FFmpeg/rubato |
| CV-345 | Option | [FFmpeg] Normalisation du volume (EBU R128 / pic), gain, fondus | Absent | P3 | FFmpeg loudnorm ; en Rust : ebur128 (pur Rust) |
| CV-346 | Option | [FFmpeg] Rogner l'audio/la vidéo (début, fin), vitesse (atempo / setpts) | Absent | P2 | FFmpeg -ss/-to/-atempo ; audio WAV/FLAC : découpe d'échantillons en Rust |
| CV-347 | Option | [FFmpeg] Métadonnées audio (ID3, vorbis comment, pochette) conservées / modifiées | Absent | P2 | symphonia lit les tags ; écriture : crate lofty (pur Rust) pour mp3/flac/ogg/m4a |
| CV-348 | Option | [FFmpeg] Vidéo : CRF, préréglage de vitesse, résolution, fps, codec audio, matériel (NVENC/QSV) | Absent | P1 | tout via FFmpeg ; profils préréglés pour éviter des dizaines de champs |
| CV-349 | Option | [FFmpeg] Vidéo : sous-titres incrustés (burn-in) ou intégrés, choix de la piste audio/sous-titres | Absent | P3 | FFmpeg -vf subtitles / -map ; ffprobe pour lister les pistes |
| CV-350 | Option | [FFmpeg] Vidéo : rogner l'image (crop), pivoter, retourner, recadrer 16:9 → 9:16 | Absent | P3 | FFmpeg -vf crop,transpose |
| CV-351 | Option | [FFmpeg] Concaténer plusieurs audios/vidéos en un seul | Absent | P3 | FFmpeg concat demuxer ; audio WAV en Rust (même format) |
| CV-352 | Option | [FFmpeg] GIF : fréquence d'images, largeur, palette, boucle | Absent | P3 | FFmpeg palettegen ; GifEncoder (image) Rust |
| CV-353 | Option | [Convertio] Archives : niveau de compression, mot de passe, méthode | Absent | P3 | voir section Archives |
| CV-354 | Option | [Convertio] Options mémorisées par format de sortie (au lieu d'un seul jeu global) | Absent | P2 | ConvertOptions est unique pour tout le lot (Convert.tsx options) ; clé par couple entrée/sortie ou préréglages (voir Interface) |
| CV-355 | Option | [Convertio] Options par fichier (taille différente pour chaque image) | Absent | P2 | ConvertOptions n'est pas dans Job (queue.ts) : l'ajouter et surcharger au besoin |

## 11. Interface du Convertisseur (file d'attente, lots, préréglages)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-356 | Interface | [Convertio] Ajouter des fichiers (sélecteur) et dossiers entiers (récursif) | Présent à vérifier | OK | Convert.tsx browse() + files.ts pickFiles/fromFileList (webkitdirectory) ; Ctrl+O ; dossier masqué en tactile |
| CV-357 | Interface | [Convertio] Glisser-déposer de fichiers et de dossiers sur la fenêtre | Présent à vérifier | OK | Convert.tsx onDrop + files.ts fromDataTransfer (profondeur 16, 500 fichiers) ; superposition « Déposer ici » |
| CV-358 | Interface | [Convertio] Limites de lot (500 fichiers, 512 Mo par fichier) | Présent à vérifier | OK | queue.ts MAX_JOBS/MAX_FILE_BYTES + addFiles (refus expliqués par notification) |
| CV-359 | Interface | [Convertio] Format de sortie par fichier | Présent à vérifier | OK | JobTable.tsx liste déroulante par ligne (targetsFor) ; formatLabel en français |
| CV-360 | Interface | [Convertio] « Tout convertir en » (format commun au lot) | Présent à vérifier | OK | ribbon.ts combo + queue.ts setAllTargets/commonTargets |
| CV-361 | Interface | [Convertio] Format par défaut intelligent selon le type du fichier | Présent à vérifier | OK | formats.ts defaultTarget (préférences par catégorie) |
| CV-362 | Interface | [Convertio] Nom de sortie par fichier (validation, dédoublonnage « (2) ») | Présent à vérifier | OK | JobTable.tsx OutNameField + naming.ts checkOutputName + queue.ts resultName |
| CV-363 | Interface | [PDF24] Ordre de la liste (glisser, flèches) qui pilote la fusion | OK | OK | listing.ts moveById/moveNear + JobTable.tsx poignée ; non testé à la souris réelle (STATUS) |
| CV-364 | Interface | [Convertio] Miniatures des fichiers (images, PDF page 1) | Présent à vérifier | OK | thumbs.ts (natif convert_miniatures ou canvas/pdf.js), Thumb.tsx IntersectionObserver ; autres types : icône |
| CV-365 | Interface | [Convertio] Progression par fichier (pourcentage, estimation du temps restant) | Partiel | P2 | JobTable.tsx State : barre indéterminée + « En cours » ; aucun pourcentage, aucune ETA (engines.ts ne remonte pas de progression) ; FFmpeg -progress ou compteurs de pages à prévoir |
| CV-366 | Interface | [Convertio] Arrêter le lot en cours | Partiel | P2 | Convert.tsx stopRef n'est lu qu'ENTRE deux fichiers : un fichier en cours (moteur natif long) n'est pas annulable ; ajouter annulation coopérative (jeton) et kill de l'outil externe (outils.rs executer) |
| CV-367 | Interface | [Convertio] Réessayer un fichier en erreur / tous les fichiers en erreur | Partiel | P3 | JobTable.tsx bouton Réessayer par ligne ; pas de « Réessayer les erreurs » |
| CV-368 | Interface | [Convertio] Traitement en parallèle (plusieurs fichiers à la fois) | Absent | P2 | Convert.tsx convertAll boucle séquentielle ; le natif tourne déjà dans spawn_blocking (convert_cmds.rs blocking) : pool de 2-4 tâches selon les coeurs, 1 pour les outils lourds |
| CV-369 | Interface | [Convertio] Résultat : enregistrer un fichier / enregistrer tout en ZIP | Présent à vérifier | OK | Convert.tsx saveJob/saveAll/zip() |
| CV-370 | Interface | [Convertio] Dossier de destination (enregistrement direct, bureau) | Partiel | P1 | Convert.tsx saveFile → native.ts saveInto (convert_save_into) SANS écrasement : un fichier déjà présent fait échouer la ligne (Cible.chemin_pour) alors qu'aucune case « Remplacer » ni renommage automatique n'existe |
| CV-371 | Interface | [Convertio] Reproduire l'arborescence du dossier source dans la destination | Absent | P2 | Job.relativePath est conservé pour l'affichage mais les sorties sont enregistrées à plat (saveInto utilise name seul) ; créer les sous-dossiers (Cible.dossier + chemin relatif validé) |
| CV-372 | Interface | [Convertio] Politique d'existant : remplacer / ignorer / numéroter / demander | Absent | P1 | Cible.ecraser booléen côté moteur ; interface sans choix ; défaut actuel = échec |
| CV-373 | Interface | [Convertio] Ouvrir le résultat dans le module adapté (Word, Excel, PDF...) | Présent à vérifier | OK | JobTable.tsx bouton « Ouvrir dans » (moduleForFile) + Convert.tsx openJob → services.openDocument |
| CV-374 | Interface | [Convertio] Historique des conversions persistant | Partiel | P3 | queue.ts pushHistory (50), volet Historique : noms et dates seulement, sans chemin, taille, durée ni action « ouvrir/refaire » |
| CV-375 | Interface | [Convertio] Aperçu du résultat avant enregistrement (avant / après) | Absent | P2 | seul l'« Ouvrir » du module adapté permet de voir ; ajouter volet d'aperçu (image, PDF page 1, texte) à côté de la source ; voir CV-A02 |
| CV-376 | Interface | [Convertio] Comparaison de taille avant / après (ratio, gain en %) | Partiel | P2 | JobTable.tsx affiche la taille source (colonne) et la taille du résultat (état) sans écart ; calculer et colorer le gain (surtout compression d'images/PDF) |
| CV-377 | Interface | [Convertio] Journal d'erreurs détaillé (copier, exporter) | Partiel | P2 | message d'erreur par ligne (info-bulle) ; shell.log.info côté Rust (convert_cmds.rs) sans le détail utilisateur ; ni copie ni fichier de journal consultable |
| CV-378 | Interface | [Convertio] Avertissements du moteur affichés (LibreOffice et liens externes, rendu simplifié, caviardage partiel) | Absent | P1 | engines.ts convertFile ne lit que .files de runBytes : Output::Fichiers.avertissements (externe.rs AVERTISSEMENT_LIBREOFFICE, rendu simplifié) n'arrive jamais à l'utilisateur ; afficher une pastille d'avertissement sur la ligne |
| CV-379 | Interface | [Convertio] Notification de fin (système, son) lorsque la fenêtre est en arrière-plan | Partiel | P3 | Convert.tsx services.notify (toast dans l'application) uniquement ; notification système et option sonore à ajouter via Tauri notification |
| CV-380 | Interface | [Convertio] Reprise après fermeture ou plantage (liste et état conservés) | Absent | P2 | la liste n'est que dans l'état React (octets en mémoire) ; persister les chemins + options + format dans les réglages (services.settings) pour rouvrir la liste en bureau |
| CV-381 | Interface | [Convertio] Préréglages / profils (« Photos web 1600 px », « E-mail 25 Mo », « Archivage PDF/A ») | Absent | P1 | aucun profil : usePersistentState déjà utilisé pour l'historique (Convert.tsx) ; modèle { nom, formats, options, outils PDF } + import/export JSON |
| CV-382 | Interface | [Convertio] Tri, filtre, sélection multiple et actions en bloc dans la liste | Absent | P3 | table sans tri ni sélection : seulement « Retirer les terminés » et « Vider » ; sélection pour appliquer outils PDF (voir Outils PDF) |
| CV-383 | Interface | [Convertio] Renommage par motif ({nom}, {n}, {date}, {format}, {largeur}) pour le lot | Absent | P2 | seul le nom unique par fichier existe (OutNameField) ; ajouter un motif global dans resultName (queue.ts) |
| CV-384 | Interface | [Convertio] Dédoublonnage des noms de sortie dans la session | Présent à vérifier | OK | queue.ts resultName → formats.ts outputName « nom (2).ext » |
| CV-385 | Interface | [Convertio] Dédoublonnage des fichiers d'entrée identiques (même contenu) | Absent | P3 | empreinte SHA-256 des octets à l'ajout (queue.ts addFiles) et avertissement |
| CV-386 | Interface | [Convertio] Page « Formats pris en charge » (matrice par catégorie, mention bureau) | Partiel | P3 | Convert.tsx formatsPage (Backstage) : une ligne par catégorie d'après un seul fichier-exemple, sans matrice entrée × sortie ni indication des outils externes requis |
| CV-387 | Interface | [Convertio] Information utilisateur « outil externe requis » par conversion (LibreOffice, Ghostscript, ffmpeg, ...) | Partiel | P2 | ribbon.ts grise les outils PDF d'après capacites() mais targetsFor ne tient compte que de nativeSupports : une conversion dépendant d'un outil absent s'affiche comme disponible puis échoue (externe.rs OutilAbsent) |
| CV-388 | Interface | [Convertio] Interface tactile / mobile (Android, iOS) | Partiel | P2 | Convert.tsx useDeviceMode (pas de dossier, flèches 44 px, gros bouton) ; moteur natif sur mobile : convert_pick_folder renvoie None (convert_cmds.rs), PDF → images en repli pur Rust |
| CV-389 | Interface | [Convertio] Raccourcis clavier (F5, Ctrl+O, Suppr, Ctrl+A) | Partiel | P3 | seuls F5 (convertir) et Ctrl+O existent (Convert.tsx onKey) |
| CV-390 | Interface | [Convertio] Accessibilité (étiquettes, focus, lecteurs d'écran) de la table de lot | Partiel | P3 | aria-label sur sélecteurs et nom de sortie, aria-invalid ; zone de dépôt role=button ; non audité aux lecteurs d'écran |
| CV-391 | Interface | [Convertio] Interface en français | Présent à vérifier | OK | strings.ts, ruban et messages d'erreur du moteur tous en français |

## 12. Intégration (moteur, pont Tauri, outils externes, système)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-392 | Intégration | [Convertio] Moteur forge-convert sans Tauri, API typée Operation / Output (serde) | Présent à vérifier | OK | crates/forge-convert/src/operation.rs run() ; erreurs françaises sérialisables (erreur.rs) |
| CV-393 | Intégration | [Convertio] Pont Tauri : exécution sur chemins autorisés, en mémoire, dossier, miniatures | Présent à vérifier | OK | apps/desktop/src-tauri/src/convert_cmds.rs : convert_run, convert_run_bytes (trame binaire, 1 Go), convert_pick_folder, convert_save_into, convert_miniatures, convert_capacites ; travail dans spawn_blocking avec garde de panique |
| CV-394 | Intégration | [Convertio] Détection des outils externes et capacités (capacites()) | Partiel | P1 | operation.rs capacites + outils.rs Outil : Ghostscript, mutool, pdftoppm, pdftotext, ocrmypdf, LibreOffice seulement ; manquent FFmpeg/ffprobe, Pandoc, ImageMagick (magick), Tesseract, Calibre (ebook-convert), 7-Zip/unrar, Inkscape, Edge/Chromium, heif-convert |
| CV-395 | Intégration | [FFmpeg] FFmpeg / ffprobe détectés et pilotés (progression, annulation) | Absent | P1 | ajouter Outil::Ffmpeg/Ffprobe (outils.rs), opération Operation::Media { entree, sortie, options } avec -progress pipe:1, délai long et kill ; capacites() « audio_video » ; voir aussi MSI/installeur : proposer FFmpeg via winget |
| CV-396 | Intégration | [Pandoc] Pandoc détecté et piloté (formats d'entrée/sortie, --toc, --reference-doc, --citeproc) | Absent | P2 | Outil::Pandoc + fichiers sous noms fixes dans DossierTemp (même modèle que externe.rs) ; liste des formats via pandoc --list-input-formats |
| CV-397 | Intégration | [ImageMagick] ImageMagick (magick) ou libvips en repli pour heic, psd, raw, jxl, formats rares | Absent | P2 | Outil::Magick (magick convert ...), policy.xml de sécurité (désactiver MSL/URL/PS) à vérifier avant usage ; sorties validées comme les autres |
| CV-398 | Intégration | [LibreOffice] LibreOffice headless (Office → PDF) durci | Partiel | P2 | externe.rs office_vers_pdf : profil utilisateur temporaire, --headless --norestore, délai 600 s ; manquent -nolockcheck, --nologo, options de filtre, limite mémoire/CPU, arrêt de l'arbre de processus, et test réel (ROADMAP §1) |
| CV-399 | Intégration | [PDF24] Ghostscript (PDF/A, rendu) et ocrmypdf (OCR) exécutés sans shell | Partiel | P2 | externe.rs executer : arguments en liste, fichiers sous noms fixes, délai 600 s ; jamais exercés sur le PC de développement ; fenêtre console possible sous Windows (pas de CREATE_NO_WINDOW dans outils.rs executer, à vérifier) |
| CV-400 | Intégration | [Convertio] Chaînage d'opérations (pipeline : docx → pdf → png, scan → ocr → docx) | Absent | P1 | le moteur enchaîne des ACTIONS PDF (Operation::Pdf) mais pas des conversions : ajouter Operation::Pipeline { etapes } avec fichiers intermédiaires privés (DossierTemp) ; interface « Convertir en » multi-étapes |
| CV-401 | Intégration | [PDF24] Ligne de commande / mode headless (forge-convert-cli, ForgeOffice.exe --convert) | Absent | P1 | le crate n'a aucun [[bin]] ; ajouter src/bin/forge-convert.rs : `forge-convert convertir in.docx --vers pdf --sortie dossier`, `--json`, codes de sortie, lecture d'une Operation JSON sur stdin ; launch.rs ignore aujourd'hui les options (files_from_args) |
| CV-402 | Intégration | [PDF24] Menu contextuel de l'Explorateur « Convertir avec ForgeOffice » | Absent | P1 | modules.ts convert.extensions est vide (aucune association) ; clés HKCU\Software\Classes\*\shell\ForgeOfficeConvert\command via installerHooks NSIS (ROADMAP : hook à finir), argument `--module convert "%1"` à gérer dans launch.rs (qui ignore aujourd'hui toute option commençant par « - ») avec la seconde instance pour regrouper une multi-sélection ; menu Windows 11 moderne : IExplorerCommand (paquet fragmenté) |
| CV-403 | Intégration | [PDF24] Imprimante PDF virtuelle (imprimer depuis n'importe quelle application vers un PDF ou vers le Convertisseur) | Absent | P2 | Windows : pilote d'impression PostScript + moniteur de port vers Ghostscript pdfwrite (modèle PDFCreator/RedMon), ou dossier surveillé alimenté par « Microsoft Print to PDF » ; effort L, hors périmètre court terme |
| CV-404 | Intégration | [PDF24] Dossier surveillé (conversion automatique des fichiers déposés) | Absent | P2 | crate notify côté Tauri + règles { dossier, extension → format, destination } ; exécution via forge-convert ; arrêt propre exigé (job object) |
| CV-405 | Intégration | [Convertio] Ouvrir avec : un fichier lancé vers le Convertisseur | Partiel | P3 | Convert.tsx accepte la prop file (« Ouvrir avec ») mais aucune association de fichiers ne cible le module Convertisseur |
| CV-406 | Intégration | [Convertio] API locale / script (appel depuis d'autres modules, PowerShell, macros) | Absent | P3 | exposer les opérations par la CLI et un canal Tauri documenté ; @forgeoffice/convert exporte déjà native.ts et pdfOps pour le module PDF |
| CV-407 | Intégration | [Convertio] Mise à jour et installation des outils externes (winget/scoop) proposées dans l'interface | Absent | P3 | messages OutilAbsent (erreur.rs) en texte seul : lien d'installation ou commande winget par outil, détection après installation |
| CV-408 | Intégration | [Convertio] Fiabilité de la table de formats : nativeSupports miroir de prise_en_charge | OK | OK | formats.ts nativeSupports testé contre la table du moteur (convert.test.ts « table native = miroir ») ; risque de dérive entre TS et Rust à surveiller (aucune génération automatique) |
| CV-409 | Intégration | [Convertio] Tests de bout en bout des chaînes natives (Convertisseur → Tauri → Rust) | Partiel | P2 | 107 tests Rust (conversions.rs, pdf_*.rs) et 18 tests TS ; aucune exécution réelle de LibreOffice/Ghostscript/ocrmypdf ni de convert_miniatures sur de vrais fichiers (ROADMAP §1, STATUS) |

## 13. Sécurité, robustesse et performances
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-410 | Option | [Convertio] Plafond de taille d'entrée (512 Mo) et de sortie (1 Gio) | Présent à vérifier | OK | fichiers.rs MAX_ENTREE / MAX_SORTIE, verifier_entree ; convert_run_bytes 1 Go au total (convert_cmds.rs) ; queue.ts MAX_FILE_BYTES |
| CV-411 | Option | [Convertio] Anti-bombe de décompression des archives (zip, tar, 7z, epub) | Présent à vérifier | OK | archives.rs MAX_TOTAL_BYTES 512 Mo / MAX_ENTRIES 10 000 (lectures bornées) ; epub.rs 256 Mio/entrée, 1 Gio total ; documents Office : lire_texte_borne (mod.rs) |
| CV-412 | Option | [Convertio] Anti zip-slip / chemins hostiles dans les archives | OK | OK | archives.rs sanitize_entry_name (.., absolus, « : » refusés) ; tests conversions.rs zip_vers_tar_assainit_les_noms |
| CV-413 | Option | [Convertio] Anti-bombe d'images (pixels) à la conversion raster → raster | Partiel | P2 | conv/images.rs convert_image_file utilise image::open sans Limits ni plafond de pixels (image::Limits par défaut : 512 Mio d'allocation) alors que pdf/images.rs fixe 100 Mpx et 1 Gio ; reprendre decoder() (pdf/images.rs) partout |
| CV-414 | Option | [Convertio] Anti-bombe SVG (dimensions) et ressources externes | OK | OK | images.rs svg_to_dynamic_image : plafond 64 Mpx, résolveur d'images désactivé (aucune lecture disque) ; tests svg_geant_refuse / svg_ne_lit_pas_les_fichiers_locaux |
| CV-415 | Option | [Convertio] Anti-bombe audio (échantillons décodés) | Présent à vérifier | OK | audio.rs MAX_SAMPLES 100 M échantillons (~19 min stéréo) ; limite à relever en flux (écriture au fil de l'eau) plutôt qu'en mémoire |
| CV-416 | Option | [Convertio] Noms de sortie confinés au dossier choisi, pas d'écrasement par défaut, écriture atomique | OK | OK | fichiers.rs Cible (valider_nom, .part puis rename) ; tests noms_de_sortie_hostiles_refuses / sortie_hostile_refusee_par_run_sans_rien_ecrire |
| CV-417 | Option | [Convertio] Chemins d'entrée limités aux fichiers autorisés par l'utilisateur | Présent à vérifier | OK | convert_cmds.rs check_paths + substitute (marqueurs @0/@sortie) : la page ne désigne jamais de chemin réel |
| CV-418 | Option | [Convertio] Injection de formule CSV neutralisée (= + - @) | OK | OK | office.rs csv_safe (natif) et engines.ts escapeFormulas (TS) ; test csv_vers_json_et_injection_de_formule_neutralisee |
| CV-419 | Option | [Convertio] Entrées XML hostiles (entités externes, milliards de rires) | Partiel | P3 | quick-xml ne résout pas les entités externes ; lectures bornées pour docx/pptx/odt ; aucune limite de profondeur/nombre de noeuds dans donnees.rs xml_to_value |
| CV-420 | Option | [Convertio] PDF hostiles (objets récursifs, flux géants) | Partiel | P2 | lopdf refuse un PDF invalide ; rendu_simple borné (500 pages, 40 Mpx, 5 M opérateurs) ; pas de délai maximal sur les opérations pur Rust (seuls les outils externes ont 600 s) : thread surveillé avec échéance |
| CV-421 | Option | [Convertio] Tableurs malformés (panique de calamine) | OK | OK | office.rs read_excel_all_sheets : catch_unwind + plafond 500 000 cellules ; convert_cmds.rs blocking → proteger (garde de panique) ; test xls_malforme_donne_une_erreur_pas_un_panic |
| CV-422 | Option | [Convertio] Documents Office avec macros ou liens externes | Partiel | P2 | LibreOffice peut suivre des liens externes d'un document hostile : avertissement prévu (AVERTISSEMENT_LIBREOFFICE) mais non affiché par l'interface (voir Interface) ; docm/xlsm : macros jamais exécutées par la suite |
| CV-423 | Option | [Convertio] Fichiers temporaires privés supprimés (RAII), pas de mot de passe en argv | Présent à vérifier | OK | fichiers.rs DossierTemp (0o700, Drop), chiffrement AES-256 en pur Rust, ocrmypdf/gs avec noms fixes |
| CV-424 | Option | [Convertio] Type réel du fichier (signature) vérifié, pas seulement l'extension | Partiel | P2 | formats.ts extensionOf se fie au nom ; docx/xlsx détectent la signature (detectFormat) mais pas le Convertisseur : un .jpg qui est un zip ou un exécutable renommé n'est pas signalé |
| CV-425 | Option | [Convertio] Performances : lecture des fichiers en mémoire et copie vers Rust | Partiel | P2 | files.ts lit chaque fichier entier (arrayBuffer) puis runBytes concatène et copie par IPC (jusqu'à 512 Mo ×2-3) alors que convert_run (chemins) évite la copie : utiliser les chemins pour les fichiers du disque (Job.path existe) |
| CV-426 | Option | [Convertio] Performances : conversions TypeScript hors fil de l'interface | Absent | P2 | viaSuite/viaCanvas s'exécutent sur le fil principal (docx/xlsx/pptx lourds figent l'interface) : Web Worker pour packages/docx, xlsx, pptx ; pdf.js a déjà son worker |
| CV-427 | Option | [Convertio] Performances : audio décodé en entier en mémoire (i16) | Partiel | P3 | audio.rs decode_audio accumule tout le PCM : traitement en flux (symphonia + écriture au fil de l'eau) pour les longs fichiers |
| CV-428 | Option | [Convertio] Performances : rendu PDF → images page par page avec libération mémoire | Partiel | P3 | engines.ts pdfPages garde toutes les pages encodées en mémoire avant retour ; émettre au fur et à mesure (zip en flux) |
| CV-429 | Option | [Convertio] Fermeture propre : aucun processus enfant orphelin après arrêt d'un lot | Partiel | P2 | exigence suite (Job Object KILL_ON_JOB_CLOSE) : outils.rs executer tue l'enfant sur délai mais pas ses petits-enfants (LibreOffice soffice.bin) ; Convert.tsx stop n'interrompt pas l'outil en cours ; à vérifier par kill brutal |

## 14. Au-delà d'Office (idées différenciantes)
| ID | Type | Conversion / fonction (référence) | Statut | Prio | Preuve / remarque |
|---|---|---|---|---|---|
| CV-A01 | Au-delà | [Convertio] Chaînes de conversion multi-étapes (graphe) : docx → pdf → png, scan → ocr → docx, markdown → epub → mobi | Absent | P1 | Operation::Pipeline { etapes: Vec<Operation> } dans operation.rs avec fichiers intermédiaires dans DossierTemp et plafonds cumulés ; interface : « Convertir en » proposant les chemins en 2 étapes calculés par un graphe de formats (BFS sur prise_en_charge + outils présents) |
| CV-A02 | Au-delà | [LibreOffice] Rapport de fidélité et comparaison avant / après : curseur d'images, différence de texte, liste de ce qui a été perdu (polices, images, tableaux, formules) | Partiel | P2 | base existante : pdf/texte.rs comparer (similar, HTML), rendu_simple, thumbs.ts ; ajouter Output::Rapport { pertes: Vec<Perte> } produit par chaque pivot (ex. « 12 images ignorées ») et un volet d'aperçu double dans Convert.tsx |
| CV-A03 | Au-delà | [PDF24] Dossiers surveillés avec règles (Hazel / PDF24 Autopilote) : « tout .heic déposé → .jpg 1600 px dans /Photos » | Absent | P2 | crate notify côté Tauri, règles en JSON dans les réglages, exécution via Operation + préréglage (CV-A14), journal et corbeille de secours ; arrêt propre via Job Object |
| CV-A04 | Au-delà | [PDF24] OCR local multilingue (images et PDF) vers PDF cherchable, texte, docx et tableaux xlsx | Absent | P2 | moteur ocrs (pur Rust, rten + modèles ONNX embarqués ou téléchargés) en repli de Tesseract ; reconnaissance de lignes/colonnes pour xlsx ; détection de langue ; OCR de lots sur la file existante |
| CV-A05 | Au-delà | [FFmpeg] Compression intelligente vers une taille cible (« moins de 25 Mo pour un e-mail »), pour images, PDF et vidéo | Absent | P2 | recherche dichotomique de la qualité JPEG / DPI / CRF avec ré-encodage d'essai sur échantillon ; compression.rs et images.rs fournissent déjà les briques ; progression dans l'interface |
| CV-A06 | Au-delà | [ImageMagick] Renommage et rangement par métadonnées : {date EXIF}, {titre PDF}, {artiste ID3}, {n} sur tout le lot | Absent | P2 | lecture EXIF (kamadak-exif), Info PDF (securite.rs lire_metadonnees), tags audio (lofty) ; moteur de motifs unique partagé avec le renommage de sortie (queue.ts resultName) |
| CV-A07 | Au-delà | [PDF24] Assainir avant partage : retirer auteur, GPS, commentaires, révisions, texte masqué, historique, pièces jointes, JavaScript | Partiel | P1 | pdf/purge.rs (XMP, PieceInfo, Info, Thumb) existe pour le caviardage ; étendre à docx/xlsx/pptx (core.xml, comments, rsid) et images (EXIF) avec rapport « avant / après » ; case « Assainir » par préréglage |
| CV-A08 | Au-delà | [Convertio] Page web ou URL → PDF / EPUB / Markdown propre (mode lecture, sans publicités) | Absent | P2 | Edge/Chromium headless ou WebView2 pour le rendu + extraction lisible (équivalent Readability en Rust : crate readability ou dom_smoothie) puis epub (ecriture_zip.rs) ; garde-fou SSRF (liste de blocage 169.254.*, réseau privé) |
| CV-A09 | Au-delà | [Pandoc] Atelier e-book : assembler plusieurs md / docx / html en un EPUB avec couverture, table des matières, CSS, métadonnées, contrôle de validité | Absent | P2 | ecriture_zip.rs epub() étendu (multi-chapitres, nav.xhtml, cover, OPF complet) + éditeur d'ordre des chapitres (listing.ts moveNear) + vérification XML/OPF intégrée |
| CV-A10 | Au-delà | [PDF24] Médecin de fichiers : détecter le vrai type (signature), réparer PDF / zip / docx corrompus, récupérer le contenu lisible | Absent | P2 | lecture des octets magiques avant conversion (remplace la confiance dans l'extension), reconstruction xref lopdf, zip récupérable entrée par entrée (zip crate), OPC partiel ; rapport de ce qui a été sauvé |
| CV-A11 | Au-delà | [FFmpeg] Transcription locale audio / vidéo → srt, vtt, txt, docx (Whisper), avec traduction hors ligne | Absent | P2 | crate whisper-rs (whisper.cpp) avec modèles téléchargés à la demande, exécution en tâche de fond annulable ; sortie via les écrivains de sous-titres (section 7) |
| CV-A12 | Au-delà | [Convertio] Atelier sous-titres : resynchronisation (décalage, fps), fusion bilingue, correction de césures, contrôle de lisibilité (caractères par seconde) | Absent | P3 | module sous_titres.rs sur une liste de cues (partagé avec les conversions srt/vtt/ass) ; pas de dépendance externe |
| CV-A13 | Au-delà | [LibreOffice] Comparer deux versions de document (docx, xlsx, pptx) et produire un document avec modifications suivies | Absent | P3 | diff de blocs sur le modèle de packages/docx (paragraphes, tableaux) puis écriture de w:ins / w:del ; xlsx : diff cellule par cellule ; réutilise similar côté Rust si fait en natif |
| CV-A14 | Au-delà | [Convertio] Préréglages et « recettes » partageables : format, options, outils PDF, destination, renommage ; import / export JSON signé | Absent | P1 | modèle versionné stocké par services.settings (usePersistentState déjà utilisé pour l'historique), menu « Appliquer le préréglage » dans le ruban, partage par fichier .forgerecette |
| CV-A15 | Au-delà | [PDF24] Numérisation directe (scanner WIA / TWAIN / SANE) → PDF avec recadrage automatique, redressement, séparation par feuille-code QR, OCR | Absent | P3 | côté Tauri : crate windows (WIA) ou SANE ; traitements image dans images.rs (deskew, trim) ; sortie vers images_vers_pdf puis ocr ; mode « un document par code-barres » |
| CV-A16 | Au-delà | [Convertio] Partage du résultat au téléphone par code QR (serveur local éphémère, jeton à usage unique, expiration) | Absent | P3 | petit serveur HTTP lié à 127.0.0.1/LAN via Tauri avec jeton aléatoire (fichiers.rs jeton()) + qrcode ; coupe-circuit à la fermeture ; exposition réseau soumise à confirmation |
| CV-A17 | Au-delà | [PDF24] Publipostage PDF / documents : remplir un formulaire PDF ou un modèle docx pour chaque ligne d'un CSV / xlsx, une sortie par ligne | Absent | P3 | pdf/formulaires.rs remplir + aplatir déjà prêts ; modèle docx : remplacement {{champ}} dans packages/docx ; zip des sorties ; renommage par colonne |
| CV-A18 | Au-delà | [Convertio] Explorateur d'archives : aperçu du contenu, extraction sélective, test d'intégrité, conversion sans extraction complète | Partiel | P3 | read_zip / read_tar_from / read_7z (archives.rs) donnent déjà la liste ; exposer Operation::ListerArchive / Tester / ExtraireSelection avec les plafonds anti-bombe existants |
| CV-A19 | Au-delà | [ImageMagick] Optimiseur d'images sans perte et vectorisation : oxipng, mozjpeg, AVIF/WebP automatiques, rapport d'économie ; raster → SVG | Absent | P3 | crates oxipng, jpeg-encoder, ravif (déjà tiré par image), webp, vtracer ; mode « dossier de site web » (srcset multi-tailles) ; rapport en Mo économisés |
| CV-A20 | Au-delà | [Convertio] Manifeste d'intégrité et signature des sorties (SHA-256 + Ed25519, horodatage) pour prouver qu'un fichier n'a pas été altéré | Absent | P3 | sha2 + ed25519-dalek ; format .sha256 compatible sha256sum ; clé d'auto-update de la suite réutilisable ; page de vérification dans le Convertisseur |
