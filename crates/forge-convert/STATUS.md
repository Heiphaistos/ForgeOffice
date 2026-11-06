# forge-convert : état (2026-11-04)

Moteur de conversion et d'outils PDF de ForgeOffice, repris de ForgePDF (`engine/` + `commands.rs`), en crate Rust autonome sans Tauri. Détail opération par opération : `INVENTAIRE.md`.

## Vérifications

- `cargo build` : OK.
- `cargo clippy --all-targets` : 0 avertissement (`unwrap_used`/`expect_used` interdits hors tests).
- `cargo test` : **107 tests, 0 échec** (25 unitaires + 31 `conversions` + 13 `pdf_caviardage` + 11 `pdf_caviardage_avance` + 20 `pdf_outils` + 7 `pdf_rendu`). Tous les PDF sont générés dans les tests (74 avant le lot du 2026-11-05).

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
| Caviardage réel | voir le détail ci-dessous (texte, images, tracés vectoriels, pages pivotées/CropBox) | pur Rust (mutool supprimé, la page reste vectorielle) |
| Correctifs de texte | l'ancien texte est retiré puis le nouveau est écrit | pur Rust |
| Images | images ou SVG vers PDF (JPEG intégré sans recompression, transparence en SMask), extraction des images | pur Rust |
| Texte | extraction par page, comparaison HTML | pur Rust (pdftotext seulement en repli) |
| Conversions | table de ForgePDF complète : images, SVG, txt, md, html, docx, pptx, odt, odp, rtf, epub, xlsx, xls, ods, csv, json, yaml, toml, xml, srt, vtt, archives, audio | pur Rust (printpdf retiré, lopdf à la place) |

### Caviardage

