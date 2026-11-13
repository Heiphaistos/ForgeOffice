# Écarts restants avec OnlyOffice Desktop Editors 10.0 (profil OnlyOffice)

Référence : application réelle installée (D:\Tools\ONLYOFFICE), captures de sa fenêtre seule (`scripts/oo-ref/winshot.py`, PrintWindow) dans `10.0/` ;
couleurs et cotes relevées dans ses variables de thème (`scripts/oo-ref/extract-themes.py` -> `onlyoffice-themes.css`). Mise à jour : 2026-11-13.

| Zone | État | Écart |
|---|---|---|
| Thèmes | fait | Classique clair, Clair, Sombre, Contraste sombre = variables exactes de l'application ; « Selon le thème de la suite » par défaut (menu Disposition) |
| Géométrie | fait | rangée fenêtre 35, entête 28, onglets 28 (13 px), barre 84 (66 en Classique), état 32 (25), petits boutons 24/20, champs 24/22, rayon 8/0 |
| Onglets | partiel | ordre et libellés français réels (Dessiner, Collaboration, Modules complémentaires) ; pas d'onglet « Outils IA », « Dessiner » du Tableur, ni de vrai module complémentaire (Modules = Publipostage) |
| Contenu des groupes | fait (Texte, Tableur, Présentation) / partiel (PDF) | groupes, ordre, tailles et rangées décrits d'après la vraie appli (`onlyofficeWord.ts`, `onlyofficeSheets.ts`) ; bouton OnlyOffice absent chez nous = bouton grisé avec infobulle « Pas encore disponible dans ForgeOffice » ; commandes à nous sans équivalent = groupe « Plus » (menu) de l'onglet ; presse-papiers à gauche de chaque onglet. Non vérifiés onglet par onglet : Références/Dessiner/Données/Mise en page du Tableur et de la Présentation à 1 px près ; PDF : seul Accueil est décrit (Commentaire, Modifier… gardent nos groupes) ; onglets « Outils IA » absent |
| Taille des boutons | partiel | Accueil sans grand bouton (comme OnlyOffice) ; autres onglets : tailles de notre schéma |
| Galerie de styles | fait | cases blanches 108 x 44 ; l'aperçu ne reprend pas la police du style |
| Rail droit | partiel | 7 icônes d'objet permanentes ; panneau « Paramètres » en formulaire (sections titrées, libellé à gauche, champs à droite, boutons d'icônes côte à côte) avec NOS commandes branchées ; pas les formulaires propres d'OnlyOffice (champs et sections différents : ex. Paragraphe = groupes Police/Paragraphe de la suite) |
| Rail gauche | partiel | Rechercher, Commentaires, Navigation, Annonces (grisé) ; PDF : Miniatures/Signets |
| Fichier | partiel | libellés d'OnlyOffice + pages Aide et À propos ; « Infos sur le document », « Paramètres avancés », Récents = pages de la suite |
| Rangée fenêtre | partiel | logo ForgeOffice, Accueil, onglet + croix ; un seul onglet de document ; pas d'avatar ni « Ouvrir l'emplacement » |
| Barre d'état | fait (Texte) | « Statistiques » (ouvre le comptage), langue, vues, zoom ; autres modules : éléments propres |
| Icônes | écart | icônes Fluent (trait, 20 px) ; formes différentes de celles d'OnlyOffice |
| Boîtes de dialogue, menus déroulants | écart | non captés ni reproduits un par un |
| Mobile < 900 px | ok | bande défilante inchangée, pas de débordement (390 px) |

## Licence des icônes (à décider par Momo)
ForgeOffice est sous PolyForm Noncommercial 1.0.0 ; les sources d'OnlyOffice (web-apps, sdkjs) et leurs icônes sont sous AGPLv3 : incompatible avec une redistribution sous PolyForm NC.
Aucun fichier d'icône, CSS ni code d'OnlyOffice n'est copié. Seules des valeurs de mesure (couleurs, tailles) ont été relevées dans l'application installée.
Redessiner à la main des icônes « visuellement équivalentes » est une œuvre dérivée si elles reprennent la forme au pixel près ; la marque ONLYOFFICE et son logo restent à ne jamais afficher.

