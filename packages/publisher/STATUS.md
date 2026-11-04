# packages/publisher : état (2026-11-04, version 0.1.0)

Application **Publication** (équivalent Publisher 2024). Exporte `{ info: MODULES.publisher, App }` depuis `src/index.ts`.
Construite sur l'éditeur de page `@forgeoffice/powerpoint/canvas` (CanvasEditor, PageView, ops, text) et le modèle `@forgeoffice/pptx` :
une page = une diapositive, une page maître = une disposition du masque. Aucun second moteur de rendu.

## Fait et prouvé

- `npx tsc -p packages/publisher/tsconfig.json --noEmit` : 0 erreur. `npx tsc -p tsconfig.json --noEmit` (tout le dépôt) : 0 erreur.
- `node --test packages/publisher/tests/*.test.ts` : 22 tests verts.
  - `flow.test.ts` : coupure des lignes, capacité d'une zone (colonnes), habillage carré et haut/bas, chaînage (débordement, reconstitution sans perte, stabilité), zones vides, suite d'un paragraphe coupé, suivi du curseur d'une zone à l'autre.
  - `layout.test.ts` : marges en miroir (vis-à-vis), repères de colonnes/lignes/ligne de base, magnétisme, planches, imposition 10 cartes 85 × 55 mm sur A4 et 24 étiquettes, traits de coupe, livret (4 et 8 pages), calendrier.
  - `document.test.ts` : les 13 compositions du catalogue en aller-retour .fopub, réglages conservés, publication.json hostile (bornes, types), liaison/répartition/rupture d'un article sur 2 pages, CSS d'habillage et de lettrine, CSV et publipostage, vérificateur (débordement, 50 ppp, hors page, police absente).
- Navigateur (banc `apps/web`, port 5317, Edge sans interface piloté en CDP sur le port 9571, vrais clics et frappes) :
  - catalogue Nouveau, ouverture de chaque type ; saisie dans un article : le texte repousse la suite dans la colonne liée puis sur la page 2 ;
  - liaison de deux zones par l'indicateur « A… » puis clic sur la zone vide ; boutons ◀ ▶ de navigation dans l'article ;
  - image insérée à la place d'un cadre d'image (recadrage aux proportions) ; repère créé en tirant depuis la règle ;
  - lettrine sur 3 lignes, habillage carré, modèle de couleurs « Baies », planche de deux pages en vis-à-vis (marges en miroir, numéros 2 et 3) ;
  - pages maîtres (numéro de page), publipostage : CSV importé (guillemets, point-virgule), aperçu enregistrement par enregistrement, fusion → 3 étiquettes différentes sur la feuille ;
  - impression : 10 cartes de visite par A4 avec traits de coupe, carte pliée (feuille 1 = dos + couverture, feuille 2 = intérieur) ;
  - Ctrl+S → .fopub téléchargé puis rouvert : 4 pages, vis-à-vis, article et habillage conservés ;
  - export « PDF prêt pour l'imprimeur » (300 ppp, imposé) et export .pptx.
- PowerPoint (COM, `Quit()` dans un `finally`, aucun processus restant) : le .pptx exporté de la lettre d'information s'ouvre sans réparation, 4 diapositives sur la disposition « Page maître A », textes et numéro de page de la page maître présents.
- Captures regardées et comparées à Publisher 2024 (`docs/captures/`) :
  `publication-catalogue.png`, `publication-prospectus.png`, `publication-brochure.png` (repères de 3 colonnes, onglet Création de page),
  `publication-cartes.png` (impression 10 par page), `publication-zones-chainees.png` (article chaîné, habillage, lettrine),
  `publication-publipostage.png`, `publication-planche.png` (deux pages + vérificateur de conception).

## Fonctions livrées

### Fichier
- Format natif **.fopub** : paquet OPC d'une présentation (`writePptx` / `readPptx`) + partie `publication.json`
  (type de composition, marges, colonnes, lignes, ligne de base, fonds perdus, vis-à-vis, repères de règle, articles, habillage, lettrines, imposition, source de publipostage, modèles).
  Renommé en .pptx, le fichier s'ouvre dans PowerPoint. publication.json est lu défensivement (`parseSettings`), références orphelines retirées.
- Ouverture par `props.file` (.fopub, ou .pptx importé), Ctrl+O, Ctrl+S / Maj+Ctrl+S via `services.saveFile`, `setModified`, `addRecent`, titre de fenêtre.
- Annuler / rétablir (`History` de @forgeoffice/core, 300 états, frappe fusionnée) sur l'ensemble Deck + réglages.
- Récupération après plantage : copie .fopub dans IndexedDB toutes les 30 s pendant les modifications, bandeau Restaurer / Ignorer.
- Backstage : Nouveau (pages vierges A4, A4 paysage, A3, A5, Lettre, taille personnalisée ; 13 compositions), Ouvrir, Informations, Enregistrer, Enregistrer sous (.fopub, .pptx), Imprimer (pages, imposition, traits de coupe, aperçu), Exporter (PDF, PDF imprimeur avec TrimBox/BleedBox, PNG 200 ppp, .pptx), Fermer.
- Écran Nouveau ouvert au démarrage d'une publication vierge, comme Publisher.

### Compositions (créées par code, `src/templates/`)
Prospectus A4, affiche A3, carte de visite, cartes de visite 10 par page, carte de vœux pliée (4 pages A5, imposée 2 par A4), invitation A5,
brochure trois volets A4 paysage (2 pages, repères 3 colonnes), lettre d'information 4 pages en vis-à-vis (page maître avec filet et numéro, article chaîné sur 2 colonnes et 2 pages, image habillée),
menu de restaurant, certificat A4 paysage, étiquettes d'adresse 70 × 37 mm (24 par page, champs de fusion), calendrier mensuel (12 pages, grille en tableau), bannière 1 000 × 300 mm, pages vierges.