Sous chaque zone :
- les glyphes sont retirés de `Tj`, `TJ`, `'` et `"`, et remplacés par un décalage, donc le reste de la ligne ne bouge pas ;
- les pixels des images sont noircis, y compris dans le masque SMask ; un JPEG que le décodeur simple refuse (`/Decode`, CMYK/YCCK via `image`) est aussi noirci seulement dans la zone (`images::decoder_jpeg_libre`) ; une image non décodable (masque d'image, palette, CCITT, JPEG 2000...) reste supprimée en entier mais est ANNONCÉE dans `avertissements` ;
- **tracés vectoriels** (`pdf/traits.rs`) : les opérateurs `m l c v y re h` puis `S s f F f* B B* b b* n` sont lus avec la matrice courante (`cm`, `q`/`Q`, formulaires) et l'épaisseur de trait (`w`, `gs /LW`) ; un dessin entièrement sous une zone est supprimé (`traits_supprimes`), un dessin qui la chevauche est RECADRÉ pour de vrai (remplissage : polygone moins la zone en morceaux disjoints ; trait : polyligne coupée, zone élargie de l'épaisseur ; courbes touchées aplaties en 12 segments, `traits_ecretes`). Un chemin d'écrêtage `W`/`W*` est conservé (`n`) pour ne jamais élargir la zone visible. Plafond de 200 000 segments par dessin (au-delà, supprimé s'il touche une zone) ;
- **pages pivotées et CropBox** : `Zone` est exprimée sur la page AFFICHÉE ; `Zone::en_points_rot` applique `/Rotate` (0/90/180/270) et la CropBox recoupée par la MediaBox (`boite_page`). Les correctifs de texte (`CorrigerTexte`) écrivent un texte droit sur une page pivotée (matrice `cm`) ;
- les formulaires XObject sont réécrits récursivement ;
- les annotations touchées sont supprimées, ainsi que les champs correspondants ;
- les anciens flux sont purgés du fichier ;
- données annexes purgées (`pdf/purge.rs`) : `/Thumb` des pages touchées, `/Metadata` (XMP) et `/PieceInfo` partout, `/Info` du trailer ; les signets, champs de formulaire, annotations et éléments de structure (`ActualText`, `Alt`) qui contiennent un mot disparu sont vidés. Le texte retiré est connu EXACTEMENT : chaînes des glyphes retirés décodées avec la police (`pdf/decodage.rs` : /ToUnicode bfchar/bfrange, /codespacerange à longueur de code variable, encodages WinAnsi/MacRoman/Standard et /Differences avec noms de glyphes Adobe, uniXXXX) puis comparaison avant/après du texte extrait par lopdf ET par notre lecteur, mots de toute longueur. Un mot de 3 caractères ou plus est cherché dans l'élément annexe ; un mot de 1 ou 2 caractères ne vide que l'élément dont la valeur entière lui est égale (aucun signet sans rapport n'est supprimé) ; les éléments qui le contiennent sans lui être égaux sont comptés dans un avertissement (« à vérifier »). Le rapport (`avertissements`) le signale.

Les tests le vérifient par extraction de texte **et** par une recherche dans le fichier brut et dans tous les flux décompressés.

### Entrées hostiles

- Lectures de zip bornées (256 Mio par entrée, 1 Gio au total pour un EPUB) : la taille déclarée d'un zip peut être falsifiée.
- Tableurs : calamine 0.38 (RUSTSEC-2026-0436 corrigée), appel enveloppé dans `catch_unwind` (inactif avec `panic = "abort"`, mais protège les autres profils).
- SVG : le résolveur d'images d'usvg ne lit jamais le disque (seules les URI `data:` sont résolues).
- LibreOffice « haute fidélité » : profil utilisateur temporaire et privé ; les liens externes d'un document hostile peuvent être suivis, l'opération renvoie donc un avertissement (`Output::Fichiers.avertissements`).
- Dossiers temporaires créés en mode 0o700 sous Unix.
- EPUB : lecteur maison (`conv/epub.rs`, `zip` + `quick-xml`), le crate `epub` (GPL-3.0) est retiré. container.xml, OPF, manifest et spine ; chemins normalisés, `..` hors de l'archive refusé.

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

## Rendu PDF vers images en pur Rust (`pdf::rendu_simple`)

Repli quand ni MuPDF, ni Poppler, ni Ghostscript ne sont là (Android, iOS, PC nu) : `PdfVersImages` l'utilise tout seul et ajoute l'avertissement « Rendu simplifié ». Faisabilité évaluée et réalisée (~1 000 lignes en 4 fichiers `pdf/rendu/`) avec des crates DÉJÀ liées par resvg : `tiny-skia` (chemins, traits, tirets, écrêtage par masque, images), `ttf-parser` (contours TrueType/OpenType intégrés), `fontdb` (police système proche pour les polices non intégrées). Pris en charge : chemins remplis/tracés, couleurs Device (gris/RVB/CMYK), images JPEG et Flate 8 bits avec SMask, masques d'image 1 bit, formulaires XObject, texte (largeurs du PDF, décodage ToUnicode/Differences), rotation et CropBox, opacité (`gs`). Non pris en charge (annoncé) : dégradés `sh` et motifs, images en ligne `BI`, polices Type 1/Type 3 intégrées (police système ou repères gris), images CCITT/JBIG2/JPEG 2000/palette (cadre gris), annotations, transparence de groupe. Bornes : 500 pages, 40 Mpx par page (résolution réduite au-delà), 5 M d'opérateurs, 48 `q` imbriqués, 8 niveaux de formulaires. Vérifié aussi à l'œil sur une page de texte (PNG regardé). Sur Android/iOS il n'y a pas de police système lisible par `fontdb` : le texte non intégré y est rendu en repères gris.

## Fusion, noms et ordre (API pour le Convertisseur)

- `Fusionner { entrees, ordre?, mots_de_passe?, sortie }` : `ordre` = indices 0-based uniques dans `entrees` (les fichiers non cités sont laissés de côté), sinon l'ordre de `entrees` ; `mots_de_passe` = mot de passe d'ouverture de chaque entrée.
- `Decouper`, `ExtraireImages`, `PdfVersImages` : `noms` (facultatif) = noms de base des fichiers produits dans l'ordre (extension ajoutée si absente) ; `Zipper` : `noms` = nom de chaque fichier DANS l'archive. Noms validés (aucun séparateur, pas de doublon). Tous les champs ont `#[serde(default)]` : le JSON d'avant reste valide.
- ATTENTION : en Rust, ces variantes gagnent des champs ; `apps/desktop/src-tauri/src/convert_cmds.rs` doit écrire `Operation::Fusionner { entrees, sortie, .. } | Operation::ImagesVersPdf { entrees, sortie } | Operation::Zipper { entrees, sortie, .. }` (un `..` à ajouter ligne 53). Non fait ici : hors périmètre du lot.

## Dépendances et sécurité

- `zip` 9.3.0 (≥ 9.0.5 : faille critique « Dual-Header » corrigée) est la SEULE version liée par forge-convert : `rust_xlsxwriter` passé de 0.93 à 0.102 (zip 9), `epub-builder` (zip 6) et `docx-rs` (zip 8) RETIRÉS et remplacés par `conv/ecriture_zip.rs` (EPUB 3 : `mimetype` non compressé en premier, container, OPF, nav, chapitre ; DOCX : types de contenu, relations, `word/document.xml` avec texte échappé). Aller-retour vérifié par nos lecteurs (`conv/epub.rs`, `docx_to_text`). `cargo tree -i zip` : 9.3.0 via calamine, rust_xlsxwriter et forge-convert ; `apps/desktop/src-tauri/Cargo.lock` : 9.3.0 aussi (tauri-plugin-updater).
- `glib` 0.18.5 (RUSTSEC, comportement indéfini, Linux seulement via GTK de Tauri 2) : aucun correctif sans migrer Tauri ; RISQUE ACCEPTÉ, non lié par forge-convert ni forge-base.

## Dépendances externes (optionnelles, détectées)

| Outil | Sert à | Sans lui |
|---|---|---|
| Ghostscript (`gs`, `gswin64c`) | PDF/A-2b ; 3e repli du rendu en images | `OutilAbsent` avec message français |
| ocrmypdf + Tesseract | OCR | idem |
| MuPDF (`mutool`), sinon Poppler (`pdftoppm`), sinon Ghostscript | rendu PDF vers PNG ou JPG fidèle | rendu simplifié intégré (`pdf::rendu_simple`) |
| Poppler (`pdftotext`) | repli d'extraction si lopdf ne trouve aucun texte | message « lancez l'OCR » |
| LibreOffice (`soffice`) | Office vers PDF fidèle (`haute_fidelite`) | conversion simplifiée en pur Rust |

Sur ce PC, seul `pdftotext` est installé. Les chemins Ghostscript, MuPDF, OCR et LibreOffice ne sont donc **pas exercés en vrai**, seulement le cas « outil absent » et la validation des arguments.

## Reste à faire

- Caviardage : les dégradés (`sh`), motifs et images en ligne `BI` sous une zone ne sont pas retirés (recouverts) ; la couture entre morceaux d'un remplissage recadré peut se voir à l'antialiasing ; une image dans un format non décodable (JPX, CCITT, JBIG2, palette, masque d'image) est retirée entièrement (annoncé) ; les polices à CMap prédéfinie non intégrée (hors Identity) sont lues sur 2 octets ; les CMap /ToUnicode à `usecmap` ne sont pas suivies.
- Rendu simplifié : voir la section dédiée (dégradés, motifs, Type 1/Type 3, CCITT/JBIG2/JPX, annotations). Non exercé sur Android/iOS.
- `Zone::en_points` (utilisé par annotations et champs de formulaire) ignore toujours `/Rotate` : seul le caviardage/correctif utilise `en_points_rot`.
- PDF/A, OCR et LibreOffice : à tester sur une machine où ces outils sont installés ; le rendu externe aussi (ici seul `pdftotext` est présent).
- Brancher les nouveaux champs d'`Operation` dans `apps/desktop/src-tauri/src/convert_cmds.rs` (un `..` au motif ligne 53) et dans `packages/convert`/`packages/pdf`. Hors périmètre de ce lot.