## Mise à jour (passe 3)
- PDF décrit en entier : Accueil, Commentaire, Collaboration, Affichage d'après la vraie appli ; Modifier, Organiser, Protection, Outils (fonctions de la suite) conservés à la suite.
- Thèmes réels de l'appli (liste relevée) : Identique à système, Moderne clair (= white), Moderne sombre, Clair, Classique clair, Sombre, Contraste élevé sombre, Gris. « Clair » n'est pas identifié (pas de variables correspondantes). Moderne clair capturé dans la vraie appli (`10.0/word-*-moderne-clair.png`) et comparé : structure identique.
- Non fait : boîtes de dialogue (Paragraphe, Police, Insérer un tableau, Enregistrer sous) et menus déroulants un par un ; formulaires exacts d'OnlyOffice du rail droit ; contenu exact de « Paramètres avancés » ; vérification au pixel de Références, Dessiner, Données, Mise en page (comparés à l'œil sur planches, écarts d'icônes et de largeurs de libellés).
- Attention : le réglage de thème de l'OnlyOffice installé a été changé pendant les captures (Moderne clair) et n'a pas pu être remis sur « Identique à système » (le changement ne s'applique pas à la relance) ; à remettre dans Fichier > Paramètres avancés > Apparence.

## Mise à jour (passe 4, branche oo-dialogs)
Captures de référence ajoutées (10.0/) : `dlg-paragraphe-avances.png`, `dlg-paragraphe-onglets.png` (les 5 autres pages), `dlg-taille-tableau.png`, `dlg-lien.png`, `menu-tableau.png` (grille 10 x 8 + 5 entrées), `fichier-info.png`, `fichier-parametres-avances.png`, `panneau-paragraphe.png`. Thème de l'appli installée remis sur « Identique à système » (Paramètres de l'écran d'accueil, liste ouverte par clic réel puis Haut + Entrée + Appliquer, vérifié sur capture).

| Zone | État | Détail |
|---|---|---|
| Boîtes de dialogue (habillage) | fait, toutes les boîtes | titre centré gras, croix, filets, OK bleu / Annuler à bordure, boutons centrés, sans voile (`onlyoffice-dialogs.css`) ; autres dispositions inchangées |
| Paragraphe - Paramètres avancés | fait (Texte) | 6 pages d'OnlyOffice : Retraits et espacement, Sauts de ligne et de page, Bordures et remplissage (fond branché, bordures = notre boîte), Police (effets branchés), Tabulation (= notre boîte), Marges intérieures (grisées : pas de fonction) ; Direction droite à gauche grisée |
| Taille du tableau, Paramètres du lien | fait (Texte) | champs et titres d'OnlyOffice, branchés |
| Panneau Paramètres du paragraphe | fait (Texte) | Interligne (menu de la suite, pas le couple Multiple + valeur), Espacement avant/après en cm, case intervalle (grisée tant que la commande n'existe pas), Retraits gauche/droite/Spécial, Couleur d'arrière-plan, lien « Afficher les paramètres avancés » |
| Fichier : ordre et libellés | fait (tous modules) | Retour, Nouveau document, Créer à partir d'un modèle, Ouvrir, Ouvrir récent, Enregistrer, Enregistrer sous, Imprimer, Info, Ouvrir l'emplacement du fichier (grisé : pas de fonction), Fermer ; bas : Paramètres avancés, Aide, Proposer une fonctionnalité (grisé) ; Accueil/Exporter/Partager/Compte gardés |
| Infos sur le document | fait (Texte) | Communs, Statistiques, Propriétés (champs branchés sur les propriétés du document) |
| Paramètres avancés | partiel (Texte) | sections d'OnlyOffice ; branchés : Vérification orthographique, Correction automatique, Thème d'interface (8 thèmes réels) ; le reste grisé avec infobulle ; nos options en plus sous « Options de ForgeOffice » ; Appliquer ferme la vue (réglages immédiats) |
| Reste non fait | | Police (boîte seule), Enregistrer sous / Ouvrir (pages de Fichier), Propriétés du tableau, Paramètres de la page, Rechercher/Remplacer, Format de cellule (Tableur) : habillage OnlyOffice appliqué, contenu = nos champs ; menus déroulants un par un (couleurs, puces, tableaux, formes, styles) ; panneaux image/forme/graphique/Text Art/Tableur/Présentation ; barre d'état Tableur/Présentation/PDF ; onglet Outils IA ; Dessiner du Tableur ; catalogue Modules ; avatar et « Ouvrir l'emplacement » (aucune fonction revealInFolder dans la suite) ; vérification au pixel Références/Dessiner/Données/Mise en page |

## Mise à jour (passe 5, branche oo-rest)
Captures ajoutées (10.0/) : `panneau-tableur-cellule.png`, `panneau-tableur-pivot.png`, `panneau-presentation-diapositive.png`, `fichier-info-*`, `fichier-avances-*` (Tableur, Présentation), `onglet-outils-ia.png`, `onglet-modules.png`, `tableur-dessiner.png`, `*-accueil-etat.png`. Les libellés et la structure des panneaux viennent des gabarits et de la localisation FR de l'application installée (lus, rien copié).

| Zone | État | Détail |
|---|---|---|
| Panneaux Paramètres (moteur) | fait | `OnlyOfficeForms.tsx` + `logic/onlyofficeForms.ts` : formulaire décrit en données (sections, champs, unités), champ branché sur une commande du ruban (`onglet:id`, `id`, `commande>entrée`), grisé sinon ; rail droit propre à chaque module (Texte, Tableur : cellule/forme/image/texte/Text Art/graphique/signature/tableau croisé, Présentation : diapositive/forme/image/texte/tableau/Text Art) ; carte de 224 px à 8 px du document |
| Texte : image | fait | Taille, Opacité (grisée), Rotation/Retournement, Style d'habillage, Remplacer, Convertir en forme (grisé), lien avancé = texte de remplacement |
| Texte : Interligne du panneau Paragraphe | fait | « Multiple » / « Au moins » / « Exactement » + valeur (cm hors Multiple), branché sur `lineSpacing` |
| Tableur : cellule | fait | Remplissage, Style des bordures (12 boutons, 8 branchés), Retrait, Angle, Habillage, Réduire pour ajuster, Mise en forme conditionnelle |
| Tableur : tableau croisé | fait | Sélectionner les champs + 4 zones, branché sur la définition du TCD (cocher, déplacer, glisser) ; le volet de champs d'origine est masqué dans ce profil |
| Tableur : forme, graphique ; Présentation : diapositive, forme, image, graphique | fait (structure) | formulaires d'OnlyOffice, commandes branchées quand elles existent (remplissage, contour, rotation, type du graphique, taille de l'image...), le reste grisé |
| Présentation : transition | sans objet | OnlyOffice n'a PAS de panneau Transition dans le rail droit (onglet Transitions seulement) ; rail de la Présentation = diapositive, forme, image, texte, tableau, Text Art |
| Vue Fichier Tableur/Présentation | fait | pages Infos (Communs, Propriétés) et Paramètres avancés (sections réelles, thème branché), libellés « Nouveau classeur », « Nouvelle présentation », « Infos », « Exporter dans le format PDF » ; composants communs `OnlyOfficeBackstage.tsx` (Texte refait dessus) |
| Boîte Format de nombre (Ctrl+1) | fait | OnlyOffice n'a pas de « Format de cellule » à 6 onglets : Ctrl+1 ouvre « Format de nombre » (catégorie en liste, décimales, séparateur de milliers) ; la boîte à 6 onglets reste par le menu |
| Menus déroulants | partiel | fond de la barre d'outils (les menus étaient BLANCS en thème sombre : corrigé), lignes de 26 px, palette de couleurs (166 px, Pipette grisée, « Plus de couleurs »), bibliothèque de puces en grille, interligne (1.0, 1.15..., ajout d'espace avant/après) ; restent : numérotation en grille, liste à plusieurs niveaux, surlignage, styles, formes, graphique, bordures, alignement |
| Barre d'état | fait | « - Zoom N % + » sans curseur, « Page 1 de 1 » / « Diapositive 1 de 1 », langue poussée à droite, onglets de feuilles du Tableur dans la barre (+ avant les onglets) ; pas de liste des feuilles ni de résumé de sélection au même endroit |
| Onglets | fait | Outils IA (boutons grisés : Paramètres, Chat IA, Résumer, Traduire), Modules complémentaires (Gestionnaire, Photo Editor, YouTube, Traducteur, Envoyer, Thésaurus, Code en surbrillance grisés ; le Publipostage reste), Dessiner du Tableur (boutons grisés) |
| Rangée fenêtre | partiel | bouton « Ouvrir l'emplacement du fichier » présent mais grisé (aucune fonction revealInFolder dans la suite) ; pas d'avatar |
| Pas fait | | Paramètres de la page (Tableur), Propriétés du tableau, boîte Police seule, Enregistrer sous/Ouvrir (pages de Fichier), Rechercher/Remplacer (le rail gauche de recherche d'OnlyOffice n'est pas reproduit), mesure au pixel Références/Dessiner/Données/Mise en page (comparées sur planche : Données et Mise en page du Tableur, écarts d'icônes et de libellés), Protéger dans le menu Fichier, mobile-coverage Tableur : « Échelle » 131 x 42 (cible < 44 px, antérieur à cette passe) |

## Mise à jour (passe 6, branche oo-gaps)
Captures ajoutées (10.0/) : `dlg-marges.png`, `menu-marges.png`, `dlg-tableau-avance-tableau.png`, `dlg-tableau-avance-pages.png`, `dlg-marges-tableur.png`, `menu-marges-tableur.png`. Seules des valeurs, libellés et structures sont relevés ; aucune icône, CSS ni code d'OnlyOffice n'est copié.

| Zone | État | Détail |
|---|---|---|
| Boîte « Marges » (Texte) | fait | Haut/Bas/Gauche/Droite, Position de la reliure, Orientation, Plusieurs pages (grisé), Aperçu ; lien « Plus d'options de page… » = boîte complète d'origine (taille, colonnes, en-têtes) |
| Boîte « Tableau - Paramètres avancés » | fait (Texte) | 6 pages d'OnlyOffice ; Position du tableau grisée comme dans l'appli (tableau dans le texte) ; branchés : largeur, alignement, largeur de colonne, texte de remplacement ; grisés : marges de cellules, espacement, habillage flottant ; nos réglages de ligne/cellule gardés sous « Options de ForgeOffice » |
| « Marges » et « En-tête/pied de page » du Tableur | fait | boîtes d'OnlyOffice (Marges + Centrer sur la page ; Paramètres de l'en-tête/pied de page : 4 options, onglets de variantes, zones gauche/centre/droite) branchées sur la copie de travail de la boîte Mise en page ; Page et Feuille gardent la boîte d'origine ; le bouton En-tête/Pied de page du ruban n'est plus grisé |
| Menus Mise en page (Texte) | fait | Marges (Normal/Étroit/Modéré/Large, deux lignes), Taille (13 formats d'OnlyOffice), Colonnes, Numéros de ligne (6 entrées), Coupure de mots (Aucun/Automatique) |
| Menus Accueil (Texte) | fait | Numérotations et listes à plusieurs niveaux (cases de 82 px avec aperçu à 3 lignes ; 4 cases liées aux titres grisées), surlignage (4 x 4 + Aucun remplissage), bordures (9 entrées), casse, grille Tableau (cases vides à bordure, 5 entrées) |
| Fichier | fait | « Protéger » entre Imprimer et Info (ouvre la page Infos, où se trouve la protection) |
| Avatar | fait | disque de 20 px à droite de la ligne du titre (initiale du réglage `user.name`, sinon silhouette) |
| Plusieurs documents | fait | en mode onglets, la bande de l'hôte prend la place de la rangée fenêtre (logo, onglets, boutons) ; l'onglet affiché pose son `data-app` avant son rendu (le profil OnlyOffice perdait ses onglets propres en mode « onglet partagé ») |
| Mobile Tableur « Échelle » 131 x 42 | corrigé | cause : bordure de 1 px du champ du profil OnlyOffice ; l'anomalie existait donc sur main (profil OnlyOffice seulement) ; `.fo-band__cell .fo-number input { min-height: 44px }` |
| Reste | | « Propriétés du tableau » : marges de cellules et habillage flottant grisés ; Enregistrer sous/Ouvrir : l'appli réelle utilise l'explorateur natif (notre vue Fichier est déjà habillée) ; menus Styles/formes/graphique/alignement ; mesure au pixel Références/Dessiner/Données ; Rechercher/Remplacer ; thème : l'appli réelle est restée sur son réglage d'origine |

## Mise à jour (passe 7, branche oo-gaps2)
Comparaison faite fenêtre contre fenêtre (PrintWindow de l'OnlyOffice Desktop 10.0 installé dans D:\Tools\ONLYOFFICE, thème sombre, documents neufs `--new:word|cell|slide` et un PDF d'une page ; aucune icône, CSS ni code d'OnlyOffice n'est copié, seuls libellés, structures et valeurs sont relevés).

| Zone | État | Détail |
|---|---|---|
| Réglage `user.name` | fait | champ « Nom d'utilisateur (avatar) » sous « Options de ForgeOffice » des Paramètres avancés (tous modules) ; la pastille de la rangée fenêtre se met à jour tout de suite |
| Menu Sauts (Texte) | fait | « Insérer un saut de page », « Insérer un saut de colonne », « Insérer saut de section » > Page suivante / continue / paire / impaire |
| Rechercher et remplacer (Texte) | fait | colonne de 300 px à droite du rail gauche (pas une boîte modale) : champ + précédent/suivant, Remplacer par, Remplacer / Remplacer tout, Sensible à la casse, Mots entiers, expressions régulières, « Résultats de la recherche : n/m », surlignage en direct ; Ctrl+F, Ctrl+H, bouton du rail et bouton Rechercher ouvrent ce panneau ; sur petit écran (< 700 px) la boîte modale d'origine est gardée |
| Propriétés du tableau (Texte) | fait en partie | marges de cellules par défaut, marges d'une cellule (« Utiliser marges par défaut ») et espacement entre cellules branchés et rendus dans l'éditeur (variables `--fo-cm-*`, `border-spacing`) ; **Position du tableau et habillage flottant restent grisés** : le moteur ne garde qu'un `w:tblpPr` brut, sans mise en page flottante |
| Menu Styles | fait | tuiles de 108 x 42 portant le nom du style (Normal, Aucun espace, Titre 1...), galerie dépliée 5 colonnes, pied « Nouveau style à partir du fragment sélectionné » |
| Menu Forme (Texte) | fait en partie | grille de glyphes de 24 px avec les titres d'OnlyOffice (Formes de base, Flèches figurées, Étoiles et rubans, Légendes, Lignes) ; **seules les 16 formes que le moteur sait dessiner y figurent** (OnlyOffice en propose environ 190) |
| Menu Graphique, SmartArt (Texte) | non fait | le Texte n'a pas d'objet graphique : boutons restent grisés, aucun menu à copier |
| Alignement (Organiser) | non fait | « Aligner » est grisé sans objet sélectionné dans les deux applis ; le menu s'ouvre seulement sur une forme, non comparé |
| Mise en page (Texte) | fait | libellés « Retrait gauche / Retrait droit / Espacement avant / Espacement après » affichés, colonnes (gauche + avant)/(droit + après), espacement en cm comme l'appli |
| Références (Texte) | fait | « Ajouter du texte » et « Mettre à jour la table » empilés avec leur texte, « Table des figures » et « Mettre à jour la table » empilés |
| Dessiner (Texte) | fait | Sélectionner (grisé), 3 stylos (vert, rouge, surligneur jaune) avec barre de couleur, Gomme (grisée) ; les autres stylos et « Dessiner » passent dans « Plus » |
| Formule (Tableur) | fait en partie | Tracer précédents/dépendants et Supprimer les flèches/Afficher les formules en grille 2 x 2 ; **les libellés de ces 4 boutons ne tiennent pas à 1440 px** (le ruban passerait en petites icônes) : icônes seules |
| Données (Tableur) | comparé | même ordre de groupes que l'appli (Obtenir, Liens externes, filtre/tri, Tri personnalisé, Texte en colonnes, Doublons, Validation, Valeur cible, Solveur, Grouper, Dissocier) |
| Onglets Présentation | fait | l'onglet « Diaporama » (absent d'OnlyOffice) est fondu dans Affichage |
| PDF | comparé, non corrigé | Accueil : OnlyOffice a le champ de page « 1 / 1 », premier/précédent/suivant/dernier et le zoom en liste ; chez nous flèches et boutons de zoom ; **le panneau latéral du module PDF (miniatures ouvertes, 2e rail) reste** : il porte des panneaux (recherche, pièces jointes, calques, signatures, historique) que le rail d'OnlyOffice n'a pas |
| Présentation : volet des diapositives et notes | non corrigé | miniatures plus larges (260 px) et notes plus basses dans l'appli ; textes d'espace réservé « Titre de la diapositive » |

