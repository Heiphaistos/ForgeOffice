# Disposition téléphone (400 x 860, tactile)

Mesuré par `apps/web/tests/e2e/flows-mobile.mjs` (parcours 6) et revu à l'œil sur la planche
`docs/captures/e2e-mobile-planche.png` (de gauche à droite et de haut en bas : Accueil, Texte, Tableur, Présentation,
Publication, Base de données, PDF, Bloc-notes, Convertisseur).

Contrôles automatiques par application : page sans défilement horizontal, aucun contrôle hors écran (hors zones qui défilent
au doigt), onglets du ruban sélectionnables par la liste du ruban compact. Seuil indicatif de toucher : 24 px dans le parcours
automatique ; cible de conception sur écran étroit ou tactile : 36 px (40 px pour les champs et la barre de formule).
Captures de la correction du 2026-11-04 (400 x 860) : `docs/captures/mobile-*.png`.

## État par application

| Application | État | Défauts restants |
|---|---|---|
| Accueil | Utilisable. Rail du bas défilant (Publication, Base, PDF, Bloc-notes, Convertisseur atteints en glissant), vignettes sur 3 colonnes | aucun |
| Texte | Utilisable. Ruban compact (Fichier + liste d'onglets + une rangée d'outils), règle masquée. La page s'ouvre ajustée à la largeur sans descendre sous 70 % (défilement horizontal en dessous), pincement à deux doigts pour zoomer | aucun |
| Tableur | Utilisable. Grille défilante, ruban compact, barre de formule et zone Nom de 40 px, champ « Taille de police » élargi, pincement à deux doigts sur la grille | le défilement de la grille au doigt reste par les barres (la grille gère elle-même ses gestes : un doigt sélectionne) |
| Présentation | Utilisable. En portrait téléphone, les miniatures passent en bandeau horizontal défilant sous la diapositive, qui prend toute la largeur (~333 px au lieu de ~215) ; notes repliables | pas de geste de pincement |
| Publication | Utilisable. S'ouvre sur « Nouveau » (par conception) ; la barre du Backstage devient un bandeau horizontal défilant ; le volet des pages devient un bandeau au-dessus de la page (zoom ajusté 34 % au lieu de 15 %) ; « Page entière », champs Largeur/Hauteur et « OK » à 36-40 px | les règles restent affichées (18 px) |
| Base de données | Écran « l'application installée est nécessaire » + démonstration : un toucher ouvre un objet du volet (plus de double-clic), le volet se replie après l'ouverture pour laisser toute la largeur, le navigateur d'enregistrements défile au doigt (boutons de 36 px) ; vérifié sur Clients, Commandes détaillées, Fiche client, État | formulaires à mise en page fixe : défilement horizontal dans la zone du formulaire |
| PDF | Utilisable. Volet latéral d'icônes, zoom par la barre d'état | gestes de pincement et de panoramique non testés |
| Bloc-notes | Utilisable. Onglets, éditeur plein écran, ruban compact | bouton de fermeture d'un onglet : 18 px |
| Convertisseur | Utilisable, à vide (zone de dépôt) comme avec une liste : après la correction, « Ouvrir », « Enregistrer » et « Retirer » tiennent à l'écran en icônes | colonnes Taille et État masquées sur téléphone (par conception) ; le format de sortie du ruban est tronqué |

## Corrections faites

- Cibles de toucher (2026-11-04) : `packages/ui` (Controls, Ribbon, StatusBar, TitleBar) passe à 36 px les boutons compacts, les champs numériques et de saisie
  (40 px), les boutons de la barre d'accès rapide, de la barre d'état (44 px de haut) et du coin du ruban ; la zone « Taille » des combos est élargie (68 px minimum).
- Zoom au pincement : `usePinchZoom` (`packages/ui/src/hooks.ts`, Pointer Events, `pinchZoom` testé dans `packages/ui/tests`) branché sur la page de Texte et la grille du Tableur.
  Mesuré avec de vrais toucher (CDP) : Texte 70 -> 196 -> 56 %, Tableur 100 -> 240 %.

- Barre d'état (`packages/ui/src/components/StatusBar.css`) : sur téléphone, groupes gauche et droit défilants au doigt au lieu de déborder, boutons
  « − / + » du zoom masqués (le pourcentage ouvre le dialogue de zoom), vues et pourcentage à 28-32 px de haut. Corrigé : le niveau de zoom et les
  boutons de vue sortaient de l'écran dans Texte, Bloc-notes et Présentation.
- Présentation (`packages/powerpoint/src/app/App.tsx`, `app.css`) : volet des diapositives de 100 px et miniatures de 64 px sous 720 px (la diapositive
  était réduite à une bande de 200 px et la miniature rognée).
- Texte (`packages/word/src/App.tsx`) : sur téléphone, la page A4 s'ouvre ajustée à la largeur (zoom 44 %) au lieu de défiler latéralement à 100 % ; le bureau reste à 100 %.
- Convertisseur (`packages/convert/src/Convert.css`) : sur téléphone, les actions de chaque ligne (Ouvrir, Enregistrer, Retirer) passent en icônes (libellé gardé pour les lecteurs d'écran) ; avant, « Enregistrer » et « Retirer » sortaient de l'écran.
- Barre de titre (`TitleBar.css`) et listes déroulantes (`ComboBox.css`) : bouton « Personnaliser la barre d'outils » et flèches de liste à 26-28 px en tactile.