### Mode Pages
- Volet « Navigation entre les pages » : miniatures, planches en vis-à-vis, glisser pour déplacer, menu contextuel (insérer avant/après, plusieurs pages, dupliquer, supprimer, appliquer une page maître, ignorer la page maître).
- Pages maîtres : affichage dédié, liste, nouvelle, copie, suppression ; en-tête, pied de page et numéro de page posés sur la page maître.
- Repères de marge (roses) et de colonnes/lignes (bleus) avec marges intérieure/extérieure en miroir, repères de règle (verts) créés en tirant depuis les règles, déplaçables, supprimés en les sortant ; lignes de base ; magnétisme sur les repères et les objets.
- Règles graduées en centimètres, zéro au bord de la page active. Limites des objets en pointillés. Une page / deux pages.

### Texte
- Zones chaînées : le texte déborde dans la zone suivante (même page ou autre page), recalcul à chaque modification, curseur qui suit le texte, indicateur « A… » de débordement, liaison par clic, rupture du lien (le texte revient dans la zone), boutons Précédent / Suivant.
- Habillage autour des images et formes placées au-dessus : aucun, carré, ajusté (contour elliptique), haut et bas ; rendu par flottants CSS `shape-outside`, mesuré avec la même règle pour la répartition.
- Colonnes dans une zone, marges intérieures, alignement vertical, ajustement du texte, lettrine (2 à 4 lignes, `initial-letter`).

### Ruban
- **Accueil** : presse-papiers (objets et images du système), reproduire la mise en forme, police, paragraphe, galerie de 7 styles, objets (zone de texte, image, formes, tableau), organiser (avancer, reculer, grouper, aligner, faire pivoter), rechercher / remplacer / tout sélectionner.
- **Insertion** : page (insérer, dupliquer, plusieurs), tableau, images, 68 formes en 5 groupes, icônes Fluent (SVG + PNG), blocs de construction (3 titres, 3 encadrés dont citation, 2 coupons, calendrier du mois, 2 accents), zone de texte, WordArt (6 styles), date, en-tête, pied de page, numéro de page, lien.
- **Création de page** : changer de modèle, marges, orientation, taille (7 formats + personnalisée, objets remis à l'échelle), repères (1, 2, 3 colonnes, grille, ajout, effacement, boîte de dialogue), pages en vis-à-vis, fond perdu, 16 modèles de couleurs, 10 modèles de polices, arrière-plan (teintes, dégradé, foncé, couleur ou dégradé personnalisés), pages maîtres.
- **Publipostage** : sélection des destinataires (CSV), insertion de champs « Nom », aperçu des résultats, enregistrement précédent/suivant, fusion vers une nouvelle publication ou en PDF (avec imposition).
- **Révision** : vérificateur de conception, langue.
- **Affichage** : normal, page maître, une page, deux pages, limites, repères, règles, navigation, lignes de base, magnétisme, zoom 100 %, page entière, largeur de page.
- **Onglets contextuels** : Format de zone de texte (liaison, alignement, ajustement, colonnes, lettrine, habillage, organiser, taille), Format d'image (changer l'image, luminosité, contraste, nuances de gris, transparence, rétablir, contour, effets, habillage, taille), Format de forme (formes, remplissage, contour, effets, habillage, taille), Tableau (en-tête, lignes à bandes, première colonne, trame, insérer/supprimer lignes et colonnes, fusionner, fractionner).

### Plus que Publisher
- **Vérificateur de conception** en volet, recalculé en continu : texte débordant, images sous 150 ppp, objets hors page au-delà du fond perdu, polices absentes du poste, zones de texte vides ; clic = aller à l'objet. Compteur dans la barre d'état.
- **Export prêt pour l'imprimeur** : fonds perdus (arrière-plan prolongé), traits de coupe, 300 ppp, TrimBox et BleedBox dans le PDF, imposition automatique des cartes, étiquettes et cartes pliées.

### Icônes ajoutées (`packages/ui/icons.json`)
book_template, calendar_month, card_ui, contact_card, certificate, layout_column_three, layout_column_two, link_dismiss, mail_template, mail_multiple, mail_add, tag_multiple, text_column_three, text_column_two, textbox_align_top, textbox_align_middle, textbox_align_bottom, text_box_settings, ticket_diagonal, image_border, textbox_more, layout_row_two, document_landscape_split, print_add, checkmark_circle, drop.

## Reste à faire

- **Habillage** : rendu limité à la première colonne d'une zone multicolonne et à 2 objets par zone ; « ajusté » ne suit que les ellipses (rectangle sinon). Le .pptx ne garde ni habillage, ni liaisons, ni lettrines, ni repères (PowerPoint ne les connaît pas : le texte y est déjà réparti).
- **Mesure du texte** : canvas `measureText` + 3 % de marge ; une police de repli très différente peut couper une ligne un peu tôt.
- **PDF** rastérisé (JPEG 150 ou 300 ppp) : texte non sélectionnable.
- **Fichiers Publisher .pub** (binaire) : non lus (l'extension est déclarée par MODULES).
- Orthographe : bouton informatif seulement (correcteur du système dans la saisie) ; pas de rognage interactif d'image (seulement au remplacement d'un cadre) ; pas de galerie de styles de tableau ; publipostage limité au CSV.
- L'impression `services.print()` n'a pas été déclenchée dans le banc sans interface (seul l'aperçu et l'export PDF ont été vérifiés).