## Mise à jour (passe 8, branche oo-gaps3)
Comparaison fenêtre contre fenêtre (PrintWindow de l'OnlyOffice Desktop 10.0, thème sombre, documents neufs `--new:slide|cell` et un PDF de 3 pages côté ForgeOffice).

| Zone | État | Détail |
|---|---|---|
| PDF : Accueil | fait | champ de page « 1 / N » (saisie, Entrée valide), premier/précédent/suivant/dernier, zoom en liste déroulante éditable (50 à 500 %, saisie libre 10 à 800), « Ajuster à la page / à la largeur » avec leur texte ; seulement dans le profil OnlyOffice (les autres dispositions gardent flèches et boutons de zoom) |
| PDF : volets | fait | un seul rail (celui de la fenêtre : Rechercher, Commentaires, Titres, Miniatures, Annonces), plus de second rail ; aucun volet ouvert au démarrage ; Pièces jointes, Calques, Signatures et Signets sont des boutons du groupe « Volets » de l'onglet Organiser |
| Présentation | fait | volet des diapositives de 260 px, bande de notes de 38 px (texte 16 px), « Commentaires » et « Présenter » retirés de l'en-tête (absents de l'appli : le rail et la barre rapide les portent) ; zoom « ajuster » recalculé avec la vraie marge de 48 px et les barres de défilement (plus de barre horizontale parasite) |
| Tableur : Formule | fait | les 4 boutons d'audit gardent leur texte à 1440 px sans repli du ruban : les intitulés des grands boutons se coupent en deux lignes équilibrées (comme « Texte et / données »), les boutons sont donc plus étroits |
| Tableur : Données | comparé | même ordre de groupes ; écarts restants : « Tri personnalisé » sur une ligne (deux chez OnlyOffice), espacement des colonnes de filtre/tri plus serré |
| Texte : Dessiner / Références | non remesuré | pas d'écart visible lors de cette passe |
