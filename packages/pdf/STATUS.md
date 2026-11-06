# packages/pdf : état (2026-11-04)

Module PDF de ForgeOffice : lecteur pdf.js + édition façon Acrobat, interface Office 2024 (ruban Fichier, Accueil,
Commentaire, Modifier, Organiser, Protéger, Outils ; rail Miniatures / Signets / Rechercher / Commentaires / Historique).
Écriture en TypeScript avec `@cantoo/pdf-lib` 2.11.1 (fork maintenu de pdf-lib, MIT, remplace pdf-lib 1.17.1 abandonné depuis mai 2022) ; opérations lourdes par le moteur natif `forge-convert` (coquille de bureau,
commande `convert_run_bytes`) ; ce qui manque est grisé avec la raison de `capacites()`.

## Vérifications

- `node --test packages/pdf/tests/*.test.ts` : 42 tests (coordonnées /Rotate + CropBox, annotations écrites puis relues pour 4 rotations, modification/suppression d'annotations du fichier, apparence tournée sur page pivotée, formulaires AcroForm /V + NeedAppearances, XFA/JavaScript, PKCS#12 AES/3DES/ECDSA, signature CMS vérifiée par OpenSSL, intégrité ByteRange, recherche regex/casse/remplacement, liens sûrs, pièces jointes, calques, signets, voix, menus contextuels, compression de repli, caviardage de repli).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur dans `packages/pdf`.
- Banc navigateur (Chromium sans interface, pilote CDP brut, souris/clavier/tactile réels), PDF de 3 pages (une /Rotate 90) avec annotations écrites par l'appli, formulaire, liens, pièce jointe, calque, signets. Exercé et regardé : sélection/déplacement/couleur/suppression d'annotations du fichier puis Ctrl+S et relecture du fichier enregistré ; outils d'édition sur affichage tourné ; couche de texte alignée aux 4 rotations et à plusieurs zooms (page /Rotate 90 comprise) ; recherche regex/casse ; liens (confirmation, saut interne) ; signets (ajout, renommage, déplacement) ; pièce jointe enregistrée ; calque basculé ; formulaire rempli (texte, case, radio, liste) puis relu ; champ de signature vide signé ; signature numérique par l'interface puis vérification ; réorganisation de miniatures à la souris ET au doigt (poignée) ; annuler/rétablir (annotation, ordre des pages) ; une page / deux pages / mode nuit / lecture à voix haute (synthèse simulée, fr-FR, 3 pages).
- Contrôle indépendant : `openssl cms -verify` valide la signature produite ; le lecteur PDF de Chromium (PDFium) affiche le texte libre posé sur la page pivotée à l'endroit.

## Correspondance ForgePDF -> ForgeOffice PDF

| ForgePDF | ForgeOffice |
|---|---|
| PdfViewer (affichage, zoom) | Lecteur pdf.js : canevas haute densité, calque de texte sélectionnable, zoom 10-500 %, largeur de page / page entière, deux pages, plein écran, page précédente/suivante |
| Studio : rotation avec aperçu | Rotation de l'affichage (sans toucher au fichier) + Organiser > Pivoter (pages sélectionnées) |
| Studio : Télécharger | Fichier > Enregistrer / Enregistrer sous (Ctrl+S, Ctrl+Maj+S), Imprimer (Ctrl+P) |
| Studio/PdfTools : Compresser | Outils > Compresser (natif, 4 niveaux) |
| Studio/PdfTools : Protéger AES-256 | Protéger > Protéger par mot de passe (AES-256 + autorisations : natif, sinon `@cantoo/pdf-lib` dans le navigateur ; le document passe alors en lecture seule jusqu'à « Supprimer la protection ») |
| Studio/PdfTools : Déverrouiller | Mot de passe demandé à l'ouverture ; déchiffrement natif, sinon `@cantoo/pdf-lib` (AES-256/128, RC4) ; lecture seule seulement si le déchiffrement échoue. PDF à mot de passe vide : déchiffré à l'ouverture pour rester éditable |
| RedactionEditor (biffure) | Protéger > Marquer pour caviardage + Appliquer : suppression réelle (natif) ; repli navigateur = page rastérisée avec zones noires |
| AnnotationEditor (zones de texte) | Commentaire : surligner (collé aux lignes, 5 couleurs), souligner, barrer, note, zone de texte, rectangle, ellipse, ligne, flèche, crayon, 6 tampons, couleur, épaisseur, taille ; vraies annotations PDF avec apparence |
| FormEditor (6 types de champs) | Modifier > Ajouter un champ (texte, multiligne, case, radio, liste déroulante, liste) ; Remplir le formulaire ; Aplatir |
| PatchEditor (couvrir + réécrire) | Correction de texte : natif `corriger_texte` (ancien texte retiré) ; repli navigateur = couvrir + réécrire (signalé) |
| InlineTextEditor (clic pour éditer) | Modifier > Modifier le texte : clic sur un texte de la page, saisie sur place |
| Studio/PdfTools : PDF/A | Outils > PDF/A (natif, Ghostscript) |
| Studio/PdfTools : OCR (langue, forcer) | Outils > Reconnaître le texte (natif, ocrmypdf) |
| Studio : Filigrane | Modifier > Filigrane (texte, taille, opacité, angle, pages) |
| Studio : Numérotation Bates | Modifier > Numérotation (modèle {page}/{total}, début, zéros, position, taille, pages) + En-tête et pied de page |
| Studio : organisation (glisser, monter, pivoter, supprimer) | Miniatures : glisser pour réordonner, sélection Ctrl/Maj, menu contextuel ; Organiser : pivoter, supprimer, extraire, page vierge, insérer un fichier |
| Studio : Ajouter un PDF à la fin | Organiser > Fusionner ; Découper (chaque page / toutes les N / plages, ZIP) |
| Studio : Comparer | Outils > Comparer (différences ligne à ligne) |
| Studio : Exporter images ZIP / texte | Outils > Exporter : images PNG (ZIP), texte, Word (.docx, natif) |
| History | Volet Historique : journal des actions, clic = revenir à cet état ; Annuler/Rétablir (Ctrl+Z/Y) |
| (absent) | Signets, recherche, volet Commentaires (ajoutés + existants), Propriétés du document, signature visuelle (dessinée ou tapée) |

## Nouveautés de cette passe (residus 3)

- Annotations du fichier modifiables : surlignage, soulignement, barré, note, zone de texte, formes, ligne/flèche, encre, tampons de l'appli. Elles sont relues dans /Annots (annots.ts), retirées de l'affichage pdf.js et redessinées par la couche d'édition ; les modifications restent en attente (DocState.annotEdits, annulables) puis l'ancienne annotation est remplacée à l'enregistrement. Barre flottante (couleurs, suppression), poignée de redimensionnement, réglages du ruban appliqués à l'élément sélectionné.
- Pages pivotées : texte libre, tampons, icônes de note, champs et signature restent droits à l'écran (matrice `cm`, MK/R) ; CropBox bornée par MediaBox comme pdf.js et le moteur natif ; rotation de l'affichage = calque d'édition tourné, tous les outils restent actifs.
- Formulaires : texte, cases, radios, listes, signature (champ vide -> signature dessinée posée dans le cadre) ; /V + apparences régénérées + NeedAppearances ; avis XFA et JavaScript (jamais exécuté).
- Signature numérique PKCS#7 détachée (src/sign/, ~1000 lignes, sans dépendance) : PFX AES-256/PBES2, 3DES, ECDSA/RSA, signature visible ou invisible, vérification (ByteRange, empreinte, signature du signataire, validité du certificat à la date, couverture du fichier). La chaîne n'est jamais vérifiée (aucun magasin de confiance) : avertissement permanent.
- Lecture : continu / une page / deux pages, mode nuit, voix française page par page, liens cliquables (externes confirmés, javascript: refusé), pièces jointes, calques, signets éditables, recherche regex + casse + remplacement dans les commentaires, glisser des miniatures (souris ; doigt par la poignée).
- Menus contextuels : texte sélectionné, annotation, champ, fond de page, miniature, signet (exercés au banc par clic droit réel).
- Audit du ruban (72 commandes, chacune cliquée au banc dans un navigateur neuf, effet constaté) : aucune commande sans effet ; seules restent grisées, avec leur raison, celles qui exigent le moteur de bureau (PDF/A, OCR, Word, caviardage natif/déverrouillage selon l'état). Compresser fonctionne maintenant dans le navigateur (réécriture de la structure, jamais plus gros) ; le moteur natif recompresse en plus les images.

## Reste à faire

- Dans la coquille Tauri graphique (jamais lancée ici) : compresser, protéger, déchiffrer, caviardage et correction natifs, PDF/A et OCR (outils absents sur ce PC). Seule la chaîne `convert_run_bytes` est prouvée par `cargo test`.
- Signature numérique : le fichier est réécrit en entier (pas de mise à jour incrémentale) : signer un document déjà signé invalide les signatures précédentes (avertissement affiché). RSA-PSS et clés non RSA/ECDSA non gérés ; PFX en RC2-40 refusé avec un message ; pas de signature PAdES-LTA, pas d'horodatage, pas de vérification de chaîne ni de révocation.
- Signets réécrits avec destination « page entière » (position fine et style d'origine perdus). Annotations non gérées (tampons image d'autres outils, encre à plusieurs traits, réponses, popups) restent dessinées par pdf.js, non modifiables.
- Recherche : un mot coupé entre deux fragments de texte n'est pas trouvé ; le remplacement ne touche que les commentaires (pas le texte de la page).
- Lecture à voix haute : testée avec une synthèse simulée (pas de voix dans le navigateur sans interface).
- Plein écran non testable sans interface.
