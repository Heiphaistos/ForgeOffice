# packages/pdf : état (2026-11-04)

Module PDF de ForgeOffice : lecteur pdf.js + édition façon Acrobat, interface Office 2024 (ruban Fichier, Accueil,
Commentaire, Modifier, Organiser, Protéger, Outils ; rail Miniatures / Signets / Rechercher / Commentaires / Historique).
Écriture en TypeScript avec pdf-lib ; opérations lourdes par le moteur natif `forge-convert` (coquille de bureau,
commande `convert_run_bytes`) ; ce qui manque est grisé avec la raison de `capacites()`.

## Vérifications

- `node --test packages/pdf/tests/*.test.ts` : 6 tests (coordonnées selon /Rotate, surlignage collé au texte, recherche
  sans accents, comparaison, écriture des annotations réelles avec apparence, formulaires créés/remplis/relus/aplatis).
- `npx tsc -p tsconfig.json --noEmit` : 0 erreur dans `packages/pdf`.
- Banc navigateur (Edge sans interface, port 5316), vrai PDF imprimé par Edge (2 pages, signets, champs ajoutés) :
  captures `docs/captures/pdf-*.png` regardées. Exercé : ouverture, miniatures, recherche « atelier » (2 résultats + surlignage),
  surlignage/rectangle/note/crayon, ellipse + zone de texte puis Ctrl+S (annotations relues par pdf.js depuis le fichier écrit),
  rotation de page, saisie d'un champ, marquage de caviardage, signature dessinée.

## Correspondance ForgePDF -> ForgeOffice PDF

| ForgePDF | ForgeOffice |
|---|---|
| PdfViewer (affichage, zoom) | Lecteur pdf.js : canevas haute densité, calque de texte sélectionnable, zoom 10-500 %, largeur de page / page entière, deux pages, plein écran, page précédente/suivante |
| Studio : rotation avec aperçu | Rotation de l'affichage (sans toucher au fichier) + Organiser > Pivoter (pages sélectionnées) |
| Studio : Télécharger | Fichier > Enregistrer / Enregistrer sous (Ctrl+S, Ctrl+Maj+S), Imprimer (Ctrl+P) |
| Studio/PdfTools : Compresser | Outils > Compresser (natif, 4 niveaux) |
| Studio/PdfTools : Protéger AES-256 | Protéger > Protéger par mot de passe (natif : AES-256 + autorisations) |
| Studio/PdfTools : Déverrouiller | Mot de passe demandé à l'ouverture ; déchiffrement natif ; sinon lecture seule |
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

## Reste à faire

- Dans la coquille Tauri graphique (jamais lancée ici) : compresser, protéger, déchiffrer, caviardage et correction natifs,
  PDF/A et OCR (outils absents sur ce PC). Seule la chaîne `convert_run_bytes` est prouvée par `cargo test`.
- Annotations existantes du fichier : affichées et listées, pas encore modifiables ni supprimables.
- Pages à /Rotate : éléments posés au bon endroit (testé) mais les zones de texte libre restent orientées comme la page non pivotée.
- Rotation de l'affichage : outils d'édition désactivés tant que l'affichage n'est pas droit.
- Glisser-déposer des miniatures et Annuler/Rétablir non exercés au banc (code seulement).
